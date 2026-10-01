/**
 * Express application factory.
 *
 * Separate from `server.js`, which owns the process lifecycle. This module has
 * NO side effects beyond wiring middleware: importing it does not bind a port,
 * does not connect to MongoDB, and does not read the filesystem. Tests import
 * `createApp()` and drive it with a plain request helper.
 *
 * Middleware order matters:
 *   1. disable x-powered-by  — do not advertise the framework
 *   2. request logging       — needs to wrap everything after it
 *   3. body parsing          — malformed JSON is turned into an error here
 *   4. routes
 *   5. 404                   — nothing matched
 *   6. error handler         — MUST be last
 */

import express from 'express'

import { createLogger, silentLogger } from './lib/logger.js'
import { errorHandler } from './middleware/error-handler.js'
import { notFoundHandler } from './middleware/not-found.js'
import { requestLogger } from './middleware/request-logger.js'
import { createApiRouter } from './routes/index.js'
import { createHealthRouter } from './routes/health.js'

/** Reject oversized bodies before they are parsed into memory. */
export const JSON_BODY_LIMIT = '100kb'

/**
 * @typedef {object} CreateAppOptions
 * @property {import('./config/index.js').ServerConfig} config
 * @property {import('./lib/logger.js').Logger} [logger]
 * @property {number} [startedAt]
 */

/**
 * Build the Express app.
 *
 * @param {CreateAppOptions} options
 * @returns {import('express').Express}
 */
export function createApp({ config, logger = silentLogger, startedAt = Date.now() }) {
  const app = express()

  // 1. Do not advertise Express in response headers.
  app.disable('x-powered-by')

  // Trust exactly one proxy hop by default. Correct this per deployment before
  // relying on `req.ip` or `secure` for anything security-relevant.
  app.set('trust proxy', false)

  // 2. Request logging, before anything that could fail.
  app.use(requestLogger({ logger, config }))

  // 3. Body parsing. A malformed JSON body throws a SyntaxError that
  //    `errorHandler` converts into a 400 with a stable code.
  app.use(express.json({ limit: JSON_BODY_LIMIT }))

  // 4. Routes.
  app.use(createHealthRouter({ config, startedAt }))
  app.use('/api', createApiRouter())

  // 5. Unmatched route -> 404.
  app.use(notFoundHandler())

  // 6. Error handler, last.
  app.use(errorHandler({ logger, config }))

  return app
}

/**
 * Convenience wrapper that builds a logger for the given config. Used by
 * `server.js`; tests pass `silentLogger` instead.
 *
 * @param {import('./config/index.js').ServerConfig} config
 */
export function createDefaultLogger(config) {
  return createLogger({
    service: config.serviceName,
    // Verbose in development so a developer sees every request; quiet in test.
    level: config.isTest ? 'error' : config.isProduction ? 'info' : 'debug',
  })
}