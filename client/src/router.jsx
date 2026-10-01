import { RouterProvider, createBrowserRouter } from 'react-router-dom'

import { AppLayout, FocusLayout } from '@/components/layout/AppLayout'
import { AgentStatusProvider } from '@/features/agent/AgentStatusProvider'
import { ProtectedRoute } from '@/features/auth/ProtectedRoute'
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
 * Route ownership and access boundaries:
 *
 *  1. `AgentStatusProvider` wraps the entire tree and owns the localhost
 *     WebSocket lifecycle.
 *  2. Layouts read status via `useAgentStatus()` and pass it down as a prop,
 *     so pages stay dumb and free of transport logic.
 *  3. `ProtectedRoute` guards both authenticated layouts.
 *  4. `/` and the auth routes render their own chrome and sit outside
 *     `AppLayout`; `/focus` uses the sidebar-less `FocusLayout` so an active
 *     session has one calm screen with End always reachable.
 */
export const router = createBrowserRouter([
  { path: '/', element: <LandingPage /> },
  { path: '/login', element: <LoginPage /> },
  { path: '/signup', element: <SignupPage /> },
  {
    element: <ProtectedRoute />,
    children: [{
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
    }],
  },
  {
    element: <ProtectedRoute />,
    children: [{ element: <FocusLayout />, children: [{ path: '/focus', element: <FocusPage /> }] }],
  },
  { path: '*', element: <NotFoundPage /> },
])

/**
 * Public tree used by `main.jsx`.
 */
export function AppProviders({ children }) {
  return <AgentStatusProvider>{children}</AgentStatusProvider>
}

/** Routes that require a signed-in session. */
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