import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { ArrowRightIcon, TimerIcon } from 'lucide-react'
import { Link } from 'react-router-dom'

import { StatTile } from '@/components/common/PageHeader'
import { AgentStatusBadge } from '@/components/agent/AgentStatusBadge'
import { useAgentCommands } from '@/features/agent/useAgentCommands'
import { useAgentStatus } from '@/features/agent/useAgentStatus'
import * as Dialog from '@radix-ui/react-dialog'
import { EmptyState } from '@/components/states/EmptyState'
import { ErrorState } from '@/components/states/ErrorState'
import { LoadingState } from '@/components/states/LoadingState'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { api } from '@/lib/api'

const DURATIONS = [25, 50, 60]

function DurationOption({ minutes, selected, onSelect }) {
  return (
    <button
      type="button"
      aria-label={`${minutes} minutes`}
      aria-pressed={selected}
      onClick={onSelect}
      className={cn('flex min-h-20 flex-col items-center justify-center gap-1 rounded-lg border px-6 py-4 text-center transition-colors', selected ? 'border-focus-600 bg-focus-50' : 'border-ink-200 bg-white hover:border-ink-400')}
    >
      <span className="text-2xl font-semibold text-brand-950">{minutes}</span>
      <span className="text-xs text-ink-400">minutes</span>
    </button>
  )
}

const sessionId = (session) => session?.id || session?._id

function minutesLabel(value) {
  const minutes = Number(value || 0)
  return minutes >= 60 ? `${Math.floor(minutes / 60)}h ${minutes % 60}m` : `${minutes}m`
}

export default function DashboardPage() {
  const agentStatus = useAgentStatus()
  const agent = useAgentCommands()
  const queryClient = useQueryClient()
  const [duration, setDuration] = useState(25)
  const [consentOpen, setConsentOpen] = useState(false)
  const [deviceId, setDeviceId] = useState('')
  const devicesQuery = useQuery({ queryKey: ['devices'], queryFn: () => api.get('/devices') })
  const activeQuery = useQuery({ queryKey: ['active-session'], queryFn: () => api.get('/sessions/active'), refetchInterval: 15000 })
  const sessionsQuery = useQuery({ queryKey: ['sessions', 'recent'], queryFn: () => api.get('/sessions', { headers: {} }) })
  const insightsQuery = useQuery({ queryKey: ['insights', 'dashboard'], queryFn: () => api.get(`/insights?range=7&tz=${encodeURIComponent(Intl.DateTimeFormat().resolvedOptions().timeZone)}`) })

  useEffect(() => {
    if (agentStatus.sessionActive) {
      queryClient.invalidateQueries({ queryKey: ['active-session'] })
      queryClient.invalidateQueries({ queryKey: ['sessions'] })
    }
  }, [agentStatus.sessionActive, queryClient])

  const activeSession = activeQuery.data && Object.hasOwn(activeQuery.data, 'session')
    ? activeQuery.data.session
    : activeQuery.data?.activeSession ?? activeQuery.data ?? null
  const deviceList = devicesQuery.data?.items || devicesQuery.data?.devices || devicesQuery.data || []
  const pairedDevices = deviceList.filter((device) => ['CONNECTED', 'ONLINE', 'READY'].includes(String(device.status).toUpperCase()) || device.connected)
  const selectedDevice = pairedDevices.find((device) => (device.id || device._id) === deviceId) || pairedDevices[0]
  const sessionList = sessionsQuery.data?.items || sessionsQuery.data?.sessions || []
  const metrics = insightsQuery.data?.summary || insightsQuery.data || {}
  const canStart = agent.connected && agentStatus.paired && agentStatus.status === 'READY' && !activeSession && selectedDevice

  const startMutation = useMutation({
    mutationFn: async () => {
      if (!selectedDevice) throw new Error('Pair and connect a device before starting focus.')
      const created = await api.post('/sessions', { deviceId: selectedDevice.id || selectedDevice._id, durationMin: duration })
      const session = created.session || created
      try {
        agent.send('enterFocus', { sessionId: sessionId(session), commandToken: created.commandToken })
      } catch (error) {
        if (sessionId(session)) await api.patch(`/sessions/${sessionId(session)}`, { status: 'CANCELLED' }).catch(() => {})
        throw error
      }
      return session
    },
    onSuccess: () => {
      setConsentOpen(false)
      toast.success('Request sent. Focus turns on only after the agent confirms.')
      queryClient.invalidateQueries({ queryKey: ['active-session'] })
      queryClient.invalidateQueries({ queryKey: ['sessions'] })
    },
    onError: (error) => toast.error(error.message),
  })

  if (devicesQuery.isPending || activeQuery.isPending) return <LoadingState label="Loading your focus dashboard" />
  if (devicesQuery.isError || activeQuery.isError) {
    const error = devicesQuery.error || activeQuery.error
    return <ErrorState title="Could not load dashboard" message={error.message} onRetry={() => { devicesQuery.refetch(); activeQuery.refetch() }} />
  }

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
              <DurationOption key={minutes} minutes={minutes} selected={minutes === duration} onSelect={() => setDuration(minutes)} />
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button size="lg" variant="focus" disabled={!canStart} onClick={() => setConsentOpen(true)}>
              <TimerIcon /> Start Focus
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link to="/focus">Focus status <ArrowRightIcon /></Link>
            </Button>
            {!canStart ? <span className="text-xs text-ink-500">Connect a paired agent before starting a session.</span> : null}
          </div>
          {pairedDevices.length > 1 ? <div className="max-w-sm space-y-1.5"><label htmlFor="focus-device" className="text-xs font-medium text-ink-600">Device</label><select id="focus-device" value={selectedDevice?.id || selectedDevice?._id || ''} onChange={(event) => setDeviceId(event.target.value)} className="h-10 w-full rounded-lg border border-ink-200 bg-white px-3 text-sm">{pairedDevices.map((device) => <option key={device.id || device._id} value={device.id || device._id}>{device.name || device.label || 'Focus Mode device'}</option>)}</select></div> : null}
          {activeSession || agentStatus.sessionActive ? <p role="status" className="rounded-lg bg-focus-50 px-3 py-2 text-sm text-focus-900">A focus session is already active. <Link to="/focus" className="font-semibold underline">Open focus controls</Link></p> : null}
        </CardContent>
      </Card>

      {/* Today's focus time */}
      <section aria-labelledby="today-heading" className="space-y-3">
        <h2 id="today-heading" className="text-sm font-semibold tracking-tight text-ink-800">
          Today's focus time
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile label="Focus time" value={minutesLabel(metrics.todayMinutes ?? metrics.focusMinutesToday ?? 0)} hint="Today" tone="focus" />
          <StatTile label="Sessions" value={metrics.todaySessions ?? metrics.sessionsToday ?? 0} hint="Today" />
          <StatTile label="Longest session" value={minutesLabel(metrics.longestSessionMin ?? metrics.longestSessionMinutes ?? 0)} hint="Last 7 days" />
          <StatTile label="Streak" value={`${metrics.currentStreak ?? metrics.streak ?? 0} days`} hint="Completed days" tone="muted" />
        </div>
      </section>

      {/* Recent sessions */}
      <section aria-labelledby="recent-heading" className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 id="recent-heading" className="text-sm font-semibold tracking-tight text-ink-800">
            Recent sessions
          </h2>
          <Badge tone="neutral">{sessionList.length}</Badge>
        </div>
        {sessionList.length ? <div className="divide-y divide-ink-200 rounded-lg border border-ink-200 bg-white">{sessionList.slice(0, 5).map((session) => <div key={sessionId(session)} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-sm"><span className="min-w-32 flex-1 text-ink-800">{session.startedAt ? new Date(session.startedAt).toLocaleString() : 'Session'}</span><span className="text-ink-500">{minutesLabel(session.actualMinutes ?? session.durationMin)}</span><Badge tone={String(session.status).toLowerCase() === 'completed' ? 'focus' : 'neutral'}>{session.status || 'Unknown'}</Badge></div>)}</div> : <EmptyState
          icon={TimerIcon}
          title="No sessions yet"
          description="Your completed sessions will appear here with how each one ended."
          action={
            <Button variant="subtle" size="sm" asChild><Link to="/insights">View insights</Link></Button>
          }
        />}
      </section>

      {/* Safety reminder, always visible per SPEC.md §7 */}
      <Card inset className="px-4 py-3">
        <p className={cn('text-xs leading-relaxed text-ink-500')}>
          Ending a session always works, including when the dashboard cannot reach the agent.
          Protected apps — your browser, the agent, and system-critical services — are always
          allowed.
        </p>
      </Card>

      <Dialog.Root open={consentOpen} onOpenChange={setConsentOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-ink-950/50" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg border border-ink-200 bg-white p-6 shadow-xl">
            <Dialog.Title className="text-lg font-semibold text-brand-950">Start a {duration}-minute session?</Dialog.Title>
            <Dialog.Description className="mt-2 text-sm leading-relaxed text-ink-600">The local agent will apply your allow-list. Your browser and protected system apps remain available. You can end focus immediately at any time.</Dialog.Description>
            <div className="mt-6 flex justify-end gap-2">
              <Dialog.Close asChild><Button variant="outline">Cancel</Button></Dialog.Close>
              <Button variant="focus" disabled={startMutation.isPending} onClick={() => startMutation.mutate()}>{startMutation.isPending ? 'Requesting…' : 'Confirm and start'}</Button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  )
}