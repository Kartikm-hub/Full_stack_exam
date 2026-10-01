import { PlaceholderPage } from '@/pages/PlaceholderPage'

export default function AllowListPage() {
  return (
    <PlaceholderPage
      title="Allow-list"
      description="Choose the applications that keep working during a session. Your browser, the agent itself and system-critical services are added automatically and cannot be removed."
      upcoming={[
        'Add apps by process or bundle id',
        'Protected apps are locked',
        'Effective list preview',
        'Per-device lists',
      ]}
      owner="Backend + agent developers"
      tone="focus"
    />
  )
}