/**
 * HTTP server bootstrap and process lifecycle.
 *
 * Owns everything `app.js` deliberately does not: reading the environment,
 * validating configuration, binding the port, and shutting down cleanly.
 *
 * Graceful shutdown (SIGINT / SIGTERM):
 *   1. stop accepting new connections
 *   2. let in-flight requests finish, up to a deadline
 *   3. force-close whatever is still open, so the process always exits
 *
 * No MongoDB teardown, because MongoDB is not connected yet (Prompt 004). The
 * comment marks where that hook belongs.
 */

import { pathToFileURL } from 'node:url'

import { createApp, createDefaultLogger } from './app.js'
import { loadConfig } from './config/index.js'

/** How long in-flight requests may take to finish before we force close. */
export const SHUTDOWN_TIMEOUT_MS = 10_000

/**
 * Start the server.
 *
 * @param {object} [options]
 * @param {import('./config/index.js').ServerConfig} [options.config]
 * @returns {{ server: import('node:http').Server, config: object, close: () => Promise<void> }}
 */
export function startServer({ config = loadConfig() } = {}) {
  const logger = createDefaultLogger(config)
  const app = createApp({ config, logger })

  const server = app.listen(config.port, () => {
    // Only safe facts are logged: never the Mongo URI, never env values.
    logger.info('focus-mode server listening', {
      environment: config.nodeEnv,
      port: config.port,
      // Presence only. The value can contain credentials.
      mongodbUriConfigured: config.hasMongodbUri,
      database: 'not_implemented',
      pid: process.pid,
    })
  })

  server.on('error', (error) => {
    logger.error('http server error', { message: error.message, code: error.code })
    process.exitCode = 1
  })

  const close = () =>
    new Promise((resolve) => {
      if (!server.listening) {
        resolve()
        return
      }

      logger.info('shutdown requested, draining connections', {
        graceMs: SHUTDOWN_TIMEOUT_MS,
      })

      const timer = setTimeout(() => {
        logger.warn('shutdown deadline reached, forcing close', { graceMs: SHUTDOWN_TIMEOUT_MS })
        // Prompt 007: close the MongoDB connection here too, before exit.
        server.closeAllConnections?.()
        resolve()
      }, SHUTDOWN_TIMEOUT_MS)

      // Do not let the deadline timer itself keep the event loop alive.
      timer.unref?.()

      server.close(() => {
        clearTimeout(timer)
        resolve()
      })
    })

  return { server, config, close }
}

/** Entry point when run directly (`npm run dev` / `npm start`). */
function main() {
  let config

  try {
    config = loadConfig()
  } catch (error) {
    // Startup misconfiguration is fatal and must be obvious. `ConfigError`
    // messages name variables and rules, never values.
    process.stderr.write(`\n${error.message}\n\n`)
    process.exit(1)
  }

  const { close } = startServer({ config })
  let shuttingDown = false

  const handleSignal = async (signal) => {
    if (shuttingDown) return
    shuttingDown = true

    const logger = createDefaultLogger(config)
    logger.info('received signal, shutting down', { signal })

    await close()
    logger.info('shutdown complete', { signal })
    process.exit(0)
  }

  process.on('SIGINT', () => void handleSignal('SIGINT'))
  process.on('SIGTERM', () => void handleSignal('SIGTERM'))

  // An unhandled rejection is a bug; log it and let the platform decide rather
  // than pretending the process is healthy.
  process.on('unhandledRejection', (reason) => {
    const logger = createDefaultLogger(config)
    logger.error('unhandled promise rejection', {
      reason: reason instanceof Error ? reason.message : String(reason),
    })
  })
}

// Only run when executed directly, never when imported by a test.
// `pathToFileURL` handles Windows drive letters and UNC paths, which a naive
// `file://${process.argv[1]}` comparison does not.
const entryPoint = process.argv[1] ? pathToFileURL(process.argv[1]).href : null

if (entryPoint === import.meta.url) {
  main()
}