import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { toMin, fromMin } from '../../utils/date'

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
  const [popupStyle, setPopupStyle] = useState<CSSProperties>({})
  const ref = useRef<HTMLDivElement>(null)
  const popupRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const selRef = useRef<HTMLButtonElement>(null)

  // Portal + fixed-position popup (same pattern as GlassDatePicker) — this menu isn't a plain
  // absolute-positioned child, since any ancestor with overflow:hidden (e.g. a collapsible filter
  // section's clip wrapper, or a panel's own rounded-corner clip) would otherwise cut it off
  // instead of letting it float over whatever's below.
  function calcPopupStyle(): CSSProperties {
    if (!ref.current) return {}
    const r = ref.current.getBoundingClientRect()
    const style: CSSProperties = { position: 'fixed', top: r.bottom + 8, zIndex: 9999, width: panelWidth }
    if (align === 'right') style.right = window.innerWidth - r.right
    else style.left = r.left
    return style
  }

  function toggle() {
    if (!open) setPopupStyle(calcPopupStyle())
    setOpen(o => !o)
  }

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      const t = e.target as Node
      if (ref.current && !ref.current.contains(t) && popupRef.current && !popupRef.current.contains(t)) setOpen(false)
    }
    function onReposition() { setPopupStyle(calcPopupStyle()) }
    if (open) {
      document.addEventListener('mousedown', onDoc)
      window.addEventListener('resize', onReposition)
      window.addEventListener('scroll', onReposition, true)
    }
    return () => {
      document.removeEventListener('mousedown', onDoc)
      window.removeEventListener('resize', onReposition)
      window.removeEventListener('scroll', onReposition, true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // Flip above the trigger if the popup would overflow the bottom of the viewport.
  useLayoutEffect(() => {
    if (!open || !popupRef.current || !ref.current) return
    const popupRect = popupRef.current.getBoundingClientRect()
    const triggerRect = ref.current.getBoundingClientRect()
    if (popupRect.bottom > window.innerHeight - 8) {
      setPopupStyle(prev => ({ ...prev, top: Math.max(8, triggerRect.top - popupRect.height - 8) }))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      <div onClick={toggle}>{children({ open })}</div>

      {open && createPortal(
        <div
          ref={popupRef}
          className={`${align === 'right' ? 'dropdown-enter-right' : 'dropdown-enter'} rounded-[1.4rem] p-2`}
          style={{ ...popupStyle, background: 'var(--ds-glass-bg)', backdropFilter: 'blur(32px)', WebkitBackdropFilter: 'blur(32px)', border: '1px solid var(--ds-glass-border)', boxShadow: 'var(--ds-glass-shadow)' }}
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
        </div>,
        document.body
      )}
    </div>
  )
}
