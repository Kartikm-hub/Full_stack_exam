/**
 * Minimal structured logger.
 *
 * Deliberately not a framework. It writes one JSON object per line so a log
 * aggregator can parse it later without us having chosen one yet.
 *
 * SAFETY: this module never logs request bodies, request headers, or anything
 * from `process.env`. Callers pass the fields they want, so a password or a
 * pairing code cannot be logged by accident through this API. See
 * `redactSecrets` in `config/index.js` for env-shaped input.
 */

/** Log levels, lowest to highest. */
export const LOG_LEVELS = Object.freeze(['debug', 'info', 'warn', 'error'])

const LEVEL_WEIGHT = Object.freeze({
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
})

/**
 * @typedef {object} Logger
 * @property {(message: string, fields?: object) => void} debug
 * @property {(message: string, fields?: object) => void} info
 * @property {(message: string, fields?: object) => void} warn
 * @property {(message: string, fields?: object) => void} error
 */

/**
 * @param {object} [options]
 * @param {string} [options.level]     minimum level to emit
 * @param {boolean} [options.silent]   suppress all output (tests)
 * @param {string} [options.service]
 * @param {(line: string) => void} [options.write] sink override (tests)
 * @returns {Logger}
 */
export function createLogger({
  level = 'info',
  silent = false,
  service = 'focus-mode-server',
  write = defaultWrite,
} = {}) {
  const threshold = LEVEL_WEIGHT[level] ?? LEVEL_WEIGHT.info

  /** @param {keyof LEVEL_WEIGHT} levelName */
  const emit = (levelName, message, fields = {}) => {
    if (silent) return
    if (LEVEL_WEIGHT[levelName] < threshold) return

    write(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level: levelName,
        service,
        message,
        ...fields,
      }),
    )
  }

  return {
    debug: (message, fields) => emit('debug', message, fields),
    info: (message, fields) => emit('info', message, fields),
    warn: (message, fields) => emit('warn', message, fields),
    error: (message, fields) => emit('error', message, fields),
  }
}

/** Console sink. stderr for warnings and errors so stdout stays pipeable. */
function defaultWrite(line) {
  const { level } = JSON.parse(line)
  const target = level === 'error' || level === 'warn' ? process.stderr : process.stdout

  target.write(`${line}\n`)
}

/** A logger that discards everything, for tests. */
export const silentLogger = createLogger({ silent: true })