import { SEVERITY_WEIGHT } from '../catalog/regulations.js'

/**
 * The evaluation engine.
 *
 * A check asserts one operator over one signal value. No customer data is ever an
 * input here - only the scalar configuration and telemetry observations that passed
 * the privacy guard.
 *
 * Outcomes:
 *   PASS           - the observation satisfies the control
 *   FAIL           - the observation violates the control
 *   WARN           - the observation is within 15 percent of a numeric threshold
 *   NOT_APPLICABLE - no agent has reported this signal yet
 */

export const OUTCOMES = ['PASS', 'FAIL', 'WARN', 'NOT_APPLICABLE']

const WARN_BAND = 0.15

export function compare(operator, observed, expected) {
  switch (operator) {
    case 'isTrue': return observed === true
    case 'isFalse': return observed === false
    case 'eq': return observed === expected
    case 'neq': return observed !== expected
    case 'gte': return Number(observed) >= Number(expected)
    case 'gt': return Number(observed) > Number(expected)
    case 'lte': return Number(observed) <= Number(expected)
    case 'lt': return Number(observed) < Number(expected)
    case 'oneOf': return Array.isArray(expected) && expected.includes(observed)
    default: return false
  }
}

/** True when a passing numeric observation sits close enough to the limit to flag early. */
function isNearThreshold(operator, observed, expected) {
  if (typeof observed !== 'number' || typeof expected !== 'number') return false
  if (expected === 0) return false
  const band = Math.abs(expected) * WARN_BAND
  if (operator === 'lte' || operator === 'lt') return observed >= expected - band
  if (operator === 'gte' || operator === 'gt') return observed <= expected + band
  return false
}

export function describeExpectation(check) {
  const { operator, expected } = check
  switch (operator) {
    case 'isTrue': return 'enabled'
    case 'isFalse': return 'disabled'
    case 'eq': return `exactly ${expected}`
    case 'neq': return `not ${expected}`
    case 'gte': return `at least ${expected}`
    case 'gt': return `more than ${expected}`
    case 'lte': return `at most ${expected}`
    case 'lt': return `less than ${expected}`
    case 'oneOf': return `one of ${(expected || []).join(', ')}`
    default: return String(expected)
  }
}

/**
 * @param {Array} checks  check documents
 * @param {Map}   signals latest signal per key: key -> { value, collectedAt, agentId, id }
 */
export function evaluate(checks, signals) {
  const results = []
  for (const check of checks) {
    if (check.enabled === false) continue
    const signal = signals.get(check.signalKey)

    if (!signal) {
      results.push({
        checkCode: check.code,
        frameworkCode: check.frameworkCode,
        controlCode: check.controlCode,
        title: check.title,
        severity: check.severity,
        signalKey: check.signalKey,
        status: 'NOT_APPLICABLE',
        observed: null,
        expected: describeExpectation(check),
        detail: 'No agent has reported this signal yet.',
        rationale: check.rationale,
        remediation: check.remediation,
        evidenceSignalId: null,
        observedAt: null,
      })
      continue
    }

    const satisfied = compare(check.operator, signal.value, check.expected)
    let status = satisfied ? 'PASS' : 'FAIL'
    let detail = satisfied
      ? `Observed ${format(signal.value)}, which satisfies "${describeExpectation(check)}".`
      : `Observed ${format(signal.value)}, but the control requires ${describeExpectation(check)}.`

    if (satisfied && isNearThreshold(check.operator, signal.value, check.expected)) {
      status = 'WARN'
      detail = `Observed ${format(signal.value)} against a limit of ${check.expected}. Still compliant, but inside the drift band.`
    }

    results.push({
      checkCode: check.code,
      frameworkCode: check.frameworkCode,
      controlCode: check.controlCode,
      title: check.title,
      severity: check.severity,
      signalKey: check.signalKey,
      status,
      observed: signal.value,
      expected: describeExpectation(check),
      detail,
      rationale: check.rationale,
      remediation: check.remediation,
      evidenceSignalId: signal.id || null,
      observedAt: signal.collectedAt || null,
    })
  }
  return results
}

function format(value) {
  if (typeof value === 'boolean') return value ? 'enabled' : 'disabled'
  return String(value)
}

/**
 * Compliance score: severity-weighted share of satisfied controls.
 * NOT_APPLICABLE checks are excluded so an unmonitored estate cannot score 100.
 */
export function scoreResults(results) {
  let earned = 0
  let possible = 0
  for (const result of results) {
    if (result.status === 'NOT_APPLICABLE') continue
    const weight = SEVERITY_WEIGHT[result.severity] || 1
    possible += weight
    if (result.status === 'PASS') earned += weight
    else if (result.status === 'WARN') earned += weight * 0.6
  }
  if (possible === 0) return 0
  return Math.round((earned / possible) * 100)
}

export function summarise(results) {
  const summary = {
    total: results.length,
    passed: 0,
    failed: 0,
    warned: 0,
    notApplicable: 0,
    bySeverity: { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 },
    byFramework: {},
  }
  for (const result of results) {
    if (result.status === 'PASS') summary.passed += 1
    else if (result.status === 'FAIL') summary.failed += 1
    else if (result.status === 'WARN') summary.warned += 1
    else summary.notApplicable += 1

    if (result.status === 'FAIL') summary.bySeverity[result.severity] += 1

    const bucket = (summary.byFramework[result.frameworkCode] ||= {
      total: 0, passed: 0, failed: 0, warned: 0, notApplicable: 0,
    })
    bucket.total += 1
    if (result.status === 'PASS') bucket.passed += 1
    else if (result.status === 'FAIL') bucket.failed += 1
    else if (result.status === 'WARN') bucket.warned += 1
    else bucket.notApplicable += 1
  }
  summary.score = scoreResults(results)
  return summary
}
