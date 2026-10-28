import fs from 'node:fs'
import path from 'node:path'

/**
 * Embedded JSON document store.
 *
 * Implements the same small collection API as the MongoDB driver adapter
 * (insertOne / find / findOne / updateOne / deleteOne / countDocuments), including
 * the query operator subset Lopsin uses: $in, $gte, $lte, $ne, $exists, $regex.
 * Writes are serialised and flushed atomically via a temp file + rename.
 */
export class FileStore {
  constructor(filePath) {
    this.filePath = filePath
    this.state = { collections: {} }
    this.writeQueue = Promise.resolve()
  }

  async connect() {
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true })
    if (fs.existsSync(this.filePath)) {
      const raw = fs.readFileSync(this.filePath, 'utf8').trim()
      if (raw) {
        try {
          const parsed = JSON.parse(raw)
          if (parsed && typeof parsed === 'object' && parsed.collections) this.state = parsed
        } catch {
          // Corrupt file: start clean rather than crash the service.
          this.state = { collections: {} }
        }
      }
    }
    return this
  }

  async close() {
    await this.writeQueue
  }

  get driver() {
    return 'file'
  }

  bucket(name) {
    if (!this.state.collections[name]) this.state.collections[name] = []
    return this.state.collections[name]
  }

  flush() {
    this.writeQueue = this.writeQueue.then(async () => {
      const payload = JSON.stringify(this.state, null, 2)
      // A unique temp name per write: a fixed one races if a second process (a
      // stray dev server, a test run) is writing the same store at the same time.
      const tmp = `${this.filePath}.${process.pid}.${Date.now()}.tmp`
      try {
        await fs.promises.writeFile(tmp, payload, 'utf8')
        await fs.promises.rename(tmp, this.filePath)
      } catch {
        // Sync clients (OneDrive, Dropbox) watch the directory and can snatch the
        // temp file before the rename lands. Write in place rather than lose data.
        await fs.promises.rm(tmp, { force: true }).catch(() => {})
        await fs.promises.writeFile(this.filePath, payload, 'utf8')
      }
    })
    return this.writeQueue
  }

  collection(name) {
    return new FileCollection(this, name)
  }

  async dropAll() {
    this.state = { collections: {} }
    await this.flush()
  }
}

function getPath(doc, field) {
  return field.split('.').reduce((acc, key) => (acc == null ? acc : acc[key]), doc)
}

function matchOperators(actual, expected) {
  if (expected === null) return actual === null || actual === undefined
  if (Array.isArray(expected)) return JSON.stringify(actual) === JSON.stringify(expected)
  if (typeof expected !== 'object') {
    if (Array.isArray(actual)) return actual.includes(expected)
    return actual === expected
  }
  return Object.entries(expected).every(([op, value]) => {
    switch (op) {
      case '$in': return Array.isArray(actual)
        ? actual.some((item) => value.includes(item))
        : value.includes(actual)
      case '$nin': return !value.includes(actual)
      case '$ne': return actual !== value
      case '$gt': return actual > value
      case '$gte': return actual >= value
      case '$lt': return actual < value
      case '$lte': return actual <= value
      case '$exists': return (actual !== undefined) === Boolean(value)
      case '$regex': return new RegExp(value, expected.$options || '').test(String(actual ?? ''))
      case '$options': return true
      default: return false
    }
  })
}

export function matchesQuery(doc, query = {}) {
  return Object.entries(query).every(([field, expected]) => {
    if (field === '$or') return expected.some((sub) => matchesQuery(doc, sub))
    if (field === '$and') return expected.every((sub) => matchesQuery(doc, sub))
    return matchOperators(getPath(doc, field), expected)
  })
}

export function applySort(docs, sort) {
  if (!sort) return docs
  const entries = Object.entries(sort)
  return [...docs].sort((a, b) => {
    for (const [field, direction] of entries) {
      const av = getPath(a, field)
      const bv = getPath(b, field)
      if (av === bv) continue
      const result = av === undefined ? -1 : bv === undefined ? 1 : av > bv ? 1 : -1
      return result * (direction < 0 ? -1 : 1)
    }
    return 0
  })
}

export function applyUpdate(doc, update) {
  const next = { ...doc }
  if (update.$set) Object.assign(next, update.$set)
  if (update.$unset) for (const key of Object.keys(update.$unset)) delete next[key]
  if (update.$inc) {
    for (const [key, amount] of Object.entries(update.$inc)) next[key] = (next[key] || 0) + amount
  }
  if (update.$push) {
    for (const [key, value] of Object.entries(update.$push)) {
      next[key] = [...(next[key] || []), value]
    }
  }
  const hasOperator = Object.keys(update).some((key) => key.startsWith('$'))
  return hasOperator ? next : { ...next, ...update }
}

class FileCollection {
  constructor(store, name) {
    this.store = store
    this.name = name
  }

  async insertOne(doc) {
    this.store.bucket(this.name).push(doc)
    await this.store.flush()
    return { insertedId: doc.id, acknowledged: true }
  }

  async insertMany(docs) {
    this.store.bucket(this.name).push(...docs)
    await this.store.flush()
    return { insertedCount: docs.length, acknowledged: true }
  }

  async findOne(query = {}) {
    return this.store.bucket(this.name).find((doc) => matchesQuery(doc, query)) || null
  }

  async find(query = {}, options = {}) {
    let docs = this.store.bucket(this.name).filter((doc) => matchesQuery(doc, query))
    docs = applySort(docs, options.sort)
    if (options.skip) docs = docs.slice(options.skip)
    if (options.limit) docs = docs.slice(0, options.limit)
    return docs.map((doc) => ({ ...doc }))
  }

  async updateOne(query, update) {
    const bucket = this.store.bucket(this.name)
    const index = bucket.findIndex((doc) => matchesQuery(doc, query))
    if (index === -1) return { matchedCount: 0, modifiedCount: 0 }
    bucket[index] = applyUpdate(bucket[index], update)
    await this.store.flush()
    return { matchedCount: 1, modifiedCount: 1 }
  }

  async updateMany(query, update) {
    const bucket = this.store.bucket(this.name)
    let modified = 0
    bucket.forEach((doc, index) => {
      if (matchesQuery(doc, query)) {
        bucket[index] = applyUpdate(doc, update)
        modified += 1
      }
    })
    if (modified) await this.store.flush()
    return { matchedCount: modified, modifiedCount: modified }
  }

  async deleteOne(query) {
    const bucket = this.store.bucket(this.name)
    const index = bucket.findIndex((doc) => matchesQuery(doc, query))
    if (index === -1) return { deletedCount: 0 }
    bucket.splice(index, 1)
    await this.store.flush()
    return { deletedCount: 1 }
  }

  async deleteMany(query = {}) {
    const bucket = this.store.bucket(this.name)
    const kept = bucket.filter((doc) => !matchesQuery(doc, query))
    const deleted = bucket.length - kept.length
    this.store.state.collections[this.name] = kept
    if (deleted) await this.store.flush()
    return { deletedCount: deleted }
  }

  async countDocuments(query = {}) {
    return this.store.bucket(this.name).filter((doc) => matchesQuery(doc, query)).length
  }
}
