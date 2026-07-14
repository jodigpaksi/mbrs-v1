import { useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import { getArchive, runArchive, restoreBooking, restoreAllBookings, purgeArchive, importArchive } from '../../api/archive'
import type { ArchiveParams } from '../../api/archive'
import { loadXlsx } from '../../utils/lazyExport'
import { parseLocal } from '../../utils/date'
import UserAvatar from '../ui/UserAvatar'
import { useCancelToast } from '../../context/CancelToastContext'

function ArchiveTab() {
  const qc = useQueryClient()
  const { addInfoToast } = useCancelToast()
  const [params, setParams] = useState<ArchiveParams>({ page: 1 })
  const [search, setSearch] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo]   = useState('')
  const [purgeConfirm, setPurgeConfirm] = useState(false)
  const importRef = useRef<HTMLInputElement>(null)
  const searchDebounce = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const queryKey = ['archive', params]
  const { data, isFetching } = useQuery({
    queryKey,
    queryFn: () => getArchive(params),
    staleTime: 30_000,
  })

  function applyFilters(patch: Partial<ArchiveParams>) {
    setParams(prev => ({ ...prev, ...patch, page: 1 }))
  }

  function onSearchChange(v: string) {
    setSearch(v)
    clearTimeout(searchDebounce.current)
    searchDebounce.current = setTimeout(() => applyFilters({ search: v || undefined }), 400)
  }

  const { mutate: doRun, isPending: running } = useMutation({
    mutationFn: runArchive,
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['archive'] })
      addInfoToast(`Archived ${res.archived} booking${res.archived !== 1 ? 's' : ''}${res.purged ? `, purged ${res.purged}` : ''}`)
    },
  })

  const { mutate: doPurge, isPending: purging } = useMutation({
    mutationFn: purgeArchive,
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['archive'] })
      setPurgeConfirm(false)
      addInfoToast(`Purged ${res.deleted} booking${res.deleted !== 1 ? 's' : ''} from archive`)
    },
  })

  const [restoringId,  setRestoringId]  = useState<number | null>(null)
  const [restoringAll, setRestoringAll] = useState(false)
  async function doRestoreAll() {
    setRestoringAll(true)
    try {
      const res = await restoreAllBookings()
      qc.invalidateQueries({ queryKey: ['archive'] })
      qc.invalidateQueries({ queryKey: ['bookings'] })
      addInfoToast(`${res.restored} booking${res.restored !== 1 ? 's' : ''} restored`)
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
      addInfoToast('Restore all failed: ' + (msg ?? 'unknown error'), true)
    } finally {
      setRestoringAll(false)
    }
  }
  async function doRestore(id: number) {
    setRestoringId(id)
    try {
      await restoreBooking(id)
      qc.invalidateQueries({ queryKey: ['archive'] })
      qc.invalidateQueries({ queryKey: ['bookings'] })
      addInfoToast('Booking restored and active again')
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
      addInfoToast('Restore failed: ' + (msg ?? 'unknown error'), true)
    } finally {
      setRestoringId(null)
    }
  }

  const { mutate: doImport, isPending: importing } = useMutation({
    mutationFn: (file: File) => importArchive(file),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['archive'] })
      addInfoToast(`Imported ${res.created} booking${res.created !== 1 ? 's' : ''}${res.errors.length ? ` (${res.errors.length} errors)` : ''}`)
    },
  })

  function fmtDate(iso: string) {
    return parseLocal(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
  }
  function fmtTime(iso: string) {
    return parseLocal(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  }

  async function exportExcel() {
    if (!data?.data?.length) return
    const rows = data.data.map(b => ({
      Date: fmtDate(b.start_at as unknown as string),
      'Start': fmtTime(b.start_at as unknown as string),
      'End': fmtTime(b.end_at as unknown as string),
      Title: b.title,
      Room: b.room?.name ?? '',
      Building: (b.room as unknown as { building?: { name: string } })?.building?.name ?? '',
      User: b.user?.name ?? '',
      Status: b.status,
      'Archived At': b.archived_at ? fmtDate(b.archived_at as unknown as string) : '',
    }))
    const XLSX = await loadXlsx()
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Archive')
    XLSX.writeFile(wb, `bookings-archive-${new Date().toISOString().slice(0, 10)}.xlsx`)
  }

  function exportCsv() {
    if (!data?.data?.length) return
    const rows = data.data
    const cols = ['Date', 'Start', 'End', 'Title', 'Room', 'User', 'Status', 'Archived At']
    const lines = [
      cols.join(','),
      ...rows.map(b => [
        fmtDate(b.start_at as unknown as string),
        fmtTime(b.start_at as unknown as string),
        fmtTime(b.end_at as unknown as string),
        `"${b.title}"`,
        `"${b.room?.name ?? ''}"`,
        `"${b.user?.name ?? ''}"`,
        b.status,
        b.archived_at ? fmtDate(b.archived_at as unknown as string) : '',
      ].join(',')),
    ]
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `bookings-archive-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const statusColor: Record<string, string> = {
    confirmed: 'bg-green-50 text-green-700',
    pending:   'bg-amber-50 text-amber-700',
    cancelled: 'bg-red-500/10 text-red-400',
    tentative: 'bg-blue-50 text-blue-600',
  }

  return (
    <div className="max-w-5xl space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <p className="text-[9px] font-black uppercase tracking-[0.25em] text-[var(--ds-text-3)] mb-1">Admin Dashboard</p>
          <h1 className="text-3xl font-black italic tracking-tighter uppercase">Archive</h1>
        </div>
        <div className="flex items-center gap-2">
          {/* icon-only utility buttons */}
          <button onClick={() => qc.invalidateQueries({ queryKey: ['archive'] })}
            title="Refresh" className="size-9 flex items-center justify-center rounded-xl border border-[var(--ds-border)] bg-[var(--ds-bg-surface)] text-[var(--ds-text-2)] hover:bg-[var(--ds-bg-raised)] transition-colors">
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>refresh</span>
          </button>

          <div className="w-px h-5 bg-[var(--ds-border)]" />

          {/* archive actions */}
          <button onClick={() => doRun()} disabled={running}
            className="flex items-center gap-1.5 px-3.5 h-9 rounded-xl border border-[var(--ds-border)] bg-[var(--ds-bg-surface)] text-[var(--ds-text-2)] text-[10px] font-black uppercase hover:bg-[var(--ds-bg-raised)] transition-colors disabled:opacity-40">
            <span className={`material-symbols-outlined ${running ? 'animate-spin' : ''}`} style={{ fontSize: 14 }}>sync</span>
            {running ? 'Running…' : 'Run Now'}
          </button>
          <button onClick={doRestoreAll} disabled={restoringAll || !data?.total}
            className="flex items-center gap-1.5 px-3.5 h-9 rounded-xl border border-[var(--ds-border)] bg-[var(--ds-bg-surface)] text-[var(--ds-text-2)] text-[10px] font-black uppercase hover:bg-[var(--ds-bg-raised)] transition-colors disabled:opacity-40">
            <span className={`material-symbols-outlined ${restoringAll ? 'animate-spin' : ''}`} style={{ fontSize: 14 }}>restore</span>
            {restoringAll ? 'Restoring…' : 'Restore All'}
          </button>

          <div className="w-px h-5 bg-[var(--ds-border)]" />

          {/* import / export */}
          <button onClick={() => importRef.current?.click()} disabled={importing}
            className="flex items-center gap-1.5 px-3.5 h-9 rounded-xl border border-[var(--ds-border)] bg-[var(--ds-bg-surface)] text-[var(--ds-text-2)] text-[10px] font-black uppercase hover:bg-[var(--ds-bg-raised)] transition-colors disabled:opacity-40">
            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>upload_file</span>
            {importing ? 'Importing…' : 'Import'}
          </button>
          <input ref={importRef} type="file" accept=".xlsx,.xls,.csv" className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) { doImport(f); e.target.value = '' } }} />
          <button onClick={exportExcel} disabled={!data?.data?.length}
            className="flex items-center gap-1.5 px-3.5 h-9 rounded-xl border border-[var(--ds-border)] bg-[var(--ds-bg-surface)] text-[var(--ds-text-2)] text-[10px] font-black uppercase hover:bg-[var(--ds-bg-raised)] transition-colors disabled:opacity-30">
            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>table_view</span>Excel
          </button>
          <button onClick={exportCsv} disabled={!data?.data?.length}
            className="flex items-center gap-1.5 px-3.5 h-9 rounded-xl border border-[var(--ds-border)] bg-[var(--ds-bg-surface)] text-[var(--ds-text-2)] text-[10px] font-black uppercase hover:bg-[var(--ds-bg-raised)] transition-colors disabled:opacity-30">
            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>csv</span>CSV
          </button>

          <div className="w-px h-5 bg-[var(--ds-border)]" />

          {/* destructive */}
          <button onClick={() => setPurgeConfirm(true)}
            className="flex items-center gap-1.5 px-3.5 h-9 rounded-xl text-red-400 text-[10px] font-black uppercase transition-colors" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }} onMouseEnter={e => (e.currentTarget.style.background='rgba(239,68,68,0.15)')} onMouseLeave={e => (e.currentTarget.style.background='rgba(239,68,68,0.08)')}>
            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>delete_sweep</span>Purge
          </button>
        </div>
      </div>

      {/* Stats */}
      {data && (
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-[var(--ds-bg-surface)] rounded-2xl border border-[var(--ds-border-sub)] p-5">
            <p className="text-[9px] font-black uppercase tracking-widest text-[var(--ds-text-3)] mb-1">Total Archived</p>
            <p className="text-3xl font-black text-[var(--ds-text-1)]">{data.total.toLocaleString()}</p>
            <p className="text-[12px] text-[var(--ds-text-3)] mt-0.5">bookings in archive</p>
          </div>
          <div className="bg-[var(--ds-bg-surface)] rounded-2xl border border-[var(--ds-border-sub)] p-5">
            <p className="text-[9px] font-black uppercase tracking-widest text-[var(--ds-text-3)] mb-1">Oldest Entry</p>
            <p className="text-xl font-black text-[var(--ds-text-1)]">{data.oldest ? fmtDate(data.oldest) : '—'}</p>
            <p className="text-[12px] text-[var(--ds-text-3)] mt-0.5">earliest archived booking</p>
          </div>
          <div className="bg-[var(--ds-bg-surface)] rounded-2xl border border-[var(--ds-border-sub)] p-5">
            <p className="text-[9px] font-black uppercase tracking-widest text-[var(--ds-text-3)] mb-1">Next Auto-Purge</p>
            <p className="text-xl font-black text-red-500">{data.purge_date ? fmtDate(data.purge_date) : '—'}</p>
            <p className="text-[12px] text-[var(--ds-text-3)] mt-0.5">oldest entry eligible</p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ds-text-3)]" style={{ fontSize: 16 }}>search</span>
          <input
            value={search} onChange={e => onSearchChange(e.target.value)}
            placeholder="Search title, room, user…"
            className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-[var(--ds-bg-surface)] border border-[var(--ds-border)] text-[12px] font-medium focus:ring-2 focus:ring-[#adee2b] focus:outline-none text-[var(--ds-text-1)]"
          />
        </div>
        <input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); applyFilters({ date_from: e.target.value || undefined }) }}
          className="px-3 py-2.5 rounded-xl bg-[var(--ds-bg-surface)] border border-[var(--ds-border)] text-[12px] font-medium focus:ring-2 focus:ring-[#adee2b] focus:outline-none text-[var(--ds-text-1)]" />
        <span className="text-[var(--ds-text-3)] font-black">→</span>
        <input type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); applyFilters({ date_to: e.target.value || undefined }) }}
          className="px-3 py-2.5 rounded-xl bg-[var(--ds-bg-surface)] border border-[var(--ds-border)] text-[12px] font-medium focus:ring-2 focus:ring-[#adee2b] focus:outline-none text-[var(--ds-text-1)]" />
        {(search || dateFrom || dateTo) && (
          <button onClick={() => { setSearch(''); setDateFrom(''); setDateTo(''); setParams({ page: 1 }) }}
            className="text-[10px] font-black text-[var(--ds-text-3)] hover:text-[var(--ds-text-1)] uppercase tracking-wider px-2">
            Clear
          </button>
        )}
      </div>

      {/* Table */}
      <div className="bg-[var(--ds-bg-surface)] rounded-2xl border border-[var(--ds-border-sub)] overflow-hidden">
        {isFetching && <div className="h-1 bg-[#adee2b] animate-pulse" />}
        <table className="w-full">
          <thead>
            <tr className="border-b border-[var(--ds-border-sub)]">
              {['Date', 'Time', 'Title', 'Room', 'User', 'Status', 'Archived', ''].map(h => (
                <th key={h} className="px-5 py-3 text-left text-[8px] font-black uppercase text-[var(--ds-text-3)] tracking-widest">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {!data?.data?.length && !isFetching && (
              <tr><td colSpan={8} className="px-5 py-12 text-center text-[var(--ds-text-3)] text-sm font-bold">No archived bookings found.</td></tr>
            )}
            {data?.data?.map(b => (
              <tr key={b.id} className="border-b border-[var(--ds-border-sub)] hover:bg-[var(--ds-bg-raised)] transition-colors">
                <td className="px-5 py-3 text-xs font-bold text-[var(--ds-text-1)] whitespace-nowrap">
                  {fmtDate(b.start_at as unknown as string)}
                </td>
                <td className="px-5 py-3 text-xs text-[var(--ds-text-2)] whitespace-nowrap tabular-nums">
                  {fmtTime(b.start_at as unknown as string)} – {fmtTime(b.end_at as unknown as string)}
                </td>
                <td className="px-5 py-3 max-w-[160px]">
                  <p className="text-xs font-bold text-[var(--ds-text-1)] truncate">{b.title}</p>
                  {b.description && <p className="text-[10px] text-[var(--ds-text-3)] truncate">{b.description}</p>}
                </td>
                <td className="px-5 py-3 text-xs text-[var(--ds-text-2)]">{b.room?.name ?? '—'}</td>
                <td className="px-5 py-3">
                  <div className="flex items-center gap-2">
                    <UserAvatar name={b.user?.name ?? '?'} avatar={b.user?.avatar} size={24} />
                    <span className="text-xs text-[var(--ds-text-2)] truncate">{b.user?.name ?? '—'}</span>
                  </div>
                </td>
                <td className="px-5 py-3">
                  <span className={`text-[9px] font-black px-2 py-0.5 rounded-full ${statusColor[b.status] ?? 'bg-[var(--ds-bg-surface-2)] text-[var(--ds-text-2)]'}`}>
                    {b.status}
                  </span>
                </td>
                <td className="px-5 py-3 text-[10px] text-[var(--ds-text-3)] whitespace-nowrap">
                  {b.archived_at ? fmtDate(b.archived_at) : '—'}
                </td>
                <td className="px-3 py-3">
                  <button
                    onClick={() => doRestore(b.id)}
                    disabled={restoringId === b.id}
                    title="Restore to active"
                    className="size-8 flex items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20 disabled:opacity-40 transition-all"
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 15 }}>restore</span>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Pagination */}
        {data && data.last_page > 1 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-[var(--ds-border-sub)]">
            <p className="text-[10px] text-[var(--ds-text-3)] font-bold">Page {data.page} of {data.last_page}</p>
            <div className="flex gap-2">
              <button onClick={() => setParams(p => ({ ...p, page: (p.page ?? 1) - 1 }))} disabled={(params.page ?? 1) <= 1}
                className="size-8 flex items-center justify-center rounded-lg bg-[var(--ds-bg-surface-2)] text-[var(--ds-text-2)] hover:bg-black hover:text-[#adee2b] disabled:opacity-30 transition-all">
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>chevron_left</span>
              </button>
              <button onClick={() => setParams(p => ({ ...p, page: (p.page ?? 1) + 1 }))} disabled={(params.page ?? 1) >= data.last_page}
                className="size-8 flex items-center justify-center rounded-lg bg-[var(--ds-bg-surface-2)] text-[var(--ds-text-2)] hover:bg-black hover:text-[#adee2b] disabled:opacity-30 transition-all">
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>chevron_right</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Purge confirm modal */}
      {purgeConfirm && createPortal(
        <div className="fixed inset-0 z-[1000] flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(16px)' }}
          onClick={() => setPurgeConfirm(false)}>
          <div className="w-[400px] rounded-[2rem] overflow-hidden shadow-2xl"
            style={{ background: 'var(--ds-bg-surface)', backdropFilter: 'blur(48px)', border: '1px solid rgba(128,128,128,0.15)' }}
            onClick={e => e.stopPropagation()}>
            <div className="px-7 pt-7 pb-5 border-b flex items-center gap-3" style={{ background: 'rgba(239,68,68,0.08)', borderColor: 'rgba(239,68,68,0.15)' }}>
              <div className="size-10 rounded-2xl bg-red-100 flex items-center justify-center">
                <span className="material-symbols-outlined text-red-500" style={{ fontSize: 22 }}>delete_forever</span>
              </div>
              <div>
                <p className="text-base font-black text-[var(--ds-text-1)]">Purge Archive</p>
                <p className="text-[11px] text-[var(--ds-text-2)]">This will permanently delete eligible archived bookings.</p>
              </div>
            </div>
            <div className="px-7 py-5 space-y-4">
              <p className="text-[12px] text-[var(--ds-text-2)] leading-relaxed">
                All <span className="font-black text-[var(--ds-text-1)]">{data?.total} archived booking{(data?.total ?? 0) !== 1 ? 's' : ''}</span> will be permanently deleted. This action cannot be undone.
              </p>
              <div className="flex gap-3 justify-end">
                <button onClick={() => setPurgeConfirm(false)}
                  className="px-4 py-2 rounded-xl border border-[var(--ds-border)] text-[var(--ds-text-2)] text-[10px] font-black uppercase hover:bg-[var(--ds-bg-raised)] transition-colors">
                  Cancel
                </button>
                <button onClick={() => doPurge()} disabled={purging}
                  className="px-4 py-2 rounded-xl bg-red-500 text-white text-[10px] font-black uppercase hover:bg-red-600 transition-colors disabled:opacity-50">
                  {purging ? 'Purging…' : 'Purge Now'}
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

export { ArchiveTab as default }
