import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { createEnvelope, validateMessage } from '../src/envelope.js'
import { ERROR_CODES } from '../src/errors.js'
import {
  ACKNOWLEDGED_COMMAND_TYPES,
  MESSAGE_DIRECTIONS,
  MESSAGE_TYPE_LIST,
  MESSAGE_TYPES,
  PAYLOAD_CONTRACTS,
  createStateResultPayload,
  getMessageContract,
  getMessageDirection,
  isKnownMessageType,
  normaliseErrorPayload,
  validatePayload,
} from '../src/messages.js'

const valid = (type, payload = {}) => createEnvelope({ type, payload })

describe('message registry', () => {
  it('defines every type required by SPEC.md §5.1', () => {
    const required = [
      'pair.request',
      'pair.result',
      'unpair.request',
      'getState',
      'state.result',
      'state.push',
      'focus.enter',
      'focus.enter.accepted',
      'focus.entered',
      'focus.exit',
      'focus.exit.accepted',
      'focus.exited',
      'focus.extend',
      'session.state',
      'ping',
      'pong',
      'error',
    ]

    for (const type of required) {
      assert.ok(MESSAGE_TYPE_LIST.includes(type), `missing message type ${type}`)
      assert.ok(Object.hasOwn(PAYLOAD_CONTRACTS, type), `missing contract for ${type}`)
    }
  })

  it('exposes no duplicate types', () => {
    assert.equal(new Set(MESSAGE_TYPE_LIST).size, MESSAGE_TYPE_LIST.length)
  })

  it('records a direction and contract for every type', () => {
    for (const type of MESSAGE_TYPE_LIST) {
      assert.notEqual(getMessageDirection(type), 'unknown', `${type} needs a direction`)
      assert.ok(getMessageContract(type), `${type} needs a contract`)
    }
  })

  it('marks state-changing commands as acknowledged', () => {
    for (const type of ACKNOWLEDGED_COMMAND_TYPES) {
      assert.ok(MESSAGE_TYPE_LIST.includes(type))
    }

    // Read-only and liveness traffic must not require an acknowledgement.
    for (const type of [MESSAGE_TYPES.GET_STATE, MESSAGE_TYPES.PING, MESSAGE_TYPES.PONG]) {
      assert.ok(!ACKNOWLEDGED_COMMAND_TYPES.includes(type), `${type} is not a command`)
    }
  })

  it('is frozen so nothing can extend the registry at runtime', () => {
    assert.equal(Object.isFrozen(MESSAGE_TYPES), true)
    assert.equal(Object.isFrozen(PAYLOAD_CONTRACTS), true)
    assert.equal(isKnownMessageType('focus.entered'), true)
    assert.equal(isKnownMessageType('focus.invented'), false)
    assert.equal(isKnownMessageType(undefined), false)
  })
})

describe('payload contracts', () => {
  it('focus.enter carries only sessionId and commandToken', () => {
    const fields = Object.keys(getMessageContract(MESSAGE_TYPES.FOCUS_ENTER).fields)

    assert.deepEqual(fields.sort(), ['commandToken', 'sessionId'])
    assert.equal(validatePayload(MESSAGE_TYPES.FOCUS_ENTER, { sessionId: 's', commandToken: 't' }).ok, true)
    assert.equal(validatePayload(MESSAGE_TYPES.FOCUS_ENTER, { sessionId: 's' }).ok, false)
    assert.equal(validatePayload(MESSAGE_TYPES.FOCUS_ENTER, { commandToken: 't' }).ok, false)
    assert.equal(validatePayload(MESSAGE_TYPES.FOCUS_ENTER, {}).ok, false)
  })

  it('focus.enter rejects an allow-list so policy never travels from the browser', () => {
    const result = validatePayload(MESSAGE_TYPES.FOCUS_ENTER, {
      sessionId: 's',
      commandToken: 't',
      allowList: ['discord'],
    })

    assert.equal(result.ok, false)
    assert.match(result.message, /unknown field "allowList"/)
  })

  it('focus.exit requires a sessionId', () => {
    assert.equal(validatePayload(MESSAGE_TYPES.FOCUS_EXIT, { sessionId: 's' }).ok, true)
    assert.equal(validatePayload(MESSAGE_TYPES.FOCUS_EXIT, {}).ok, false)
  })

  it('getState accepts an empty payload and rejects fields', () => {
    assert.equal(validatePayload(MESSAGE_TYPES.GET_STATE, {}).ok, true)
    assert.equal(validatePayload(MESSAGE_TYPES.GET_STATE, undefined).ok, true)
    assert.equal(validatePayload(MESSAGE_TYPES.GET_STATE, { force: true }).ok, false)
  })

  it('unpair.request takes no fields', () => {
    assert.equal(validatePayload(MESSAGE_TYPES.UNPAIR_REQUEST, {}).ok, true)
    assert.equal(validatePayload(MESSAGE_TYPES.UNPAIR_REQUEST, { confirm: true }).ok, false)
  })

  it('ping requires an ISO sentAt', () => {
    const now = '2026-01-01T10:00:00.000Z'

    assert.equal(validatePayload(MESSAGE_TYPES.PING, { sentAt: now }).ok, true)
    assert.equal(validatePayload(MESSAGE_TYPES.PING, { sentAt: '10:00' }).ok, false)
    assert.equal(validatePayload(MESSAGE_TYPES.PING, { sentAt: 1735730400000 }).ok, false)
    assert.equal(validatePayload(MESSAGE_TYPES.PING, {}).ok, false)
  })

  it('pong requires the echoed sentAt', () => {
    const sentAt = '2026-01-01T10:00:00.000Z'

    assert.equal(validatePayload(MESSAGE_TYPES.PONG, { sentAt }).ok, true)
    assert.equal(validatePayload(MESSAGE_TYPES.PONG, {}).ok, false)
  })

  it('pair.request requires exactly six digits', () => {
    const base = { code: '123456' }

    assert.equal(validatePayload(MESSAGE_TYPES.PAIR_REQUEST, base).ok, true)

    for (const code of ['12345', '1234567', 'abcdef', '12345a', '']) {
      assert.equal(
        validatePayload(MESSAGE_TYPES.PAIR_REQUEST, { ...base, code }).ok,
        false,
        `code ${code} should be rejected`,
      )
    }
  })

  it('error requires code, message and retryable', () => {
    const good = { code: 'TOKEN_INVALID', message: 'Token already used', retryable: false }

    assert.equal(validatePayload(MESSAGE_TYPES.ERROR, good).ok, true)
    assert.equal(validatePayload(MESSAGE_TYPES.ERROR, { ...good, code: 'NOPE' }).ok, false)
    assert.equal(validatePayload(MESSAGE_TYPES.ERROR, { ...good, code: undefined }).ok, false)
    assert.equal(validatePayload(MESSAGE_TYPES.ERROR, { ...good, retryable: 'yes' }).ok, false)
    assert.equal(validatePayload(MESSAGE_TYPES.ERROR, { code: 'TOKEN_INVALID', message: 'x' }).ok, false)
  })

  it('session.state restricts state to the agent vocabulary', () => {
    assert.equal(validatePayload(MESSAGE_TYPES.SESSION_STATE, { state: 'ACTIVE' }).ok, true)
    assert.equal(validatePayload(MESSAGE_TYPES.SESSION_STATE, { state: 'active' }).ok, false)
    assert.equal(validatePayload(MESSAGE_TYPES.SESSION_STATE, { state: 'BLOOMING' }).ok, false)
    assert.equal(validatePayload(MESSAGE_TYPES.SESSION_STATE, {}).ok, false)
  })

  it('focus.extend requires a positive integer number of minutes', () => {
    const base = { sessionId: 's', additionalMinutes: 25, commandToken: 't' }

    assert.equal(validatePayload(MESSAGE_TYPES.FOCUS_EXTEND, base).ok, true)
    assert.equal(validatePayload(MESSAGE_TYPES.FOCUS_EXTEND, { ...base, additionalMinutes: 0 }).ok, false)
    assert.equal(validatePayload(MESSAGE_TYPES.FOCUS_EXTEND, { ...base, additionalMinutes: -5 }).ok, false)
    assert.equal(validatePayload(MESSAGE_TYPES.FOCUS_EXTEND, { ...base, additionalMinutes: 1.5 }).ok, false)
  })

  it('rejects a non-object payload', () => {
    for (const payload of ['x', 42, null, []]) {
      assert.equal(validatePayload(MESSAGE_TYPES.GET_STATE, payload).ok, false)
    }
  })

  it('reports no contract for an unknown type', () => {
    const result = validatePayload('focus.invented', {})

    assert.equal(result.ok, false)
    assert.match(result.message, /No payload contract/)
  })
})

describe('validateMessage integration', () => {
  it('accepts a well-formed command envelope', () => {
    const result = validateMessage(
      createEnvelope({
        type: MESSAGE_TYPES.FOCUS_ENTER,
        payload: { sessionId: 'ses_1', commandToken: 'tok_1' },
      }),
    )

    assert.equal(result.ok, true)
  })

  it('surfaces a payload failure as INVALID_MESSAGE', () => {
    const result = validateMessage(
      createEnvelope({ type: MESSAGE_TYPES.FOCUS_EXIT, payload: { sessionId: '' } }),
    )

    assert.equal(result.ok, false)
    assert.equal(result.code, ERROR_CODES.INVALID_MESSAGE)
    assert.equal(result.detail.type, 'focus.exit')
  })

  it('every message type can be built and round-tripped with a valid payload', () => {
    const samples = {
      [MESSAGE_TYPES.PAIR_REQUEST]: { code: '123456', platform: 'win32' },
      [MESSAGE_TYPES.PAIR_RESULT]: { paired: true, reason: undefined },
      [MESSAGE_TYPES.UNPAIR_REQUEST]: {},
      [MESSAGE_TYPES.GET_STATE]: {},
      [MESSAGE_TYPES.STATE_RESULT]: createStateResultPayload({}),
      [MESSAGE_TYPES.STATE_PUSH]: {
        reason: 'WATCHDOG',
        ...createStateResultPayload({}),
      },
      [MESSAGE_TYPES.SESSION_STATE]: { state: 'IDLE' },
      [MESSAGE_TYPES.FOCUS_ENTER]: { sessionId: 's', commandToken: 't' },
      [MESSAGE_TYPES.FOCUS_ENTER_ACCEPTED]: { sessionId: 's', state: 'ENTERING' },
      [MESSAGE_TYPES.FOCUS_ENTERED]: {
        sessionId: 's',
        state: 'ACTIVE',
        effectiveAllowList: ['browser.exe'],
        protectedCount: 3,
        startedAt: '2026-01-01T10:00:00.000Z',
        plannedEndAt: '2026-01-01T10:25:00.000Z',
      },
      [MESSAGE_TYPES.FOCUS_EXIT]: { sessionId: 's' },
      [MESSAGE_TYPES.FOCUS_EXIT_ACCEPTED]: { sessionId: 's', state: 'EXITING' },
      [MESSAGE_TYPES.FOCUS_EXITED]: {
        sessionId: 's',
        state: 'IDLE',
        exitReason: 'USER',
        actualDurationSeconds: 1500,
      },
      [MESSAGE_TYPES.FOCUS_EXTEND]: { sessionId: 's', additionalMinutes: 10, commandToken: 't' },
      [MESSAGE_TYPES.PING]: { sentAt: '2026-01-01T10:00:00.000Z' },
      [MESSAGE_TYPES.PONG]: { sentAt: '2026-01-01T10:00:00.000Z' },
      [MESSAGE_TYPES.ERROR]: { code: 'INVALID_STATE', message: 'No session to exit', retryable: false },
    }

    for (const type of MESSAGE_TYPE_LIST) {
      const payload = samples[type]
      assert.ok(payload !== undefined, `no sample payload defined for ${type}`)

      const result = validateMessage(createEnvelope({ type, payload }))
      assert.equal(result.ok, true, `${type} should validate: ${JSON.stringify(result)}`)
    }
  })
})

describe('state snapshot helper', () => {
  it('fills safe defaults so consumers never branch on undefined', () => {
    const payload = createStateResultPayload({})

    assert.deepEqual(payload.agent, { version: null, platform: null })
    assert.equal(payload.pairing.paired, false)
    assert.equal(payload.allowList.protectedCount, 0)
    assert.equal(payload.safety.autoExitOnDisconnect, true)
    assert.equal(payload.agentHealthy, true)
  })

  it('refuses an unknown agent state', () => {
    assert.throws(() => createStateResultPayload({ session: { state: 'MEDITATING' } }), TypeError)
  })
})

describe('normaliseErrorPayload', () => {
  it('defaults retryable from the code table', () => {
    assert.equal(normaliseErrorPayload({ code: 'TOKEN_INVALID', message: 'x' }).retryable, false)
    assert.equal(normaliseErrorPayload({ code: 'RATE_LIMITED', message: 'x' }).retryable, true)
  })

  it('keeps an explicit retryable and preserves detail', () => {
    const result = normaliseErrorPayload({
      code: 'RATE_LIMITED',
      message: 'Slow down',
      retryable: false,
      detail: { limit: 10 },
    })

    assert.equal(result.retryable, false)
    assert.deepEqual(result.detail, { limit: 10 })
  })
})