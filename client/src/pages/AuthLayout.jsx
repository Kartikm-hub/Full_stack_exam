import { useState } from 'react'
import toast from 'react-hot-toast'
import { z } from 'zod'
import { Link, useLocation, useNavigate } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/features/auth/useAuth'

/**
 * Split-screen auth shell used by `/login` and `/signup`.
 *
 * Shared public shell for validated login and registration forms.
 */
export function AuthLayout({ title, subtitle, children, footer, aside }) {
  return (
    <div className="grid min-h-full lg:grid-cols-2">
      {/* Form column */}
      <div className="flex items-center justify-center px-4 py-12 sm:px-8">
        <div className="w-full max-w-sm">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm font-semibold tracking-tight text-brand-950"
          >
            <span
              aria-hidden="true"
              className="grid size-7 place-items-center rounded-lg bg-brand-800 text-white"
            >
              <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 3 5 6v6c0 4 3 7.5 7 9 4-1.5 7-5 7-9V6l-7-3Z" />
              </svg>
            </span>
            Focus Mode
          </Link>

          <h1 className="mt-8 text-2xl font-semibold tracking-tight text-brand-950">{title}</h1>
          <p className="mt-1.5 text-sm text-ink-500">{subtitle}</p>

          {children}

          {footer ? (
            <p className="mt-6 text-sm text-ink-500">
              {footer.pretext}{' '}
              <Link to={footer.to} className="font-medium text-brand-700 underline underline-offset-4">
                {footer.linkLabel}
              </Link>
            </p>
          ) : null}
        </div>
      </div>

      {/* Reassurance column */}
      <aside className="hidden flex-col justify-center gap-6 border-l border-ink-200 bg-brand-950 px-12 lg:flex">
        <div className="max-w-md space-y-4">
          <h2 className="text-xl font-semibold tracking-tight text-white">
            Calm, explicit, reversible.
          </h2>
          <ul className="space-y-3 text-sm leading-relaxed text-brand-100">
            <li className="flex gap-3">
              <span aria-hidden="true" className="mt-1.5 size-1.5 shrink-0 rounded-full bg-focus-400" />
              Your browser sends intent only. The local agent is the single component allowed to
              change your operating system.
            </li>
            <li className="flex gap-3">
              <span aria-hidden="true" className="mt-1.5 size-1.5 shrink-0 rounded-full bg-focus-400" />
              Protected apps — your browser, the agent, and system-critical services — are never
              blocked.
            </li>
            <li className="flex gap-3">
              <span aria-hidden="true" className="mt-1.5 size-1.5 shrink-0 rounded-full bg-focus-400" />
              If the connection drops or the session ends, the agent restores your machine on its
              own.
            </li>
          </ul>
        </div>
        {aside}
      </aside>
    </div>
  )
}

/** Validated email/password fields shared by login and registration. */
const loginSchema = z.object({
  email: z.string().email('Enter a valid email address.'),
  password: z.string().min(1, 'Enter your password.'),
})

const signupSchema = z.object({
  name: z.string().trim().min(2, 'Use at least 2 characters for your name.'),
  email: z.string().email('Enter a valid email address.'),
  password: z.string().min(8, 'Use at least 8 characters.'),
  confirmPassword: z.string(),
}).refine((values) => values.password === values.confirmPassword, {
  message: 'Passwords do not match.',
  path: ['confirmPassword'],
})

export function AuthFields({ confirm = false, buttonLabel }) {
  const { login, register } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState({})

  async function handleSubmit(event) {
    event.preventDefault()
    const values = Object.fromEntries(new FormData(event.currentTarget))
    const parsed = (confirm ? signupSchema : loginSchema).safeParse(values)
    if (!parsed.success) {
      setErrors(Object.fromEntries(parsed.error.issues.map((issue) => [issue.path[0], issue.message])))
      return
    }

    setErrors({})
    setLoading(true)
    try {
      const credentials = confirm
        ? { name: parsed.data.name, email: parsed.data.email, password: parsed.data.password }
        : parsed.data
      await (confirm ? register(credentials) : login(credentials))
      toast.success(confirm ? 'Account created.' : 'Welcome back.')
      navigate(location.state?.from || '/dashboard', { replace: true })
    } catch (error) {
      toast.error(error.message || 'Authentication failed.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form className="mt-8" onSubmit={handleSubmit} noValidate>
    <Card>
      <CardHeader className="border-b-0 pb-3">
        <CardTitle>Account details</CardTitle>
        <CardDescription>Credentials are sent securely to your Focus Mode server.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {confirm ? (
          <div className="space-y-1.5">
            <Label htmlFor="name">Name</Label>
            <input id="name" name="name" autoComplete="name" required aria-invalid={Boolean(errors.name)} aria-describedby={errors.name ? 'name-error' : undefined} className="h-10 w-full rounded-lg border border-ink-200 bg-white px-3 text-sm" />
            {errors.name ? <p id="name-error" className="text-xs text-danger-700">{errors.name}</p> : null}
          </div>
        ) : null}
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            required
            aria-invalid={Boolean(errors.email)}
            aria-describedby={errors.email ? 'email-error' : undefined}
            className="h-10 w-full rounded-lg border border-ink-200 bg-white px-3 text-sm"
          />
          {errors.email ? <p id="email-error" className="text-xs text-danger-700">{errors.email}</p> : null}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password">Password</Label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete={confirm ? 'new-password' : 'current-password'}
            placeholder="••••••••"
            required
            aria-invalid={Boolean(errors.password)}
            aria-describedby={errors.password ? 'password-error' : undefined}
            className="h-10 w-full rounded-lg border border-ink-200 bg-white px-3 text-sm"
          />
          {errors.password ? <p id="password-error" className="text-xs text-danger-700">{errors.password}</p> : null}
        </div>
        {confirm ? (
          <div className="space-y-1.5">
            <Label htmlFor="confirm-password">Confirm password</Label>
            <input
              id="confirm-password"
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              placeholder="••••••••"
              required
              aria-invalid={Boolean(errors.confirmPassword)}
              aria-describedby={errors.confirmPassword ? 'confirm-password-error' : undefined}
              className="h-10 w-full rounded-lg border border-ink-200 bg-white px-3 text-sm"
            />
            {errors.confirmPassword ? <p id="confirm-password-error" className="text-xs text-danger-700">{errors.confirmPassword}</p> : null}
          </div>
        ) : null}
      </CardContent>
      <CardFooter className="flex-col items-stretch gap-2">
        <Button type="submit" size="lg" disabled={loading}>
          {loading ? 'Please wait…' : buttonLabel}
        </Button>
      </CardFooter>
    </Card>
    </form>
  )
}