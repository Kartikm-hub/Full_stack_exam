import { LoaderCircleIcon } from 'lucide-react'

import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

/**
 * Generic loading state for a region of the page.
 *
 * Accessibility: the container is announced as a live region so screen readers
 * hear "Loading…" instead of silence.
 *
 * @param {object} props
 * @param {string} [props.label]
 * @param {'block'|'card'|'inline'} [props.variant]
 * @param {number} [props.rows]
 */
export function LoadingState({ label = 'Loading…', variant = 'block', rows = 3, className }) {
  if (variant === 'inline') {
    return (
      <div
        role="status"
        aria-live="polite"
        className={cn('flex items-center gap-2 text-sm text-ink-500', className)}
      >
        <LoaderCircleIcon aria-hidden="true" className="size-4 animate-spin text-brand-600" />
        <span>{label}</span>
      </div>
    )
  }

  if (variant === 'card') {
    return (
      <div
        role="status"
        aria-live="polite"
        className={cn('rounded-xl border border-ink-200 bg-white p-5', className)}
      >
        <span className="sr-only">{label}</span>
        <div aria-hidden="true" className="space-y-3">
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-3 w-2/3" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      </div>
    )
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn('space-y-3', className)}
      aria-label={label}
    >
      <span className="sr-only">{label}</span>
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} aria-hidden="true" className="space-y-2">
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-3 w-full" />
        </div>
      ))}
    </div>
  )
}

export default LoadingState