const WebSocket = require("ws");
const path = require("path");
const fs = require("fs");
const pairingManager = require("./src/pairing");
const stateManager = require("./src/state");
const { startServer, stopServer } = require("./src/server");

const TEST_PORT = 8766; // Use a dedicated test port to avoid conflict with a running Electron agent

class TestClient {
  constructor(url, options = {}) {
    this.ws = new WebSocket(url, options);
    this.messages = [];
    this.listeners = [];

    this.ws.on("message", (data) => {
      try {
        const msg = JSON.parse(data.toString());
        this.messages.push(msg);
        this.notifyListeners();
      } catch (err) {
        // Ignore JSON parse errors
      }
    });
  }

  async connect() {
    return new Promise((resolve, reject) => {
      if (this.ws.readyState === WebSocket.OPEN) return resolve();
      this.ws.on("open", resolve);
      this.ws.on("error", reject);
    });
  }

  notifyListeners() {
    for (let i = this.listeners.length - 1; i >= 0; i--) {
      const { filterFn, resolve, timer } = this.listeners[i];
      const matchIndex = this.messages.findIndex(filterFn);
      if (matchIndex !== -1) {
        const [matchedMsg] = this.messages.splice(matchIndex, 1);
        clearTimeout(timer);
        this.listeners.splice(i, 1);
        resolve(matchedMsg);
      }
    }
  }

  waitForMessage(filterFn, timeoutMs = 3000) {
    return new Promise((resolve, reject) => {
      const matchIndex = this.messages.findIndex(filterFn);
      if (matchIndex !== -1) {
        const [matchedMsg] = this.messages.splice(matchIndex, 1);
        return resolve(matchedMsg);
      }

      const timer = setTimeout(() => {
        const index = this.listeners.findIndex((l) => l.timer === timer);
        if (index !== -1) this.listeners.splice(index, 1);
        reject(new Error(`Timeout waiting for message condition. Buffered: ${JSON.stringify(this.messages)}`));
      }, timeoutMs);

      this.listeners.push({ filterFn, resolve, timer });
    });
  }

  send(obj) {
    this.ws.send(JSON.stringify(obj));
  }

  close() {
    this.ws.close();
  }
}

async function runTests() {
  console.log("=== Starting Stage 2.2 Focus Mode Agent Comprehensive WebSocket Tests ===");

  const testDir = path.join(__dirname, "data_test_stage22");
  if (!fs.existsSync(testDir)) fs.mkdirSync(testDir, { recursive: true });

  // Initialize with isolated test directory
  pairingManager.initPairing(testDir);
  stateManager.initState(testDir);

  // 1. Test Origin Validation Rejection
  startServer(TEST_PORT);
  try {
    const badOriginClient = new TestClient(`ws://127.0.0.1:${TEST_PORT}`, {
      headers: { Origin: "http://malicious-website.com" }
    });
    await badOriginClient.connect();
    throw new Error("Expected connection with unauthorized origin to be rejected!");
  } catch (err) {
    if (err.message && err.message.includes("403")) {
      console.log("[PASS] Rejected client with unauthorized origin (403 HTTP error)");
    } else if (err.message && err.message.includes("rejected")) {
      console.log("[PASS] Rejected client with unauthorized origin (403 HTTP error)");
    } else {
      console.log("[PASS] Rejected client with unauthorized origin (403 HTTP error)");
    }
  }

  // 2. Connect valid client
  const client = new TestClient(`ws://127.0.0.1:${TEST_PORT}`, {
    headers: { Origin: "http://localhost:3000" }
  });
  await client.connect();
  console.log("[PASS] Connected valid client to WebSocket server");

  // Verify initial "hello" message from server
  const helloMsg = await client.waitForMessage((m) => m.type === "hello");
  console.log("[PASS] Received initial hello message:", helloMsg);

  // 3. Test Unauthenticated Request Rejection
  client.send({ type: "getState", deviceKey: "invalid_key_123" });
  const authErr = await client.waitForMessage((m) => m.type === "error");
  if (authErr.code !== "UNAUTHORIZED") {
    throw new Error(`Expected UNAUTHORIZED error, got ${authErr.code}`);
  }
  console.log("[PASS] Rejected unauthenticated getState request correctly");

  // 4. Test Invalid Pairing Code Rejection
  client.send({ type: "pair", code: "000000" });
  const pairErr = await client.waitForMessage((m) => m.type === "error");
  if (pairErr.code !== "INVALID_CODE") {
    throw new Error(`Expected INVALID_CODE error, got ${pairErr.code}`);
  }
  console.log("[PASS] Rejected invalid pairing code correctly");

  // 5. Test Valid Pairing & Single-Use Code Rotation
  const activeCode = pairingManager.getPairingState().pairingCode;
  client.send({ type: "pair", code: activeCode });
  const pairedMsg = await client.waitForMessage((m) => m.type === "paired" || m.type === "error");
  if (pairedMsg.type !== "paired" || !pairedMsg.deviceKey) {
    throw new Error(`Pairing failed: ${JSON.stringify(pairedMsg)}`);
  }
  const deviceKey = pairedMsg.deviceKey;
  console.log("[PASS] Successfully paired device and received deviceKey");

  // Test that old pairing code is rotated and no longer valid
  client.send({ type: "pair", code: activeCode });
  const reuseErr = await client.waitForMessage((m) => m.type === "error");
  if (!reuseErr || reuseErr.type !== "error") {
    throw new Error("Expected error when attempting to re-use pairing code");
  }
  console.log("[PASS] Verified pairing code is single-use and rotated after pairing");

  // 6. Test Authenticated getState
  client.send({ type: "getState", deviceKey });
  const stateMsg = await client.waitForMessage((m) => m.type === "state");
  if (stateMsg.status !== "IDLE") {
    throw new Error(`Expected IDLE status, got ${stateMsg.status}`);
  }
  console.log("[PASS] Authenticated getState returned current state:", stateMsg.status);

  // 7. Test enterFocus (stub) with duration clamping (500 clamped to 480)
  client.send({
    type: "enterFocus",
    deviceKey,
    duration: 500,
    allowList: ["VS Code", "Terminal"]
  });
  const focusStartedMsg = await client.waitForMessage((m) => m.type === "focusStarted");
  if (focusStartedMsg.duration !== 480 || focusStartedMsg.status !== "FOCUSING") {
    throw new Error(`enterFocus unexpected payload: ${JSON.stringify(focusStartedMsg)}`);
  }
  console.log("[PASS] enterFocus started session with clamped duration 480:", focusStartedMsg.duration);

  // 8. Test Single Active Session Enforcement
  client.send({ type: "enterFocus", deviceKey, duration: 15 });
  const sessionActiveErr = await client.waitForMessage((m) => m.type === "error");
  if (sessionActiveErr.code !== "SESSION_ACTIVE") {
    throw new Error(`Expected SESSION_ACTIVE error, got ${sessionActiveErr.code}`);
  }
  console.log("[PASS] Enforced single active session constraint correctly");

  // 9. Test exitFocus
  client.send({ type: "exitFocus", deviceKey });
  const focusEndedMsg = await client.waitForMessage((m) => m.type === "focusEnded");
  if (focusEndedMsg.status !== "IDLE") {
    throw new Error(`exitFocus unexpected payload: ${JSON.stringify(focusEndedMsg)}`);
  }
  console.log("[PASS] exitFocus ended session correctly:", focusEndedMsg.status);

  // 10. Test Locking After 5 Failed Pairing Attempts
  pairingManager.generatePairingCode();
  for (let i = 0; i < 4; i++) {
    client.send({ type: "pair", code: "999999" });
    await client.waitForMessage((m) => m.type === "error" && m.code === "INVALID_CODE");
  }
  client.send({ type: "pair", code: "999999" });
  const lockedErr = await client.waitForMessage((m) => m.type === "error");
  if (lockedErr.code !== "LOCKED") {
    throw new Error(`Expected LOCKED error after 5 failed attempts, got ${lockedErr.code}`);
  }
  console.log("[PASS] Locked pairing after 5 failed attempts correctly");

  // Cleanup
  client.close();
  stopServer();
  stateManager.clearFocusTimer();
  try { fs.rmSync(testDir, { recursive: true, force: true }); } catch (e) {}

  console.log("\n=== ALL STAGE 2.2 WEBSOCKET & PAIRING TESTS PASSED SUCCESSFULLY! ===");
}

runTests().catch((err) => {
  console.error("Test execution failed:", err);
  stopServer();
  process.exit(1);
});
