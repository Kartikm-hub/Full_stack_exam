/**
 * src/focus/stub.js
 *
 * Safe no-op FocusController for automated tests and unsupported platforms.
 * Does not hide, show, or touch any application.
 */

async function enterFocus({ allowList = [], userAllowList = [] } = {}) {
  // Stub: records nothing, hides nothing
  return { hiddenApps: [] };
}

async function exitFocus({ hiddenApps = [] } = {}) {
  // Stub: restores nothing
  return { restoredApps: [] };
}

async function getState() {
  return { hiddenApps: [] };
}

module.exports = { enterFocus, exitFocus, getState };
