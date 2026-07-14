import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { Booking } from '../../types/index'
import { parseLocal } from '../../utils/date'
import { getDisputes, resolveDispute } from '../../api/bookings'
import UserAvatar from '../ui/UserAvatar'

function DisputesTab() {
  const qc = useQueryClient()
  const [statusFilter, setStatusFilter] = useState<'pending' | 'resolved'>('pending')
  const [resolvingId, setResolvingId] = useState<number | null>(null)

  const { data: disputes = [], isLoading } = useQuery<Booking[]>({
    queryKey: ['disputes', statusFilter],
    queryFn: () => getDisputes(statusFilter),
    staleTime: 30_000,
  })

  function fmtDt(s: string) {
    const d = parseLocal(s)
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) + ' ' +
      d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  }
  function fmtTime(s: string) { return parseLocal(s).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) }

  async function handleResolve(b: Booking, action: 'approve' | 'reject') {
    setResolvingId(b.id)
    try {
      await resolveDispute(b.id, action)
      qc.invalidateQueries({ queryKey: ['disputes'] })
    } catch { /* ignore */ }
    finally { setResolvingId(null) }
  }

  return (
    <div className="max-w-3xl space-y-6">
      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <p className="text-[9px] font-black uppercase tracking-[0.25em] text-[var(--ds-text-3)] mb-1">Auto-Release</p>
          <h1 className="text-3xl font-black italic tracking-tighter uppercase text-[var(--ds-text-1)]">Disputes</h1>
        </div>
        {/* Filter pills */}
        <div className="flex gap-2">
          {(['pending', 'resolved'] as const).map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className="px-4 py-2 rounded-2xl text-[10px] font-black uppercase tracking-wide transition-all"
              style={statusFilter === s
                ? { background: '#adee2b', color: '#000' }
                : { background: 'var(--ds-bg-surface)', border: '1px solid var(--ds-border)', color: 'var(--ds-text-2)' }}>
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Info */}
      {statusFilter === 'pending' && (
        <div className="p-3.5 rounded-xl text-[10px] font-semibold leading-relaxed" style={{ background: 'rgba(249,115,22,0.06)', border: '1px solid rgba(249,115,22,0.2)', color: '#ea580c' }}>
          <span className="font-black">Approve</span> to reinstate the booking (status → confirmed). <span className="font-black">Reject</span> to confirm the auto-release stands.
        </div>
      )}

      {/* List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="size-8 border-2 border-[var(--ds-border)] border-t-[#adee2b] rounded-full animate-spin" />
        </div>
      ) : disputes.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
          <span className="material-symbols-outlined text-[var(--ds-text-4)]" style={{ fontSize: 48 }}>gavel</span>
          <p className="text-[11px] font-black uppercase tracking-wider text-[var(--ds-text-4)]">
            {statusFilter === 'pending' ? 'No pending disputes' : 'No resolved disputes'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {disputes.map((b) => {
            const isPending   = b.dispute_status === 'pending'
            const isApproved  = b.dispute_status === 'approved'
            const resolving   = resolvingId === b.id

            return (
              <div key={b.id} className="rounded-2xl p-5 space-y-4 transition-all"
                style={{ background: 'var(--ds-bg-surface)', border: '1px solid var(--ds-border-sub)' }}>

                {/* Top row: user + booking info */}
                <div className="flex items-start gap-4">
                  <UserAvatar name={b.user?.name ?? '?'} avatar={b.user?.avatar} size={38} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <p className="text-[13px] font-black text-[var(--ds-text-1)]">{b.user?.name ?? 'Unknown User'}</p>
                      <span className="text-[9px] font-bold text-[var(--ds-text-4)]">{b.user?.email}</span>
                    </div>
                    <p className="text-[12px] font-black uppercase tracking-tight text-[var(--ds-text-1)]">{b.title}</p>
                    <div className="flex items-center gap-3 mt-1 flex-wrap">
                      <span className="flex items-center gap-1 text-[10px] font-bold text-[var(--ds-text-3)]">
                        <span className="material-symbols-outlined" style={{ fontSize: 12 }}>meeting_room</span>
                        {b.room?.name}{b.room?.building ? ` · ${b.room.building.code ?? b.room.building.name}` : ''}
                      </span>
                      <span className="flex items-center gap-1 text-[10px] font-bold text-[var(--ds-text-3)]">
                        <span className="material-symbols-outlined" style={{ fontSize: 12 }}>schedule</span>
                        {b.start_at ? fmtDt(b.start_at).split(' ').slice(0, 3).join(' ') : ''} · {b.start_at ? fmtTime(b.start_at) : ''}–{b.end_at ? fmtTime(b.end_at) : ''}
                      </span>
                    </div>
                  </div>

                  {/* Status badge */}
                  <div className="shrink-0">
                    {isPending && (
                      <span className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[9px] font-black uppercase bg-orange-500/15 text-orange-600 dark:text-orange-400">
                        <span className="material-symbols-outlined" style={{ fontSize: 10 }}>hourglass_top</span>Pending
                      </span>
                    )}
                    {isApproved && (
                      <span className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[9px] font-black uppercase bg-green-500/15 text-green-600 dark:text-green-400">
                        <span className="material-symbols-outlined" style={{ fontSize: 10 }}>check_circle</span>Approved
                      </span>
                    )}
                    {b.dispute_status === 'rejected' && (
                      <span className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[9px] font-black uppercase bg-red-500/15 text-red-500">
                        <span className="material-symbols-outlined" style={{ fontSize: 10 }}>cancel</span>Rejected
                      </span>
                    )}
                  </div>
                </div>

                {/* User note */}
                {b.dispute_note ? (
                  <div className="px-4 py-3 rounded-xl" style={{ background: 'var(--ds-bg-raised)', border: '1px solid var(--ds-border-sub)' }}>
                    <p className="text-[9px] font-black uppercase tracking-wider text-[var(--ds-text-4)] mb-1">User's note</p>
                    <p className="text-[11px] font-medium text-[var(--ds-text-2)] leading-relaxed">{b.dispute_note}</p>
                  </div>
                ) : (
                  <p className="text-[10px] font-medium text-[var(--ds-text-4)] italic">No note provided</p>
                )}

                {/* Meta */}
                <div className="flex items-center gap-4 text-[9px] font-bold text-[var(--ds-text-4)]">
                  <span>Disputed: {b.disputed_at ? fmtDt(b.disputed_at) : '—'}</span>
                  {b.dispute_resolved_at && <span>Resolved: {fmtDt(b.dispute_resolved_at)}</span>}
                </div>

                {/* Actions — only for pending */}
                {isPending && (
                  <div className="flex gap-3 pt-1">
                    <button onClick={() => handleResolve(b, 'approve')} disabled={resolving}
                      className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-wide transition-all disabled:opacity-50 hover:opacity-80"
                      style={{ background: '#adee2b', color: '#000' }}>
                      <span className="material-symbols-outlined" style={{ fontSize: 14 }}>check_circle</span>
                      {resolving ? '…' : 'Approve — Reinstate'}
                    </button>
                    <button onClick={() => handleResolve(b, 'reject')} disabled={resolving}
                      className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-wide transition-all disabled:opacity-50 hover:opacity-80"
                      style={{ background: 'rgba(239,68,68,0.12)', border: '1.5px solid rgba(239,68,68,0.3)', color: '#ef4444' }}>
                      <span className="material-symbols-outlined" style={{ fontSize: 14 }}>cancel</span>
                      {resolving ? '…' : 'Reject'}
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export { DisputesTab as default }
