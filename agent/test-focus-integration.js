const assert = require("assert");
const fs = require("fs");
const path = require("path");
const WebSocket = require("ws");
const pairingManager = require("./src/pairing");
const stateManager = require("./src/state");
const FocusController = require("./src/focus/FocusController");
const { buildEffectiveAllowList } = require("./src/allowlist");
const { startServer, stopServer } = require("./src/server");

const TEST_PORT = 8767;

class FakeFocusController {
  constructor() {
    this.enterCalls = [];
    this.exitCalls = [];
    this.browserFailures = 0;
  }

  async enterFocus({ userAllowList = [] } = {}) {
    this.enterCalls.push([...userAllowList]);
    const allowed = buildEffectiveAllowList(userAllowList).map((name) => name.toLowerCase());
    const visible = ["Google Chrome", "Finder", "Terminal", "Slack", "Broken App"];
    const hiddenApps = [];
    for (const app of visible) {
      if (allowed.includes(app.toLowerCase())) continue;
      if (app === "Broken App") continue; // Simulates an individual hide failure.
      hiddenApps.push(app);
    }
    // A browser activation failure is non-fatal by design.
    this.browserFailures += 1;
    return { hiddenApps };
  }

  async exitFocus({ hiddenApps = [] } = {}) {
    this.exitCalls.push([...hiddenApps]);
    return { restoredApps: [...hiddenApps] };
  }

  async getVisibleApps() { return []; }
}

function waitFor(ws, predicate, timeoutMs = 3000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Timed out waiting for WebSocket message")), timeoutMs);
    const onMessage = (data) => {
      const message = JSON.parse(data.toString());
      if (predicate(message)) {
        clearTimeout(timer);
        ws.off("message", onMessage);
        resolve(message);
      }
    };
    ws.on("message", onMessage);
  });
}

async function connect(url) {
  const ws = new WebSocket(url, { headers: { Origin: "http://localhost:3000" } });
  await new Promise((resolve, reject) => { ws.once("open", resolve); ws.once("error", reject); });
  return ws;
}

async function run() {
  const testDir = path.join(__dirname, "data_test_focus_integration");
  fs.rmSync(testDir, { recursive: true, force: true });
  fs.mkdirSync(testDir, { recursive: true });

  const controller = new FakeFocusController();
  FocusController.setImpl(controller);
  pairingManager.initPairing(testDir);
  await stateManager.initState(testDir);

  // A-D + M: start is stateful; user and protected apps are preserved; only
  // successful hides are persisted; browser convenience failure is non-fatal.
  let state = await stateManager.startFocus({ durationMs: 1000, allowList: ["Chrome"] });
  assert.equal(state.status, "FOCUSING");
  assert.deepEqual(state.hiddenApps, ["Terminal", "Slack"]);
  assert(!state.hiddenApps.includes("Google Chrome"));
  assert(!state.hiddenApps.includes("Finder"));
  assert.equal(controller.browserFailures, 1);
  console.log("[PASS] A-D,M focus start protects browser/system apps and persists successful hides only");

  // E-F: exactly persisted apps are restored and list is cleared.
  state = await stateManager.endFocus();
  assert.deepEqual(controller.exitCalls.at(-1), ["Terminal", "Slack"]);
  assert.equal(state.status, "IDLE");
  assert.deepEqual(state.hiddenApps, []);
  console.log("[PASS] E-F focus exit restores only hiddenApps and clears state");

  // G: expiry follows the same central exit path.
  await stateManager.startFocus({ durationMs: 80, allowList: ["Google Chrome"] });
  await new Promise((resolve) => setTimeout(resolve, 180));
  assert.equal(stateManager.getStatus(), "IDLE");
  assert.deepEqual(controller.exitCalls.at(-1), ["Terminal", "Slack"]);
  console.log("[PASS] G timer expiration performs central restoration");

  // H: recovery restores exactly the persisted list before resetting to idle.
  const statePath = stateManager.getStateStoragePath();
  fs.writeFileSync(statePath, JSON.stringify({
    status: "FOCUSING", endsAt: Date.now() + 60000, allowList: ["Google Chrome"],
    focusSession: { duration: 1 }, hiddenApps: ["Notes", "Preview"]
  }), "utf8");
  await stateManager.initState(testDir);
  assert.deepEqual(controller.exitCalls.at(-1), ["Notes", "Preview"]);
  assert.equal(stateManager.getStatus(), "IDLE");
  assert.deepEqual(stateManager.getHiddenApps(), []);
  console.log("[PASS] H restart recovery restores persisted hidden applications");

  // I-J-K-L: exercise the public WebSocket route through the same controller.
  startServer(TEST_PORT);
  const ws = await connect(`ws://127.0.0.1:${TEST_PORT}`);
  const code = pairingManager.getPairingState().pairingCode;
  const paired = waitFor(ws, (message) => message.type === "paired");
  ws.send(JSON.stringify({ type: "pair", code }));
  const { deviceKey } = await paired;

  const started = waitFor(ws, (message) => message.type === "focusStarted");
  ws.send(JSON.stringify({ type: "enterFocus", deviceKey, durationMs: 5000, allowList: ["Google Chrome"] }));
  const startMessage = await started;
  assert.deepEqual(startMessage.hiddenApps, ["Terminal", "Slack"]);
  await assert.rejects(() => stateManager.startFocus({ durationMs: 1000 }), /already active/);

  const malformed = waitFor(ws, (message) => message.code === "INVALID_JSON");
  ws.send("not-json");
  await malformed;

  const ended = waitFor(ws, (message) => message.type === "focusEnded");
  ws.send(JSON.stringify({ type: "exitFocus", deviceKey }));
  await ended;
  assert.deepEqual(controller.exitCalls.at(-1), ["Terminal", "Slack"]);
  console.log("[PASS] I-L WebSocket invokes controller, rejects duplicate/malformed input, and restores apps");

  ws.close();
  stopServer();
  stateManager.clearFocusTimer();
  fs.rmSync(testDir, { recursive: true, force: true });
  console.log("All FocusController integration tests passed.");
}

run().catch((error) => {
  console.error("FocusController integration test failed:", error);
  stopServer();
  process.exitCode = 1;
});
