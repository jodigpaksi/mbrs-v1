import { useState, useEffect } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { getPublicBooking, confirmPublicBookingPresence, cancelPublicBooking, type PublicBookingDetail } from '../api/publicBookings'
import { parseLocal } from '../utils/date'

function fmtDate(iso: string) { return parseLocal(iso).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) }
function fmtTime(iso: string) { return parseLocal(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) }

export default function PublicBookingPage() {
  const { id } = useParams<{ id: string }>()
  const [searchParams] = useSearchParams()
  const query = searchParams.toString()

  const [booking, setBooking] = useState<PublicBookingDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [confirming, setConfirming] = useState(false)
  const [confirmResult, setConfirmResult] = useState('')
  const [cancelStep, setCancelStep] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [cancelResult, setCancelResult] = useState('')

  useEffect(() => {
    if (!id) return
    getPublicBooking(id, query)
      .then(setBooking)
      .catch((e: unknown) => {
        const status = (e as { response?: { status?: number } })?.response?.status
        setLoadError(status === 403 ? 'This link has expired or is no longer valid.' : 'Could not load this booking.')
      })
      .finally(() => setLoading(false))
  }, [id, query])

  async function handleConfirm() {
    if (!id) return
    setConfirming(true)
    try {
      await confirmPublicBookingPresence(id, query)
      setConfirmResult('Presence confirmed. Enjoy your meeting!')
      setBooking(b => b ? { ...b, can_confirm: false, presence_confirmed_at: new Date().toISOString() } : b)
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
      setConfirmResult(msg ?? 'Could not confirm presence — please try again.')
    } finally {
      setConfirming(false)
    }
  }

  async function handleCancel() {
    if (!id) return
    setCancelling(true)
    try {
      await cancelPublicBooking(id, query)
      setCancelResult('Booking cancelled.')
      setBooking(b => b ? { ...b, status: 'cancelled', can_confirm: false, can_cancel: false } : b)
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
      setCancelResult(msg ?? 'Could not cancel booking — please try again.')
    } finally {
      setCancelling(false)
      setCancelStep(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--ds-bg-base)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ width: '100%', maxWidth: 440, background: 'var(--ds-bg-surface)', borderRadius: 28, border: '1px solid var(--ds-border)', padding: 32, boxShadow: '0 24px 56px -8px rgba(0,0,0,0.25)' }}>
        {loading && (
          <p style={{ textAlign: 'center', color: 'var(--ds-text-3)', fontSize: 13, fontWeight: 700 }}>Loading…</p>
        )}

        {!loading && loadError && (
          <div style={{ textAlign: 'center' }}>
            <span className="material-symbols-outlined" style={{ fontSize: 40, color: '#ef4444' }}>link_off</span>
            <p style={{ marginTop: 12, fontSize: 15, fontWeight: 900, color: 'var(--ds-text-1)' }}>Link unavailable</p>
            <p style={{ marginTop: 4, fontSize: 13, color: 'var(--ds-text-3)' }}>{loadError}</p>
          </div>
        )}

        {!loading && booking && (
          <>
            <p style={{ fontSize: 9, fontWeight: 900, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--ds-text-3)', marginBottom: 4 }}>Booking Detail</p>
            <h1 style={{ fontSize: 22, fontWeight: 900, letterSpacing: '-0.02em', color: 'var(--ds-text-1)', marginBottom: 16 }}>{booking.title}</h1>

            <div style={{ background: 'var(--ds-bg-raised)', border: '1px solid var(--ds-border)', borderRadius: 16, padding: 18, display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
              <Row icon="meeting_room" label="Room" value={`${booking.room.name ?? '—'}${booking.room.building ? ` — ${booking.room.building}` : ''}`} />
              <Row icon="calendar_today" label="Date" value={fmtDate(booking.start_at)} />
              <Row icon="schedule" label="Time" value={`${fmtTime(booking.start_at)} – ${fmtTime(booking.end_at)}`} />
              {booking.recipient_name && <Row icon="person" label="For" value={booking.recipient_name} />}
              <Row icon="info" label="Status" value={
                booking.status === 'cancelled' ? 'Cancelled'
                  : booking.presence_confirmed_at ? 'Presence confirmed'
                  : booking.status === 'tentative' ? 'Tentative' : 'Confirmed'
              } />
            </div>

            {booking.status === 'cancelled' && (
              <p style={{ textAlign: 'center', fontSize: 13, fontWeight: 700, color: 'var(--ds-text-3)' }}>This booking has been cancelled.</p>
            )}

            {confirmResult && (
              <p style={{ fontSize: 12, fontWeight: 700, color: '#4d7c00', background: 'rgba(173,238,43,0.1)', border: '1px solid rgba(173,238,43,0.3)', borderRadius: 12, padding: '10px 14px', marginBottom: 12 }}>{confirmResult}</p>
            )}
            {cancelResult && (
              <p style={{ fontSize: 12, fontWeight: 700, color: '#ef4444', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 12, padding: '10px 14px', marginBottom: 12 }}>{cancelResult}</p>
            )}

            {booking.can_confirm && (
              <button onClick={handleConfirm} disabled={confirming}
                style={{ width: '100%', padding: '13px 0', borderRadius: 14, background: '#adee2b', color: '#000', border: 'none', fontSize: 13, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.04em', cursor: 'pointer', marginBottom: 10, opacity: confirming ? 0.5 : 1 }}>
                {confirming ? 'Confirming…' : 'Confirm Presence'}
              </button>
            )}

            {booking.can_cancel && !cancelStep && (
              <button onClick={() => setCancelStep(true)}
                style={{ width: '100%', padding: '13px 0', borderRadius: 14, background: 'transparent', color: '#ef4444', border: '1px solid rgba(239,68,68,0.35)', fontSize: 13, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.04em', cursor: 'pointer' }}>
                Cancel Booking
              </button>
            )}

            {cancelStep && (
              <div style={{ border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.06)', borderRadius: 16, padding: 16, textAlign: 'center' }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--ds-text-1)', marginBottom: 12 }}>Cancel this booking? This cannot be undone.</p>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => setCancelStep(false)} disabled={cancelling}
                    style={{ flex: 1, padding: '11px 0', borderRadius: 12, background: 'var(--ds-bg-surface-2)', color: 'var(--ds-text-2)', border: 'none', fontSize: 12, fontWeight: 900, textTransform: 'uppercase', cursor: 'pointer' }}>
                    Keep Booking
                  </button>
                  <button onClick={handleCancel} disabled={cancelling}
                    style={{ flex: 1, padding: '11px 0', borderRadius: 12, background: '#ef4444', color: '#fff', border: 'none', fontSize: 12, fontWeight: 900, textTransform: 'uppercase', cursor: 'pointer', opacity: cancelling ? 0.5 : 1 }}>
                    {cancelling ? 'Cancelling…' : 'Yes, Cancel'}
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function Row({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
      <span className="material-symbols-outlined" style={{ fontSize: 17, color: 'var(--ds-text-3)', marginTop: 1 }}>{icon}</span>
      <div>
        <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--ds-text-3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ds-text-1)' }}>{value}</div>
      </div>
    </div>
  )
}
