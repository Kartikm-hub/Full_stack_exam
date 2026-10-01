# PROMPTS.md — Focus Mode

This file is the **single source of truth for the task breakdown** of the
Focus Mode project. Every development task in the project is recorded here as a
numbered prompt, together with its intent, constraints and completion status.

## How this file is used

1. Prompts are numbered sequentially: `Prompt 001`, `Prompt 002`, …
2. A prompt is added **before** the work starts (planning) and its status is
   updated **after** the work is reviewed.
3. A prompt must be small enough to be owned by one person / one component.
4. Prompts must never demand OS automation before the safety scaffolding
   (pairing, allow-list, fail-safe) exists.

## Status legend

| Status | Meaning |
| ------ | ------- |
| `planned` | Written down, not started |
| `in progress` | Actively being implemented |
| `in review` | Implementation done, awaiting review |
| `done` | Merged and reviewed |
| `blocked` | Cannot proceed, reason recorded in the entry |

## Prompt log

| ID | Title | Component | Status |
| -- | ----- | --------- | ------ |
| 001 | Project foundation & documentation | repo / all | done |
| 002 | Client foundation: React + Vite + Tailwind + Router | client | done |
| 003 | Shared message contracts & tooling | all | done |
| 004 | Server: project scaffold, config & health | server | planned |
| 005 | Server: User & auth data models | server | planned |
| 006 | Server: Device pairing data models + API | server | planned |
| 007 | Server: Focus session data models + API | server | planned |
| 008 | Server: audit log collection & write path | server | planned |
| 009 | Client: auth pages wiring & route guards | client | planned |
| 010 | Client: agent connection manager (WebSocket) | client | planned |
| 011 | Client: pairing UI (6-digit code flow) | client | planned |
| 012 | Client: session control UI (enter / extend / exit) | client | planned |
| 013 | Client: agent state & system status views | client | planned |
| 014 | Agent: Electron scaffold + tray presence | agent | planned |
| 015 | Agent: config, single-instance & logging | agent | planned |
| 016 | Agent: loopback WebSocket server + envelope codec | agent | planned |
| 017 | Agent: pairing handler & credential storage | agent | planned |
| 018 | Agent: session state machine (no OS effects yet) | agent | planned |
| 019 | Agent: protected allow-list resolution | agent | planned |
| 020 | Agent: OS adapter interface + stub adapter | agent | planned |
| 021 | Agent: fail-safe watchdog & auto-exit | agent | planned |
| 022 | Integration: contract tests across all three | integration | planned |
| 023 | OS adapter: real implementation (later milestone) | agent | planned |
| 024 | Hardening, threat model review & packaging | all | planned |

---

# Prompt 001 — Project foundation & documentation

- **Component:** repository / all
- **Status:** `done`
- **Depends on:** none
- **Blocks:** Prompt 002
- **Scope:** documentation and repository scaffolding only

## Original prompt

> You are working on a team-based full-stack examination project called
> "Focus Mode — Distraction Lockdown Dashboard".
>
> Read and understand the following project requirements before writing code:
>
> - The project is a MERN web dashboard.
> - React is the dashboard.
> - Node.js + Express is the cloud API.
> - MongoDB is the database.
> - Electron + Node.js is the local companion agent.
> - The browser must NOT directly control the operating system.
> - The browser communicates with the local Electron agent through a
>   localhost WebSocket connection.
> - The agent is the ONLY component allowed to interact with the OS.
> - The agent must have a visible tray/menu-bar presence.
> - The agent must support pairing through a short-lived 6-digit code.
> - The agent must eventually expose:
>     enterFocus(allowList)
>     exitFocus()
>     getState()
> - The protected allow-list must always preserve the browser, agent,
>   and system-critical applications.
> - The system must be safe, explicit, reversible and fail-safe.
>
> For this first task, DO NOT implement the actual focus/OS-control
> functionality.
>
> Instead, ONLY create the project foundation.
>
> Create this repository structure:
>
> ```
> focus-mode/
> ├── client/
> ├── server/
> ├── agent/
> ├── SPEC.md
> ├── PROMPTS.md
> ├── README.md
> └── .gitignore
> ```
>
> Requirements:
>
> 1. Create a sensible .gitignore for Node.js, React, Vite, Electron and
>    environment files.
> 2. Create SPEC.md containing: project overview, architecture, three major
>    components, responsibilities of client/server/agent, WebSocket
>    communication concept, planned agent messages, core data models,
>    security and safety principles, and development milestones.
> 3. Create PROMPTS.md and record this prompt as Prompt 001.
> 4. Create README.md with: project name, short description, architecture
>    overview, planned tech stack, planned folder structure, and development
>    phases.
> 5. Do NOT generate fake features.
> 6. Do NOT create the complete application.
> 7. Do NOT implement OS automation.
> 8. Do NOT add unnecessary dependencies.
> 9. Keep the architecture modular so 5 developers can work independently on
>    client, server, agent and integration.
>
> Before finishing, inspect the generated files and explain what you created,
> why each file exists, and what should be built next.
>
> Do not modify files outside this repository.

## What was delivered

- `.gitignore` — ignores for Node, React, Vite, Electron, env/secret files,
  caches, logs, coverage and OS noise.
- `SPEC.md` — overview, architecture, component responsibilities, WebSocket
  concept, planned agent messages, data models, safety principles, milestones.
- `README.md` — project name, description, architecture, planned stack,
  planned folder structure, development phases.
- `PROMPTS.md` — this file, with Prompt 001 and the planned prompt backlog.
- `client/`, `server/`, `agent/` — empty component workspaces, each holding only
  a short scope note (`README.md`) that states what belongs there.

## Explicitly NOT done in this prompt

- No `package.json`, no dependencies installed, no build tooling configured.
- No OS automation, no focus logic, no Electron main process code.
- No fake screens, endpoints or UI — only the documented plan.

---

# Prompt 003 — Shared message contracts & tooling

- **Component:** all (shared contract package)
- **Status:** `done`
- **Depends on:** Prompt 001
- **Blocks:** Prompts 004, 006, 010, 016, 022
- **Scope:** the wire contract only. No transport, no business logic.

## Purpose

Stop the client, the server and the agent from inventing three different
message formats. The envelope, payload contracts, error codes and state
vocabularies from SPEC.md §5, §6.4 and §7 are frozen here as executable,
tested contracts, so a malformed message becomes a validation error instead of
a partially enforced focus session.

Core rule encoded throughout: **reject, never repair.** A message that is
almost valid is invalid.

## Files created

```
shared/protocol/
├── package.json              @focus-mode/protocol, zero runtime dependencies
├── README.md                 contract documentation
├── src/
│   ├── envelope.js           createEnvelope / createReply / createMessageId /
│   │                         validateEnvelope / validateMessage, versioning
│   ├── messages.js           17 message types, directions, payload contracts
│   ├── errors.js             13 fixed error codes, ProtocolError, retryable table
│   ├── state.js              agent states, focus-session states, exit reasons
│   └── index.js              public entry point re-exporting all of the above
└── test/
    ├── envelope.test.js      creation, ids, timestamps, version/type/id rejection
    ├── messages.test.js      every type's payload contract, unknown fields
    └── constants.test.js     error-code table and both state vocabularies
```

## Files changed

- `client/vite.config.js` — added the `@protocol` alias pointing at
  `shared/protocol/src`, plus `server.fs.allow` so Vite may serve it. Aliasing
  the source (rather than installing a copy) means the dashboard always
  compiles against the contracts in this repository.
- `client/src/features/agent/agentStatus.js` — now keys its display copy and
  predicates on `AGENT_STATES` / `LINK_STATES` / `isEnforcing` from the shared
  package instead of local string literals, and gained
  `isFocusConfirmedActive()`. Purely a refactor of Prompt 002 code: the rendered
  output is identical, verified by the route smoke test.
- `PROMPTS.md` — this entry.

`server/` and `agent/` were not touched. `SPEC.md` was not modified.

## Contracts defined

- **Envelope** — `{ version, type, id, replyTo, timestamp, payload }` with
  `PROTOCOL_VERSION = 1` and `SUPPORTED_PROTOCOL_VERSIONS = [1]`. Validation
  checks `version` first, so an unknown version is reported as
  `UNSUPPORTED_VERSION` even when other fields are also wrong.
- **Message types** — all 17 from SPEC.md §5.1: `pair.request`, `pair.result`,
  `unpair.request`, `getState`, `state.result`, `state.push`, `session.state`,
  `focus.enter`, `focus.enter.accepted`, `focus.entered`, `focus.exit`,
  `focus.exit.accepted`, `focus.exited`, `focus.extend`, `ping`, `pong`,
  `error`. Each with a direction and a payload contract.
- **Payload contracts** — `focus.enter` carries `{ sessionId, commandToken }`
  and deliberately has **no** `allowList`, so the browser cannot dictate policy
  (SPEC.md §7.8–7.9). `focus.exit` takes only `sessionId`. `getState` and
  `unpair.request` take no fields. `ping` requires `sentAt`. `error` requires
  `{ code, message, retryable }`. Contracts reject unknown fields
  (`additional: false`) so a typo like `allowedList` fails loudly.
- **Error codes** — the 13 required, plus `retryable` defaults: credential
  failures are never retryable, `RATE_LIMITED` and `INTERNAL_ERROR` are.
- **State vocabularies** — `AGENT_STATES` (8, upper case, in-process),
  `FOCUS_SESSION_STATES` (6, lower case, persisted record), `EXIT_REASONS` (6)
  with `AUTO_EXIT_REASONS`, and `LINK_STATES.UNAVAILABLE` kept deliberately
  separate from agent states so the UI cannot imply a healthy machine.

## Verification performed

| Check | Result |
| ----- | ------ |
| `shared/protocol`: `npm test` (node:test) | **69/69 pass** |
| `client`: `npm run lint` | clean, zero warnings |
| `client`: `npm run build` | succeeds, 1997 modules, no errors |
| `client`: `npm run smoke` | **13/13 pass** — 12 routes render expected content with zero console errors, 6/6 design tokens present |
| `client`: `npm run dev` | all 11 routes + 404 return 200; protocol module served over the alias with no transform errors |

Protocol test coverage includes: valid envelopes pass; missing/unsupported
version, unknown type, missing/empty/oversized id, invalid timestamp and
malformed payload all fail; unknown message types fail with
`UNSUPPORTED_MESSAGE_TYPE`; every defined constant and all 17 message types are
importable and round-trip through `validateMessage`.

Three bugs were found and fixed during verification: `ERROR_CODES` was imported
from the wrong module, `validatePayload` silently coerced a `null` payload to
`{}` (a direct violation of the reject-never-repair rule), and `sessionId`
lacked a `minLength` so an empty string passed.

## Intentionally NOT implemented

No WebSocket server or client, no pairing logic, no session state machine, no
timers or watchdog, no Electron, no OS control, no process blocking, no
database, no Express routes, no authentication, no npm workspaces or root
install. The package has **zero runtime dependencies** and the client gained
**zero** new dependencies: `@protocol` is a Vite alias, not an install.

Prompts 004–024 own all of that. This package only defines what a valid message
looks like.

---

# Prompt 002 — Client foundation: React + Vite + Tailwind + Router

- **Component:** client
- **Status:** `done`
- **Depends on:** Prompt 001
- **Blocks:** Prompts 009–013
- **Scope:** frontend foundation only, inside `client/`

## Original prompt

> Continue working on the existing Focus Mode project.
>
> Read SPEC.md and README.md first. Do not change the architecture defined there.
>
> For this task, ONLY build the frontend foundation inside: `client/`.
>
> Tech stack: React, Vite, JavaScript, Tailwind CSS, React Router, shadcn/ui if
> setup is straightforward.
>
> Create a clean, production-quality frontend foundation.
>
> 1. Initialize the React + Vite application inside `client/`.
> 2. Configure Tailwind CSS.
> 3. Set up React Router.
> 4. Create these routes as placeholder pages only: `/`, `/login`, `/signup`,
>    `/dashboard`, `/focus`, `/devices`, `/allowlist`, `/schedules`,
>    `/insights`, `/settings`, `/admin`.
> 5. Create a reusable application layout: sidebar, main content area,
>    top/header area, agent connection status badge.
> 6. Create reusable components: Sidebar, Header, AgentStatusBadge,
>    LoadingState, EmptyState, ErrorState.
> 7. Create a basic design system based on the project specification:
>    calm/focused/trustworthy appearance, deep indigo, calm blue, teal for
>    active focus, amber for warnings, red for destructive actions, light
>    background.
> 8. The dashboard placeholder should contain a "Start Focus" primary button,
>    duration options 25/50/60 minutes, today's focus time placeholder, recent
>    sessions placeholder, agent connection status.
> 9. The focus page should contain only a placeholder active-session UI:
>    countdown placeholder, "Focus mode is on", End Focus button.
> 10. Do NOT implement: authentication logic, API calls, MongoDB, WebSocket
>     connection, local agent communication, OS control, real sessions.
> 11. Keep components modular so another developer can later add API and
>     WebSocket functionality without rewriting the UI.
> 12. Make the application responsive for mobile, tablet and desktop.
> 13. Add a simple 404 page.
> 14. Update PROMPTS.md with this as Prompt 002.
> 15. Do not modify server/ or agent/ except if absolutely necessary for
>     shared documentation.
>
> After implementation: run the frontend, verify all routes compile, verify
> there are no console/build errors, explain the folder structure, explain how
> another developer will later connect APIs and WebSocket to this frontend.
>
> Do not build features beyond this task.

## What was delivered

- **Vite 8 + React 19 app** in `client/` with `@` → `src` path alias
  (`vite.config.js`) and oxlint configured.
- **Tailwind CSS 4** via `@tailwindcss/vite` (no JS config file). Design tokens
  declared in `src/index.css` with an `@theme` block: `brand` (deep indigo),
  `calm` (calm blue), `focus` (teal, active focus), `warn` (amber), `danger`
  (red, destructive), `ink` (neutral), plus light `surface` tokens, a soft
  radial background wash, visible focus rings and `prefers-reduced-motion`
  support.
- **shadcn/ui-style primitives** hand-written in `client/src/components/ui/`
  (button, card, badge, separator, skeleton, label) plus Radix-powered `sheet`
  and `dropdown-menu`. Kept local, no CLI, no extra component registry.
- **React Router 7** route table in `src/router.jsx` with all eleven required
  routes plus a catch-all `NotFoundPage`, a sidebar-less `FocusLayout` for
  `/focus`, and an exported `PROTECTED_ROUTES` list for the future auth guard.
- **Responsive layout**: fixed 260px sidebar at `lg` and above, drawer
  navigation below it, header with page context, agent badge and account menu,
  and responsive page grids.
- **Required components**: `Sidebar`, `Header`, `AgentStatusBadge` (plus
  `AgentUnreachableNotice`), `LoadingState`, `EmptyState`, `ErrorState`.
- **Dashboard placeholder**: Start Focus primary button (teal `focus` variant),
  25/50/60 minute options, today's focus time tiles, recent sessions empty
  state, agent status.
- **Focus page placeholder**: teal "Focus mode is on" badge, static `00:00`
  countdown, always-available destructive End Focus button, safety note.
- **Integration seam**: `src/features/agent/agentStatus.js` defines the
  `AgentStatus` contract mirroring SPEC.md §5.1, and
  `src/features/agent/AgentStatusProvider.jsx` supplies it via React context
  (`useAgentStatus()`). Prompt 010 replaces the provider body only.
- **Verification tooling**: `client/scripts/smoke.mjs` plus
  `route-worker.mjs` boot the production build once per route in a real DOM
  and assert expected content plus zero console errors, and verify design
  tokens survived the Tailwind build (`npm run smoke`).

## Verification results

- `npm run lint` — clean, no warnings.
- `npm run build` — succeeds, 1996 modules, no build errors.
- `npm run dev` — serves on http://localhost:5173.
- `npm run smoke` — **13/13 checks passed**: 12 routes rendered their expected
  content with zero console errors (including the 404), and all design tokens
  are present in the emitted CSS.

## Explicitly NOT done in this prompt

- No authentication logic, no submit handlers, no route guards.
- No REST/API calls, no WebSocket client, no pairing flow.
- No timers, no real session state, no countdown ticking.
- No OS control and no agent communication of any kind.
- `server/` and `agent/` untouched apart from their own scope notes.