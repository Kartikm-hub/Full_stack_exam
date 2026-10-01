/**
 * Request logging.
 *
 * Logs one line per completed request: method, path, status, duration.
 *
 * SAFETY: the query string is logged, the body and headers never are. A path
 * may legitimately contain an id; a body would contain passwords, tokens and
 * pairing codes. `req.originalUrl` is used so a mounted router's prefix shows
 * up, and it is truncated so a hostile URL cannot flood the log.
 */

const MAX_URL_LENGTH = 300

/**
 * @param {object} options
 * @param {import('../lib/logger.js').Logger} options.logger
 * @param {import('../config/index.js').ServerConfig} options.config
 */
export function requestLogger({ logger, config }) {
  return function logRequest(req, res, next) {
    const startedAt = process.hrtime.bigint()

    res.on('finish', () => {
      const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6
      const path = truncate(req.originalUrl ?? req.url ?? '', MAX_URL_LENGTH)

      // 5xx is an operator problem: warn. 4xx is a client problem: debug.
      const level = res.statusCode >= 500 ? 'warn' : 'debug'
      const message = level === 'warn' ? 'request failed' : 'request'

      logger[level](message, {
        method: req.method,
        path,
        status: res.statusCode,
        durationMs: round(durationMs),
        // No headers, no body, no cookies.
        environment: config.nodeEnv,
      })
    })

    next()
  }
}

function truncate(value, max) {
  return value.length > max ? `${value.slice(0, max)}…` : value
}

function round(value) {
  return Math.round(value * 100) / 100
}