import { useEffect, useRef, useState } from 'react'
import type { Booking } from '../../types/index'
import { deptColors } from '../../data/mockData'

interface TooltipPos { x: number; y: number }

interface BookingTooltipProps {
  booking: Booking | null
  pos: TooltipPos
  visible: boolean
  onMouseEnter: () => void
  onMouseLeave: () => void
  currentUserId: number
  onEdit?: (booking: Booking) => void
  onCancel?: (booking: Booking) => void
}

function parseLocal(iso: string) { return new Date(iso.replace('Z', '')) }

export default function BookingTooltip({ booking, pos, visible, onMouseEnter, onMouseLeave, currentUserId, onEdit, onCancel }: BookingTooltipProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [adjustedPos, setAdjustedPos] = useState(pos)

  useEffect(() => {
    if (!visible || !ref.current) return
    const el = ref.current
    const rect = el.getBoundingClientRect()
    let x = pos.x + 20
    let y = pos.y + 20
    if (x + rect.width > window.innerWidth) x = pos.x - rect.width - 10
    if (y + rect.height > window.innerHeight) y = window.innerHeight - rect.height - 10
    setAdjustedPos({ x, y })
  }, [pos, visible])

  if (!booking) return null

  const dept = booking.user?.department || ''
  const colors = deptColors[dept] || deptColors['GAA']
  const isMe = booking.user_id === currentUserId
  const isTentative = booking.status === 'tentative'

  function formatTime(iso: string) {
    return parseLocal(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  }

  function getDuration() {
    const diff = (parseLocal(booking.end_at).getTime() - parseLocal(booking.start_at).getTime()) / 60000
    const h = Math.floor(diff / 60)
    const m = diff % 60
    return h && m ? `${h}h ${m}m` : h ? `${h}h` : `${m}m`
  }

  function copyToClip(text: string, btnId: string) {
    navigator.clipboard.writeText(text).then(() => {
      const btn = document.getElementById(btnId)
      if (!btn) return
      const orig = btn.innerHTML
      btn.innerHTML = '<span class="material-symbols-outlined" style="font-size:12px">check</span>Copied!'
      btn.style.background = '#adee2b'
      btn.style.color = '#000'
      setTimeout(() => { btn.innerHTML = orig; btn.style.background = ''; btn.style.color = '' }, 1500)
    })
  }

  return (
    <div
      ref={ref}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className="fixed z-[999] w-[360px] pointer-events-auto"
      style={{
        left: adjustedPos.x,
        top: adjustedPos.y,
        background: 'rgba(255,255,255,0.82)',
        backdropFilter: 'blur(48px) saturate(200%)',
        WebkitBackdropFilter: 'blur(48px) saturate(200%)',
        border: '1px solid rgba(255,255,255,0.95)',
        borderRadius: '1.75rem',
        boxShadow: '0 12px 48px rgba(0,0,0,0.10), 0 4px 16px rgba(0,0,0,0.07), inset 0 1px 0 rgba(255,255,255,1)',
        opacity: visible ? 1 : 0,
        visibility: visible ? 'visible' : 'hidden',
        transform: visible ? 'translateY(0) scale(1)' : 'translateY(8px) scale(0.97)',
        transition: 'opacity 0.18s cubic-bezier(0.4,0,0.2,1), transform 0.18s cubic-bezier(0.4,0,0.2,1)',
      }}
    >
      <div className="p-6 space-y-4">
        {/* Header badges */}
        <div className="flex items-center gap-2">
          {isMe && (
            <span className="bg-blue-500 text-white text-[9px] font-black px-3 py-1 rounded-full uppercase tracking-wide">
              Your Booking
            </span>
          )}
          <span
            className="text-[9px] font-black px-3 py-1 rounded-full uppercase tracking-wide ml-auto"
            style={{ background: colors.bg, color: colors.text }}
          >
            {isTentative ? 'Tentative' : booking.status === 'confirmed' ? 'Confirmed' : booking.status}
          </span>
        </div>

        {/* User */}
        <div className="flex items-center gap-3.5">
          <img
            src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${booking.user?.avatar || booking.user?.name}`}
            className="size-12 rounded-xl object-cover border border-slate-200"
          />
          <div>
            <p className="text-base font-black text-slate-900 leading-tight">{booking.user?.name}</p>
            <p className="text-[11px] font-bold uppercase mt-0.5 text-slate-500">{booking.user?.department}</p>
          </div>
        </div>

        {/* Contact */}
        <div className="border-y border-slate-200/70 py-3 space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-slate-400" style={{ fontSize: 15 }}>phone_in_talk</span>
              <span className="text-[11px] font-bold text-slate-500">Ext</span>
              <span className="text-[11px] font-black text-slate-800">{booking.user?.ext}</span>
            </div>
            <button
              id="tt-copy-ext"
              onClick={() => copyToClip(booking.user?.ext || '', 'tt-copy-ext')}
              className="shrink-0 flex items-center gap-1 bg-slate-100 hover:bg-[#adee2b] hover:text-black text-slate-500 px-2.5 py-1 rounded-lg transition-all text-[9px] font-black uppercase"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 12 }}>content_copy</span>Copy
            </button>
          </div>
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className="material-symbols-outlined text-slate-400 shrink-0" style={{ fontSize: 15 }}>mail</span>
              <span className="text-[11px] font-black text-slate-800 truncate">{booking.user?.email}</span>
            </div>
            <button
              id="tt-copy-email"
              onClick={() => copyToClip(booking.user?.email || '', 'tt-copy-email')}
              className="shrink-0 flex items-center gap-1 bg-slate-100 hover:bg-[#adee2b] hover:text-black text-slate-500 px-2.5 py-1 rounded-lg transition-all text-[9px] font-black uppercase"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 12 }}>content_copy</span>Copy
            </button>
          </div>
        </div>

        {/* Title & desc */}
        <div className="space-y-1.5">
          <p className="text-[15px] font-black text-slate-900 leading-tight">{booking.title}</p>
          {booking.description && (
            <p className="text-[12px] text-slate-500 font-medium leading-relaxed">{booking.description}</p>
          )}
        </div>

        {/* Time */}
        <div className="bg-slate-50 rounded-2xl px-4 py-3 flex items-center gap-3">
          <span className="material-symbols-outlined text-slate-400" style={{ fontSize: 16 }}>schedule</span>
          <div>
            <p className="text-[13px] font-black tabular-nums text-slate-900">
              {formatTime(booking.start_at)} &ndash; {formatTime(booking.end_at)}
              <span className="text-slate-400 font-bold ml-1.5">&middot; {getDuration()}</span>
            </p>
            <p className="text-[11px] font-bold text-slate-500 mt-0.5">{booking.room?.name}</p>
          </div>
        </div>

        {/* Edit actions (only for own bookings) */}
        {isMe && (
          <div className="flex gap-2 pt-1">
            <button
              onClick={() => onEdit?.(booking)}
              className="flex-1 bg-[#adee2b] text-black text-[10px] font-black uppercase rounded-xl py-2.5 hover:opacity-90 transition-opacity"
            >
              Edit
            </button>
            <button
              onClick={() => onCancel?.(booking)}
              className="flex-1 bg-slate-100 text-slate-600 text-[10px] font-black uppercase rounded-xl py-2.5 hover:bg-red-50 hover:text-red-500 transition-colors"
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
