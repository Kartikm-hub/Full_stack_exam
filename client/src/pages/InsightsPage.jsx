import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { FlameIcon, TargetIcon, TrophyIcon } from 'lucide-react'

import { ErrorState } from '@/components/states/ErrorState'
import { LoadingState } from '@/components/states/LoadingState'
import { StatTile } from '@/components/common/PageHeader'
import { api } from '@/lib/api'

const RANGES = [7, 14, 30, 90]

export default function InsightsPage() {
  const [range, setRange] = useState(7)
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone
  const query = useQuery({ queryKey: ['insights', range, timezone], queryFn: () => api.get(`/insights?range=${range}&tz=${encodeURIComponent(timezone)}`) })

  if (query.isPending) return <LoadingState label="Loading focus insights" />
  if (query.isError) return <ErrorState title="Could not load insights" message={query.error.message} onRetry={() => query.refetch()} />

  const data = query.data || {}
  const summary = data.summary || data
  const days = data.daily || data.series || data.days || []
  const chartData = days.map((item) => ({
    day: item.date ? new Date(`${item.date}T12:00:00`).toLocaleDateString([], { month: 'short', day: 'numeric' }) : item.label,
    minutes: Number(item.minutes ?? item.focusMinutes ?? item.totalMinutes ?? 0),
  }))

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div className="space-y-1"><h1 className="text-2xl font-semibold text-brand-950">Insights</h1><p className="text-sm text-ink-500">Focus time and completed sessions only. No browsing history or keystrokes are collected.</p></div><div role="group" aria-label="Insights date range" className="inline-flex rounded-md border border-ink-200 bg-white p-1">{RANGES.map((value) => <button key={value} type="button" aria-pressed={range === value} onClick={() => setRange(value)} className={`min-h-8 rounded px-3 text-xs font-medium ${range === value ? 'bg-brand-800 text-white' : 'text-ink-600 hover:bg-ink-100'}`}>{value}d</button>)}</div></header>
      <section className="grid gap-3 sm:grid-cols-3">
        <StatTile label="Focus time" value={`${summary.totalMinutes ?? summary.focusMinutes ?? 0}m`} hint={`Last ${range} days`} tone="focus" />
        <StatTile label="Current streak" value={`${summary.currentStreak ?? summary.streak ?? 0} days`} hint="Completed days" />
        <StatTile label="Completion rate" value={`${Math.round((summary.completionRate ?? 0) * (summary.completionRate <= 1 ? 100 : 1))}%`} hint="Sessions completed" tone="info" />
      </section>
      <section className="space-y-3" aria-labelledby="daily-focus-heading"><div><h2 id="daily-focus-heading" className="text-sm font-semibold text-ink-800">Daily focus time</h2><p className="text-xs text-ink-500">Your local timezone: {timezone}</p></div><div className="h-72 rounded-lg border border-ink-200 bg-white p-3 sm:p-5">{chartData.length ? <ResponsiveContainer width="100%" height="100%"><BarChart data={chartData} margin={{ top: 8, right: 8, left: -18, bottom: 4 }}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" /><XAxis dataKey="day" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} /><YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11 }} /><Tooltip formatter={(value) => [`${value} min`, 'Focus time']} /><Bar dataKey="minutes" fill="#4F46E5" radius={[3, 3, 0, 0]} maxBarSize={34} /></BarChart></ResponsiveContainer> : <div className="grid h-full place-items-center text-sm text-ink-500">No completed sessions in this range.</div>}</div></section>
      <section className="grid gap-4 sm:grid-cols-2"><div className="rounded-lg border border-ink-200 bg-white p-4"><div className="flex items-center gap-2 text-ink-500"><FlameIcon className="size-4 text-warn-600" /><h2 className="text-sm font-semibold text-ink-800">Best focus hours</h2></div><p className="mt-3 text-lg font-semibold text-brand-950">{data.bestHours?.length ? data.bestHours.map((hour) => `${hour.hour}:00`).join(', ') : 'Not enough data yet'}</p></div><div className="rounded-lg border border-ink-200 bg-white p-4"><div className="flex items-center gap-2 text-ink-500"><TrophyIcon className="size-4 text-calm-600" /><h2 className="text-sm font-semibold text-ink-800">Sessions completed</h2></div><p className="mt-3 text-lg font-semibold text-brand-950"><TargetIcon className="mr-2 inline size-4 text-focus-700" />{summary.completedSessions ?? summary.sessionsCompleted ?? 0}</p></div></section>
    </div>
  )
}