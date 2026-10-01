/**
 * Agent connection status contract.
 *
 * Mirrors the agent state shape from SPEC.md §5.1 (`state.result` /
 * `state.push`) so the WebSocket layer can be dropped in later WITHOUT
 * rewriting any component that consumes this type.
 *
 * This module contains NO connection logic. Today `readAgentStatus()` returns
 * a fixed "unavailable" snapshot; Prompt 010 replaces the implementation with
 * the real `getState` subscription and keeps the same exported shape.
 *
 * Note on honesty (SPEC.md §7 principle 22): `UNAVAILABLE` is a real,
 * first-class status. The UI must never imply the agent is connected until the
 * agent itself says so.
 */

/** @typedef {'IDLE'|'PAIRING'|'READY'|'ENTERING'|'ACTIVE'|'EXITING'|'FAILED'|'UNAVAILABLE'} AgentConnectionStatus */

/**
 * @typedef {object} AgentStatus
 * @property {AgentConnectionStatus} status
 * @property {string|null} agentId      Stable agent identity, once known.
 * @property {string|null} label        User-facing device label, e.g. "Work laptop".
 * @property {string|null} platform     'win32' | 'darwin' | 'linux' | null
 * @property {string|null} agentVersion
 * @property {boolean} paired           Pairing is required before any command.
 * @property {boolean} sessionActive    Agent reports an enforced focus session.
 * @property {Date|null} lastSeenAt
 */

const STATUS_TEXT = {
  IDLE: 'Agent idle',
  PAIRING: 'Pairing in progress',
  READY: 'Agent ready',
  ENTERING: 'Entering focus mode',
  ACTIVE: 'Focus mode active',
  EXITING: 'Restoring your system',
  FAILED: 'Agent reported a problem',
  UNAVAILABLE: 'Agent not connected',
}

const STATUS_HINT = {
  IDLE: 'The local agent is running and waiting for a command.',
  PAIRING: 'Waiting for the agent to confirm the pairing code.',
  READY: 'Paired and idle. Starting a focus session only takes effect locally.',
  ENTERING: 'The agent is asking the operating system to apply the allow-list.',
  ACTIVE: 'The agent is enforcing the allow-list on this machine.',
  EXITING: 'Blocked applications are being restored. This always finishes.',
  FAILED: 'The last command failed. Nothing was left half-applied.',
  UNAVAILABLE: 'Start the Focus Mode agent to control your machine from here.',
}

const ACTIVE_STATUSES = ['ENTERING', 'ACTIVE', 'EXITING']

/**
 * Current status of the local agent. Placeholder implementation on purpose.
 * @returns {AgentStatus}
 */
export function readAgentStatus() {
  return {
    status: 'UNAVAILABLE',
    agentId: null,
    label: null,
    platform: null,
    agentVersion: null,
    paired: false,
    sessionActive: false,
    lastSeenAt: null,
  }
}

/** @param {AgentConnectionStatus} status */
export function describeAgentStatus(status) {
  return {
    text: STATUS_TEXT[status] ?? STATUS_TEXT.UNAVAILABLE,
    hint: STATUS_HINT[status] ?? STATUS_HINT.UNAVAILABLE,
  }
}

/** A focus session is running or being applied. Drives teal accents. */
export function isFocusActive(status) {
  return ACTIVE_STATUSES.includes(status)
}

/**
 * SPEC.md §7 principle 22: the dashboard may only claim focus mode is on when
 * the agent has confirmed it.
 */
export function canStartFocus(status) {
  return status === 'READY' || status === 'IDLE'
}

/** Exit must always be reachable (SPEC.md §7 principle 12). */
export function canEndFocus(status) {
  return isFocusActive(status)
}