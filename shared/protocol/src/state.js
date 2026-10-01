/**
 * Agent and focus-session state constants.
 *
 * Pure vocabulary: this module describes the state NAMES only. It deliberately
 * contains no transition table, no timers and no session logic — the state
 * machine is the agent's job (Prompts 018 and 021).
 *
 * Two vocabularies exist on purpose:
 *
 *  - `AGENT_STATES` is the local agent's own state machine, reported by
 *    `getState()`. Upper case because it is an in-process state.
 *  - `FOCUS_SESSION_STATES` is what the cloud API persists per session row
 *    (SPEC.md §6.4 `focusSessions.state`). Lower case because it is a record
 *    field, and because a session outlives the agent process.
 */

/** Local agent states. Reported in `state.result` / `state.push` as `session.state`. */
export const AGENT_STATES = Object.freeze({
  /** Running, not paired yet. */
  IDLE: 'IDLE',
  /** A pairing request is in flight (short-lived 6-digit code). */
  PAIRING: 'PAIRING',
  /** Paired and ready to accept commands. */
  READY: 'READY',
  /** `focus.enter` accepted, OS adapter applying the allow-list. */
  ENTERING: 'ENTERING',
  /** Enforcement confirmed by the OS adapter. */
  ACTIVE: 'ACTIVE',
  /** A bounded extension is being applied. */
  EXTENDING: 'EXTENDING',
  /** Restoration in progress. Always finishes. */
  EXITING: 'EXITING',
  /** Last command failed. Nothing left half-applied. */
  FAILED: 'FAILED',
})

export const AGENT_STATE_LIST = Object.freeze(Object.values(AGENT_STATES))

/**
 * Cloud-side focus session states (SPEC.md §6.4). Persisted by the server,
 * written from agent-reported transitions.
 */
export const FOCUS_SESSION_STATES = Object.freeze({
  /** Created and authorised; the agent has not confirmed enforcement yet. */
  REQUESTED: 'requested',
  /** Agent confirmed enforcement. */
  ACTIVE: 'active',
  /** Restoration started. */
  EXITING: 'exiting',
  /** Restored, ended deliberately by the user or by the planned end time. */
  EXITED: 'exited',
  /** Failed before or during enforcement; rolled back. */
  FAILED: 'failed',
  /** Ended without a user action: watchdog, disconnect, crash recovery. */
  AUTO_EXITED: 'auto_exited',
})

export const FOCUS_SESSION_STATE_LIST = Object.freeze(Object.values(FOCUS_SESSION_STATES))

/**
 * Why a session ended. Mirrors SPEC.md §6.4 `exitReason` and §7 principles
 * 15–18. `auto_*` values are the fail-safe paths and must never be described to
 * the user as a normal exit.
 */
export const EXIT_REASONS = Object.freeze({
  USER: 'USER',
  TIMEOUT: 'TIMEOUT',
  WATCHDOG: 'WATCHDOG',
  CRASH_RECOVERY: 'CRASH_RECOVERY',
  AGENT_QUIT: 'AGENT_QUIT',
  ERROR: 'ERROR',
})

export const EXIT_REASON_LIST = Object.freeze(Object.values(EXIT_REASONS))

/** Exit reasons produced by the system, not by the user. */
export const AUTO_EXIT_REASONS = Object.freeze([
  EXIT_REASONS.TIMEOUT,
  EXIT_REASONS.WATCHDOG,
  EXIT_REASONS.CRASH_RECOVERY,
  EXIT_REASONS.AGENT_QUIT,
])

/**
 * Client-only link status.
 *
 * Not an agent state: `UNAVAILABLE` means no agent has answered yet, which is a
 * fact about the browser's connection, not about the agent. Keeping it separate
 * prevents the UI from claiming a healthy machine when nothing has been
 * confirmed (SPEC.md §7 principle 22). The client already models this as part
 * of its `AgentConnectionStatus`.
 */
export const LINK_STATES = Object.freeze({
  UNAVAILABLE: 'UNAVAILABLE',
})

export const LINK_STATE_LIST = Object.freeze(Object.values(LINK_STATES))

/** Agent states in which the OS adapter is actively enforcing. */
export const ENFORCING_AGENT_STATES = Object.freeze([
  AGENT_STATES.ENTERING,
  AGENT_STATES.ACTIVE,
  AGENT_STATES.EXTENDING,
  AGENT_STATES.EXITING,
])

/** @param {string} value */
export function isAgentState(value) {
  return AGENT_STATE_LIST.includes(value)
}

/** @param {string} value */
export function isFocusSessionState(value) {
  return FOCUS_SESSION_STATE_LIST.includes(value)
}

/** @param {string} value */
export function isExitReason(value) {
  return EXIT_REASON_LIST.includes(value)
}

/**
 * True when enforcement is in progress or applied.
 *
 * The client must only claim "focus mode is on" for `ACTIVE` (principle 22);
 * use `isAgentState(value) && value === AGENT_STATES.ACTIVE` for that narrower
 * question. This wider helper exists for "a session is open, keep End
 * reachable" (principle 12).
 */
export function isEnforcing(value) {
  return ENFORCING_AGENT_STATES.includes(value)
}

/** True when the end was caused by the fail-safe, not by the user. */
export function isAutoExit(reason) {
  return AUTO_EXIT_REASONS.includes(reason)
}

/** Terminal agent states: no further command without a reset. */
export function isTerminalAgentState(value) {
  return value === AGENT_STATES.FAILED
}