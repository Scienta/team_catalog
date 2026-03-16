import { Navigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isAdmin, loading } = useAuth()

  if (loading) return null

  if (!user || !isAdmin) return <Navigate to="/login" replace />

  return <>{children}</>
}
