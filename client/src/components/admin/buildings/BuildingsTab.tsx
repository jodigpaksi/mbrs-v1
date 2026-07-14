import { useState, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { Building, Location, Room } from '../../../types/index'
import { useModalHotkeys } from '../../../hooks/useModalHotkeys'
import { getBuildings, createBuilding, updateBuilding, deleteBuilding, importBuildings } from '../../../api/buildings'
import { getRooms, createRoom, updateRoom, deleteRoom, importRooms } from '../../../api/rooms'
import { getLocations, createLocation, updateLocation, deleteLocation } from '../../../api/locations'
import { getGeneralSettings } from '../../../api/settings'
import { useAuth } from '../../../context/AuthContext'
import { ModalPortal } from '../shared'
import RoomModal, { RoomList } from './RoomModal'
import BuildingImportExportModal from './BuildingImportExportModal'
import RoomImportExportModal from './RoomImportExportModal'

function BuildingModal({
  initial, locations, onSave, onClose,
}: {
  initial?: Partial<Building>
  locations: Location[]
  onSave: (data: Partial<Building>) => Promise<void>
  onClose: () => void
}) {
  const [name, setName] = useState(initial?.name ?? '')
  const [code, setCode] = useState(initial?.code ?? '')
  const [address, setAddress] = useState(initial?.address ?? '')
  const [locationId, setLocationId] = useState<number | ''>(initial?.location_id ?? '')
  const [floors, setFloors] = useState(String(initial?.floors ?? 1))
  const [notes, setNotes] = useState(initial?.notes ?? '')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  async function handleSave() {
    if (!name.trim()) { setErr('Name is required'); return }
    setSaving(true); setErr('')
    try {
      await onSave({
        name: name.trim(),
        code: code.trim() || undefined,
        address: address.trim() || undefined,
        location_id: locationId !== '' ? locationId : undefined,
        floors: Number(floors) || 1,
        notes: notes.trim() || undefined,
      })
      onClose()
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string; errors?: { name?: string[] } } } })?.response?.data?.errors?.name?.[0]
        ?? (e as { response?: { data?: { message?: string } } })?.response?.data?.message
      setErr(msg || 'Failed to save building.')
    } finally { setSaving(false) }
  }

  useModalHotkeys(true, handleSave, onClose)

  return (
    <ModalPortal>
    <div className="fixed inset-0 z-[1000] flex items-center justify-center admin-backdrop-in" style={{ background: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(12px)' }} onClick={onClose}>
      <div className="bg-[var(--ds-bg-surface)] rounded-3xl shadow-2xl w-[440px] p-7 space-y-4 admin-modal-in" onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-black uppercase tracking-tight text-[var(--ds-text-1)]">{initial?.id ? 'Edit Building' : 'Add Building'}</h3>
        {err && <p className="text-xs text-red-500 font-bold">{err}</p>}

        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2 space-y-1">
            <label className="text-[9px] font-black uppercase text-[var(--ds-text-3)] tracking-wider">Name *</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Main Building"
              className="w-full border border-[var(--ds-border)] rounded-xl px-3 py-2 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-[#adee2b] bg-[var(--ds-bg-surface)] text-[var(--ds-text-1)]" />
          </div>
          <div className="space-y-1">
            <label className="text-[9px] font-black uppercase text-[var(--ds-text-3)] tracking-wider">Code</label>
            <input value={code} onChange={e => setCode(e.target.value)} placeholder="e.g. GU"
              className="w-full border border-[var(--ds-border)] rounded-xl px-3 py-2 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-[#adee2b] bg-[var(--ds-bg-surface)] text-[var(--ds-text-1)]" />
          </div>
          <div className="space-y-1">
            <label className="text-[9px] font-black uppercase text-[var(--ds-text-3)] tracking-wider">Floors</label>
            <input type="number" min={1} value={floors} onChange={e => setFloors(e.target.value)}
              className="w-full border border-[var(--ds-border)] rounded-xl px-3 py-2 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-[#adee2b] bg-[var(--ds-bg-surface)] text-[var(--ds-text-1)]" />
          </div>
          <div className="col-span-2 space-y-1">
            <label className="text-[9px] font-black uppercase text-[var(--ds-text-3)] tracking-wider">City / Location</label>
            <select value={locationId} onChange={e => setLocationId(e.target.value ? Number(e.target.value) : '')}
              className="w-full border border-[var(--ds-border)] rounded-xl px-3 py-2 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-[#adee2b] bg-[var(--ds-bg-surface)] text-[var(--ds-text-1)]">
              <option value="">— No city assigned —</option>
              {locations.map(loc => (
                <option key={loc.id} value={loc.id}>{loc.name}{loc.code ? ` (${loc.code})` : ''}</option>
              ))}
            </select>
          </div>
          <div className="col-span-2 space-y-1">
            <label className="text-[9px] font-black uppercase text-[var(--ds-text-3)] tracking-wider">Address</label>
            <input value={address} onChange={e => setAddress(e.target.value)} placeholder="e.g. 123 Main Street"
              className="w-full border border-[var(--ds-border)] rounded-xl px-3 py-2 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-[#adee2b] bg-[var(--ds-bg-surface)] text-[var(--ds-text-1)]" />
          </div>
          <div className="col-span-2 space-y-1">
            <label className="text-[9px] font-black uppercase text-[var(--ds-text-3)] tracking-wider">Notes</label>
            <textarea rows={2} value={notes} onChange={e => setNotes(e.target.value)}
              className="w-full border border-[var(--ds-border)] rounded-xl px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#adee2b] resize-none bg-[var(--ds-bg-surface)] text-[var(--ds-text-1)]" />
          </div>
        </div>

        <div className="flex gap-3 pt-1">
          <button onClick={onClose} className="flex-1 py-3 rounded-2xl bg-[var(--ds-bg-surface-2)] text-[var(--ds-text-2)] text-[10px] font-black uppercase hover:bg-[var(--ds-bg-raised)] transition-colors">Cancel</button>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 py-3 rounded-2xl bg-black text-[#adee2b] text-[10px] font-black uppercase hover:bg-slate-800 transition-colors disabled:opacity-40">
            {saving ? 'Saving...' : 'Save Building'}
          </button>
        </div>
      </div>
    </div>
    </ModalPortal>
  )
}

function LocationsSection() {
  const qc = useQueryClient()
  const { data: locations = [] } = useQuery<Location[]>({ queryKey: ['locations'], queryFn: getLocations })
  const [modal, setModal] = useState<{ open: boolean; initial?: Location } | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Location | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteErr, setDeleteErr] = useState('')
  const [deleteLocConfirm, setDeleteLocConfirm] = useState('')

  async function handleSave(data: { name: string; code: string }) {
    if (modal?.initial?.id) {
      await updateLocation(modal.initial.id, data)
    } else {
      await createLocation(data)
    }
    qc.invalidateQueries({ queryKey: ['locations'] })
    qc.invalidateQueries({ queryKey: ['buildings'] })
    setModal(null)
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true); setDeleteErr('')
    try {
      await deleteLocation(deleteTarget.id)
      qc.invalidateQueries({ queryKey: ['locations'] })
      qc.invalidateQueries({ queryKey: ['buildings'] })
      setDeleteTarget(null)
    } catch { setDeleteErr('Cannot delete — buildings may still reference this city.') }
    finally { setDeleting(false) }
  }

  useModalHotkeys(
    !!deleteTarget,
    deleteTarget && deleteLocConfirm === deleteTarget.name ? handleDelete : undefined,
    () => { setDeleteTarget(null); setDeleteLocConfirm('') },
  )

  return (
    <div className="bg-[var(--ds-bg-surface)] rounded-2xl border border-[var(--ds-border-sub)] p-5 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[9px] font-black uppercase tracking-[0.25em] text-[var(--ds-text-3)]">Cities / Areas</p>
          <p className="text-xs text-[var(--ds-text-2)] font-medium mt-0.5">Top-level geographic anchors for buildings</p>
        </div>
        <button
          onClick={() => setModal({ open: true })}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-black text-[#adee2b] text-[9px] font-black uppercase hover:bg-slate-800 transition-colors"
        >
          <span className="material-symbols-outlined" style={{ fontSize: 13 }}>add</span>
          Add City
        </button>
      </div>

      {locations.length === 0 ? (
        <p className="text-[11px] text-[var(--ds-text-3)] font-medium py-3">No cities yet.</p>
      ) : (
        <div className="grid grid-cols-3 gap-3">
          {locations.map(loc => (
            <div key={loc.id} className="flex items-center gap-3 px-4 py-3.5 rounded-2xl bg-[var(--ds-bg-raised)] border border-[var(--ds-border-sub)]">
              <div className="size-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'var(--ds-bg-surface)' }}>
                <span className="material-symbols-outlined text-[var(--ds-text-3)]" style={{ fontSize: 18 }}>location_city</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-black text-[var(--ds-text-1)] truncate">{loc.name}</p>
                <p className="text-[10px] text-[var(--ds-text-3)] font-bold uppercase tracking-wide">
                  {loc.code ? `${loc.code} · ` : ''}{loc.buildings_count ?? 0} building{(loc.buildings_count ?? 0) !== 1 ? 's' : ''}
                </p>
              </div>
              <div className="flex items-center gap-0.5">
                <button onClick={() => setModal({ open: true, initial: loc })}
                  className="size-7 flex items-center justify-center rounded-lg text-[var(--ds-text-3)] hover:bg-[var(--ds-bg-surface)] hover:text-[var(--ds-text-1)] transition-all">
                  <span className="material-symbols-outlined" style={{ fontSize: 15 }}>edit</span>
                </button>
                <button onClick={() => { setDeleteErr(''); setDeleteLocConfirm(''); setDeleteTarget(loc) }}
                  className="size-7 flex items-center justify-center rounded-lg text-[var(--ds-text-3)] hover:bg-red-500/10 hover:text-red-400 transition-all">
                  <span className="material-symbols-outlined" style={{ fontSize: 15 }}>delete</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Location modal */}
      {modal?.open && (
        <LocationModal
          initial={modal.initial}
          onSave={handleSave}
          onClose={() => setModal(null)}
        />
      )}

      {/* Delete city confirm */}
      {deleteTarget && (
        <ModalPortal>
        <div className="fixed inset-0 z-[1000] flex items-center justify-center admin-backdrop-in"
          style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(16px)' }}
          onClick={() => { setDeleteTarget(null); setDeleteLocConfirm('') }}>
          <div
            className="w-[400px] rounded-[2rem] shadow-2xl overflow-hidden admin-modal-in"
            style={{ background: 'var(--ds-bg-surface)', backdropFilter: 'blur(48px) saturate(200%)', border: '1px solid rgba(128,128,128,0.15)' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="px-7 pt-7 pb-5 border-b flex items-center gap-3" style={{ background: 'rgba(239,68,68,0.08)', borderColor: 'rgba(239,68,68,0.15)' }}>
              <div className="size-11 rounded-2xl flex items-center justify-center shrink-0" style={{ background: 'rgba(239,68,68,0.15)' }}>
                <span className="material-symbols-outlined text-red-500" style={{ fontSize: 22, fontVariationSettings: "'FILL' 1" }}>location_city</span>
              </div>
              <div>
                <p className="text-[9px] font-black uppercase tracking-[0.2em] text-red-500">Danger Zone</p>
                <h3 className="text-lg font-black text-[var(--ds-text-1)] uppercase tracking-tight mt-0.5">Delete City?</h3>
              </div>
            </div>
            <div className="px-7 py-5 space-y-4">
              <div className="bg-[var(--ds-bg-raised)] rounded-xl px-4 py-3 flex items-center gap-3">
                <span className="material-symbols-outlined text-[var(--ds-text-3)] shrink-0" style={{ fontSize: 20 }}>location_city</span>
                <div>
                  <p className="text-sm font-black text-[var(--ds-text-1)]">{deleteTarget.name}</p>
                  {deleteTarget.code && <p className="text-[10px] text-[var(--ds-text-3)] font-bold uppercase mt-0.5">{deleteTarget.code}</p>}
                </div>
              </div>
              <p className="text-[11px] text-[var(--ds-text-2)] font-medium leading-relaxed">
                Buildings assigned to this city will be unlinked but not deleted. <span className="font-black text-[var(--ds-text-1)]">This cannot be undone.</span>
              </p>
              <div className="space-y-1.5">
                <label className="text-[9px] font-black uppercase tracking-wider text-[var(--ds-text-3)] px-1">
                  Type <span className="normal-case text-[var(--ds-text-1)]">"{deleteTarget.name}"</span> to confirm
                </label>
                <input
                  value={deleteLocConfirm}
                  onChange={e => setDeleteLocConfirm(e.target.value)}
                  placeholder={deleteTarget.name}
                  autoFocus
                  className="w-full bg-[var(--ds-bg-raised)] border border-[var(--ds-border)] rounded-xl px-3 py-2.5 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-red-300 focus:border-transparent text-[var(--ds-text-1)]"
                />
              </div>
              {deleteErr && (
                <div className="flex items-center gap-2 text-[11px] font-bold px-3 py-2.5 rounded-xl" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171' }}>
                  <span className="material-symbols-outlined shrink-0" style={{ fontSize: 14 }}>error</span>{deleteErr}
                </div>
              )}
              <div className="flex gap-3 pt-1">
                <button onClick={() => { setDeleteTarget(null); setDeleteLocConfirm('') }}
                  className="flex-1 py-3.5 rounded-full text-[10px] font-black uppercase tracking-[0.15em] bg-[var(--ds-bg-surface-2)] text-[var(--ds-text-2)] hover:bg-[var(--ds-bg-raised)] transition-colors">Cancel</button>
                <button onClick={handleDelete} disabled={deleting || deleteLocConfirm !== deleteTarget.name}
                  className="flex-1 py-3.5 rounded-full text-[10px] font-black uppercase tracking-[0.15em] bg-red-500 text-white hover:bg-red-600 disabled:opacity-30 flex items-center justify-center gap-2 transition-all">
                  {deleting && <span className="material-symbols-outlined animate-spin" style={{ fontSize: 13 }}>progress_activity</span>}
                  {deleting ? 'Deleting...' : 'Delete City'}
                </button>
              </div>
            </div>
          </div>
        </div>
        </ModalPortal>
      )}
    </div>
  )
}

function LocationModal({ initial, onSave, onClose }: {
  initial?: Location
  onSave: (data: { name: string; code: string }) => Promise<void>
  onClose: () => void
}) {
  const [name, setName] = useState(initial?.name ?? '')
  const [code, setCode] = useState(initial?.code ?? '')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  async function handleSave() {
    if (!name.trim()) { setErr('Name is required'); return }
    setSaving(true); setErr('')
    try {
      await onSave({ name: name.trim(), code: code.trim() })
      onClose()
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string; errors?: { name?: string[] } } } })?.response?.data?.errors?.name?.[0]
        ?? (e as { response?: { data?: { message?: string } } })?.response?.data?.message
      setErr(msg || 'Failed to save.')
    } finally { setSaving(false) }
  }

  useModalHotkeys(true, handleSave, onClose)

  return (
    <ModalPortal>
    <div className="fixed inset-0 z-[1100] flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(12px)' }} onClick={onClose}>
      <div className="bg-[var(--ds-bg-surface)] rounded-3xl shadow-2xl w-[360px] p-7 space-y-4" onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-black uppercase tracking-tight text-[var(--ds-text-1)]">{initial?.id ? 'Edit City' : 'Add City'}</h3>
        {err && <p className="text-xs text-red-500 font-bold">{err}</p>}
        <div className="space-y-3">
          <div className="space-y-1">
            <label className="text-[9px] font-black uppercase text-[var(--ds-text-3)] tracking-wider">City / Area Name *</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Jakarta"
              className="w-full border border-[var(--ds-border)] rounded-xl px-3 py-2 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-[#adee2b] bg-[var(--ds-bg-surface)] text-[var(--ds-text-1)]" />
          </div>
          <div className="space-y-1">
            <label className="text-[9px] font-black uppercase text-[var(--ds-text-3)] tracking-wider">Code (optional)</label>
            <input value={code} onChange={e => setCode(e.target.value)} placeholder="e.g. JKT"
              className="w-full border border-[var(--ds-border)] rounded-xl px-3 py-2 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-[#adee2b] bg-[var(--ds-bg-surface)] text-[var(--ds-text-1)]" />
          </div>
        </div>
        <div className="flex gap-3 pt-1">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl bg-[var(--ds-bg-surface-2)] text-[var(--ds-text-2)] text-[10px] font-black uppercase hover:bg-[var(--ds-bg-raised)]">Cancel</button>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 py-2.5 rounded-xl bg-black text-[#adee2b] text-[10px] font-black uppercase hover:bg-slate-800 disabled:opacity-40">
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
    </ModalPortal>
  )
}

function BuildingsTab() {
  const qc = useQueryClient()
  const { user: currentUser } = useAuth()
  const isBuildingAdminUser = currentUser?.role === 'building_admin'
  const managedBuildingIds = new Set((currentUser?.buildings ?? []).map(b => b.id))
  const { data: allBuildings = [], isLoading } = useQuery({ queryKey: ['buildings'], queryFn: getBuildings })
  const buildings = isBuildingAdminUser ? (allBuildings as Building[]).filter(b => managedBuildingIds.has(b.id)) : (allBuildings as Building[])
  const { data: allRooms = [] } = useQuery({ queryKey: ['rooms'], queryFn: getRooms })
  const { data: locations = [] } = useQuery<Location[]>({ queryKey: ['locations'], queryFn: getLocations })
  const { data: bldgGeneral } = useQuery({ queryKey: ['settings-general'], queryFn: getGeneralSettings, staleTime: 60_000 })
  const sensorMode = (bldgGeneral?.anti_ghost_mode ?? '').split(',').includes('sensor')

  const [expanded, setExpanded] = useState<number | null>(null)
  const [buildingModal, setBuildingModal] = useState<{ open: boolean; initial?: Partial<Building> }>({ open: false })
  const [roomModal, setRoomModal] = useState<{ open: boolean; buildingId: number; initial?: Partial<Room> } | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Building | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteErr, setDeleteErr] = useState('')
  const [deleteRoomTarget, setDeleteRoomTarget] = useState<Room | null>(null)
  const [deletingRoom, setDeletingRoom] = useState(false)
  const [deleteRoomErr, setDeleteRoomErr] = useState('')
  const [confirmBuildingInput, setConfirmBuildingInput] = useState('')
  const [confirmRoomInput, setConfirmRoomInput] = useState('')
  const [localRooms, setLocalRooms] = useState<Room[] | null>(null)
  const [buildingIEModal, setBuildingIEModal] = useState(false)
  const [roomIEModal, setRoomIEModal] = useState(false)

  const effectiveRooms = localRooms ?? (allRooms as Room[])

  // localRooms is an optimistic snapshot (reorder/status/special/sensor-code toggles show it
  // immediately without waiting for a refetch). Once the underlying query actually refetches
  // (e.g. after invalidateQueries from any room create/update/delete/import), drop the snapshot
  // so the UI goes back to reflecting real server data — otherwise a stale snapshot permanently
  // masks anything new (like a freshly created room) until a hard refresh clears component state.
  useEffect(() => {
    setLocalRooms(null)
  }, [allRooms])

  async function handleImportBuildings(rows: Parameters<typeof importBuildings>[0]) {
    const result = await importBuildings(rows)
    qc.invalidateQueries({ queryKey: ['buildings'] })
    return result
  }

  async function handleImportRooms(rows: Parameters<typeof importRooms>[0]) {
    const result = await importRooms(rows)
    qc.invalidateQueries({ queryKey: ['rooms'] })
    qc.invalidateQueries({ queryKey: ['buildings'] })
    return result
  }

  function roomsFor(bid: number) {
    return effectiveRooms.filter(r => r.building_id === bid).sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
  }

  function handleRoomReorder(buildingId: number, reordered: Room[]) {
    const base = effectiveRooms.filter(r => r.building_id !== buildingId)
    setLocalRooms([...base, ...reordered])
    qc.invalidateQueries({ queryKey: ['rooms'] })
  }

  async function handleSaveBuilding(data: Partial<Building>) {
    if (buildingModal.initial?.id) {
      await updateBuilding(buildingModal.initial.id, data)
    } else {
      await createBuilding(data)
    }
    qc.invalidateQueries({ queryKey: ['buildings'] })
  }

  async function handleSaveRoom(data: Partial<Room>) {
    if (roomModal?.initial?.id) {
      await updateRoom(roomModal.initial.id, data)
    } else {
      await createRoom(data)
    }
    qc.invalidateQueries({ queryKey: ['rooms'] })
    qc.invalidateQueries({ queryKey: ['buildings'] })
  }

  async function handleDeleteRoom() {
    if (!deleteRoomTarget) return
    setDeletingRoom(true); setDeleteRoomErr('')
    try {
      await deleteRoom(deleteRoomTarget.id)
      qc.invalidateQueries({ queryKey: ['rooms'] })
      setDeleteRoomTarget(null)
    } catch { setDeleteRoomErr('Failed to delete room. It may have active bookings.') }
    finally { setDeletingRoom(false) }
  }

  useModalHotkeys(
    !!deleteRoomTarget,
    deleteRoomTarget && confirmRoomInput === deleteRoomTarget.name ? handleDeleteRoom : undefined,
    () => { setDeleteRoomTarget(null); setDeleteRoomErr(''); setConfirmRoomInput('') },
  )

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true); setDeleteErr('')
    try {
      await deleteBuilding(deleteTarget.id)
      qc.invalidateQueries({ queryKey: ['buildings'] })
      setDeleteTarget(null)
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
      setDeleteErr(msg || 'Failed to delete.')
    } finally { setDeleting(false) }
  }

  useModalHotkeys(
    !!deleteTarget,
    deleteTarget && confirmBuildingInput === deleteTarget.name ? handleDelete : undefined,
    () => { setDeleteTarget(null); setConfirmBuildingInput('') },
  )

  if (isLoading) return <div className="flex items-center justify-center h-48 text-[var(--ds-text-3)] text-sm font-bold">Loading...</div>

  return (
    <div className="max-w-4xl space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[9px] font-black uppercase tracking-[0.25em] text-[var(--ds-text-3)] mb-1">Admin Dashboard</p>
          <h1 className="text-3xl font-black italic tracking-tighter uppercase">Buildings</h1>
        </div>
        {!isBuildingAdminUser && (
        <div className="flex gap-2">
          <button onClick={() => setBuildingIEModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-[var(--ds-bg-surface-2)] text-[var(--ds-text-2)] text-[10px] font-black uppercase hover:bg-[var(--ds-bg-raised)] transition-colors">
            <span className="material-symbols-outlined" style={{ fontSize: 15 }}>import_export</span>Buildings
          </button>
          <button onClick={() => setRoomIEModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-[var(--ds-bg-surface-2)] text-[var(--ds-text-2)] text-[10px] font-black uppercase hover:bg-[var(--ds-bg-raised)] transition-colors">
            <span className="material-symbols-outlined" style={{ fontSize: 15 }}>import_export</span>Rooms
          </button>
        </div>
        )}
      </div>

      {buildingIEModal && (
        <BuildingImportExportModal buildings={buildings} onImport={handleImportBuildings} onClose={() => setBuildingIEModal(false)} />
      )}
      {roomIEModal && (
        <RoomImportExportModal rooms={effectiveRooms} onImport={handleImportRooms} onClose={() => setRoomIEModal(false)} />
      )}

      <LocationsSection />

      {buildings.length === 0 && (
        <div className="bg-[var(--ds-bg-surface)] rounded-2xl border border-[var(--ds-border-sub)] p-10 text-center">
          <span className="material-symbols-outlined text-[var(--ds-text-3)] text-5xl">domain</span>
          <p className="text-[var(--ds-text-3)] font-bold mt-3">No buildings yet.</p>
        </div>
      )}

      <div className="space-y-3">
        {buildings.map(b => {
          const rooms = roomsFor(b.id)
          const isExpanded = expanded === b.id

          return (
            <div key={b.id} className="bg-[var(--ds-bg-surface)] rounded-2xl border border-[var(--ds-border-sub)] overflow-hidden">
              {/* Building header row */}
              <div className="flex items-center gap-4 px-5 py-4">
                {/* Placeholder icon */}
                <div className="size-14 rounded-xl overflow-hidden shrink-0 bg-[var(--ds-bg-surface-2)] flex items-center justify-center">
                  <span className="material-symbols-outlined text-[var(--ds-text-3)]" style={{ fontSize: 28 }}>domain</span>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-base font-black text-[var(--ds-text-1)]">{b.name}</p>
                    {b.code && (
                      <span className="px-2 py-0.5 rounded-full bg-[var(--ds-bg-surface-2)] text-[10px] font-black uppercase text-[var(--ds-text-2)]">{b.code}</span>
                    )}
                    {b.location && (
                      <span className="px-2 py-0.5 rounded-full bg-blue-50 text-[10px] font-black uppercase text-blue-500">{b.location.name}</span>
                    )}
                    {!b.is_active && (
                      <span className="px-2 py-0.5 rounded-full bg-red-500/10 text-[10px] font-black uppercase text-red-400">Inactive</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-1">
                    {b.address && (
                      <span className="flex items-center gap-1 text-[11px] text-[var(--ds-text-3)] font-medium truncate">
                        <span className="material-symbols-outlined" style={{ fontSize: 13 }}>location_on</span>
                        {b.address}
                      </span>
                    )}
                    <span className="flex items-center gap-1 text-[11px] text-[var(--ds-text-3)] font-bold shrink-0">
                      <span className="material-symbols-outlined" style={{ fontSize: 13 }}>layers</span>
                      {b.floors} floor{b.floors !== 1 ? 's' : ''}
                    </span>
                    <span className="flex items-center gap-1 text-[11px] font-black text-[var(--ds-text-2)] shrink-0">
                      <span className="material-symbols-outlined" style={{ fontSize: 13 }}>meeting_room</span>
                      {rooms.length} room{rooms.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {!isBuildingAdminUser && (<>
                  <button
                    onClick={() => setBuildingModal({ open: true, initial: b })}
                    className="size-9 flex items-center justify-center rounded-lg bg-[var(--ds-bg-surface-2)] text-[var(--ds-text-2)] hover:bg-black hover:text-[#adee2b] transition-all"
                    title="Edit building"
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 17 }}>edit</span>
                  </button>
                  <button
                    onClick={() => { setDeleteErr(''); setConfirmBuildingInput(''); setDeleteTarget(b) }}
                    className="size-9 flex items-center justify-center rounded-lg bg-[var(--ds-bg-surface-2)] text-[var(--ds-text-2)] hover:bg-red-500/10 hover:text-red-400 transition-all"
                    title="Delete building"
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 17 }}>delete</span>
                  </button>
                  </>)}
                  <button
                    onClick={() => setExpanded(isExpanded ? null : b.id)}
                    className="size-9 flex items-center justify-center rounded-lg bg-[var(--ds-bg-surface-2)] text-[var(--ds-text-2)] hover:bg-[var(--ds-bg-raised)] transition-all"
                  >
                    <span className="material-symbols-outlined transition-transform duration-200" style={{ fontSize: 22, transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}>expand_more</span>
                  </button>
                </div>
              </div>

              {/* Expanded rooms list */}
              {isExpanded && (
                <div className="border-t border-[var(--ds-border)] bg-[var(--ds-bg-raised)] px-5 py-4 space-y-3 admin-dropdown-in">
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] font-black uppercase text-[var(--ds-text-3)] tracking-wider">Rooms in {b.name}</p>
                    <button
                      onClick={() => setRoomModal({ open: true, buildingId: b.id })}
                      className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-black text-[#adee2b] text-[10px] font-black uppercase hover:bg-slate-800 transition-colors"
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: 14 }}>add</span>
                      Add Room
                    </button>
                  </div>

                  {rooms.length === 0 ? (
                    <p className="text-xs text-[var(--ds-text-3)] font-medium py-2">No rooms yet in this building.</p>
                  ) : (
                    <RoomList
                      rooms={rooms}
                      buildingId={b.id}
                      sensorMode={sensorMode}
                      onEdit={r => setRoomModal({ open: true, buildingId: b.id, initial: r })}
                      onDelete={r => { setDeleteRoomTarget(r); setDeleteRoomErr(''); setConfirmRoomInput('') }}
                      onReordered={reordered => handleRoomReorder(b.id, reordered)}
                      onStatusChange={(roomId, status) => setLocalRooms(prev => (prev ?? allRooms as Room[]).map(r => r.id === roomId ? { ...r, status } : r))}
                      onSpecialChange={(roomId, special) => setLocalRooms(prev => (prev ?? allRooms as Room[]).map(r => r.id === roomId ? { ...r, requires_contact: special } : r))}
                      onSensorCodeChange={(roomId, code) => setLocalRooms(prev => (prev ?? allRooms as Room[]).map(r => r.id === roomId ? { ...r, sensor_code: code } : r))}
                    />
                  )}
                </div>
              )}
            </div>
          )
        })}

        {/* Add Building — inline at bottom of list */}
        {!isBuildingAdminUser && (
        <button
          onClick={() => setBuildingModal({ open: true })}
          className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl text-[11px] font-black uppercase tracking-wide transition-all"
          style={{ background: 'rgba(0,0,0,0.85)', color: '#adee2b' }}
          onMouseEnter={e => { e.currentTarget.style.background = '#000' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(0,0,0,0.85)' }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>add</span>
          Add Building
        </button>
        )}
      </div>

      {/* Building modal */}
      {buildingModal.open && (
        <BuildingModal
          initial={buildingModal.initial}
          locations={locations as Location[]}
          onSave={handleSaveBuilding}
          onClose={() => setBuildingModal({ open: false })}
        />
      )}

      {/* Room modal */}
      {roomModal?.open && (
        <RoomModal
          buildingId={roomModal.buildingId}
          initial={roomModal.initial}
          onSave={handleSaveRoom}
          onClose={() => setRoomModal(null)}
        />
      )}

      {/* Delete building confirm */}
      {deleteTarget && (
        <ModalPortal>
        <div className="fixed inset-0 z-[1000] flex items-center justify-center admin-backdrop-in"
          style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(16px)' }}
          onClick={() => { setDeleteTarget(null); setConfirmBuildingInput('') }}>
          <div
            className="w-[420px] rounded-[2rem] shadow-2xl overflow-hidden admin-modal-in"
            style={{ background: 'var(--ds-bg-surface)', backdropFilter: 'blur(48px) saturate(200%)', border: '1px solid rgba(128,128,128,0.15)' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="px-7 pt-7 pb-5 border-b flex items-center gap-3" style={{ background: 'rgba(239,68,68,0.08)', borderColor: 'rgba(239,68,68,0.15)' }}>
              <div className="size-11 rounded-2xl flex items-center justify-center shrink-0" style={{ background: 'rgba(239,68,68,0.15)' }}>
                <span className="material-symbols-outlined text-red-500" style={{ fontSize: 22, fontVariationSettings: "'FILL' 1" }}>domain</span>
              </div>
              <div>
                <p className="text-[9px] font-black uppercase tracking-[0.2em] text-red-500">Danger Zone</p>
                <h3 className="text-lg font-black text-[var(--ds-text-1)] uppercase tracking-tight mt-0.5">Delete Building?</h3>
              </div>
            </div>
            <div className="px-7 py-5 space-y-4">
              <div className="bg-[var(--ds-bg-raised)] rounded-xl px-4 py-3 flex items-center gap-3">
                <span className="material-symbols-outlined text-[var(--ds-text-3)] shrink-0" style={{ fontSize: 22 }}>domain</span>
                <div>
                  <p className="text-sm font-black text-[var(--ds-text-1)]">{deleteTarget.name}</p>
                  {deleteTarget.address && <p className="text-[10px] text-[var(--ds-text-3)] font-medium mt-0.5">{deleteTarget.address}</p>}
                </div>
              </div>
              <p className="text-[11px] text-[var(--ds-text-2)] font-medium leading-relaxed">
                All rooms inside this building will also be deleted. <span className="font-black text-[var(--ds-text-1)]">This cannot be undone.</span>
              </p>
              <div className="space-y-1.5">
                <label className="text-[9px] font-black uppercase tracking-wider text-[var(--ds-text-3)] px-1">
                  Type <span className="normal-case text-[var(--ds-text-1)]">"{deleteTarget.name}"</span> to confirm
                </label>
                <input
                  value={confirmBuildingInput}
                  onChange={e => setConfirmBuildingInput(e.target.value)}
                  placeholder={deleteTarget.name}
                  autoFocus
                  className="w-full bg-[var(--ds-bg-raised)] border border-[var(--ds-border)] rounded-xl px-3 py-2.5 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-red-300 focus:border-transparent text-[var(--ds-text-1)]"
                />
              </div>
              {deleteErr && (
                <div className="flex items-center gap-2 text-[11px] font-bold px-3 py-2.5 rounded-xl" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171' }}>
                  <span className="material-symbols-outlined shrink-0" style={{ fontSize: 14 }}>error</span>{deleteErr}
                </div>
              )}
              <div className="flex gap-3 pt-1">
                <button onClick={() => { setDeleteTarget(null); setConfirmBuildingInput('') }}
                  className="flex-1 py-3.5 rounded-full text-[10px] font-black uppercase tracking-[0.15em] bg-[var(--ds-bg-surface-2)] text-[var(--ds-text-2)] hover:bg-[var(--ds-bg-raised)] transition-colors">Cancel</button>
                <button onClick={handleDelete} disabled={deleting || confirmBuildingInput !== deleteTarget.name}
                  className="flex-1 py-3.5 rounded-full text-[10px] font-black uppercase tracking-[0.15em] bg-red-500 text-white hover:bg-red-600 disabled:opacity-30 flex items-center justify-center gap-2 transition-all">
                  {deleting && <span className="material-symbols-outlined animate-spin" style={{ fontSize: 13 }}>progress_activity</span>}
                  {deleting ? 'Deleting...' : 'Delete Building'}
                </button>
              </div>
            </div>
          </div>
        </div>
        </ModalPortal>
      )}

      {/* Delete room confirm */}
      {deleteRoomTarget && (
        <ModalPortal>
        <div className="fixed inset-0 z-[1001] flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(16px)' }}
          onClick={() => { setDeleteRoomTarget(null); setDeleteRoomErr(''); setConfirmRoomInput('') }}>
          <div
            className="w-[420px] rounded-[2rem] shadow-2xl overflow-hidden"
            style={{ background: 'var(--ds-bg-surface)', backdropFilter: 'blur(48px) saturate(200%)', border: '1px solid rgba(128,128,128,0.15)' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="px-7 pt-7 pb-5 border-b flex items-center gap-3" style={{ background: 'rgba(239,68,68,0.08)', borderColor: 'rgba(239,68,68,0.15)' }}>
              <div className="size-11 rounded-2xl flex items-center justify-center shrink-0" style={{ background: 'rgba(239,68,68,0.15)' }}>
                <span className="material-symbols-outlined text-red-500" style={{ fontSize: 22, fontVariationSettings: "'FILL' 1" }}>meeting_room</span>
              </div>
              <div>
                <p className="text-[9px] font-black uppercase tracking-[0.2em] text-red-500">Danger Zone</p>
                <h3 className="text-lg font-black text-[var(--ds-text-1)] uppercase tracking-tight mt-0.5">Delete Room?</h3>
              </div>
            </div>
            <div className="px-7 py-5 space-y-4">
              <div className="bg-[var(--ds-bg-raised)] rounded-xl px-4 py-3 flex items-center gap-3">
                <span className="material-symbols-outlined text-[var(--ds-text-3)] shrink-0" style={{ fontSize: 22 }}>meeting_room</span>
                <div>
                  <p className="text-sm font-black text-[var(--ds-text-1)]">{deleteRoomTarget.name}</p>
                  <p className="text-[10px] text-[var(--ds-text-3)] font-bold mt-0.5">
                    {deleteRoomTarget.capacity} pax · {deleteRoomTarget.floor}
                    {deleteRoomTarget.requires_contact && ' · Special Room'}
                  </p>
                </div>
              </div>
              <p className="text-[11px] text-[var(--ds-text-2)] font-medium leading-relaxed">
                Existing bookings linked to this room may be affected. <span className="font-black text-[var(--ds-text-1)]">This cannot be undone.</span>
              </p>
              <div className="space-y-1.5">
                <label className="text-[9px] font-black uppercase tracking-wider text-[var(--ds-text-3)] px-1">
                  Type <span className="normal-case text-[var(--ds-text-1)]">"{deleteRoomTarget.name}"</span> to confirm
                </label>
                <input
                  value={confirmRoomInput}
                  onChange={e => setConfirmRoomInput(e.target.value)}
                  placeholder={deleteRoomTarget.name}
                  autoFocus
                  className="w-full bg-[var(--ds-bg-raised)] border border-[var(--ds-border)] rounded-xl px-3 py-2.5 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-red-300 focus:border-transparent text-[var(--ds-text-1)]"
                />
              </div>
              {deleteRoomErr && (
                <div className="flex items-center gap-2 text-[11px] font-bold px-3 py-2.5 rounded-xl" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171' }}>
                  <span className="material-symbols-outlined shrink-0" style={{ fontSize: 14 }}>error</span>
                  {deleteRoomErr}
                </div>
              )}
              <div className="flex gap-3 pt-1">
                <button
                  onClick={() => { setDeleteRoomTarget(null); setDeleteRoomErr(''); setConfirmRoomInput('') }}
                  className="flex-1 py-3.5 rounded-full text-[10px] font-black uppercase tracking-[0.15em] bg-[var(--ds-bg-surface-2)] text-[var(--ds-text-2)] hover:bg-[var(--ds-bg-raised)] transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteRoom}
                  disabled={deletingRoom || confirmRoomInput !== deleteRoomTarget.name}
                  className="flex-1 py-3.5 rounded-full text-[10px] font-black uppercase tracking-[0.15em] bg-red-500 text-white hover:bg-red-600 disabled:opacity-30 flex items-center justify-center gap-2 transition-all"
                >
                  {deletingRoom && <span className="material-symbols-outlined animate-spin" style={{ fontSize: 13 }}>progress_activity</span>}
                  {deletingRoom ? 'Deleting...' : 'Delete Room'}
                </button>
              </div>
            </div>
          </div>
        </div>
        </ModalPortal>
      )}
    </div>
  )
}

export { BuildingsTab as default }
