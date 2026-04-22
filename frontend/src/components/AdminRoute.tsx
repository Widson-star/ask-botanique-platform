import { Navigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

const ADMIN_EMAILS = ['widsonnambaisi@gmail.com']

export default function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()

  if (loading) return null

  if (!user || !ADMIN_EMAILS.includes(user.email ?? '')) {
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}
