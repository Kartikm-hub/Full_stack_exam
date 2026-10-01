# agent/ — Electron companion agent (the OS authority)

Owner: agent / systems developer. Status: **empty workspace** (Prompts 014–023).

## Belongs here

- Electron main process with a **visible tray / menu-bar icon** (required),
  single-instance lock, graceful shutdown and crash-recovery marker.
- Loopback WebSocket server (`127.0.0.1` only) with origin/host validation,
  envelope codec, size and rate limits.
- Pairing: consume a short-lived 6-digit code, store the credential in the OS
  keychain, support unpair.
- Session state machine exposing `enterFocus(allowList)`, `exitFocus()`,
  `getState()`, plus heartbeat, watchdog and auto-exit.
- Allow-list resolution: `userExtras ∪ protectedBaseline`, one-directional.
- OS adapter interface (`src/os/`) with one implementation per platform — the
  **only** code allowed to touch the operating system.

## Hard rules

- Never bind `0.0.0.0`; loopback only.
- Never require admin/root; run as the signed-in user.
- Exit must always work, from the tray as well as from the dashboard.
- If the link drops, the planned end is reached, or the process restarts with a
  stale marker, restore the system immediately.

## Does not belong here

- User accounts, long-term history, cloud sync logic (that is `server/`).

## Planned entry points (not created yet)

`src/main/main.ts` · `src/main/tray.ts` · `src/ws/server.ts` ·
`src/pairing/pairing.ts` · `src/session/sessionMachine.ts` ·
`src/session/watchdog.ts` · `src/allowlist/resolve.ts` · `src/os/*`