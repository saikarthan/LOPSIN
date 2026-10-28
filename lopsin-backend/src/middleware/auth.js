import { verifyToken } from '../utils/crypto.js'
import { collection, COLLECTIONS } from '../db/index.js'
import { sha256 } from '../utils/ids.js'
import { ApiError } from './errorHandler.js'

function bearer(req) {
  const header = req.headers.authorization || ''
  return header.startsWith('Bearer ') ? header.slice(7).trim() : null
}

/** Dashboard session auth - a human user signed in to the console. */
export async function requireUser(req, _res, next) {
  try {
    const token = bearer(req)
    if (!token) throw new ApiError(401, 'Authentication required')
    const payload = verifyToken(token)
    if (!payload || payload.typ !== 'session') throw new ApiError(401, 'Session expired, please sign in again')

    const user = await collection(COLLECTIONS.users).findOne({ id: payload.sub })
    if (!user || user.status !== 'ACTIVE') throw new ApiError(401, 'Account is no longer active')

    req.user = {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      orgId: user.orgId,
    }
    next()
  } catch (error) {
    next(error)
  }
}

/** Role gate. Usage: requireRole('ADMIN', 'COMPLIANCE') */
export function requireRole(...roles) {
  return (req, _res, next) => {
    if (!req.user) return next(new ApiError(401, 'Authentication required'))
    if (!roles.includes(req.user.role)) {
      return next(new ApiError(403, `This action requires one of: ${roles.join(', ')}`))
    }
    next()
  }
}

/** Agent auth - a collector running inside the customer estate. */
export async function requireAgent(req, _res, next) {
  try {
    const token = bearer(req)
    if (!token) throw new ApiError(401, 'Agent credential required')

    const agent = await collection(COLLECTIONS.agents).findOne({ secretHash: sha256(token) })
    if (!agent) throw new ApiError(401, 'Unknown or revoked agent credential')
    if (agent.status === 'REVOKED') throw new ApiError(403, 'This agent credential has been revoked')

    req.agent = agent
    next()
  } catch (error) {
    next(error)
  }
}
