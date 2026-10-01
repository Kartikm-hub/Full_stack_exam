/**
 * Protocol error codes.
 *
 * A FIXED enum (SPEC.md §5.1: "Codes are a fixed enum"). Nothing may add a code
 * at runtime; a new failure mode is expressed with an existing code plus a
 * `detail` field, or by amending this file in a reviewed protocol change.
 *
 * `retryable` is a default, not a promise. The receiver may still refuse to
 * retry; the client uses it to decide whether to surface a "Try again" action.
 */

/** Canonical error codes. The only valid values of `error` payload `code`. */
export const ERROR_CODES = Object.freeze({
  /** Envelope structure is invalid: missing/invalid field, malformed payload. */
  INVALID_MESSAGE: 'INVALID_MESSAGE',
  /** Envelope `version` is newer (or older) than this build understands. */
  UNSUPPORTED_VERSION: 'UNSUPPORTED_VERSION',
  /** Envelope `type` is well formed but not part of the protocol. */
  UNSUPPORTED_MESSAGE_TYPE: 'UNSUPPORTED_MESSAGE_TYPE',
  /** Pairing is required before this command may be executed. */
  PAIRING_REQUIRED: 'PAIRING_REQUIRED',
  /** Connection exists but carries no valid pairing credential. */
  UNAUTHENTICATED: 'UNAUTHENTICATED',
  /** Pairing code was wrong, already consumed, or revoked. Deliberately vague. */
  PAIRING_REJECTED: 'PAIRING_REJECTED',
  /** One-time command token is not recognised (wrong or already used). */
  TOKEN_INVALID: 'TOKEN_INVALID',
  /** One-time command token was valid but has passed its expiry. */
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  /** A focus session is already active; the command is answered with state. */
  SESSION_ALREADY_ACTIVE: 'SESSION_ALREADY_ACTIVE',
  /** Referenced session id is unknown to the agent. */
  SESSION_NOT_FOUND: 'SESSION_NOT_FOUND',
  /** Command is not legal from the agent's current state (see `state.js`). */
  INVALID_STATE: 'INVALID_STATE',
  /** Link is alive but the peer exceeded the frame or rate limit. */
  RATE_LIMITED: 'RATE_LIMITED',
  /** Unexpected failure. Details are logged locally, never broadcast. */
  INTERNAL_ERROR: 'INTERNAL_ERROR',
})

/** Immutable list in declaration order, useful for docs and tests. */
export const ERROR_CODE_LIST = Object.freeze(Object.values(ERROR_CODES))

/**
 * Whether a caller may sensibly retry the same request unchanged.
 * `TOKEN_EXPIRED` and `PAIRING_REJECTED` are false: retrying needs a new
 * credential, not another attempt.
 */
const RETRYABLE_BY_DEFAULT = Object.freeze({
  INVALID_MESSAGE: false,
  UNSUPPORTED_VERSION: false,
  UNSUPPORTED_MESSAGE_TYPE: false,
  PAIRING_REQUIRED: false,
  UNAUTHENTICATED: false,
  PAIRING_REJECTED: false,
  TOKEN_INVALID: false,
  TOKEN_EXPIRED: false,
  SESSION_ALREADY_ACTIVE: false,
  SESSION_NOT_FOUND: false,
  INVALID_STATE: false,
  RATE_LIMITED: true,
  INTERNAL_ERROR: true,
})

/** @param {string} code */
export function isErrorCode(code) {
  return Object.hasOwn(ERROR_CODES, code)
}

/** @param {string} code */
export function isRetryable(code) {
  return RETRYABLE_BY_DEFAULT[code] ?? false
}

/**
 * Build the canonical `error` payload.
 *
 * @param {string} code      one of ERROR_CODES
 * @param {string} message   human-readable, safe to show in the UI
 * @param {object} [options]
 * @param {boolean} [options.retryable] override the default
 * @param {string} [options.detail]     optional machine-readable context
 * @throws {TypeError} if `code` is not part of the fixed enum
 */
export function createErrorPayload(code, message, options = {}) {
  if (!isErrorCode(code)) {
    throw new TypeError(`Unknown error code: ${String(code)}`)
  }

  const payload = {
    code,
    message,
    retryable: options.retryable ?? isRetryable(code),
  }

  if (options.detail !== undefined) payload.detail = options.detail

  return payload
}

/**
 * Thrown by validators. `code` is always one of ERROR_CODES so any component
 * can turn it into an `error` envelope without a lookup table.
 */
export class ProtocolError extends Error {
  constructor(code, message, options = {}) {
    super(message)
    this.name = 'ProtocolError'
    this.code = isErrorCode(code) ? code : ERROR_CODES.INTERNAL_ERROR
    this.retryable = options.retryable ?? isRetryable(this.code)
    this.detail = options.detail
  }
}