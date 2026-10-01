import { cva } from 'class-variance-authority'

import { cn } from '@/lib/utils'

/**
 * `tone` maps to the semantic palette (SPEC.md §7):
 *   neutral -> structure/labels      info    -> calm blue
 *   focus   -> active focus (teal)   warning -> amber
 *   danger  -> destructive/agent down success -> calm, allowed state
 */
const badgeVariants = cva(
  'inline-flex w-fit shrink-0 items-center justify-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap',
  {
    variants: {
      tone: {
        neutral: 'border-ink-200 bg-ink-50 text-ink-700',
        brand: 'border-brand-200 bg-brand-50 text-brand-800',
        info: 'border-calm-200 bg-calm-50 text-calm-800',
        focus: 'border-focus-200 bg-focus-50 text-focus-800',
        warning: 'border-warn-200 bg-warn-50 text-warn-800',
        danger: 'border-danger-200 bg-danger-50 text-danger-800',
        success: 'border-focus-200 bg-focus-50 text-focus-800',
      },
    },
    defaultVariants: {
      tone: 'neutral',
    },
  },
)

function Badge({ className, tone, ...props }) {
  return <span data-slot="badge" className={cn(badgeVariants({ tone }), className)} {...props} />
}

export { Badge, badgeVariants }