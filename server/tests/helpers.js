/**
 * Tiny HTTP test helper.
 *
 * The project uses `node:test` (no test framework dependency, matching
 * `shared/protocol`). This helper binds the Express app to an ephemeral port
 * on `127.0.0.1`, sends real HTTP requests, and tears the server down
 * afterwards — so the tests exercise the full middleware stack, including the
 * JSON body parser, rather than calling middleware functions directly.
 */

import { createServer } from 'node:http'

import { createApp } from '../src/app.js'
import { loadConfig } from '../src/config/index.js'
import { silentLogger } from '../src/lib/logger.js'

/** Config for tests: `NODE_ENV=test` regardless of the caller's shell. */
export function testConfig(overrides = {}) {
  return loadConfig({ NODE_ENV: 'test', ...overrides })
}

/**
 * Start an app instance on an ephemeral loopback port.
 *
 * @param {object} [options]
 * @param {import('../src/config/index.js').ServerConfig} [options.config]
 * @returns {Promise<{ url: string, close: () => Promise<void>, logs: object[] }>}
 */
export async function startTestApp({ config = testConfig() } = {}) {
  const logs = []
  const logger = {
    debug: (message, fields) => logs.push({ level: 'debug', message, ...fields }),
    info: (message, fields) => logs.push({ level: 'info', message, ...fields }),
    warn: (message, fields) => logs.push({ level: 'warn', message, ...fields }),
    error: (message, fields) => logs.push({ level: 'error', message, ...fields }),
  }

  const app = createApp({ config, logger })
  const httpServer = createServer(app)

  await new Promise((resolve) => httpServer.listen(0, '127.0.0.1', resolve))
  const { port } = httpServer.address()

  return {
    url: `http://127.0.0.1:${port}`,
    logs,
    close: () =>
      new Promise((resolve) => {
        httpServer.closeAllConnections?.()
        httpServer.close(() => resolve())
      }),
  }
}

/**
 * Send a request and return `{ status, body, headers, text }`.
 * Never throws on a non-2xx status; asserts on the response instead.
 *
 * @param {string} url
 * @param {RequestInit & { rawBody?: string }} [options]
 */
export async function request(url, options = {}) {
  const { rawBody, headers, ...init } = options

  const response = await fetch(url, {
    ...init,
    headers: {
      ...(rawBody !== undefined ? { 'content-type': 'application/json' } : {}),
      ...headers,
    },
    body: rawBody,
  })

  const text = await response.text()
  let body = null

  try {
    body = text ? JSON.parse(text) : null
  } catch {
    body = null
  }

  return {
    status: response.status,
    headers: Object.fromEntries(response.headers.entries()),
    body,
    text,
  }
}

/** Start an app, run a callback, always close afterwards. */
export async function withTestApp(run, options) {
  const app = await startTestApp(options)

  try {
    return await run(app)
  } finally {
    await app.close()
  }
}

export { silentLogger }