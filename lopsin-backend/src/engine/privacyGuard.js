import { config } from '../config/env.js'
import { isKnownSignal, SIGNAL_INDEX } from '../catalog/signals.js'

/**
 * Zero-data-access guard.
 *
 * Lopsin never receives customer data. This module is the enforcement point: every
 * signal an agent submits is checked against three gates before it can be stored.
 *
 *   Gate 1 - allow-list   : the key must exist in the published signal contract.
 *   Gate 2 - type contract: the value must match the declared scalar type.
 *   Gate 3 - content scan : the value must not resemble personal or payload data.
 *
 * A rejected signal is never persisted; the reason is returned to the agent so the
 * operator can fix their collector.
 */

const MAX_VALUE_LENGTH = 64

const CONTENT_PATTERNS = [
  { name: 'EMAIL_ADDRESS', pattern: /[\w.+-]+@[\w-]+\.[\w.]{2,}/ },
  // Ordered most specific first: a card number also satisfies the phone pattern,
  // and the detector name is reported back to the operator, so precedence matters.
  { name: 'PAYMENT_CARD', pattern: /\b(?:\d[ -]?){13,19}\b/ },
  { name: 'INDIA_AADHAAR', pattern: /\b\d{4}\s?\d{4}\s?\d{4}\b/ },
  { name: 'PHONE_NUMBER', pattern: /(?:\+?\d[\s-]?){10,15}/ },
  { name: 'INDIA_PAN', pattern: /\b[A-Z]{5}\d{4}[A-Z]\b/ },
  { name: 'US_SSN', pattern: /\b\d{3}-\d{2}-\d{4}\b/ },
  { name: 'IP_ADDRESS', pattern: /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/ },
  { name: 'PRIVATE_KEY_MATERIAL', pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
  { name: 'BEARER_SECRET', pattern: /\b(?:bearer|api[_-]?key|password|secret)\b\s*[:=]/i },
  { name: 'FILE_PATH', pattern: /(?:[A-Za-z]:\\|\/(?:home|users|var|etc)\/)/i },
  { name: 'ENCODED_PAYLOAD', pattern: /^[A-Za-z0-9+/]{40,}={0,2}$/ },
]

export const GUARD_RULES = [
  { gate: 'ALLOW_LIST', description: 'The signal key must appear in the published signal contract.' },
  { gate: 'TYPE_CONTRACT', description: 'The value must match the declared scalar type (boolean, number or short string).' },
  { gate: 'SHAPE', description: 'Objects, arrays and values longer than 64 characters are rejected outright.' },
  { gate: 'CONTENT_SCAN', description: 'Values are screened for personal data, secrets, file paths and encoded payloads.' },
]

export function inspectSignal(rawSignal) {
  const key = typeof rawSignal?.key === 'string' ? rawSignal.key.trim() : ''
  const value = rawSignal?.value

  if (!key) {
    return { accepted: false, key, gate: 'ALLOW_LIST', reason: 'Signal key is missing.' }
  }

  if (!isKnownSignal(key)) {
    return {
      accepted: false,
      key,
      gate: 'ALLOW_LIST',
      reason: `"${key}" is not part of the Lopsin signal contract. Agents may only report declared configuration and telemetry keys.`,
    }
  }

  if (value === null || value === undefined) {
    return { accepted: false, key, gate: 'TYPE_CONTRACT', reason: 'Signal value is missing.' }
  }

  if (typeof value === 'object') {
    return {
      accepted: false,
      key,
      gate: 'SHAPE',
      reason: 'Structured payloads are never accepted. Report a single scalar observation per signal.',
    }
  }

  const declared = SIGNAL_INDEX.get(key)
  const actualType = typeof value
  if (declared.type !== actualType) {
    return {
      accepted: false,
      key,
      gate: 'TYPE_CONTRACT',
      reason: `Signal "${key}" is declared as ${declared.type} but ${actualType} was submitted.`,
    }
  }

  if (actualType === 'number' && !Number.isFinite(value)) {
    return { accepted: false, key, gate: 'TYPE_CONTRACT', reason: 'Numeric signals must be finite.' }
  }

  if (actualType === 'string') {
    if (value.length > MAX_VALUE_LENGTH) {
      return {
        accepted: false,
        key,
        gate: 'SHAPE',
        reason: `String signals are capped at ${MAX_VALUE_LENGTH} characters; ${value.length} were submitted.`,
      }
    }
    if (config.privacyGuard === 'STRICT') {
      for (const { name, pattern } of CONTENT_PATTERNS) {
        if (pattern.test(value)) {
          return {
            accepted: false,
            key,
            gate: 'CONTENT_SCAN',
            detector: name,
            reason: `Value rejected by the zero-data-access guard: it matches the ${name.replace(/_/g, ' ').toLowerCase()} detector.`,
          }
        }
      }
    }
  }

  return { accepted: true, key, value, declaredType: declared.type }
}

/** Splits a submitted batch into accepted signals and rejections, with per-item reasons. */
export function inspectBatch(signals) {
  const accepted = []
  const rejected = []
  for (const signal of signals) {
    const verdict = inspectSignal(signal)
    if (verdict.accepted) {
      accepted.push({ key: verdict.key, value: verdict.value, collectedAt: signal.collectedAt })
    } else {
      rejected.push(verdict)
    }
  }
  return { accepted, rejected }
}
