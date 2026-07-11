import { useState, useRef, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getAvailableRooms } from '../../api/rooms'
import { getBuildings } from '../../api/buildings'
import { getGeneralSettings } from '../../api/settings'
import { useSettings } from '../../context/SettingsContext'
import { useBookingHours } from '../../hooks/useBookingHours'
import { useAuth } from '../../context/AuthContext'
import GlassDatePicker from '../ui/GlassDatePicker'
import GlassTimePicker from '../ui/GlassTimePicker'
import type { AvailableSlot, Building, Room } from '../../types'

/* ── helpers ── */
function toMin(hhmm: string) { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m }
function fromMin(min: number) { return `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}` }

function todayISO() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
function fmtDate(iso: string, lang = 'en') {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString(lang === 'id' ? 'id-ID' : 'en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
}
function slotTime(iso: string) { return iso.split('T')[1]?.slice(0, 5) ?? '' }
function slotDate(iso: string) { return iso.split('T')[0] ?? '' }
function slotDuration(slot: AvailableSlot) {
  const mins = Math.round((new Date(slot.end).getTime() - new Date(slot.start).getTime()) / 60000)
  if (mins < 60) return `${mins}m`
  const h = Math.floor(mins / 60), m = mins % 60
  return m ? `${h}h ${m}m` : `${h}h`
}

function getDatesBetween(start: string, end: string): string[] {
  const dates: string[] = []
  const [sy, sm, sd] = start.split('-').map(Number)
  const [ey, em, ed] = end.split('-').map(Number)
  const cur = new Date(sy, sm - 1, sd)
  const last = new Date(ey, em - 1, ed)
  while (cur <= last) {
    dates.push(`${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}-${String(cur.getDate()).padStart(2, '0')}`)
    cur.setDate(cur.getDate() + 1)
  }
  return dates
}

function splitSlotsByDay(
  slots: AvailableSlot[],
  dates: string[],
  bsMin: number,
  beMin: number,
): Record<string, AvailableSlot[]> {
  const byDate: Record<string, AvailableSlot[]> = {}
  dates.forEach(d => { byDate[d] = [] })
  for (const slot of slots) {
    const sDate = slot.start.slice(0, 10)
    const eDate = slot.end.slice(0, 10)
    const sTime = toMin(slot.start.slice(11, 16))
    const eTime = toMin(slot.end.slice(11, 16))
    for (const d of dates) {
      if (d < sDate || d > eDate) continue
      const segS = d === sDate ? Math.max(sTime, bsMin) : bsMin
      const segE = d === eDate ? Math.min(eTime, beMin) : beMin
      if (segE - segS < 30) continue
      byDate[d].push({ start: `${d}T${fromMin(segS)}:00`, end: `${d}T${fromMin(segE)}:00` })
    }
  }
  return byDate
}

const fieldBtn = 'w-full flex items-center gap-2 bg-[var(--ds-bg-surface)] dark:bg-white/[0.06] border border-[var(--ds-border)] rounded-xl text-[11px] font-bold px-3 py-2 hover:border-[#adee2b] hover:bg-[#fafff0] dark:hover:bg-[#adee2b]/10 transition-all'

type GroupBy = 'room' | 'date' | 'session'

interface Props {
  open: boolean
  bookingOpen: boolean
  onClose: () => void
  onRoomSelect: (room: Room, date: string, startTime?: string, endTime?: string) => void
  prefillDate?: string
  prefillStartTime?: string
  prefillEndTime?: string
}

/* ── Shared room card (no date pills) ── */
function SlotRoomCard({
  room, slots, showDate, onSelect,
}: {
  room: Room
  slots: AvailableSlot[]
  showDate?: boolean
  onSelect: (room: Room, date: string, start: string, end: string) => void
}) {
  const { language, t: tr } = useSettings()
  if (slots.length === 0) return null
  return (
    <div className="rounded-2xl overflow-hidden border border-[var(--ds-border-sub)]">
      <div className="flex items-center gap-3 px-4 py-3 bg-[var(--ds-bg-surface-2)]">
        <div className="size-10 rounded-[10px] bg-[var(--ds-border)] overflow-hidden shrink-0">
          {(room.photos ?? [])[0]
            ? <img src={room.photos[0]} className="w-full h-full object-cover" />
            : <span className="w-full h-full flex items-center justify-center material-symbols-outlined text-[var(--ds-text-3)]" style={{ fontSize: 18 }}>meeting_room</span>
          }
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="text-[12px] font-black text-[var(--ds-text-1)] truncate">{room.name}</p>
            {room.requires_contact && (
              <span className="material-symbols-outlined text-amber-400 shrink-0" style={{ fontSize: 13, fontVariationSettings: "'FILL' 1" }}>star</span>
            )}
          </div>
          <div className="flex items-center gap-2 text-[10px] text-[var(--ds-text-3)] font-medium mt-0.5">
            <span>{room.floor}</span>
            <span className="text-[var(--ds-border)]">·</span>
            <span className="flex items-center gap-0.5">
              <span className="material-symbols-outlined" style={{ fontSize: 11 }}>group</span>
              {room.capacity}
            </span>
          </div>
        </div>
        {room.is_fully_free && (
          <span className="shrink-0 px-2 py-0.5 bg-[#adee2b] text-black rounded-lg text-[8px] font-black uppercase">{tr('fully_free')}</span>
        )}
      </div>
      <div className="divide-y divide-[var(--ds-border-sub)]">
        {slots.map((slot, i) => (
          <button
            key={i}
            type="button"
            onClick={() => onSelect(room, slotDate(slot.start), slotTime(slot.start), slotTime(slot.end))}
            className="w-full flex items-center gap-3 px-4 py-3 bg-[var(--ds-bg-surface)] hover:bg-[#f7fee7] dark:hover:bg-[#adee2b]/[0.08] active:bg-[#edfbb4] dark:active:bg-[#adee2b]/[0.14] transition-colors text-left group"
          >
            <span className="material-symbols-outlined text-[#adee2b] shrink-0" style={{ fontSize: 14 }}>schedule</span>
            <span className="text-[11px] font-black text-[var(--ds-text-1)] tabular-nums flex-1">
              {showDate && (
                <span className="text-[var(--ds-text-3)] font-bold mr-1.5">{fmtDate(slotDate(slot.start), language)} ·</span>
              )}
              {slotTime(slot.start)} – {slotTime(slot.end)}
            </span>
            <span className="text-[9px] font-bold text-[var(--ds-text-3)] uppercase tabular-nums">{slotDuration(slot)}</span>
            <span className="material-symbols-outlined text-[var(--ds-text-4)] dark:text-white/20 group-hover:text-[var(--ds-text-2)] dark:group-hover:text-white/50 transition-colors shrink-0" style={{ fontSize: 14 }}>arrow_forward</span>
          </button>
        ))}
      </div>
    </div>
  )
}

export default function AvailableRoomsPanel({ open, bookingOpen, onClose, onRoomSelect, prefillDate, prefillStartTime, prefillEndTime }: Props) {
  const { defaultBuilding, t, language } = useSettings()
  const { user } = useAuth()
  const isPrivileged = user?.role === 'admin' || user?.role === 'receptionist' || user?.role === 'building_admin'
  const { start: bsStr, end: beStr } = useBookingHours()
  const { data: generalSettings } = useQuery({ queryKey: ['settings-general'], queryFn: getGeneralSettings, staleTime: 5 * 60_000 })
  // After-Hours Restriction (if enabled, for non-privileged users) caps results earlier than Booking Hours end
  const effectiveEndStr = (!isPrivileged && generalSettings?.restrict_after_hours)
    ? (generalSettings?.working_hours_end ?? beStr)
    : beStr
  const bookingStartMin = toMin(bsStr)
  const bookingEndMin   = toMin(effectiveEndStr)

  const [buildingId, setBuildingId]   = useState<number | null>(defaultBuilding)
  const [bDropOpen, setBDropOpen]     = useState(false)

  // Sync buildingId if defaultBuilding loads after mount (async settings)
  useEffect(() => {
    if (defaultBuilding !== null && buildingId === null) setBuildingId(defaultBuilding)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultBuilding])
  const bDropRef                      = useRef<HTMLDivElement>(null)

  const [mode, setMode]               = useState<'day' | 'range'>('day')
  const [displayMode, setDisplayMode] = useState<'day' | 'range'>('day')
  const [formVisible, setFormVisible] = useState(true)

  const [startDate, setStartDate]     = useState(todayISO())
  const [endDate, setEndDate]         = useState(todayISO())
  const [startTime, setStartTime]     = useState('09:00')
  const [endTime, setEndTime]         = useState('10:00')

  const [groupBy, setGroupBy]         = useState<GroupBy>('room')
  const [minCapacity, setMinCapacity] = useState(0)
  const [specialOnly, setSpecialOnly] = useState(false)

  const [searched, setSearched]           = useState(false)
  const [searchKey, setSearchKey]         = useState(0)
  const [selectedRoomDate, setSelectedRoomDate] = useState<Record<number, string>>({})
  const [activeDatePill, setActiveDatePill]     = useState<string>('')
  const [activeSessionPill, setActiveSessionPill] = useState<'morning' | 'afternoon'>('morning')

  const { data: buildings = [] } = useQuery<Building[]>({ queryKey: ['buildings'], queryFn: getBuildings })

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (bDropRef.current && !bDropRef.current.contains(e.target as Node)) setBDropOpen(false)
    }
    if (bDropOpen) document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [bDropOpen])

  // When opened with prefill (e.g. "Find another slot" from series skipped dates)
  useEffect(() => {
    if (!open) return
    if (prefillDate || prefillStartTime || prefillEndTime) {
      setMode('day')
      setDisplayMode('day')
      if (prefillDate) { setStartDate(prefillDate); setEndDate(prefillDate) }
      if (prefillStartTime) setStartTime(prefillStartTime)
      if (prefillEndTime) setEndTime(prefillEndTime)
      setSearched(false)
      setFormVisible(true)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, prefillDate, prefillStartTime, prefillEndTime])

  // Default start/end time for the search fields — plain Booking Hours (start & end).
  // Keeps re-syncing until the user manually touches a time field, so it still applies
  // once async settings load. After-Hours Restriction only caps the *results*, not this field.
  const userEditedTimeRef = useRef(false)
  useEffect(() => {
    if (!open) { userEditedTimeRef.current = false; return }
    if (prefillDate || prefillStartTime || prefillEndTime) return
    if (userEditedTimeRef.current) return
    setStartTime(bsStr)
    setEndTime(beStr)
  }, [open, bsStr, beStr, prefillDate, prefillStartTime, prefillEndTime])

  function onStartTimeChange(v: string) { userEditedTimeRef.current = true; setStartTime(v) }
  function onEndTimeChange(v: string) { userEditedTimeRef.current = true; setEndTime(v) }

  function switchMode(next: 'day' | 'range') {
    if (next === mode) return
    setMode(next)
    setFormVisible(false)
    setTimeout(() => {
      setDisplayMode(next)
      if (next === 'range') {
        const nd = new Date(startDate + 'T12:00:00')
        nd.setDate(nd.getDate() + 1)
        setEndDate(`${nd.getFullYear()}-${String(nd.getMonth()+1).padStart(2,'0')}-${String(nd.getDate()).padStart(2,'0')}`)
      }
      setFormVisible(true)
    }, 140)
  }

  function handleSearch() {
    setSearched(true)
    setSearchKey(k => k + 1)
    setSelectedRoomDate({})
    setActiveDatePill('')
    setActiveSessionPill('morning')
  }

  const selectedBuilding = buildings.find(b => b.id === buildingId)
  const startAt = displayMode === 'day' ? `${startDate}T${startTime}:00` : `${startDate}T00:00:00`
  const endAt   = displayMode === 'day' ? `${startDate}T${endTime}:00`   : `${endDate}T23:59:59`

  const { data: rooms = [], isFetching } = useQuery<Room[]>({
    queryKey: ['available-rooms', searchKey],
    queryFn: () => getAvailableRooms(startAt, endAt, buildingId),
    enabled: searched && buildingId !== null,
  })

  const modeIdx = mode === 'day' ? 0 : 1

  const groupByOptions: { value: GroupBy; label: string; icon: string }[] = [
    { value: 'room',    label: t('by_room'),    icon: 'meeting_room' },
    { value: 'date',    label: t('by_date'),    icon: 'calendar_today' },
    { value: 'session', label: t('by_session'), icon: 'wb_sunny' },
  ]
  const groupByIdx = groupByOptions.findIndex(o => o.value === groupBy)

  return (
    <>
      {open && !bookingOpen && <div className="fixed inset-0 z-[106]" onClick={onClose} />}

      <div
        className="fixed z-[108] flex flex-col rounded-[20px] overflow-hidden transition-transform duration-[450ms] ease-[cubic-bezier(0.32,0.72,0,1)] bg-[rgba(252,252,252,0.98)] dark:bg-[rgba(15,18,30,0.97)]"
        style={{
          top: 12, right: 12, bottom: 12, width: 476,
          transform: !open ? 'translateX(calc(100% + 12px))' : bookingOpen ? 'translateX(-452px)' : 'translateX(0)',
          backdropFilter: 'blur(48px) saturate(180%)',
          WebkitBackdropFilter: 'blur(48px) saturate(180%)',
          boxShadow: '0 8px 64px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.06)',
        }}
      >
        {/* ── Header ── */}
        <div className="px-5 pt-5 pb-4 shrink-0 border-b border-black/[0.06] dark:border-white/[0.08]">
          <div className="flex items-center gap-3">
            <div className="size-9 rounded-[10px] bg-[#adee2b] flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-black" style={{ fontSize: 18 }}>meeting_room</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[8px] font-black uppercase tracking-[0.22em] text-[var(--ds-text-3)]">{t('available_rooms_schedule')}</p>
              <p className="text-[12px] font-black text-[var(--ds-text-1)] uppercase tracking-tight leading-tight">{t('available_rooms')}</p>
            </div>
            <button onClick={onClose} className="size-8 rounded-xl bg-slate-100 dark:bg-white/[0.08] hover:bg-slate-200 dark:hover:bg-white/[0.14] active:scale-95 flex items-center justify-center transition-all shrink-0">
              <span className="material-symbols-outlined text-[var(--ds-text-2)]" style={{ fontSize: 15 }}>close</span>
            </button>
          </div>
        </div>

        {/* ── Filters ── */}
        <div className="relative z-20 px-5 py-4 shrink-0 space-y-3 border-b border-black/[0.06] dark:border-white/[0.08]">

          {/* Building dropdown */}
          <div className="space-y-1">
            <label className="text-[8px] font-black uppercase text-[var(--ds-text-3)] tracking-[0.15em]">{t('building')}</label>
            <div ref={bDropRef} className="relative">
              <button
                type="button"
                onClick={() => setBDropOpen(o => !o)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl border text-[11px] font-bold transition-all
                  ${bDropOpen
                    ? 'bg-[var(--ds-bg-surface)] dark:bg-white/[0.07] border-[#adee2b] ring-2 ring-[#adee2b]/20'
                    : 'bg-[var(--ds-bg-surface)] dark:bg-white/[0.05] border-[var(--ds-border)] hover:border-[var(--ds-text-4)] dark:hover:border-white/20 hover:bg-slate-50 dark:hover:bg-white/[0.08]'}`}
              >
                <span className="material-symbols-outlined text-[var(--ds-text-3)] shrink-0" style={{ fontSize: 14 }}>
                  {selectedBuilding ? 'domain' : 'add_location_alt'}
                </span>
                <span className={`flex-1 text-left truncate ${selectedBuilding ? 'text-[var(--ds-text-1)]' : 'text-[var(--ds-text-3)]'}`}>
                  {selectedBuilding
                    ? `${selectedBuilding.code || selectedBuilding.name}${(selectedBuilding as any).location?.name ? ' - ' + (selectedBuilding as any).location.name : selectedBuilding.address ? ' - ' + selectedBuilding.address : ''}`
                    : 'Select building…'}
                </span>
                <span className="material-symbols-outlined text-[var(--ds-text-3)] shrink-0 transition-transform duration-200" style={{ fontSize: 14, transform: bDropOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}>
                  expand_more
                </span>
              </button>
              <div
                className="absolute left-0 right-0 top-full mt-1.5 z-50 rounded-xl overflow-hidden bg-[rgba(255,255,255,0.98)] dark:bg-[rgba(20,23,40,0.98)]"
                style={{
                  backdropFilter: 'blur(24px)',
                  boxShadow: '0 8px 32px rgba(0,0,0,0.14), 0 0 0 1px rgba(0,0,0,0.07)',
                  opacity: bDropOpen ? 1 : 0,
                  transform: bDropOpen ? 'translateY(0) scale(1)' : 'translateY(-6px) scale(0.97)',
                  transition: 'opacity 150ms ease, transform 150ms cubic-bezier(0.4,0,0.2,1)',
                  pointerEvents: bDropOpen ? 'auto' : 'none',
                  maxHeight: 220, overflowY: 'auto',
                }}
              >
                {buildings.map(b => (
                  <button key={b.id} type="button"
                    onClick={() => { setBuildingId(b.id); setBDropOpen(false); setSearched(false) }}
                    className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-left text-[11px] font-bold transition-colors
                      ${b.id === buildingId ? 'bg-[#adee2b] text-black' : 'text-[var(--ds-text-1)] hover:bg-[#adee2b]/25 dark:hover:bg-[#adee2b]/15'}`}
                  >
                    <span className="material-symbols-outlined shrink-0" style={{ fontSize: 14 }}>
                      {b.id === buildingId ? 'check_circle' : 'domain'}
                    </span>
                    <span className="flex-1 truncate">
                      {b.code || b.name}{(b as any).location?.name ? ` - ${(b as any).location.name}` : b.address ? ` - ${b.address}` : ''}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Search Mode */}
          <div className="space-y-1">
            <label className="text-[8px] font-black uppercase text-[var(--ds-text-3)] tracking-[0.15em]">{t('search_mode')}</label>
            <div className="relative flex items-center p-1 rounded-xl bg-slate-100 dark:bg-white/[0.08]">
              <div
                className="absolute top-1 bottom-1 rounded-[9px] bg-black shadow-sm pointer-events-none transition-transform duration-[250ms] ease-[cubic-bezier(0.4,0,0.2,1)]"
                style={{ left: 4, width: 'calc(50% - 4px)', transform: `translateX(${modeIdx * 100}%)` }}
              />
              {(['day', 'range'] as const).map(m => (
                <button key={m} type="button" onClick={() => switchMode(m)}
                  className={`relative z-10 flex-1 py-1.5 rounded-[9px] text-[11px] font-black uppercase tracking-wide transition-colors duration-200
                    ${mode === m ? 'text-[#adee2b]' : 'text-slate-500 dark:text-white/40 hover:text-slate-700 dark:hover:text-white/70'}`}
                >
                  {m === 'day' ? t('single_day') : t('date_range')}
                </button>
              ))}
            </div>
          </div>

          {/* Group By — range mode only, above form fields so date pickers can open freely below */}
          {mode === 'range' && (
            <div className="space-y-1">
              <label className="text-[8px] font-black uppercase text-[var(--ds-text-3)] tracking-[0.15em]">{t('group_by')}</label>
              <div className="relative flex items-center p-1 rounded-xl bg-slate-100 dark:bg-white/[0.08]">
                <div
                  className="absolute top-1 bottom-1 rounded-[9px] bg-black shadow-sm pointer-events-none transition-all duration-[250ms] ease-[cubic-bezier(0.4,0,0.2,1)]"
                  style={{ left: 4, width: 'calc((100% - 8px) / 3)', transform: `translateX(${groupByIdx * 100}%)` }}
                />
                {groupByOptions.map(opt => (
                  <button key={opt.value} type="button" onClick={() => setGroupBy(opt.value)}
                    className={`relative z-10 flex-1 flex items-center justify-center gap-1.5 py-2 rounded-[9px] text-[11px] font-black uppercase tracking-wide transition-colors duration-200
                      ${groupBy === opt.value ? 'text-[#adee2b]' : 'text-slate-500 dark:text-white/40 hover:text-slate-700 dark:hover:text-white/70'}`}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 13 }}>{opt.icon}</span>
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Form fields — fade + slide on mode switch */}
          <div style={{ opacity: formVisible ? 1 : 0, transform: formVisible ? 'translateY(0)' : 'translateY(4px)', transition: 'opacity 140ms ease, transform 140ms ease' }}>
            {displayMode === 'day' ? (
              <div className="space-y-2">
                <div className="space-y-1">
                  <label className="text-[8px] font-black uppercase text-[var(--ds-text-3)] tracking-[0.15em]">Date</label>
                  <GlassDatePicker value={startDate} onChange={setStartDate} align="left">
                    {({ label }) => (
                      <button type="button" className={fieldBtn}>
                        <span className="material-symbols-outlined text-[var(--ds-text-3)] shrink-0" style={{ fontSize: 13 }}>calendar_today</span>
                        <span className="flex-1 text-left text-[var(--ds-text-1)]">{label || fmtDate(startDate, language)}</span>
                        <span className="material-symbols-outlined text-[var(--ds-text-3)]" style={{ fontSize: 13 }}>expand_more</span>
                      </button>
                    )}
                  </GlassDatePicker>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="text-[8px] font-black uppercase text-[var(--ds-text-3)] tracking-[0.15em]">{t('panel_start')}</label>
                    <GlassTimePicker value={startTime} onChange={onStartTimeChange} min={bsStr} max={fromMin(toMin(beStr) - 30)}>
                      {() => (
                        <button type="button" className={fieldBtn}>
                          <span className="material-symbols-outlined text-[var(--ds-text-3)] shrink-0" style={{ fontSize: 13 }}>schedule</span>
                          <span className="text-[var(--ds-text-1)] tabular-nums">{startTime}</span>
                        </button>
                      )}
                    </GlassTimePicker>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[8px] font-black uppercase text-[var(--ds-text-3)] tracking-[0.15em]">{t('panel_end')}</label>
                    <GlassTimePicker value={endTime} onChange={onEndTimeChange} min={fromMin(toMin(bsStr) + 30)} max={beStr} align="right">
                      {() => (
                        <button type="button" className={fieldBtn}>
                          <span className="material-symbols-outlined text-[var(--ds-text-3)] shrink-0" style={{ fontSize: 13 }}>schedule</span>
                          <span className="text-[var(--ds-text-1)] tabular-nums">{endTime}</span>
                        </button>
                      )}
                    </GlassTimePicker>
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-[8px] font-black uppercase text-[var(--ds-text-3)] tracking-[0.15em]">{t('panel_start')} {t('panel_date')}</label>
                  <GlassDatePicker value={startDate} onChange={d => { setStartDate(d); const nd = new Date(d + 'T12:00:00'); nd.setDate(nd.getDate() + 1); setEndDate(`${nd.getFullYear()}-${String(nd.getMonth()+1).padStart(2,'0')}-${String(nd.getDate()).padStart(2,'0')}`) }}>
                    {({ label }) => (
                      <button type="button" className={fieldBtn}>
                        <span className="material-symbols-outlined text-[var(--ds-text-3)] shrink-0" style={{ fontSize: 13 }}>calendar_today</span>
                        <span className="flex-1 text-left text-[var(--ds-text-1)] truncate">{label || fmtDate(startDate, language)}</span>
                      </button>
                    )}
                  </GlassDatePicker>
                </div>
                <div className="space-y-1">
                  <label className="text-[8px] font-black uppercase text-[var(--ds-text-3)] tracking-[0.15em]">{t('panel_end')} {t('panel_date')}</label>
                  <GlassDatePicker value={endDate} onChange={setEndDate} min={startDate} align="right">
                    {({ label }) => (
                      <button type="button" className={fieldBtn}>
                        <span className="material-symbols-outlined text-[var(--ds-text-3)] shrink-0" style={{ fontSize: 13 }}>calendar_today</span>
                        <span className="flex-1 text-left text-[var(--ds-text-1)] truncate">{label || fmtDate(endDate, language)}</span>
                      </button>
                    )}
                  </GlassDatePicker>
                </div>
              </div>
            )}
          </div>

          {/* Minimum Seats filter */}
          <style>{`
            .seat-slider { -webkit-appearance: none; appearance: none; outline: none; }
            .seat-slider::-webkit-slider-runnable-track { height: 6px; border-radius: 9999px; }
            .seat-slider::-webkit-slider-thumb { -webkit-appearance: none; width: 16px; height: 16px; border-radius: 50%; background: #000; cursor: pointer; margin-top: -5px; box-shadow: 0 1px 4px rgba(0,0,0,0.25); border: 2px solid #fff; transition: transform 0.1s; }
            .seat-slider::-webkit-slider-thumb:hover { transform: scale(1.15); }
            .seat-slider::-moz-range-track { height: 6px; border-radius: 9999px; background: #e2e8f0; }
            .seat-slider::-moz-range-progress { height: 6px; border-radius: 9999px; background: #000; }
            .seat-slider::-moz-range-thumb { width: 16px; height: 16px; border-radius: 50%; background: #000; cursor: pointer; border: 2px solid #fff; box-shadow: 0 1px 4px rgba(0,0,0,0.25); }
            .dark .seat-slider::-webkit-slider-thumb { background: #fff; border-color: rgba(255,255,255,0.15); }
            .dark .seat-slider::-moz-range-thumb { background: #fff; border-color: rgba(255,255,255,0.15); }
            .dark .seat-slider::-moz-range-track { background: rgba(255,255,255,0.15); }
            .dark .seat-slider::-moz-range-progress { background: #fff; }
          `}</style>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[8px] font-black uppercase text-[var(--ds-text-3)] tracking-[0.15em]">{t('minimum_seats')}</label>
              {minCapacity > 0 && (
                <button
                  type="button"
                  onClick={() => setMinCapacity(0)}
                  className="text-[8px] font-black uppercase text-[var(--ds-text-3)] hover:text-[var(--ds-text-1)] transition-colors flex items-center gap-0.5"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 10 }}>close</span>{t('clear')}
                </button>
              )}
            </div>
            <div className="flex items-center gap-2">
              {(() => {
                const pct = Math.round((Math.min(minCapacity, 50) / 50) * 100)
                return (
                  <input
                    type="range"
                    min={0}
                    max={50}
                    step={1}
                    value={Math.min(minCapacity, 50)}
                    onChange={e => setMinCapacity(Number(e.target.value))}
                    className="seat-slider flex-1 cursor-pointer"
                    style={{
                      background: `linear-gradient(to right, var(--ds-text-1) ${pct}%, var(--ds-border) ${pct}%)`,
                      height: 6,
                      borderRadius: 9999,
                    }}
                  />
                )
              })()}
              <input
                type="number"
                min={0}
                max={999}
                value={minCapacity === 0 ? '' : minCapacity}
                placeholder="0"
                onChange={e => {
                  const v = parseInt(e.target.value)
                  setMinCapacity(isNaN(v) || v < 0 ? 0 : v)
                }}
                className="w-14 border border-[var(--ds-border)] rounded-lg px-2 py-1 text-[11px] font-bold text-center bg-[var(--ds-bg-surface)] text-[var(--ds-text-1)] focus:outline-none focus:border-[var(--ds-text-1)] transition-colors"
              />
            </div>
            {minCapacity > 0 && (
              <p className="text-[9px] font-bold text-[var(--ds-text-3)]">
                {t('showing_rooms_with')} <span className="text-[var(--ds-text-1)] font-black">{minCapacity}+</span> {t('seats_suffix')}
              </p>
            )}
          </div>

          {/* Special Rooms only toggle — receptionist/admin only */}
          {isPrivileged && (
            <button
              type="button"
              onClick={() => setSpecialOnly(v => !v)}
              className={`flex items-center gap-2 w-fit rounded-full px-3 py-1.5 transition-all text-[10px] font-black uppercase tracking-wide border
                ${specialOnly
                  ? 'bg-[#adee2b] border-[#adee2b] text-black'
                  : 'bg-transparent border-[var(--ds-border)] dark:border-white/20 text-[var(--ds-text-3)]'
                }`}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 13 }}>star</span>
              {t('special_rooms_only')}
            </button>
          )}

          {/* Search button */}
          <button
            onClick={handleSearch}
            disabled={!buildingId || isFetching}
            className="w-full py-2.5 rounded-xl bg-black text-[#adee2b] text-[10px] font-black uppercase tracking-[0.15em]
              hover:bg-slate-800 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed
              flex items-center justify-center gap-2 transition-all"
          >
            {isFetching
              ? <><span className="material-symbols-outlined animate-spin" style={{ fontSize: 14 }}>progress_activity</span>{t('searching')}</>
              : <><span className="material-symbols-outlined" style={{ fontSize: 14 }}>search</span>{t('search_btn')}</>}
          </button>
        </div>

        {/* ── Results ── */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3" style={{ scrollbarWidth: 'thin' }}>

          {!buildingId && (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-center py-12">
              <span className="material-symbols-outlined text-slate-200 dark:text-white/10" style={{ fontSize: 44 }}>domain</span>
              <p className="text-[11px] font-black text-[var(--ds-text-3)] uppercase tracking-wide">{t('select_building_first')}</p>
            </div>
          )}

          {buildingId && !searched && !isFetching && (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-center py-12">
              <span className="material-symbols-outlined text-slate-200 dark:text-white/10" style={{ fontSize: 44 }}>meeting_room</span>
              <p className="text-[11px] font-bold text-[var(--ds-text-3)]">{t('pick_date_time')}</p>
            </div>
          )}

          {buildingId && searched && !isFetching && rooms.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-center py-12">
              <span className="material-symbols-outlined text-slate-200 dark:text-white/10" style={{ fontSize: 44 }}>do_not_disturb</span>
              <p className="text-[12px] font-black text-[var(--ds-text-2)]">{t('no_rooms_available')}</p>
              <p className="text-[11px] text-[var(--ds-text-3)]">{t('all_rooms_booked')}</p>
            </div>
          )}

          {buildingId && searched && !isFetching && rooms.length > 0 && (() => {
            const visibleRooms = rooms.filter((r: Room) =>
  (isPrivileged || !r.requires_contact) &&
  (!minCapacity || r.capacity >= minCapacity) &&
  (!specialOnly || r.requires_contact)
)
            if (visibleRooms.length === 0) return (
              <div className="flex flex-col items-center justify-center h-full gap-3 text-center py-12">
                <span className="material-symbols-outlined text-slate-200 dark:text-white/10" style={{ fontSize: 44 }}>do_not_disturb</span>
                <p className="text-[12px] font-black text-[var(--ds-text-2)]">{t('no_rooms_available')}</p>
              </div>
            )

            const isRange = displayMode === 'range' && startDate !== endDate
            const rangeDates = isRange ? getDatesBetween(startDate, endDate) : []

            const singleSlots: Record<number, AvailableSlot[]> = {}
            const rangeSlots: Record<number, Record<string, AvailableSlot[]>> = {}
            visibleRooms.forEach((room: Room) => {
              if (isRange) {
                rangeSlots[room.id] = splitSlotsByDay(room.available_slots ?? [], rangeDates, bookingStartMin, bookingEndMin)
              } else {
                singleSlots[room.id] = (room.available_slots ?? [])
                  .filter((slot: AvailableSlot) => {
                    const s = toMin(slotTime(slot.start))
                    const e = toMin(slotTime(slot.end))
                    const cappedE = Math.min(e, bookingEndMin)
                    return s >= bookingStartMin && s < bookingEndMin && cappedE - s >= 30
                  })
                  .map((slot: AvailableSlot) => {
                    const e = toMin(slotTime(slot.end))
                    if (e <= bookingEndMin) return slot
                    return { ...slot, end: `${slot.end.slice(0, 11)}${fromMin(bookingEndMin)}:00` }
                  })
              }
            })

            function allSlotsFor(room: Room): AvailableSlot[] {
              if (isRange) return rangeDates.flatMap(d => rangeSlots[room.id]?.[d] ?? [])
              return singleSlots[room.id] ?? []
            }

            /* ── GROUP BY ROOM ── */
            if (groupBy === 'room' || !isRange) {
              return (
                <>
                  <p className="text-[8px] font-black uppercase tracking-widest text-[var(--ds-text-3)] pb-0.5">
                    {visibleRooms.length} room{visibleRooms.length !== 1 ? 's' : ''} with availability
                  </p>
                  {visibleRooms.map((room: Room) => {
                    const byDate = isRange ? rangeSlots[room.id] : {}
                    const datesWithSlots = rangeDates.filter(d => (byDate[d]?.length ?? 0) > 0)
                    const activeDate = selectedRoomDate[room.id] ?? datesWithSlots[0] ?? ''
                    const visibleSlots = isRange ? (byDate[activeDate] ?? []) : singleSlots[room.id]

                    return (
                      <div key={room.id} className="rounded-2xl overflow-hidden border border-[var(--ds-border-sub)]">
                        <div className="flex items-center gap-3 px-4 py-3 bg-[var(--ds-bg-surface-2)]">
                          <div className="size-10 rounded-[10px] bg-[var(--ds-border)] overflow-hidden shrink-0">
                            {(room.photos ?? [])[0]
                              ? <img src={room.photos[0]} className="w-full h-full object-cover" />
                              : <span className="w-full h-full flex items-center justify-center material-symbols-outlined text-[var(--ds-text-3)]" style={{ fontSize: 18 }}>meeting_room</span>
                            }
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <p className="text-[12px] font-black text-[var(--ds-text-1)] truncate">{room.name}</p>
                              {room.requires_contact && (
                                <span className="material-symbols-outlined text-amber-400 shrink-0" style={{ fontSize: 13, fontVariationSettings: "'FILL' 1" }}>star</span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 text-[10px] text-[var(--ds-text-3)] font-medium mt-0.5">
                              <span>{room.floor}</span>
                              <span className="text-[var(--ds-border)]">·</span>
                              <span className="flex items-center gap-0.5">
                                <span className="material-symbols-outlined" style={{ fontSize: 11 }}>group</span>
                                {room.capacity}
                              </span>
                            </div>
                          </div>
                          {room.is_fully_free && (
                            <span className="shrink-0 px-2 py-0.5 bg-[#adee2b] text-black rounded-lg text-[8px] font-black uppercase">{t('fully_free')}</span>
                          )}
                        </div>

                        {isRange && datesWithSlots.length > 0 && (
                          <div className="px-3 pt-2.5 pb-2 flex items-center gap-1.5 flex-wrap bg-[var(--ds-bg-surface)] border-b border-[var(--ds-border-sub)]">
                            {datesWithSlots.map(d => {
                              const isActive = d === activeDate
                              return (
                                <button key={d} type="button"
                                  onClick={() => setSelectedRoomDate(prev => ({ ...prev, [room.id]: d }))}
                                  className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[9px] font-black uppercase transition-all
                                    ${isActive ? 'bg-black dark:bg-white text-[#adee2b] dark:text-black' : 'bg-[var(--ds-bg-raised)] text-[var(--ds-text-2)] hover:bg-[var(--ds-border)]'}`}
                                >
                                  {fmtDate(d, language)}
                                  <span className={`text-[8px] px-1.5 py-0.5 rounded-full leading-none font-black
                                    ${isActive ? 'bg-white/15 dark:bg-black/15 text-[#adee2b] dark:text-black' : 'bg-[var(--ds-border)] text-[var(--ds-text-3)]'}`}>
                                    {byDate[d].length}
                                  </span>
                                </button>
                              )
                            })}
                          </div>
                        )}

                        <div className="divide-y divide-[var(--ds-border-sub)]">
                          {visibleSlots.map((slot: AvailableSlot, i: number) => (
                            <button key={i} type="button"
                              onClick={() => onRoomSelect(room, slotDate(slot.start), slotTime(slot.start), slotTime(slot.end))}
                              className="w-full flex items-center gap-3 px-4 py-3 bg-[var(--ds-bg-surface)] hover:bg-[#f7fee7] dark:hover:bg-[#adee2b]/[0.08] active:bg-[#edfbb4] dark:active:bg-[#adee2b]/[0.14] transition-colors text-left group"
                            >
                              <span className="material-symbols-outlined text-[#adee2b] shrink-0" style={{ fontSize: 14 }}>schedule</span>
                              <span className="text-[11px] font-black text-[var(--ds-text-1)] tabular-nums flex-1">
                                {slotTime(slot.start)} – {slotTime(slot.end)}
                              </span>
                              <span className="text-[9px] font-bold text-[var(--ds-text-3)] uppercase tabular-nums">{slotDuration(slot)}</span>
                              <span className="material-symbols-outlined text-[var(--ds-text-4)] dark:text-white/20 group-hover:text-[var(--ds-text-2)] dark:group-hover:text-white/50 transition-colors shrink-0" style={{ fontSize: 14 }}>arrow_forward</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </>
              )
            }

            /* ── GROUP BY DATE — pill nav at top ── */
            if (groupBy === 'date') {
              const datesWithRooms = rangeDates.filter(d =>
                visibleRooms.some((r: Room) => (rangeSlots[r.id]?.[d]?.length ?? 0) > 0)
              )
              if (datesWithRooms.length === 0) return (
                <div className="flex flex-col items-center justify-center h-full gap-3 text-center py-12">
                  <span className="material-symbols-outlined text-slate-200 dark:text-white/10" style={{ fontSize: 44 }}>do_not_disturb</span>
                  <p className="text-[12px] font-black text-[var(--ds-text-2)]">{t('no_rooms_available')}</p>
                </div>
              )

              const currentDate = activeDatePill && datesWithRooms.includes(activeDatePill)
                ? activeDatePill : datesWithRooms[0]

              const roomsForDate = visibleRooms.filter((r: Room) => (rangeSlots[r.id]?.[currentDate]?.length ?? 0) > 0)

              return (
                <>
                  {/* Sticky date pill nav */}
                  <div className="sticky top-0 z-10 -mx-5 px-5 -mt-4 pt-1 pb-2 flex gap-1.5 flex-wrap">
                    {datesWithRooms.map(d => {
                      const isActive = d === currentDate
                      const count = visibleRooms.filter((r: Room) => (rangeSlots[r.id]?.[d]?.length ?? 0) > 0).length
                      return (
                        <button key={d} type="button" onClick={() => setActiveDatePill(d)}
                          className={`group flex items-center gap-1 px-3 py-1.5 rounded-full text-[10px] font-black uppercase transition-all active:scale-95 border backdrop-blur-md
                            ${isActive
                              ? 'bg-[rgba(10,15,40,0.82)] border-white/[0.12] text-[#adee2b] shadow-[0_2px_12px_rgba(0,0,0,0.22)]'
                              : 'bg-[rgba(10,15,40,0.26)] border-white/[0.08] text-white/60 hover:bg-[rgba(10,15,40,0.48)] hover:border-white/[0.15] hover:text-white/90'}`}
                        >
                          {fmtDate(d, language)}
                          <span className={`text-[8px] px-1.5 py-0.5 rounded-full leading-none font-black transition-colors
                            ${isActive ? 'bg-[rgba(173,238,43,0.18)] text-[#adee2b]' : 'bg-white/10 text-white/50 group-hover:text-white/75'}`}>
                            {count}
                          </span>
                        </button>
                      )
                    })}
                  </div>

                  {roomsForDate.map((room: Room) => (
                    <SlotRoomCard
                      key={room.id}
                      room={room}
                      slots={rangeSlots[room.id]?.[currentDate] ?? []}
                      onSelect={onRoomSelect}
                    />
                  ))}
                </>
              )
            }

            /* ── GROUP BY SESSION — pill nav at top ── */
            if (groupBy === 'session') {
              const sessionDefs = [
                { key: 'morning'   as const, label: t('label_morning'),   icon: 'wb_sunny',   test: (ts: string) => ts < '12:00' },
                { key: 'afternoon' as const, label: t('label_afternoon'), icon: 'wb_twilight', test: (ts: string) => ts >= '12:00' },
              ]

              const availableSessions = sessionDefs.filter(sess =>
                visibleRooms.some((r: Room) => allSlotsFor(r).some(s => sess.test(slotTime(s.start))))
              )
              if (availableSessions.length === 0) return (
                <div className="flex flex-col items-center justify-center h-full gap-3 text-center py-12">
                  <span className="material-symbols-outlined text-slate-200 dark:text-white/10" style={{ fontSize: 44 }}>do_not_disturb</span>
                  <p className="text-[12px] font-black text-[var(--ds-text-2)]">{t('no_rooms_available')}</p>
                </div>
              )

              const currentSession = availableSessions.some(s => s.key === activeSessionPill)
                ? activeSessionPill : availableSessions[0].key
              const sessDef = sessionDefs.find(s => s.key === currentSession)!

              const sessionEndCap = currentSession === 'morning' ? 720 : bookingEndMin  // 12:00 or effective end
              const roomsForSession = visibleRooms
                .map((r: Room) => {
                  const slots = allSlotsFor(r)
                    .filter(s => sessDef.test(slotTime(s.start)))
                    .map(s => {
                      const eMin = toMin(slotTime(s.end))
                      if (eMin <= sessionEndCap) return s
                      return { ...s, end: `${s.end.slice(0, 11)}${fromMin(sessionEndCap)}:00` }
                    })
                    .filter(s => toMin(slotTime(s.end)) - toMin(slotTime(s.start)) >= 30)
                  return { room: r, slots }
                })
                .filter(({ slots }) => slots.length > 0)

              return (
                <>
                  {/* Sticky session pill nav */}
                  <div className="sticky top-0 z-10 -mx-5 px-5 -mt-4 pt-1 pb-2 flex gap-2">
                    {availableSessions.map(sess => {
                      const isActive = sess.key === currentSession
                      const count = visibleRooms.filter((r: Room) =>
                        allSlotsFor(r).some(s => sess.test(slotTime(s.start)))
                      ).length
                      return (
                        <button key={sess.key} type="button" onClick={() => setActiveSessionPill(sess.key)}
                          className={`group flex items-center gap-1.5 px-4 py-2 rounded-full text-[11px] font-black uppercase transition-all active:scale-95 border backdrop-blur-md
                            ${isActive
                              ? 'bg-[rgba(10,15,40,0.82)] border-white/[0.12] text-[#adee2b] shadow-[0_2px_12px_rgba(0,0,0,0.22)]'
                              : 'bg-[rgba(10,15,40,0.26)] border-white/[0.08] text-white/60 hover:bg-[rgba(10,15,40,0.48)] hover:border-white/[0.15] hover:text-white/90'}`}
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: 14 }}>{sess.icon}</span>
                          {sess.label}
                          <span className={`text-[9px] px-1.5 py-0.5 rounded-full leading-none font-black transition-colors
                            ${isActive ? 'bg-[rgba(173,238,43,0.18)] text-[#adee2b]' : 'bg-white/10 text-white/50 group-hover:text-white/75'}`}>
                            {count}
                          </span>
                        </button>
                      )
                    })}
                  </div>

                  {roomsForSession.map(({ room, slots }) => (
                    <SlotRoomCard key={room.id} room={room} slots={slots} showDate={isRange} onSelect={onRoomSelect} />
                  ))}
                </>
              )
            }

            return null
          })()}
        </div>
      </div>
    </>
  )
}
