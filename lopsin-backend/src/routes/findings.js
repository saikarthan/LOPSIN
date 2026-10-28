import { Router } from 'express'
import { collection, COLLECTIONS } from '../db/index.js'
import { requireUser, requireRole } from '../middleware/auth.js'
import { ApiError, asyncRoute } from '../middleware/errorHandler.js'
import { runScan, latestSignals } from '../engine/scanner.js'
import { recordAudit } from '../utils/audit.js'
import { SEVERITY_WEIGHT } from '../catalog/regulations.js'
import { draftRemediationPlan, advisorStatus } from '../engine/advisor.js'

const router = Router()

router.get(
  '/',
  requireUser,
  asyncRoute(async (req, res) => {
    const query = { orgId: req.user.orgId }
    if (req.query.status) query.status = String(req.query.status).toUpperCase()
    if (req.query.severity) query.severity = String(req.query.severity).toUpperCase()
    if (req.query.framework) query.frameworkCode = String(req.query.framework).toUpperCase()

    const findings = await collection(COLLECTIONS.findings).find(query)
    const tickets = await collection(COLLECTIONS.tickets).find({ orgId: req.user.orgId })
    const ticketByFinding = new Map(tickets.map((ticket) => [ticket.findingId, ticket]))

    const ordered = findings.sort((a, b) => {
      const statusRank = { FAIL: 0, WARN: 1, NOT_APPLICABLE: 2, PASS: 3 }
      if (statusRank[a.status] !== statusRank[b.status]) return statusRank[a.status] - statusRank[b.status]
      return (SEVERITY_WEIGHT[b.severity] || 0) - (SEVERITY_WEIGHT[a.severity] || 0)
    })

    res.json(
      ordered.map((finding) => ({
        ...finding,
        ticket: ticketByFinding.get(finding.id)
          ? {
              id: ticketByFinding.get(finding.id).id,
              system: ticketByFinding.get(finding.id).system,
              externalKey: ticketByFinding.get(finding.id).externalKey,
              status: ticketByFinding.get(finding.id).status,
            }
          : null,
      }))
    )
  })
)

router.get(
  '/:id',
  requireUser,
  asyncRoute(async (req, res) => {
    const finding = await collection(COLLECTIONS.findings).findOne({
      id: req.params.id,
      orgId: req.user.orgId,
    })
    if (!finding) throw new ApiError(404, 'Finding not found')

    const evidence = finding.evidenceSignalId
      ? await collection(COLLECTIONS.signals).findOne({ id: finding.evidenceSignalId })
      : null
    const ticket = await collection(COLLECTIONS.tickets).findOne({ findingId: finding.id })

    res.json({ ...finding, evidence, ticket })
  })
)

/** Manual re-evaluation from the console. */
router.post(
  '/scan',
  requireUser,
  requireRole('ADMIN', 'COMPLIANCE'),
  asyncRoute(async (req, res) => {
    const outcome = await runScan(req.user.orgId, { triggeredBy: req.user.email })
    await recordAudit({
      orgId: req.user.orgId,
      actor: req.user.email,
      actorRole: req.user.role,
      action: 'SCAN_RUN',
      target: outcome.scan.id,
      detail: `${outcome.summary.failed} failing of ${outcome.summary.total} checks`,
    })
    res.json({ scan: outcome.scan, summary: outcome.summary })
  })
)

/** Evidence register - the metadata Lopsin actually holds, and nothing else. */
router.get(
  '/evidence/signals',
  requireUser,
  asyncRoute(async (req, res) => {
    const latest = await latestSignals(req.user.orgId)
    res.json([...latest.values()].sort((a, b) => a.key.localeCompare(b.key)))
  })
)

/** Reports whether the AI advisor is configured, without exposing any key. */
router.get('/advisor/status', requireUser, (_req, res) => {
  res.json(advisorStatus())
})

/**
 * Drafts a remediation plan for one failing control. The prompt carries only the
 * control text and a single scalar observation - the same zero-data-access rule
 * that governs the rest of the platform.
 */
router.post(
  '/:id/advise',
  requireUser,
  requireRole('ADMIN', 'COMPLIANCE'),
  asyncRoute(async (req, res) => {
    const finding = await collection(COLLECTIONS.findings).findOne({
      id: req.params.id,
      orgId: req.user.orgId,
    })
    if (!finding) throw new ApiError(404, 'Finding not found')

    const advice = await draftRemediationPlan(finding)
    await recordAudit({
      orgId: req.user.orgId,
      actor: req.user.email,
      actorRole: req.user.role,
      action: 'REMEDIATION_PLAN_DRAFTED',
      target: finding.id,
      detail: `${advice.source} guidance for ${finding.checkCode}`,
    })
    res.json({ findingId: finding.id, checkCode: finding.checkCode, ...advice })
  })
)

export default router
