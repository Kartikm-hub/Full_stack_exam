import { CheckCircle2Icon } from 'lucide-react'
import { Link } from 'react-router-dom'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

const UPCOMING = [
  {
    to: '/schedules',
    icon: CheckCircle2Icon,
    title: 'Schedules',
    description: 'Plan recurring focus blocks with bounded, always-reversible sessions.',
  },
  {
    to: '/insights',
    icon: CheckCircle2Icon,
    title: 'Insights',
    description: 'Review focus totals and how sessions ended. No browsing history.',
  },
  {
    to: '/allowlist',
    icon: CheckCircle2Icon,
    title: 'Allow-list',
    description: 'Add the apps you want to keep. Protected apps are added automatically.',
  },
  {
    to: '/devices',
    icon: CheckCircle2Icon,
    title: 'Devices',
    description: 'Pair an agent with a short-lived 6-digit code and revoke it any time.',
  },
  {
    to: '/settings',
    icon: CheckCircle2Icon,
    title: 'Settings',
    description: 'Default duration, fail-safe behaviour and accessibility preferences.',
  },
]

/** Marketing / landing route at `/`. Placeholder only. */
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
              <CheckCircle2Icon className="size-5" />
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

      <main className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6 sm:py-20">
        <section className="max-w-2xl">
          <Badge tone="brand">Distraction lockdown, reversible by design</Badge>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight text-brand-950 sm:text-4xl">
            Deep work on your own machine, with an escape hatch you can always reach.
          </h1>
          <p className="mt-4 text-base leading-relaxed text-ink-500">
            Pick a duration, and the Focus Mode agent blocks distractions locally while keeping
            your browser, the agent itself and system-critical apps untouched. End it whenever
            you want. Nothing is left half-applied.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link
              to="/signup"
              className="inline-flex h-11 items-center rounded-xl bg-brand-700 px-6 text-base font-medium text-white transition-colors hover:bg-brand-800"
            >
              Get started
            </Link>
            <Link
              to="/dashboard"
              className="inline-flex h-11 items-center rounded-xl border border-ink-200 bg-white px-6 text-base font-medium text-ink-700 transition-colors hover:bg-ink-50"
            >
              View dashboard placeholder
            </Link>
          </div>
        </section>

        <section className="mt-16">
          <div className="mb-5 flex items-center gap-3">
            <h2 className="text-sm font-semibold tracking-tight text-ink-800">Product areas</h2>
            <Badge tone="neutral">Coming next</Badge>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {UPCOMING.map((item) => {
              const Icon = item.icon

              return (
                <Link key={item.to} to={item.to} className="group">
                  <Card className="h-full transition-colors group-hover:border-brand-300">
                    <CardHeader className="border-b-0 pb-2">
                      <span
                        aria-hidden="true"
                        className="grid size-9 place-items-center rounded-lg bg-brand-50 text-brand-700"
                      >
                        <Icon className="size-4" />
                      </span>
                      <CardTitle className="mt-2">{item.title}</CardTitle>
                      <CardDescription>{item.description}</CardDescription>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <span className="text-xs font-medium text-brand-700 group-hover:underline">
                        Open placeholder →
                      </span>
                    </CardContent>
                  </Card>
                </Link>
              )
            })}
          </div>
        </section>
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