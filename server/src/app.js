import cors from 'cors'
import express from 'express'
import helmet from 'helmet'
import mongoose from 'mongoose'

import { createApiRouter } from './routes/api.js'
import { User } from './models/User.js'

export function createApp(config, { UserModel = User } = {}) {
  const app = express()
  const clientOrigins = new Set([config.CLIENT_URL])
  const configuredClient = new URL(config.CLIENT_URL)
  if (config.NODE_ENV !== 'production' && ['localhost', '127.0.0.1'].includes(configuredClient.hostname)) {
    configuredClient.hostname = configuredClient.hostname === 'localhost' ? '127.0.0.1' : 'localhost'
    clientOrigins.add(configuredClient.origin)
  }

  app.disable('x-powered-by')
  app.use(helmet())
  app.use(cors({
    origin(origin, callback) {
      if (!origin || clientOrigins.has(origin)) return callback(null, true)
      return callback(new Error('Origin is not allowed by CORS.'))
    },
    credentials: false,
  }))
  app.use(express.json({ limit: '10kb' }))
  app.locals.databaseReady = mongoose.connection.readyState === 1
  mongoose.connection.on('connected', () => { app.locals.databaseReady = true })
  mongoose.connection.on('disconnected', () => { app.locals.databaseReady = false })
  app.use('/api/v1', createApiRouter(config, UserModel))
  app.use((request, response) => response.status(404).json({
    success: false,
    error: { code: 'NOT_FOUND', message: 'API route not found.' },
  }))
  app.use((error, request, response, next) => {
    if (response.headersSent) return next(error)
    if (error instanceof SyntaxError && 'body' in error) {
      return response.status(400).json({ success: false, error: { code: 'INVALID_JSON', message: 'Request body must be valid JSON.' } })
    }
    if (error?.name === 'ValidationError') {
      return response.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Check the submitted fields.' } })
    }
    console.error(error)
    return response.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Something went wrong.' } })
  })
  return app
}