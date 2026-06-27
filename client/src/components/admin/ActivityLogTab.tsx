import { useState } from 'react'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { getActivityLogs, type ActivityLog } from '../../api/activityLogs'

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

export default function ActivityLogTab() {
  const [category, setCategory] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)

  const { data, isLoading } = useQuery({
    queryKey: ['activity-logs', category, search, page],
    queryFn: () => getActivityLogs({ category: category || undefined, q: search || undefined, page }),
    placeholderData: keepPreviousData,
  })

  const logs = data?.data ?? []
  const meta = data?.meta

  return (
    <div className="max-w-3xl">
      {/* Header */}
      <div className="mb-5">
        <h2 className="text-xl font-black text-[var(--ds-text-1)]">Activity Log</h2>
        <p className="text-[12px] text-[var(--ds-text-3)] mt-1">Audit trail of important admin actions — cancellations, role changes, user & settings changes, and data exports.</p>
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
      </div>

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

      {/* Pagination */}
      {meta && meta.last_page > 1 && (
        <div className="flex items-center justify-center gap-3 mt-5">
          <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}
            className="px-3 py-1.5 rounded-lg text-[11px] font-black bg-[var(--ds-bg-raised)] border border-[var(--ds-border)] text-[var(--ds-text-2)] disabled:opacity-40 hover:text-[var(--ds-text-1)] transition-colors">
            ← Prev
          </button>
          <span className="text-[11px] font-bold text-[var(--ds-text-3)]">Page {meta.current_page} of {meta.last_page} · {meta.total} entries</span>
          <button disabled={page >= meta.last_page} onClick={() => setPage(p => p + 1)}
            className="px-3 py-1.5 rounded-lg text-[11px] font-black bg-[var(--ds-bg-raised)] border border-[var(--ds-border)] text-[var(--ds-text-2)] disabled:opacity-40 hover:text-[var(--ds-text-1)] transition-colors">
            Next →
          </button>
        </div>
      )}
    </div>
  )
}
