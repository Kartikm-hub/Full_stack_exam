import { PlaceholderPage } from '@/pages/PlaceholderPage'

export default function SettingsPage() {
  return (
    <PlaceholderPage
      title="Settings"
      description="Account and focus preferences: default duration, maximum session length, and what happens if the agent loses its connection."
      upcoming={[
        'Default duration',
        'Maximum session length',
        'Auto-exit on disconnect',
        'Disconnect grace period',
      ]}
      owner="Frontend + backend developers"
    />
  )
}