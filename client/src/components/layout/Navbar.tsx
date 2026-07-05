import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getMyBookings, getBookings } from '../../api/bookings'
import { getRooms } from '../../api/rooms'
import { getGeneralSettings, getCachedBranding } from '../../api/settings'
import type { Booking, Room } from '../../types'
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

function fmtSearchDate(iso: string, lang = 'en') {
  const d = new Date(iso)
  return d.toLocaleDateString(lang === 'id' ? 'id-ID' : 'en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
}

export default function Navbar({ onSearch, onTodayClick }: NavbarProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, logout } = useAuth()
  const { t, language } = useSettings()
  const queryClient = useQueryClient()
  const { openNotifications } = useNotification()
  const unreadCount = useNotificationUnreadCount()
  const { data: appSettings } = useQuery({ queryKey: ['settings-general'], queryFn: getGeneralSettings, staleTime: 5 * 60 * 1000 })
  const cachedBranding = appSettings ? null : getCachedBranding()
  const appName = appSettings?.app_name ?? cachedBranding?.app_name ?? 'RoomSync Pro'
  const appLogoUrl = appSettings?.app_logo_url ?? cachedBranding?.app_logo_url ?? null
  useEffect(() => { document.title = appName }, [appName])

  // — all useState / useRef declarations first, before any useQuery that references them —
  const [q, setQ] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [profileModalOpen, setProfileModalOpen] = useState(false)
  const [settingOpen, setSettingOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  // — queries (may reference state declared above) —
  const { data: myBookings = [] } = useQuery<Booking[]>({
    queryKey: ['my-bookings'],
    queryFn: getMyBookings,
    staleTime: 10_000,
  })
  const { data: rooms = [] } = useQuery<Room[]>({
    queryKey: ['rooms'],
    queryFn: getRooms,
    staleTime: 5 * 60_000,
  })
  const todayStr = new Date().toLocaleDateString('en-CA')
  const plus60Str = (() => { const d = new Date(); d.setDate(d.getDate() + 60); return d.toLocaleDateString('en-CA') })()
  const { data: allBookings = [] } = useQuery<Booking[]>({
    queryKey: ['bookings-global-search', todayStr],
    queryFn: () => getBookings({ date_from: todayStr, date_to: plus60Str }),
    staleTime: 60_000,
    enabled: searchOpen,
  })

  const todayCount = useMemo(() => {
    return myBookings.filter(b =>
      b.status !== 'cancelled' && b.start_at.slice(0, 10) === todayStr
    ).length
  }, [myBookings, todayStr])

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

  function dispatchTimeline(val: string) {
    onSearch?.(val)
    document.dispatchEvent(new CustomEvent('timeline-search', { detail: val }))
  }

  function clear() { setQ(''); dispatchTimeline('') }

  function closeSearch() { setSearchOpen(false); setQ(''); dispatchTimeline('') }

  // Global search results — rooms + all users' upcoming bookings
  const searchResults = useMemo(() => {
    const trimmed = q.trim().toLowerCase()
    if (trimmed.length < 1) return null
    const matchedRooms = (rooms as Room[]).filter(r =>
      r.name.toLowerCase().includes(trimmed) ||
      (r.building?.name ?? '').toLowerCase().includes(trimmed) ||
      (r.building?.code ?? '').toLowerCase().includes(trimmed)
    ).slice(0, 4)
    const matchedBookings = (allBookings as Booking[])
      .filter(b =>
        b.status !== 'cancelled' &&
        (
          b.title.toLowerCase().includes(trimmed) ||
          (b.room?.name ?? '').toLowerCase().includes(trimmed) ||
          (b.description ?? '').toLowerCase().includes(trimmed) ||
          (b.user?.name ?? '').toLowerCase().includes(trimmed)
        )
      )
      .sort((a, b) => a.start_at.localeCompare(b.start_at))
      .slice(0, 5)
    return { rooms: matchedRooms, bookings: matchedBookings }
  }, [q, rooms, allBookings])

  const hasResults = searchResults && (searchResults.rooms.length > 0 || searchResults.bookings.length > 0)

  function goToRoom(r: Room) {
    closeSearch()
    navigate('/rooms')
    setTimeout(() => document.dispatchEvent(new CustomEvent('rooms-highlight', { detail: r.id })), 120)
  }

  function goToBooking(b: Booking) {
    closeSearch()
    const date = b.start_at.slice(0, 10)
    navigate(`/?date=${date}&highlight=${b.id}`)
  }

  const isActive = (path: string) => location.pathname === path

  const NAV_ITEMS = NAV_PATHS.map(n => ({ ...n, label: t(n.key as Parameters<typeof t>[0]) }))
  const isReceptionist = user?.role === 'receptionist' || user?.role === 'admin'
  const isAdminPanelUser = user?.role === 'admin' || user?.role === 'building_admin'
  const allItems = [
    ...NAV_ITEMS,
    ...(isReceptionist ? [{ path: '/receptionist', label: 'Receptionist', icon: 'support_agent' }] : []),
    ...(isAdminPanelUser ? [{ path: '/admin', label: t('nav_admin'), icon: 'admin_panel_settings' }] : []),
  ]

  // Global keyboard shortcuts — Ctrl+F available rooms, N notifications, T today panel,
  // Alt+N new booking (handled by TimelinePage via CustomEvent)
  // Note: Ctrl+N is reserved by the browser (new window) and cannot be overridden — Alt+N used instead.
  // Note: Tab/Shift+Tab nav-cycling was removed — it interfered with normal Tab-based focus navigation in forms.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement
      const isTyping = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable)

      if (e.altKey && !e.ctrlKey && !e.metaKey) {
        if (isTyping) return
        if (e.key.toLowerCase() === 'n') {
          e.preventDefault()
          document.dispatchEvent(new CustomEvent('new-booking-shortcut'))
        }
        return
      }

      if (e.ctrlKey || e.metaKey) {
        if (isTyping) return
        if (e.key.toLowerCase() === 'f') {
          e.preventDefault()
          document.dispatchEvent(new CustomEvent('available-rooms-toggle'))
        }
        return
      }

      if (isTyping) return

      if (e.key === 'n' || e.key === 'N') {
        e.preventDefault()
        openNotifications()
      } else if (e.key === 't' || e.key === 'T') {
        e.preventDefault()
        document.dispatchEvent(new CustomEvent('today-panel-toggle'))
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [user?.role, location.pathname, language])

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
          <div className={`h-9 min-w-9 max-w-[160px] rounded-xl flex items-center justify-center text-[#adee2b] overflow-hidden px-1 ${appLogoUrl ? 'bg-white' : 'bg-black'}`}>
            {appLogoUrl
              ? <img src={appLogoUrl} alt="logo" className="h-full w-auto max-w-[152px] object-contain" />
              : <span className="material-symbols-outlined text-lg">sync_alt</span>
            }
          </div>
          <span className="text-xl font-black tracking-tighter italic uppercase" style={{ color: 'var(--ds-text-1)' }}>
            {appName}
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
                  style={{ width: ITEM_W, color: isActive(item.path) ? 'var(--ds-text-1)' : 'var(--ds-text-2)' }}
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

          {/* Global search */}
          <div ref={searchRef} className="relative">
            <div className="group relative">
              <button
                onClick={openSearch}
                className="relative size-9 flex items-center justify-center rounded-xl transition-colors hover:bg-[var(--ds-bg-raised)]"
                style={{ color: q ? '#adee2b' : 'var(--ds-text-2)' }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>search</span>
              </button>
              <div className={`absolute top-full left-1/2 -translate-x-1/2 mt-2 pointer-events-none z-[51] transition-opacity duration-150 whitespace-nowrap ${searchOpen ? 'opacity-0' : 'opacity-0 group-hover:opacity-100'}`}>
                <div className="px-2.5 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wide text-[var(--ds-text-2)]"
                  style={{ background: 'var(--ds-glass-bg)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', border: '1px solid var(--ds-glass-border)', boxShadow: 'var(--ds-glass-shadow)' }}>
                  {t('nav_search_tooltip')}
                </div>
              </div>
            </div>

            {/* Search dropdown */}
            <div
              className="absolute right-0 top-full mt-2 z-50 w-80"
              style={{
                opacity: searchOpen ? 1 : 0,
                transform: searchOpen ? 'translateY(0) scale(1)' : 'translateY(-6px) scale(0.97)',
                transition: 'opacity 150ms ease, transform 150ms cubic-bezier(0.4,0,0.2,1)',
                pointerEvents: searchOpen ? 'auto' : 'none',
              }}
            >
              <div className="rounded-2xl shadow-xl overflow-hidden"
                style={{ background: 'var(--ds-glass-bg)', backdropFilter: 'blur(32px)', WebkitBackdropFilter: 'blur(32px)', border: '1px solid var(--ds-glass-border)' }}>

                {/* Input */}
                <div className="flex items-center gap-1 p-1.5">
                  <span className="material-symbols-outlined text-base ml-2 shrink-0" style={{ color: 'var(--ds-text-4)' }}>search</span>
                  <input
                    ref={searchInputRef}
                    type="text"
                    placeholder={t('nav_search_rooms_placeholder')}
                    value={q}
                    onChange={e => { setQ(e.target.value); dispatchTimeline(e.target.value) }}
                    onKeyDown={e => e.key === 'Escape' && closeSearch()}
                    className="flex-1 text-[13px] font-bold bg-transparent focus:outline-none"
                    style={{ color: 'var(--ds-text-1)' }}
                  />
                  {q && (
                    <button type="button" onClick={clear}
                      className="size-6 rounded-lg flex items-center justify-center shrink-0 transition-colors"
                      style={{ color: 'var(--ds-text-3)' }}>
                      <span className="material-symbols-outlined text-sm">close</span>
                    </button>
                  )}
                </div>

                {/* Live results */}
                {searchResults && (
                  <div style={{ borderTop: '1px solid var(--ds-border-sub)' }}>
                    {searchResults.rooms.length > 0 && (
                      <div className="px-2 pt-2 pb-1">
                        <p className="px-2 pb-1 text-[9px] font-black uppercase tracking-widest" style={{ color: 'var(--ds-text-4)' }}>{t('nav_rooms_section')}</p>
                        {searchResults.rooms.map(r => (
                          <button key={r.id} onClick={() => goToRoom(r)}
                            className="w-full flex items-center gap-2.5 px-2 py-2 rounded-xl transition-colors text-left"
                            style={{ color: 'var(--ds-text-1)' }}
                            onMouseEnter={e => (e.currentTarget.style.background = 'var(--ds-bg-raised)')}
                            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                          >
                            <span className="material-symbols-outlined shrink-0" style={{ fontSize: 16, color: 'var(--ds-text-3)' }}>meeting_room</span>
                            <div className="flex-1 min-w-0">
                              <p className="text-[12px] font-black truncate">{r.name}</p>
                              <p className="text-[10px] font-bold truncate" style={{ color: 'var(--ds-text-3)' }}>
                                {r.building?.code || r.building?.name}{r.floor ? ` · Lt ${r.floor}` : ''}{r.capacity ? ` · ${r.capacity} pax` : ''}
                              </p>
                            </div>
                            <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded-full shrink-0 ${r.status === 'active' ? 'bg-green-500/15 text-green-600' : 'bg-amber-500/15 text-amber-600'}`}>
                              {r.status}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}

                    {searchResults.bookings.length > 0 && (
                      <div className={`px-2 pt-2 pb-1 ${searchResults.rooms.length > 0 ? 'border-t' : ''}`} style={{ borderColor: 'var(--ds-border-sub)' }}>
                        <p className="px-2 pb-1 text-[9px] font-black uppercase tracking-widest" style={{ color: 'var(--ds-text-4)' }}>{t('nav_bookings_section')}</p>
                        {searchResults.bookings.map(b => {
                          const isOwn = b.user_id === user?.id
                          return (
                            <button key={b.id} onClick={() => goToBooking(b)}
                              className="w-full flex items-center gap-2.5 px-2 py-2 rounded-xl transition-colors text-left"
                              style={{ color: 'var(--ds-text-1)' }}
                              onMouseEnter={e => (e.currentTarget.style.background = 'var(--ds-bg-raised)')}
                              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                            >
                              {b.user && !isOwn
                                ? <UserAvatar name={b.user.name} avatar={b.user.avatar} size={22} style={{ shrink: 0 }} />
                                : <span className="material-symbols-outlined shrink-0" style={{ fontSize: 16, color: 'var(--ds-text-3)' }}>event</span>
                              }
                              <div className="flex-1 min-w-0">
                                <p className="text-[12px] font-black truncate">{b.title}</p>
                                <p className="text-[10px] font-bold truncate" style={{ color: 'var(--ds-text-3)' }}>
                                  {b.room?.name} · {fmtSearchDate(b.start_at, language)}
                                  {!isOwn && b.user && <span style={{ color: 'var(--ds-text-4)' }}> · {b.user.name}</span>}
                                </p>
                              </div>
                              <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded-full shrink-0 ${b.status === 'confirmed' ? 'bg-[#adee2b] text-black' : 'bg-amber-500/15 text-amber-600'}`}>
                                {b.status}
                              </span>
                            </button>
                          )
                        })}
                      </div>
                    )}

                    {!hasResults && (
                      <div className="px-4 py-4 text-center">
                        <p className="text-[11px] font-bold" style={{ color: 'var(--ds-text-3)' }}>{t('nav_no_results')} "{q}"</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Footer: Search Available Rooms shortcut */}
                <div className="px-2 pb-2" style={{ borderTop: '1px solid var(--ds-border-sub)', paddingTop: 6, marginTop: searchResults ? 0 : 0 }}>
                  <button type="button"
                    onClick={() => {
                      document.dispatchEvent(new CustomEvent('available-rooms-toggle'))
                      closeSearch()
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-[11px] font-black uppercase transition-colors mt-1"
                    style={{ color: 'var(--ds-text-3)' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--ds-bg-raised)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 16 }}>tune</span>
                    {t('nav_search_available_rooms')}
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
              style={{ color: 'var(--ds-text-2)' }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>calendar_today</span>
              {todayCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[16px] h-[16px] rounded-full bg-[#adee2b] text-black text-[9px] font-black flex items-center justify-center px-[3px] leading-none border-2 border-[var(--ds-bg-surface)]">
                  {todayCount > 9 ? '9+' : todayCount}
                </span>
              )}
            </button>
            <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 pointer-events-none z-50 opacity-0 group-hover:opacity-100 transition-opacity duration-150 whitespace-nowrap">
              <div className="px-2.5 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wide text-[var(--ds-text-2)]"
                style={{ background: 'var(--ds-glass-bg)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', border: '1px solid var(--ds-glass-border)', boxShadow: 'var(--ds-glass-shadow)' }}>
                {t('nav_todays_bookings')}
              </div>
            </div>
          </div>

          {/* Notification bell */}
          <div className="group relative">
            <button
              onClick={openNotifications}
              className="relative size-9 flex items-center justify-center rounded-xl transition-colors hover:bg-[var(--ds-bg-raised)]"
              style={{ color: 'var(--ds-text-2)' }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>notifications</span>
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[16px] h-[16px] rounded-full bg-[#adee2b] text-black text-[9px] font-black flex items-center justify-center px-[3px] leading-none border-2 border-[var(--ds-bg-surface)]">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>
            <div className="absolute top-full right-0 mt-2 pointer-events-none z-50 opacity-0 group-hover:opacity-100 transition-opacity duration-150 whitespace-nowrap">
              <div className="px-2.5 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wide text-[var(--ds-text-2)]"
                style={{ background: 'var(--ds-glass-bg)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', border: '1px solid var(--ds-glass-border)', boxShadow: 'var(--ds-glass-shadow)' }}>
                {t('nav_notifications')}{unreadCount > 0 ? ` · ${unreadCount} ${t('nav_notifications_unread')}` : ''}
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
                  { icon: 'account_circle', label: t('nav_user_profile'), action: () => { setProfileModalOpen(true); setProfileOpen(false) } },
                  { icon: 'settings', label: t('nav_setting'), action: () => { setSettingOpen(true); setProfileOpen(false) } },
                  { icon: 'help', label: t('nav_help'), action: () => { setHelpOpen(true); setProfileOpen(false) } },
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
                  {t('nav_logout')}
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
