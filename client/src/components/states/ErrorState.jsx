import { AlertTriangleIcon, RefreshCwIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

/**
 * Failure state for a region of the page.
 *
 * Tone follows SPEC.md §7: amber for recoverable problems, red when the
 * failure means the user's machine is not in the state the UI claims.
 *
 * @param {object} props
 * @param {string} [props.title]
 * @param {string} [props.message]
 * @param {() => void} [props.onRetry] renders a retry button when provided
 * @param {'warning'|'danger'} [props.tone]
 */
export function ErrorState({
  title = 'Something went wrong',
  message,
  onRetry,
  tone = 'warning',
  className,
}) {
  const danger = tone === 'danger'

  return (
    <div
      role="alert"
      className={cn(
        'flex flex-col gap-3 rounded-xl border px-5 py-4 sm:flex-row sm:items-start sm:justify-between',
        danger ? 'border-danger-200 bg-danger-50' : 'border-warn-200 bg-warn-50',
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <AlertTriangleIcon
          aria-hidden="true"
          className={cn('mt-0.5 size-4 shrink-0', danger ? 'text-danger-600' : 'text-warn-600')}
        />
        <div className="space-y-1">
          <p
            className={cn(
              'text-sm font-semibold',
              danger ? 'text-danger-900' : 'text-warn-900',
            )}
          >
            {title}
          </p>
          {message ? (
            <p className={cn('text-sm', danger ? 'text-danger-800' : 'text-warn-800')}>{message}</p>
          ) : null}
        </div>
      </div>

      {onRetry ? (
        <Button
          variant="outline"
          size="sm"
          onClick={onRetry}
          className={cn('shrink-0', danger ? 'border-danger-200 text-danger-700' : 'border-warn-300 text-warn-800')}
        >
          <RefreshCwIcon />
          Try again
        </Button>
      ) : null}
    </div>
  )
}

export default ErrorState