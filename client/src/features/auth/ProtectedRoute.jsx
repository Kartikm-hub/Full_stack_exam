import { Navigate, Outlet, useLocation } from 'react-router-dom'

import { LoadingState } from '@/components/states/LoadingState'
import { useAuth } from '@/features/auth/useAuth'

export function ProtectedRoute() {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) return <LoadingState label="Checking your session" />
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  return <Outlet />
}