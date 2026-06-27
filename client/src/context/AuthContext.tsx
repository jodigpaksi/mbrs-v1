import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { getMe, logout as apiLogout } from '../api/auth'
import { queryClient } from '../main'

export interface UserPreferences {
  defaultView?: string
  defaultType?: string
  language?: string
  darkMode?: boolean
  startDay?: string
  showBarTitle?: boolean
  defaultBuilding?: number | null
}

interface User {
  id: number
  name: string
  email: string
  department: string
  role: string
  ext: string
  avatar: string
  on_duty?: boolean
  buildings?: { id: number; name: string }[]
  preferences?: UserPreferences
  default_building_id?: number | null
}

interface AuthContextType {
  user: User | null
  loading: boolean
  setUser: (user: User | null) => void
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) { setLoading(false); return }
    const timeoutRace = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('timeout')), 7000)
    )
    Promise.race([getMe(), timeoutRace])
      .then((u: User) => setUser(u))
      .catch(() => localStorage.removeItem('token'))
      .finally(() => setLoading(false))
  }, [])

  async function logout() {
    try { await apiLogout() } catch {}
    queryClient.clear()
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, loading, setUser, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
