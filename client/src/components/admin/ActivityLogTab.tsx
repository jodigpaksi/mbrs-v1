import { useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { getActivityLogs, exportActivityLogs, clearAllActivityLogs, type ActivityLog } from '../../api/activityLogs'
import { useCancelToast } from '../../context/CancelToastContext'
import { useModalHotkeys } from '../../hooks/useModalHotkeys'

const CATEGORIES: { key: string; label: string }[] = [
  { key: '',         label: 'All' },
  { key: 'booking',  label: 'Bookings' },
  { key: 'user',     label: 'Users' },
  { key: 'settings', label: 'Settings' },
  { key: 'data',     label: 'Data' },
]

const CAT_META: Record<string, { icon: string; color: string; bg: string }> = {
  booking:  { icon: 'event',         color: '#3b82f6', bg: 'rgba(59,130,246,0.12)' },
  user:     { icon: 'person',        color: '#a855f7', bg: 'rgba(168,85,247,0.12)' },
  settings: { icon: 'tune',          color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
  data:     { icon: 'download',      color: '#ef4444', bg: 'rgba(239,68,68,0.12)' },
}

const PER_PAGE_OPTIONS = [25, 50, 100, 200, 500]

function fmtWhen(iso: string) {
  const d = new Date(iso.replace('Z', ''))
  const now = new Date()
  const diff = (now.getTime() - d.getTime()) / 1000
  let rel = ''
  if (diff < 60) rel = 'just now'
  else if (diff < 3600) rel = `${Math.floor(diff / 60)}m ago`
  else if (diff < 86400) rel = `${Math.floor(diff / 3600)}h ago`
  else if (diff < 604800) rel = `${Math.floor(diff / 86400)}d ago`
  const abs = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) + ', ' +
    d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  return { rel, abs }
}

function LogRow({ log }: { log: ActivityLog }) {
  const meta = CAT_META[log.category] ?? { icon: 'bolt', color: 'var(--ds-text-3)', bg: 'var(--ds-bg-raised)' }
  const when = fmtWhen(log.created_at)
  return (
    <div className="flex items-start gap-3 px-4 py-3 rounded-2xl border border-[var(--ds-border)] bg-[var(--ds-bg-surface)]">
      <div className="size-9 shrink-0 rounded-xl flex items-center justify-center" style={{ background: meta.bg }}>
        <span className="material-symbols-outlined" style={{ fontSize: 18, color: meta.color }}>{meta.icon}</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-bold text-[var(--ds-text-1)] leading-snug">{log.description}</p>
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          <span className="text-[10px] font-black uppercase tracking-wider" style={{ color: meta.color }}>{log.action.replace(/\./g, ' · ')}</span>
          <span className="text-[var(--ds-text-4)]">·</span>
          <span className="text-[11px] font-bold text-[var(--ds-text-3)]">
            {log.actor ? log.actor.name : 'System'}
          </span>
          {log.ip_address && (
            <>
              <span className="text-[var(--ds-text-4)]">·</span>
              <span className="text-[10px] font-mono text-[var(--ds-text-4)]">{log.ip_address}</span>
            </>
          )}
        </div>
      </div>
      <div className="shrink-0 text-right">
        <p className="text-[11px] font-black text-[var(--ds-text-2)]">{when.rel}</p>
        <p className="text-[10px] text-[var(--ds-text-4)] font-bold">{when.abs}</p>
      </div>
    </div>
  )
}

function PageButtons({ current, total, onChange }: { current: number; total: number; onChange: (p: number) => void }) {
  if (total <= 1) return null

  // Build page number sequence with ellipses
  const pages: (number | '...')[] = []
  const delta = 2
  const left  = Math.max(2, current - delta)
  const right = Math.min(total - 1, current + delta)

  pages.push(1)
  if (left > 2) pages.push('...')
  for (let i = left; i <= right; i++) pages.push(i)
  if (right < total - 1) pages.push('...')
  if (total > 1) pages.push(total)

  const btnBase = 'min-w-[32px] h-8 px-2 rounded-lg text-[11px] font-black transition-all'

  return (
    <div className="flex items-center gap-1 flex-wrap justify-center">
      <button disabled={current <= 1} onClick={() => onChange(current - 1)}
        className={`${btnBase} bg-[var(--ds-bg-raised)] border border-[var(--ds-border)] text-[var(--ds-text-2)] disabled:opacity-40 hover:text-[var(--ds-text-1)]`}>
        ←
      </button>
      {pages.map((p, i) =>
        p === '...'
          ? <span key={`e${i}`} className="text-[11px] text-[var(--ds-text-4)] px-1">…</span>
          : <button key={p} onClick={() => onChange(p as number)}
              className={`${btnBase} ${p === current
                ? 'bg-black text-[#adee2b]'
                : 'bg-[var(--ds-bg-raised)] border border-[var(--ds-border)] text-[var(--ds-text-2)] hover:text-[var(--ds-text-1)]'}`}>
              {p}
            </button>
      )}
      <button disabled={current >= total} onClick={() => onChange(current + 1)}
        className={`${btnBase} bg-[var(--ds-bg-raised)] border border-[var(--ds-border)] text-[var(--ds-text-2)] disabled:opacity-40 hover:text-[var(--ds-text-1)]`}>
        →
      </button>
    </div>
  )
}

export default function ActivityLogTab() {
  const queryClient = useQueryClient()
  const { addInfoToast } = useCancelToast()
  const [category, setCategory] = useState('')
  const [search, setSearch]     = useState('')
  const [page, setPage]         = useState(1)
  const [perPage, setPerPage]   = useState(25)
  const [exporting, setExporting]   = useState(false)
  const [exportOpen, setExportOpen] = useState(false)
  const exportRef = useRef<HTMLDivElement>(null)
  const [clearConfirm, setClearConfirm] = useState(false)
  const [clearInput, setClearInput]     = useState('')
  const [clearing, setClearing]         = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['activity-logs', category, search, page, perPage],
    queryFn: () => getActivityLogs({ category: category || undefined, q: search || undefined, page, per_page: perPage }),
    placeholderData: keepPreviousData,
  })

  async function doClearAll() {
    setClearing(true)
    try {
      const res = await clearAllActivityLogs()
      queryClient.invalidateQueries({ queryKey: ['activity-logs'] })
      addInfoToast(`${res.deleted} activity log entr${res.deleted !== 1 ? 'ies' : 'y'} deleted`)
      setClearConfirm(false)
      setClearInput('')
      setPage(1)
    } catch {
      addInfoToast('Clear failed', true)
    } finally {
      setClearing(false)
    }
  }

  useModalHotkeys(
    clearConfirm,
    clearInput === 'Delete all logs' ? doClearAll : undefined,
    () => setClearConfirm(false),
  )

  const logs = data?.data ?? []
  const meta = data?.meta

  function changePage(p: number) {
    setPage(p)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function handleExport(format: 'excel' | 'pdf' | 'txt') {
    setExportOpen(false)
    setExporting(true)
    try {
      await exportActivityLogs({ format, category: category || undefined, q: search || undefined })
    } catch { /* ignore */ }
    finally { setExporting(false) }
  }

  const selectCls = 'px-3 py-1.5 rounded-xl text-[11px] font-black bg-[var(--ds-bg-raised)] border border-[var(--ds-border)] text-[var(--ds-text-2)] focus:outline-none focus:ring-2 focus:ring-[#adee2b] cursor-pointer'

  return (
    <div className="max-w-3xl">
      {/* Header */}
      <div className="flex items-start justify-between mb-5 gap-4">
        <div>
          <h2 className="text-xl font-black text-[var(--ds-text-1)]">Activity Log</h2>
          <p className="text-[12px] text-[var(--ds-text-3)] mt-1">Audit trail of important admin actions — cancellations, role changes, user & settings changes, and data exports.</p>
        </div>
        {/* Export dropdown */}
        <div className="relative shrink-0" ref={exportRef}>
          <button
            onClick={() => setExportOpen(o => !o)}
            disabled={exporting}
            className="flex items-center gap-1.5 px-4 py-2 rounded-2xl text-[10px] font-black uppercase tracking-wide transition-all disabled:opacity-60"
            style={{ background: '#111827', color: '#adee2b' }}
          >
            {exporting
              ? <><span className="material-symbols-outlined animate-spin" style={{ fontSize: 13 }}>progress_activity</span>Exporting…</>
              : <><span className="material-symbols-outlined" style={{ fontSize: 13 }}>download</span>Export</>}
          </button>
          {exportOpen && (
            <div className="absolute right-0 top-full mt-1 z-50 rounded-2xl overflow-hidden shadow-xl"
              style={{ background: 'var(--ds-bg-surface)', border: '1px solid var(--ds-border)', minWidth: 160 }}>
              <button onClick={() => handleExport('excel')}
                className="flex items-center gap-2 w-full px-4 py-3 text-[11px] font-black uppercase tracking-wide text-left transition-colors hover:bg-[var(--ds-bg-raised)]"
                style={{ color: 'var(--ds-text-1)' }}>
                <span className="material-symbols-outlined" style={{ fontSize: 15, color: '#22c55e' }}>table</span>Excel (.xlsx)
              </button>
              <button onClick={() => handleExport('pdf')}
                className="flex items-center gap-2 w-full px-4 py-3 text-[11px] font-black uppercase tracking-wide text-left transition-colors hover:bg-[var(--ds-bg-raised)]"
                style={{ color: 'var(--ds-text-1)', borderTop: '1px solid var(--ds-border-sub)' }}>
                <span className="material-symbols-outlined" style={{ fontSize: 15, color: '#ef4444' }}>description</span>PDF
              </button>
              <button onClick={() => handleExport('txt')}
                className="flex items-center gap-2 w-full px-4 py-3 text-[11px] font-black uppercase tracking-wide text-left transition-colors hover:bg-[var(--ds-bg-raised)]"
                style={{ color: 'var(--ds-text-1)', borderTop: '1px solid var(--ds-border-sub)' }}>
                <span className="material-symbols-outlined" style={{ fontSize: 15, color: '#94a3b8' }}>text_snippet</span>Text (.txt)
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <div className="flex gap-1 p-1 rounded-xl bg-[var(--ds-bg-surface-2)]">
          {CATEGORIES.map(c => {
            const sel = category === c.key
            return (
              <button key={c.key} onClick={() => { setCategory(c.key); setPage(1) }}
                className="px-3 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-wide transition-all"
                style={{
                  background: sel ? 'var(--ds-bg-surface)' : 'transparent',
                  color: sel ? 'var(--ds-text-1)' : 'var(--ds-text-3)',
                  boxShadow: sel ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                }}>
                {c.label}
              </button>
            )
          })}
        </div>
        <div className="flex items-center gap-2 ml-auto min-w-[200px] flex-1 max-w-[280px] bg-[var(--ds-bg-raised)] border border-[var(--ds-border)] rounded-xl px-3 py-2">
          <span className="material-symbols-outlined text-[var(--ds-text-4)]" style={{ fontSize: 16 }}>search</span>
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} placeholder="Search…"
            className="flex-1 bg-transparent text-[12px] font-medium text-[var(--ds-text-1)] focus:outline-none placeholder:text-[var(--ds-text-4)]" />
        </div>
        <select value={perPage} onChange={e => { setPerPage(Number(e.target.value)); setPage(1) }} className={selectCls}>
          {PER_PAGE_OPTIONS.map(n => <option key={n} value={n}>{n} / page</option>)}
        </select>
      </div>

      {/* Top pagination */}
      {meta && meta.last_page > 1 && (
        <div className="mb-4">
          <PageButtons current={meta.current_page} total={meta.last_page} onChange={changePage} />
          <p className="text-center text-[10px] text-[var(--ds-text-4)] font-bold mt-1.5">
            {meta.total} entries · page {meta.current_page} of {meta.last_page}
          </p>
        </div>
      )}

      {/* List */}
      {isLoading && logs.length === 0 ? (
        <div className="flex items-center justify-center py-20">
          <span className="material-symbols-outlined animate-spin text-[var(--ds-text-4)]" style={{ fontSize: 28 }}>progress_activity</span>
        </div>
      ) : logs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3 rounded-3xl border border-dashed border-[var(--ds-border)]">
          <span className="material-symbols-outlined text-[var(--ds-text-4)]" style={{ fontSize: 40 }}>history</span>
          <p className="text-[12px] font-black text-[var(--ds-text-3)]">No activity yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {logs.map(l => <LogRow key={l.id} log={l} />)}
        </div>
      )}

      {/* Bottom pagination */}
      {meta && meta.last_page > 1 && (
        <div className="mt-5">
          <PageButtons current={meta.current_page} total={meta.last_page} onChange={changePage} />
          <p className="text-center text-[10px] text-[var(--ds-text-4)] font-bold mt-1.5">
            {meta.total} entries · page {meta.current_page} of {meta.last_page}
          </p>
        </div>
      )}

      {/* Danger Zone */}
      {!!meta?.total && (
        <div className="mt-6 rounded-2xl p-4 flex items-center justify-between gap-4" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)' }}>
          <div>
            <p className="text-[11px] font-black text-red-500 uppercase tracking-wider">Danger Zone</p>
            <p className="text-[10px] text-red-400 mt-0.5">Permanently delete all {meta.total} activity log entries.</p>
          </div>
          <button onClick={() => { setClearConfirm(true); setClearInput('') }}
            className="shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-red-300 bg-[var(--ds-bg-surface)] text-red-500 text-[10px] font-black uppercase hover:bg-red-100 transition-colors">
            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>delete_forever</span>
            Clear All
          </button>
        </div>
      )}

      {/* Clear all confirm modal */}
      {clearConfirm && createPortal(
        <div className="fixed inset-0 z-[1000] flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(16px)' }}
          onClick={() => setClearConfirm(false)}>
          <div className="w-[420px] rounded-[2rem] overflow-hidden shadow-2xl"
            style={{ background: 'var(--ds-bg-surface)', backdropFilter: 'blur(48px)', border: '1px solid rgba(128,128,128,0.15)' }}
            onClick={e => e.stopPropagation()}>
            <div className="px-7 pt-7 pb-5 border-b flex items-center gap-3" style={{ background: 'rgba(239,68,68,0.08)', borderColor: 'rgba(239,68,68,0.15)' }}>
              <div className="size-10 rounded-2xl bg-red-100 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-red-500" style={{ fontSize: 22 }}>delete_forever</span>
              </div>
              <div>
                <p className="text-base font-black text-[var(--ds-text-1)]">Clear All Activity Log</p>
                <p className="text-[11px] text-[var(--ds-text-2)]">This will permanently delete every log entry.</p>
              </div>
            </div>
            <div className="px-7 py-6 space-y-5">
              <p className="text-[12px] text-[var(--ds-text-2)] leading-relaxed">
                All <span className="font-black text-[var(--ds-text-1)]">{meta?.total ?? 0} activity log entries</span> will be permanently removed. This action <span className="font-black text-red-500">cannot be undone</span>.
              </p>
              <div className="space-y-1.5">
                <p className="text-[10px] font-black text-[var(--ds-text-2)] uppercase tracking-wider">Confirm action</p>
                <p className="text-[11px] text-[var(--ds-text-2)]">Type <span className="font-black text-red-500 font-mono">Delete all logs</span> to confirm</p>
                <input
                  type="text"
                  value={clearInput}
                  onChange={e => setClearInput(e.target.value)}
                  placeholder="Delete all logs"
                  autoFocus
                  className="w-full px-4 py-3 rounded-xl border border-[var(--ds-border)] text-[13px] font-semibold focus:outline-none focus:ring-2 focus:ring-red-300 focus:border-red-300 placeholder:text-[var(--ds-text-3)] bg-[var(--ds-bg-raised)] text-[var(--ds-text-1)]"
                />
              </div>
              <div className="flex gap-3 justify-end">
                <button onClick={() => setClearConfirm(false)}
                  className="px-5 py-2.5 rounded-xl border border-[var(--ds-border)] text-[var(--ds-text-2)] text-[11px] font-black uppercase hover:bg-[var(--ds-bg-raised)] transition-colors">
                  Cancel
                </button>
                <button onClick={doClearAll} disabled={clearInput !== 'Delete all logs' || clearing}
                  className="px-5 py-2.5 rounded-xl bg-red-500 text-white text-[11px] font-black uppercase hover:bg-red-600 disabled:opacity-40 transition-colors">
                  {clearing ? 'Deleting…' : 'Delete Permanently'}
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
