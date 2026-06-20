import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { Booking } from '../../types/index'
import { deptColors } from '../../data/mockData'
import { getDirectory } from '../../api/users'

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
  onCancelSeries?: (booking: Booking) => void
}

function parseLocal(iso: string) { return new Date(iso.replace('Z', '')) }

export default function BookingTooltip({ booking, pos, visible, onMouseEnter, onMouseLeave, currentUserId, onEdit, onCancel, onCancelSeries }: BookingTooltipProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [adjustedPos, setAdjustedPos] = useState(pos)
  const [forInfoPos, setForInfoPos] = useState<{ x: number; y: number } | null>(null)
  const forPopupRef = useRef<HTMLDivElement>(null)
  const { data: directory = [] } = useQuery({ queryKey: ['user-directory'], queryFn: getDirectory, staleTime: 60_000 })
  const forUser = booking?.booked_for_user_id ? directory.find(u => u.id === booking.booked_for_user_id) : null

  function openForInfo(e: React.MouseEvent<HTMLButtonElement>) {
    e.stopPropagation()
    const rect = e.currentTarget.getBoundingClientRect()
    setForInfoPos(p => p ? null : { x: rect.left, y: rect.bottom + 6 })
  }

  useEffect(() => {
    if (!forInfoPos) return
    function handleClickOutside(e: MouseEvent) {
      if (forPopupRef.current && !forPopupRef.current.contains(e.target as Node)) {
        setForInfoPos(null)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [forInfoPos])

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

  const dept = booking.user?.department_name || (typeof booking.user?.department === 'string' ? booking.user.department : '') || ''
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

  function formatDate(iso: string) {
    return parseLocal(iso).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' })
  }

  function copyBookingInfo() {
    const text = [
      `${booking.room?.name} (${booking.room?.capacity})`,
      formatDate(booking.start_at),
      `${formatTime(booking.start_at)} – ${formatTime(booking.end_at)} | ${getDuration()}`,
      booking.title,
    ].join('\n')
    copyToClip(text, 'tt-copy-booking')
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
    <>
    <div
      ref={ref}
      onMouseEnter={onMouseEnter}
      onMouseLeave={(e) => {
        if (forPopupRef.current?.contains(e.relatedTarget as Node)) return
        onMouseLeave()
      }}
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
        <div className="flex items-center gap-2 flex-wrap">
          {isMe && (
            <span className="text-[9px] font-black px-3 py-1 rounded-full uppercase tracking-wide" style={{ backgroundColor: '#72ddf7', color: 'black' }}>
              Your Booking
            </span>
          )}
          {booking.series_id && (
            <span className="flex items-center gap-1 bg-blue-100 text-blue-700 text-[9px] font-black px-3 py-1 rounded-full uppercase tracking-wide">
              <span className="material-symbols-outlined" style={{ fontSize: 11 }}>link</span>Series
            </span>
          )}
          {booking.room?.requires_contact && (
            <span className="flex items-center gap-1 bg-amber-50 text-amber-600 text-[9px] font-black px-3 py-1 rounded-full uppercase tracking-wide">
              <span className="material-symbols-outlined" style={{ fontSize: 11 }}>star</span>Special
            </span>
          )}
          <span
            className="text-[9px] font-black px-3 py-1 rounded-full uppercase tracking-wide ml-auto"
            style={isTentative
              ? { backgroundColor: '#e4e6ea', backgroundImage: 'repeating-linear-gradient(45deg,transparent,transparent 3px,rgba(0,0,0,0.03) 3px,rgba(0,0,0,0.03) 6px)', color: '#4b5563' }
              : { background: colors.bg, color: colors.text }}
          >
            {isTentative ? 'Tentative' : booking.status === 'confirmed' ? 'Confirmed' : booking.status}
          </span>
        </div>

        {/* Title & desc */}
        <div className="space-y-1.5">
          <p className="text-[15px] font-black text-slate-900 leading-tight">{booking.title}</p>
          {booking.description && (
            <p className="text-[12px] text-slate-500 font-medium leading-relaxed">{booking.description}</p>
          )}
          <span
            className="inline-block text-[9px] font-black px-3 py-1 rounded-full uppercase tracking-wide mt-0.5"
            style={booking.type === 'external'
              ? { backgroundColor: '#ffedd5', color: '#c2410c' }
              : { backgroundColor: '#dbeafe', color: '#1d4ed8' }}
          >
            {booking.type === 'external' ? 'External' : 'Internal'}
          </span>
        </div>

        {/* Time */}
        <div className="bg-slate-50 rounded-2xl px-4 py-3 flex items-center gap-3">
          <span className="material-symbols-outlined text-slate-400 shrink-0" style={{ fontSize: 16 }}>schedule</span>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-black tabular-nums text-slate-900">
              {formatTime(booking.start_at)} &ndash; {formatTime(booking.end_at)}
              <span className="text-slate-400 font-bold ml-1.5">&middot; {getDuration()}</span>
            </p>
            <p className="text-[11px] font-bold text-slate-500 mt-0.5">{booking.room?.name}</p>
          </div>
          <button
            id="tt-copy-booking"
            onClick={copyBookingInfo}
            className="shrink-0 flex items-center gap-1 bg-white border border-slate-200 hover:bg-[#adee2b] hover:border-[#adee2b] hover:text-black text-slate-400 px-2.5 py-1.5 rounded-xl transition-all text-[9px] font-black uppercase"
            title="Copy booking info"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 13 }}>content_copy</span>
            Copy
          </button>
        </div>

        {/* User */}
        <div className="border-t border-slate-200/70 pt-4 space-y-3">
          <div className="flex items-center gap-3.5">
            <img
              src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${booking.user?.avatar || booking.user?.name}`}
              className="size-12 rounded-xl object-cover border border-slate-200"
            />
            <div>
              <p className="text-base font-black text-slate-900 leading-tight">{booking.user?.name}</p>
              <p className="text-[11px] font-bold uppercase mt-0.5 text-slate-500">{dept}</p>
              {booking.booked_for && (
                <button
                  onClick={openForInfo}
                  className="flex items-center gap-1 text-[10px] font-bold text-slate-400 hover:text-slate-500 transition-colors mt-1"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 12 }}>person_pin</span>
                  Booking for <span style={{ color: '#72ddf7' }}>{booking.booked_for}</span>
                  <span className="material-symbols-outlined" style={{ fontSize: 11 }}>open_in_new</span>
                </button>
              )}
            </div>
          </div>

          {/* Contact */}
          <div className="space-y-2.5">
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
        </div>

        {/* Edit / Cancel actions (own bookings only) */}
        {isMe && (
          <div className="space-y-2 pt-1">
            {booking.series_id ? (
              <>
                <div className="flex gap-2">
                  <button
                    onClick={() => onEdit?.(booking)}
                    className="flex-1 bg-[#adee2b] text-black text-[9px] font-black uppercase rounded-xl py-2.5 hover:opacity-90 transition-opacity"
                  >
                    Edit this
                  </button>
                  <button
                    onClick={() => onEdit?.(booking)}
                    className="flex-1 bg-black text-[#adee2b] text-[9px] font-black uppercase rounded-xl py-2.5 hover:bg-slate-800 transition-colors flex items-center justify-center gap-1"
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 11 }}>link</span>
                    Edit series
                  </button>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => onCancel?.(booking)}
                    className="flex-1 bg-slate-100 text-slate-600 text-[9px] font-black uppercase rounded-xl py-2 hover:bg-red-50 hover:text-red-500 transition-colors"
                  >
                    Cancel this
                  </button>
                  <button
                    onClick={() => onCancelSeries?.(booking)}
                    className="flex-1 bg-red-50 text-red-500 text-[9px] font-black uppercase rounded-xl py-2 hover:bg-red-500 hover:text-white transition-colors flex items-center justify-center gap-1"
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 11 }}>link</span>
                    Cancel series
                  </button>
                </div>
              </>
            ) : (
              <div className="flex gap-2">
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
        )}
      </div>
    </div>

    {/* Booking-for dark glass mini popup */}
    {forInfoPos && (
      <>
        <div
          ref={forPopupRef}
          onMouseLeave={(e) => {
            if (ref.current?.contains(e.relatedTarget as Node)) return
            onMouseLeave()
          }}
          className="fixed z-[1001] w-56 rounded-2xl overflow-hidden"
          style={{
            left: forInfoPos.x,
            top: forInfoPos.y,
            background: 'rgba(255,255,255,0.55)',
            backdropFilter: 'blur(28px)',
            WebkitBackdropFilter: 'blur(28px)',
            border: '1px solid rgba(255,255,255,0.75)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.12), 0 1.5px 6px rgba(0,0,0,0.06)',
          }}
        >
          <div className="px-4 pt-4 pb-3">
            {/* Avatar + name */}
            <div className="flex items-center gap-3 mb-3">
              <div className="size-10 rounded-xl bg-slate-200/60 flex items-center justify-center text-base font-black text-slate-600 shrink-0">
                {(forUser?.name ?? booking.booked_for ?? '?').charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="text-[13px] font-black leading-tight truncate" style={{ color: '#72ddf7' }}>
                  {forUser?.name ?? booking.booked_for}
                </p>
                {forUser?.department && (
                  <p className="text-[9px] font-black uppercase tracking-wider mt-0.5 text-slate-400">
                    {forUser.department}
                  </p>
                )}
              </div>
            </div>

            {forUser ? (
              <div className="space-y-2 border-t border-slate-200/60 pt-3">
                {forUser.ext && (
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-slate-400 shrink-0" style={{ fontSize: 13 }}>phone_in_talk</span>
                    <span className="text-[11px] font-bold text-slate-400">Ext</span>
                    <span className="text-[11px] font-black text-slate-700">{forUser.ext}</span>
                  </div>
                )}
                {forUser.email && (
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-slate-400 shrink-0" style={{ fontSize: 13 }}>mail</span>
                    <span className="text-[10px] font-bold text-slate-600 truncate flex-1">{forUser.email}</span>
                    <button onClick={() => navigator.clipboard.writeText(forUser!.email)}
                      className="shrink-0 text-slate-400 hover:text-slate-600 transition-colors">
                      <span className="material-symbols-outlined" style={{ fontSize: 12 }}>content_copy</span>
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-[10px] italic text-slate-400">No account info available</p>
            )}
          </div>
        </div>
      </>
    )}
    </>
  )
}
