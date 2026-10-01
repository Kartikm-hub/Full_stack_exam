import { Link } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'

/**
 * Split-screen auth shell used by `/login` and `/signup`.
 *
 * Deliberately contains no auth logic: no submit handler, no validation, no
 * API call (Prompt 009 adds those). Inputs are disabled so the placeholder
 * cannot look like a working form.
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

/** Static email/password fields for the auth placeholders. */
export function AuthFields({ confirm = false, buttonLabel, disabledHint }) {
  return (
    <Card className="mt-8">
      <CardHeader className="border-b-0 pb-3">
        <CardTitle>Account details</CardTitle>
        <CardDescription>{disabledHint}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            disabled
            className="h-10 w-full rounded-lg border border-ink-200 bg-ink-50 px-3 text-sm text-ink-400 disabled:cursor-not-allowed"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password">Password</Label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            placeholder="••••••••"
            disabled
            className="h-10 w-full rounded-lg border border-ink-200 bg-ink-50 px-3 text-sm text-ink-400 disabled:cursor-not-allowed"
          />
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
              disabled
              className="h-10 w-full rounded-lg border border-ink-200 bg-ink-50 px-3 text-sm text-ink-400 disabled:cursor-not-allowed"
            />
          </div>
        ) : null}
      </CardContent>
      <CardFooter className="flex-col items-stretch gap-2">
        <Button type="button" size="lg" disabled>
          {buttonLabel}
        </Button>
        <p className="text-center text-xs text-ink-400">
          Authentication is not implemented in this prompt.
        </p>
      </CardFooter>
    </Card>
  )
}