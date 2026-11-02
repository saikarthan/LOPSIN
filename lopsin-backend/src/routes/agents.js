import { Router } from 'express'
import { collection, COLLECTIONS } from '../db/index.js'
import { newAgentSecret } from '../utils/crypto.js'
import { newId, nowIso, sha256 } from '../utils/ids.js'
import { ApiError, asyncRoute } from '../middleware/errorHandler.js'
import { requireUser, requireRole } from '../middleware/auth.js'
import { recordAudit } from '../utils/audit.js'
import { invalidate } from '../utils/cache.js'

const router = Router()

const ENVIRONMENTS = ['PRODUCTION', 'STAGING', 'DEVELOPMENT', 'CORPORATE']
const PLATFORMS = ['AWS', 'AZURE', 'GCP', 'KUBERNETES', 'ON_PREMISE', 'SAAS']

const STALE_HEARTBEAT_MINUTES = 30

function decorate(agent) {
  const { secretHash, ...safe } = agent
  const last = agent.lastHeartbeatAt ? new Date(agent.lastHeartbeatAt).getTime() : 0
  const minutesSince = last ? Math.round((Date.now() - last) / 60000) : null
  return {
    ...safe,
    minutesSinceHeartbeat: minutesSince,
    connectivity:
      agent.status === 'REVOKED'
        ? 'REVOKED'
        : !last
          ? 'AWAITING_FIRST_CONTACT'
          : minutesSince > STALE_HEARTBEAT_MINUTES
            ? 'STALE'
            : 'HEALTHY',
  }
}

router.get(
  '/',
  requireUser,
  asyncRoute(async (req, res) => {
    const agents = await collection(COLLECTIONS.agents).find(
      { orgId: req.user.orgId },
      { sort: { createdAt: -1 } }
    )
    res.json(agents.map(decorate))
  })
)

/**
 * Enrolment. Returns the agent secret exactly once - only its SHA-256 digest is
 * stored, so the platform can verify a collector without ever being able to
 * reproduce its credential.
 */
router.post(
  '/',
  requireUser,
  requireRole('ADMIN'),
  asyncRoute(async (req, res) => {
    const name = String(req.body?.name || '').trim()
    const environment = String(req.body?.environment || 'PRODUCTION').toUpperCase()
    const platform = String(req.body?.platform || 'AWS').toUpperCase()

    if (!name) throw new ApiError(400, 'Agent name is required')
    if (!ENVIRONMENTS.includes(environment)) {
      throw new ApiError(400, `Environment must be one of: ${ENVIRONMENTS.join(', ')}`)
    }
    if (!PLATFORMS.includes(platform)) {
      throw new ApiError(400, `Platform must be one of: ${PLATFORMS.join(', ')}`)
    }

    const secret = newAgentSecret()
    const agent = {
      id: newId('agt'),
      orgId: req.user.orgId,
      name,
      environment,
      platform,
      secretHash: sha256(secret),
      status: 'ENROLLED',
      version: null,
      hostLabel: null,
      lastHeartbeatAt: null,
      signalsAccepted: 0,
      signalsRejected: 0,
      createdAt: nowIso(),
      createdBy: req.user.email,
    }
    await collection(COLLECTIONS.agents).insertOne(agent)
    await recordAudit({
      orgId: req.user.orgId,
      actor: req.user.email,
      actorRole: req.user.role,
      action: 'AGENT_ENROLLED',
      target: agent.id,
      detail: `${name} (${platform} / ${environment})`,
    })

    res.status(201).json({
      ...decorate(agent),
      enrollmentSecret: secret,
      notice: 'Copy this secret now. It is stored only as a hash and cannot be shown again.',
    })
  })
)

router.post(
  '/:id/rotate',
  requireUser,
  requireRole('ADMIN'),
  asyncRoute(async (req, res) => {
    const agent = await collection(COLLECTIONS.agents).findOne({ id: req.params.id, orgId: req.user.orgId })
    if (!agent) throw new ApiError(404, 'Agent not found')

    const secret = newAgentSecret()
    await collection(COLLECTIONS.agents).updateOne(
      { id: agent.id },
      { $set: { secretHash: sha256(secret), status: 'ENROLLED', rotatedAt: nowIso() } }
    )
    invalidate(`agent:${agent.secretHash}`)
    await recordAudit({
      orgId: req.user.orgId,
      actor: req.user.email,
      actorRole: req.user.role,
      action: 'AGENT_CREDENTIAL_ROTATED',
      target: agent.id,
    })
    res.json({ id: agent.id, enrollmentSecret: secret, notice: 'The previous credential stopped working immediately.' })
  })
)

router.post(
  '/:id/revoke',
  requireUser,
  requireRole('ADMIN'),
  asyncRoute(async (req, res) => {
    const agent = await collection(COLLECTIONS.agents).findOne({ id: req.params.id, orgId: req.user.orgId })
    if (!agent) throw new ApiError(404, 'Agent not found')

    await collection(COLLECTIONS.agents).updateOne({ id: agent.id }, { $set: { status: 'REVOKED' } })
    invalidate(`agent:${agent.secretHash}`)
    await recordAudit({
      orgId: req.user.orgId,
      actor: req.user.email,
      actorRole: req.user.role,
      action: 'AGENT_REVOKED',
      target: agent.id,
      detail: agent.name,
    })
    res.json({ id: agent.id, status: 'REVOKED' })
  })
)

router.delete(
  '/:id',
  requireUser,
  requireRole('ADMIN'),
  asyncRoute(async (req, res) => {
    const result = await collection(COLLECTIONS.agents).deleteOne({ id: req.params.id, orgId: req.user.orgId })
    if (!result.deletedCount) throw new ApiError(404, 'Agent not found')
    await recordAudit({
      orgId: req.user.orgId,
      actor: req.user.email,
      actorRole: req.user.role,
      action: 'AGENT_DELETED',
      target: req.params.id,
    })
    res.status(204).end()
  })
)

export default router
