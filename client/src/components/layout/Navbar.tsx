import { useState, useRef, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import UserProfileModal from '../profile/UserProfileModal'
import SettingModal from '../profile/SettingModal'
import HelpModal from '../profile/HelpModal'

const NAV_ITEMS = [
  { path: '/', label: 'Schedule', icon: 'grid_view' },
  { path: '/schedule', label: 'My Bookings', icon: 'calendar_month' },
  { path: '/rooms', label: 'Rooms', icon: 'meeting_room' },
]

interface NavbarProps {
  onSearch?: (q: string) => void
  onTodayClick?: () => void
}

export default function Navbar({ onSearch, onTodayClick }: NavbarProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, logout } = useAuth()
  const [q, setQ] = useState('')
  const [profileOpen, setProfileOpen] = useState(false)
  const [profileModalOpen, setProfileModalOpen] = useState(false)
  const [settingOpen, setSettingOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setProfileOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  function dispatch(val: string) {
    onSearch?.(val)
    document.dispatchEvent(new CustomEvent('timeline-search', { detail: val }))
  }

  function clear() { setQ(''); dispatch('') }

  const isActive = (path: string) => location.pathname === path

  const allItems = user?.role === 'admin'
    ? [...NAV_ITEMS, { path: '/admin', label: 'Admin', icon: 'admin_panel_settings' }]
    : NAV_ITEMS

  async function handleLogout() {
    setProfileOpen(false)
    await logout()
    navigate('/login')
  }

  const avatarSrc = user?.avatar?.startsWith('http') || user?.avatar?.startsWith('/storage')
    ? user.avatar
    : `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.avatar || user?.name}`

  return (
    <>
      <nav className="flex items-center justify-between px-8 bg-white border-b border-slate-100 sticky top-0 z-50 shrink-0" style={{ height: 60 }}>

        {/* Logo */}
        <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate('/')}>
          <div className="size-9 bg-black rounded-xl flex items-center justify-center text-[#adee2b]">
            <span className="material-symbols-outlined text-lg">sync_alt</span>
          </div>
          <span className="text-xl font-black tracking-tighter italic uppercase">
            RoomSync <span className="text-blue-600">Pro</span>
          </span>
        </div>

        {/* Page nav — segmented pill */}
        {(() => {
          const activeIndex = allItems.findIndex(item => isActive(item.path))
          const ITEM_W = 120
          return (
            <div className="relative flex items-center bg-slate-100 p-1 rounded-xl"
              style={{ width: allItems.length * ITEM_W + 8 }}>
              <div
                className="absolute top-1 bottom-1 bg-white rounded-lg shadow-sm pointer-events-none transition-transform duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]"
                style={{ width: ITEM_W, transform: `translateX(${Math.max(0, activeIndex) * ITEM_W}px)` }}
              />
              {allItems.map(item => (
                <button
                  key={item.path}
                  onClick={() => navigate(item.path)}
                  style={{ width: ITEM_W }}
                  className={`relative flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wide transition-colors duration-200 z-10
                    ${isActive(item.path) ? 'text-slate-900' : 'text-slate-400 hover:text-slate-600'}`}
                >
                  <span className="material-symbols-outlined text-sm">{item.icon}</span>
                  {item.label}
                </button>
              ))}
            </div>
          )
        })()}

        {/* Right actions */}
        <div className="flex items-center gap-3">
          <form onSubmit={e => { e.preventDefault(); dispatch(q) }} className="relative flex items-center">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 text-base pointer-events-none">search</span>
            <input
              type="text"
              placeholder="Search bookings..."
              value={q}
              onChange={e => { setQ(e.target.value); dispatch(e.target.value) }}
              className={`w-48 bg-slate-50 border rounded-xl pl-9 ${q ? 'pr-16' : 'pr-3'} py-2 text-[11px] font-bold focus:outline-none focus:ring-2 focus:ring-[#adee2b] focus:border-transparent transition-all
                ${q ? 'border-[#adee2b] bg-[#f7fee7]' : 'border-slate-200'}`}
            />
            {q && (
              <div className="absolute right-1 flex items-center gap-0.5">
                <button type="button" onClick={clear}
                  className="size-6 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-white transition-colors">
                  <span className="material-symbols-outlined text-sm">close</span>
                </button>
                <button type="submit"
                  className="size-6 rounded-lg flex items-center justify-center bg-[#adee2b] text-black hover:bg-black hover:text-[#adee2b] transition-colors">
                  <span className="material-symbols-outlined text-sm">arrow_forward</span>
                </button>
              </div>
            )}
          </form>

          <button
            onClick={onTodayClick}
            className="flex items-center gap-2 px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl hover:border-[#adee2b] hover:bg-[#f7fee7] transition-all text-[10px] font-black uppercase"
          >
            <span className="material-symbols-outlined text-base">today</span>
            Today
          </button>

          {/* Avatar + dropdown */}
          <div ref={dropdownRef} className="relative">
            <button
              onClick={() => setProfileOpen(o => !o)}
              className="flex items-center gap-2"
            >
              {user?.avatar?.startsWith('http') || user?.avatar?.startsWith('/storage')
                ? <img src={avatarSrc} className="size-9 rounded-full border-2 border-[#adee2b] object-cover cursor-pointer" title={user?.name} />
                : <img src={avatarSrc} className="size-9 rounded-full border-2 border-[#adee2b] p-0.5 bg-slate-100 cursor-pointer" title={user?.name} />
              }
            </button>

            <div
              className="absolute right-0 top-full mt-2 w-56 rounded-2xl z-50 overflow-hidden pointer-events-none"
              style={{
                opacity: profileOpen ? 1 : 0,
                transform: profileOpen ? 'translateY(0) scale(1)' : 'translateY(-8px) scale(0.97)',
                transition: 'opacity 180ms ease, transform 180ms cubic-bezier(0.4,0,0.2,1)',
                pointerEvents: profileOpen ? 'auto' : 'none',
                background: 'rgba(255,255,255,0.72)',
                backdropFilter: 'blur(24px)',
                WebkitBackdropFilter: 'blur(24px)',
                border: '1px solid rgba(255,255,255,0.6)',
                boxShadow: '0 8px 32px rgba(0,0,0,0.12), 0 1px 0 rgba(255,255,255,0.8) inset',
              }}
            >
              <div className="px-4 py-3" style={{ borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
                <p className="text-[12px] font-black text-slate-800">{user?.name}</p>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wide">{user?.department} · {user?.role}</p>
              </div>

              <div className="py-1.5">
                {[
                  { icon: 'account_circle', label: 'User Profile', action: () => { setProfileModalOpen(true); setProfileOpen(false) } },
                  { icon: 'settings', label: 'Setting', action: () => { setSettingOpen(true); setProfileOpen(false) } },
                  { icon: 'help', label: 'Help', action: () => { setHelpOpen(true); setProfileOpen(false) } },
                ].map(({ icon, label, action }) => (
                  <button key={label} onClick={action}
                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-slate-600 hover:bg-white/60 transition-colors text-[11px] font-black uppercase"
                  >
                    <span className="material-symbols-outlined text-base text-slate-400">{icon}</span>
                    {label}
                  </button>
                ))}
              </div>

              <div className="py-1.5" style={{ borderTop: '1px solid rgba(0,0,0,0.06)' }}>
                <button onClick={handleLogout}
                  className="w-full flex items-center gap-2.5 px-4 py-2.5 hover:bg-red-50/80 hover:text-red-600 text-slate-500 transition-colors text-[11px] font-black uppercase"
                >
                  <span className="material-symbols-outlined text-base">logout</span>
                  Logout
                </button>
              </div>
            </div>
          </div>
        </div>
      </nav>

      <UserProfileModal open={profileModalOpen} onClose={() => setProfileModalOpen(false)} />
      <SettingModal open={settingOpen} onClose={() => setSettingOpen(false)} />
      <HelpModal open={helpOpen} onClose={() => setHelpOpen(false)} />
    </>
  )
}
