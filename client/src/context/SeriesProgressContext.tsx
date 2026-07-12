import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useQueryClient } from '@tanstack/react-query'
import { useSettings } from './SettingsContext'

export type SkipReason = 'conflict' | 'advance_limit' | 'timeout' | 'invalid_date'
// label: optional display override — invalid_date entries store a clamped placeholder date
// (e.g. Sep 30) for series_skipped_dates, but should still *display* the originally requested
// day (e.g. "31 Sep") so the post-submit result matches what the dates-list panel showed.
export interface SkippedEntry { date: string; reason: SkipReason; label?: string }

interface SeriesResult { created: number; total: number; skipped: SkippedEntry[] }

interface Ctx {
  active: boolean
  progress: number
  result: SeriesResult | null
  // Which BookingPanel instance actually started the current submission — every OTHER instance
  // (e.g. a fresh, unrelated "new booking" opened on a different menu meanwhile) must ignore
  // `result`/`progress` entirely and render as if nothing were happening; only the corner widget
  // is meant to be a truly global signal.
  activeInstanceId: string | null
  startSeriesProgress: (instanceId: string) => void
  updateSeriesProgress: (percent: number) => void
  finishSeriesProgress: (result: SeriesResult, onDone?: () => void) => void
  doneSeriesProgress: () => void
  reportPanelOpen: (instanceId: string, open: boolean) => void
}

const SeriesProgressContext = createContext<Ctx | null>(null)

function fmtShortDate(iso: string, lang = 'en'): string {
  if (!iso) return ''
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString(lang === 'id' ? 'id-ID' : 'en-GB', { day: '2-digit', month: 'short' })
}

// Lives above the router (mounted once in main.tsx) so an in-flight repeat/series booking batch,
// and its result, stay visible even if the page that started it — or the whole route layout,
// including MainLayout itself — unmounts mid-submission from navigating elsewhere. The actual
// createBooking() network calls in BookingPanel.doCreateBookings() keep running to completion
// regardless of any component unmounting; this context is just where their progress is reported
// so something is always still listening.
export function SeriesProgressProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const { t, language } = useSettings()
  const [active, setActive] = useState(false)
  const [progress, setProgress] = useState(0)
  const [result, setResult] = useState<SeriesResult | null>(null)
  const [activeInstanceId, setActiveInstanceId] = useState<string | null>(null)
  const [minimized, setMinimized] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  // Multiple BookingPanel instances can be mounted at once (MainLayout's own + the current page's),
  // each reporting its own open/closed state by a stable per-instance id — the widget only shows
  // while ALL of them are closed, since an open panel has its own inline progress bar (on the
  // Confirm button) and showing the floating widget too would be a duplicate.
  const [openPanelIds, setOpenPanelIds] = useState<Set<string>>(new Set())
  const reportPanelOpen = useCallback((instanceId: string, open: boolean) => {
    setOpenPanelIds(prev => {
      const next = new Set(prev)
      if (open) next.add(instanceId)
      else next.delete(instanceId)
      return next
    })
  }, [])
  const panelOpen = openPanelIds.size > 0
  // Fires when the result is dismissed — via the widget's Done button, or immediately on a
  // zero-skip finish. Best-effort call into whichever BookingPanel instance started the
  // submission (e.g. to close its panel / highlight the new booking); if that instance has since
  // unmounted (page navigated away), the closure's setState calls are harmless no-ops.
  const onDoneRef = useRef<(() => void) | undefined>(undefined)

  function invalidateBookingQueries() {
    queryClient.invalidateQueries({ queryKey: ['bookings'] })
    queryClient.invalidateQueries({ queryKey: ['my-bookings'] })
    queryClient.invalidateQueries({ queryKey: ['all-my-bookings'] })
    queryClient.invalidateQueries({ queryKey: ['special-bookings'] })
  }

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 3500)
  }

  const startSeriesProgress = useCallback((instanceId: string) => {
    setActive(true)
    setProgress(0)
    setResult(null)
    setActiveInstanceId(instanceId)
    setMinimized(false)
  }, [])

  const updateSeriesProgress = useCallback((percent: number) => {
    setProgress(percent)
  }, [])

  const finishSeriesProgress = useCallback((r: SeriesResult, onDone?: () => void) => {
    invalidateBookingQueries()
    if (r.skipped.length === 0) {
      setActive(false)
      setResult(null)
      setActiveInstanceId(null)
      showToast(`${r.created} ${t('booked_of')} ${r.total} ${t('booked_count')}`)
      onDone?.()
    } else {
      setResult(r)
      onDoneRef.current = onDone
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t])

  const doneSeriesProgress = useCallback(() => {
    setActive(false)
    setResult(null)
    setActiveInstanceId(null)
    onDoneRef.current?.()
    onDoneRef.current = undefined
  }, [])

  const widget = active && !panelOpen && createPortal(
    <div
      className="fixed z-[9999] rounded-2xl overflow-hidden transition-[width] duration-200 ease-out"
      style={{
        right: 24, bottom: 100, width: minimized ? 220 : 320,
        background: 'rgba(15,20,45,0.92)',
        backdropFilter: 'blur(24px) saturate(180%)',
        WebkitBackdropFilter: 'blur(24px) saturate(180%)',
        border: '1px solid rgba(255,255,255,0.14)',
        boxShadow: '0 24px 56px -8px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.12)',
      }}
    >
      <div className="flex items-center gap-2 px-4 py-3">
        <span className={`material-symbols-outlined text-[#adee2b] ${result ? '' : 'animate-spin'}`} style={{ fontSize: 16 }}>
          {result ? 'task_alt' : 'progress_activity'}
        </span>
        <p className="flex-1 text-[10px] font-black uppercase tracking-wide text-white truncate">
          {result ? `${result.created} ${t('booked_of')} ${result.total}` : `${t('btn_saving')} ${progress}%`}
        </p>
        <button type="button" onClick={() => setMinimized(v => !v)}
          className="size-6 shrink-0 rounded-lg flex items-center justify-center hover:bg-white/10 text-white/70 transition-colors">
          <span className="material-symbols-outlined" style={{ fontSize: 14 }}>{minimized ? 'expand_more' : 'expand_less'}</span>
        </button>
      </div>
      {!minimized && (
        <div className="px-4 pb-4 space-y-2.5">
          {!result && (
            <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
              <div className="h-full bg-[#adee2b] transition-[width] duration-300 ease-out" style={{ width: `${progress}%` }} />
            </div>
          )}
          {result && (
            <>
              <p className="text-[9px] text-white/60 font-bold">{result.skipped.length} {t('skipped_conflicts')}</p>
              <div className="bg-red-500/10 rounded-xl p-2.5 space-y-1 max-h-32 overflow-y-auto">
                {result.skipped.map(({ date: d, reason, label }) => (
                  <div key={`${d}-${reason}-${label ?? ''}`} className="flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-red-400 shrink-0" style={{ fontSize: 12 }}>
                      {reason === 'advance_limit' ? 'event_busy' : reason === 'timeout' ? 'hourglass_disabled' : reason === 'invalid_date' ? 'event_note' : 'block'}
                    </span>
                    <span className="text-[11px] font-bold text-red-300 truncate">{label ?? fmtShortDate(d, language)}</span>
                  </div>
                ))}
              </div>
              <button
                onClick={doneSeriesProgress}
                className="attn-pulse w-full py-2 rounded-xl bg-black text-[#adee2b] text-[9px] font-black uppercase tracking-wide hover:bg-slate-800 hover:scale-[1.03] hover:shadow-lg hover:[animation-play-state:paused] active:scale-95 transition-all"
              >
                {t('btn_done')}
              </button>
            </>
          )}
        </div>
      )}
    </div>,
    document.body
  )

  const toastUI = toast && createPortal(
    <div
      className="fixed z-[9999] transition-all duration-300 pointer-events-none"
      style={{ bottom: 28, right: 96, transform: 'translateY(0)', opacity: 1 }}
    >
      <div style={{
        background: 'rgba(15,20,45,0.55)',
        backdropFilter: 'blur(48px) saturate(200%)',
        WebkitBackdropFilter: 'blur(48px) saturate(200%)',
        border: '1px solid rgba(255,255,255,0.14)',
        borderRadius: '1.5rem',
        padding: '16px 20px',
        boxShadow: '0 24px 56px -8px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.12)',
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        minWidth: 320,
      }} className="toast-pop-in-bottom">
        <span className="material-symbols-outlined shrink-0" style={{ fontSize: 24, color: '#adee2b' }}>check_circle</span>
        <span className="text-white text-[13px] font-black flex-1">{toast}</span>
      </div>
    </div>,
    document.body
  )

  return (
    <SeriesProgressContext.Provider value={{ active, progress, result, activeInstanceId, startSeriesProgress, updateSeriesProgress, finishSeriesProgress, doneSeriesProgress, reportPanelOpen }}>
      {children}
      {widget}
      {toastUI}
    </SeriesProgressContext.Provider>
  )
}

export function useSeriesProgress() {
  const ctx = useContext(SeriesProgressContext)
  if (!ctx) throw new Error('useSeriesProgress must be used within SeriesProgressProvider')
  return ctx
}
