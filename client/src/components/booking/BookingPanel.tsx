import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { Booking, Building, Room } from '../../types/index'
import { getRooms, checkAvailability, clearRoomView, getAvailableRooms } from '../../api/rooms'
import { getBuildings } from '../../api/buildings'
import { createBooking, updateBooking, cancelSeries, updateSeries } from '../../api/bookings'
import { getDirectory } from '../../api/users'
import { useAuth } from '../../context/AuthContext'
import { useSettings } from '../../context/SettingsContext'
import { useBookingHours } from '../../hooks/useBookingHours'
import GlassDatePicker from '../ui/GlassDatePicker'
import GlassTimePicker from '../ui/GlassTimePicker'
import { SpecialRoomBadge } from '../ui/SpecialRoomBadge'

function fmtFieldDate(iso: string): string {
  if (!iso) return 'Select date'
  const [y, m, d] = iso.split('T')[0].split('-').map(Number)
  if (!y || !m || !d) return 'Select date'
  return new Date(y, m - 1, d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

function fmtShortDate(iso: string): string {
  if (!iso) return ''
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
}

function toMin(hhmm: string) { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m }
function fromMin(min: number) { return `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}` }

const DOW_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const
const DOW_LABELS: Record<string, string> = { mon: 'M', tue: 'T', wed: 'W', thu: 'T', fri: 'F', sat: 'S', sun: 'S' }
const DOW_FULL: Record<string, string> = { mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu', fri: 'Fri', sat: 'Sat', sun: 'Sun' }
// JS getDay() returns 0=Sun,1=Mon,...,6=Sat; our array index in DOW_KEYS: mon=0,...,sun=6
const JS_DOW_TO_KEY: Record<number, string> = { 0: 'sun', 1: 'mon', 2: 'tue', 3: 'wed', 4: 'thu', 5: 'fri', 6: 'sat' }
const KEY_TO_JS_DOW: Record<string, number> = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 }

interface BookingPanelProps {
  open: boolean
  onClose: () => void
  initialRoom?: Room | null
  editBooking?: Booking | null
  prefillStart?: string
  prefillEnd?: string
  prefillDate?: string
  prefillVersion?: number
  buildingId?: number | null
  onSubmit?: () => void
  onCancel?: (booking: Booking) => void
}

export default function BookingPanel({ open, onClose, initialRoom, editBooking, prefillStart, prefillEnd, prefillDate, prefillVersion, buildingId, onSubmit, onCancel }: BookingPanelProps) {
  const { user } = useAuth()
  const { defaultType, defaultBuilding } = useSettings()
  const { start: bsStr, end: beStr } = useBookingHours()
  const bookingStartMin = toMin(bsStr)
  const bookingEndMin   = toMin(beStr)
  const isPrivileged = user?.role === 'admin' || user?.role === 'receptionist'
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null)
  const [title, setTitle] = useState('')
  const [desc, setDesc] = useState('')
  const [date, setDate] = useState('')
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const [status, setStatus] = useState<'confirmed' | 'tentative'>('confirmed')
  const [type, setType] = useState<'internal' | 'external' | 'maintenance' | 'repairment'>(() => defaultType)
  const [repeat, setRepeat] = useState<'none' | 'daily' | 'weekly'>('none')
  // repeat sub-state
  const [repeatMode, setRepeatMode] = useState<'count' | 'until'>('count')
  const [repeatCount, setRepeatCount] = useState(5)
  const [repeatEndDate, setRepeatEndDate] = useState('')
  const [skipConflicts, setSkipConflicts] = useState(true)
  const [weeklyDays, setWeeklyDays] = useState<string[]>(['mon'])
  // pantry
  const [pantryOpen, setPantryOpen] = useState(false)
  const [coffeeQty, setCoffeeQty] = useState(2)
  const [teaQty, setTeaQty] = useState(0)
  const [waterQty, setWaterQty] = useState(5)
  const [snackQty, setSnackQty] = useState(0)
  const [pantrySaved, setPantrySaved] = useState(false)
  // book for
  const [bookFor, setBookFor] = useState('')
  const [bookForUserId, setBookForUserId] = useState<number | null>(null)
  const [showBookForDrop, setShowBookForDrop] = useState(false)
  const bookForRef = useRef<HTMLDivElement>(null)
  // room selector
  const [roomSearch, setRoomSearch] = useState('')
  const [showRoomDrop, setShowRoomDrop] = useState(false)
  const [hoverRoomPhoto, setHoverRoomPhoto] = useState<{ x: number; y: number; src: string } | null>(null)
  const [showMiniPanel, setShowMiniPanel] = useState(false)
  const [showBookFor, setShowBookFor] = useState(false)
  const [activeBuildingId, setActiveBuildingId] = useState<number | null>(buildingId ?? defaultBuilding ?? null)
  // submit
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  // conflict preview modal (all-or-nothing mode)
  const [conflictInfo, setConflictInfo] = useState<{ conflicting: string[]; available: string[]; seriesId: string } | null>(null)
  // skipped dates result modal (shown after skip-mode series completes)
  const [skippedResult, setSkippedResult] = useState<{ skipped: string[]; created: number; total: number } | null>(null)
  // cancel series modal
  const [showCancelModal, setShowCancelModal] = useState(false)

  const isEdit = !!editBooking
  const [glowActive, setGlowActive] = useState(false)
  const [availResult, setAvailResult] = useState<{ available: boolean; other_viewers: number } | null>(null)
  const [availChecking, setAvailChecking] = useState(false)
  const availTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  async function recheckAvailability() {
    if (!selectedRoom || !date || !startTime || !endTime) return
    setAvailChecking(true)
    try {
      const res = await checkAvailability(
        selectedRoom.id,
        `${date} ${startTime}:00`,
        `${date} ${endTime}:00`,
        isEdit && editBooking ? editBooking.id : undefined,
      )
      setAvailResult({ available: !!res.available, other_viewers: res.other_viewers ?? 0 })
    } catch {
      setAvailResult(null)
    } finally {
      setAvailChecking(false)
    }
  }

  const today = new Date().toISOString().split('T')[0]

  const { data: rooms = [] } = useQuery({ queryKey: ['rooms'], queryFn: getRooms })
  const { data: buildings = [] } = useQuery({ queryKey: ['buildings'], queryFn: getBuildings })
  const { data: directory = [] } = useQuery({ queryKey: ['user-directory'], queryFn: getDirectory, staleTime: 60_000 })
  const miniEnabled = open && showMiniPanel && !!selectedRoom && !!date
  const { data: miniRooms = [], isFetching: miniFetching } = useQuery<import('../../types/index').Room[]>({
    queryKey: ['avail-mini', selectedRoom?.id, date, bsStr, beStr],
    queryFn: () => getAvailableRooms(`${date}T${bsStr}:00`, `${date}T${beStr}:00`),
    enabled: miniEnabled,
    staleTime: 30_000,
  })
  const miniSlots = miniEnabled
    ? (miniRooms.find(r => r.id === selectedRoom?.id)?.available_slots ?? (miniFetching ? null : []))
    : null

  // Init/reset when panel opens
  useEffect(() => {
    if (!open) return
    if (editBooking) {
      setTitle(editBooking.title)
      setDesc(editBooking.description || '')
      setDate(editBooking.start_at.split('T')[0])
      setStartTime(editBooking.start_at.split('T')[1]?.slice(0, 5))
      setEndTime(editBooking.end_at.split('T')[1]?.slice(0, 5))
      setStatus(editBooking.status as 'confirmed' | 'tentative')
      setType(editBooking.type)
      setSelectedRoom(editBooking.room || null)
      setBookFor(editBooking.booked_for ?? '')
      setBookForUserId(editBooking.booked_for_user_id ?? null)
      setShowBookFor(!!(editBooking.booked_for))
      setShowMiniPanel(false)
    } else {
      setTitle('')
      setDesc('')
      setBookFor('')
      setBookForUserId(null)
      setShowBookFor(false)
      setShowMiniPanel(false)
      setDate(prefillDate || today)
      setStartTime(prefillStart || '')
      setEndTime(prefillEnd || '')
      setStatus('confirmed')
      setType('internal')
      setRepeat('none')
      setRepeatMode('count')
      setRepeatCount(5)
      setRepeatEndDate('')
      setSkipConflicts(true)
      setWeeklyDays(['mon'])
      setSelectedRoom(initialRoom || null)
      setPantrySaved(false)
    }
    setShowCancelModal(false)
    setError('')
    setConflictInfo(null)
    setSkippedResult(null)
    setActiveBuildingId(buildingId ?? defaultBuilding ?? null)
  }, [open, editBooking, initialRoom, prefillStart, prefillEnd, prefillDate])

  // Auto-set weeklyDays default to day of selected date when switching to weekly
  function handleRepeatChange(r: 'none' | 'daily' | 'weekly') {
    setRepeat(r)
    if (r === 'weekly' && date) {
      const [yy, mm, dd] = date.split('-').map(Number)
      const dow = new Date(yy, mm - 1, dd).getDay()
      setWeeklyDays([JS_DOW_TO_KEY[dow]])
    }
  }

  useEffect(() => {
    if (!open && selectedRoom) clearRoomView(selectedRoom.id)
  }, [open])

  useEffect(() => {
    if (!showBookForDrop) return
    const handler = (e: MouseEvent) => {
      if (bookForRef.current && !bookForRef.current.contains(e.target as Node)) {
        setShowBookForDrop(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showBookForDrop])

  // Glow border when prefill is updated while panel is already open
  useEffect(() => {
    if (!prefillVersion) return
    setGlowActive(true)
    const t = setTimeout(() => setGlowActive(false), 1400)
    return () => clearTimeout(t)
  }, [prefillVersion])

  // Real-time availability check (debounced, single-booking only)
  useEffect(() => {
    if (!open) { setAvailResult(null); setAvailChecking(false); return }
    if (!selectedRoom || !date || !startTime || !endTime) { setAvailResult(null); return }
    const [h1, m1] = startTime.split(':').map(Number)
    const [h2, m2] = endTime.split(':').map(Number)
    if ((h2 * 60 + m2) <= (h1 * 60 + m1)) { setAvailResult(null); return }

    setAvailChecking(true)
    if (availTimer.current) clearTimeout(availTimer.current)
    availTimer.current = setTimeout(async () => {
      try {
        const res = await checkAvailability(
          selectedRoom.id,
          `${date} ${startTime}:00`,
          `${date} ${endTime}:00`,
          isEdit && editBooking ? editBooking.id : undefined,
        )
        setAvailResult({ available: !!res.available, other_viewers: res.other_viewers ?? 0 })
      } catch {
        setAvailResult(null)
      } finally {
        setAvailChecking(false)
      }
    }, 600)
    return () => { if (availTimer.current) clearTimeout(availTimer.current) }
  }, [open, selectedRoom?.id, date, startTime, endTime, editBooking?.id])

  function getDuration() {
    if (!startTime || !endTime) return '— min'
    const [h1, m1] = startTime.split(':').map(Number)
    const [h2, m2] = endTime.split(':').map(Number)
    const total = (h2 * 60 + m2) - (h1 * 60 + m1)
    if (total <= 0) return 'Invalid'
    const h = Math.floor(total / 60)
    const m = total % 60
    return h && m ? `${h} hrs ${m} min` : h ? `${h} hrs` : `${m} min`
  }

  function toISO(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
  }

  // Generate all planned dates for a repeat series
  function generateRepeatDates(): string[] {
    if (repeat === 'none' || !date) return []
    const [yy, mm, dd] = date.split('-').map(Number)
    const startD = new Date(yy, mm - 1, dd)

    if (repeat === 'daily') {
      const dates: string[] = []
      if (repeatMode === 'count') {
        for (let i = 0; i < repeatCount; i++) {
          const d = new Date(startD); d.setDate(d.getDate() + i)
          dates.push(toISO(d))
        }
      } else {
        // until mode
        if (!repeatEndDate) return []
        const [ey, em, ed] = repeatEndDate.split('-').map(Number)
        const endD = new Date(ey, em - 1, ed)
        const cur = new Date(startD)
        while (cur <= endD) {
          dates.push(toISO(cur))
          cur.setDate(cur.getDate() + 1)
        }
      }
      return dates
    }

    if (repeat === 'weekly') {
      if (weeklyDays.length === 0) return []
      const selectedDows = weeklyDays.map(k => KEY_TO_JS_DOW[k])
      const dates: string[] = []
      if (repeatMode === 'count') {
        const endD = new Date(startD); endD.setDate(endD.getDate() + repeatCount * 7)
        const cur = new Date(startD)
        while (cur < endD) {
          if (selectedDows.includes(cur.getDay())) dates.push(toISO(cur))
          cur.setDate(cur.getDate() + 1)
        }
      } else {
        if (!repeatEndDate) return []
        const [ey, em, ed] = repeatEndDate.split('-').map(Number)
        const endD = new Date(ey, em - 1, ed)
        const cur = new Date(startD)
        while (cur <= endD) {
          if (selectedDows.includes(cur.getDay())) dates.push(toISO(cur))
          cur.setDate(cur.getDate() + 1)
        }
      }
      return dates
    }

    return []
  }

  function getRepeatSummary(): string {
    const dates = generateRepeatDates()
    if (dates.length === 0) return ''
    const last = dates[dates.length - 1]
    return `${dates.length} occurrence${dates.length !== 1 ? 's' : ''} · ends ${fmtShortDate(last)}`
  }

  function isTimeValid() {
    if (!startTime || !endTime) return null
    const [h1, m1] = startTime.split(':').map(Number)
    const [h2, m2] = endTime.split(':').map(Number)
    const s = h1 * 60 + m1
    const e = h2 * 60 + m2
    if (s < bookingStartMin || s > bookingEndMin - 30) return false
    if (e < bookingStartMin + 30 || e > bookingEndMin) return false
    return e > s
  }

  function isAvailable(): boolean | null {
    if (!isTimeValid()) return isTimeValid() === false ? false : null
    if (!selectedRoom) return null
    if (availChecking) return null
    return availResult?.available ?? null
  }

  const roomIsMaintenance = selectedRoom?.status === 'maintenance'
  const maintenanceBlocked = roomIsMaintenance && !isPrivileged
  const canBookDirectly = isPrivileged || user?.department === 'GAA'
  const showReceptionistNotice = !!(selectedRoom?.requires_contact && !canBookDirectly)

  function isValid() {
    if (maintenanceBlocked) return false
    if (!title.trim() || !startTime || !endTime || !selectedRoom) return false
    if (repeat !== 'none') {
      // For repeat: don't block on availability check (each slot checked individually on submit)
      return isTimeValid() === true
    }
    return isAvailable() === true
  }

  async function doSubmitSingle() {
    if (!selectedRoom) return
    const base = { room_id: selectedRoom.id, title, description: desc, status, type, booked_for: bookFor.trim() || undefined, booked_for_user_id: bookForUserId ?? undefined }
    if (isEdit && editBooking) {
      await updateBooking(editBooking.id, { ...base, start_at: `${date} ${startTime}:00`, end_at: `${date} ${endTime}:00` })
    } else {
      await createBooking({ ...base, start_at: `${date} ${startTime}:00`, end_at: `${date} ${endTime}:00` })
    }
    onSubmit?.()
  }

  async function doCreateBookings(datesToBook: string[], seriesId: string) {
    if (!selectedRoom) return
    const base = { room_id: selectedRoom.id, title, description: desc, status, type, booked_for: bookFor.trim() || undefined, booked_for_user_id: bookForUserId ?? undefined }
    let created = 0
    const skippedDates: string[] = []
    for (const d of datesToBook) {
      try {
        await createBooking({ ...base, start_at: `${d} ${startTime}:00`, end_at: `${d} ${endTime}:00`, series_id: seriesId })
        created++
      } catch { skippedDates.push(d) }
    }
    if (created === 0) { setError(`All ${datesToBook.length} slots had conflicts.`); return }
    if (skippedDates.length > 0) {
      setSkippedResult({ skipped: skippedDates, created, total: datesToBook.length })
    } else {
      onSubmit?.()
    }
  }

  async function doSubmitSeries() {
    if (!selectedRoom) return
    const dates = generateRepeatDates()
    if (dates.length === 0) { setError('No repeat dates configured.'); return }

    const seriesId = crypto.randomUUID()

    if (!skipConflicts) {
      // All-or-nothing: pre-check all slots first
      const checks = await Promise.all(
        dates.map(d =>
          checkAvailability(selectedRoom.id, `${d} ${startTime}:00`, `${d} ${endTime}:00`)
            .then(res => ({ date: d, available: !!res.available }))
            .catch(() => ({ date: d, available: false }))
        )
      )
      const conflicting = checks.filter(c => !c.available).map(c => c.date)
      if (conflicting.length > 0) {
        const available = checks.filter(c => c.available).map(c => c.date)
        setConflictInfo({ conflicting, available, seriesId })
        return
      }
      // No conflicts — create all
      await doCreateBookings(dates, seriesId)
      return
    }

    // Skip mode: create all, skip conflicts
    await doCreateBookings(dates, seriesId)
  }

  async function handleSubmit() {
    if (!isValid() || !selectedRoom) return
    setSubmitting(true)
    setError('')
    try {
      if (repeat === 'none') {
        await doSubmitSingle()
      } else {
        await doSubmitSeries()
      }
    } catch (err: unknown) {
      const e = err as { response?: { status?: number; data?: { message?: string } } }
      const status = e?.response?.status
      const msg = e?.response?.data?.message
      if (status === 422 && msg?.toLowerCase().includes('not available')) {
        setError('Someone just booked this room. Please choose another time or room.')
        recheckAvailability()
      } else {
        setError(msg || 'Failed to save booking.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  const filteredRooms = (rooms as Room[]).filter((r: Room) => {
    if (activeBuildingId && r.building_id !== activeBuildingId) return false
    const q = roomSearch.toLowerCase()
    return r.name.toLowerCase().includes(q) || (r.type?.toLowerCase() ?? '').includes(q)
  })

  const repeatDates = generateRepeatDates()
  const repeatSummary = getRepeatSummary()

  return (
    <>
      <style>{`
        @keyframes bp-glow-pulse {
          0%   { box-shadow: -20px 0 80px rgba(0,0,0,0.12); border-color: var(--ds-border); }
          15%  { box-shadow: -20px 0 80px rgba(0,0,0,0.12), inset 0 0 0 3px #adee2b, inset 0 0 80px rgba(173,238,43,0.35), inset 0 0 24px rgba(173,238,43,0.5); border-color: #adee2b; }
          38%  { box-shadow: -20px 0 80px rgba(0,0,0,0.12), inset 0 0 0 2px rgba(173,238,43,0.5), inset 0 0 40px rgba(173,238,43,0.15); border-color: rgba(173,238,43,0.6); }
          58%  { box-shadow: -20px 0 80px rgba(0,0,0,0.12), inset 0 0 0 3px #adee2b, inset 0 0 70px rgba(173,238,43,0.3), inset 0 0 20px rgba(173,238,43,0.45); border-color: #adee2b; }
          85%  { box-shadow: -20px 0 80px rgba(0,0,0,0.12), inset 0 0 0 2px rgba(173,238,43,0.4), inset 0 0 32px rgba(173,238,43,0.12); border-color: rgba(173,238,43,0.5); }
          100% { box-shadow: -20px 0 80px rgba(0,0,0,0.12); border-color: var(--ds-border); }
        }
        @keyframes field-glow-pulse {
          0%   { box-shadow: none; border-color: #e2e8f0; }
          15%  { box-shadow: 0 0 0 3px #adee2b, 0 0 18px rgba(173,238,43,0.7), 0 0 36px rgba(173,238,43,0.35); border-color: #adee2b; }
          40%  { box-shadow: 0 0 0 1px rgba(173,238,43,0.5), 0 0 10px rgba(173,238,43,0.3); border-color: rgba(173,238,43,0.6); }
          62%  { box-shadow: 0 0 0 3px #adee2b, 0 0 16px rgba(173,238,43,0.6), 0 0 30px rgba(173,238,43,0.3); border-color: #adee2b; }
          86%  { box-shadow: 0 0 0 1px rgba(173,238,43,0.35), 0 0 8px rgba(173,238,43,0.25); border-color: rgba(173,238,43,0.4); }
          100% { box-shadow: none; border-color: #e2e8f0; }
        }
        @keyframes duration-glow-pulse {
          0%   { box-shadow: none; }
          15%  { box-shadow: 0 0 0 3px #adee2b, 0 0 20px rgba(173,238,43,0.8), 0 0 40px rgba(173,238,43,0.4); }
          40%  { box-shadow: 0 0 0 1px rgba(173,238,43,0.5), 0 0 12px rgba(173,238,43,0.35); }
          62%  { box-shadow: 0 0 0 3px #adee2b, 0 0 18px rgba(173,238,43,0.7), 0 0 34px rgba(173,238,43,0.35); }
          86%  { box-shadow: 0 0 0 1px rgba(173,238,43,0.4), 0 0 10px rgba(173,238,43,0.25); }
          100% { box-shadow: none; }
        }
      `}</style>

      {/* Overlay */}
      <div
        className={`fixed inset-0 bg-black/40 backdrop-blur-sm z-[100] transition-opacity duration-300 ${open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
      />

      {/* Available times mini-panel — floating card to the left of main panel */}
      <div
        className="fixed z-[109] w-[260px] transition-all duration-[350ms] ease-[cubic-bezier(0.34,1.04,0.64,1)]"
        style={{
          right: 452,
          top: 24,
          opacity: miniEnabled ? 1 : 0,
          transform: miniEnabled ? 'translateX(0) scale(1)' : 'translateX(24px) scale(0.96)',
          pointerEvents: miniEnabled ? 'auto' : 'none',
          background: 'rgba(255,255,255,0.98)',
          backdropFilter: 'blur(24px)',
          borderRadius: 24,
          border: '1px solid rgba(226,232,240,0.9)',
          boxShadow: '0 8px 40px rgba(0,0,0,0.13), 0 2px 8px rgba(0,0,0,0.06)',
        }}
      >
        {/* Header */}
        <div className="px-5 pt-5 pb-4 border-b border-slate-100">
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400 mb-1.5">Free Slots</p>
          <p className="text-[16px] font-black text-slate-800 leading-tight truncate">{selectedRoom?.name ?? ''}</p>
          {date && (
            <p className="text-[12px] font-bold text-slate-400 mt-1">
              {new Date(date + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
            </p>
          )}
        </div>

        {/* Slot list — grows with content, max 5 items before scroll */}
        <div className="py-3" style={{ maxHeight: 300, overflowY: 'auto' }}>
          {miniSlots === null ? (
            <div className="px-4 space-y-2.5">
              {[1,2,3].map(i => (
                <div key={i} className="h-12 bg-slate-100 rounded-2xl animate-pulse" style={{ opacity: 1 - i * 0.25 }} />
              ))}
            </div>
          ) : miniSlots.length === 0 ? (
            <div className="flex flex-col items-center gap-2.5 py-6 px-4 text-center">
              <span className="material-symbols-outlined text-4xl text-slate-300">event_busy</span>
              <p className="text-[11px] font-black uppercase tracking-wide text-slate-300">Fully Booked</p>
            </div>
          ) : (
            <div className="px-3 space-y-2">
              {miniSlots.filter(slot => {
                const sHH = slot.start.split('T')[1]?.slice(0,5) ?? slot.start.slice(11,16)
                return sHH < '16:30'
              }).map((slot, i) => {
                const sHH = slot.start.split('T')[1]?.slice(0,5) ?? slot.start.slice(11,16)
                const rawEHH = slot.end.split('T')[1]?.slice(0,5) ?? slot.end.slice(11,16)
                const eHH = rawEHH > '16:30' ? '16:30' : rawEHH
                const cappedEnd = rawEHH > '16:30' ? `${slot.end.slice(0, 11)}16:30:00` : slot.end
                const durMin = (new Date(cappedEnd).getTime() - new Date(slot.start).getTime()) / 60000
                const durH = Math.floor(durMin / 60)
                const durM = durMin % 60
                const durLabel = durH && durM ? `${durH}h ${durM}m` : durH ? `${durH}h` : `${durM}m`
                const isSelected = startTime === sHH && endTime === eHH
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => { setStartTime(sHH); setEndTime(eHH) }}
                    className="w-full flex items-center justify-between gap-3 px-4 py-3 rounded-2xl transition-all text-left active:scale-95"
                    style={{
                      background: isSelected ? '#adee2b' : 'rgba(241,245,249,0.9)',
                      border: isSelected ? '1.5px solid #8bc200' : '1.5px solid transparent',
                    }}
                  >
                    <span className="text-[14px] font-black tabular-nums" style={{ color: isSelected ? '#1a3a00' : '#1e293b' }}>
                      {sHH} – {eHH}
                    </span>
                    <span className="text-[11px] font-black px-2 py-1 rounded-xl shrink-0"
                      style={{ background: isSelected ? 'rgba(0,0,0,0.12)' : '#e2e8f0', color: isSelected ? '#1a3a00' : '#64748b' }}>
                      {durLabel}
                    </span>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Panel */}
      <div
        className={`fixed top-0 right-0 h-full w-[440px] z-[110] flex flex-col transition-transform duration-[450ms] cubic-bezier(0.32,0.72,0,1) ${open ? 'translate-x-0' : 'translate-x-full'}`}
        style={{
          background: 'var(--ds-bg-surface)',
          color: 'var(--ds-text-1)',
          ...(glowActive
            ? {
                border: '2px solid transparent',
                animation: 'bp-glow-pulse 1.4s ease-in-out forwards',
              }
            : {
                borderLeft: '1px solid var(--ds-border)',
                boxShadow: '-20px 0 80px rgba(0,0,0,0.12)',
              }),
        }}
      >
        {/* Header */}
        <div className="p-7 pb-4 flex items-start justify-between shrink-0">
          <div>
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.25em] leading-none">
              {isEdit ? 'Edit Booking' : 'Create Booking'}
            </p>
            {/* Room selector */}
            <div className="relative mt-1">
              <button
                onClick={() => setShowRoomDrop(!showRoomDrop)}
                className="text-3xl font-black italic tracking-tighter text-blue-600 leading-none uppercase hover:text-blue-700 transition-colors flex items-center gap-2 rounded-lg px-1 -mx-1"
                style={glowActive ? { animation: 'field-glow-pulse 1.4s ease-in-out forwards' } : undefined}
              >
                {selectedRoom?.name || 'Select a Room'}
                <span className="material-symbols-outlined text-lg text-blue-400">expand_more</span>
              </button>
              {showRoomDrop && (
                <div className="absolute top-full left-0 mt-2 w-80 bg-white border border-slate-100 rounded-2xl shadow-2xl z-50 overflow-hidden">
                  {/* Building selector */}
                  {(buildings as Building[]).length > 1 && (
                    <div className="px-3 pt-3 pb-2 border-b border-slate-100">
                      <p className="text-[8px] font-black uppercase tracking-widest text-slate-400 mb-2">Building</p>
                      <div className="flex flex-wrap gap-1.5">
                        <button
                          onClick={() => setActiveBuildingId(null)}
                          className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase transition-all ${activeBuildingId === null ? 'bg-black text-[#adee2b]' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                        >
                          All
                        </button>
                        {(buildings as Building[]).map(b => (
                          <button
                            key={b.id}
                            onClick={() => setActiveBuildingId(b.id)}
                            className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase transition-all ${activeBuildingId === b.id ? 'bg-black text-[#adee2b]' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                          >
                            {b.code ?? b.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {/* Search */}
                  <div className="p-3 border-b border-slate-100">
                    <input
                      type="text"
                      placeholder="Search room..."
                      value={roomSearch}
                      onChange={e => setRoomSearch(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-[#adee2b]"
                      autoFocus
                    />
                  </div>
                  <>
                    <style>{`
                      .room-drop-list::-webkit-scrollbar { width: 8px; }
                      .room-drop-list::-webkit-scrollbar-track { background: transparent; margin: 4px 0; }
                      .room-drop-list::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 99px; border: 2px solid white; }
                      .room-drop-list::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
                    `}</style>
                    <div className="room-drop-list overflow-y-auto" style={{ maxHeight: 380, scrollbarWidth: 'thin', scrollbarColor: '#cbd5e1 transparent' }}>
                      {filteredRooms.map(r => {
                        const isMaint = r.status === 'maintenance'
                        return (
                          <button
                            key={r.id}
                            onClick={() => { setSelectedRoom(r); setShowRoomDrop(false); setRoomSearch('') }}
                            onMouseMove={e => { const p = (r.photos ?? [])[0]; if (p) setHoverRoomPhoto({ x: e.clientX, y: e.clientY, src: p }) }}
                            onMouseLeave={() => setHoverRoomPhoto(null)}
                            className={`w-full flex items-center gap-3 px-4 py-3.5 transition-colors text-left ${isMaint ? 'hover:bg-orange-50' : 'hover:bg-[#f7fee7]'}`}
                          >
                            <div className="flex-1 min-w-0">
                              <p className={`text-sm font-black flex items-center gap-2 ${isMaint ? 'text-orange-700' : 'text-slate-800'}`}>
                                {r.name}
                                <span className={`size-2 rounded-full shrink-0 ${isMaint ? 'bg-orange-400' : 'bg-green-400'}`} />
                              </p>
                              <p className={`text-[11px] font-bold mt-0.5 flex items-center gap-1 ${isMaint ? 'text-orange-400' : 'text-slate-400'}`}>
                                <span className="material-symbols-outlined" style={{ fontSize: 12 }}>groups</span>
                                {r.capacity} seats
                                <span className="mx-1 opacity-40">·</span>
                                <span className="material-symbols-outlined" style={{ fontSize: 12 }}>layers</span>
                                {r.floor}
                              </p>
                            </div>
                            {isMaint && (
                              <span className="shrink-0 flex items-center gap-1 px-2.5 py-1 bg-orange-100 text-orange-600 rounded-lg text-[9px] font-black uppercase">
                                <span className="material-symbols-outlined" style={{ fontSize: 11 }}>construction</span>
                                Maint.
                              </span>
                            )}
                            {r.requires_contact && !isMaint && <SpecialRoomBadge size="xs" />}
                          </button>
                        )
                      })}
                    </div>
                  </>
                </div>
              )}
              {/* Hover photo preview — fixed at cursor position */}
              {hoverRoomPhoto && (
                <div className="fixed pointer-events-none z-[200] w-44 rounded-2xl overflow-hidden shadow-2xl border border-white/80"
                  style={{ left: hoverRoomPhoto.x, top: hoverRoomPhoto.y, transform: 'translate(-115%, -50%)' }}>
                  <img src={hoverRoomPhoto.src} className="w-full aspect-video object-cover" alt="" />
                </div>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="size-10 flex items-center justify-center rounded-full bg-slate-100 hover:bg-slate-900 hover:text-[#adee2b] transition-all group"
          >
            <span className="material-symbols-outlined text-lg group-hover:rotate-90 transition-transform">close</span>
          </button>
        </div>

        <div className="flex-1 overflow-hidden relative flex flex-col">

          {/* Receptionist-only overlay — covers form + submit when room requires contact */}
          {showReceptionistNotice && (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center text-center gap-5 px-8"
              style={{ background: 'var(--ds-bg-surface)' }}>
              <div className="size-16 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(251,191,36,0.12)' }}>
                <span className="material-symbols-outlined" style={{ fontSize: 32, color: '#d97706', fontVariationSettings: "'FILL' 1" }}>support_agent</span>
              </div>
              <div>
                <p className="text-[13px] font-black uppercase tracking-wide" style={{ color: 'var(--ds-text-1)' }}>Booking via Receptionist / GAA Only</p>
                <p className="text-[11px] font-medium mt-2 leading-relaxed max-w-[260px] mx-auto" style={{ color: 'var(--ds-text-3)' }}>
                  This room can only be booked through the Receptionist or GAA team. Please contact them to make a reservation.
                </p>
              </div>
              <button
                onClick={() => { setSelectedRoom(null); setShowRoomDrop(true) }}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 transition-colors text-[10px] font-black uppercase text-slate-600"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>arrow_back</span>
                Pilih ruangan lain
              </button>
            </div>
          )}

          {/* Pantry pull tab — hidden until pantry feature is ready */}
          {/* <button
            onClick={() => setPantryOpen(true)}
            className="absolute right-0 top-1/2 -translate-y-1/2 z-20 bg-black text-[#adee2b] py-8 px-2 rounded-l-2xl shadow-xl flex flex-col items-center gap-3 hover:pr-3 transition-all"
          >
            <span className="material-symbols-outlined text-sm">flatware</span>
            <span className="text-[9px] font-black uppercase tracking-widest" style={{ writingMode: 'vertical-lr' }}>Pantry</span>
          </button> */}

          {/* Main form */}
          <div className="flex-1 overflow-y-auto px-7 space-y-4 pb-4" style={{ scrollbarWidth: 'thin' }}>

            {/* Maintenance warning */}
            {roomIsMaintenance && (
              <div className={`flex items-start gap-3 p-4 rounded-2xl border ${isPrivileged ? 'bg-orange-50 border-orange-200' : 'bg-red-50 border-red-200'}`}>
                <span className={`material-symbols-outlined shrink-0 mt-0.5 ${isPrivileged ? 'text-orange-500' : 'text-red-500'}`} style={{ fontSize: 18 }}>construction</span>
                <div>
                  <p className={`text-[11px] font-black uppercase tracking-wide ${isPrivileged ? 'text-orange-700' : 'text-red-700'}`}>
                    Room Under Maintenance
                  </p>
                  <p className={`text-[10px] font-medium mt-0.5 leading-relaxed ${isPrivileged ? 'text-orange-600' : 'text-red-500'}`}>
                    {isPrivileged
                      ? 'This room is under maintenance. As admin/receptionist you may still book.'
                      : 'This room is currently under maintenance and cannot be booked. Please contact Receptionist or GAA.'}
                  </p>
                </div>
              </div>
            )}

            {/* Date & Time */}
            <div className="bg-slate-50 px-4 py-3.5 rounded-[1.8rem] border border-slate-100 space-y-2.5">
              {/* Date */}
              <div className="space-y-1">
                <label className="text-[9px] font-black uppercase text-slate-400 tracking-wider px-1">Date</label>
                <GlassDatePicker value={date} onChange={setDate} min={today} compact>
                  {() => (
                    <button type="button"
                      className="w-full flex items-center gap-2 bg-white border border-slate-200 rounded-xl text-xs font-bold px-3 py-2 hover:border-[#adee2b] transition-all"
                      style={glowActive ? { animation: 'field-glow-pulse 1.4s ease-in-out forwards' } : undefined}>
                      <span className="material-symbols-outlined text-slate-400 shrink-0" style={{ fontSize: 15 }}>calendar_today</span>
                      <span className={`flex-1 text-left ${date ? 'text-slate-800' : 'text-slate-400'}`}>{fmtFieldDate(date)}</span>
                      <span className="material-symbols-outlined text-slate-300 shrink-0" style={{ fontSize: 13 }}>expand_more</span>
                    </button>
                  )}
                </GlassDatePicker>
              </div>

              {/* Time + Duration */}
              <div className="flex items-start gap-1.5">
                <div className="w-[88px] shrink-0 space-y-1">
                  <label className="text-[9px] font-black uppercase text-slate-400 tracking-wider px-1">Start Time</label>
                  <GlassTimePicker value={startTime} onChange={setStartTime} min={bsStr} max={fromMin(bookingEndMin - 30)}>
                    {() => (
                      <button type="button"
                        className="w-full flex items-center gap-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold px-2.5 py-2 hover:border-[#adee2b] transition-all"
                        style={glowActive ? { animation: 'field-glow-pulse 1.4s ease-in-out forwards' } : undefined}>
                        <span className="material-symbols-outlined text-slate-400 shrink-0" style={{ fontSize: 14 }}>schedule</span>
                        <span className={startTime ? 'text-slate-800 tabular-nums' : 'text-slate-400'}>{startTime || '—'}</span>
                      </button>
                    )}
                  </GlassTimePicker>
                </div>

                {/* Arrow — pt skips the label row, self-stretch+flex+items-center centers within field height */}
                <div className="self-stretch flex items-center shrink-0" style={{ paddingTop: 20 }}>
                  <span className="text-slate-300 text-[10px] font-black">→</span>
                </div>

                <div className="w-[88px] shrink-0 space-y-1">
                  <label className="text-[9px] font-black uppercase text-slate-400 tracking-wider px-1">End Time</label>
                  <GlassTimePicker value={endTime} onChange={setEndTime} min={fromMin(bookingStartMin + 30)} max={beStr} align="right">
                    {() => (
                      <button type="button"
                        className="w-full flex items-center gap-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold px-2.5 py-2 hover:border-[#adee2b] transition-all"
                        style={glowActive ? { animation: 'field-glow-pulse 1.4s ease-in-out forwards' } : undefined}>
                        <span className="material-symbols-outlined text-slate-400 shrink-0" style={{ fontSize: 14 }}>schedule</span>
                        <span className={endTime ? 'text-slate-800 tabular-nums' : 'text-slate-400'}>{endTime || '—'}</span>
                      </button>
                    )}
                  </GlassTimePicker>
                </div>

                {/* Duration badge — same label+field structure for alignment */}
                <div className="shrink-0 space-y-1">
                  <label className="text-[9px] font-black uppercase text-slate-400 tracking-wider px-1">Duration</label>
                  <div className="px-3 py-2 rounded-xl text-[15px] font-black leading-none whitespace-nowrap tabular-nums text-center"
                    style={{
                      backgroundColor: '#d9faa0',
                      color: '#2d5a00',
                      ...(glowActive ? { animation: 'duration-glow-pulse 1.4s ease-in-out forwards' } : {}),
                    }}>
                    {getDuration()}
                  </div>
                </div>
              </div>

              {/* Show available time toggle */}
              {selectedRoom && date && (
                <button
                  type="button"
                  onClick={() => setShowMiniPanel(v => !v)}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl font-black text-[11px] uppercase tracking-wider transition-all active:scale-95"
                  style={{
                    background: showMiniPanel ? '#adee2b' : 'rgba(241,245,249,1)',
                    color: showMiniPanel ? '#1a3a00' : '#64748b',
                    border: showMiniPanel ? '1.5px solid #8bc200' : '1.5px solid #e2e8f0',
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                    {showMiniPanel ? 'visibility_off' : 'calendar_view_week'}
                  </span>
                  {showMiniPanel ? 'Hide available time' : 'Show available time'}
                </button>
              )}
            </div>

            {/* Details */}
            <div className="bg-slate-50 p-5 rounded-[1.8rem] border border-slate-100 space-y-3">
              <div className="space-y-1.5">
                <label className="text-[11px] font-black uppercase text-slate-400 tracking-wider px-1">Meeting Title *</label>
                <input type="text" value={title} onChange={e => setTitle(e.target.value)}
                  placeholder="e.g. Brand Strategy 2026"
                  className="w-full bg-white border border-slate-200 rounded-xl text-sm font-black p-2.5 focus:ring-2 focus:ring-[#adee2b] focus:outline-none" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] font-black uppercase text-slate-400 tracking-wider px-1">Description</label>
                <textarea rows={2} value={desc} onChange={e => setDesc(e.target.value)}
                  placeholder="Agenda, notes..."
                  className="w-full bg-white border border-slate-200 rounded-xl text-sm font-medium p-2.5 focus:ring-2 focus:ring-[#adee2b] focus:outline-none resize-none" />
              </div>

              {/* Book for — accordion */}
              <div ref={bookForRef}>
                <button
                  type="button"
                  onClick={() => { setShowBookFor(v => !v); if (showBookFor) { setBookFor(''); setShowBookForDrop(false) } }}
                  className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-wider transition-colors"
                  style={{ color: showBookFor ? '#475569' : '#94a3b8' }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 13 }}>
                    {showBookFor ? 'remove' : 'add'}
                  </span>
                  Book for (optional)
                  {bookFor && <span className="ml-1 px-1.5 py-0.5 bg-slate-200 rounded text-slate-600 normal-case font-bold tracking-normal">{bookFor}</span>}
                </button>

                {showBookFor && (
                  <div className="relative mt-2">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 material-symbols-outlined text-slate-300" style={{ fontSize: 15 }}>person</span>
                    <input
                      type="text"
                      value={bookFor}
                      onChange={e => { setBookFor(e.target.value); setBookForUserId(null); setShowBookForDrop(true) }}
                      onFocus={() => setShowBookForDrop(true)}
                      placeholder="Type name or pick from dept..."
                      autoFocus
                      className="w-full bg-white border border-slate-200 rounded-xl text-sm font-medium pl-8 pr-8 py-2.5 focus:ring-2 focus:ring-[#adee2b] focus:outline-none"
                    />
                    {bookFor && (
                      <button type="button" onClick={() => setBookFor('')}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500">
                        <span className="material-symbols-outlined" style={{ fontSize: 14 }}>close</span>
                      </button>
                    )}
                    {showBookForDrop && (() => {
                      const q = bookFor.toLowerCase()
                      const sameDept = directory.filter(u => u.department === (user?.department ?? ''))
                      const filtered = sameDept.filter(u => !q || u.name.toLowerCase().includes(q))
                      if (filtered.length === 0) return null
                      return (
                        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-100 rounded-2xl shadow-xl z-50 overflow-hidden" style={{ maxHeight: 200, overflowY: 'auto' }}>
                          {filtered.map(u => (
                            <button key={u.id} type="button"
                              onMouseDown={e => { e.preventDefault(); setBookFor(u.name); setBookForUserId(u.id); setShowBookForDrop(false) }}
                              className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-[#f7fee7] transition-colors text-left">
                              <span className="size-6 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-black text-slate-500 shrink-0">
                                {u.name.charAt(0).toUpperCase()}
                              </span>
                              <span className="text-sm font-bold text-slate-700 truncate">{u.name}</span>
                            </button>
                          ))}
                        </div>
                      )
                    })()}
                  </div>
                )}
              </div>

              {pantrySaved && (
                <div className="flex items-center gap-2 bg-slate-900 text-[#adee2b] px-4 py-3 rounded-2xl">
                  <span className="material-symbols-outlined text-sm">shopping_bag</span>
                  <span className="text-[9px] font-black uppercase tracking-widest">Pantry Request Added</span>
                </div>
              )}
            </div>

            {/* Options */}
            <div className="bg-slate-50 p-5 rounded-[1.8rem] border border-slate-100 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-black uppercase text-slate-400 tracking-wider px-1">Type</label>
                  {isPrivileged ? (
                    <div className="grid grid-cols-2 gap-1">
                      {([
                        { value: 'internal', label: 'Internal', bg: '#1d4ed8', text: 'white' },
                        { value: 'external', label: 'External', bg: '#f97316', text: 'white' },
                        { value: 'maintenance', label: 'Maint.', bg: '#fb923c', text: '#7c2d12' },
                        { value: 'repairment', label: 'Repair', bg: '#ef4444', text: 'white' },
                      ] as const).map(opt => (
                        <button
                          key={opt.value}
                          onClick={() => setType(opt.value)}
                          className="py-1.5 text-[10px] font-black uppercase rounded-full border transition-all duration-150"
                          style={{
                            background: type === opt.value ? opt.bg : 'transparent',
                            color: type === opt.value ? opt.text : '#94a3b8',
                            borderColor: type === opt.value ? opt.bg : '#e2e8f0',
                          }}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="relative flex bg-slate-200/60 p-1 rounded-full border border-black/5">
                      <div className="absolute top-1 bottom-1 w-[calc(50%-2px)] rounded-full shadow-sm pointer-events-none transition-all duration-200 ease-[cubic-bezier(0.4,0,0.2,1)]"
                        style={{ left: type === 'internal' ? 3 : 'calc(50%)', width: 'calc(50% - 3px)', background: type === 'internal' ? '#1d4ed8' : '#f97316', transition: 'left 0.2s cubic-bezier(0.4,0,0.2,1)' }} />
                      <button onClick={() => setType('internal')}
                        className={`relative z-10 flex-1 py-1.5 text-[10px] font-black uppercase rounded-full transition-colors duration-150 ${type === 'internal' ? 'text-white' : 'text-slate-400'}`}>
                        Internal
                      </button>
                      <button onClick={() => setType('external')}
                        className={`relative z-10 flex-1 py-1.5 text-[10px] font-black uppercase rounded-full transition-colors duration-150 ${type === 'external' ? 'text-white' : 'text-slate-400'}`}>
                        External
                      </button>
                    </div>
                  )}
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-black uppercase text-slate-400 tracking-wider px-1">Status</label>
                  <div className="relative flex bg-slate-200/60 p-[3px] rounded-full border border-black/5">
                    <div className="absolute inset-y-[3px] rounded-full shadow-sm pointer-events-none"
                      style={{
                        left: status === 'confirmed' ? 3 : 'calc(50%)',
                        width: 'calc(50% - 3px)',
                        transition: 'left 0.2s cubic-bezier(0.4,0,0.2,1)',
                        background: status === 'confirmed' ? '#adee2b' : '#d1d5db',
                        backgroundImage: status === 'tentative' ? 'repeating-linear-gradient(45deg, transparent, transparent 4px, rgba(0,0,0,0.09) 4px, rgba(0,0,0,0.09) 8px)' : undefined,
                      }} />
                    <button onClick={() => setStatus('confirmed')}
                      className={`relative z-10 flex-1 py-1.5 text-[10px] font-black uppercase rounded-full transition-colors duration-150 ${status === 'confirmed' ? 'text-black' : 'text-slate-400'}`}>
                      Confirmed
                    </button>
                    <button onClick={() => setStatus('tentative')}
                      className={`relative z-10 flex-1 py-1.5 text-[10px] font-black uppercase rounded-full transition-colors duration-150 ${status === 'tentative' ? 'text-slate-600' : 'text-slate-400'}`}>
                      Tentative
                    </button>
                  </div>
                </div>
              </div>

              {/* Repeat — only for create */}
              {!isEdit && (
                <div className="space-y-3">
                  <label className="text-[9px] font-black uppercase text-slate-400 tracking-wider px-1">Repeat</label>
                  {/* Repeat mode toggle: None / Daily / Weekly */}
                  <div className="relative flex bg-slate-200/60 p-1 rounded-full border border-black/5">
                    <div className="absolute top-1 bottom-1 rounded-full bg-white shadow-sm pointer-events-none transition-transform duration-200 ease-[cubic-bezier(0.4,0,0.2,1)]"
                      style={{ left: 4, width: 'calc((100% - 8px) / 3)', transform: `translateX(${repeat === 'none' ? 0 : repeat === 'daily' ? 100 : 200}%)` }} />
                    {(['none', 'daily', 'weekly'] as const).map(r => (
                      <button key={r} onClick={() => handleRepeatChange(r)}
                        className={`relative z-10 flex-1 py-1.5 text-[11px] font-black uppercase rounded-full transition-colors duration-150 ${repeat === r ? 'text-black' : 'text-slate-400'}`}>
                        {r}
                      </button>
                    ))}
                  </div>

                  {repeat !== 'none' && (
                    <div className="space-y-2.5">
                      {/* Weekly day picker */}
                      {repeat === 'weekly' && (
                        <div className="space-y-1.5">
                          <p className="text-[9px] font-black uppercase text-slate-400 tracking-wider px-1">Repeat Days</p>
                          <div className="flex gap-1">
                            {DOW_KEYS.map(key => {
                              const selected = weeklyDays.includes(key)
                              return (
                                <button
                                  key={key}
                                  type="button"
                                  title={DOW_FULL[key]}
                                  onClick={() => {
                                    if (selected && weeklyDays.length === 1) return // must have at least 1
                                    setWeeklyDays(selected ? weeklyDays.filter(d => d !== key) : [...weeklyDays, key])
                                  }}
                                  className="flex-1 h-8 rounded-xl text-[9px] font-black uppercase transition-all duration-150"
                                  style={{
                                    background: selected ? '#1e293b' : '#f1f5f9',
                                    color: selected ? '#adee2b' : '#94a3b8',
                                  }}
                                >
                                  {DOW_LABELS[key]}
                                </button>
                              )
                            })}
                          </div>
                        </div>
                      )}

                      {/* Count vs Until toggle */}
                      <div className="bg-white border border-slate-100 rounded-2xl p-3 space-y-2">
                        {/* Radio: By count */}
                        <label className="flex items-center gap-3 cursor-pointer">
                          <div
                            onClick={() => setRepeatMode('count')}
                            className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${repeatMode === 'count' ? 'border-black bg-black' : 'border-slate-300'}`}
                          >
                            {repeatMode === 'count' && <div className="w-1.5 h-1.5 rounded-full bg-[#adee2b]" />}
                          </div>
                          <span className="text-[10px] font-black uppercase text-slate-500 flex-1" onClick={() => setRepeatMode('count')}>
                            {repeat === 'daily' ? 'For N days' : 'For N weeks'}
                          </span>
                          {repeatMode === 'count' && (
                            <div className="flex items-center gap-1.5 ml-auto">
                              <button type="button"
                                onClick={() => setRepeatCount(c => Math.max(2, c - 1))}
                                className="size-7 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center font-black text-slate-600 transition-colors">
                                <span className="material-symbols-outlined" style={{ fontSize: 15 }}>remove</span>
                              </button>
                              <span className="text-[15px] font-black text-slate-900 w-6 text-center tabular-nums">{repeatCount}</span>
                              <button type="button"
                                onClick={() => setRepeatCount(c => Math.min(repeat === 'daily' ? 90 : 52, c + 1))}
                                className="size-7 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center font-black text-slate-600 transition-colors">
                                <span className="material-symbols-outlined" style={{ fontSize: 15 }}>add</span>
                              </button>
                            </div>
                          )}
                        </label>

                        <div className="border-t border-slate-100" />

                        {/* Radio: Until date */}
                        <label className="flex items-center gap-3 cursor-pointer">
                          <div
                            onClick={() => setRepeatMode('until')}
                            className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${repeatMode === 'until' ? 'border-black bg-black' : 'border-slate-300'}`}
                          >
                            {repeatMode === 'until' && <div className="w-1.5 h-1.5 rounded-full bg-[#adee2b]" />}
                          </div>
                          <span className="text-[10px] font-black uppercase text-slate-500 flex-1" onClick={() => setRepeatMode('until')}>
                            Until date
                          </span>
                          {repeatMode === 'until' && (
                            <div className="ml-auto" onClick={e => e.stopPropagation()}>
                              <GlassDatePicker value={repeatEndDate} onChange={setRepeatEndDate} min={date || today} align="right" panelWidth={260}>
                                {() => (
                                  <button type="button" className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 rounded-xl px-3 py-1.5 text-[10px] font-black transition-all">
                                    <span className="text-slate-700">{repeatEndDate ? fmtShortDate(repeatEndDate) : 'Pick date'}</span>
                                    <span className="material-symbols-outlined text-slate-400" style={{ fontSize: 14 }}>calendar_today</span>
                                  </button>
                                )}
                              </GlassDatePicker>
                            </div>
                          )}
                        </label>
                      </div>

                      {/* Skip conflicts toggle */}
                      <button
                        type="button"
                        onClick={() => setSkipConflicts(!skipConflicts)}
                        className="w-full flex items-center gap-3 bg-white border border-slate-100 rounded-2xl px-4 py-2.5 transition-all hover:border-slate-200"
                      >
                        <div className={`w-9 h-5 rounded-full transition-colors duration-200 relative shrink-0 ${skipConflicts ? 'bg-black' : 'bg-slate-200'}`}>
                          <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-200 ${skipConflicts ? 'translate-x-4' : 'translate-x-0.5'}`} />
                        </div>
                        <span className="text-[10px] font-black uppercase text-slate-600">Skip past conflicts</span>
                        <span className="ml-auto text-[9px] text-slate-400 font-medium">
                          {skipConflicts ? 'conflicts skipped' : 'stop on conflict'}
                        </span>
                      </button>

                      {/* Repeat preview summary */}
                      {repeatDates.length > 0 && (
                        <div className="bg-black/[0.04] rounded-2xl px-4 py-3 space-y-2">
                          <div className="flex items-center gap-2">
                            <span className="material-symbols-outlined text-slate-400" style={{ fontSize: 14 }}>event_repeat</span>
                            <span className="text-[10px] font-black text-slate-600">{repeatSummary}</span>
                          </div>
                          {/* Preview first 6 dates */}
                          <div className="flex flex-wrap gap-1">
                            {repeatDates.slice(0, 6).map(d => (
                              <span key={d} className="text-[8px] font-bold bg-white border border-slate-100 rounded-lg px-2 py-0.5 text-slate-500">
                                {fmtShortDate(d)}
                              </span>
                            ))}
                            {repeatDates.length > 6 && (
                              <span className="text-[8px] font-bold bg-slate-900 text-[#adee2b] rounded-lg px-2 py-0.5">
                                +{repeatDates.length - 6} more
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Series badge for edit mode */}
              {isEdit && editBooking?.series_id && (
                <div className="flex items-center gap-3 bg-blue-600 rounded-2xl px-4 py-3">
                  <span className="material-symbols-outlined text-blue-200" style={{ fontSize: 16 }}>link</span>
                  <div>
                    <p className="text-[11px] font-black uppercase text-white tracking-wider">Booking Series</p>
                    <p className="text-[10px] text-blue-200 font-medium mt-0.5">Changes can apply to this booking or the entire series</p>
                  </div>
                </div>
              )}
            </div>

            {/* Availability (single booking only) */}
            {repeat === 'none' && (
              <>
                {isTimeValid() === false && (
                  <div className="flex items-center gap-3 px-4 py-3 rounded-2xl border-2 border-red-200 bg-red-50">
                    <div className="size-8 rounded-xl bg-red-500 flex items-center justify-center text-white shrink-0">
                      <span className="material-symbols-outlined text-base">schedule</span>
                    </div>
                    <div>
                      <p className="text-[9px] font-black uppercase tracking-widest text-red-800">Invalid Time</p>
                      <p className="text-[9px] text-red-600 mt-0.5">End time must be after start time.</p>
                    </div>
                  </div>
                )}
                {isTimeValid() === true && availChecking && (
                  <div className="flex items-center gap-3 px-4 py-3 rounded-2xl border-2 border-slate-100 bg-slate-50">
                    <div className="size-8 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400 shrink-0">
                      <span className="material-symbols-outlined text-base animate-spin">progress_activity</span>
                    </div>
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Checking availability&hellip;</p>
                  </div>
                )}
                {isTimeValid() === true && !availChecking && isAvailable() === true && (
                  <div className={`flex items-center gap-3 px-4 py-3 rounded-2xl border-2 ${(availResult?.other_viewers ?? 0) > 0 ? 'border-amber-300 bg-amber-50' : 'border-[#adee2b] bg-[#f7fee7]'}`}>
                    <div className={`size-8 rounded-xl flex items-center justify-center shrink-0 ${(availResult?.other_viewers ?? 0) > 0 ? 'bg-amber-400 text-white' : 'bg-[#adee2b] text-black'}`}>
                      <span className="material-symbols-outlined text-base">{(availResult?.other_viewers ?? 0) > 0 ? 'group' : 'verified'}</span>
                    </div>
                    <div>
                      <p className={`text-[9px] font-black uppercase tracking-widest ${(availResult?.other_viewers ?? 0) > 0 ? 'text-amber-800' : 'text-green-800'}`}>
                        {(availResult?.other_viewers ?? 0) > 0 ? `${availResult!.other_viewers} other user${availResult!.other_viewers > 1 ? 's' : ''} viewing this slot` : 'Room Available'}
                      </p>
                      <p className={`text-[9px] mt-0.5 ${(availResult?.other_viewers ?? 0) > 0 ? 'text-amber-700' : 'text-green-700'}`}>
                        {(availResult?.other_viewers ?? 0) > 0 ? 'Submit quickly — someone else may book first.' : 'No conflicts for this slot.'}
                      </p>
                    </div>
                  </div>
                )}
                {isTimeValid() === true && !availChecking && isAvailable() === false && (
                  <div className="flex items-center gap-3 px-4 py-3 rounded-2xl border-2 border-red-200 bg-red-50">
                    <div className="size-8 rounded-xl bg-red-500 flex items-center justify-center text-white shrink-0">
                      <span className="material-symbols-outlined text-base">block</span>
                    </div>
                    <div>
                      <p className="text-[9px] font-black uppercase tracking-widest text-red-800">Room Conflict</p>
                      <p className="text-[9px] text-red-600 mt-0.5">Another booking exists at this time.</p>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Pantry Slide */}
          <div
            className={`absolute inset-0 bg-white z-30 flex flex-col border-l-4 border-[#adee2b] transition-transform duration-500 ${pantryOpen ? 'translate-x-0' : 'translate-x-full'}`}
          >
            <div className="p-6 flex items-center justify-between border-b shrink-0">
              <div className="flex items-center gap-3">
                <div className="size-9 bg-black rounded-xl flex items-center justify-center text-[#adee2b]">
                  <span className="material-symbols-outlined text-base">flatware</span>
                </div>
                <h4 className="font-black uppercase tracking-tighter text-xl italic">Pantry Order</h4>
              </div>
              <button
                onClick={() => setPantryOpen(false)}
                className="size-8 bg-slate-100 rounded-full flex items-center justify-center hover:bg-black hover:text-[#adee2b] transition-all"
              >
                <span className="material-symbols-outlined text-sm">arrow_back</span>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-5 bg-slate-50/50">
              <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest px-1 mb-3">Hot Beverages</p>
              {[
                { label: 'Coffee', icon: 'coffee', qty: coffeeQty, set: setCoffeeQty, color: 'orange' },
                { label: 'Tea', icon: 'emoji_food_beverage', qty: teaQty, set: setTeaQty, color: 'green' },
              ].map(item => (
                <div key={item.label} className="bg-white p-4 rounded-3xl border border-slate-100 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`size-10 bg-${item.color}-50 text-${item.color}-500 rounded-2xl flex items-center justify-center`}>
                        <span className="material-symbols-outlined text-lg">{item.icon}</span>
                      </div>
                      <span className="text-xs font-black uppercase">{item.label}</span>
                    </div>
                    <div className="flex items-center bg-slate-100 rounded-full p-1 gap-1">
                      <button onClick={() => item.set(Math.max(0, item.qty - 1))} className="size-7 flex items-center justify-center text-sm font-black hover:bg-white rounded-full transition-colors">−</button>
                      <span className="w-6 text-center text-xs font-black">{item.qty}</span>
                      <button onClick={() => item.set(item.qty + 1)} className="size-7 flex items-center justify-center text-sm font-black hover:bg-white rounded-full transition-colors">+</button>
                    </div>
                  </div>
                </div>
              ))}
              <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest px-1 mt-4 mb-3">Others</p>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Water', icon: 'water_full', qty: waterQty, set: setWaterQty, color: 'blue' },
                  { label: 'Snacks', icon: 'cookie', qty: snackQty, set: setSnackQty, color: 'amber' },
                ].map(item => (
                  <div key={item.label} className="bg-white p-3 rounded-2xl border border-slate-100 flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                      <span className={`material-symbols-outlined text-${item.color}-400 text-base`}>{item.icon}</span>
                      <span className="text-[10px] font-black uppercase">{item.label}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => item.set(Math.max(0, item.qty - 1))} className="size-6 flex items-center justify-center text-sm font-black text-slate-400 hover:text-black">−</button>
                      <span className={`text-[10px] font-black text-${item.color}-600`}>{item.qty}</span>
                      <button onClick={() => item.set(item.qty + 1)} className="size-6 flex items-center justify-center text-sm font-black text-slate-400 hover:text-black">+</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="p-5 bg-white border-t shrink-0">
              <button
                onClick={() => { setPantryOpen(false); setPantrySaved(true) }}
                className="w-full py-4 bg-black text-[#adee2b] rounded-full text-[9px] font-black uppercase tracking-[0.2em] hover:scale-[1.02] active:scale-[0.98] transition-transform"
              >
                Save & Return →
              </button>
            </div>
          </div>

          {/* Cancel Series Modal */}
          {showCancelModal && editBooking && onCancel && (
            <div className="absolute inset-0 z-40 flex items-end" style={{ background: 'rgba(0,0,0,0.35)' }}>
              <div className="w-full bg-white rounded-t-3xl p-6 space-y-4 shadow-2xl">
                <div className="flex items-center gap-3">
                  <div className="size-9 rounded-2xl bg-red-100 flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-red-500" style={{ fontSize: 18 }}>cancel</span>
                  </div>
                  <div>
                    <p className="text-sm font-black uppercase tracking-tight text-slate-800">Cancel Booking</p>
                    <p className="text-[10px] text-slate-400 font-bold">Part of a series</p>
                  </div>
                </div>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  Cancel just this booking, or cancel all bookings in the series?
                </p>
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <button
                    onClick={() => { setShowCancelModal(false); onClose(); setTimeout(() => onCancel(editBooking), 150) }}
                    className="py-3.5 rounded-2xl bg-slate-100 text-slate-700 text-[10px] font-black uppercase tracking-wide hover:bg-slate-200 transition-all"
                  >
                    Just this one
                  </button>
                  <button
                    onClick={async () => {
                      setShowCancelModal(false)
                      setSubmitting(true); setError('')
                      try { await cancelSeries(editBooking.series_id!); onSubmit?.(); onClose() }
                      catch (err: unknown) {
                        const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
                        setError(msg || 'Failed to cancel series.')
                      } finally { setSubmitting(false) }
                    }}
                    className="py-3.5 rounded-2xl bg-red-500 text-white text-[10px] font-black uppercase tracking-wide hover:bg-red-600 transition-all"
                  >
                    All in series
                  </button>
                </div>
                <button
                  onClick={() => setShowCancelModal(false)}
                  className="w-full text-[9px] font-black uppercase text-slate-400 hover:text-slate-600 py-1 tracking-wider transition-colors"
                >
                  Back
                </button>
              </div>
            </div>
          )}

          {/* Conflict Preview Modal (all-or-nothing) */}
          {conflictInfo && (
            <div className="absolute inset-0 z-40 flex items-end" style={{ background: 'rgba(0,0,0,0.45)' }}>
              <div className="w-full bg-white rounded-t-3xl p-6 space-y-4 shadow-2xl">
                <div className="flex items-center gap-3">
                  <div className="size-9 rounded-2xl bg-red-100 flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-red-500" style={{ fontSize: 18 }}>event_busy</span>
                  </div>
                  <div>
                    <p className="text-sm font-black uppercase tracking-tight text-slate-800">Conflicts Found</p>
                    <p className="text-[10px] text-slate-400 font-bold">
                      {conflictInfo.conflicting.length} slot{conflictInfo.conflicting.length !== 1 ? 's' : ''} already booked
                    </p>
                  </div>
                </div>

                {/* Conflicting dates list */}
                <div className="bg-red-50 rounded-2xl p-3 space-y-1 max-h-32 overflow-y-auto">
                  {conflictInfo.conflicting.map(d => (
                    <div key={d} className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-red-400" style={{ fontSize: 13 }}>block</span>
                      <span className="text-[10px] font-bold text-red-600">{fmtShortDate(d)}</span>
                    </div>
                  ))}
                </div>

                <p className="text-[11px] text-slate-500 leading-relaxed">
                  {conflictInfo.available.length > 0
                    ? `Turn on "Skip conflicts" to book the ${conflictInfo.available.length} available slot${conflictInfo.available.length !== 1 ? 's' : ''} and skip the ${conflictInfo.conflicting.length} above.`
                    : 'All selected slots are already booked. Choose different dates or times.'}
                </p>

                <div className={`${conflictInfo.available.length > 0 ? 'grid grid-cols-2 gap-3' : ''} pt-1`}>
                  {conflictInfo.available.length > 0 && (
                    <button
                      onClick={async () => {
                        const info = conflictInfo
                        setConflictInfo(null)
                        setSkipConflicts(true)
                        setSubmitting(true)
                        setError('')
                        try {
                          await doCreateBookings(info.available, info.seriesId)
                        } catch (err: unknown) {
                          const e = err as { response?: { status?: number; data?: { message?: string } } }
                          const status = e?.response?.status
                          const msg = e?.response?.data?.message
                          if (status === 422 && msg?.toLowerCase().includes('not available')) {
                            setError('Someone just booked this room. Please choose another time or room.')
                            recheckAvailability()
                          } else {
                            setError(msg || 'Failed to save booking.')
                          }
                        } finally {
                          setSubmitting(false)
                        }
                      }}
                      className="py-3.5 rounded-2xl bg-black text-[#adee2b] text-[10px] font-black uppercase tracking-wide hover:bg-slate-800 transition-all"
                    >
                      Skip & Book {conflictInfo.available.length}
                    </button>
                  )}
                  <button
                    onClick={() => setConflictInfo(null)}
                    className="py-3.5 rounded-2xl bg-slate-100 text-slate-700 text-[10px] font-black uppercase tracking-wide hover:bg-slate-200 transition-all"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* (skippedResult shown inline in submit area) */}

        </div>

        {/* Submit */}
        <div className="p-7 pt-3 shrink-0 space-y-2">
          {error && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-100 text-red-600 text-[11px] font-bold px-4 py-3 rounded-xl">
              <span className="material-symbols-outlined text-base">error</span>
              {error}
            </div>
          )}

          {/* Skipped dates result — inline after series booking */}
          {skippedResult && (
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="size-7 rounded-xl flex items-center justify-center shrink-0" style={{ background: '#adee2b' }}>
                    <span className="material-symbols-outlined text-black" style={{ fontSize: 14 }}>task_alt</span>
                  </div>
                  <div>
                    <p className="text-[11px] font-black text-slate-800">{skippedResult.created} of {skippedResult.total} booked</p>
                    <p className="text-[9px] text-slate-400 font-bold">{skippedResult.skipped.length} skipped — conflicts</p>
                  </div>
                </div>
                <button
                  onClick={() => { setSkippedResult(null); onSubmit?.() }}
                  className="px-3 py-1.5 rounded-xl bg-black text-[#adee2b] text-[9px] font-black uppercase tracking-wide hover:bg-slate-800 transition-all shrink-0"
                >
                  Done
                </button>
              </div>
              <div className="bg-red-50 rounded-xl p-2.5 space-y-1 max-h-32 overflow-y-auto">
                <p className="text-[8px] font-black uppercase text-red-400 tracking-wider px-1 mb-1.5">Skipped dates</p>
                {skippedResult.skipped.map(d => (
                  <div key={d} className="flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-red-400 shrink-0" style={{ fontSize: 12 }}>block</span>
                    <span className="text-[11px] font-bold text-red-600">{fmtShortDate(d)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Series edit mode — split save buttons */}
          {isEdit && editBooking?.series_id ? (
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={async () => {
                    if (!isValid()) return
                    setSubmitting(true); setError('')
                    try { await doSubmitSingle() }
                    catch (err: unknown) {
                      const e = err as { response?: { status?: number; data?: { message?: string } } }
                      const status = e?.response?.status
                      const msg = e?.response?.data?.message
                      if (status === 422 && msg?.toLowerCase().includes('not available')) {
                        setError('Someone just booked this room. Please choose another time or room.')
                        recheckAvailability()
                      } else {
                        setError(msg || 'Failed to save.')
                      }
                    } finally { setSubmitting(false) }
                  }}
                  disabled={!isValid() || submitting}
                  className="py-4 rounded-full text-[9px] font-black uppercase tracking-wide transition-all
                    bg-[#adee2b] text-black hover:bg-slate-900 hover:text-[#adee2b]
                    disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
                >
                  {submitting ? '...' : 'Save this'}
                </button>
                <button
                  onClick={async () => {
                    if (!isValid()) return
                    setSubmitting(true); setError('')
                    try {
                      await updateSeries(editBooking.series_id!, { title, description: desc, type, status })
                      onSubmit?.()
                    } catch (err: unknown) {
                      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
                      setError(msg || 'Failed to save series.')
                    } finally { setSubmitting(false) }
                  }}
                  disabled={!isValid() || submitting}
                  className="py-4 rounded-full text-[9px] font-black uppercase tracking-wide transition-all flex items-center justify-center gap-1
                    bg-blue-600 text-white hover:bg-blue-700
                    disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 12 }}>link</span>
                  {submitting ? '...' : 'Save series'}
                </button>
              </div>
              {onCancel && (
                <button
                  type="button"
                  onClick={() => setShowCancelModal(true)}
                  className="w-full py-3 rounded-full text-[10px] font-black uppercase tracking-[0.15em] transition-all duration-200 border-2 border-red-100 text-red-400 hover:border-red-400 hover:bg-red-50 hover:text-red-600"
                >
                  Cancel Booking
                </button>
              )}
            </div>
          ) : (
            /* Normal (non-series) submit */
            <>
              <button
                onClick={handleSubmit}
                disabled={!isValid() || submitting}
                className="w-full py-5 rounded-full text-[10px] font-black uppercase tracking-[0.2em] shadow-xl transition-all duration-200
                  bg-[#adee2b] text-black hover:bg-black hover:text-[#adee2b] shadow-lime-400/20
                  disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed disabled:shadow-none"
              >
                {submitting ? 'Saving...' : isEdit ? 'Save Changes' : repeat !== 'none' ? `Schedule ${repeatDates.length > 0 ? `(${repeatDates.length})` : ''} Bookings` : 'Confirm Booking'}
              </button>
              {isEdit && editBooking && onCancel && (
                <button
                  type="button"
                  onClick={() => { onClose(); setTimeout(() => onCancel(editBooking), 150) }}
                  className="w-full py-3 rounded-full text-[10px] font-black uppercase tracking-[0.15em] transition-all duration-200 border-2 border-red-100 text-red-400 hover:border-red-400 hover:bg-red-50 hover:text-red-600"
                >
                  Cancel Booking
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </>
  )
}
