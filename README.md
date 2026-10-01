# Focus Mode — Distraction Lockdown Dashboard

A MERN dashboard plus a local companion agent that turns a normal desktop into a
deliberate, time-boxed workspace. You start a focus session from the browser;
the agent running on your own machine — and only the agent — enforces it on the
operating system, then restores everything cleanly when the session ends.

> **Project status: foundation only.** The repository currently contains the
> specification and an empty workspace per component. No application code and
> no dependencies exist yet. See [SPEC.md](./SPEC.md) for the full design and
> [PROMPTS.md](./PROMPTS.md) for the ordered task list.

## Architecture overview

```
  browser tab  ──HTTPS/REST──▶  server/   Node.js + Express API  ──▶  MongoDB
  (client/)    ◀──────────────  cloud API            │
        │                                                 │ authorisation + history
        └──ws://127.0.0.1:<agentPort>──────────────────────┘
                          localhost WebSocket, paired
                                   │
                                   ▼
                            agent/  Electron + Node.js
                            the ONLY component allowed to touch the OS
                            tray icon, pairing, session state, fail-safe
```

- The **browser never controls the operating system.** It can only ask the
  agent, over a localhost WebSocket, to run `enterFocus(allowList)`,
  `exitFocus()` or `getState()`.
- The **agent is always visible** in the tray / menu bar and is the single
  enforcement point, behind a swappable OS-adapter interface.
- The **cloud API** owns accounts, devices, session history and the protected
  allow-list rules; it never enforces anything locally.
- Everything is **explicit, reversible and fail-safe**: if the link drops, the
  session times out or the agent crashes, the machine is restored on its own.

## Planned tech stack

| Layer | Choice | Notes |
| ----- | ------ | ----- |
| Client | React + Vite, TypeScript | SPA dashboard; React Router for pages |
| Client state | React Query (server data) + a small WebSocket store | agent state comes from the agent, not from optimistic UI |
| Client styling | CSS Modules (or Tailwind, decided in M1) | no design decision is locked yet |
| Server | Node.js, Express, TypeScript | REST API, MERN |
| Server data | MongoDB + Mongoose | users, devices, pairing requests, sessions, allow-list, audit |
| Server validation | Zod (proposed) | shared with the other workspaces through `shared/protocol` |
| Agent | Electron + Node.js, TypeScript | main process only for OS work; tray presence required |
| Agent platform layer | one OS adapter per OS (`win32` / `darwin` / `linux`) | the *only* module allowed to touch the system |
| Transport | REST over HTTPS + WebSocket on `127.0.0.1` | loopback-only agent socket, origin-validated |
| Contracts | one `shared/protocol` package (JSON-schema validated) | prevents client/server/agent drift |
| Tooling | ESLint + Prettier, Vitest, GitHub Actions | configured in M1, nothing installed yet |

No dependency is installed at this stage — versions are pinned when each
workspace is scaffolded.

## Planned folder structure

```
focus-mode/
├── client/                  # React dashboard (Vite SPA)      — owner: frontend dev
│   └── src/
│       ├── api/             # REST calls to the cloud API
│       ├── agent/           # localhost WebSocket manager, pairing flow
│       ├── components/      # reusable UI
│       ├── pages/           # dashboard, sessions, devices, history
│       └── state/           # agent/session state store
├── server/                  # Node.js + Express API            — owner: backend dev
│   └── src/
│       ├── config/          # env parsing + validation
│       ├── models/          # Mongoose schemas
│       ├── routes/          # REST endpoints
│       ├── services/        # pairing, sessions, allow-list
│       └── middleware/      # auth, error handling, validation
├── agent/                   # Electron companion (the OS authority) — owner: agent dev
│   └── src/
│       ├── main/            # Electron main process, tray, lifecycle
│       ├── pairing/         # 6-digit code flow, keychain storage
│       ├── session/         # state machine, watchdog, auto-exit
│       ├── allowlist/       # protected baseline merge
│       ├── os/              # OS adapters (one per platform) + stub
│       └── ws/              # loopback WebSocket server, envelope codec
├── shared/                  # message contracts + schemas (planned, M1)
│   └── protocol/
├── tests/                   # cross-component integration tests (planned)
├── SPEC.md                  # architecture, protocols, data models, safety rules
├── PROMPTS.md               # numbered task log
├── README.md
└── .gitignore
```

The three workspaces are independent: each gets its own `package.json`, lint
config and tests, so client, server, agent, contracts and QA can work in
parallel without stepping on each other.

## Development phases

| Phase | Contents | Done when |
| ----- | -------- | --------- |
| **M0 — Foundation** | docs, spec, prompts, gitignore, empty workspaces | this commit |
| **M1 — Contracts & tooling** | `shared/protocol`, envelope + message schemas, lint/test/CI | all three workspaces import the same schemas |
| **M2 — Server skeleton** | Express app, env validation, Mongo connection, health, error handling | `/health` responds, tests run |
| **M3 — Client skeleton** | Vite app, routing, layout, agent connection manager against a mock | dashboard builds and shows connection state |
| **M4 — Agent skeleton** | Electron main process, tray icon + menu, single instance, clean shutdown | tray is visible and the app never double-launches |
| **M5 — Pairing** | 6-digit code issue/consume, keychain credential, unpair | a real dashboard pairs with a real agent |
| **M6 — Agent state machine** | `enterFocus` / `exitFocus` / `getState` over a **stub** OS adapter | transitions unit-tested, no OS effect yet |
| **M7 — Protected allow-list** | one-directional baseline merge, server + agent | no input path can remove browser/agent/system apps |
| **M8 — Session UX** | start / extend / exit / history, driven by real agent state | UI never claims focus mode without agent confirmation |
| **M9 — Fail-safe** | disconnect grace timer, planned-end timeout, crash-recovery restore | killing the agent mid-session still restores the machine |
| **M10 — Real OS adapters** | per-platform enforcement behind the adapter interface | each platform has a tested restore path |
| **M11 — Hardening & packaging** | integration tests, threat-model review, installers, deployment | release candidate |

Real OS automation is deliberately last: nothing touches the OS until pairing,
the protected allow-list and the fail-safe paths are proven.

## Core safety rules (short version)

1. The agent is the only component that may interact with the OS.
2. The agent listens on `127.0.0.1` only and validates the WebSocket `Origin`.
3. Pairing needs a short-lived, single-use, hashed 6-digit code; the
   credential lives in the OS keychain.
4. The protected allow-list (browser, the agent itself, system-critical apps)
   can only be added to, never subtracted.
5. Exit is always available — dashboard, tray menu, hotkey — and no session is
   ever infinite.
6. Losing the link, reaching the planned end, or crashing the agent all end
   the session with a full restore.