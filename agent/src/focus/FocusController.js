/**
 * src/focus/FocusController.js
 *
 * Platform-agnostic FocusController.
 *
 * Selects the correct OS implementation:
 *   macOS   → mac.js
 *   Windows → windows.js
 *   other   → stub.js
 *
 * Exported interface:
 *   enterFocus(options) → Promise<{ hiddenApps: string[] }>
 *   exitFocus(options)  → Promise<{ restoredApps: string[] }>
 *   getState()          → Promise<{ hiddenApps: string[] }>
 */

let _impl = null;

function getImpl() {
  if (_impl) return _impl;

  switch (process.platform) {
    // Node-based test runs must remain harmless even on a Mac. The real
    // controller is selected only by the Electron main process.
    case "darwin":
      if (!process.versions.electron) {
        _impl = require("./stub");
        break;
      }
      _impl = require("./mac");
      break;
    case "win32":
      if (!process.versions.electron && !process.env.FORCE_WINDOWS_FOCUS) {
        _impl = require("./stub");
        break;
      }
      _impl = require("./windows");
      break;
    default:
      _impl = require("./stub");
      break;
  }
  return _impl;
}

/**
 * Override the implementation (used in tests to inject the stub).
 */
function setImpl(impl) {
  _impl = impl;
}

/**
 * Enter focus mode.
 * @param {Object} options
 * @param {string[]} options.userAllowList  - App names to keep visible
 * @returns {Promise<{ hiddenApps: string[] }>}
 */
async function enterFocus(options = {}) {
  return getImpl().enterFocus(options);
}

/**
 * Exit focus mode and restore hidden applications.
 * @param {Object} options
 * @param {string[]} options.hiddenApps - Exact list persisted during enterFocus
 * @returns {Promise<{ restoredApps: string[] }>}
 */
async function exitFocus(options = {}) {
  return getImpl().exitFocus(options);
}

/**
 * Get currently visible application names.
 * @returns {Promise<string[]>}
 */
async function getState() {
  return getImpl().getState();
}

module.exports = { enterFocus, exitFocus, getState, setImpl };
