import { Fragment, useEffect, useRef, useState } from 'react'

const SHORTCUTS = [
  { keys: ['Ctrl', 'F'], label: 'Search Available Rooms' },
  { keys: ['Alt', 'N'], label: 'New Booking' },
  { keys: ['N'], label: 'Open Notifications' },
  { keys: ['T'], label: 'Today Panel' },
]

export default function KeyboardShortcutsFab({ stackAboveAiFab = true }: { stackAboveAiFab?: boolean }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  return (
    <div ref={ref} className="fixed z-[9997]" style={{ right: 28, bottom: stackAboveAiFab ? 100 : 28 }}>
      <style>{`
        @keyframes shortcuts-fab-in {
          from { opacity: 0; transform: translateY(8px) scale(0.97) }
          to   { opacity: 1; transform: translateY(0) scale(1) }
        }
      `}</style>
      {open && (
        <div
          className="absolute bottom-full right-0 mb-3 rounded-2xl p-4"
          style={{
            width: 260,
            background: 'var(--ds-glass-bg)',
            backdropFilter: 'blur(32px)',
            WebkitBackdropFilter: 'blur(32px)',
            border: '1px solid var(--ds-glass-border)',
            boxShadow: 'var(--ds-glass-shadow)',
            animation: 'shortcuts-fab-in 0.15s ease both',
          }}
        >
          <p className="text-[9px] font-black uppercase tracking-widest mb-3" style={{ color: 'var(--ds-text-3)' }}>Keyboard Shortcuts</p>
          <div className="space-y-2">
            {SHORTCUTS.map(({ keys, label }) => (
              <div key={label} className="flex items-center justify-between gap-3">
                <span className="text-[11px] font-semibold" style={{ color: 'var(--ds-text-2)' }}>{label}</span>
                <div className="flex items-center gap-1 shrink-0">
                  {keys.map((k, i) => (
                    <Fragment key={k}>
                      {i > 0 && <span className="text-[9px] font-black" style={{ color: 'var(--ds-text-4)' }}>+</span>}
                      <kbd className="px-1.5 py-0.5 rounded-md text-[9px] font-black uppercase"
                        style={{ background: 'var(--ds-bg-raised)', border: '1px solid var(--ds-border)', color: 'var(--ds-text-1)' }}>
                        {k}
                      </kbd>
                    </Fragment>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        title="Keyboard shortcuts"
        className="size-10 rounded-full flex items-center justify-center shadow-lg transition-all duration-200"
        style={{
          background: open ? '#adee2b' : 'var(--ds-glass-bg)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          border: '1px solid var(--ds-glass-border)',
          color: open ? '#000' : 'var(--ds-text-2)',
        }}
      >
        <span className="material-symbols-outlined text-lg">keyboard</span>
      </button>
    </div>
  )
}
