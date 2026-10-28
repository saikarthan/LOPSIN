import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

// Isolate the test run from the development store before any module reads config.
const testDbPath = path.join(os.tmpdir(), `lopsin-test-${Date.now()}.json`)
process.env.FILE_DB_PATH = testDbPath
process.env.MONGODB_URI = ''
process.env.PRIVACY_GUARD = 'STRICT'
process.env.JWT_SECRET = 'test-secret-key-for-the-lopsin-suite'

const { connectDb, closeDb, collection, COLLECTIONS } = await import('../src/db/index.js')
const { seedIfEmpty } = await import('../src/db/seed.js')
const { createApp } = await import('../src/app.js')
const { inspectSignal } = await import('../src/engine/privacyGuard.js')
const { evaluate, scoreResults, compare } = await import('../src/engine/ruleEngine.js')
const { flattenChecks } = await import('../src/catalog/regulations.js')
const { SIGNAL_CATALOG } = await import('../src/catalog/signals.js')

await connectDb({ quiet: true })
await seedIfEmpty()

const server = createApp().listen(0)
const base = `http://127.0.0.1:${server.address().port}/api`

test.after(async () => {
  server.close()
  await closeDb()
  fs.rmSync(testDbPath, { force: true })
})

async function call(method, route, { token, body } = {}) {
  const response = await fetch(`${base}${route}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
  const text = await response.text()
  return { status: response.status, body: text ? JSON.parse(text) : null }
}

const signIn = async (email, password = 'Lopsin@2026') => {
  const result = await call('POST', '/auth/login', { body: { email, password } })
  assert.equal(result.status, 200, `sign-in failed for ${email}`)
  return result.body.token
}

// ---------------------------------------------------------------- catalog

test('the regulation catalog is internally consistent', () => {
  const checks = flattenChecks()
  const knownKeys = new Set(SIGNAL_CATALOG.map((signal) => signal.key))
  const codes = new Set()

  for (const check of checks) {
    assert.ok(knownKeys.has(check.signalKey), `${check.code} references undeclared signal ${check.signalKey}`)
    assert.ok(!codes.has(check.code), `duplicate check code ${check.code}`)
    assert.ok(check.remediation && check.rationale, `${check.code} is missing guidance`)
    assert.ok(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].includes(check.severity))
    codes.add(check.code)
  }
  assert.ok(checks.length >= 40, 'expected a substantial check library')
})

// ---------------------------------------------------- privacy guard (unit)

test('the privacy guard accepts only declared scalar telemetry', () => {
  assert.equal(inspectSignal({ key: 'storage.public_buckets', value: 0 }).accepted, true)
  assert.equal(inspectSignal({ key: 'identity.sso_enabled', value: true }).accepted, true)
  assert.equal(inspectSignal({ key: 'transport.tls_min_version', value: '1.3' }).accepted, true)
})

test('the privacy guard blocks undeclared keys', () => {
  const verdict = inspectSignal({ key: 'customer.records', value: 12 })
  assert.equal(verdict.accepted, false)
  assert.equal(verdict.gate, 'ALLOW_LIST')
})

test('the privacy guard blocks structured payloads', () => {
  const verdict = inspectSignal({ key: 'identity.sso_enabled', value: { rows: [1, 2] } })
  assert.equal(verdict.accepted, false)
  assert.equal(verdict.gate, 'SHAPE')
})

test('the privacy guard blocks type mismatches', () => {
  const verdict = inspectSignal({ key: 'identity.password_min_length', value: 'twelve' })
  assert.equal(verdict.accepted, false)
  assert.equal(verdict.gate, 'TYPE_CONTRACT')
})

test('the privacy guard content scan catches personal data in a declared key', () => {
  const cases = [
    ['person@example.com', 'EMAIL_ADDRESS'],
    ['ABCDE1234F', 'INDIA_PAN'],
    ['4111 1111 1111 1111', 'PAYMENT_CARD'],
    ['/home/ubuntu/patients.csv', 'FILE_PATH'],
    ['10.20.30.40', 'IP_ADDRESS'],
  ]
  for (const [value, detector] of cases) {
    const verdict = inspectSignal({ key: 'transport.tls_min_version', value })
    assert.equal(verdict.accepted, false, `${value} should have been rejected`)
    assert.equal(verdict.gate, 'CONTENT_SCAN')
    assert.equal(verdict.detector, detector)
  }
})

// ------------------------------------------------------ rule engine (unit)

test('comparison operators behave as specified', () => {
  assert.equal(compare('gte', 14, 12), true)
  assert.equal(compare('lte', 400, 365), false)
  assert.equal(compare('eq', 0, 0), true)
  assert.equal(compare('isTrue', false, null), false)
  assert.equal(compare('oneOf', '1.2', ['1.2', '1.3']), true)
  assert.equal(compare('oneOf', '1.0', ['1.2', '1.3']), false)
})

test('an unreported signal yields NOT_APPLICABLE rather than a false pass', () => {
  const checks = [
    { code: 'X.1', frameworkCode: 'F', controlCode: 'C', title: 't', severity: 'HIGH', signalKey: 'identity.sso_enabled', operator: 'isTrue' },
  ]
  const [result] = evaluate(checks, new Map())
  assert.equal(result.status, 'NOT_APPLICABLE')
  assert.equal(scoreResults([result]), 0, 'an unmonitored estate must not score above zero')
})

test('a passing value close to its threshold is flagged as drift', () => {
  const checks = [
    { code: 'X.2', frameworkCode: 'F', controlCode: 'C', title: 't', severity: 'MEDIUM', signalKey: 'logging.retention_days', operator: 'gte', expected: 180 },
  ]
  const signals = new Map([['logging.retention_days', { value: 185, collectedAt: new Date().toISOString() }]])
  assert.equal(evaluate(checks, signals)[0].status, 'WARN')

  const healthy = new Map([['logging.retention_days', { value: 400, collectedAt: new Date().toISOString() }]])
  assert.equal(evaluate(checks, healthy)[0].status, 'PASS')
})

// ------------------------------------------------------------ auth + RBAC

test('login rejects a wrong password and accepts the right one', async () => {
  const bad = await call('POST', '/auth/login', { body: { email: 'admin@lopsin.demo', password: 'nope' } })
  assert.equal(bad.status, 401)

  const good = await call('POST', '/auth/login', { body: { email: 'admin@lopsin.demo', password: 'Lopsin@2026' } })
  assert.equal(good.status, 200)
  assert.equal(good.body.role, 'ADMIN')
  assert.ok(good.body.token)
  assert.equal(good.body.passwordHash, undefined, 'the password hash must never leave the server')
})

test('protected routes reject missing and forged tokens', async () => {
  assert.equal((await call('GET', '/dashboard/summary')).status, 401)
  assert.equal((await call('GET', '/dashboard/summary', { token: 'not.a.token' })).status, 401)

  const valid = await signIn('admin@lopsin.demo')
  const tampered = `${valid.slice(0, -4)}AAAA`
  assert.equal((await call('GET', '/dashboard/summary', { token: tampered })).status, 401)
})

test('an auditor cannot mutate state but can read it', async () => {
  const auditor = await signIn('auditor@lopsin.demo')

  assert.equal((await call('GET', '/findings', { token: auditor })).status, 200)
  assert.equal((await call('GET', '/audit', { token: auditor })).status, 200)

  const scan = await call('POST', '/findings/scan', { token: auditor })
  assert.equal(scan.status, 403)

  const enroll = await call('POST', '/agents', { token: auditor, body: { name: 'rogue', environment: 'PRODUCTION', platform: 'AWS' } })
  assert.equal(enroll.status, 403)

  const users = await call('GET', '/users', { token: auditor })
  assert.equal(users.status, 403)
})

test('an administrator cannot delete or demote their own account', async () => {
  const token = await signIn('admin@lopsin.demo')
  const me = await call('GET', '/auth/me', { token })

  assert.equal((await call('DELETE', `/users/${me.body.id}`, { token })).status, 400)
  assert.equal((await call('PUT', `/users/${me.body.id}`, { token, body: { role: 'AUDITOR' } })).status, 400)
  assert.equal((await call('PUT', `/users/${me.body.id}`, { token, body: { status: 'SUSPENDED' } })).status, 400)
})

// ------------------------------------------------------------- agent flow

test('an enrolled agent can hand shake, pull a manifest and submit signals', async () => {
  const token = await signIn('admin@lopsin.demo')
  const enrolled = await call('POST', '/agents', {
    token,
    body: { name: 'suite-collector', environment: 'STAGING', platform: 'GCP' },
  })
  assert.equal(enrolled.status, 201)
  const secret = enrolled.body.enrollmentSecret
  assert.ok(secret.startsWith('lpsn_'))
  assert.equal(enrolled.body.secretHash, undefined, 'the stored hash must not be returned')

  const listed = await call('GET', '/agents', { token })
  const stored = listed.body.find((agent) => agent.id === enrolled.body.id)
  assert.equal(stored.secretHash, undefined)

  assert.equal((await call('POST', '/agent/handshake', { token: secret, body: { version: '1.4.2' } })).status, 200)

  const manifest = await call('GET', '/agent/manifest', { token: secret })
  assert.equal(manifest.status, 200)
  assert.ok(manifest.body.signals.length > 0)

  const submission = await call('POST', '/agent/signals', {
    token: secret,
    body: {
      signals: [
        { key: 'storage.public_buckets', value: 0 },
        { key: 'ai.transparency_notice_published', value: true },
        { key: 'exported.customer_table', value: 'rows' },
      ],
    },
  })
  assert.equal(submission.status, 202)
  assert.equal(submission.body.accepted, 2)
  assert.equal(submission.body.rejected, 1)
  assert.equal(submission.body.rejections[0].gate, 'ALLOW_LIST')
  assert.ok(submission.body.scan.score >= 0)
})

test('a revoked agent credential stops working immediately', async () => {
  const token = await signIn('admin@lopsin.demo')
  const enrolled = await call('POST', '/agents', {
    token,
    body: { name: 'revoke-me', environment: 'DEVELOPMENT', platform: 'AWS' },
  })
  const secret = enrolled.body.enrollmentSecret
  assert.equal((await call('POST', '/agent/heartbeat', { token: secret })).status, 200)

  await call('POST', `/agents/${enrolled.body.id}/revoke`, { token })
  assert.equal((await call('POST', '/agent/heartbeat', { token: secret })).status, 403)
})

test('rotating a credential invalidates the previous secret', async () => {
  const token = await signIn('admin@lopsin.demo')
  const enrolled = await call('POST', '/agents', {
    token,
    body: { name: 'rotate-me', environment: 'DEVELOPMENT', platform: 'AWS' },
  })
  const first = enrolled.body.enrollmentSecret
  const rotated = await call('POST', `/agents/${enrolled.body.id}/rotate`, { token })

  assert.notEqual(rotated.body.enrollmentSecret, first)
  assert.equal((await call('POST', '/agent/heartbeat', { token: first })).status, 401)
  assert.equal((await call('POST', '/agent/heartbeat', { token: rotated.body.enrollmentSecret })).status, 200)
})

test('an unauthenticated collector cannot submit signals', async () => {
  const result = await call('POST', '/agent/signals', { body: { signals: [{ key: 'identity.sso_enabled', value: true }] } })
  assert.equal(result.status, 401)
})

// -------------------------------------------------- findings + remediation

test('a scan produces findings with evidence traceable to a signal', async () => {
  const token = await signIn('compliance@lopsin.demo')
  const scan = await call('POST', '/findings/scan', { token })
  assert.equal(scan.status, 200)
  assert.ok(scan.body.summary.total >= 40)

  const failing = await call('GET', '/findings?status=FAIL', { token })
  assert.equal(failing.status, 200)
  assert.ok(failing.body.length > 0, 'the demo posture should contain failures')

  const detail = await call('GET', `/findings/${failing.body[0].id}`, { token })
  assert.equal(detail.status, 200)
  assert.ok(detail.body.remediation)
  assert.ok(detail.body.evidence, 'a failing finding must cite the signal it was derived from')
  assert.equal(detail.body.evidence.key, detail.body.signalKey)
  assert.ok(detail.body.evidence.digest, 'evidence must carry an integrity digest')
})

test('findings are ordered with the most severe failures first', async () => {
  const token = await signIn('compliance@lopsin.demo')
  const all = await call('GET', '/findings', { token })
  assert.equal(all.body[0].status, 'FAIL')
  const firstPassIndex = all.body.findIndex((finding) => finding.status === 'PASS')
  const lastFailIndex = all.body.map((finding) => finding.status).lastIndexOf('FAIL')
  assert.ok(lastFailIndex < firstPassIndex, 'all failures should sort ahead of passes')
})

test('a remediation ticket runs through its full lifecycle', async () => {
  const token = await signIn('compliance@lopsin.demo')
  const failing = await call('GET', '/findings?status=FAIL', { token })
  const target = failing.body.find((finding) => !finding.ticket)
  assert.ok(target, 'expected an un-ticketed failing finding')

  const created = await call('POST', '/remediation', {
    token,
    body: { findingId: target.id, system: 'JIRA', assignee: 'platform@acme.example' },
  })
  assert.equal(created.status, 201)
  assert.equal(created.body.status, 'OPEN')
  assert.ok(created.body.externalKey.startsWith('COMP-'))
  assert.ok(created.body.dueAt)

  const duplicate = await call('POST', '/remediation', { token, body: { findingId: target.id, system: 'JIRA' } })
  assert.equal(duplicate.status, 409, 'a second open ticket for the same finding must be refused')

  const progressed = await call('PUT', `/remediation/${created.body.id}/status`, {
    token,
    body: { status: 'IN_PROGRESS', note: 'assigned to platform security' },
  })
  assert.equal(progressed.body.status, 'IN_PROGRESS')
  assert.equal(progressed.body.history.length, 2)

  const resolved = await call('PUT', `/remediation/${created.body.id}/status`, { token, body: { status: 'RESOLVED' } })
  assert.equal(resolved.body.status, 'RESOLVED')

  const invalid = await call('PUT', `/remediation/${created.body.id}/status`, { token, body: { status: 'BANANA' } })
  assert.equal(invalid.status, 400)
})

test('a passing control cannot be sent for remediation', async () => {
  const token = await signIn('compliance@lopsin.demo')
  const all = await call('GET', '/findings', { token })
  const passing = all.body.find((finding) => finding.status === 'PASS')
  const result = await call('POST', '/remediation', { token, body: { findingId: passing.id, system: 'MANUAL' } })
  assert.equal(result.status, 400)
})

test('a ticket cannot be raised into a disconnected tool', async () => {
  const token = await signIn('admin@lopsin.demo')
  const failing = await call('GET', '/findings?status=FAIL', { token })
  const target = failing.body.find((finding) => !finding.ticket)
  const result = await call('POST', '/remediation', { token, body: { findingId: target.id, system: 'GITHUB' } })
  assert.equal(result.status, 400)
  assert.match(result.body.message, /not connected/i)
})

// ------------------------------------------------------------- dashboards

test('the dashboard summary reports posture, coverage and trend', async () => {
  const token = await signIn('admin@lopsin.demo')
  const summary = await call('GET', '/dashboard/summary', { token })
  assert.equal(summary.status, 200)
  assert.ok(summary.body.complianceScore >= 0 && summary.body.complianceScore <= 100)
  assert.equal(
    summary.body.checks.passed + summary.body.checks.failed + summary.body.checks.warned + summary.body.checks.notApplicable,
    summary.body.checks.total
  )
  assert.ok(summary.body.scanHistory.length > 1, 'a trend needs more than one point')
  assert.ok(summary.body.coverage.coveragePct <= 100)
})

test('the readiness report breaks down every enabled framework', async () => {
  const token = await signIn('auditor@lopsin.demo')
  const report = await call('GET', '/dashboard/readiness', { token })
  assert.equal(report.status, 200)
  assert.ok(report.body.frameworks.length >= 5)
  for (const framework of report.body.frameworks) {
    assert.ok(framework.readinessPct >= 0 && framework.readinessPct <= 100)
    assert.equal(framework.passed + framework.failed + framework.warned + framework.notApplicable, framework.total)
  }
})

// -------------------------------------------------------- tenant isolation

test('a new tenant sees only its own data', async () => {
  const registered = await call('POST', '/auth/register-organization', {
    body: {
      organizationName: 'Contoso Analytics',
      fullName: 'Priya R',
      email: 'owner@contoso.example',
      password: 'Contoso@2026!',
      region: 'India',
      industry: 'Fintech',
      frameworks: ['DPDP', 'SOC2'],
    },
  })
  assert.equal(registered.status, 201)
  const token = registered.body.token

  const agents = await call('GET', '/agents', { token })
  assert.equal(agents.body.length, 0, 'a fresh tenant must not see another tenant agents')

  const findings = await call('GET', '/findings', { token })
  assert.equal(findings.body.length, 0)

  const summary = await call('GET', '/dashboard/summary', { token })
  assert.equal(summary.body.organization.name, 'Contoso Analytics')
  assert.equal(summary.body.agents.total, 0)

  const duplicate = await call('POST', '/auth/register-organization', {
    body: { organizationName: 'Contoso Again', fullName: 'Priya R', email: 'owner@contoso.example', password: 'Contoso@2026!' },
  })
  assert.equal(duplicate.status, 409)
})

test('a new tenant scores zero until an agent reports, then reflects reality', async () => {
  const registered = await call('POST', '/auth/register-organization', {
    body: {
      organizationName: 'Fresh Start Ltd',
      fullName: 'Owner One',
      email: 'owner@freshstart.example',
      password: 'FreshStart@2026',
      frameworks: ['SOC2'],
    },
  })
  const token = registered.body.token

  const first = await call('POST', '/findings/scan', { token })
  assert.equal(first.body.summary.score, 0, 'no telemetry means no assurance')
  assert.equal(first.body.summary.notApplicable, first.body.summary.total)

  const agent = await call('POST', '/agents', { token, body: { name: 'fs-collector', environment: 'PRODUCTION', platform: 'AWS' } })
  await call('POST', '/agent/signals', {
    token: agent.body.enrollmentSecret,
    body: {
      signals: [
        { key: 'identity.sso_enabled', value: true },
        { key: 'network.firewall_default_deny', value: true },
        { key: 'network.open_admin_ports', value: 4 },
      ],
    },
  })

  const second = await call('GET', '/dashboard/summary', { token })
  assert.ok(second.body.complianceScore > 0)
  assert.ok(second.body.checks.failed >= 1, 'four exposed admin ports must fail CC6.7')
})

// -------------------------------------------------------------- audit trail

test('every state change is written to the audit trail', async () => {
  const token = await signIn('admin@lopsin.demo')
  const entries = await call('GET', '/audit', { token })
  assert.equal(entries.status, 200)

  const actions = new Set(entries.body.map((entry) => entry.action))
  for (const expected of ['USER_SIGNED_IN', 'AGENT_ENROLLED', 'REMEDIATION_TICKET_CREATED', 'SCAN_RUN']) {
    assert.ok(actions.has(expected), `audit trail is missing ${expected}`)
  }

  const guardEntry = entries.body.find((entry) => entry.action === 'SIGNALS_REJECTED_BY_PRIVACY_GUARD')
  assert.ok(guardEntry, 'guard rejections must be auditable')

  const ordered = entries.body.map((entry) => entry.at)
  assert.deepEqual(ordered, [...ordered].sort().reverse(), 'the trail must read newest first')
})

// ------------------------------------------------------------- data layer

test('the document store implements the query subset the API relies on', async () => {
  const probe = collection('storeProbe')
  await probe.insertMany([
    { id: 'a', group: 'x', score: 10, tags: ['red'] },
    { id: 'b', group: 'x', score: 30, tags: ['blue'] },
    { id: 'c', group: 'y', score: 20, tags: ['red', 'blue'] },
  ])

  assert.equal((await probe.find({ group: 'x' })).length, 2)
  assert.equal((await probe.find({ score: { $gte: 20 } })).length, 2)
  assert.equal((await probe.find({ group: { $in: ['y'] } })).length, 1)
  assert.equal((await probe.find({ id: { $nin: ['a', 'b'] } })).length, 1)
  assert.equal((await probe.find({ tags: 'blue' })).length, 2)
  assert.equal((await probe.findOne({ id: 'missing' })), null)

  const sorted = await probe.find({}, { sort: { score: -1 }, limit: 2 })
  assert.deepEqual(sorted.map((doc) => doc.id), ['b', 'c'])

  await probe.updateOne({ id: 'a' }, { $set: { score: 99 }, $push: { tags: 'green' } })
  const updated = await probe.findOne({ id: 'a' })
  assert.equal(updated.score, 99)
  assert.deepEqual(updated.tags, ['red', 'green'])

  await probe.updateOne({ id: 'a' }, { $inc: { score: 1 } })
  assert.equal((await probe.findOne({ id: 'a' })).score, 100)

  assert.equal((await probe.deleteOne({ id: 'a' })).deletedCount, 1)
  assert.equal(await probe.countDocuments({}), 2)
  await probe.deleteMany({})
  assert.equal(await probe.countDocuments({}), 0)
})

test('unknown endpoints return a clean 404 rather than an HTML error page', async () => {
  const result = await call('GET', '/does-not-exist')
  assert.equal(result.status, 404)
  assert.equal(result.body.message, 'Endpoint not found')
})

test('the health endpoint reports the active driver', async () => {
  const result = await call('GET', '/health')
  assert.equal(result.status, 200)
  assert.equal(result.body.status, 'UP')
  assert.ok(['file', 'mongodb'].includes(result.body.driver))
})
