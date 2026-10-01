# server/ — cloud API (Node.js + Express + MongoDB)

Owner: backend developer. Status: **empty workspace** (Prompts 003–007).

## Belongs here

- Express app, env/config validation, MongoDB connection via Mongoose.
- Mongoose models: `users`, `devices`, `pairingRequests`, `focusSessions`,
  `allowListEntries`, `auditEvents`.
- REST routes: auth, devices, pairing (issue/confirm/revoke), sessions
  (request, state report, history), allow-list preferences, audit read.
- Pairing codes (hashed, short-lived, single use) and short-lived one-time
  command tokens that authorise the agent.
- Server-side validation and merging of the protected allow-list baseline.

## Hard rules

- The server never interacts with any OS; it authorises and records only.
- Never trust the client for the protected baseline or for session limits
  (max duration, one active session per device).
- Never store plain pairing codes, tokens or passwords.

## Does not belong here

- Electron / OS code, local WebSocket listening, agent lifecycle.

## Planned entry points (not created yet)

`src/index.ts` (bootstrap) · `src/app.ts` · `src/config/env.ts` ·
`src/models/*` · `src/routes/*` · `src/middleware/*`