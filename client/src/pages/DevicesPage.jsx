import { PlaceholderPage } from '@/pages/PlaceholderPage'

export default function DevicesPage() {
  return (
    <PlaceholderPage
      title="Devices"
      description="Pair the Focus Mode agent on each machine and revoke access at any time. Pairing uses a short-lived 6-digit code and the credential is stored in the OS keychain."
      upcoming={['Pair a device', 'Revoke a device', 'Agent version and platform', 'Last seen']}
      owner="Agent developer (Prompt 011 pairing UI)"
    />
  )
}