import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Link } from 'react-router-dom'
import { ShieldCheckIcon } from 'lucide-react'

import { AgentStatusBadge } from '@/components/agent/AgentStatusBadge'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { useAgentCommands } from '@/features/agent/useAgentCommands'
import { useAgentStatus } from '@/features/agent/useAgentStatus'
import { api } from '@/lib/api'
import { LoadingState } from '@/components/states/LoadingState'
import { ErrorState } from '@/components/states/ErrorState'

function getSessionEnd(session, agentStatus) {
  const end = session?.endsAt || session?.plannedEndAt || session?.endAt || agentStatus.sessionEndsAt
  if (end) return new Date(end).getTime()
  const startedAt = session?.startedAt || session?.startTime
  const duration = session?.durationMin || session?.durationMinutes
  if (startedAt && duration) return new Date(startedAt).getTime() + Number(duration) * 60000
  return null
}

function formatRemaining(milliseconds) {
  const seconds = Math.max(0, Math.floor(milliseconds / 1000))
  return `${String(Math.floor(seconds / 3600)).padStart(2, '0')}:${String(Math.floor((seconds % 3600) / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`
}

export default function FocusPage() {
  const status = useAgentStatus()
  const agent = useAgentCommands()
  const queryClient = useQueryClient()
  const [now, setNow] = useState(0)
  const query = useQuery({ queryKey: ['active-session'], queryFn: () => api.get('/sessions/active'), refetchInterval: 10000 })
  const session = query.data?.session ?? query.data?.activeSession ?? query.data ?? null
  const active = Boolean(status.sessionActive || session?.status === 'ACTIVE')
  const endAt = getSessionEnd(session, status)
  const remaining = endAt && now > 0 ? Math.max(0, endAt - now) : 0
  const duration = Number(session?.durationMin || session?.durationMinutes || 0) * 60000
  const progress = duration ? Math.min(1, Math.max(0, remaining / duration)) : 0

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  const endMutation = useMutation({
    mutationFn: () => {
      const id = session?.id || session?._id || status.sessionId
      if (!agent.connected) throw new Error('The agent is not connected. End focus from the agent tray to restore your apps.')
      agent.send('exitFocus', { sessionId: id })
      return id
    },
    onSuccess: () => toast.success('Exit requested. The session ends when the agent confirms restoration.'),
    onError: (error) => toast.error(error.message),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['active-session'] })
      queryClient.invalidateQueries({ queryKey: ['sessions'] })
    },
  })

  if (query.isPending) return <LoadingState label="Checking focus session" />
  if (query.isError && !status.sessionActive) return <ErrorState title="Could not check your session" message={query.error.message} onRetry={() => query.refetch()} />

  if (!active) return (
    <div className="mx-auto w-full max-w-xl space-y-5 text-center">
      <AgentStatusBadge status={status} className="mx-auto" />
      <h1 className="text-2xl font-semibold text-brand-950">No active focus session</h1>
      <p className="text-sm text-ink-500">Your system has not been reported as restricted. Start a session from the dashboard when your agent is connected.</p>
      <Button asChild><Link to="/dashboard">Go to dashboard</Link></Button>
    </div>
  )

  return (
    <div className="w-full space-y-5">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium text-ink-500">Focus session</span>
        <AgentStatusBadge status={status} />
      </div>
      <Card className="overflow-hidden border-brand-900 bg-brand-950 text-white">
        <CardContent className="space-y-8 px-5 py-8 text-center sm:px-10 sm:py-10">
          {/* Live-state marker */}
          <div className="flex items-center justify-center gap-2">
            <span aria-hidden="true" className="size-2.5 animate-pulse rounded-full bg-focus-400" />
            <Badge tone="focus">Focus mode active</Badge>
          </div>

          <div className="relative mx-auto grid size-64 max-w-full place-items-center">
            <svg viewBox="0 0 100 100" className="absolute inset-0 size-full -rotate-90" aria-hidden="true">
              <circle cx="50" cy="50" r="43" fill="none" stroke="rgb(255 255 255 / 15%)" strokeWidth="3" />
              <circle cx="50" cy="50" r="43" fill="none" stroke="#0D9488" strokeWidth="3" strokeLinecap="round" strokeDasharray={`${2 * Math.PI * 43}`} strokeDashoffset={`${2 * Math.PI * 43 * (1 - progress)}`} />
            </svg>
            <div>
              <p className="font-mono text-5xl font-semibold tabular-nums sm:text-6xl">{endAt && now > 0 ? formatRemaining(remaining) : '--:--:--'}</p>
              <p className="mt-2 text-sm text-brand-100">Remaining time</p>
            </div>
          </div>

          <dl className="mx-auto grid max-w-md grid-cols-2 gap-3 text-left">
            <div className="rounded-lg border border-white/15 bg-white/5 px-3 py-2">
              <dt className="text-xs text-brand-100">Planned duration</dt>
              <dd className="text-sm font-medium">{session?.durationMin || session?.durationMinutes ? `${session.durationMin || session.durationMinutes} minutes` : 'Agent session'}</dd>
            </div>
            <div className="rounded-lg border border-white/15 bg-white/5 px-3 py-2">
              <dt className="text-xs text-brand-100">Started at</dt>
              <dd className="text-sm font-medium">{session?.startedAt ? new Date(session.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'In progress'}</dd>
            </div>
          </dl>

          {/* Exit is always reachable */}
          <div className="flex flex-col items-center justify-center gap-2">
            <Button size="lg" variant="danger" disabled={endMutation.isPending} onClick={() => endMutation.mutate()}>
              {endMutation.isPending ? 'Ending…' : 'End Focus'}
            </Button>
            <p className="text-xs text-brand-100">
              One click asks the agent to restore your apps. The session ends when restoration is confirmed.
            </p>
          </div>

          {/* Safety footer */}
          <p className="inline-flex items-center gap-2 rounded-lg bg-focus-900 px-3 py-2 text-xs text-white">
            <ShieldCheckIcon aria-hidden="true" className="size-4 shrink-0" />
            Your browser, the agent and system-critical apps stay available for the whole session.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}