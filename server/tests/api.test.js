import assert from 'node:assert/strict'
import { after, test } from 'node:test'
import { createServer } from 'node:http'

import { createApp } from '../src/app.js'

const config = {
  CLIENT_URL: 'http://localhost:5173',
  JWT_SECRET: 'test-secret-at-least-32-characters-long',
  JWT_EXPIRES_IN: '1h',
  AUTH_RATE_LIMIT_MAX: 100,
}

let server
let baseUrl

const users = new Map()
let nextUserId = 1

class FakeUser {
  constructor(values) {
    Object.assign(this, values)
    this.id ||= String(nextUserId++)
    this.isActive ??= true
    this.role ||= 'USER'
    this.defaultDurationMin ||= 25
    this.userApps ||= []
    this.createdAt ||= new Date()
  }

  async save() {
    users.set(this.id, this)
    return this
  }

  static async exists({ email }) {
    return [...users.values()].some((user) => user.email === email)
  }

  static async create(values) {
    const user = new FakeUser(values)
    await user.save()
    return user
  }

  static findOne({ email }) {
    return { select: async () => [...users.values()].find((user) => user.email === email) || null }
  }

  static findById(id) {
    const value = users.get(String(id)) || null
    return {
      select: async () => value,
      then: (resolve, reject) => Promise.resolve(value).then(resolve, reject),
    }
  }
}

server = createServer(createApp(config, { UserModel: FakeUser }))
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
baseUrl = `http://127.0.0.1:${server.address().port}/api/v1`

after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve))
})

async function request(path, { token, ...options } = {}) {
  const headers = new Headers(options.headers)
  if (options.body) headers.set('Content-Type', 'application/json')
  if (token) headers.set('Authorization', `Bearer ${token}`)
  const response = await fetch(`${baseUrl}${path}`, { ...options, headers })
  return { response, body: await response.json() }
}

test('health responds without connecting to a configured database', async () => {
  const { response, body } = await request('/health')
  assert.equal(response.status, 200)
  assert.equal(body.data.status, 'ok')
})

test('registration, login, profile, allow-list, and password change persist safely', async () => {
  const created = await request('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ name: 'Test User', email: 'TEST@example.com', password: 'SecurePass123' }),
  })
  assert.equal(created.response.status, 201)
  assert.equal(created.body.data.user.email, 'test@example.com')
  assert.equal(created.body.data.user.role, 'USER')
  assert.equal(Object.hasOwn(created.body.data.user, 'passwordHash'), false)

  const token = created.body.data.accessToken
  const profile = await request('/auth/me', { token })
  assert.equal(profile.response.status, 200)
  assert.equal(profile.body.data.user.name, 'Test User')

  const updated = await request('/auth/me', {
    method: 'PATCH',
    token,
    body: JSON.stringify({ name: 'Updated User', defaultDurationMin: 50 }),
  })
  assert.equal(updated.body.data.user.defaultDurationMin, 50)

  const allowlist = await request('/allowlist', {
    method: 'PUT',
    token,
    body: JSON.stringify({ userApps: ['Code.exe', 'browser', 'Code.exe'] }),
  })
  assert.deepEqual(allowlist.body.data.userApps, ['Code.exe'])
  assert.ok(allowlist.body.data.effectiveApps.includes('browser'))

  const changed = await request('/auth/change-password', {
    method: 'POST',
    token,
    body: JSON.stringify({ currentPassword: 'SecurePass123', newPassword: 'NewSecurePass123' }),
  })
  assert.equal(changed.response.status, 200)

  const oldLogin = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'test@example.com', password: 'SecurePass123' }),
  })
  const newLogin = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'test@example.com', password: 'NewSecurePass123' }),
  })
  assert.equal(oldLogin.response.status, 401)
  assert.equal(newLogin.response.status, 200)

  const stored = [...users.values()].find((user) => user.email === 'test@example.com')
  assert.notEqual(stored.passwordHash, 'NewSecurePass123')
})

test('rejects invalid credentials and protected routes without a token', async () => {
  const invalidLogin = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'test@example.com', password: 'wrong-password' }),
  })
  assert.equal(invalidLogin.response.status, 401)
  const privateRoute = await request('/auth/me')
  assert.equal(privateRoute.response.status, 401)
})

test('development CORS accepts both loopback frontend hostnames', async () => {
  for (const origin of ['http://localhost:5173', 'http://127.0.0.1:5173']) {
    const response = await fetch(`${baseUrl}/auth/register`, {
      method: 'OPTIONS',
      headers: {
        Origin: origin,
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'content-type',
      },
    })
    assert.equal(response.headers.get('access-control-allow-origin'), origin)
  }
})