/**
 * Route smoke test for the Focus Mode client (parent runner).
 *
 * Boots the production build once per route in a fresh DOM (happy-dom), records
 * console errors, and asserts each route rendered its expected content. Each
 * route runs in a child process so module state (the browser router captures
 * `window.history` at import time) cannot leak between routes.
 *
 *   npm run build && npm run smoke
 *
 * Dev-time verification script, not shipped application code.
 */
import { spawn } from 'node:child_process'
import { readFile, readdir } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptPath = fileURLToPath(import.meta.url)
const scriptDir = dirname(scriptPath)
const projectRoot = resolve(scriptDir, '..')
const distDir = join(projectRoot, 'dist')

/** Every route required by Prompt 002, plus a deliberate miss. */
const ROUTES = [
  '/',
  '/login',
  '/signup',
  '/dashboard',
  '/focus',
  '/devices',
  '/allowlist',
  '/schedules',
  '/insights',
  '/settings',
  '/admin',
  '/nope-not-a-route',
]

/** Substrings that must appear in the rendered output for each route. */
const EXPECTED = {
  '/': ['Focus Mode', 'Create account'],
  '/login': ['Welcome back', 'Sign in', 'not implemented'],
  '/signup': ['Create your account', 'Confirm password'],
  '/dashboard': [
    'Start Focus',
    '25',
    '50',
    '60',
    "Today's focus time",
    'Recent sessions',
    'Agent not connected',
  ],
  '/focus': ['Focus mode is on', '00:00', 'End Focus', 'agent tray icon'],
  '/devices': ['Devices', 'Placeholder', '6-digit code'],
  '/allowlist': ['Allow-list', 'Placeholder', 'cannot be removed'],
  '/schedules': ['Schedules', 'Placeholder'],
  '/insights': ['Insights', 'Placeholder', 'No browsing history'],
  '/settings': ['Settings', 'Placeholder', 'Auto-exit on disconnect'],
  '/admin': ['Admin', 'Placeholder'],
  '/nope-not-a-route': ['404', 'does not exist', 'dashboard'],
}

/** Design tokens that must survive the Tailwind build. */
const REQUIRED_CSS_TOKENS = [
  '--color-brand-700',
  '--color-calm-500',
  '--color-focus-500',
  '--color-warn-500',
  '--color-danger-600',
  '--color-surface',
]

function runChild(route) {
  return new Promise((done) => {
    const child = spawn(process.execPath, [join(scriptDir, 'route-worker.mjs'), route], {
      cwd: projectRoot,
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (chunk) => (stdout += chunk))
    child.stderr.on('data', (chunk) => (stderr += chunk))
    child.on('close', (code) => done({ code, stdout, stderr }))
  })
}

function parseChild(stdout) {
  const trimmed = stdout.trim().split('\n').pop()
  try {
    return JSON.parse(trimmed)
  } catch {
    return { ok: false, text: '', errors: [`child produced no result: ${trimmed}`], missing: [] }
  }
}

async function main() {
  const assets = await readdir(join(distDir, 'assets')).catch(() => [])
  if (assets.length === 0) {
    console.error('dist/assets is empty — run `npm run build` first.')
    process.exit(1)
  }

  let failures = 0

  console.log('route checks')
  for (const route of ROUTES) {
    const { code, stdout, stderr } = await runChild(route)
    const result = parseChild(stdout)
    const expected = EXPECTED[route] ?? []
    const missing = result.missing?.length ? result.missing : expected.filter((n) => !result.text.includes(n))
    const ok = code === 0 && result.ok && result.errors.length === 0 && missing.length === 0

    if (!ok) failures += 1
    console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${route.padEnd(20)} chars=${result.text.length}`)

    for (const error of (result.errors ?? []).slice(0, 4)) console.log(`          console: ${error}`)
    for (const needle of missing) console.log(`          missing: "${needle}"`)
    if (ok === false && stderr.trim()) console.log(`          stderr: ${stderr.trim().split('\n')[0]}`)
  }

  // Design-token check on the emitted CSS.
  const cssName = assets.find((name) => name.endsWith('.css'))
  const css = await readFile(join(distDir, 'assets', cssName), 'utf8')
  const missingTokens = REQUIRED_CSS_TOKENS.filter((token) => !css.includes(token))
  if (missingTokens.length > 0) failures += 1

  console.log('\ncss checks')
  console.log(
    `  ${missingTokens.length === 0 ? 'PASS' : 'FAIL'}  design tokens  (${REQUIRED_CSS_TOKENS.length} checked, ${css.length} bytes)`,
  )
  for (const token of missingTokens) console.log(`          missing: ${token}`)

  const passed = ROUTES.length + 1 - failures
  console.log(`\n${passed}/${ROUTES.length + 1} checks passed`)
  process.exit(failures === 0 ? 0 : 1)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})