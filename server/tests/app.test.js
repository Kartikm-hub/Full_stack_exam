/**
 * HTTP behaviour of the scaffold: health, 404, malformed JSON, and the
 * guarantees around error bodies.
 */

import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { after, before, describe, it } from 'node:test'
import express from 'express'

import { createApp, JSON_BODY_LIMIT } from '../src/app.js'
import { errorHandler } from '../src/middleware/error-handler.js'
import { request, startTestApp, testConfig } from './helpers.js'

describe('app scaffold', () => {
  let app

  before(async () => {
    app = await startTestApp()
  })

  after(async () => {
    await app.close()
  })

  it('creates an app without starting a server or touching the network', async () => {
    // Importing and calling the factory must have no side effects: no port is
    // bound and no connection is opened.
    const created = createApp({ config: testConfig() })

    assert.equal(typeof created, 'function')
    assert.equal(typeof created.listen, 'function')
  })

  it('does not advertise Express in response headers', async () => {
    const response = await request(`${app.url}/health`)

    assert.equal(response.headers['x-powered-by'], undefined)
  })

  it('answers with JSON', async () => {
    const response = await request(`${app.url}/health`)

    assert.match(response.headers['content-type'], /application\/json/)
  })
})

describe('GET /health', () => {
  let app

  before(async () => {
    app = await startTestApp({ config: testConfig({ MONGODB_URI: 'mongodb://localhost/focus' }) })
  })

  after(async () => {
    await app.close()
  })

  it('returns 200', async () => {
    const response = await request(`${app.url}/health`)

    assert.equal(response.status, 200)
  })

  it('returns the required fields with the REAL configured environment', async () => {
    const response = await request(`${app.url}/health`)

    assert.equal(response.status, 200)
    assert.equal(response.body.status, 'ok')
    assert.equal(typeof response.body.service, 'string')
    assert.ok(response.body.service.length > 0)
    assert.equal(response.body.environment, 'test')
    assert.match(response.body.timestamp, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)
    assert.ok(!Number.isNaN(Date.parse(response.body.timestamp)))
  })

  it('never claims the database is connected', async () => {
    // MONGODB_URI IS set for this app instance, and it still must not lie.
    const response = await request(`${app.url}/health`)

    assert.equal(response.body.database, 'not_configured')
    assert.equal(response.text.includes('mongodb://localhost/focus'), false)
  })

  it('reports unimplemented features explicitly', async () => {
    const response = await request(`${app.url}/health`)

    assert.deepEqual(response.body.features, {
      api: 'not_implemented',
      auth: 'not_implemented',
      sessions: 'not_implemented',
      websocket: 'not_implemented',
    })
  })

  it('reflects a production environment when configured as such', async () => {
    const prod = await startTestApp({ config: testConfig({ NODE_ENV: 'production' }) })

    try {
      const response = await request(`${prod.url}/health`)
      assert.equal(response.body.environment, 'production')
    } finally {
      await prod.close()
    }
  })

  })

describe('unknown routes', () => {
  let app

  before(async () => {
    app = await startTestApp()
  })

  after(async () => {
    await app.close()
  })

  it('returns a 404 JSON error for an unknown /api route', async () => {
    const response = await request(`${app.url}/api/not-a-real-route`)

    assert.equal(response.status, 404)
    assert.match(response.headers['content-type'], /application\/json/)
    assert.equal(typeof response.body.error, 'object')
    assert.equal(response.body.error.code, 'ROUTE_NOT_FOUND')
    assert.equal(typeof response.body.error.message, 'string')
  })

  it('returns the same shape for an unknown root path', async () => {
    const response = await request(`${app.url}/definitely-not-here`)

    assert.equal(response.status, 404)
    assert.equal(response.body.error.code, 'ROUTE_NOT_FOUND')
  })

  it('returns 404 for a method the path does not implement', async () => {
    const response = await request(`${app.url}/health`, { method: 'POST' })

    assert.equal(response.status, 404)
    assert.equal(response.body.error.code, 'ROUTE_NOT_FOUND')
  })

  it('exposes no stack trace in the 404 body', async () => {
    const response = await request(`${app.url}/api/nope`)

    assert.equal(response.text.includes('at '), false)
    assert.equal(response.text.includes('.js:'), false)
    assert.equal(response.body.error.stack, undefined)
  })

  it('does not leak the 404 shape for a very long path', async () => {
    const response = await request(`${app.url}/api/${'x'.repeat(4000)}`)

    assert.equal(response.status, 404)
    assert.equal(response.body.error.code, 'ROUTE_NOT_FOUND')
    assert.ok(response.text.length < 1000, 'path echo should be truncated')
  })
})

describe('API namespace', () => {
  let app

  before(async () => {
    app = await startTestApp()
  })

  after(async () => {
    await app.close()
  })

  it('serves a namespace index that admits nothing is built yet', async () => {
    const response = await request(`${app.url}/api`)

    assert.equal(response.status, 200)
    assert.equal(response.body.status, 'scaffold')
    assert.deepEqual(response.body.routes, [])
  })

  it('exposes no fake auth, device or session endpoints', async () => {
    for (const path of [
      '/api/auth/login',
      '/api/devices',
      '/api/sessions',
      '/api/pairing',
      '/api/allowlist',
    ]) {
      const response = await request(`${app.url}${path}`)

      assert.equal(response.status, 404, `${path} must not exist yet`)
      assert.equal(response.body.error.code, 'ROUTE_NOT_FOUND')
    }
  })
})

describe('malformed JSON', () => {
  let app

  before(async () => {
    app = await startTestApp()
  })

  after(async () => {
    await app.close()
  })

  it('returns 400 with a stable code', async () => {
    const response = await request(`${app.url}/api`, {
      method: 'POST',
      rawBody: '{"broken": ',
    })

    assert.equal(response.status, 400)
    assert.match(response.headers['content-type'], /application\/json/)
    assert.equal(response.body.error.code, 'INVALID_JSON')
    assert.equal(typeof response.body.error.message, 'string')
  })

  it('rejects several malformed shapes', async () => {
    for (const body of ['{', '{"a":1,,}', 'not json at all', '[1,2', "{'single':'quotes'}"]) {
      const response = await request(`${app.url}/api`, { method: 'POST', rawBody: body })

      assert.equal(response.status, 400, `body ${JSON.stringify(body)} should be rejected`)
      assert.equal(response.body.error.code, 'INVALID_JSON')
    }
  })

  it('never exposes a stack trace or parser internals', async () => {
    const response = await request(`${app.url}/api`, { method: 'POST', rawBody: '{"x":' })

    assert.equal(response.text.includes('    at '), false)
    assert.equal(response.text.includes('node_modules'), false)
    assert.equal(response.body.error.stack, undefined)
  })

  it('accepts an empty body without treating it as malformed', async () => {
    const response = await request(`${app.url}/api`, { method: 'POST' })

    assert.equal(response.status, 404)
  })

  it('rejects an oversized body with 413', async () => {
    const response = await request(`${app.url}/api`, {
      method: 'POST',
      rawBody: JSON.stringify({ blob: 'x'.repeat(200_000) }),
    })

    assert.equal(response.status, 413)
    assert.equal(response.body.error.code, 'PAYLOAD_TOO_LARGE')
  })

  it('hides parser detail in production', async () => {
    const prod = await startTestApp({ config: testConfig({ NODE_ENV: 'production' }) })

    try {
      const response = await request(`${prod.url}/api`, { method: 'POST', rawBody: '{"x":' })

      assert.equal(response.status, 400)
      assert.equal(response.body.error.code, 'INVALID_JSON')
      // Development exposes `details`; production must not.
      assert.equal(response.body.error.details, undefined)
    } finally {
      await prod.close()
    }
  })
})

describe('unexpected errors', () => {
  it('returns a clean 500 for an unexpected failure and logs the stack', async () => {
    const logs = []
    const logger = {
      debug: (message, fields) => logs.push({ level: 'debug', message, ...fields }),
      info: (message, fields) => logs.push({ level: 'info', message, ...fields }),
      warn: (message, fields) => logs.push({ level: 'warn', message, ...fields }),
      error: (message, fields) => logs.push({ level: 'error', message, ...fields }),
    }

    // `createApp` mounts its terminal middleware, so a throwing route added
    // afterwards would never be reached. Build a minimal app with the same
    // errorHandler to test it directly.
    const broken = express()
    broken.use(express.json({ limit: JSON_BODY_LIMIT }))
    broken.get('/boom', () => {
      throw new Error('database password is hunter2')
    })
    broken.use(errorHandler({ logger, config: testConfig() }))

    const server = createServer(broken)
    await new Promise((done) => server.listen(0, '127.0.0.1', done))

    try {
      const response = await request(`http://127.0.0.1:${server.address().port}/boom`)

      assert.equal(response.status, 500)
      assert.equal(response.body.error.code, 'INTERNAL_ERROR')
      assert.equal(response.body.error.message, 'Internal server error')
      // The internal message must not leak to the client...
      assert.equal(response.text.includes('hunter2'), false)
      assert.equal(response.text.includes('    at '), false)

      // ...but the stack must reach the log so an operator can debug. It is
      // carried in `stack`, never in `message`.
      const logged = logs.find((entry) => entry.level === 'error')
      assert.ok(logged, 'unexpected error should be logged')
      assert.match(logged.stack, /hunter2/)
      assert.equal(logged.status, 500)
      assert.equal(logged.code, 'INTERNAL_ERROR')
    } finally {
      server.closeAllConnections?.()
      await new Promise((done) => server.close(done))
    }
  })
})