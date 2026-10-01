import { PlaceholderPage } from '@/pages/PlaceholderPage'

export default function SchedulesPage() {
  return (
    <PlaceholderPage
      title="Schedules"
      description="Plan recurring focus blocks. Every scheduled session is bounded and ends on its own, even if the dashboard is closed."
      upcoming={['Weekly recurrence', 'Per-schedule duration', 'Skip or pause', 'Timezone handling']}
      owner="Backend developer"
    />
  )
}