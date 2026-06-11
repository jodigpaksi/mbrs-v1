import { useState, useRef, useEffect, useMemo, type ReactNode } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import * as XLSX from 'xlsx'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { Booking } from '../types/index'
import { getMyBookings, cancelBooking, clearCancelledBookings, getBookings, updateBooking } from '../api/bookings'
import { useAuth } from '../context/AuthContext'
import { useSettings } from '../context/SettingsContext'
import BookingPanel from '../components/booking/BookingPanel'

function parseLocal(iso: string) { return new Date(iso.replace('Z', '')) }
function dur(start: string, end: string) {
  const diff = (parseLocal(end).getTime() - parseLocal(start).getTime()) / 60000
  const h = Math.floor(diff / 60), m = diff % 60
  return h && m ? `${h}h ${m}m` : h ? `${h}h` : `${m}m`
}
function fmtTime(iso: string) {
  return parseLocal(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}
function fmtGroupLabel(iso: string) {
  const d = parseLocal(iso), today = new Date(), tomorrow = new Date()
  tomorrow.setDate(today.getDate() + 1)
  if (d.toDateString() === today.toDateString()) return 'Today'
  if (d.toDateString() === tomorrow.toDateString()) return 'Tomorrow'
  return d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).toUpperCase()
}
function fmtTableDate(iso: string) {
  return parseLocal(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
}
function fmtTableDay(iso: string) {
  return parseLocal(iso).toLocaleDateString('en-GB', { weekday: 'short' })
}
function groupByDate(bookings: Booking[]) {
  const groups: Record<string, Booking[]> = {}
  bookings.forEach(b => {
    const key = parseLocal(b.start_at).toDateString()
    if (!groups[key]) groups[key] = []
    groups[key].push(b)
  })
  return Object.entries(groups)
}
function isActuallyPast(b: Booking) {
  const today = new Date()
  return parseLocal(b.end_at) < new Date(today.getFullYear(), today.getMonth(), today.getDate())
}

const typeStyle: Record<string, { bg: string; text: string; label: string }> = {
  internal: { bg: '#dbeafe', text: '#1d4ed8', label: 'Internal' },
  external: { bg: '#ffedd5', text: '#c2410c', label: 'External' },
}

type Tab = 'today' | 'upcoming' | 'all' | 'past' | 'cancelled' | 'tentative'
type AllSortKey = 'start_at' | 'title' | 'room' | 'status' | 'type'
type AllSortDir = 'asc' | 'desc'

const TAB_META: Record<Tab, { color: string; indicatorColor: string }> = {
  today:     { color: 'text-black',        indicatorColor: '#000' },
  upcoming:  { color: 'text-black',        indicatorColor: '#000' },
  all:       { color: 'text-black',        indicatorColor: '#000' },
  past:      { color: 'text-slate-500',    indicatorColor: '#64748b' },
  cancelled: { color: 'text-red-500',      indicatorColor: '#ef4444' },
  tentative: { color: 'text-amber-500',    indicatorColor: '#f59e0b' },
}

const PRIMARY_TABS: Tab[] = ['today', 'upcoming', 'all']
const SECONDARY_TABS: Tab[] = ['past', 'cancelled', 'tentative']

const TAB_TOOLTIP: Partial<Record<Tab, string>> = {
  past: 'Last 30 days only',
  cancelled: 'Within ±7 days',
}

interface CardSharedProps {
  activeTab: Tab
  pendingCancelId: number | null
  exitingCancelId: number | null
  cancelling: number | null
  onEdit: (b: Booking) => void
  onCancel: (b: Booking) => void
  onTentativeAction?: (b: Booking) => void
}

function BookingCard({ b, index = 0, activeTab, pendingCancelId, exitingCancelId, cancelling, onEdit, onCancel, onTentativeAction }: { b: Booking; index?: number } & CardSharedProps) {
  const isConf = b.status === 'confirmed'
  const isCancelled = b.status === 'cancelled'
  const isTentative = b.status === 'tentative'
  const isPast = isActuallyPast(b)
  const isPastTab = activeTab === 'past'
  const isPending = pendingCancelId === b.id
  const isExiting = exitingCancelId === b.id
  const canEdit = !isPast && !isCancelled
  const tStyle = typeStyle[b.type] || typeStyle.internal

  const cardBg = isCancelled ? 'bg-red-50 border border-red-100'
    : isTentative ? 'bg-amber-50 border border-amber-100'
    : isConf ? 'bg-[#adee2b]' : ''
  const titleClr = isPastTab ? 'text-slate-500' : isCancelled ? 'text-red-700' : isTentative ? 'text-amber-700' : isConf ? 'text-black' : 'text-slate-700'
  const loc  = isPastTab ? 'text-slate-300' : isCancelled ? 'text-red-400' : isTentative ? 'text-amber-500' : isConf ? 'text-black/50' : 'text-slate-400'
  const desc = isPastTab ? 'text-slate-300' : isCancelled ? 'text-red-300' : isTentative ? 'text-amber-400/70' : isConf ? 'text-black/40' : 'text-slate-400'
  const t1   = isPastTab ? 'text-slate-400' : isCancelled ? 'text-red-400' : isTentative ? 'text-amber-600' : isConf ? 'text-black/80' : 'text-slate-500'
  const t2   = isPastTab ? 'text-slate-300' : isCancelled ? 'text-red-300' : isTentative ? 'text-amber-400' : isConf ? 'text-black/50' : 'text-slate-400'
  const td   = isPastTab ? 'text-slate-200' : isCancelled ? 'text-red-200' : isTentative ? 'text-amber-300' : isConf ? 'text-black/30' : 'text-slate-300'
  const badge = isPastTab ? 'bg-slate-100 text-slate-400'
    : isCancelled ? 'bg-red-200 text-red-600' : isTentative ? 'bg-amber-200 text-amber-700'
    : isPast ? 'bg-slate-200 text-slate-400' : isConf ? 'bg-black text-[#adee2b]' : 'bg-slate-100 text-slate-500'

  const baseCardStyle = (!isCancelled && !isTentative && !isConf)
    ? { background: 'var(--ds-bg-surface)', border: '1px solid var(--ds-border-sub)' }
    : {}

  return (
    <div
      onClick={() => { if (canEdit) { if (isTentative && onTentativeAction) onTentativeAction(b); else onEdit(b) } }}
      className={`rounded-2xl p-5 group ${cardBg} ${canEdit ? 'cursor-pointer hover:-translate-y-0.5 hover:shadow-md' : ''}`}
      style={{
        ...baseCardStyle,
        animation: `card-in 0.25s cubic-bezier(0.4,0,0.2,1) ${index * 45}ms both`,
        opacity: isExiting ? 0 : isPending ? 0.3 : 1,
        transform: isExiting ? 'scale(0.95)' : isPending ? 'scale(0.98)' : undefined,
        outline: isPending ? '2px solid #fca5a5' : 'none',
        outlineOffset: -2,
        transition: 'opacity 0.35s ease, transform 0.35s ease, box-shadow 0.2s',
      }}
    >
      <div className="flex items-center gap-2 mb-3">
        <span className={`text-[9px] font-black uppercase px-2.5 py-1 rounded-full ${badge}`}>{b.status}</span>
        <span className="text-[9px] font-black uppercase px-2.5 py-1 rounded-full"
          style={{ backgroundColor: tStyle.bg, color: tStyle.text }}>{tStyle.label}</span>
      </div>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h4 className={`text-base font-black uppercase tracking-tight leading-tight ${titleClr}`}>{b.title}</h4>
          <p className={`text-xs font-bold mt-2 flex items-center gap-1 ${loc}`}>
            <span className="material-symbols-outlined text-sm">location_on</span>{b.room?.name}
          </p>
          {b.description && <p className={`text-xs font-medium mt-1.5 leading-relaxed line-clamp-2 ${desc}`}>{b.description}</p>}
        </div>
        <div className="text-right shrink-0">
          <p className={`text-2xl font-black tabular-nums leading-none ${t1}`}>{fmtTime(b.start_at)}</p>
          <p className={`text-sm font-bold mt-1 ${t2}`}>{fmtTime(b.end_at)}</p>
          <p className={`text-[10px] font-bold mt-0.5 ${td}`}>{dur(b.start_at, b.end_at)}</p>
        </div>
      </div>
      {canEdit && (
        <div className={`flex items-center justify-between mt-4 pt-3 border-t ${isConf ? 'border-black/10' : 'border-slate-100'}`}>
          <span className="text-[9px] font-black uppercase tracking-wider flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity text-black/40">
            <span className="material-symbols-outlined" style={{ fontSize: 12 }}>{isTentative ? 'tune' : 'edit'}</span>{isTentative ? 'Click to manage' : 'Click to edit'}
          </span>
          <button onClick={e => { e.stopPropagation(); onCancel(b) }} disabled={cancelling === b.id}
            className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase transition-all disabled:opacity-40
              ${isConf ? 'bg-black/10 text-black/50 hover:bg-black hover:text-[#adee2b]' : 'bg-slate-100 text-slate-400 hover:bg-red-50 hover:text-red-500'}`}>
            {cancelling === b.id ? '...' : 'Cancel'}
          </button>
        </div>
      )}
    </div>
  )
}

function BookingListItem({ b, index = 0, activeTab, pendingCancelId, exitingCancelId, cancelling, onEdit, onCancel, onTentativeAction }: { b: Booking; index?: number } & CardSharedProps) {
  const isConf = b.status === 'confirmed'
  const isCancelled = b.status === 'cancelled'
  const isTentative = b.status === 'tentative'
  const isPast = isActuallyPast(b)
  const isPastTab = activeTab === 'past'
  const isPending = pendingCancelId === b.id
  const isExiting = exitingCancelId === b.id
  const canEdit = !isPast && !isCancelled
  const tStyle = typeStyle[b.type] || typeStyle.internal

  const rowBg = isCancelled ? 'bg-red-50 border-red-100'
    : isTentative ? 'bg-amber-50 border-amber-100'
    : isConf ? 'bg-[#adee2b] border-transparent' : ''
  const dot     = isPastTab ? 'bg-slate-300' : isCancelled ? 'bg-red-400' : isTentative ? 'bg-amber-400' : isConf ? 'bg-black' : 'bg-slate-400'
  const titleClr = isPastTab ? 'text-slate-500' : isCancelled ? 'text-red-700' : isTentative ? 'text-amber-700' : isConf ? 'text-black' : 'text-slate-700'
  const subClr  = isPastTab ? 'text-slate-300' : isCancelled ? 'text-red-400' : isTentative ? 'text-amber-500' : isConf ? 'text-black/50' : 'text-slate-400'
  const timeClr = isPastTab ? 'text-slate-400' : isCancelled ? 'text-red-400' : isTentative ? 'text-amber-600' : isConf ? 'text-black/80' : 'text-slate-700'

  return (
    <div
      onClick={() => { if (canEdit) { if (isTentative && onTentativeAction) onTentativeAction(b); else onEdit(b) } }}
      className={`flex items-center gap-4 px-4 py-3 rounded-2xl border ${rowBg} ${canEdit ? 'cursor-pointer hover:shadow-sm' : ''}`}
      style={{
        ...(!isCancelled && !isTentative && !isConf ? { background: 'var(--ds-bg-surface)', borderColor: 'var(--ds-border-sub)' } : {}),
        animation: `card-in 0.22s cubic-bezier(0.4,0,0.2,1) ${index * 35}ms both`,
        opacity: isExiting ? 0 : isPending ? 0.3 : 1,
        transform: isExiting ? 'scale(0.97) translateY(4px)' : undefined,
        outline: isPending ? '2px solid #fca5a5' : 'none',
        outlineOffset: -2,
        transition: 'opacity 0.35s ease, transform 0.35s ease, box-shadow 0.15s',
      }}
    >
      <div className={`size-2.5 rounded-full shrink-0 ${dot}`} />
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 min-w-0">
          <span className={`text-[13px] font-black uppercase leading-tight shrink-0 ${titleClr}`}>{b.title}</span>
          <span className={`text-[10px] font-bold truncate ${subClr}`}>{b.room?.name}</span>
        </div>
        {b.description && <p className={`text-[10px] font-medium truncate mt-0.5 ${subClr}`}>{b.description}</p>}
      </div>
      <span className="text-[8px] font-black uppercase px-2 py-0.5 rounded-full shrink-0"
        style={{ backgroundColor: tStyle.bg, color: tStyle.text }}>{tStyle.label}</span>
      <div className={`text-[11px] font-bold text-right shrink-0 leading-tight ${subClr}`}>
        <p>{fmtTableDate(b.start_at)}</p>
        <p className="opacity-60">{fmtTableDay(b.start_at)}</p>
      </div>
      <div className={`text-[12px] font-black tabular-nums shrink-0 ${timeClr}`}>
        {fmtTime(b.start_at)}–{fmtTime(b.end_at)}
      </div>
      {canEdit ? (
        <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
          <button onClick={() => { if (isTentative && onTentativeAction) onTentativeAction(b); else onEdit(b) }}
            className={`size-7 flex items-center justify-center rounded-lg transition-all ${isConf ? 'bg-black/10 text-black/60 hover:bg-black hover:text-[#adee2b]' : 'bg-slate-100 text-slate-400 hover:bg-black hover:text-[#adee2b]'}`}>
            <span className="material-symbols-outlined" style={{ fontSize: 13 }}>{isTentative ? 'tune' : 'edit'}</span>
          </button>
          <button onClick={() => onCancel(b)}
            className="size-7 flex items-center justify-center rounded-lg bg-slate-100/60 text-slate-400 hover:bg-red-50 hover:text-red-500 transition-all">
            <span className="material-symbols-outlined" style={{ fontSize: 13 }}>cancel</span>
          </button>
        </div>
      ) : <div className="w-[62px] shrink-0" />}
    </div>
  )
}

function SlideWrapper({ exiting, children }: { exiting: boolean; children: ReactNode }) {
  const wrapRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = wrapRef.current
    if (!el || !exiting) return
    const h = el.scrollHeight
    el.style.height = `${h}px`
    el.style.overflow = 'hidden'
    el.getBoundingClientRect() // force reflow so transition fires
    el.style.transition = 'height 0.32s cubic-bezier(0.4,0,0.2,1)'
    el.style.height = '0'
  }, [exiting])
  return <div ref={wrapRef}>{children}</div>
}

export default function SchedulePage() {
  const { user } = useAuth()
  const { t } = useSettings()
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState<Tab>('today')
  const [editBooking, setEditBooking] = useState<Booking | null>(null)
  const [panelOpen, setPanelOpen] = useState(false)
  const [cancelling, setCancelling] = useState<number | null>(null)
  const [cancelTarget, setCancelTarget] = useState<Booking | null>(null)
  const [clearConfirm, setClearConfirm] = useState(false)
  const [viewMode, setViewMode] = useState<'card' | 'list'>('card')
  const [pendingCancelId, setPendingCancelId] = useState<number | null>(null)
  const [exitingCancelId, setExitingCancelId] = useState<number | null>(null)
  const [descTooltip, setDescTooltip] = useState<{ text: string; x: number; y: number } | null>(null)
  const [toastMsg, setToastMsg] = useState<string | null>(null)
  const [toastCountdown, setToastCountdown] = useState<number | null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const cancelTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const cancelIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [allSortKey, setAllSortKey] = useState<AllSortKey>('start_at')
  const [allSortDir, setAllSortDir] = useState<AllSortDir>('asc')
  const [allSearch, setAllSearch] = useState('')
  const [tentativeTarget, setTentativeTarget] = useState<Booking | null>(null)
  const [tentativeConfirming, setTentativeConfirming] = useState(false)

  function toggleAllSort(key: AllSortKey) {
    if (allSortKey === key) setAllSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setAllSortKey(key); setAllSortDir('desc') }
  }

  const tabRefs = useRef<(HTMLButtonElement | null)[]>([])
  const [indicator, setIndicator] = useState({ left: 0, width: 0 })

  const { data: myBookings = [], isLoading } = useQuery({
    queryKey: ['my-bookings'],
    queryFn: getMyBookings,
  })

  const { data: allMyBookings = [], isLoading: loadingAll } = useQuery({
    queryKey: ['all-my-bookings', user?.id],
    queryFn: () => getBookings({ user_id: user?.id }),
    enabled: !!user?.id,
  })

  const today = new Date()
  const minus7 = new Date(today); minus7.setDate(today.getDate() - 7)
  const plus7 = new Date(today); plus7.setDate(today.getDate() + 7)
  const past30 = new Date(today); past30.setDate(today.getDate() - 30)

  const todayList: Booking[]     = myBookings.filter((b: Booking) => parseLocal(b.start_at).toDateString() === today.toDateString())
  const upcomingList: Booking[]  = myBookings.filter((b: Booking) => parseLocal(b.start_at) > today)
  const allList: Booking[] = useMemo(() => {
    const upcoming = myBookings.filter((b: Booking) => !isActuallyPast(b))
    const past = myBookings.filter((b: Booking) => isActuallyPast(b))
    function sortFn(a: Booking, b: Booking) {
      if (allSortKey === 'start_at') return allSortDir === 'desc'
        ? parseLocal(b.start_at).getTime() - parseLocal(a.start_at).getTime()
        : parseLocal(a.start_at).getTime() - parseLocal(b.start_at).getTime()
      let va = '', vb = ''
      if (allSortKey === 'title') { va = a.title; vb = b.title }
      else if (allSortKey === 'room') { va = a.room?.name ?? ''; vb = b.room?.name ?? '' }
      else if (allSortKey === 'status') { va = a.status; vb = b.status }
      else if (allSortKey === 'type') { va = a.type; vb = b.type }
      return allSortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va)
    }
    return [...upcoming.sort(sortFn), ...past.sort(sortFn)]
  }, [myBookings, allSortKey, allSortDir])
  const pastList: Booking[]      = myBookings.filter((b: Booking) => isActuallyPast(b) && parseLocal(b.start_at) >= past30).sort((a: Booking, b: Booking) => parseLocal(b.start_at).getTime() - parseLocal(a.start_at).getTime())
  const cancelledList: Booking[] = (allMyBookings as Booking[]).filter((b: Booking) => b.status === 'cancelled' && b.cancelled_at && parseLocal(b.cancelled_at) >= minus7).sort((a: Booking, b: Booking) => parseLocal(b.start_at).getTime() - parseLocal(a.start_at).getTime())
  const tentativeList: Booking[] = myBookings.filter((b: Booking) => b.status === 'tentative').sort((a: Booking, b: Booking) => parseLocal(a.start_at).getTime() - parseLocal(b.start_at).getTime())

  const thisMonthCount = myBookings.filter((b: Booking) => {
    const d = parseLocal(b.start_at)
    return d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear()
  }).length

  const totalHours = myBookings.filter((b: Booking) => {
    const d = parseLocal(b.start_at)
    return d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear()
  }).reduce((acc: number, b: Booking) =>
    acc + (parseLocal(b.end_at).getTime() - parseLocal(b.start_at).getTime()) / 3600000, 0
  )

  const tabCounts: Record<Tab, number> = {
    today: todayList.length, upcoming: upcomingList.length, all: allList.length,
    past: pastList.length, cancelled: cancelledList.length, tentative: tentativeList.length,
  }

  const tabLabels: Record<Tab, string> = {
    today: t('tab_today'), upcoming: t('tab_upcoming'), all: t('tab_all'),
    past: t('tab_past'), cancelled: t('tab_cancelled'), tentative: t('tab_tentative'),
  }

  const allTabsOrdered: Tab[] = [...PRIMARY_TABS, ...SECONDARY_TABS]

  useEffect(() => {
    const idx = allTabsOrdered.indexOf(activeTab)
    const el = tabRefs.current[idx]
    if (el) setIndicator({ left: el.offsetLeft, width: el.offsetWidth })
  }, [activeTab])

  function handleCancel(b: Booking) {
    setCancelTarget(b)
  }

  function confirmCancel() {
    if (!cancelTarget) return
    const booking = cancelTarget
    setCancelTarget(null)
    setPendingCancelId(booking.id)

    let count = 5
    setToastMsg(`"${booking.title}" cancelled`)
    setToastCountdown(count)
    if (cancelIntervalRef.current) clearInterval(cancelIntervalRef.current)
    if (cancelTimerRef.current) clearTimeout(cancelTimerRef.current)

    cancelIntervalRef.current = setInterval(() => {
      count -= 1
      setToastCountdown(count)
    }, 1000)

    cancelTimerRef.current = setTimeout(() => {
      clearInterval(cancelIntervalRef.current!)
      setToastCountdown(null)
      setToastMsg(null)
      // Phase 1: start exit animation
      setExitingCancelId(booking.id)
      // Phase 2: after transition completes, do the actual remove
      setTimeout(async () => {
        setExitingCancelId(null)
        setPendingCancelId(null)
        await cancelBooking(booking.id)
        queryClient.invalidateQueries({ queryKey: ['my-bookings'] })
        queryClient.invalidateQueries({ queryKey: ['all-my-bookings', user?.id] })
        queryClient.invalidateQueries({ queryKey: ['bookings'] })
      }, 380)
    }, 5000)
  }

  function undoCancel() {
    if (cancelTimerRef.current) clearTimeout(cancelTimerRef.current)
    if (cancelIntervalRef.current) clearInterval(cancelIntervalRef.current)
    setToastMsg(null)
    setToastCountdown(null)
    setPendingCancelId(null)
    setExitingCancelId(null)
  }

  async function handleTentativeAction(action: 'confirm' | 'cancel') {
    if (!tentativeTarget) return
    const booking = tentativeTarget
    setTentativeTarget(null)
    setTentativeConfirming(true)
    try {
      if (action === 'confirm') await updateBooking(booking.id, { status: 'confirmed' })
      else if (action === 'cancel') await cancelBooking(booking.id)
      queryClient.invalidateQueries({ queryKey: ['my-bookings'] })
      queryClient.invalidateQueries({ queryKey: ['all-my-bookings', user?.id] })
    } finally { setTentativeConfirming(false) }
  }

  async function doClearCancelled() {
    setClearConfirm(false)
    await clearCancelledBookings()
    queryClient.invalidateQueries({ queryKey: ['my-bookings'] })
    queryClient.invalidateQueries({ queryKey: ['all-my-bookings', user?.id] })
    setToastMsg('Cancelled bookings cleared')
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToastMsg(null), 3500)
  }

  const upcomingInAll = allList.filter((b: Booking) => !isActuallyPast(b))
  const pastInAll     = allList.filter((b: Booking) => isActuallyPast(b))
  const pastPreview   = pastInAll.slice(0, 5)
  const allListForDisplay = [...upcomingInAll, ...pastPreview]
  const allListFiltered = useMemo(() => {
    if (!allSearch.trim()) return allListForDisplay
    const q = allSearch.toLowerCase()
    return allListForDisplay.filter((b: Booking) =>
      b.title.toLowerCase().includes(q) ||
      b.room?.name?.toLowerCase().includes(q) ||
      b.description?.toLowerCase().includes(q) ||
      b.type.toLowerCase().includes(q) ||
      b.status.toLowerCase().includes(q)
    )
  }, [allListForDisplay, allSearch])

  function exportExcel() {
    const rows = upcomingInAll.map((b: Booking) => ({
      Date: fmtTableDate(b.start_at), Day: fmtTableDay(b.start_at),
      'Start Time': fmtTime(b.start_at), 'End Time': fmtTime(b.end_at),
      Duration: dur(b.start_at, b.end_at), Room: b.room?.name ?? '',
      Floor: b.room?.floor ?? '', Title: b.title,
      Description: b.description ?? '', Status: b.status, Type: b.type,
    }))
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'My Bookings')
    XLSX.writeFile(wb, `bookings-${user?.name?.replace(' ', '-').toLowerCase()}.xlsx`)
  }

  function exportPDF() {
    const doc = new jsPDF()
    doc.setFontSize(14); doc.text(`My Bookings — ${user?.name}`, 14, 16)
    doc.setFontSize(9); doc.setTextColor(150)
    doc.text(`${user?.department} · Exported ${today.toLocaleDateString('en-GB')}`, 14, 22)
    autoTable(doc, {
      startY: 28,
      head: [['Date', 'Day', 'Time', 'Room', 'Title', 'Status']],
      body: upcomingInAll.map((b: Booking) => [
        fmtTableDate(b.start_at), fmtTableDay(b.start_at),
        `${fmtTime(b.start_at)} – ${fmtTime(b.end_at)}`,
        b.room?.name ?? '', b.title, b.status,
      ]),
      styles: { fontSize: 8, cellPadding: 3 },
      headStyles: { fillColor: [0, 0, 0], textColor: [173, 238, 43], fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 250, 252] },
    })
    doc.save(`bookings-${user?.name?.replace(' ', '-').toLowerCase()}.pdf`)
  }

  function getActiveList(): Booking[] {
    if (activeTab === 'today') return todayList
    if (activeTab === 'upcoming') return upcomingList
    if (activeTab === 'all') return allList
    if (activeTab === 'past') return pastList
    if (activeTab === 'cancelled') return cancelledList
    return tentativeList
  }

  const activeList = getActiveList()
  const grouped = groupByDate(activeList)
  const meta = TAB_META[activeTab]
  const isSecondary = SECONDARY_TABS.includes(activeTab)

  const cardSharedProps: CardSharedProps = {
    activeTab,
    pendingCancelId,
    exitingCancelId,
    cancelling,
    onEdit: (b) => { setEditBooking(b); setPanelOpen(true) },
    onCancel: handleCancel,
    onTentativeAction: (b) => setTentativeTarget(b),
  }

  return (
    <div className="flex flex-col flex-1 overflow-hidden" style={{ background: 'var(--ds-bg-surface)' }}>
      <style>{`@keyframes card-in{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}`}</style>

      {/* Top header */}
      <div className="px-8 pt-6 shrink-0" style={{ background: 'var(--ds-bg-surface)', borderBottom: '1px solid var(--ds-border-sub)' }}>
        <div className="flex items-start justify-between mb-5">
          <div>
            <h2 className="text-3xl font-black tracking-tighter uppercase leading-none" style={{ color: 'var(--ds-text-1)' }}>{user?.name}</h2>
            <p className="text-sm font-bold mt-1.5" style={{ color: 'var(--ds-text-3)' }}>{user?.department} &middot; Ext. {user?.ext}</p>
          </div>
          <button
            onClick={() => { setEditBooking(null); setPanelOpen(true) }}
            className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-[10px] font-black uppercase shadow-lg shadow-lime-300/30 transition-all duration-200 bg-[#adee2b] text-black hover:bg-black hover:text-[#adee2b]"
          >
            <span className="material-symbols-outlined text-base">add</span>
            New Booking
          </button>
        </div>

        {/* Tabs */}
        <div className="relative flex items-end">
          {/* Primary tabs */}
          <div className="flex items-end gap-6">
            {PRIMARY_TABS.map((key, i) => (
              <button key={key} ref={el => { tabRefs.current[i] = el }}
                onClick={() => setActiveTab(key)}
                className="flex items-center gap-2 pb-3 text-[13px] font-black uppercase tracking-wide transition-colors duration-200"
                style={{ color: activeTab === key ? 'var(--ds-text-1)' : 'var(--ds-text-3)' }}>
                {tabLabels[key]}
                {tabCounts[key] > 0 && (
                  <span className="text-[9px] font-black px-2 py-0.5 rounded-full transition-colors"
                    style={{ background: activeTab === key ? 'var(--ds-text-1)' : 'var(--ds-bg-raised)', color: activeTab === key ? 'var(--ds-bg-surface)' : 'var(--ds-text-3)' }}>
                    {tabCounts[key]}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Divider */}
          <div className="mx-5 mb-3 w-px h-4 bg-slate-200 self-end" />

          {/* Secondary tabs */}
          <div className="flex items-end gap-5">
            {SECONDARY_TABS.map((key, i) => {
              const m = TAB_META[key]
              const tabTip = TAB_TOOLTIP[key]
              return (
                <button key={key} ref={el => { tabRefs.current[PRIMARY_TABS.length + i] = el }}
                  onClick={() => setActiveTab(key)}
                  className={`relative group/stab flex items-center gap-2 pb-3 text-[12px] font-black uppercase tracking-wide transition-colors duration-200
                    ${activeTab === key ? m.color : 'text-slate-300 hover:text-slate-400'}`}>
                  {tabLabels[key]}
                  {tabCounts[key] > 0 && (
                    <span className={`text-[9px] font-black px-2 py-0.5 rounded-full transition-colors
                      ${activeTab === key
                        ? key === 'cancelled' ? 'bg-red-100 text-red-500'
                          : key === 'tentative' ? 'bg-amber-100 text-amber-600'
                          : 'bg-slate-200 text-slate-500'
                        : 'bg-slate-100 text-slate-300'}`}>
                      {tabCounts[key]}
                    </span>
                  )}
                  {tabTip && (
                    <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1.5 bg-slate-900 text-white text-[9px] font-bold rounded-lg whitespace-nowrap opacity-0 group-hover/stab:opacity-100 pointer-events-none transition-opacity z-50 shadow-xl">
                      {tabTip}
                    </span>
                  )}
                </button>
              )
            })}
          </div>

          {/* View toggle */}
          <div className={`ml-auto mb-2.5 flex gap-0.5 bg-slate-100 rounded-xl p-1 shrink-0 ${activeTab === 'all' ? 'opacity-35' : ''}`}>
            <button
              onClick={() => activeTab !== 'all' && setViewMode('card')}
              title="Card view"
              className={`size-8 flex items-center justify-center rounded-lg transition-all ${viewMode === 'card' ? 'bg-white shadow text-slate-800' : 'text-slate-400 hover:text-slate-600'}`}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 17 }}>grid_view</span>
            </button>
            <button
              onClick={() => activeTab !== 'all' && setViewMode('list')}
              title="List view"
              className={`size-8 flex items-center justify-center rounded-lg transition-all ${viewMode === 'list' ? 'bg-white shadow text-slate-800' : 'text-slate-400 hover:text-slate-600'}`}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 17 }}>view_list</span>
            </button>
          </div>

          {/* Animated indicator */}
          <div
            className="absolute bottom-0 h-0.5 rounded-full transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] pointer-events-none"
            style={{ left: indicator.left, width: indicator.width, backgroundColor: meta.indicatorColor }}
          />
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">

        {/* Main content */}
        <div className="flex-1 overflow-y-auto px-8 py-6 bg-slate-50" style={{ scrollbarWidth: 'thin' }}>
          {(isLoading || loadingAll) ? (
            <div className="flex items-center justify-center h-full">
              <span className="material-symbols-outlined animate-spin text-4xl text-slate-300">progress_activity</span>
            </div>
          ) : activeList.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-slate-300">
              <span className="material-symbols-outlined text-5xl">
                {activeTab === 'cancelled' ? 'cancel' : activeTab === 'tentative' ? 'pending' : activeTab === 'past' ? 'history' : 'calendar_month'}
              </span>
              <p className="text-sm font-black uppercase">
                {activeTab === 'today' ? 'No bookings today'
                  : activeTab === 'upcoming' ? 'No upcoming bookings'
                  : activeTab === 'past' ? 'No past bookings (last 30 days)'
                  : activeTab === 'cancelled' ? 'No cancelled bookings (±7 days)'
                  : activeTab === 'tentative' ? 'No tentative bookings'
                  : 'No bookings yet'}
              </p>
            </div>
          ) : activeTab === 'all' ? (
            <>
              {/* Search */}
              <div className="relative mb-3">
                <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none" style={{ fontSize: 18 }}>search</span>
                <input
                  type="text"
                  placeholder="Search by title, room, type, status..."
                  value={allSearch}
                  onChange={e => setAllSearch(e.target.value)}
                  className={`w-full pl-10 pr-4 py-2.5 bg-slate-50 border rounded-2xl text-[12px] font-bold focus:outline-none focus:ring-2 focus:ring-[#adee2b] focus:border-transparent transition-all
                    ${allSearch ? 'border-[#adee2b] bg-[#f7fee7]' : 'border-slate-200'}`}
                />
                {allSearch && (
                  <button onClick={() => setAllSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 size-6 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-white transition-colors">
                    <span className="material-symbols-outlined text-sm">close</span>
                  </button>
                )}
              </div>
              <div className="flex items-center justify-between mb-4">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  {allSearch ? `${allListFiltered.length} result${allListFiltered.length !== 1 ? 's' : ''}` : `${upcomingInAll.length} upcoming${pastInAll.length > 0 ? ` · ${pastInAll.length} past` : ''}`}
                </p>
                <div className="flex gap-2">
                  <button onClick={exportExcel}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-[10px] font-black uppercase border border-slate-200 bg-white hover:border-green-400 hover:text-green-600 hover:bg-green-50 transition-all">
                    <span className="material-symbols-outlined text-sm">table_view</span>Export Excel
                  </button>
                  <button onClick={exportPDF}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-[10px] font-black uppercase border border-slate-200 bg-white hover:border-red-400 hover:text-red-600 hover:bg-red-50 transition-all">
                    <span className="material-symbols-outlined text-sm">picture_as_pdf</span>Export PDF
                  </button>
                </div>
              </div>
              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-slate-900 border-b border-slate-700">
                      {([
                        { label: 'Date', key: 'start_at' },
                        { label: 'Day', key: null },
                        { label: 'Time', key: null },
                        { label: 'Room', key: 'room' },
                        { label: 'Title', key: 'title' },
                        { label: 'Description', key: null },
                        { label: 'Status', key: 'status' },
                        { label: 'Type', key: 'type' },
                        { label: '', key: null },
                      ] as { label: string; key: AllSortKey | null }[]).map((h, i) => (
                        <th key={i} className="px-4 py-3.5 text-left whitespace-nowrap">
                          {h.key ? (
                            <button onClick={() => toggleAllSort(h.key!)}
                              className="flex items-center gap-1 text-[11px] font-black uppercase tracking-widest transition-colors"
                              style={{ color: allSortKey === h.key ? '#adee2b' : '#94a3b8' }}>
                              {h.label}
                              <span className="material-symbols-outlined" style={{ fontSize: 12, color: allSortKey === h.key ? '#adee2b' : '#64748b' }}>
                                {allSortKey === h.key ? (allSortDir === 'asc' ? 'arrow_upward' : 'arrow_downward') : 'unfold_more'}
                              </span>
                            </button>
                          ) : (
                            <span className="text-[11px] font-black uppercase tracking-widest text-slate-400">{h.label}</span>
                          )}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {allListFiltered.map((b: Booking, i: number) => {
                      const isPast = isActuallyPast(b)
                      const prevIsActive = i > 0 && !isActuallyPast(allListFiltered[i - 1])
                      const isFirstPast = isPast && prevIsActive
                      const isConf = b.status === 'confirmed'
                      const tStyle = typeStyle[b.type] || typeStyle.internal
                      return (
                        <>
                          {isFirstPast && (
                            <tr key={`divider-${b.id}`} className="bg-slate-100">
                              <td colSpan={9} className="px-4 py-2">
                                <div className="flex items-center gap-3">
                                  <span className="material-symbols-outlined text-slate-400" style={{ fontSize: 14 }}>history</span>
                                  <span className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">Past Bookings</span>
                                  <div className="flex-1 h-px bg-slate-300" />
                                </div>
                              </td>
                            </tr>
                          )}
                          <tr key={b.id}
                          onClick={() => { if (!isPast) { setEditBooking(b); setPanelOpen(true) } }}
                          className={`border-b border-slate-50 transition-colors
                            ${isPast ? 'opacity-40' : 'hover:bg-[#f7fee7] cursor-pointer'}
                            ${i % 2 !== 0 ? 'bg-slate-50/50' : ''}`}
                        >
                          <td className="px-4 py-3 text-xs font-black text-slate-700 whitespace-nowrap">{fmtTableDate(b.start_at)}</td>
                          <td className="px-4 py-3 text-xs font-bold text-slate-400 whitespace-nowrap">{fmtTableDay(b.start_at)}</td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <p className="text-sm font-black text-slate-800 tabular-nums">{fmtTime(b.start_at)} &ndash; {fmtTime(b.end_at)}</p>
                            <p className="text-[10px] font-bold text-slate-400 mt-0.5">{dur(b.start_at, b.end_at)}</p>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <p className="text-xs font-bold text-slate-600">{b.room?.name}</p>
                            <p className="text-[9px] font-bold text-slate-300">{b.room?.floor}</p>
                          </td>
                          <td className="px-4 py-3 text-xs font-black text-slate-800 max-w-[160px] truncate">{b.title}</td>
                          <td className="px-4 py-3 max-w-[200px]"
                            onMouseEnter={e => b.description && setDescTooltip({ text: b.description, x: e.clientX, y: e.clientY })}
                            onMouseMove={e => b.description && setDescTooltip(prev => prev ? { ...prev, x: e.clientX, y: e.clientY } : null)}
                            onMouseLeave={() => setDescTooltip(null)}
                          >
                            {b.description
                              ? <span className="text-xs text-slate-400 truncate block max-w-[180px] cursor-default">{b.description}</span>
                              : <span className="text-slate-200 text-xs">&mdash;</span>
                            }
                          </td>
                          <td className="px-4 py-3">
                            <span className={`text-[8px] font-black uppercase px-2.5 py-1 rounded-full whitespace-nowrap
                              ${isConf ? 'bg-[#adee2b] text-black' : 'bg-slate-100 text-slate-500'}`}>
                              {b.status}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-[8px] font-black uppercase px-2.5 py-1 rounded-full whitespace-nowrap"
                              style={{ backgroundColor: tStyle.bg, color: tStyle.text }}>
                              {tStyle.label}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            {!isPast && (
                              <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                                <button onClick={() => { setEditBooking(b); setPanelOpen(true) }} title="Edit"
                                  className="size-7 flex items-center justify-center rounded-lg bg-slate-100 text-slate-500 hover:bg-black hover:text-[#adee2b] transition-all">
                                  <span className="material-symbols-outlined" style={{ fontSize: 14 }}>edit</span>
                                </button>
                                <button onClick={() => handleCancel(b)} disabled={cancelling === b.id} title="Cancel"
                                  className="size-7 flex items-center justify-center rounded-lg bg-slate-100 text-slate-500 hover:bg-red-50 hover:text-red-500 transition-all disabled:opacity-40">
                                  <span className="material-symbols-outlined" style={{ fontSize: 14 }}>
                                    {cancelling === b.id ? 'progress_activity' : 'cancel'}
                                  </span>
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                        </>
                      )
                    })}
                    {pastInAll.length > 5 && (
                      <tr>
                        <td colSpan={9} className="px-4 py-3 bg-slate-50/70">
                          <button
                            onClick={() => setActiveTab('past')}
                            className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-700 transition-colors group/more"
                          >
                            <span className="material-symbols-outlined group-hover/more:text-black transition-colors" style={{ fontSize: 14 }}>history</span>
                            Show {pastInAll.length - 5} more past booking{pastInAll.length - 5 !== 1 ? 's' : ''} →
                          </button>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <div className="space-y-8">
              {isSecondary && activeTab === 'cancelled' && (
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                    Cancelled bookings within &plusmn;7 days
                  </p>
                  {cancelledList.length > 0 && (
                    <button
                      onClick={() => setClearConfirm(true)}
                      className="flex items-center gap-2 text-[11px] font-black uppercase tracking-wide text-red-400 hover:text-red-600 transition-colors px-3.5 py-2 rounded-xl border border-red-100 hover:border-red-200 hover:bg-red-50"
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: 16 }}>delete_sweep</span>
                      Clear All
                    </button>
                  )}
                </div>
              )}
              {grouped.map(([dateKey, bookings]) => (
                <div key={dateKey}>
                  <div className="flex items-center gap-3 mb-3">
                    <p className={`text-[10px] font-black uppercase tracking-[0.2em] whitespace-nowrap
                      ${activeTab === 'cancelled' ? 'text-red-400'
                        : activeTab === 'tentative' ? 'text-amber-400'
                        : 'text-slate-400'}`}>
                      {fmtGroupLabel(bookings[0].start_at)}
                    </p>
                    <div className={`flex-1 h-px
                      ${activeTab === 'cancelled' ? 'bg-red-100'
                        : activeTab === 'tentative' ? 'bg-amber-100'
                        : 'bg-slate-200'}`} />
                    <span className="text-[9px] font-black text-slate-300">{bookings.length}</span>
                  </div>
                  {viewMode === 'card' ? (
                    <div className="flex gap-3">
                      {([0, 1] as const).map(col => (
                        <div key={col} className="flex-1 flex flex-col gap-3">
                          {bookings
                            .filter((_, i) => i % 2 === col)
                            .map((b, colIdx) => (
                              <SlideWrapper key={b.id} exiting={exitingCancelId === b.id}>
                                <BookingCard b={b} index={colIdx * 2 + col} {...cardSharedProps} />
                              </SlideWrapper>
                            ))}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div>
                      {bookings.map((b, idx) => (
                        <SlideWrapper key={b.id} exiting={exitingCancelId === b.id}>
                          <div style={{ paddingBottom: idx < bookings.length - 1 ? 8 : 0 }}>
                            <BookingListItem b={b} index={idx} {...cardSharedProps} />
                          </div>
                        </SlideWrapper>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right sidebar */}
        <div className="w-44 flex flex-col shrink-0 p-4 gap-2.5 overflow-y-auto" style={{ borderLeft: '1px solid var(--ds-border-sub)', background: 'var(--ds-bg-surface)', scrollbarWidth: 'none' }}>
          <p className="text-[8px] font-black uppercase tracking-widest mb-1" style={{ color: 'var(--ds-text-4)' }}>Overview</p>
          {([
            { label: 'This Month', value: String(thisMonthCount).padStart(2, '0'), sub: 'bookings', icon: 'calendar_month', accent: true },
            { label: 'Hours Used', value: `${totalHours.toFixed(0)}h`, sub: 'this month', icon: 'schedule', accent: false },
            { label: 'Today', value: String(todayList.length).padStart(2, '0'), sub: 'bookings', icon: 'today', accent: false },
            { label: 'Upcoming', value: String(upcomingList.length).padStart(2, '0'), sub: 'scheduled', icon: 'upcoming', accent: false },
          ] as const).map(card => (
            <div key={card.label} className="p-3 rounded-xl"
              style={{ background: card.accent ? '#0f0f0f' : 'var(--ds-bg-raised)', border: card.accent ? 'none' : '1px solid var(--ds-border-sub)' }}>
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-[7px] font-black uppercase tracking-widest leading-none" style={{ color: card.accent ? '#555' : 'var(--ds-text-3)' }}>{card.label}</p>
                <span className="material-symbols-outlined" style={{ fontSize: 12, color: card.accent ? '#444' : 'var(--ds-text-4)' }}>{card.icon}</span>
              </div>
              <p className="text-2xl font-black leading-none" style={{ color: card.accent ? '#adee2b' : 'var(--ds-text-1)' }}>{card.value}</p>
              <p className="text-[8px] font-bold mt-1" style={{ color: card.accent ? '#555' : 'var(--ds-text-3)' }}>{card.sub}</p>
            </div>
          ))}
        </div>
      </div>

      <BookingPanel
        open={panelOpen}
        onClose={() => setPanelOpen(false)}
        editBooking={editBooking}
        onSubmit={() => {
          setPanelOpen(false)
          queryClient.invalidateQueries({ queryKey: ['my-bookings'] })
          queryClient.invalidateQueries({ queryKey: ['all-my-bookings', user?.id] })
          queryClient.invalidateQueries({ queryKey: ['bookings'] })
        }}
        onCancel={(b) => { setPanelOpen(false); handleCancel(b) }}
      />

      {/* Fixed description tooltip (avoids table overflow-hidden clipping) */}
      {descTooltip && (
        <div
          className="fixed pointer-events-none z-[9999]"
          style={{ left: descTooltip.x + 16, top: descTooltip.y - 88 }}
        >
          <div className="bg-slate-900/95 backdrop-blur-md border border-white/10 text-white text-xs font-medium px-4 py-3 rounded-2xl shadow-2xl leading-relaxed max-w-[320px]">
            {descTooltip.text}
          </div>
          <div className="absolute top-full left-5 w-2.5 h-2.5 bg-slate-900/95 border-r border-b border-white/10 rotate-45 -mt-1.5" />
        </div>
      )}

      {/* Toast */}
      <div
        className="fixed z-[9999] transition-all duration-300"
        style={{ bottom: 28, right: 96, transform: toastMsg ? 'translateY(0)' : 'translateY(80px)', opacity: toastMsg ? 1 : 0, pointerEvents: toastMsg ? 'auto' : 'none' }}
      >
        <div style={{
          background: 'rgba(15,20,45,0.55)',
          backdropFilter: 'blur(48px) saturate(200%)',
          WebkitBackdropFilter: 'blur(48px) saturate(200%)',
          border: '1px solid rgba(255,255,255,0.14)',
          borderRadius: '1.5rem',
          padding: '16px 20px',
          boxShadow: '0 24px 56px -8px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.12)',
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          minWidth: 320,
        }}>
          <span
            className="material-symbols-outlined shrink-0"
            style={{ fontSize: 24, color: toastCountdown !== null ? '#f87171' : '#adee2b' }}
          >
            {toastCountdown !== null ? 'cancel' : 'check_circle'}
          </span>
          <span className="text-white text-[13px] font-black flex-1">{toastMsg}</span>
          {toastCountdown !== null && (
            <>
              <span style={{ fontSize: 13, fontWeight: 900, color: 'rgba(255,255,255,0.45)', minWidth: 26, textAlign: 'right' }}>
                {toastCountdown}s
              </span>
              <button
                onClick={undoCancel}
                style={{
                  background: '#adee2b', color: '#000', border: 'none',
                  borderRadius: 10, padding: '6px 14px',
                  fontSize: 11, fontWeight: 900, textTransform: 'uppercase',
                  cursor: 'pointer', letterSpacing: '0.05em', flexShrink: 0,
                }}
              >
                Undo
              </button>
            </>
          )}
        </div>
      </div>

      {/* Cancel confirm modal */}
      {(cancelTarget || clearConfirm) && (
        <style>{`@keyframes sp-modal-in{from{opacity:0;transform:scale(0.93) translateY(10px)}to{opacity:1;transform:scale(1) translateY(0)}}`}</style>
      )}
      {cancelTarget && (
        <div
          className="fixed inset-0 z-[1000] flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.28)', backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)' }}
          onClick={() => setCancelTarget(null)}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              width: 380,
              background: 'rgba(255,255,255,0.82)',
              backdropFilter: 'blur(48px) saturate(200%)',
              WebkitBackdropFilter: 'blur(48px) saturate(200%)',
              border: '1px solid rgba(255,255,255,0.95)',
              borderRadius: 22,
              boxShadow: '0 24px 64px rgba(0,0,0,0.14), 0 6px 20px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,1)',
              padding: 28,
              animation: 'sp-modal-in 0.18s cubic-bezier(0.4,0,0.2,1)',
            }}
          >
            <div className="flex items-center gap-3.5 mb-6">
              <div className="size-11 rounded-2xl flex items-center justify-center shrink-0"
                style={{ background: 'rgba(239,68,68,0.1)' }}>
                <span className="material-symbols-outlined text-red-500 text-xl">cancel</span>
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900">Cancel Booking?</h3>
                <p className="text-xs text-slate-400 font-medium mt-0.5">This action cannot be undone.</p>
              </div>
            </div>
            <div className="rounded-2xl p-4 mb-6 space-y-2.5"
              style={{ background: 'rgba(0,0,0,0.04)', border: '1px solid rgba(0,0,0,0.06)' }}>
              <p className="text-sm font-black text-slate-800 leading-snug">{cancelTarget.title}</p>
              <div className="w-full h-px" style={{ background: 'rgba(0,0,0,0.07)' }} />
              <p className="text-xs font-bold text-slate-500 flex items-center gap-2">
                <span className="material-symbols-outlined text-slate-400 shrink-0" style={{ fontSize: 14 }}>location_on</span>
                {cancelTarget.room?.name} &middot; {cancelTarget.room?.floor}
              </p>
              <p className="text-xs font-bold text-slate-500 flex items-center gap-2">
                <span className="material-symbols-outlined text-slate-400 shrink-0" style={{ fontSize: 14 }}>schedule</span>
                {fmtTime(cancelTarget.start_at)} &ndash; {fmtTime(cancelTarget.end_at)} &middot; {dur(cancelTarget.start_at, cancelTarget.end_at)}
              </p>
              <p className="text-xs font-bold text-slate-500 flex items-center gap-2">
                <span className="material-symbols-outlined text-slate-400 shrink-0" style={{ fontSize: 14 }}>calendar_today</span>
                {fmtTableDate(cancelTarget.start_at)} &middot; {fmtTableDay(cancelTarget.start_at)}
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setCancelTarget(null)}
                className="flex-1 py-3 rounded-2xl text-[11px] font-black uppercase transition-colors"
                style={{ background: 'rgba(0,0,0,0.06)', color: '#475569' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(0,0,0,0.10)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'rgba(0,0,0,0.06)')}
              >
                Keep Booking
              </button>
              <button
                onClick={confirmCancel}
                className="flex-1 py-3 rounded-2xl text-[11px] font-black uppercase bg-red-500 text-white hover:bg-red-600 transition-colors"
              >
                Yes, Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tentative action popup */}
      {tentativeTarget && (
        <div
          className="fixed inset-0 z-[1000] flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.28)', backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)' }}
          onClick={() => setTentativeTarget(null)}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              width: 400,
              background: 'rgba(255,255,255,0.88)',
              backdropFilter: 'blur(48px) saturate(200%)',
              WebkitBackdropFilter: 'blur(48px) saturate(200%)',
              border: '1px solid rgba(255,255,255,0.95)',
              borderRadius: 22,
              boxShadow: '0 24px 64px rgba(0,0,0,0.14), 0 6px 20px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,1)',
              padding: 28,
              animation: 'sp-modal-in 0.18s cubic-bezier(0.4,0,0.2,1)',
            }}
          >
            <div className="flex items-center gap-3.5 mb-5">
              <div className="size-11 rounded-2xl flex items-center justify-center shrink-0"
                style={{ background: 'rgba(245,158,11,0.12)' }}>
                <span className="material-symbols-outlined text-xl" style={{ color: '#d97706' }}>pending_actions</span>
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900">Manage Tentative Booking</h3>
                <p className="text-xs text-slate-400 font-medium mt-0.5">What would you like to do with this booking?</p>
              </div>
            </div>

            <div className="rounded-2xl p-4 mb-5 space-y-2"
              style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.15)' }}>
              <p className="text-sm font-black text-slate-800 leading-snug">{tentativeTarget.title}</p>
              <div className="w-full h-px" style={{ background: 'rgba(0,0,0,0.07)' }} />
              <p className="text-xs font-bold text-slate-500 flex items-center gap-2">
                <span className="material-symbols-outlined text-slate-400 shrink-0" style={{ fontSize: 14 }}>location_on</span>
                {tentativeTarget.room?.name}
              </p>
              <p className="text-xs font-bold text-slate-500 flex items-center gap-2">
                <span className="material-symbols-outlined text-slate-400 shrink-0" style={{ fontSize: 14 }}>schedule</span>
                {fmtTableDate(tentativeTarget.start_at)} &middot; {fmtTime(tentativeTarget.start_at)} &ndash; {fmtTime(tentativeTarget.end_at)}
              </p>
            </div>

            <div className="space-y-2">
              <button
                onClick={() => handleTentativeAction('confirm')}
                disabled={tentativeConfirming}
                className="w-full py-3 rounded-2xl text-[12px] font-black uppercase tracking-wide bg-[#adee2b] text-black hover:bg-[#9fe020] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <span className="material-symbols-outlined text-base">check_circle</span>
                Ubah ke Confirmed
              </button>
              <button
                onClick={() => setTentativeTarget(null)}
                className="w-full py-3 rounded-2xl text-[12px] font-black uppercase tracking-wide transition-colors flex items-center justify-center gap-2"
                style={{ background: 'rgba(0,0,0,0.06)', color: '#475569' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(0,0,0,0.10)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'rgba(0,0,0,0.06)')}
              >
                <span className="material-symbols-outlined text-base">hourglass_empty</span>
                Biarkan (Keep Tentative)
              </button>
              <button
                onClick={() => handleTentativeAction('cancel')}
                disabled={tentativeConfirming}
                className="w-full py-3 rounded-2xl text-[12px] font-black uppercase tracking-wide bg-red-50 text-red-500 hover:bg-red-500 hover:text-white transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <span className="material-symbols-outlined text-base">cancel</span>
                Cancel Booking
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Clear cancelled modal */}
      {clearConfirm && (
        <div
          className="fixed inset-0 z-[1000] flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.28)', backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)' }}
          onClick={() => setClearConfirm(false)}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              width: 380,
              background: 'rgba(255,255,255,0.82)',
              backdropFilter: 'blur(48px) saturate(200%)',
              WebkitBackdropFilter: 'blur(48px) saturate(200%)',
              border: '1px solid rgba(255,255,255,0.95)',
              borderRadius: 22,
              boxShadow: '0 24px 64px rgba(0,0,0,0.14), 0 6px 20px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,1)',
              padding: 28,
              animation: 'sp-modal-in 0.18s cubic-bezier(0.4,0,0.2,1)',
            }}
          >
            <div className="flex items-center gap-3.5 mb-5">
              <div className="size-11 rounded-2xl flex items-center justify-center shrink-0"
                style={{ background: 'rgba(239,68,68,0.1)' }}>
                <span className="material-symbols-outlined text-red-500 text-xl">delete_sweep</span>
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900">Clear Cancelled Bookings?</h3>
                <p className="text-xs text-slate-400 font-medium mt-0.5">All {cancelledList.length} cancelled booking{cancelledList.length !== 1 ? 's' : ''} will be permanently removed.</p>
              </div>
            </div>
            <div className="rounded-2xl p-4 mb-6"
              style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.12)' }}>
              <p className="text-xs font-bold text-red-500 leading-relaxed">
                This permanently deletes all your cancelled bookings from history. This cannot be undone.
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setClearConfirm(false)}
                className="flex-1 py-3 rounded-2xl text-[11px] font-black uppercase transition-colors"
                style={{ background: 'rgba(0,0,0,0.06)', color: '#475569' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(0,0,0,0.10)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'rgba(0,0,0,0.06)')}
              >
                Keep
              </button>
              <button
                onClick={doClearCancelled}
                className="flex-1 py-3 rounded-2xl text-[11px] font-black uppercase bg-red-500 text-white hover:bg-red-600 transition-colors"
              >
                Clear All
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
