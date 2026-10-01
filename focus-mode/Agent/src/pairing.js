const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const PAIRING_EXPIRATION_MS = 5 * 60 * 1000; // 5 minutes
const MAX_FAILED_ATTEMPTS = 5;

let userDataDir = null;
let currentCode = null;
let createdAt = 0;
let expiresAt = 0;
let failedAttempts = 0;
let isLocked = false;
let expirationTimer = null;
let persistedData = null;

const listeners = new Set();

function getDefaultUserDataPath() {
  try {
    const { app } = require("electron");
    if (app && typeof app.getPath === "function") {
      return app.getPath("userData");
    }
  } catch (err) {
    // Electron app unavailable (e.g. running in standalone Node test)
  }
  return path.join(__dirname, "..", "data");
}

function getStoragePath() {
  const dir = userDataDir || getDefaultUserDataPath();
  if (!fs.existsSync(dir)) {
    try {
      fs.mkdirSync(dir, { recursive: true });
    } catch (err) {
      // Ignore directory creation error if directory exists
    }
  }
  return path.join(dir, "device-config.json");
}

function loadPersistedData() {
  if (persistedData) return persistedData;
  const filePath = getStoragePath();
  if (fs.existsSync(filePath)) {
    try {
      const content = fs.readFileSync(filePath, "utf-8");
      persistedData = JSON.parse(content);
      return persistedData;
    } catch (err) {
      persistedData = { deviceKey: null };
      return persistedData;
    }
  }
  persistedData = { deviceKey: null };
  return persistedData;
}

function savePersistedData(data) {
  persistedData = data;
  const filePath = getStoragePath();
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
  } catch (err) {
    // Ignore write failure in read-only environments
  }
}

function notifyListeners() {
  const state = getPairingState();
  for (const listener of listeners) {
    try {
      listener(state);
    } catch (err) {
      // Ignore listener error
    }
  }
}

function initPairing(customUserDataDir) {
  persistedData = null; // Reset memory cache for clean path switching
  if (customUserDataDir) {
    userDataDir = customUserDataDir;
  } else {
    userDataDir = getDefaultUserDataPath();
  }
  loadPersistedData();
  generatePairingCode();
}

function generatePairingCode() {
  if (expirationTimer) {
    clearTimeout(expirationTimer);
    expirationTimer = null;
  }

  // Cryptographically secure 6-digit code (100000 - 999999)
  currentCode = crypto.randomInt(100000, 1000000).toString();
  createdAt = Date.now();
  expiresAt = createdAt + PAIRING_EXPIRATION_MS;
  failedAttempts = 0;
  isLocked = false;

  expirationTimer = setTimeout(() => {
    // Automatically rotate code when expired
    generatePairingCode();
  }, PAIRING_EXPIRATION_MS);

  if (typeof expirationTimer.unref === "function") {
    expirationTimer.unref();
  }

  notifyListeners();
  return currentCode;
}

function getPairingState() {
  const now = Date.now();
  const isExpired = now > expiresAt;
  let codeForDisplay = currentCode;

  if (isLocked) {
    codeForDisplay = "LOCKED";
  } else if (isExpired) {
    codeForDisplay = "EXPIRED";
  }

  return {
    pairingCode: codeForDisplay,
    isExpired,
    isLocked,
    remainingAttempts: Math.max(0, MAX_FAILED_ATTEMPTS - failedAttempts),
    isPaired: isPaired()
  };
}

function attemptPairing(submittedCode) {
  if (isLocked || failedAttempts >= MAX_FAILED_ATTEMPTS) {
    isLocked = true;
    notifyListeners();
    return {
      success: false,
      error: "Pairing locked after 5 failed attempts",
      code: "LOCKED"
    };
  }

  if (Date.now() > expiresAt) {
    return {
      success: false,
      error: "Pairing code expired",
      code: "EXPIRED"
    };
  }

  if (!submittedCode || String(submittedCode).trim() !== currentCode) {
    failedAttempts++;
    if (failedAttempts >= MAX_FAILED_ATTEMPTS) {
      isLocked = true;
      notifyListeners();
      return {
        success: false,
        error: "Pairing locked after 5 failed attempts",
        code: "LOCKED",
        remainingAttempts: 0
      };
    }
    notifyListeners();
    return {
      success: false,
      error: "Invalid pairing code",
      code: "INVALID_CODE",
      remainingAttempts: Math.max(0, MAX_FAILED_ATTEMPTS - failedAttempts)
    };
  }

  // Code matches: generate 32-byte deviceKey, persist it, rotate pairing code
  const deviceKey = crypto.randomBytes(32).toString("hex");
  savePersistedData({
    deviceKey,
    pairedAt: new Date().toISOString()
  });

  // Single-use: rotate pairing code after successful pairing
  generatePairingCode();

  return {
    success: true,
    deviceKey
  };
}

function isPaired() {
  const data = loadPersistedData();
  return Boolean(data && data.deviceKey);
}

function validateDeviceKey(key) {
  if (!key || typeof key !== "string") return false;
  const data = loadPersistedData();
  if (!data || !data.deviceKey) return false;

  const storedBuf = Buffer.from(data.deviceKey, "utf-8");
  const keyBuf = Buffer.from(key, "utf-8");

  if (storedBuf.length !== keyBuf.length) return false;
  return crypto.timingSafeEqual(storedBuf, keyBuf);
}

function onPairingChange(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// Auto-initialize with default path
initPairing();

module.exports = {
  initPairing,
  generatePairingCode,
  getPairingState,
  attemptPairing,
  isPaired,
  validateDeviceKey,
  onPairingChange
};
