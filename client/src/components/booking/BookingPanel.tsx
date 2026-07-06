import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { Booking, Building, Room } from '../../types/index'
import { getRooms, checkAvailability, clearRoomView, getAvailableRooms } from '../../api/rooms'
import { getBuildings } from '../../api/buildings'
import { createBooking, updateBooking, cancelSeries, updateSeries } from '../../api/bookings'
import { getDirectory } from '../../api/users'
import { getGeneralSettings } from '../../api/settings'
import { useAuth } from '../../context/AuthContext'
import { useSettings } from '../../context/SettingsContext'
import { useBookingHours } from '../../hooks/useBookingHours'
import GlassDatePicker from '../ui/GlassDatePicker'
import GlassTimePicker from '../ui/GlassTimePicker'
import { SpecialRoomBadge } from '../ui/SpecialRoomBadge'

function exportToICS(data: { title: string; description?: string; startAt: string; endAt: string; location?: string }) {
  const fmtDT = (dt: string) => dt.replace(/-/g, '').replace(/:/g, '').replace(' ', 'T').substring(0, 15)
  const esc = (s: string) => s.replace(/[\\;,]/g, m => '\\' + m).replace(/\n/g, '\\n')
  const stamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'
  const lines = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//MRBS//RoomSync//EN', 'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `DTSTART:${fmtDT(data.startAt)}`,
    `DTEND:${fmtDT(data.endAt)}`,
    `DTSTAMP:${stamp}`,
    `UID:booking-panel-${Date.now()}@mbrs`,
    `SUMMARY:${esc(data.title)}`,
    data.description ? `DESCRIPTION:${esc(data.description)}` : '',
    data.location ? `LOCATION:${esc(data.location)}` : '',
    'END:VEVENT', 'END:VCALENDAR',
  ].filter(Boolean).join('\r\n')
  const a = Object.assign(document.createElement('a'), {
    href: URL.createObjectURL(new Blob([lines], { type: 'text/calendar;charset=utf-8' })),
    download: `${(data.title || 'booking').replace(/[^a-z0-9]/gi, '_').toLowerCase()}.ics`,
  })
  document.body.appendChild(a); a.click(); document.body.removeChild(a)
}

function fmtFieldDate(iso: string, lang = 'en', pickDateLabel = 'Pick a date'): string {
  if (!iso) return pickDateLabel
  const [y, m, d] = iso.split('T')[0].split('-').map(Number)
  if (!y || !m || !d) return pickDateLabel
  return new Date(y, m - 1, d).toLocaleDateString(lang === 'id' ? 'id-ID' : 'en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

function fmtShortDate(iso: string, lang = 'en'): string {
  if (!iso) return ''
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString(lang === 'id' ? 'id-ID' : 'en-GB', { day: '2-digit', month: 'short' })
}

function toMin(hhmm: string) { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m }
function fromMin(min: number) { return `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}` }

const DOW_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const
const DOW_LABELS: Record<string, string> = { mon: 'Sen', tue: 'Sel', wed: 'Rab', thu: 'Kam', fri: 'Jum', sat: 'Sab', sun: 'Min' }
const DOW_FULL: Record<string, string> = { mon: 'Senin', tue: 'Selasa', wed: 'Rabu', thu: 'Kamis', fri: 'Jumat', sat: 'Sabtu', sun: 'Minggu' }
const REPEAT_LABELS: Record<string, string> = { none: 'Tidak', daily: 'Harian', weekly: 'Mingguan' }
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
  onAfterHoursOpen?: (data: { buildingId?: number | null; workingHoursEnd: string }) => void
}

export default function BookingPanel({ open, onClose, initialRoom, editBooking, prefillStart, prefillEnd, prefillDate, prefillVersion, buildingId, onSubmit, onCancel, onAfterHoursOpen }: BookingPanelProps) {
  const { user } = useAuth()
  const { defaultType, defaultBuilding, t, language } = useSettings()
  const REPEAT_LBL: Record<string, string> = { none: t('repeat_none'), daily: t('repeat_daily'), weekly: t('repeat_weekly') }
  const DOW_LBL: Record<string, string> = { mon: t('dow_mon'), tue: t('dow_tue'), wed: t('dow_wed'), thu: t('dow_thu'), fri: t('dow_fri'), sat: t('dow_sat'), sun: t('dow_sun') }
  const DOW_FUL: Record<string, string> = { mon: t('dow_full_mon'), tue: t('dow_full_tue'), wed: t('dow_full_wed'), thu: t('dow_full_thu'), fri: t('dow_full_fri'), sat: t('dow_full_sat'), sun: t('dow_full_sun') }
  const { start: bsStr, end: beStr } = useBookingHours()
  const bookingStartMin = toMin(bsStr)
  const bookingEndMin   = toMin(beStr)
  const isPrivileged = user?.role === 'admin' || user?.role === 'receptionist'
  const { data: generalSettings } = useQuery({ queryKey: ['settings-general'], queryFn: getGeneralSettings, staleTime: 5 * 60_000 })
  const allowBookForOthers = isPrivileged || (generalSettings?.allow_book_for_others !== false)
  const restrictAfterHours = !isPrivileged && (generalSettings?.restrict_after_hours === true)
  const workingHoursEnd = generalSettings?.working_hours_end ?? '17:00'
  const maxAdvanceDays = generalSettings?.max_advance_days ?? 30
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
  const [repeatCountRaw, setRepeatCountRaw] = useState('5')
  const [repeatEndDate, setRepeatEndDate] = useState('')
  const [untilDateText, setUntilDateText] = useState('')
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
  const [pendingBookFor, setPendingBookFor] = useState<{ id: number; name: string; department: string } | null>(null)
  const bookForRef     = useRef<HTMLDivElement>(null)
  const panelBodyRef   = useRef<HTMLDivElement>(null)
  const summaryRef     = useRef<HTMLDivElement>(null)
  const calendarBtnRef = useRef<HTMLDivElement>(null)
  const [draftRestored, setDraftRestored] = useState(false)
  // copy-paste preset
  const PRESET_KEY = 'mbrs_booking_preset'
  const [preset, setPreset] = useState<Record<string, unknown> | null>(() => {
    try { return JSON.parse(localStorage.getItem('mbrs_booking_preset') ?? 'null') } catch { return null }
  })
  const [justCopied, setJustCopied] = useState(false)

  function handleCopyPreset() {
    const p: Record<string, unknown> = { title, desc, type, status }
    if (bookFor) { p.bookFor = bookFor; p.bookForUserId = bookForUserId ?? undefined }
    if (repeat !== 'none') {
      p.repeat = repeat; p.repeatMode = repeatMode; p.repeatCount = repeatCount
      p.repeatEndDate = repeatEndDate; p.skipConflicts = skipConflicts
      if (repeat === 'weekly') p.weeklyDays = weeklyDays
    }
    localStorage.setItem(PRESET_KEY, JSON.stringify(p))
    setPreset(p)
    setJustCopied(true)
    setTimeout(() => setJustCopied(false), 2000)
  }

  function handlePastePreset() {
    if (!preset) return
    if (preset.title) setTitle(preset.title as string)
    if (preset.desc !== undefined) setDesc(preset.desc as string)
    if (preset.type) setType(preset.type as typeof type)
    if (preset.status) setStatus(preset.status as typeof status)
    if (preset.bookFor && allowBookForOthers) {
      setBookFor(preset.bookFor as string)
      setBookForUserId((preset.bookForUserId as number | null) ?? null)
      setShowBookFor(true)
    }
    if (preset.repeat && preset.repeat !== 'none') {
      setRepeat(preset.repeat as typeof repeat)
      if (preset.repeatMode) setRepeatMode(preset.repeatMode as typeof repeatMode)
      if (preset.repeatCount) { setRepeatCount(preset.repeatCount as number); setRepeatCountRaw(String(preset.repeatCount)) }
      if (preset.repeatEndDate) {
        setRepeatEndDate(preset.repeatEndDate as string)
        const [y, m, d] = (preset.repeatEndDate as string).split('-')
        setUntilDateText(`${d}/${m}/${y}`)
      }
      if (preset.weeklyDays) setWeeklyDays(preset.weeklyDays as string[])
      if (preset.skipConflicts !== undefined) setSkipConflicts(preset.skipConflicts as boolean)
    }
  }

  // Always-current snapshot of form values — updated every render, no closure staleness.
  const draftSnapshotRef = useRef<Record<string, unknown>>({})
  const openRef      = useRef(open)
  const editModeRef  = useRef(!!editBooking)
  openRef.current    = open
  editModeRef.current = !!editBooking
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
  // after-hours restriction modal

  const isEdit = !!editBooking
  // Recipient of someone else's booking (made FOR them, not BY them) — can edit meeting
  // details but not reassign who it's for; only the original owner or a privileged user can.
  const isRecipientOnly = isEdit && !isPrivileged
    && !!editBooking?.booked_for_user_id
    && editBooking.booked_for_user_id === user?.id
    && editBooking.user_id !== user?.id
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

  const isPastBookingTime = !isEdit && !!date && !!startTime && (() => {
    const now = new Date()
    const PAST_TOLERANCE_MIN = 60 // allow booking up to 1 hour in the past
    if (date < today) return true
    if (date === today) return toMin(startTime) < (now.getHours() * 60 + now.getMinutes() - PAST_TOLERANCE_MIN)
    return false
  })()

  // Update snapshot every render — guarantees saveDraft() always has current values.
  const DRAFT_KEY = 'mbrs-booking-draft'
  if (open && !editBooking) {
    draftSnapshotRef.current = {
      title, desc, date, startTime, endTime, status, type,
      room: selectedRoom ? { id: selectedRoom.id, name: selectedRoom.name, building_id: selectedRoom.building_id, building: selectedRoom.building ? { id: selectedRoom.building.id, name: selectedRoom.building.name, code: selectedRoom.building.code } : undefined } : null,
      repeat, repeatMode, repeatCount, repeatEndDate, weeklyDays, skipConflicts,
      bookFor, bookForUserId, showBookFor,
    }
  }

  function saveDraft() {
    if (editModeRef.current) return
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ ...draftSnapshotRef.current, savedAt: new Date().toISOString() }))
    } catch {}
  }

  function clearDraft() {
    draftSnapshotRef.current = {}
    localStorage.removeItem(DRAFT_KEY)
    setDraftRestored(false)
  }

  function hasMeaningfulDraft(): boolean {
    try {
      const raw = localStorage.getItem(DRAFT_KEY)
      if (!raw) return false
      const d = JSON.parse(raw)
      return !!(d.title || d.room || (d.date && d.date !== today))
    } catch { return false }
  }

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
      // Try restoring a saved draft.
      // prefillDate alone (without times) just means "current calendar date" — don't treat it as a
      // specific slot click. Only prefillStart/End or initialRoom mean a specific slot was chosen.
      const isPrefilled = !!(prefillStart || prefillEnd || initialRoom)
      if (!isPrefilled && hasMeaningfulDraft()) {
        try {
          const d = JSON.parse(localStorage.getItem(DRAFT_KEY)!)
          setTitle(d.title ?? '')
          setDesc(d.desc ?? '')
          // Honor prefillDate if set (e.g. user is viewing a future date in the timeline).
          setDate(prefillDate || d.date || today)
          setStartTime(d.startTime ?? '')
          setEndTime(d.endTime ?? '')
          setStatus(d.status ?? 'confirmed')
          setType(d.type ?? 'internal')
          setSelectedRoom(d.room ?? null)
          setRepeat(d.repeat ?? 'none')
          setRepeatMode(d.repeatMode ?? 'count')
          setRepeatCount(d.repeatCount ?? 5)
          setRepeatCountRaw(String(d.repeatCount ?? 5))
          setRepeatEndDate(d.repeatEndDate ?? '')
          setUntilDateText(d.repeatEndDate ? (() => { const [y, m, dd] = d.repeatEndDate.split('-'); return `${dd}/${m}/${y}` })() : '')
          setWeeklyDays(d.weeklyDays ?? ['mon'])
          setSkipConflicts(d.skipConflicts ?? true)
          setBookFor(d.bookFor ?? '')
          setBookForUserId(d.bookForUserId ?? null)
          setShowBookFor(d.showBookFor ?? false)
          setShowMiniPanel(false)
          setPantrySaved(false)
          setDraftRestored(true)
          setActiveBuildingId(d.room?.building_id ?? buildingId ?? defaultBuilding ?? null)
          setShowCancelModal(false); setError(''); setConflictInfo(null); setSkippedResult(null)
          return
        } catch {}
      }
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
      setRepeatCountRaw('5')
      setRepeatEndDate('')
      setUntilDateText('')
      setSkipConflicts(true)
      setWeeklyDays(['mon'])
      setSelectedRoom(initialRoom || null)
      setPantrySaved(false)
      setDraftRestored(false)
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

  // Save draft after every render while panel is open (new booking mode).
  // No deps array = runs after every render, so localStorage is always current.
  // This is the most reliable approach — no closure staleness, no timing gaps.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (open && !editBooking) saveDraft() })

  // Also save on unmount (navigating away while panel is open).
  useEffect(() => {
    return () => { if (openRef.current && !editModeRef.current) saveDraft() }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Sync untilDateText when picker updates repeatEndDate
  useEffect(() => {
    if (repeatEndDate) {
      const [y, m, d] = repeatEndDate.split('-')
      setUntilDateText(`${d}/${m}/${y}`)
    } else {
      setUntilDateText('')
    }
  }, [repeatEndDate])

  function getDuration() {
    const id = language === 'id'
    if (!startTime || !endTime) return id ? '— mnt' : '— min'
    const [h1, m1] = startTime.split(':').map(Number)
    const [h2, m2] = endTime.split(':').map(Number)
    const total = (h2 * 60 + m2) - (h1 * 60 + m1)
    if (total <= 0) return id ? 'Tidak Valid' : 'Invalid'
    const h = Math.floor(total / 60)
    const m = total % 60
    if (id) return h && m ? `${h} jam ${m} mnt` : h ? `${h} jam` : `${m} mnt`
    return h && m ? `${h}h ${m}m` : h ? `${h}h` : `${m}m`
  }

  function toISO(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
  }

  // Parse typed date string → YYYY-MM-DD, accepts: DD/MM/YYYY, DD/MM/YY, DD/MM, YYYY-MM-DD
  function parseTypedDate(raw: string): string | null {
    const s = raw.trim().replace(/[.\-]/g, '/')
    const parts = s.split('/')
    if (parts.length >= 2) {
      const d = parseInt(parts[0]), m = parseInt(parts[1])
      const yearRaw = parts[2] ?? ''
      const y = yearRaw.length === 2 ? 2000 + parseInt(yearRaw)
              : yearRaw.length >= 4  ? parseInt(yearRaw)
              : new Date().getFullYear()
      if (d >= 1 && d <= 31 && m >= 1 && m <= 12 && y >= 2020 && y <= 2099) {
        // Validate the date actually exists
        const dt = new Date(y, m - 1, d)
        if (dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d) {
          return `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`
        }
      }
    }
    return null
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
    return `${dates.length} ${t('series_label')} · ${t('series_ends')} ${fmtShortDate(last, language)}`
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
  const canBookSpecial = isPrivileged || user?.can_book_special === true
  const specialRoomBlocked = !!(selectedRoom?.requires_contact && !canBookSpecial)
  const showReceptionistNotice = specialRoomBlocked

  function isValid() {
    if (maintenanceBlocked) return false
    if (specialRoomBlocked) return false
    if (isPastBookingTime) return false
    if (!title.trim() || !startTime || !endTime || !selectedRoom) return false
    if (restrictAfterHours && startTime >= workingHoursEnd) return false
    if (repeat !== 'none') {
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
      clearDraft()
    }
    onSubmit?.()
  }

  // knownSkipped: dates already known to conflict (pre-checked), so they get stored on each booking
  async function doCreateBookings(datesToBook: string[], seriesId: string, knownSkipped: string[] = []) {
    if (!selectedRoom) return
    const base = { room_id: selectedRoom.id, title, description: desc, status, type, booked_for: bookFor.trim() || undefined, booked_for_user_id: bookForUserId ?? undefined }
    let created = 0
    const runtimeSkipped: string[] = []
    for (const d of datesToBook) {
      try {
        await createBooking({
          ...base,
          start_at: `${d} ${startTime}:00`,
          end_at: `${d} ${endTime}:00`,
          series_id: seriesId,
          series_skipped_dates: knownSkipped.length > 0 ? knownSkipped : undefined,
        })
        created++
      } catch { runtimeSkipped.push(d) }
    }
    const allSkipped = [...knownSkipped, ...runtimeSkipped]
    if (created === 0) { setError(t('all_slots_taken')); return }
    // If any runtime skips happened (race condition after pre-check), patch the stored skipped dates
    // by including them in a final pass — simplest: just show combined result
    clearDraft()
    if (allSkipped.length > 0) {
      setSkippedResult({ skipped: allSkipped, created, total: datesToBook.length + knownSkipped.length })
    } else {
      onSubmit?.()
    }
  }

  async function doSubmitSeries() {
    if (!selectedRoom) return
    const dates = generateRepeatDates()
    if (dates.length === 0) { setError(t('err_no_repeat_dates')); return }

    const seriesId = crypto.randomUUID()

    // Always pre-check all slots so we know the skipped dates upfront and can store them on each booking
    const checks = await Promise.all(
      dates.map(d =>
        checkAvailability(selectedRoom.id, `${d} ${startTime}:00`, `${d} ${endTime}:00`)
          .then(res => ({ date: d, available: !!res.available }))
          .catch(() => ({ date: d, available: false }))
      )
    )
    const conflicting = checks.filter(c => !c.available).map(c => c.date)
    const available   = checks.filter(c => c.available).map(c => c.date)

    if (!skipConflicts) {
      if (conflicting.length > 0) {
        setConflictInfo({ conflicting, available, seriesId })
        return
      }
      await doCreateBookings(dates, seriesId)
      return
    }

    // Skip mode: create only available, pass conflicting as knownSkipped
    if (available.length === 0) { setError(t('all_slots_taken')); return }
    await doCreateBookings(available, seriesId, conflicting)
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
        setError(t('err_room_taken'))
        recheckAvailability()
      } else {
        setError(msg || t('err_save_booking'))
      }
    } finally {
      setSubmitting(false)
    }
  }

  // Save draft on close (belt-and-suspenders alongside the auto-save effect).
  function handleClose() {
    if (!editBooking) saveDraft()
    onClose()
  }

  const filteredRooms = (rooms as Room[]).filter((r: Room) => {
    if (activeBuildingId && r.building_id !== activeBuildingId) return false
    const q = roomSearch.toLowerCase()
    return r.name.toLowerCase().includes(q)
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
        @keyframes section-in {
          from { opacity: 0; transform: translateY(-10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes drop-in {
          from { opacity: 0; transform: translateY(-6px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes chip-pop {
          0%   { opacity: 0; transform: scale(0.6); }
          65%  { transform: scale(1.12); }
          100% { opacity: 1; transform: scale(1); }
        }
        @keyframes field-success {
          0%   { box-shadow: 0 0 0 3px rgba(173,238,43,0.55); }
          100% { box-shadow: 0 0 0 0px rgba(173,238,43,0); }
        }
        @keyframes dur-pop {
          0%   { transform: scale(0.8) translateY(3px); opacity: 0.5; }
          65%  { transform: scale(1.08) translateY(-1px); opacity: 1; }
          100% { transform: scale(1) translateY(0); opacity: 1; }
        }
        @keyframes stat-pop {
          0%   { transform: scale(0.65) translateY(6px); opacity: 0; }
          60%  { transform: scale(1.1) translateY(-2px); opacity: 1; }
          100% { transform: scale(1) translateY(0); opacity: 1; }
        }
        @keyframes chip-in {
          0%   { opacity: 0; transform: scale(0.7) translateY(4px); }
          70%  { transform: scale(1.07) translateY(-1px); }
          100% { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>

      {/* Overlay */}
      <div
        className={`fixed inset-0 bg-black/40 backdrop-blur-sm z-[100] transition-opacity duration-300 ${open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
        onClick={handleClose}
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
          background: 'var(--ds-glass-bg)',
          backdropFilter: 'blur(32px) saturate(180%)',
          WebkitBackdropFilter: 'blur(32px) saturate(180%)',
          borderRadius: 24,
          border: '1px solid var(--ds-glass-border)',
          boxShadow: 'var(--ds-glass-shadow)',
        }}
      >
        {/* Header */}
        <div className="px-5 pt-5 pb-4 border-b border-[var(--ds-border-sub)]">
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[var(--ds-text-3)] mb-1.5">Slot Tersedia</p>
          <p className="text-[16px] font-black text-[var(--ds-text-1)] leading-tight truncate">{selectedRoom?.name ?? ''}</p>
          {date && (
            <p className="text-[12px] font-bold text-[var(--ds-text-3)] mt-1">
              {new Date(date + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
            </p>
          )}
        </div>

        {/* Slot list — grows with content, max 5 items before scroll */}
        <div className="py-3" style={{ maxHeight: 300, overflowY: 'auto' }}>
          {miniSlots === null ? (
            <div className="px-4 space-y-2.5">
              {[1,2,3].map(i => (
                <div key={i} className="h-12 bg-[var(--ds-bg-surface-2)] rounded-2xl animate-pulse" style={{ opacity: 1 - i * 0.25 }} />
              ))}
            </div>
          ) : miniSlots.length === 0 ? (
            <div className="flex flex-col items-center gap-2.5 py-6 px-4 text-center">
              <span className="material-symbols-outlined text-4xl text-[var(--ds-text-3)]">event_busy</span>
              <p className="text-[11px] font-black uppercase tracking-wide text-[var(--ds-text-3)]">Penuh</p>
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
                      background: isSelected ? '#adee2b' : 'var(--ds-bg-raised)',
                      border: isSelected ? '1.5px solid #8bc200' : '1.5px solid transparent',
                    }}
                  >
                    <span className="text-[14px] font-black tabular-nums" style={{ color: isSelected ? '#1a3a00' : 'var(--ds-text-1)' }}>
                      {sHH} – {eHH}
                    </span>
                    <span className="text-[11px] font-black px-2 py-1 rounded-xl shrink-0"
                      style={{ background: isSelected ? 'rgba(0,0,0,0.12)' : 'var(--ds-border)', color: isSelected ? '#1a3a00' : 'var(--ds-text-2)' }}>
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
            <div className="flex items-center gap-2">
              <p className="text-[9px] font-black text-[var(--ds-text-3)] uppercase tracking-[0.25em] leading-none">
                {isEdit ? t('panel_edit_booking') : t('panel_book_room')}
              </p>
              {draftRestored && !isEdit && (
                <div className="flex items-center gap-1">
                  <span className="draft-blink flex items-center gap-1 text-[8px] font-black uppercase tracking-wider px-2 py-1 rounded-lg"
                    style={{ background: 'rgba(251,191,36,0.15)', color: '#f59e0b', border: '1.5px solid rgba(251,191,36,0.45)' }}>
                    <span className="inline-block size-1.5 rounded-full" style={{ background: '#f59e0b' }} />
                    Draft
                  </span>
                  <button
                    onClick={() => { clearDraft(); setTitle(''); setDesc(''); setDate(today); setStartTime(''); setEndTime(''); setSelectedRoom(null); setRepeat('none'); setBookFor(''); setBookForUserId(null); setShowBookFor(false); setDraftRestored(false) }}
                    className="text-[var(--ds-text-4)] hover:text-red-400 transition-colors"
                    title="Buang draf">
                    <span className="material-symbols-outlined" style={{ fontSize: 12 }}>close</span>
                  </button>
                </div>
              )}
            </div>
            {/* Room selector */}
            <div className="relative mt-1">
              <button
                onClick={() => setShowRoomDrop(!showRoomDrop)}
                className="text-3xl font-black italic tracking-tighter text-blue-600 leading-none uppercase hover:text-blue-700 transition-colors flex items-center gap-2 rounded-lg px-1 -mx-1"
                style={glowActive ? { animation: 'field-glow-pulse 1.4s ease-in-out forwards' } : undefined}
              >
                {selectedRoom?.name || t('panel_pick_room')}
                <span className="material-symbols-outlined text-lg text-blue-400">expand_more</span>
              </button>
              {showRoomDrop && (
                <div className="absolute top-full left-0 mt-2 w-80 bg-[var(--ds-bg-surface)] border border-[var(--ds-border-sub)] rounded-2xl shadow-2xl z-50 overflow-hidden">
                  {/* Building selector */}
                  {(buildings as Building[]).length > 1 && (
                    <div className="px-3 pt-3 pb-2 border-b border-[var(--ds-border-sub)]">
                      <p className="text-[8px] font-black uppercase tracking-widest text-[var(--ds-text-3)] mb-2">{t('building')}</p>
                      <div className="flex flex-wrap gap-1.5">
                        <button
                          onClick={() => setActiveBuildingId(null)}
                          className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase transition-all ${activeBuildingId === null ? 'bg-black text-[#adee2b]' : 'bg-[var(--ds-bg-surface-2)] text-[var(--ds-text-3)] hover:bg-[var(--ds-border)]'}`}
                        >
                          {t('all')}
                        </button>
                        {(buildings as Building[]).map(b => (
                          <button
                            key={b.id}
                            onClick={() => setActiveBuildingId(b.id)}
                            className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase transition-all ${activeBuildingId === b.id ? 'bg-black text-[#adee2b]' : 'bg-[var(--ds-bg-surface-2)] text-[var(--ds-text-3)] hover:bg-[var(--ds-border)]'}`}
                          >
                            {b.code ?? b.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {/* Search */}
                  <div className="p-3 border-b border-[var(--ds-border-sub)]">
                    <input
                      type="text"
                      placeholder={t('search_room_placeholder')}
                      value={roomSearch}
                      onChange={e => setRoomSearch(e.target.value)}
                      className="w-full bg-[var(--ds-bg-raised)] border border-[var(--ds-border)] rounded-xl px-3 py-2 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-[#adee2b]"
                      autoFocus
                    />
                  </div>
                  <>
                    <style>{`
                      .room-drop-list::-webkit-scrollbar { width: 8px; }
                      .room-drop-list::-webkit-scrollbar-track { background: transparent; margin: 4px 0; }
                      .room-drop-list::-webkit-scrollbar-thumb { background: var(--ds-border); border-radius: 99px; border: 2px solid var(--ds-bg-surface); }
                      .room-drop-list::-webkit-scrollbar-thumb:hover { background: var(--ds-text-4); }
                    `}</style>
                    <div className="room-drop-list overflow-y-auto" style={{ maxHeight: 380, scrollbarWidth: 'thin', scrollbarColor: 'var(--ds-border) transparent' }}>
                      {filteredRooms.map(r => {
                        const isMaint = r.status === 'maintenance'
                        return (
                          <button
                            key={r.id}
                            onClick={() => { setSelectedRoom(r); setShowRoomDrop(false); setRoomSearch('') }}
                            onMouseMove={e => { const p = (r.photos ?? [])[0]; if (p) setHoverRoomPhoto({ x: e.clientX, y: e.clientY, src: p }) }}
                            onMouseLeave={() => setHoverRoomPhoto(null)}
                            className={`w-full flex items-center gap-3 px-4 py-3.5 transition-colors text-left ${isMaint ? 'hover:bg-orange-500/10' : 'hover:bg-[#adee2b]/10'}`}
                          >
                            <div className="flex-1 min-w-0">
                              <p className={`text-sm font-black flex items-center gap-2 ${isMaint ? 'text-orange-700' : 'text-[var(--ds-text-1)]'}`}>
                                {r.name}
                                <span className={`size-2 rounded-full shrink-0 ${isMaint ? 'bg-orange-400' : 'bg-green-400'}`} />
                              </p>
                              <p className={`text-[11px] font-bold mt-0.5 flex items-center gap-1 ${isMaint ? 'text-orange-400' : 'text-[var(--ds-text-3)]'}`}>
                                <span className="material-symbols-outlined" style={{ fontSize: 12 }}>groups</span>
                                {r.capacity} seats
                                <span className="mx-1 opacity-40">·</span>
                                <span className="material-symbols-outlined" style={{ fontSize: 12 }}>layers</span>
                                {r.floor}
                              </p>
                            </div>
                            {isMaint && (
                              <span className="shrink-0 flex items-center gap-1 px-2.5 py-1 bg-orange-500/15 text-orange-500 dark:text-orange-400 rounded-lg text-[9px] font-black uppercase">
                                <span className="material-symbols-outlined" style={{ fontSize: 11 }}>construction</span>
                                {t('type_maintenance')}
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
            onClick={handleClose}
            className="size-10 flex items-center justify-center rounded-full bg-[var(--ds-bg-surface-2)] hover:bg-slate-900 hover:text-[#adee2b] transition-all group"
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
                <p className="text-[13px] font-black uppercase tracking-wide" style={{ color: 'var(--ds-text-1)' }}>{t('special_room_contact_title')}</p>
                <p className="text-[11px] font-medium mt-2 leading-relaxed max-w-[260px] mx-auto" style={{ color: 'var(--ds-text-3)' }}>
                  {t('special_room_contact_msg')}
                </p>
              </div>
              <button
                onClick={() => { setSelectedRoom(null); setShowRoomDrop(true) }}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[var(--ds-bg-surface-2)] hover:bg-[var(--ds-border)] transition-colors text-[10px] font-black uppercase text-[var(--ds-text-2)]"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>arrow_back</span>
                {t('panel_change_room')}
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
          <div ref={panelBodyRef} className="flex-1 overflow-y-auto px-7 space-y-4 pb-4" style={{ scrollbarWidth: 'thin' }}>

            {/* Maintenance warning */}
            {roomIsMaintenance && (
              <div className={`flex items-start gap-3 p-4 rounded-2xl border ${isPrivileged ? 'bg-orange-500/10 border-orange-500/25 dark:border-orange-500/20' : 'bg-red-500/10 border-red-500/25 dark:border-red-500/20'}`}>
                <span className={`material-symbols-outlined shrink-0 mt-0.5 ${isPrivileged ? 'text-orange-500' : 'text-red-500'}`} style={{ fontSize: 18 }}>construction</span>
                <div>
                  <p className={`text-[11px] font-black uppercase tracking-wide ${isPrivileged ? 'text-orange-700 dark:text-orange-400' : 'text-red-700 dark:text-red-400'}`}>
                    {t('panel_maintenance_title')}
                  </p>
                  <p className={`text-[10px] font-medium mt-0.5 leading-relaxed ${isPrivileged ? 'text-orange-600 dark:text-orange-300' : 'text-red-500 dark:text-red-400'}`}>
                    {isPrivileged ? t('panel_maintenance_admin') : t('panel_maintenance_user')}
                  </p>
                </div>
              </div>
            )}

            {/* Date & Time */}
            <div className="bg-[var(--ds-bg-raised)] px-4 py-3.5 rounded-[1.8rem] border border-[var(--ds-border-sub)] space-y-2.5">
              {/* Date */}
              <div className="space-y-1">
                <label className="text-[9px] font-black uppercase text-[var(--ds-text-3)] tracking-wider px-1">{t('panel_date')}</label>
                <GlassDatePicker value={date} onChange={setDate} min={today}>
                  {() => (
                    <button type="button"
                      className="w-full flex items-center gap-2 bg-[var(--ds-bg-surface)] border border-[var(--ds-border)] rounded-xl text-xs font-bold px-3 py-2 hover:border-[#adee2b] transition-all"
                      style={glowActive ? { animation: 'field-glow-pulse 1.4s ease-in-out forwards' } : undefined}>
                      <span className="material-symbols-outlined text-[var(--ds-text-3)] shrink-0" style={{ fontSize: 15 }}>calendar_today</span>
                      <span className={`flex-1 text-left ${date ? 'text-[var(--ds-text-1)]' : 'text-[var(--ds-text-3)]'}`}>{fmtFieldDate(date, language, t('panel_pick_date'))}</span>
                      <span className="material-symbols-outlined text-[var(--ds-text-3)] shrink-0" style={{ fontSize: 13 }}>expand_more</span>
                    </button>
                  )}
                </GlassDatePicker>
              </div>

              {/* Time + Duration */}
              <div className="flex items-start gap-1.5">
                <div className="w-[88px] shrink-0 space-y-1">
                  <label className="text-[9px] font-black uppercase text-[var(--ds-text-3)] tracking-wider px-1">{t('panel_start')}</label>
                  <GlassTimePicker value={startTime} onChange={setStartTime} min={bsStr} max={fromMin(bookingEndMin - 30)}>
                    {() => (
                      <button type="button"
                        className="w-full flex items-center gap-1.5 bg-[var(--ds-bg-surface)] border border-[var(--ds-border)] rounded-xl text-xs font-bold px-2.5 py-2 hover:border-[#adee2b] transition-all"
                        style={glowActive ? { animation: 'field-glow-pulse 1.4s ease-in-out forwards' } : undefined}>
                        <span className="material-symbols-outlined text-[var(--ds-text-3)] shrink-0" style={{ fontSize: 14 }}>schedule</span>
                        <span className={startTime ? 'text-[var(--ds-text-1)] tabular-nums' : 'text-[var(--ds-text-3)]'}>{startTime || '—'}</span>
                      </button>
                    )}
                  </GlassTimePicker>
                </div>

                {/* Arrow — pt skips the label row, self-stretch+flex+items-center centers within field height */}
                <div className="self-stretch flex items-center shrink-0" style={{ paddingTop: 20 }}>
                  <span className="text-[var(--ds-text-3)] text-[10px] font-black">→</span>
                </div>

                <div className="w-[88px] shrink-0 space-y-1">
                  <label className="text-[9px] font-black uppercase text-[var(--ds-text-3)] tracking-wider px-1">{t('panel_end')}</label>
                  <GlassTimePicker value={endTime} onChange={setEndTime} min={fromMin(bookingStartMin + 30)} max={beStr} align="right">
                    {() => (
                      <button type="button"
                        className="w-full flex items-center gap-1.5 bg-[var(--ds-bg-surface)] border border-[var(--ds-border)] rounded-xl text-xs font-bold px-2.5 py-2 hover:border-[#adee2b] transition-all"
                        style={glowActive ? { animation: 'field-glow-pulse 1.4s ease-in-out forwards' } : undefined}>
                        <span className="material-symbols-outlined text-[var(--ds-text-3)] shrink-0" style={{ fontSize: 14 }}>schedule</span>
                        <span className={endTime ? 'text-[var(--ds-text-1)] tabular-nums' : 'text-[var(--ds-text-3)]'}>{endTime || '—'}</span>
                      </button>
                    )}
                  </GlassTimePicker>
                </div>

                {/* Duration badge — same label+field structure for alignment */}
                {(() => {
                  const dur = getDuration()
                  return (
                    <div className="shrink-0 space-y-1">
                      <label className="text-[9px] font-black uppercase text-[var(--ds-text-3)] tracking-wider px-1">{t('panel_duration')}</label>
                      <div
                        key={dur}
                        className="px-3 py-2 rounded-xl text-[15px] font-black leading-none whitespace-nowrap tabular-nums text-center dark:bg-[#adee2b]/15 dark:text-[#adee2b]"
                        style={{
                          backgroundColor: '#d9faa0',
                          color: '#2d5a00',
                          animation: glowActive
                            ? 'duration-glow-pulse 1.4s ease-in-out forwards'
                            : 'dur-pop 0.35s cubic-bezier(0.34,1.56,0.64,1)',
                        }}
                      >
                        {dur}
                      </div>
                    </div>
                  )
                })()}
              </div>

              {/* Past date/time warning */}
              {isPastBookingTime && (
                <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl" style={{ background: 'rgba(234,179,8,0.1)', border: '1px solid rgba(234,179,8,0.25)' }}>
                  <span className="material-symbols-outlined shrink-0" style={{ fontSize: 15, color: '#ca8a04' }}>schedule</span>
                  <p className="text-[11px] font-semibold" style={{ color: '#92610a' }}>{t('past_datetime_inline')}</p>
                </div>
              )}

              {/* Show available time toggle */}
              {selectedRoom && date && (
                <button
                  type="button"
                  onClick={() => setShowMiniPanel(v => !v)}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl font-black text-[11px] uppercase tracking-wider transition-all active:scale-95"
                  style={{
                    background: showMiniPanel ? '#adee2b' : 'var(--ds-bg-surface-2)',
                    color: showMiniPanel ? '#1a3a00' : 'var(--ds-text-2)',
                    border: showMiniPanel ? '1.5px solid #8bc200' : '1.5px solid var(--ds-border)',
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                    {showMiniPanel ? 'visibility_off' : 'calendar_view_week'}
                  </span>
                  {showMiniPanel ? t('panel_hide_slots') : t('panel_show_slots')}
                </button>
              )}
            </div>

            {/* Details */}
            <div className="bg-[var(--ds-bg-raised)] p-5 rounded-[1.8rem] border border-[var(--ds-border-sub)] space-y-3">
              <div className="space-y-1.5 transition-transform duration-200 ease-out focus-within:scale-[1.015] origin-left">
                <div className="flex items-center justify-between px-1">
                  <label className="text-[11px] font-black uppercase text-[var(--ds-text-3)] tracking-wider transition-colors duration-200 focus-within:text-[var(--ds-text-2)]">{t('panel_meeting_title')}</label>
                  <div className="flex items-center gap-1">
                    {!isEdit && preset && (
                      <button
                        type="button"
                        onClick={handlePastePreset}
                        className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-[#adee2b]/15 hover:bg-[#adee2b]/30 text-[#3a6600] dark:text-[#adee2b] transition-all active:scale-95"
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: 11 }}>content_paste</span>
                        <span className="text-[9px] font-black uppercase tracking-wide">Paste</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={handleCopyPreset}
                      className="flex items-center gap-1 px-2 py-0.5 rounded-lg hover:bg-[var(--ds-bg-raised)] text-[var(--ds-text-4)] hover:text-[var(--ds-text-2)] transition-all active:scale-95"
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: 11 }}>{justCopied ? 'check' : 'content_copy'}</span>
                      <span className="text-[9px] font-black uppercase tracking-wide">{justCopied ? 'Copied!' : 'Copy'}</span>
                    </button>
                  </div>
                </div>
                <input type="text" value={title} onChange={e => setTitle(e.target.value)}
                  placeholder={t('panel_title_placeholder')}
                  className="w-full bg-[var(--ds-bg-surface)] border border-[var(--ds-border)] rounded-xl text-sm font-black p-2.5 outline-none transition-all duration-200
                    focus:border-[#adee2b]/60 focus:shadow-[0_0_0_3px_rgba(173,238,43,0.12)] focus:bg-[var(--ds-bg-surface)]" />
              </div>
              <div className="space-y-1.5 transition-transform duration-200 ease-out focus-within:scale-[1.015] origin-left">
                <label className="text-[11px] font-black uppercase text-[var(--ds-text-3)] tracking-wider px-1 transition-colors duration-200 focus-within:text-[var(--ds-text-2)]">{t('panel_description')}</label>
                <textarea rows={2} value={desc} onChange={e => setDesc(e.target.value)}
                  placeholder={t('panel_desc_placeholder')}
                  className="w-full bg-[var(--ds-bg-surface)] border border-[var(--ds-border)] rounded-xl text-sm font-medium p-2.5 outline-none resize-none transition-all duration-200
                    focus:border-[#adee2b]/60 focus:shadow-[0_0_0_3px_rgba(173,238,43,0.12)] focus:bg-[var(--ds-bg-surface)]" />
              </div>

              {/* Booking for — accordion (hidden if disabled by admin, or if editing as a recipient) */}
              {allowBookForOthers && !isRecipientOnly && <div ref={bookForRef}>
                <button
                  type="button"
                  onClick={() => { setShowBookFor(v => !v); if (showBookFor) { setBookFor(''); setBookForUserId(null); setShowBookForDrop(false); setPendingBookFor(null) } }}
                  className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-wider transition-colors"
                  style={{ color: showBookFor ? 'var(--ds-text-2)' : 'var(--ds-text-3)' }}
                >
                  <span className="material-symbols-outlined transition-transform duration-200" style={{ fontSize: 13, transform: showBookFor ? 'rotate(45deg)' : 'rotate(0deg)' }}>
                    add
                  </span>
                  {t('panel_booked_for')}
                  {bookFor && (
                    <span
                      key={bookFor}
                      className="ml-1 px-2 py-0.5 bg-[#adee2b] rounded-full text-black normal-case font-black tracking-normal text-[8px]"
                      style={{ animation: 'chip-pop 0.3s cubic-bezier(0.34,1.56,0.64,1)' }}
                    >
                      {bookFor}
                    </span>
                  )}
                </button>

                {showBookFor && (
                  <div className="relative mt-2" style={{ animation: 'section-in 0.2s ease-out' }}>
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 material-symbols-outlined text-[var(--ds-text-3)]" style={{ fontSize: 15 }}>person</span>
                    <input
                      type="text"
                      value={bookFor}
                      onChange={e => { setBookFor(e.target.value); setBookForUserId(null); setShowBookForDrop(true) }}
                      onFocus={() => setShowBookForDrop(true)}
                      placeholder={t('panel_booked_for_placeholder')}
                      autoFocus
                      className="w-full bg-[var(--ds-bg-surface)] border border-[var(--ds-border)] rounded-xl text-sm font-medium pl-8 pr-8 py-2.5 focus:ring-2 focus:ring-[#adee2b] focus:outline-none transition-all"
                      style={bookForUserId !== null ? { borderColor: '#adee2b', animation: 'field-success 0.5s ease-out' } : undefined}
                    />
                    {bookFor && (
                      <button type="button" onClick={() => { setBookFor(''); setBookForUserId(null) }}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--ds-text-3)] hover:text-[var(--ds-text-2)]">
                        <span className="material-symbols-outlined" style={{ fontSize: 14 }}>close</span>
                      </button>
                    )}
                    {showBookForDrop && (() => {
                      const q = bookFor.toLowerCase()
                      const sameDept = directory.filter(u => u.department === (user?.department ?? ''))
                      const sameDeptFiltered = q ? sameDept.filter(u => u.name.toLowerCase().includes(q)) : sameDept
                      const results = sameDeptFiltered.length > 0
                        ? sameDeptFiltered
                        : q ? directory.filter(u => u.name.toLowerCase().includes(q)) : []
                      if (results.length === 0) return null
                      return (
                        <div
                          className="absolute top-full left-0 right-0 mt-1 bg-[var(--ds-bg-surface)] border border-[var(--ds-border-sub)] rounded-2xl shadow-xl z-50 overflow-hidden"
                          style={{ maxHeight: 200, overflowY: 'auto', animation: 'drop-in 0.18s ease-out' }}
                        >
                          {results.map(u => (
                            <button key={u.id} type="button"
                              onMouseDown={e => {
                                e.preventDefault()
                                setShowBookForDrop(false)
                                if (u.department === (user?.department ?? '')) {
                                  setBookFor(u.name); setBookForUserId(u.id)
                                } else {
                                  setPendingBookFor({ id: u.id, name: u.name, department: u.department })
                                }
                              }}
                              className="w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-[#adee2b]/10 transition-colors text-left">
                              <span className="size-7 rounded-full bg-[#adee2b]/20 flex items-center justify-center text-[11px] font-black text-[#2d5000] shrink-0">
                                {u.name.charAt(0).toUpperCase()}
                              </span>
                              <span className="text-sm font-bold text-[var(--ds-text-1)] truncate">{u.name}</span>
                              <span className="ml-auto text-[9px] font-black text-[var(--ds-text-4)] uppercase">{u.department}</span>
                            </button>
                          ))}
                        </div>
                      )
                    })()}

                    {/* Inline cross-dept confirm */}
                    {pendingBookFor && (
                      <div
                        className="mt-2 rounded-2xl border border-amber-300 dark:border-amber-500/40 bg-amber-50 dark:bg-amber-500/10 px-4 py-3 space-y-2.5"
                        style={{ animation: 'section-in 0.18s ease-out' }}
                      >
                        <div className="flex items-start gap-2.5">
                          <span className="material-symbols-outlined text-amber-500 shrink-0 mt-0.5" style={{ fontSize: 16, fontVariationSettings: "'FILL' 1" }}>warning</span>
                          <div className="min-w-0">
                            <p className="text-[11px] font-black text-[var(--ds-text-1)]">{pendingBookFor.name}</p>
                            <p className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wide">{pendingBookFor.department}</p>
                            <p className="text-[10px] text-[var(--ds-text-3)] mt-0.5">This person is from a different department. Book on their behalf?</p>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => { setBookFor(pendingBookFor.name); setBookForUserId(pendingBookFor.id); setPendingBookFor(null) }}
                            className="flex-1 py-1.5 rounded-xl bg-black dark:bg-white text-[#adee2b] dark:text-black text-[10px] font-black uppercase tracking-wide transition-all hover:opacity-80 active:scale-[0.97]"
                          >
                            Confirm
                          </button>
                          <button
                            type="button"
                            onClick={() => { setPendingBookFor(null); setBookFor('') }}
                            className="flex-1 py-1.5 rounded-xl border border-[var(--ds-border)] text-[var(--ds-text-2)] text-[10px] font-black uppercase tracking-wide transition-all hover:bg-[var(--ds-bg-raised)] active:scale-[0.97]"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>}

              {pantrySaved && (
                <div className="flex items-center gap-2 bg-slate-900 text-[#adee2b] px-4 py-3 rounded-2xl">
                  <span className="material-symbols-outlined text-sm">shopping_bag</span>
                  <span className="text-[9px] font-black uppercase tracking-widest">{t('panel_pantry_added')}</span>
                </div>
              )}
            </div>

            {/* Options */}
            <div className="bg-[var(--ds-bg-raised)] p-5 rounded-[1.8rem] border border-[var(--ds-border-sub)] space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-black uppercase text-[var(--ds-text-3)] tracking-wider px-1">{t('panel_type')}</label>
                  {isPrivileged ? (
                    <div className="grid grid-cols-2 gap-1.5">
                      {([
                        { value: 'internal',    label: t('type_internal'),    bg: '#1d4ed8', text: 'white',   shadow: '0 4px 14px rgba(29,78,216,0.45)' },
                        { value: 'external',    label: t('type_external'),    bg: '#f97316', text: 'white',   shadow: '0 4px 14px rgba(249,115,22,0.45)' },
                        { value: 'maintenance', label: t('type_maintenance'), bg: '#fb923c', text: '#7c2d12', shadow: '0 4px 14px rgba(251,146,60,0.45)' },
                        { value: 'repairment',  label: t('type_repairment'),  bg: '#ef4444', text: 'white',   shadow: '0 4px 14px rgba(239,68,68,0.45)' },
                      ] as const).map(opt => {
                        const isActive = type === opt.value
                        return (
                          <button
                            key={opt.value}
                            onClick={() => setType(opt.value)}
                            className="py-2 text-[10px] font-black uppercase rounded-xl border"
                            style={{
                              background: isActive ? opt.bg : 'transparent',
                              color: isActive ? opt.text : 'var(--ds-text-3)',
                              borderColor: isActive ? opt.bg : 'var(--ds-border)',
                              transform: isActive ? 'scale(1.03)' : 'scale(0.97)',
                              boxShadow: isActive ? opt.shadow : 'none',
                              transition: 'all 0.3s cubic-bezier(0.34,1.56,0.64,1)',
                            }}
                          >
                            {opt.label}
                          </button>
                        )
                      })}
                    </div>
                  ) : (
                    <div className="relative flex bg-[var(--ds-bg-surface-2)] p-1 rounded-full border border-[var(--ds-border-sub)]">
                      <div className="absolute top-1 bottom-1 w-[calc(50%-2px)] rounded-full shadow-sm pointer-events-none transition-all duration-200 ease-[cubic-bezier(0.4,0,0.2,1)]"
                        style={{ left: type === 'internal' ? 3 : 'calc(50%)', width: 'calc(50% - 3px)', background: type === 'internal' ? '#1d4ed8' : '#f97316', transition: 'left 0.2s cubic-bezier(0.4,0,0.2,1)' }} />
                      <button onClick={() => setType('internal')}
                        className={`relative z-10 flex-1 py-1.5 text-[10px] font-black uppercase rounded-full transition-colors duration-150 ${type === 'internal' ? 'text-white' : 'text-[var(--ds-text-3)]'}`}>
                        {t('type_internal')}
                      </button>
                      <button onClick={() => setType('external')}
                        className={`relative z-10 flex-1 py-1.5 text-[10px] font-black uppercase rounded-full transition-colors duration-150 ${type === 'external' ? 'text-white' : 'text-[var(--ds-text-3)]'}`}>
                        {t('type_external')}
                      </button>
                    </div>
                  )}
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-black uppercase text-[var(--ds-text-3)] tracking-wider px-1">{t('panel_status')}</label>
                  <div className="relative flex bg-[var(--ds-bg-surface-2)] p-[3px] rounded-full border border-[var(--ds-border-sub)]">
                    <div className="absolute inset-y-[3px] rounded-full shadow-sm pointer-events-none"
                      style={{
                        left: status === 'confirmed' ? 3 : 'calc(50%)',
                        width: 'calc(50% - 3px)',
                        transition: 'left 0.2s cubic-bezier(0.4,0,0.2,1)',
                        background: status === 'confirmed' ? '#adee2b' : '#d1d5db',
                        backgroundImage: status === 'tentative' ? 'repeating-linear-gradient(45deg, transparent, transparent 4px, rgba(0,0,0,0.09) 4px, rgba(0,0,0,0.09) 8px)' : undefined,
                      }} />
                    <button onClick={() => setStatus('confirmed')}
                      className={`relative z-10 flex-1 py-1.5 text-[10px] font-black uppercase rounded-full transition-colors duration-150 ${status === 'confirmed' ? 'text-black' : 'text-[var(--ds-text-3)]'}`}>
                      {t('status_confirmed')}
                    </button>
                    <button onClick={() => setStatus('tentative')}
                      className={`relative z-10 flex-1 py-1.5 text-[10px] font-black uppercase rounded-full transition-colors duration-150 ${status === 'tentative' ? 'text-[var(--ds-text-2)]' : 'text-[var(--ds-text-3)]'}`}>
                      {t('status_tentative')}
                    </button>
                  </div>
                </div>
              </div>

              {/* Repeat — only for create */}
              {!isEdit && (
                <div className="space-y-3">
                  <label className="text-[9px] font-black uppercase text-[var(--ds-text-3)] tracking-wider px-1">{t('panel_repeat')}</label>
                  {/* Repeat mode toggle: None / Daily / Weekly */}
                  <div className="relative flex bg-[var(--ds-bg-surface-2)] p-1 rounded-full border border-[var(--ds-border-sub)]">
                    <div className="absolute top-1 bottom-1 rounded-full bg-[var(--ds-bg-surface)] shadow-sm pointer-events-none transition-transform duration-200 ease-[cubic-bezier(0.4,0,0.2,1)]"
                      style={{ left: 4, width: 'calc((100% - 8px) / 3)', transform: `translateX(${repeat === 'none' ? 0 : repeat === 'daily' ? 100 : 200}%)` }} />
                    {(['none', 'daily', 'weekly'] as const).map(r => (
                      <button key={r} onClick={() => handleRepeatChange(r)}
                        className={`relative z-10 flex-1 py-1.5 text-[11px] font-black uppercase rounded-full transition-colors duration-150 ${repeat === r ? 'text-[var(--ds-text-1)]' : 'text-[var(--ds-text-3)]'}`}>
                        {REPEAT_LBL[r]}
                      </button>
                    ))}
                  </div>

                  {repeat !== 'none' && (
                    <div className="space-y-2.5" style={{ animation: 'section-in 0.25s ease-out' }}>
                      {/* Weekly day picker */}
                      {repeat === 'weekly' && (
                        <div className="space-y-1.5" style={{ animation: 'section-in 0.22s ease-out' }}>
                          <p className="text-[9px] font-black uppercase text-[var(--ds-text-3)] tracking-wider px-1">{t('repeat_days_label')}</p>
                          <div className="flex gap-1">
                            {DOW_KEYS.map(key => {
                              const selected = weeklyDays.includes(key)
                              return (
                                <button
                                  key={key}
                                  type="button"
                                  title={DOW_FUL[key]}
                                  onClick={() => {
                                    if (selected && weeklyDays.length === 1) return
                                    setWeeklyDays(selected ? weeklyDays.filter(d => d !== key) : [...weeklyDays, key])
                                  }}
                                  className="flex-1 h-9 rounded-xl text-[10px] font-black uppercase"
                                  style={{
                                    background: selected ? '#adee2b' : 'var(--ds-bg-surface-2)',
                                    color: selected ? '#1a3a00' : 'var(--ds-text-4)',
                                    border: selected ? '1.5px solid #7cc000' : '1.5px solid transparent',
                                    transform: selected ? 'scale(1.06)' : 'scale(1)',
                                    boxShadow: selected ? '0 3px 10px rgba(173,238,43,0.4)' : 'none',
                                    transition: 'all 0.25s cubic-bezier(0.34,1.56,0.64,1)',
                                  }}
                                >
                                  {DOW_LBL[key]}
                                </button>
                              )
                            })}
                          </div>
                        </div>
                      )}

                      {/* Count vs Until toggle */}
                      <div className="bg-[var(--ds-bg-surface)] border border-[var(--ds-border-sub)] rounded-2xl p-3 space-y-2">
                        {/* Radio: By count */}
                        <label className="flex items-center gap-3 cursor-pointer">
                          <div
                            onClick={() => setRepeatMode('count')}
                            className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${repeatMode === 'count' ? 'border-black bg-black' : 'border-[var(--ds-border)]'}`}
                          >
                            {repeatMode === 'count' && <div className="w-1.5 h-1.5 rounded-full bg-[#adee2b]" />}
                          </div>
                          <span className="text-[10px] font-black uppercase text-[var(--ds-text-3)] flex-1" onClick={() => setRepeatMode('count')}>
                            {repeat === 'daily' ? t('repeat_for_days') : t('repeat_for_weeks')}
                          </span>
                          {repeatMode === 'count' && (
                            <div className="flex items-center gap-1.5 ml-auto">
                              <button type="button"
                                onClick={() => { const v = Math.max(2, repeatCount - 1); setRepeatCount(v); setRepeatCountRaw(String(v)) }}
                                className="size-7 rounded-lg bg-[var(--ds-bg-surface-2)] hover:bg-[var(--ds-border)] flex items-center justify-center font-black text-[var(--ds-text-2)] transition-colors">
                                <span className="material-symbols-outlined" style={{ fontSize: 15 }}>remove</span>
                              </button>
                              <input
                                type="text"
                                inputMode="numeric"
                                value={repeatCountRaw}
                                onChange={e => {
                                  const raw = e.target.value.replace(/\D/g, '')
                                  setRepeatCountRaw(raw)
                                  const v = parseInt(raw)
                                  if (!isNaN(v) && v >= 2) setRepeatCount(Math.min(repeat === 'daily' ? 90 : 52, v))
                                }}
                                onBlur={e => {
                                  const v = parseInt(e.target.value)
                                  const clamped = isNaN(v) ? 2 : Math.min(repeat === 'daily' ? 90 : 52, Math.max(2, v))
                                  setRepeatCount(clamped)
                                  setRepeatCountRaw(String(clamped))
                                }}
                                className="text-[15px] font-black text-[var(--ds-text-1)] text-center tabular-nums bg-transparent border-b-2 focus:outline-none transition-colors"
                                style={{ width: 36, borderColor: 'var(--ds-border)', caretColor: '#adee2b' }}
                                onFocus={e => { e.target.style.borderColor = '#adee2b'; e.target.select() }}
                                onBlurCapture={e => { e.target.style.borderColor = 'var(--ds-border)' }}
                              />
                              <button type="button"
                                onClick={() => { const v = Math.min(repeat === 'daily' ? 90 : 52, repeatCount + 1); setRepeatCount(v); setRepeatCountRaw(String(v)) }}
                                className="size-7 rounded-lg bg-[var(--ds-bg-surface-2)] hover:bg-[var(--ds-border)] flex items-center justify-center font-black text-[var(--ds-text-2)] transition-colors">
                                <span className="material-symbols-outlined" style={{ fontSize: 15 }}>add</span>
                              </button>
                            </div>
                          )}
                        </label>

                        <div className="border-t border-[var(--ds-border-sub)]" />

                        {/* Radio: Until date */}
                        <label className="flex items-center gap-3 cursor-pointer">
                          <div
                            onClick={() => setRepeatMode('until')}
                            className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${repeatMode === 'until' ? 'border-black bg-black' : 'border-[var(--ds-border)]'}`}
                          >
                            {repeatMode === 'until' && <div className="w-1.5 h-1.5 rounded-full bg-[#adee2b]" />}
                          </div>
                          <span className="text-[10px] font-black uppercase text-[var(--ds-text-3)] flex-1" onClick={() => setRepeatMode('until')}>
                            {t('repeat_until')}
                          </span>
                          {repeatMode === 'until' && (
                            <div className="flex items-center gap-1.5 ml-auto" onClick={e => e.stopPropagation()}>
                              <input
                                type="text"
                                placeholder="DD/MM/YYYY"
                                value={untilDateText}
                                onChange={e => {
                                  const raw = e.target.value
                                  setUntilDateText(raw)
                                  const parsed = parseTypedDate(raw)
                                  if (parsed) setRepeatEndDate(parsed)
                                }}
                                onBlur={e => {
                                  const parsed = parseTypedDate(e.target.value)
                                  if (parsed) {
                                    setRepeatEndDate(parsed)
                                    const [y, m, d] = parsed.split('-')
                                    setUntilDateText(`${d}/${m}/${y}`)
                                  } else if (!e.target.value.trim()) {
                                    setRepeatEndDate('')
                                    setUntilDateText('')
                                  } else {
                                    // restore last valid value
                                    if (repeatEndDate) {
                                      const [y, m, d] = repeatEndDate.split('-')
                                      setUntilDateText(`${d}/${m}/${y}`)
                                    } else {
                                      setUntilDateText('')
                                    }
                                  }
                                }}
                                className="text-[11px] font-black text-[var(--ds-text-1)] bg-transparent border-b-2 focus:outline-none transition-colors placeholder:text-[var(--ds-text-4)] tabular-nums"
                                style={{ width: 88, borderColor: 'var(--ds-border)', caretColor: '#adee2b' }}
                                onFocus={e => { e.target.style.borderColor = '#adee2b' }}
                                onBlurCapture={e => { e.target.style.borderColor = 'var(--ds-border)' }}
                              />
                              <div ref={calendarBtnRef}>
                                <GlassDatePicker value={repeatEndDate} onChange={val => { setRepeatEndDate(val) }} min={date || today} align="right">
                                  {() => (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        // Scroll panel body so the datepicker panel becomes visible
                                        setTimeout(() => {
                                          calendarBtnRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
                                        }, 30)
                                      }}
                                      className="size-7 flex items-center justify-center bg-[var(--ds-bg-surface-2)] hover:bg-[var(--ds-border)] rounded-lg transition-colors">
                                      <span className="material-symbols-outlined text-[var(--ds-text-3)]" style={{ fontSize: 14 }}>calendar_today</span>
                                    </button>
                                  )}
                                </GlassDatePicker>
                              </div>
                            </div>
                          )}
                        </label>
                      </div>

                      {/* Skip conflicts toggle */}
                      <button
                        type="button"
                        onClick={() => setSkipConflicts(!skipConflicts)}
                        className="w-full flex items-center gap-3 bg-[var(--ds-bg-surface)] border border-[var(--ds-border-sub)] rounded-2xl px-4 py-2.5 transition-all hover:border-[var(--ds-border)]"
                      >
                        <div className={`w-9 h-5 rounded-full transition-colors duration-200 relative shrink-0 ${skipConflicts ? 'bg-[#adee2b]' : 'bg-[var(--ds-border)]'}`}>
                          <div className={`absolute top-0.5 w-4 h-4 rounded-full shadow-sm transition-transform duration-200 ${skipConflicts ? 'translate-x-4 bg-black' : 'translate-x-0.5 bg-[var(--ds-bg-surface)]'}`} />
                        </div>
                        <span className={`text-[10px] font-black uppercase ${skipConflicts ? 'text-[var(--ds-text-1)]' : 'text-[var(--ds-text-3)]'}`}>{t('skip_conflicts')}</span>
                        <span className={`ml-auto text-[9px] font-black uppercase ${skipConflicts ? 'text-[#adee2b] dark:text-[#adee2b]/80' : 'text-[var(--ds-text-4)]'}`}>
                          {skipConflicts ? 'ON' : 'OFF'}
                        </span>
                      </button>

                      {/* Repeat preview summary */}
                      {repeatDates.length > 0 && (
                        <div
                          ref={summaryRef}
                          className="bg-[var(--ds-bg-surface-2)] rounded-2xl p-3 space-y-2.5"
                          style={{ animation: 'section-in 0.3s cubic-bezier(0.34,1.56,0.64,1)' }}
                        >
                          {/* Two symmetric stat boxes */}
                          <div className="grid grid-cols-2 gap-2">
                            <div className="bg-[var(--ds-bg-surface)] border border-[var(--ds-border-sub)] rounded-xl py-3 flex flex-col items-center justify-center gap-1 overflow-hidden">
                              <span
                                key={repeatDates.length}
                                className="text-[28px] font-black text-[#adee2b] leading-none tabular-nums"
                                style={{ animation: 'stat-pop 0.38s cubic-bezier(0.34,1.56,0.64,1)' }}
                              >{repeatDates.length}</span>
                              <span className="text-[8px] font-black uppercase tracking-widest text-[var(--ds-text-3)]">{t('series_label')}</span>
                            </div>
                            <div className="bg-[var(--ds-bg-surface)] border border-[var(--ds-border-sub)] rounded-xl py-3 flex flex-col items-center justify-center gap-1 overflow-hidden">
                              <span
                                key={repeatDates[repeatDates.length - 1]}
                                className="text-[18px] font-black text-[var(--ds-text-1)] leading-none"
                                style={{ animation: 'stat-pop 0.38s cubic-bezier(0.34,1.56,0.64,1) 0.04s both' }}
                              >{fmtShortDate(repeatDates[repeatDates.length - 1], language)}</span>
                              <span className="text-[8px] font-black uppercase tracking-widest text-[var(--ds-text-3)]">{t('series_ends')}</span>
                            </div>
                          </div>
                          {/* Preview first 8 dates — stagger-animate when list changes */}
                          <div key={repeatDates.slice(0, 8).join(',')} className="flex flex-wrap gap-1.5">
                            {repeatDates.slice(0, 8).map((d, i) => (
                              <span
                                key={d}
                                className="text-[10px] font-bold bg-[var(--ds-bg-surface)] border border-[var(--ds-border-sub)] rounded-lg px-2.5 py-1 text-[var(--ds-text-2)]"
                                style={{ animation: `chip-in 0.28s cubic-bezier(0.34,1.56,0.64,1) ${i * 30}ms both` }}
                              >
                                {fmtShortDate(d, language)}
                              </span>
                            ))}
                            {repeatDates.length > 8 && (
                              <span
                                className="text-[10px] font-bold bg-black dark:bg-white/10 text-[#adee2b] rounded-lg px-2.5 py-1"
                                style={{ animation: `chip-in 0.28s cubic-bezier(0.34,1.56,0.64,1) ${8 * 30}ms both` }}
                              >
                                +{repeatDates.length - 8} {t('series_more')}
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
                    <p className="text-[11px] font-black uppercase text-white tracking-wider">{t('series_title')}</p>
                    <p className="text-[10px] text-blue-200 font-medium mt-0.5">{t('series_edit_note')}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Availability (single booking only) */}
            {repeat === 'none' && (
              <>
                {isTimeValid() === false && (
                  <div className="flex items-center gap-3 px-4 py-3 rounded-2xl border-2 border-red-500/30 bg-red-500/10">
                    <div className="size-8 rounded-xl bg-red-500 flex items-center justify-center text-white shrink-0">
                      <span className="material-symbols-outlined text-base">schedule</span>
                    </div>
                    <div>
                      <p className="text-[9px] font-black uppercase tracking-widest text-red-700 dark:text-red-400">{t('time_invalid_title')}</p>
                      <p className="text-[9px] mt-0.5 text-red-600 dark:text-red-400">{t('time_invalid_msg')}</p>
                    </div>
                  </div>
                )}
                {isTimeValid() === true && availChecking && (
                  <div className="flex items-center gap-3 px-4 py-3 rounded-2xl border-2 border-[var(--ds-border-sub)] bg-[var(--ds-bg-raised)]">
                    <div className="size-8 rounded-xl bg-[var(--ds-bg-surface-2)] flex items-center justify-center text-[var(--ds-text-3)] shrink-0">
                      <span className="material-symbols-outlined text-base animate-spin">progress_activity</span>
                    </div>
                    <p className="text-[9px] font-black uppercase tracking-widest text-[var(--ds-text-3)]">{t('checking_avail')}</p>
                  </div>
                )}
                {isTimeValid() === true && !availChecking && isAvailable() === true && (
                  <div className={`flex items-center gap-3 px-4 py-3 rounded-2xl border-2 ${(availResult?.other_viewers ?? 0) > 0 ? 'border-amber-500/30 bg-amber-500/10' : 'border-[#adee2b]/50 bg-[#adee2b]/10'}`}>
                    <div className={`size-8 rounded-xl flex items-center justify-center shrink-0 ${(availResult?.other_viewers ?? 0) > 0 ? 'bg-amber-400 text-white' : 'bg-[#adee2b] text-black'}`}>
                      <span className="material-symbols-outlined text-base">{(availResult?.other_viewers ?? 0) > 0 ? 'group' : 'verified'}</span>
                    </div>
                    <div>
                      <p className={`text-[9px] font-black uppercase tracking-widest ${(availResult?.other_viewers ?? 0) > 0 ? 'text-amber-700 dark:text-amber-400' : 'text-green-800 dark:text-[#adee2b]'}`}>
                        {(availResult?.other_viewers ?? 0) > 0 ? `${availResult!.other_viewers} ${t('others_viewing')}` : t('room_available')}
                      </p>
                      <p className={`text-[9px] mt-0.5 ${(availResult?.other_viewers ?? 0) > 0 ? 'text-amber-600 dark:text-amber-300' : 'text-green-700 dark:text-[#adee2b]/70'}`}>
                        {(availResult?.other_viewers ?? 0) > 0 ? t('confirm_quickly') : t('no_conflict')}
                      </p>
                    </div>
                  </div>
                )}
                {isTimeValid() === true && !availChecking && isAvailable() === false && (
                  <div className="flex items-center gap-3 px-4 py-3 rounded-2xl border-2 border-red-500/30 bg-red-500/10">
                    <div className="size-8 rounded-xl bg-red-500 flex items-center justify-center text-white shrink-0">
                      <span className="material-symbols-outlined text-base">block</span>
                    </div>
                    <div>
                      <p className="text-[9px] font-black uppercase tracking-widest text-red-700 dark:text-red-400">{t('room_conflict_title')}</p>
                      <p className="text-[9px] mt-0.5 text-red-600 dark:text-red-400">{t('room_conflict_msg')}</p>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Pantry Slide */}
          <div
            className={`absolute inset-0 bg-[var(--ds-bg-surface)] z-30 flex flex-col border-l-4 border-[#adee2b] transition-transform duration-500 ${pantryOpen ? 'translate-x-0' : 'translate-x-full'}`}
          >
            <div className="p-6 flex items-center justify-between border-b border-[var(--ds-border)] shrink-0">
              <div className="flex items-center gap-3">
                <div className="size-9 bg-black rounded-xl flex items-center justify-center text-[#adee2b]">
                  <span className="material-symbols-outlined text-base">flatware</span>
                </div>
                <h4 className="font-black uppercase tracking-tighter text-xl italic">Pesanan Pantry</h4>
              </div>
              <button
                onClick={() => setPantryOpen(false)}
                className="size-8 bg-[var(--ds-bg-surface-2)] rounded-full flex items-center justify-center hover:bg-black hover:text-[#adee2b] transition-all"
              >
                <span className="material-symbols-outlined text-sm">arrow_back</span>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-5 bg-[var(--ds-bg-raised)]">
              <p className="text-[9px] font-black uppercase text-[var(--ds-text-3)] tracking-widest px-1 mb-3">Hot Beverages</p>
              {[
                { label: 'Coffee', icon: 'coffee', qty: coffeeQty, set: setCoffeeQty, color: 'orange' },
                { label: 'Tea', icon: 'emoji_food_beverage', qty: teaQty, set: setTeaQty, color: 'green' },
              ].map(item => (
                <div key={item.label} className="bg-[var(--ds-bg-surface)] p-4 rounded-3xl border border-[var(--ds-border-sub)] shadow-sm">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`size-10 bg-${item.color}-50 text-${item.color}-500 rounded-2xl flex items-center justify-center`}>
                        <span className="material-symbols-outlined text-lg">{item.icon}</span>
                      </div>
                      <span className="text-xs font-black uppercase">{item.label}</span>
                    </div>
                    <div className="flex items-center bg-[var(--ds-bg-surface-2)] rounded-full p-1 gap-1">
                      <button onClick={() => item.set(Math.max(0, item.qty - 1))} className="size-7 flex items-center justify-center text-sm font-black hover:bg-[var(--ds-bg-surface)] rounded-full transition-colors">−</button>
                      <span className="w-6 text-center text-xs font-black">{item.qty}</span>
                      <button onClick={() => item.set(item.qty + 1)} className="size-7 flex items-center justify-center text-sm font-black hover:bg-[var(--ds-bg-surface)] rounded-full transition-colors">+</button>
                    </div>
                  </div>
                </div>
              ))}
              <p className="text-[9px] font-black uppercase text-[var(--ds-text-3)] tracking-widest px-1 mt-4 mb-3">Others</p>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Water', icon: 'water_full', qty: waterQty, set: setWaterQty, color: 'blue' },
                  { label: 'Snacks', icon: 'cookie', qty: snackQty, set: setSnackQty, color: 'amber' },
                ].map(item => (
                  <div key={item.label} className="bg-[var(--ds-bg-surface)] p-3 rounded-2xl border border-[var(--ds-border-sub)] flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                      <span className={`material-symbols-outlined text-${item.color}-400 text-base`}>{item.icon}</span>
                      <span className="text-[10px] font-black uppercase">{item.label}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => item.set(Math.max(0, item.qty - 1))} className="size-6 flex items-center justify-center text-sm font-black text-[var(--ds-text-3)] hover:text-black">−</button>
                      <span className={`text-[10px] font-black text-${item.color}-600`}>{item.qty}</span>
                      <button onClick={() => item.set(item.qty + 1)} className="size-6 flex items-center justify-center text-sm font-black text-[var(--ds-text-3)] hover:text-black">+</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="p-5 bg-[var(--ds-bg-surface)] border-t border-[var(--ds-border)] shrink-0">
              <button
                onClick={() => { setPantryOpen(false); setPantrySaved(true) }}
                className="w-full py-4 bg-black text-[#adee2b] rounded-full text-[9px] font-black uppercase tracking-[0.2em] hover:scale-[1.02] active:scale-[0.98] transition-transform"
              >
                {t('panel_save_and_back')}
              </button>
            </div>
          </div>

          {/* Cancel Series Modal */}
          {showCancelModal && editBooking && onCancel && (
            <div className="absolute inset-0 z-40 flex items-end" style={{ background: 'rgba(0,0,0,0.35)' }}>
              <div className="w-full bg-[var(--ds-bg-surface)] rounded-t-3xl p-6 space-y-4 shadow-2xl">
                <div className="flex items-center gap-3">
                  <div className="size-9 rounded-2xl bg-red-100 flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-red-500" style={{ fontSize: 18 }}>cancel</span>
                  </div>
                  <div>
                    <p className="text-sm font-black uppercase tracking-tight text-[var(--ds-text-1)]">{t('btn_cancel_booking')}</p>
                    <p className="text-[10px] text-[var(--ds-text-3)] font-bold">{t('cancel_part_of_series')}</p>
                  </div>
                </div>
                <p className="text-[11px] text-[var(--ds-text-3)] leading-relaxed">
                  {t('cancel_series_confirm')}
                </p>
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <button
                    onClick={() => { setShowCancelModal(false); onClose(); setTimeout(() => onCancel(editBooking), 150) }}
                    className="py-3.5 rounded-2xl bg-[var(--ds-bg-surface-2)] text-[var(--ds-text-2)] text-[10px] font-black uppercase tracking-wide hover:bg-[var(--ds-border)] transition-all"
                  >
                    {t('cancel_only_this')}
                  </button>
                  <button
                    onClick={async () => {
                      setShowCancelModal(false)
                      setSubmitting(true); setError('')
                      try { await cancelSeries(editBooking.series_id!); onSubmit?.(); onClose() }
                      catch (err: unknown) {
                        const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
                        setError(msg || t('err_cancel_series'))
                      } finally { setSubmitting(false) }
                    }}
                    className="py-3.5 rounded-2xl bg-red-500 text-white text-[10px] font-black uppercase tracking-wide hover:bg-red-600 transition-all"
                  >
                    {t('cancel_all_series')}
                  </button>
                </div>
                <button
                  onClick={() => setShowCancelModal(false)}
                  className="w-full text-[9px] font-black uppercase text-[var(--ds-text-3)] hover:text-[var(--ds-text-2)] py-1 tracking-wider transition-colors"
                >
                  {t('btn_back')}
                </button>
              </div>
            </div>
          )}

          {/* Conflict Preview Modal (all-or-nothing) */}
          {conflictInfo && (
            <div className="absolute inset-0 z-40 flex items-end" style={{ background: 'rgba(0,0,0,0.45)' }}>
              <div className="w-full bg-[var(--ds-bg-surface)] rounded-t-3xl p-6 space-y-4 shadow-2xl">
                <div className="flex items-center gap-3">
                  <div className="size-9 rounded-2xl bg-red-100 flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-red-500" style={{ fontSize: 18 }}>event_busy</span>
                  </div>
                  <div>
                    <p className="text-sm font-black uppercase tracking-tight text-[var(--ds-text-1)]">{t('conflict_found_title')}</p>
                    <p className="text-[10px] text-[var(--ds-text-3)] font-bold">
                      {conflictInfo.conflicting.length} {t('slots_taken')}
                    </p>
                  </div>
                </div>

                {/* Conflicting dates list */}
                <div className="bg-red-50 rounded-2xl p-3 space-y-1 max-h-32 overflow-y-auto">
                  {conflictInfo.conflicting.map(d => (
                    <div key={d} className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-red-400" style={{ fontSize: 13 }}>block</span>
                      <span className="text-[10px] font-bold text-red-600">{fmtShortDate(d, language)}</span>
                    </div>
                  ))}
                </div>

                <p className="text-[11px] text-[var(--ds-text-3)] leading-relaxed">
                  {conflictInfo.available.length > 0
                    ? t('enable_skip_conflicts').replace('{a}', String(conflictInfo.available.length)).replace('{c}', String(conflictInfo.conflicting.length))
                    : t('all_slots_taken')}
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
                          await doCreateBookings(info.available, info.seriesId, info.conflicting)
                        } catch (err: unknown) {
                          const e = err as { response?: { status?: number; data?: { message?: string } } }
                          const status = e?.response?.status
                          const msg = e?.response?.data?.message
                          if (status === 422 && msg?.toLowerCase().includes('not available')) {
                            setError(t('err_room_taken'))
                            recheckAvailability()
                          } else {
                            setError(msg || t('err_save_booking'))
                          }
                        } finally {
                          setSubmitting(false)
                        }
                      }}
                      className="py-3.5 rounded-2xl bg-black text-[#adee2b] text-[10px] font-black uppercase tracking-wide hover:bg-slate-800 transition-all"
                    >
                      {t('skip_and_book')} {conflictInfo.available.length}
                    </button>
                  )}
                  <button
                    onClick={() => setConflictInfo(null)}
                    className="py-3.5 rounded-2xl bg-[var(--ds-bg-surface-2)] text-[var(--ds-text-2)] text-[10px] font-black uppercase tracking-wide hover:bg-[var(--ds-border)] transition-all"
                  >
                    {t('btn_cancel')}
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
            <div className="bg-[var(--ds-bg-raised)] border border-[var(--ds-border)] rounded-2xl p-4 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="size-7 rounded-xl flex items-center justify-center shrink-0" style={{ background: '#adee2b' }}>
                    <span className="material-symbols-outlined text-black" style={{ fontSize: 14 }}>task_alt</span>
                  </div>
                  <div>
                    <p className="text-[11px] font-black text-[var(--ds-text-1)]">{skippedResult.created} {t('booked_of')} {skippedResult.total} {t('booked_count')}</p>
                    <p className="text-[9px] text-[var(--ds-text-3)] font-bold">{skippedResult.skipped.length} {t('skipped_conflicts')}</p>
                  </div>
                </div>
                <button
                  onClick={() => { setSkippedResult(null); onSubmit?.() }}
                  className="px-3 py-1.5 rounded-xl bg-black text-[#adee2b] text-[9px] font-black uppercase tracking-wide hover:bg-slate-800 transition-all shrink-0"
                >
                  {t('btn_done')}
                </button>
              </div>
              <div className="bg-red-50 rounded-xl p-2.5 space-y-1 max-h-32 overflow-y-auto">
                <p className="text-[8px] font-black uppercase text-red-400 tracking-wider px-1 mb-1.5">{t('skipped_dates_label')}</p>
                {skippedResult.skipped.map(d => (
                  <div key={d} className="flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-red-400 shrink-0" style={{ fontSize: 12 }}>block</span>
                    <span className="text-[11px] font-bold text-red-600">{fmtShortDate(d, language)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Export to Calendar */}
          {title.trim() && date && startTime && endTime && selectedRoom && (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => exportToICS({
                  title,
                  description: desc || undefined,
                  startAt: `${date} ${startTime}:00`,
                  endAt: `${date} ${endTime}:00`,
                  location: [selectedRoom.name, selectedRoom.building?.name].filter(Boolean).join(', '),
                })}
                className="flex items-center gap-1.5 text-[10px] font-bold text-[var(--ds-text-3)] hover:text-[var(--ds-text-1)] transition-colors"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 13 }}>event</span>
                {t('btn_export_ics')}
              </button>
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
                        setError(t('err_room_taken'))
                        recheckAvailability()
                      } else {
                        setError(msg || t('err_save'))
                      }
                    } finally { setSubmitting(false) }
                  }}
                  disabled={!isValid() || submitting}
                  className="py-4 rounded-full text-[9px] font-black uppercase tracking-wide transition-all
                    bg-[#adee2b] text-black hover:bg-slate-900 hover:text-[#adee2b]
                    disabled:bg-[var(--ds-bg-surface-2)] disabled:text-[var(--ds-text-3)] disabled:cursor-not-allowed"
                >
                  {submitting ? '...' : t('btn_save_this')}
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
                      setError(msg || t('err_save_series'))
                    } finally { setSubmitting(false) }
                  }}
                  disabled={!isValid() || submitting}
                  className="py-4 rounded-full text-[9px] font-black uppercase tracking-wide transition-all flex items-center justify-center gap-1
                    bg-blue-600 text-white hover:bg-blue-700
                    disabled:bg-[var(--ds-bg-surface-2)] disabled:text-[var(--ds-text-3)] disabled:cursor-not-allowed"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 12 }}>link</span>
                  {submitting ? '...' : t('btn_save_series')}
                </button>
              </div>
              {onCancel && (
                <button
                  type="button"
                  onClick={() => setShowCancelModal(true)}
                  className="w-full py-3 rounded-full text-[10px] font-black uppercase tracking-[0.15em] transition-all duration-200 border-2 border-red-100 text-red-400 hover:border-red-400 hover:bg-red-50 hover:text-red-600"
                >
                  {t('btn_cancel_booking')}
                </button>
              )}
            </div>
          ) : (
            /* Normal (non-series) submit */
            <>
              <div className="relative w-full">
                <button
                  onClick={handleSubmit}
                  disabled={!isValid() || submitting || !!skippedResult}
                  className="w-full py-5 rounded-full text-[10px] font-black uppercase tracking-[0.2em] shadow-xl transition-all duration-200
                    bg-[#adee2b] text-black hover:bg-black hover:text-[#adee2b] shadow-lime-400/20
                    disabled:bg-[var(--ds-bg-surface-2)] disabled:text-[var(--ds-text-3)] disabled:cursor-not-allowed disabled:shadow-none"
                >
                  {submitting ? t('btn_saving') : isEdit ? t('btn_save_changes') : repeat !== 'none' ? `${t('btn_schedule_sessions')} ${repeatDates.length > 0 ? `(${repeatDates.length})` : ''}`.trim() : t('btn_confirm_booking')}
                </button>
                {/* After-hours overlay — covers the Confirm Booking button */}
                {restrictAfterHours && startTime >= workingHoursEnd && !showReceptionistNotice && (
                  <button
                    onClick={() => { saveDraft(); onClose(); onAfterHoursOpen?.({ buildingId: selectedRoom?.building_id ?? null, workingHoursEnd }) }}
                    className="absolute inset-0 w-full rounded-full flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-[0.1em] transition-all hover:brightness-110 active:scale-[0.98]"
                    style={{
                      background: 'rgba(99,102,241,0.15)',
                      border: '1.5px solid rgba(99,102,241,0.35)',
                      color: '#6366f1',
                      backdropFilter: 'blur(4px)',
                    }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 14, fontVariationSettings: "'FILL' 1" }}>schedule</span>
                    {t('after_hours_msg')}
                    <span className="material-symbols-outlined" style={{ fontSize: 13 }}>chevron_right</span>
                  </button>
                )}
              </div>
              {isEdit && editBooking && onCancel && (
                <button
                  type="button"
                  onClick={() => { onClose(); setTimeout(() => onCancel(editBooking), 150) }}
                  className="w-full py-3 rounded-full text-[10px] font-black uppercase tracking-[0.15em] transition-all duration-200 border-2 border-red-100 text-red-400 hover:border-red-400 hover:bg-red-50 hover:text-red-600"
                >
                  {t('btn_cancel_booking')}
                </button>
              )}
            </>
          )}
        </div>
      </div>

    </>
  )
}
