import { Router } from 'express'
import { collection, COLLECTIONS } from '../db/index.js'
import { requireUser, requireRole } from '../middleware/auth.js'
import { ApiError, asyncRoute } from '../middleware/errorHandler.js'
import { hashPassword } from '../utils/crypto.js'
import { newId, nowIso } from '../utils/ids.js'
import { recordAudit } from '../utils/audit.js'

const router = Router()

export const ROLES = ['ADMIN', 'COMPLIANCE', 'AUDITOR']
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

const strip = ({ passwordHash, ...safe }) => safe

router.get(
  '/',
  requireUser,
  requireRole('ADMIN'),
  asyncRoute(async (req, res) => {
    const users = await collection(COLLECTIONS.users).find(
      { orgId: req.user.orgId },
      { sort: { createdAt: 1 } }
    )
    res.json(users.map(strip))
  })
)

router.post(
  '/',
  requireUser,
  requireRole('ADMIN'),
  asyncRoute(async (req, res) => {
    const email = String(req.body?.email || '').trim().toLowerCase()
    const fullName = String(req.body?.fullName || '').trim()
    const role = String(req.body?.role || 'AUDITOR').toUpperCase()
    const password = String(req.body?.password || '')

    if (!fullName) throw new ApiError(400, 'Full name is required')
    if (!EMAIL_PATTERN.test(email)) throw new ApiError(400, 'Enter a valid email address')
    if (!ROLES.includes(role)) throw new ApiError(400, `Role must be one of: ${ROLES.join(', ')}`)
    if (password.length < 10) throw new ApiError(400, 'Password must be at least 10 characters')

    const existing = await collection(COLLECTIONS.users).findOne({ email })
    if (existing) throw new ApiError(409, 'A user with this email already exists')

    const user = {
      id: newId('usr'),
      orgId: req.user.orgId,
      email,
      fullName,
      role,
      status: 'ACTIVE',
      passwordHash: hashPassword(password),
      createdAt: nowIso(),
      lastLoginAt: null,
    }
    await collection(COLLECTIONS.users).insertOne(user)
    await recordAudit({
      orgId: req.user.orgId,
      actor: req.user.email,
      actorRole: req.user.role,
      action: 'USER_CREATED',
      target: user.id,
      detail: `${email} as ${role}`,
    })
    res.status(201).json(strip(user))
  })
)

router.put(
  '/:id',
  requireUser,
  requireRole('ADMIN'),
  asyncRoute(async (req, res) => {
    const user = await collection(COLLECTIONS.users).findOne({ id: req.params.id, orgId: req.user.orgId })
    if (!user) throw new ApiError(404, 'User not found')

    const update = {}
    if (req.body?.fullName !== undefined) {
      const fullName = String(req.body.fullName).trim()
      if (!fullName) throw new ApiError(400, 'Full name cannot be empty')
      update.fullName = fullName
    }
    if (req.body?.role !== undefined) {
      const role = String(req.body.role).toUpperCase()
      if (!ROLES.includes(role)) throw new ApiError(400, `Role must be one of: ${ROLES.join(', ')}`)
      if (user.id === req.user.id && role !== 'ADMIN') {
        throw new ApiError(400, 'You cannot remove your own administrator role')
      }
      update.role = role
    }
    if (req.body?.status !== undefined) {
      const status = String(req.body.status).toUpperCase()
      if (!['ACTIVE', 'SUSPENDED'].includes(status)) throw new ApiError(400, 'Status must be ACTIVE or SUSPENDED')
      if (user.id === req.user.id && status !== 'ACTIVE') {
        throw new ApiError(400, 'You cannot suspend your own account')
      }
      update.status = status
    }
    if (req.body?.password) {
      const password = String(req.body.password)
      if (password.length < 10) throw new ApiError(400, 'Password must be at least 10 characters')
      update.passwordHash = hashPassword(password)
    }

    await collection(COLLECTIONS.users).updateOne({ id: user.id }, { $set: update })
    await recordAudit({
      orgId: req.user.orgId,
      actor: req.user.email,
      actorRole: req.user.role,
      action: 'USER_UPDATED',
      target: user.id,
      detail: Object.keys(update).filter((key) => key !== 'passwordHash').join(', ') || 'credentials',
    })

    const updated = await collection(COLLECTIONS.users).findOne({ id: user.id })
    res.json(strip(updated))
  })
)

router.delete(
  '/:id',
  requireUser,
  requireRole('ADMIN'),
  asyncRoute(async (req, res) => {
    if (req.params.id === req.user.id) throw new ApiError(400, 'You cannot delete your own account')
    const result = await collection(COLLECTIONS.users).deleteOne({ id: req.params.id, orgId: req.user.orgId })
    if (!result.deletedCount) throw new ApiError(404, 'User not found')
    await recordAudit({
      orgId: req.user.orgId,
      actor: req.user.email,
      actorRole: req.user.role,
      action: 'USER_DELETED',
      target: req.params.id,
    })
    res.status(204).end()
  })
)

export default router
