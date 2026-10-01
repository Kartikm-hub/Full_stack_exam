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

import { AGENT_STATES, LINK_STATES, isEnforcing } from '@protocol/state'

/**
 * Connection status the dashboard can display.
 *
 * The agent half is owned by the shared protocol (`AGENT_STATES`); the extra
 * `UNAVAILABLE` member is the client-only link state (`LINK_STATES`), meaning
 * no agent has answered yet. Keeping them separate stops the UI from implying
 * a healthy machine when nothing has been confirmed (SPEC.md §7 principle 22).
 *
 * @typedef {'IDLE'|'PAIRING'|'READY'|'ENTERING'|'ACTIVE'|'EXTENDING'|'EXITING'|'FAILED'|'UNAVAILABLE'} AgentConnectionStatus
 */

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

/**
 * Display copy keyed by the shared vocabulary. Keys are protocol constants, so
 * a state added in `shared/protocol/src/state.js` fails loudly here rather than
 * silently rendering "Agent not connected".
 */
const STATUS_TEXT = {
  [AGENT_STATES.IDLE]: 'Agent idle',
  [AGENT_STATES.PAIRING]: 'Pairing in progress',
  [AGENT_STATES.READY]: 'Agent ready',
  [AGENT_STATES.ENTERING]: 'Entering focus mode',
  [AGENT_STATES.ACTIVE]: 'Focus mode active',
  [AGENT_STATES.EXTENDING]: 'Extending focus mode',
  [AGENT_STATES.EXITING]: 'Restoring your system',
  [AGENT_STATES.FAILED]: 'Agent reported a problem',
  [LINK_STATES.UNAVAILABLE]: 'Agent not connected',
}

const STATUS_HINT = {
  [AGENT_STATES.IDLE]: 'The local agent is running and waiting for a command.',
  [AGENT_STATES.PAIRING]: 'Waiting for the agent to confirm the pairing code.',
  [AGENT_STATES.READY]: 'Paired and idle. Starting a focus session only takes effect locally.',
  [AGENT_STATES.ENTERING]: 'The agent is asking the operating system to apply the allow-list.',
  [AGENT_STATES.ACTIVE]: 'The agent is enforcing the allow-list on this machine.',
  [AGENT_STATES.EXTENDING]: 'A longer session is being applied. The end time moves, it never disappears.',
  [AGENT_STATES.EXITING]: 'Blocked applications are being restored. This always finishes.',
  [AGENT_STATES.FAILED]: 'The last command failed. Nothing was left half-applied.',
  [LINK_STATES.UNAVAILABLE]: 'Start the Focus Mode agent to control your machine from here.',
}

/**
 * Current status of the local agent. Placeholder implementation on purpose.
 * @returns {AgentStatus}
 */
export function readAgentStatus() {
  return {
    status: LINK_STATES.UNAVAILABLE,
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
  const known = STATUS_TEXT[status] !== undefined
  const fallback = STATUS_TEXT[LINK_STATES.UNAVAILABLE]

  if (!known) {
    console.warn(`[agentStatus] unknown status "${String(status)}", treating as unavailable`)
  }

  return {
    text: known ? STATUS_TEXT[status] : fallback,
    hint: known ? STATUS_HINT[status] : STATUS_HINT[LINK_STATES.UNAVAILABLE],
  }
}

/**
 * A focus session is running or being applied. Drives teal accents.
 * Delegates to the shared `isEnforcing` so the client and the agent agree on
 * which states count as "a session is open".
 */
export function isFocusActive(status) {
  return isEnforcing(status)
}

/**
 * SPEC.md §7 principle 22: the dashboard may only claim focus mode is on when
 * the agent has confirmed it. Narrower than `isFocusActive` on purpose.
 */
export function isFocusConfirmedActive(status) {
  return status === AGENT_STATES.ACTIVE
}

/**
 * SPEC.md §7 principle 22: a session may be requested only from a settled,
 * paired agent. Prompt 012 uses this to gate the Start Focus button.
 */
export function canStartFocus(status) {
  return status === AGENT_STATES.READY || status === AGENT_STATES.IDLE
}

/** Exit must always be reachable (SPEC.md §7 principle 12). */
export function canEndFocus(status) {
  return isFocusActive(status)
}