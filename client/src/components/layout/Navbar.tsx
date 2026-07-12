import { useState, useRef, useEffect, useLayoutEffect, useCallback, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
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
import UserHoverCard from '../ui/UserHoverCard'
import SettingModal from '../profile/SettingModal'
import HelpModal from '../profile/HelpModal'
import AboutModal from '../profile/AboutModal'

const NAV_PATHS = [
  { path: '/',         key: 'nav_schedule',    icon: 'grid_view' },
  { path: '/schedule', key: 'nav_my_bookings', icon: 'calendar_month' },
  { path: '/rooms',    key: 'nav_rooms',        icon: 'meeting_room' },
] as const

interface NavbarProps {
  onSearch?: (q: string) => void
  onTodayClick?: () => void
}

// Portal-based hover tooltip — escapes the search dropdown's overflow-hidden container
// (a plain CSS group-hover popup gets clipped since it's near the top edge of that box).
function InfoTooltip({ text }: { text: string }) {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  const btnRef = useRef<HTMLButtonElement>(null)
  const width = 224

  function show() {
    const rect = btnRef.current?.getBoundingClientRect()
    if (!rect) return
    setPos({ top: rect.bottom + 8, left: Math.min(rect.right - width, window.innerWidth - width - 8) })
  }

  return (
    <div className="relative shrink-0">
      <button
        ref={btnRef}
        type="button"
        onMouseEnter={show}
        onMouseLeave={() => setPos(null)}
        className="size-6 rounded-lg flex items-center justify-center transition-colors hover:bg-[var(--ds-bg-raised)]"
        style={{ color: 'var(--ds-text-4)' }}
      >
        <span className="material-symbols-outlined text-sm">info</span>
      </button>
      {pos && createPortal(
        <div className="fixed z-[300] pointer-events-none" style={{ top: pos.top, left: pos.left, width }}>
          <div className="px-3 py-2.5 rounded-xl" style={{ background: '#1e293b', boxShadow: '0 8px 24px rgba(0,0,0,0.28)' }}>
            <p className="text-[10px] font-semibold text-white leading-relaxed">{text}</p>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}

function fmtSearchDate(iso: string, lang = 'en') {
  const d = new Date(iso.replace('Z', ''))
  return d.toLocaleDateString(lang === 'id' ? 'id-ID' : 'en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
}

function fmtSearchTime(iso: string) {
  const d = new Date(iso.replace('Z', ''))
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

// Wraps the substring(s) matching `query` (case-insensitive) in a light-green highlight.
function HighlightMatch({ text, query }: { text: string; query: string }) {
  const q = query.trim()
  if (!q) return <>{text}</>
  const idx = text.toLowerCase().indexOf(q.toLowerCase())
  if (idx === -1) return <>{text}</>
  return (
    <>
      {text.slice(0, idx)}
      <span style={{ background: 'rgba(173,238,43,0.45)', color: 'inherit', borderRadius: 3, padding: '0 1px' }}>
        {text.slice(idx, idx + q.length)}
      </span>
      {text.slice(idx + q.length)}
    </>
  )
}

export default function Navbar({ onSearch, onTodayClick }: NavbarProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, logout } = useAuth()
  const { t, language } = useSettings()
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
  const [aboutOpen, setAboutOpen] = useState(false)
  const [advancedSearchOpen, setAdvancedSearchOpen] = useState(false)
  // Synced from TimelinePage's "Select Building" filter via CustomEvent — null means no
  // filter is active there (or the user hasn't visited Timeline yet), so show all buildings.
  const [selectedBuildingId, setSelectedBuildingId] = useState<number | null>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  // Measured content height for the animated "expand" transition on the results — CSS can't
  // transition to/from `height: auto`, so the actual content height is measured and animated
  // as a pixel value instead (see the two useLayoutEffects below).
  const dropdownResultsRef = useRef<HTMLDivElement>(null)
  const [dropdownResultsH, setDropdownResultsH] = useState(0)
  const modalBodyRef = useRef<HTMLDivElement>(null)
  const [modalBodyH, setModalBodyH] = useState(0)

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
  const plus7Str = (() => { const d = new Date(); d.setDate(d.getDate() + 7); return d.toLocaleDateString('en-CA') })()
  const { data: allBookings = [] } = useQuery<Booking[]>({
    queryKey: ['bookings-global-search', todayStr],
    queryFn: () => getBookings({ date_from: todayStr, date_to: plus7Str }),
    staleTime: 60_000,
    enabled: searchOpen || advancedSearchOpen,
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

  useEffect(() => {
    function handleBuildingFilter(e: Event) {
      setSelectedBuildingId((e as CustomEvent<number | null>).detail)
    }
    document.addEventListener('building-filter-changed', handleBuildingFilter)
    return () => document.removeEventListener('building-filter-changed', handleBuildingFilter)
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

  const RESULT_CAP = 5

  // Global search results — rooms (scoped to the building selected on Timeline, if any) + all
  // users' bookings from today through the next 7 days. Full (uncapped) lists are kept so the
  // "Show more" advanced search modal can browse everything; the dropdown only shows the top 5
  // of each.
  const searchResults = useMemo(() => {
    const trimmed = q.trim().toLowerCase()
    if (trimmed.length < 1) return null
    const allMatchedRooms = (rooms as Room[]).filter(r =>
      (selectedBuildingId === null || r.building_id === selectedBuildingId) &&
      (
        r.name.toLowerCase().includes(trimmed) ||
        (r.building?.name ?? '').toLowerCase().includes(trimmed) ||
        (r.building?.code ?? '').toLowerCase().includes(trimmed)
      )
    )
    const allMatchedBookings = (allBookings as Booking[])
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
    return {
      rooms: allMatchedRooms.slice(0, RESULT_CAP),
      bookings: allMatchedBookings.slice(0, RESULT_CAP),
      allRooms: allMatchedRooms,
      allBookings: allMatchedBookings,
      hasMore: allMatchedRooms.length > RESULT_CAP || allMatchedBookings.length > RESULT_CAP,
    }
  }, [q, rooms, allBookings, selectedBuildingId])

  const hasResults = searchResults && (searchResults.rooms.length > 0 || searchResults.bookings.length > 0)

  // Re-measure whenever the result set changes (typing, or the results loading in) so the
  // dropdown/modal can smoothly animate to the new content height instead of snapping.
  useLayoutEffect(() => {
    setDropdownResultsH(dropdownResultsRef.current?.scrollHeight ?? 0)
  }, [searchResults])

  useLayoutEffect(() => {
    if (!advancedSearchOpen) return
    setModalBodyH(modalBodyRef.current?.scrollHeight ?? 0)
  }, [searchResults, advancedSearchOpen])

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
    ...(isReceptionist ? [{ path: '/receptionist', label: t('nav_receptionist'), icon: 'support_agent' }] : []),
    ...(isAdminPanelUser ? [{ path: '/admin', label: t('nav_admin'), icon: 'admin_panel_settings' }] : []),
  ]

  // Global keyboard shortcuts — Ctrl+F available rooms, Ctrl+Shift+F global search,
  // N notifications, T today panel, Alt+N new booking (handled by TimelinePage via CustomEvent)
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
          if (e.shiftKey) {
            openSearch()
          } else {
            document.dispatchEvent(new CustomEvent('available-rooms-toggle'))
          }
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
  }, [user?.role, location.pathname, language, openSearch])

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
          <span className="text-xl font-black tracking-tighter uppercase" style={{ color: 'var(--ds-text-1)' }}>
            {appName}
          </span>
          {user?.role === 'guest' && (
            <span className="text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-full bg-[#adee2b]/15 text-[#7ea816] dark:text-[#adee2b]">
              Guest · Read-only
            </span>
          )}
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
                <Link
                  key={item.path}
                  to={item.path}
                  style={{ width: ITEM_W, color: isActive(item.path) ? 'var(--ds-text-1)' : 'var(--ds-text-2)' }}
                  className="relative flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wide transition-colors duration-200 z-10 hover:text-[--ds-text-2]"
                >
                  <span className="material-symbols-outlined text-sm">{item.icon}</span>
                  {item.label}
                </Link>
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
              className="absolute right-0 top-full mt-2 z-50 w-[28rem]"
              style={{
                opacity: searchOpen ? 1 : 0,
                transform: searchOpen ? 'translateY(0) scale(1)' : 'translateY(-6px) scale(0.97)',
                transition: 'opacity 150ms ease, transform 150ms cubic-bezier(0.4,0,0.2,1)',
                pointerEvents: searchOpen ? 'auto' : 'none',
              }}
            >
              <div className="rounded-2xl overflow-hidden shadow-xl"
                style={{
                  background: 'var(--ds-glass-bg)',
                  backdropFilter: 'blur(32px)',
                  WebkitBackdropFilter: 'blur(32px)',
                  border: '1.5px solid var(--ds-border)',
                }}>

                {/* Input */}
                <div className="flex items-center gap-1 px-2 py-4">
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
                  <InfoTooltip text={language === 'id'
                    ? 'Pencarian cuma mencakup Ruangan & Booking (hari ini s/d 7 hari ke depan). Tidak bisa mencari orang/user.'
                    : 'Search covers Rooms & Bookings only (today through the next 7 days). Cannot search for people/users.'} />
                </div>

                {/* Live results — outer wrapper animates its height to the measured content
                    height so the dropdown smoothly grows/shrinks as you type, instead of
                    snapping to the new size. */}
                <div style={{ height: dropdownResultsH, overflow: 'hidden', transition: 'height 200ms cubic-bezier(0.4,0,0.2,1)' }}>
                <div ref={dropdownResultsRef}>
                {searchResults && (
                  <div style={{ borderTop: '1px solid var(--ds-border-sub)' }}>
                    {searchResults.rooms.length > 0 && (
                      <div className="px-2 pt-2 pb-1">
                        <p className="px-2 pb-1 text-[9px] font-black uppercase tracking-widest" style={{ color: 'var(--ds-text-4)' }}>{t('nav_rooms_section')}</p>
                        {searchResults.rooms.map((r, i) => (
                          <button key={r.id} onClick={() => goToRoom(r)}
                            className="w-full flex items-center gap-2.5 px-2 py-2 rounded-xl transition-colors text-left row-stagger-in"
                            style={{ color: 'var(--ds-text-1)', animationDelay: `${i * 25}ms` }}
                            onMouseEnter={e => (e.currentTarget.style.background = 'var(--ds-bg-raised)')}
                            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                          >
                            <span className="material-symbols-outlined shrink-0" style={{ fontSize: 16, color: 'var(--ds-text-3)' }}>meeting_room</span>
                            <div className="flex-1 min-w-0">
                              <p className="text-[12px] font-black truncate" title={r.name}><HighlightMatch text={r.name} query={q} /></p>
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
                        {searchResults.bookings.map((b, i) => {
                          const isOwn = b.user_id === user?.id
                          return (
                            <button key={b.id} onClick={() => goToBooking(b)}
                              className="w-full flex items-center gap-2.5 px-2 py-2 rounded-xl transition-colors text-left row-stagger-in"
                              style={{ color: 'var(--ds-text-1)', animationDelay: `${(searchResults.rooms.length + i) * 25}ms` }}
                              onMouseEnter={e => (e.currentTarget.style.background = 'var(--ds-bg-raised)')}
                              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                            >
                              {b.user && !isOwn
                                ? <UserAvatar name={b.user.name} avatar={b.user.avatar} size={22} style={{ flexShrink: 0 }} />
                                : (
                                  <div className="shrink-0 flex items-center justify-center rounded-full" style={{ width: 22, height: 22, background: 'var(--ds-bg-raised)' }}>
                                    <span className="material-symbols-outlined" style={{ fontSize: 13, color: 'var(--ds-text-3)' }}>event</span>
                                  </div>
                                )
                              }
                              <div className="flex-1 min-w-0">
                                <p className="text-[12px] font-black truncate" title={b.title}><HighlightMatch text={b.title} query={q} /></p>
                                <div className="text-[10px] font-bold truncate" style={{ color: 'var(--ds-text-3)' }}>
                                  {b.room?.name} · {fmtSearchDate(b.start_at, language)}, {fmtSearchTime(b.start_at)}–{fmtSearchTime(b.end_at)}
                                  {b.user && (
                                    <UserHoverCard name={b.user.name} userId={b.user_id} user={b.user}>
                                      <span style={{ color: 'var(--ds-text-4)', cursor: 'default' }}>
                                        {' · '}{isOwn ? t('nav_search_you') : b.user.name}{b.user.department_name ? `/${b.user.department_name}` : ''}
                                      </span>
                                    </UserHoverCard>
                                  )}
                                </div>
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

                    {searchResults.hasMore && (
                      <div className="px-2 pb-1">
                        <button type="button"
                          onClick={() => setAdvancedSearchOpen(true)}
                          className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-wide transition-colors"
                          style={{ color: '#7ab814' }}
                          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(173,238,43,0.10)')}
                          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                        >
                          {t('nav_search_show_more')}
                          <span className="material-symbols-outlined" style={{ fontSize: 14 }}>arrow_forward</span>
                        </button>
                      </div>
                    )}
                  </div>
                )}
                </div>
                </div>

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
                  { icon: 'info', label: t('nav_about'), action: () => { setAboutOpen(true); setProfileOpen(false) } },
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
      <AboutModal open={aboutOpen} onClose={() => setAboutOpen(false)} />

      {advancedSearchOpen && searchResults && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <style>{`
            @keyframes advsearch-backdrop-in { from { opacity: 0 } to { opacity: 1 } }
          `}</style>
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setAdvancedSearchOpen(false)}
            style={{ animation: 'advsearch-backdrop-in 150ms ease' }} />
          <div
            className="relative flex flex-col rounded-3xl shadow-2xl w-full max-w-[640px] modal-pop-in"
            style={{
              background: 'var(--ds-bg-surface)',
              border: '1px solid var(--ds-border-sub)',
              maxHeight: '82vh',
            }}
          >
            {/* Header */}
            <div className="flex items-center gap-3 px-6 py-5 shrink-0 rounded-t-3xl" style={{ borderBottom: '1px solid var(--ds-border-sub)' }}>
              <span className="material-symbols-outlined shrink-0" style={{ fontSize: 20, color: 'var(--ds-text-3)' }}>search</span>
              <input
                type="text"
                autoFocus
                value={q}
                onChange={e => { setQ(e.target.value); dispatchTimeline(e.target.value) }}
                onKeyDown={e => e.key === 'Escape' && setAdvancedSearchOpen(false)}
                className="flex-1 text-[15px] font-bold bg-transparent focus:outline-none"
                style={{ color: 'var(--ds-text-1)' }}
              />
              <button onClick={() => setAdvancedSearchOpen(false)}
                className="size-8 rounded-full flex items-center justify-center transition-colors hover:bg-[var(--ds-bg-raised)] shrink-0"
                style={{ color: 'var(--ds-text-3)' }}>
                <span className="material-symbols-outlined text-base">close</span>
              </button>
            </div>

            {/* Body — outer wrapper animates height to the measured content height (see
                modalBodyH/useLayoutEffect above) so the modal visibly "expands" as results
                come in, instead of jumping straight to full size. */}
            <div className="overflow-y-auto" style={{ height: modalBodyH, maxHeight: 'calc(82vh - 88px)', transition: 'height 220ms cubic-bezier(0.4,0,0.2,1)' }}>
            <div ref={modalBodyRef} className="px-2 py-2">
              {searchResults.allRooms.length > 0 && (
                <div className="px-2 pt-2 pb-1">
                  <p className="px-2 pb-1 text-[9px] font-black uppercase tracking-widest" style={{ color: 'var(--ds-text-4)' }}>
                    {t('nav_rooms_section')} ({searchResults.allRooms.length})
                  </p>
                  {searchResults.allRooms.map((r, i) => (
                    <button key={r.id} onClick={() => { setAdvancedSearchOpen(false); goToRoom(r) }}
                      className="w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-colors text-left row-stagger-in"
                      style={{ color: 'var(--ds-text-1)', animationDelay: `${Math.min(i, 10) * 30}ms` }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--ds-bg-raised)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      <span className="material-symbols-outlined shrink-0" style={{ fontSize: 19, color: 'var(--ds-text-3)' }}>meeting_room</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-[14px] font-black truncate" title={r.name}><HighlightMatch text={r.name} query={q} /></p>
                        <p className="text-[11px] font-bold truncate mt-0.5" style={{ color: 'var(--ds-text-3)' }}>
                          {r.building?.code || r.building?.name}{r.floor ? ` · Lt ${r.floor}` : ''}{r.capacity ? ` · ${r.capacity} pax` : ''}
                        </p>
                      </div>
                      <span className={`text-[9px] font-black uppercase px-2 py-1 rounded-full shrink-0 ${r.status === 'active' ? 'bg-green-500/15 text-green-600' : 'bg-amber-500/15 text-amber-600'}`}>
                        {r.status}
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {searchResults.allBookings.length > 0 && (
                <div className={`px-2 pt-2 pb-1 ${searchResults.allRooms.length > 0 ? 'border-t' : ''}`} style={{ borderColor: 'var(--ds-border-sub)' }}>
                  <p className="px-2 pb-1 text-[9px] font-black uppercase tracking-widest" style={{ color: 'var(--ds-text-4)' }}>
                    {t('nav_bookings_section')} ({searchResults.allBookings.length})
                  </p>
                  {searchResults.allBookings.map((b, i) => {
                    const isOwn = b.user_id === user?.id
                    return (
                      <button key={b.id} onClick={() => { setAdvancedSearchOpen(false); goToBooking(b) }}
                        className="w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-colors text-left row-stagger-in"
                        style={{ color: 'var(--ds-text-1)', animationDelay: `${Math.min(searchResults.allRooms.length + i, 10) * 30}ms` }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'var(--ds-bg-raised)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                      >
                        {b.user && !isOwn
                          ? <UserAvatar name={b.user.name} avatar={b.user.avatar} size={28} style={{ flexShrink: 0 }} />
                          : (
                            <div className="shrink-0 flex items-center justify-center rounded-full" style={{ width: 28, height: 28, background: 'var(--ds-bg-raised)' }}>
                              <span className="material-symbols-outlined" style={{ fontSize: 16, color: 'var(--ds-text-3)' }}>event</span>
                            </div>
                          )
                        }
                        <div className="flex-1 min-w-0">
                          <p className="text-[14px] font-black truncate" title={b.title}><HighlightMatch text={b.title} query={q} /></p>
                          <div className="text-[11px] font-bold truncate mt-0.5" style={{ color: 'var(--ds-text-3)' }}>
                            {b.room?.name} · {fmtSearchDate(b.start_at, language)}, {fmtSearchTime(b.start_at)}–{fmtSearchTime(b.end_at)}
                            {b.user && (
                              <UserHoverCard name={b.user.name} userId={b.user_id} user={b.user}>
                                <span style={{ color: 'var(--ds-text-4)', cursor: 'default' }}>
                                  {' · '}{isOwn ? t('nav_search_you') : b.user.name}{b.user.department_name ? `/${b.user.department_name}` : ''}
                                </span>
                              </UserHoverCard>
                            )}
                          </div>
                        </div>
                        <span className={`text-[9px] font-black uppercase px-2 py-1 rounded-full shrink-0 ${b.status === 'confirmed' ? 'bg-[#adee2b] text-black' : 'bg-amber-500/15 text-amber-600'}`}>
                          {b.status}
                        </span>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
            </div>
          </div>
        </div>
      )}

    </>
  )
}
