import { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery, useQueryClient, useQueries } from '@tanstack/react-query'
import type { Booking, Building, Room } from '../types/index'
import { getRooms } from '../api/rooms'
import { getBookings, updateBooking as updateBookingApi, cancelBooking, cancelSeries } from '../api/bookings'
import { getBuildings } from '../api/buildings'
import { useAuth } from '../context/AuthContext'
import { useSettings } from '../context/SettingsContext'
import BookingBar from '../components/booking/BookingBar'
import BookingTooltip from '../components/booking/BookingTooltip'
import BookingPanel from '../components/booking/BookingPanel'
import RoomDetailModal from '../components/room/RoomDetailModal'
import ContactReceptionistModal from '../components/room/ContactReceptionistModal'
import AfterHoursModal from '../components/booking/AfterHoursModal'
import GlassDatePicker from '../components/ui/GlassDatePicker'
import { SpecialRoomBadge } from '../components/ui/SpecialRoomBadge'
import { useWeekendSettings } from '../hooks/useWeekendSettings'
import { getDepartments } from '../api/departments'
import type { Department } from '../types'

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


type CellDrag = { roomId: number; room: Room; startSlot: number; endSlot: number }
type BarDrag  = { booking: Booking; origStartSlot: number; origSpan: number; offsetSlot: number; deltaSlot: number; origClientX: number; deltaPixels: number }
type BarResize = { booking: Booking; edge: 'left' | 'right'; origStartSlot: number; origSpan: number; deltaSlot: number; origClientX: number; deltaPixels: number }

export default function TimelinePage() {
  const { user } = useAuth()
  const { defaultView, startDay, defaultBuilding, showBarTitle, t } = useSettings()
  const { saturday: wkSat, sunday: wkSun } = useWeekendSettings()
  const queryClient = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()
  const [highlightId, setHighlightId] = useState<number | null>(() => {
    const h = searchParams.get('highlight')
    return h ? parseInt(h) : null
  })
  const highlightRef = useRef<HTMLDivElement | null>(null)
  const [currentDate, setCurrentDate] = useState(() => {
    const d = searchParams.get('date')
    if (d) { const [y, m, day] = d.split('-').map(Number); return new Date(y, m - 1, day) }
    return new Date()
  })
  const [location, setLocation] = useState<Building | null>(null)
  const [deptFilter, setDeptFilter] = useState('')
  const [deptSearch, setDeptSearch] = useState('')
  const [search, setSearch] = useState('')
  const [locationOpen, setLocationOpen] = useState(false)
  const [deptOpen, setDeptOpen] = useState(false)
  const [bookingPanelOpen, setBookingPanelOpen] = useState(false)
  const [afterHoursOpen, setAfterHoursOpen] = useState(false)
  const [afterHoursData, setAfterHoursData] = useState<{ buildingId?: number | null; workingHoursEnd: string } | null>(null)
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null)
  const [editBooking, setEditBooking] = useState<Booking | null>(null)
  const [prefillStart, setPrefillStart] = useState('')
  const [prefillEnd, setPrefillEnd] = useState('')
  const [detailRoom, setDetailRoom] = useState<Room | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [contactRoom, setContactRoom] = useState<Room | null>(null)
  const [contactOpen, setContactOpen] = useState(false)
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
  const [cellCtxMenu, setCellCtxMenu] = useState<{ room: Room | null; slot: number; date: Date; x: number; y: number } | null>(null)
  const [cancelTarget, setCancelTarget] = useState<Booking | null>(null)
  const [seriesCancelTarget, setSeriesCancelTarget] = useState<Booking | null>(null)
  const [pendingSeriesId, setPendingSeriesId] = useState<{ seriesId: string; title: string; count: number } | null>(null)
  const seriesCancelTimerRef = useRef<{ timer: ReturnType<typeof setTimeout>; interval: ReturnType<typeof setInterval> } | null>(null)
  const [viewMode, setViewMode] = useState<'day' | 'week' | 'month'>(() => defaultView)
  const [ganttKey, setGanttKey] = useState(0)
  const [ganttAnim, setGanttAnim] = useState<'left' | 'right' | 'up' | 'fade' | 'none'>('none')

  const [tooltip, setTooltip] = useState<{ booking: Booking | null; pos: { x: number; y: number }; visible: boolean }>({
    booking: null, pos: { x: 0, y: 0 }, visible: false,
  })
  const hideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [weekBarTooltip, setWeekBarTooltip] = useState<{ booking: Booking; x: number; y: number } | null>(null)

  // Drag state via refs (avoids stale closures in document listeners)
  const cellDragRef = useRef<CellDrag | null>(null)
  const barDragRef  = useRef<BarDrag | null>(null)
  const barResizeRef = useRef<BarResize | null>(null)
  const [dragTick, setDragTick] = useState(0)
  const mainRef = useRef<HTMLElement>(null)

  // Clear animation after it plays so background re-renders don't replay it
  useEffect(() => {
    if (ganttAnim === 'none') return
    const durations: Record<string, number> = { left: 220, right: 220, up: 240, fade: 200 }
    const t = setTimeout(() => setGanttAnim('none'), durations[ganttAnim] ?? 250)
    return () => clearTimeout(t)
  }, [ganttKey, ganttAnim])

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
    // Coalesce mousemove → at most one re-render + one layout read per animation
    // frame. Mouse events fire faster than the screen paints, so without this the
    // whole gantt re-renders 100+×/s during a drag, making move/resize feel stiff.
    let rafId: number | null = null
    let lastEvent: MouseEvent | null = null

    function applyMove(e: MouseEvent) {
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

    function onMove(e: MouseEvent) {
      lastEvent = e
      if (rafId !== null) return
      rafId = requestAnimationFrame(() => {
        rafId = null
        if (lastEvent) applyMove(lastEvent)
      })
    }

    async function onUp() {
      const cd = cellDragRef.current
      if (cd) {
        const minSlot = Math.min(cd.startSlot, cd.endSlot)
        const maxSlot = Math.max(cd.startSlot, cd.endSlot)
        cellDragRef.current = null
        setDragTick(t => t + 1)
        if (!canBookDirectly(cd.room)) {
          setContactRoom(cd.room); setContactOpen(true)
        } else {
          setPrefillStart(slotToTimeStr(minSlot))
          setPrefillEnd(slotToTimeStr(maxSlot + 1))
          setSelectedRoom(cd.room)
          setEditBooking(null)
          setBookingPanelOpen(true)
        }
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
      const bd = barDragRef.current
      const br = barResizeRef.current
      const needsCheck = (bd && bd.deltaSlot !== 0) || (br && br.deltaSlot !== 0)
      const allBkgs: Booking[] = needsCheck
        ? await queryClient.fetchQuery({ queryKey: ['bookings', dStr], queryFn: () => getBookings({ date: dStr }), staleTime: 0 })
        : (queryClient.getQueryData(['bookings', dStr]) as Booking[]) ?? []

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
      if (rafId !== null) cancelAnimationFrame(rafId)
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
  }, [getSlotFromClientX, currentDate, slots])

  const dateStr = toLocalDateStr(currentDate)

  const { data: buildings = [] } = useQuery<Building[]>({ queryKey: ['buildings'], queryFn: getBuildings })

  useEffect(() => {
    if (buildings.length > 0 && !location) {
      const preferred = defaultBuilding ? buildings.find(b => b.id === defaultBuilding) : null
      setLocation(preferred ?? buildings[0])
    }
  }, [buildings])

  // Re-sync highlight + date from URL params when navigating to this page while already mounted
  // (e.g. from navbar global search when user is already on the timeline).
  // Use searchParams.toString() — not searchParams itself — because React Router creates a new
  // URLSearchParams object every render, which would cause an infinite loop with the object as dep.
  useEffect(() => {
    const h = searchParams.get('highlight')
    const d = searchParams.get('date')
    if (h) setHighlightId(parseInt(h))
    if (d) { const [y, m, day] = d.split('-').map(Number); setCurrentDate(new Date(y, m - 1, day)) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams.toString()])

  // Scroll to and flash highlight booking from notification click
  useEffect(() => {
    if (!highlightId || !highlightRef.current) return
    const el = highlightRef.current
    el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' })
    el.animate([
      { outline: '2px solid transparent', boxShadow: '0 0 0 0 rgba(173,238,43,0)' },
      { outline: '2px solid #adee2b',     boxShadow: '0 0 0 8px rgba(173,238,43,0.5)' },
      { outline: '2px solid transparent', boxShadow: '0 0 0 0 rgba(173,238,43,0)' },
      { outline: '2px solid #adee2b',     boxShadow: '0 0 0 8px rgba(173,238,43,0.5)' },
      { outline: '2px solid transparent', boxShadow: '0 0 0 0 rgba(173,238,43,0)' },
    ], { duration: 4000, easing: 'ease-in-out' })
    const t = setTimeout(() => {
      setHighlightId(null)
      setSearchParams(p => { p.delete('highlight'); p.delete('date'); return p }, { replace: true })
    }, 4100)
    return () => clearTimeout(t)
  }, [highlightId, highlightRef.current])

  const { data: rooms = [], isLoading: roomsLoading } = useQuery({ queryKey: ['rooms'], queryFn: getRooms })
  const { data: departments = [] } = useQuery<Department[]>({
    queryKey: ['departments'],
    queryFn: getDepartments,
    staleTime: 5 * 60_000,
  })

  const { data: bookings = [], isLoading: bookingsLoading } = useQuery({
    queryKey: ['bookings', dateStr],
    queryFn: () => getBookings({ date: dateStr }),
    staleTime: 3_000,
  })

  // Week view
  const weekDates = useMemo(() => {
    const d = new Date(currentDate)
    const day = d.getDay() // 0=Sun
    // offset = how many days back to reach the week start
    const offset = startDay === 'sun' ? day : (day + 6) % 7
    const start = new Date(d)
    start.setDate(d.getDate() - offset)
    return Array.from({ length: 7 }, (_, i) => {
      const dd = new Date(start)
      dd.setDate(start.getDate() + i)
      return dd
    })
  }, [currentDate, startDay])

  const weekResults = useQueries({
    queries: weekDates.map(d => ({
      queryKey: ['bookings', toLocalDateStr(d)],
      queryFn: () => getBookings({ date: toLocalDateStr(d) }),
      enabled: viewMode === 'week',
      staleTime: 10_000,
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
    staleTime: 3_000,
  })

  const today = new Date()
  const isToday = currentDate.toDateString() === today.toDateString()
  const nowSlot = ((today.getHours() - HOUR_START) * 60 + today.getMinutes()) / 30

  function fmtDate(d: Date) {
    return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }).toUpperCase()
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

  const filteredDepts = departments
    .map(d => d.name)
    .filter(n => n.toLowerCase().includes(deptSearch.toLowerCase()))

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
      b.title, b.description, b.user?.name, b.user?.department_name,
      b.user?.email, b.user?.ext, b.type, b.status,
      fmt(b.start_at), fmt(b.end_at),
    ].some(v => v && v.toLowerCase().includes(s))
  }

  const filteredRooms = (rooms as Room[]).filter((r: Room) => {
    if (location && r.building_id !== location.id) return false
    if (search) {
      const roomMatch = r.name.toLowerCase().includes(search.toLowerCase())
      const bookingMatch = allVisibleBookings.filter((b: Booking) => b.room_id === r.id && b.status !== 'cancelled')
        .some(b => bookingMatchesSearch(b, search))
      if (!roomMatch && !bookingMatch) return false
    }
    if (deptFilter) {
      const has = allVisibleBookings.some((b: Booking) => b.room_id === r.id && b.user?.department_name === deptFilter)
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

  const canBookDirectly = (room: Room) => {
    if (!room.requires_contact) return true
    return user?.role === 'admin' || user?.role === 'receptionist' || user?.department === 'GAA'
  }

  function openBookingForRoom(room: Room) {
    if (!canBookDirectly(room)) { setContactRoom(room); setContactOpen(true); return }
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

  function confirmSeriesCancel(target: Booking) {
    setSeriesCancelTarget(null)
    if (!target.series_id) return
    const allBookings = queryClient.getQueryData<Booking[]>(['bookings', dateStr]) ?? []
    const seriesBookings = allBookings.filter(b => b.series_id === target.series_id && b.status !== 'cancelled')
    const count = seriesBookings.length || 1
    setPendingSeriesId({ seriesId: target.series_id, title: target.title, count })
    if (seriesCancelTimerRef.current) {
      clearTimeout(seriesCancelTimerRef.current.timer)
      clearInterval(seriesCancelTimerRef.current.interval)
    }
    let c = 5
    setToastMsg(`"${target.title}" series (${count} bookings) will be cancelled`)
    setToastCountdown(c)
    const interval = setInterval(() => {
      c -= 1
      setToastCountdown(c)
    }, 1000)
    const timer = setTimeout(async () => {
      clearInterval(interval)
      seriesCancelTimerRef.current = null
      setPendingSeriesId(null)
      setToastMsg(null)
      setToastCountdown(null)
      await cancelSeries(target.series_id!)
      queryClient.invalidateQueries({ queryKey: ['bookings', dateStr] })
    }, 5000)
    seriesCancelTimerRef.current = { timer, interval }
  }

  function undoSeriesCancel() {
    if (seriesCancelTimerRef.current) {
      clearTimeout(seriesCancelTimerRef.current.timer)
      clearInterval(seriesCancelTimerRef.current.interval)
      seriesCancelTimerRef.current = null
    }
    setPendingSeriesId(null)
    setToastMsg(null)
    setToastCountdown(null)
  }

  const VIEW_ORDER = { day: 0, week: 1, month: 2 } as const
  const ganttAnimCSS: Record<string, string> = {
    left:  'gantt-enter-left 0.2s cubic-bezier(0.4,0,0.2,1) both',
    right: 'gantt-enter-right 0.2s cubic-bezier(0.4,0,0.2,1) both',
    up:    'gantt-enter-up 0.22s cubic-bezier(0.34,1.04,0.64,1) both',
    fade:  'gantt-enter-fade 0.18s ease both',
    none:  '',
  }

  function switchViewMode(mode: 'day' | 'week' | 'month') {
    if (mode === viewMode) return
    setGanttAnim(VIEW_ORDER[mode] > VIEW_ORDER[viewMode] ? 'left' : 'right')
    setGanttKey(k => k + 1)
    setViewMode(mode)
  }

  function switchBuilding(b: Building | null) {
    setGanttAnim('up')
    setGanttKey(k => k + 1)
    setLocation(b)
  }

  function switchDept(d: string) {
    setGanttAnim('fade')
    setGanttKey(k => k + 1)
    setDeptFilter(d)
  }

  function switchDate(newDate: Date, dir: 'left' | 'right' | 'fade') {
    setGanttAnim(dir)
    setGanttKey(k => k + 1)
    setCurrentDate(newDate)
  }

  function navDate(forward: boolean) {
    const d = new Date(currentDate)
    if (viewMode === 'week') d.setDate(d.getDate() + (forward ? 7 : -7))
    else if (viewMode === 'month') d.setMonth(d.getMonth() + (forward ? 1 : -1))
    else d.setDate(d.getDate() + (forward ? 1 : -1))
    switchDate(d, forward ? 'left' : 'right')
  }

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <style>{`
        @keyframes gantt-enter-left{from{opacity:0;transform:translateX(28px)}to{opacity:1;transform:translateX(0)}}
        @keyframes gantt-enter-right{from{opacity:0;transform:translateX(-28px)}to{opacity:1;transform:translateX(0)}}
        @keyframes gantt-enter-up{from{opacity:0;transform:translateY(16px) scale(0.99)}to{opacity:1;transform:translateY(0) scale(1)}}
        @keyframes gantt-enter-fade{from{opacity:0}to{opacity:1}}
      `}</style>

      {/* Toolbar */}
      <div className="bg-[var(--ds-bg-surface)] border-b border-[var(--ds-border-sub)] px-8 py-2.5 grid grid-cols-3 items-center shrink-0 select-none">

        {/* Date nav */}
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={() => { const t = new Date(); switchDate(t, toLocalDateStr(t) > dateStr ? 'left' : toLocalDateStr(t) < dateStr ? 'right' : 'fade') }}
            className="px-5 py-2.5 bg-black text-[#adee2b] rounded-xl text-[11px] font-black uppercase tracking-wider hover:opacity-80 transition-opacity">
            Today
          </button>
          {(() => {
            const fmtShort = (d: Date) => `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getFullYear()).slice(2)}`
            const weekLabel = viewMode === 'week' ? `${fmtShort(weekDates[0])} – ${fmtShort(weekDates[6])}` : null
            return (
              <GlassDatePicker
                value={dateStr}
                onChange={(iso) => { const [yy, mm, dd] = iso.split('-').map(Number); switchDate(new Date(yy, mm - 1, dd), iso > dateStr ? 'left' : 'right') }}
                highlightWeek={viewMode === 'week' ? { start: toLocalDateStr(weekDates[0]), end: toLocalDateStr(weekDates[6]) } : undefined}
                footer={(close) => (
                  <>
                    <button onClick={() => { const t = new Date(); switchDate(t, toLocalDateStr(t) > dateStr ? 'left' : toLocalDateStr(t) < dateStr ? 'right' : 'fade'); close() }}
                      className="flex-1 py-2.5 bg-black text-[#adee2b] rounded-xl text-[9px] font-black uppercase">Today</button>
                    <button onClick={() => { const d = new Date(currentDate); d.setDate(d.getDate()-7); switchDate(d, 'right'); close() }}
                      className="flex-1 py-2.5 bg-[var(--ds-bg-raised)] text-[var(--ds-text-2)] rounded-xl text-[9px] font-black uppercase hover:bg-[var(--ds-bg-surface)]">- 1 Week</button>
                    <button onClick={() => { const d = new Date(currentDate); d.setDate(d.getDate()+7); switchDate(d, 'left'); close() }}
                      className="flex-1 py-2.5 bg-[var(--ds-bg-raised)] text-[var(--ds-text-2)] rounded-xl text-[9px] font-black uppercase hover:bg-[var(--ds-bg-surface)]">+ 1 Week</button>
                  </>
                )}
              >
                {({ open }) => (
                  <button
                    className="flex items-center gap-1.5 border border-[var(--ds-border)] rounded-xl px-2.5 py-1.5 hover:border-[#adee2b] hover:bg-[#adee2b]/10 transition-all group" style={{ width: 190 }}>
                    <span className="material-symbols-outlined text-sm text-[var(--ds-text-3)] group-hover:text-[var(--ds-text-1)] shrink-0">calendar_today</span>
                    <span className="text-[11px] font-black text-[var(--ds-text-1)] uppercase flex-1 text-left truncate">
                      {weekLabel ?? fmtDate(currentDate)}
                    </span>
                    <span className={`material-symbols-outlined text-xs text-[var(--ds-text-3)] transition-transform ${open ? 'rotate-180' : ''}`}>expand_more</span>
                  </button>
                )}
              </GlassDatePicker>
            )
          })()}
          <div className="flex items-center">
            <button onClick={() => navDate(false)} className="px-1.5 py-1.5 text-[var(--ds-text-3)] hover:bg-[var(--ds-bg-raised)] rounded-l-xl border border-[var(--ds-border)] transition-colors">
              <span className="material-symbols-outlined text-sm">chevron_left</span>
            </button>
            <button onClick={() => navDate(true)} className="px-1.5 py-1.5 text-[var(--ds-text-3)] hover:bg-[var(--ds-bg-raised)] rounded-r-xl border border-[var(--ds-border)] border-l-0 transition-colors">
              <span className="material-symbols-outlined text-sm">chevron_right</span>
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
            className="flex items-center min-w-[240px] bg-[var(--ds-bg-raised)] border border-[var(--ds-border)] rounded-xl px-4 py-2.5 hover:border-[#adee2b] transition-all group">
            <span className="material-symbols-outlined text-[var(--ds-text-3)] text-base mr-2">apartment</span>
            <span className="text-[10px] font-black uppercase text-[var(--ds-text-1)] flex-1 text-left flex items-center gap-1">
              {location ? (
                <>
                  {location.code || location.name}
                  {location.address && (
                    <> - <span className="material-symbols-outlined" style={{ fontSize: 10, fontVariationSettings: "'FILL' 1" }}>location_on</span>{location.address}</>
                  )}
                </>
              ) : 'Select Building'}
            </span>
            <span className="material-symbols-outlined text-[var(--ds-text-3)] text-base ml-2 group-hover:rotate-180 transition-transform duration-200">expand_more</span>
          </button>
          {locationOpen && (
            <div className="dropdown-enter absolute top-full mt-2 w-[260px] rounded-2xl z-[200] p-1.5"
              style={{ background: 'var(--ds-glass-bg)', backdropFilter: 'blur(32px)', WebkitBackdropFilter: 'blur(32px)', border: '1px solid var(--ds-glass-border)', boxShadow: 'var(--ds-glass-shadow)' }}>
              {(buildings as Building[]).map(b => {
                const roomCount = (rooms as Room[]).filter(r => r.building_id === b.id && r.is_active).length
                return (
                  <div key={b.id}
                    className={`group relative px-5 py-5 rounded-xl cursor-pointer transition-colors
                      ${location?.id === b.id ? 'bg-[#adee2b] text-black' : 'text-[var(--ds-text-1)] hover:bg-[#adee2b]/25 hover:text-black'}`}
                    onClick={() => { switchBuilding(b); setLocationOpen(false) }}>
                    <p className="flex items-center gap-1 text-[10px] font-black uppercase">
                      {b.code || b.name}
                      {b.address && (
                        <> - <span className="material-symbols-outlined" style={{ fontSize: 10, fontVariationSettings: "'FILL' 1" }}>location_on</span>{b.address}</>
                      )}
                    </p>

                    {/* Dark glass tooltip */}
                    <div className="absolute left-full top-1/2 -translate-y-1/2 ml-3 opacity-0 group-hover:opacity-100 transition-opacity duration-150 pointer-events-none z-[300] w-[260px]">
                      <div className="rounded-2xl p-5 space-y-3"
                        style={{ background: 'rgba(15,15,15,0.87)', backdropFilter: 'blur(64px) saturate(2)', WebkitBackdropFilter: 'blur(64px) saturate(2)', border: '1px solid rgba(255,255,255,0.12)', boxShadow: '0 16px 48px rgba(0,0,0,0.5)' }}>
                        <p className="text-[13px] font-black text-white leading-tight">{b.name}</p>
                        {b.address && (
                          <div className="flex items-start gap-2">
                            <span className="material-symbols-outlined shrink-0 text-white/40" style={{ fontSize: 13, marginTop: 1 }}>location_on</span>
                            <p className="text-[11px] text-white/60 font-medium leading-relaxed">{b.address}</p>
                          </div>
                        )}
                        {b.notes && (
                          <div className="flex items-start gap-2">
                            <span className="material-symbols-outlined shrink-0 text-white/40" style={{ fontSize: 13, marginTop: 1 }}>notes</span>
                            <p className="text-[11px] text-white/60 font-medium leading-relaxed">{b.notes}</p>
                          </div>
                        )}
                        <div className="flex items-center gap-2 pt-1 border-t border-white/10">
                          <span className="material-symbols-outlined text-white/40" style={{ fontSize: 13 }}>meeting_room</span>
                          <p className="text-[11px] text-white/60 font-medium">{roomCount} room{roomCount !== 1 ? 's' : ''}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Filter group + New Booking */}
        <div className="flex justify-end items-center gap-3">

          {/* Unified filter pill */}
          <div className="flex items-center bg-[var(--ds-bg-surface-2)] rounded-2xl p-1 gap-0.5">

            {/* View toggle — animated sliding pill (Day | Week | Month) */}
            <div className="relative flex">
              {(() => {
                const idx = viewMode === 'day' ? 0 : viewMode === 'week' ? 1 : 2
                return (
                  <div
                    className="absolute inset-y-0 w-1/3 bg-[var(--ds-bg-surface)] rounded-xl shadow-sm dark:ring-1 dark:ring-white/[0.09] pointer-events-none transition-transform duration-200 ease-[cubic-bezier(0.4,0,0.2,1)]"
                    style={{ transform: `translateX(${idx * 100}%)` }}
                  />
                )
              })()}
              {([
                { mode: 'day',   icon: 'calendar_today',     labelKey: 'view_day' },
                { mode: 'week',  icon: 'calendar_view_week', labelKey: 'view_week' },
                { mode: 'month', icon: 'calendar_month',     labelKey: 'view_month' },
              ] as const).map(({ mode, icon, labelKey }) => {
                const label = t(labelKey as Parameters<typeof t>[0])
                return (
                <button
                  key={mode}
                  onClick={() => switchViewMode(mode)}
                  className={`relative z-10 w-[72px] flex items-center justify-center gap-1.5 py-1.5 text-[10px] font-black uppercase transition-colors duration-150 ${viewMode === mode ? 'text-[var(--ds-text-1)]' : 'text-[var(--ds-text-3)] hover:text-[var(--ds-text-2)]'}`}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 15 }}>{icon}</span>
                  {label}
                </button>
              )})}
            </div>

            {/* Divider */}
            <div className="w-px h-5 bg-[var(--ds-border)] mx-0.5 shrink-0" />

            {/* Dept filter */}
            <div ref={deptRef} className="relative">
              <button
                onClick={() => { setDeptOpen(!deptOpen); if (!deptOpen) setDeptSearch('') }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase transition-all
                  ${deptFilter ? 'bg-[var(--ds-bg-surface)] shadow text-[var(--ds-text-1)] dark:ring-1 dark:ring-white/[0.09]' : 'text-[var(--ds-text-3)] hover:text-[var(--ds-text-2)]'}`}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>filter_list</span>
                {deptFilter || 'Dept'}
                {deptFilter && (
                  <span
                    onClick={e => { e.stopPropagation(); switchDept('') }}
                    className="material-symbols-outlined text-[var(--ds-text-3)] hover:text-[var(--ds-text-1)] transition-colors"
                    style={{ fontSize: 13 }}
                  >close</span>
                )}
              </button>
              {deptOpen && (
                <div className="dropdown-enter-right absolute top-full right-0 mt-2 w-[164px] rounded-2xl shadow-2xl z-[300] overflow-hidden" style={{ background: 'var(--ds-glass-bg)', backdropFilter: 'blur(32px)', border: '1px solid var(--ds-glass-border)' }}>
                  <div className="px-2.5 pt-2.5 pb-1.5">
                    <input type="text" placeholder="Search dept..." value={deptSearch}
                      onChange={e => setDeptSearch(e.target.value)} autoFocus
                      className="w-full bg-[var(--ds-bg-raised)] border border-[var(--ds-border)] rounded-lg px-2.5 py-1.5 text-[10px] font-bold text-[var(--ds-text-1)] outline-none focus:border-[#adee2b] transition-all" />
                  </div>
                  <div className="pb-1.5">
                    {(!deptSearch || 'all depts'.includes(deptSearch.toLowerCase())) && (
                      <button onClick={() => { switchDept(''); setDeptOpen(false); setDeptSearch('') }}
                        className="w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-[#adee2b] transition-colors text-left">
                        <span className="size-5 rounded-md bg-[var(--ds-bg-raised)] flex items-center justify-center shrink-0">
                          <span className="material-symbols-outlined text-[var(--ds-text-3)]" style={{ fontSize: 11 }}>layers</span>
                        </span>
                        <span className="text-[10px] font-black uppercase text-[var(--ds-text-1)]">All Depts</span>
                      </button>
                    )}
                    {filteredDepts.map(d => (
                      <button key={d} onClick={() => { switchDept(d); setDeptOpen(false); setDeptSearch('') }}
                        className="w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-[#adee2b] transition-colors text-left">
                        <span className="size-5 rounded-md bg-[var(--ds-bg-raised)] flex items-center justify-center shrink-0 text-[8px] font-black text-[var(--ds-text-2)]">{d.slice(0, 2)}</span>
                        <span className="text-[10px] font-black uppercase text-[var(--ds-text-1)]">{d}</span>
                      </button>
                    ))}
                    {filteredDepts.length === 0 && deptSearch && (
                      <p className="px-3 py-3 text-[10px] text-[var(--ds-text-3)] font-bold">No results</p>
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
        <main key={ganttKey} className="flex-1 overflow-auto bg-[var(--ds-bg-base)] relative select-none" style={{ animation: ganttAnimCSS[ganttAnim], scrollbarWidth: 'thin' }}>
          {roomsLoading && (
            <div className="absolute inset-0 bg-[var(--ds-bg-base)]/80 flex items-center justify-center z-50">
              <span className="material-symbols-outlined animate-spin text-4xl text-[var(--ds-text-4)]">progress_activity</span>
            </div>
          )}
          <div style={{ minWidth: ROOM_W + 7 * 140 }}>
            {/* Week header */}
            <div className="sticky top-0 z-40 bg-[var(--ds-bg-surface)] border-b border-[var(--ds-border-sub)] shadow-sm flex">
              <div
                className="shrink-0 flex items-center px-3 text-[9px] font-black text-[var(--ds-text-3)] uppercase tracking-widest border-r-2 border-[var(--ds-border)]"
                style={{ width: ROOM_W, height: CELL_H }}
              >Room</div>
              {weekDates.map((d, i) => {
                const isTd = d.toDateString() === today.toDateString()
                const showMonth = i === 0 || d.getMonth() !== weekDates[i - 1].getMonth()
                const isColLoading = weekResults[i]?.isLoading
                const visibleRoomIds = new Set(filteredRooms.map((r: Room) => r.id))
                const hasMyBooking = (weekData[i] ?? []).some((b: Booking) =>
                  b.user_id === user?.id && b.status !== 'cancelled' && visibleRoomIds.has(b.room_id)
                )
                const dow = d.getDay()
                const isWeekend = (dow === 6 && wkSat) || (dow === 0 && wkSun)
                return (
                  <div key={i}
                    className={`flex-1 flex flex-col items-center justify-center border-r border-[var(--ds-border-sub)] cursor-pointer transition-colors group/wh
                      ${isTd
                        ? 'bg-[#adee2b]/10'
                        : isWeekend
                          ? 'bg-[var(--ds-bg-surface-2)] hover:bg-[#adee2b]/5'
                          : 'bg-[var(--ds-bg-surface)] hover:bg-[#adee2b]/5'
                      }`}
                    style={{ height: CELL_H }}
                    onClick={() => { setCurrentDate(d); switchViewMode('day') }}
                  >
                    <span className={`text-[9px] font-black uppercase tracking-wider ${isTd ? 'text-lime-600 dark:text-lime-400' : isWeekend ? 'text-red-400 group-hover/wh:text-red-500' : 'text-[var(--ds-text-3)] group-hover/wh:text-[var(--ds-text-2)]'}`}>
                      {d.toLocaleDateString('en-GB', { weekday: 'short' })}
                    </span>
                    <div className={`mt-0.5 flex items-center justify-center rounded-full text-[15px] font-black transition-colors`}
                      style={{ width: 30, height: 30, background: isTd ? '#000' : 'transparent', color: isTd ? '#adee2b' : isWeekend ? '#ef4444' : 'var(--ds-text-1)' }}>
                      {d.getDate()}
                    </div>
                    {showMonth && !isColLoading && (
                      <span className="text-[8px] font-bold text-[var(--ds-text-4)] mt-0.5">
                        {d.toLocaleDateString('en-GB', { month: 'short' }).toUpperCase()}
                      </span>
                    )}
                    {isColLoading && (
                      <span className="material-symbols-outlined animate-spin text-[var(--ds-text-4)] mt-0.5" style={{ fontSize: 10 }}>progress_activity</span>
                    )}
                    {!isColLoading && hasMyBooking && (
                      <span className="size-1.5 rounded-full mt-0.5 shrink-0" style={{ background: '#72ddf7' }} />
                    )}
                  </div>
                )
              })}
            </div>

            {/* Empty search state — week view */}
            {search && filteredRooms.length === 0 && (
              <div className="flex flex-col items-center justify-center py-24 gap-3">
                <span className="material-symbols-outlined text-[var(--ds-text-4)]" style={{ fontSize: 48 }}>search_off</span>
                <p className="text-[11px] font-black text-[var(--ds-text-3)] uppercase tracking-widest">No rooms match "{search}"</p>
              </div>
            )}

            {/* Room rows */}
            {filteredRooms.map((room: Room) => {
              const dotColor = room.status === 'maintenance' ? 'bg-orange-400' : 'bg-slate-300'
              const occupied = isRoomOccupied(room)
              const isMaintRoom = room.status === 'maintenance'
              return (
                <div key={room.id} className={`flex border-b border-[var(--ds-border-sub)] group/row ${isMaintRoom ? 'hover:bg-orange-50/40 dark:hover:bg-orange-900/10' : 'hover:bg-[var(--ds-bg-raised)]'}`}>
                  {/* Room label — same style as day view, sticky */}
                  <div
                    className={`shrink-0 flex items-center justify-between px-3 border-r-2 sticky left-0 z-20 transition-colors cursor-pointer
                      ${isMaintRoom ? 'bg-orange-50 dark:bg-orange-950/20 border-orange-200 dark:border-orange-900/40 group-hover/row:bg-orange-100/50 dark:group-hover/row:bg-orange-900/20' : 'bg-[var(--ds-bg-surface)] border-[var(--ds-border)] group-hover/row:bg-[var(--ds-bg-raised)]'}`}
                    style={{ width: ROOM_W, height: WEEK_CELL_H }}
                    onClick={() => { setDetailRoom(room); setDetailOpen(true) }}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="min-w-0">
                        <span className={`text-[12px] font-black leading-tight block truncate ${isMaintRoom ? 'text-orange-600 dark:text-orange-400' : 'text-[var(--ds-text-1)]'}`}>{room.name}</span>
                        <span className={`text-[10px] font-bold flex items-center gap-1 mt-0.5 ${isMaintRoom ? 'text-orange-400 dark:text-orange-600' : 'text-[var(--ds-text-3)]'}`}>
                          {isMaintRoom
                            ? <><span className="material-symbols-outlined" style={{ fontSize: 10 }}>construction</span>Maintenance</>
                            : room.requires_contact
                              ? <SpecialRoomBadge size="xs" />
                              : <><span className="material-symbols-outlined" style={{ fontSize: 10 }}>groups</span>{room.capacity} · {room.floor}</>
                          }
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* 7 day cells */}
                  {weekDates.map((d, dayIdx) => {
                    const isTd = d.toDateString() === today.toDateString()
                    const dow = d.getDay()
                    const isWeekend = (dow === 6 && wkSat) || (dow === 0 && wkSun)
                    const dayBookings = (weekData[dayIdx] ?? []).filter(
                      (b: Booking) => b.room_id === room.id && b.status !== 'cancelled'
                    )
                    return (
                      <div key={dayIdx}
                        className={`flex-1 border-r border-[var(--ds-border-sub)] px-1.5 py-2 overflow-hidden cursor-pointer transition-colors relative flex flex-col
                          ${isTd
                            ? 'bg-[#adee2b]/10 dark:bg-[#adee2b]/6'
                            : isWeekend
                              ? 'bg-[var(--ds-bg-surface-2)] hover:bg-[var(--ds-bg-raised)]'
                              : 'bg-[var(--ds-bg-surface)] hover:bg-[var(--ds-bg-raised)]'
                          }`}
                        style={{ height: WEEK_CELL_H }}
                        onClick={() => { setCurrentDate(d); switchViewMode('day') }}
                        onContextMenu={e => {
                          if (e.ctrlKey) return
                          e.preventDefault()
                          e.stopPropagation()
                          setCellCtxMenu({ room, slot: 4, date: d, x: e.clientX, y: e.clientY })
                        }}
                      >
                        {isTd && <div className="absolute top-0 left-0 right-0 h-0.5 bg-[#adee2b]/60 pointer-events-none" />}
                        {dayBookings.length === 0 ? (
                          <div className="flex-1 flex items-center justify-center">
                            <div className="w-4 h-0.5 bg-[var(--ds-border)] rounded-full" />
                          </div>
                        ) : (
                          <>
                            <div className="flex flex-row flex-wrap gap-0.5">
                              {dayBookings.map((b: Booking) => {
                                const isMe = b.user_id === user?.id
                                const isTentative = b.status === 'tentative'
                                const isMaint = b.type === 'maintenance' || b.type === 'repairment'
                                const bg = isMaint ? '#fb923c' : isMe ? (isTentative ? '#b0e8f8' : '#72ddf7') : (isTentative ? '#d1d5db' : '#adee2b')
                                const matchesSearch = !search || bookingMatchesSearch(b, search)
                                return (
                                  <div key={b.id}
                                    className={`rounded-sm shrink-0 hover:brightness-90 transition-all ${isMe ? 'cursor-pointer' : 'cursor-default'}`}
                                    style={{ height: 8, flex: '1 1 0', minWidth: 8, background: bg, opacity: search && !matchesSearch ? 0.15 : 1 }}
                                    onClick={e => { e.stopPropagation(); if (isMe) openEdit(b) }}
                                    onContextMenu={e => {
                                      if (e.ctrlKey) return
                                      e.preventDefault()
                                      e.stopPropagation()
                                      setWeekBarTooltip(null)
                                      if (isMe) setCtxMenu({ booking: b, x: e.clientX, y: e.clientY })
                                      else setOtherCtxMenu({ booking: b, x: e.clientX, y: e.clientY })
                                    }}
                                    onMouseEnter={e => setWeekBarTooltip({ booking: b, x: e.clientX, y: e.clientY })}
                                    onMouseMove={e => setWeekBarTooltip(prev => prev ? { ...prev, x: e.clientX, y: e.clientY } : null)}
                                    onMouseLeave={() => setWeekBarTooltip(null)}
                                  />
                                )
                              })}
                            </div>
                            <div className="mt-auto text-[7px] font-black text-[var(--ds-text-3)] text-center leading-none pt-0.5">
                              {dayBookings.length}
                            </div>
                          </>
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
        // startDay setting: 'mon' = Monday first (offset +6 mod 7), 'sun' = Sunday first (raw .getDay())
        const startOffset = startDay === 'sun'
          ? firstDay.getDay()
          : (firstDay.getDay() + 6) % 7
        const gridStart = new Date(firstDay)
        gridStart.setDate(1 - startOffset)
        const totalCells = Math.ceil((startOffset + lastDay.getDate()) / 7) * 7
        const cells = Array.from({ length: totalCells }, (_, i) => {
          const d = new Date(gridStart)
          d.setDate(gridStart.getDate() + i)
          return d
        })
        const bkgs = monthBookings as Booking[]
        const DOW_MON = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
        const DOW_SUN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
        const DOW = startDay === 'sun' ? DOW_SUN : DOW_MON
        const todayDateStr = toLocalDateStr(today)
        const regularRooms = (rooms as Room[]).filter(r => r.status !== 'maintenance')
        const totalCapacityMins = regularRooms.length * (HOUR_END - HOUR_START) * 60
        const regularRoomIds = new Set(regularRooms.map(r => r.id))
        return (
          <main key={ganttKey} className="flex-1 overflow-auto bg-[var(--ds-bg-base)] p-6" style={{ animation: ganttAnimCSS[ganttAnim] }}>
            {/* Month header */}
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-[28px] font-black text-[var(--ds-text-1)] uppercase tracking-tight leading-none">
                {currentDate.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }).toUpperCase()}
              </h2>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => navDate(false)}
                  className="px-2.5 py-2 text-[var(--ds-text-3)] hover:bg-[var(--ds-bg-raised)] rounded-l-xl border border-[var(--ds-border)] transition-colors"
                >
                  <span className="material-symbols-outlined text-lg">chevron_left</span>
                </button>
                <button
                  onClick={() => navDate(true)}
                  className="px-2.5 py-2 text-[var(--ds-text-3)] hover:bg-[var(--ds-bg-raised)] rounded-r-xl border border-[var(--ds-border)] border-l-0 transition-colors"
                >
                  <span className="material-symbols-outlined text-lg">chevron_right</span>
                </button>
              </div>
            </div>

            {/* Day-of-week header */}
            <div className="grid grid-cols-7 mb-1">
              {DOW.map(d => {
                const isWkHeader = (d === 'Sat' && wkSat) || (d === 'Sun' && wkSun)
                return (
                  <div key={d} className={`text-center py-2 text-[11px] font-black uppercase tracking-widest ${isWkHeader ? 'text-red-400' : 'text-[var(--ds-text-3)]'}`}>{d}</div>
                )
              })}
            </div>

            {/* Calendar grid */}
            <div className="grid grid-cols-7 border-l border-t border-[var(--ds-border-sub)]">
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
                const visibleBkgs = dayBkgs.slice(0, 6)
                const overflow = dayBkgs.length - 6
                const cellDow = cellDate.getDay()
                const isCellWeekend = (cellDow === 6 && wkSat) || (cellDow === 0 && wkSun)
                const isPast = cellStr < todayDateStr

                // Usage % — only for today + future cells in current month
                let usagePct = 0
                if (isCurrentMonth && !isPast && totalCapacityMins > 0) {
                  let totalBookedMins = 0
                  dayBkgs.forEach(b => {
                    if (!regularRoomIds.has(b.room_id)) return
                    const s = new Date(b.start_at.replace('Z', ''))
                    const e = new Date(b.end_at.replace('Z', ''))
                    const sMins = Math.max(s.getHours() * 60 + s.getMinutes(), HOUR_START * 60)
                    const eMins = Math.min(e.getHours() * 60 + e.getMinutes(), HOUR_END * 60)
                    totalBookedMins += Math.max(0, eMins - sMins)
                  })
                  usagePct = Math.min(100, Math.round(totalBookedMins / totalCapacityMins * 100))
                }

                const usageColor = usagePct >= 80 ? '#ef4444' : usagePct >= 50 ? '#f59e0b' : '#adee2b'
                const showUsage = isCurrentMonth && !isPast && totalCapacityMins > 0

                return (
                  <div
                    key={idx}
                    onClick={() => { setCurrentDate(cellDate); switchViewMode('day') }}
                    onContextMenu={e => {
                      if (e.ctrlKey) return
                      e.preventDefault()
                      e.stopPropagation()
                      setCellCtxMenu({ room: null, slot: 4, date: cellDate, x: e.clientX, y: e.clientY })
                    }}
                    className={`min-h-[110px] border-r border-b border-[var(--ds-border-sub)] p-2 cursor-pointer transition-colors group flex flex-col
                      ${isCurrentMonth ? 'bg-[var(--ds-bg-surface)] hover:bg-[#adee2b]/5' : 'bg-[var(--ds-bg-base)] hover:bg-[var(--ds-bg-surface-2)]'}
                      ${isTodayCell ? 'ring-2 ring-inset ring-[#adee2b]' : ''}`}
                  >
                    {/* Date number + dots */}
                    <div className="flex items-center justify-between mb-1">
                      <span
                        className={`flex items-center justify-center w-8 h-8 rounded-full text-[16px] font-black transition-colors
                          ${isTodayCell ? 'bg-black text-[#adee2b]' : isCurrentMonth ? (isCellWeekend ? 'text-red-500 group-hover:bg-red-50 dark:group-hover:bg-red-900/20' : 'text-[var(--ds-text-1)] group-hover:bg-[var(--ds-bg-raised)]') : (isCellWeekend ? 'text-red-300/50' : 'text-[var(--ds-text-4)]')}`}
                      >
                        {cellDate.getDate()}
                      </span>
                      {(myBkgs.length > 0 || otherBkgs.length > 0) && (
                        <div className="flex items-center gap-0.5">
                          {myBkgs.length > 0 && <span className="size-1.5 rounded-full" style={{ background: '#72ddf7' }} />}
                          {otherBkgs.length > 0 && <span className="size-1.5 rounded-full" style={{ background: '#adee2b' }} />}
                        </div>
                      )}
                    </div>

                    {/* Booking bars — horizontal stack */}
                    <div className="flex flex-row flex-wrap gap-0.5">
                      {visibleBkgs.map(b => {
                        const isMe = b.user_id === user?.id
                        const isTentative = b.status === 'tentative'
                        const isMaint = b.type === 'maintenance' || b.type === 'repairment'
                        const bg = isMaint ? '#fb923c' : isMe ? (isTentative ? '#b0e8f8' : '#72ddf7') : (isTentative ? '#d1d5db' : '#adee2b')
                        const start = new Date(b.start_at.replace('Z', ''))
                        const hh = String(start.getHours()).padStart(2, '0')
                        const mm = String(start.getMinutes()).padStart(2, '0')
                        return (
                          <div
                            key={b.id}
                            onClick={e => { e.stopPropagation(); if (isMe) openEdit(b) }}
                            onContextMenu={e => {
                              if (e.ctrlKey) return
                              e.preventDefault()
                              e.stopPropagation()
                              setWeekBarTooltip(null)
                              if (isMe) setCtxMenu({ booking: b, x: e.clientX, y: e.clientY })
                              else setOtherCtxMenu({ booking: b, x: e.clientX, y: e.clientY })
                            }}
                            className={`rounded-sm shrink-0 hover:brightness-90 transition-all ${isMe ? 'cursor-pointer' : 'cursor-default'}`}
                            style={{ height: 5, width: 18, background: bg }}
                            onMouseEnter={e => setWeekBarTooltip({ booking: b, x: e.clientX, y: e.clientY })}
                            onMouseMove={e => setWeekBarTooltip(prev => prev ? { ...prev, x: e.clientX, y: e.clientY } : null)}
                            onMouseLeave={() => setWeekBarTooltip(null)}
                          />
                        )
                      })}
                      {overflow > 0 && (
                        <p className="text-[7px] font-black text-[var(--ds-text-3)] leading-none self-end">+{overflow}</p>
                      )}
                    </div>

                    {/* Usage bar — pinned to bottom, today + future only */}
                    <div className="mt-auto pt-2">
                      {showUsage && (
                        <div className="relative group/usagebar" onClick={e => e.stopPropagation()}>
                          {/* Fluent tooltip */}
                          <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 opacity-0 group-hover/usagebar:opacity-100 transition-opacity duration-150 pointer-events-none z-50 whitespace-nowrap">
                            <div style={{
                              background: 'rgba(15,20,45,0.72)',
                              backdropFilter: 'blur(28px) saturate(180%)',
                              WebkitBackdropFilter: 'blur(28px) saturate(180%)',
                              border: '1px solid rgba(255,255,255,0.10)',
                              borderRadius: 10,
                              padding: '6px 10px',
                              boxShadow: '0 8px 32px rgba(0,0,0,0.40), inset 0 1px 0 rgba(255,255,255,0.08)',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 6,
                            }}>
                              <span style={{ width: 8, height: 8, borderRadius: '50%', background: usageColor, display: 'inline-block', flexShrink: 0 }} />
                              <span style={{ color: 'rgba(255,255,255,0.55)', fontSize: 10, fontWeight: 700 }}>Room usage</span>
                              <span style={{ color: usageColor, fontSize: 12, fontWeight: 900 }}>{usagePct}%</span>
                              <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: 9, fontWeight: 600 }}>· {regularRooms.length} rooms</span>
                            </div>
                            {/* Arrow */}
                            <div style={{ width: 0, height: 0, margin: '0 auto', borderLeft: '5px solid transparent', borderRight: '5px solid transparent', borderTop: '5px solid rgba(15,20,45,0.72)' }} />
                          </div>
                          {/* Bar + inline % */}
                          <div className="flex items-center gap-1">
                            <div className="flex-1 h-[3px] rounded-full overflow-hidden" style={{ background: 'var(--ds-border)' }}>
                              <div className="h-full rounded-full transition-all duration-500" style={{ width: `${usagePct}%`, background: usageColor }} />
                            </div>
                            <span className="text-[8px] font-black shrink-0 tabular-nums" style={{ color: 'var(--ds-text-3)' }}>{usagePct}%</span>
                          </div>
                        </div>
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
      <main key={ganttKey} ref={mainRef} className="flex-1 overflow-auto relative select-none" style={{ animation: ganttAnimCSS[ganttAnim], background: 'var(--ds-bg-surface)', scrollbarWidth: 'thin' }}>
        {(roomsLoading || bookingsLoading) && (
          <div className="absolute inset-0 bg-[var(--ds-bg-base)]/70 flex items-center justify-center z-50">
            <span className="material-symbols-outlined animate-spin text-4xl text-[var(--ds-text-4)]">progress_activity</span>
          </div>
        )}
        <div style={{ width: ROOM_W + slots * SLOT_W, minWidth: '100%' }}>

          {/* Header row */}
          <div className="sticky top-0 z-40 border-b shadow-sm flex" style={{ background: 'var(--ds-bg-surface)', borderColor: 'var(--ds-border)' }}>
            <div className="shrink-0 flex items-center px-3 text-[9px] font-black text-[var(--ds-text-3)] uppercase tracking-widest border-r-2 border-[var(--ds-border)]"
              style={{ width: ROOM_W, height: CELL_H }}>Room</div>
            {Array.from({ length: HOUR_END - HOUR_START }, (_, i) => {
              const h = HOUR_START + i
              return (
                <div key={h} style={{ width: SLOT_W * 2, height: CELL_H }} className="flex shrink-0">
                  <div className="flex-1 flex items-center justify-center text-[13px] font-black text-[var(--ds-text-1)] border-r-2 border-[var(--ds-border)] border-b border-b-[var(--ds-border-sub)]">
                    {h}:00
                  </div>
                  <div className="flex-1 flex items-center justify-center text-[10px] font-medium text-[var(--ds-text-3)] border-r border-[var(--ds-border-sub)] border-b border-b-[var(--ds-border-sub)]">
                    {h}:30
                  </div>
                </div>
              )
            })}
          </div>

          {/* Empty search state — day view */}
          {search && filteredRooms.length === 0 && (
            <div className="flex flex-col items-center justify-center py-32 gap-3">
              <span className="material-symbols-outlined text-[var(--ds-text-4)]" style={{ fontSize: 52 }}>search_off</span>
              <p className="text-[13px] font-black text-[var(--ds-text-3)] uppercase tracking-widest">No results for "{search}"</p>
              <p className="text-[10px] font-bold text-[var(--ds-text-4)]">Try searching by title, user, dept, room, or time</p>
            </div>
          )}

          {/* Room rows */}
          {filteredRooms.map((room: Room) => {
            const roomBookings = getBookingsForRoom(room.id)
            const dotColor = room.status === 'maintenance' ? 'bg-orange-400' : 'bg-green-400'
            const occupied  = isRoomOccupied(room)
            const isMaintRoom = room.status === 'maintenance'

            const isCellDragRow = cellDragRef.current?.roomId === room.id
            const cellDragMinSlot = cellDragRef.current ? Math.min(cellDragRef.current.startSlot, cellDragRef.current.endSlot) : -1
            const cellDragMaxSlot = cellDragRef.current ? Math.max(cellDragRef.current.startSlot, cellDragRef.current.endSlot) : -1

            return (
              <div key={room.id} className={`flex group/row relative border-b border-[var(--ds-border-sub)] ${isMaintRoom ? 'hover:bg-orange-50/60 dark:hover:bg-orange-900/10' : 'hover:bg-[var(--ds-bg-raised)]'}`}>
                {/* Room label */}
                <div
                  className={`shrink-0 flex items-center justify-between px-3 border-r-2 group/room cursor-pointer sticky left-0 z-20 transition-colors
                    ${isMaintRoom
                      ? 'bg-orange-50 dark:bg-orange-950/20 border-orange-200 dark:border-orange-900/40 group-hover/row:bg-orange-100/60 dark:group-hover/row:bg-orange-900/20'
                      : 'bg-[var(--ds-bg-surface)] border-[var(--ds-border)] group-hover/row:bg-[var(--ds-bg-raised)]'}`}
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
                    <div className="min-w-0">
                      <span className={`text-[13px] font-black leading-tight block truncate ${isMaintRoom ? 'text-orange-600 dark:text-orange-400' : 'text-[var(--ds-text-1)]'}`}>{room.name}</span>
                      <span className={`text-[11px] font-bold flex items-center gap-1 mt-0.5 ${isMaintRoom ? 'text-orange-400 dark:text-orange-600' : 'text-[var(--ds-text-3)]'}`}>
                        {isMaintRoom
                          ? <><span className="material-symbols-outlined" style={{ fontSize: 11 }}>construction</span>Maintenance</>
                          : room.requires_contact
                            ? <span onMouseEnter={() => setRoomHover(null)}><SpecialRoomBadge size="xs" /></span>
                            : <><span className="material-symbols-outlined" style={{ fontSize: 11 }}>groups</span>{room.capacity} &middot; {room.floor}</>
                        }
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => { setDetailRoom(room); setDetailOpen(true) }}
                    className={`size-6 rounded-lg items-center justify-center hidden group-hover/room:flex shrink-0 ${isMaintRoom ? 'bg-orange-100 dark:bg-orange-900/40 hover:bg-orange-400 text-orange-600 hover:text-white' : 'bg-[var(--ds-bg-raised)] hover:bg-[#adee2b]'}`}
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
                          className={`shrink-0 border-r border-[var(--ds-border-sub)] transition-colors cursor-cell
                            ${isCellSel ? 'bg-[#adee2b]/30' : 'hover:bg-[#adee2b]/5'}
                            ${(s + 1) % 2 === 0 ? 'border-r-[var(--ds-border)]' : ''}`}
                          style={{ width: SLOT_W, height: CELL_H }}
                          onMouseDown={e => {
                            if (e.button !== 0) return
                            e.preventDefault()
                            const s2 = getSlotFromClientX(e.clientX)
                            cellDragRef.current = { roomId: room.id, room, startSlot: s2, endSlot: s2 }
                            setDragTick(t => t + 1)
                          }}
                          onContextMenu={e => {
                            if (e.ctrlKey) return
                            e.preventDefault()
                            const slot = getSlotFromClientX(e.clientX)
                            setCellCtxMenu({ room, slot, date: currentDate, x: e.clientX, y: e.clientY })
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
                        ref={b.id === highlightId ? highlightRef : undefined}
                        style={{ left, width, height: CELL_H, opacity: search && !matchesSearch ? 0.18 : 1, transition: isDragging ? 'none' : 'left 0.12s cubic-bezier(0.4,0,0.2,1), width 0.12s cubic-bezier(0.4,0,0.2,1), opacity 0.2s', willChange: isDragging ? 'left,width' : undefined, borderRadius: b.id === highlightId ? 8 : undefined }}
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
                          showTitle={showBarTitle}
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
      <footer className="bg-[var(--ds-bg-surface)] border-t border-[var(--ds-border-sub)] px-8 py-2.5 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-5">
          {[
            { label: 'My Booking', style: { backgroundColor: '#72ddf7' } },
            { label: 'My Tentative', style: { backgroundColor: '#b0e8f8', backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 2px, rgba(0,0,0,0.1) 2px, rgba(0,0,0,0.1) 4px)' } },
            { label: 'Confirmed', style: { backgroundColor: '#adee2b' } },
            { label: 'Tentative', style: { backgroundColor: '#d1d5db', backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 2px, rgba(0,0,0,0.1) 2px, rgba(0,0,0,0.1) 4px)' } },
            { label: 'Maintenance', style: { backgroundColor: '#fb923c' } },
          ].map(l => (
            <div key={l.label} className="flex items-center gap-1.5">
              <div className="size-2.5 rounded-md" style={l.style} />
              <span className="text-[8px] font-bold text-[var(--ds-text-3)] uppercase">{l.label}</span>
            </div>
          ))}
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-0.5 bg-red-500" />
            <span className="text-[8px] font-bold text-[var(--ds-text-3)] uppercase">Now</span>
          </div>
          <div className="flex items-center gap-1.5 border-l border-[var(--ds-border-sub)] pl-4">
            <span className="material-symbols-outlined text-[var(--ds-text-4)]" style={{ fontSize: 12 }}>drag_pan</span>
            <span className="text-[8px] font-bold text-[var(--ds-text-4)] uppercase">Drag bar to move &middot; drag edge to resize &middot; drag cell to create</span>
          </div>
        </div>
        <p className="text-[8px] font-black text-[var(--ds-text-4)] uppercase tracking-widest italic">RoomSync Pro v2.1 &middot; 2026</p>
      </footer>

      {/* Booking Tooltip */}
      {tooltip.booking && <BookingTooltip
        booking={tooltip.booking} pos={tooltip.pos} visible={tooltip.visible}
        onMouseEnter={() => { if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current) }}
        onMouseLeave={hideTooltip}
        currentUserId={user?.id ?? 0}
        onEdit={openEdit}
        onCancel={b => { setCancelTarget(b); setTooltip(prev => ({ ...prev, visible: false })) }}
        onCancelSeries={b => {
          setTooltip(prev => ({ ...prev, visible: false }))
          if (b.series_id) setSeriesCancelTarget(b)
        }}
      />}

      {/* Week/Month bar glass tooltip */}
      {weekBarTooltip && (() => {
        const b = weekBarTooltip.booking
        const isMe = b.user_id === user?.id
        const tStyle: Record<string, { bg: string; text: string; label: string }> = {
          internal: { bg: 'var(--ds-type-int-bg)', text: 'var(--ds-type-int-text)', label: 'Internal' },
          external: { bg: 'var(--ds-type-ext-bg)', text: 'var(--ds-type-ext-text)', label: 'External' },
        }
        const ts = tStyle[b.type] ?? tStyle.internal
        const tx = Math.min(weekBarTooltip.x + 14, window.innerWidth - 240)
        const ty = Math.max(8, weekBarTooltip.y - 100)
        return (
          <div className="fixed pointer-events-none z-[9999]" style={{ left: tx, top: ty }}>
            <div style={{
              background: 'var(--ds-glass-bg)',
              backdropFilter: 'blur(32px) saturate(180%)',
              WebkitBackdropFilter: 'blur(32px) saturate(180%)',
              border: '1px solid var(--ds-glass-border)',
              boxShadow: 'var(--ds-glass-shadow)',
              borderRadius: 14,
              padding: '10px 14px',
              minWidth: 200,
            }}>
              <div className="flex items-center gap-1.5 mb-1.5">
                <span className="text-[8px] font-black uppercase px-2 py-0.5 rounded-full" style={{ background: isMe ? '#72ddf7' : '#adee2b', color: '#000' }}>
                  {isMe ? 'My booking' : 'Other'}
                </span>
                <span className="text-[8px] font-black uppercase px-2 py-0.5 rounded-full" style={{ backgroundColor: ts.bg, color: ts.text }}>{ts.label}</span>
              </div>
              <p className="text-[12px] font-black text-[var(--ds-text-1)] leading-tight">{b.title}</p>
              {b.room && <p className="text-[10px] font-bold text-[var(--ds-text-3)] mt-0.5">{b.room.name}</p>}
              <p className="text-[11px] font-black text-[var(--ds-text-2)] tabular-nums mt-1">{fmtTime(b.start_at)} – {fmtTime(b.end_at)}</p>
            </div>
          </div>
        )
      })()}

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
              background: 'var(--ds-glass-bg)',
              backdropFilter: 'blur(48px) saturate(200%)',
              WebkitBackdropFilter: 'blur(48px) saturate(200%)',
              border: '1px solid var(--ds-glass-border)',
              borderRadius: '1.5rem',
              width: 288,
              overflow: 'hidden',
              boxShadow: 'var(--ds-glass-shadow)',
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
                <p className="text-[17px] font-black text-[var(--ds-text-1)] leading-tight">{roomHover.room.name}</p>
                <div className="flex items-center gap-3 mt-2">
                  <span className="text-[11px] font-bold text-[var(--ds-text-2)] flex items-center gap-1">
                    <span className="material-symbols-outlined text-[var(--ds-text-3)]" style={{ fontSize: 12 }}>groups</span>
                    {roomHover.room.capacity} seats
                  </span>
                  <span className="text-[11px] font-bold text-[var(--ds-text-3)]">Floor {roomHover.room.floor}</span>
                </div>
                <div className="flex flex-wrap gap-1 mt-3">
                  {(roomHover.room.facilities ?? []).slice(0, 5).map(f => (
                    <span key={f.name} className="flex items-center gap-1 bg-[var(--ds-bg-raised)] px-2 py-0.5 rounded-full text-[8px] font-bold text-[var(--ds-text-2)]">
                      <span className="material-symbols-outlined text-[var(--ds-text-3)]" style={{ fontSize: 9 }}>{f.icon}</span>
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
        buildingId={editBooking ? (editBooking.room?.building_id ?? null) : (location?.id ?? null)}
        onSubmit={() => {
          setBookingPanelOpen(false)
          queryClient.invalidateQueries({ queryKey: ['bookings', dateStr] })
          setToastMsg('Booking saved successfully')
          if (toastTimer.current) clearTimeout(toastTimer.current)
          toastTimer.current = setTimeout(() => setToastMsg(null), 3500)
        }}
        onCancel={(b) => { setBookingPanelOpen(false); setCancelTarget(b) }}
        onAfterHoursOpen={(data) => {
          setBookingPanelOpen(false)
          setAfterHoursData(data)
          setAfterHoursOpen(true)
        }}
      />

      <AfterHoursModal
        open={afterHoursOpen}
        onClose={() => setAfterHoursOpen(false)}
        workingHoursEnd={afterHoursData?.workingHoursEnd ?? '17:00'}
        buildingId={afterHoursData?.buildingId}
        onChangeTime={() => {
          setAfterHoursOpen(false)
          setSelectedRoom(null)
          setPrefillStart('')
          setPrefillEnd('')
          setBookingPanelOpen(true)
        }}
      />

      {/* Contact Receptionist modal (requires_contact rooms) */}
      <ContactReceptionistModal
        open={contactOpen}
        onClose={() => { setContactOpen(false); setContactRoom(null) }}
        roomName={contactRoom?.name}
        buildingId={contactRoom?.building_id}
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
                background: 'var(--ds-glass-bg)',
                backdropFilter: 'blur(48px) saturate(180%)',
                WebkitBackdropFilter: 'blur(48px) saturate(180%)',
                border: '1px solid var(--ds-glass-border)',
                borderRadius: 14,
                boxShadow: 'var(--ds-glass-shadow)',
                padding: 5,
                animation: 'ctx-in 0.15s cubic-bezier(0.4,0,0.2,1)',
                transformOrigin: 'top left',
              }}
            >
              {/* Header */}
              <div className="px-3.5 pt-2.5 pb-2">
                <p className="text-[9px] font-black uppercase tracking-widest text-[var(--ds-text-3)] truncate">{otherCtxMenu.booking.user?.name}</p>
              </div>
              <div style={{ height: 1, background: 'var(--ds-border)', marginBottom: 4 }} />

              {/* Copy Ext */}
              <button
                onClick={() => {
                  navigator.clipboard.writeText(otherCtxMenu.booking.user?.ext || '')
                  setOtherCtxMenu(null)
                  setToastMsg(`Ext ${otherCtxMenu.booking.user?.ext} copied`)
                  if (toastTimer.current) clearTimeout(toastTimer.current)
                  toastTimer.current = setTimeout(() => setToastMsg(null), 2500)
                }}
                className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-[9px] text-left transition-colors hover:bg-[#adee2b]/25"
              >
                <span className="material-symbols-outlined text-[var(--ds-text-2)]" style={{ fontSize: 15 }}>phone_in_talk</span>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-black uppercase text-[var(--ds-text-1)] leading-none">Copy Ext</p>
                  <p className="text-[9px] font-bold text-[var(--ds-text-3)] mt-0.5">{otherCtxMenu.booking.user?.ext}</p>
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
                className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-[9px] text-left transition-colors hover:bg-[#adee2b]/25"
              >
                <span className="material-symbols-outlined text-[var(--ds-text-2)]" style={{ fontSize: 15 }}>mail</span>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-black uppercase text-[var(--ds-text-1)] leading-none">Copy Email</p>
                  <p className="text-[9px] font-bold text-[var(--ds-text-3)] mt-0.5 truncate">{otherCtxMenu.booking.user?.email}</p>
                </div>
              </button>

              <div style={{ height: 1, background: 'var(--ds-border)', margin: '4px 0' }} />

              {/* View Room */}
              <button
                onClick={() => {
                  setDetailRoom(otherCtxMenu.booking.room || null)
                  setDetailOpen(true)
                  setOtherCtxMenu(null)
                }}
                className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-[9px] text-left transition-colors hover:bg-[#adee2b]/25"
              >
                <span className="material-symbols-outlined text-[var(--ds-text-2)]" style={{ fontSize: 15 }}>open_in_new</span>
                <span className="text-[11px] font-black uppercase text-[var(--ds-text-1)]">View Room Detail</span>
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
                background: 'var(--ds-glass-bg)',
                backdropFilter: 'blur(48px) saturate(180%)',
                WebkitBackdropFilter: 'blur(48px) saturate(180%)',
                border: '1px solid var(--ds-glass-border)',
                borderRadius: 14,
                boxShadow: 'var(--ds-glass-shadow)',
                padding: 5,
                animation: 'ctx-in 0.15s cubic-bezier(0.4,0,0.2,1)',
                transformOrigin: 'top left',
              }}
            >
              {/* Header — room + time */}
              <div className="px-3.5 pt-2.5 pb-2">
                <p className="text-[9px] font-black uppercase tracking-widest text-[var(--ds-text-3)] truncate">
                  {cellCtxMenu.room ? cellCtxMenu.room.name : cellCtxMenu.date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                </p>
              </div>
              <div style={{ height: 1, background: 'var(--ds-border)', marginBottom: 4 }} />

              {/* New Booking */}
              <button
                onClick={() => {
                  setCurrentDate(cellCtxMenu.date)
                  setPrefillStart(slotToTimeStr(cellCtxMenu.slot))
                  setPrefillEnd(slotToTimeStr(Math.min(slots, cellCtxMenu.slot + 2)))
                  if (cellCtxMenu.room) setSelectedRoom(cellCtxMenu.room)
                  setEditBooking(null)
                  setBookingPanelOpen(true)
                  setCellCtxMenu(null)
                }}
                className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-[9px] text-left transition-colors hover:bg-[#adee2b]/25"
              >
                <span className="material-symbols-outlined text-[var(--ds-text-2)]" style={{ fontSize: 15 }}>add_circle</span>
                <span className="text-[11px] font-black uppercase text-[var(--ds-text-1)]">New Booking</span>
              </button>

              {/* View Room */}
              {cellCtxMenu.room && (
                <button
                  onClick={() => { setDetailRoom(cellCtxMenu.room); setDetailOpen(true); setCellCtxMenu(null) }}
                  className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-[9px] text-left transition-colors hover:bg-[#adee2b]/25"
                >
                  <span className="material-symbols-outlined text-[var(--ds-text-2)]" style={{ fontSize: 15 }}>open_in_new</span>
                  <span className="text-[11px] font-black uppercase text-[var(--ds-text-1)]">View Room</span>
                </button>
              )}
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
                background: 'var(--ds-glass-bg)',
                backdropFilter: 'blur(48px) saturate(180%)',
                WebkitBackdropFilter: 'blur(48px) saturate(180%)',
                border: '1px solid var(--ds-glass-border)',
                borderRadius: 14,
                boxShadow: 'var(--ds-glass-shadow)',
                padding: 5,
                animation: 'ctx-in 0.15s cubic-bezier(0.4,0,0.2,1)',
                transformOrigin: 'top left',
              }}
            >
              {/* Header — booking title */}
              <div className="px-3.5 pt-2.5 pb-2">
                <p className="text-[9px] font-black uppercase tracking-widest text-[var(--ds-text-3)] truncate">{ctxMenu.booking.title}</p>
              </div>
              <div style={{ height: 1, background: 'var(--ds-border)', marginBottom: 4 }} />

              {/* Edit */}
              <button
                onClick={() => { openEdit(ctxMenu.booking); setCtxMenu(null) }}
                className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-[9px] text-left transition-colors hover:bg-[#adee2b]/25"
              >
                <span className="material-symbols-outlined text-[var(--ds-text-2)]" style={{ fontSize: 15 }}>edit</span>
                <span className="text-[11px] font-black uppercase text-[var(--ds-text-1)]">Edit</span>
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

      {/* Cancel Series confirm modal */}
      {seriesCancelTarget && (
        <>
          <style>{`@keyframes modal-in{from{opacity:0;transform:scale(0.93) translateY(10px)}to{opacity:1;transform:scale(1) translateY(0)}}`}</style>
          <div
            className="fixed inset-0 z-[1000] flex items-center justify-center"
            style={{ background: 'rgba(0,0,0,0.28)', backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)' }}
            onClick={() => setSeriesCancelTarget(null)}
          >
            <div
              onClick={e => e.stopPropagation()}
              style={{
                width: 400,
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
              <div className="flex items-center gap-3.5 mb-6">
                <div className="size-11 rounded-2xl flex items-center justify-center shrink-0"
                  style={{ background: 'rgba(239,68,68,0.1)' }}>
                  <span className="material-symbols-outlined text-red-500 text-xl">link_off</span>
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">Cancel Entire Series?</h3>
                  <p className="text-xs text-slate-400 font-medium mt-0.5">All bookings in this series will be cancelled.</p>
                </div>
              </div>

              <div className="rounded-2xl p-4 mb-6 space-y-2.5"
                style={{ background: 'rgba(0,0,0,0.04)', border: '1px solid rgba(0,0,0,0.06)' }}>
                <p className="text-sm font-black text-slate-800">{seriesCancelTarget.title}</p>
                <div className="w-full h-px" style={{ background: 'rgba(0,0,0,0.07)' }} />
                <p className="text-xs font-bold text-slate-500 flex items-center gap-2">
                  <span className="material-symbols-outlined text-slate-400 shrink-0" style={{ fontSize: 14 }}>link</span>
                  Series booking — all occurrences
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setSeriesCancelTarget(null)}
                  className="flex-1 py-3 rounded-2xl text-[11px] font-black uppercase transition-colors"
                  style={{ background: 'rgba(0,0,0,0.06)', color: '#475569' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(0,0,0,0.10)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'rgba(0,0,0,0.06)')}
                >
                  Keep Bookings
                </button>
                <button
                  onClick={() => confirmSeriesCancel(seriesCancelTarget!)}
                  className="flex-1 py-3 rounded-2xl text-[11px] font-black uppercase bg-red-500 text-white hover:bg-red-600 transition-colors"
                >
                  Yes, Cancel Series
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
            {toastCountdown !== null ? (pendingSeriesId ? 'repeat' : 'cancel') : 'check_circle'}
          </span>
          <span className="text-white text-[13px] font-black flex-1">{toastMsg}</span>
          {toastCountdown !== null && (
            <>
              <span style={{ fontSize: 13, fontWeight: 900, color: 'rgba(255,255,255,0.45)', minWidth: 26, textAlign: 'right' }}>
                {toastCountdown}s
              </span>
              <button
                onClick={pendingSeriesId ? undoSeriesCancel : undoCancel}
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
