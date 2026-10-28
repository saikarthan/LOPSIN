import { config } from '../config/env.js'
import { FileStore } from './fileStore.js'
import { MongoStore } from './mongoStore.js'

let store = null

/**
 * Picks the data driver. MONGODB_URI wins when set and reachable; otherwise the
 * embedded JSON document store is used so the platform always boots.
 */
export async function connectDb({ quiet = false } = {}) {
  if (store) return store
  if (config.mongoUri) {
    try {
      store = await new MongoStore(config.mongoUri, config.mongoDb).connect()
      if (!quiet) console.log(`[db] connected to MongoDB database "${config.mongoDb}"`)
      return store
    } catch (error) {
      console.warn(`[db] MongoDB unavailable (${error.message}); falling back to embedded store`)
    }
  }
  store = await new FileStore(config.fileDbPath).connect()
  if (!quiet) console.log(`[db] using embedded document store at ${config.fileDbPath}`)
  return store
}

export function db() {
  if (!store) throw new Error('Database not connected - call connectDb() first')
  return store
}

export function collection(name) {
  return db().collection(name)
}

export async function closeDb() {
  if (store) await store.close()
  store = null
}

export const COLLECTIONS = {
  users: 'users',
  organizations: 'organizations',
  agents: 'agents',
  frameworks: 'frameworks',
  checks: 'checks',
  signals: 'signals',
  findings: 'findings',
  tickets: 'tickets',
  integrations: 'integrations',
  auditLogs: 'auditLogs',
  scans: 'scans',
}
