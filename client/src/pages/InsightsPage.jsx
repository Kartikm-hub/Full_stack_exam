import { PlaceholderPage } from '@/pages/PlaceholderPage'

export default function InsightsPage() {
  return (
    <PlaceholderPage
      title="Insights"
      description="Understand your focus habits: totals, streak, and how each session ended. No browsing history, window titles or keystrokes are ever stored."
      upcoming={['Daily and weekly totals', 'Exit reasons breakdown', 'Streaks', 'Export as CSV']}
      owner="Backend developer"
      tone="info"
    />
  )
}