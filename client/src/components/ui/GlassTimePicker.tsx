import { useEffect, useRef, useState, type ReactNode } from 'react'

function toMin(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}
function fromMin(min: number): string {
  return `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`
}

interface GlassTimePickerProps {
  value: string                                       // 'HH:mm'
  onChange: (v: string) => void
  min?: string                                        // 'HH:mm'  (default '07:00')
  max?: string                                        // 'HH:mm'  (default '19:00')
  step?: number                                       // minutes  (default 30)
  align?: 'left' | 'right'
  panelWidth?: number
  children: (o: { open: boolean }) => ReactNode
}

export default function GlassTimePicker({
  value, onChange, min = '07:00', max = '19:00', step = 30, align = 'left', panelWidth = 188, children,
}: GlassTimePickerProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const selRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  // scroll selected slot into view when opening (within the list only, no page jump)
  useEffect(() => {
    if (open && selRef.current && listRef.current) {
      const list = listRef.current, sel = selRef.current
      list.scrollTop = sel.offsetTop - (list.clientHeight - sel.clientHeight) / 2
    }
  }, [open])

  const lo = toMin(min), hi = toMin(max)
  const slots: number[] = []
  for (let t = lo; t <= hi; t += step) slots.push(t)
  const selMin = value ? toMin(value) : null

  return (
    <div ref={ref} className="relative">
      <div onClick={() => setOpen(o => !o)}>{children({ open })}</div>

      {open && (
        <div
          className={`absolute top-full mt-2 z-[400] ${align === 'right' ? 'right-0 dropdown-enter-right' : 'left-0 dropdown-enter'} rounded-[1.4rem] p-2`}
          style={{ width: panelWidth, background: 'var(--ds-glass-bg)', backdropFilter: 'blur(32px)', WebkitBackdropFilter: 'blur(32px)', border: '1px solid var(--ds-glass-border)', boxShadow: 'var(--ds-glass-shadow)' }}
        >
          <div ref={listRef} className="tp-scroll relative max-h-[224px] overflow-y-auto grid grid-cols-2 gap-1 pr-1">
            {slots.map(t => {
              const isSel = selMin === t
              return (
                <button key={t} type="button" ref={isSel ? selRef : undefined}
                  onClick={() => { onChange(fromMin(t)); setOpen(false) }}
                  className={`h-9 rounded-xl text-[11px] font-black tabular-nums transition-all
                    ${isSel ? 'bg-[#adee2b] text-black shadow-sm ring-1 ring-black/10'
                      : 'text-[var(--ds-text-1)] hover:bg-[var(--ds-bg-raised)]'}`}>
                  {fromMin(t)}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
