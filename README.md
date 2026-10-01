# Focus Mode

> Distraction Lockdown Dashboard

Focus Mode is a full-stack productivity system designed to help users create deliberate, time-boxed work sessions without being distracted by the rest of the desktop environment.

The project combines a React dashboard, a Node.js/Express API, MongoDB persistence, and a local Electron companion agent. The browser requests a focus session, the server records and validates it, and the desktop agent is the component that actually enforces the session at the operating-system level.

This separation is intentional: the UI can suggest actions, but only the local companion has the authority to restrict apps and restore the machine afterward.

---

## Why this project exists

Modern work is often fragmented by notifications, browser tabs, messaging apps, and other distractions. Focus Mode tries to solve that by creating a simple, structured workflow:

- define a session
- allow only the apps and tools that matter
- enforce the session locally on the machine
- restore the system automatically when the session ends

The result is a safer, clearer approach to deep work than a raw browser-only "do not disturb" mode.

---

## Core principles

1. Safe by default
   - a failed session must not lock the user out of their machine
2. Explicit control
   - the user must intentionally start and end a session
3. Local enforcement
   - the operating system is controlled only by the trusted desktop agent
4. Transparency
   - the dashboard reflects real state reported by the agent, not optimistic assumptions
5. Fail-safe behavior
   - if the agent crashes or connectivity fails, the environment is restored

---

## Architecture at a glance

```text
User
  │
  ▼
React Dashboard (client/)
  │
  │ HTTPS / REST + local WebSocket
  ▼
Express Server (server/)
  │
  │ persists data and validates requests
  ▼
MongoDB
  │
  │ paired local connection
  ▼
Electron Companion Agent (agent/)
  │
  │ only component allowed to touch the OS
  ▼
Operating System
```

The key design rule is:

> The browser requests focus mode. The companion agent enforces it.

---

## Main components

### Client
The frontend is a React + Vite single-page app used to manage sessions, device state, allow-lists, and dashboard activity.

### Server
The backend is a Node.js/Express service that handles authentication, device information, session records, and API validation.

### Agent
The desktop companion runs locally as an Electron app, maintains the trust relationship with the dashboard, and performs OS-level enforcement through an adapter layer.

### Shared protocol
The communication contract between the client, server, and agent is defined under the shared protocol workspace so the interfaces stay aligned.

---

## Project status

This repository is currently in active development. The foundation and architecture are in place, but several areas are still being built and refined.

Current status includes:

- ✅ project architecture and product direction
- ✅ shared protocol foundation
- ✅ client workspace scaffold
- ✅ server scaffold
- ✅ agent architecture and local enforcement model
- ✅ safety and fail-safe design
- 🚧 device pairing
- 🚧 session state machine
- 🚧 OS adapter implementations
- 🚧 MongoDB integration
- 🚧 end-to-end testing and packaging

---

## Repository layout

```text
Full_stack_exam/
├── agent/                 # Electron companion app
├── client/                # React dashboard
├── server/                # Express backend
├── shared/
│   └── protocol/          # message contracts and shared types
├── README.md              # project overview
├── SPEC.md                # detailed system specification
├── PROMPTS.md             # ordered task sequence and project prompts
└── .gitignore
```

---

## Quick start

Install and run each workspace separately:

```bash
cd client
npm install
npm run dev
```

```bash
cd server
npm install
npm run dev
```

```bash
cd agent
npm install
npm start
```

The exact runtime flow depends on the current implementation state, but the structure above reflects the intended local architecture for development.

---

## Technology stack

| Layer | Stack | Purpose |
| --- | --- | --- |
| Frontend | React + Vite | Dashboard UI |
| Backend | Node.js + Express | API and session logic |
| Database | MongoDB + Mongoose | Persistence |
| Desktop app | Electron + Node.js | Local enforcement and device control |
| Messaging | REST + WebSocket | Client/server/agent communication |
| Shared contracts | protocol package | Consistent message definitions |

---

## Security and safety design

Focus Mode is intentionally designed around a strict trust model:

- the browser never directly manipulates the OS
- the agent listens only on loopback interfaces
- origin validation protects local WebSocket endpoints
- the protected allow-list prevents critical system apps from being removed
- the system must support explicit exit and automatic restoration

This protects the user from both accidental and malicious misuse.

---

## Documentation

Additional project documentation:

- [SPEC.md](./SPEC.md) — full architecture and implementation specification
- [PROMPTS.md](./PROMPTS.md) — development roadmap and task sequence
- [shared/protocol](./shared/protocol) — shared contracts for client/server/agent communication

---

## Summary

Focus Mode is a practical, safety-focused desktop productivity project that blends modern web engineering with local machine control. It is designed to be explicit, transparent, and resilient: the user starts a session, the agent enforces it, and the machine is restored afterward without leaving the user stranded.

This repository is best understood as a structured development project and architecture blueprint for a real-world focus-management product.
