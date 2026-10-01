/**
 * test-windows-controller.js
 *
 * Direct test for native Windows FocusController (windows.js).
 */

const assert = require("assert");
const windowsController = require("./src/focus/windows");

async function runTest() {
  console.log("=== Testing Native Windows Focus Controller ===");

  // 1. Initial state
  const initialState = await windowsController.getState();
  assert.deepStrictEqual(initialState, { hiddenApps: [] });
  console.log("[PASS] Initial state is empty");

  // 2. enterFocus with Google Chrome & Visual Studio Code allowed
  console.log("Calling enterFocus with ['Google Chrome', 'Visual Studio Code']...");
  const enterResult = await windowsController.enterFocus({
    userAllowList: ["Google Chrome", "Visual Studio Code"],
    strict: false
  });

  assert(Array.isArray(enterResult.hiddenApps), "hiddenApps should be an array");
  console.log(`[PASS] enterFocus executed successfully. Hidden apps: [${enterResult.hiddenApps.join(", ")}]`);

  // Verify allow-listed apps are not in hiddenApps
  for (const app of enterResult.hiddenApps) {
    const lower = app.toLowerCase();
    assert(!lower.includes("chrome"), `Chrome should not be hidden: ${app}`);
    assert(!lower.includes("electron"), `Electron should not be hidden: ${app}`);
    assert(!lower.includes("explorer"), `Explorer should not be hidden: ${app}`);
  }
  console.log("[PASS] Allowed browser and system essentials were untouched");

  // 3. getState reflects hidden apps
  const stateDuringFocus = await windowsController.getState();
  assert.deepStrictEqual(stateDuringFocus.hiddenApps, enterResult.hiddenApps);
  console.log("[PASS] getState matches enterFocus hiddenApps");

  // 4. exitFocus restores the hidden apps
  console.log("Calling exitFocus...");
  const exitResult = await windowsController.exitFocus({
    hiddenApps: enterResult.hiddenApps
  });

  assert(Array.isArray(exitResult.restoredApps), "restoredApps should be an array");
  console.log(`[PASS] exitFocus executed successfully. Restored apps: [${exitResult.restoredApps.join(", ")}]`);

  // 5. Final state is clean
  const finalState = await windowsController.getState();
  assert.deepStrictEqual(finalState, { hiddenApps: [] });
  console.log("[PASS] State is clean after exitFocus");

  console.log("\n=== ALL WINDOWS FOCUS CONTROLLER TESTS PASSED! ===");
  process.exit(0);
}

runTest().catch((err) => {
  console.error("Windows controller test failed:", err);
  process.exit(1);
});
