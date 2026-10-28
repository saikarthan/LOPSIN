import { connectDb, collection, COLLECTIONS, closeDb } from './index.js'
import { flattenChecks, FRAMEWORKS } from '../catalog/regulations.js'
import { hashPassword, newAgentSecret } from '../utils/crypto.js'
import { newId, nowIso, sha256 } from '../utils/ids.js'
import { runScan } from '../engine/scanner.js'

const DEMO_PASSWORD = 'Lopsin@2026'

const DEMO_USERS = [
  { email: 'admin@lopsin.demo', fullName: 'Sai Keerthan K', role: 'ADMIN' },
  { email: 'compliance@lopsin.demo', fullName: 'Mahender G', role: 'COMPLIANCE' },
  { email: 'auditor@lopsin.demo', fullName: 'External Auditor', role: 'AUDITOR' },
]

const DEMO_AGENTS = [
  { name: 'aws-prod-collector', environment: 'PRODUCTION', platform: 'AWS', hostLabel: 'ip-10-20-3-14', version: '1.4.2' },
  { name: 'k8s-platform-collector', environment: 'PRODUCTION', platform: 'KUBERNETES', hostLabel: 'lopsin-agent-7c9f', version: '1.4.2' },
  { name: 'corp-identity-collector', environment: 'CORPORATE', platform: 'SAAS', hostLabel: 'entra-connector', version: '1.3.9' },
]

/**
 * A believable posture for the demo tenant: strong on identity and logging, weak on
 * a handful of controls so the console has real failures to remediate. Values are
 * configuration observations only - exactly what a real collector would report.
 */
const DEMO_SIGNALS = {
  'identity.mfa_enforced_admins': true,
  'identity.sso_enabled': true,
  'identity.password_min_length': 14,
  'identity.dormant_accounts_over_90d': 6,
  'access.privilege_review_age_days': 118,
  'access.offboarding_sla_hours': 19,

  'storage.encryption_at_rest': true,
  'storage.public_buckets': 2,
  'storage.key_rotation_age_days': 402,
  'transport.tls_min_version': '1.2',
  'transport.hsts_enabled': true,
  'endpoint.disk_encryption_coverage_pct': 96,

  'logging.audit_log_enabled': true,
  'logging.retention_days': 400,
  'logging.tamper_protection': true,
  'monitoring.alerting_enabled': true,
  'backup.last_success_age_hours': 21,
  'backup.restore_test_age_days': 94,
  'incident.plan_test_age_days': 402,

  'vuln.critical_open_count': 3,
  'vuln.scan_age_days': 12,
  'change.peer_review_required': true,
  'change.pipeline_artifacts_signed': false,
  'network.firewall_default_deny': true,
  'network.open_admin_ports': 1,

  'privacy.dsr_workflow_configured': true,
  'privacy.dsr_median_response_days': 26,
  'privacy.retention_policy_days': 1460,
  'privacy.consent_records_enabled': true,
  'privacy.cross_border_transfer_controls': false,
  'privacy.breach_runbook_age_days': 210,
  'privacy.ropa_maintained': true,
  'privacy.dpo_designated': true,
  'vendor.dpa_coverage_pct': 88,

  'phi.access_audit_enabled': true,
  'phi.minimum_necessary_controls': true,
  'phi.baa_coverage_pct': 92,

  'ai.model_inventory_maintained': true,
  'ai.risk_classification_documented': true,
  'ai.human_oversight_configured': true,
  'ai.training_data_provenance_logged': false,
  'ai.output_logging_enabled': true,
  'ai.prohibited_practice_scan': true,
  // ai.transparency_notice_published is deliberately unreported, so the console
  // shows a NOT_APPLICABLE control and coverage below 100 percent.
}

const AGENT_FOR_PREFIX = (key) => {
  if (key.startsWith('identity.') || key.startsWith('access.')) return 2
  if (key.startsWith('change.') || key.startsWith('vuln.') || key.startsWith('ai.')) return 1
  return 0
}

export async function seedChecks() {
  const checks = collection(COLLECTIONS.checks)
  const existing = await checks.countDocuments({})
  if (existing) await checks.deleteMany({})
  await checks.insertMany(flattenChecks())

  const frameworks = collection(COLLECTIONS.frameworks)
  if (await frameworks.countDocuments({})) await frameworks.deleteMany({})
  await frameworks.insertMany(
    FRAMEWORKS.map((framework) => ({
      id: framework.code,
      code: framework.code,
      name: framework.name,
      region: framework.region,
      version: framework.version,
      authority: framework.authority,
      summary: framework.summary,
    }))
  )
}

/** Runs on every boot: refreshes the regulation catalog, seeds the demo tenant once. */
export async function seedIfEmpty() {
  await seedChecks()
  const orgs = await collection(COLLECTIONS.organizations).countDocuments({})
  if (orgs > 0) return { seeded: false }
  await seedDemoTenant()
  return { seeded: true }
}

export async function seedDemoTenant() {
  const createdAt = nowIso()

  const org = {
    id: newId('org'),
    name: 'Northwind Health Cloud',
    slug: 'northwind-health-cloud',
    industry: 'Healthcare SaaS',
    region: 'European Union',
    dataResidency: 'EU (Frankfurt)',
    enabledFrameworks: FRAMEWORKS.map((framework) => framework.code),
    complianceScore: 0,
    lastScanAt: null,
    createdAt,
  }
  await collection(COLLECTIONS.organizations).insertOne(org)

  await collection(COLLECTIONS.users).insertMany(
    DEMO_USERS.map((user) => ({
      id: newId('usr'),
      orgId: org.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      status: 'ACTIVE',
      passwordHash: hashPassword(DEMO_PASSWORD),
      createdAt,
      lastLoginAt: null,
    }))
  )

  const agents = DEMO_AGENTS.map((agent, index) => ({
    id: newId('agt'),
    orgId: org.id,
    name: agent.name,
    environment: agent.environment,
    platform: agent.platform,
    secretHash: sha256(newAgentSecret()),
    status: 'ACTIVE',
    version: agent.version,
    hostLabel: agent.hostLabel,
    lastHeartbeatAt: new Date(Date.now() - (index + 1) * 4 * 60000).toISOString(),
    signalsAccepted: 0,
    signalsRejected: index === 0 ? 2 : 0,
    createdAt,
    createdBy: DEMO_USERS[0].email,
  }))
  await collection(COLLECTIONS.agents).insertMany(agents)

  const collectedAt = new Date(Date.now() - 12 * 60000).toISOString()
  const signals = Object.entries(DEMO_SIGNALS).map(([key, value]) => {
    const agent = agents[AGENT_FOR_PREFIX(key)]
    return {
      id: newId('sig'),
      orgId: org.id,
      agentId: agent.id,
      agentName: agent.name,
      key,
      value,
      collectedAt,
      receivedAt: collectedAt,
      digest: sha256(`${key}:${value}:${collectedAt}`),
    }
  })
  await collection(COLLECTIONS.signals).insertMany(signals)

  const counts = new Map()
  for (const signal of signals) counts.set(signal.agentId, (counts.get(signal.agentId) || 0) + 1)
  for (const [agentId, count] of counts) {
    await collection(COLLECTIONS.agents).updateOne({ id: agentId }, { $set: { signalsAccepted: count } })
  }

  await collection(COLLECTIONS.integrations).insertMany([
    {
      id: newId('int'),
      orgId: org.id,
      system: 'JIRA',
      status: 'CONNECTED',
      config: { siteUrl: 'https://northwind.atlassian.net', projectKey: 'COMP' },
      connectedAt: createdAt,
      connectedBy: DEMO_USERS[0].email,
    },
    {
      id: newId('int'),
      orgId: org.id,
      system: 'SLACK',
      status: 'CONNECTED',
      config: { channel: '#compliance-alerts' },
      connectedAt: createdAt,
      connectedBy: DEMO_USERS[0].email,
    },
  ])

  // Historic scan trend so the dashboard opens with a real posture curve.
  const history = [58, 61, 63, 67, 70, 72, 76, 79]
  await collection(COLLECTIONS.scans).insertMany(
    history.map((score, index) => {
      const at = new Date(Date.now() - (history.length - index) * 86400000).toISOString()
      return {
        id: newId('scan'),
        orgId: org.id,
        triggeredBy: 'scheduler',
        startedAt: at,
        finishedAt: at,
        checksEvaluated: 47,
        passed: Math.round(47 * (score / 100)),
        failed: 47 - Math.round(47 * (score / 100)) - 2,
        warned: 2,
        notApplicable: 1,
        score,
      }
    })
  )

  const { summary } = await runScan(org.id, { triggeredBy: 'seed' })

  // Two remediation tickets already in flight, so the board is not empty.
  const failing = await collection(COLLECTIONS.findings).find({ orgId: org.id, status: 'FAIL' })
  const ordered = failing.sort((a, b) => a.severity.localeCompare(b.severity)).slice(0, 2)
  let sequence = 0
  for (const finding of ordered) {
    const at = nowIso()
    await collection(COLLECTIONS.tickets).insertOne({
      id: newId('tkt'),
      orgId: org.id,
      findingId: finding.id,
      checkCode: finding.checkCode,
      frameworkCode: finding.frameworkCode,
      controlCode: finding.controlCode,
      severity: finding.severity,
      system: 'JIRA',
      externalKey: `COMP-${1000 + sequence}`,
      title: `[${finding.frameworkCode} ${finding.controlCode}] ${finding.title}`,
      description: `${finding.detail}\n\nRemediation: ${finding.remediation}`,
      status: sequence === 0 ? 'IN_PROGRESS' : 'OPEN',
      assignee: 'platform-security@northwind.example',
      dueAt: new Date(Date.now() + 7 * 86400000).toISOString(),
      createdBy: DEMO_USERS[1].email,
      createdAt: at,
      updatedAt: at,
      history: [{ at, actor: DEMO_USERS[1].email, from: null, to: 'OPEN', note: 'Raised from Lopsin finding' }],
    })
    sequence += 1
  }

  await collection(COLLECTIONS.auditLogs).insertMany([
    {
      id: newId('aud'),
      orgId: org.id,
      actor: 'system',
      actorRole: 'SYSTEM',
      action: 'ORGANIZATION_REGISTERED',
      target: org.id,
      detail: 'Demo tenant provisioned with 6 frameworks',
      at: createdAt,
    },
    {
      id: newId('aud'),
      orgId: org.id,
      actor: agents[0].name,
      actorRole: 'AGENT',
      action: 'SIGNALS_REJECTED_BY_PRIVACY_GUARD',
      target: agents[0].id,
      detail: '2 signals refused: ALLOW_LIST, CONTENT_SCAN',
      at: createdAt,
    },
  ])

  return { org, summary }
}

const isDirectRun = process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('src/db/seed.js')

if (isDirectRun) {
  const force = process.argv.includes('--force')
  const store = await connectDb()
  if (force) {
    await store.dropAll()
    console.log('[seed] existing data cleared')
  }
  const result = await seedIfEmpty()
  if (result.seeded) {
    console.log('[seed] demo tenant "Northwind Health Cloud" created')
    console.log('[seed] sign in with:')
    for (const user of DEMO_USERS) console.log(`        ${user.email.padEnd(26)} ${DEMO_PASSWORD}  (${user.role})`)
  } else {
    console.log('[seed] regulation catalog refreshed; tenant data left untouched (use --force to reset)')
  }
  await closeDb()
}
