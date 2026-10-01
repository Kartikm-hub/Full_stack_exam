import { Slot } from '@radix-ui/react-slot'
import { cva } from 'class-variance-authority'

import { cn } from '@/lib/utils'

/**
 * Single button primitive for the whole dashboard.
 *
 * `variant` carries the semantic colour language from SPEC.md §7:
 *   default  -> deep indigo, normal navigation and actions
 *   focus    -> teal, ONLY for active focus mode actions
 *   outline  -> calm blue, low-emphasis secondary actions
 *   ghost    -> neutral, table/list rows and icon-only buttons
 *   subtle   -> tinted surface, inline actions
 *   warning  -> amber, needs attention
 *   danger   -> red, destructive (ending a session, revoking a device)
 */
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          'bg-brand-700 text-white shadow-sm hover:bg-brand-800 focus-visible:outline-brand-700',
        focus:
          'bg-focus-700 text-white shadow-sm hover:bg-focus-800 focus-visible:outline-focus-700',
        outline:
          'border border-ink-200 bg-white text-ink-700 shadow-xs hover:border-ink-300 hover:bg-ink-50 focus-visible:outline-brand-600',
        ghost: 'text-ink-600 hover:bg-ink-100 hover:text-ink-900',
        subtle: 'bg-brand-50 text-brand-800 hover:bg-brand-100',
        warning:
          'border border-warn-200 bg-warn-50 text-warn-800 hover:bg-warn-100 focus-visible:outline-warn-600',
        danger:
          'bg-danger-600 text-white shadow-sm hover:bg-danger-700 focus-visible:outline-danger-600',
        'danger-outline':
          'border border-danger-200 bg-white text-danger-700 hover:bg-danger-50 focus-visible:outline-danger-600',
        link: 'text-brand-700 underline-offset-4 hover:underline',
      },
      size: {
        sm: 'h-8 rounded-md px-3 text-xs',
        default: 'h-10 px-4',
        lg: 'h-11 rounded-xl px-6 text-base',
        xl: 'h-12 rounded-xl px-8 text-base',
        icon: 'size-10',
        'icon-sm': 'size-8 rounded-md',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)

function Button({ className, variant, size, asChild = false, ...props }) {
  const Comp = asChild ? Slot : 'button'

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  )
}

export { Button, buttonVariants }