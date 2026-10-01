# Focus Mode — Distraction Lockdown Dashboard

> A MERN-based focus dashboard with a local Electron companion agent that turns a normal desktop into a deliberate, time-boxed workspace.

Focus Mode is a full-stack productivity system designed to help users create distraction-free work sessions.

The system consists of a **React dashboard**, a **Node.js/Express backend**, a **MongoDB data layer**, and a **local Electron companion agent**. The dashboard manages the user's focus sessions, while the companion agent acts as the trusted local component responsible for enforcing focus mode on the user's machine.

---

## 📌 Project Status

**Current stage: Active development**

The project foundation, shared protocol, React dashboard, Express server scaffold, and companion-agent architecture are being developed incrementally.

### Current progress

* ✅ Project architecture defined
* ✅ Shared communication protocol created
* ✅ React/Vite client workspace created
* ✅ Express server scaffold created
* ✅ Companion-agent workspace and architecture planned
* ✅ Safety and fail-safe rules defined
* 🚧 MongoDB integration
* 🚧 Authentication and device management
* 🚧 Agent pairing
* 🚧 Focus-session state machine
* 🚧 OS-level enforcement
* 🚧 Integration testing
* 🚧 Application packaging

For the complete technical specification, see [SPEC.md](./SPEC.md).

For the ordered development tasks, see [PROMPTS.md](./PROMPTS.md).

---

# 🎯 What is Focus Mode?

Focus Mode creates a controlled environment for focused work.

Instead of relying only on a browser interface, the system uses a **local companion agent** running directly on the user's computer.

The workflow is:

```text
User
 │
 ▼
React Dashboard
 │
 │ REST / WebSocket
 ▼
Express Server ───────► MongoDB
 │
 │ Local WebSocket
 ▼
Electron Companion Agent
 │
 ▼
Operating System
```

The important design principle is:

> **The browser requests focus mode. The companion agent enforces it.**

This separation prevents the web dashboard from directly controlling the operating system.

---

# 🧩 System Architecture

```text
                         ┌─────────────────────┐
                         │    React Client     │
                         │      client/        │
                         └──────────┬──────────┘
                                    │
                              HTTPS / REST
                                    │
                                    ▼
                         ┌─────────────────────┐
                         │   Express Server    │
                         │       server/       │
                         └──────────┬──────────┘
                                    │
                                    ▼
                              ┌───────────┐
                              │  MongoDB  │
                              └───────────┘


     Localhost WebSocket
            │
            ▼
┌───────────────────────────┐
│   Electron Companion      │
│          Agent            │
│          agent/           │
│                           │
│  • Tray / Menu Bar        │
│  • Pairing                │
│  • Session Management     │
│  • Watchdog / Fail-safe   │
│  • OS Adapter             │
│  • WebSocket Server       │
└─────────────┬─────────────┘
              │
              ▼
       Operating System
```

---

# 🖥️ Companion Agent

The **Companion Agent** is the most important local component of Focus Mode.

It is a lightweight **Electron + Node.js application** that runs on the user's own computer.

Unlike the React dashboard and cloud server, the companion agent is allowed to interact with the local operating system.

### Why is the agent required?

A normal web application should not have unrestricted access to the operating system.

Therefore, Focus Mode separates responsibilities:

| Component       | Responsibility                                |
| --------------- | --------------------------------------------- |
| React Client    | User interface and session controls           |
| Express Server  | Accounts, devices, sessions and cloud data    |
| MongoDB         | Persistent application data                   |
| Companion Agent | Local focus-mode enforcement                  |
| OS Adapter      | Platform-specific operating-system operations |
| Shared Protocol | Communication contract between components     |

The browser can request an action, but it cannot directly perform the operating-system operation.

---

## ⚙️ Companion Agent Responsibilities

The agent is designed to handle the following responsibilities.

### 1. Tray / Menu Bar Presence

The companion agent runs as a desktop application and remains visible through the system tray or menu bar.

This provides the user with a clear indication that Focus Mode is active.

The agent can also provide local controls such as:

* Current focus-session state
* Session information
* Exit Focus Mode
* Pairing status
* Application status

---

### 2. Local WebSocket Communication

The dashboard communicates with the local agent through a WebSocket running on:

```text
127.0.0.1
```

The agent exposes a controlled communication interface rather than allowing arbitrary operating-system commands.

The primary operations are:

```text
enterFocus(allowList)
exitFocus()
getState()
```

All communication follows the shared protocol defined inside:

```text
shared/protocol/
```

---

### 3. Device Pairing

The dashboard and companion agent must establish a trusted relationship before focus sessions can be controlled.

The planned pairing system uses:

* Short-lived pairing codes
* Single-use 6-digit codes
* Hashed credentials
* OS keychain storage
* Explicit pairing and unpairing

This prevents an unrelated local webpage or application from automatically controlling the agent.

---

### 4. Session Management

The agent maintains the local state of a focus session.

A session can move through controlled states such as:

```text
IDLE
   ↓
FOCUSING
   ↓
EXITING
   ↓
RESTORED
```

The agent, rather than the browser, is the source of truth for the local session state.

This prevents the dashboard from displaying a focus session as active when the local agent is not actually enforcing it.

---

### 5. Fail-Safe Behaviour

Focus Mode is designed around a **fail-safe principle**.

If something goes wrong, the machine should be restored rather than left in a restricted state.

The agent is therefore designed to handle situations such as:

* WebSocket connection loss
* Planned session expiration
* Agent shutdown
* Unexpected agent crash
* Session timeout

The intended behaviour is:

```text
Problem occurs
      ↓
Agent detects failure
      ↓
Session ends
      ↓
Operating-system state is restored
```

No focus session should be infinite or impossible to exit.

---

### 6. OS Adapter Architecture

Operating-system-specific functionality is isolated behind an adapter interface.

```text
                 OS Adapter Interface
                         │
          ┌──────────────┼──────────────┐
          ▼              ▼              ▼
       Windows         macOS          Linux
       win32           darwin         linux
```

This allows the core agent logic to remain platform-independent.

The agent itself does not need to know the implementation details of every operating system.

Instead:

```text
Agent
  ↓
OS Adapter Interface
  ↓
Platform-specific implementation
  ↓
Operating System
```

This architecture also makes testing safer because the application can initially use a **stub adapter** without making real operating-system changes.

---

# 🔐 Security & Safety Design

Focus Mode follows several important security principles.

### Browser isolation

The browser never directly controls the operating system.

### Localhost restriction

The agent listens only on:

```text
127.0.0.1
```

### Origin validation

WebSocket connections validate their origin before accepting requests.

### Protected allow-list

Critical applications such as the browser, companion agent and system-critical applications cannot be removed from the protected allow-list.

The allow-list can only be expanded, never reduced by an untrusted input path.

### Explicit exit

Focus Mode always provides an exit mechanism.

Possible exit paths include:

* Dashboard
* Agent tray/menu
* Keyboard shortcut

### Automatic restoration

When a session ends, the agent restores the previous system state.

---

# 🛠️ Technology Stack

| Layer           | Technology                      | Purpose                           |
| --------------- | ------------------------------- | --------------------------------- |
| Frontend        | React + Vite + TypeScript       | Dashboard UI                      |
| Client State    | React Query + WebSocket store   | Server and agent state            |
| Backend         | Node.js + Express 5             | REST API                          |
| Database        | MongoDB + Mongoose              | Persistent data                   |
| Companion Agent | Electron + Node.js + TypeScript | Desktop agent                     |
| Communication   | REST + WebSocket                | Client/server/agent communication |
| Protocol        | `@focus-mode/protocol`          | Shared communication contract     |
| Testing         | `node:test` + workspace tests   | Automated testing                 |
| Linting         | oxlint                          | Code quality                      |
| Build Tool      | Vite 8                          | Frontend development/build        |

---

# 📁 Project Structure

```text
focus-mode/
│
├── client/                       # React dashboard
│   └── src/
│       ├── api/                  # REST API communication
│       ├── agent/                # Agent WebSocket manager
│       ├── components/           # Reusable UI components
│       ├── pages/                # Dashboard pages
│       └── state/                # Application state
│
├── server/                       # Express backend
│   └── src/
│       ├── config/               # Configuration and validation
│       ├── models/               # Database models
│       ├── routes/               # REST endpoints
│       ├── services/             # Business logic
│       └── middleware/           # Middleware
│
├── agent/                        # Electron companion agent
│   └── src/
│       ├── main/                 # Electron main process
│       ├── pairing/              # Device pairing
│       ├── session/              # Session state machine
│       ├── allowlist/            # Protected allow-list
│       ├── os/                   # Operating-system adapters
│       └── ws/                   # Local WebSocket server
│
├── shared/
│   └── protocol/                 # Shared communication contract
│       ├── src/
│       └── test/
│
├── tests/                        # Integration tests
│
├── SPEC.md                       # Detailed architecture specification
├── PROMPTS.md                    # Development task history
├── README.md                     # Project documentation
└── .gitignore
```

---

# 🔄 How a Focus Session Works

A typical session follows this flow:

```text
1. User opens the Focus Mode dashboard
                ↓
2. Dashboard connects to the companion agent
                ↓
3. User selects a focus duration
                ↓
4. Dashboard sends a request to the agent
                ↓
5. Agent validates the request
                ↓
6. Agent enters focus mode
                ↓
7. OS adapter applies the required restrictions
                ↓
8. Agent reports the actual state
                ↓
9. Dashboard displays the confirmed state
                ↓
10. Session reaches its planned end
                ↓
11. Agent exits focus mode
                ↓
12. OS state is restored
```

The dashboard never assumes that an operation succeeded. The agent must confirm the resulting state.

---

# 🚀 Development Roadmap

| Phase | Description                                   | Status |
| ----- | --------------------------------------------- | ------ |
| M0    | Foundation, documentation and workspace setup | ✅      |
| M1    | Shared protocol and tooling                   | ✅      |
| M2    | Express server skeleton                       | 🚧     |
| M3    | React client skeleton                         | 🚧     |
| M4    | Electron companion agent                      | 🚧     |
| M5    | Device pairing                                | 🚧     |
| M6    | Agent state machine                           | 🚧     |
| M7    | Protected allow-list                          | 🚧     |
| M8    | Session UX                                    | 🚧     |
| M9    | Fail-safe and crash recovery                  | 🚧     |
| M10   | Real OS adapters                              | 🚧     |
| M11   | Hardening, testing and packaging              | 🚧     |

---

# 🧪 Development Philosophy

Focus Mode is being developed incrementally.

Real operating-system automation is intentionally kept until the core architecture, communication protocol, pairing system, protected allow-list and fail-safe mechanisms have been tested.

This gives the project a safer development progression:

```text
Architecture
     ↓
Shared Protocol
     ↓
Server + Client
     ↓
Agent
     ↓
Pairing
     ↓
State Machine
     ↓
Fail-Safe
     ↓
OS Adapter
     ↓
Real OS Enforcement
```

---

# 📚 Documentation

Additional project documentation:

* [SPEC.md](./SPEC.md) — Complete architecture and technical specification
* [PROMPTS.md](./PROMPTS.md) — Ordered development tasks and implementation prompts
* [shared/protocol](./shared/protocol) — Shared communication contract

---

# 👨‍💻 Project

**Focus Mode — Distraction Lockdown Dashboard**

A full-stack productivity project combining:

* Web development
* Backend development
* Desktop application development
* WebSocket communication
* OS-level integration
* Security
* Fail-safe system design
* Cross-platform architecture

---

## 📌 Note

The project is under active development. Features and architecture may evolve as implementation progresses.
