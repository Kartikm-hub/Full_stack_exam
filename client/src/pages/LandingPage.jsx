import { ArrowRightIcon, LockKeyholeIcon, ShieldCheckIcon, TimerIcon } from 'lucide-react'
import { Link } from 'react-router-dom'

/** Public overview route. */
export default function LandingPage() {
  return (
    <div className="min-h-full">
      <header className="border-b border-ink-200 bg-white/80 backdrop-blur-sm">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <span
              aria-hidden="true"
              className="grid size-9 place-items-center rounded-lg bg-brand-800 text-white"
            >
              <TimerIcon className="size-5" />
            </span>
            <span className="text-sm font-semibold tracking-tight text-brand-950">Focus Mode</span>
          </div>
          <nav aria-label="Account" className="flex items-center gap-2">
            <Link
              to="/login"
              className="rounded-lg px-3 py-2 text-sm font-medium text-ink-600 transition-colors hover:bg-ink-100 hover:text-ink-900"
            >
              Sign in
            </Link>
            <Link
              to="/signup"
              className="rounded-lg bg-brand-700 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-800"
            >
              Create account
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
        <section className="overflow-hidden rounded-lg bg-brand-950 px-6 py-10 text-white sm:px-10 sm:py-14">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase text-focus-300">Focus Mode · Local by design</p>
            <h1 className="mt-4 text-3xl font-semibold sm:text-5xl">Make room for the work that matters.</h1>
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-brand-100">Choose a bounded focus session and let a visible local agent apply it on your computer. Your browser and protected system apps stay available, and you can end focus whenever you need.</p>
          </div>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              to="/signup"
              className="inline-flex h-11 items-center gap-2 rounded-lg bg-focus-700 px-5 text-sm font-semibold text-white transition-colors hover:bg-focus-800"
            >
              Create your account <ArrowRightIcon className="size-4" />
            </Link>
            <Link
              to="/login"
              className="inline-flex h-11 items-center rounded-lg border border-white/30 px-5 text-sm font-medium text-white transition-colors hover:bg-white/10"
            >
              Sign in
            </Link>
          </div>
        </section>

        <section className="mt-12 grid gap-8 border-b border-ink-200 pb-12 sm:grid-cols-3" aria-label="How Focus Mode works">
          <article className="space-y-3"><span className="grid size-9 place-items-center rounded-md bg-brand-100 text-brand-800"><LockKeyholeIcon className="size-4" /></span><p className="text-xs font-semibold uppercase text-ink-400">01 · Install</p><h2 className="text-lg font-semibold text-brand-950">Run the local agent</h2><p className="text-sm leading-relaxed text-ink-500">The companion runs on your computer and is the only part of Focus Mode that can apply system restrictions. The agent package must be installed separately.</p></article>
          <article className="space-y-3"><span className="grid size-9 place-items-center rounded-md bg-calm-100 text-calm-800"><ShieldCheckIcon className="size-4" /></span><p className="text-xs font-semibold uppercase text-ink-400">02 · Pair</p><h2 className="text-lg font-semibold text-brand-950">Connect with a short code</h2><p className="text-sm leading-relaxed text-ink-500">Enter the agent’s temporary 6-digit code. Paired computers can be reviewed and unlinked from your account at any time.</p></article>
          <article className="space-y-3"><span className="grid size-9 place-items-center rounded-md bg-focus-100 text-focus-800"><TimerIcon className="size-4" /></span><p className="text-xs font-semibold uppercase text-ink-400">03 · Focus</p><h2 className="text-lg font-semibold text-brand-950">Set a limit and begin</h2><p className="text-sm leading-relaxed text-ink-500">Choose a duration, review the consent prompt, and start. The agent keeps protected apps available and always provides an immediate exit.</p></article>
        </section>

        <section className="grid gap-5 py-10 sm:grid-cols-[1fr_auto] sm:items-center"><div><h2 className="text-lg font-semibold text-brand-950">Your activity stays yours.</h2><p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-500">Focus Mode records session duration and outcomes, not browsing history, window titles, or keystrokes. System changes are performed locally by the agent, never by the browser.</p></div><div className="rounded-lg border border-ink-200 bg-white px-4 py-3 text-xs text-ink-600"><ShieldCheckIcon className="mr-2 inline size-4 text-focus-700" />Reversible at any time</div></section>
      </main>

      <footer className="border-t border-ink-200 bg-white/60">
        <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6">
          <p className="text-xs text-ink-400">
            Focus Mode — the browser never controls your operating system. The local agent is the
            only component that does, and it is always visible.
          </p>
        </div>
      </footer>
    </div>
  )
}