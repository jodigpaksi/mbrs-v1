import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import type { Department, Location } from '../../../types/index'
import { createDepartment, updateDepartment, deleteDepartment } from '../../../api/departments'

function DepartmentsSection({ departments, locations, qc }: {
  departments: Department[]
  locations: Location[]
  qc: ReturnType<typeof useQueryClient>
}) {
  const [collapsed, setCollapsed]   = useState(true)
  const [addName, setAddName]       = useState('')
  const [addCode, setAddCode]       = useState('')
  const [addLocId, setAddLocId]     = useState<number | null>(null)
  const [addSaving, setAddSaving]   = useState(false)
  const [addErr, setAddErr]         = useState('')
  const [editId, setEditId]         = useState<number | null>(null)
  const [editName, setEditName]     = useState('')
  const [editCode, setEditCode]     = useState('')
  const [editLocId, setEditLocId]   = useState<number | null>(null)
  const [editSaving, setEditSaving] = useState(false)
  const [editErr, setEditErr]       = useState('')
  const [delErr, setDelErr]         = useState('')

  async function handleAdd() {
    if (!addName.trim()) { setAddErr('Name is required'); return }
    setAddSaving(true); setAddErr('')
    try {
      await createDepartment({ name: addName.trim(), code: addCode.trim() || undefined, location_id: addLocId })
      qc.invalidateQueries({ queryKey: ['departments'] })
      setAddName(''); setAddCode(''); setAddLocId(null)
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
      setAddErr(msg ?? 'Failed to create department.')
    } finally { setAddSaving(false) }
  }

  function openEdit(d: Department) {
    setEditId(d.id); setEditName(d.name); setEditCode(d.code ?? ''); setEditLocId(d.location_id ?? null); setEditErr('')
  }

  async function handleEdit() {
    if (!editId || !editName.trim()) return
    setEditSaving(true); setEditErr('')
    try {
      await updateDepartment(editId, { name: editName.trim(), code: editCode.trim() || null, location_id: editLocId })
      qc.invalidateQueries({ queryKey: ['departments'] })
      setEditId(null)
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
      setEditErr(msg ?? 'Failed to update.')
    } finally { setEditSaving(false) }
  }

  async function handleDelete(d: Department) {
    setDelErr('')
    try {
      await deleteDepartment(d.id)
      qc.invalidateQueries({ queryKey: ['departments'] })
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
      setDelErr(msg ?? 'Failed to delete department.')
    }
  }

  const inputCls = 'border border-[var(--ds-border)] rounded-xl px-3 py-2 text-[11px] font-bold focus:outline-none focus:ring-2 focus:ring-[#adee2b] bg-[var(--ds-bg-surface)] text-[var(--ds-text-1)]'
  const selectCls = `${inputCls} cursor-pointer`

  return (
    <div className="bg-[var(--ds-bg-surface)] rounded-2xl border border-[var(--ds-border-sub)] overflow-hidden">
      <button onClick={() => setCollapsed(v => !v)}
        className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-[var(--ds-bg-raised)] transition-colors text-left">
        <span className="material-symbols-outlined text-[var(--ds-text-3)]" style={{ fontSize: 16 }}>corporate_fare</span>
        <span className="flex-1 text-[10px] font-black uppercase tracking-wider text-[var(--ds-text-1)]">Departments</span>
        <span className="text-[9px] text-[var(--ds-text-3)] font-bold">{departments.length} dept{departments.length !== 1 ? 's' : ''}</span>
        <span className="material-symbols-outlined text-[var(--ds-text-3)]" style={{ fontSize: 16 }}>{collapsed ? 'expand_more' : 'expand_less'}</span>
      </button>

      {!collapsed && (
        <div className="border-t border-[var(--ds-border-sub)] px-5 py-4 space-y-3">
          {delErr && (
            <div className="flex items-center gap-2 text-[11px] font-bold px-3 py-2 rounded-xl" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171' }}>
              <span className="material-symbols-outlined shrink-0" style={{ fontSize: 13 }}>error</span>{delErr}
            </div>
          )}

          {/* List */}
          {departments.length > 0 && (
            <div className="space-y-1">
              {departments.map(d => (
                <div key={d.id}>
                  {editId === d.id ? (
                    <div className="flex items-center gap-2 bg-[var(--ds-bg-raised)] rounded-xl px-3 py-2 flex-wrap">
                      <input value={editName} onChange={e => setEditName(e.target.value)} placeholder="Name"
                        className={`flex-1 min-w-[120px] ${inputCls}`} />
                      <input value={editCode} onChange={e => setEditCode(e.target.value)} placeholder="Code" style={{ width: 72 }}
                        className={inputCls} />
                      <select value={editLocId ?? ''} onChange={e => setEditLocId(e.target.value === '' ? null : Number(e.target.value))}
                        style={{ width: 130 }} className={selectCls}>
                        <option value="">No location</option>
                        {locations.map(l => <option key={l.id} value={l.id}>{l.name}{l.code ? ` (${l.code})` : ''}</option>)}
                      </select>
                      {editErr && <span className="text-[9px] text-red-500 font-bold">{editErr}</span>}
                      <button onClick={handleEdit} disabled={editSaving}
                        className="px-3 py-2 rounded-xl bg-black text-[#adee2b] text-[9px] font-black uppercase disabled:opacity-40">
                        {editSaving ? '...' : 'Save'}
                      </button>
                      <button onClick={() => setEditId(null)} className="px-3 py-2 rounded-xl bg-[var(--ds-bg-surface-2)] text-[var(--ds-text-2)] text-[9px] font-black uppercase">
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3 px-2 py-1.5 rounded-xl hover:bg-[var(--ds-bg-raised)] group">
                      <span className="flex-1 text-[12px] font-black text-[var(--ds-text-1)]">{d.name}</span>
                      {d.code && <span className="px-2 py-0.5 bg-[var(--ds-bg-surface-2)] text-[var(--ds-text-2)] rounded-lg text-[8px] font-black uppercase">{d.code}</span>}
                      {d.location && (
                        <span className="flex items-center gap-1 text-[9px] font-bold text-[var(--ds-text-3)]">
                          <span className="material-symbols-outlined" style={{ fontSize: 10 }}>location_on</span>
                          {d.location.name}{d.location.code ? ` (${d.location.code})` : ''}
                        </span>
                      )}
                      <span className="text-[9px] text-[var(--ds-text-3)] font-bold">{d.users_count ?? 0} user{(d.users_count ?? 0) !== 1 ? 's' : ''}</span>
                      <button onClick={() => openEdit(d)}
                        className="size-7 flex items-center justify-center rounded-lg text-[var(--ds-text-3)] hover:bg-[var(--ds-bg-surface-2)] hover:text-[var(--ds-text-1)] opacity-0 group-hover:opacity-100 transition-all">
                        <span className="material-symbols-outlined" style={{ fontSize: 13 }}>edit</span>
                      </button>
                      <button onClick={() => handleDelete(d)}
                        className="size-7 flex items-center justify-center rounded-lg text-[var(--ds-text-3)] hover:bg-red-500/10 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all">
                        <span className="material-symbols-outlined" style={{ fontSize: 13 }}>delete</span>
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Add row */}
          <div className="flex items-center gap-2 pt-1 flex-wrap">
            <input value={addName} onChange={e => setAddName(e.target.value)} placeholder="New department name"
              className={`flex-1 min-w-[140px] ${inputCls}`} onKeyDown={e => e.key === 'Enter' && handleAdd()} />
            <input value={addCode} onChange={e => setAddCode(e.target.value)} placeholder="Code" style={{ width: 80 }}
              className={inputCls} onKeyDown={e => e.key === 'Enter' && handleAdd()} />
            <select value={addLocId ?? ''} onChange={e => setAddLocId(e.target.value === '' ? null : Number(e.target.value))}
              style={{ width: 130 }} className={selectCls}>
              <option value="">No location</option>
              {locations.map(l => <option key={l.id} value={l.id}>{l.name}{l.code ? ` (${l.code})` : ''}</option>)}
            </select>
            {addErr && <span className="text-[9px] text-red-500 font-bold">{addErr}</span>}
            <button onClick={handleAdd} disabled={addSaving}
              className="flex items-center gap-1 px-3 py-2 rounded-xl bg-black text-[#adee2b] text-[9px] font-black uppercase disabled:opacity-40">
              <span className="material-symbols-outlined" style={{ fontSize: 13 }}>add</span>
              {addSaving ? 'Adding...' : 'Add'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export { DepartmentsSection as default }
