import { Router } from 'express'
import { collection, COLLECTIONS } from '../db/index.js'
import { requireUser } from '../middleware/auth.js'
import { asyncRoute } from '../middleware/errorHandler.js'
import { SEVERITY_WEIGHT } from '../catalog/regulations.js'
import { latestSignals } from '../engine/scanner.js'
import { SIGNAL_CATALOG } from '../catalog/signals.js'

const router = Router()

const STALE_HEARTBEAT_MINUTES = 30

router.get(
  '/summary',
  requireUser,
  asyncRoute(async (req, res) => {
    const orgId = req.user.orgId
    const [org, findings, agents, tickets, scans, signals] = await Promise.all([
      collection(COLLECTIONS.organizations).findOne({ id: orgId }),
      collection(COLLECTIONS.findings).find({ orgId }),
      collection(COLLECTIONS.agents).find({ orgId }),
      collection(COLLECTIONS.tickets).find({ orgId }),
      collection(COLLECTIONS.scans).find({ orgId }, { sort: { finishedAt: -1 }, limit: 12 }),
      latestSignals(orgId),
    ])

    const bySeverity = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 }
    const byFramework = {}
    let passed = 0
    let failed = 0
    let warned = 0
    let notApplicable = 0

    for (const finding of findings) {
      if (finding.status === 'PASS') passed += 1
      else if (finding.status === 'FAIL') failed += 1
      else if (finding.status === 'WARN') warned += 1
      else notApplicable += 1

      if (finding.status === 'FAIL') bySeverity[finding.severity] += 1

      const bucket = (byFramework[finding.frameworkCode] ||= { passed: 0, failed: 0, warned: 0, notApplicable: 0 })
      if (finding.status === 'PASS') bucket.passed += 1
      else if (finding.status === 'FAIL') bucket.failed += 1
      else if (finding.status === 'WARN') bucket.warned += 1
      else bucket.notApplicable += 1
    }

    const now = Date.now()
    const healthyAgents = agents.filter(
      (agent) =>
        agent.status !== 'REVOKED' &&
        agent.lastHeartbeatAt &&
        (now - new Date(agent.lastHeartbeatAt).getTime()) / 60000 <= STALE_HEARTBEAT_MINUTES
    ).length

    const openTickets = tickets.filter((ticket) => !['RESOLVED', 'CLOSED'].includes(ticket.status))
    const overdueTickets = openTickets.filter((ticket) => new Date(ticket.dueAt).getTime() < now)

    res.json({
      organization: org
        ? { id: org.id, name: org.name, region: org.region, industry: org.industry, enabledFrameworks: org.enabledFrameworks }
        : null,
      complianceScore: org?.complianceScore ?? 0,
      lastScanAt: org?.lastScanAt || null,
      checks: { total: findings.length, passed, failed, warned, notApplicable },
      failuresBySeverity: bySeverity,
      byFramework,
      agents: { total: agents.length, healthy: healthyAgents, revoked: agents.filter((a) => a.status === 'REVOKED').length },
      remediation: {
        open: openTickets.length,
        overdue: overdueTickets.length,
        resolved: tickets.filter((ticket) => ['RESOLVED', 'CLOSED'].includes(ticket.status)).length,
      },
      coverage: {
        signalsReported: signals.size,
        signalsInContract: SIGNAL_CATALOG.length,
        coveragePct: Math.round((signals.size / SIGNAL_CATALOG.length) * 100),
      },
      scanHistory: scans
        .map((scan) => ({
          at: scan.finishedAt,
          score: scan.score,
          failed: scan.failed,
          passed: scan.passed,
          label: new Date(scan.finishedAt).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }),
        }))
        .reverse(),
    })
  })
)

/** Audit-ready readiness report for one framework or the whole programme. */
router.get(
  '/readiness',
  requireUser,
  asyncRoute(async (req, res) => {
    const orgId = req.user.orgId
    const [org, findings, tickets] = await Promise.all([
      collection(COLLECTIONS.organizations).findOne({ id: orgId }),
      collection(COLLECTIONS.findings).find({ orgId }),
      collection(COLLECTIONS.tickets).find({ orgId }),
    ])

    const frameworks = {}
    for (const finding of findings) {
      const bucket = (frameworks[finding.frameworkCode] ||= {
        frameworkCode: finding.frameworkCode,
        total: 0,
        passed: 0,
        failed: 0,
        warned: 0,
        notApplicable: 0,
        weightEarned: 0,
        weightPossible: 0,
        openFindings: [],
      })
      bucket.total += 1
      const weight = SEVERITY_WEIGHT[finding.severity] || 1
      if (finding.status !== 'NOT_APPLICABLE') {
        bucket.weightPossible += weight
        if (finding.status === 'PASS') bucket.weightEarned += weight
        if (finding.status === 'WARN') bucket.weightEarned += weight * 0.6
      }
      if (finding.status === 'PASS') bucket.passed += 1
      else if (finding.status === 'FAIL') bucket.failed += 1
      else if (finding.status === 'WARN') bucket.warned += 1
      else bucket.notApplicable += 1

      if (finding.status === 'FAIL') {
        bucket.openFindings.push({
          checkCode: finding.checkCode,
          controlCode: finding.controlCode,
          title: finding.title,
          severity: finding.severity,
          detail: finding.detail,
          remediation: finding.remediation,
          firstSeenAt: finding.firstSeenAt,
          ticket: tickets.find((ticket) => ticket.findingId === finding.id)?.externalKey || null,
        })
      }
    }

    const report = Object.values(frameworks).map((bucket) => ({
      ...bucket,
      readinessPct: bucket.weightPossible
        ? Math.round((bucket.weightEarned / bucket.weightPossible) * 100)
        : 0,
    }))

    res.json({
      organization: org?.name || null,
      generatedAt: new Date().toISOString(),
      generatedFor: req.user.email,
      overallScore: org?.complianceScore ?? 0,
      frameworks: report.sort((a, b) => a.frameworkCode.localeCompare(b.frameworkCode)),
    })
  })
)

export default router
