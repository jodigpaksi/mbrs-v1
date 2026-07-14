import { useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { ReactNode } from 'react'

function ModalPortal({ children }: { children: ReactNode }) {
  return <>{createPortal(children, document.body)}</>
}

function InfoTooltip({ text, width = 220 }: { text: string; width?: number }) {
  const [visible, setVisible] = useState(false)
  const [pos, setPos] = useState({ top: 0, left: 0 })
  const ref = useRef<HTMLButtonElement>(null)

  function handleEnter() {
    const r = ref.current?.getBoundingClientRect()
    if (r) {
      const spaceRight = window.innerWidth - r.left
      const left = spaceRight >= width + 12 ? r.left : Math.max(12, r.right - width)
      setPos({ top: r.bottom + 8, left })
    }
    setVisible(true)
  }

  return (
    <>
      <button
        ref={ref}
        type="button"
        onMouseEnter={handleEnter}
        onMouseLeave={() => setVisible(false)}
        onClick={e => e.stopPropagation()}
        className="size-4 flex items-center justify-center rounded-full shrink-0 normal-case transition-colors"
        style={{ background: 'var(--ds-bg-raised)', color: 'var(--ds-text-3)' }}
      >
        <span className="material-symbols-outlined" style={{ fontSize: 11 }}>info</span>
      </button>

      {visible && createPortal(
        <div
          className="fixed z-[400] pointer-events-none"
          style={{ top: pos.top, left: pos.left, width }}
        >
          <div className="rounded-2xl px-3.5 py-2.5"
            style={{ background: 'rgba(15,15,15,0.87)', backdropFilter: 'blur(64px) saturate(2)', WebkitBackdropFilter: 'blur(64px) saturate(2)', border: '1px solid rgba(255,255,255,0.12)', boxShadow: '0 16px 48px rgba(0,0,0,0.5)' }}>
            <p className="text-[11px] text-white/70 font-medium normal-case leading-relaxed">{text}</p>
          </div>
        </div>,
        document.body
      )}
    </>
  )
}

export { ModalPortal, InfoTooltip }
