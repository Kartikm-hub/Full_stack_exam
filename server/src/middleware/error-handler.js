/**
 * Centralised error handler. Must be mounted LAST.
 *
 * Express identifies an error-handling middleware by its four-argument
 * signature; the unused `next` is required and must stay.
 *
 * Responsibilities:
 *  - map known failure shapes (malformed JSON, oversized body, ApiError) to a
 *    stable code and an appropriate status
 *  - return one consistent JSON body for every failure
 *  - 500 with no stack trace and no internal detail in production
 *  - log unexpected failures with the stack, so operators can debug, while the
 *    response body stays clean
 *
 * The response NEVER contains a stack trace, a file path, a configuration
 * value, or a request body. Stack traces are logged, not returned.
 */

import { ApiError, toErrorBody } from '../lib/http-error.js'

/**
 * @param {object} options
 * @param {import('../lib/logger.js').Logger} options.logger
 * @param {import('../config/index.js').ServerConfig} options.config
 */
export function errorHandler({ logger, config }) {
  // eslint-disable-next-line no-unused-vars -- Express requires the 4-arg shape
  return function handleError(err, req, res, next) {
    const mapped = mapError(err, config)

    // Unexpected failures are logged in full; expected ones are not errors.
    if (mapped.status >= 500) {
      logger.error('unhandled request error', {
        method: req.method,
        path: req.originalUrl ?? req.url ?? '',
        status: mapped.status,
        code: mapped.code,
        // The stack may contain internal paths, so it goes to the log only.
        stack: err instanceof Error ? err.stack : String(err),
      })
    } else {
      logger.debug('request rejected', {
        method: req.method,
        path: req.originalUrl ?? req.url ?? '',
        status: mapped.status,
        code: mapped.code,
      })
    }

    if (res.headersSent) {
      // Too late to change the status line; drop the connection instead of
      // appending a second body.
      return res.destroy()
    }

    return res.status(mapped.status).json(toErrorBody(mapped, config))
  }
}

/**
 * Translate any thrown value into an `ApiError`. Never trusts `err.message` for
 * an unknown failure, so an internal exception string cannot leak to a client.
 *
 * @param {unknown} err
 * @param {import('../config/index.js').ServerConfig} config
 * @returns {ApiError}
 */
export function mapError(err, config) {
  if (err instanceof ApiError) return err

  // Malformed JSON thrown by express.json() / body-parser.
  if (isBodyParseError(err)) {
    return new ApiError(400, 'INVALID_JSON', 'Request body is not valid JSON', {
      details: [err.message],
    })
  }

  if (isPayloadTooLarge(err)) {
    return ApiError.payloadTooLarge()
  }

  if (err instanceof Error) {
    if (err.status === 400 && err.name === 'SyntaxError') {
      return new ApiError(400, 'INVALID_JSON', 'Request body is not valid JSON')
    }

    // Any other status an upstream middleware trusted enough to set.
    const status = Number(err.status ?? err.statusCode)
    if (Number.isInteger(status) && status >= 400 && status < 500) {
      return new ApiError(status, errorCodeFor(status), 'Request could not be processed')
    }
  }

  // Unknown: generic message, status 500.
  void config
  return ApiError.internal()
}

/** body-parser tags parse failures so we do not have to sniff the message. */
function isBodyParseError(err) {
  return (
    err instanceof SyntaxError &&
    (err.type === 'entity.parse.failed' || Object.hasOwn(err, 'body'))
  )
}

function isPayloadTooLarge(err) {
  return err?.type === 'entity.too.large'
}

function errorCodeFor(status) {
  switch (status) {
    case 401:
      return 'UNAUTHORIZED'
    case 403:
      return 'FORBIDDEN'
    case 404:
      return 'NOT_FOUND'
    case 405:
      return 'METHOD_NOT_ALLOWED'
    case 415:
      return 'UNSUPPORTED_MEDIA_TYPE'
    default:
      return 'BAD_REQUEST'
  }
}