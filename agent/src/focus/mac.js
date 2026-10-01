/**
 * src/focus/mac.js
 *
 * macOS FocusController — real AppleScript-based implementation.
 *
 * REQUIRED macOS PERMISSION:
 *   System Settings → Privacy & Security → Automation
 *   → Allow "Electron" to control "System Events"
 *
 * This module:
 * - Queries visible applications via System Events AppleScript
 * - Hides non-allowed, non-protected apps using System Events
 * - Activates / brings the allowed browser to front
 * - Restores ONLY the apps this session hid
 * - Never kills or relaunches any process
 */

const { execFile } = require("child_process");
const { promisify } = require("util");
const { buildEffectiveAllowList, findAllowedBrowser } = require("../allowlist");

const execFileAsync = promisify(execFile);
let lastHiddenApps = [];
let strictTimer = null;
let strictBusy = false;

/**
 * Run an AppleScript string via osascript.
 * Returns stdout string on success, throws on failure.
 */
async function runAppleScript(script) {
  const { stdout } = await execFileAsync("osascript", ["-e", script], {
    timeout: 10000,
  });
  return stdout.trim();
}

/**
 * Get the names of all currently visible (not hidden) application processes.
 * Returns an array of strings.
 */
async function getVisibleApps() {
  try {
    const result = await runAppleScript(
      'tell application "System Events" to get name of every application process whose visible is true and background only is false'
    );
    if (!result) return [];
    return result.split(", ").map((s) => s.trim()).filter(Boolean);
  } catch (err) {
    const permissionError = new Error(
      "Focus Mode needs macOS Automation/Accessibility permission to inspect visible applications. " +
      "Enable Focus Mode Agent in System Settings > Privacy & Security > Accessibility and Automation."
    );
    permissionError.code = "MACOS_PERMISSION_REQUIRED";
    throw permissionError;
  }
}

/**
 * Hide a single application by name using System Events.
 * Returns true if successful, false otherwise.
 */
async function hideApp(appName) {
  try {
    await runAppleScript(
      `tell application "System Events" to set visible of process "${appName.replace(/"/g, '\\"')}" to false`
    );
    return true;
  } catch (err) {
    console.error(`[mac.js] Failed to hide "${appName}":`, err.message || err);
    return false;
  }
}

/**
 * Show (unhide) a single application by name using System Events.
 * Returns true if successful, false otherwise.
 */
async function showApp(appName) {
  try {
    await runAppleScript(
      `tell application "System Events" to set visible of process "${appName.replace(/"/g, '\\"')}" to true`
    );
    return true;
  } catch (err) {
    console.error(`[mac.js] Failed to show "${appName}":`, err.message || err);
    return false;
  }
}

/**
 * Activate a browser by name — bring to front.
 * Uses the application's own 'activate' command where available,
 * falling back to System Events visibility toggle.
 *
 * Browser-specific notes:
 *  - Google Chrome:  supports 'activate' and AppleScript 'set bounds'
 *  - Safari:         supports 'activate'
 *  - Firefox:        supports 'activate' (no window manipulation via AS)
 *  - Arc:            supports 'activate'
 *  - Others:         activate via System Events
 *
 * True native full-screen is NOT set here because triggering it
 * programmatically in Chrome/Firefox can cause unreliable behavior.
 * Instead we activate the app and zoom the front window where supported.
 */
async function activateBrowser(browserName, { strict = false } = {}) {
  // First, ensure the browser is visible
  await showApp(browserName);

  // Activate (bring to front) using the app's own AppleScript suite
  try {
    await runAppleScript(`tell application "${browserName.replace(/"/g, '\\"')}" to activate`);
  } catch (err) {
    // Fallback: activate via System Events if the app doesn't have a direct suite
    try {
      await runAppleScript(
        `tell application "System Events" to tell process "${browserName.replace(/"/g, '\\"')}" to set frontmost to true`
      );
    } catch (e2) {
      console.error(`[mac.js] activateBrowser fallback failed for "${browserName}":`, e2.message || e2);
    }
  }

  // Attempt to zoom / maximize the front window (best-effort, Chrome/Safari only)
  try {
    const zoomScript = `
      tell application "${browserName.replace(/"/g, '\\"')}"
        if (count windows) > 0 then
          set zoomed of front window to true
        end if
      end tell`;
    await runAppleScript(zoomScript);
  } catch (err) {
    // Not all browsers support 'zoomed' property — silently ignore
  }

  // Strict mode requests native full-screen through Accessibility. macOS may
  // reject this for a specific browser/window; zooming above remains the safe
  // fallback and the session itself continues.
  if (strict) {
    try {
      await runAppleScript(`
        tell application "System Events"
          tell process "${browserName.replace(/"/g, '\\"')}"
            if (count of windows) > 0 then
              set value of attribute "AXFullScreen" of window 1 to true
            end if
          end tell
        end tell`);
    } catch (err) {
      console.warn(`[mac.js] Native full-screen unavailable for "${browserName}":`, err.message || err);
    }
  }
}

function stopStrictEnforcement() {
  if (strictTimer) clearInterval(strictTimer);
  strictTimer = null;
  strictBusy = false;
}

function startStrictEnforcement({ effectiveAllowList, browserName, onAppHidden }) {
  stopStrictEnforcement();
  const enforce = async () => {
    if (strictBusy) return;
    strictBusy = true;
    try {
      const visibleApps = await getVisibleApps();
      for (const appName of visibleApps) {
        const allowed = effectiveAllowList.some((item) => item.toLowerCase() === appName.toLowerCase());
        if (allowed) continue;
        if (await hideApp(appName)) {
          if (!lastHiddenApps.some((item) => item.toLowerCase() === appName.toLowerCase())) {
            lastHiddenApps.push(appName);
            onAppHidden?.(appName);
          }
        }
      }
      if (browserName && visibleApps.some((app) => app.toLowerCase() === browserName.toLowerCase())) {
        await activateBrowser(browserName, { strict: true });
      }
    } catch (err) {
      // A transient Accessibility failure must not crash or trap the user.
      console.warn("[mac.js] Strict enforcement paused:", err.message || err);
    } finally {
      strictBusy = false;
    }
  };
  strictTimer = setInterval(enforce, 1000);
  if (typeof strictTimer.unref === "function") strictTimer.unref();
}

/**
 * enterFocus — hide non-allowed visible apps and activate browser.
 *
 * @param {Object} options
 * @param {string[]} options.userAllowList - App names the user wants to keep
 * @returns {{ hiddenApps: string[] }}
 */
async function enterFocus({ userAllowList = [], strict = false, onAppHidden } = {}) {
  const effectiveAllowList = buildEffectiveAllowList(userAllowList);
  const visibleApps = await getVisibleApps();

  const hiddenApps = [];

  for (const appName of visibleApps) {
    const isAllowed = effectiveAllowList.some(
      (allowed) => allowed.toLowerCase() === appName.toLowerCase()
    );

    if (isAllowed) continue; // Skip protected / allowed apps

    const success = await hideApp(appName);
    if (success) {
      hiddenApps.push(appName);
    }
  }

  // Activate the browser if one is in the allow-list and running
  const allowedBrowser = findAllowedBrowser(userAllowList);
  if (allowedBrowser) {
    const browserRunning = visibleApps.some(
      (app) => app.toLowerCase() === allowedBrowser.toLowerCase()
    );
    if (browserRunning) {
      try {
        await activateBrowser(allowedBrowser, { strict });
      } catch (err) {
        console.error(`[mac.js] Failed to activate browser "${allowedBrowser}":`, err.message || err);
      }
    }
    // If browser is not running, we do NOT launch it — per requirements
  }

  lastHiddenApps = [...hiddenApps];
  if (strict) {
    startStrictEnforcement({
      effectiveAllowList,
      browserName: allowedBrowser,
      onAppHidden
    });
  }
  return { hiddenApps };
}

/**
 * exitFocus — restore only the apps this Focus session hid.
 *
 * @param {Object} options
 * @param {string[]} options.hiddenApps - Exact list of apps this session hid
 * @returns {{ restoredApps: string[] }}
 */
async function exitFocus({ hiddenApps = [] } = {}) {
  stopStrictEnforcement();
  const restoredApps = [];

  for (const appName of hiddenApps) {
    const success = await showApp(appName);
    if (success) {
      restoredApps.push(appName);
    }
    // On individual failure: log already printed inside showApp, continue with others
  }

  lastHiddenApps = [];
  return { restoredApps };
}

async function getState() {
  return { hiddenApps: [...lastHiddenApps] };
}

module.exports = { enterFocus, exitFocus, getState };
