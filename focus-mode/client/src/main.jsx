import React, { StrictMode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

const AGENT_URL = import.meta.env.VITE_AGENT_WS || "ws://127.0.0.1:8765";
const STORAGE_KEY = "focus-mode-device-key";
const DURATION_OPTIONS = [25, 50, 60];
const APP_OPTIONS = ["Google Chrome", "Microsoft Edge", "Firefox", "Visual Studio Code", "Terminal"];

const initialState = {
  status: "DISCONNECTED",
  endsAt: null,
  allowList: [],
  hiddenApps: [],
  focusSession: null,
  pairingCode: null,
  isPaired: false
};

function formatRemaining(endsAt) {
  const remaining = Math.max(0, Math.ceil((Number(endsAt) - Date.now()) / 1000));
  const minutes = String(Math.floor(remaining / 60)).padStart(2, "0");
  const seconds = String(remaining % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function Icon({ children }) { return <span className="icon" aria-hidden="true">{children}</span>; }

function App() {
  const [agentState, setAgentState] = useState(initialState);
  const [connected, setConnected] = useState(false);
  const [pairingCode, setPairingCode] = useState("");
  const [duration, setDuration] = useState(25);
  const [customDuration, setCustomDuration] = useState("");
  const [selectedApps, setSelectedApps] = useState(["Google Chrome"]);
  const [customApp, setCustomApp] = useState("");
  const [notice, setNotice] = useState("Start the companion agent to connect.");
  const [error, setError] = useState("");
  const [now, setNow] = useState(Date.now());
  const wsRef = useRef(null);
  const reconnectRef = useRef(0);
  const timerRef = useRef(null);

  const deviceKey = useRef(localStorage.getItem(STORAGE_KEY));
  const focusing = agentState.status === "FOCUSING";
  const effectiveDuration = customDuration ? Math.min(480, Math.max(1, Number(customDuration) || 25)) : duration;

  const send = useCallback((message) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      setError("The local agent is not connected. Start it, then try again.");
      return false;
    }
    wsRef.current.send(JSON.stringify(message));
    return true;
  }, []);

  const requestState = useCallback(() => {
    if (deviceKey.current) send({ type: "getState", deviceKey: deviceKey.current });
  }, [send]);

  useEffect(() => {
    let cancelled = false;
    const connect = () => {
      if (cancelled) return;
      const ws = new WebSocket(AGENT_URL);
      wsRef.current = ws;
      ws.onopen = () => {
        setConnected(true);
        reconnectRef.current = 0;
        setNotice("Local agent connected.");
        setError("");
        requestState();
      };
      ws.onmessage = (event) => {
        let message;
        try { message = JSON.parse(event.data); } catch { return; }
        if (message.type === "hello") {
          setAgentState((current) => ({ ...current, isPaired: message.paired, status: message.status || "IDLE" }));
          if (!message.paired) setNotice("Enter the six-digit code shown in the Focus Mode Agent.");
        } else if (message.type === "paired") {
          deviceKey.current = message.deviceKey;
          localStorage.setItem(STORAGE_KEY, message.deviceKey);
          setNotice("Dashboard paired securely with this agent.");
          setError("");
          requestState();
        } else if (message.type === "state") {
          const state = message.payload || message;
          setAgentState((current) => ({ ...current, ...state }));
        } else if (message.type === "focusStarted") {
          setNotice("Focus Mode is on. Your selected browser remains available.");
          requestState();
        } else if (message.type === "focusEnded") {
          setNotice("Focus Mode ended and hidden applications were restored.");
          requestState();
        } else if (message.type === "error") {
          setError(message.message || "The agent rejected this request.");
        }
      };
      ws.onclose = () => {
        if (cancelled) return;
        setConnected(false);
        setAgentState((current) => ({ ...current, status: current.status === "FOCUSING" ? "FOCUSING" : "DISCONNECTED" }));
        const retryDelay = Math.min(10000, 750 * 2 ** reconnectRef.current++);
        timerRef.current = window.setTimeout(connect, retryDelay);
      };
      ws.onerror = () => ws.close();
    };
    connect();
    return () => {
      cancelled = true;
      clearTimeout(timerRef.current);
      wsRef.current?.close();
    };
  }, [requestState]);

  useEffect(() => {
    if (!focusing) return undefined;
    const interval = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(interval);
  }, [focusing]);

  const timeRemaining = useMemo(() => agentState.endsAt ? formatRemaining(agentState.endsAt) : "00:00", [agentState.endsAt, now]);

  const toggleApp = (app) => {
    setSelectedApps((apps) => apps.includes(app) ? apps.filter((name) => name !== app) : [...apps, app]);
  };

  const addCustomApp = () => {
    const name = customApp.trim();
    if (!name) return;
    setSelectedApps((apps) => apps.includes(name) ? apps : [...apps, name]);
    setCustomApp("");
  };

  const pair = (event) => {
    event.preventDefault();
    if (!/^\d{6}$/.test(pairingCode.trim())) {
      setError("Enter the six-digit pairing code shown by the agent.");
      return;
    }
    setError("");
    send({ type: "pair", code: pairingCode.trim() });
  };

  const startFocus = () => {
    if (!deviceKey.current) {
      setError("Pair this dashboard with the local agent before starting Focus Mode.");
      return;
    }
    setError("");
    send({ type: "enterFocus", deviceKey: deviceKey.current, duration: effectiveDuration, allowList: selectedApps });
  };

  const endFocus = () => {
    if (deviceKey.current) send({ type: "exitFocus", deviceKey: deviceKey.current });
  };

  const statusLabel = focusing ? "Focusing" : connected ? "Connected" : "Disconnected";
  const protectedApps = ["Focus Mode Agent", "Browser", "System essentials"];

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark">✦</div><span>Focus Mode</span></div>
      <nav aria-label="Dashboard navigation">
        <a className="nav-item active" href="#dashboard"><Icon>⌂</Icon>Dashboard</a>
        <a className="nav-item" href="#focus"><Icon>◉</Icon>Focus session</a>
        <a className="nav-item" href="#allow-list"><Icon>✓</Icon>Allow-list</a>
      </nav>
      <div className="sidebar-foot"><span className="privacy-dot">●</span> Local agent connection</div>
    </aside>

    <main className="main-content" id="dashboard">
      <header className="topbar">
        <div><p className="eyebrow">YOUR FOCUS SPACE</p><h1>Good afternoon.</h1><p className="subtle">Choose what stays open, then let everything else step aside.</p></div>
        <div className={`agent-status ${statusLabel.toLowerCase()}`}><span className="status-dot" />{statusLabel}</div>
      </header>

      {(error || notice) && <div className={`notice ${error ? "notice-error" : ""}`} role="status">{error || notice}</div>}

      {!deviceKey.current && <section className="pair-card" aria-labelledby="pair-heading">
        <div><p className="eyebrow">ONE-TIME SETUP</p><h2 id="pair-heading">Pair your companion agent</h2><p>Open Focus Mode Agent, then enter the six-digit code shown there. The code never leaves this computer.</p></div>
        <form onSubmit={pair} className="pair-form"><label htmlFor="pair-code">Pairing code</label><div><input id="pair-code" inputMode="numeric" maxLength="6" value={pairingCode} onChange={(e) => setPairingCode(e.target.value.replace(/\D/g, ""))} placeholder="000000" /><button type="submit" disabled={!connected}>Pair agent</button></div></form>
      </section>}

      <section className={`focus-hero ${focusing ? "focus-active" : ""}`} id="focus">
        <div className="focus-copy">
          <p className="eyebrow">{focusing ? "FOCUS MODE IS ON" : "READY WHEN YOU ARE"}</p>
          <h2>{focusing ? "Stay with the task." : "Begin a calm focus session."}</h2>
          <p>{focusing ? "Your agent will restore only the applications it hid when this session ends." : "Your browser and selected applications stay available. Everything else steps aside."}</p>
          {focusing ? <button className="danger-button" onClick={endFocus}>End Focus Mode</button> : <button className="primary-button" onClick={startFocus} disabled={!connected || !deviceKey.current}>Start Focus Mode <span>→</span></button>}
        </div>
        <div className="timer-panel" aria-live="polite"><div className="timer-ring"><span>{focusing ? timeRemaining : `${effectiveDuration}:00`}</span></div><strong>{focusing ? "remaining" : "selected"}</strong><small>{focusing ? `${agentState.hiddenApps?.length || 0} app(s) stepped aside` : `${effectiveDuration} minute session`}</small></div>
      </section>

      <div className="dashboard-grid">
        <section className="card duration-card"><div className="card-heading"><div><p className="eyebrow">SESSION LENGTH</p><h2>How long do you need?</h2></div></div>
          <div className="duration-options">{DURATION_OPTIONS.map((option) => <button key={option} className={!customDuration && duration === option ? "selected" : ""} onClick={() => { setDuration(option); setCustomDuration(""); }}>{option}<small>min</small></button>)}<label className={customDuration ? "selected custom-duration" : "custom-duration"}>Custom<input aria-label="Custom duration in minutes" type="number" min="1" max="480" placeholder="min" value={customDuration} onChange={(e) => setCustomDuration(e.target.value)} /></label></div>
        </section>

        <section className="card allow-card" id="allow-list"><div className="card-heading"><div><p className="eyebrow">ALLOW-LIST</p><h2>What stays available?</h2></div><span className="count-badge">{selectedApps.length} selected</span></div>
          <p className="card-description">Focus Mode always preserves the agent, your browser, and system essentials.</p>
          <div className="app-options">{APP_OPTIONS.map((app) => <label key={app} className="app-check"><input type="checkbox" checked={selectedApps.includes(app)} onChange={() => toggleApp(app)} /><span>{selectedApps.includes(app) ? "✓" : ""}</span>{app}</label>)}</div>
          {selectedApps.filter((app) => !APP_OPTIONS.includes(app)).map((app) => <button className="custom-app" key={app} onClick={() => setSelectedApps((apps) => apps.filter((name) => name !== app))}>{app} <span aria-label={`Remove ${app}`}>×</span></button>)}
          <div className="add-app"><input value={customApp} onChange={(e) => setCustomApp(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addCustomApp()} placeholder="Add another application" /><button onClick={addCustomApp}>Add</button></div>
        </section>
      </div>

      <section className="state-row">
        <article className="state-card"><p className="eyebrow">AGENT STATE</p><h3>{agentState.status || "IDLE"}</h3><p>{connected ? "Secure local WebSocket connected" : "Looking for agent on port 8765"}</p></article>
        <article className="state-card"><p className="eyebrow">HIDDEN THIS SESSION</p><h3>{agentState.hiddenApps?.length || 0}</h3><p>{focusing && agentState.hiddenApps?.length ? agentState.hiddenApps.join(", ") : "Nothing hidden right now"}</p></article>
        <article className="state-card"><p className="eyebrow">ALWAYS PROTECTED</p><h3>{protectedApps.length}</h3><p>{protectedApps.join(" · ")}</p></article>
      </section>
    </main>
  </div>;
}

createRoot(document.getElementById("root")).render(<StrictMode><App /></StrictMode>);
