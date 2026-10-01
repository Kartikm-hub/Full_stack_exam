import { Link } from 'react-router-dom'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

/**
 * 404 page, also used as React Router's catch-all route.
 *
 * Uses `<Link>` rather than `<a>` so navigation stays client-side.
 */
export default function NotFoundPage() {
  return (
    <div className="flex flex-col items-center justify-center gap-6 px-4 py-20 text-center">
      <div className="space-y-2">
        <Badge tone="warning">Error 404</Badge>
        <h1 className="text-3xl font-semibold tracking-tight text-brand-950 sm:text-4xl">
          This page does not exist
        </h1>
        <p className="mx-auto max-w-md text-sm leading-relaxed text-ink-500">
          The address may be out of date. Nothing about your system or your focus sessions was
          changed.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-3">
        <Button asChild>
          <Link to="/dashboard">Back to dashboard</Link>
        </Button>
        <Button variant="outline" asChild>
          <Link to="/">Go to the start</Link>
        </Button>
      </div>
    </div>
  )
}