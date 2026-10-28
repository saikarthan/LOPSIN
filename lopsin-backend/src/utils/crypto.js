import crypto from 'node:crypto'
import { config } from '../config/env.js'

const SCRYPT_KEYLEN = 64

/** Password hashing: scrypt with a per-password salt. No native build step. */
export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex')
  const derived = crypto.scryptSync(String(password), salt, SCRYPT_KEYLEN).toString('hex')
  return `scrypt$${salt}$${derived}`
}

export function verifyPassword(password, stored) {
  if (typeof stored !== 'string') return false
  const [scheme, salt, digest] = stored.split('$')
  if (scheme !== 'scrypt' || !salt || !digest) return false
  const derived = crypto.scryptSync(String(password), salt, SCRYPT_KEYLEN)
  const expected = Buffer.from(digest, 'hex')
  if (expected.length !== derived.length) return false
  return crypto.timingSafeEqual(derived, expected)
}

const b64url = (buf) =>
  Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

const b64urlDecode = (str) =>
  Buffer.from(str.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8')

function sign(data) {
  return b64url(crypto.createHmac('sha256', config.jwtSecret).update(data).digest())
}

/** HS256 JWT issue/verify implemented on node:crypto - no third-party token library. */
export function issueToken(payload, ttlHours = config.tokenTtlHours) {
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const issuedAt = Math.floor(Date.now() / 1000)
  const body = b64url(
    JSON.stringify({ ...payload, iat: issuedAt, exp: issuedAt + Math.round(ttlHours * 3600) })
  )
  return `${header}.${body}.${sign(`${header}.${body}`)}`
}

export function verifyToken(token) {
  if (typeof token !== 'string') return null
  const parts = token.split('.')
  if (parts.length !== 3) return null
  const [header, body, signature] = parts
  const expected = sign(`${header}.${body}`)
  const a = Buffer.from(signature)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null
  try {
    const payload = JSON.parse(b64urlDecode(body))
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null
    return payload
  } catch {
    return null
  }
}

/** Agent enrollment secrets are shown once and stored only as a SHA-256 digest. */
export function newAgentSecret() {
  return `lpsn_${crypto.randomBytes(24).toString('hex')}`
}
