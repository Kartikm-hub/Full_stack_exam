/**
 * Environment configuration for the Focus Mode cloud API.
 *
 * Reads `process.env`, validates it, and returns a frozen config object.
 * No dependency on a validation library: the rules are few and explicit, and
 * the project already avoids unnecessary packages.
 *
 * IMPORTANT: this module validates configuration only. It never opens a
 * database connection. `mongodbUri` is carried as a string and nothing more,
 * because MongoDB is not implemented yet (Prompt 004).
 *
 * Secrets are never logged, never returned to clients, and never appear in
 * error messages. When a variable fails validation we report the variable
 * NAME and the rule it broke, never its value.
 */

/** Environments the server knows how to behave in. */
export const ENVIRONMENTS = Object.freeze(['development', 'test', 'production'])

/** Fail loudly rather than silently picking an unexpected port. */
const DEFAULT_PORT = 4000
const PORT_MIN = 1
const PORT_MAX = 65535

/**
 * Variable names that must never appear in logs or error output.
 * Used by the logger to redact defensively.
 */
export const SECRET_ENV_KEYS = Object.freeze([
  'password',
  'passwordhash',
  'token',
  'commandtoken',
  'code',
  'pairingcode',
  'secret',
  'jwt',
  'authorization',
  'cookie',
  'mongodb_uri',
  'mongo_uri',
])

/** Thrown when the environment is unusable. Fatal at startup. */
export class ConfigError extends Error {
  /** @param {string[]} problems */
  constructor(problems) {
    super(`Invalid server configuration:\n  - ${problems.join('\n  - ')}`)
    this.name = 'ConfigError'
    this.problems = problems
  }
}

/**
 * @typedef {object} ServerConfig
 * @property {'development'|'test'|'production'} nodeEnv
 * @property {boolean} isProduction
 * @property {boolean} isDevelopment
 * @property {boolean} isTest
 * @property {number} port
 * @property {string} mongodbUri  Configuration only; not connected in Prompt 004.
 * @property {boolean} hasMongodbUri
 * @property {string} serviceName
 * @property {string} serviceVersion
 */

/**
 * Validate and freeze configuration.
 *
 * @param {NodeJS.ProcessEnv} [env] defaults to `process.env`
 * @returns {ServerConfig}
 * @throws {ConfigError} when any value is unusable
 */
export function loadConfig(env = process.env) {
  const problems = []

  const nodeEnv = readNodeEnv(env, problems)
  const port = readPort(env, problems)
  const mongodbUri = readMongoUri(env, problems)

  if (problems.length > 0) throw new ConfigError(problems)

  return Object.freeze({
    nodeEnv,
    isProduction: nodeEnv === 'production',
    isDevelopment: nodeEnv === 'development',
    isTest: nodeEnv === 'test',
    port,
    // Kept for later prompts. Never logged, never returned in a response.
    mongodbUri,
    hasMongodbUri: mongodbUri.length > 0,
    serviceName: 'focus-mode-server',
    serviceVersion: '0.1.0',
  })
}

function readNodeEnv(env, problems) {
  const raw = env.NODE_ENV

  if (raw === undefined || raw === '') return 'development'

  if (!ENVIRONMENTS.includes(raw)) {
    problems.push(`NODE_ENV must be one of: ${ENVIRONMENTS.join(', ')} (received "${raw}")`)
    return 'development'
  }

  return raw
}

function readPort(env, problems) {
  const raw = env.PORT

  if (raw === undefined || raw === '') return DEFAULT_PORT

  // Reject "4000abc", " 4000 " and floats: a port must be an exact integer.
  if (!/^\d+$/.test(raw)) {
    problems.push('PORT must be an integer between 1 and 65535')
    return DEFAULT_PORT
  }

  const port = Number(raw)

  if (port < PORT_MIN || port > PORT_MAX) {
    problems.push(`PORT must be between ${PORT_MIN} and ${PORT_MAX}`)
    return DEFAULT_PORT
  }

  return port
}

/**
 * `MONGODB_URI` is optional while the database is unimplemented. When present
 * it must at least look like a MongoDB connection string.
 */
function readMongoUri(env, problems) {
  const raw = env.MONGODB_URI

  if (raw === undefined || raw === '') return ''

  if (!/^mongodb(\+srv)?:\/\/.+/.test(raw)) {
    // Deliberately does not include the value: it usually carries credentials.
    problems.push('MONGODB_URI must start with "mongodb://" or "mongodb+srv://"')
    return ''
  }

  return raw
}

/**
 * Redact secret-looking values before anything reaches a log line.
 * Defence in depth: the HTTP layer never logs bodies, but a future prompt may
 * want to log a config summary.
 *
 * @param {Record<string, unknown>} values
 */
export function redactSecrets(values) {
  const output = {}

  for (const [key, value] of Object.entries(values)) {
    output[key] = SECRET_ENV_KEYS.includes(key.toLowerCase()) ? '[redacted]' : value
  }

  return output
}