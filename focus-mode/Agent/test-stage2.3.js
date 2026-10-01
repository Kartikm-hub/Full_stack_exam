const fs = require("fs");
const path = require("path");
const WebSocket = require("ws");
const pairingManager = require("./src/pairing");
const stateManager = require("./src/state");
const { startServer, stopServer } = require("./src/server");

const TEST_PORT = 8766; // Use dedicated test port to avoid conflict with running Electron agent on 8765

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
        this.messages.push({ _raw: data.toString() });
        this.notifyListeners();
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
        reject(new Error(`Timeout waiting for message matching condition. Buffered messages: ${JSON.stringify(this.messages)}`));
      }, timeoutMs);

      this.listeners.push({ filterFn, resolve, timer });
    });
  }

  send(obj) {
    if (typeof obj === "string") {
      this.ws.send(obj);
    } else {
      this.ws.send(JSON.stringify(obj));
    }
  }

  close() {
    this.ws.close();
  }
}

async function runStage23Tests() {
  console.log("=== Starting Stage 2.3 Comprehensive Verification Tests ===");

  const testDir = path.join(__dirname, "data_test_stage23");
  if (!fs.existsSync(testDir)) {
    fs.mkdirSync(testDir, { recursive: true });
  }

  pairingManager.initPairing(testDir);
  stateManager.initState(testDir);

  startServer(TEST_PORT);
  console.log(`[PASS] WebSocket Server started on 127.0.0.1:${TEST_PORT}`);

  const client = new TestClient(`ws://127.0.0.1:${TEST_PORT}`, {
    headers: { Origin: "http://localhost:3000" }
  });
  await client.connect();
  await client.waitForMessage((m) => m.type === "hello");
  console.log("[PASS] Connected WebSocket test client");

  // Pair device
  const activeCode = pairingManager.getPairingState().pairingCode;
  console.log(`Submitting active pairing code: ${activeCode}`);
  client.send({ type: "pair", code: activeCode });
  const pairResponse = await client.waitForMessage((m) => m.type === "paired" || m.type === "error");
  if (pairResponse.type !== "paired") {
    throw new Error(`Pairing failed: ${JSON.stringify(pairResponse)}`);
  }
  const deviceKey = pairResponse.deviceKey;
  console.log("[PASS] Device paired successfully");

  // Test A, B, C, D: Start Focus short duration & verify state.json persistence
  console.log("\n--- Testing Short Focus Session & Persistence (Items A - D) ---");
  client.send({
    type: "enterFocus",
    deviceKey,
    durationMs: 600, // 600 ms fast expiration for test
    allowList: ["Terminal", "Browser"]
  });

  const focusStartedMsg = await client.waitForMessage((m) => m.type === "focusStarted");
  if (focusStartedMsg.status !== "FOCUSING") {
    throw new Error(`Expected status FOCUSING, got ${focusStartedMsg.status}`);
  }
  if (!focusStartedMsg.endsAt || typeof focusStartedMsg.endsAt !== "number") {
    throw new Error("Expected endsAt timestamp to be populated");
  }
  console.log("[PASS] enterFocus returned status FOCUSING with endsAt populated");

  const statePath = stateManager.getStateStoragePath();
  if (!fs.existsSync(statePath)) {
    throw new Error(`state.json not found on disk at ${statePath}`);
  }
  const persistedContent = JSON.parse(fs.readFileSync(statePath, "utf-8"));
  if (persistedContent.status !== "FOCUSING" || !persistedContent.endsAt) {
    throw new Error("state.json disk content does not match FOCUSING state");
  }
  console.log("[PASS] state.json correctly written to disk with FOCUSING status and endsAt");

  // Test E, F, G: Automatic Timer Expiration & State Restoration to IDLE
  console.log("\n--- Testing Automatic Timer Expiration (Items E - G) ---");
  const focusEndedMsg = await client.waitForMessage((m) => m.type === "focusEnded", 3000);
  if (focusEndedMsg.status !== "IDLE") {
    throw new Error(`Expected status IDLE on timer expiration, got ${focusEndedMsg.status}`);
  }
  const currentStateAfterExpiry = stateManager.getFullState();
  if (currentStateAfterExpiry.status !== "IDLE" || currentStateAfterExpiry.endsAt !== null) {
    throw new Error("State after timer expiration was not reset to IDLE with endsAt: null");
  }
  const diskContentAfterExpiry = JSON.parse(fs.readFileSync(statePath, "utf-8"));
  if (diskContentAfterExpiry.status !== "IDLE" || diskContentAfterExpiry.endsAt !== null) {
    throw new Error("state.json on disk was not updated to IDLE after expiration");
  }
  console.log("[PASS] Focus timer automatically expired, restored state to IDLE, cleared endsAt, and updated state.json");

  // Test H: Reject Second enterFocus while FOCUSING
  console.log("\n--- Testing Active Session Rejection (Item H) ---");
  client.send({ type: "enterFocus", deviceKey, durationMs: 10000 });
  await client.waitForMessage((m) => m.type === "focusStarted");

  client.send({ type: "enterFocus", deviceKey, durationMs: 5000 });
  const activeSessionErr = await client.waitForMessage((m) => m.type === "error");
  if (activeSessionErr.code !== "SESSION_ACTIVE") {
    throw new Error(`Expected SESSION_ACTIVE error, got ${activeSessionErr.code}`);
  }
  console.log("[PASS] Rejected second enterFocus command while session was active");

  // Clean exit focus
  client.send({ type: "exitFocus", deviceKey });
  await client.waitForMessage((m) => m.type === "focusEnded");

  // Test I & J: Restart / Crash Recovery Safety (Fail Safe Principle)
  console.log("\n--- Testing Restart / Crash Recovery Fail-Safe (Items I & J) ---");
  const crashedState = {
    status: "FOCUSING",
    endsAt: Date.now() + 300000,
    allowList: ["InterruptedApp"],
    focusSession: { duration: 5, startTime: Date.now(), endsAt: Date.now() + 300000 }
  };
  fs.writeFileSync(statePath, JSON.stringify(crashedState, null, 2), "utf-8");

  // Simulate agent restarting by re-initializing state manager
  await stateManager.initState(testDir);
  const recoveredState = stateManager.getFullState();
  if (recoveredState.status !== "IDLE" || recoveredState.endsAt !== null) {
    throw new Error(`Crash recovery failed: status is ${recoveredState.status}, expected IDLE`);
  }
  const diskStateAfterRecovery = JSON.parse(fs.readFileSync(statePath, "utf-8"));
  if (diskStateAfterRecovery.status !== "IDLE") {
    throw new Error("state.json was not updated to IDLE after crash recovery");
  }
  console.log("[PASS] Agent startup detected previous FOCUSING state, performed fail-safe recovery to IDLE, and persisted updated state.json");

  // Test K & L: WebSocket getState and exitFocus
  console.log("\n--- Testing WebSocket getState and exitFocus Protocol (Items K & L) ---");
  client.send({ type: "getState", deviceKey });
  const stateProtocolMsg = await client.waitForMessage((m) => m.type === "state");
  if (stateProtocolMsg.status !== "IDLE" || !Array.isArray(stateProtocolMsg.hiddenApps)) {
    throw new Error("getState protocol response missing valid fields");
  }
  console.log("[PASS] WebSocket getState protocol working as expected");

  client.send({ type: "enterFocus", deviceKey, durationMs: 5000 });
  await client.waitForMessage((m) => m.type === "focusStarted");
  client.send({ type: "exitFocus", deviceKey });
  const exitFocusMsg = await client.waitForMessage((m) => m.type === "focusEnded");
  if (exitFocusMsg.status !== "IDLE") {
    throw new Error("exitFocus failed to transition state to IDLE");
  }
  console.log("[PASS] WebSocket exitFocus protocol working as expected");

  // Test M: Malformed Message Handling
  console.log("\n--- Testing Malformed Messages and Robustness (Item M) ---");
  client.send("THIS_IS_NOT_VALID_JSON{{{");
  const jsonErr = await client.waitForMessage((m) => m.type === "error" && m.code === "INVALID_JSON");
  if (!jsonErr) throw new Error("Expected INVALID_JSON error");

  client.send({ foo: "bar" });
  const formatErr = await client.waitForMessage((m) => m.type === "error" && m.code === "INVALID_FORMAT");
  if (!formatErr) throw new Error("Expected INVALID_FORMAT error");

  client.send({ type: "unknownCommand123" });
  const typeErr = await client.waitForMessage((m) => m.type === "error" && m.code === "UNKNOWN_TYPE");
  if (!typeErr) throw new Error("Expected UNKNOWN_TYPE error");

  console.log("[PASS] Server handled malformed JSON, invalid schema, and unknown message types gracefully without crashing");

  // Cleanup
  client.close();
  stopServer();
  stateManager.clearFocusTimer();
  try {
    fs.rmSync(testDir, { recursive: true, force: true });
  } catch (e) {}

  console.log("\n=== ALL STAGE 2.3 TESTS (A THROUGH M) PASSED SUCCESSFULLY! ===");
}

runStage23Tests().catch((err) => {
  console.error("Test execution failed:", err);
  stopServer();
  process.exit(1);
});
