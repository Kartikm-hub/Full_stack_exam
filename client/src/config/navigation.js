/**
 * Application routing + navigation contract.
 *
 * `NAV_ITEMS` is the single source of truth for the sidebar, the 404 page's
 * "go back" links and any future command palette. Adding a page here is enough
 * for it to appear in the sidebar — see `router.jsx` for the route table.
 *
 * ICONS maps to `lucide-react` icons; a `lucide-react` upgrade must not change
 * any other file.
 */
import {
  BarChart3Icon,
  CalendarClockIcon,
  GaugeIcon,
  LayoutDashboardIcon,
  ListChecksIcon,
  MonitorSmartphoneIcon,
  SettingsIcon,
  ShieldCheckIcon,
  ShieldHalfIcon,
  UsersIcon,
} from 'lucide-react'

export const NAV_ITEMS = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboardIcon, end: false },
  { to: '/focus', label: 'Focus', icon: GaugeIcon, end: false },
  { to: '/devices', label: 'Devices', icon: MonitorSmartphoneIcon, end: false },
  { to: '/allowlist', label: 'Allow-list', icon: ListChecksIcon, end: false },
  { to: '/schedules', label: 'Schedules', icon: CalendarClockIcon, end: false },
  { to: '/insights', label: 'Insights', icon: BarChart3Icon, end: false },
  { to: '/settings', label: 'Settings', icon: SettingsIcon, end: false },
  { to: '/admin', label: 'Admin', icon: UsersIcon, end: false, adminOnly: true },
]

/** Links shown on the public (signed-out) layout. */
export const AUTH_NAV_ITEMS = [{ to: '/login', label: 'Sign in' }]

/** Short product description used in the sidebar footer and on public pages. */
export const PRODUCT = {
  name: 'Focus Mode',
  tagline: 'Distraction lockdown, reversible by design',
  icon: ShieldHalfIcon,
  trustNote: 'The agent is the only component that touches your OS. Every session can be ended at any time.',
}

export { ShieldCheckIcon }