import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  ERROR_CODE_LIST,
  ERROR_CODES,
  ProtocolError,
  createErrorPayload,
  isErrorCode,
  isRetryable,
} from '../src/errors.js'
import {
  AGENT_STATE_LIST,
  AGENT_STATES,
  AUTO_EXIT_REASONS,
  ENFORCING_AGENT_STATES,
  EXIT_REASON_LIST,
  EXIT_REASONS,
  FOCUS_SESSION_STATE_LIST,
  FOCUS_SESSION_STATES,
  LINK_STATES,
  isAgentState,
  isAutoExit,
  isEnforcing,
  isExitReason,
  isFocusSessionState,
  isTerminalAgentState,
} from '../src/state.js'

describe('error codes', () => {
  it('defines every code required by Prompt 003', () => {
    const required = [
      'INVALID_MESSAGE',
      'UNSUPPORTED_VERSION',
      'UNSUPPORTED_MESSAGE_TYPE',
      'UNAUTHENTICATED',
      'TOKEN_INVALID',
      'TOKEN_EXPIRED',
      'PAIRING_REQUIRED',
      'PAIRING_REJECTED',
      'SESSION_ALREADY_ACTIVE',
      'SESSION_NOT_FOUND',
      'INVALID_STATE',
      'RATE_LIMITED',
      'INTERNAL_ERROR',
    ]

    for (const code of required) {
      assert.equal(ERROR_CODES[code], code, `missing error code ${code}`)
      assert.ok(ERROR_CODE_LIST.includes(code))
      assert.equal(isErrorCode(code), true)
    }
  })

  it('is frozen and rejects unknown codes', () => {
    assert.equal(Object.isFrozen(ERROR_CODES), true)
    assert.equal(Object.isFrozen(ERROR_CODE_LIST), true)
    assert.equal(isErrorCode('SOMETHING_ELSE'), false)
    assert.equal(isErrorCode(undefined), false)
    assert.throws(() => createErrorPayload('SOMETHING_ELSE', 'x'), TypeError)
  })

  it('exposes one retryable default per code', () => {
    for (const code of ERROR_CODE_LIST) {
      assert.equal(typeof isRetryable(code), 'boolean', `${code} needs a retryable default`)
    }

    // Credential problems are not fixed by trying again with the same input.
    for (const code of ['TOKEN_INVALID', 'TOKEN_EXPIRED', 'PAIRING_REJECTED', 'UNAUTHENTICATED']) {
      assert.equal(isRetryable(code), false, `${code} should not be retryable`)
    }

    assert.equal(isRetryable('RATE_LIMITED'), true)
    assert.equal(isRetryable('INTERNAL_ERROR'), true)
  })

  it('builds the canonical error payload', () => {
    const payload = createErrorPayload('TOKEN_INVALID', 'Token already used')

    assert.deepEqual(payload, {
      code: 'TOKEN_INVALID',
      message: 'Token already used',
      retryable: false,
    })
  })

  it('allows a retryable override and an optional detail', () => {
    const payload = createErrorPayload('RATE_LIMITED', 'Slow down', {
      retryable: false,
      detail: { limitPerMinute: 10 },
    })

    assert.equal(payload.retryable, false)
    assert.deepEqual(payload.detail, { limitPerMinute: 10 })
  })
})

describe('ProtocolError', () => {
  it('carries a valid code so it can become an error envelope directly', () => {
    const error = new ProtocolError(ERROR_CODES.PAIRING_REQUIRED, 'Pair this device first')

    assert.ok(error instanceof Error)
    assert.equal(error.name, 'ProtocolError')
    assert.equal(error.code, 'PAIRING_REQUIRED')
    assert.equal(error.retryable, false)
  })

  it('falls back to INTERNAL_ERROR for an unknown code', () => {
    assert.equal(new ProtocolError('NOPE', 'x').code, 'INTERNAL_ERROR')
  })
})

describe('agent states', () => {
  it('defines the vocabulary from SPEC.md §5.1', () => {
    const required = ['IDLE', 'PAIRING', 'READY', 'ENTERING', 'ACTIVE', 'EXTENDING', 'EXITING', 'FAILED']

    for (const state of required) {
      assert.equal(AGENT_STATES[state], state)
      assert.ok(AGENT_STATE_LIST.includes(state))
      assert.equal(isAgentState(state), true)
    }
  })

  it('rejects unknown states', () => {
    assert.equal(isAgentState('active'), false)
    assert.equal(isAgentState(undefined), false)
    assert.equal(isAgentState('RESTING'), false)
  })

  it('is frozen', () => {
    assert.equal(Object.isFrozen(AGENT_STATES), true)
    assert.equal(Object.isFrozen(AGENT_STATE_LIST), true)
  })
})

describe('focus session states', () => {
  it('defines the server-side vocabulary from SPEC.md §6.4', () => {
    const required = ['requested', 'active', 'exiting', 'exited', 'failed', 'auto_exited']

    for (const state of required) {
      assert.equal(FOCUS_SESSION_STATES[state.toUpperCase()], state)
      assert.ok(FOCUS_SESSION_STATE_LIST.includes(state))
      assert.equal(isFocusSessionState(state), true)
    }
  })

  it('keeps server states distinct from agent states', () => {
    // 'active' (server record) and 'ACTIVE' (agent process) are different things.
    assert.equal(isAgentState('active'), false)
    assert.equal(isFocusSessionState('ACTIVE'), false)
  })
})

describe('exit reasons', () => {
  it('defines the reasons from SPEC.md §6.4', () => {
    const required = ['USER', 'TIMEOUT', 'WATCHDOG', 'CRASH_RECOVERY', 'AGENT_QUIT', 'ERROR']

    for (const reason of required) {
      assert.equal(EXIT_REASONS[reason], reason)
      assert.ok(EXIT_REASON_LIST.includes(reason))
      assert.equal(isExitReason(reason), true)
    }
  })

  it('classifies fail-safe reasons as automatic exits', () => {
    for (const reason of AUTO_EXIT_REASONS) {
      assert.equal(isAutoExit(reason), true, `${reason} should be automatic`)
    }

    assert.equal(isAutoExit(EXIT_REASONS.USER), false)
    assert.equal(isAutoExit(undefined), false)
  })
})

describe('state predicates', () => {
  it('treats enforcing states as open sessions so End stays reachable', () => {
    for (const state of ENFORCING_AGENT_STATES) {
      assert.equal(isEnforcing(state), true, `${state} is enforcing`)
    }

    for (const state of ['IDLE', 'PAIRING', 'READY', 'FAILED']) {
      assert.equal(isEnforcing(state), false, `${state} is not enforcing`)
    }
  })

  it('marks FAILED as the only terminal agent state', () => {
    assert.equal(isTerminalAgentState('FAILED'), true)
    assert.equal(isTerminalAgentState('IDLE'), false)
  })

  it('keeps the client-only link state separate from agent states', () => {
    assert.equal(LINK_STATES.UNAVAILABLE, 'UNAVAILABLE')
    assert.equal(isAgentState(LINK_STATES.UNAVAILABLE), false)
    assert.equal(isEnforcing(LINK_STATES.UNAVAILABLE), false)
  })
})