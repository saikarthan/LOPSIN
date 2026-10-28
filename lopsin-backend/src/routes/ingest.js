import { Router } from 'express'
import { collection, COLLECTIONS } from '../db/index.js'
import { requireAgent } from '../middleware/auth.js'
import { ApiError, asyncRoute } from '../middleware/errorHandler.js'
import { inspectBatch } from '../engine/privacyGuard.js'
import { SIGNAL_CATALOG } from '../catalog/signals.js'
import { runScan } from '../engine/scanner.js'
import { newId, nowIso, sha256 } from '../utils/ids.js'
import { recordAudit } from '../utils/audit.js'

const router = Router()

/**
 * Agent-facing API. Every call here is outbound from the customer estate over
 * HTTPS - Lopsin never opens a connection into a customer network and never holds
 * a credential to their systems.
 */

/** Handshake: the collector confirms its credential and reports its build. */
router.post(
  '/handshake',
  requireAgent,
  asyncRoute(async (req, res) => {
    const version = String(req.body?.version || 'unknown').slice(0, 32)
    const hostLabel = String(req.body?.hostLabel || '').slice(0, 64)

    await collection(COLLECTIONS.agents).updateOne(
      { id: req.agent.id },
      { $set: { version, hostLabel: hostLabel || null, status: 'ACTIVE', lastHeartbeatAt: nowIso() } }
    )
    await recordAudit({
      orgId: req.agent.orgId,
      actor: req.agent.name,
      actorRole: 'AGENT',
      action: 'AGENT_HANDSHAKE',
      target: req.agent.id,
      detail: `version ${version}`,
    })

    res.json({
      agentId: req.agent.id,
      organizationId: req.agent.orgId,
      collectionIntervalSeconds: 900,
      acknowledged: true,
    })
  })
)

/**
 * Collection manifest: the agent asks what to observe. It receives only key names
 * and types - never a query, a path or a credential.
 */
router.get(
  '/manifest',
  requireAgent,
  asyncRoute(async (req, res) => {
    const org = await collection(COLLECTIONS.organizations).findOne({ id: req.agent.orgId })
    const enabled = org?.enabledFrameworks || []
    const checks = await collection(COLLECTIONS.checks).find({})
    const required = new Set(
      checks
        .filter((check) => enabled.length === 0 || enabled.includes(check.frameworkCode))
        .map((check) => check.signalKey)
    )

    res.json({
      generatedAt: nowIso(),
      collectionIntervalSeconds: 900,
      signals: SIGNAL_CATALOG.filter((signal) => required.has(signal.key)),
    })
  })
)

router.post(
  '/heartbeat',
  requireAgent,
  asyncRoute(async (req, res) => {
    await collection(COLLECTIONS.agents).updateOne(
      { id: req.agent.id },
      { $set: { lastHeartbeatAt: nowIso(), status: 'ACTIVE' } }
    )
    res.json({ acknowledged: true, at: nowIso() })
  })
)

/**
 * Signal submission. Each item passes the privacy guard before it is stored; the
 * response tells the operator exactly which items were refused and why.
 */
router.post(
  '/signals',
  requireAgent,
  asyncRoute(async (req, res) => {
    const submitted = Array.isArray(req.body?.signals) ? req.body.signals : null
    if (!submitted) throw new ApiError(400, 'Body must contain a "signals" array')
    if (submitted.length > 200) throw new ApiError(413, 'A batch may contain at most 200 signals')

    const { accepted, rejected } = inspectBatch(submitted)
    const receivedAt = nowIso()

    const documents = accepted.map((signal) => ({
      id: newId('sig'),
      orgId: req.agent.orgId,
      agentId: req.agent.id,
      agentName: req.agent.name,
      key: signal.key,
      value: signal.value,
      collectedAt: signal.collectedAt || receivedAt,
      receivedAt,
      // Integrity digest over the observation, so evidence cannot be altered silently.
      digest: sha256(`${signal.key}:${signal.value}:${signal.collectedAt || receivedAt}`),
    }))

    if (documents.length) await collection(COLLECTIONS.signals).insertMany(documents)

    await collection(COLLECTIONS.agents).updateOne(
      { id: req.agent.id },
      {
        $set: { lastHeartbeatAt: receivedAt, status: 'ACTIVE' },
        $inc: { signalsAccepted: documents.length, signalsRejected: rejected.length },
      }
    )

    if (rejected.length) {
      await recordAudit({
        orgId: req.agent.orgId,
        actor: req.agent.name,
        actorRole: 'AGENT',
        action: 'SIGNALS_REJECTED_BY_PRIVACY_GUARD',
        target: req.agent.id,
        detail: `${rejected.length} of ${submitted.length} signals refused: ${rejected.map((r) => r.gate).join(', ')}`,
      })
    }

    let scan = null
    if (documents.length && req.body?.evaluate !== false) {
      const outcome = await runScan(req.agent.orgId, { triggeredBy: `agent:${req.agent.name}` })
      scan = { id: outcome.scan.id, score: outcome.summary.score, failed: outcome.summary.failed }
    }

    res.status(rejected.length && !documents.length ? 422 : 202).json({
      submitted: submitted.length,
      accepted: documents.length,
      rejected: rejected.length,
      rejections: rejected,
      scan,
    })
  })
)

export default router
