import { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import { useQuery, useQueryClient, useQueries } from '@tanstack/react-query'
import type { Booking, Room } from '../types/index'
import { getRooms } from '../api/rooms'
import { getBookings, updateBooking as updateBookingApi, cancelBooking } from '../api/bookings'
import { useAuth } from '../context/AuthContext'
import BookingBar from '../components/booking/BookingBar'
import BookingTooltip from '../components/booking/BookingTooltip'
import BookingPanel from '../components/booking/BookingPanel'
import RoomDetailModal from '../components/room/RoomDetailModal'
import GlassDatePicker from '../components/ui/GlassDatePicker'

const HOUR_START = 7
const HOUR_END = 19
const SLOT_W = 64
const ROOM_W = 164
const CELL_H = 60
const WEEK_CELL_H = 80

function fmtTime(iso: string) {
  const d = new Date(iso.replace('Z', ''))
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

function toLocalDateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const LOCATIONS = ['Head Office – Jakarta', 'Creative Tower – Bandung', 'South Hub – Surabaya']
const DEPTS = ['GAA', 'HRD', 'MTC']

type CellDrag = { roomId: number; room: Room; startSlot: number; endSlot: number }
type BarDrag  = { booking: Booking; origStartSlot: number; origSpan: number; offsetSlot: number; deltaSlot: number; origClientX: number; deltaPixels: number }
type BarResize = { booking: Booking; edge: 'left' | 'right'; origStartSlot: number; origSpan: number; deltaSlot: number; origClientX: number; deltaPixels: number }

export default function TimelinePage() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [currentDate, setCurrentDate] = useState(new Date())
  const [location, setLocation] = useState(LOCATIONS[0])
  const [deptFilter, setDeptFilter] = useState('')
  const [deptSearch, setDeptSearch] = useState('')
  const [search, setSearch] = useState('')
  const [locationOpen, setLocationOpen] = useState(false)
  const [deptOpen, setDeptOpen] = useState(false)
  const [bookingPanelOpen, setBookingPanelOpen] = useState(false)
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null)
  const [editBooking, setEditBooking] = useState<Booking | null>(null)
  const [prefillStart, setPrefillStart] = useState('')
  const [prefillEnd, setPrefillEnd] = useState('')
  const [detailRoom, setDetailRoom] = useState<Room | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [roomHover, setRoomHover] = useState<{ room: Room; x: number; y: number } | null>(null)
  const roomHoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [roomHoverPhotoIdx, setRoomHoverPhotoIdx] = useState(0)
  const [toastMsg, setToastMsg] = useState<string | null>(null)
  const [toastCountdown, setToastCountdown] = useState<number | null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const cancelTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const cancelIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [ctxMenu, setCtxMenu] = useState<{ booking: Booking; x: number; y: number } | null>(null)
  const [otherCtxMenu, setOtherCtxMenu] = useState<{ booking: Booking; x: number; y: number } | null>(null)
  const [cellCtxMenu, setCellCtxMenu] = useState<{ room: Room; slot: number; x: number; y: number } | null>(null)
  const [cancelTarget, setCancelTarget] = useState<Booking | null>(null)
  const [viewMode, setViewMode] = useState<'day' | 'week' | 'month'>('day')

  const [tooltip, setTooltip] = useState<{ booking: Booking | null; pos: { x: number; y: number }; visible: boolean }>({
    booking: null, pos: { x: 0, y: 0 }, visible: false,
  })
  const hideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Drag state via refs (avoids stale closures in document listeners)
  const cellDragRef = useRef<CellDrag | null>(null)
  const barDragRef  = useRef<BarDrag | null>(null)
  const barResizeRef = useRef<BarResize | null>(null)
  const [dragTick, setDragTick] = useState(0)
  const mainRef = useRef<HTMLElement>(null)

  // Dropdown click-outside refs
  const locationRef = useRef<HTMLDivElement>(null)
  const deptRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleMouseDown(e: MouseEvent) {
      if (locationRef.current && !locationRef.current.contains(e.target as Node)) setLocationOpen(false)
      if (deptRef.current && !deptRef.current.contains(e.target as Node)) { setDeptOpen(false); setDeptSearch('') }
    }
    function handleSearch(e: Event) { setSearch((e as CustomEvent<string>).detail) }
    document.addEventListener('mousedown', handleMouseDown)
    document.addEventListener('timeline-search', handleSearch)
    return () => {
      document.removeEventListener('mousedown', handleMouseDown)
      document.removeEventListener('timeline-search', handleSearch)
    }
  }, [])

  const slots = (HOUR_END - HOUR_START) * 2

  // Slot ↔ time conversions (captured fresh each time via closure)
  function slotToTimeStr(slot: number): string {
    const totalMins = HOUR_START * 60 + slot * 30
    const h = Math.floor(totalMins / 60)
    const m = totalMins % 60
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
  }

  function slotToDateTimeStr(date: Date, slot: number): string {
    const y  = date.getFullYear()
    const mo = String(date.getMonth() + 1).padStart(2, '0')
    const d  = String(date.getDate()).padStart(2, '0')
    const t  = slotToTimeStr(slot)
    return `${y}-${mo}-${d} ${t}:00`
  }

  const getSlotFromClientX = useCallback((clientX: number): number => {
    const el = mainRef.current
    if (!el) return 0
    const rect = el.getBoundingClientRect()
    const x = clientX - rect.left + el.scrollLeft - ROOM_W
    return Math.max(0, Math.min(slots - 1, Math.floor(x / SLOT_W)))
  }, [slots])

  // Document-level drag handlers
  useEffect(() => {
    function onMove(e: MouseEvent) {
      let changed = false
      if (cellDragRef.current) {
        cellDragRef.current.endSlot = getSlotFromClientX(e.clientX)
        changed = true
      }
      if (barDragRef.current) {
        const d = barDragRef.current
        d.deltaPixels = e.clientX - d.origClientX
        const s = getSlotFromClientX(e.clientX)
        const raw = s - d.offsetSlot - d.origStartSlot
        const maxDelta = slots - d.origStartSlot - d.origSpan
        const minDelta = -d.origStartSlot
        d.deltaSlot = Math.max(minDelta, Math.min(maxDelta, raw))
        changed = true
      }
      if (barResizeRef.current) {
        const d = barResizeRef.current
        d.deltaPixels = e.clientX - d.origClientX
        const s = getSlotFromClientX(e.clientX)
        if (d.edge === 'right') {
          const origEnd = d.origStartSlot + d.origSpan
          d.deltaSlot = Math.max(1 - d.origSpan, s + 1 - origEnd)
        } else {
          d.deltaSlot = Math.max(-(slots - d.origStartSlot - d.origSpan), Math.min(d.origSpan - 1, d.origStartSlot - s))
        }
        changed = true
      }
      if (changed) setDragTick(t => t + 1)
    }

    async function onUp() {
      const cd = cellDragRef.current
      if (cd) {
        const minSlot = Math.min(cd.startSlot, cd.endSlot)
        const maxSlot = Math.max(cd.startSlot, cd.endSlot)
        setPrefillStart(slotToTimeStr(minSlot))
        setPrefillEnd(slotToTimeStr(maxSlot + 1))
        setSelectedRoom(cd.room)
        setEditBooking(null)
        setBookingPanelOpen(true)
        cellDragRef.current = null
        setDragTick(t => t + 1)
      }

      function slotOverlaps(ns: number, ne: number, roomId: number, excludeId: number, all: Booking[]) {
        return all.some(o => {
          if (o.id === excludeId || o.room_id !== roomId || o.status === 'cancelled') return false
          const s = new Date(o.start_at.replace('Z', ''))
          const e = new Date(o.end_at.replace('Z', ''))
          const os = (s.getHours() - HOUR_START) * 2 + (s.getMinutes() >= 30 ? 1 : 0)
          const oe = (e.getHours() - HOUR_START) * 2 + (e.getMinutes() > 0 ? Math.ceil(e.getMinutes() / 30) : 0)
          return ns < oe && ne > os
        })
      }

      const dStr = toLocalDateStr(currentDate)
      const allBkgs: Booking[] = (queryClient.getQueryData(['bookings', dStr]) as Booking[]) ?? []

      const bd = barDragRef.current
      if (bd && bd.deltaSlot !== 0) {
        const newStart = bd.origStartSlot + bd.deltaSlot
        const newEnd   = newStart + bd.origSpan
        if (slotOverlaps(newStart, newEnd, bd.booking.room_id, bd.booking.id, allBkgs)) {
          setToastMsg('Slot occupied — move cancelled')
          if (toastTimer.current) clearTimeout(toastTimer.current)
          toastTimer.current = setTimeout(() => setToastMsg(null), 3000)
        } else {
          try {
            await updateBookingApi(bd.booking.id, {
              start_at: slotToDateTimeStr(currentDate, newStart),
              end_at:   slotToDateTimeStr(currentDate, newEnd),
            })
            queryClient.invalidateQueries({ queryKey: ['bookings', dStr] })
            setToastMsg('Booking moved successfully')
            if (toastTimer.current) clearTimeout(toastTimer.current)
            toastTimer.current = setTimeout(() => setToastMsg(null), 3500)
          } catch (err: unknown) {
            const status = (err as { response?: { status?: number } })?.response?.status
            setToastMsg(status === 422 ? 'Slot occupied — move cancelled' : 'Failed to move booking')
            if (toastTimer.current) clearTimeout(toastTimer.current)
            toastTimer.current = setTimeout(() => setToastMsg(null), 3000)
          }
        }
      }
      if (bd) { barDragRef.current = null; setDragTick(t => t + 1) }

      const br = barResizeRef.current
      if (br && br.deltaSlot !== 0) {
        let newStart = br.origStartSlot
        let newEnd   = br.origStartSlot + br.origSpan
        if (br.edge === 'right') newEnd   += br.deltaSlot
        else                     newStart -= br.deltaSlot
        if (newEnd > newStart && newStart >= 0 && newEnd <= slots) {
          if (slotOverlaps(newStart, newEnd, br.booking.room_id, br.booking.id, allBkgs)) {
            setToastMsg('Slot occupied — resize cancelled')
            if (toastTimer.current) clearTimeout(toastTimer.current)
            toastTimer.current = setTimeout(() => setToastMsg(null), 3000)
          } else {
            try {
              await updateBookingApi(br.booking.id, {
                start_at: slotToDateTimeStr(currentDate, newStart),
                end_at:   slotToDateTimeStr(currentDate, newEnd),
              })
              queryClient.invalidateQueries({ queryKey: ['bookings', dStr] })
              setToastMsg('Booking resized successfully')
              if (toastTimer.current) clearTimeout(toastTimer.current)
              toastTimer.current = setTimeout(() => setToastMsg(null), 3500)
            } catch (err: unknown) {
              const status = (err as { response?: { status?: number } })?.response?.status
              setToastMsg(status === 422 ? 'Slot occupied — resize cancelled' : 'Failed to resize booking')
              if (toastTimer.current) clearTimeout(toastTimer.current)
              toastTimer.current = setTimeout(() => setToastMsg(null), 3000)
            }
          }
        }
      }
      if (br) { barResizeRef.current = null; setDragTick(t => t + 1) }
    }

    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
    return () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
  }, [getSlotFromClientX, currentDate, slots])

  const dateStr = toLocalDateStr(currentDate)

  const { data: rooms = [], isLoading: roomsLoading } = useQuery({ queryKey: ['rooms'], queryFn: getRooms })
  const { data: bookings = [], isLoading: bookingsLoading } = useQuery({
    queryKey: ['bookings', dateStr],
    queryFn: () => getBookings({ date: dateStr }),
  })

  // Week view
  const weekDates = useMemo(() => {
    const d = new Date(currentDate)
    const day = d.getDay() // 0=Sun
    const offset = day === 0 ? -6 : 1 - day
    const monday = new Date(d)
    monday.setDate(d.getDate() + offset)
    return Array.from({ length: 7 }, (_, i) => {
      const dd = new Date(monday)
      dd.setDate(monday.getDate() + i)
      return dd
    })
  }, [currentDate])

  const weekResults = useQueries({
    queries: weekDates.map(d => ({
      queryKey: ['bookings', toLocalDateStr(d)],
      queryFn: () => getBookings({ date: toLocalDateStr(d) }),
      enabled: viewMode === 'week',
    }))
  })
  const weekData: Booking[][] = weekResults.map(r => (r.data as Booking[]) ?? [])

  // Month view data
  const monthFrom = toLocalDateStr(new Date(currentDate.getFullYear(), currentDate.getMonth(), 1))
  const monthTo   = toLocalDateStr(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0))
  const { data: monthBookings = [] } = useQuery({
    queryKey: ['bookings-month', monthFrom, monthTo],
    queryFn: () => getBookings({ date_from: monthFrom, date_to: monthTo }),
    enabled: viewMode === 'month',
  })

  const today = new Date()
  const isToday = currentDate.toDateString() === today.toDateString()
  const nowSlot = ((today.getHours() - HOUR_START) * 60 + today.getMinutes()) / 30

  function fmtDate(d: Date) {
    return d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' }).toUpperCase()
  }

  function bookingToSlots(b: Booking) {
    const start = new Date(b.start_at.replace('Z', ''))
    const end   = new Date(b.end_at.replace('Z', ''))
    const startSlot = (start.getHours() - HOUR_START) * 2 + (start.getMinutes() >= 30 ? 1 : 0)
    const endSlot   = (end.getHours() - HOUR_START) * 2 + (end.getMinutes() > 0 ? Math.ceil(end.getMinutes() / 30) : 0)
    return { startSlot, span: endSlot - startSlot }
  }

  function isRoomOccupied(room: Room): boolean {
    const now = new Date()
    return bookings.some((b: Booking) => {
      if (b.room_id !== room.id || b.status === 'cancelled') return false
      const start = new Date(b.start_at.replace('Z', ''))
      const end   = new Date(b.end_at.replace('Z', ''))
      return start <= now && now < end
    })
  }

  const filteredDepts = DEPTS.filter(d => d.toLowerCase().includes(deptSearch.toLowerCase()))

  const allVisibleBookings: Booking[] = viewMode === 'week'
    ? weekResults.flatMap(r => (r.data || []) as Booking[])
    : viewMode === 'month'
    ? monthBookings as Booking[]
    : bookings as Booking[]

  function bookingMatchesSearch(b: Booking, q: string): boolean {
    const s = q.toLowerCase()
    const fmt = (iso: string) => {
      const d = new Date(iso.replace('Z', ''))
      return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
    }
    return [
      b.title, b.description, b.user?.name, b.user?.department,
      b.user?.email, b.user?.ext, b.type, b.status,
      fmt(b.start_at), fmt(b.end_at),
    ].some(v => v && v.toLowerCase().includes(s))
  }

  const filteredRooms = (rooms as Room[]).filter((r: Room) => {
    if (search) {
      const roomMatch = r.name.toLowerCase().includes(search.toLowerCase()) || r.type.toLowerCase().includes(search.toLowerCase())
      const bookingMatch = allVisibleBookings.filter((b: Booking) => b.room_id === r.id && b.status !== 'cancelled')
        .some(b => bookingMatchesSearch(b, search))
      if (!roomMatch && !bookingMatch) return false
    }
    if (deptFilter) {
      const has = allVisibleBookings.some((b: Booking) => b.room_id === r.id && b.user?.department === deptFilter)
      if (!has) return false
    }
    return true
  })

  function getBookingsForRoom(roomId: number) {
    return bookings.filter((b: Booking) => b.room_id === roomId && b.status !== 'cancelled')
  }

  const showTooltip = useCallback((e: React.MouseEvent, booking: Booking) => {
    if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current)
    setTooltip({ booking, pos: { x: e.clientX, y: e.clientY }, visible: true })
  }, [])

  const hideTooltip = useCallback(() => {
    hideTimeoutRef.current = setTimeout(() => setTooltip(prev => ({ ...prev, visible: false })), 180)
  }, [])

  function openBookingForRoom(room: Room) {
    setSelectedRoom(room); setEditBooking(null)
    setPrefillStart(''); setPrefillEnd('')
    setBookingPanelOpen(true)
  }
  function openEdit(booking: Booking) {
    setEditBooking(booking); setSelectedRoom(booking.room || null)
    setPrefillStart(''); setPrefillEnd('')
    setBookingPanelOpen(true)
  }

  function confirmCancel() {
    if (!cancelTarget) return
    const booking = cancelTarget
    setCancelTarget(null)

    let count = 5
    setToastMsg(`"${booking.title}" cancelled`)
    setToastCountdown(count)
    if (cancelIntervalRef.current) clearInterval(cancelIntervalRef.current)
    if (cancelTimerRef.current) clearTimeout(cancelTimerRef.current)

    cancelIntervalRef.current = setInterval(() => {
      count -= 1
      setToastCountdown(count)
    }, 1000)

    cancelTimerRef.current = setTimeout(async () => {
      clearInterval(cancelIntervalRef.current!)
      setToastCountdown(null)
      setToastMsg(null)
      await cancelBooking(booking.id)
      queryClient.invalidateQueries({ queryKey: ['bookings', dateStr] })
    }, 5000)
  }

  function undoCancel() {
    if (cancelTimerRef.current) clearTimeout(cancelTimerRef.current)
    if (cancelIntervalRef.current) clearInterval(cancelIntervalRef.current)
    setToastMsg(null)
    setToastCountdown(null)
  }

  return (
    <div className="flex flex-col flex-1 overflow-hidden">

      {/* Toolbar */}
      <div className="bg-white border-b border-slate-100 px-8 py-2.5 grid grid-cols-3 items-center shrink-0 select-none">

        {/* Date nav */}
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={() => setCurrentDate(new Date())}
            className="px-4 py-2 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase hover:bg-black transition-colors">
            Today
          </button>
          <GlassDatePicker
            value={dateStr}
            onChange={(iso) => { const [yy, mm, dd] = iso.split('-').map(Number); setCurrentDate(new Date(yy, mm - 1, dd)) }}
            footer={(close) => (
              <>
                <button onClick={() => { setCurrentDate(new Date()); close() }}
                  className="flex-1 py-2.5 bg-black text-[#adee2b] rounded-xl text-[9px] font-black uppercase">Today</button>
                <button onClick={() => { const d = new Date(currentDate); d.setDate(d.getDate()-7); setCurrentDate(d); close() }}
                  className="flex-1 py-2.5 bg-white/70 text-slate-600 rounded-xl text-[9px] font-black uppercase hover:bg-white">- 1 Week</button>
                <button onClick={() => { const d = new Date(currentDate); d.setDate(d.getDate()+7); setCurrentDate(d); close() }}
                  className="flex-1 py-2.5 bg-white/70 text-slate-600 rounded-xl text-[9px] font-black uppercase hover:bg-white">+ 1 Week</button>
              </>
            )}
          >
            {({ open }) => (
              <button
                className="flex items-center gap-2 border-2 border-slate-100 rounded-xl px-3 py-2 hover:border-[#adee2b] hover:bg-[#f7fee7] transition-all group">
                <span className="material-symbols-outlined text-base text-slate-400 group-hover:text-black">calendar_today</span>
                <span className="text-[12px] font-black text-slate-800 uppercase">{fmtDate(currentDate)}</span>
                <span className={`material-symbols-outlined text-sm text-slate-300 transition-transform ${open ? 'rotate-180' : ''}`}>expand_more</span>
              </button>
            )}
          </GlassDatePicker>
          <div className="flex items-center">
            <button onClick={() => { const d=new Date(currentDate); d.setDate(d.getDate()-1); setCurrentDate(d) }}
              className="px-2.5 py-2 text-slate-400 hover:bg-slate-50 rounded-l-xl border border-slate-200 transition-colors">
              <span className="material-symbols-outlined text-lg">chevron_left</span>
            </button>
            <button onClick={() => { const d=new Date(currentDate); d.setDate(d.getDate()+1); setCurrentDate(d) }}
              className="px-2.5 py-2 text-slate-400 hover:bg-slate-50 rounded-r-xl border border-slate-200 border-l-0 transition-colors">
              <span className="material-symbols-outlined text-lg">chevron_right</span>
            </button>
          </div>
          {search && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-[#adee2b] rounded-xl text-[9px] font-black uppercase">
              <span className="material-symbols-outlined text-black" style={{ fontSize: 13 }}>search</span>
              <span className="text-black">{filteredRooms.length} room{filteredRooms.length !== 1 ? 's' : ''} matched</span>
              <button
                onClick={() => { setSearch(''); document.dispatchEvent(new CustomEvent('timeline-search', { detail: '' })) }}
                className="ml-0.5 hover:opacity-60 transition-opacity"
              >
                <span className="material-symbols-outlined text-black" style={{ fontSize: 12 }}>close</span>
              </button>
            </div>
          )}
        </div>

        {/* Location */}
        <div ref={locationRef} className="flex justify-center relative">
          <button onClick={() => setLocationOpen(!locationOpen)}
            className="flex items-center min-w-[240px] bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 hover:border-[#adee2b] transition-all group">
            <span className="material-symbols-outlined text-slate-400 text-base mr-2">apartment</span>
            <span className="text-[10px] font-black uppercase text-slate-700 flex-1 text-left">{location}</span>
            <span className="material-symbols-outlined text-slate-400 text-base ml-2 group-hover:rotate-180 transition-transform duration-200">expand_more</span>
          </button>
          {locationOpen && (
            <div className="dropdown-enter absolute top-full mt-2 w-[240px] bg-white border border-slate-100 rounded-2xl shadow-2xl z-[200] p-1.5">
              {LOCATIONS.map(l => (
                <div key={l} onClick={() => { setLocation(l); setLocationOpen(false) }}
                  className="px-4 py-2.5 hover:bg-[#adee2b] hover:text-black rounded-xl cursor-pointer text-[10px] font-black uppercase transition-colors">
                  {l}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Filter group + New Booking */}
        <div className="flex justify-end items-center gap-3">

          {/* Unified filter pill */}
          <div className="flex items-center bg-slate-100 rounded-2xl p-1 gap-0.5">

            {/* View toggle — animated sliding pill (Day | Week | Month) */}
            <div className="relative flex">
              {(() => {
                const idx = viewMode === 'day' ? 0 : viewMode === 'week' ? 1 : 2
                return (
                  <div
                    className="absolute inset-y-0 w-1/3 bg-white rounded-xl shadow-sm pointer-events-none transition-transform duration-200 ease-[cubic-bezier(0.4,0,0.2,1)]"
                    style={{ transform: `translateX(${idx * 100}%)` }}
                  />
                )
              })()}
              {([
                { mode: 'day', icon: 'calendar_today', label: 'Day' },
                { mode: 'week', icon: 'calendar_view_week', label: 'Week' },
                { mode: 'month', icon: 'calendar_month', label: 'Month' },
              ] as const).map(({ mode, icon, label }) => (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode)}
                  className={`relative z-10 w-[72px] flex items-center justify-center gap-1.5 py-1.5 text-[10px] font-black uppercase transition-colors duration-150 ${viewMode === mode ? 'text-slate-800' : 'text-slate-400 hover:text-slate-600'}`}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 15 }}>{icon}</span>
                  {label}
                </button>
              ))}
            </div>

            {/* Divider */}
            <div className="w-px h-5 bg-slate-300/60 mx-0.5 shrink-0" />

            {/* Dept filter */}
            <div ref={deptRef} className="relative">
              <button
                onClick={() => { setDeptOpen(!deptOpen); if (!deptOpen) setDeptSearch('') }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase transition-all
                  ${deptFilter ? 'bg-white shadow text-slate-800' : 'text-slate-400 hover:text-slate-600'}`}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>filter_list</span>
                {deptFilter || 'Dept'}
                {deptFilter && (
                  <span
                    onClick={e => { e.stopPropagation(); setDeptFilter('') }}
                    className="material-symbols-outlined text-slate-400 hover:text-slate-700 transition-colors"
                    style={{ fontSize: 13 }}
                  >close</span>
                )}
              </button>
              {deptOpen && (
                <div className="dropdown-enter-right absolute top-full right-0 mt-2 w-[164px] bg-white border border-slate-100 rounded-2xl shadow-2xl z-[300] overflow-hidden">
                  <div className="px-2.5 pt-2.5 pb-1.5">
                    <input type="text" placeholder="Search dept..." value={deptSearch}
                      onChange={e => setDeptSearch(e.target.value)} autoFocus
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-[10px] font-bold outline-none focus:border-[#adee2b] focus:bg-white transition-all" />
                  </div>
                  <div className="pb-1.5">
                    {(!deptSearch || 'all depts'.includes(deptSearch.toLowerCase())) && (
                      <button onClick={() => { setDeptFilter(''); setDeptOpen(false); setDeptSearch('') }}
                        className="w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-[#adee2b] transition-colors text-left">
                        <span className="size-5 rounded-md bg-slate-100 flex items-center justify-center shrink-0">
                          <span className="material-symbols-outlined text-slate-400" style={{ fontSize: 11 }}>layers</span>
                        </span>
                        <span className="text-[10px] font-black uppercase text-slate-700">All Depts</span>
                      </button>
                    )}
                    {filteredDepts.map(d => (
                      <button key={d} onClick={() => { setDeptFilter(d); setDeptOpen(false); setDeptSearch('') }}
                        className="w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-[#adee2b] transition-colors text-left">
                        <span className="size-5 rounded-md bg-slate-100 flex items-center justify-center shrink-0 text-[8px] font-black text-slate-600">{d.slice(0, 2)}</span>
                        <span className="text-[10px] font-black uppercase text-slate-700">{d}</span>
                      </button>
                    ))}
                    {filteredDepts.length === 0 && deptSearch && (
                      <p className="px-3 py-3 text-[10px] text-slate-300 font-bold">No results</p>
                    )}
                  </div>
                </div>
              )}
            </div>

          </div>

          <button onClick={() => { setSelectedRoom(null); setEditBooking(null); setPrefillStart(''); setPrefillEnd(''); setBookingPanelOpen(true) }}
            className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-[10px] font-black uppercase shadow-lg shadow-lime-300/30 transition-all duration-200 bg-[#adee2b] text-black hover:bg-black hover:text-[#adee2b]">
            <span className="material-symbols-outlined text-base">add</span> New Booking
          </button>
        </div>
      </div>

      {/* Week view */}
      {viewMode === 'week' && (
        <main className="flex-1 overflow-auto bg-white relative select-none" style={{ scrollbarWidth: 'thin' }}>
          {roomsLoading && (
            <div className="absolute inset-0 bg-white/80 flex items-center justify-center z-50">
              <span className="material-symbols-outlined animate-spin text-4xl text-slate-300">progress_activity</span>
            </div>
          )}
          <div style={{ minWidth: ROOM_W + 7 * 140 }}>
            {/* Week header */}
            <div className="sticky top-0 z-40 bg-white border-b shadow-sm flex">
              <div
                className="shrink-0 flex items-center px-3 text-[9px] font-black text-slate-400 uppercase tracking-widest border-r-2 border-slate-200"
                style={{ width: ROOM_W, height: CELL_H }}
              >Room</div>
              {weekDates.map((d, i) => {
                const isTd = d.toDateString() === today.toDateString()
                const showMonth = i === 0 || d.getMonth() !== weekDates[i - 1].getMonth()
                const isColLoading = weekResults[i]?.isLoading
                return (
                  <div key={i}
                    className={`flex-1 flex flex-col items-center justify-center border-r border-slate-200 cursor-pointer transition-colors group/wh
                      ${isTd ? 'bg-[#f7fee7]' : 'hover:bg-[#f7fee7]'}`}
                    style={{ height: CELL_H }}
                    onClick={() => { setCurrentDate(d); setViewMode('day') }}
                  >
                    <span className={`text-[9px] font-black uppercase tracking-wider ${isTd ? 'text-lime-700' : 'text-slate-400 group-hover/wh:text-slate-600'}`}>
                      {d.toLocaleDateString('en-GB', { weekday: 'short' })}
                    </span>
                    <div className={`mt-0.5 flex items-center justify-center rounded-full text-[15px] font-black transition-colors`}
                      style={{ width: 30, height: 30, background: isTd ? '#000' : 'transparent', color: isTd ? '#adee2b' : '#334155' }}>
                      {d.getDate()}
                    </div>
                    {showMonth && !isColLoading && (
                      <span className="text-[8px] font-bold text-slate-300 mt-0.5">
                        {d.toLocaleDateString('en-GB', { month: 'short' }).toUpperCase()}
                      </span>
                    )}
                    {isColLoading && (
                      <span className="material-symbols-outlined animate-spin text-slate-300 mt-0.5" style={{ fontSize: 10 }}>progress_activity</span>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Empty search state — week view */}
            {search && filteredRooms.length === 0 && (
              <div className="flex flex-col items-center justify-center py-24 gap-3">
                <span className="material-symbols-outlined text-slate-200" style={{ fontSize: 48 }}>search_off</span>
                <p className="text-[11px] font-black text-slate-300 uppercase tracking-widest">No rooms match "{search}"</p>
              </div>
            )}

            {/* Room rows */}
            {filteredRooms.map((room: Room) => {
              const dotColor = room.status === 'maintenance' ? 'bg-orange-400' : room.type === 'Ballroom' ? 'bg-purple-400' : room.type === 'Executive' ? 'bg-blue-400' : 'bg-green-400'
              const occupied = isRoomOccupied(room)
              const isMaintRoom = room.status === 'maintenance'
              return (
                <div key={room.id} className={`flex border-b border-slate-100 group/row ${isMaintRoom ? 'hover:bg-orange-50/40' : 'hover:bg-slate-50/50'}`}>
                  {/* Room label — same style as day view, sticky */}
                  <div
                    className={`shrink-0 flex items-center justify-between px-3 border-r-2 sticky left-0 z-20 transition-colors cursor-pointer
                      ${isMaintRoom ? 'bg-orange-50 border-orange-200 group-hover/row:bg-orange-100/50' : 'bg-white border-slate-200 group-hover/row:bg-slate-50/50'}`}
                    style={{ width: ROOM_W, height: WEEK_CELL_H }}
                    onClick={() => { setDetailRoom(room); setDetailOpen(true) }}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div className={`size-2 rounded-full shrink-0 ${dotColor} ${occupied ? 'ring-2 ring-offset-1 ring-red-400' : ''} ${isMaintRoom ? 'animate-pulse' : ''}`} />
                      <div className="min-w-0">
                        <span className={`text-[12px] font-black leading-tight block truncate ${isMaintRoom ? 'text-orange-700' : 'text-slate-800'}`}>{room.name}</span>
                        <span className={`text-[10px] font-bold flex items-center gap-1 mt-0.5 ${isMaintRoom ? 'text-orange-400' : 'text-slate-400'}`}>
                          {isMaintRoom
                            ? <><span className="material-symbols-outlined" style={{ fontSize: 10 }}>construction</span>Maintenance</>
                            : <><span className="material-symbols-outlined" style={{ fontSize: 10 }}>groups</span>{room.capacity} · {room.floor}</>
                          }
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* 7 day cells */}
                  {weekDates.map((d, dayIdx) => {
                    const isTd = d.toDateString() === today.toDateString()
                    const dayBookings = (weekData[dayIdx] ?? []).filter(
                      (b: Booking) => b.room_id === room.id && b.status !== 'cancelled'
                    )
                    return (
                      <div key={dayIdx}
                        className={`flex-1 border-r border-slate-100 px-1.5 py-2 overflow-hidden cursor-pointer transition-colors relative flex flex-col gap-0.5 justify-start
                          ${isTd ? 'bg-[#f7fee7]/40' : 'hover:bg-[#f7fee7]/60'}`}
                        style={{ height: WEEK_CELL_H }}
                        onClick={() => { setCurrentDate(d); setViewMode('day') }}
                      >
                        {isTd && <div className="absolute top-0 left-0 right-0 h-0.5 bg-[#adee2b]/60 pointer-events-none" />}
                        {dayBookings.map((b: Booking) => {
                          const isMe = b.user_id === user?.id
                          const isTentative = b.status === 'tentative'
                          const isMaint = b.type === 'maintenance' || b.type === 'repairment'
                          const bg = isMaint ? '#fb923c' : isTentative ? '#fde68a' : isMe ? '#adee2b' : '#bfdbfe'
                          const matchesSearch = !search || bookingMatchesSearch(b, search)
                          return (
                            <div key={b.id}
                              className="w-full rounded-sm shrink-0 hover:brightness-90 transition-all"
                              style={{ height: 8, background: bg, opacity: search && !matchesSearch ? 0.15 : 1 }}
                              onClick={e => { e.stopPropagation(); openEdit(b) }}
                              title={`${fmtTime(b.start_at)}–${fmtTime(b.end_at)} · ${b.title}`}
                            />
                          )
                        })}
                        {dayBookings.length === 0 && (
                          <div className="flex-1 flex items-center justify-center">
                            <div className="w-4 h-0.5 bg-slate-100 rounded-full" />
                          </div>
                        )}
                        {dayBookings.length > 0 && (
                          <div className="mt-auto text-[7px] font-black text-slate-400 text-center leading-none pt-0.5">
                            {dayBookings.length}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )
            })}
          </div>
        </main>
      )}

      {/* Month view */}
      {viewMode === 'month' && (() => {
        const year  = currentDate.getFullYear()
        const month = currentDate.getMonth()
        const firstDay = new Date(year, month, 1)
        const lastDay  = new Date(year, month + 1, 0)
        // Start from Monday before the 1st
        const startOffset = (firstDay.getDay() + 6) % 7
        const gridStart = new Date(firstDay)
        gridStart.setDate(1 - startOffset)
        const totalCells = Math.ceil((startOffset + lastDay.getDate()) / 7) * 7
        const cells = Array.from({ length: totalCells }, (_, i) => {
          const d = new Date(gridStart)
          d.setDate(gridStart.getDate() + i)
          return d
        })
        const bkgs = monthBookings as Booking[]
        const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
        return (
          <main className="flex-1 overflow-auto bg-white p-6">
            {/* Month header */}
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-[18px] font-black text-slate-900 uppercase tracking-tight">
                {currentDate.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }).toUpperCase()}
              </h2>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => { const d = new Date(currentDate); d.setMonth(d.getMonth() - 1); setCurrentDate(d) }}
                  className="px-2.5 py-2 text-slate-400 hover:bg-slate-50 rounded-l-xl border border-slate-200 transition-colors"
                >
                  <span className="material-symbols-outlined text-lg">chevron_left</span>
                </button>
                <button
                  onClick={() => setCurrentDate(new Date())}
                  className="px-4 py-2 bg-slate-900 text-white text-[10px] font-black uppercase border border-slate-200 hover:bg-black transition-colors"
                >
                  Today
                </button>
                <button
                  onClick={() => { const d = new Date(currentDate); d.setMonth(d.getMonth() + 1); setCurrentDate(d) }}
                  className="px-2.5 py-2 text-slate-400 hover:bg-slate-50 rounded-r-xl border border-slate-200 border-l-0 transition-colors"
                >
                  <span className="material-symbols-outlined text-lg">chevron_right</span>
                </button>
              </div>
            </div>

            {/* Day-of-week header */}
            <div className="grid grid-cols-7 mb-1">
              {DOW.map(d => (
                <div key={d} className="text-center py-2 text-[9px] font-black uppercase tracking-widest text-slate-400">{d}</div>
              ))}
            </div>

            {/* Calendar grid */}
            <div className="grid grid-cols-7 border-l border-t border-slate-100">
              {cells.map((cellDate, idx) => {
                const isCurrentMonth = cellDate.getMonth() === month
                const isTodayCell = cellDate.toDateString() === today.toDateString()
                const cellStr = toLocalDateStr(cellDate)
                const dayBkgs = bkgs.filter(b => {
                  const s = new Date(b.start_at.replace('Z', ''))
                  return toLocalDateStr(s) === cellStr && b.status !== 'cancelled'
                })
                const myBkgs = dayBkgs.filter(b => b.user_id === user?.id)
                const otherBkgs = dayBkgs.filter(b => b.user_id !== user?.id)
                const visibleBkgs = dayBkgs.slice(0, 3)
                const overflow = dayBkgs.length - 3

                return (
                  <div
                    key={idx}
                    onClick={() => { setCurrentDate(cellDate); setViewMode('day') }}
                    className={`min-h-[110px] border-r border-b border-slate-100 p-2 cursor-pointer transition-colors group
                      ${isCurrentMonth ? 'bg-white hover:bg-[#f7fee7]/60' : 'bg-slate-50/50 hover:bg-slate-50'}
                      ${isTodayCell ? 'bg-[#f7fee7]/70 ring-2 ring-inset ring-[#adee2b]' : ''}`}
                  >
                    {/* Date number */}
                    <div className="flex items-center justify-between mb-1.5">
                      <span
                        className={`flex items-center justify-center w-6 h-6 rounded-full text-[11px] font-black transition-colors
                          ${isTodayCell ? 'bg-black text-[#adee2b]' : isCurrentMonth ? 'text-slate-700 group-hover:bg-slate-200' : 'text-slate-300'}`}
                      >
                        {cellDate.getDate()}
                      </span>
                      {(myBkgs.length > 0 || otherBkgs.length > 0) && (
                        <div className="flex items-center gap-0.5">
                          {myBkgs.length > 0 && <span className="size-1.5 rounded-full bg-[#adee2b]" />}
                          {otherBkgs.length > 0 && <span className="size-1.5 rounded-full bg-blue-400" />}
                        </div>
                      )}
                    </div>

                    {/* Booking bars — color only, no text */}
                    <div className="flex flex-col gap-0.5 mt-0.5">
                      {visibleBkgs.map(b => {
                        const isMe = b.user_id === user?.id
                        const isTentative = b.status === 'tentative'
                        const isMaint = b.type === 'maintenance' || b.type === 'repairment'
                        const bg = isMaint ? '#fb923c' : isTentative ? '#fde68a' : isMe ? '#adee2b' : '#bfdbfe'
                        const start = new Date(b.start_at.replace('Z', ''))
                        const hh = String(start.getHours()).padStart(2, '0')
                        const mm = String(start.getMinutes()).padStart(2, '0')
                        return (
                          <div
                            key={b.id}
                            onClick={e => { e.stopPropagation(); openEdit(b) }}
                            className="w-full rounded-sm hover:brightness-90 transition-all cursor-pointer"
                            style={{ height: 6, background: bg }}
                            title={`${hh}:${mm} · ${b.title}`}
                          />
                        )
                      })}
                      {overflow > 0 && (
                        <p className="text-[7px] font-black text-slate-400">+{overflow}</p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </main>
        )
      })()}

      {/* Day view grid */}
      {viewMode === 'day' && (
      <main ref={mainRef} className="flex-1 overflow-auto bg-white relative select-none" style={{ scrollbarWidth: 'thin' }}>
        {(roomsLoading || bookingsLoading) && (
          <div className="absolute inset-0 bg-white/70 flex items-center justify-center z-50">
            <span className="material-symbols-outlined animate-spin text-4xl text-slate-300">progress_activity</span>
          </div>
        )}
        <div style={{ width: ROOM_W + slots * SLOT_W, minWidth: '100%' }}>

          {/* Header row */}
          <div className="sticky top-0 z-40 bg-white border-b shadow-sm flex">
            <div className="shrink-0 flex items-center px-3 text-[9px] font-black text-slate-400 uppercase tracking-widest border-r-2 border-slate-200"
              style={{ width: ROOM_W, height: CELL_H }}>Room</div>
            {Array.from({ length: HOUR_END - HOUR_START }, (_, i) => {
              const h = HOUR_START + i
              return (
                <div key={h} style={{ width: SLOT_W * 2, height: CELL_H }} className="flex shrink-0">
                  <div className="flex-1 flex items-center justify-center text-[13px] font-black text-slate-700 border-r-2 border-slate-200 border-b">
                    {h}:00
                  </div>
                  <div className="flex-1 flex items-center justify-center text-[10px] font-medium text-slate-400 border-r border-slate-100 border-b">
                    {h}:30
                  </div>
                </div>
              )
            })}
          </div>

          {/* Empty search state — day view */}
          {search && filteredRooms.length === 0 && (
            <div className="flex flex-col items-center justify-center py-32 gap-3">
              <span className="material-symbols-outlined text-slate-200" style={{ fontSize: 52 }}>search_off</span>
              <p className="text-[13px] font-black text-slate-300 uppercase tracking-widest">No results for "{search}"</p>
              <p className="text-[10px] font-bold text-slate-200">Try searching by title, user, dept, room, or time</p>
            </div>
          )}

          {/* Room rows */}
          {filteredRooms.map((room: Room) => {
            const roomBookings = getBookingsForRoom(room.id)
            const dotColor = room.status === 'maintenance' ? 'bg-orange-400' : room.type === 'Ballroom' ? 'bg-purple-400' : room.type === 'Executive' ? 'bg-blue-400' : 'bg-green-400'
            const occupied  = isRoomOccupied(room)
            const isMaintRoom = room.status === 'maintenance'

            const isCellDragRow = cellDragRef.current?.roomId === room.id
            const cellDragMinSlot = cellDragRef.current ? Math.min(cellDragRef.current.startSlot, cellDragRef.current.endSlot) : -1
            const cellDragMaxSlot = cellDragRef.current ? Math.max(cellDragRef.current.startSlot, cellDragRef.current.endSlot) : -1

            return (
              <div key={room.id} className={`flex group/row relative border-b border-slate-100 ${isMaintRoom ? 'hover:bg-orange-50/60' : 'hover:bg-[#f1f7ff]'}`}>
                {/* Room label */}
                <div
                  className={`shrink-0 flex items-center justify-between px-3 border-r-2 group/room cursor-pointer sticky left-0 z-20 transition-colors
                    ${isMaintRoom
                      ? 'bg-orange-50 border-orange-200 group-hover/row:bg-orange-100/60'
                      : 'bg-white border-slate-200 group-hover/row:bg-[#eef3ff]'}`}
                  style={{ width: ROOM_W, height: CELL_H }}
                  onMouseEnter={e => {
                    if (roomHoverTimer.current) clearTimeout(roomHoverTimer.current)
                    if (roomHover?.room.id !== room.id) setRoomHoverPhotoIdx(0)
                    setRoomHover({ room, x: e.clientX, y: e.clientY })
                  }}
                  onMouseLeave={() => {
                    roomHoverTimer.current = setTimeout(() => setRoomHover(null), 250)
                  }}
                >
                  <div className="flex items-center gap-2 min-w-0" onClick={() => { setDetailRoom(room); setDetailOpen(true) }}>
                    <div className={`size-2 rounded-full shrink-0 ${dotColor} ${occupied ? 'ring-2 ring-offset-1 ring-red-400' : ''} ${isMaintRoom ? 'animate-pulse' : ''}`} />
                    <div className="min-w-0">
                      <span className={`text-[13px] font-black leading-tight block truncate ${isMaintRoom ? 'text-orange-700' : 'text-slate-800'}`}>{room.name}</span>
                      <span className={`text-[11px] font-bold flex items-center gap-1 mt-0.5 ${isMaintRoom ? 'text-orange-400' : 'text-slate-400'}`}>
                        {isMaintRoom
                          ? <><span className="material-symbols-outlined" style={{ fontSize: 11 }}>construction</span>Maintenance</>
                          : <><span className="material-symbols-outlined" style={{ fontSize: 11 }}>groups</span>{room.capacity} &middot; {room.floor}</>
                        }
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => { setDetailRoom(room); setDetailOpen(true) }}
                    className={`size-6 rounded-lg items-center justify-center hidden group-hover/room:flex shrink-0 ${isMaintRoom ? 'bg-orange-100 hover:bg-orange-400 text-orange-600 hover:text-white' : 'bg-slate-100 hover:bg-[#adee2b]'}`}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 12 }}>open_in_new</span>
                  </button>
                </div>

                {/* Slots */}
                <div className="flex-1 relative" style={{ height: CELL_H }}>
                  {/* Cell grid — fixed layout, no bookings in flow */}
                  <div className="flex h-full absolute inset-0">
                    {Array.from({ length: slots }, (_, s) => {
                      const isCellSel = isCellDragRow && s >= cellDragMinSlot && s <= cellDragMaxSlot
                      return (
                        <div key={s}
                          className={`shrink-0 border-r border-slate-100 transition-colors cursor-cell
                            ${isCellSel ? 'bg-[#adee2b]/30' : 'hover:bg-[#f7fee7]'}
                            ${(s + 1) % 2 === 0 ? 'border-r-slate-200' : ''}`}
                          style={{ width: SLOT_W, height: CELL_H }}
                          onMouseDown={e => {
                            if (e.button !== 0) return
                            e.preventDefault()
                            const s2 = getSlotFromClientX(e.clientX)
                            cellDragRef.current = { roomId: room.id, room, startSlot: s2, endSlot: s2 }
                            setDragTick(t => t + 1)
                          }}
                          onContextMenu={e => {
                            e.preventDefault()
                            const slot = getSlotFromClientX(e.clientX)
                            setCellCtxMenu({ room, slot, x: e.clientX, y: e.clientY })
                          }}
                        />
                      )
                    })}
                  </div>

                  {/* Booking bars — absolutely positioned, no layout impact */}
                  {roomBookings.map((b: Booking) => {
                    const isMe = b.user_id === user?.id
                    const matchesSearch = !search || bookingMatchesSearch(b, search)
                    const bd = barDragRef.current
                    const br = barResizeRef.current
                    const isDragging = bd?.booking.id === b.id || br?.booking.id === b.id

                    let { startSlot, span } = bookingToSlots(b)
                    let fracPx = 0, resizeFracW = 0, resizeFracX = 0

                    if (bd?.booking.id === b.id) {
                      startSlot = Math.max(0, Math.min(slots - bd.origSpan, bd.origStartSlot + bd.deltaSlot))
                      span = bd.origSpan
                      fracPx = bd.deltaPixels - bd.deltaSlot * SLOT_W
                    } else if (br?.booking.id === b.id) {
                      if (br.edge === 'right') {
                        span = Math.max(1, br.origSpan + br.deltaSlot)
                        resizeFracW = br.deltaPixels - br.deltaSlot * SLOT_W
                      } else {
                        const origStart = br.origStartSlot
                        const delta = Math.max(-(slots - origStart - br.origSpan), Math.min(br.origSpan - 1, br.deltaSlot))
                        startSlot = Math.max(0, origStart - delta)
                        span = Math.max(1, br.origSpan + delta)
                        const f = Math.max(0, -br.deltaPixels - br.deltaSlot * SLOT_W)
                        resizeFracW = f
                        resizeFracX = -f
                      }
                    }

                    const left = startSlot * SLOT_W + fracPx + resizeFracX
                    const width = span * SLOT_W + resizeFracW

                    let startS = startSlot, endS = startSlot + span
                    if (bd?.booking.id === b.id) {
                      startS = Math.max(0, bd.origStartSlot + bd.deltaSlot)
                      endS = startS + bd.origSpan
                    } else if (br?.booking.id === b.id) {
                      if (br.edge === 'right') {
                        startS = br.origStartSlot
                        endS = Math.max(br.origStartSlot + 1, br.origStartSlot + br.origSpan + br.deltaSlot)
                      } else {
                        const d = Math.max(-(slots - br.origStartSlot - br.origSpan), Math.min(br.origSpan - 1, br.deltaSlot))
                        startS = Math.max(0, br.origStartSlot - d)
                        endS = br.origStartSlot + br.origSpan + d
                      }
                    }

                    return (
                      <div key={b.id} className="absolute top-0 z-10"
                        style={{ left, width, height: CELL_H, opacity: search && !matchesSearch ? 0.18 : 1, transition: isDragging ? 'none' : 'left 0.12s cubic-bezier(0.4,0,0.2,1), width 0.12s cubic-bezier(0.4,0,0.2,1), opacity 0.2s', willChange: isDragging ? 'left,width' : undefined }}
                        onContextMenu={e => {
                          e.preventDefault()
                          e.stopPropagation()
                          if (isMe) setCtxMenu({ booking: b, x: e.clientX, y: e.clientY })
                          else setOtherCtxMenu({ booking: b, x: e.clientX, y: e.clientY })
                        }}>
                        <BookingBar
                          booking={b}
                          onMouseEnter={showTooltip}
                          onMouseLeave={hideTooltip}
                          isMe={isMe}
                          isDragging={isDragging}
                          onBarMouseDown={isMe ? (e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            const { startSlot: ss, span: sp } = bookingToSlots(b)
                            const mouseSlot = getSlotFromClientX(e.clientX)
                            barDragRef.current = {
                              booking: b,
                              origStartSlot: ss,
                              origSpan: sp,
                              offsetSlot: mouseSlot - ss,
                              deltaSlot: 0,
                              origClientX: e.clientX,
                              deltaPixels: 0,
                            }
                            setDragTick(t => t + 1)
                          } : undefined}
                          onResizeMouseDown={isMe ? (e, edge) => {
                            e.preventDefault()
                            e.stopPropagation()
                            const { startSlot: ss, span: sp } = bookingToSlots(b)
                            barResizeRef.current = {
                              booking: b, edge,
                              origStartSlot: ss,
                              origSpan: sp,
                              deltaSlot: 0,
                              origClientX: e.clientX,
                              deltaPixels: 0,
                            }
                            setDragTick(t => t + 1)
                          } : undefined}
                        />
                        {isDragging && (
                          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-30">
                            <div style={{
                              background: 'rgba(8,12,28,0.9)',
                              backdropFilter: 'blur(8px)',
                              border: '1px solid rgba(255,255,255,0.2)',
                              borderRadius: 99,
                              padding: '2px 10px',
                              whiteSpace: 'nowrap',
                            }}>
                              <span className="text-white text-[9px] font-black">
                                {slotToTimeStr(Math.max(0, startS))} &ndash; {slotToTimeStr(Math.min(slots, endS))}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}

                  {/* Now line */}
                  {isToday && nowSlot > 0 && nowSlot < slots && (
                    <div className="absolute top-0 bottom-0 w-0.5 bg-red-500 pointer-events-none z-25"
                      style={{ left: nowSlot * SLOT_W }}>
                      <div className="absolute top-1/2 -left-1 -translate-y-1/2 w-2.5 h-2.5 bg-red-500 rounded-full" />
                    </div>
                  )}

                  {/* Cell drag selection overlay */}
                  {isCellDragRow && cellDragRef.current && (
                    <div
                      className="absolute top-2 bottom-2 bg-[#adee2b]/40 border-2 border-[#adee2b] rounded-xl pointer-events-none z-10 transition-none"
                      style={{
                        left: cellDragMinSlot * SLOT_W + 2,
                        width: (cellDragMaxSlot - cellDragMinSlot + 1) * SLOT_W - 4,
                      }}
                    >
                      <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[9px] font-black text-black/70 whitespace-nowrap">
                        {slotToTimeStr(cellDragMinSlot)} &ndash; {slotToTimeStr(cellDragMaxSlot + 1)}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </main>
      )}

      {/* Footer */}
      <footer className="bg-white border-t border-slate-100 px-8 py-2.5 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-5">
          {[
            { color: 'bg-blue-500', label: 'My Booking' },
            { color: 'bg-[#adee2b]', label: 'Confirmed' },
            { color: 'bg-slate-300', label: 'Tentative' },
            { color: 'bg-orange-400', label: 'Maintenance' },
          ].map(l => (
            <div key={l.label} className="flex items-center gap-1.5">
              <div className={`size-2.5 rounded-md ${l.color}`} />
              <span className="text-[8px] font-bold text-slate-400 uppercase">{l.label}</span>
            </div>
          ))}
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-0.5 bg-red-500" />
            <span className="text-[8px] font-bold text-slate-400 uppercase">Now</span>
          </div>
          <div className="flex items-center gap-1.5 border-l border-slate-100 pl-4">
            <span className="material-symbols-outlined text-slate-300" style={{ fontSize: 12 }}>drag_pan</span>
            <span className="text-[8px] font-bold text-slate-300 uppercase">Drag bar to move &middot; drag edge to resize &middot; drag cell to create</span>
          </div>
        </div>
        <p className="text-[8px] font-black text-slate-300 uppercase tracking-widest italic">RoomSync Pro v2.1 &middot; 2026</p>
      </footer>

      {/* Booking Tooltip */}
      {tooltip.booking && <BookingTooltip
        booking={tooltip.booking} pos={tooltip.pos} visible={tooltip.visible}
        onMouseEnter={() => { if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current) }}
        onMouseLeave={hideTooltip}
        currentUserId={user?.id ?? 0}
        onEdit={openEdit}
        onCancel={b => { setCancelTarget(b); setTooltip(prev => ({ ...prev, visible: false })) }}
      />}

      {/* Room hover mini-card */}
      {roomHover && (
        <>
          <style>{`@keyframes room-hover-in{from{opacity:0;transform:scale(0.94) translateY(8px)}to{opacity:1;transform:scale(1) translateY(0)}}`}</style>
          <div
            className="fixed z-[997]"
            style={{ left: Math.min(roomHover.x + 20, window.innerWidth - 308), top: Math.min(roomHover.y - 10, window.innerHeight - 420) }}
            onMouseEnter={() => { if (roomHoverTimer.current) clearTimeout(roomHoverTimer.current) }}
            onMouseLeave={() => { roomHoverTimer.current = setTimeout(() => setRoomHover(null), 250) }}
          >
            <div style={{
              background: 'rgba(255,255,255,0.82)',
              backdropFilter: 'blur(48px) saturate(200%)',
              WebkitBackdropFilter: 'blur(48px) saturate(200%)',
              border: '1px solid rgba(255,255,255,0.95)',
              borderRadius: '1.5rem',
              width: 288,
              overflow: 'hidden',
              boxShadow: '0 12px 48px rgba(0,0,0,0.10), 0 4px 16px rgba(0,0,0,0.07), inset 0 1px 0 rgba(255,255,255,1)',
              animation: 'room-hover-in 0.18s cubic-bezier(0.4,0,0.2,1)',
            }}>
              {/* Photo slideshow */}
              {roomHover.room.photos?.length > 0 ? (
                <div style={{ position: 'relative', height: 150, overflow: 'hidden', background: '#f1f5f9' }}>
                  <div style={{ display: 'flex', height: '100%', transition: 'transform 0.3s ease', transform: `translateX(-${roomHoverPhotoIdx * 100}%)` }}>
                    {roomHover.room.photos.slice(0, 5).map((p, i) => (
                      <img key={i} src={p} style={{ minWidth: '100%', height: '100%', objectFit: 'cover', flexShrink: 0 }} alt="" />
                    ))}
                  </div>
                  {roomHover.room.photos.length > 1 && (
                    <>
                      <button
                        onClick={() => setRoomHoverPhotoIdx(Math.max(0, roomHoverPhotoIdx - 1))}
                        style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', background: 'rgba(255,255,255,0.7)', backdropFilter: 'blur(8px)', border: 'none', color: '#1e293b', width: 26, height: 26, borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: 14 }}>chevron_left</span>
                      </button>
                      <button
                        onClick={() => setRoomHoverPhotoIdx(Math.min((roomHover.room.photos?.length ?? 1) - 1, roomHoverPhotoIdx + 1))}
                        style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'rgba(255,255,255,0.7)', backdropFilter: 'blur(8px)', border: 'none', color: '#1e293b', width: 26, height: 26, borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: 14 }}>chevron_right</span>
                      </button>
                      <div style={{ position: 'absolute', bottom: 8, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 4 }}>
                        {roomHover.room.photos.slice(0, 5).map((_, i) => (
                          <div key={i} style={{ width: i === roomHoverPhotoIdx ? 16 : 5, height: 5, borderRadius: i === roomHoverPhotoIdx ? 3 : '50%', background: i === roomHoverPhotoIdx ? 'white' : 'rgba(255,255,255,0.5)', transition: 'all 0.2s' }} />
                        ))}
                      </div>
                    </>
                  )}
                  <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.45) 0%, transparent 55%)', pointerEvents: 'none' }} />
                  <div style={{ position: 'absolute', bottom: 10, right: 12 }}>
                    {isRoomOccupied(roomHover.room)
                      ? <span style={{ fontSize: 8, fontWeight: 900, textTransform: 'uppercase', background: '#ef4444', color: 'white', padding: '3px 10px', borderRadius: 99, letterSpacing: '0.06em' }}>Occupied</span>
                      : <span style={{ fontSize: 8, fontWeight: 900, textTransform: 'uppercase', background: '#adee2b', color: '#000', padding: '3px 10px', borderRadius: 99, letterSpacing: '0.06em' }}>Free</span>
                    }
                  </div>
                </div>
              ) : (
                <div style={{ height: 44, background: 'rgba(0,0,0,0.03)', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', padding: '0 14px', borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
                  {isRoomOccupied(roomHover.room)
                    ? <span style={{ fontSize: 8, fontWeight: 900, textTransform: 'uppercase', background: 'rgba(239,68,68,0.1)', color: '#dc2626', padding: '3px 10px', borderRadius: 99 }}>Occupied</span>
                    : <span style={{ fontSize: 8, fontWeight: 900, textTransform: 'uppercase', background: 'rgba(173,238,43,0.25)', color: '#3f6212', padding: '3px 10px', borderRadius: 99 }}>Free</span>
                  }
                </div>
              )}
              <div style={{ padding: '14px 16px 16px' }}>
                <div className="flex items-center gap-1.5 mb-1">
                  <div className={`size-1.5 rounded-full shrink-0 ${roomHover.room.type === 'Ballroom' ? 'bg-purple-400' : roomHover.room.type === 'Executive' ? 'bg-blue-400' : 'bg-green-400'}`} />
                  <span className="text-[8px] font-black uppercase text-slate-400">{roomHover.room.type}</span>
                </div>
                <p className="text-[17px] font-black text-slate-900 leading-tight">{roomHover.room.name}</p>
                <div className="flex items-center gap-3 mt-2">
                  <span className="text-[11px] font-bold text-slate-500 flex items-center gap-1">
                    <span className="material-symbols-outlined text-slate-400" style={{ fontSize: 12 }}>groups</span>
                    {roomHover.room.capacity} seats
                  </span>
                  <span className="text-[11px] font-bold text-slate-400">Floor {roomHover.room.floor}</span>
                </div>
                <div className="flex flex-wrap gap-1 mt-3">
                  {roomHover.room.facilities.slice(0, 5).map(f => (
                    <span key={f.name} className="flex items-center gap-1 bg-slate-100 px-2 py-0.5 rounded-full text-[8px] font-bold text-slate-500">
                      <span className="material-symbols-outlined text-slate-400" style={{ fontSize: 9 }}>{f.icon}</span>
                      {f.name}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Booking Panel */}
      <BookingPanel
        open={bookingPanelOpen}
        onClose={() => setBookingPanelOpen(false)}
        initialRoom={selectedRoom}
        editBooking={editBooking}
        prefillStart={prefillStart}
        prefillEnd={prefillEnd}
        prefillDate={toLocalDateStr(currentDate)}
        onSubmit={() => {
          setBookingPanelOpen(false)
          queryClient.invalidateQueries({ queryKey: ['bookings', dateStr] })
          setToastMsg('Booking saved successfully')
          if (toastTimer.current) clearTimeout(toastTimer.current)
          toastTimer.current = setTimeout(() => setToastMsg(null), 3500)
        }}
        onCancel={(b) => { setBookingPanelOpen(false); setCancelTarget(b) }}
      />

      {/* Room Detail */}
      <RoomDetailModal
        room={detailRoom}
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        onBook={openBookingForRoom}
        bookings={bookings}
      />

      {/* Other user's bar context menu */}
      {otherCtxMenu && (
        <>
          <style>{`@keyframes ctx-in{from{opacity:0;transform:scale(0.92) translateY(-6px)}to{opacity:1;transform:scale(1) translateY(0)}}`}</style>
          <div className="fixed inset-0 z-[990]" onClick={() => setOtherCtxMenu(null)} onContextMenu={e => { e.preventDefault(); setOtherCtxMenu(null) }}>
            <div
              onClick={e => e.stopPropagation()}
              style={{
                position: 'absolute',
                left: Math.min(otherCtxMenu.x, window.innerWidth - 200),
                top: Math.min(otherCtxMenu.y, window.innerHeight - 150),
                minWidth: 188,
                background: 'rgba(255,255,255,0.82)',
                backdropFilter: 'blur(48px) saturate(200%)',
                WebkitBackdropFilter: 'blur(48px) saturate(200%)',
                border: '1px solid rgba(255,255,255,0.95)',
                borderRadius: 14,
                boxShadow: '0 8px 32px rgba(0,0,0,0.10), 0 2px 8px rgba(0,0,0,0.07), inset 0 1px 0 rgba(255,255,255,1)',
                padding: 5,
                animation: 'ctx-in 0.15s cubic-bezier(0.4,0,0.2,1)',
                transformOrigin: 'top left',
              }}
            >
              {/* Header */}
              <div className="px-3.5 pt-2.5 pb-2">
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 truncate">{otherCtxMenu.booking.user?.name}</p>
              </div>
              <div style={{ height: 1, background: 'rgba(0,0,0,0.06)', marginBottom: 4 }} />

              {/* Copy Ext */}
              <button
                onClick={() => {
                  navigator.clipboard.writeText(otherCtxMenu.booking.user?.ext || '')
                  setOtherCtxMenu(null)
                  setToastMsg(`Ext ${otherCtxMenu.booking.user?.ext} copied`)
                  if (toastTimer.current) clearTimeout(toastTimer.current)
                  toastTimer.current = setTimeout(() => setToastMsg(null), 2500)
                }}
                className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-[9px] text-left transition-colors hover:bg-black/5"
              >
                <span className="material-symbols-outlined text-slate-500" style={{ fontSize: 15 }}>phone_in_talk</span>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-black uppercase text-slate-700 leading-none">Copy Ext</p>
                  <p className="text-[9px] font-bold text-slate-400 mt-0.5">{otherCtxMenu.booking.user?.ext}</p>
                </div>
              </button>

              {/* Copy Email */}
              <button
                onClick={() => {
                  navigator.clipboard.writeText(otherCtxMenu.booking.user?.email || '')
                  setOtherCtxMenu(null)
                  setToastMsg('Email copied')
                  if (toastTimer.current) clearTimeout(toastTimer.current)
                  toastTimer.current = setTimeout(() => setToastMsg(null), 2500)
                }}
                className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-[9px] text-left transition-colors hover:bg-black/5"
              >
                <span className="material-symbols-outlined text-slate-500" style={{ fontSize: 15 }}>mail</span>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-black uppercase text-slate-700 leading-none">Copy Email</p>
                  <p className="text-[9px] font-bold text-slate-400 mt-0.5 truncate">{otherCtxMenu.booking.user?.email}</p>
                </div>
              </button>

              <div style={{ height: 1, background: 'rgba(0,0,0,0.06)', margin: '4px 0' }} />

              {/* View Room */}
              <button
                onClick={() => {
                  setDetailRoom(otherCtxMenu.booking.room || null)
                  setDetailOpen(true)
                  setOtherCtxMenu(null)
                }}
                className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-[9px] text-left transition-colors hover:bg-black/5"
              >
                <span className="material-symbols-outlined text-slate-500" style={{ fontSize: 15 }}>open_in_new</span>
                <span className="text-[11px] font-black uppercase text-slate-700">View Room Detail</span>
              </button>
            </div>
          </div>
        </>
      )}

      {/* Cell right-click context menu */}
      {cellCtxMenu && (
        <>
          <style>{`@keyframes ctx-in{from{opacity:0;transform:scale(0.92) translateY(-6px)}to{opacity:1;transform:scale(1) translateY(0)}}`}</style>
          <div className="fixed inset-0 z-[990]" onClick={() => setCellCtxMenu(null)} onContextMenu={e => { e.preventDefault(); setCellCtxMenu(null) }}>
            <div
              onClick={e => e.stopPropagation()}
              style={{
                position: 'absolute',
                left: Math.min(cellCtxMenu.x, window.innerWidth - 200),
                top: Math.min(cellCtxMenu.y, window.innerHeight - 120),
                minWidth: 188,
                background: 'rgba(255,255,255,0.82)',
                backdropFilter: 'blur(48px) saturate(200%)',
                WebkitBackdropFilter: 'blur(48px) saturate(200%)',
                border: '1px solid rgba(255,255,255,0.95)',
                borderRadius: 14,
                boxShadow: '0 8px 32px rgba(0,0,0,0.10), 0 2px 8px rgba(0,0,0,0.07), inset 0 1px 0 rgba(255,255,255,1)',
                padding: 5,
                animation: 'ctx-in 0.15s cubic-bezier(0.4,0,0.2,1)',
                transformOrigin: 'top left',
              }}
            >
              {/* Header — room + time */}
              <div className="px-3.5 pt-2.5 pb-2">
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 truncate">{cellCtxMenu.room.name}</p>
              </div>
              <div style={{ height: 1, background: 'rgba(0,0,0,0.06)', marginBottom: 4 }} />

              {/* New Booking */}
              <button
                onClick={() => {
                  setPrefillStart(slotToTimeStr(cellCtxMenu.slot))
                  setPrefillEnd(slotToTimeStr(Math.min(slots, cellCtxMenu.slot + 2)))
                  setSelectedRoom(cellCtxMenu.room)
                  setEditBooking(null)
                  setBookingPanelOpen(true)
                  setCellCtxMenu(null)
                }}
                className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-[9px] text-left transition-colors hover:bg-black/5"
              >
                <span className="material-symbols-outlined text-slate-500" style={{ fontSize: 15 }}>add_circle</span>
                <span className="text-[11px] font-black uppercase text-slate-700">New Booking</span>
              </button>

              {/* View Room */}
              <button
                onClick={() => { setDetailRoom(cellCtxMenu.room); setDetailOpen(true); setCellCtxMenu(null) }}
                className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-[9px] text-left transition-colors hover:bg-black/5"
              >
                <span className="material-symbols-outlined text-slate-500" style={{ fontSize: 15 }}>open_in_new</span>
                <span className="text-[11px] font-black uppercase text-slate-700">View Room</span>
              </button>
            </div>
          </div>
        </>
      )}

      {/* Right-click context menu */}
      {ctxMenu && (
        <>
          <style>{`@keyframes ctx-in{from{opacity:0;transform:scale(0.92) translateY(-6px)}to{opacity:1;transform:scale(1) translateY(0)}}`}</style>
          <div className="fixed inset-0 z-[990]" onClick={() => setCtxMenu(null)} onContextMenu={e => { e.preventDefault(); setCtxMenu(null) }}>
            <div
              onClick={e => e.stopPropagation()}
              style={{
                position: 'absolute',
                left: Math.min(ctxMenu.x, window.innerWidth - 184),
                top: Math.min(ctxMenu.y, window.innerHeight - 130),
                minWidth: 172,
                background: 'rgba(255,255,255,0.72)',
                backdropFilter: 'blur(48px) saturate(180%)',
                WebkitBackdropFilter: 'blur(48px) saturate(180%)',
                border: '1px solid rgba(255,255,255,0.9)',
                borderRadius: 14,
                boxShadow: '0 8px 32px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,1)',
                padding: 5,
                animation: 'ctx-in 0.15s cubic-bezier(0.4,0,0.2,1)',
                transformOrigin: 'top left',
              }}
            >
              {/* Header — booking title */}
              <div className="px-3.5 pt-2.5 pb-2">
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 truncate">{ctxMenu.booking.title}</p>
              </div>
              <div style={{ height: 1, background: 'rgba(0,0,0,0.06)', marginBottom: 4 }} />

              {/* Edit */}
              <button
                onClick={() => { openEdit(ctxMenu.booking); setCtxMenu(null) }}
                className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-[9px] text-left transition-colors hover:bg-black/5"
              >
                <span className="material-symbols-outlined text-slate-500" style={{ fontSize: 15 }}>edit</span>
                <span className="text-[11px] font-black uppercase text-slate-700">Edit</span>
              </button>

              {/* Cancel */}
              <button
                onClick={() => { setCancelTarget(ctxMenu.booking); setCtxMenu(null) }}
                className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-[9px] text-left transition-colors hover:bg-red-500/10"
              >
                <span className="material-symbols-outlined text-red-400" style={{ fontSize: 15 }}>cancel</span>
                <span className="text-[11px] font-black uppercase text-red-500">Cancel Booking</span>
              </button>
            </div>
          </div>
        </>
      )}

      {/* Cancel confirm modal */}
      {cancelTarget && (
        <>
          <style>{`@keyframes modal-in{from{opacity:0;transform:scale(0.93) translateY(10px)}to{opacity:1;transform:scale(1) translateY(0)}}`}</style>
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
                animation: 'modal-in 0.18s cubic-bezier(0.4,0,0.2,1)',
              }}
            >
              {/* Header */}
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

              {/* Booking info */}
              <div className="rounded-2xl p-4 mb-6 space-y-2.5"
                style={{ background: 'rgba(0,0,0,0.04)', border: '1px solid rgba(0,0,0,0.06)' }}>
                <p className="text-sm font-black text-slate-800">{cancelTarget.title}</p>
                <div className="w-full h-px" style={{ background: 'rgba(0,0,0,0.07)' }} />
                <p className="text-xs font-bold text-slate-500 flex items-center gap-2">
                  <span className="material-symbols-outlined text-slate-400 shrink-0" style={{ fontSize: 14 }}>location_on</span>
                  {cancelTarget.room?.name}
                </p>
              </div>

              {/* Buttons */}
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
        </>
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
    </div>
  )
}
