/**
 * Configuration loading and validation.
 *
 * The important cases are the ones that must FAIL loudly at startup rather
 * than produce a half-configured server.
 */

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { ConfigError, ENVIRONMENTS, loadConfig, redactSecrets } from '../src/config/index.js'

describe('loadConfig — environments', () => {
  it('recognises every supported environment', () => {
    assert.deepEqual([...ENVIRONMENTS], ['development', 'test', 'production'])

    for (const nodeEnv of ENVIRONMENTS) {
      const config = loadConfig({ NODE_ENV: nodeEnv })

      assert.equal(config.nodeEnv, nodeEnv)
      assert.equal(config.isProduction, nodeEnv === 'production')
      assert.equal(config.isDevelopment, nodeEnv === 'development')
      assert.equal(config.isTest, nodeEnv === 'test')
    }
  })

  it('defaults to development when NODE_ENV is absent', () => {
    assert.equal(loadConfig({}).nodeEnv, 'development')
    assert.equal(loadConfig({ NODE_ENV: '' }).nodeEnv, 'development')
  })

  it('rejects an unknown environment and names the allowed values', () => {
    assert.throws(
      () => loadConfig({ NODE_ENV: 'staging' }),
      (error) => {
        assert.ok(error instanceof ConfigError)
        assert.match(error.message, /NODE_ENV must be one of/)
        return true
      },
    )
  })
})

describe('loadConfig — port', () => {
  it('accepts a valid port', () => {
    assert.equal(loadConfig({ PORT: '8080' }).port, 8080)
    assert.equal(loadConfig({ PORT: '1' }).port, 1)
    assert.equal(loadConfig({ PORT: '65535' }).port, 65535)
  })

  it('defaults when unset', () => {
    assert.equal(loadConfig({}).port, 4000)
  })

  it('rejects a non-integer, out-of-range or padded port', () => {
    for (const port of ['0', '65536', '99999', 'abc', '4000abc', '40.00', '-1']) {
      assert.throws(() => loadConfig({ PORT: port }), ConfigError, `PORT ${port} should fail`)
    }
  })

  it('never echoes the port value into a message with a secret nearby', () => {
    try {
      loadConfig({ PORT: 'nope', MONGODB_URI: 'mongodb+srv://user:hunter2@host/db' })
      assert.fail('should have thrown')
    } catch (error) {
      // The URI contains a password; it must not appear in the error.
      assert.equal(error.message.includes('hunter2'), false)
    }
  })
})

describe('loadConfig — MONGODB_URI is configuration only', () => {
  it('is optional while the database is unimplemented', () => {
    const config = loadConfig({})

    assert.equal(config.mongodbUri, '')
    assert.equal(config.hasMongodbUri, false)
  })

  it('accepts a well-formed connection string without connecting to it', () => {
    const config = loadConfig({ MONGODB_URI: 'mongodb+srv://user:pass@cluster.example/db' })

    assert.equal(config.hasMongodbUri, true)
    assert.match(config.mongodbUri, /^mongodb\+srv:\/\//)
  })

  it('rejects a malformed URI without revealing the value', () => {
    assert.throws(
      () => loadConfig({ MONGODB_URI: 'postgres://user:hunter2@host/db' }),
      (error) => {
        assert.ok(error instanceof ConfigError)
        assert.match(error.message, /MONGODB_URI must start with/)
        assert.equal(error.message.includes('hunter2'), false)
        return true
      },
    )
  })

  it('returns a frozen config so a route cannot mutate it', () => {
    const config = loadConfig({ PORT: '4000' })

    assert.equal(Object.isFrozen(config), true)
  })
})

describe('redactSecrets', () => {
  it('masks secret-looking keys regardless of case', () => {
    const redacted = redactSecrets({
      PORT: 4000,
      MONGODB_URI: 'mongodb://u:p@h/db',
      password: 'hunter2',
      Code: '123456',
      commandToken: 'tok_1',
    })

    assert.equal(redacted.PORT, 4000)
    assert.equal(redacted.MONGODB_URI, '[redacted]')
    assert.equal(redacted.password, '[redacted]')
    assert.equal(redacted.Code, '[redacted]')
    assert.equal(redacted.commandToken, '[redacted]')
  })
})