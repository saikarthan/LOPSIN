import { createApp } from '../src/app.js'
import { connectDb } from '../src/db/index.js'
import { seedIfEmpty } from '../src/db/seed.js'

// Cached across warm invocations of the same serverless instance, so the DB
// connection and seed check only run once per container, not per request.
let appPromise

async function getApp() {
  if (!appPromise) {
    appPromise = (async () => {
      await connectDb()
      await seedIfEmpty()
      return createApp()
    })()
  }
  return appPromise
}

export default async function handler(req, res) {
  const app = await getApp()
  app(req, res)
}
