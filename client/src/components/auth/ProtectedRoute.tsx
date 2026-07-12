import { Navigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import WifiLoader from '../ui/WifiLoader'

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()

  if (loading) return (
    <div className="min-h-screen bg-[#f7f8f6] flex items-center justify-center">
      <WifiLoader />
    </div>
  )

  if (!user) return <Navigate to="/login" replace />

  return <>{children}</>
}
