import { useEffect, useRef, useState, type ReactNode } from 'react'

const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const MONTHS_LONG = ['January','February','March','April','May','June','July','August','September','October','November','December']
const WEEKDAYS = ['Su','Mo','Tu','We','Th','Fr','Sa']

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

interface GlassDatePickerProps {
  value: string                                       // 'yyyy-MM-dd'
  onChange: (iso: string) => void
  min?: string                                        // 'yyyy-MM-dd'
  align?: 'left' | 'right'
  panelWidth?: number
  footer?: (close: () => void) => ReactNode
  children: (o: { open: boolean; label: string }) => ReactNode
}

export default function GlassDatePicker({ value, onChange, min, align = 'left', panelWidth = 300, footer, children }: GlassDatePickerProps) {
  const [open, setOpen] = useState(false)
  const [view, setView] = useState<'days' | 'months'>('days')
  const [cursor, setCursor] = useState(() => parseISO(value) ?? new Date())
  const ref = useRef<HTMLDivElement>(null)

  const selected = parseISO(value)
  const today = new Date()
  const minDate = min ? parseISO(min) : null

  function toggle() {
    if (!open) { setCursor(parseISO(value) ?? new Date()); setView('days') }
    setOpen(o => !o)
  }

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  const y = cursor.getFullYear()
  const m = cursor.getMonth()

  const label = selected
    ? selected.toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase()
    : ''

  function pick(d: Date) { onChange(toISO(d)); setOpen(false) }
  const beforeMin = (d: Date) => minDate ? dayFloor(d) < dayFloor(minDate) : false

  // ── days grid ──
  const firstDay = new Date(y, m, 1).getDay()
  const daysInMonth = new Date(y, m + 1, 0).getDate()
  const dayCells: ReactNode[] = []
  for (let i = 0; i < firstDay; i++) dayCells.push(<div key={`e${i}`} />)
  for (let d = 1; d <= daysInMonth; d++) {
    const dd = new Date(y, m, d)
    const isToday = sameDay(dd, today)
    const isSel = selected ? sameDay(dd, selected) : false
    const disabled = beforeMin(dd)
    dayCells.push(
      <button key={d} type="button" disabled={disabled} onClick={() => pick(dd)}
        className={`w-[34px] h-[34px] rounded-[10px] flex items-center justify-center text-[11px] font-black transition-all duration-150
          ${disabled ? 'text-slate-300 cursor-not-allowed'
            : isToday ? 'bg-black text-[#adee2b] shadow-md hover:scale-110'
            : isSel ? 'bg-[#adee2b] text-black shadow-sm ring-1 ring-black/10 scale-105'
            : 'text-slate-600 hover:bg-white hover:scale-110 hover:shadow-sm'}`}>
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

      {open && (
        <div
          className={`absolute top-full mt-2 z-[400] ${align === 'right' ? 'right-0 dropdown-enter-right' : 'left-0 dropdown-enter'}
            bg-white/70 backdrop-blur-2xl border border-white/60 ring-1 ring-black/5
            rounded-[1.5rem] shadow-2xl shadow-slate-900/20 p-4`}
          style={{ width: panelWidth }}
        >
          {/* header */}
          <div className="flex items-center justify-between mb-3">
            <button type="button" onClick={() => step(-1)}
              className="size-8 rounded-xl hover:bg-white/80 flex items-center justify-center text-slate-500 transition-colors">
              <span className="material-symbols-outlined text-sm">chevron_left</span>
            </button>

            {view === 'days' ? (
              <div className="flex items-center gap-1.5">
                <button type="button" onClick={() => setView('months')}
                  className="px-2.5 py-1 rounded-lg text-[12px] font-black uppercase tracking-wider text-slate-700 hover:bg-white/80 transition-colors">
                  {MONTHS_LONG[m]}
                </button>
                <span className="hidden sm:inline px-2.5 py-1 text-[12px] font-black uppercase tracking-wider text-slate-400 select-none">
                  {y}
                </span>
              </div>
            ) : (
              <span className="hidden sm:inline px-3 py-1 text-[12px] font-black uppercase tracking-widest text-slate-700 select-none">
                {y}
              </span>
            )}

            <button type="button" onClick={() => step(1)}
              className="size-8 rounded-xl hover:bg-white/80 flex items-center justify-center text-slate-500 transition-colors">
              <span className="material-symbols-outlined text-sm">chevron_right</span>
            </button>
          </div>

          {/* body */}
          {view === 'days' && (
            <>
              <div className="grid grid-cols-7 mb-1.5">
                {WEEKDAYS.map(d => (
                  <div key={d} className="text-center text-[9px] font-black text-slate-400 uppercase py-1">{d}</div>
                ))}
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
                    className={`h-11 rounded-xl text-[11px] font-black uppercase tracking-wide transition-all
                      ${isCur ? 'bg-black text-[#adee2b]'
                        : isSel ? 'bg-[#adee2b] text-black'
                        : 'text-slate-600 hover:bg-white/80'}`}>
                    {mo}
                  </button>
                )
              })}
            </div>
          )}

          {footer && view === 'days' && (
            <div className="flex gap-2 mt-3 pt-3 border-t border-white/60">
              {footer(() => setOpen(false))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
