import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useSettings } from '../../context/SettingsContext'
import { useWeekendSettings } from '../../hooks/useWeekendSettings'

const MONTHS_SHORT_EN = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const MONTHS_LONG_EN  = ['January','February','March','April','May','June','July','August','September','October','November','December']
const MONTHS_SHORT_ID = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des']
const MONTHS_LONG_ID  = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember']
const WEEKDAYS_SUN_EN = ['Su','Mo','Tu','We','Th','Fr','Sa']
const WEEKDAYS_MON_EN = ['Mo','Tu','We','Th','Fr','Sa','Su']
const WEEKDAYS_SUN_ID = ['Mi','Se','Se','Ra','Ka','Ju','Sa']
const WEEKDAYS_MON_ID = ['Se','Se','Ra','Ka','Ju','Sa','Mi']

function parseISO(iso: string): Date | null {
  if (!iso) return null
  const [y, m, d] = iso.split('T')[0].split('-').map(Number)
  if (!y || !m || !d) return null
  return new Date(y, m - 1, d)
}
function toISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
function sameDay(a: Date, b: Date) {
  return a.getDate() === b.getDate() && a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear()
}
function dayFloor(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
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
      const dt = new Date(y, m - 1, d)
      if (dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d) {
        return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
      }
    }
  }
  return null
}

interface GlassDatePickerProps {
  value: string                                       // 'yyyy-MM-dd'
  onChange: (iso: string) => void
  min?: string                                        // 'yyyy-MM-dd'
  align?: 'left' | 'right'
  panelWidth?: number
  compact?: boolean
  footer?: (close: () => void) => ReactNode
  highlightWeek?: { start: string; end: string }      // highlight a week range in the calendar
  children: (o: { open: boolean; label: string }) => ReactNode
}

export default function GlassDatePicker({ value, onChange, min, align = 'left', panelWidth, compact = false, footer, highlightWeek, children }: GlassDatePickerProps) {
  const defaultWidth = compact ? 232 : 300
  panelWidth = panelWidth ?? defaultWidth
  const { startDay, language } = useSettings()
  const { saturday: wkSat, sunday: wkSun } = useWeekendSettings()
  const [open, setOpen] = useState(false)
  const [view, setView] = useState<'days' | 'months'>('days')
  const [cursor, setCursor] = useState(() => parseISO(value) ?? new Date())
  const [typedText, setTypedText] = useState('')
  const ref = useRef<HTMLDivElement>(null)
  const popupRef = useRef<HTMLDivElement>(null)
  const [popupStyle, setPopupStyle] = useState<CSSProperties>({})

  const isId = language === 'id'
  const MONTHS_SHORT = isId ? MONTHS_SHORT_ID : MONTHS_SHORT_EN
  const MONTHS_LONG  = isId ? MONTHS_LONG_ID  : MONTHS_LONG_EN
  const WEEKDAYS_SUN = isId ? WEEKDAYS_SUN_ID : WEEKDAYS_SUN_EN
  const WEEKDAYS_MON = isId ? WEEKDAYS_MON_ID : WEEKDAYS_MON_EN

  const selected = parseISO(value)
  const today = new Date()
  const minDate = min ? parseISO(min) : null
  const weekdays = startDay === 'mon' ? WEEKDAYS_MON : WEEKDAYS_SUN

  function calcPopupStyle() {
    if (!ref.current) return {}
    const r = ref.current.getBoundingClientRect()
    const style: CSSProperties = {
      position: 'fixed',
      top: r.bottom + 8,
      zIndex: 9999,
      width: panelWidth,
    }
    if (align === 'right') {
      style.right = window.innerWidth - r.right
    } else {
      style.left = r.left
    }
    return style
  }

  function toggle() {
    if (!open) {
      const sel = parseISO(value)
      setCursor(sel ?? new Date())
      setTypedText(sel ? `${String(sel.getDate()).padStart(2, '0')}/${String(sel.getMonth() + 1).padStart(2, '0')}/${sel.getFullYear()}` : '')
      setView('days')
      setPopupStyle(calcPopupStyle())
    }
    setOpen(o => !o)
  }

  function commitTyped(raw: string) {
    const iso = parseTypedDate(raw)
    if (!iso) return
    const d = parseISO(iso)
    if (!d || beforeMin(d)) return
    onChange(iso)
    setCursor(d)
  }

  useEffect(() => {
    if (!open) return
    function onDoc(e: MouseEvent) {
      const t = e.target as Node
      if (
        ref.current && !ref.current.contains(t) &&
        popupRef.current && !popupRef.current.contains(t)
      ) setOpen(false)
    }
    function onScroll() { setPopupStyle(calcPopupStyle()) }
    document.addEventListener('mousedown', onDoc)
    window.addEventListener('resize', onScroll)
    window.addEventListener('scroll', onScroll, true)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      window.removeEventListener('resize', onScroll)
      window.removeEventListener('scroll', onScroll, true)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // After the popup renders, flip it above the trigger if it would overflow the
  // bottom of the viewport (the panel it lives in may not scroll far enough to reveal it).
  useLayoutEffect(() => {
    if (!open || !popupRef.current || !ref.current) return
    const popupRect = popupRef.current.getBoundingClientRect()
    const triggerRect = ref.current.getBoundingClientRect()
    const overflowsBottom = popupRect.bottom > window.innerHeight - 8
    if (overflowsBottom) {
      const flippedTop = Math.max(8, triggerRect.top - popupRect.height - 8)
      setPopupStyle(prev => ({ ...prev, top: flippedTop }))
    }
  }, [open, view, cursor])

  const y = cursor.getFullYear()
  const m = cursor.getMonth()

  const label = selected
    ? selected.toLocaleDateString(isId ? 'id-ID' : 'en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase()
    : ''

  function pick(d: Date) { onChange(toISO(d)); setOpen(false) }
  const beforeMin = (d: Date) => minDate ? dayFloor(d) < dayFloor(minDate) : false

  // ── days grid ──
  const hlStart = highlightWeek ? parseISO(highlightWeek.start) : null
  const hlEnd   = highlightWeek ? parseISO(highlightWeek.end)   : null

  const rawFirstDay = new Date(y, m, 1).getDay() // 0=Sun
  const firstDayOffset = startDay === 'mon' ? (rawFirstDay + 6) % 7 : rawFirstDay
  const daysInMonth = new Date(y, m + 1, 0).getDate()
  const dayCells: ReactNode[] = []
  for (let i = 0; i < firstDayOffset; i++) dayCells.push(<div key={`e${i}`} />)
  for (let d = 1; d <= daysInMonth; d++) {
    const dd = new Date(y, m, d)
    const isToday = sameDay(dd, today)
    const isSel = selected ? sameDay(dd, selected) : false
    const disabled = beforeMin(dd)
    const dow = dd.getDay()
    const isWeekend = (dow === 6 && wkSat) || (dow === 0 && wkSun)
    const inWeek = hlStart && hlEnd
      ? dayFloor(dd) >= dayFloor(hlStart) && dayFloor(dd) <= dayFloor(hlEnd)
      : false
    const isWeekStart = hlStart ? sameDay(dd, hlStart) : false
    const isWeekEnd   = hlEnd   ? sameDay(dd, hlEnd)   : false
    const weekRoundClass = isWeekStart ? 'rounded-l-[8px] rounded-r-none' : isWeekEnd ? 'rounded-r-[8px] rounded-l-none' : 'rounded-none'
    dayCells.push(
      <button key={d} type="button" disabled={disabled} onClick={() => pick(dd)}
        className={`${compact ? 'w-[27px] h-[27px] text-[10px]' : 'w-[34px] h-[34px] text-[11px]'} flex items-center justify-center font-black transition-all duration-150
          ${disabled ? 'text-[var(--ds-text-4)] cursor-not-allowed rounded-[7px]'
            : isToday ? 'bg-black text-[#adee2b] shadow-md hover:scale-110 rounded-full'
            : isSel ? 'bg-[#adee2b] text-black shadow-sm ring-1 ring-black/10 scale-105 rounded-full'
            : inWeek ? `bg-[#adee2b]/20 hover:bg-[#adee2b]/40 ${weekRoundClass} ${isWeekend ? 'text-red-500' : 'text-[var(--ds-text-1)]'}`
            : `${compact ? 'rounded-[7px]' : 'rounded-[10px]'} hover:bg-[var(--ds-bg-raised)] hover:scale-110 ${isWeekend ? 'text-red-500' : 'text-[var(--ds-text-1)]'}`}`}>
        {d}
      </button>
    )
  }


  function step(dir: number) {
    if (view === 'days') setCursor(new Date(y, m + dir, 1))
    else setCursor(new Date(y + dir, m, 1))
  }

  return (
    <div ref={ref} className="relative">
      <div onClick={toggle}>{children({ open, label })}</div>

      {open && createPortal(
        <div
          ref={popupRef}
          className={`${align === 'right' ? 'dropdown-enter-right' : 'dropdown-enter'} rounded-[1.5rem] p-4`}
          style={{ ...popupStyle, background: 'var(--ds-glass-bg)', backdropFilter: 'blur(32px)', WebkitBackdropFilter: 'blur(32px)', border: '1px solid var(--ds-glass-border)', boxShadow: 'var(--ds-glass-shadow)' }}
        >
          {/* header */}
          <div className="flex items-center justify-between mb-3">
            <button type="button" onClick={() => step(-1)}
              className={`${compact ? 'size-6 rounded-lg' : 'size-8 rounded-xl'} hover:bg-[var(--ds-bg-raised)] flex items-center justify-center text-[var(--ds-text-2)] transition-colors`}>
              <span className="material-symbols-outlined" style={{ fontSize: compact ? 14 : 18 }}>chevron_left</span>
            </button>

            {view === 'days' ? (
              <div className="flex items-center gap-1">
                <button type="button" onClick={() => setView('months')}
                  className={`px-2 py-0.5 rounded-lg ${compact ? 'text-[10px]' : 'text-[12px]'} font-black uppercase tracking-wider text-[var(--ds-text-1)] hover:bg-[var(--ds-bg-raised)] transition-colors`}>
                  {MONTHS_LONG[m]}
                </button>
                <span className={`px-1.5 py-0.5 ${compact ? 'text-[10px]' : 'text-[12px]'} font-black uppercase tracking-wider text-[var(--ds-text-3)] select-none`}>
                  {y}
                </span>
              </div>
            ) : (
              <span className={`px-2 py-0.5 ${compact ? 'text-[10px]' : 'text-[12px]'} font-black uppercase tracking-widest text-[var(--ds-text-1)] select-none`}>
                {y}
              </span>
            )}

            <button type="button" onClick={() => step(1)}
              className={`${compact ? 'size-6 rounded-lg' : 'size-8 rounded-xl'} hover:bg-[var(--ds-bg-raised)] flex items-center justify-center text-[var(--ds-text-2)] transition-colors`}>
              <span className="material-symbols-outlined" style={{ fontSize: compact ? 14 : 18 }}>chevron_right</span>
            </button>
          </div>

          {/* typed date input */}
          {view === 'days' && (
            <input
              type="text"
              placeholder="DD/MM/YYYY"
              value={typedText}
              onChange={e => setTypedText(e.target.value)}
              onBlur={e => commitTyped(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { commitTyped((e.target as HTMLInputElement).value); setOpen(false) } }}
              className={`w-full mb-2 px-2.5 ${compact ? 'py-1 text-[10px]' : 'py-1.5 text-[11px]'} rounded-lg font-bold tracking-wide text-center bg-[var(--ds-bg-surface)] border border-[var(--ds-border)] text-[var(--ds-text-1)] placeholder:text-[var(--ds-text-4)] focus:outline-none focus:border-[#adee2b] transition-colors`}
            />
          )}

          {/* body */}
          {view === 'days' && (
            <>
              <div className="grid grid-cols-7 mb-1">
                {weekdays.map((d, colIdx) => {
                  // determine which day-of-week (0=Sun,6=Sat) each column represents
                  const dow = startDay === 'mon' ? (colIdx + 1) % 7 : colIdx
                  const isWkHeader = (dow === 6 && wkSat) || (dow === 0 && wkSun)
                  return (
                    <div key={colIdx} className={`text-center ${compact ? 'text-[8px]' : 'text-[9px]'} font-black uppercase py-0.5 ${isWkHeader ? 'text-red-400' : 'text-[var(--ds-text-3)]'}`}>{d}</div>
                  )
                })}
              </div>
              <div className="grid grid-cols-7 gap-0.5 place-items-center">{dayCells}</div>
            </>
          )}

          {view === 'months' && (
            <div className="grid grid-cols-3 gap-1.5 py-1">
              {MONTHS_SHORT.map((mo, i) => {
                const isSel = selected && selected.getFullYear() === y && selected.getMonth() === i
                const isCur = today.getFullYear() === y && today.getMonth() === i
                return (
                  <button key={mo} type="button"
                    onClick={() => { setCursor(new Date(y, i, 1)); setView('days') }}
                    className={`${compact ? 'h-8 text-[10px]' : 'h-11 text-[11px]'} rounded-xl font-black uppercase tracking-wide transition-all
                      ${isCur ? 'bg-black text-[#adee2b]'
                        : isSel ? 'bg-[#adee2b] text-black'
                        : 'text-[var(--ds-text-1)] hover:bg-[var(--ds-bg-raised)]'}`}>
                    {mo}
                  </button>
                )
              })}
            </div>
          )}

          {footer && view === 'days' && (
            <div className="flex gap-2 mt-3 pt-3 border-t border-[var(--ds-border-sub)]">
              {footer(() => setOpen(false))}
            </div>
          )}
        </div>,
        document.body
      )}
    </div>
  )
}
