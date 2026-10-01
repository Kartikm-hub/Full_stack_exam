import { TimerIcon } from 'lucide-react'
import { Link } from 'react-router-dom'

import { PlaceholderNote, StatTile } from '@/components/common/PageHeader'
import { AgentStatusBadge } from '@/components/agent/AgentStatusBadge'
import { useAgentStatus } from '@/features/agent/AgentStatusProvider'
import { EmptyState } from '@/components/states/EmptyState'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

/**
 * Duration choices. Static for now; Prompt 012 binds selection to state and
 * then to the `focus.enter` message.
 */
const DURATIONS = [25, 50, 60]

function DurationOption({ minutes }) {
  return (
    <button
      type="button"
      disabled
      aria-label={`${minutes} minutes`}
      className="flex flex-col items-center gap-1 rounded-xl border border-ink-200 bg-white px-6 py-4 text-center transition-colors disabled:cursor-not-allowed disabled:opacity-100"
    >
      <span className="text-2xl font-semibold tracking-tight text-brand-950">{minutes}</span>
      <span className="text-xs text-ink-400">minutes</span>
    </button>
  )
}

/**
 * Dashboard placeholder.
 *
 * Static values only — no timers, no API calls, no agent commands. The layout
 * is final so Prompt 012 (session UI) and Prompt 013 (agent state) can fill in
 * data without restructuring the page.
 */
export default function DashboardPage() {
  const agentStatus = useAgentStatus()

  return (
    <div className="space-y-8">
      {/* Page heading */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight text-brand-950">Dashboard</h1>
          <p className="text-sm text-ink-500">
            Start a bounded focus session. The agent applies it on this machine.
          </p>
        </div>
        <AgentStatusBadge status={agentStatus} className="lg:hidden" />
      </div>

      {/* Start Focus */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TimerIcon aria-hidden="true" className="size-4 text-brand-700" />
            Start Focus
          </CardTitle>
          <CardDescription>
            Sessions always end. If the agent loses its connection, the system is restored
            automatically.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid grid-cols-3 gap-3 sm:max-w-lg">
            {DURATIONS.map((minutes) => (
              <DurationOption key={minutes} minutes={minutes} />
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button size="lg" variant="focus" disabled>
              Start Focus
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link to="/focus">Focus page</Link>
            </Button>
            <PlaceholderNote>Selection and submit arrive with Prompt 012.</PlaceholderNote>
          </div>
        </CardContent>
      </Card>

      {/* Today's focus time */}
      <section aria-labelledby="today-heading" className="space-y-3">
        <h2 id="today-heading" className="text-sm font-semibold tracking-tight text-ink-800">
          Today's focus time
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile label="Focus time" value="—" hint="Placeholder" tone="focus" />
          <StatTile label="Sessions" value="—" hint="Placeholder" />
          <StatTile label="Longest session" value="—" hint="Placeholder" />
          <StatTile label="Streak" value="—" hint="Placeholder" tone="muted" />
        </div>
      </section>

      {/* Recent sessions */}
      <section aria-labelledby="recent-heading" className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 id="recent-heading" className="text-sm font-semibold tracking-tight text-ink-800">
            Recent sessions
          </h2>
          <Badge tone="neutral">Empty</Badge>
        </div>
        <EmptyState
          icon={TimerIcon}
          title="No sessions yet"
          description="Your completed sessions will appear here with how each one ended."
          action={
            <Button variant="subtle" size="sm" disabled>
              View all sessions
            </Button>
          }
        />
      </section>

      {/* Safety reminder, always visible per SPEC.md §7 */}
      <Card inset className="px-4 py-3">
        <p className={cn('text-xs leading-relaxed text-ink-500')}>
          Ending a session always works, including when the dashboard cannot reach the agent.
          Protected apps — your browser, the agent, and system-critical services — are always
          allowed.
        </p>
      </Card>
    </div>
  )
}