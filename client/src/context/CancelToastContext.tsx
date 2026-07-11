import { createContext, useContext, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useQueryClient } from '@tanstack/react-query'
import { cancelBooking, cancelSeries } from '../api/bookings'
import type { Booking } from '../types'

export interface ToastItem {
  id: string
  bookingId: number
  msg: string
  countdown: number
  isUndo: boolean
  negative: boolean
}

export interface SeriesUndoToast {
  id: string
  seriesId: string
  msg: string
  countdown: number
}

export interface SeriesCancelTarget {
  series_id: string
  bookings: Booking[]
}

interface Ctx {
  pendingCancelIds: Set<number>
  exitingCancelIds: Set<number>
  toasts: ToastItem[]
  seriesUndoToasts: SeriesUndoToast[]
  addCancelToast: (booking: Booking) => void
  addInfoToast: (msg: string, negative?: boolean) => void
  undoCancel: (toastId: string, bookingId: number) => void
  confirmSeriesCancel: (target: SeriesCancelTarget) => void
  undoSeriesCancel: (toastId: string) => void
}

const CancelToastContext = createContext<Ctx | null>(null)

export function CancelToastProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const [toasts, setToasts]                       = useState<ToastItem[]>([])
  const [seriesUndoToasts, setSeriesUndoToasts]   = useState<SeriesUndoToast[]>([])
  const [pendingCancelIds, setPendingCancelIds]   = useState<Set<number>>(new Set())
  const [exitingCancelIds, setExitingCancelIds]   = useState<Set<number>>(new Set())
  const cancelTimers     = useRef<Map<number, { timer: ReturnType<typeof setTimeout>; interval: ReturnType<typeof setInterval> }>>(new Map())
  const seriesCancelTimers = useRef<Map<string, { timer: ReturnType<typeof setTimeout>; interval: ReturnType<typeof setInterval> }>>(new Map())

  async function invalidateAll(cancelledId?: number) {
    // Patch active queries immediately (Schedule page still mounted)
    if (cancelledId) {
      const patchStatus = (old: unknown) => {
        if (!Array.isArray(old)) return old
        return old.map((b: any) => b.id === cancelledId ? { ...b, status: 'cancelled' } : b)
      }
      queryClient.setQueryData(['my-bookings'], patchStatus)
      queryClient.setQueriesData<unknown>({ queryKey: ['all-my-bookings'] }, patchStatus)
    }
    // Remove bookings cache entirely so Timeline fetches fresh on next mount
    queryClient.removeQueries({ queryKey: ['bookings'] })
    // Refetch active queries
    await Promise.all([
      queryClient.refetchQueries({ queryKey: ['my-bookings'] }),
      queryClient.refetchQueries({ queryKey: ['all-my-bookings'] }),
      queryClient.refetchQueries({ queryKey: ['special-bookings'] }),
    ])
  }

  function addCancelToast(booking: Booking) {
    const bid = booking.id
    const toastId = `cancel-${bid}-${Date.now()}`
    let count = 5

    setPendingCancelIds(prev => new Set([...prev, bid]))
    setToasts(prev => [...prev, { id: toastId, bookingId: bid, msg: `"${booking.title}" will be cancelled`, countdown: count, isUndo: true, negative: true }])

    const interval = setInterval(() => {
      count -= 1
      setToasts(prev => prev.map(t => t.id === toastId ? { ...t, countdown: count } : t))
    }, 1000)

    const timer = setTimeout(async () => {
      clearInterval(interval)
      cancelTimers.current.delete(bid)
      setToasts(prev => prev.filter(t => t.id !== toastId))
      setExitingCancelIds(prev => new Set([...prev, bid]))
      setTimeout(async () => {
        setExitingCancelIds(prev => { const s = new Set(prev); s.delete(bid); return s })
        setPendingCancelIds(prev => { const s = new Set(prev); s.delete(bid); return s })
        await cancelBooking(bid)
        invalidateAll(bid)
      }, 380)
    }, 5000)

    cancelTimers.current.set(bid, { timer, interval })
  }

  function addInfoToast(msg: string, negative = false) {
    const id = `info-${Date.now()}`
    setToasts(prev => [...prev, { id, bookingId: 0, msg, countdown: 0, isUndo: false, negative }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3500)
  }

  function undoCancel(toastId: string, bookingId: number) {
    const timers = cancelTimers.current.get(bookingId)
    if (timers) {
      clearTimeout(timers.timer)
      clearInterval(timers.interval)
      cancelTimers.current.delete(bookingId)
    }
    setToasts(prev => prev.filter(t => t.id !== toastId))
    setPendingCancelIds(prev => { const s = new Set(prev); s.delete(bookingId); return s })
    setExitingCancelIds(prev => { const s = new Set(prev); s.delete(bookingId); return s })
  }

  function confirmSeriesCancel(target: SeriesCancelTarget) {
    const toastId = `series-${target.series_id}-${Date.now()}`
    let count = 5
    const activeCount = target.bookings.filter(b => b.status !== 'cancelled').length

    setSeriesUndoToasts(prev => [...prev, { id: toastId, seriesId: target.series_id, msg: `"${target.bookings[0].title}" series (${activeCount} bookings) will be cancelled`, countdown: count }])

    const interval = setInterval(() => {
      count -= 1
      setSeriesUndoToasts(prev => prev.map(t => t.id === toastId ? { ...t, countdown: count } : t))
    }, 1000)

    const timer = setTimeout(async () => {
      seriesCancelTimers.current.delete(toastId)
      setSeriesUndoToasts(prev => prev.filter(t => t.id !== toastId))
      await cancelSeries(target.series_id)
      await invalidateAll()
    }, 5000)

    seriesCancelTimers.current.set(toastId, { timer, interval })
  }

  function undoSeriesCancel(toastId: string) {
    const t = seriesCancelTimers.current.get(toastId)
    if (t) {
      clearTimeout(t.timer)
      clearInterval(t.interval)
      seriesCancelTimers.current.delete(toastId)
    }
    setSeriesUndoToasts(prev => prev.filter(x => x.id !== toastId))
  }

  const toastUI = (toasts.length > 0 || seriesUndoToasts.length > 0) ? createPortal(
    <div style={{ position: 'fixed', bottom: 28, right: 96, zIndex: 99999, display: 'flex', flexDirection: 'column', gap: 10, pointerEvents: 'auto' }}>
      {seriesUndoToasts.map(st => (
        <div key={st.id} className="toast-pop-in-bottom" style={{
          background: 'rgba(15,20,45,0.55)', backdropFilter: 'blur(48px) saturate(200%)',
          WebkitBackdropFilter: 'blur(48px) saturate(200%)', border: '1px solid rgba(255,255,255,0.14)',
          borderRadius: '1.5rem', padding: '14px 18px',
          boxShadow: '0 24px 56px -8px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.12)',
          display: 'flex', alignItems: 'center', gap: 12, minWidth: 300,
        }}>
          <span className="material-symbols-outlined" style={{ fontSize: 22, color: '#f87171', flexShrink: 0 }}>repeat</span>
          <span style={{ color: 'white', fontSize: 12, fontWeight: 900, flex: 1 }}>{st.msg}</span>
          <span style={{ fontSize: 12, fontWeight: 900, color: 'rgba(255,255,255,0.45)', minWidth: 22, textAlign: 'right' }}>{st.countdown}s</span>
          <button onClick={() => undoSeriesCancel(st.id)} style={{ background: '#adee2b', color: '#000', border: 'none', borderRadius: 10, padding: '5px 12px', fontSize: 10, fontWeight: 900, textTransform: 'uppercase', cursor: 'pointer', letterSpacing: '0.05em', flexShrink: 0 }}>Undo</button>
        </div>
      ))}
      {toasts.map(t => (
        <div key={t.id} className="toast-pop-in-bottom" style={{
          background: 'rgba(15,20,45,0.55)', backdropFilter: 'blur(48px) saturate(200%)',
          WebkitBackdropFilter: 'blur(48px) saturate(200%)', border: '1px solid rgba(255,255,255,0.14)',
          borderRadius: '1.5rem', padding: '14px 18px',
          boxShadow: '0 24px 56px -8px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.12)',
          display: 'flex', alignItems: 'center', gap: 12, minWidth: 300,
        }}>
          <span className="material-symbols-outlined" style={{ fontSize: 22, color: (t.isUndo || t.negative) ? '#f87171' : '#adee2b', flexShrink: 0 }}>{(t.isUndo || t.negative) ? 'cancel' : 'check_circle'}</span>
          <span style={{ color: 'white', fontSize: 12, fontWeight: 900, flex: 1 }}>{t.msg}</span>
          {t.isUndo && (
            <>
              <span style={{ fontSize: 12, fontWeight: 900, color: 'rgba(255,255,255,0.45)', minWidth: 22, textAlign: 'right' }}>{t.countdown}s</span>
              <button onClick={() => undoCancel(t.id, t.bookingId)} style={{ background: '#adee2b', color: '#000', border: 'none', borderRadius: 10, padding: '5px 12px', fontSize: 10, fontWeight: 900, textTransform: 'uppercase', cursor: 'pointer', letterSpacing: '0.05em', flexShrink: 0 }}>Undo</button>
            </>
          )}
        </div>
      ))}
    </div>,
    document.body
  ) : null

  return (
    <CancelToastContext.Provider value={{
      pendingCancelIds, exitingCancelIds,
      toasts, seriesUndoToasts,
      addCancelToast, addInfoToast,
      undoCancel, confirmSeriesCancel, undoSeriesCancel,
    }}>
      {children}
      {toastUI}
    </CancelToastContext.Provider>
  )
}

export function useCancelToast() {
  const ctx = useContext(CancelToastContext)
  if (!ctx) throw new Error('useCancelToast must be used within CancelToastProvider')
  return ctx
}
