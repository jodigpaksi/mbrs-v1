import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getMyBookings } from '../../api/bookings'
import type { Booking } from '../../types'
import { useAuth } from '../../context/AuthContext'
import { useSettings } from '../../context/SettingsContext'
import { useNotification } from '../../context/NotificationContext'
import { useNotificationUnreadCount } from './NotificationPanel'
import UserProfileModal from '../profile/UserProfileModal'
import UserAvatar from '../ui/UserAvatar'
import SettingModal from '../profile/SettingModal'
import HelpModal from '../profile/HelpModal'

const NAV_PATHS = [
  { path: '/',         key: 'nav_schedule',    icon: 'grid_view' },
  { path: '/schedule', key: 'nav_my_bookings', icon: 'calendar_month' },
  { path: '/rooms',    key: 'nav_rooms',        icon: 'meeting_room' },
] as const

interface NavbarProps {
  onSearch?: (q: string) => void
  onTodayClick?: () => void
}

export default function Navbar({ onSearch, onTodayClick }: NavbarProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, logout } = useAuth()
  const { t } = useSettings()
  const queryClient = useQueryClient()
  const { openNotifications } = useNotification()
  const unreadCount = useNotificationUnreadCount()
  const { data: myBookings = [] } = useQuery<Booking[]>({
    queryKey: ['my-bookings'],
    queryFn: getMyBookings,
    staleTime: 10_000,
  })
  const todayCount = useMemo(() => {
    const todayStr = new Date().toLocaleDateString('en-CA')
    return myBookings.filter(b =>
      b.status !== 'cancelled' && b.start_at.slice(0, 10) === todayStr
    ).length
  }, [myBookings])
  const [q, setQ] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [profileModalOpen, setProfileModalOpen] = useState(false)
  const [settingOpen, setSettingOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)


  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setProfileOpen(false)
      }
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const openSearch = useCallback(() => {
    setSearchOpen(true)
    setTimeout(() => searchInputRef.current?.focus(), 50)
  }, [])

  function dispatch(val: string) {
    onSearch?.(val)
    document.dispatchEvent(new CustomEvent('timeline-search', { detail: val }))
  }

  function clear() { setQ(''); dispatch('') }

  const isActive = (path: string) => location.pathname === path

  const NAV_ITEMS = NAV_PATHS.map(n => ({ ...n, label: t(n.key as Parameters<typeof t>[0]) }))
  const allItems = user?.role === 'admin'
    ? [...NAV_ITEMS, { path: '/admin', label: t('nav_admin'), icon: 'admin_panel_settings' }]
    : NAV_ITEMS

  async function handleLogout() {
    setProfileOpen(false)
    await logout()
    navigate('/login')
  }

  return (
    <>
      <nav className="flex items-center justify-between px-8 sticky top-0 z-50 shrink-0" style={{ height: 60, background: 'var(--ds-bg-surface)', borderBottom: '1px solid var(--ds-border-sub)' }}>

        {/* Logo */}
        <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate('/')}>
          <div className="size-9 bg-black rounded-xl flex items-center justify-center text-[#adee2b]">
            <span className="material-symbols-outlined text-lg">sync_alt</span>
          </div>
          <span className="text-xl font-black tracking-tighter italic uppercase" style={{ color: 'var(--ds-text-1)' }}>
            RoomSync <span className="text-blue-500">Pro</span>
          </span>
        </div>

        {/* Page nav — segmented pill */}
        {(() => {
          const activeIndex = allItems.findIndex(item => isActive(item.path))
          const ITEM_W = 120
          return (
            <div className="relative flex items-center p-1 rounded-xl"
              style={{ width: allItems.length * ITEM_W + 8, background: 'var(--ds-bg-raised)' }}>
              <div
                className="absolute top-1 bottom-1 rounded-lg shadow-sm pointer-events-none transition-transform duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]"
                style={{ width: ITEM_W, transform: `translateX(${Math.max(0, activeIndex) * ITEM_W}px)`, background: 'var(--ds-pill-bg)' }}
              />
              {allItems.map(item => (
                <button
                  key={item.path}
                  onClick={() => navigate(item.path)}
                  style={{ width: ITEM_W, color: isActive(item.path) ? 'var(--ds-text-1)' : 'var(--ds-text-3)' }}
                  className="relative flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wide transition-colors duration-200 z-10 hover:text-[--ds-text-2]"
                >
                  <span className="material-symbols-outlined text-sm">{item.icon}</span>
                  {item.label}
                </button>
              ))}
            </div>
          )
        })()}

        {/* Right actions */}
        <div className="flex items-center gap-2">
          {/* Search icon → expandable dropdown */}
          <div ref={searchRef} className="relative">
            <div className="group relative">
              <button
                onClick={openSearch}
                className="relative size-9 flex items-center justify-center rounded-xl transition-colors hover:bg-[var(--ds-bg-raised)]"
                style={{ color: q ? '#adee2b' : 'var(--ds-text-3)' }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>search</span>
              </button>
              {/* Tooltip */}
              <div className={`absolute top-full left-1/2 -translate-x-1/2 mt-2 pointer-events-none z-[51] transition-opacity duration-150 whitespace-nowrap ${searchOpen ? 'opacity-0' : 'opacity-0 group-hover:opacity-100'}`}>
                <div className="px-2.5 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wide text-slate-500"
                  style={{ background: 'rgba(255,255,255,0.75)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.6)', boxShadow: '0 4px 16px rgba(0,0,0,0.08)' }}>
                  Search
                </div>
              </div>
            </div>

            {/* Search dropdown */}
            <div
              className="absolute right-0 top-full mt-2 z-50"
              style={{
                opacity: searchOpen ? 1 : 0,
                transform: searchOpen ? 'translateY(0) scale(1)' : 'translateY(-6px) scale(0.97)',
                transition: 'opacity 150ms ease, transform 150ms cubic-bezier(0.4,0,0.2,1)',
                pointerEvents: searchOpen ? 'auto' : 'none',
              }}
            >
              <div className="rounded-2xl shadow-xl overflow-hidden"
                style={{ background: 'var(--ds-glass-bg)', backdropFilter: 'blur(32px)', WebkitBackdropFilter: 'blur(32px)', border: '1px solid var(--ds-glass-border)' }}>
                <form onSubmit={e => { e.preventDefault(); dispatch(q); setSearchOpen(false) }}
                  className="flex items-center gap-1 p-1.5">
                  <span className="material-symbols-outlined text-base ml-2 shrink-0" style={{ color: 'var(--ds-text-4)' }}>search</span>
                  <input
                    ref={searchInputRef}
                    type="text"
                    placeholder={t('nav_search_placeholder')}
                    value={q}
                    onChange={e => { setQ(e.target.value); dispatch(e.target.value) }}
                    className="w-80 text-[13px] font-bold bg-transparent focus:outline-none"
                    style={{ color: 'var(--ds-text-1)' }}
                  />
                  {q && (
                    <button type="button" onClick={clear}
                      className="size-6 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 transition-colors shrink-0">
                      <span className="material-symbols-outlined text-sm">close</span>
                    </button>
                  )}
                </form>
                <div className="border-t border-white/60 mx-2 mb-1.5">
                  <button type="button"
                    onClick={() => {
                      document.dispatchEvent(new CustomEvent('available-rooms-toggle'))
                      setSearchOpen(false)
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-[12px] font-black uppercase text-slate-500 hover:bg-slate-100 transition-colors mt-1">
                    <span className="material-symbols-outlined" style={{ fontSize: 16 }}>meeting_room</span>
                    Search Available Rooms
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Today icon button */}
          <div className="group relative">
            <button
              onClick={() => { document.dispatchEvent(new CustomEvent('today-panel-toggle')); onTodayClick?.() }}
              className="relative size-9 flex items-center justify-center rounded-xl transition-colors hover:bg-[var(--ds-bg-raised)]"
              style={{ color: 'var(--ds-text-3)' }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>calendar_today</span>
              {todayCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[16px] h-[16px] rounded-full bg-[#adee2b] text-black text-[9px] font-black flex items-center justify-center px-[3px] leading-none border-2 border-white">
                  {todayCount > 9 ? '9+' : todayCount}
                </span>
              )}
            </button>
            <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 pointer-events-none z-50 opacity-0 group-hover:opacity-100 transition-opacity duration-150 whitespace-nowrap">
              <div className="px-2.5 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wide text-slate-500"
                style={{ background: 'rgba(255,255,255,0.75)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.6)', boxShadow: '0 4px 16px rgba(0,0,0,0.08)' }}>
                Today's Bookings
              </div>
            </div>
          </div>

          {/* Notification bell */}
          <div className="group relative">
            <button
              onClick={openNotifications}
              className="relative size-9 flex items-center justify-center rounded-xl transition-colors hover:bg-[var(--ds-bg-raised)]"
              style={{ color: 'var(--ds-text-3)' }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>notifications</span>
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[16px] h-[16px] rounded-full bg-[#adee2b] text-black text-[9px] font-black flex items-center justify-center px-[3px] leading-none border-2 border-white">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>
            <div className="absolute top-full right-0 mt-2 pointer-events-none z-50 opacity-0 group-hover:opacity-100 transition-opacity duration-150 whitespace-nowrap">
              <div className="px-2.5 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wide text-slate-500"
                style={{ background: 'rgba(255,255,255,0.75)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.6)', boxShadow: '0 4px 16px rgba(0,0,0,0.08)' }}>
                Notifications{unreadCount > 0 ? ` · ${unreadCount} unread` : ''}
              </div>
            </div>
          </div>

          {/* Avatar + dropdown */}
          <div ref={dropdownRef} className="relative">
            <button
              onClick={() => setProfileOpen(o => !o)}
              className="flex items-center gap-2"
            >
              <UserAvatar name={user?.name ?? ''} avatar={user?.avatar} size={36}
                style={{ border: '2px solid #adee2b', cursor: 'pointer' }} />
            </button>

            <div
              className="absolute right-0 top-full mt-2 w-56 rounded-2xl z-50 overflow-hidden"
              style={{
                opacity: profileOpen ? 1 : 0,
                transform: profileOpen ? 'translateY(0) scale(1)' : 'translateY(-8px) scale(0.97)',
                transition: 'opacity 180ms ease, transform 180ms cubic-bezier(0.4,0,0.2,1)',
                pointerEvents: profileOpen ? 'auto' : 'none',
                background: 'var(--ds-glass-bg)',
                backdropFilter: 'blur(32px)',
                WebkitBackdropFilter: 'blur(32px)',
                border: '1px solid var(--ds-glass-border)',
                boxShadow: 'var(--ds-glass-shadow)',
              }}
            >
              <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--ds-border-sub)' }}>
                <p className="text-[12px] font-black" style={{ color: 'var(--ds-text-1)' }}>{user?.name}</p>
                <p className="text-[10px] font-bold uppercase tracking-wide" style={{ color: 'var(--ds-text-3)' }}>{user?.role}{user?.department ? ` · ${user.department}` : ''}</p>
              </div>

              <div className="py-1.5">
                {[
                  { icon: 'account_circle', label: 'User Profile', action: () => { setProfileModalOpen(true); setProfileOpen(false) } },
                  { icon: 'settings', label: 'Setting', action: () => { setSettingOpen(true); setProfileOpen(false) } },
                  { icon: 'help', label: 'Help', action: () => { setHelpOpen(true); setProfileOpen(false) } },
                ].map(({ icon, label, action }) => (
                  <button key={label} onClick={action}
                    className="w-full flex items-center gap-2.5 px-4 py-2.5 hover:bg-white/10 transition-colors text-[11px] font-black uppercase"
                    style={{ color: 'var(--ds-text-2)' }}
                  >
                    <span className="material-symbols-outlined text-base" style={{ color: 'var(--ds-text-3)' }}>{icon}</span>
                    {label}
                  </button>
                ))}
              </div>

              <div className="py-1.5" style={{ borderTop: '1px solid var(--ds-border-sub)' }}>
                <button onClick={handleLogout}
                  className="w-full flex items-center gap-2.5 px-4 py-2.5 hover:bg-red-50/80 hover:text-red-600 transition-colors text-[11px] font-black uppercase"
                  style={{ color: 'var(--ds-text-3)' }}
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
