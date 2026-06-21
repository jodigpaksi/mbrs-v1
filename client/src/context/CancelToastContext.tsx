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
  seriesUndoToast: SeriesUndoToast | null
  addCancelToast: (booking: Booking) => void
  addInfoToast: (msg: string) => void
  undoCancel: (toastId: string, bookingId: number) => void
  confirmSeriesCancel: (target: SeriesCancelTarget) => void
  undoSeriesCancel: () => void
}

const CancelToastContext = createContext<Ctx | null>(null)

export function CancelToastProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const [toasts, setToasts]                       = useState<ToastItem[]>([])
  const [seriesUndoToast, setSeriesUndoToast]     = useState<SeriesUndoToast | null>(null)
  const [pendingCancelIds, setPendingCancelIds]   = useState<Set<number>>(new Set())
  const [exitingCancelIds, setExitingCancelIds]   = useState<Set<number>>(new Set())
  const cancelTimers     = useRef<Map<number, { timer: ReturnType<typeof setTimeout>; interval: ReturnType<typeof setInterval> }>>(new Map())
  const seriesCancelTimer = useRef<{ timer: ReturnType<typeof setTimeout>; interval: ReturnType<typeof setInterval> } | null>(null)

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
    setToasts(prev => [...prev, { id: toastId, bookingId: bid, msg: `"${booking.title}" will be cancelled`, countdown: count, isUndo: true }])

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

  function addInfoToast(msg: string) {
    const id = `info-${Date.now()}`
    setToasts(prev => [...prev, { id, bookingId: 0, msg, countdown: 0, isUndo: false }])
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

    setSeriesUndoToast({ id: toastId, seriesId: target.series_id, msg: `"${target.bookings[0].title}" series (${activeCount} bookings) will be cancelled`, countdown: count })

    const interval = setInterval(() => {
      count -= 1
      setSeriesUndoToast(prev => prev?.id === toastId ? { ...prev, countdown: count } : prev)
    }, 1000)

    const timer = setTimeout(async () => {
      clearInterval(interval)
      seriesCancelTimer.current = null
      setSeriesUndoToast(null)
      await cancelSeries(target.series_id)
      await invalidateAll()
    }, 5000)

    seriesCancelTimer.current = { timer, interval }
  }

  function undoSeriesCancel() {
    if (seriesCancelTimer.current) {
      clearTimeout(seriesCancelTimer.current.timer)
      clearInterval(seriesCancelTimer.current.interval)
      seriesCancelTimer.current = null
    }
    setSeriesUndoToast(null)
  }

  const toastUI = (toasts.length > 0 || seriesUndoToast) ? createPortal(
    <div style={{ position: 'fixed', bottom: 28, right: 96, zIndex: 99999, display: 'flex', flexDirection: 'column', gap: 10, pointerEvents: 'auto' }}>
      <style>{`@keyframes ct-in{from{opacity:0;transform:translateY(12px) scale(0.95)}to{opacity:1;transform:translateY(0) scale(1)}}`}</style>
      {seriesUndoToast && (
        <div key={seriesUndoToast.id} style={{
          background: 'rgba(15,20,45,0.55)', backdropFilter: 'blur(48px) saturate(200%)',
          WebkitBackdropFilter: 'blur(48px) saturate(200%)', border: '1px solid rgba(255,255,255,0.14)',
          borderRadius: '1.5rem', padding: '14px 18px',
          boxShadow: '0 24px 56px -8px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.12)',
          display: 'flex', alignItems: 'center', gap: 12, minWidth: 300,
          animation: 'ct-in 0.22s cubic-bezier(0.34,1.04,0.64,1)',
        }}>
          <span className="material-symbols-outlined" style={{ fontSize: 22, color: '#f87171', flexShrink: 0 }}>repeat</span>
          <span style={{ color: 'white', fontSize: 12, fontWeight: 900, flex: 1 }}>{seriesUndoToast.msg}</span>
          <span style={{ fontSize: 12, fontWeight: 900, color: 'rgba(255,255,255,0.45)', minWidth: 22, textAlign: 'right' }}>{seriesUndoToast.countdown}s</span>
          <button onClick={undoSeriesCancel} style={{ background: '#adee2b', color: '#000', border: 'none', borderRadius: 10, padding: '5px 12px', fontSize: 10, fontWeight: 900, textTransform: 'uppercase', cursor: 'pointer', letterSpacing: '0.05em', flexShrink: 0 }}>Undo</button>
        </div>
      )}
      {toasts.map(t => (
        <div key={t.id} style={{
          background: 'rgba(15,20,45,0.55)', backdropFilter: 'blur(48px) saturate(200%)',
          WebkitBackdropFilter: 'blur(48px) saturate(200%)', border: '1px solid rgba(255,255,255,0.14)',
          borderRadius: '1.5rem', padding: '14px 18px',
          boxShadow: '0 24px 56px -8px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.12)',
          display: 'flex', alignItems: 'center', gap: 12, minWidth: 300,
          animation: 'ct-in 0.22s cubic-bezier(0.34,1.04,0.64,1)',
        }}>
          <span className="material-symbols-outlined" style={{ fontSize: 22, color: t.isUndo ? '#f87171' : '#adee2b', flexShrink: 0 }}>{t.isUndo ? 'cancel' : 'check_circle'}</span>
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
      toasts, seriesUndoToast,
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
