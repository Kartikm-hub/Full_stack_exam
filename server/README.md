# Focus Mode API

Minimal Node.js, Express, and MongoDB backend for account authentication and
user preferences. This service does not communicate with the local agent or
control the operating system.

## Run

1. From `server/`, install dependencies with `npm install`.
2. Keep the existing `server/.env` private. It must define `MONGO_URI` and
   `JWT_SECRET`; see `.env.example` for the supported settings.
3. Start the API with `npm run dev`.

The API listens on `http://localhost:5000/api/v1` by default. Run `npm test` to
exercise the endpoints using an isolated in-memory test repository; tests do
not connect to or modify the MongoDB database configured in `.env`.

## API

All responses use `{ success, data }`. Errors use
`{ success: false, error: { code, message, details? } }`.

| Method | Path | Access | Behavior |
| --- | --- | --- | --- |
| GET | `/health` | Public | API and database connection status |
| POST | `/auth/register` | Public | Create an account and return a bearer token |
| POST | `/auth/login` | Public | Verify credentials and return a bearer token |
| POST | `/auth/logout` | Signed in | Stateless sign-out acknowledgement |
| GET | `/auth/me` | Signed in | Return the current profile |
| PATCH | `/auth/me` | Signed in | Update name and default session duration |
| POST | `/auth/change-password` | Signed in | Verify current password and set a new password |
| GET | `/allowlist` | Signed in | Return protected baseline and user apps |
| PUT | `/allowlist` | Signed in | Replace user apps; protected entries remain server-controlled |

Send protected requests with `Authorization: Bearer <accessToken>`.

## Security Basics

- Passwords are hashed with bcrypt and are never included in responses.
- Zod validates request bodies; registration never accepts a client-supplied role.
- JWTs expire according to `JWT_EXPIRES_IN`; each protected request reloads the
  account and rejects deleted or disabled users.
- Login and registration are rate-limited. Helmet, a restricted JSON body size,
  and the configured `CLIENT_URL` CORS origin are enabled.
- The protected allow-list baseline (`browser`, `agent`, `system`) cannot be
  removed through the user preference endpoint.
- `.env` contains secrets and must not be committed.

## Not Included

Device pairing, agent heartbeats, focus enforcement, session control, schedules,
insights, admin APIs, and all operating-system behavior are intentionally out
of scope for this basic backend.