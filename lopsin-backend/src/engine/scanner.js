import { collection, COLLECTIONS } from '../db/index.js'
import { evaluate, summarise } from './ruleEngine.js'
import { newId, nowIso } from '../utils/ids.js'

/** Latest observation per signal key for an organisation. */
export async function latestSignals(orgId) {
  const signals = await collection(COLLECTIONS.signals).find(
    { orgId },
    { sort: { collectedAt: -1 } }
  )
  const latest = new Map()
  for (const signal of signals) {
    const seen = latest.get(signal.key)
    if (!seen || signal.collectedAt > seen.collectedAt) latest.set(signal.key, signal)
  }
  return latest
}

export async function activeChecks(orgId) {
  const all = await collection(COLLECTIONS.checks).find({})
  const disabled = await collection(COLLECTIONS.organizations).findOne({ id: orgId })
  const enabledFrameworks = disabled?.enabledFrameworks
  if (!Array.isArray(enabledFrameworks) || enabledFrameworks.length === 0) return all
  return all.filter((check) => enabledFrameworks.includes(check.frameworkCode))
}

/**
 * Runs a full evaluation for one organisation and reconciles the findings register:
 * new violations are created, resolved ones are closed, and firstSeenAt is preserved
 * so an auditor can see how long a control has been failing.
 */
export async function runScan(orgId, { triggeredBy = 'system' } = {}) {
  const [checks, signals] = await Promise.all([activeChecks(orgId), latestSignals(orgId)])
  const results = evaluate(checks, signals)
  const summary = summarise(results)
  const at = nowIso()

  const findingsCollection = collection(COLLECTIONS.findings)
  const existing = await findingsCollection.find({ orgId })
  const existingByCheck = new Map(existing.map((finding) => [finding.checkCode, finding]))

  for (const result of results) {
    const previous = existingByCheck.get(result.checkCode)
    const base = {
      orgId,
      checkCode: result.checkCode,
      frameworkCode: result.frameworkCode,
      controlCode: result.controlCode,
      title: result.title,
      severity: result.severity,
      signalKey: result.signalKey,
      status: result.status,
      observed: result.observed,
      expected: result.expected,
      detail: result.detail,
      rationale: result.rationale,
      remediation: result.remediation,
      evidenceSignalId: result.evidenceSignalId,
      observedAt: result.observedAt,
      lastEvaluatedAt: at,
    }

    if (!previous) {
      await findingsCollection.insertOne({
        id: newId('fnd'),
        ...base,
        firstSeenAt: at,
        resolvedAt: result.status === 'FAIL' ? null : at,
      })
      continue
    }

    const wasFailing = previous.status === 'FAIL'
    const isFailing = result.status === 'FAIL'
    await findingsCollection.updateOne(
      { id: previous.id },
      {
        $set: {
          ...base,
          firstSeenAt: isFailing && !wasFailing ? at : previous.firstSeenAt,
          resolvedAt: isFailing ? null : wasFailing ? at : previous.resolvedAt,
        },
      }
    )
  }

  const scan = {
    id: newId('scan'),
    orgId,
    triggeredBy,
    startedAt: at,
    finishedAt: nowIso(),
    checksEvaluated: summary.total,
    passed: summary.passed,
    failed: summary.failed,
    warned: summary.warned,
    notApplicable: summary.notApplicable,
    score: summary.score,
  }
  await collection(COLLECTIONS.scans).insertOne(scan)

  await collection(COLLECTIONS.organizations).updateOne(
    { id: orgId },
    { $set: { complianceScore: summary.score, lastScanAt: scan.finishedAt } }
  )

  return { scan, summary, results }
}
