/**
 * HTTP error shapes.
 *
 * One consistent JSON body for every failure, so the dashboard has exactly one
 * error shape to parse:
 *
 *   { "error": { "code": "...", "message": "...", "details": [...]? } }
 *
 * `code` is stable and machine-readable. `message` is safe to show a user.
 * `details` is only ever populated outside production, and never with stack
 * traces, file paths, or configuration values.
 */

/**
 * An error that carries an HTTP status and a stable code.
 * Throw it from a route or middleware; `errorHandler` renders it.
 */
export class ApiError extends Error {
  /**
   * @param {number} status
   * @param {string} code
   * @param {string} message  user-safe text
   * @param {object} [options]
   * @param {unknown[]} [options.details] diagnostic list, non-production only
   */
  constructor(status, code, message, { details } = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.expose = true
    if (details) this.details = details
  }

  static badRequest(code, message, options) {
    return new ApiError(400, code, message, options)
  }

  static unauthorized(code, message) {
    return new ApiError(401, code, message)
  }

  static notFound(message = 'Resource not found', code = 'NOT_FOUND') {
    return new ApiError(404, code, message)
  }

  static payloadTooLarge(message = 'Request body is too large', code = 'PAYLOAD_TOO_LARGE') {
    return new ApiError(413, code, message)
  }

  static internal(message = 'Internal server error', code = 'INTERNAL_ERROR') {
    const error = new ApiError(500, code, message)
    // Never expose an internal failure's text to the client.
    error.expose = false
    return error
  }
}

/**
 * Body for a known error. Development and test may include `details`; in
 * production only the code and the generic message survive.
 *
 * @param {ApiError} error
 * @param {import('../config/index.js').ServerConfig} config
 */
export function toErrorBody(error, config) {
  const body = {
    error: {
      code: error.code,
      message: error.expose ? error.message : 'Internal server error',
    },
  }

  if (!config.isProduction && Array.isArray(error.details) && error.details.length > 0) {
    body.error.details = error.details
  }

  return body
}