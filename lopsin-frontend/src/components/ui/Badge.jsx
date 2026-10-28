const TONE_MAP = {
  PASS: 'success',
  ACTIVE: 'success',
  HEALTHY: 'success',
  CONNECTED: 'success',
  RESOLVED: 'success',
  CLOSED: 'success',
  ENROLLED: 'neutral',
  OPEN: 'warning',
  IN_PROGRESS: 'neutral',
  WARN: 'warning',
  STALE: 'warning',
  AWAITING_FIRST_CONTACT: 'warning',
  BLOCKED: 'danger',
  FAIL: 'danger',
  REVOKED: 'danger',
  SUSPENDED: 'danger',
  NOT_APPLICABLE: 'neutral',
  NOT_EVALUATED: 'neutral',
  NOT_CONNECTED: 'neutral',
  CRITICAL: 'critical',
  HIGH: 'danger',
  MEDIUM: 'warning',
  LOW: 'neutral',
}

export default function Badge({ value, tone }) {
  if (value === null || value === undefined) return null
  const resolved = tone || TONE_MAP[value] || 'neutral'
  return <span className={`badge badge-${resolved}`}>{String(value).replace(/_/g, ' ')}</span>
}
