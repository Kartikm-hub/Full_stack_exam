import { PlaceholderPage } from '@/pages/PlaceholderPage'

export default function AdminPage() {
  return (
    <PlaceholderPage
      title="Admin"
      description="Administrative overview for team accounts: member roles, revoked devices and audit events. Access is role-gated in a later prompt."
      upcoming={['Member roles', 'Revoked devices', 'Audit trail', 'Protected baseline version']}
      owner="Backend developer"
      tone="warning"
    />
  )
}