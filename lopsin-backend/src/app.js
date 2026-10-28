import express from 'express'
import cors from 'cors'

import { config } from './config/env.js'
import { db } from './db/index.js'
import { notFound, errorHandler } from './middleware/errorHandler.js'

import authRoutes from './routes/auth.js'
import catalogRoutes from './routes/catalog.js'
import agentRoutes from './routes/agents.js'
import ingestRoutes from './routes/ingest.js'
import findingRoutes from './routes/findings.js'
import remediationRoutes from './routes/remediation.js'
import integrationRoutes from './routes/integrations.js'
import dashboardRoutes from './routes/dashboard.js'
import userRoutes from './routes/users.js'
import auditRoutes from './routes/audit.js'

export function createApp() {
  const app = express()

  app.use(cors())
  app.use(express.json({ limit: '256kb' }))

  // Security headers. The API serves JSON only, so the policy can be strict.
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff')
    res.setHeader('X-Frame-Options', 'DENY')
    res.setHeader('Referrer-Policy', 'no-referrer')
    res.setHeader('Cache-Control', 'no-store')
    next()
  })

  app.get('/api/health', (_req, res) => {
    res.json({
      service: 'lopsin-api',
      status: 'UP',
      driver: db().driver,
      privacyGuard: config.privacyGuard,
      time: new Date().toISOString(),
    })
  })

  app.use('/api/auth', authRoutes)
  app.use('/api', catalogRoutes)
  app.use('/api/agents', agentRoutes)
  app.use('/api/agent', ingestRoutes)
  app.use('/api/findings', findingRoutes)
  app.use('/api/remediation', remediationRoutes)
  app.use('/api/integrations', integrationRoutes)
  app.use('/api/dashboard', dashboardRoutes)
  app.use('/api/users', userRoutes)
  app.use('/api/audit', auditRoutes)

  app.use(notFound)
  app.use(errorHandler)

  return app
}
