import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { getKioskConfig, getKioskStatus, verifyKioskPin, confirmPresence } from '../api/kiosk'
import type { KioskConfig, KioskStatus } from '../types'

// ── helpers ──────────────────────────────────────────────────────────────────

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false })
}
function fmtClock(d: Date) {
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false })
}
function fmtSec(d: Date) {
  return d.toLocaleTimeString('en-GB', { second: '2-digit', hour12: false }).slice(-2)
}
function fmtLongDate(d: Date) {
  return d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}
function fmtShortDate(d: Date) {
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
}
function dur(start: string, end: string) {
  const m = (new Date(end).getTime() - new Date(start).getTime()) / 60000
  const h = Math.floor(m / 60); const min = m % 60
  return h && min ? `${h}h ${min}m` : h ? `${h}h` : `${min}m`
}

// ── PIN screen ────────────────────────────────────────────────────────────────

function PinScreen({ onVerify, kioskId }: { onVerify: () => void; kioskId: string }) {
  const [pin, setPin] = useState('')
  const [error, setError] = useState(false)
  const [loading, setLoading] = useState(false)

  async function submit(p: string) {
    if (p.length < 4) return
    setLoading(true); setError(false)
    try { await verifyKioskPin(kioskId, p); onVerify() }
    catch { setError(true); setPin('') }
    finally { setLoading(false) }
  }

  function press(v: string) {
    if (loading) return
    if (v === '⌫') { setPin(p => p.slice(0, -1)); setError(false); return }
    const next = pin + v
    setPin(next)
    if (next.length === 4) submit(next)
  }

  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center gap-8" style={{ background: '#0a0e1a' }}>
      <span className="material-symbols-outlined text-white/20" style={{ fontSize: 48 }}>lock</span>
      <p className="text-white/60 text-[14px] font-black uppercase tracking-[0.25em]">Enter PIN to unlock</p>
      <div className="flex gap-4">
        {[0,1,2,3].map(i => (
          <div key={i} className="size-5 rounded-full transition-all"
            style={{ background: pin.length > i ? '#adee2b' : 'rgba(255,255,255,0.15)' }} />
        ))}
      </div>
      {error && <p className="text-red-400 text-[12px] font-black uppercase tracking-wider">Incorrect PIN</p>}
      <div className="grid grid-cols-3 gap-3 mt-2">
        {['1','2','3','4','5','6','7','8','9','','0','⌫'].map((k, i) => (
          k === '' ? <div key={i} /> :
          <button key={i} onClick={() => press(k)} disabled={loading}
            className="size-16 rounded-2xl text-[20px] font-black text-white transition-all active:scale-90 disabled:opacity-40"
            style={{ background: k === '⌫' ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.1)' }}>
            {k}
          </button>
        ))}
      </div>
    </div>
  )
}

// ── Confirm presence button ───────────────────────────────────────────────────

function ConfirmPresenceBtn({
  kioskId, bookingId, confirmedAt, onConfirmed, size = 'normal',
}: {
  kioskId: string
  bookingId: number
  confirmedAt: string | null
  onConfirmed: (ts: string) => void
  size?: 'normal' | 'large'
}) {
  const [loading, setLoading] = useState(false)
  const [flash,   setFlash]   = useState(false)

  async function handleConfirm() {
    if (confirmedAt || loading) return
    setLoading(true)
    try {
      const r = await confirmPresence(kioskId, bookingId)
      onConfirmed(r.presence_confirmed_at)
      setFlash(true)
      setTimeout(() => setFlash(false), 2000)
    } catch {}
    finally { setLoading(false) }
  }

  const isConfirmed = !!confirmedAt
  const pad  = size === 'large' ? '18px 0' : '14px 0'
  const fz   = size === 'large' ? 15 : 13
  const icon = size === 'large' ? 22 : 18

  if (isConfirmed) return (
    <div className="flex items-center justify-center gap-2 rounded-2xl font-black uppercase tracking-[0.1em]"
      style={{ background: 'rgba(34,197,94,0.15)', border: '1.5px solid rgba(34,197,94,0.4)', padding: pad, color: '#22c55e', fontSize: fz }}>
      <span className="material-symbols-outlined" style={{ fontSize: icon }}>check_circle</span>
      Presence Confirmed · {fmtTime(confirmedAt)}
    </div>
  )

  return (
    <button onClick={handleConfirm} disabled={loading}
      className="flex items-center justify-center gap-2 rounded-2xl font-black uppercase tracking-[0.1em] transition-all active:scale-95 disabled:opacity-50 w-full"
      style={{
        background: flash ? 'rgba(34,197,94,0.2)' : 'rgba(255,255,255,0.08)',
        border: '1.5px solid rgba(255,255,255,0.15)',
        color: 'rgba(255,255,255,0.7)',
        fontSize: fz, padding: pad,
      }}>
      <span className="material-symbols-outlined" style={{ fontSize: icon }}>
        {loading ? 'progress_activity' : 'how_to_reg'}
      </span>
      {loading ? 'Confirming…' : 'Confirm Presence'}
    </button>
  )
}

// ── Layout props ──────────────────────────────────────────────────────────────

interface LayoutProps {
  now:        Date
  theme:      KioskConfig['theme']
  layout:     KioskConfig['layout']
  room:       any
  status:     KioskStatus | null
  current:    KioskStatus['current']
  isOccupied: boolean
  accent:     string
  kioskId:    string
  onPresenceConfirmed: (ts: string) => void
}

// ════════════════════════════════════════════════════════════════════════════
// LANDSCAPE — "command center"
// ┌─ thin header bar ───────────────────────────────────────────────────────┐
// │ LEFT: giant status block (full-height colored sidebar)                  │
// │ RIGHT: two-column schedule table                                        │
// └─────────────────────────────────────────────────────────────────────────┘
// ════════════════════════════════════════════════════════════════════════════

function LandscapeLayout({ now, theme, layout, room, status, current, isOccupied, accent, kioskId, onPresenceConfirmed }: LayoutProps) {
  const ok     = isOccupied ? '#ef4444' : '#22c55e'
  const isDark = theme.mode === 'dark'

  return (
    <div className="flex h-full overflow-hidden" style={{ color: 'var(--k-text)' }}>

      {/* ── LEFT PANEL — giant status ── */}
      <div className="relative flex flex-col overflow-hidden shrink-0"
        style={{ width: '38%', background: isOccupied ? (isDark ? 'rgba(239,68,68,0.13)' : 'rgba(239,68,68,0.08)') : (isDark ? 'rgba(34,197,94,0.10)' : 'rgba(34,197,94,0.07)'), borderRight: `1px solid ${ok}25` }}>

        {/* Top color stripe */}
        <div style={{ height: 4, background: ok, flexShrink: 0 }} />

        {/* Room identity */}
        <div className="px-8 pt-7 pb-5 shrink-0" style={{ borderBottom: '1px solid var(--k-border)' }}>
          <p className="font-black uppercase tracking-[0.2em]" style={{ fontSize: 9, color: ok, marginBottom: 4 }}>
            {isOccupied ? 'In Use' : 'Available'}
          </p>
          <p className="font-black leading-tight" style={{ fontSize: 24, color: 'var(--k-text)', letterSpacing: '-0.02em' }}>
            {room?.name ?? 'Meeting Room'}
          </p>
          <p style={{ fontSize: 11, color: 'var(--k-text2)', marginTop: 3 }}>
            {room?.building ?? ''}{room?.floor ? ` · Fl. ${room.floor}` : ''}
            {room?.capacity ? ` · ${room.capacity} seats` : ''}
          </p>
        </div>

        {/* Status info */}
        <div className="flex-1 flex flex-col justify-center px-8 py-6 gap-5">
          {/* Giant pulsing dot */}
          <div className="flex items-center gap-3">
            <div className="rounded-full shrink-0" style={{ width: 12, height: 12, background: ok, boxShadow: `0 0 0 4px ${ok}30, 0 0 16px ${ok}` }} />
            <span className="font-black uppercase tracking-[0.18em]" style={{ fontSize: 13, color: ok }}>
              {isOccupied ? 'Room Occupied' : 'Room Free'}
            </span>
          </div>

          {isOccupied && current ? (
            <div>
              <p className="font-black leading-snug" style={{ fontSize: 28, color: 'var(--k-text)', letterSpacing: '-0.03em' }}>
                {current.title}
              </p>
              <p className="font-bold mt-3" style={{ fontSize: 13, color: 'var(--k-text2)' }}>
                {fmtTime(current.start_at)} — {fmtTime(current.end_at)}
              </p>
              {current.user && (
                <p className="font-bold mt-1" style={{ fontSize: 13, color: 'var(--k-text2)' }}>{current.user}</p>
              )}
              {status?.free_from && (
                <p className="mt-4 font-bold" style={{ fontSize: 12, color: 'var(--k-text2)' }}>
                  Free at <span style={{ color: '#22c55e', fontWeight: 900 }}>{fmtTime(status.free_from)}</span>
                </p>
              )}
            </div>
          ) : (
            <div>
              {status?.free_until ? (
                <>
                  <p style={{ fontSize: 12, color: 'var(--k-text2)', fontWeight: 700 }}>Free until</p>
                  <p className="font-black" style={{ fontSize: 48, color: ok, letterSpacing: '-0.04em', lineHeight: 1.1 }}>
                    {fmtTime(status.free_until)}
                  </p>
                </>
              ) : (
                <p className="font-black" style={{ fontSize: 20, color: 'var(--k-text2)' }}>No bookings today</p>
              )}
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div className="px-8 pb-8 shrink-0 flex flex-col gap-3">
          {layout.show_confirm_btn && isOccupied && current && (
            <ConfirmPresenceBtn
              kioskId={kioskId}
              bookingId={current.id}
              confirmedAt={current.presence_confirmed_at}
              onConfirmed={onPresenceConfirmed}
            />
          )}
          {layout.show_book_btn && !isOccupied && (
            <a href={layout.book_btn_url || window.location.origin} target="_blank" rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 rounded-2xl font-black uppercase tracking-[0.1em] transition-all active:scale-95 w-full"
              style={{ background: accent, color: '#1a3a00', fontSize: 13, padding: '14px 0' }}>
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>add</span>
              Book Now
            </a>
          )}
        </div>
      </div>

      {/* ── RIGHT PANEL — clock + schedule ── */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden" style={{ background: 'var(--k-bg)' }}>

        {/* Clock header */}
        <div className="flex items-center justify-between px-8 py-5 shrink-0" style={{ borderBottom: '1px solid var(--k-border)' }}>
          {layout.show_clock && (
            <>
              <div>
                <p className="font-bold" style={{ fontSize: 12, color: 'var(--k-text2)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                  {fmtLongDate(now)}
                </p>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="font-black tabular-nums" style={{ fontSize: 48, color: accent, letterSpacing: '-0.04em', lineHeight: 1 }}>
                  {fmtClock(now)}
                </span>
                <span className="font-bold tabular-nums" style={{ fontSize: 20, color: 'var(--k-text2)', lineHeight: 1 }}>
                  :{fmtSec(now)}
                </span>
              </div>
            </>
          )}
          {!layout.show_clock && (
            <p className="font-black uppercase tracking-[0.25em]" style={{ fontSize: 10, color: 'var(--k-text2)' }}>Today's Schedule</p>
          )}
        </div>

        {/* Schedule */}
        {layout.show_bookings && (
          <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
            {layout.show_clock && (
              <div className="px-8 pt-5 pb-2 shrink-0">
                <p className="font-black uppercase tracking-[0.25em]" style={{ fontSize: 9, color: 'var(--k-text2)' }}>Today's Schedule</p>
              </div>
            )}
            {(!status?.upcoming?.length && !current) ? (
              <div className="flex flex-col items-center justify-center h-48 gap-2">
                <span className="material-symbols-outlined" style={{ fontSize: 32, color: 'var(--k-text2)', opacity: 0.25 }}>event_available</span>
                <p style={{ fontSize: 12, color: 'var(--k-text2)', fontWeight: 700, opacity: 0.4 }}>No bookings today</p>
              </div>
            ) : (
              <div className="px-8 pb-6">
                {/* Current booking row if occupied */}
                {current && (
                  <div className="flex items-stretch gap-0 mb-1">
                    {/* Time column */}
                    <div className="shrink-0 py-3 pr-5 text-right" style={{ width: 76 }}>
                      <p className="font-black tabular-nums" style={{ fontSize: 13, color: '#ef4444' }}>{fmtTime(current.start_at)}</p>
                      <p className="font-bold tabular-nums" style={{ fontSize: 11, color: 'var(--k-text2)' }}>{fmtTime(current.end_at)}</p>
                    </div>
                    {/* Left border accent */}
                    <div className="shrink-0 w-0.5 self-stretch rounded-full mx-1" style={{ background: '#ef4444' }} />
                    {/* Content */}
                    <div className="flex-1 min-w-0 py-3 pl-4 rounded-r-xl" style={{ background: 'rgba(239,68,68,0.07)' }}>
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="px-2 py-0.5 rounded-full font-black uppercase" style={{ fontSize: 9, background: 'rgba(239,68,68,0.2)', color: '#ef4444', letterSpacing: '0.1em' }}>Now</span>
                        <p className="font-black truncate" style={{ fontSize: 14, color: 'var(--k-text)' }}>{current.title}</p>
                      </div>
                      {current.user && <p className="font-bold truncate" style={{ fontSize: 11, color: 'var(--k-text2)' }}>{current.user}</p>}
                    </div>
                  </div>
                )}
                {status?.upcoming?.map((b) => (
                  <div key={b.id} className="flex items-stretch gap-0">
                    <div className="shrink-0 py-3 pr-5 text-right" style={{ width: 76 }}>
                      <p className="font-black tabular-nums" style={{ fontSize: 13, color: accent }}>{fmtTime(b.start_at)}</p>
                      <p className="font-bold tabular-nums" style={{ fontSize: 11, color: 'var(--k-text2)' }}>{fmtTime(b.end_at)}</p>
                    </div>
                    <div className="shrink-0 w-0.5 self-stretch rounded-full mx-1" style={{ background: 'var(--k-border)' }} />
                    <div className="flex-1 min-w-0 py-3 pl-4" style={{ borderBottom: '1px solid var(--k-border)' }}>
                      <p className="font-black truncate" style={{ fontSize: 14, color: 'var(--k-text)' }}>{b.title}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {b.user && <p className="font-bold truncate" style={{ fontSize: 11, color: 'var(--k-text2)' }}>{b.user}</p>}
                        <span className="shrink-0 font-bold" style={{ fontSize: 10, color: 'var(--k-text2)', opacity: 0.6 }}>{dur(b.start_at, b.end_at)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between px-8 py-2.5 shrink-0" style={{ borderTop: '1px solid var(--k-border)' }}>
          <p style={{ fontSize: 9, color: 'var(--k-text2)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            MBRS · Meeting Room Booking System
          </p>
          <p style={{ fontSize: 9, color: 'var(--k-text2)', fontWeight: 700 }}>Auto-refreshes every 30s</p>
        </div>
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// PORTRAIT — "door sign"
// ┌─ top 50%: full-bleed status hero, centered, huge text ─────────────────┐
// │  Clock HUGE centered at top                                             │
// │  ● BIG STATUS TEXT                                                      │
// │  Room name below                                                        │
// ├─ bottom 50%: booking details + schedule ────────────────────────────────┤
// └─────────────────────────────────────────────────────────────────────────┘
// ════════════════════════════════════════════════════════════════════════════

function PortraitLayout({ now, theme, layout, room, status, current, isOccupied, accent, kioskId, onPresenceConfirmed }: LayoutProps) {
  const ok     = isOccupied ? '#ef4444' : '#22c55e'
  const isDark = theme.mode === 'dark'

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ color: 'var(--k-text)' }}>

      {/* ══ TOP HERO — 48% of height ══ */}
      <div className="relative flex flex-col items-center justify-end pb-8 shrink-0 overflow-hidden"
        style={{ height: '48%' }}>

        {/* Full-bleed radial glow */}
        <div className="absolute inset-0" style={{ background: `radial-gradient(ellipse 90% 80% at 50% 100%, ${ok}30 0%, ${ok}06 50%, transparent 75%)` }} />

        {/* Subtle top gradient */}
        <div className="absolute inset-0" style={{ background: isOccupied
          ? `linear-gradient(to bottom, rgba(239,68,68,0.06) 0%, rgba(239,68,68,0.14) 100%)`
          : `linear-gradient(to bottom, rgba(34,197,94,0.04) 0%, rgba(34,197,94,0.11) 100%)` }} />

        {/* Bottom border line */}
        <div className="absolute bottom-0 left-0 right-0" style={{ height: 3, background: `linear-gradient(to right, transparent, ${ok}, transparent)` }} />

        {/* Clock — top center */}
        {layout.show_clock && (
          <div className="absolute top-6 left-0 right-0 flex flex-col items-center">
            <p className="font-black tabular-nums leading-none" style={{ fontSize: 52, color: 'var(--k-text)', letterSpacing: '-0.04em' }}>
              {fmtClock(now)}<span style={{ fontSize: 26, color: 'var(--k-text2)', marginLeft: 4 }}>:{fmtSec(now)}</span>
            </p>
            <p className="font-bold mt-1" style={{ fontSize: 12, color: 'var(--k-text2)' }}>{fmtShortDate(now)}</p>
          </div>
        )}

        {/* Status + room name — bottom of hero */}
        <div className="relative z-10 flex flex-col items-center gap-3 text-center px-8">
          <div className="flex items-center gap-2.5">
            <div className="rounded-full" style={{ width: 14, height: 14, background: ok, boxShadow: `0 0 0 5px ${ok}28, 0 0 20px ${ok}` }} />
            <span className="font-black uppercase tracking-[0.16em]" style={{ fontSize: 38, color: ok, letterSpacing: '-0.01em', lineHeight: 1 }}>
              {isOccupied ? 'In Use' : 'Available'}
            </span>
          </div>
          <div>
            <p className="font-black" style={{ fontSize: 20, color: 'var(--k-text)' }}>{room?.name ?? 'Meeting Room'}</p>
            <p style={{ fontSize: 12, color: 'var(--k-text2)', marginTop: 2 }}>
              {room?.building ?? ''}{room?.floor ? ` · Floor ${room.floor}` : ''}
              {room?.capacity ? ` · ${room.capacity} seats` : ''}
            </p>
          </div>
        </div>
      </div>

      {/* ══ BOTTOM DETAILS — 52% of height ══ */}
      <div className="flex flex-col flex-1 min-h-0 overflow-hidden" style={{ background: 'var(--k-bg)' }}>

        {/* Current booking / availability card */}
        <div className="px-7 pt-6 pb-5 shrink-0" style={{ borderBottom: '1px solid var(--k-border)' }}>
          {isOccupied && current ? (
            <>
              <p className="font-black uppercase tracking-[0.25em] mb-2" style={{ fontSize: 9, color: ok }}>Currently Booked</p>
              <p className="font-black" style={{ fontSize: 22, color: 'var(--k-text)', letterSpacing: '-0.02em', lineHeight: 1.2 }}>
                {current.title}
              </p>
              <p className="font-bold mt-2" style={{ fontSize: 13, color: 'var(--k-text2)' }}>
                {fmtTime(current.start_at)} — {fmtTime(current.end_at)}
                {current.user ? ` · ${current.user}` : ''}
              </p>
              {status?.free_from && (
                <p className="font-bold mt-2" style={{ fontSize: 12, color: 'var(--k-text2)' }}>
                  Free at <span style={{ color: '#22c55e', fontWeight: 900 }}>{fmtTime(status.free_from)}</span>
                </p>
              )}
              {layout.show_confirm_btn && (
                <div className="mt-4">
                  <ConfirmPresenceBtn
                    kioskId={kioskId}
                    bookingId={current.id}
                    confirmedAt={current.presence_confirmed_at}
                    onConfirmed={onPresenceConfirmed}
                    size="large"
                  />
                </div>
              )}
            </>
          ) : (
            <>
              <p className="font-black uppercase tracking-[0.25em] mb-2" style={{ fontSize: 9, color: ok }}>Availability</p>
              {status?.free_until ? (
                <p className="font-black" style={{ fontSize: 20, color: 'var(--k-text)' }}>
                  Free until <span style={{ color: accent }}>{fmtTime(status.free_until)}</span>
                </p>
              ) : (
                <p className="font-black" style={{ fontSize: 18, color: 'var(--k-text2)' }}>No bookings today</p>
              )}
              {layout.show_book_btn && (
                <a href={layout.book_btn_url || window.location.origin} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-2xl font-black uppercase tracking-[0.1em] transition-all active:scale-95 mt-4"
                  style={{ background: accent, color: '#1a3a00', fontSize: 13, padding: '12px 24px' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 18 }}>add</span>
                  Book Now
                </a>
              )}
            </>
          )}
        </div>

        {/* Schedule list */}
        {layout.show_bookings && (
          <div className="flex-1 overflow-y-auto px-7 pt-4 pb-4 min-h-0" style={{ scrollbarWidth: 'none' }}>
            <p className="font-black uppercase tracking-[0.25em] mb-3" style={{ fontSize: 9, color: 'var(--k-text2)' }}>
              {isOccupied ? 'Upcoming' : "Today's Schedule"}
            </p>
            {!status?.upcoming?.length ? (
              <p style={{ fontSize: 12, color: 'var(--k-text2)', fontWeight: 700, opacity: 0.4 }}>No upcoming bookings</p>
            ) : (
              status.upcoming.map((b) => (
                <div key={b.id} className="flex items-center gap-3 py-2.5" style={{ borderBottom: '1px solid var(--k-border)' }}>
                  <div className="shrink-0 text-right" style={{ width: 56 }}>
                    <p className="font-black tabular-nums" style={{ fontSize: 13, color: accent }}>{fmtTime(b.start_at)}</p>
                    <p className="font-bold tabular-nums" style={{ fontSize: 10, color: 'var(--k-text2)' }}>{fmtTime(b.end_at)}</p>
                  </div>
                  <div className="w-px self-stretch" style={{ background: 'var(--k-border)' }} />
                  <div className="flex-1 min-w-0">
                    <p className="font-black truncate" style={{ fontSize: 13, color: 'var(--k-text)' }}>{b.title}</p>
                    {b.user && <p className="font-bold truncate" style={{ fontSize: 10, color: 'var(--k-text2)' }}>{b.user}</p>}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Footer */}
        <div className="px-7 py-2.5 shrink-0" style={{ borderTop: '1px solid var(--k-border)' }}>
          <p style={{ fontSize: 9, color: 'var(--k-text2)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            MBRS · Auto-refreshes every 30s
          </p>
        </div>
      </div>
    </div>
  )
}

// ── Main kiosk display ────────────────────────────────────────────────────────

function KioskDisplay({ config, kioskId }: { config: KioskConfig & { room: any }; kioskId: string }) {
  const { theme, layout, resolution } = config
  const [status, setStatus]   = useState<KioskStatus | null>(null)
  const [now, setNow]         = useState(new Date())
  const [scale, setScale]     = useState(1)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const pollRef     = useRef<ReturnType<typeof setInterval> | null>(null)

  const computeScale = useCallback(() => {
    const sx = window.innerWidth  / resolution.width
    const sy = window.innerHeight / resolution.height
    setScale(Math.min(sx, sy))
  }, [resolution.width, resolution.height])

  const poll = useCallback(async () => {
    try { setStatus(await getKioskStatus(kioskId)) } catch {}
  }, [kioskId])

  useEffect(() => {
    computeScale()
    window.addEventListener('resize', computeScale)
    return () => window.removeEventListener('resize', computeScale)
  }, [computeScale])

  useEffect(() => {
    poll()
    intervalRef.current = setInterval(() => setNow(new Date()), 1000)
    pollRef.current     = setInterval(poll, 30_000)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
      if (pollRef.current)     clearInterval(pollRef.current)
    }
  }, [poll])

  // Optimistic update presence_confirmed_at without waiting for next poll
  function handlePresenceConfirmed(ts: string) {
    setStatus(prev => {
      if (!prev?.current) return prev
      return { ...prev, current: { ...prev.current, presence_confirmed_at: ts } }
    })
  }

  const accent     = theme.accent
  const current    = status?.current ?? null
  const isOccupied = !!current
  const isLandscape = layout.orientation !== 'portrait'

  const cssVars = {
    '--k-bg':      theme.bg,
    '--k-surface': theme.surface,
    '--k-accent':  accent,
    '--k-text':    theme.text,
    '--k-text2':   theme.mode === 'dark' ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.45)',
    '--k-border':  theme.mode === 'dark' ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.08)',
  } as React.CSSProperties

  const layoutProps: LayoutProps = {
    now, theme, layout, room: config.room,
    status, current, isOccupied, accent,
    kioskId, onPresenceConfirmed: handlePresenceConfirmed,
  }

  return (
    <div className="fixed inset-0 overflow-hidden" style={{ background: theme.bg }}>
      <div style={{
        position: 'absolute', top: '50%', left: '50%',
        width: resolution.width, height: resolution.height,
        transform: `translate(-50%, -50%) scale(${scale})`,
        transformOrigin: 'center center',
        ...cssVars,
      }}>
        {config.room?.photos?.[0] && (
          <div className="absolute inset-0 pointer-events-none"
            style={{ backgroundImage: `url(${config.room.photos[0]})`, backgroundSize: 'cover', backgroundPosition: 'center', opacity: 0.05 }} />
        )}
        {isLandscape
          ? <LandscapeLayout {...layoutProps} />
          : <PortraitLayout  {...layoutProps} />
        }
      </div>
    </div>
  )
}

// ── Root ──────────────────────────────────────────────────────────────────────

export default function KioskPage() {
  const { id = '' } = useParams<{ id: string }>()
  const [config,    setConfig]   = useState<(KioskConfig & { room: any }) | null>(null)
  const [loading,   setLoading]  = useState(true)
  const [notFound,  setNotFound] = useState(false)
  const [unlocked,  setUnlocked] = useState(false)

  useEffect(() => {
    setLoading(true)
    getKioskConfig(id)
      .then(cfg => { setConfig(cfg as any); setUnlocked(!cfg.has_pin) })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) return (
    <div className="fixed inset-0 flex items-center justify-center" style={{ background: '#0a0e1a' }}>
      <span className="material-symbols-outlined animate-spin text-white/30" style={{ fontSize: 36 }}>progress_activity</span>
    </div>
  )

  if (notFound || !config) return (
    <div className="fixed inset-0 flex flex-col items-center justify-center gap-4" style={{ background: '#0a0e1a' }}>
      <span className="material-symbols-outlined text-white/20" style={{ fontSize: 56 }}>meeting_room</span>
      <p className="text-white/40 font-black uppercase tracking-widest text-[14px]">Kiosk not found</p>
      <p className="text-white/20 text-[11px]">ID: {id}</p>
    </div>
  )

  if (!unlocked) return <PinScreen kioskId={id} onVerify={() => setUnlocked(true)} />

  return <KioskDisplay config={config} kioskId={id} />
}
