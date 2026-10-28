import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
export const ROOT = path.resolve(here, '../..')

// Minimal .env loader - keeps the service dependency-free.
function loadDotEnv() {
  const file = path.join(ROOT, '.env')
  if (!fs.existsSync(file)) return
  for (const rawLine of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    const eq = line.indexOf('=')
    if (eq === -1) continue
    const key = line.slice(0, eq).trim()
    const value = line.slice(eq + 1).trim().replace(/^["']|["']$/g, '')
    if (process.env[key] === undefined) process.env[key] = value
  }
}

loadDotEnv()

export const config = {
  port: Number(process.env.PORT || 8080),
  nodeEnv: process.env.NODE_ENV || 'development',
  jwtSecret: process.env.JWT_SECRET || 'lopsin-dev-secret-do-not-use-in-production',
  tokenTtlHours: Number(process.env.TOKEN_TTL_HOURS || 12),
  mongoUri: (process.env.MONGODB_URI || '').trim(),
  mongoDb: process.env.MONGODB_DB || 'lopsin',
  fileDbPath: path.resolve(ROOT, process.env.FILE_DB_PATH || './data/lopsin.json'),
  privacyGuard: (process.env.PRIVACY_GUARD || 'STRICT').toUpperCase(),
  llmProvider: (process.env.LLM_PROVIDER || 'groq').toLowerCase(),
  llmModel: process.env.LLM_MODEL || 'openai/gpt-oss-120b',
  llmApiKeys: (process.env.LLM_API_KEYS || '')
    .split(',')
    .map((key) => key.trim())
    .filter(Boolean),
}
