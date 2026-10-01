import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { LaptopIcon, Link2Icon, UnlinkIcon } from 'lucide-react'

import { EmptyState } from '@/components/states/EmptyState'
import { ErrorState } from '@/components/states/ErrorState'
import { LoadingState } from '@/components/states/LoadingState'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { api } from '@/lib/api'
import { useAgentCommands } from '@/features/agent/useAgentCommands'

const DEVICES_KEY = ['devices']

function deviceId(device) {
  return device.id || device._id
}

export default function DevicesPage() {
  const [code, setCode] = useState('')
  const agent = useAgentCommands()
  const queryClient = useQueryClient()
  const devicesQuery = useQuery({ queryKey: DEVICES_KEY, queryFn: () => api.get('/devices') })
  const pairMutation = useMutation({
    mutationFn: () => api.post('/devices/pair', { code }),
    onSuccess: () => {
      setCode('')
      if (agent.connected) agent.send('getState')
      queryClient.invalidateQueries({ queryKey: DEVICES_KEY })
      toast.success('Device paired to your account.')
    },
    onError: (error) => toast.error(error.message),
  })
  const unpairMutation = useMutation({
    mutationFn: (id) => api.delete(`/devices/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: DEVICES_KEY })
      toast.success('Device unpaired.')
    },
    onError: (error) => toast.error(error.message),
  })
  const devices = devicesQuery.data?.items || devicesQuery.data?.devices || devicesQuery.data || []

  if (devicesQuery.isPending) return <LoadingState label="Loading paired devices" />
  if (devicesQuery.isError) return <ErrorState title="Could not load devices" message={devicesQuery.error.message} onRetry={() => devicesQuery.refetch()} />

  return (
    <div className="space-y-8">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold text-brand-950">Devices</h1>
        <p className="text-sm text-ink-500">Pair an agent using its short-lived code. Unpairing stops any active session on that device.</p>
      </header>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Link2Icon className="size-4" /> Pair a device</CardTitle>
          <CardDescription>Enter the 6-digit code shown by the Focus Mode agent on your computer.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="flex flex-col gap-3 sm:flex-row sm:items-end" onSubmit={(event) => { event.preventDefault(); pairMutation.mutate() }}>
            <div className="w-full max-w-xs space-y-1.5">
              <Label htmlFor="pairing-code">Pairing code</Label>
              <input id="pairing-code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} pattern="[0-9]{6}" required value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="123456" className="h-10 w-full rounded-lg border border-ink-200 bg-white px-3 font-mono text-lg tracking-[0.25em]" />
            </div>
            <Button type="submit" disabled={code.length !== 6 || pairMutation.isPending}>
              {pairMutation.isPending ? 'Pairing…' : 'Pair device'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <section className="space-y-3" aria-labelledby="paired-devices-heading">
        <div className="flex items-center justify-between gap-3">
          <h2 id="paired-devices-heading" className="text-sm font-semibold text-ink-800">Paired agents</h2>
          <span className="text-xs text-ink-500">{devices.length} {devices.length === 1 ? 'device' : 'devices'}</span>
        </div>
        {devices.length === 0 ? (
          <EmptyState icon={LaptopIcon} title="No paired devices" description="Start the Focus Mode agent on a computer and pair it with the code it displays." />
        ) : (
          <div className="divide-y divide-ink-200 rounded-lg border border-ink-200 bg-white">
            {devices.map((device) => (
              <div key={deviceId(device)} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
                <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-700"><LaptopIcon className="size-5" /></div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-ink-900">{device.name || device.label || 'Focus Mode device'}</p>
                  <p className="mt-1 text-xs text-ink-500">{device.os || device.platform || 'Unknown platform'} · {device.status || 'Paired'}{device.lastSeenAt ? ` · Seen ${new Date(device.lastSeenAt).toLocaleString()}` : ''}</p>
                </div>
                <Button variant="danger-outline" size="sm" disabled={unpairMutation.isPending} onClick={() => {
                  if (window.confirm('Unpair this device? Any active focus session will be cancelled.')) unpairMutation.mutate(deviceId(device))
                }}><UnlinkIcon /> Unpair</Button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}