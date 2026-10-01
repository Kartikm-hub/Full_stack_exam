import { NavLink } from 'react-router-dom'

import { AgentStatusBadge } from '@/components/agent/AgentStatusBadge'
import { NAV_ITEMS, PRODUCT } from '@/config/navigation'
import { cn } from '@/lib/utils'

/**
 * Primary navigation. Rendered twice from one component: permanently on
 * desktop (lg+), and inside a Sheet drawer below lg — so mobile never needs a
 * duplicated nav tree.
 *
 * @param {object} props
 * @param {import('@/features/agent/agentStatus').AgentStatus} [props.agentStatus]
 * @param {'sidebar'|'drawer'} [props.variant]
 * @param {() => void} [props.onNavigate] called after a link is picked (drawer closes)
 */
export function Sidebar({ agentStatus, variant = 'sidebar', onNavigate }) {
  const BrandIcon = PRODUCT.icon
  const isDrawer = variant === 'drawer'

  return (
    <div className={cn('flex h-full flex-col bg-white', isDrawer && 'w-full')}>
      {/* Brand */}
      <div className={cn('flex items-center gap-3 px-4', isDrawer ? 'py-5' : 'h-16 border-b border-ink-200')}>
        <span
          aria-hidden="true"
          className="grid size-9 shrink-0 place-items-center rounded-lg bg-brand-800 text-white"
        >
          <BrandIcon className="size-5" />
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold tracking-tight text-brand-950">
            {PRODUCT.name}
          </span>
          <span className="block truncate text-xs text-ink-400">{PRODUCT.tagline}</span>
        </span>
      </div>

      {/* Navigation */}
      <nav aria-label="Main" className="flex-1 overflow-y-auto px-3 py-4 scrollbar-quiet">
        <ul className="flex flex-col gap-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon

            return (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  end={item.end}
                  onClick={onNavigate}
                  className={({ isActive }) =>
                    cn(
                      'group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                      'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600',
                      isActive
                        ? 'bg-brand-50 text-brand-800'
                        : 'text-ink-600 hover:bg-ink-50 hover:text-ink-900',
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      <Icon
                        aria-hidden="true"
                        className={cn(
                          'size-4 shrink-0 transition-colors',
                          isActive ? 'text-brand-700' : 'text-ink-400 group-hover:text-ink-600',
                        )}
                      />
                      <span className="truncate">{item.label}</span>
                    </>
                  )}
                </NavLink>
              </li>
            )
          })}
        </ul>
      </nav>

      {/* Footer: agent status + trust note */}
      <div className="space-y-3 border-t border-ink-200 px-4 py-4">
        <AgentStatusBadge status={agentStatus} className="max-w-full" />
        <p className="text-xs leading-relaxed text-ink-400">{PRODUCT.trustNote}</p>
      </div>
    </div>
  )
}

export default Sidebar