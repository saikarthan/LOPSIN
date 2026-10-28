import crypto from 'node:crypto'

const ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyz'

export function newId(prefix) {
  const bytes = crypto.randomBytes(12)
  let out = ''
  for (const byte of bytes) out += ALPHABET[byte % ALPHABET.length]
  return prefix ? `${prefix}_${out}` : out
}

export function nowIso() {
  return new Date().toISOString()
}

export function sha256(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex')
}
