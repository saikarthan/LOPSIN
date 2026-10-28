import { Router } from 'express'
import { collection, COLLECTIONS } from '../db/index.js'
import { requireUser, requireRole } from '../middleware/auth.js'
import { ApiError, asyncRoute } from '../middleware/errorHandler.js'
import { newId, nowIso } from '../utils/ids.js'
import { recordAudit } from '../utils/audit.js'

const router = Router()

export const TICKET_STATUSES = ['OPEN', 'IN_PROGRESS', 'BLOCKED', 'RESOLVED', 'CLOSED']
const SYSTEMS = ['JIRA', 'GITHUB', 'SLACK', 'MANUAL']

const SLA_DAYS = { CRITICAL: 7, HIGH: 14, MEDIUM: 30, LOW: 90 }

/** Mirrors the key format each downstream tool would hand back. */
function externalKeyFor(system, integration, sequence) {
  switch (system) {
    case 'JIRA': return `${integration?.config?.projectKey || 'COMP'}-${1000 + sequence}`
    case 'GITHUB': return `${integration?.config?.repository || 'org/compliance'}#${100 + sequence}`
    case 'SLACK': return `${integration?.config?.channel || '#compliance'}/${Date.now()}`
    default: return `MANUAL-${1000 + sequence}`
  }
}

router.get(
  '/',
  requireUser,
  asyncRoute(async (req, res) => {
    const query = { orgId: req.user.orgId }
    if (req.query.status) query.status = String(req.query.status).toUpperCase()
    const tickets = await collection(COLLECTIONS.tickets).find(query, { sort: { createdAt: -1 } })
    res.json(tickets)
  })
)

/**
 * Orchestration layer: turn a finding into work in the tool the team already uses.
 * The ticket carries the control reference and the remediation guidance, never data.
 */
router.post(
  '/',
  requireUser,
  requireRole('ADMIN', 'COMPLIANCE'),
  asyncRoute(async (req, res) => {
    const findingId = String(req.body?.findingId || '')
    const system = String(req.body?.system || 'JIRA').toUpperCase()
    const assignee = String(req.body?.assignee || '').trim()

    if (!SYSTEMS.includes(system)) throw new ApiError(400, `System must be one of: ${SYSTEMS.join(', ')}`)

    const finding = await collection(COLLECTIONS.findings).findOne({ id: findingId, orgId: req.user.orgId })
    if (!finding) throw new ApiError(404, 'Finding not found')
    if (finding.status !== 'FAIL' && finding.status !== 'WARN') {
      throw new ApiError(400, 'Only failing or drifting controls can be sent for remediation')
    }

    const duplicate = await collection(COLLECTIONS.tickets).findOne({
      findingId,
      status: { $nin: ['RESOLVED', 'CLOSED'] },
    })
    if (duplicate) throw new ApiError(409, `An open ${duplicate.system} ticket already exists for this finding`)

    if (system !== 'MANUAL') {
      const integration = await collection(COLLECTIONS.integrations).findOne({
        orgId: req.user.orgId,
        system,
      })
      if (!integration || integration.status !== 'CONNECTED') {
        throw new ApiError(400, `${system} is not connected. Connect it under Integrations first.`)
      }
    }

    const integration = await collection(COLLECTIONS.integrations).findOne({ orgId: req.user.orgId, system })
    const sequence = await collection(COLLECTIONS.tickets).countDocuments({ orgId: req.user.orgId })
    const slaDays = SLA_DAYS[finding.severity] || 30
    const at = nowIso()

    const ticket = {
      id: newId('tkt'),
      orgId: req.user.orgId,
      findingId,
      checkCode: finding.checkCode,
      frameworkCode: finding.frameworkCode,
      controlCode: finding.controlCode,
      severity: finding.severity,
      system,
      externalKey: externalKeyFor(system, integration, sequence),
      title: `[${finding.frameworkCode} ${finding.controlCode}] ${finding.title}`,
      description: `${finding.detail}\n\nRemediation: ${finding.remediation}\n\nWhy it matters: ${finding.rationale}`,
      status: 'OPEN',
      assignee: assignee || null,
      dueAt: new Date(Date.now() + slaDays * 86400000).toISOString(),
      createdBy: req.user.email,
      createdAt: at,
      updatedAt: at,
      history: [{ at, actor: req.user.email, from: null, to: 'OPEN', note: 'Ticket raised from Lopsin finding' }],
    }

    await collection(COLLECTIONS.tickets).insertOne(ticket)
    await recordAudit({
      orgId: req.user.orgId,
      actor: req.user.email,
      actorRole: req.user.role,
      action: 'REMEDIATION_TICKET_CREATED',
      target: ticket.id,
      detail: `${system} ${ticket.externalKey} for ${finding.checkCode}`,
    })
    res.status(201).json(ticket)
  })
)

router.put(
  '/:id/status',
  requireUser,
  requireRole('ADMIN', 'COMPLIANCE'),
  asyncRoute(async (req, res) => {
    const status = String(req.body?.status || '').toUpperCase()
    const note = String(req.body?.note || '').slice(0, 280)
    if (!TICKET_STATUSES.includes(status)) {
      throw new ApiError(400, `Status must be one of: ${TICKET_STATUSES.join(', ')}`)
    }

    const ticket = await collection(COLLECTIONS.tickets).findOne({ id: req.params.id, orgId: req.user.orgId })
    if (!ticket) throw new ApiError(404, 'Ticket not found')
    if (ticket.status === status) return res.json(ticket)

    const at = nowIso()
    const entry = { at, actor: req.user.email, from: ticket.status, to: status, note: note || null }
    await collection(COLLECTIONS.tickets).updateOne(
      { id: ticket.id },
      { $set: { status, updatedAt: at }, $push: { history: entry } }
    )
    await recordAudit({
      orgId: req.user.orgId,
      actor: req.user.email,
      actorRole: req.user.role,
      action: 'REMEDIATION_STATUS_CHANGED',
      target: ticket.id,
      detail: `${ticket.status} -> ${status}`,
    })

    const updated = await collection(COLLECTIONS.tickets).findOne({ id: ticket.id })
    res.json(updated)
  })
)

router.delete(
  '/:id',
  requireUser,
  requireRole('ADMIN', 'COMPLIANCE'),
  asyncRoute(async (req, res) => {
    const result = await collection(COLLECTIONS.tickets).deleteOne({ id: req.params.id, orgId: req.user.orgId })
    if (!result.deletedCount) throw new ApiError(404, 'Ticket not found')
    await recordAudit({
      orgId: req.user.orgId,
      actor: req.user.email,
      actorRole: req.user.role,
      action: 'REMEDIATION_TICKET_DELETED',
      target: req.params.id,
    })
    res.status(204).end()
  })
)

export default router
