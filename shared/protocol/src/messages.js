/**
 * Protocol message types and payload contracts.
 *
 * This file is the registry that stops the client, the server and the agent
 * from inventing three different message formats. It contains NO transport
 * code: no WebSocket, no pairing, no session logic, no OS access.
 *
 * Naming convention (SPEC.md §5.1): `pair.*`, `focus.*`, `state.*`, plus the
 * protocol-level `getState` / `ping` / `pong` / `error` / `session.state`.
 *
 * `direction` documents who is expected to send what. The agent is
 * defensive in either direction, so this is documentation, not enforcement.
 */

import { ERROR_CODE_LIST, isErrorCode, isRetryable } from './errors.js'
import { AGENT_STATE_LIST, EXIT_REASON_LIST, isAgentState } from './state.js'

/** Roles a component can play on the loopback link. */
export const ROLES = Object.freeze({
  CLIENT: 'client',
  AGENT: 'agent',
  SERVER: 'server',
})

/**
 * Every protocol message type. Frozen: adding a type is a reviewed change to
 * this file, not a runtime extension.
 */
export const MESSAGE_TYPES = Object.freeze({
  // --- pairing -----------------------------------------------------------
  /** client → agent: redeem the short-lived 6-digit code. */
  PAIR_REQUEST: 'pair.request',
  /** agent → client: paired, or rejected (vague on purpose). */
  PAIR_RESULT: 'pair.result',
  /** client → agent: drop the stored pairing credential. Always allowed. */
  UNPAIR_REQUEST: 'unpair.request',

  // --- state -------------------------------------------------------------
  /** client → agent: `getState()`, read-only and always safe. */
  GET_STATE: 'getState',
  /** agent → client: full state snapshot, the UI's source of truth. */
  STATE_RESULT: 'state.result',
  /** agent → client: unsolicited change (tray exit, watchdog, timeout). */
  STATE_PUSH: 'state.push',
  /** agent → client: session state-machine snapshot. */
  SESSION_STATE: 'session.state',

  // --- focus commands ----------------------------------------------------
  /** client → agent: `enterFocus(allowList)` authorised by a one-time token. */
  FOCUS_ENTER: 'focus.enter',
  /** agent → client: request validated, enforcement starting. */
  FOCUS_ENTER_ACCEPTED: 'focus.enter.accepted',
  /** agent → client: OS adapter confirmed enforcement. */
  FOCUS_ENTERED: 'focus.entered',
  /** client → agent: `exitFocus()`. Always honoured. */
  FOCUS_EXIT: 'focus.exit',
  /** agent → client: restoration started. */
  FOCUS_EXIT_ACCEPTED: 'focus.exit.accepted',
  /** agent → client: system fully restored. */
  FOCUS_EXITED: 'focus.exited',
  /** client → agent: bounded extension request. Never indefinite. */
  FOCUS_EXTEND: 'focus.extend',

  // --- liveness & errors -------------------------------------------------
  PING: 'ping',
  PONG: 'pong',
  ERROR: 'error',
})

export const MESSAGE_TYPE_LIST = Object.freeze(Object.values(MESSAGE_TYPES))

/** Who sends what. Documentation for implementers; not a runtime gate. */
export const MESSAGE_DIRECTIONS = Object.freeze({
  [MESSAGE_TYPES.PAIR_REQUEST]: ROLES.CLIENT,
  [MESSAGE_TYPES.PAIR_RESULT]: ROLES.AGENT,
  [MESSAGE_TYPES.UNPAIR_REQUEST]: ROLES.CLIENT,
  [MESSAGE_TYPES.GET_STATE]: ROLES.CLIENT,
  [MESSAGE_TYPES.STATE_RESULT]: ROLES.AGENT,
  [MESSAGE_TYPES.STATE_PUSH]: ROLES.AGENT,
  [MESSAGE_TYPES.SESSION_STATE]: ROLES.AGENT,
  [MESSAGE_TYPES.FOCUS_ENTER]: ROLES.CLIENT,
  [MESSAGE_TYPES.FOCUS_ENTER_ACCEPTED]: ROLES.AGENT,
  [MESSAGE_TYPES.FOCUS_ENTERED]: ROLES.AGENT,
  [MESSAGE_TYPES.FOCUS_EXIT]: ROLES.CLIENT,
  [MESSAGE_TYPES.FOCUS_EXIT_ACCEPTED]: ROLES.AGENT,
  [MESSAGE_TYPES.FOCUS_EXITED]: ROLES.AGENT,
  [MESSAGE_TYPES.FOCUS_EXTEND]: ROLES.CLIENT,
  [MESSAGE_TYPES.PING]: 'either',
  [MESSAGE_TYPES.PONG]: 'either',
  [MESSAGE_TYPES.ERROR]: 'either',
})

/**
 * Message types that change system state and therefore always require an
 * explicit acknowledgement or an `error` (SPEC.md §5 protocol rules).
 */
export const ACKNOWLEDGED_COMMAND_TYPES = Object.freeze([
  MESSAGE_TYPES.FOCUS_ENTER,
  MESSAGE_TYPES.FOCUS_EXIT,
  MESSAGE_TYPES.FOCUS_EXTEND,
  MESSAGE_TYPES.PAIR_REQUEST,
  MESSAGE_TYPES.UNPAIR_REQUEST,
])

/**
 * Minimal field descriptor helpers. Deliberately tiny: the protocol needs
 * presence, type and enum checks, not a general schema language.
 */
const string = (extra = {}) => ({ kind: 'string', ...extra })
const nullableString = (extra = {}) => ({ kind: 'string', nullable: true, ...extra })
const boolean = (extra = {}) => ({ kind: 'boolean', ...extra })
const number = (extra = {}) => ({ kind: 'number', ...extra })
const integer = (extra = {}) => ({ kind: 'number', integer: true, ...extra })
const timestamp = (extra = {}) => ({ kind: 'string', isoDate: true, ...extra })
const object = (extra = {}) => ({ kind: 'object', ...extra })
const array = (extra = {}) => ({ kind: 'array', ...extra })
const enumOf = (values, extra = {}) => ({ kind: 'string', enum: values, ...extra })

/**
 * Payload contracts, keyed by message type.
 *
 * `fields` maps a field name to a descriptor. `additional: false` means unknown
 * keys are rejected rather than ignored — a typo'd `allowedList` must not
 * silently produce an empty allow-list.
 */
export const PAYLOAD_CONTRACTS = Object.freeze({
  [MESSAGE_TYPES.PAIR_REQUEST]: {
    description: 'Redeem the short-lived 6-digit pairing code. Never carries a password.',
    fields: {
      code: string({ minLength: 6, maxLength: 6, pattern: '^[0-9]{6}$', secret: true }),
      deviceLabel: string({ maxLength: 80 }),
      platform: enumOf(['win32', 'darwin', 'linux']),
    },
    required: ['code'],
    additional: false,
  },

  [MESSAGE_TYPES.PAIR_RESULT]: {
    description: 'Outcome of a pairing attempt. Deliberately vague about why it failed.',
    fields: {
      paired: boolean(),
      agentId: nullableString(),
      label: nullableString(),
      platform: nullableString(),
      agentVersion: nullableString(),
      pairedAt: timestamp({ nullable: true }),
      reason: enumOf([...ERROR_CODE_LIST]),
    },
    required: ['paired'],
    additional: false,
  },

  [MESSAGE_TYPES.UNPAIR_REQUEST]: {
    description: 'Remove the stored pairing credential. Requires no confirmation.',
    fields: {},
    required: [],
    additional: false,
  },

  [MESSAGE_TYPES.GET_STATE]: {
    description: 'Read-only state request. Payload is always empty.',
    fields: {},
    required: [],
    additional: false,
  },

  [MESSAGE_TYPES.STATE_RESULT]: {
    description: 'Full agent state snapshot. The dashboard renders this, never its own guess.',
    fields: {
      agent: object({ shape: ['version', 'platform'] }),
      pairing: object({ shape: ['paired', 'pairedAt', 'label'] }),
      session: object({ shape: ['state', 'sessionId', 'startedAt', 'plannedEndAt', 'exitReason'] }),
      allowList: object({ shape: ['effective', 'protectedCount', 'extrasCount'] }),
      safety: object({ shape: ['watchdogArmed', 'graceSeconds', 'autoExitOnDisconnect'] }),
      agentHealthy: boolean(),
    },
    required: ['agent', 'pairing', 'session', 'allowList', 'safety', 'agentHealthy'],
    additional: false,
  },

  [MESSAGE_TYPES.STATE_PUSH]: {
    description: 'Same shape as state.result, sent unsolicited when something changes.',
    fields: {
      reason: enumOf([
        'USER',
        'TIMEOUT',
        'WATCHDOG',
        'CRASH_RECOVERY',
        'AGENT_QUIT',
        'ERROR',
        'SESSION_STARTED',
        'SESSION_ENDED',
        'PAIRING_CHANGED',
      ]),
      agent: object(),
      pairing: object(),
      session: object(),
      allowList: object(),
      safety: object(),
      agentHealthy: boolean(),
    },
    required: ['agent', 'pairing', 'session', 'allowList', 'safety', 'agentHealthy'],
    additional: false,
  },

  [MESSAGE_TYPES.SESSION_STATE]: {
    description: 'Session state-machine snapshot, scoped to one session.',
    fields: {
      sessionId: nullableString(),
      state: enumOf(AGENT_STATE_LIST, { stateName: true }),
      startedAt: timestamp({ nullable: true }),
      plannedEndAt: timestamp({ nullable: true }),
      exitReason: enumOf(EXIT_REASON_LIST, { nullable: true }),
    },
    required: ['state'],
    additional: false,
  },

  [MESSAGE_TYPES.FOCUS_ENTER]: {
    description:
      'enterFocus(allowList). Carries authorisation, never raw policy: the agent re-resolves the protected baseline.',
    fields: {
      sessionId: string({ minLength: 1 }),
      commandToken: string({ minLength: 1, secret: true }),
    },
    required: ['sessionId', 'commandToken'],
    additional: false,
  },

  [MESSAGE_TYPES.FOCUS_ENTER_ACCEPTED]: {
    description: 'Request validated, enforcement not yet applied.',
    fields: {
      sessionId: string({ minLength: 1 }),
      state: enumOf(AGENT_STATE_LIST, { stateName: true }),
    },
    required: ['sessionId', 'state'],
    additional: false,
  },

  [MESSAGE_TYPES.FOCUS_ENTERED]: {
    description:
      'OS adapter confirmed enforcement. The only point at which the UI may claim focus mode is on.',
    fields: {
      sessionId: string({ minLength: 1 }),
      state: enumOf(AGENT_STATE_LIST, { stateName: true }),
      effectiveAllowList: array(),
      protectedCount: integer({ min: 0 }),
      startedAt: timestamp(),
      plannedEndAt: timestamp(),
    },
    required: ['sessionId', 'state', 'effectiveAllowList', 'protectedCount', 'startedAt', 'plannedEndAt'],
    additional: false,
  },

  [MESSAGE_TYPES.FOCUS_EXIT]: {
    description: 'exitFocus(). Always honoured, even mid-enforcement. Never gated.',
    fields: {
      sessionId: string({ minLength: 1 }),
    },
    required: ['sessionId'],
    additional: false,
  },

  [MESSAGE_TYPES.FOCUS_EXIT_ACCEPTED]: {
    description: 'Restoration started.',
    fields: {
      sessionId: string({ minLength: 1 }),
      state: enumOf(AGENT_STATE_LIST, { stateName: true }),
    },
    required: ['sessionId', 'state'],
    additional: false,
  },

  [MESSAGE_TYPES.FOCUS_EXITED]: {
    description: 'System fully restored.',
    fields: {
      sessionId: string({ minLength: 1 }),
      state: enumOf(AGENT_STATE_LIST, { stateName: true }),
      exitReason: enumOf(EXIT_REASON_LIST),
      actualDurationSeconds: integer({ min: 0 }),
    },
    required: ['sessionId', 'state', 'exitReason'],
    additional: false,
  },

  [MESSAGE_TYPES.FOCUS_EXTEND]: {
    description: 'Bounded extension. The server caps the total; "indefinite" does not exist.',
    fields: {
      sessionId: string({ minLength: 1 }),
      additionalMinutes: integer({ min: 1 }),
      commandToken: string({ minLength: 1, secret: true }),
    },
    required: ['sessionId', 'additionalMinutes', 'commandToken'],
    additional: false,
  },

  [MESSAGE_TYPES.PING]: {
    description: 'Liveness probe. A missed heartbeat arms the fail-safe (SPEC §7.15).',
    fields: {
      sentAt: timestamp(),
    },
    required: ['sentAt'],
    additional: false,
  },

  [MESSAGE_TYPES.PONG]: {
    description: 'Liveness reply, echoing the probe timestamp.',
    fields: {
      sentAt: timestamp(),
      receivedAt: timestamp(),
    },
    required: ['sentAt'],
    additional: false,
  },

  [MESSAGE_TYPES.ERROR]: {
    description: 'Structured failure. Always one of the fixed error codes.',
    fields: {
      code: enumOf(ERROR_CODE_LIST, { codeName: true }),
      message: string({ minLength: 1 }),
      retryable: boolean(),
      detail: object({ nullable: true }),
      inReplyToType: string({ nullable: true }),
    },
    required: ['code', 'message', 'retryable'],
    additional: false,
  },
})

/** @param {unknown} type */
export function isKnownMessageType(type) {
  return typeof type === 'string' && MESSAGE_TYPE_LIST.includes(type)
}

/** @param {string} type */
export function getMessageContract(type) {
  return PAYLOAD_CONTRACTS[type] ?? null
}

/** @param {string} type */
export function getMessageDirection(type) {
  return MESSAGE_DIRECTIONS[type] ?? 'unknown'
}

/**
 * Validate a payload against its contract.
 *
 * @param {string} type
 * @param {unknown} payload
 * @returns {{ ok: true } | { ok: false, message: string, detail?: object }}
 */
export function validatePayload(type, payload) {
  const contract = getMessageContract(type)

  if (!contract) {
    return { ok: false, message: `No payload contract for type "${String(type)}"` }
  }

  // `null` is malformed and must not be silently treated as "absent"; only an
  // omitted payload defaults to `{}`, for types that take no fields.
  if (payload === null) {
    return { ok: false, message: 'payload must be a plain object' }
  }

  const value = payload ?? {}

  if (typeof value !== 'object' || Array.isArray(value)) {
    return { ok: false, message: 'payload must be a plain object' }
  }

  const { fields, required = [], additional = true } = contract
  const violations = []

  for (const fieldName of required) {
    if (!Object.hasOwn(value, fieldName) || value[fieldName] === undefined) {
      violations.push(`missing required field "${fieldName}"`)
    }
  }

  for (const [fieldName, descriptor] of Object.entries(fields)) {
    if (!Object.hasOwn(value, fieldName)) continue

    const fieldValue = value[fieldName]
    if (fieldValue === undefined) continue

    const violation = checkField(fieldName, fieldValue, descriptor)
    if (violation) violations.push(violation)
  }

  if (additional === false) {
    const known = new Set(Object.keys(fields))
    for (const key of Object.keys(value)) {
      if (!known.has(key)) violations.push(`unknown field "${key}"`)
    }
  }

  if (violations.length === 0) return { ok: true }

  return {
    ok: false,
    message: violations.join('; '),
    detail: { type, violations },
  }
}

function checkField(fieldName, value, descriptor) {
  const { kind, nullable } = descriptor

  if (value === null) return nullable ? null : `"${fieldName}" must not be null`
  if (value === undefined) return null

  switch (kind) {
    case 'string': {
      if (typeof value !== 'string') return `"${fieldName}" must be a string`
      if (descriptor.minLength !== undefined && value.length < descriptor.minLength) {
        return `"${fieldName}" must be at least ${descriptor.minLength} characters`
      }
      if (descriptor.maxLength !== undefined && value.length > descriptor.maxLength) {
        return `"${fieldName}" must be at most ${descriptor.maxLength} characters`
      }
      if (descriptor.pattern && !new RegExp(descriptor.pattern).test(value)) {
        return `"${fieldName}" does not match ${descriptor.pattern}`
      }
      if (descriptor.enum && !descriptor.enum.includes(value)) {
        return `"${fieldName}" must be one of: ${descriptor.enum.join(', ')}`
      }
      if (descriptor.isoDate && !isIsoInstant(value)) {
        return `"${fieldName}" must be an ISO-8601 instant`
      }
      return null
    }

    case 'boolean':
      return typeof value === 'boolean' ? null : `"${fieldName}" must be a boolean`

    case 'number': {
      if (typeof value !== 'number' || Number.isNaN(value)) {
        return `"${fieldName}" must be a number`
      }
      if (descriptor.integer && !Number.isInteger(value)) {
        return `"${fieldName}" must be an integer`
      }
      if (descriptor.min !== undefined && value < descriptor.min) {
        return `"${fieldName}" must be >= ${descriptor.min}`
      }
      return null
    }

    case 'object': {
      if (typeof value !== 'object' || Array.isArray(value)) {
        return `"${fieldName}" must be an object`
      }
      // Sub-shape names are documentation for now: the nested payloads are
      // owned by the agent/server contracts (Prompts 019 and 007).
      return null
    }

    case 'array':
      return Array.isArray(value) ? null : `"${fieldName}" must be an array`

    default:
      return null
  }
}

function isIsoInstant(value) {
  if (typeof value !== 'string') return false
  if (Number.isNaN(Date.parse(value))) return false
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(Z|[+-]\d{2}:\d{2})$/.test(value)
}

/**
 * Build a `state.result` payload from an agent state object, using the agent
 * states as the vocabulary. Present so all three components agree on the shape
 * without duplicating it.
 *
 * @param {object} snapshot
 */
export function createStateResultPayload(snapshot) {
  const state = snapshot?.session?.state

  if (state !== undefined && !isAgentState(state)) {
    throw new TypeError(`Unknown agent state: ${String(state)}`)
  }

  return {
    agent: snapshot.agent ?? { version: null, platform: null },
    pairing: snapshot.pairing ?? { paired: false, pairedAt: null, label: null },
    session: snapshot.session ?? {
      state: null,
      sessionId: null,
      startedAt: null,
      plannedEndAt: null,
      exitReason: null,
    },
    allowList: snapshot.allowList ?? { effective: [], protectedCount: 0, extrasCount: 0 },
    safety: snapshot.safety ?? {
      watchdogArmed: false,
      graceSeconds: 0,
      autoExitOnDisconnect: true,
    },
    agentHealthy: snapshot.agentHealthy ?? true,
  }
}

/**
 * Normalise an `error` payload, defaulting `retryable` from the code table.
 * @param {object} payload
 */
export function normaliseErrorPayload(payload) {
  const code = payload?.code

  return {
    code,
    message: payload?.message ?? 'Unknown error',
    retryable: payload?.retryable ?? isRetryable(code) ?? false,
    ...(payload?.detail !== undefined ? { detail: payload.detail } : {}),
  }
}

/** @param {string} code */
export function isKnownErrorCode(code) {
  return isErrorCode(code)
}