import { useState, useRef } from 'react'
import { createPortal } from 'react-dom'

const TOOLTIP = 'This room requires a special request. Please contact the Receptionist or GAA team to make a booking.'

interface Props {
  size?: 'xs' | 'sm' | 'md'
  variant?: 'light' | 'dark'
}

export function SpecialRoomBadge({ size = 'md', variant = 'light' }: Props) {
  const [visible, setVisible] = useState(false)
  const [pos, setPos]         = useState({ top: 0, left: 0 })
  const ref = useRef<HTMLSpanElement>(null)

  const TOOLTIP_W = 240
  const VIEWPORT_PAD = 12

  function handleEnter() {
    if (ref.current) {
      const r = ref.current.getBoundingClientRect()
      const spaceRight = window.innerWidth - r.left
      const left = spaceRight >= TOOLTIP_W + VIEWPORT_PAD
        ? r.left
        : Math.max(VIEWPORT_PAD, r.right - TOOLTIP_W)
      setPos({ top: r.bottom + 8, left })
    }
    setVisible(true)
  }

  const iconSz  = size === 'xs' ? 9  : size === 'sm' ? 11 : 13
  const textSz  = size === 'xs' ? 8  : size === 'sm' ? 9  : 10
  const gapCls  = size === 'xs' ? 'gap-0.5' : 'gap-1'
  const padCls  = size === 'xs' ? 'px-1.5 py-0.5' : size === 'sm' ? 'px-2 py-0.5' : 'px-2.5 py-1'
  const rndCls  = size === 'xs' ? 'rounded' : 'rounded-lg'

  const darkVariant  = variant === 'dark'
  const badgeBg   = darkVariant ? 'rgba(251,191,36,0.25)' : '#fef3c7'
  const badgeClr  = darkVariant ? '#fde68a' : '#92400e'

  return (
    <>
      <span
        ref={ref}
        onMouseEnter={handleEnter}
        onMouseLeave={() => setVisible(false)}
        onClick={e => e.stopPropagation()}
        onMouseDown={e => e.stopPropagation()}
        className={`inline-flex items-center ${gapCls} ${padCls} ${rndCls} font-black uppercase cursor-default select-none`}
        style={{ fontSize: textSz, background: badgeBg, color: badgeClr }}
      >
        <span className="material-symbols-outlined" style={{ fontSize: iconSz }}>star</span>
        Special Room
        <span className="material-symbols-outlined" style={{ fontSize: iconSz }}>info</span>
      </span>

      {visible && createPortal(
        <div
          style={{
            position: 'fixed',
            top: pos.top,
            left: pos.left,
            zIndex: 99999,
            width: 240,
            background: 'rgba(255,255,255,0.75)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            border: '1px solid rgba(255,255,255,0.6)',
            borderRadius: 16,
            padding: '10px 14px',
            boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
            pointerEvents: 'none',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
            <span
              className="material-symbols-outlined"
              style={{ fontSize: 14, color: '#d97706' }}
            >
              star
            </span>
            <span style={{ fontSize: 11, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#92400e' }}>
              Special Room
            </span>
          </div>
          <p style={{ fontSize: 11, fontWeight: 600, color: '#374151', lineHeight: 1.55, margin: 0 }}>
            {TOOLTIP}
          </p>
        </div>,
        document.body
      )}
    </>
  )
}
