#!/usr/bin/env node
/**
 * Lopsin collector agent.
 *
 * This is the component that runs INSIDE a customer estate. It is deliberately
 * small and auditable, because the whole zero-data-access claim rests on what this
 * process is capable of doing:
 *
 *   - It opens outbound HTTPS connections only. It listens on no port.
 *   - It holds one credential: its own Lopsin enrolment secret. It holds no
 *     credential for any customer system.
 *   - Every collector function returns a single scalar. There is no code path here
 *     that can read a record, a file body or a database row.
 *
 * Usage:
 *   LOPSIN_AGENT_SECRET=lpsn_... node agent.js            # run continuously
 *   LOPSIN_AGENT_SECRET=lpsn_... node agent.js --once     # single cycle
 *   LOPSIN_AGENT_SECRET=lpsn_... node agent.js --demo-violation
 *   LOPSIN_AGENT_SECRET=lpsn_... node agent.js --dry-run  # print, do not send
 */

import os from 'node:os'

const API = (process.env.LOPSIN_API || 'http://localhost:8080/api').replace(/\/$/, '')
const SECRET = process.env.LOPSIN_AGENT_SECRET || ''
const VERSION = '1.4.2'

const args = new Set(process.argv.slice(2))
const ONCE = args.has('--once')
const DRY_RUN = args.has('--dry-run')
const DEMO_VIOLATION = args.has('--demo-violation')

/**
 * The collector library.
 *
 * In a production agent each of these would call a cloud, identity or CI provider
 * SDK - always a "describe configuration" API, never a "read object" API. Here they
 * read from the host and from environment overrides so the agent is runnable and
 * inspectable without cloud credentials.
 *
 * The contract every collector obeys: return one boolean, number or short string.
 */
const COLLECTORS = {
  // ---- identity and access ----
  'identity.mfa_enforced_admins': () => envBool('LOPSIN_MFA_ADMINS', true),
  'identity.sso_enabled': () => envBool('LOPSIN_SSO', true),
  'identity.password_min_length': () => envNumber('LOPSIN_PASSWORD_MIN', 14),
  'identity.dormant_accounts_over_90d': () => envNumber('LOPSIN_DORMANT_ACCOUNTS', 4),
  'access.privilege_review_age_days': () => envNumber('LOPSIN_PRIV_REVIEW_AGE', 62),
  'access.offboarding_sla_hours': () => envNumber('LOPSIN_OFFBOARD_HOURS', 18),

  // ---- data protection ----
  'storage.encryption_at_rest': () => envBool('LOPSIN_ENCRYPTION_AT_REST', true),
  'storage.public_buckets': () => envNumber('LOPSIN_PUBLIC_BUCKETS', 0),
  'storage.key_rotation_age_days': () => envNumber('LOPSIN_KEY_AGE', 180),
  'transport.tls_min_version': () => envString('LOPSIN_TLS_MIN', '1.2'),
  'transport.hsts_enabled': () => envBool('LOPSIN_HSTS', true),
  'endpoint.disk_encryption_coverage_pct': () => envNumber('LOPSIN_DISK_ENCRYPTION_PCT', 99),

  // ---- logging, monitoring, resilience ----
  'logging.audit_log_enabled': () => envBool('LOPSIN_AUDIT_LOG', true),
  'logging.retention_days': () => envNumber('LOPSIN_LOG_RETENTION', 365),
  'logging.tamper_protection': () => envBool('LOPSIN_LOG_IMMUTABLE', true),
  'monitoring.alerting_enabled': () => envBool('LOPSIN_ALERTING', true),
  'backup.last_success_age_hours': () => envNumber('LOPSIN_BACKUP_AGE_HOURS', 6),
  'backup.restore_test_age_days': () => envNumber('LOPSIN_RESTORE_TEST_AGE', 45),
  'incident.plan_test_age_days': () => envNumber('LOPSIN_IR_TEST_AGE', 120),

  // ---- vulnerability and change management ----
  'vuln.critical_open_count': () => envNumber('LOPSIN_CRITICAL_VULNS', 0),
  'vuln.scan_age_days': () => envNumber('LOPSIN_SCAN_AGE', 5),
  'change.peer_review_required': () => envBool('LOPSIN_PEER_REVIEW', true),
  'change.pipeline_artifacts_signed': () => envBool('LOPSIN_SIGNED_ARTIFACTS', true),
  'network.firewall_default_deny': () => envBool('LOPSIN_DEFAULT_DENY', true),
  'network.open_admin_ports': () => envNumber('LOPSIN_OPEN_ADMIN_PORTS', 0),

  // ---- privacy programme ----
  'privacy.dsr_workflow_configured': () => envBool('LOPSIN_DSR_WORKFLOW', true),
  'privacy.dsr_median_response_days': () => envNumber('LOPSIN_DSR_DAYS', 11),
  'privacy.retention_policy_days': () => envNumber('LOPSIN_RETENTION_DAYS', 730),
  'privacy.consent_records_enabled': () => envBool('LOPSIN_CONSENT_RECORDS', true),
  'privacy.cross_border_transfer_controls': () => envBool('LOPSIN_TRANSFER_CONTROLS', true),
  'privacy.breach_runbook_age_days': () => envNumber('LOPSIN_BREACH_RUNBOOK_AGE', 90),
  'privacy.ropa_maintained': () => envBool('LOPSIN_ROPA', true),
  'privacy.dpo_designated': () => envBool('LOPSIN_DPO', true),
  'vendor.dpa_coverage_pct': () => envNumber('LOPSIN_DPA_COVERAGE', 97),

  // ---- healthcare ----
  'phi.access_audit_enabled': () => envBool('LOPSIN_PHI_AUDIT', true),
  'phi.minimum_necessary_controls': () => envBool('LOPSIN_PHI_MIN_NECESSARY', true),
  'phi.baa_coverage_pct': () => envNumber('LOPSIN_BAA_COVERAGE', 100),

  // ---- AI governance ----
  'ai.model_inventory_maintained': () => envBool('LOPSIN_AI_INVENTORY', true),
  'ai.risk_classification_documented': () => envBool('LOPSIN_AI_RISK_CLASS', true),
  'ai.human_oversight_configured': () => envBool('LOPSIN_AI_OVERSIGHT', true),
  'ai.training_data_provenance_logged': () => envBool('LOPSIN_AI_PROVENANCE', true),
  'ai.output_logging_enabled': () => envBool('LOPSIN_AI_OUTPUT_LOG', true),
  'ai.prohibited_practice_scan': () => envBool('LOPSIN_AI_PROHIBITED_SCAN', true),
  'ai.transparency_notice_published': () => envBool('LOPSIN_AI_TRANSPARENCY', true),
}

function envBool(name, fallback) {
  const raw = process.env[name]
  if (raw === undefined) return fallback
  return raw === 'true' || raw === '1'
}

function envNumber(name, fallback) {
  const raw = process.env[name]
  if (raw === undefined) return fallback
  const parsed = Number(raw)
  return Number.isFinite(parsed) ? parsed : fallback
}

function envString(name, fallback) {
  return process.env[name] ?? fallback
}

/**
 * Signals a well-behaved collector would never produce. Sent only with
 * --demo-violation, to show the guard refusing them at the boundary.
 */
const VIOLATION_SAMPLES = [
  { key: 'patient.records', value: 'Jane Doe, DOB 1984-02-11' },
  { key: 'transport.tls_min_version', value: 'admin@northwind.example' },
  { key: 'identity.sso_enabled', value: { employees: ['alice', 'bob'] } },
  { key: 'identity.password_min_length', value: 'twelve' },
  { key: 'storage.encryption_at_rest', value: '/home/ubuntu/backups/customers.sql' },
]

async function callApi(path, { method = 'GET', body } = {}) {
  const response = await fetch(`${API}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${SECRET}`,
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
  const text = await response.text()
  const payload = text ? JSON.parse(text) : null
  if (!response.ok && response.status !== 422) {
    throw new Error(payload?.message || `${method} ${path} failed with ${response.status}`)
  }
  return payload
}

async function handshake() {
  const result = await callApi('/agent/handshake', {
    method: 'POST',
    body: { version: VERSION, hostLabel: os.hostname().slice(0, 64) },
  })
  console.log(`[agent] handshake accepted - agent ${result.agentId}`)
  return result
}

/** Every signal this build is capable of producing, with no server involved. */
function collectAllLocally() {
  const collectedAt = new Date().toISOString()
  return Object.entries(COLLECTORS).map(([key, collector]) => ({
    key,
    value: collector(),
    collectedAt,
  }))
}

/** Collects only the signals the platform actually asked for. */
async function collect() {
  const manifest = await callApi('/agent/manifest')
  const collectedAt = new Date().toISOString()
  const signals = []
  const unsupported = []

  for (const requested of manifest.signals) {
    const collector = COLLECTORS[requested.key]
    if (!collector) {
      unsupported.push(requested.key)
      continue
    }
    signals.push({ key: requested.key, value: collector(), collectedAt })
  }

  if (unsupported.length) {
    console.log(`[agent] ${unsupported.length} requested signal(s) not supported by this build`)
  }
  return { signals, manifest }
}

async function runCycle({ offline = false } = {}) {
  // A dry run without a credential enumerates the full local collector set, so an
  // operator can audit exactly what this agent is capable of sending before it is
  // ever pointed at the platform.
  const signals = offline ? collectAllLocally() : (await collect()).signals
  const payload = DEMO_VIOLATION ? [...signals, ...VIOLATION_SAMPLES] : signals

  if (DRY_RUN) {
    console.log(`[agent] dry run - ${payload.length} signal(s) that WOULD be sent:`)
    for (const signal of payload) {
      console.log(`         ${signal.key.padEnd(42)} ${JSON.stringify(signal.value)}`)
    }
    return
  }

  const result = await callApi('/agent/signals', { method: 'POST', body: { signals: payload } })

  console.log(
    `[agent] submitted ${result.submitted} · accepted ${result.accepted} · rejected ${result.rejected}`
  )
  for (const rejection of result.rejections || []) {
    console.log(`        REFUSED [${rejection.gate}] ${rejection.key}`)
    console.log(`                ${rejection.reason}`)
  }
  if (result.scan) {
    console.log(`[agent] posture re-evaluated - score ${result.scan.score}, ${result.scan.failed} failing`)
  }
}

async function main() {
  if (!SECRET && DRY_RUN) {
    console.log(`[agent] Lopsin collector ${VERSION} - offline dry run, nothing will be sent`)
    console.log(`[agent] ${Object.keys(COLLECTORS).length} collectors available, all scalar-only`)
    await runCycle({ offline: true })
    return
  }

  if (!SECRET) {
    console.error('[agent] LOPSIN_AGENT_SECRET is not set.')
    console.error('        Enrol an agent in the Lopsin console and export the secret it issues:')
    console.error('        LOPSIN_AGENT_SECRET=lpsn_... node agent.js --once')
    process.exit(1)
  }

  console.log(`[agent] Lopsin collector ${VERSION}`)
  console.log(`[agent] endpoint ${API} (outbound only)`)
  console.log(`[agent] ${Object.keys(COLLECTORS).length} collectors available, all scalar-only`)

  if (DRY_RUN) {
    await runCycle()
    return
  }

  const session = await handshake()
  await runCycle()

  if (ONCE) return

  const intervalMs = (session.collectionIntervalSeconds || 900) * 1000
  console.log(`[agent] entering collection loop every ${intervalMs / 1000}s (Ctrl+C to stop)`)

  const timer = setInterval(() => {
    runCycle().catch((error) => console.error(`[agent] cycle failed: ${error.message}`))
  }, intervalMs)

  const stop = () => {
    clearInterval(timer)
    console.log('\n[agent] stopped')
    process.exit(0)
  }
  process.on('SIGINT', stop)
  process.on('SIGTERM', stop)
}

main().catch((error) => {
  console.error(`[agent] ${error.message}`)
  process.exit(1)
})
