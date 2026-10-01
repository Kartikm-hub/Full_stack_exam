/**
 * Agent connection status contract.
 *
 * Stable UI contract for state reported by the local agent connection.
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
  IDLE: 'Connected, not paired',
  PAIRING: 'Pairing in progress',
  READY: 'Connected',
  ENTERING: 'Starting focus',
  ACTIVE: 'Focusing',
  EXITING: 'Ending focus',
  FAILED: 'Agent reported a problem',
  UNAVAILABLE: 'Disconnected',
}

const STATUS_HINT = {
  IDLE: 'The local agent is connected but has not paired with this account.',
  PAIRING: 'Waiting for the agent to confirm the pairing code.',
  READY: 'The local agent is paired and connected.',
  ENTERING: 'The agent is asking the operating system to apply the allow-list.',
  ACTIVE: 'The agent reports that focus is active on this machine.',
  EXITING: 'Blocked applications are being restored. This always finishes.',
  FAILED: 'The last command failed. Nothing was left half-applied.',
  UNAVAILABLE: 'Start the Focus Mode agent to control your machine from here.',
}

const ACTIVE_STATUSES = ['ENTERING', 'ACTIVE', 'EXITING']

/**
 * Default state before a live agent connection is established.
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