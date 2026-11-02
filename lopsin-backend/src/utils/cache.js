/**
 * Tiny in-process TTL cache. Lives only for the life of a warm serverless
 * instance - it never needs to be its own service. Used to avoid re-querying
 * the database on every request for values that rarely change (e.g. "is this
 * user still active"), which is the dominant cost on a cold/shared-tier DB.
 */
const store = new Map()

export function cached(key, ttlMs, loader) {
  const hit = store.get(key)
  if (hit && hit.expiresAt > Date.now()) return hit.value

  const value = Promise.resolve(loader()).catch((error) => {
    store.delete(key)
    throw error
  })
  store.set(key, { value, expiresAt: Date.now() + ttlMs })
  return value
}

export function invalidate(key) {
  store.delete(key)
}
