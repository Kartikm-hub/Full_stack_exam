import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Navigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { BarChart3Icon, PlusIcon, ShieldIcon, Trash2Icon, UsersIcon } from 'lucide-react'

import { ErrorState } from '@/components/states/ErrorState'
import { LoadingState } from '@/components/states/LoadingState'
import { StatTile } from '@/components/common/PageHeader'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/features/auth/useAuth'
import { api } from '@/lib/api'

export default function AdminPage() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [apps, setApps] = useState('')
  const admin = ['ADMIN', 'admin'].includes(user?.role)
  const usersQuery = useQuery({ queryKey: ['admin', 'users'], queryFn: () => api.get('/admin/users'), enabled: admin })
  const statsQuery = useQuery({ queryKey: ['admin', 'stats'], queryFn: () => api.get('/admin/stats'), enabled: admin })
  const presetsQuery = useQuery({ queryKey: ['admin', 'presets'], queryFn: () => api.get('/admin/presets'), enabled: admin })
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['admin'] })
  const updateUser = useMutation({
    mutationFn: ({ id, isActive }) => api.patch(`/admin/users/${id}`, { isActive }),
    onSuccess: () => { invalidate(); toast.success('User updated.') },
    onError: (error) => toast.error(error.message),
  })
  const createPreset = useMutation({
    mutationFn: (preset) => api.post('/admin/presets', preset),
    onSuccess: () => { invalidate(); setApps(''); toast.success('Preset published.') },
    onError: (error) => toast.error(error.message),
  })
  const deletePreset = useMutation({
    mutationFn: (id) => api.delete(`/admin/presets/${id}`),
    onSuccess: () => { invalidate(); toast.success('Preset removed.') },
    onError: (error) => toast.error(error.message),
  })

  if (!admin) return <Navigate to="/dashboard" replace />
  if (usersQuery.isPending || statsQuery.isPending || presetsQuery.isPending) return <LoadingState label="Loading administration" />
  const failure = usersQuery.error || statsQuery.error || presetsQuery.error
  if (failure) return <ErrorState title="Could not load admin data" message={failure.message} onRetry={() => { usersQuery.refetch(); statsQuery.refetch(); presetsQuery.refetch() }} />

  const users = usersQuery.data?.items || usersQuery.data?.users || usersQuery.data || []
  const presets = presetsQuery.data?.items || presetsQuery.data?.presets || presetsQuery.data || []
  const stats = statsQuery.data?.stats || statsQuery.data || {}

  return (
    <div className="space-y-8">
      <header className="space-y-1"><h1 className="text-2xl font-semibold text-brand-950">Administration</h1><p className="text-sm text-ink-500">Manage accounts, service health, and published application presets.</p></header>
      <section className="grid gap-3 sm:grid-cols-3"><StatTile label="Users" value={stats.totalUsers ?? stats.users ?? users.length} tone="info" /><StatTile label="Active users" value={stats.activeUsers ?? '—'} /><StatTile label="Focus sessions" value={stats.totalSessions ?? stats.sessions ?? '—'} tone="focus" /></section>
      <section className="space-y-3" aria-labelledby="admin-users-heading"><h2 id="admin-users-heading" className="flex items-center gap-2 text-sm font-semibold text-ink-800"><UsersIcon className="size-4" /> Users</h2><div className="overflow-x-auto rounded-lg border border-ink-200 bg-white"><table className="w-full min-w-[36rem] text-left text-sm"><thead className="border-b border-ink-200 bg-ink-50 text-xs text-ink-500"><tr><th scope="col" className="px-4 py-3 font-medium">Account</th><th scope="col" className="px-4 py-3 font-medium">Role</th><th scope="col" className="px-4 py-3 font-medium">Status</th><th scope="col" className="px-4 py-3 text-right font-medium">Action</th></tr></thead><tbody className="divide-y divide-ink-200">{users.map((entry) => <tr key={entry.id || entry._id}><td className="px-4 py-3"><p className="font-medium text-ink-800">{entry.name}</p><p className="text-xs text-ink-500">{entry.email}</p></td><td className="px-4 py-3">{entry.role}</td><td className="px-4 py-3">{entry.isActive === false ? 'Inactive' : 'Active'}</td><td className="px-4 py-3 text-right"><Button variant={entry.isActive === false ? 'outline' : 'danger-outline'} size="sm" disabled={updateUser.isPending} onClick={() => updateUser.mutate({ id: entry.id || entry._id, isActive: entry.isActive === false })}>{entry.isActive === false ? 'Reactivate' : 'Deactivate'}</Button></td></tr>)}</tbody></table></div></section>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card><CardHeader><CardTitle className="flex items-center gap-2"><ShieldIcon className="size-4" /> Published presets</CardTitle><CardDescription>Protected apps are enforced independently and cannot be removed by presets.</CardDescription></CardHeader><CardContent className="space-y-4">{presets.length ? <ul className="divide-y divide-ink-200 rounded-md border border-ink-200">{presets.map((preset) => <li key={preset.id || preset._id} className="flex items-center gap-3 px-3 py-2"><span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium text-ink-800">{preset.name}</span><span className="block truncate text-xs text-ink-500">{(preset.apps || preset.userApps || []).join(', ')}</span></span><Button variant="ghost" size="icon-sm" aria-label={`Remove ${preset.name}`} onClick={() => deletePreset.mutate(preset.id || preset._id)}><Trash2Icon /></Button></li>)}</ul> : <p className="text-sm text-ink-500">No published presets.</p>}<form className="space-y-3 border-t border-ink-200 pt-4" onSubmit={(event) => { event.preventDefault(); const form = new FormData(event.currentTarget); createPreset.mutate({ name: form.get('presetName'), apps: apps.split(',').map((value) => value.trim()).filter(Boolean) }) }}><div className="space-y-1.5"><Label htmlFor="preset-name">Preset name</Label><input id="preset-name" name="presetName" required maxLength={60} className="h-10 w-full rounded-lg border border-ink-200 bg-white px-3 text-sm" /></div><div className="space-y-1.5"><Label htmlFor="preset-apps">Applications, comma separated</Label><input id="preset-apps" value={apps} onChange={(event) => setApps(event.target.value)} required className="h-10 w-full rounded-lg border border-ink-200 bg-white px-3 text-sm" /></div><Button type="submit" disabled={createPreset.isPending}><PlusIcon /> Publish preset</Button></form></CardContent></Card>
        <Card><CardHeader><CardTitle className="flex items-center gap-2"><BarChart3Icon className="size-4" /> Service overview</CardTitle><CardDescription>Aggregate usage metrics only. No per-user browsing or device activity tracking.</CardDescription></CardHeader><CardContent className="space-y-3 text-sm"><p className="flex justify-between gap-4"><span className="text-ink-500">Paired devices</span><strong className="text-ink-800">{stats.pairedDevices ?? '—'}</strong></p><p className="flex justify-between gap-4"><span className="text-ink-500">Active sessions</span><strong className="text-ink-800">{stats.activeSessions ?? '—'}</strong></p><p className="flex justify-between gap-4"><span className="text-ink-500">Sessions completed</span><strong className="text-ink-800">{stats.completedSessions ?? '—'}</strong></p></CardContent></Card>
      </div>
    </div>
  )
}