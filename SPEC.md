# SPEC.md — Focus Mode: Distraction Lockdown Dashboard

> Status: **foundation / specification**. This document defines the target
> system. Nothing described here is implemented yet — see *Milestones* for the
> build order and *Out of scope right now* for what deliberately does not exist
> yet.

---

## 1. Project overview

Focus Mode is a MERN dashboard plus a local companion agent that turns a normal
desktop into a deliberate, time-boxed workspace.

A signed-in user starts a **focus session** from the web dashboard. The request
travels to the cloud API, is validated and recorded, and is then relayed to the
Focus Mode agent running on that user's own machine. The agent — and only the
agent — enforces the session on the operating system: distracting applications
are blocked, the allowed applications keep working, and everything is restored
when the session ends.

Design goals, in priority order:

1. **Safe** — a bug must never lock a user out of their own machine.
2. **Explicit** — nothing changes without an intentional, visible action.
3. **Reversible** — every enforced change can be undone, at any time.
4. **Fail-safe** — if the agent dies, the network drops or the server errors,
   the OS returns to its normal state on its own.
5. **Honest** — the UI always reflects real agent state, never an optimistic
   guess.

Non-goals: enterprise device management, surveillance of other users,
background activity tracking, or "nanny mode" features that hide enforcement
from the user. The agent is always visibly present in the tray.

---

## 2. Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                        CLOUD (remote, trusted-ish)                   │
│                                                                      │
│   Browser tab ──HTTPS/JSON──►  server/  (Node.js + Express API)      │
│                     ▲                      │                         │
│        REST (auth, sessions,             Mongoose                   │
│        history, allow-list)                  │                         │
│                                            ▼                         │
│                                      MongoDB (Atlas / self-hosted)   │
└──────────────────────────────────────────────────────────────────────┘
             ▲ REST (validation + persistence)
             │
┌────────────┴─────────────────────────────────────────────────────────┐
│                        CLIENT (browser tab)                           │
│   client/  React + Vite SPA                                           │
│   - talks to the cloud API over HTTPS                                │
│   - talks to the agent over ws://127.0.0.1:<agentPort> (localhost)   │
│   - NEVER touches the OS; renders state reported by the agent        │
└────────────┬─────────────────────────────────────────────────────────┘
             │ WebSocket, loopback only
             │ agent must be paired (short-lived 6-digit code)
             ▼
┌──────────────────────────────────────────────────────────────────────┐
│               AGENT (this machine, runs as the user)                 │
│   agent/  Electron main process + tray/menu-bar icon                │
│   - the ONLY component that interacts with the OS                    │
│   - owns: pairing, allow-list resolution, session state machine,      │
│           OS adapter, watchdog / auto-exit, audit of local events     │
│   - binds 127.0.0.1 only — never 0.0.0.0, never a public port        │
└──────────────────────────────────────────────────────────────────────┘
```

Data flow for "start a 50-minute session":

1. Browser → server: `POST /api/sessions` with `{ deviceId, durationMinutes, allowListExtras }`.
2. Server: authenticates the user, verifies device ownership, merges the extra
   allow-list entries with the **protected baseline**, writes a `focusSession`
   document in state `requested`, and returns the session + a short-lived
   **command token**.
3. Browser → agent: `focus.enter` message containing only the command token and
   the session id.
4. Agent: rejects the request if it is not paired, if the token is expired or
   unknown, or if another session is already active. It resolves the effective
   allow-list (extras + protected baseline, never fewer), starts its watchdog,
   then asks the **OS adapter** to enforce. The adapter is the only module that
   may touch the system.
5. Agent → browser: `focus.entered` with the real enforced state, or `error`.
6. Agent → server: `POST /api/sessions/:id/state` (authenticated as the paired
   device) so the cloud record matches reality.
7. On exit (user action, timeout, watchdog, crash) the agent restores the
   system, marks the session accordingly and the server records the reason.

---

## 3. The three major components

| Component | Folder | Runtime | Owner role |
| --------- | ------ | ------- | ---------- |
| **Client** — React dashboard | `client/` | Browser tab (Vite SPA) | Frontend developer |
| **Server** — cloud API | `server/` | Node.js + Express + Mongoose | Backend developer |
| **Agent** — local companion | `agent/` | Electron main process (Node.js) | Agent / systems developer |
| **Contracts** — shared message shapes | `shared/` (planned, Prompt 002) | imported by all three | Integration developer |
| **QA / integration** | `tests/` (planned) | end-to-end harness | 5th developer |

Each folder is a self-contained workspace with its own `package.json`,
dependencies, linting and tests, so the three can be developed, reviewed and
released in parallel. Shared *wire formats* live in one place
(`shared/protocol`) precisely so that client, server and agent cannot drift.

---

## 4. Responsibilities

### 4.1 Client (`client/`) — React dashboard

- Render the dashboard: sign-in, device list, session controls, allow-list
  editor, session history, agent status.
- Hold the **cloud session** (JWT in httpOnly cookie or equivalent) and call
  the server REST API.
- Maintain the **localhost WebSocket connection** to the agent: connect,
  heartbeat, reconnect with backoff, surface connection status in the UI.
- Run the **pairing flow**: ask the server for a code, show it to the user,
  relay the code to the agent, poll/receive the pairing result.
- Send only high-level intents (`enterFocus`, `exitFocus`, `getState`) and
  **always render the agent's reported state** — never an optimistic local
  guess.
- Never import Node/Electron APIs, never attempt OS access, never open an
  inbound port.
- Not responsible for: trusting the browser as a security boundary, deciding
  which OS processes are protected, or persisting session truth (the agent and
  server own that).

### 4.2 Server (`server/`) — cloud API

- Expose a REST API for authentication, devices, sessions, allow-list
  preferences and history.
- Validate every request; never trust the client to enforce the protected
  allow-list — the baseline is applied server-side *and* agent-side.
- Persist users, paired devices, pairing requests, focus sessions, allow-list
  entries, protected-reference data and audit events in MongoDB via Mongoose.
- Issue short-lived, single-use pairing codes and command tokens.
- Serve as the source of truth for session history and reporting.
- Relay nothing implicitly: the browser→agent leg is direct over loopback; the
  server authorises it and records it.
- Not responsible for: OS control, agent lifecycle, holding long-lived local
  state, or accepting an "enforced" state from a client without an agent
  acknowledgement.

### 4.3 Agent (`agent/`) — local companion (the only OS authority)

- Run as a background Electron app with a **visible tray / menu-bar icon**
  (required; an invisible agent is unacceptable).
- Listen on `127.0.0.1` only, validate the `Origin` of WebSocket handshakes,
  and reject all traffic from unpaired clients.
- Implement pairing with a **short-lived 6-digit code**, store the pairing
  credential in the OS keychain/credential store, and support unpairing.
- Expose exactly three intents: `enterFocus(allowList)`, `exitFocus()`,
  `getState()` — plus pairing and lifecycle messages.
- Resolve the effective allow-list = requested extras ∪ protected baseline
  (browser, the agent itself, system-critical apps, shell/compositor, auth/
  input services, disk & network daemons).
- Drive the OS **only** through an OS-adapter interface, so Windows / macOS /
  Linux enforcement is isolated in one swappable module.
- Own the session state machine, the watchdog and the auto-exit path, and
  recover to a clean system state on start-up if it finds an unclean shutdown.
- Report state changes to the client and the server; keep a local activity
  log for debugging.
- Not responsible for: user accounts, long-term history, or trusting the
  browser to supply the protected baseline.

---

## 5. WebSocket communication concept

**Transport.** The dashboard opens `ws://127.0.0.1:<AGENT_PORT>/agent`
(configurable, proposed default `17389`). The agent is the WebSocket
**server**, bound to loopback only. Binding to `0.0.0.0` or any external
interface is forbidden by code review rule and by the agent's config loader.

**Why loopback and not a cloud relay?** The agent must remain reachable while
the user works, must work when the cloud API is unreachable, and must not
require the dashboard's origin to be trusted by a public socket. Cloud traffic
never carries enforcement instructions; it only carries authorisation and
history.

**Localhost is not a trust boundary.** Any website the user visits can attempt
a `ws://127.0.0.1` connection. Therefore the agent:

- validates the HTTP `Origin` / `Host` header and only accepts the dashboard
  origin(s) configured for this install (default: `http://localhost:*` and
  `http://127.0.0.1:*` in development, pinned to the deployed origin in
  production);
- requires a completed pairing before accepting any command;
- authorises each message against the paired credential;
- rate-limits handshakes and rejects oversized messages before parsing.

**Lifecycle.**

```
agent not running ──(dashboard retries with backoff)──▶ agent running
        │
        ▼
   UNPAIRED ──pair.request(code)──▶ PAIRING ──ok──▶ PAIRED ──▶ READY
        ▲                              │ fail                        │
        └──────────── unpair / reset ◀─┴──────────── revoke ◀───────┘
                                                             │
                                          session active: ACTIVE / EXITING
```

**Protocol rules.**

- Every message is a JSON **envelope** with a `version`, `type`, `id`,
  `timestamp`, optional `replyTo`, and `payload`. Unknown `version` or `type`
  → structured error, never a crash.
- Requests that change system state are always answered with an explicit
  acknowledgement (`focus.enter.accepted` → `focus.entered`, or `error`).
  Commands are idempotent: re-sending `enterFocus` for an active session
  returns the current state instead of stacking enforcement.
- Heartbeat `ping` / `pong` every N seconds (proposed 15 s / 10 s timeout);
  missing heartbeats mark the link down and arm the fail-safe timer.
- The agent answers `getState` at any time; the dashboard polls it on mount,
  on reconnect and after every user action.
- Frame size limit and message rate limit enforced on the agent side.

**Envelope (proposed shape, v1)**

```jsonc
{
  "version": 1,
  "type": "focus.enter",
  "id": "msg_01H...",        // unique per message
  "replyTo": null,           // set on responses
  "timestamp": "2026-01-01T10:00:00.000Z",
  "payload": { }
}
```

### 5.1 Planned agent messages

Naming: `pair.*`, `focus.*`, `state.*`, `sys.*`. All payloads are *proposed*;
they are frozen in Prompt 002 before any component implements them.

| Direction | Type | Purpose | Safety note |
| --------- | ---- | ------- | ----------- |
| client → agent | `pair.request` | Pair with a 6-digit code shown by the dashboard | Code expires, single use, attempt-limited |
| agent → client | `pair.result` | `paired` \| `rejected` (expired / wrong / already paired) | No detail leakage that helps brute force |
| client → agent | `unpair.request` | Remove stored pairing credential | Always allowed, locally |
| agent → client | `state.push` | Unsolicited state change (user exited from tray, watchdog fired) | Keeps UI truthful |
| client → agent | `getState` | `getState()` | Read-only, always safe |
| agent → client | `state.result` | Full agent state snapshot | Source of truth for the UI |
| client → agent | `focus.enter` | `enterFocus(allowList)` — payload carries session id + command token, not raw policy | Agent re-resolves the protected baseline |
| agent → client | `focus.enter.accepted` | Request validated, enforcement starting | |
| agent → client | `focus.entered` | System actually enforced; includes effective allow-list | Only sent after OS adapter confirms |
| client → agent | `focus.exit` | `exitFocus()` | Always honoured, even mid-enforcement |
| agent → client | `focus.exit.accepted` / `focus.exited` | Restoration progress / result | |
| client → agent | `focus.extend` | Request a longer session (Prompt for later) | Bounded by a maximum, never infinite |
| agent → client | `session.state` | Session state-machine snapshot | |
| either | `ping` / `pong` | Liveness | Missed heartbeat arms fail-safe |
| either | `error` | Structured error `{ code, message, retryable }` | Codes are a fixed enum |

**Agent-internal flow of `focus.enter`**

```
validate envelope & size
  → agent paired?                     no  → error(UNAUTHENTICATED)
  → command token valid & unexpired?   no  → error(TOKEN_INVALID)
  → no session already active?     active → return current state (idempotent)
  → resolve allow-list = extras ∪ protected baseline (baseline cannot be removed)
  → pre-flight checks (policy, disk, adapter availability) → else FAILED, no change
  → arm watchdog with disconnect grace timer
  → OS adapter.apply(...)              fail → rollback any partial change, report
  → persist local session, notify tray, reply focus.entered
  → POST state to server
```

**State reported by `getState()` / `state.result`**

```jsonc
{
  "agent": { "version": "0.0.0", "platform": "win32|darwin|linux" },
  "pairing": { "paired": false, "pairedAt": null, "label": null },
  "session": {
    "state": "IDLE|PAIRING|READY|ENTERING|ACTIVE|EXTENDING|EXITING|FAILED",
    "sessionId": null,
    "startedAt": null,
    "plannedEndAt": null,
    "exitReason": null          // USER | TIMEOUT | WATCHDOG | CRASH_RECOVERY | AGENT_QUIT | ERROR
  },
  "allowList": { "effective": [], "protectedCount": 0, "extrasCount": 0 },
  "safety": { "watchdogArmed": false, "graceSeconds": 0, "autoExitOnDisconnect": true },
  "agentHealthy": true
}
```

---

## 6. Core data models

MongoDB via Mongoose. Field lists below are the *contract to implement in
Prompts 004–007*; validators, indexes and TTL behaviour are specified with each
prompt. `_id`/`createdAt`/`updatedAt` are added to every collection.

### 6.1 `users`

| Field | Type | Notes |
| ----- | ---- | ----- |
| `email` | String, unique, indexed | login identifier |
| `displayName` | String | shown in UI |
| `passwordHash` | String | hashed; OAuth provider id instead if that flow is chosen |
| `role` | Enum | `user` \| `admin` |
| `settings.defaultSessionMinutes` | Number | server-side default |
| `settings.maxSessionMinutes` | Number | hard cap enforced by the server |
| `settings.autoExitOnDisconnect` | Boolean | default `true` |
| `settings.disconnectGraceSeconds` | Number | default 30 |
| `settings.allowListExtras` | [ObjectId → `allowListEntries`] | user-added apps only |

### 6.2 `devices` (paired agents)

| Field | Type | Notes |
| ----- | ---- | ----- |
| `userId` | ObjectId → `users` | owner |
| `label` | String | "Work laptop" |
| `agentId` | String, unique | stable agent identity (generated at first run) |
| `platform` | Enum | `win32` \| `darwin` \| `linux` |
| `agentVersion` | String | reported on connect |
| `status` | Enum | `pending` \| `paired` \| `revoked` |
| `credentialHint` | String | non-secret fingerprint for UI (e.g. hash prefix) |
| `pairedAt` / `lastSeenAt` / `revokedAt` | Date | presence tracking |

### 6.3 `pairingRequests`

| Field | Type | Notes |
| ----- | ---- | ----- |
| `userId` | ObjectId → `users` | requester |
| `codeHash` | String | **hashed** 6-digit code, never stored in plain text |
| `expiresAt` | Date | TTL index — the code is deleted by MongoDB |
| `maxAttempts` / `attempts` | Number | proposed 5 / counter |
| `consumedAt` | Date | set on successful pairing; code is single-use |
| `deviceId` | ObjectId → `devices` | filled after success |
| `status` | Enum | `open` \| `consumed` \| `expired` \| `rejected` |

Proposed TTL / validity: **6 digits, 5 minutes, single use, 5 attempts.**

### 6.4 `focusSessions`

| Field | Type | Notes |
| ----- | ---- | ----- |
| `userId` / `deviceId` | ObjectId | who and where |
| `state` | Enum | `requested` \| `active` \| `exiting` \| `exited` \| `failed` \| `auto_exited` |
| `plannedDurationMinutes` | Number | requested length |
| `plannedStartAt` / `plannedEndAt` | Date | schedule |
| `startedAt` / `endedAt` | Date | actual enforcement window |
| `actualDurationSeconds` | Number | written on close |
| `exitReason` | Enum | `USER` \| `TIMEOUT` \| `WATCHDOG` \| `CRASH_RECOVERY` \| `AGENT_QUIT` \| `ERROR` |
| `allowListSnapshot` | [Object] | effective allow-list as enforced (immutable record) |
| `blockedSnapshot` | [Object] | what was blocked, if the adapter reports it |
| `requestedBy` | Object | `{ clientVersion, userAgent }` for auditing |
| `commandTokenHash` / `tokenExpiresAt` | String / Date | one-time authorisation for the agent |

### 6.5 `allowListEntries`

| Field | Type | Notes |
| ----- | ---- | ----- |
| `userId` | ObjectId → `users` | owner (null for shipped defaults) |
| `label` | String | user-facing name |
| `platformMatchers` | [{ platform, kind, value }] | `kind`: `process` \| `bundleId` \| `path` \| `appName` \| `service` |
| `category` | Enum | `user` \| `protected` \| `system_critical` |
| `locked` | Boolean | `true` for protected/system-critical — cannot be deleted or demoted |

### 6.6 `protectedBaseline` (shipped reference data, read-only)

Versioned JSON shipped with the agent and mirrored server-side for validation.
Categories that **must** always survive merging:

- the **browser** the user is working in (so the dashboard stays reachable),
- the **Focus Mode agent** itself,
- system-critical applications and services: window manager / shell /
  compositor, login & lock screen, input and accessibility services, audio
  and notification daemons, disk / file-system / network core services,
  security and authentication agents, and (Windows) the Windows shell,
  Defender and Update services.

The merge rule is one-directional: `effective = userExtras ∪ protectedBaseline`.
There is no code path that subtracts from the baseline.

### 6.7 `auditEvents` (append-only)

| Field | Type | Notes |
| ----- | ---- | ----- |
| `userId` / `deviceId` / `sessionId` | ObjectId | context |
| `type` | String | `PAIR_REQUESTED`, `DEVICE_PAIRED`, `SESSION_REQUESTED`, `SESSION_ENTERED`, `SESSION_EXITED`, `AUTO_EXIT`, `POLICY_VIOLATION_ATTEMPT` |
| `at` | Date | indexed, immutable |
| `metadata` | Object | redacted; never stores raw credentials |

---

## 7. Security and safety principles

These are acceptance criteria, not suggestions. A change that violates one of
them does not merge.

**Authority**

1. The **agent is the only OS authority.** The browser and the server can never
   reach the OS. All enforcement lives behind the OS-adapter interface in the
   agent.
2. The browser is **untrusted input**. Every message is schema-validated,
   size-limited and rate-limited on the agent side.

**Pairing & transport**

3. The agent binds **loopback only** (`127.0.0.1`), never `0.0.0.0`.
4. WebSocket handshakes validate **`Origin` and `Host`**; anything else is
   rejected (protection against other websites reaching the local socket).
5. Pairing requires a **short-lived 6-digit code**: hashed at rest, single
   use, TTL-expiring (proposed 5 minutes), attempt-limited, and useless once
   consumed.
6. The pairing credential is stored in the **OS keychain** / credential store,
   never in plain config or `localStorage`.
7. `unpair` and local tray "forget device" always work, even without the cloud
   account or network.

**Allow-list integrity**

8. The protected baseline **cannot be removed** by user input, API call or
   agent logic; merging is one-directional (extras ∪ baseline).
9. The effective allow-list is resolved **twice**: server-side for validation
   and record, agent-side for enforcement. A mismatch is a bug, not a fallback.
10. The **agent itself and the browser are always allowed** — otherwise the
    user could lose the very tools needed to undo enforcement.

**Explicit & reversible**

11. Every state change is an **explicit, acknowledged** action: no implicit
    start on page load, on reconnect, or on a timer the user did not create.
12. **Exit is always available** — from the dashboard, from the tray menu, and
    (proposed) via a global hotkey. No confirmation-only gating for exit.
13. The tray icon **reflects real state** (idle / active / restoring / error)
    and its menu always offers a clear "Exit focus mode" item.
14. Enforcement is **reversible**: the agent records what it changed and can
    undo it exactly; partial failures roll back rather than leaving a machine
    half-locked.

**Fail-safe**

15. **Disconnect ⇒ release.** If the dashboard connection drops during a
    session, the agent starts a grace timer (proposed 30 s) and exits focus if
    it does not recover. The user is never locked out by a network problem.
16. **Crash recovery.** The agent writes a marker before enforcing and clears
    it after restoring; if it starts up with a stale marker, it restores the
    system first.
17. **Bounded sessions.** Duration is always finite and capped server-side
    (proposed max 8 h); there is no "indefinite focus" mode.
18. **Timeout wins.** If the session reaches `plannedEndAt`, the agent exits —
    even if the dashboard is still connected and asking for more.

**Data & privacy**

19. The server stores **no** browsing history, window titles, keystrokes or
    screenshots. It stores what was allowed, when, and how the session ended.
20. Credentials and pairing codes are never logged in plain text; audit events
    are redacted.
21. The agent is a **user-space, user-session** process: it must never require
    or request administrator/root privileges to restore state.

**Honesty**

22. The UI shows the agent's **reported** state, plus an explicit
    "agent unreachable" banner when the loopback link is down. No optimistic
    "focus mode on" that the agent has not confirmed.

---

## 8. Development milestones

Ordered so that each milestone is verifiable before the next, and so the
five owners (client / server / agent / contracts / QA) can work in parallel
once M1 lands.

| ID | Milestone | Owner | Exit criteria |
| -- | --------- | ----- | ------------- |
| M0 | **Foundation & docs** (this repo state) | all | SPEC, README, PROMPTS, .gitignore, empty workspaces |
| M1 | Contracts & tooling | contracts dev | `shared/protocol` with envelope + message schemas, JSON-schema validation used by all three, CI running lint + unit tests |
| M2 | Server skeleton | server dev | Express app boots, config/env validation, Mongo connection, `/health`, error middleware, tests |
| M3 | Client skeleton | client dev | Vite React app builds, router, layout, auth page stub, WS connection manager with mock transport |
| M4 | Agent skeleton | agent dev | Electron app starts, tray icon + menu with Quit/Unpair, single-instance lock, graceful shutdown |
| M5 | Pairing end-to-end | server + agent + client | 6-digit code issued by server, consumed by agent, credential in keychain, `paired` state visible in UI, unpair works |
| M6 | Agent state machine (no OS effects) | agent dev | `enterFocus`/`exitFocus`/`getState` implemented against a **stub OS adapter**; full unit-tested transitions |
| M7 | Protected allow-list | agent + server | Baseline merge is one-directional, unit-tested, cannot be subtracted via any input path |
| M8 | Dashboard session UX | client dev | Start / extend / exit / history screens driven by real agent state, offline banners |
| M9 | Fail-safe & watchdog | agent dev | Disconnect grace timer, planned-end timeout, crash-recovery restore marker — all tested with the agent killed mid-session |
| M10 | Real OS adapters | agent dev | Per-platform adapters behind the interface; each with a tested restore path and a manual QA checklist |
| M11 | Integration, hardening, packaging | QA + all | Contract tests, threat-model review, installers for the agent, dashboard deployment |

Critical path: **M1 → M2/M3/M4 → M5 → M6 → M7 → M9 → M10**. Real OS work is
last on purpose: nothing may touch the OS until pairing, the protected
allow-list and the fail-safe paths are proven.

## Out of scope right now (deliberate)

- No focus logic, no OS automation, no Electron main-process code.
- No `package.json` files and **no dependencies** installed yet.
- No fake screens, fake endpoints or stubbed "working" features — only the plan.
- No packaging, CI or deployment config yet (Prompt 002 / M1).

## Open questions for the team

1. Auth method: email + password, or OAuth providers only?
2. Cloud deployment target (affects allowed `Origin` list and cookie policy)?
3. Which platforms ship in v1 — is Windows-only acceptable for the first
   adapter, with macOS/Linux following?
4. Enforcement mechanism per platform: process kill / suspend, window-hiding
   hooks, or OS focus-mode APIs (Windows `IFocusSession`)? The adapter
   interface must not be designed around one of these prematurely.
5. Should a session be allowed to survive a dashboard reload (keep-alive) or
   always exit on disconnect (default: exit, per principle 15)?