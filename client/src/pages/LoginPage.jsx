import { AuthFields, AuthLayout } from '@/pages/AuthLayout'

export default function LoginPage() {
  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Sign in to reach your focus sessions and paired devices."
      footer={{ pretext: 'No account yet?', to: '/signup', linkLabel: 'Create one' }}
    >
      <AuthFields buttonLabel="Sign in" mode="login" />
    </AuthLayout>
  )
}