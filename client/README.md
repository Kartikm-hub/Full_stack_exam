# client/ — React dashboard

Owner: frontend developer. Status: **foundation built** (Prompts 002–003).
React 19 + Vite 8 + Tailwind CSS 4 + React Router 7, JavaScript (JSX).

## Commands

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # production build into dist/
npm run preview  # serve the production build
npm run lint     # oxlint
npm run smoke    # route smoke test (run `npm run build` first)
```

## Folder structure

```
src/
├── main.jsx                      # React root, mounts providers + router
├── router.jsx                    # route table, provider wrapper, PROTECTED_ROUTES
├── index.css                     # Tailwind import + design tokens (@theme)
├── config/
│   └── navigation.js             # NAV_ITEMS: single source of truth for routes
├── lib/
│   └── utils.js                  # cn() class merge helper
├── features/
│   └── agent/
│       ├── agentStatus.js        # display copy + predicates on @protocol/state
│       └── AgentStatusProvider.jsx   # the seam where the WebSocket client lands
├── components/
│   ├── ui/                       # shadcn-style primitives
│   │   ├── button.jsx  card.jsx  badge.jsx
│   │   ├── sheet.jsx   dropdown-menu.jsx
│   │   └── separator.jsx  skeleton.jsx  label.jsx
│   ├── layout/
│   │   ├── AppLayout.jsx         # sidebar + header + main (responsive shell)
│   │   ├── Sidebar.jsx           # reused by desktop and mobile drawer
│   │   └── Header.jsx            # drawer trigger, page title, agent badge
│   ├── agent/
│   │   └── AgentStatusBadge.jsx  # badge + unreachable notice
│   ├── states/
│   │   └── LoadingState.jsx  EmptyState.jsx  ErrorState.jsx
│   └── common/
│       └── PageHeader.jsx        # page frame, StatTile, SectionHeading
└── pages/                        # one file per route
```

## Routes

| Route | Page | State |
| ----- | ---- | ----- |
| `/` | `LandingPage` | placeholder marketing page |
| `/login`, `/signup` | `LoginPage`, `SignupPage` | static form layout, **no auth logic** |
| `/dashboard` | `DashboardPage` | Start Focus + 25/50/60 options, today's time, recent sessions |
| `/focus` | `FocusPage` | placeholder active-session UI, static countdown, End Focus |
| `/devices`, `/allowlist`, `/schedules`, `/insights`, `/settings`, `/admin` | via `PlaceholderPage` | scaffold only |
| `*` | `NotFoundPage` | 404 |

## Shared protocol

`client/vite.config.js` aliases `@protocol` to `shared/protocol/src`, so the
dashboard compiles against the same contract files the server and the agent
import as `@focus-mode/protocol`. The alias points at the source: no build step,
no second copy to drift, and zero added dependencies.

```js
import { AGENT_STATES, isEnforcing } from '@protocol/state'
```

`features/agent/agentStatus.js` already uses it, so badge labels and the "is a
session open" predicate come from the shared vocabulary rather than local string
literals. Prompt 010 will add `@protocol/envelope` and `@protocol/messages` at
the point the WebSocket client is written.

## Hard rules

- Never import Node/Electron APIs and never attempt OS access.
- Only talk to the OS *through* the agent over `ws://127.0.0.1:<agentPort>`.
- Render the agent's reported state; never show "focus mode active" optimistically.

## Not implemented yet (by design)

Authentication, API calls, WebSocket transport, real timers and sessions.
`features/agent/AgentStatusProvider.jsx` currently returns a static
`UNAVAILABLE` snapshot and is the single file Prompt 010 replaces.