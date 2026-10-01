import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { LockKeyholeIcon, PlusIcon, ShieldCheckIcon, Trash2Icon } from 'lucide-react'

import { EmptyState } from '@/components/states/EmptyState'
import { ErrorState } from '@/components/states/ErrorState'
import { LoadingState } from '@/components/states/LoadingState'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { api } from '@/lib/api'

export default function AllowListPage() {
  const [appName, setAppName] = useState('')
  const queryClient = useQueryClient()
  const query = useQuery({ queryKey: ['allowlist'], queryFn: () => api.get('/allowlist') })
  const mutation = useMutation({
    mutationFn: (userApps) => api.put('/allowlist', { userApps }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['allowlist'] })
      toast.success('Allow-list updated.')
    },
    onError: (error) => toast.error(error.message),
  })

  if (query.isPending) return <LoadingState label="Loading your allow-list" />
  if (query.isError) return <ErrorState title="Could not load allow-list" message={query.error.message} onRetry={() => query.refetch()} />

  const data = query.data || {}
  const protectedApps = data.protectedApps || data.protected || []
  const userApps = data.userApps || data.customApps || []
  const entries = userApps.map((item) => typeof item === 'string' ? item : item.name || item.appId).filter(Boolean)

  function updateApps(nextApps) {
    mutation.mutate(nextApps)
  }

  return (
    <div className="space-y-8">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold text-brand-950">Allow-list</h1>
        <p className="text-sm text-ink-500">Choose which apps stay available during focus. Protected system entries are always included.</p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><PlusIcon className="size-4" /> Add an application</CardTitle>
          <CardDescription>Use the application or process name recognized by your local agent.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="flex flex-col gap-3 sm:flex-row sm:items-end" onSubmit={(event) => {
            event.preventDefault()
            const name = appName.trim()
            if (!name || entries.includes(name)) return
            updateApps([...entries, name])
            setAppName('')
          }}>
            <div className="w-full max-w-sm space-y-1.5">
              <Label htmlFor="app-name">Application name</Label>
              <input id="app-name" value={appName} onChange={(event) => setAppName(event.target.value)} maxLength={100} required placeholder="e.g. Code.exe" className="h-10 w-full rounded-lg border border-ink-200 bg-white px-3 text-sm" />
            </div>
            <Button type="submit" disabled={mutation.isPending || !appName.trim()}><PlusIcon /> Add app</Button>
          </form>
        </CardContent>
      </Card>

      <section className="space-y-3" aria-labelledby="protected-apps-heading">
        <div className="flex items-center gap-2">
          <h2 id="protected-apps-heading" className="text-sm font-semibold text-ink-800">Protected applications</h2>
          <span className="text-xs text-ink-500">Always allowed</span>
        </div>
        {protectedApps.length ? (
          <ul className="divide-y divide-ink-200 rounded-lg border border-ink-200 bg-white">
            {protectedApps.map((item) => {
              const name = typeof item === 'string' ? item : item.name || item.appId
              return <li key={name} className="flex items-center gap-3 px-4 py-3"><LockKeyholeIcon className="size-4 text-focus-700" /><span className="flex-1 text-sm text-ink-800">{name}</span><span className="text-xs font-medium text-focus-800">Locked</span></li>
            })}
          </ul>
        ) : <p className="rounded-lg border border-ink-200 bg-white p-4 text-sm text-ink-500">Protected browser, agent, and system apps are enforced by the server and agent.</p>}
      </section>

      <section className="space-y-3" aria-labelledby="your-apps-heading">
        <h2 id="your-apps-heading" className="text-sm font-semibold text-ink-800">Your applications</h2>
        {entries.length ? (
          <ul className="divide-y divide-ink-200 rounded-lg border border-ink-200 bg-white">
            {entries.map((name) => <li key={name} className="flex items-center gap-3 px-4 py-3"><ShieldCheckIcon className="size-4 text-brand-700" /><span className="flex-1 break-all text-sm text-ink-800">{name}</span><Button variant="ghost" size="icon-sm" aria-label={`Remove ${name}`} title={`Remove ${name}`} disabled={mutation.isPending} onClick={() => updateApps(entries.filter((entry) => entry !== name))}><Trash2Icon /></Button></li>)}
          </ul>
        ) : <EmptyState icon={ShieldCheckIcon} title="No additional apps" description="Add the apps you want available during a focus session." />}
      </section>
      <p role="note" className="text-xs leading-relaxed text-ink-500">The server and agent both enforce the protected baseline. Removing an entry here never removes a protected app.</p>
    </div>
  )
}