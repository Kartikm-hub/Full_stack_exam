/**
 * The protocol envelope (SPEC.md §5).
 *
 * Every message between the dashboard and the agent — and between any component
 * and the cloud API that speaks the agent protocol — is this exact shape:
 *
 *   { version, type, id, replyTo, timestamp, payload }
 *
 * Rules encoded here:
 *  - `version` is mandatory and must be a supported integer.
 *  - `type` must be a known protocol message type.
 *  - `id` must be a non-empty string up to MAX_ID_LENGTH.
 *  - `timestamp` must be a real ISO-8601 instant, not merely parseable noise.
 *  - `payload` must be a plain object (possibly empty). Never repaired, always
 *    rejected when wrong — a silently "fixed" message is a safety bug here.
 */

import { ERROR_CODES, ProtocolError } from './errors.js'
import { MESSAGE_TYPE_LIST, validatePayload } from './messages.js'

/** Protocol version implemented by this build. */
export const PROTOCOL_VERSION = 1

/** Versions this build can decode. Bumped only by a reviewed protocol change. */
export const SUPPORTED_PROTOCOL_VERSIONS = Object.freeze([1])

/** Prefix for generated ids, so a `msg_` id is recognisable in logs. */
export const MESSAGE_ID_PREFIX = 'msg_'

/** Upper bound on `id` length, enforced before any allocation-heavy work. */
export const MAX_ID_LENGTH = 128

/** Guard against oversized frames before the caller starts validating (SPEC §5). */
export const MAX_PAYLOAD_BYTES = 64 * 1024

/** Sentinel for an explicitly empty `replyTo`. `null` and `undefined` both mean "not a reply". */
export const NO_REPLY = null

/** @param {string} value */
function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0
}

/** @param {unknown} value */
function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * Accept only full ISO-8601 instants with an explicit UTC offset or `Z`, plus
 * the exact millisecond form the protocol emits. `new Date('hello')` is NaN and
 * `new Date('2026-13-01')` rolls over, so this is stricter than `Date.parse`.
 *
 * @param {unknown} value
 */
export function isValidTimestamp(value) {
  if (typeof value !== 'string') return false

  // Reject rollover dates that Date.parse would silently accept.
  const parsed = Date.parse(value)
  if (Number.isNaN(parsed)) return false

  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?(Z|[+-]\d{2}:\d{2})$/.exec(
    value,
  )
  if (!match) return false

  const [, year, month, day] = match
  const monthNumber = Number(month)
  const dayNumber = Number(day)

  if (monthNumber < 1 || monthNumber > 12) return false
  if (dayNumber < 1 || dayNumber > 31) return false

  // Compare against a UTC-normalised copy so a timezone offset cannot shift the
  // calendar day out of range unnoticed.
  const utc = new Date(`${year}-${month}-${day}T00:00:00.000Z`)
  if (utc.getUTCMonth() + 1 !== monthNumber || utc.getUTCDate() !== dayNumber) return false

  return true
}

/** @param {number} version */
export function isSupportedVersion(version) {
  return SUPPORTED_PROTOCOL_VERSIONS.includes(version)
}

/** @param {unknown} type */
export function isKnownType(type) {
  return typeof type === 'string' && MESSAGE_TYPE_LIST.includes(type)
}

/**
 * RFC-4122-shaped v4 id. Uses `crypto.randomUUID()` where available and falls
 * back to `crypto.getRandomValues`, which every supported Node and browser has.
 *
 * @returns {string} e.g. `msg_1f0c...`
 */
export function createMessageId() {
  const uuid = globalThis.crypto?.randomUUID?.()

  if (uuid) return `${MESSAGE_ID_PREFIX}${uuid}`

  const bytes = new Uint8Array(16)
  globalThis.crypto.getRandomValues(bytes)
  // Set version 4 and variant bits so the value is a well-formed v4 UUID.
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80

  const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('')
  const uuidShape = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`

  return `${MESSAGE_ID_PREFIX}${uuidShape}`
}

/** @param {number|Date} [at] */
export function createTimestamp(at = new Date()) {
  return new Date(at).toISOString()
}

/**
 * Create a protocol envelope.
 *
 * Creation is strict about `type` but does not validate the payload's inner
 * fields: use `validatePayload` (or `validateMessage` for both layers) when
 * receiving data from another component.
 *
 * @param {object} options
 * @param {string} options.type    one of MESSAGE_TYPES
 * @param {object} [options.payload]
 * @param {string} [options.id]            defaults to a fresh message id
 * @param {string|null} [options.replyTo]  id of the message being answered
 * @param {string} [options.timestamp]     defaults to now
 * @param {number} [options.version]       defaults to PROTOCOL_VERSION
 * @throws {ProtocolError} INVALID_MESSAGE / UNSUPPORTED_MESSAGE_TYPE
 */
export function createEnvelope({ type, payload = {}, id, replyTo = NO_REPLY, timestamp, version = PROTOCOL_VERSION }) {
  if (!isKnownType(type)) {
    throw new ProtocolError(
      ERROR_CODES.UNSUPPORTED_MESSAGE_TYPE,
      `Unknown message type: ${String(type)}`,
      { detail: { type: String(type), known: MESSAGE_TYPE_LIST.length } },
    )
  }

  if (!isNonEmptyString(id) && id !== undefined) {
    throw new ProtocolError(ERROR_CODES.INVALID_MESSAGE, 'Envelope id must be a non-empty string')
  }

  if (replyTo !== NO_REPLY && replyTo !== undefined && !isNonEmptyString(replyTo)) {
    throw new ProtocolError(
      ERROR_CODES.INVALID_MESSAGE,
      'replyTo must be a non-empty string or null',
    )
  }

  const envelope = {
    version,
    type,
    id: id ?? createMessageId(),
    replyTo: replyTo ?? NO_REPLY,
    timestamp: timestamp ?? createTimestamp(),
    payload,
  }

  return envelope
}

/**
 * Convenience wrapper: build a response envelope that answers `request`.
 *
 * @param {object} request  the inbound envelope
 * @param {string} type     response type
 * @param {object} [payload]
 * @param {object} [options]
 */
export function createReply(request, type, payload = {}, options = {}) {
  if (!isPlainObject(request) || !isNonEmptyString(request.id)) {
    throw new ProtocolError(ERROR_CODES.INVALID_MESSAGE, 'Cannot reply: request id is missing')
  }

  return createEnvelope({
    type,
    payload,
    replyTo: request.id,
    ...options,
  })
}

/**
 * Validate the envelope structure only.
 *
 * @param {unknown} candidate
 * @returns {{ ok: true, envelope: object } | { ok: false, code: string, message: string }}
 */
export function validateEnvelope(candidate) {
  if (!isPlainObject(candidate)) {
    return fail(ERROR_CODES.INVALID_MESSAGE, 'Envelope must be a plain object')
  }

  // `version` first: an unknown version means the rest cannot be trusted.
  if (!('version' in candidate) || candidate.version === undefined || candidate.version === null) {
    return fail(ERROR_CODES.INVALID_MESSAGE, 'Envelope is missing "version"')
  }

  const { version } = candidate
  if (typeof version !== 'number' || !Number.isInteger(version)) {
    return fail(ERROR_CODES.INVALID_MESSAGE, 'Envelope "version" must be an integer')
  }

  if (!isSupportedVersion(version)) {
    return fail(ERROR_CODES.UNSUPPORTED_VERSION, `Unsupported protocol version: ${version}`, {
      supported: SUPPORTED_PROTOCOL_VERSIONS,
    })
  }

  if (!('type' in candidate) || candidate.type === undefined || candidate.type === null) {
    return fail(ERROR_CODES.INVALID_MESSAGE, 'Envelope is missing "type"')
  }

  if (typeof candidate.type !== 'string') {
    return fail(ERROR_CODES.INVALID_MESSAGE, 'Envelope "type" must be a string')
  }

  if (!isKnownType(candidate.type)) {
    return fail(ERROR_CODES.UNSUPPORTED_MESSAGE_TYPE, `Unknown message type: ${candidate.type}`)
  }

  if (!('id' in candidate) || candidate.id === undefined || candidate.id === null) {
    return fail(ERROR_CODES.INVALID_MESSAGE, 'Envelope is missing "id"')
  }

  if (!isNonEmptyString(candidate.id)) {
    return fail(ERROR_CODES.INVALID_MESSAGE, 'Envelope "id" must be a non-empty string')
  }

  if (candidate.id.length > MAX_ID_LENGTH) {
    return fail(ERROR_CODES.INVALID_MESSAGE, `Envelope "id" exceeds ${MAX_ID_LENGTH} characters`)
  }

  if (!('timestamp' in candidate) || candidate.timestamp === undefined || candidate.timestamp === null) {
    return fail(ERROR_CODES.INVALID_MESSAGE, 'Envelope is missing "timestamp"')
  }

  if (!isValidTimestamp(candidate.timestamp)) {
    return fail(ERROR_CODES.INVALID_MESSAGE, 'Envelope "timestamp" must be an ISO-8601 instant')
  }

  if ('replyTo' in candidate && candidate.replyTo !== NO_REPLY && candidate.replyTo !== undefined) {
    if (!isNonEmptyString(candidate.replyTo)) {
      return fail(ERROR_CODES.INVALID_MESSAGE, 'Envelope "replyTo" must be a non-empty string or null')
    }

    if (candidate.replyTo.length > MAX_ID_LENGTH) {
      return fail(ERROR_CODES.INVALID_MESSAGE, `Envelope "replyTo" exceeds ${MAX_ID_LENGTH} characters`)
    }
  }

  // `payload` may be omitted only as an explicit empty object; a non-object
  // payload (array, string, null) is malformed, never coerced.
  if ('payload' in candidate && candidate.payload !== undefined) {
    if (!isPlainObject(candidate.payload)) {
      return fail(ERROR_CODES.INVALID_MESSAGE, 'Envelope "payload" must be a plain object')
    }

    const byteLength = approximateByteLength(candidate.payload)
    if (byteLength > MAX_PAYLOAD_BYTES) {
      return fail(ERROR_CODES.INVALID_MESSAGE, 'Envelope "payload" exceeds the maximum frame size', {
        maxBytes: MAX_PAYLOAD_BYTES,
        actualBytes: byteLength,
      })
    }
  }

  return { ok: true, envelope: normaliseEnvelope(candidate) }
}

/**
 * Validate envelope + payload schema together. This is what every receiver
 * should call on an inbound message.
 *
 * @param {unknown} candidate
 * @returns {{ ok: true, envelope: object } | { ok: false, code: string, message: string, detail?: object }}
 */
export function validateMessage(candidate) {
  const envelopeResult = validateEnvelope(candidate)
  if (!envelopeResult.ok) return envelopeResult

  const { envelope } = envelopeResult
  const payloadResult = validatePayload(envelope.type, envelope.payload)

  if (!payloadResult.ok) {
    return {
      ok: false,
      code: ERROR_CODES.INVALID_MESSAGE,
      message: `Invalid payload for "${envelope.type}": ${payloadResult.message}`,
      detail: { type: envelope.type, ...payloadResult.detail },
    }
  }

  return { ok: true, envelope }
}

function fail(code, message, detail) {
  const result = { ok: false, code, message }
  if (detail !== undefined) result.detail = detail
  return result
}

/** Cheap size guard that avoids `JSON.stringify` on a hostile payload twice. */
function approximateByteLength(payload) {
  try {
    return JSON.stringify(payload)?.length ?? 0
  } catch {
    return Number.POSITIVE_INFINITY
  }
}

/**
 * Fill in the documented defaults for an already-valid envelope so consumers
 * never branch on `undefined` for `replyTo` or `payload`.
 */
function normaliseEnvelope(candidate) {
  return {
    version: candidate.version,
    type: candidate.type,
    id: candidate.id,
    replyTo: candidate.replyTo ?? NO_REPLY,
    timestamp: candidate.timestamp,
    payload: candidate.payload ?? {},
  }
}