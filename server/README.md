# server/ — cloud API (Node.js + Express)

Owner: backend developer. Status: **scaffold built** (Prompt 004).
Node.js 20.19+ / Express 5, JavaScript (ESM).

## What this is

The Focus Mode cloud API. It owns accounts, devices, session history and the
protected allow-list rules, and it **never** touches an operating system: the
Electron agent is the only component allowed to do that (SPEC.md §7).

**Current state: scaffold.** Configuration, logging, error handling and one
health endpoint. No database, no authentication, no product endpoints.

## Commands

```bash
npm install
npm run dev      # watch mode on PORT (default 4000)
npm start        # plain start
npm test         # node:test, no test framework dependency
npm run lint     # oxlint
```

There is no build step: plain ESM runs directly on Node.

## Environment variables

Copy the example and edit it:

```bash
cp .env.example .env
```

Node loads `.env` automatically through `--env-file-if-exists` in the npm
scripts, so there is no dotenv dependency. A missing `.env` is fine; the
defaults apply.

| Variable | Required | Default | Notes |
| -------- | -------- | ------- | ----- |
| `NODE_ENV` | no | `development` | One of `development`, `test`, `production`. Anything else fails at startup. |
| `PORT` | no | `4000` | Integer 1–65535. A malformed value fails at startup. |
| `MONGODB_URI` | no | *(empty)* | **Configuration only — not connected yet.** Must start with `mongodb://` or `mongodb+srv://`. |

Validation happens in `src/config/index.js` with no external library. Misleading
values fail loudly at startup rather than producing a half-configured server.

`.env` is git-ignored and `.env.example` is committed. Real values never appear
in a log line or an HTTP response.

## `GET /health`

An infrastructure probe, deliberately outside the `/api` namespace.

```bash
curl http://localhost:4000/health
```

```json
{
  "status": "ok",
  "service": "focus-mode-server",
  "environment": "development",
  "timestamp": "2026-01-01T10:00:00.000Z",
  "version": "0.1.0",
  "uptimeSeconds": 12,
  "database": "not_configured",
  "features": {
    "api": "not_implemented",
    "auth": "not_implemented",
    "sessions": "not_implemented",
    "websocket": "not_implemented"
  }
}
```

`environment` is the real configured value. `database` reads
`"not_configured"` **even when `MONGODB_URI` is set**, because nothing is
connected yet — reporting "connected" would hide a real outage.

## Error responses

One shape for every failure, so the dashboard parses exactly one thing:

```json
{ "error": { "code": "ROUTE_NOT_FOUND", "message": "Cannot GET /api/nope" } }
```

| Status | Code | Cause |
| ------ | ---- | ----- |
| 400 | `INVALID_JSON` | Malformed request body |
| 404 | `ROUTE_NOT_FOUND` | Unknown path or method |
| 413 | `PAYLOAD_TOO_LARGE` | Body over 100 kB |
| 500 | `INTERNAL_ERROR` | Unexpected failure |

Never returned: stack traces, file paths, configuration values, request bodies.
Stack traces go to the log. Development and test add an `error.details` array;
production omits it.

## Folder structure

```
server/
├── package.json
├── .env.example
├── .oxlintrc.json
├── src/
│   ├── app.js               # Express factory — no side effects, no port binding
│   ├── server.js            # process lifecycle: env, listen, graceful shutdown
│   ├── config/index.js      # loadConfig() validation, redactSecrets()
│   ├── lib/
│   │   ├── logger.js        # one JSON line per event, no framework
│   │   └── http-error.js    # ApiError + the shared error body
│   ├── middleware/
│   │   ├── request-logger.js
│   │   ├── not-found.js
│   │   └── error-handler.js # must be mounted last
│   └── routes/
│       ├── health.js        # GET /health
│       └── index.js         # the /api namespace, mounted here
└── tests/
    ├── helpers.js           # binds the app to an ephemeral port
    ├── config.test.js
    └── app.test.js
```

`app.js` and `server.js` are split on purpose: tests import `createApp()` and
drive it over real HTTP without a background process, and never bind the
configured port.

### Middleware order

1. `disable('x-powered-by')` — do not advertise the framework
2. request logging
3. `express.json({ limit: '100kb' })` — malformed JSON becomes an error here
4. routes
5. 404 handler
6. error handler — **must be last**

### Adding a route

Mount it in `src/routes/index.js` under `/api`:

```js
router.use('/sessions', createSessionRouter())   // Prompt 007
```

Nothing outside that file needs to change.

## Logging

One JSON object per line, so an aggregator can parse it without us having
picked one yet. Nothing is logged that could carry a credential: no bodies, no
headers, no cookies, no environment values. `MONGODB_URI` is logged as
`mongodbUriConfigured: true|false`, never as a value.

## Graceful shutdown

`SIGINT` and `SIGTERM` stop accepting connections, drain in-flight requests for
up to 10 s (`SHUTDOWN_TIMEOUT_MS`), then force-close and exit 0.

## Not implemented yet

- **MongoDB connection** — `MONGODB_URI` is parsed and validated, nothing connects.
- **Mongoose models** — no `users`, `devices`, `pairingRequests`, `focusSessions`,
  `allowListEntries` or `auditEvents`.
- **Authentication** — no login, no JWT, no session cookies.
- **Pairing**, **devices**, **focus sessions**, **allow-list** — no endpoints.
- **WebSocket** — no local socket, no agent communication.
- **Electron / OS control** — belongs to `agent/`, never here.
- **Real focus mode** — nothing is enforced anywhere yet.

Per SPEC.md §7, the server authorises and records; it never enforces.

## Planned entry points (not created yet)

`src/db/connect.js` + `src/models/*` (Prompt 005) · `src/routes/auth.js` (005) ·
`src/routes/devices.js` (006) · `src/routes/sessions.js` (007) ·
`src/middleware/auth.js` (005) · `src/routes/audit.js` (008)