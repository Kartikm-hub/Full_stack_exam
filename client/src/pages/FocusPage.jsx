import { ShieldCheckIcon } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

/**
 * Active-session placeholder UI only.
 *
 * The countdown is a static string — there is NO timer, no ticking state and no
 * `focus.exit` call in this prompt. Ending a session must be available at all
 * times (SPEC.md §7 principle 12), which is why the button is always rendered
 * rather than gated behind a state check.
 */
export default function FocusPage() {
  return (
    <div className="space-y-6">
      <Card className="border-focus-200 bg-white">
        <CardContent className="space-y-8 px-6 py-10 text-center sm:px-10">
          {/* Live-state marker */}
          <div className="flex items-center justify-center gap-2">
            <span aria-hidden="true" className="size-2.5 rounded-full bg-focus-500" />
            <Badge tone="focus">Focus mode is on</Badge>
          </div>

          {/* Countdown placeholder — static, no ticking timer yet */}
          <div className="space-y-2">
            <p className="font-mono text-6xl font-semibold tracking-tight text-focus-800 tabular-nums sm:text-7xl">
              00:00
            </p>
            <p className="text-sm text-ink-500">Remaining time</p>
          </div>

          {/* Context */}
          <dl className="mx-auto grid max-w-md grid-cols-2 gap-3 text-left">
            <div className="rounded-lg border border-ink-200 bg-ink-50 px-3 py-2">
              <dt className="text-xs text-ink-400">Planned duration</dt>
              <dd className="text-sm font-medium text-ink-800">—</dd>
            </div>
            <div className="rounded-lg border border-ink-200 bg-ink-50 px-3 py-2">
              <dt className="text-xs text-ink-400">Started at</dt>
              <dd className="text-sm font-medium text-ink-800">—</dd>
            </div>
          </dl>

          {/* Exit is always reachable */}
          <div className="flex flex-col items-center justify-center gap-2">
            <Button size="lg" variant="danger" disabled>
              End Focus
            </Button>
            <p className="text-xs text-ink-400">
              Ends the session and restores blocked apps immediately. No confirmation required.
            </p>
          </div>

          {/* Safety footer */}
          <p className="inline-flex items-center gap-2 rounded-lg bg-focus-50 px-3 py-2 text-xs text-focus-900">
            <ShieldCheckIcon aria-hidden="true" className="size-4 shrink-0" />
            Your browser, the agent and system-critical apps stay available for the whole session.
          </p>
        </CardContent>
      </Card>

      <p className="text-center text-xs text-ink-400">
        Placeholder only — the live countdown, extend and end actions arrive with Prompt 012.
      </p>
    </div>
  )
}