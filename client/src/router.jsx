import { RouterProvider, createBrowserRouter } from 'react-router-dom'

import { AppLayout, FocusLayout } from '@/components/layout/AppLayout'
import { AgentStatusProvider } from '@/features/agent/AgentStatusProvider'
import AdminPage from '@/pages/AdminPage'
import AllowListPage from '@/pages/AllowListPage'
import DashboardPage from '@/pages/DashboardPage'
import DevicesPage from '@/pages/DevicesPage'
import FocusPage from '@/pages/FocusPage'
import InsightsPage from '@/pages/InsightsPage'
import LandingPage from '@/pages/LandingPage'
import LoginPage from '@/pages/LoginPage'
import NotFoundPage from '@/pages/NotFoundPage'
import SchedulesPage from '@/pages/SchedulesPage'
import SettingsPage from '@/pages/SettingsPage'
import SignupPage from '@/pages/SignupPage'

/**
 * Route table for the whole dashboard.
 *
 * Rules that matter for the developers who come next:
 *
 *  1. `AgentStatusProvider` wraps the entire tree. It currently yields a static
 *     `UNAVAILABLE` snapshot; Prompt 010 swaps its implementation for the
 *     localhost WebSocket client and nothing else in the UI has to change.
 *  2. Layouts read status via `useAgentStatus()` and pass it down as a prop,
 *     so pages stay dumb and free of transport logic.
 *  3. No auth guard yet (Prompt 009). Adding one means protecting the two
 *     `AppLayout` / `FocusLayout` elements only — no page changes.
 *  4. `/` and the auth routes render their own chrome and sit outside
 *     `AppLayout`; `/focus` uses the sidebar-less `FocusLayout` so an active
 *     session has one calm screen with End always reachable.
 */
export const router = createBrowserRouter([
  { path: '/', element: <LandingPage /> },
  { path: '/login', element: <LoginPage /> },
  { path: '/signup', element: <SignupPage /> },
  {
    element: <AppLayout />,
    children: [
      { path: '/dashboard', element: <DashboardPage /> },
      { path: '/devices', element: <DevicesPage /> },
      { path: '/allowlist', element: <AllowListPage /> },
      { path: '/schedules', element: <SchedulesPage /> },
      { path: '/insights', element: <InsightsPage /> },
      { path: '/settings', element: <SettingsPage /> },
      { path: '/admin', element: <AdminPage /> },
    ],
  },
  {
    element: <FocusLayout />,
    children: [{ path: '/focus', element: <FocusPage /> }],
  },
  { path: '*', element: <NotFoundPage /> },
])

/**
 * Public tree used by `main.jsx`. The provider is the only piece here that is
 * expected to change in Prompt 010.
 */
export function AppProviders({ children }) {
  return <AgentStatusProvider>{children}</AgentStatusProvider>
}

/** Routes that will require a signed-in session (Prompt 009). */
export const PROTECTED_ROUTES = [
  '/dashboard',
  '/focus',
  '/devices',
  '/allowlist',
  '/schedules',
  '/insights',
  '/settings',
  '/admin',
]

export default RouterProvider