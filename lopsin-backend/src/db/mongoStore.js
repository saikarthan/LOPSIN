/**
 * MongoDB adapter. Exposes exactly the same collection surface as FileStore so the
 * rest of the codebase never branches on driver. Activated by setting MONGODB_URI.
 */
export class MongoStore {
  constructor(uri, dbName) {
    this.uri = uri
    this.dbName = dbName
    this.client = null
    this.db = null
  }

  get driver() {
    return 'mongodb'
  }

  async connect() {
    const { MongoClient } = await import('mongodb')
    this.client = new MongoClient(this.uri, { serverSelectionTimeoutMS: 5000 })
    await this.client.connect()
    this.db = this.client.db(this.dbName)
    await this.ensureIndexes()
    return this
  }

  async ensureIndexes() {
    await this.db.collection('users').createIndex({ email: 1 }, { unique: true })
    await this.db.collection('signals').createIndex({ orgId: 1, key: 1, collectedAt: -1 })
    await this.db.collection('findings').createIndex({ orgId: 1, status: 1, severity: 1 })
    await this.db.collection('agents').createIndex({ orgId: 1 })
  }

  async close() {
    if (this.client) await this.client.close()
  }

  collection(name) {
    return new MongoCollection(this.db.collection(name))
  }

  async dropAll() {
    const names = await this.db.listCollections().toArray()
    for (const { name } of names) await this.db.collection(name).deleteMany({})
  }
}

const PROJECTION = { projection: { _id: 0 } }

class MongoCollection {
  constructor(raw) {
    this.raw = raw
  }

  insertOne(doc) {
    return this.raw.insertOne({ ...doc })
  }

  insertMany(docs) {
    return this.raw.insertMany(docs.map((doc) => ({ ...doc })))
  }

  findOne(query = {}) {
    return this.raw.findOne(query, PROJECTION)
  }

  find(query = {}, options = {}) {
    let cursor = this.raw.find(query, PROJECTION)
    if (options.sort) cursor = cursor.sort(options.sort)
    if (options.skip) cursor = cursor.skip(options.skip)
    if (options.limit) cursor = cursor.limit(options.limit)
    return cursor.toArray()
  }

  updateOne(query, update) {
    return this.raw.updateOne(query, normaliseUpdate(update))
  }

  updateMany(query, update) {
    return this.raw.updateMany(query, normaliseUpdate(update))
  }

  deleteOne(query) {
    return this.raw.deleteOne(query)
  }

  deleteMany(query = {}) {
    return this.raw.deleteMany(query)
  }

  countDocuments(query = {}) {
    return this.raw.countDocuments(query)
  }
}

function normaliseUpdate(update) {
  const hasOperator = Object.keys(update).some((key) => key.startsWith('$'))
  return hasOperator ? update : { $set: update }
}
