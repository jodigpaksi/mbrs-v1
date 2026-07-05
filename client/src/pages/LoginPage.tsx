import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { login, loginAsGuest } from '../api/auth'
import { useAuth } from '../context/AuthContext'
import { prefetchAfterLogin } from '../api/prefetch'
import { getBranding, getCachedBranding } from '../api/settings'

export default function LoginPage() {
  const navigate = useNavigate()
  const { setUser } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [guestLoading, setGuestLoading] = useState(false)
  const [error, setError] = useState('')
  const { data: branding } = useQuery({ queryKey: ['app-branding'], queryFn: getBranding, staleTime: 5 * 60 * 1000, initialData: getCachedBranding })
  const appName = branding?.app_name ?? 'RoomSync Pro'
  const appFullName = branding?.app_full_name ?? ''
  useEffect(() => { document.title = appName }, [appName])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email || !password) {
      setError('Please fill in all fields.')
      return
    }
    setError('')
    setLoading(true)
    try {
      const data = await login(email.trim(), password)
      setUser(data.user)
      await prefetchAfterLogin()
      const isAdmin = data.user.role === 'admin' || data.user.role === 'superadmin'
      navigate(isAdmin ? '/admin' : '/')
    } catch {
      setError('Invalid username or password.')
    } finally {
      setLoading(false)
    }
  }

  async function handleGuestLogin() {
    setError('')
    setGuestLoading(true)
    try {
      const data = await loginAsGuest()
      setUser(data.user)
      await prefetchAfterLogin()
      navigate('/')
    } catch {
      setError('Could not continue as guest. Please try again.')
    } finally {
      setGuestLoading(false)
    }
  }

  const logoMark = (
    <div className={`h-10 min-w-10 max-w-[180px] rounded-2xl flex items-center justify-center overflow-hidden px-1.5 ${branding?.app_logo_url ? 'bg-white' : 'bg-black'}`}>
      {branding?.app_logo_url
        ? <img src={branding.app_logo_url} alt="logo" className="h-full w-auto max-w-[168px] object-contain" />
        : <span className="material-symbols-outlined text-lg text-[#adee2b]">sync_alt</span>
      }
    </div>
  )

  return (
    <div className="min-h-screen bg-[#f7f8f6] flex items-center justify-center p-4">
      <div className="w-full max-w-4xl">

        {/* Card */}
        <div className="bg-white rounded-[2rem] border border-slate-100 shadow-xl shadow-slate-200/60 overflow-hidden flex flex-col md:flex-row md:min-h-[640px]">

          {/* Left showcase panel */}
          <div
            className="hidden md:flex md:w-[44%] relative flex-col justify-end p-8 shrink-0"
            style={{
              backgroundImage: branding?.login_photo_url
                ? `linear-gradient(180deg, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0.8) 100%), url(${branding.login_photo_url})`
                : 'radial-gradient(130% 130% at 15% 10%, #1a1f08 0%, #0c0c0c 55%, #000 100%)',
              backgroundSize: 'cover',
              backgroundPosition: branding?.login_photo_url
                ? `${branding.login_photo_pos_x ?? 50}% ${branding.login_photo_pos_y ?? 50}%`
                : 'center',
            }}
          >
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.25em] text-[#adee2b] mb-2">{branding?.login_headline ?? 'Booking made easy'}</p>
              <h2 className="text-2xl font-black italic uppercase tracking-tight text-white leading-snug">
                {branding?.login_subheadline ?? 'Book meeting rooms without the back-and-forth'}
              </h2>
            </div>
          </div>

          {/* Right form panel */}
          <div className="flex-1 p-8 sm:p-10 flex flex-col">

            {/* Logo (mobile / right panel header) */}
            <div className="w-full max-w-sm mx-auto flex items-center gap-3">
              {logoMark}
              <div className="h-8 w-px bg-slate-200 shrink-0" />
              <div className="min-w-0">
                <span className="block text-xl font-black tracking-tighter uppercase text-slate-900 leading-tight truncate">
                  {appName}
                </span>
                {appFullName && (
                  <span className="block text-[11px] font-semibold text-slate-400 leading-tight truncate">
                    {appFullName}
                  </span>
                )}
              </div>
            </div>

            <div className="flex-1 flex items-center">
            <div className="w-full max-w-sm mx-auto">

              <div className="mb-7">
                <p className="text-[9px] font-black uppercase tracking-[0.25em] text-slate-400">Welcome back</p>
                <h1 className="text-3xl font-black italic tracking-tighter uppercase mt-1 text-slate-900">Sign In</h1>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">

                {/* Email */}
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black uppercase text-slate-400 tracking-wider px-1">
                    Username
                  </label>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-300 text-base">
                      person
                    </span>
                    <input
                      type="text"
                      autoCapitalize="none"
                      autoCorrect="off"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="username"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-3 text-sm font-bold text-slate-800 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-[#adee2b] focus:border-transparent transition-all"
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
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-12 py-3 text-sm font-bold text-slate-800 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-[#adee2b] focus:border-transparent transition-all"
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

              {/* Guest access */}
              <div className="flex items-center gap-3 my-5">
                <div className="flex-1 h-px bg-slate-100" />
                <span className="text-[9px] font-black uppercase tracking-widest text-slate-300">or</span>
                <div className="flex-1 h-px bg-slate-100" />
              </div>
              <button
                type="button"
                onClick={handleGuestLogin}
                disabled={guestLoading}
                className="w-full py-3.5 rounded-full text-[10px] font-black uppercase tracking-[0.2em] transition-all duration-200
                  bg-white text-slate-500 border border-slate-200 hover:border-slate-400 hover:text-slate-700
                  disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {guestLoading ? 'Signing in...' : 'Continue as Guest'}
              </button>
              <p className="text-center text-[10px] text-slate-300 font-semibold mt-2">View-only access — no booking or editing.</p>
            </div>
            </div>
          </div>

        </div>

        {/* Footer */}
        <p className="text-center text-[9px] font-black text-slate-300 uppercase tracking-widest italic mt-6">
          {appName} · {new Date().getFullYear()}
        </p>

      </div>
    </div>
  )
}
