import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { login } from '../api/auth'
import { useAuth } from '../context/AuthContext'

export default function LoginPage() {
  const navigate = useNavigate()
  const { setUser } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email || !password) {
      setError('Please fill in all fields.')
      return
    }
    setError('')
    setLoading(true)
    try {
      const data = await login(email, password)
      setUser(data.user)
      navigate('/')
    } catch {
      setError('Invalid email or password.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#f7f8f6] flex items-center justify-center p-4">
      <div className="w-full max-w-md">

        {/* Logo */}
        <div className="flex items-center gap-3 mb-10 justify-center">
          <div className="size-11 bg-black rounded-2xl flex items-center justify-center text-[#adee2b]">
            <span className="material-symbols-outlined text-xl">sync_alt</span>
          </div>
          <span className="text-2xl font-black tracking-tighter italic uppercase">
            RoomSync <span className="text-blue-600">Pro</span>
          </span>
        </div>

        {/* Card */}
        <div className="bg-white rounded-[2rem] border border-slate-100 shadow-xl shadow-slate-200/60 p-8">

          <div className="mb-7">
            <p className="text-[9px] font-black uppercase tracking-[0.25em] text-slate-400">Welcome back</p>
            <h1 className="text-3xl font-black italic tracking-tighter uppercase mt-1">Sign In</h1>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">

            {/* Email */}
            <div className="space-y-1.5">
              <label className="text-[9px] font-black uppercase text-slate-400 tracking-wider px-1">
                Email
              </label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-300 text-base">
                  mail
                </span>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-3 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-[#adee2b] focus:border-transparent transition-all"
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <label className="text-[9px] font-black uppercase text-slate-400 tracking-wider px-1">
                Password
              </label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-300 text-base">
                  lock
                </span>
                <input
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-12 py-3 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-[#adee2b] focus:border-transparent transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500 transition-colors"
                >
                  <span className="material-symbols-outlined text-base">
                    {showPass ? 'visibility_off' : 'visibility'}
                  </span>
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="flex items-center gap-2 bg-red-50 border border-red-100 text-red-600 text-[11px] font-bold px-4 py-3 rounded-xl">
                <span className="material-symbols-outlined text-base">error</span>
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 mt-2 rounded-full text-[10px] font-black uppercase tracking-[0.2em] transition-all duration-200 shadow-lg
                bg-[#adee2b] text-black hover:bg-black hover:text-[#adee2b] shadow-lime-300/30
                disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed disabled:shadow-none"
            >
              {loading ? 'Signing in...' : 'Sign In →'}
            </button>

          </form>
        </div>

        {/* Footer */}
        <p className="text-center text-[9px] font-black text-slate-300 uppercase tracking-widest italic mt-6">
          RoomSync Pro · {new Date().getFullYear()}
        </p>

      </div>
    </div>
  )
}
