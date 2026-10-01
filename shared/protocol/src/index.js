/**
 * `@focus-mode/protocol` — the single wire contract for Focus Mode.
 *
 * The dashboard (browser), the cloud API (Node/Express) and the Electron agent
 * all import this module so they cannot invent three different message formats.
 *
 * WHAT THIS IS: constants, the envelope, and payload contracts, with strict
 * validation that rejects rather than repairs.
 *
 * WHAT THIS IS NOT: no WebSocket, no pairing logic, no sessions, no timers, no
 * Electron, no OS access, no database. Those belong to later prompts.
 */

export {
  MAX_ID_LENGTH,
  MAX_PAYLOAD_BYTES,
  MESSAGE_ID_PREFIX,
  NO_REPLY,
  PROTOCOL_VERSION,
  SUPPORTED_PROTOCOL_VERSIONS,
  createEnvelope,
  createMessageId,
  createReply,
  createTimestamp,
  isKnownType,
  isSupportedVersion,
  isValidTimestamp,
  validateEnvelope,
  validateMessage,
} from './envelope.js'

export {
  ACKNOWLEDGED_COMMAND_TYPES,
  MESSAGE_DIRECTIONS,
  MESSAGE_TYPE_LIST,
  MESSAGE_TYPES,
  PAYLOAD_CONTRACTS,
  ROLES,
  createStateResultPayload,
  getMessageContract,
  getMessageDirection,
  isKnownErrorCode,
  isKnownMessageType,
  normaliseErrorPayload,
  validatePayload,
} from './messages.js'

export {
  ERROR_CODE_LIST,
  ERROR_CODES,
  ProtocolError,
  createErrorPayload,
  isErrorCode,
  isRetryable,
} from './errors.js'

export {
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
} from './state.js'

/** Package version, kept in step with package.json by hand (one source: here). */
export const PROTOCOL_PACKAGE_VERSION = '0.1.0'