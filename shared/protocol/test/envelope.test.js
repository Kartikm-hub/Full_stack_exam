import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  PROTOCOL_VERSION,
  SUPPORTED_PROTOCOL_VERSIONS,
  createEnvelope,
  createMessageId,
  createReply,
  createTimestamp,
  isKnownType,
  isSupportedVersion,
  isValidTimestamp,
  validateEnvelope,
  validateMessage,
} from '../src/envelope.js'
import { ERROR_CODES } from '../src/errors.js'
import { MESSAGE_TYPES } from '../src/messages.js'

/** A structurally valid envelope with all fields present. */
function validEnvelope(overrides = {}) {
  return {
    version: PROTOCOL_VERSION,
    type: MESSAGE_TYPES.PING,
    id: 'msg_test_0001',
    replyTo: null,
    timestamp: '2026-01-01T10:00:00.000Z',
    payload: { sentAt: '2026-01-01T10:00:00.000Z' },
    ...overrides,
  }
}

describe('createEnvelope', () => {
  it('builds the canonical shape from SPEC.md §5', () => {
    const envelope = createEnvelope({ type: MESSAGE_TYPES.GET_STATE })

    assert.equal(envelope.version, PROTOCOL_VERSION)
    assert.equal(envelope.type, 'getState')
    assert.equal(envelope.replyTo, null)
    assert.deepEqual(envelope.payload, {})
    assert.match(envelope.id, /^msg_/)
    assert.ok(isValidTimestamp(envelope.timestamp))
  })

  it('defaults payload to an empty object and allows an explicit one', () => {
    assert.deepEqual(createEnvelope({ type: MESSAGE_TYPES.GET_STATE }).payload, {})
    assert.deepEqual(
      createEnvelope({ type: MESSAGE_TYPES.FOCUS_EXIT, payload: { sessionId: 's-1' } }).payload,
      { sessionId: 's-1' },
    )
  })

  it('rejects an unknown message type', () => {
    assert.throws(
      () => createEnvelope({ type: 'focus.teleport' }),
      (error) => error.code === ERROR_CODES.UNSUPPORTED_MESSAGE_TYPE,
    )
  })

  it('rejects a malformed id or replyTo instead of repairing it', () => {
    assert.throws(
      () => createEnvelope({ type: MESSAGE_TYPES.PING, id: '   ' }),
      (error) => error.code === ERROR_CODES.INVALID_MESSAGE,
    )
    assert.throws(
      () => createEnvelope({ type: MESSAGE_TYPES.PING, replyTo: 42 }),
      (error) => error.code === ERROR_CODES.INVALID_MESSAGE,
    )
  })
})

describe('createReply', () => {
  it('links the response to the request id', () => {
    const request = createEnvelope({ type: MESSAGE_TYPES.GET_STATE })
    const reply = createReply(request, MESSAGE_TYPES.STATE_RESULT, { agentHealthy: true })

    assert.equal(reply.replyTo, request.id)
    assert.equal(reply.type, 'state.result')
  })

  it('refuses to answer a request with no id', () => {
    assert.throws(
      () => createReply({}, MESSAGE_TYPES.PONG, { sentAt: createTimestamp() }),
      (error) => error.code === ERROR_CODES.INVALID_MESSAGE,
    )
  })
})

describe('createMessageId', () => {
  it('is prefixed and unique across calls', () => {
    const ids = new Set(Array.from({ length: 500 }, () => createMessageId()))

    assert.equal(ids.size, 500)
    for (const id of ids) assert.match(id, /^msg_/)
  })
})

describe('version checks', () => {
  it('accepts the supported version and rejects others', () => {
    assert.equal(isSupportedVersion(1), true)
    assert.equal(isSupportedVersion(2), false)
    assert.equal(isSupportedVersion(0), false)
    assert.equal(isSupportedVersion('1'), false)
    assert.deepEqual([...SUPPORTED_PROTOCOL_VERSIONS], [1])
  })

  it('reports UNSUPPORTED_VERSION before anything else is inspected', () => {
    const result = validateEnvelope({ ...validEnvelope(), version: 99, type: 'nope' })

    assert.equal(result.ok, false)
    assert.equal(result.code, ERROR_CODES.UNSUPPORTED_VERSION)
  })
})

describe('timestamp validation', () => {
  it('accepts the millisecond form the protocol emits', () => {
    assert.equal(isValidTimestamp('2026-01-01T10:00:00.000Z'), true)
    assert.equal(isValidTimestamp('2026-01-01T10:00:00Z'), true)
    assert.equal(isValidTimestamp('2026-01-01T10:00:00.000+02:00'), true)
  })

  it('rejects loose or rollover values Date.parse would tolerate', () => {
    for (const bad of [
      '2026-01-01',
      'not-a-date',
      '2026-13-01T00:00:00.000Z',
      '2026-02-30T00:00:00.000Z',
      '2026-01-01T10:00:00',
      '',
      1735730400000,
      null,
      undefined,
    ]) {
      assert.equal(isValidTimestamp(bad), false, `expected ${String(bad)} to be invalid`)
    }
  })
})

describe('validateEnvelope — valid input', () => {
  it('accepts a complete envelope', () => {
    const result = validateEnvelope(validEnvelope())

    assert.equal(result.ok, true)
    assert.equal(result.envelope.type, 'ping')
  })

  it('normalises a missing payload and replyTo rather than failing', () => {
    const { payload, replyTo, ...rest } = validEnvelope()
    void payload
    void replyTo

    const result = validateEnvelope(rest)

    assert.equal(result.ok, true)
    assert.deepEqual(result.envelope.payload, {})
    assert.equal(result.envelope.replyTo, null)
  })

  it('accepts every defined message type with an empty payload', () => {
    for (const type of Object.values(MESSAGE_TYPES)) {
      assert.equal(isKnownType(type), true, `${type} should be known`)
      assert.equal(validateEnvelope(validEnvelope({ type, payload: {} })).ok, true, type)
    }
  })
})

describe('validateEnvelope — rejection cases', () => {
  it('rejects a missing version', () => {
    const { version, ...rest } = validEnvelope()
    void version
    const result = validateEnvelope(rest)

    assert.equal(result.ok, false)
    assert.equal(result.code, ERROR_CODES.INVALID_MESSAGE)
    assert.match(result.message, /version/)
  })

  it('rejects a non-integer version', () => {
    assert.equal(validateEnvelope(validEnvelope({ version: '1' })).code, ERROR_CODES.INVALID_MESSAGE)
    assert.equal(validateEnvelope(validEnvelope({ version: 1.5 })).code, ERROR_CODES.INVALID_MESSAGE)
  })

  it('rejects a missing or non-string type', () => {
    assert.equal(validateEnvelope(validEnvelope({ type: undefined })).code, ERROR_CODES.INVALID_MESSAGE)
    assert.equal(validateEnvelope(validEnvelope({ type: 42 })).code, ERROR_CODES.INVALID_MESSAGE)
  })

  it('rejects an unknown type with UNSUPPORTED_MESSAGE_TYPE', () => {
    const result = validateEnvelope(validEnvelope({ type: 'focus.explode' }))

    assert.equal(result.ok, false)
    assert.equal(result.code, ERROR_CODES.UNSUPPORTED_MESSAGE_TYPE)
  })

  it('rejects a missing, empty or oversized id', () => {
    assert.equal(validateEnvelope(validEnvelope({ id: undefined })).code, ERROR_CODES.INVALID_MESSAGE)
    assert.equal(validateEnvelope(validEnvelope({ id: '' })).code, ERROR_CODES.INVALID_MESSAGE)
    assert.equal(validateEnvelope(validEnvelope({ id: 7 })).code, ERROR_CODES.INVALID_MESSAGE)
    assert.equal(
      validateEnvelope(validEnvelope({ id: 'x'.repeat(200) })).code,
      ERROR_CODES.INVALID_MESSAGE,
    )
  })

  it('rejects an invalid timestamp', () => {
    assert.equal(
      validateEnvelope(validEnvelope({ timestamp: 'yesterday' })).code,
      ERROR_CODES.INVALID_MESSAGE,
    )
    assert.equal(
      validateEnvelope(validEnvelope({ timestamp: undefined })).code,
      ERROR_CODES.INVALID_MESSAGE,
    )
  })

  it('rejects a malformed payload rather than coercing it', () => {
    for (const payload of ['string', 42, null, [1, 2], true]) {
      const result = validateEnvelope(validEnvelope({ payload }))
      assert.equal(result.ok, false, `payload ${JSON.stringify(payload)} should be rejected`)
      assert.equal(result.code, ERROR_CODES.INVALID_MESSAGE)
    }
  })

  it('rejects a payload that exceeds the frame limit', () => {
    const result = validateEnvelope(validEnvelope({ payload: { blob: 'x'.repeat(70_000) } }))

    assert.equal(result.ok, false)
    assert.equal(result.code, ERROR_CODES.INVALID_MESSAGE)
    assert.equal(result.detail.maxBytes, 65_536)
  })

  it('rejects non-object input', () => {
    for (const bad of [null, undefined, 'msg', 42, []]) {
      assert.equal(validateEnvelope(bad).ok, false)
    }
  })

  it('rejects a non-null non-string replyTo', () => {
    assert.equal(validateEnvelope(validEnvelope({ replyTo: 123 })).code, ERROR_CODES.INVALID_MESSAGE)
  })

  it('never mutates the candidate envelope', () => {
    const candidate = validEnvelope()
    const snapshot = structuredClone(candidate)

    validateMessage(candidate)

    assert.deepEqual(candidate, snapshot)
  })
})

describe('validateMessage — envelope plus payload', () => {
  it('accepts a correct focus.enter', () => {
    const envelope = createEnvelope({
      type: MESSAGE_TYPES.FOCUS_ENTER,
      payload: { sessionId: 'ses_123', commandToken: 'tok_abc' },
    })

    const result = validateMessage(envelope)

    assert.equal(result.ok, true)
  })

  it('rejects focus.enter with a missing commandToken', () => {
    const envelope = createEnvelope({
      type: MESSAGE_TYPES.FOCUS_ENTER,
      payload: { sessionId: 'ses_123' },
    })

    const result = validateMessage(envelope)

    assert.equal(result.ok, false)
    assert.equal(result.code, ERROR_CODES.INVALID_MESSAGE)
    assert.match(result.message, /commandToken/)
  })
})