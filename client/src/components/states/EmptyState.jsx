import { InboxIcon } from 'lucide-react'

import { cn } from '@/lib/utils'

/**
 * Zero-data state for lists and panels (no sessions yet, no devices paired).
 * `action` lets a caller offer the next step without hard-coding it here.
 */
export function EmptyState({
  title = 'Nothing here yet',
  description,
  icon: Icon = InboxIcon,
  action,
  className,
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-ink-300 bg-white/60 px-6 py-10 text-center',
        className,
      )}
    >
      <span
        aria-hidden="true"
        className="grid size-11 place-items-center rounded-full bg-brand-50 text-brand-700"
      >
        <Icon className="size-5" />
      </span>
      <div className="space-y-1">
        <p className="text-sm font-semibold text-ink-800">{title}</p>
        {description ? <p className="mx-auto max-w-sm text-sm text-ink-500">{description}</p> : null}
      </div>
      {action ? <div className="mt-1">{action}</div> : null}
    </div>
  )
}

export default EmptyState