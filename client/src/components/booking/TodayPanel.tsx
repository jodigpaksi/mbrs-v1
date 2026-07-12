import { useEffect, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getMyBookings, confirmPresenceWeb } from '../../api/bookings'
import { getGeneralSettings } from '../../api/settings'
import { useCancelToast } from '../../context/CancelToastContext'
import { useSettings } from '../../context/SettingsContext'
import type { Booking } from '../../types'
import { parseLocal } from '../../utils/date'

function fmtTime(s: string): string {
  const d = parseLocal(s)
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

export default function TodayPanel() {
  const qc = useQueryClient()
  const { t, language } = useSettings()
  const { addInfoToast } = useCancelToast()
  const [open, setOpen] = useState(false)
  const [visible, setVisible] = useState(false)
  const [now, setNow] = useState(() => new Date())
  const [confirming, setConfirming] = useState<number | null>(null)
  const notifiedWindowRef = useRef<Set<number>>(new Set())

  useEffect(() => {
    function onToggle() { setOpen(o => !o) }
    document.addEventListener('today-panel-toggle', onToggle)
    return () => document.removeEventListener('today-panel-toggle', onToggle)
  }, [])

  useEffect(() => {
    if (open) {
      setVisible(true)
    } else {
      const t = setTimeout(() => setVisible(false), 420)
      return () => clearTimeout(t)
    }
  }, [open])

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000)
    return () => clearInterval(id)
  }, [])

  const { data: myBookings = [] } = useQuery<Booking[]>({
    queryKey: ['my-bookings'],
    queryFn: getMyBookings,
    enabled: open,
    staleTime: 30_000,
  })

  const { data: generalSettings } = useQuery({
    queryKey: ['settings-general'],
    queryFn: getGeneralSettings,
    staleTime: 5 * 60_000,
    enabled: open,
  })
  const webConfirmEnabled  = (generalSettings?.anti_ghost_enabled ?? false) && (generalSettings?.web_confirm_enabled ?? false)
  const windowBefore       = generalSettings?.anti_ghost_window_before  ?? 5
  const windowAfter        = generalSettings?.anti_ghost_window_after   ?? 10

  const today = new Date()
  const todayList = (myBookings as Booking[])
    .filter(b => parseLocal(b.start_at).toDateString() === today.toDateString())
    .sort((a, b) => parseLocal(a.start_at).getTime() - parseLocal(b.start_at).getTime())

  const todayLabel = today.toLocaleDateString(language === 'id' ? 'id-ID' : 'en-GB', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })

  // Fire a warning toast the first time each booking enters its confirm window
  useEffect(() => {
    if (!webConfirmEnabled) return
    for (const b of todayList) {
      if (b.status === 'cancelled' || b.presence_confirmed_at) continue
      const isConfirmTarget = !b.booked_for_user_id || b.is_recipient === true
      if (!isConfirmTarget) continue
      const start = parseLocal(b.start_at)
      const windowOpen  = new Date(start.getTime() - windowBefore * 60_000)
      const windowClose = new Date(start.getTime() + windowAfter  * 60_000)
      if (now >= windowOpen && now <= windowClose && !notifiedWindowRef.current.has(b.id)) {
        notifiedWindowRef.current.add(b.id)
        addInfoToast(`Confirm your presence for "${b.title}" before it gets auto-released!`)
      }
    }
  }, [now, todayList, webConfirmEnabled])

  async function handleConfirm(b: Booking) {
    setConfirming(b.id)
    try {
      await confirmPresenceWeb(b.id)
      qc.invalidateQueries({ queryKey: ['my-bookings'] })
      setOpen(false)
      addInfoToast(`Presence confirmed for "${b.title}"`)
    } catch { /* ignore */ }
    finally { setConfirming(null) }
  }

  return (
    <>
      {/* Backdrop */}
      {open && (
        <div className="fixed inset-0 z-[115]" onClick={() => setOpen(false)} />
      )}

      {/* Slide-in panel */}
      <div
        className={`fixed top-0 right-0 h-full z-[120] flex flex-col transition-transform duration-[400ms] ease-[cubic-bezier(0.32,0.72,0,1)]
          ${open ? 'translate-x-0' : 'translate-x-full'}`}
        style={{
          width: 360,
          background: 'var(--ds-glass-bg)',
          backdropFilter: 'blur(48px) saturate(200%)',
          WebkitBackdropFilter: 'blur(48px) saturate(200%)',
          borderLeft: '1px solid var(--ds-border)',
          boxShadow: '-20px 0 80px rgba(0,0,0,0.18)',
          visibility: visible ? 'visible' : 'hidden',
        }}
      >
        {/* Header */}
        <div className="px-6 pt-6 pb-4 shrink-0" style={{ borderBottom: '1px solid var(--ds-border-sub)' }}>
          <div className="flex items-center gap-3">
            <div className="size-9 rounded-xl bg-black flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-[#adee2b]" style={{ fontSize: 18 }}>calendar_today</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[9px] font-black uppercase tracking-[0.2em]" style={{ color: 'var(--ds-text-3)' }}>{t('label_my_schedule')}</p>
              <p className="text-[11px] font-black uppercase tracking-tight truncate" style={{ color: 'var(--ds-text-1)' }}>{todayLabel}</p>
            </div>
            <button onClick={() => setOpen(false)}
              className="size-8 rounded-xl flex items-center justify-center transition-colors shrink-0"
              style={{ background: 'var(--ds-bg-surface-2)', color: 'var(--ds-text-2)' }}
              onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.background = 'var(--ds-bg-raised)'}
              onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.background = 'var(--ds-bg-surface-2)'}>
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>close</span>
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-3" style={{ scrollbarWidth: 'thin' }}>
          {todayList.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-center py-12">
              <span className="material-symbols-outlined" style={{ fontSize: 52, color: 'var(--ds-text-4)' }}>event_available</span>
              <p className="text-[12px] font-black uppercase tracking-wide" style={{ color: 'var(--ds-text-3)' }}>{t('empty_today')}</p>
              <p className="text-[11px] font-medium" style={{ color: 'var(--ds-text-3)' }}>{t('empty_today_clear')}</p>
            </div>
          ) : (() => {
            // Cancelled bookings always go to past section regardless of end_at
            const active = todayList.filter(b => b.status !== 'cancelled' && parseLocal(b.end_at) > now)
            const past   = todayList.filter(b => b.status === 'cancelled' || parseLocal(b.end_at) <= now)

            const renderCard = (b: Booking) => {
              const start       = parseLocal(b.start_at)
              const end         = parseLocal(b.end_at)
              const ongoing     = start <= now && end > now && b.status !== 'cancelled'
              const isPast      = b.status === 'cancelled' || end <= now
              const isCancelled = b.status === 'cancelled'
              const isTentative = b.status === 'tentative'

              const windowOpen  = new Date(start.getTime() - windowBefore * 60_000)
              const windowClose = new Date(start.getTime() + windowAfter  * 60_000)
              const inWindow        = now >= windowOpen && now <= windowClose
              const isConfirmTarget = !b.booked_for_user_id || b.is_recipient === true
              const needsConfirm    = webConfirmEnabled && inWindow && !b.presence_confirmed_at && isConfirmTarget && !isCancelled

              const cardStyle = ongoing
                ? { background: 'rgba(173,238,43,0.12)', border: '2px solid #adee2b' }
                : isPast
                  ? { background: 'var(--ds-bg-surface-2)', border: '1px solid var(--ds-border-sub)', opacity: 0.65 }
                  : { background: 'var(--ds-bg-surface)', border: '1px solid var(--ds-border-sub)' }

              const statusBadgeClass = isCancelled
                ? 'bg-red-500/15 text-red-500 dark:text-red-400'
                : isTentative
                  ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                  : 'bg-[#adee2b] text-black'

              return (
                <div key={b.id} className="rounded-2xl px-4 py-3.5 space-y-2 transition-colors" style={cardStyle}>
                  {/* Title on its own line */}
                  <p className="text-[15px] font-black leading-tight" style={{ color: 'var(--ds-text-1)' }}>{b.title}</p>

                  {/* Badges row — wraps freely, never competes with title */}
                  <div className="flex flex-wrap items-center gap-1">
                    {ongoing && (
                      <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-[#adee2b] text-black">
                        <span className="size-1.5 rounded-full bg-black/40 animate-pulse inline-block" />
                        {t('label_on_going')}
                      </span>
                    )}
                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${statusBadgeClass}`}>
                      {b.status}
                    </span>
                    {b.cancel_reason === 'ghost_release' && b.dispute_status !== 'approved' && (
                      <span className="flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-orange-500/15 text-orange-600">
                        <span className="material-symbols-outlined" style={{ fontSize: 10 }}>person_off</span>Auto-Released
                      </span>
                    )}
                    {b.dispute_status === 'approved' && (
                      <span className="flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-green-500/15 text-green-600">
                        <span className="material-symbols-outlined" style={{ fontSize: 10 }}>gavel</span>Reinstated
                      </span>
                    )}
                  </div>

                  {b.is_recipient && b.user ? (
                    <div className="flex items-center gap-2 text-[12px] font-bold" style={{ color: 'var(--ds-text-3)' }}>
                      <span className="material-symbols-outlined shrink-0" style={{ fontSize: 15 }}>person_pin</span>
                      <span className="truncate">{t('label_by')} {b.user.name}</span>
                    </div>
                  ) : b.booked_for && (
                    <div className="flex items-center gap-2 text-[12px] font-bold" style={{ color: 'var(--ds-text-3)' }}>
                      <span className="material-symbols-outlined shrink-0" style={{ fontSize: 15 }}>person_pin</span>
                      <span className="truncate">{t('label_for')} {b.booked_for}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-[13px] font-bold" style={{ color: 'var(--ds-text-2)' }}>
                    <span className="material-symbols-outlined shrink-0" style={{ fontSize: 15 }}>schedule</span>
                    <span className="tabular-nums">{fmtTime(b.start_at)} – {fmtTime(b.end_at)}</span>
                  </div>
                  {b.room && (
                    <div className="flex items-center gap-2 text-[12px] font-medium" style={{ color: 'var(--ds-text-3)' }}>
                      <span className="material-symbols-outlined shrink-0" style={{ fontSize: 15 }}>meeting_room</span>
                      <span className="truncate">{b.room.name}{b.room.building ? ` · ${b.room.building.code ?? b.room.building.name}` : ''}</span>
                    </div>
                  )}

                  {ongoing && b.presence_confirmed_at && (
                    <div className="flex items-center gap-1.5 text-[12px] font-black" style={{ color: '#22c55e' }}>
                      <span className="material-symbols-outlined" style={{ fontSize: 15, fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                      {t('presence_confirmed')}
                    </div>
                  )}

                  {needsConfirm && (
                    <button
                      onClick={() => handleConfirm(b)}
                      disabled={confirming === b.id}
                      className="w-full mt-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all disabled:opacity-60"
                      style={{ background: 'rgba(99,102,241,0.12)', border: '1.5px solid rgba(99,102,241,0.35)', color: '#6366f1' }}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: 14, fontVariationSettings: "'FILL' 1" }}>how_to_reg</span>
                      {confirming === b.id ? t('confirming') : t('confirm_presence')}
                    </button>
                  )}
                </div>
              )
            }

            return (
              <>
                <p className="text-[9px] font-black uppercase tracking-widest" style={{ color: 'var(--ds-text-3)' }}>
                  {todayList.length} {t('label_bookings')} {t('label_today').toLowerCase()}
                </p>
                {active.map(renderCard)}
                {past.length > 0 && (
                  <>
                    <div className="flex items-center gap-2 pt-1">
                      <div className="flex-1 h-px" style={{ background: 'var(--ds-border-sub)' }} />
                      <span className="text-[9px] font-black uppercase tracking-widest" style={{ color: 'var(--ds-text-4)' }}>{t('label_past')}</span>
                      <div className="flex-1 h-px" style={{ background: 'var(--ds-border-sub)' }} />
                    </div>
                    {past.map(renderCard)}
                  </>
                )}
              </>
            )
          })()}
        </div>
      </div>
    </>
  )
}
