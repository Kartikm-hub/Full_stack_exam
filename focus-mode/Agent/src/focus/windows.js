/**
 * src/focus/windows.js
 *
 * Windows FocusController — native Win32 window management implementation.
 *
 * Architecture:
 * - Spawns a persistent PowerShell worker (windowsWorker.ps1) that uses
 *   user32.dll Win32 APIs (EnumDesktopWindows, ShowWindow, PostMessage, SetForegroundWindow).
 * - Identifies non-allowed visible windows and minimizes them safely.
 * - Activates the allowed browser or application and brings it to front.
 * - Supports strict mode enforcement (polling to prevent new distractions).
 * - Reversibly restores only the applications hidden by this session.
 * - Supports crash recovery restoration by process/application name.
 * - Never terminates, closes, or kills any process.
 */

const path = require("path");
const { spawn } = require("child_process");
const readline = require("readline");
const {
  buildEffectiveAllowList,
  findAllowedBrowser,
  isProtected
} = require("../allowlist");

// Friendly name overrides for common Windows desktop processes
const FRIENDLY_NAMES = {
  "chrome": "Google Chrome",
  "msedge": "Microsoft Edge",
  "firefox": "Firefox",
  "code": "Visual Studio Code",
  "windowsterminal": "Windows Terminal",
  "powershell": "PowerShell",
  "pwsh": "PowerShell",
  "cmd": "Command Prompt",
  "whatsapp": "WhatsApp",
  "whatsapp.root": "WhatsApp",
  "acrobat": "Adobe Acrobat Reader",
  "chatgpt classic": "ChatGPT Classic",
  "chatgpt": "ChatGPT",
  "slack": "Slack",
  "discord": "Discord",
  "spotify": "Spotify",
  "steam": "Steam",
  "notepad": "Notepad",
  "telegram": "Telegram",
  "notion": "Notion",
  "zoom": "Zoom",
  "teams": "Microsoft Teams",
  "devenv": "Visual Studio",
};

let workerProcess = null;
let workerReadline = null;
let isWorkerReady = false;
let readyWaiters = [];
let pendingRequests = new Map();
let requestIdCounter = 0;

let lastHiddenApps = [];
let lastHiddenHwnds = new Set();
let strictTimer = null;
let strictBusy = false;

/**
 * Start or retrieve the persistent PowerShell worker.
 */
function getWorker() {
  if (workerProcess && !workerProcess.killed) {
    return workerProcess;
  }

  isWorkerReady = false;
  pendingRequests.clear();

  const workerScript = path.join(__dirname, "windowsWorker.ps1");
  workerProcess = spawn("powershell.exe", [
    "-NoProfile",
    "-NonInteractive",
    "-ExecutionPolicy",
    "Bypass",
    "-File",
    workerScript
  ], {
    windowsHide: true,
    stdio: ["pipe", "pipe", "pipe"]
  });

  workerReadline = readline.createInterface({ input: workerProcess.stdout });

  workerReadline.on("line", (line) => {
    line = line.trim();
    if (!line) return;

    if (line === "READY") {
      isWorkerReady = true;
      for (const resolve of readyWaiters) {
        resolve();
      }
      readyWaiters = [];
      return;
    }

    try {
      const data = JSON.parse(line);
      if (data && typeof data.id !== "undefined") {
        const deferred = pendingRequests.get(data.id);
        if (deferred) {
          pendingRequests.delete(data.id);
          deferred.resolve(data);
        }
      }
    } catch (e) {
      // Ignore non-JSON worker output
    }
  });

  workerProcess.stderr.on("data", (err) => {
    // Keep stderr non-fatal
    const msg = err.toString().trim();
    if (msg) console.warn("[windowsWorker.ps1]", msg);
  });

  workerProcess.on("close", () => {
    workerProcess = null;
    workerReadline = null;
    isWorkerReady = false;
    // Reject any in-flight requests
    for (const [, deferred] of pendingRequests) {
      deferred.reject(new Error("Windows focus worker terminated unexpectedly"));
    }
    pendingRequests.clear();
  });

  return workerProcess;
}

/**
 * Ensure the worker is ready to receive commands.
 */
function ensureReady() {
  getWorker();
  if (isWorkerReady) return Promise.resolve();

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error("Timeout waiting for Windows focus worker to initialize"));
    }, 10000);

    readyWaiters.push(() => {
      clearTimeout(timer);
      resolve();
    });
  });
}

/**
 * Send a command to the worker and await response.
 */
async function sendCommand(req, timeoutMs = 6000) {
  await ensureReady();
  const id = ++requestIdCounter;
  const payload = { ...req, id };

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pendingRequests.delete(id);
      reject(new Error(`Timeout waiting for Windows focus worker action "${req.action}"`));
    }, timeoutMs);

    pendingRequests.set(id, {
      resolve: (val) => {
        clearTimeout(timer);
        resolve(val);
      },
      reject: (err) => {
        clearTimeout(timer);
        reject(err);
      }
    });

    try {
      workerProcess.stdin.write(JSON.stringify(payload) + "\n");
    } catch (err) {
      pendingRequests.delete(id);
      clearTimeout(timer);
      reject(err);
    }
  });
}

/**
 * Determine human-friendly application name from process name and title.
 */
function getFriendlyName(procName, title) {
  const lower = (procName || "").toLowerCase();
  if (FRIENDLY_NAMES[lower]) {
    return FRIENDLY_NAMES[lower];
  }
  // If title has something like "FileName - ApplicationName", use ApplicationName
  if (title && title.includes(" - ")) {
    const parts = title.split(" - ");
    const candidate = parts[parts.length - 1].trim();
    if (candidate.length > 2 && candidate.length < 30) {
      return candidate;
    }
  }
  // Otherwise capitalize the process name
  if (procName) {
    return procName.charAt(0).toUpperCase() + procName.slice(1);
  }
  return title || "Application";
}

/**
 * Check if a window should remain visible based on allow-list and system protections.
 */
function isWindowAllowed(window, effectiveAllowList) {
  const proc = (window.ProcessName || "").trim().toLowerCase();
  const title = (window.Title || "").trim().toLowerCase();

  // 1. Is it protected by system allow-list?
  if (isProtected(proc) || isProtected(window.ProcessName)) {
    return true;
  }

  // 2. Check against effective allow-list
  for (const item of effectiveAllowList) {
    const norm = item.trim().toLowerCase();
    if (!norm) continue;

    if (proc === norm || title === norm) return true;
    if (proc.includes(norm) || norm.includes(proc)) return true;
    if (title.includes(norm)) return true;

    // Check friendly alias
    if (FRIENDLY_NAMES[proc] && FRIENDLY_NAMES[proc].toLowerCase() === norm) {
      return true;
    }
  }

  return false;
}

/**
 * Stop continuous strict mode enforcement.
 */
function stopStrictEnforcement() {
  if (strictTimer) {
    clearInterval(strictTimer);
    strictTimer = null;
  }
  strictBusy = false;
}

/**
 * Start periodic strict enforcement.
 */
function startStrictEnforcement({ effectiveAllowList, allowedBrowserHwnd, onAppHidden }) {
  stopStrictEnforcement();

  const enforce = async () => {
    if (strictBusy) return;
    strictBusy = true;
    try {
      const res = await sendCommand({ action: "getWindows" });
      const windows = Array.isArray(res?.windows) ? res.windows : [];

      const toMin = [];
      for (const w of windows) {
        if (w.IsMinimized) continue;
        if (isWindowAllowed(w, effectiveAllowList)) continue;

        toMin.push(w.Hwnd);
        const name = getFriendlyName(w.ProcessName, w.Title);
        if (!lastHiddenApps.some((a) => a.toLowerCase() === name.toLowerCase())) {
          lastHiddenApps.push(name);
          onAppHidden?.(name);
        }
        lastHiddenHwnds.add(w.Hwnd);
      }

      if (toMin.length > 0) {
        await sendCommand({ action: "minimize", hwnds: toMin });
      }

      if (allowedBrowserHwnd) {
        await sendCommand({ action: "activate", hwnd: allowedBrowserHwnd });
      }
    } catch (err) {
      console.warn("[windows.js] Strict enforcement check warning:", err.message || err);
    } finally {
      strictBusy = false;
    }
  };

  strictTimer = setInterval(enforce, 1500);
  if (typeof strictTimer.unref === "function") strictTimer.unref();
}

/**
 * Enter Focus Mode on Windows.
 *
 * @param {Object} options
 * @param {string[]} options.userAllowList - List of user-permitted application names
 * @param {boolean} options.strict - Continuous distraction prevention
 * @param {Function} options.onAppHidden - Callback when a new app is hidden
 * @returns {Promise<{ hiddenApps: string[] }>}
 */
async function enterFocus({ userAllowList = [], strict = false, onAppHidden } = {}) {
  const effectiveAllowList = buildEffectiveAllowList(userAllowList);

  let windows = [];
  try {
    const res = await sendCommand({ action: "getWindows" });
    windows = Array.isArray(res?.windows) ? res.windows : [];
  } catch (err) {
    console.error("[windows.js] Failed to query open windows:", err.message || err);
    return { hiddenApps: [] };
  }

  const hwndsToMinimize = [];
  const hiddenApps = [];
  let allowedBrowserHwnd = null;

  const allowedBrowser = findAllowedBrowser(userAllowList);

  for (const w of windows) {
    const allowed = isWindowAllowed(w, effectiveAllowList);

    if (allowed) {
      // Check if this window belongs to the allowed browser
      if (allowedBrowser) {
        const proc = (w.ProcessName || "").toLowerCase();
        const normBrowser = allowedBrowser.toLowerCase();
        if (proc.includes("chrome") && normBrowser.includes("chrome")) {
          allowedBrowserHwnd = w.Hwnd;
        } else if (proc.includes("edge") && normBrowser.includes("edge")) {
          allowedBrowserHwnd = w.Hwnd;
        } else if (proc.includes("firefox") && normBrowser.includes("firefox")) {
          allowedBrowserHwnd = w.Hwnd;
        }
      }
      continue;
    }

    // Non-allowed window: if not already minimized, step it aside
    if (!w.IsMinimized) {
      hwndsToMinimize.push(w.Hwnd);
      const friendlyName = getFriendlyName(w.ProcessName, w.Title);
      if (!hiddenApps.some((a) => a.toLowerCase() === friendlyName.toLowerCase())) {
        hiddenApps.push(friendlyName);
      }
      lastHiddenHwnds.add(w.Hwnd);
    }
  }

  // Minimize non-allowed windows
  if (hwndsToMinimize.length > 0) {
    try {
      await sendCommand({ action: "minimize", hwnds: hwndsToMinimize });
    } catch (err) {
      console.error("[windows.js] Failed to minimize non-allowed windows:", err.message || err);
    }
  }

  // Bring allowed browser / app to front
  if (allowedBrowserHwnd) {
    try {
      await sendCommand({ action: "activate", hwnd: allowedBrowserHwnd });
    } catch (err) {
      console.warn("[windows.js] Could not activate browser window:", err.message || err);
    }
  }

  lastHiddenApps = [...hiddenApps];

  if (strict) {
    startStrictEnforcement({
      effectiveAllowList,
      allowedBrowserHwnd,
      onAppHidden
    });
  }

  return { hiddenApps };
}

/**
 * Exit Focus Mode on Windows and restore applications.
 *
 * @param {Object} options
 * @param {string[]} options.hiddenApps - Names of apps to restore (from session or crash recovery)
 * @returns {Promise<{ restoredApps: string[] }>}
 */
async function exitFocus({ hiddenApps = [] } = {}) {
  stopStrictEnforcement();

  const restoredApps = new Set(hiddenApps.length > 0 ? hiddenApps : lastHiddenApps);

  // 1. Restore by recorded HWNDs if available
  if (lastHiddenHwnds.size > 0) {
    try {
      await sendCommand({ action: "restore", hwnds: Array.from(lastHiddenHwnds) });
    } catch (err) {
      console.warn("[windows.js] HWND restore error:", err.message || err);
    }
  }

  // 2. Restore by application/process names (covers crash recovery and newly spawned handles)
  const namesToRestore = Array.from(restoredApps);
  if (namesToRestore.length > 0) {
    try {
      await sendCommand({ action: "restoreByNames", names: namesToRestore });
    } catch (err) {
      console.warn("[windows.js] Name-based restore error:", err.message || err);
    }
  }

  lastHiddenApps = [];
  lastHiddenHwnds.clear();

  return { restoredApps: Array.from(restoredApps) };
}

/**
 * Get current list of hidden apps.
 */
async function getState() {
  return { hiddenApps: [...lastHiddenApps] };
}

// Graceful cleanup on agent process exit
process.on("exit", () => {
  if (workerProcess) {
    try {
      workerProcess.stdin.write("QUIT\n");
      workerProcess.kill();
    } catch (e) {}
  }
});

module.exports = { enterFocus, exitFocus, getState };
