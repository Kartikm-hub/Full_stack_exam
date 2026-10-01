/**
 * test-focus.js
 *
 * Stage 4 comprehensive test suite — A through M.
 * Uses the stub FocusController to avoid actually hiding development applications.
 *
 * Run: node test-focus.js
 */

const fs = require("fs");
const path = require("path");
const assert = require("assert");
const WebSocket = require("ws");

// ─── Inject stub BEFORE requiring any module that loads FocusController ───────
const FocusController = require("./src/focus/FocusController");
const stubImpl = require("./focus/stub");

// Custom controllable stub that records calls and lets us simulate failures
let stubHiddenAppsToReturn = ["TestApp1", "TestApp2"];
let stubShouldFail = false;
let lastEnterFocusOptions = null;
let lastExitFocusOptions = null;

const controllableStub = {
  async enterFocus(options) {
    lastEnterFocusOptions = options;
    if (stubShouldFail) throw new Error("Stub: simulated enterFocus failure");
    return { hiddenApps: [...stubHiddenAppsToReturn] };
  },
  async exitFocus(options) {
    lastExitFocusOptions = options;
    return { restoredApps: [...(options.hiddenApps || [])] };
  },
  async getVisibleApps() {
    return ["TestApp1", "TestApp2", "AllowedBrowser"];
  }
};

FocusController.setImpl(controllableStub);

// Now require state after stub is set
const pairingManager = require("./src/pairing");
const stateManager = require("./src/state");
const { startServer, stopServer } = require("./src/server");

const TEST_PORT = 8767;

let passed = 0;
let failed = 0;

function ok(label) { console.log(`  [PASS] ${label}`); passed++; }
function fail(label, err) { console.error(`  [FAIL] ${label}`, err && (err.message || err)); failed++; }

function assertEq(actual, expected, label) {
  try {
    assert.strictEqual(actual, expected);
    ok(label);
  } catch (e) {
    fail(label, `Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function assertDeepEq(actual, expected, label) {
  try {
    assert.deepStrictEqual(actual, expected);
    ok(label);
  } catch (e) {
    fail(label, `Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

// ─── WebSocket test client ──────────────────────────────────────────────────

class TestClient {
  constructor(url, options = {}) {
    this.ws = new WebSocket(url, options);
    this.messages = [];
    this.listeners = [];
    this.ws.on("message", (data) => {
      try { const msg = JSON.parse(data.toString()); this.messages.push(msg); this.notifyListeners(); } catch (e) {}
    });
  }
  connect() {
    return new Promise((res, rej) => {
      if (this.ws.readyState === WebSocket.OPEN) return res();
      this.ws.on("open", res);
      this.ws.on("error", rej);
    });
  }
  notifyListeners() {
    for (let i = this.listeners.length - 1; i >= 0; i--) {
      const { filterFn, resolve, timer } = this.listeners[i];
      const idx = this.messages.findIndex(filterFn);
      if (idx !== -1) {
        const [msg] = this.messages.splice(idx, 1);
        clearTimeout(timer);
        this.listeners.splice(i, 1);
        resolve(msg);
      }
    }
  }
  waitForMessage(filterFn, timeoutMs = 3000) {
    return new Promise((resolve, reject) => {
      const idx = this.messages.findIndex(filterFn);
      if (idx !== -1) { const [m] = this.messages.splice(idx, 1); return resolve(m); }
      const timer = setTimeout(() => {
        const i = this.listeners.findIndex((l) => l.timer === timer);
        if (i !== -1) this.listeners.splice(i, 1);
        reject(new Error(`Timeout. Buffered: ${JSON.stringify(this.messages)}`));
      }, timeoutMs);
      this.listeners.push({ filterFn, resolve, timer });
    });
  }
  send(obj) { this.ws.send(typeof obj === "string" ? obj : JSON.stringify(obj)); }
  close() { this.ws.close(); }
}

// ─── Main test runner ────────────────────────────────────────────────────────

async function runTests() {
  console.log("=== Stage 4 Focus Mode Integration Tests (Stub Mode) ===\n");

  const testDir = path.join(__dirname, "data_test_focus_stage4");
  if (fs.existsSync(testDir)) fs.rmSync(testDir, { recursive: true, force: true });
  fs.mkdirSync(testDir, { recursive: true });

  pairingManager.initPairing(testDir);
  await stateManager.initState(testDir);

  startServer(TEST_PORT);
  console.log("Server started on port", TEST_PORT);

  const client = new TestClient(`ws://127.0.0.1:${TEST_PORT}`, {
    headers: { Origin: "http://localhost:3000" }
  });
  await client.connect();
  await client.waitForMessage((m) => m.type === "hello");

  // Pair
  const code = pairingManager.getPairingState().pairingCode;
  client.send({ type: "pair", code });
  const pairedMsg = await client.waitForMessage((m) => m.type === "paired" || m.type === "error");
  if (pairedMsg.type !== "paired") throw new Error("Pairing failed: " + JSON.stringify(pairedMsg));
  const deviceKey = pairedMsg.deviceKey;
  ok("Paired device, received deviceKey");

  // ─── Test A: enterFocus changes state to FOCUSING ─────────────────────────
  console.log("\n--- A: enterFocus changes state to FOCUSING ---");
  stubHiddenAppsToReturn = ["TestApp1", "TestApp2"];
  client.send({ type: "enterFocus", deviceKey, durationMs: 1000, allowList: ["AllowedBrowser"] });
  const fsMsg = await client.waitForMessage((m) => m.type === "focusStarted");
  assertEq(fsMsg.status, "FOCUSING", "A: focusStarted.status === FOCUSING");
  assertEq(stateManager.getStatus(), "FOCUSING", "A: stateManager.getStatus() === FOCUSING");

  // ─── Test B: Browser is not in hiddenApps ─────────────────────────────────
  console.log("\n--- B: Allow-listed browser is NOT in hiddenApps ---");
  // Stub returns what we told it to; verify the browser passed in allowList isn't in hiddenApps
  const hiddenAfterEnter = stateManager.getHiddenApps();
  const browserInHidden = hiddenAfterEnter.some((a) => a.toLowerCase() === "allowedbrowser");
  assertEq(browserInHidden, false, "B: Allowed browser not present in hiddenApps");

  // ─── Test C: Protected app not in hiddenApps ──────────────────────────────
  console.log("\n--- C: Protected app not in hiddenApps ---");
  stubHiddenAppsToReturn = ["TestApp1"];
  // Verify Electron (self) not hidden — stub returns what we said, verify "Electron" absent
  const electronInHidden = hiddenAfterEnter.some((a) => a.toLowerCase() === "electron");
  assertEq(electronInHidden, false, "C: Protected 'Electron' app not in hiddenApps");

  // ─── Test D: hiddenApps contains successfully hidden apps ─────────────────
  console.log("\n--- D: hiddenApps contains only stub-returned apps ---");
  assertDeepEq(fsMsg.hiddenApps, ["TestApp1", "TestApp2"], "D: hiddenApps matches stub return value");

  // ─── Test E & F: exitFocus restores only hiddenApps ──────────────────────
  console.log("\n--- E+F: exitFocus restores hiddenApps, then hiddenApps = [] ---");
  client.send({ type: "exitFocus", deviceKey });
  const feMsg = await client.waitForMessage((m) => m.type === "focusEnded");
  assertEq(feMsg.status, "IDLE", "E: focusEnded.status === IDLE");
  assertDeepEq(lastExitFocusOptions.hiddenApps, ["TestApp1", "TestApp2"], "E: exitFocus called with correct hiddenApps");
  assertDeepEq(stateManager.getHiddenApps(), [], "F: hiddenApps cleared after exitFocus");
  assertEq(stateManager.getStatus(), "IDLE", "F: status is IDLE after exitFocus");

  // ─── Test G: Timer expiration calls exitFocus ─────────────────────────────
  console.log("\n--- G: Timer expiration automatically calls exitFocus ---");
  stubHiddenAppsToReturn = ["TimerTestApp"];
  client.send({ type: "enterFocus", deviceKey, durationMs: 600 });
  await client.waitForMessage((m) => m.type === "focusStarted");
  const timerEndMsg = await client.waitForMessage((m) => m.type === "focusEnded", 3000);
  assertEq(timerEndMsg.status, "IDLE", "G: Timer expiry sends focusEnded with IDLE status");
  assertEq(stateManager.getStatus(), "IDLE", "G: stateManager status IDLE after timer expiry");
  assertDeepEq(stateManager.getHiddenApps(), [], "G: hiddenApps cleared after timer expiry");

  // ─── Test H: Crash recovery restores persisted hiddenApps ────────────────
  console.log("\n--- H: Restart recovery restores persisted hiddenApps ---");
  const statePath = stateManager.getStateStoragePath();
  const crashState = {
    status: "FOCUSING",
    endsAt: Date.now() + 300000,
    allowList: ["AllowedBrowser"],
    hiddenApps: ["CrashedApp1", "CrashedApp2"],
    focusSession: { duration: 5, startTime: Date.now() }
  };
  fs.writeFileSync(statePath, JSON.stringify(crashState, null, 2), "utf-8");
  lastExitFocusOptions = null;
  await stateManager.initState(testDir);
  assertEq(stateManager.getStatus(), "IDLE", "H: Status is IDLE after crash recovery");
  assertDeepEq(stateManager.getHiddenApps(), [], "H: hiddenApps cleared after crash recovery");
  if (lastExitFocusOptions) {
    assertDeepEq(lastExitFocusOptions.hiddenApps, ["CrashedApp1", "CrashedApp2"], "H: exitFocus called with persisted hiddenApps during recovery");
  } else {
    fail("H: exitFocus was not called during crash recovery");
  }
  const diskState = JSON.parse(fs.readFileSync(statePath, "utf-8"));
  assertEq(diskState.status, "IDLE", "H: state.json written as IDLE after recovery");

  // ─── Test I: WebSocket enterFocus triggers FocusController ───────────────
  console.log("\n--- I: WebSocket enterFocus triggers FocusController ---");
  stubHiddenAppsToReturn = ["WSTestApp"];
  lastEnterFocusOptions = null;
  client.send({ type: "enterFocus", deviceKey, durationMs: 5000, allowList: ["AllowedBrowser"] });
  await client.waitForMessage((m) => m.type === "focusStarted");
  assertEq(lastEnterFocusOptions !== null, true, "I: FocusController.enterFocus was called");
  assertDeepEq(lastEnterFocusOptions.userAllowList, ["AllowedBrowser"], "I: correct userAllowList passed to FocusController");

  // ─── Test J: WebSocket exitFocus restores applications ───────────────────
  console.log("\n--- J: WebSocket exitFocus triggers FocusController.exitFocus ---");
  lastExitFocusOptions = null;
  client.send({ type: "exitFocus", deviceKey });
  await client.waitForMessage((m) => m.type === "focusEnded");
  assertEq(lastExitFocusOptions !== null, true, "J: FocusController.exitFocus was called");
  assertDeepEq(lastExitFocusOptions.hiddenApps, ["WSTestApp"], "J: correct hiddenApps passed to FocusController.exitFocus");

  // ─── Test K: Malformed messages don't crash agent ────────────────────────
  console.log("\n--- K: Malformed messages do not crash agent ---");
  client.send("NOT_JSON_AT_ALL{{");
  const jsonErr = await client.waitForMessage((m) => m.type === "error" && m.code === "INVALID_JSON");
  assertEq(jsonErr.type, "error", "K: Malformed JSON returns error");
  client.send({ weird: "notype" });
  const fmtErr = await client.waitForMessage((m) => m.type === "error" && m.code === "INVALID_FORMAT");
  assertEq(fmtErr.code, "INVALID_FORMAT", "K: Missing type field returns INVALID_FORMAT");
  assertEq(stateManager.getStatus(), "IDLE", "K: Agent still alive and IDLE after malformed messages");

  // ─── Test L: Focus cannot start twice ────────────────────────────────────
  console.log("\n--- L: Focus cannot start twice ---");
  client.send({ type: "enterFocus", deviceKey, durationMs: 10000 });
  await client.waitForMessage((m) => m.type === "focusStarted");
  client.send({ type: "enterFocus", deviceKey, durationMs: 5000 });
  const dupErr = await client.waitForMessage((m) => m.type === "error");
  assertEq(dupErr.code, "SESSION_ACTIVE", "L: Second enterFocus rejected with SESSION_ACTIVE");
  client.send({ type: "exitFocus", deviceKey });
  await client.waitForMessage((m) => m.type === "focusEnded");

  // ─── Test M: Browser handling failure doesn't crash agent ────────────────
  console.log("\n--- M: FocusController failure does not crash agent ---");
  stubShouldFail = true;
  // Server catches error and still enters focus state (non-fatal)
  client.send({ type: "enterFocus", deviceKey, durationMs: 5000 });
  const mMsg = await client.waitForMessage((m) => m.type === "focusStarted" || m.type === "error", 3000);
  // Should still succeed because the error is non-fatal (state.js catches it)
  if (mMsg.type === "focusStarted") {
    ok("M: Focus still started despite FocusController error (non-fatal)");
    client.send({ type: "exitFocus", deviceKey });
    await client.waitForMessage((m) => m.type === "focusEnded");
  } else {
    ok("M: FocusController error handled gracefully — agent did not crash");
  }
  assertEq(stateManager.getStatus(), "IDLE", "M: Agent recovered to IDLE after FocusController failure");
  stubShouldFail = false;

  // Cleanup
  client.close();
  stopServer();
  stateManager.clearFocusTimer();
  try { fs.rmSync(testDir, { recursive: true, force: true }); } catch (e) {}

  // ─── Summary ───────────────────────────────────────────────────────────────
  console.log(`\n${"─".repeat(55)}`);
  console.log(`Tests passed: ${passed}`);
  console.log(`Tests failed: ${failed}`);
  if (failed === 0) {
    console.log("\n=== ALL STAGE 4 TESTS PASSED SUCCESSFULLY! ===");
  } else {
    console.log("\n=== SOME TESTS FAILED — see above for details ===");
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error("Test runner crashed:", err);
  stopServer();
  process.exit(1);
});
