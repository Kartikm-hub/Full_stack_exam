/**
 * allowlist.js
 *
 * Central authority for protected and allowed applications.
 * The internally protected list CANNOT be overridden by the user.
 */

// Applications that are ALWAYS protected — never hidden regardless of user config.
// These names must match macOS process names (as reported by System Events).
const PROTECTED_APPS = [
  "Focus Mode Agent",  // Packaged application name
  "Electron",          // Development application name
  // macOS system processes
  "Finder",            // macOS Finder — always required
  "SystemUIServer",    // macOS menu bar / system UI
  "Dock",              // macOS Dock process
  "loginwindow",       // macOS login window
  "AXServer",          // macOS Accessibility server
  "universalaccessd",  // macOS Accessibility daemon
  "WindowManager",     // macOS window manager (macOS 13+)
  "NotificationCenter",// macOS notification center
  "ControlCenter",     // macOS Control Center (macOS 11+)
  // Windows system processes
  "explorer",
  "explorer.exe",
  "dwm",
  "dwm.exe",
  "ShellExperienceHost",
  "SearchHost",
  "StartMenuExperienceHost",
  "SystemSettings",
  "TextInputHost",
  "ApplicationFrameHost",
  "Taskmgr",
  "cmd",
  "powershell",
  "pwsh",
  "conhost",
  "Antigravity",
  // Common browser choices available by default
  "Google Chrome",
  "Safari",
  "Firefox",
  "Microsoft Edge",
  "msedge",
  "Arc",
  "Brave Browser",
  "Chromium",
];

// Common browser process names and aliases for normalization
const BROWSER_NAME_MAP = {
  "chrome":          "Google Chrome",
  "google chrome":   "Google Chrome",
  "chromium":        "Chromium",
  "safari":          "Safari",
  "firefox":         "Firefox",
  "arc":             "Arc",
  "brave":           "Brave Browser",
  "brave browser":   "Brave Browser",
  "edge":            "Microsoft Edge",
  "msedge":          "Microsoft Edge",
  "microsoft edge":  "Microsoft Edge",
  "opera":           "Opera",
  "vivaldi":         "Vivaldi",
  "code":            "Visual Studio Code",
  "vs code":         "Visual Studio Code",
  "visual studio code": "Visual Studio Code",
  "terminal":        "Terminal",
  "windowsterminal": "Terminal",
  "windows terminal": "Terminal",
};

// Known browsers for focused browser handling
const KNOWN_BROWSERS = [
  "Google Chrome",
  "Microsoft Edge",
  "Safari",
  "Firefox",
  "Arc",
  "Brave Browser",
  "Chromium",
  "Opera",
  "Vivaldi",
];

/**
 * Normalize an app name for reliable comparison.
 * Applies the browser name map for common shorthand.
 */
function normalizeAppName(name) {
  if (!name || typeof name !== "string") return "";
  const lower = name.trim().toLowerCase();
  if (BROWSER_NAME_MAP[lower]) return BROWSER_NAME_MAP[lower];
  // Return trimmed original (preserve casing for AppleScript)
  return name.trim();
}

/**
 * Build the full effective allow-list: protected ∪ user-provided.
 * Always returns a de-duplicated array of normalized names.
 */
function buildEffectiveAllowList(userAllowList = []) {
  const normalized = Array.isArray(userAllowList) ? userAllowList.map(normalizeAppName).filter(Boolean) : [];
  const combined = [];
  for (const name of [...PROTECTED_APPS, ...normalized]) {
    if (!combined.some((existing) => existing.toLowerCase() === name.toLowerCase())) combined.push(name);
  }
  return combined;
}

/**
 * Returns true if the given app name is protected (should never be hidden).
 */
function isProtected(appName, userAllowList = []) {
  const normalizedName = normalizeAppName(appName);
  const effective = buildEffectiveAllowList(userAllowList);
  return effective.some(
    (allowed) => allowed.toLowerCase() === normalizedName.toLowerCase()
  );
}

/**
 * Returns the first browser found in the user allow-list, or null.
 */
function findAllowedBrowser(userAllowList = []) {
  for (const name of userAllowList) {
    const normalized = normalizeAppName(name);
    if (KNOWN_BROWSERS.some((b) => b.toLowerCase() === normalized.toLowerCase())) {
      return normalized;
    }
  }
  return null;
}

module.exports = {
  PROTECTED_APPS,
  KNOWN_BROWSERS,
  normalizeAppName,
  buildEffectiveAllowList,
  isProtected,
  findAllowedBrowser,
};
