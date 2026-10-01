import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { CalendarClockIcon, PlusIcon, Trash2Icon } from 'lucide-react'

import { EmptyState } from '@/components/states/EmptyState'
import { ErrorState } from '@/components/states/ErrorState'
import { LoadingState } from '@/components/states/LoadingState'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { api } from '@/lib/api'

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export default function SchedulesPage() {
  const queryClient = useQueryClient()
  const [days, setDays] = useState(['Mon', 'Tue', 'Wed', 'Thu', 'Fri'])
  const query = useQuery({ queryKey: ['schedules'], queryFn: () => api.get('/schedules') })
  const createMutation = useMutation({
    mutationFn: (schedule) => api.post('/schedules', schedule),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['schedules'] }); toast.success('Schedule created.') },
    onError: (error) => toast.error(error.message),
  })
  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/schedules/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['schedules'] }); toast.success('Schedule removed.') },
    onError: (error) => toast.error(error.message),
  })

  if (query.isPending) return <LoadingState label="Loading schedules" />
  if (query.isError) return <ErrorState title="Could not load schedules" message={query.error.message} onRetry={() => query.refetch()} />

  const schedules = query.data?.items || query.data?.schedules || query.data || []

  return (
    <div className="space-y-8">
      <header className="space-y-1"><h1 className="text-2xl font-semibold text-brand-950">Schedules</h1><p className="text-sm text-ink-500">Plan bounded recurring focus windows. Scheduled sessions still require a running, paired agent.</p></header>
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><PlusIcon className="size-4" /> New schedule</CardTitle><CardDescription>Choose the days and local time when a focus session should be available.</CardDescription></CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={(event) => {
            event.preventDefault()
            const form = new FormData(event.currentTarget)
            createMutation.mutate({ name: form.get('name'), daysOfWeek: days, startTime: form.get('startTime'), durationMin: Number(form.get('durationMin')), timezone: Intl.DateTimeFormat().resolvedOptions().timeZone })
          }}>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-1.5"><Label htmlFor="schedule-name">Name</Label><input id="schedule-name" name="name" required maxLength={60} placeholder="Morning deep work" className="h-10 w-full rounded-lg border border-ink-200 bg-white px-3 text-sm" /></div>
              <div className="space-y-1.5"><Label htmlFor="schedule-start">Start time</Label><input id="schedule-start" name="startTime" type="time" required defaultValue="09:00" className="h-10 w-full rounded-lg border border-ink-200 bg-white px-3 text-sm" /></div>
              <div className="space-y-1.5"><Label htmlFor="schedule-duration">Duration</Label><select id="schedule-duration" name="durationMin" defaultValue="50" className="h-10 w-full rounded-lg border border-ink-200 bg-white px-3 text-sm">{[25, 50, 60, 90, 120].map((minutes) => <option key={minutes} value={minutes}>{minutes} minutes</option>)}</select></div>
            </div>
            <fieldset className="space-y-2"><legend className="text-sm font-medium text-ink-700">Repeat on</legend><div className="flex flex-wrap gap-2">{WEEKDAYS.map((day) => <label key={day} className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-ink-200 bg-white px-3 py-2 text-sm"><input type="checkbox" checked={days.includes(day)} onChange={() => setDays((current) => current.includes(day) ? current.filter((value) => value !== day) : [...current, day])} />{day}</label>)}</div></fieldset>
            <Button type="submit" disabled={!days.length || createMutation.isPending}><CalendarClockIcon />{createMutation.isPending ? 'Saving…' : 'Create schedule'}</Button>
          </form>
        </CardContent>
      </Card>
      <section className="space-y-3" aria-labelledby="schedule-list-heading"><h2 id="schedule-list-heading" className="text-sm font-semibold text-ink-800">Recurring windows</h2>
        {schedules.length ? <ul className="divide-y divide-ink-200 rounded-lg border border-ink-200 bg-white">{schedules.map((schedule) => <li key={schedule.id || schedule._id} className="flex flex-wrap items-center gap-3 p-4"><CalendarClockIcon className="size-5 text-brand-700" /><div className="min-w-0 flex-1"><p className="text-sm font-semibold text-ink-900">{schedule.name}</p><p className="mt-1 text-xs text-ink-500">{(schedule.daysOfWeek || schedule.days || []).join(', ')} · {schedule.startTime} · {schedule.durationMin} min · {schedule.timezone || 'Local time'}</p></div><Button variant="danger-outline" size="sm" disabled={deleteMutation.isPending} onClick={() => deleteMutation.mutate(schedule.id || schedule._id)}><Trash2Icon /> Remove</Button></li>)}</ul> : <EmptyState icon={CalendarClockIcon} title="No schedules yet" description="Create a recurring window to organize your focus time." />}
      </section>
      <p className="text-xs text-ink-500">Automatic schedule activation depends on the server scheduler and a connected agent. Sessions remain time-bounded and can always be ended.</p>
    </div>
  )
}