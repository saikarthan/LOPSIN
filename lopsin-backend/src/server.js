import { createApp } from './app.js'
import { config } from './config/env.js'
import { connectDb, collection, COLLECTIONS } from './db/index.js'
import { seedIfEmpty } from './db/seed.js'

async function main() {
  await connectDb()
  await seedIfEmpty()

  const app = createApp()
  const server = app.listen(config.port, () => {
    console.log(`[lopsin] API listening on http://localhost:${config.port}/api`)
    console.log(`[lopsin] privacy guard: ${config.privacyGuard}`)
  })

  const shutdown = async (signal) => {
    console.log(`\n[lopsin] ${signal} received, shutting down`)
    server.close(() => process.exit(0))
  }
  process.on('SIGINT', () => shutdown('SIGINT'))
  process.on('SIGTERM', () => shutdown('SIGTERM'))

  const orgCount = await collection(COLLECTIONS.organizations).countDocuments({})
  console.log(`[lopsin] ${orgCount} organisation(s) in the tenant registry`)
}

main().catch((error) => {
  console.error('[lopsin] failed to start:', error)
  process.exit(1)
})
