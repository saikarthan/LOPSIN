import { Router } from 'express'
import { collection, COLLECTIONS } from '../db/index.js'
import { hashPassword, verifyPassword, issueToken } from '../utils/crypto.js'
import { ApiError, asyncRoute } from '../middleware/errorHandler.js'
import { requireUser } from '../middleware/auth.js'
import { newId, nowIso } from '../utils/ids.js'
import { recordAudit } from '../utils/audit.js'
import { FRAMEWORKS } from '../catalog/regulations.js'

const router = Router()

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

router.post(
  '/login',
  asyncRoute(async (req, res) => {
    const email = String(req.body?.email || '').trim().toLowerCase()
    const password = String(req.body?.password || '')
    if (!email || !password) throw new ApiError(400, 'Email and password are required')

    const user = await collection(COLLECTIONS.users).findOne({ email })
    if (!user || !verifyPassword(password, user.passwordHash)) {
      throw new ApiError(401, 'Invalid email or password')
    }
    if (user.status !== 'ACTIVE') throw new ApiError(403, 'This account has been deactivated')

    const org = await collection(COLLECTIONS.organizations).findOne({ id: user.orgId })
    const token = issueToken({ sub: user.id, role: user.role, orgId: user.orgId, typ: 'session' })

    await collection(COLLECTIONS.users).updateOne({ id: user.id }, { $set: { lastLoginAt: nowIso() } })
    await recordAudit({
      orgId: user.orgId,
      actor: user.email,
      actorRole: user.role,
      action: 'USER_SIGNED_IN',
      target: user.id,
    })

    res.json({
      token,
      userId: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      orgId: user.orgId,
      orgName: org?.name || null,
    })
  })
)

router.get(
  '/me',
  requireUser,
  asyncRoute(async (req, res) => {
    const org = await collection(COLLECTIONS.organizations).findOne({ id: req.user.orgId })
    res.json({ ...req.user, orgName: org?.name || null, org })
  })
)

/**
 * Self-serve onboarding. This is the front door for a company joining Lopsin:
 * it creates the tenant, its first administrator and a workspace scoped to the
 * frameworks that apply to them. No customer data is involved at any point.
 */
router.post(
  '/register-organization',
  asyncRoute(async (req, res) => {
    const name = String(req.body?.organizationName || '').trim()
    const fullName = String(req.body?.fullName || '').trim()
    const email = String(req.body?.email || '').trim().toLowerCase()
    const password = String(req.body?.password || '')
    const region = String(req.body?.region || 'Global').trim()
    const industry = String(req.body?.industry || 'Technology').trim()
    const requested = Array.isArray(req.body?.frameworks) ? req.body.frameworks : []

    if (!name || !fullName || !email || !password) {
      throw new ApiError(400, 'Organisation name, administrator name, email and password are all required')
    }
    if (!EMAIL_PATTERN.test(email)) throw new ApiError(400, 'Enter a valid work email address')
    if (password.length < 10) throw new ApiError(400, 'Password must be at least 10 characters')

    const existing = await collection(COLLECTIONS.users).findOne({ email })
    if (existing) throw new ApiError(409, 'An account already exists for this email address')

    const validCodes = new Set(FRAMEWORKS.map((framework) => framework.code))
    const enabledFrameworks = requested.filter((code) => validCodes.has(code))

    const org = {
      id: newId('org'),
      name,
      slug: name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
      industry,
      region,
      dataResidency: region,
      enabledFrameworks: enabledFrameworks.length ? enabledFrameworks : [...validCodes],
      complianceScore: 0,
      lastScanAt: null,
      createdAt: nowIso(),
    }
    await collection(COLLECTIONS.organizations).insertOne(org)

    const user = {
      id: newId('usr'),
      orgId: org.id,
      email,
      fullName,
      role: 'ADMIN',
      status: 'ACTIVE',
      passwordHash: hashPassword(password),
      createdAt: nowIso(),
      lastLoginAt: null,
    }
    await collection(COLLECTIONS.users).insertOne(user)

    await recordAudit({
      orgId: org.id,
      actor: email,
      actorRole: 'ADMIN',
      action: 'ORGANIZATION_REGISTERED',
      target: org.id,
      detail: `${name} onboarded with ${org.enabledFrameworks.length} frameworks`,
    })

    const token = issueToken({ sub: user.id, role: user.role, orgId: org.id, typ: 'session' })
    res.status(201).json({
      token,
      userId: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      orgId: org.id,
      orgName: org.name,
    })
  })
)

export default router
