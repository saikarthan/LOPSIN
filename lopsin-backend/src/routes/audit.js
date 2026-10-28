import { Router } from 'express'
import { collection, COLLECTIONS } from '../db/index.js'
import { requireUser, requireRole } from '../middleware/auth.js'
import { asyncRoute } from '../middleware/errorHandler.js'

const router = Router()

router.get(
  '/',
  requireUser,
  requireRole('ADMIN', 'AUDITOR', 'COMPLIANCE'),
  asyncRoute(async (req, res) => {
    const query = { orgId: req.user.orgId }
    if (req.query.action) query.action = String(req.query.action).toUpperCase()
    const limit = Math.min(Number(req.query.limit) || 200, 500)
    const entries = await collection(COLLECTIONS.auditLogs).find(query, { sort: { at: -1 }, limit })
    res.json(entries)
  })
)

export default router
