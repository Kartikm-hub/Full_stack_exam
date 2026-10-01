const {
  app,
  BrowserWindow,
  Tray,
  Menu,
  nativeImage,
  ipcMain,
  powerMonitor
} = require("electron");

const path = require("path");
const pairingManager = require("./pairing");
const stateManager = require("./state");
const { startServer, stopServer } = require("./server");

let mainWindow = null;
let tray = null;
let isShuttingDown = false;
const hasSingleInstanceLock = app.requestSingleInstanceLock();

// Only one local agent can own port 8765 and one pairing code at a time.
// Without this guard a second Electron window can display a code while the
// dashboard is still connected to an older agent process.
if (!hasSingleInstanceLock) {
  app.quit();
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 420,
    height: 620,
    resizable: false,
    title: "Focus Mode Agent",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, "renderer", "index.html"));

  mainWindow.on("close", (event) => {
    if (!app.isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });
}

app.on("second-instance", () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  }
});

function createTray() {
  const icon = nativeImage.createEmpty();
  tray = new Tray(icon);
  updateTrayMenu();
  tray.setToolTip("Focus Mode Agent");
  tray.on("click", () => { if (mainWindow) mainWindow.show(); });
}

function updateTrayMenu() {
  if (!tray) return;
  const currentState = stateManager.getFullState();
  const contextMenu = Menu.buildFromTemplate([
    {
      label: "Show Agent",
      click: () => { if (mainWindow) mainWindow.show(); }
    },
    {
      label: currentState.status === "FOCUSING" ? "⏹ End Focus Mode" : "Focus Mode (Idle)",
      enabled: currentState.status === "FOCUSING",
      click: async () => {
        try { await stateManager.endFocus(); } catch (e) {}
      }
    },
    { type: "separator" },
    {
      label: "Quit Agent",
      click: () => { app.isQuitting = true; app.quit(); }
    }
  ]);
  tray.setContextMenu(contextMenu);
}

// IPC: renderer ↔ main process
ipcMain.handle("get-agent-state", () => stateManager.getFullState());
ipcMain.handle("end-focus", async () => {
  try { return await stateManager.endFocus(); } catch (e) { return stateManager.getFullState(); }
});
ipcMain.handle("quit-agent", () => {
  app.isQuitting = true;
  app.quit();
});

// Push state updates to renderer window
stateManager.onStateChange((state, expired) => {
  if (mainWindow && mainWindow.webContents && !mainWindow.webContents.isDestroyed()) {
    mainWindow.webContents.send("agent-state", state);
  }
  updateTrayMenu();
});

// ─────────────────────────────────────────────
// Graceful shutdown
// ─────────────────────────────────────────────

async function handleShutdown() {
  if (isShuttingDown) return;
  isShuttingDown = true;
  stateManager.clearFocusTimer();
  // endFocus handles restoration if currently focusing
  if (stateManager.getStatus() === "FOCUSING") {
    try { await stateManager.endFocus(); } catch (e) {}
  }
  stopServer();
}

process.on("uncaughtException", async (err) => {
  console.error("[Uncaught Exception]", err);
  try { await stateManager.endFocus(); } catch (e) {}
});

process.on("unhandledRejection", async (reason) => {
  console.error("[Unhandled Rejection]", reason);
  try { await stateManager.endFocus(); } catch (e) {}
});

process.on("SIGINT", async () => { await handleShutdown(); app.quit(); });
process.on("SIGTERM", async () => { await handleShutdown(); app.quit(); });

// ─────────────────────────────────────────────
// Startup
// ─────────────────────────────────────────────

app.whenReady().then(async () => {
  if (!hasSingleInstanceLock) return;
  const userDataDir = app.getPath("userData");

  pairingManager.initPairing(userDataDir);
  await stateManager.initState(userDataDir); // async: performs crash recovery

  // Sleep/wake support
  if (powerMonitor) {
    powerMonitor.on("resume", async () => {
      try { await stateManager.checkTimerOnResume(); } catch (e) {}
    });
  }

  startServer();
  createWindow();
  createTray();

  if (process.platform === "darwin") {
    app.dock.hide();
  }
});

app.on("before-quit", async (event) => {
  if (!isShuttingDown) {
    event.preventDefault();
    app.isQuitting = true;
    await handleShutdown();
    app.quit();
  }
});

app.on("window-all-closed", (event) => {
  event.preventDefault();
});
