import { Router } from 'express'
import { collection, COLLECTIONS } from '../db/index.js'
import { requireUser, requireRole } from '../middleware/auth.js'
import { ApiError, asyncRoute } from '../middleware/errorHandler.js'
import { newId, nowIso } from '../utils/ids.js'
import { recordAudit } from '../utils/audit.js'

const router = Router()

/**
 * Workflow integrations. Lopsin pushes remediation work outward into the tools a
 * team already runs; none of these connections grant Lopsin read access to data.
 */
export const INTEGRATION_CATALOG = [
  {
    system: 'JIRA',
    name: 'Jira Software',
    category: 'Issue tracking',
    scopeRequested: 'write:issue',
    description: 'Raises a remediation issue in the chosen project when a control fails.',
    fields: [
      { key: 'siteUrl', label: 'Site URL', placeholder: 'https://acme.atlassian.net', required: true },
      { key: 'projectKey', label: 'Project key', placeholder: 'COMP', required: true },
    ],
  },
  {
    system: 'GITHUB',
    name: 'GitHub Issues',
    category: 'Engineering workflow',
    scopeRequested: 'issues:write',
    description: 'Opens an issue on the repository that owns the failing configuration.',
    fields: [
      { key: 'repository', label: 'Repository', placeholder: 'acme/platform-infra', required: true },
    ],
  },
  {
    system: 'SLACK',
    name: 'Slack',
    category: 'Notification',
    scopeRequested: 'chat:write',
    description: 'Posts an alert to a channel the moment a critical control starts failing.',
    fields: [
      { key: 'channel', label: 'Channel', placeholder: '#compliance-alerts', required: true },
    ],
  },
]

router.get(
  '/',
  requireUser,
  asyncRoute(async (req, res) => {
    const connected = await collection(COLLECTIONS.integrations).find({ orgId: req.user.orgId })
    const bySystem = new Map(connected.map((item) => [item.system, item]))
    res.json(
      INTEGRATION_CATALOG.map((definition) => {
        const record = bySystem.get(definition.system)
        return {
          ...definition,
          status: record?.status || 'NOT_CONNECTED',
          config: record?.config || {},
          connectedAt: record?.connectedAt || null,
          connectedBy: record?.connectedBy || null,
        }
      })
    )
  })
)

router.post(
  '/:system/connect',
  requireUser,
  requireRole('ADMIN'),
  asyncRoute(async (req, res) => {
    const system = String(req.params.system).toUpperCase()
    const definition = INTEGRATION_CATALOG.find((item) => item.system === system)
    if (!definition) throw new ApiError(404, 'Unknown integration')

    const config = {}
    for (const field of definition.fields) {
      const value = String(req.body?.[field.key] || '').trim()
      if (field.required && !value) throw new ApiError(400, `${field.label} is required`)
      config[field.key] = value
    }

    const existing = await collection(COLLECTIONS.integrations).findOne({ orgId: req.user.orgId, system })
    const record = {
      id: existing?.id || newId('int'),
      orgId: req.user.orgId,
      system,
      status: 'CONNECTED',
      config,
      connectedAt: nowIso(),
      connectedBy: req.user.email,
    }

    if (existing) await collection(COLLECTIONS.integrations).updateOne({ id: existing.id }, { $set: record })
    else await collection(COLLECTIONS.integrations).insertOne(record)

    await recordAudit({
      orgId: req.user.orgId,
      actor: req.user.email,
      actorRole: req.user.role,
      action: 'INTEGRATION_CONNECTED',
      target: system,
    })
    res.json({ ...definition, ...record })
  })
)

router.post(
  '/:system/disconnect',
  requireUser,
  requireRole('ADMIN'),
  asyncRoute(async (req, res) => {
    const system = String(req.params.system).toUpperCase()
    const result = await collection(COLLECTIONS.integrations).deleteOne({ orgId: req.user.orgId, system })
    if (!result.deletedCount) throw new ApiError(404, 'That integration is not connected')
    await recordAudit({
      orgId: req.user.orgId,
      actor: req.user.email,
      actorRole: req.user.role,
      action: 'INTEGRATION_DISCONNECTED',
      target: system,
    })
    res.json({ system, status: 'NOT_CONNECTED' })
  })
)

export default router
