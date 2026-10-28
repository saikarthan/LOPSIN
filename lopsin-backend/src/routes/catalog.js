import { Router } from 'express'
import { collection, COLLECTIONS } from '../db/index.js'
import { FRAMEWORKS, frameworkDocuments, flattenChecks } from '../catalog/regulations.js'
import { SIGNAL_CATALOG } from '../catalog/signals.js'
import { GUARD_RULES } from '../engine/privacyGuard.js'
import { ApiError, asyncRoute } from '../middleware/errorHandler.js'
import { requireUser, requireRole } from '../middleware/auth.js'
import { recordAudit } from '../utils/audit.js'

const router = Router()

/** Public surface used by the marketing site - no authentication, no tenant data. */
router.get('/public/overview', (_req, res) => {
  res.json({
    frameworks: frameworkDocuments().map(({ controls, ...rest }) => rest),
    totalFrameworks: FRAMEWORKS.length,
    totalControls: FRAMEWORKS.reduce((total, f) => total + f.controls.length, 0),
    totalChecks: flattenChecks().length,
    signalContractSize: SIGNAL_CATALOG.length,
    guardRules: GUARD_RULES,
  })
})

/** The published signal contract - what an agent is permitted to send. */
router.get('/public/signal-contract', (_req, res) => {
  res.json({ signals: SIGNAL_CATALOG, guardRules: GUARD_RULES })
})

router.get(
  '/frameworks',
  requireUser,
  asyncRoute(async (req, res) => {
    const org = await collection(COLLECTIONS.organizations).findOne({ id: req.user.orgId })
    const enabled = org?.enabledFrameworks || []
    const findings = await collection(COLLECTIONS.findings).find({ orgId: req.user.orgId })

    const byFramework = new Map()
    for (const finding of findings) {
      const bucket = byFramework.get(finding.frameworkCode) || { passed: 0, failed: 0, warned: 0, notApplicable: 0 }
      if (finding.status === 'PASS') bucket.passed += 1
      else if (finding.status === 'FAIL') bucket.failed += 1
      else if (finding.status === 'WARN') bucket.warned += 1
      else bucket.notApplicable += 1
      byFramework.set(finding.frameworkCode, bucket)
    }

    res.json(
      frameworkDocuments().map((framework) => ({
        ...framework,
        enabled: enabled.includes(framework.code),
        posture: byFramework.get(framework.code) || { passed: 0, failed: 0, warned: 0, notApplicable: 0 },
      }))
    )
  })
)

router.get(
  '/frameworks/:code',
  requireUser,
  asyncRoute(async (req, res) => {
    const framework = FRAMEWORKS.find((item) => item.code === req.params.code)
    if (!framework) throw new ApiError(404, 'Framework not found')

    const findings = await collection(COLLECTIONS.findings).find({
      orgId: req.user.orgId,
      frameworkCode: framework.code,
    })
    const byCheck = new Map(findings.map((finding) => [finding.checkCode, finding]))

    res.json({
      code: framework.code,
      name: framework.name,
      region: framework.region,
      version: framework.version,
      authority: framework.authority,
      summary: framework.summary,
      controls: framework.controls.map((control) => ({
        code: control.code,
        title: control.title,
        requirement: control.requirement,
        checks: control.checks.map((check) => ({
          code: check.code,
          title: check.title,
          severity: check.severity,
          signalKey: check.signalKey,
          rationale: check.rationale,
          remediation: check.remediation,
          status: byCheck.get(check.code)?.status || 'NOT_EVALUATED',
          observed: byCheck.get(check.code)?.observed ?? null,
          expected: byCheck.get(check.code)?.expected ?? null,
        })),
      })),
    })
  })
)

/** Switch a framework on or off for the tenant, then the next scan honours it. */
router.put(
  '/frameworks/:code/enabled',
  requireUser,
  requireRole('ADMIN', 'COMPLIANCE'),
  asyncRoute(async (req, res) => {
    const code = req.params.code
    if (!FRAMEWORKS.some((framework) => framework.code === code)) {
      throw new ApiError(404, 'Framework not found')
    }
    const enabled = Boolean(req.body?.enabled)
    const org = await collection(COLLECTIONS.organizations).findOne({ id: req.user.orgId })
    const current = new Set(org?.enabledFrameworks || [])
    if (enabled) current.add(code)
    else current.delete(code)

    await collection(COLLECTIONS.organizations).updateOne(
      { id: req.user.orgId },
      { $set: { enabledFrameworks: [...current] } }
    )
    await recordAudit({
      orgId: req.user.orgId,
      actor: req.user.email,
      actorRole: req.user.role,
      action: enabled ? 'FRAMEWORK_ENABLED' : 'FRAMEWORK_DISABLED',
      target: code,
    })
    res.json({ code, enabled, enabledFrameworks: [...current] })
  })
)

router.get('/signal-contract', requireUser, (_req, res) => {
  res.json({ signals: SIGNAL_CATALOG, guardRules: GUARD_RULES })
})

export default router
