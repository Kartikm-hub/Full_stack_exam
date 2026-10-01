import { cn } from '@/lib/utils'

/**
 * Full-width label above form controls. Always pair with an input that has a
 * matching `id` so the association survives for screen readers.
 */
function Label({ className, ...props }) {
  return (
    <label
      data-slot="label"
      className={cn(
        'text-sm font-medium text-ink-700 select-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70',
        className,
      )}
      {...props}
    />
  )
}

export { Label }