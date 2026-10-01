import { MenuIcon, UserRoundIcon } from 'lucide-react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'

import { AgentStatusBadge } from '@/components/agent/AgentStatusBadge'
import { Sidebar } from '@/components/layout/Sidebar'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { NAV_ITEMS, PRODUCT } from '@/config/navigation'
import { useAuth } from '@/features/auth/useAuth'

/** Title of the current route, resolved from the navigation table. */
function useRouteTitle() {
  const { pathname } = useLocation()
  return NAV_ITEMS.find((item) => item.to === pathname)?.label ?? PRODUCT.name
}

/**
 * Sticky top bar: mobile nav trigger, page context, agent status, account menu.
 *
 * The drawer reuses the desktop `Sidebar` so mobile and desktop navigation
 * never drift apart.
 *
 * @param {object} props
 * @param {import('@/features/agent/agentStatus').AgentStatus} [props.agentStatus]
 * @param {boolean} [props.showAgentStatus] hide on public layouts
 * @param {import('react').ReactNode} [props.children] extra right-side content (per-page actions)
 */
export function Header({ agentStatus, showAgentStatus = true, children }) {
  const title = useRouteTitle()
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  async function handleLogout() {
    try {
      await logout()
      toast.success('Signed out.')
      navigate('/login', { replace: true })
    } catch (error) {
      toast.error(error.message || 'Could not sign out.')
    }
  }

  return (
    <header className="sticky top-0 z-30 border-b border-ink-200 bg-white/85 backdrop-blur-sm">
      <div className="flex h-16 items-center gap-3 px-4 sm:px-6">
        {/* Mobile / tablet navigation */}
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline" size="icon-sm" className="lg:hidden" aria-label="Open navigation">
              <MenuIcon />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-72 p-0">
            <SheetTitle className="sr-only">Navigation</SheetTitle>
            <SheetDescription className="sr-only">
              Move between Focus Mode pages. The agent status is shown at the bottom of the
              drawer.
            </SheetDescription>
            <Sidebar agentStatus={agentStatus} variant="drawer" />
          </SheetContent>
        </Sheet>

        <div className="min-w-0 flex-1">
          <h1 className="truncate text-base font-semibold tracking-tight text-brand-950 sm:text-lg">
            {title}
          </h1>
          {showAgentStatus ? (
            <p className="hidden truncate text-xs text-ink-400 sm:block">
              Local agent enforces the allow-list. This dashboard only sends intent.
            </p>
          ) : null}
        </div>

        {showAgentStatus ? (
          <AgentStatusBadge status={agentStatus} className="hidden lg:inline-flex" />
        ) : null}

        {children}

        {/* Account menu — labels only, no auth logic in this prompt. */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              className="rounded-full border border-ink-200 bg-white"
              aria-label="Account menu"
            >
              <UserRoundIcon />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>{user?.name || user?.email || 'Account'}</DropdownMenuLabel>
            <DropdownMenuItem asChild>
              <Link to="/settings">Account settings</Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link to="/devices">Paired devices</Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="danger" onSelect={handleLogout}>Sign out</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}

export default Header