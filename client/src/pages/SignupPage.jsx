import { AuthFields, AuthLayout } from '@/pages/AuthLayout'

export default function SignupPage() {
  return (
    <AuthLayout
      title="Create your account"
      subtitle="Set up the dashboard first, then pair the agent on each machine."
      footer={{ pretext: 'Already registered?', to: '/login', linkLabel: 'Sign in' }}
    >
      <AuthFields
        confirm
        buttonLabel="Create account"
        disabledHint="Registration is wired up in a later prompt."
      />
    </AuthLayout>
  )
}