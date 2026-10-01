import { cn } from '@/lib/utils'

/**
 * Neutral surface container. `inset` is used for nested panels (lists inside a
 * card), the default is a white raised card on the light background.
 */
function Card({ className, inset = false, ...props }) {
  return (
    <div
      data-slot="card"
      className={cn(
        'flex flex-col rounded-xl text-ink-800 shadow-xs',
        inset ? 'border border-ink-200/70 bg-ink-50/80' : 'border border-ink-200 bg-white',
        className,
      )}
      {...props}
    />
  )
}

function CardHeader({ className, ...props }) {
  return (
    <div
      data-slot="card-header"
      className={cn(
        'flex flex-col gap-1 border-b border-ink-200/80 px-5 py-4',
        className,
      )}
      {...props}
    />
  )
}

function CardTitle({ className, ...props }) {
  return (
    <h3
      data-slot="card-title"
      className={cn('text-base leading-tight font-semibold tracking-tight', className)}
      {...props}
    />
  )
}

function CardDescription({ className, ...props }) {
  return (
    <p
      data-slot="card-description"
      className={cn('text-sm text-ink-500', className)}
      {...props}
    />
  )
}

function CardContent({ className, ...props }) {
  return <div data-slot="card-content" className={cn('px-5 py-4', className)} {...props} />
}

function CardFooter({ className, ...props }) {
  return (
    <div
      data-slot="card-footer"
      className={cn(
        'flex items-center gap-3 border-t border-ink-200/80 px-5 py-4',
        className,
      )}
      {...props}
    />
  )
}

export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter }