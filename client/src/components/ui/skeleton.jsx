import { cn } from '@/lib/utils'

/**
 * Placeholder block for future loading states (e.g. while a session query or
 * `getState()` round-trip is in flight). Purely presentational.
 */
function Skeleton({ className, ...props }) {
  return (
    <div
      data-slot="skeleton"
      aria-hidden="true"
      className={cn('animate-pulse rounded-md bg-ink-200/70', className)}
      {...props}
    />
  )
}

export { Skeleton }