/**
 * src/state.js
 *
 * Single source of truth for agent runtime state.
 * Owns the focus timer, persistent state file, and FocusController lifecycle.
 *
 * All paths that end/start focus go through this module:
 *   - WebSocket enterFocus / exitFocus
 *   - Tray "End Focus" button
 *   - Renderer "End Focus" button
 *   - Internal timer expiry
 *   - Sleep/wake checkTimerOnResume
 *   - Crash recovery on startup
 */

const fs = require("fs");
const path = require("path");
const pairingManager = require("./pairing");
const FocusController = require("./focus/FocusController");

let userDataDir = null;
let status = "IDLE";
let endsAt = null;
let allowList = [];
let focusSession = null;
let hiddenApps = [];
let strictMode = false;
let focusTimer = null;
let timerExpired = false;

const listeners = new Set();
const focusEndedListeners = new Set();

// ─────────────────────────────────────────────
// Persistence helpers
// ─────────────────────────────────────────────

function getDefaultUserDataPath() {
  try {
    const { app } = require("electron");
    if (app && typeof app.getPath === "function") {
      return app.getPath("userData");
    }
  } catch (err) {
    // Electron unavailable (standalone Node test)
  }
  return path.join(__dirname, "..", "data");
}

function getStateStoragePath() {
  const dir = userDataDir || getDefaultUserDataPath();
  if (!fs.existsSync(dir)) {
    try { fs.mkdirSync(dir, { recursive: true }); } catch (e) {}
  }
  return path.join(dir, "state.json");
}

function safeSaveState(stateData) {
  const filePath = getStateStoragePath();
  const tmpPath = `${filePath}.tmp`;
  const json = JSON.stringify(stateData, null, 2);
  try {
    fs.writeFileSync(tmpPath, json, "utf-8");
    fs.renameSync(tmpPath, filePath);
  } catch (err) {
    try { fs.writeFileSync(filePath, json, "utf-8"); } catch (e) {}
  }
}

// ─────────────────────────────────────────────
// Event notification
// ─────────────────────────────────────────────

function notifyListeners(expired = false) {
  const currentState = getFullState();
  for (const listener of listeners) {
    try { listener(currentState, expired); } catch (e) {}
  }
  if (expired) {
    for (const listener of focusEndedListeners) {
      try { listener(currentState); } catch (e) {}
    }
  }
}

pairingManager.onPairingChange(() => { notifyListeners(); });

// ─────────────────────────────────────────────
// Timer
// ─────────────────────────────────────────────

function clearFocusTimer() {
  if (focusTimer) { clearTimeout(focusTimer); focusTimer = null; }
}

function startFocusTimer(delayMs) {
  clearFocusTimer();
  focusTimer = setTimeout(() => {
    timerExpired = true;
    endFocus();
    timerExpired = false;
  }, Math.max(0, delayMs));
  if (typeof focusTimer.unref === "function") focusTimer.unref();
}

// ─────────────────────────────────────────────
// Startup / recovery
// ─────────────────────────────────────────────

async function loadAndRecoverState() {
  const filePath = getStateStoragePath();
  if (fs.existsSync(filePath)) {
    let savedState;
    try {
      savedState = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    } catch (e) { savedState = null; }

    if (savedState && savedState.status === "FOCUSING") {
      // FAIL SAFE: restore hidden apps, then go IDLE
      const savedHiddenApps = Array.isArray(savedState.hiddenApps) ? savedState.hiddenApps : [];
      console.log(`[state] Crash recovery: restoring ${savedHiddenApps.length} app(s) from persisted hiddenApps`);
      try {
        await FocusController.exitFocus({ hiddenApps: savedHiddenApps });
      } catch (err) {
        console.error("[state] Crash recovery FocusController.exitFocus error:", err.message || err);
      }

      status = "IDLE";
      endsAt = null;
      focusSession = null;
      hiddenApps = [];
      strictMode = false;
      allowList = Array.isArray(savedState.allowList) ? savedState.allowList : [];

      safeSaveState({
        status: "IDLE", endsAt: null, allowList, focusSession: null, hiddenApps: [],
        recoveredAt: new Date().toISOString(),
        recoveryNote: "Recovered from interrupted FOCUSING session on startup."
      });
      return;
    }

    if (savedState) {
      status = savedState.status || "IDLE";
      endsAt = savedState.endsAt || null;
      allowList = Array.isArray(savedState.allowList) ? savedState.allowList : [];
      focusSession = savedState.focusSession || null;
      hiddenApps = Array.isArray(savedState.hiddenApps) ? savedState.hiddenApps : [];
      return;
    }
  }

  // Default
  status = "IDLE"; endsAt = null; allowList = []; focusSession = null; hiddenApps = []; strictMode = false;
  safeSaveState({ status, endsAt, allowList, focusSession, hiddenApps });
}

/**
 * Initialize state. Must be called once on app startup.
 * Re-calling (e.g. in tests) fully resets module-level state.
 */
async function initState(customUserDataDir) {
  clearFocusTimer();
  status = "IDLE"; endsAt = null; allowList = []; focusSession = null; hiddenApps = []; strictMode = false; timerExpired = false;

  userDataDir = customUserDataDir || getDefaultUserDataPath();
  await loadAndRecoverState();
}

// ─────────────────────────────────────────────
// Public state accessors
// ─────────────────────────────────────────────

function getStatus() { return status; }
function getAllowList() { return allowList; }
function getEndsAt() { return endsAt; }
function getHiddenApps() { return hiddenApps; }

function getFullState() {
  const pairingState = pairingManager.getPairingState();
  return {
    status,
    endsAt,
    pairingCode: pairingState.pairingCode,
    isPaired: pairingState.isPaired,
    allowList,
    focusSession,
    hiddenApps,
    strictMode
  };
}

// ─────────────────────────────────────────────
// Focus lifecycle
// ─────────────────────────────────────────────

/**
 * Start a focus session.
 * Calls FocusController.enterFocus → records hiddenApps → starts timer.
 */
async function startFocus({ duration = 25, allowList: requestedAllowList = [], durationMs = null, strict = false } = {}) {
  if (status === "FOCUSING") {
    const err = new Error("Focus session already active");
    err.code = "SESSION_ACTIVE";
    throw err;
  }

  let delayMs, clampedDurationMinutes;
  if (durationMs !== null && typeof durationMs === "number" && durationMs > 0) {
    delayMs = durationMs;
    clampedDurationMinutes = Math.max(1, Math.ceil(durationMs / 60000));
  } else {
    clampedDurationMinutes = Math.min(480, Math.max(1, Math.floor(Number(duration) || 25)));
    delayMs = clampedDurationMinutes * 60 * 1000;
  }

  const now = Date.now();
  const normalizedAllowList = Array.isArray(requestedAllowList) ? [...requestedAllowList] : [];

  // Call OS integration
  let newHiddenApps = [];
  try {
    const result = await FocusController.enterFocus({
      userAllowList: normalizedAllowList,
      strict: Boolean(strict),
      onAppHidden: (appName) => {
        if (status !== "FOCUSING" || hiddenApps.some((app) => app.toLowerCase() === appName.toLowerCase())) return;
        hiddenApps = [...hiddenApps, appName];
        safeSaveState({ status, endsAt, allowList, focusSession, hiddenApps, strictMode });
        notifyListeners();
      }
    });
    newHiddenApps = Array.isArray(result.hiddenApps) ? result.hiddenApps : [];
  } catch (err) {
    const focusError = new Error(err.message || "Unable to start Focus Mode");
    focusError.code = err.code || "FOCUS_CONTROLLER_ERROR";
    throw focusError;
  }

  status = "FOCUSING";
  endsAt = now + delayMs;
  allowList = normalizedAllowList;
  hiddenApps = newHiddenApps;
  strictMode = Boolean(strict);

  focusSession = {
    duration: clampedDurationMinutes,
    startTime: now,
    endsAt,
    allowList: [...normalizedAllowList],
    strict: strictMode
  };

  safeSaveState({ status, endsAt, allowList, focusSession, hiddenApps, strictMode });
  startFocusTimer(delayMs);
  notifyListeners();

  return getFullState();
}

/**
 * End the current focus session.
 * Calls FocusController.exitFocus with persisted hiddenApps → clears state.
 */
async function endFocus() {
  const wasTimerExpiry = timerExpired;
  clearFocusTimer();

  const appsToRestore = [...hiddenApps];

  // Restore hidden apps
  try {
    await FocusController.exitFocus({ hiddenApps: appsToRestore });
  } catch (err) {
    console.error("[state] FocusController.exitFocus error:", err.message || err);
  }

  status = "IDLE";
  endsAt = null;
  focusSession = null;
  hiddenApps = [];
  strictMode = false;

  safeSaveState({ status, endsAt: null, allowList, focusSession: null, hiddenApps: [], strictMode: false });
  notifyListeners(wasTimerExpiry);

  return getFullState();
}

/**
 * Called after sleep/wake. Re-checks endsAt and resumes or ends focus.
 */
async function checkTimerOnResume() {
  if (status === "FOCUSING" && endsAt) {
    const remainingMs = endsAt - Date.now();
    if (remainingMs <= 0) {
      await endFocus();
    } else {
      startFocusTimer(remainingMs);
    }
  }
}

// ─────────────────────────────────────────────
// Subscriptions
// ─────────────────────────────────────────────

function onStateChange(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function onFocusEnded(listener) {
  focusEndedListeners.add(listener);
  return () => focusEndedListeners.delete(listener);
}

/** Test seam: automated tests inject a controller and never invoke macOS. */

// ─────────────────────────────────────────────
// Auto-initialize (synchronous bootstrap)
// ─────────────────────────────────────────────

// Note: initState is now async. The auto-call here is fire-and-forget for
// standalone requires (tests call initState manually with await).
initState();

module.exports = {
  initState,
  getStatus,
  getAllowList,
  getEndsAt,
  getHiddenApps,
  getFullState,
  startFocus,
  endFocus,
  clearFocusTimer,
  checkTimerOnResume,
  onStateChange,
  onFocusEnded,
  getStateStoragePath
};
