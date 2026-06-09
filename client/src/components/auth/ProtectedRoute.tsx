import { Navigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()

  if (loading) return (
    <div className="min-h-screen bg-[#f7f8f6] flex items-center justify-center">
      <span className="material-symbols-outlined animate-spin text-4xl text-slate-300">progress_activity</span>
    </div>
  )

  if (!user) return <Navigate to="/login" replace />

  return <>{children}</>
}
