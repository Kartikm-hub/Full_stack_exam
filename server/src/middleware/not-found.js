/**
 * Terminal 404 handler for unmatched routes.
 *
 * Mounted after every router, so anything that reached this point does not
 * exist. The response shape matches every other error (see `lib/http-error.js`).
 *
 * The path is echoed back because it helps a developer find a typo, and it is
 * truncated for the same reason the logger truncates it: the value comes from
 * the client.
 */

import { ApiError } from '../lib/http-error.js'

const MAX_ECHOED_PATH = 200

export function notFoundHandler() {
  return function handleNotFound(req, _res, next) {
    const path = truncate(req.originalUrl ?? req.url ?? '', MAX_ECHOED_PATH)

    next(ApiError.notFound(`Cannot ${req.method} ${path}`, 'ROUTE_NOT_FOUND'))
  }
}

function truncate(value, max) {
  return value.length > max ? `${value.slice(0, max)}…` : value
}