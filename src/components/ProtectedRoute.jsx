import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function ProtectedRoute({ roles, children }) {
  const { user, profile, loading } = useAuth()
  if (loading) return <p className="p-6">Chargement…</p>
  if (!user) return <Navigate to="/connexion" replace />
  if (roles && profile && !roles.includes(profile.role)) return <Navigate to="/" replace />
  return children
}
