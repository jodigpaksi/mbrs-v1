import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { Booking } from '../../types/index'
import { getDirectory } from '../../api/users'
import UserAvatar from '../ui/UserAvatar'
import { parseLocal } from '../../utils/date'
import { useSettings } from '../../context/SettingsContext'

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

export default function BookingTooltip({ booking: bookingProp, pos, visible, onMouseEnter, onMouseLeave, currentUserId, onEdit, onCancel, onCancelSeries }: BookingTooltipProps) {
  const { t, language } = useSettings()
  const ref = useRef<HTMLDivElement>(null)
  const [adjustedPos, setAdjustedPos] = useState(pos)
  const [forAnchorRect, setForAnchorRect] = useState<DOMRect | null>(null)
  const [forComputedPos, setForComputedPos] = useState<{ x: number; y: number } | null>(null)
  const forPopupRef = useRef<HTMLDivElement>(null)
  const { data: directory = [] } = useQuery({ queryKey: ['user-directory'], queryFn: getDirectory, staleTime: 60_000 })
  const forUser = bookingProp?.booked_for_user_id ? directory.find(u => u.id === bookingProp.booked_for_user_id) : null

  function openForInfo(e: React.MouseEvent<HTMLButtonElement>) {
    e.stopPropagation()
    const rect = e.currentTarget.getBoundingClientRect()
    if (forAnchorRect) {
      setForAnchorRect(null)
      setForComputedPos(null)
    } else {
      setForAnchorRect(rect)
      setForComputedPos({ x: rect.left, y: rect.bottom + 6 })
    }
  }

  useEffect(() => {
    if (!forAnchorRect || !forPopupRef.current) return
    const popup = forPopupRef.current.getBoundingClientRect()
    const POPUP_W = 224
    const GAP = 6
    let x = forAnchorRect.left
    let y = forAnchorRect.bottom + GAP
    if (y + popup.height > window.innerHeight - 12) {
      y = forAnchorRect.top - popup.height - GAP
    }
    if (x + POPUP_W > window.innerWidth - 12) x = window.innerWidth - POPUP_W - 12
    if (x < 8) x = 8
    setForComputedPos({ x, y })
  }, [forAnchorRect])

  useEffect(() => {
    if (!forAnchorRect) return
    function handleClickOutside(e: MouseEvent) {
      if (forPopupRef.current && !forPopupRef.current.contains(e.target as Node)) {
        setForAnchorRect(null)
        setForComputedPos(null)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [forAnchorRect])

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

  if (!bookingProp) return null
  const booking = bookingProp

  const dept = booking.user?.department_name || (typeof booking.user?.department === 'string' ? booking.user.department : '') || ''
  const isMe = booking.user_id === currentUserId
  const isTentative = booking.status === 'tentative'
  const isConf = booking.status === 'confirmed'

  function formatTime(iso: string) {
    return parseLocal(iso).toLocaleTimeString(language === 'id' ? 'id-ID' : 'en-GB', { hour: '2-digit', minute: '2-digit' })
  }

  function getDuration() {
    const diff = (parseLocal(booking.end_at).getTime() - parseLocal(booking.start_at).getTime()) / 60000
    const h = Math.floor(diff / 60)
    const m = diff % 60
    const hUnit = language === 'id' ? 'j' : 'h'
    return h && m ? `${h}${hUnit} ${m}m` : h ? `${h}${hUnit}` : `${m}m`
  }

  function formatDate(iso: string) {
    return parseLocal(iso).toLocaleDateString(language === 'id' ? 'id-ID' : 'en-GB', { weekday: 'long', day: 'numeric', month: 'short' })
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
        background: 'var(--ds-glass-bg)',
        backdropFilter: 'blur(48px) saturate(200%)',
        WebkitBackdropFilter: 'blur(48px) saturate(200%)',
        border: '1px solid var(--ds-glass-border)',
        borderRadius: '1.75rem',
        boxShadow: 'var(--ds-glass-shadow)',
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
              {t('tt_your_booking')}
            </span>
          )}
          {booking.series_id && (
            <span className="flex items-center gap-1 bg-blue-500/15 text-blue-700 dark:text-blue-400 text-[9px] font-black px-3 py-1 rounded-full uppercase tracking-wide">
              <span className="material-symbols-outlined" style={{ fontSize: 11 }}>link</span>Series
            </span>
          )}
          {booking.room?.requires_contact && (
            <span className="flex items-center gap-1 bg-amber-500/15 text-amber-600 dark:text-amber-400 text-[9px] font-black px-3 py-1 rounded-full uppercase tracking-wide">
              <span className="material-symbols-outlined" style={{ fontSize: 11 }}>star</span>Special
            </span>
          )}
          <span
            className="text-[9px] font-black px-3 py-1 rounded-full uppercase tracking-wide ml-auto"
            style={isTentative
              ? { background: 'var(--ds-bg-surface-2)', backgroundImage: 'repeating-linear-gradient(45deg,transparent,transparent 3px,rgba(0,0,0,0.04) 3px,rgba(0,0,0,0.04) 6px)', color: 'var(--ds-text-2)' }
              : isConf
                ? { background: 'rgba(173,238,43,0.15)', color: '#4d7c00' }
                : { background: 'var(--ds-bg-surface-2)', color: 'var(--ds-text-2)' }}
          >
            {isTentative ? t('tt_tentative') : booking.status === 'confirmed' ? t('tt_confirmed') : booking.status}
          </span>
        </div>

        {/* Title & desc */}
        <div className="space-y-1.5">
          <p className="text-[15px] font-black leading-tight" style={{ color: 'var(--ds-text-1)' }}>{booking.title}</p>
          {booking.description && (
            <p className="text-[12px] font-medium leading-relaxed" style={{ color: 'var(--ds-text-2)' }}>{booking.description}</p>
          )}
          <span
            className="inline-block text-[9px] font-black px-3 py-1 rounded-full uppercase tracking-wide mt-0.5"
            style={booking.type === 'external'
              ? { backgroundColor: 'var(--ds-type-ext-bg)', color: 'var(--ds-type-ext-text)' }
              : { backgroundColor: 'var(--ds-type-int-bg)', color: 'var(--ds-type-int-text)' }}
          >
            {booking.type === 'external' ? 'External' : 'Internal'}
          </span>
        </div>

        {/* Time */}
        <div className="rounded-2xl px-4 py-3 flex items-center gap-3" style={{ background: 'var(--ds-bg-surface-2)' }}>
          <span className="material-symbols-outlined shrink-0" style={{ fontSize: 16, color: 'var(--ds-text-3)' }}>schedule</span>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-black tabular-nums" style={{ color: 'var(--ds-text-1)' }}>
              {formatTime(booking.start_at)} &ndash; {formatTime(booking.end_at)}
              <span className="font-bold ml-1.5" style={{ color: 'var(--ds-text-3)' }}>&middot; {getDuration()}</span>
            </p>
            <p className="text-[11px] font-bold mt-0.5" style={{ color: 'var(--ds-text-2)' }}>{booking.room?.name}</p>
          </div>
          <button
            id="tt-copy-booking"
            onClick={copyBookingInfo}
            className="shrink-0 flex items-center gap-1 hover:bg-[#adee2b] hover:text-black px-2.5 py-1.5 rounded-xl transition-all text-[9px] font-black uppercase"
            style={{ background: 'var(--ds-bg-raised)', border: '1px solid var(--ds-border)', color: 'var(--ds-text-3)' }}
            title="Copy booking info"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 13 }}>content_copy</span>
            {t('tt_copy')}
          </button>
        </div>

        {/* User */}
        <div className="pt-4 space-y-3" style={{ borderTop: '1px solid var(--ds-border-sub)' }}>
          <div className="flex items-center gap-3.5">
            <UserAvatar name={booking.user?.name ?? '?'} avatar={booking.user?.avatar} size={48}
              style={{ borderRadius: 12, border: '1px solid var(--ds-border-sub)' }} />
            <div>
              <p className="text-base font-black leading-tight" style={{ color: 'var(--ds-text-1)' }}>{booking.user?.name}</p>
              <p className="text-[11px] font-bold uppercase mt-0.5" style={{ color: 'var(--ds-text-3)' }}>{dept}</p>
              {booking.booked_for && (
                <button
                  onClick={openForInfo}
                  className="flex items-center gap-1 text-[10px] font-bold transition-colors mt-1"
                  style={{ color: 'var(--ds-text-3)' }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 12 }}>person_pin</span>
                  Booking {t('label_for')} <span style={{ color: '#72ddf7' }}>{booking.booked_for}</span>
                  <span className="material-symbols-outlined" style={{ fontSize: 11 }}>open_in_new</span>
                </button>
              )}
            </div>
          </div>

          {/* Contact */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined" style={{ fontSize: 15, color: 'var(--ds-text-3)' }}>phone_in_talk</span>
                <span className="text-[11px] font-bold" style={{ color: 'var(--ds-text-3)' }}>Ext</span>
                <span className="text-[11px] font-black" style={{ color: 'var(--ds-text-1)' }}>{booking.user?.ext}</span>
              </div>
              <button
                id="tt-copy-ext"
                onClick={() => copyToClip(booking.user?.ext || '', 'tt-copy-ext')}
                className="shrink-0 flex items-center gap-1 hover:bg-[#adee2b] hover:text-black px-2.5 py-1 rounded-lg transition-all text-[9px] font-black uppercase"
                style={{ background: 'var(--ds-bg-raised)', color: 'var(--ds-text-2)' }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 12 }}>content_copy</span>{t('tt_copy')}
              </button>
            </div>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className="material-symbols-outlined shrink-0" style={{ fontSize: 15, color: 'var(--ds-text-3)' }}>mail</span>
                <span className="text-[11px] font-black truncate" style={{ color: 'var(--ds-text-1)' }}>{booking.user?.email}</span>
              </div>
              <button
                id="tt-copy-email"
                onClick={() => copyToClip(booking.user?.email || '', 'tt-copy-email')}
                className="shrink-0 flex items-center gap-1 hover:bg-[#adee2b] hover:text-black px-2.5 py-1 rounded-lg transition-all text-[9px] font-black uppercase"
                style={{ background: 'var(--ds-bg-raised)', color: 'var(--ds-text-2)' }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 12 }}>content_copy</span>{t('tt_copy')}
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
                    className="flex-1 text-[#adee2b] text-[9px] font-black uppercase rounded-xl py-2.5 transition-colors flex items-center justify-center gap-1"
                    style={{ background: 'var(--ds-text-1)' }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 11 }}>link</span>
                    Edit series
                  </button>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => onCancel?.(booking)}
                    className="flex-1 text-[9px] font-black uppercase rounded-xl py-2 hover:bg-red-500/15 hover:text-red-500 transition-colors"
                    style={{ background: 'var(--ds-bg-raised)', color: 'var(--ds-text-2)' }}
                  >
                    Cancel this
                  </button>
                  <button
                    onClick={() => onCancelSeries?.(booking)}
                    className="flex-1 bg-red-500/10 text-red-500 dark:text-red-400 text-[9px] font-black uppercase rounded-xl py-2 hover:bg-red-500 hover:text-white transition-colors flex items-center justify-center gap-1"
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
                  className="flex-1 text-[10px] font-black uppercase rounded-xl py-2.5 hover:bg-red-500/15 hover:text-red-500 transition-colors"
                  style={{ background: 'var(--ds-bg-raised)', color: 'var(--ds-text-2)' }}
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>

    {/* Booking-for glass mini popup */}
    {forAnchorRect && forComputedPos && (
      <div
        ref={forPopupRef}
        onMouseLeave={(e) => {
          if (ref.current?.contains(e.relatedTarget as Node)) return
          onMouseLeave()
        }}
        className="fixed z-[1001] w-56 rounded-2xl overflow-hidden"
        style={{
          left: forComputedPos.x,
          top: forComputedPos.y,
          background: 'var(--ds-glass-bg)',
          backdropFilter: 'blur(32px) saturate(180%)',
          WebkitBackdropFilter: 'blur(32px) saturate(180%)',
          border: '1px solid var(--ds-glass-border)',
          boxShadow: 'var(--ds-glass-shadow)',
        }}
      >
        <div className="px-4 pt-4 pb-3">
          <div className="flex items-center gap-3 mb-3">
            <div className="size-10 rounded-xl flex items-center justify-center text-base font-black shrink-0"
              style={{ background: 'var(--ds-bg-surface-2)', color: 'var(--ds-text-2)' }}>
              {(forUser?.name ?? booking.booked_for ?? '?').charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-[13px] font-black leading-tight truncate" style={{ color: '#72ddf7' }}>
                {forUser?.name ?? booking.booked_for}
              </p>
              {forUser?.department && (
                <p className="text-[9px] font-black uppercase tracking-wider mt-0.5" style={{ color: 'var(--ds-text-3)' }}>
                  {forUser.department}
                </p>
              )}
            </div>
          </div>

          {forUser ? (
            <div className="space-y-2 pt-3" style={{ borderTop: '1px solid var(--ds-border-sub)' }}>
              {forUser.ext && (
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined shrink-0" style={{ fontSize: 13, color: 'var(--ds-text-3)' }}>phone_in_talk</span>
                  <span className="text-[11px] font-bold" style={{ color: 'var(--ds-text-3)' }}>Ext</span>
                  <span className="text-[11px] font-black" style={{ color: 'var(--ds-text-1)' }}>{forUser.ext}</span>
                </div>
              )}
              {forUser.email && (
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined shrink-0" style={{ fontSize: 13, color: 'var(--ds-text-3)' }}>mail</span>
                  <span className="text-[10px] font-bold truncate flex-1" style={{ color: 'var(--ds-text-2)' }}>{forUser.email}</span>
                  <button onClick={() => navigator.clipboard.writeText(forUser!.email)}
                    className="shrink-0 transition-colors" style={{ color: 'var(--ds-text-3)' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 12 }}>content_copy</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <p className="text-[10px] italic" style={{ color: 'var(--ds-text-3)' }}>No account info available</p>
          )}
        </div>
      </div>
    )}
    </>
  )
}
