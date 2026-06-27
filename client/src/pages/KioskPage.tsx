import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { getKioskConfig, getKioskStatus, verifyKioskPin, confirmPresence } from '../api/kiosk'
import type { KioskConfig, KioskStatus } from '../types'

// ── helpers ──────────────────────────────────────────────────────────────────

function fmtTime(iso: string) {
  // Datetimes are naive local wall-clock — strip the trailing Z so the browser
  // doesn't shift them by its UTC offset (must match the rest of the app).
  return new Date(iso.replace('Z', '')).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false })
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
  const m = (new Date(end.replace('Z', '')).getTime() - new Date(start.replace('Z', '')).getTime()) / 60000
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
      <span className="material-symbols-outlined text-white/20" style={{ fontSize: '4.5vmin' }}>lock</span>
      <p className="text-white/60 font-black uppercase tracking-[0.25em]" style={{ fontSize: '1.3vmin' }}>Enter PIN to unlock</p>
      <div className="flex gap-4">
        {[0,1,2,3].map(i => (
          <div key={i} className="rounded-full transition-all"
            style={{ width: '1.9vmin', height: '1.9vmin', background: pin.length > i ? '#adee2b' : 'rgba(255,255,255,0.15)' }} />
        ))}
      </div>
      {error && <p className="text-red-400 font-black uppercase tracking-wider" style={{ fontSize: '1.1vmin' }}>Incorrect PIN</p>}
      <div className="grid grid-cols-3 gap-3 mt-2">
        {['1','2','3','4','5','6','7','8','9','','0','⌫'].map((k, i) => (
          k === '' ? <div key={i} /> :
          <button key={i} onClick={() => press(k)} disabled={loading}
            className="rounded-2xl font-black text-white transition-all active:scale-90 disabled:opacity-40 flex items-center justify-center"
            style={{ width: '8vmin', height: '8vmin', fontSize: '2vmin', background: k === '⌫' ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.1)' }}>
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
  const [tapped, setTapped] = useState(false)

  async function handleConfirm() {
    if (confirmedAt || tapped) return
    setTapped(true)
    try {
      const r = await confirmPresence(kioskId, bookingId)
      onConfirmed(r.presence_confirmed_at)
    } catch {}
  }

  const isConfirmed = !!confirmedAt || tapped
  const pad  = size === 'large' ? '3.4vmin 0' : '2.4vmin 0'
  const fz   = size === 'large' ? '3.2vmin' : '2.4vmin'
  const icon = size === 'large' ? '3.8vmin' : '3vmin'

  if (isConfirmed) return (
    <div className="flex items-center justify-center gap-2 rounded-2xl font-black uppercase tracking-[0.1em] w-full"
      style={{ background: 'rgba(34,197,94,0.15)', border: '1.5px solid rgba(34,197,94,0.4)', padding: pad, color: '#22c55e', fontSize: fz }}>
      <span className="material-symbols-outlined" style={{ fontSize: icon, fontVariationSettings: "'FILL' 1" }}>check_circle</span>
      Confirmed
    </div>
  )

  return (
    <button onClick={handleConfirm}
      className="flex items-center justify-center gap-2 rounded-2xl font-black uppercase tracking-[0.1em] transition-all active:scale-95 w-full"
      style={{
        background: 'rgba(255,255,255,0.08)',
        border: '1.5px solid rgba(255,255,255,0.15)',
        color: 'rgba(255,255,255,0.7)',
        fontSize: fz, padding: pad,
      }}>
      <span className="material-symbols-outlined" style={{ fontSize: icon }}>how_to_reg</span>
      Confirm Presence
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
// ════════════════════════════════════════════════════════════════════════════

function LandscapeLayout({ now, theme, layout, room, status, current, isOccupied, accent, kioskId, onPresenceConfirmed }: LayoutProps) {
  const ok     = isOccupied ? '#ef4444' : '#22c55e'
  const isDark = theme.mode === 'dark'
  const upcomingCount = Math.min(2, Math.max(1, layout.upcoming_count ?? 2))

  return (
    <div className="flex h-full overflow-hidden" style={{ color: 'var(--k-text)' }}>

      {/* ── LEFT PANEL — giant status ── */}
      <div className="relative flex flex-col overflow-hidden shrink-0"
        style={{ width: '38%', background: isOccupied ? (isDark ? 'rgba(239,68,68,0.13)' : 'rgba(239,68,68,0.08)') : (isDark ? 'rgba(34,197,94,0.10)' : 'rgba(34,197,94,0.07)'), borderRight: `1px solid ${ok}25` }}>

        <div style={{ height: '0.4vmin', background: ok, flexShrink: 0 }} />

        {/* Room identity */}
        <div className="shrink-0" style={{ padding: '2.5vmin 3vmin', borderBottom: '1px solid var(--k-border)' }}>
          <p className="font-black uppercase tracking-[0.2em]" style={{ fontSize: '2vmin', color: ok, marginBottom: '0.8vmin' }}>
            {isOccupied ? 'In Use' : 'Available'}
          </p>
          <p className="font-black leading-tight" style={{ fontSize: '4.4vmin', color: 'var(--k-text)', letterSpacing: '-0.02em' }}>
            {room?.name ?? 'Meeting Room'}
          </p>
          <p className="font-semibold" style={{ fontSize: '2.3vmin', color: 'var(--k-text2)', marginTop: '0.8vmin' }}>
            {room?.building ?? ''}{room?.floor ? ` · ${room.floor}` : ''}
            {room?.capacity ? ` · ${room.capacity} seats` : ''}
          </p>
        </div>

        {/* Status info */}
        <div className="flex-1 flex flex-col justify-center gap-5" style={{ padding: '2vmin 3vmin' }}>
          <div className="flex items-center gap-3">
            <div className="rounded-full shrink-0" style={{ width: '2vmin', height: '2vmin', background: ok }} />
            <span className="font-black uppercase tracking-[0.18em]" style={{ fontSize: '2.6vmin', color: ok }}>
              {isOccupied ? 'Room Occupied' : 'Room Free'}
            </span>
          </div>

          {isOccupied && current ? (
            <div>
              <p className="font-black leading-snug" style={{ fontSize: '5vmin', color: 'var(--k-text)', letterSpacing: '-0.03em' }}>
                {current.title}
              </p>
              <p className="font-bold" style={{ fontSize: '2.6vmin', color: 'var(--k-text2)', marginTop: '1.2vmin' }}>
                {fmtTime(current.start_at)} — {fmtTime(current.end_at)}
              </p>
              {current.user && (
                <p className="font-bold" style={{ fontSize: '2.6vmin', color: 'var(--k-text2)', marginTop: '0.5vmin' }}>{current.user}{current.department ? ` - ${current.department}` : ''}</p>
              )}
            </div>
          ) : (
            <div>
              {status?.free_until ? (
                <>
                  <p className="font-bold" style={{ fontSize: '2.3vmin', color: 'var(--k-text2)' }}>Free until</p>
                  <p className="font-black" style={{ fontSize: '6.8vmin', color: ok, letterSpacing: '-0.04em', lineHeight: 1.1 }}>
                    {fmtTime(status.free_until)}
                  </p>
                </>
              ) : (
                <p className="font-black" style={{ fontSize: '3.2vmin', color: 'var(--k-text2)' }}>No bookings today</p>
              )}
            </div>
          )}
        </div>

        {/* Action buttons */}
        {layout.show_confirm_btn && isOccupied && current && (
          <div className="shrink-0 flex flex-col gap-3" style={{ padding: '0 3vmin 3vmin' }}>
            <ConfirmPresenceBtn
              kioskId={kioskId}
              bookingId={current.id}
              confirmedAt={current.presence_confirmed_at}
              onConfirmed={onPresenceConfirmed}
            />
          </div>
        )}
      </div>

      {/* ── RIGHT PANEL — clock + schedule ── */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden" style={{ background: 'var(--k-bg)' }}>

        {/* Clock header */}
        <div className="flex items-center justify-between shrink-0" style={{ padding: '2vmin 3vmin', borderBottom: '1px solid var(--k-border)' }}>
          {layout.show_clock && (
            <>
              <div>
                <p className="font-black" style={{ fontSize: '2.4vmin', color: 'var(--k-text)', letterSpacing: '0.02em' }}>
                  {fmtLongDate(now)}
                </p>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="font-black tabular-nums" style={{ fontSize: '5.5vmin', color: accent, letterSpacing: '-0.04em', lineHeight: 1 }}>
                  {fmtClock(now)}
                </span>
                <span className="font-bold tabular-nums" style={{ fontSize: '2.3vmin', color: 'var(--k-text2)', lineHeight: 1 }}>
                  :{fmtSec(now)}
                </span>
              </div>
            </>
          )}
          {!layout.show_clock && (
            <p className="font-black uppercase tracking-[0.25em]" style={{ fontSize: '2vmin', color: 'var(--k-text2)' }}>Today's Schedule</p>
          )}
        </div>

        {/* Schedule */}
        {layout.show_bookings && (
          <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
            {layout.show_clock && (
              <div className="shrink-0" style={{ padding: '2.4vmin 3vmin 0.8vmin' }}>
                <p className="font-black uppercase tracking-[0.25em]" style={{ fontSize: '1.9vmin', color: 'var(--k-text2)' }}>Today's Schedule</p>
              </div>
            )}
            {(!status?.upcoming?.length && !current) ? (
              <div className="flex flex-col items-center justify-center gap-2" style={{ height: '16vmin' }}>
                <span className="material-symbols-outlined" style={{ fontSize: '5vmin', color: 'var(--k-text2)', opacity: 0.25 }}>event_available</span>
                <p style={{ fontSize: '2.3vmin', color: 'var(--k-text2)', fontWeight: 700, opacity: 0.4 }}>No bookings today</p>
              </div>
            ) : (
              <div style={{ padding: '0 3vmin 2vmin' }}>
                {current && (
                  <div className="flex items-stretch gap-0 mb-1">
                    <div className="shrink-0 text-right" style={{ width: '11vmin', padding: '1.4vmin 2vmin 1.4vmin 0' }}>
                      <p className="font-black tabular-nums" style={{ fontSize: '2.3vmin', color: '#ef4444' }}>{fmtTime(current.start_at)}</p>
                      <p className="font-bold tabular-nums" style={{ fontSize: '1.8vmin', color: 'var(--k-text2)' }}>{fmtTime(current.end_at)}</p>
                    </div>
                    <div className="shrink-0 self-stretch rounded-full" style={{ width: 3, margin: '0 0.6vmin', background: '#ef4444' }} />
                    <div className="flex-1 min-w-0 rounded-r-xl" style={{ padding: '1.4vmin 1.4vmin 1.4vmin 2vmin', background: 'rgba(239,68,68,0.07)' }}>
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="px-2 py-0.5 rounded-full font-black uppercase" style={{ fontSize: '1.6vmin', background: 'rgba(239,68,68,0.2)', color: '#ef4444', letterSpacing: '0.1em' }}>Now</span>
                        <p className="font-black truncate" style={{ fontSize: '2.5vmin', color: 'var(--k-text)' }}>{current.title}</p>
                      </div>
                      {current.user && <p className="font-bold truncate" style={{ fontSize: '1.9vmin', color: 'var(--k-text2)' }}>{current.user}{current.department ? ` - ${current.department}` : ''}</p>}
                    </div>
                  </div>
                )}
                {status?.upcoming?.slice(0, upcomingCount).map((b) => (
                  <div key={b.id} className="flex items-stretch gap-0">
                    <div className="shrink-0 text-right" style={{ width: '11vmin', padding: '1.4vmin 2vmin 1.4vmin 0' }}>
                      <p className="font-black tabular-nums" style={{ fontSize: '2.3vmin', color: accent }}>{fmtTime(b.start_at)}</p>
                      <p className="font-bold tabular-nums" style={{ fontSize: '1.8vmin', color: 'var(--k-text2)' }}>{fmtTime(b.end_at)}</p>
                    </div>
                    <div className="shrink-0 self-stretch rounded-full" style={{ width: 3, margin: '0 0.6vmin', background: 'var(--k-border)' }} />
                    <div className="flex-1 min-w-0" style={{ padding: '1.4vmin 0 1.4vmin 2vmin', borderBottom: '1px solid var(--k-border)' }}>
                      <p className="font-black truncate" style={{ fontSize: '2.5vmin', color: 'var(--k-text)' }}>{b.title}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {b.user && <p className="font-bold truncate" style={{ fontSize: '1.9vmin', color: 'var(--k-text2)' }}>{b.user}{b.department ? ` - ${b.department}` : ''}</p>}
                        <span className="shrink-0 font-bold" style={{ fontSize: '1.7vmin', color: 'var(--k-text2)', opacity: 0.6 }}>{dur(b.start_at, b.end_at)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between shrink-0" style={{ padding: '1.4vmin 3vmin', borderTop: '1px solid var(--k-border)' }}>
          <p style={{ fontSize: '1.7vmin', color: 'var(--k-text2)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            MBRS · Meeting Room Booking System
          </p>
          <p style={{ fontSize: '1.7vmin', color: 'var(--k-text2)', fontWeight: 700 }}>Auto-refreshes every 30s</p>
        </div>
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// PORTRAIT — "door sign"
// ════════════════════════════════════════════════════════════════════════════

function PortraitLayout({ now, theme, layout, room, status, current, isOccupied, accent, kioskId, onPresenceConfirmed }: LayoutProps) {
  const ok = isOccupied ? '#ef4444' : '#22c55e'
  const upcomingCount = Math.min(2, Math.max(1, layout.upcoming_count ?? 2))

  return (
    <div className="relative flex flex-col h-full overflow-hidden" style={{ color: 'var(--k-text)' }}>
      {/* Subtle top color strip */}
      <div className="absolute top-0 inset-x-0 pointer-events-none" style={{ height: '0.5vmin', background: ok }} />

      {/* ── BODY — core (never clipped) + upcoming (fills leftover) ── */}
      <div className="relative z-10 flex-1 min-h-0 flex flex-col overflow-hidden">

        {/* Core: clock + room + card + confirm — shrink-0, always fully visible */}
        <div className="shrink-0 flex flex-col items-center text-center" style={{ padding: '0 7vmin' }}>

          {/* Clock */}
          {layout.show_clock && (
            <div className="flex flex-col items-center" style={{ paddingTop: '4vmin', paddingBottom: '3vmin' }}>
              <p className="font-black tabular-nums leading-none" style={{ fontSize: '10vmin', color: 'var(--k-text)', letterSpacing: '-0.04em' }}>
                {fmtClock(now)}<span style={{ fontSize: '5vmin', color: 'var(--k-text2)', marginLeft: '0.8vmin' }}>:{fmtSec(now)}</span>
              </p>
              <p className="font-black" style={{ fontSize: '3.9vmin', color: 'var(--k-text)', marginTop: '1.6vmin', letterSpacing: '-0.01em' }}>{fmtLongDate(now)}</p>
            </div>
          )}

          {/* Room name */}
          <div style={{ marginTop: layout.show_clock ? 0 : '4vmin', marginBottom: '3vmin' }}>
            <p className="font-black" style={{ fontSize: '7.5vmin', color: 'var(--k-text)', lineHeight: 1.05 }}>{room?.name ?? 'Meeting Room'}</p>
            {room?.capacity ? (
              <p className="font-semibold" style={{ fontSize: '3.3vmin', color: 'var(--k-text2)', marginTop: '1vmin' }}>{room.capacity} seats</p>
            ) : null}
          </div>

          {/* Divider */}
          <div style={{ width: '30%', height: 1, background: `${ok}40`, marginBottom: '3vmin' }} />

          {/* Currently Booked info */}
          {isOccupied && current ? (
            <div className="w-full text-left" style={{
              background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.20)',
              borderRadius: '2.5vmin', padding: '3vmin 3.6vmin',
            }}>
              <div className="flex items-center gap-2" style={{ marginBottom: '1.6vmin' }}>
                <div className="rounded-full shrink-0" style={{ width: '1.6vmin', height: '1.6vmin', background: '#ef4444' }} />
                <p className="font-black uppercase tracking-[0.2em]" style={{ fontSize: '2.4vmin', color: '#ef4444' }}>In Use</p>
              </div>
              <p className="font-black" style={{ fontSize: '5vmin', color: 'var(--k-text)', lineHeight: 1.12 }}>{current.title}</p>
              <p className="font-bold" style={{ fontSize: '3.4vmin', color: 'var(--k-text)', marginTop: '1.4vmin' }}>
                {fmtTime(current.start_at)} — {fmtTime(current.end_at)}
              </p>
              {current.user && (
                <p className="font-semibold" style={{ fontSize: '2.8vmin', color: 'var(--k-text2)', marginTop: '0.8vmin' }}>
                  {current.user}{current.department ? ` - ${current.department}` : ''}
                </p>
              )}
            </div>
          ) : (
            <div>
              {status?.free_until ? (
                <p className="font-bold" style={{ fontSize: '3.6vmin', color: 'var(--k-text2)' }}>
                  Free until <span style={{ color: accent, fontWeight: 900 }}>{fmtTime(status.free_until)}</span>
                </p>
              ) : (
                <p style={{ fontSize: '3.3vmin', color: 'var(--k-text2)', fontWeight: 700 }}>No bookings today</p>
              )}
            </div>
          )}

          {/* Confirm Presence button — inside the core so it always sits right under the card */}
          {layout.show_confirm_btn && isOccupied && current && (
            <div className="w-full" style={{ marginTop: '2.4vmin' }}>
              <ConfirmPresenceBtn
                kioskId={kioskId}
                bookingId={current.id}
                confirmedAt={current.presence_confirmed_at}
                onConfirmed={onPresenceConfirmed}
                size="large"
              />
            </div>
          )}
        </div>

        {/* Next N upcoming — fills the remaining space, scrolls/clips if tight */}
        {layout.show_bookings && status?.upcoming && status.upcoming.length > 0 && (
          <div className="flex-1 min-h-0 overflow-hidden" style={{ borderTop: '1px solid var(--k-border)', marginTop: '3vmin', padding: '3vmin 7vmin' }}>
            <p className="font-black uppercase tracking-[0.2em]" style={{ fontSize: '2.5vmin', color: 'var(--k-text2)', marginBottom: '2.8vmin' }}>
              {upcomingCount > 1 ? 'Next Up' : 'Upcoming'}
            </p>
            <div className="flex flex-col" style={{ gap: '3vmin' }}>
              {status.upcoming.slice(0, upcomingCount).map((b) => (
                <div key={b.id} className="flex items-center" style={{ gap: '2.8vmin' }}>
                  <div className="shrink-0 text-right" style={{ width: '15vmin' }}>
                    <p className="font-black tabular-nums" style={{ fontSize: '3.5vmin', color: accent, lineHeight: 1.1 }}>{fmtTime(b.start_at)}</p>
                    <p className="font-semibold tabular-nums" style={{ fontSize: '2.5vmin', color: 'var(--k-text2)' }}>{fmtTime(b.end_at)}</p>
                  </div>
                  <div className="self-stretch shrink-0" style={{ width: 3, borderRadius: 99, background: 'var(--k-border)' }} />
                  <div className="flex-1 min-w-0">
                    <p className="font-black truncate" style={{ fontSize: '3.5vmin', color: 'var(--k-text)', lineHeight: 1.15 }}>{b.title}</p>
                    {b.user && <p className="font-semibold truncate" style={{ fontSize: '2.5vmin', color: 'var(--k-text2)', marginTop: '0.4vmin' }}>{b.user}{b.department ? ` - ${b.department}` : ''}</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="relative z-10 shrink-0" style={{ borderTop: '1px solid var(--k-border)', padding: '1.8vmin 7vmin' }}>
        <p style={{ fontSize: '1.9vmin', color: 'var(--k-text2)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          MBRS · Auto-refreshes every 30s
        </p>
      </div>
    </div>
  )
}

// ── Main kiosk display ────────────────────────────────────────────────────────

function KioskDisplay({ config, kioskId }: { config: KioskConfig & { room: any }; kioskId: string }) {
  const { theme, layout } = config
  const [status, setStatus] = useState<KioskStatus | null>(null)
  const [now, setNow]       = useState(new Date())
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const pollRef     = useRef<ReturnType<typeof setInterval> | null>(null)

  const poll = useCallback(async () => {
    try { setStatus(await getKioskStatus(kioskId)) } catch {}
  }, [kioskId])

  useEffect(() => {
    poll()
    intervalRef.current = setInterval(() => setNow(new Date()), 1000)
    pollRef.current     = setInterval(poll, 30_000)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
      if (pollRef.current)     clearInterval(pollRef.current)
    }
  }, [poll])

  function handlePresenceConfirmed(ts: string) {
    setStatus(prev => {
      if (!prev?.current) return prev
      return { ...prev, current: { ...prev.current, presence_confirmed_at: ts } }
    })
  }

  // Responsive: pick the layout from the ACTUAL viewport aspect ratio (not a saved
  // config value), so the kiosk fits any device/rotation. A landscape layout squeezed
  // into a portrait screen (or vice-versa) is what made the text tiny.
  const [viewport, setViewport] = useState({ w: window.innerWidth, h: window.innerHeight })
  useEffect(() => {
    const onResize = () => setViewport({ w: window.innerWidth, h: window.innerHeight })
    window.addEventListener('resize', onResize)
    window.addEventListener('orientationchange', onResize)
    return () => {
      window.removeEventListener('resize', onResize)
      window.removeEventListener('orientationchange', onResize)
    }
  }, [])

  const accent      = theme.accent
  const current     = status?.current ?? null
  const isOccupied  = !!current
  const isLandscape = viewport.w >= viewport.h

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
    <div className="fixed inset-0 overflow-hidden" style={{ background: theme.bg, ...cssVars }}>
      {isLandscape
        ? <LandscapeLayout {...layoutProps} />
        : <PortraitLayout  {...layoutProps} />
      }
    </div>
  )
}

// ── Root ──────────────────────────────────────────────────────────────────────

export default function KioskPage() {
  const { id = '' } = useParams<{ id: string }>()
  const [config,   setConfig]  = useState<(KioskConfig & { room: any }) | null>(null)
  const [loading,  setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [unlocked, setUnlocked] = useState(false)

  useEffect(() => {
    setLoading(true)
    getKioskConfig(id)
      .then(cfg => { setConfig(cfg as any); setUnlocked(!cfg.has_pin) })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) return (
    <div className="fixed inset-0 flex items-center justify-center" style={{ background: '#0a0e1a' }}>
      <span className="material-symbols-outlined animate-spin text-white/30" style={{ fontSize: '3.5vmin' }}>progress_activity</span>
    </div>
  )

  if (notFound || !config) return (
    <div className="fixed inset-0 flex flex-col items-center justify-center gap-4" style={{ background: '#0a0e1a' }}>
      <span className="material-symbols-outlined text-white/20" style={{ fontSize: '5.2vmin' }}>meeting_room</span>
      <p className="text-white/40 font-black uppercase tracking-widest" style={{ fontSize: '1.3vmin' }}>Kiosk not found</p>
      <p className="text-white/20" style={{ fontSize: '1vmin' }}>ID: {id}</p>
    </div>
  )

  if (!unlocked) return <PinScreen kioskId={id} onVerify={() => setUnlocked(true)} />

  return <KioskDisplay config={config} kioskId={id} />
}
