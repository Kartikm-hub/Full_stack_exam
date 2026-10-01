import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { z } from 'zod'
import { AlertTriangleIcon, BellIcon, KeyRoundIcon, SaveIcon, UserRoundIcon } from 'lucide-react'

import { ErrorState } from '@/components/states/ErrorState'
import { LoadingState } from '@/components/states/LoadingState'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { api } from '@/lib/api'

const passwordSchema = z.object({
  currentPassword: z.string().min(1, 'Enter your current password.'),
  newPassword: z.string().min(8, 'Use at least 8 characters.'),
})

export default function SettingsPage() {
  const queryClient = useQueryClient()
  const [notifications, setNotifications] = useState(() => localStorage.getItem('focus-mode-notifications') !== 'off')
  const [passwordErrors, setPasswordErrors] = useState({})
  const query = useQuery({ queryKey: ['profile'], queryFn: () => api.get('/auth/me') })
  const profile = query.data?.user || query.data || {}
  const profileMutation = useMutation({
    mutationFn: (values) => api.patch('/auth/me', values),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['profile'] }); toast.success('Profile saved.') },
    onError: (error) => toast.error(error.message),
  })
  const passwordMutation = useMutation({
    mutationFn: (values) => api.post('/auth/change-password', values),
    onSuccess: () => { setPasswordErrors({}); toast.success('Password changed.') },
    onError: (error) => toast.error(error.message),
  })
  const unpairMutation = useMutation({
    mutationFn: () => api.delete('/devices'),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['devices'] }); toast.success('All devices were unpaired.') },
    onError: (error) => toast.error(error.message),
  })

  if (query.isPending) return <LoadingState label="Loading settings" />
  if (query.isError) return <ErrorState title="Could not load settings" message={query.error.message} onRetry={() => query.refetch()} />

  return (
    <div className="space-y-8">
      <header className="space-y-1"><h1 className="text-2xl font-semibold text-brand-950">Settings</h1><p className="text-sm text-ink-500">Manage your profile, focus defaults, and account security.</p></header>
      <Card><CardHeader><CardTitle className="flex items-center gap-2"><UserRoundIcon className="size-4" /> Profile and defaults</CardTitle><CardDescription>Your account details and preferred session length.</CardDescription></CardHeader><CardContent><form className="grid gap-4 sm:grid-cols-2" onSubmit={(event) => { event.preventDefault(); const values = Object.fromEntries(new FormData(event.currentTarget)); profileMutation.mutate({ name: values.name, defaultDurationMin: Number(values.defaultDurationMin) }) }}>
        <div className="space-y-1.5"><Label htmlFor="profile-name">Name</Label><input id="profile-name" name="name" required minLength={2} defaultValue={profile.name || ''} className="h-10 w-full rounded-lg border border-ink-200 bg-white px-3 text-sm" /></div>
        <div className="space-y-1.5"><Label htmlFor="profile-email">Email</Label><input id="profile-email" type="email" readOnly value={profile.email || ''} className="h-10 w-full rounded-lg border border-ink-200 bg-ink-50 px-3 text-sm text-ink-500" /></div>
        <div className="space-y-1.5"><Label htmlFor="default-duration">Default duration</Label><select id="default-duration" name="defaultDurationMin" defaultValue={profile.defaultDurationMin || 25} className="h-10 w-full rounded-lg border border-ink-200 bg-white px-3 text-sm">{[25, 50, 60, 90, 120].map((minutes) => <option key={minutes} value={minutes}>{minutes} minutes</option>)}</select></div>
        <div className="flex items-end"><Button type="submit" disabled={profileMutation.isPending}><SaveIcon /> Save profile</Button></div>
      </form></CardContent></Card>

      <Card><CardHeader><CardTitle className="flex items-center gap-2"><KeyRoundIcon className="size-4" /> Change password</CardTitle></CardHeader><CardContent><form className="grid gap-4 sm:grid-cols-3" onSubmit={(event) => {
        event.preventDefault()
        const form = event.currentTarget
        const parsed = passwordSchema.safeParse(Object.fromEntries(new FormData(form)))
        if (!parsed.success) { setPasswordErrors(Object.fromEntries(parsed.error.issues.map((issue) => [issue.path[0], issue.message]))); return }
        passwordMutation.mutate(parsed.data, { onSuccess: () => form.reset() })
      }}>
        {['currentPassword', 'newPassword'].map((name) => <div key={name} className="space-y-1.5"><Label htmlFor={name}>{name === 'currentPassword' ? 'Current password' : 'New password'}</Label><input id={name} name={name} type="password" autoComplete={name === 'currentPassword' ? 'current-password' : 'new-password'} required className="h-10 w-full rounded-lg border border-ink-200 bg-white px-3 text-sm" />{passwordErrors[name] ? <p className="text-xs text-danger-700">{passwordErrors[name]}</p> : null}</div>)}
        <div className="flex items-end"><Button type="submit" disabled={passwordMutation.isPending}>{passwordMutation.isPending ? 'Updating…' : 'Update password'}</Button></div>
      </form></CardContent></Card>

      <section className="space-y-3" aria-labelledby="notifications-heading"><h2 id="notifications-heading" className="text-sm font-semibold text-ink-800">Notifications</h2><label className="flex items-start gap-3 rounded-lg border border-ink-200 bg-white p-4"><input type="checkbox" checked={notifications} onChange={(event) => { setNotifications(event.target.checked); localStorage.setItem('focus-mode-notifications', event.target.checked ? 'on' : 'off') }} /><span><span className="flex items-center gap-2 text-sm font-medium text-ink-800"><BellIcon className="size-4" /> Focus reminders</span><span className="mt-1 block text-xs text-ink-500">Allow this browser to show focus session reminders.</span></span></label></section>

      <Card className="border-danger-200"><CardHeader><CardTitle className="flex items-center gap-2 text-danger-800"><AlertTriangleIcon className="size-4" /> Danger zone</CardTitle><CardDescription>Unpairing all devices cancels any active sessions on those devices.</CardDescription></CardHeader><CardContent><Button variant="danger-outline" disabled={unpairMutation.isPending} onClick={() => { if (window.confirm('Unpair all devices? Any active sessions will be cancelled.')) unpairMutation.mutate() }}>Unpair all devices</Button></CardContent></Card>
    </div>
  )
}