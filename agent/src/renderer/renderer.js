// renderer.js — Focus Mode Agent UI

const pairingCodeEl = document.getElementById("pairingCode");
const statusBadge = document.getElementById("statusBadge");
const statusText = document.getElementById("statusText");
const allowListEl = document.getElementById("allowList");
const hiddenAppsEl = document.getElementById("hiddenApps");
const hiddenAppsCard = document.getElementById("hiddenAppsCard");
const countdownBlock = document.getElementById("countdownBlock");
const countdownEl = document.getElementById("countdown");
const endFocusBtn = document.getElementById("endFocus");
const quitBtn = document.getElementById("quit");

let countdownInterval = null;

function formatMMSS(ms) {
  if (ms <= 0) return "00:00";
  const totalSeconds = Math.ceil(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function startCountdown(endsAt) {
  stopCountdown();
  function tick() {
    const remaining = endsAt - Date.now();
    countdownEl.textContent = formatMMSS(remaining);
    if (remaining <= 0) stopCountdown();
  }
  tick();
  countdownInterval = setInterval(tick, 500);
}

function stopCountdown() {
  if (countdownInterval) {
    clearInterval(countdownInterval);
    countdownInterval = null;
  }
}

function renderState(state) {
  // Pairing code
  pairingCodeEl.textContent = state.pairingCode || "------";

  // Status badge
  const isFocusing = state.status === "FOCUSING";
  statusText.textContent = state.status || "IDLE";
  statusBadge.className = "status-badge " + (isFocusing ? "focusing" : "idle");

  // Countdown
  if (isFocusing && state.endsAt) {
    countdownBlock.classList.add("visible");
    startCountdown(state.endsAt);
  } else {
    countdownBlock.classList.remove("visible");
    stopCountdown();
    countdownEl.textContent = "--:--";
  }

  // Allowed apps
  allowListEl.innerHTML = "";
  const displayApps = ["Focus Mode Agent", ...(state.allowList || [])];
  const unique = [...new Set(displayApps)];
  unique.forEach((name) => {
    const li = document.createElement("li");
    li.textContent = name;
    allowListEl.appendChild(li);
  });

  // Hidden apps
  if (isFocusing && state.hiddenApps && state.hiddenApps.length > 0) {
    hiddenAppsCard.classList.add("visible");
    hiddenAppsEl.innerHTML = "";
    state.hiddenApps.forEach((name) => {
      const li = document.createElement("li");
      li.textContent = name;
      hiddenAppsEl.appendChild(li);
    });
  } else {
    hiddenAppsCard.classList.remove("visible");
    hiddenAppsEl.innerHTML = "";
  }

  // End Focus button
  endFocusBtn.disabled = !isFocusing;
}

async function initialize() {
  const state = await window.agentAPI.getState();
  renderState(state);
}

endFocusBtn.addEventListener("click", async () => {
  endFocusBtn.disabled = true;
  endFocusBtn.textContent = "Ending…";
  try {
    const state = await window.agentAPI.endFocus();
    renderState(state);
  } catch (e) {
    endFocusBtn.textContent = "⏹ End Focus Mode";
    endFocusBtn.disabled = false;
  }
});

quitBtn.addEventListener("click", () => {
  window.agentAPI.quit();
});

window.agentAPI.onStateChange((state) => {
  renderState(state);
});

initialize();
