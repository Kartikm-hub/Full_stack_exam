/**
 * Single-route worker for `smoke.mjs`.
 *
 * Runs the production bundle for one route in a fresh happy-dom window and
 * prints a JSON result. Invoked as a child process by the parent runner so
 * module-level browser state (React Router captures `window.history` at import
 * time) never leaks between routes.
 *
 * Usage: node scripts/smoke.mjs /dashboard
 */
import { readFile, readdir } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { pathToFileURL, fileURLToPath } from 'node:url'
import { Window } from 'happy-dom'

const scriptPath = fileURLToPath(import.meta.url)
const projectRoot = resolve(scriptPath, '..', '..')
const distDir = join(projectRoot, 'dist')

const route = process.argv[2] ?? '/'

const errors = []
const window = new Window({
  url: `http://localhost${route}`,
  width: 1280,
  height: 900,
  // We import the bundle ourselves below; stop happy-dom from also trying to
  // fetch and evaluate the <script type="module"> tag from the app shell.
  settings: { disableJavaScriptFileLoading: true, disableJavaScriptEvaluation: true },
})

for (const level of ['error', 'warn']) {
  window.console[level] = (...args) => {
    if (level !== 'error') return
    errors.push(
      args.map((arg) => (arg instanceof Error ? `${arg.name}: ${arg.message}` : String(arg))).join(' '),
    )
  }
}
window.addEventListener('error', (event) => errors.push(`window.error: ${event.message}`))

// Seed the app shell so #root exists, as in a real browser load. The <script>
// and <link> tags are stripped: the bundle is imported below and the stylesheet
// is already verified against the built CSS file by the parent runner.
const shell = await readFile(join(distDir, 'index.html'), 'utf8')
window.document.write(
  shell.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<link[^>]+rel=["']stylesheet["'][^>]*>/gi, ''),
)

const globals = [
  'window',
  'document',
  'navigator',
  'location',
  'history',
  'localStorage',
  'sessionStorage',
  'HTMLElement',
  'Element',
  'Node',
  'Event',
  'CustomEvent',
  'MouseEvent',
  'KeyboardEvent',
  'getComputedStyle',
  'requestAnimationFrame',
  'cancelAnimationFrame',
  'matchMedia',
  'MutationObserver',
  'DOMParser',
  'CSS',
  'SVGSVGElement',
  'fetch',
]

// Node defines some of these (e.g. `navigator`) as getter-only, so swap them
// with defineProperty and restore the original descriptors afterwards.
const previous = new Map()
const assign = (key, value) => {
  previous.set(key, Object.getOwnPropertyDescriptor(globalThis, key))
  Object.defineProperty(globalThis, key, {
    value,
    writable: true,
    configurable: true,
    enumerable: true,
  })
}

for (const key of globals) {
  const value = key === 'window' ? window : window[key]
  if (value !== undefined) assign(key, value)
}
assign('self', window)
assign('globalThis', window)

const assets = await readdir(join(distDir, 'assets'))
const entryName = assets.find((name) => name.endsWith('.js'))
const entryPath = pathToFileURL(join(distDir, 'assets', entryName)).href

try {
  await import(entryPath)
  // Let React flush renders, effects and the router settle.
  await new Promise((done) => setTimeout(done, 250))
} catch (error) {
  errors.push(`import: ${error.message}`)
}

const rootNode = window.document.getElementById('root')
const text = (rootNode?.textContent ?? '').replace(/\s+/g, ' ').trim()

// Teardown while the happy-dom window is still the active global.
await window.happyDOM.close().catch(() => {})

for (const [key, descriptor] of previous) {
  if (descriptor) Object.defineProperty(globalThis, key, descriptor)
  else delete globalThis[key]
}

console.log(JSON.stringify({ ok: errors.length === 0 && text.length > 0, text, errors }))
process.exit(0)