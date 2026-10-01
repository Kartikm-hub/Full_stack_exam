import {
  describeAgentStatus,
  isFocusActive,
  readAgentStatus,
} from '@/features/agent/agentStatus'
import { cn } from '@/lib/utils'

const DOT_TONE = {
  IDLE: 'bg-ink-400',
  PAIRING: 'bg-calm-500 animate-pulse',
  READY: 'bg-emerald-500',
  ENTERING: 'bg-focus-500 animate-pulse',
  ACTIVE: 'bg-focus-600',
  EXITING: 'bg-warn-500 animate-pulse',
  FAILED: 'bg-danger-500',
  UNAVAILABLE: 'bg-ink-300',
}

/**
 * Human-readable last-seen timestamp.
 */
function formatLastSeen(lastSeenAt) {
  if (!lastSeenAt) return null

  const value = lastSeenAt instanceof Date ? lastSeenAt : new Date(lastSeenAt)
  if (Number.isNaN(value.getTime())) return null

  return value.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

/**
 * Compact connection badge for the header.
 *
 * @param {object} props
 * @param {import('@/features/agent/agentStatus').AgentStatus} [props.status]
 *        Defaults to `readAgentStatus()`. When the WebSocket layer lands this is
 *        the only prop that changes — pass live agent state.
 * @param {(status: import('@/features/agent/agentStatus').AgentConnectionStatus) => void} [props.onClick]
 *        Makes the badge actionable for layouts that need status details.
 */
export function AgentStatusBadge({ status = readAgentStatus(), onClick, className }) {
  const { text, hint } = describeAgentStatus(status.status)
  const active = isFocusActive(status.status)
  const unavailable = status.status === 'UNAVAILABLE'
  const lastSeen = formatLastSeen(status.lastSeenAt)

  const dot = (
    <span
      data-slot="agent-status-dot"
      className={cn('size-2 shrink-0 rounded-full', DOT_TONE[status.status])}
    />
  )

  const label = (
    <>
      {dot}
      <span className="truncate">{text}</span>
      {lastSeen ? <span className="text-ink-400">· {lastSeen}</span> : null}
    </>
  )

  const shell = cn(
    'inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
    active
      ? 'border-focus-200 bg-focus-50 text-focus-800'
      : status.status === 'READY'
        ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
        : unavailable
        ? 'border-ink-200 bg-white text-ink-500'
        : 'border-ink-200 bg-ink-50 text-ink-700',
    className,
  )

  if (!onClick) {
    return (
      <span className={shell} title={hint} data-status={status.status}>
        {label}
      </span>
    )
  }

  return (
    <button
      type="button"
      onClick={onClick}
      title={hint}
      aria-label={`${text}. ${hint}`}
      data-status={status.status}
      className={cn(shell, 'hover:border-ink-300 hover:bg-ink-100 focus-visible:outline-2 focus-visible:outline-brand-600')}
    >
      {label}
    </button>
  )
}

/**
 * Full-width explanation shown when the agent is unreachable. Honest empty
 * state per SPEC.md §7 principle 22: we say what is missing, and why it
 * matters, instead of pretending the machine is protected.
 */
export function AgentUnreachableNotice({ className }) {
  return (
    <div
      role="status"
      className={cn(
        'flex items-start gap-3 rounded-xl border border-warn-200 bg-warn-50 px-4 py-3',
        className,
      )}
    >
      <span aria-hidden="true" className="mt-1.5 size-2 shrink-0 rounded-full bg-warn-500" />
      <div className="space-y-0.5">
        <p className="text-sm font-semibold text-warn-900">Local agent not connected</p>
        <p className="text-sm text-warn-800">
          Focus sessions cannot be enforced until the Focus Mode agent is running on this
          machine. Your system is unchanged.
        </p>
      </div>
    </div>
  )
}