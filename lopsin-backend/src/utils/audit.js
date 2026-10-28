import { collection, COLLECTIONS } from '../db/index.js'
import { newId, nowIso } from './ids.js'

/**
 * Append-only activity trail. Every state change in the platform is recorded here,
 * which is itself the evidence for the logging controls Lopsin evaluates.
 */
export async function recordAudit({ orgId, actor, actorRole, action, target, detail }) {
  const entry = {
    id: newId('aud'),
    orgId: orgId || null,
    actor: actor || 'system',
    actorRole: actorRole || 'SYSTEM',
    action,
    target: target || null,
    detail: detail || null,
    at: nowIso(),
  }
  await collection(COLLECTIONS.auditLogs).insertOne(entry)
  return entry
}
