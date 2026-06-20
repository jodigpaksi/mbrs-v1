import { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import * as XLSX from 'xlsx'
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import { mockBookings, mockRooms, mockUsers } from '../data/mockData'
import type { Building, Room, Asset, AssetStatus, Location, User, Department } from '../types/index'
import { getBuildings, createBuilding, updateBuilding, deleteBuilding } from '../api/buildings'
import { getRooms, createRoom, updateRoom, deleteRoom, reorderRooms } from '../api/rooms'
import { getAssets, createAsset, updateAsset, deleteAsset, createAssetUnit, updateAssetUnit, deleteAssetUnit } from '../api/assets'
import { getUsers, createUser, updateUser, importUsers, updateUserRole, assignUserBuildings, deleteUser, exportUsers } from '../api/users'
import { getLocations, createLocation, updateLocation, deleteLocation } from '../api/locations'
import { getDepartments, createDepartment, updateDepartment, deleteDepartment } from '../api/departments'
import { getBookingHours, updateBookingHours, getWeekendSettings, updateWeekendSettings } from '../api/settings'
import type { UserRole } from '../types/index'
import { SpecialRoomBadge } from '../components/ui/SpecialRoomBadge'
import GlassTimePicker from '../components/ui/GlassTimePicker'
import { useAuth } from '../context/AuthContext'

type Tab = 'overview' | 'bookings' | 'users' | 'buildings' | 'assets' | 'settings'
type SortKey = 'start_at' | 'title' | 'room' | 'user' | 'status'
type SortDir = 'asc' | 'desc'

function ModalPortal({ children }: { children: ReactNode }) {
  return <>{createPortal(children, document.body)}</>
}

function StatCard({ label, value, sub, dark }: { label: string; value: string; sub: string; dark?: boolean }) {
  return (
    <div className={`p-5 rounded-2xl ${dark ? 'bg-black' : 'bg-white border border-slate-100'}`}>
      <p className={`text-[8px] font-black uppercase tracking-widest ${dark ? 'text-slate-500' : 'text-slate-400'}`}>{label}</p>
      <p className={`text-4xl font-black italic mt-1 ${dark ? 'text-[#adee2b]' : 'text-slate-800'}`}>{value}</p>
      <p className={`text-[9px] font-bold mt-0.5 ${dark ? 'text-slate-500' : 'text-slate-400'}`}>{sub}</p>
    </div>
  )
}

const ROOM_TYPE_COLOR: Record<string, string> = {
  Ballroom: 'bg-purple-400', Executive: 'bg-blue-400', Focus: 'bg-green-400',
}

// ── Building form modal ──────────────────────────────────────────────────────
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
  const [photo, setPhoto] = useState(initial?.photo ?? '')
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
        photo: photo.trim() || undefined,
        notes: notes.trim() || undefined,
      })
      onClose()
    } catch { setErr('Failed to save building.') } finally { setSaving(false) }
  }

  return (
    <ModalPortal>
    <div className="fixed inset-0 z-[1000] flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(12px)' }} onClick={onClose}>
      <div className="bg-white rounded-3xl shadow-2xl w-[440px] p-7 space-y-4" onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-black uppercase tracking-tight">{initial?.id ? 'Edit Building' : 'Add Building'}</h3>
        {err && <p className="text-xs text-red-500 font-bold">{err}</p>}

        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2 space-y-1">
            <label className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Name *</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Gedung Utama"
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-[#adee2b]" />
          </div>
          <div className="space-y-1">
            <label className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Code</label>
            <input value={code} onChange={e => setCode(e.target.value)} placeholder="e.g. GU"
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-[#adee2b]" />
          </div>
          <div className="space-y-1">
            <label className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Floors</label>
            <input type="number" min={1} value={floors} onChange={e => setFloors(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-[#adee2b]" />
          </div>
          <div className="col-span-2 space-y-1">
            <label className="text-[9px] font-black uppercase text-slate-400 tracking-wider">City / Location</label>
            <select value={locationId} onChange={e => setLocationId(e.target.value ? Number(e.target.value) : '')}
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-[#adee2b] bg-white">
              <option value="">— No city assigned —</option>
              {locations.map(loc => (
                <option key={loc.id} value={loc.id}>{loc.name}{loc.code ? ` (${loc.code})` : ''}</option>
              ))}
            </select>
          </div>
          <div className="col-span-2 space-y-1">
            <label className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Address</label>
            <input value={address} onChange={e => setAddress(e.target.value)} placeholder="e.g. Jl. Sudirman No. 1"
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-[#adee2b]" />
          </div>
          <div className="col-span-2 space-y-1">
            <label className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Photo URL</label>
            <input value={photo} onChange={e => setPhoto(e.target.value)} placeholder="https://..."
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-[#adee2b]" />
          </div>
          <div className="col-span-2 space-y-1">
            <label className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Notes</label>
            <textarea rows={2} value={notes} onChange={e => setNotes(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#adee2b] resize-none" />
          </div>
        </div>

        <div className="flex gap-3 pt-1">
          <button onClick={onClose} className="flex-1 py-3 rounded-2xl bg-slate-100 text-slate-600 text-[10px] font-black uppercase hover:bg-slate-200 transition-colors">Cancel</button>
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

// ── Room form modal (within a building) ─────────────────────────────────────
const PRESET_FACILITIES = [
  { name: 'TV / Monitor',      icon: 'tv' },
  { name: 'Projector',         icon: 'present_to_all' },
  { name: 'Video Conference',  icon: 'video_call' },
  { name: 'Whiteboard',        icon: 'edit_square' },
  { name: 'Microphone',        icon: 'mic' },
  { name: 'Speaker',           icon: 'speaker' },
  { name: 'HDMI Cable',        icon: 'cable' },
  { name: 'WiFi',              icon: 'wifi' },
  { name: 'Air Conditioner',   icon: 'ac_unit' },
  { name: 'Phone / Intercom',  icon: 'phone' },
  { name: 'Laptop',            icon: 'laptop' },
  { name: 'Printer',           icon: 'print' },
  { name: 'Webcam',            icon: 'camera' },
  { name: 'Power Strip',       icon: 'electrical_services' },
  { name: 'Smart Display',     icon: 'smart_display' },
]

function RoomModal({
  buildingId, initial, onSave, onClose,
}: {
  buildingId: number
  initial?: Partial<Room>
  onSave: (data: Partial<Room>) => Promise<void>
  onClose: () => void
}) {
  const qc = useQueryClient()
  type RoomTab = 'basic' | 'photos' | 'facilities'
  const [activeTab, setActiveTab] = useState<RoomTab>('basic')
  const isEdit = !!initial?.id

  // Basic
  const [name, setName]                 = useState(initial?.name ?? '')
  const [capacity, setCapacity]         = useState(String(initial?.capacity ?? ''))
  const [floor, setFloor]               = useState(initial?.floor ?? '')
  const [notes, setNotes]               = useState(initial?.notes ?? '')
  const [requiresContact, setRequiresContact] = useState(initial?.requires_contact ?? false)
  const [saving, setSaving]             = useState(false)
  const [err, setErr]                   = useState('')

  // Photos
  const [photos, setPhotos]             = useState<string[]>(initial?.photos ?? [])
  const [newUrl, setNewUrl]             = useState('')
  const [savingPhotos, setSavingPhotos] = useState(false)

  // Facilities
  const [facilities, setFacilities]         = useState<{ name: string; icon: string }[]>(initial?.facilities ?? [])
  const [showPresets, setShowPresets]       = useState(false)
  const [customName, setCustomName]         = useState('')
  const [customIcon, setCustomIcon]         = useState('devices')
  const [savingFacilities, setSavingFacilities] = useState(false)

  async function handleSave() {
    if (!name.trim() || !floor.trim() || !capacity) { setErr('Name, floor and capacity are required'); return }
    setSaving(true); setErr('')
    try {
      await onSave({ building_id: buildingId, name: name.trim(), capacity: Number(capacity), floor: floor.trim(), notes: notes.trim() || undefined, requires_contact: requiresContact })
      onClose()
    } catch { setErr('Failed to save room.') } finally { setSaving(false) }
  }

  function addPhoto() {
    const url = newUrl.trim()
    if (!url || photos.includes(url)) return
    setPhotos(prev => [...prev, url]); setNewUrl('')
  }
  async function savePhotos() {
    if (!initial?.id) return
    setSavingPhotos(true)
    try { await updateRoom(initial.id, { photos }); qc.invalidateQueries({ queryKey: ['rooms'] }) }
    finally { setSavingPhotos(false) }
  }

  function addPreset(f: { name: string; icon: string }) {
    if (facilities.some(x => x.name === f.name)) return
    setFacilities(prev => [...prev, f])
  }
  function addCustom() {
    const n = customName.trim()
    if (!n || facilities.some(x => x.name === n)) return
    setFacilities(prev => [...prev, { name: n, icon: customIcon.trim() || 'devices' }])
    setCustomName(''); setCustomIcon('devices')
  }
  async function saveFacilities() {
    if (!initial?.id) return
    setSavingFacilities(true)
    try { await updateRoom(initial.id, { facilities }); qc.invalidateQueries({ queryKey: ['rooms'] }) }
    finally { setSavingFacilities(false) }
  }

  const TAB_ORDER: RoomTab[] = ['basic', 'photos', 'facilities']
  const animDirRef = useRef<'left' | 'right'>('right')

  function switchTab(tab: RoomTab) {
    animDirRef.current = TAB_ORDER.indexOf(tab) > TAB_ORDER.indexOf(activeTab) ? 'right' : 'left'
    setActiveTab(tab)
  }

  const TABS: { key: RoomTab; label: string; icon: string; disabled?: boolean }[] = [
    { key: 'basic',      label: 'Basic',      icon: 'tune' },
    { key: 'photos',     label: 'Photos',     icon: 'photo_library', disabled: !isEdit },
    { key: 'facilities', label: 'Facilities', icon: 'widgets',       disabled: !isEdit },
  ]

  // Unified footer action per tab
  const footerAction =
    activeTab === 'photos'     ? { label: savingPhotos     ? 'Saving...' : 'Save Photos →',     fn: savePhotos,     busy: savingPhotos } :
    activeTab === 'facilities' ? { label: savingFacilities ? 'Saving...' : 'Save Facilities →', fn: saveFacilities, busy: savingFacilities } :
                                 { label: saving           ? 'Saving...' : isEdit ? 'Save Changes →' : 'Create Room →', fn: handleSave, busy: saving }

  return (
    <ModalPortal>
    <>
      <style>{`
        @keyframes tab-slide-right {
          from { opacity: 0; transform: translateX(22px) }
          to   { opacity: 1; transform: translateX(0) }
        }
        @keyframes tab-slide-left {
          from { opacity: 0; transform: translateX(-22px) }
          to   { opacity: 1; transform: translateX(0) }
        }
        .tab-anim-right { animation: tab-slide-right 0.22s cubic-bezier(0.25,0.46,0.45,0.94) both }
        .tab-anim-left  { animation: tab-slide-left  0.22s cubic-bezier(0.25,0.46,0.45,0.94) both }
      `}</style>

      <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4"
        style={{ background: 'rgba(0,0,0,0.4)' }} onClick={onClose}>
        <div
          className="w-full max-w-[560px] flex flex-col rounded-[2rem] shadow-2xl overflow-hidden"
          style={{
            height: 620,
            background: 'rgba(255,255,255,0.92)',
            backdropFilter: 'blur(48px) saturate(200%)',
            border: '1px solid rgba(255,255,255,0.7)',
          }}
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-7 pt-7 pb-5 border-b border-slate-100 shrink-0">
            <div>
              <p className="text-[9px] font-black uppercase tracking-[0.25em] text-slate-400">Buildings · Room</p>
              <h2 className="text-2xl font-black italic tracking-tighter uppercase mt-0.5">{isEdit ? initial?.name ?? 'Edit Room' : 'Add Room'}</h2>
            </div>
            <button onClick={onClose} className="size-9 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors">
              <span className="material-symbols-outlined text-slate-500" style={{ fontSize: 18 }}>close</span>
            </button>
          </div>

          {/* Tab bar */}
          <div className="flex gap-1 px-7 pt-4 pb-0 shrink-0">
            {TABS.map(t => (
              <button key={t.key} disabled={t.disabled}
                onClick={() => switchTab(t.key)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-t-xl text-[9px] font-black uppercase tracking-wider transition-all
                  ${t.disabled ? 'text-slate-300 cursor-not-allowed' : activeTab === t.key ? 'bg-white border border-b-white border-slate-100 text-black shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                title={t.disabled ? 'Save room first to manage this' : undefined}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 13 }}>{t.icon}</span>
                {t.label}
                {t.key === 'photos' && isEdit && photos.length > 0 && (
                  <span className="ml-0.5 size-4 rounded-full bg-slate-200 text-slate-600 text-[8px] flex items-center justify-center font-black">{photos.length}</span>
                )}
                {t.key === 'facilities' && isEdit && facilities.length > 0 && (
                  <span className="ml-0.5 size-4 rounded-full bg-slate-200 text-slate-600 text-[8px] flex items-center justify-center font-black">{facilities.length}</span>
                )}
              </button>
            ))}
          </div>

          {/* Tab content — fixed area, scrolls internally */}
          <div className="flex-1 border-t border-slate-100 overflow-hidden relative">
            <div
              key={activeTab}
              className={`absolute inset-0 overflow-y-auto ${animDirRef.current === 'right' ? 'tab-anim-right' : 'tab-anim-left'}`}
              style={{ scrollbarWidth: 'thin' }}
            >

              {/* ── Basic ── */}
              {activeTab === 'basic' && (
                <div className="px-7 py-5 space-y-4">
                  {err && <div className="flex items-center gap-2 bg-red-50 border border-red-100 text-red-600 text-[11px] font-bold px-4 py-3 rounded-xl"><span className="material-symbols-outlined" style={{ fontSize: 15 }}>error</span>{err}</div>}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2 space-y-1.5">
                      <label className="text-[9px] font-black uppercase text-slate-400 tracking-wider px-1">Room Name *</label>
                      <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Executive Suite 2A"
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-[#adee2b] focus:border-transparent" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[9px] font-black uppercase text-slate-400 tracking-wider px-1">Capacity *</label>
                      <div className="relative">
                        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" style={{ fontSize: 15 }}>groups</span>
                        <input type="number" min={1} value={capacity} onChange={e => setCapacity(e.target.value)} placeholder="e.g. 10"
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2.5 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-[#adee2b] focus:border-transparent" />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[9px] font-black uppercase text-slate-400 tracking-wider px-1">Floor *</label>
                      <div className="relative">
                        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" style={{ fontSize: 15 }}>layers</span>
                        <input value={floor} onChange={e => setFloor(e.target.value)} placeholder="e.g. 2F"
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2.5 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-[#adee2b] focus:border-transparent" />
                      </div>
                    </div>
                    <div className="col-span-2 space-y-1.5">
                      <label className="text-[9px] font-black uppercase text-slate-400 tracking-wider px-1">Notes</label>
                      <textarea rows={2} value={notes} onChange={e => setNotes(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#adee2b] focus:border-transparent resize-none" />
                    </div>
                    <div className="col-span-2">
                      <button type="button" onClick={() => setRequiresContact(v => !v)}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 transition-all text-left
                          ${requiresContact ? 'border-amber-400 bg-amber-50' : 'border-slate-200 bg-slate-50 hover:border-slate-300'}`}>
                        <div className={`size-5 rounded-md flex items-center justify-center shrink-0 transition-all ${requiresContact ? 'bg-amber-400' : 'bg-white border-2 border-slate-300'}`}>
                          {requiresContact && <span className="material-symbols-outlined text-white" style={{ fontSize: 14 }}>check</span>}
                        </div>
                        <div>
                          <p className={`text-[10px] font-black uppercase ${requiresContact ? 'text-amber-700' : 'text-slate-500'}`}>Requires Receptionist / GAA</p>
                          <p className="text-[9px] font-medium text-slate-400 mt-0.5">Room can only be booked through Receptionist or GAA</p>
                        </div>
                        <span className="material-symbols-outlined ml-auto text-amber-400 shrink-0" style={{ fontSize: 18, opacity: requiresContact ? 1 : 0 }}>support_agent</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* ── Photos ── */}
              {activeTab === 'photos' && (
                <div className="px-7 py-5 space-y-4">
                  <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">{photos.length} photo{photos.length !== 1 ? 's' : ''} · first is cover</p>
                  {photos.length > 0 && (
                    <div className="grid grid-cols-3 gap-3">
                      {photos.map((url, i) => (
                        <div key={i} className="relative group aspect-video rounded-xl overflow-hidden bg-slate-100">
                          <img src={url} alt="" className="w-full h-full object-cover" onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                            {i > 0 && (
                              <button onClick={() => setPhotos(prev => { const a = [...prev]; [a[i-1], a[i]] = [a[i], a[i-1]]; return a })}
                                className="size-7 flex items-center justify-center rounded-lg bg-white/20 text-white hover:bg-white/40 transition-colors">
                                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>arrow_back</span>
                              </button>
                            )}
                            <button onClick={() => setPhotos(prev => prev.filter((_, j) => j !== i))}
                              className="size-7 flex items-center justify-center rounded-lg bg-red-500/90 text-white hover:bg-red-600 transition-colors">
                              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>delete</span>
                            </button>
                            {i < photos.length - 1 && (
                              <button onClick={() => setPhotos(prev => { const a = [...prev]; [a[i], a[i+1]] = [a[i+1], a[i]]; return a })}
                                className="size-7 flex items-center justify-center rounded-lg bg-white/20 text-white hover:bg-white/40 transition-colors">
                                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>arrow_forward</span>
                              </button>
                            )}
                          </div>
                          <div className="absolute bottom-1.5 left-1.5 bg-black/60 text-white text-[8px] font-black px-1.5 py-0.5 rounded-md">
                            {i === 0 ? 'Cover' : `#${i + 1}`}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="flex gap-2">
                    <input value={newUrl} onChange={e => setNewUrl(e.target.value)} onKeyDown={e => e.key === 'Enter' && addPhoto()}
                      placeholder="Paste image URL and press Enter..."
                      className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-[11px] font-bold focus:outline-none focus:ring-2 focus:ring-[#adee2b] focus:border-transparent" />
                    <button onClick={addPhoto}
                      className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl text-[9px] font-black uppercase hover:bg-slate-200 flex items-center gap-1.5 transition-all shrink-0">
                      <span className="material-symbols-outlined" style={{ fontSize: 14 }}>add_photo_alternate</span>Add
                    </button>
                  </div>
                </div>
              )}

              {/* ── Facilities ── */}
              {activeTab === 'facilities' && (
                <div className="px-7 py-5 space-y-4">
                  <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">{facilities.length} item{facilities.length !== 1 ? 's' : ''}</p>
                  {facilities.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {facilities.map((f, i) => (
                        <div key={i} className="flex items-center gap-2 pl-2.5 pr-1.5 py-1.5 bg-slate-100 rounded-xl group">
                          <span className="material-symbols-outlined text-slate-500" style={{ fontSize: 15 }}>{f.icon}</span>
                          <span className="text-[10px] font-black uppercase text-slate-600">{f.name}</span>
                          <button onClick={() => setFacilities(prev => prev.filter((_, j) => j !== i))}
                            className="size-4 flex items-center justify-center rounded text-slate-300 hover:text-red-500 transition-colors ml-0.5">
                            <span className="material-symbols-outlined" style={{ fontSize: 12 }}>close</span>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  {showPresets && (
                    <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100">
                      <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-2.5">Quick Add</p>
                      <div className="flex flex-wrap gap-1.5">
                        {PRESET_FACILITIES.map(f => {
                          const exists = facilities.some(x => x.name === f.name)
                          return (
                            <button key={f.name} onClick={() => !exists && addPreset(f)} disabled={exists}
                              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[9px] font-black uppercase transition-all
                                ${exists ? 'bg-slate-200 text-slate-300 cursor-not-allowed' : 'bg-white border border-slate-200 text-slate-600 hover:border-black hover:text-black hover:shadow-sm'}`}>
                              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>{f.icon}</span>
                              {f.name}
                              {exists && <span className="material-symbols-outlined" style={{ fontSize: 11 }}>check</span>}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )}
                  <div className="flex gap-2 items-center">
                    <button onClick={() => setShowPresets(s => !s)}
                      className={`flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-[9px] font-black uppercase shrink-0 transition-all
                        ${showPresets ? 'bg-black text-[#adee2b]' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                      <span className="material-symbols-outlined" style={{ fontSize: 14 }}>bolt</span>Presets
                    </button>
                    <div className="relative shrink-0">
                      <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" style={{ fontSize: 15 }}>{customIcon || 'devices'}</span>
                      <input value={customIcon} onChange={e => setCustomIcon(e.target.value)} placeholder="icon"
                        className="w-28 bg-slate-50 border border-slate-200 rounded-xl pl-8 pr-3 py-2.5 text-[11px] font-bold focus:outline-none focus:ring-2 focus:ring-[#adee2b] focus:border-transparent" />
                    </div>
                    <input value={customName} onChange={e => setCustomName(e.target.value)} onKeyDown={e => e.key === 'Enter' && addCustom()}
                      placeholder="Facility / asset name..."
                      className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-[11px] font-bold focus:outline-none focus:ring-2 focus:ring-[#adee2b] focus:border-transparent" />
                    <button onClick={addCustom}
                      className="px-4 py-2.5 bg-slate-100 text-slate-700 rounded-xl text-[9px] font-black uppercase hover:bg-slate-200 flex items-center gap-1.5 shrink-0 transition-all">
                      <span className="material-symbols-outlined" style={{ fontSize: 14 }}>add</span>Add
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Footer — always visible, action changes per tab */}
          <div className="px-7 py-5 border-t border-slate-100 shrink-0 flex gap-3">
            <button onClick={onClose} className="flex-1 py-3.5 rounded-full text-[10px] font-black uppercase tracking-[0.15em] bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors">Cancel</button>
            <button onClick={footerAction.fn} disabled={footerAction.busy}
              className="flex-1 py-3.5 rounded-full text-[10px] font-black uppercase tracking-[0.15em] bg-black text-[#adee2b] hover:bg-slate-800 disabled:opacity-40 flex items-center justify-center gap-2 transition-all">
              {footerAction.busy && <span className="material-symbols-outlined animate-spin" style={{ fontSize: 13 }}>progress_activity</span>}
              {footerAction.label}
            </button>
          </div>
        </div>
      </div>
    </>
    </ModalPortal>
  )
}

// ── Drag & Drop Room List ─────────────────────────────────────────────────────
function RoomList({ rooms, buildingId, onEdit, onDelete, onReordered }: {
  rooms: Room[]
  buildingId: number
  onEdit: (r: Room) => void
  onDelete: (r: Room) => void
  onReordered: (rooms: Room[]) => void
}) {
  const dragIdx = useRef<number | null>(null)
  const [overIdx, setOverIdx] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)

  function onDragStart(i: number) { dragIdx.current = i }
  function onDragOver(e: React.DragEvent, i: number) { e.preventDefault(); setOverIdx(i) }
  function onDragLeave() { setOverIdx(null) }

  async function onDrop(e: React.DragEvent, dropIdx: number) {
    e.preventDefault()
    setOverIdx(null)
    const from = dragIdx.current
    if (from === null || from === dropIdx) return
    const reordered = [...rooms]
    const [moved] = reordered.splice(from, 1)
    reordered.splice(dropIdx, 0, moved)
    const withOrder = reordered.map((r, i) => ({ ...r, sort_order: i + 1 }))
    onReordered(withOrder)
    setSaving(true)
    try {
      await reorderRooms(withOrder.map(r => ({ id: r.id, sort_order: r.sort_order! })))
    } finally { setSaving(false) }
    dragIdx.current = null
  }

  return (
    <div className="space-y-1.5">
      {saving && <p className="text-[9px] font-black uppercase text-slate-400 tracking-wider px-1">Saving order...</p>}
      {rooms.map((r, i) => (
        <div
          key={r.id}
          draggable
          onDragStart={() => onDragStart(i)}
          onDragOver={e => onDragOver(e, i)}
          onDragLeave={onDragLeave}
          onDrop={e => onDrop(e, i)}
          className={`flex items-center gap-3 bg-white rounded-xl border px-3 py-2.5 transition-all select-none
            ${overIdx === i ? 'border-[#adee2b] bg-[#f7fee7] scale-[1.01]' : 'border-slate-200'}`}
        >
          {/* Drag handle */}
          <span className="material-symbols-outlined text-slate-300 cursor-grab active:cursor-grabbing shrink-0" style={{ fontSize: 20 }}>drag_indicator</span>
          {/* Order number */}
          <span className="text-xs font-black text-slate-400 w-5 text-center shrink-0">{i + 1}</span>
          {/* Info */}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-black text-slate-800 leading-tight truncate">{r.name}</p>
            <p className="text-[11px] text-slate-400 font-bold mt-0.5">
              <span className="inline-flex items-center gap-0.5"><span className="material-symbols-outlined" style={{ fontSize: 11 }}>groups</span>{r.capacity} pax</span>
              {' · '}
              <span className="inline-flex items-center gap-0.5"><span className="material-symbols-outlined" style={{ fontSize: 11 }}>layers</span>{r.floor}</span>
              {r.type ? ` · ${r.type}` : ''}
            </p>
          </div>
          {/* Badges */}
          <div className="flex items-center gap-1.5 shrink-0">
            <span className={`text-[9px] font-black px-2 py-0.5 rounded-full ${r.status === 'maintenance' ? 'bg-orange-100 text-orange-600' : 'bg-green-50 text-green-700'}`}>
              {r.status === 'maintenance' ? 'Maint.' : 'Active'}
            </span>
            {r.requires_contact && <SpecialRoomBadge size="xs" />}
          </div>
          {/* Actions */}
          <button
            onClick={() => onEdit(r)}
            className="size-8 flex items-center justify-center rounded-lg bg-slate-100 text-slate-400 hover:bg-black hover:text-[#adee2b] transition-all shrink-0"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 15 }}>edit</span>
          </button>
          <button
            onClick={() => onDelete(r)}
            className="size-8 flex items-center justify-center rounded-lg bg-slate-100 text-slate-400 hover:bg-red-500 hover:text-white transition-all shrink-0"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 15 }}>delete</span>
          </button>
        </div>
      ))}
    </div>
  )
}

// ── Locations management section (inside BuildingsTab) ───────────────────────
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

  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-5 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[9px] font-black uppercase tracking-[0.25em] text-slate-400">Cities / Areas</p>
          <p className="text-xs text-slate-500 font-medium mt-0.5">Top-level geographic anchors for buildings</p>
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
        <p className="text-[11px] text-slate-400 font-medium py-2">No cities yet.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {locations.map(loc => (
            <div key={loc.id} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-50 border border-slate-100">
              <span className="material-symbols-outlined text-slate-400" style={{ fontSize: 14 }}>location_city</span>
              <div>
                <p className="text-[11px] font-black text-slate-800">{loc.name}</p>
                {loc.code && <p className="text-[9px] text-slate-400 font-bold uppercase">{loc.code}</p>}
              </div>
              <span className="text-[9px] text-slate-400 font-medium">{loc.buildings_count ?? 0} bldg</span>
              <button onClick={() => setModal({ open: true, initial: loc })}
                className="size-6 flex items-center justify-center rounded-lg text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition-all">
                <span className="material-symbols-outlined" style={{ fontSize: 13 }}>edit</span>
              </button>
              <button onClick={() => { setDeleteErr(''); setDeleteLocConfirm(''); setDeleteTarget(loc) }}
                className="size-6 flex items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-500 transition-all">
                <span className="material-symbols-outlined" style={{ fontSize: 13 }}>delete</span>
              </button>
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
        <div className="fixed inset-0 z-[1000] flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(16px)' }}
          onClick={() => { setDeleteTarget(null); setDeleteLocConfirm('') }}>
          <div
            className="w-[400px] rounded-[2rem] shadow-2xl overflow-hidden"
            style={{ background: 'rgba(255,255,255,0.94)', backdropFilter: 'blur(48px) saturate(200%)', border: '1px solid rgba(255,255,255,0.7)' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="px-7 pt-7 pb-5 bg-red-50 border-b border-red-100 flex items-center gap-3">
              <div className="size-11 rounded-2xl bg-red-100 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-red-500" style={{ fontSize: 22, fontVariationSettings: "'FILL' 1" }}>location_city</span>
              </div>
              <div>
                <p className="text-[9px] font-black uppercase tracking-[0.2em] text-red-400">Danger Zone</p>
                <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight mt-0.5">Delete City?</h3>
              </div>
            </div>
            <div className="px-7 py-5 space-y-4">
              <div className="bg-slate-50 rounded-xl px-4 py-3 flex items-center gap-3">
                <span className="material-symbols-outlined text-slate-300 shrink-0" style={{ fontSize: 20 }}>location_city</span>
                <div>
                  <p className="text-sm font-black text-slate-800">{deleteTarget.name}</p>
                  {deleteTarget.code && <p className="text-[10px] text-slate-400 font-bold uppercase mt-0.5">{deleteTarget.code}</p>}
                </div>
              </div>
              <p className="text-[11px] text-slate-500 font-medium leading-relaxed">
                Buildings assigned to this city will be unlinked but not deleted. <span className="font-black text-slate-700">This cannot be undone.</span>
              </p>
              <div className="space-y-1.5">
                <label className="text-[9px] font-black uppercase tracking-wider text-slate-400 px-1">
                  Type <span className="normal-case text-slate-700">"{deleteTarget.name}"</span> to confirm
                </label>
                <input
                  value={deleteLocConfirm}
                  onChange={e => setDeleteLocConfirm(e.target.value)}
                  placeholder={deleteTarget.name}
                  autoFocus
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-red-300 focus:border-transparent"
                />
              </div>
              {deleteErr && (
                <div className="flex items-center gap-2 bg-red-50 border border-red-100 text-red-600 text-[11px] font-bold px-3 py-2.5 rounded-xl">
                  <span className="material-symbols-outlined shrink-0" style={{ fontSize: 14 }}>error</span>{deleteErr}
                </div>
              )}
              <div className="flex gap-3 pt-1">
                <button onClick={() => { setDeleteTarget(null); setDeleteLocConfirm('') }}
                  className="flex-1 py-3.5 rounded-full text-[10px] font-black uppercase tracking-[0.15em] bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors">Cancel</button>
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
    } catch { setErr('Failed to save.') } finally { setSaving(false) }
  }

  return (
    <ModalPortal>
    <div className="fixed inset-0 z-[1100] flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(12px)' }} onClick={onClose}>
      <div className="bg-white rounded-3xl shadow-2xl w-[360px] p-7 space-y-4" onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-black uppercase tracking-tight">{initial?.id ? 'Edit City' : 'Add City'}</h3>
        {err && <p className="text-xs text-red-500 font-bold">{err}</p>}
        <div className="space-y-3">
          <div className="space-y-1">
            <label className="text-[9px] font-black uppercase text-slate-400 tracking-wider">City / Area Name *</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Jakarta"
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-[#adee2b]" />
          </div>
          <div className="space-y-1">
            <label className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Code (optional)</label>
            <input value={code} onChange={e => setCode(e.target.value)} placeholder="e.g. JKT"
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-[#adee2b]" />
          </div>
        </div>
        <div className="flex gap-3 pt-1">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl bg-slate-100 text-slate-600 text-[10px] font-black uppercase hover:bg-slate-200">Cancel</button>
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

// ── Buildings Tab ────────────────────────────────────────────────────────────
function BuildingsTab() {
  const qc = useQueryClient()
  const { data: buildings = [], isLoading } = useQuery({ queryKey: ['buildings'], queryFn: getBuildings })
  const { data: allRooms = [] } = useQuery({ queryKey: ['rooms'], queryFn: getRooms })
  const { data: locations = [] } = useQuery<Location[]>({ queryKey: ['locations'], queryFn: getLocations })

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

  const effectiveRooms = localRooms ?? (allRooms as Room[])

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

  if (isLoading) return <div className="flex items-center justify-center h-48 text-slate-400 text-sm font-bold">Loading...</div>

  return (
    <div className="max-w-4xl space-y-5">
      <div className="flex items-end justify-between">
        <div>
          <p className="text-[9px] font-black uppercase tracking-[0.25em] text-slate-400 mb-1">Admin Dashboard</p>
          <h1 className="text-3xl font-black italic tracking-tighter uppercase">Buildings</h1>
        </div>
        <button
          onClick={() => setBuildingModal({ open: true })}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-black text-[#adee2b] text-[10px] font-black uppercase hover:bg-slate-800 transition-colors"
        >
          <span className="material-symbols-outlined text-sm">add</span>
          Add Building
        </button>
      </div>

      <LocationsSection />

      {buildings.length === 0 && (
        <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center">
          <span className="material-symbols-outlined text-slate-300 text-5xl">domain</span>
          <p className="text-slate-400 font-bold mt-3">No buildings yet.</p>
          <button onClick={() => setBuildingModal({ open: true })}
            className="mt-4 px-4 py-2 rounded-xl bg-black text-[#adee2b] text-[10px] font-black uppercase">
            Add First Building
          </button>
        </div>
      )}

      <div className="space-y-3">
        {buildings.map(b => {
          const rooms = roomsFor(b.id)
          const isExpanded = expanded === b.id

          return (
            <div key={b.id} className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
              {/* Building header row */}
              <div className="flex items-center gap-4 px-5 py-4">
                {/* Photo or placeholder */}
                <div className="size-14 rounded-xl overflow-hidden shrink-0 bg-slate-100 flex items-center justify-center">
                  {b.photo
                    ? <img src={b.photo} className="w-full h-full object-cover" />
                    : <span className="material-symbols-outlined text-slate-300" style={{ fontSize: 28 }}>domain</span>}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-base font-black text-slate-900">{b.name}</p>
                    {b.code && (
                      <span className="px-2 py-0.5 rounded-full bg-slate-100 text-[10px] font-black uppercase text-slate-500">{b.code}</span>
                    )}
                    {b.location && (
                      <span className="px-2 py-0.5 rounded-full bg-blue-50 text-[10px] font-black uppercase text-blue-500">{b.location.name}</span>
                    )}
                    {!b.is_active && (
                      <span className="px-2 py-0.5 rounded-full bg-red-50 text-[10px] font-black uppercase text-red-400">Inactive</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-1">
                    {b.address && (
                      <span className="flex items-center gap-1 text-[11px] text-slate-400 font-medium truncate">
                        <span className="material-symbols-outlined" style={{ fontSize: 13 }}>location_on</span>
                        {b.address}
                      </span>
                    )}
                    <span className="flex items-center gap-1 text-[11px] text-slate-400 font-bold shrink-0">
                      <span className="material-symbols-outlined" style={{ fontSize: 13 }}>layers</span>
                      {b.floors} floor{b.floors !== 1 ? 's' : ''}
                    </span>
                    <span className="flex items-center gap-1 text-[11px] font-black text-slate-600 shrink-0">
                      <span className="material-symbols-outlined" style={{ fontSize: 13 }}>meeting_room</span>
                      {rooms.length} room{rooms.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => setBuildingModal({ open: true, initial: b })}
                    className="size-9 flex items-center justify-center rounded-lg bg-slate-100 text-slate-500 hover:bg-black hover:text-[#adee2b] transition-all"
                    title="Edit building"
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 17 }}>edit</span>
                  </button>
                  <button
                    onClick={() => { setDeleteErr(''); setConfirmBuildingInput(''); setDeleteTarget(b) }}
                    className="size-9 flex items-center justify-center rounded-lg bg-slate-100 text-slate-500 hover:bg-red-50 hover:text-red-500 transition-all"
                    title="Delete building"
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 17 }}>delete</span>
                  </button>
                  <button
                    onClick={() => setExpanded(isExpanded ? null : b.id)}
                    className="size-9 flex items-center justify-center rounded-lg bg-slate-100 text-slate-500 hover:bg-slate-200 transition-all"
                  >
                    <span className="material-symbols-outlined transition-transform duration-200" style={{ fontSize: 22, transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}>expand_more</span>
                  </button>
                </div>
              </div>

              {/* Expanded rooms list */}
              {isExpanded && (
                <div className="border-t border-slate-100 bg-slate-50 px-5 py-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] font-black uppercase text-slate-400 tracking-wider">Rooms in {b.name}</p>
                    <button
                      onClick={() => setRoomModal({ open: true, buildingId: b.id })}
                      className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-black text-[#adee2b] text-[10px] font-black uppercase hover:bg-slate-800 transition-colors"
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: 14 }}>add</span>
                      Add Room
                    </button>
                  </div>

                  {rooms.length === 0 ? (
                    <p className="text-xs text-slate-400 font-medium py-2">No rooms yet in this building.</p>
                  ) : (
                    <RoomList
                      rooms={rooms}
                      buildingId={b.id}
                      onEdit={r => setRoomModal({ open: true, buildingId: b.id, initial: r })}
                      onDelete={r => { setDeleteRoomTarget(r); setDeleteRoomErr(''); setConfirmRoomInput('') }}
                      onReordered={reordered => handleRoomReorder(b.id, reordered)}
                    />
                  )}
                </div>
              )}
            </div>
          )
        })}
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
        <div className="fixed inset-0 z-[1000] flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(16px)' }}
          onClick={() => { setDeleteTarget(null); setConfirmBuildingInput('') }}>
          <div
            className="w-[420px] rounded-[2rem] shadow-2xl overflow-hidden"
            style={{ background: 'rgba(255,255,255,0.94)', backdropFilter: 'blur(48px) saturate(200%)', border: '1px solid rgba(255,255,255,0.7)' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="px-7 pt-7 pb-5 bg-red-50 border-b border-red-100 flex items-center gap-3">
              <div className="size-11 rounded-2xl bg-red-100 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-red-500" style={{ fontSize: 22, fontVariationSettings: "'FILL' 1" }}>domain</span>
              </div>
              <div>
                <p className="text-[9px] font-black uppercase tracking-[0.2em] text-red-400">Danger Zone</p>
                <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight mt-0.5">Delete Building?</h3>
              </div>
            </div>
            <div className="px-7 py-5 space-y-4">
              <div className="bg-slate-50 rounded-xl px-4 py-3 flex items-center gap-3">
                <span className="material-symbols-outlined text-slate-300 shrink-0" style={{ fontSize: 22 }}>domain</span>
                <div>
                  <p className="text-sm font-black text-slate-800">{deleteTarget.name}</p>
                  {deleteTarget.address && <p className="text-[10px] text-slate-400 font-medium mt-0.5">{deleteTarget.address}</p>}
                </div>
              </div>
              <p className="text-[11px] text-slate-500 font-medium leading-relaxed">
                All rooms inside this building will also be deleted. <span className="font-black text-slate-700">This cannot be undone.</span>
              </p>
              <div className="space-y-1.5">
                <label className="text-[9px] font-black uppercase tracking-wider text-slate-400 px-1">
                  Type <span className="normal-case text-slate-700">"{deleteTarget.name}"</span> to confirm
                </label>
                <input
                  value={confirmBuildingInput}
                  onChange={e => setConfirmBuildingInput(e.target.value)}
                  placeholder={deleteTarget.name}
                  autoFocus
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-red-300 focus:border-transparent"
                />
              </div>
              {deleteErr && (
                <div className="flex items-center gap-2 bg-red-50 border border-red-100 text-red-600 text-[11px] font-bold px-3 py-2.5 rounded-xl">
                  <span className="material-symbols-outlined shrink-0" style={{ fontSize: 14 }}>error</span>{deleteErr}
                </div>
              )}
              <div className="flex gap-3 pt-1">
                <button onClick={() => { setDeleteTarget(null); setConfirmBuildingInput('') }}
                  className="flex-1 py-3.5 rounded-full text-[10px] font-black uppercase tracking-[0.15em] bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors">Cancel</button>
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
            style={{ background: 'rgba(255,255,255,0.94)', backdropFilter: 'blur(48px) saturate(200%)', border: '1px solid rgba(255,255,255,0.7)' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="px-7 pt-7 pb-5 bg-red-50 border-b border-red-100 flex items-center gap-3">
              <div className="size-11 rounded-2xl bg-red-100 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-red-500" style={{ fontSize: 22, fontVariationSettings: "'FILL' 1" }}>meeting_room</span>
              </div>
              <div>
                <p className="text-[9px] font-black uppercase tracking-[0.2em] text-red-400">Danger Zone</p>
                <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight mt-0.5">Delete Room?</h3>
              </div>
            </div>
            <div className="px-7 py-5 space-y-4">
              <div className="bg-slate-50 rounded-xl px-4 py-3 flex items-center gap-3">
                <span className="material-symbols-outlined text-slate-300 shrink-0" style={{ fontSize: 22 }}>meeting_room</span>
                <div>
                  <p className="text-sm font-black text-slate-800">{deleteRoomTarget.name}</p>
                  <p className="text-[10px] text-slate-400 font-bold mt-0.5">
                    {deleteRoomTarget.capacity} pax · {deleteRoomTarget.floor}
                    {deleteRoomTarget.requires_contact && ' · Special Room'}
                  </p>
                </div>
              </div>
              <p className="text-[11px] text-slate-500 font-medium leading-relaxed">
                Existing bookings linked to this room may be affected. <span className="font-black text-slate-700">This cannot be undone.</span>
              </p>
              <div className="space-y-1.5">
                <label className="text-[9px] font-black uppercase tracking-wider text-slate-400 px-1">
                  Type <span className="normal-case text-slate-700">"{deleteRoomTarget.name}"</span> to confirm
                </label>
                <input
                  value={confirmRoomInput}
                  onChange={e => setConfirmRoomInput(e.target.value)}
                  placeholder={deleteRoomTarget.name}
                  autoFocus
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-red-300 focus:border-transparent"
                />
              </div>
              {deleteRoomErr && (
                <div className="flex items-center gap-2 bg-red-50 border border-red-100 text-red-600 text-[11px] font-bold px-3 py-2.5 rounded-xl">
                  <span className="material-symbols-outlined shrink-0" style={{ fontSize: 14 }}>error</span>
                  {deleteRoomErr}
                </div>
              )}
              <div className="flex gap-3 pt-1">
                <button
                  onClick={() => { setDeleteRoomTarget(null); setDeleteRoomErr(''); setConfirmRoomInput('') }}
                  className="flex-1 py-3.5 rounded-full text-[10px] font-black uppercase tracking-[0.15em] bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors"
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


// ── Assets / Inventory Tab ───────────────────────────────────────────────────

const STATUS_META: Record<AssetStatus, { label: string; bg: string; text: string; dot: string }> = {
  active:  { label: 'Active',  bg: 'bg-green-100',  text: 'text-green-700',  dot: 'bg-green-500' },
  rusak:   { label: 'Rusak',   bg: 'bg-red-100',    text: 'text-red-600',    dot: 'bg-red-500' },
  service: { label: 'Service', bg: 'bg-orange-100', text: 'text-orange-600', dot: 'bg-orange-500' },
  hilang:  { label: 'Hilang',  bg: 'bg-slate-100',  text: 'text-slate-500',  dot: 'bg-slate-400' },
  indent:  { label: 'Indent',  bg: 'bg-blue-100',   text: 'text-blue-600',   dot: 'bg-blue-500' },
}
const ASSET_STATUSES: AssetStatus[] = ['active', 'rusak', 'service', 'hilang', 'indent']

function StatusBadge({ status, onChange }: { status: AssetStatus; onChange?: (s: AssetStatus) => void }) {
  const m = STATUS_META[status]
  if (!onChange) return (
    <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[9px] font-black uppercase ${m.bg} ${m.text}`}>
      <span className={`size-1.5 rounded-full ${m.dot}`} />{m.label}
    </span>
  )
  return (
    <div className="relative group/sb">
      <button className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[9px] font-black uppercase cursor-pointer ${m.bg} ${m.text}`}>
        <span className={`size-1.5 rounded-full ${m.dot}`} />{m.label}
        <span className="material-symbols-outlined" style={{ fontSize: 11 }}>expand_more</span>
      </button>
      <div className="absolute left-0 top-full mt-1 z-50 hidden group-hover/sb:flex flex-col bg-white rounded-xl border border-slate-100 shadow-xl overflow-hidden min-w-[110px]">
        {ASSET_STATUSES.filter(s => s !== status).map(s => {
          const sm = STATUS_META[s]
          return (
            <button key={s} onClick={() => onChange(s)}
              className={`flex items-center gap-2 px-3 py-2 text-[9px] font-black uppercase hover:bg-slate-50 ${sm.text}`}>
              <span className={`size-1.5 rounded-full ${sm.dot}`} />{sm.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// Modal: add/edit asset type
function AssetTypeModal({ initial, onSave, onClose }: {
  initial?: Partial<Asset>
  onSave: (d: Partial<Asset>) => Promise<void>
  onClose: () => void
}) {
  const [name, setName]         = useState(initial?.name ?? '')
  const [category, setCategory] = useState(initial?.category ?? '')
  const [icon, setIcon]         = useState(initial?.icon ?? '')
  const [notes, setNotes]       = useState(initial?.notes ?? '')
  const [saving, setSaving]     = useState(false)
  const [err, setErr]           = useState('')

  async function handleSave() {
    if (!name.trim()) { setErr('Name is required'); return }
    setSaving(true); setErr('')
    try {
      await onSave({ name: name.trim(), category: category.trim() || undefined, icon: icon.trim() || undefined, notes: notes.trim() || undefined })
      onClose()
    } catch { setErr('Failed to save.') } finally { setSaving(false) }
  }

  return (
    <ModalPortal>
    <div className="fixed inset-0 z-[1000] flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(12px)' }} onClick={onClose}>
      <div className="bg-white rounded-3xl shadow-2xl w-[400px] p-7 space-y-4" onClick={e => e.stopPropagation()}>
        <h3 className="text-base font-black uppercase tracking-tight">{initial?.id ? 'Edit Asset Type' : 'Register Asset Type'}</h3>
        {err && <p className="text-xs text-red-500 font-bold">{err}</p>}
        <div className="space-y-3">
          <div className="space-y-1">
            <label className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Name *</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Projector Epson EB"
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-[#adee2b]" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Category</label>
              <input value={category} onChange={e => setCategory(e.target.value)} placeholder="e.g. AV, IT, Furniture"
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-[#adee2b]" />
            </div>
            <div className="space-y-1">
              <label className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Icon</label>
              <div className="relative">
                {icon && <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" style={{ fontSize: 16 }}>{icon}</span>}
                <input value={icon} onChange={e => setIcon(e.target.value)} placeholder="present_to_all"
                  className={`w-full border border-slate-200 rounded-xl py-2 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-[#adee2b] ${icon ? 'pl-9 pr-3' : 'px-3'}`} />
              </div>
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Notes</label>
            <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Brand, spec, dsb."
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-[#adee2b]" />
          </div>
        </div>
        <div className="flex gap-3 pt-1">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-[10px] font-black uppercase text-slate-500 hover:bg-slate-50">Cancel</button>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 py-2.5 rounded-xl bg-black text-[#adee2b] text-[10px] font-black uppercase hover:opacity-80 disabled:opacity-50 flex items-center justify-center gap-2">
            {saving && <span className="material-symbols-outlined animate-spin" style={{ fontSize: 13 }}>progress_activity</span>}
            {initial?.id ? 'Save' : 'Register'}
          </button>
        </div>
      </div>
    </div>
    </ModalPortal>
  )
}

// Modal: add/edit asset unit
function AssetUnitModal({ assetName, rooms, initial, onSave, onClose }: {
  assetName: string
  rooms: Room[]
  initial?: Partial<AssetUnit>
  onSave: (d: Partial<AssetUnit>) => Promise<void>
  onClose: () => void
}) {
  const [roomId, setRoomId]     = useState<string>(initial?.room_id ? String(initial.room_id) : '')
  const [unitCode, setUnitCode] = useState(initial?.unit_code ?? '')
  const [status, setStatus]     = useState<AssetStatus>(initial?.status ?? 'active')
  const [notes, setNotes]       = useState(initial?.notes ?? '')
  const [saving, setSaving]     = useState(false)

  async function handleSave() {
    setSaving(true)
    try {
      await onSave({ room_id: roomId ? Number(roomId) : undefined, unit_code: unitCode.trim() || undefined, status, notes: notes.trim() || undefined })
      onClose()
    } finally { setSaving(false) }
  }

  return (
    <ModalPortal>
    <div className="fixed inset-0 z-[1000] flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(12px)' }} onClick={onClose}>
      <div className="bg-white rounded-3xl shadow-2xl w-[380px] p-7 space-y-4" onClick={e => e.stopPropagation()}>
        <div>
          <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">{assetName}</p>
          <h3 className="text-base font-black uppercase tracking-tight mt-0.5">{initial?.id ? 'Edit Unit' : 'Add Unit'}</h3>
        </div>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Unit Code / Serial</label>
              <input value={unitCode} onChange={e => setUnitCode(e.target.value)} placeholder="e.g. PRJ-001"
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-[#adee2b]" />
            </div>
            <div className="space-y-1">
              <label className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Ruangan</label>
              <select value={roomId} onChange={e => setRoomId(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-[#adee2b] bg-white">
                <option value="">— Tidak ada / Gudang —</option>
                {rooms.map(r => <option key={r.id} value={r.id}>{r.name}{r.floor ? ` (${r.floor})` : ''}</option>)}
              </select>
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Status</label>
            <div className="flex gap-2 flex-wrap">
              {ASSET_STATUSES.map(s => {
                const m = STATUS_META[s]
                return (
                  <button key={s} onClick={() => setStatus(s)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[9px] font-black uppercase transition-all border
                      ${status === s ? `${m.bg} ${m.text} border-transparent` : 'bg-white border-slate-200 text-slate-400 hover:border-slate-300'}`}>
                    <span className={`size-1.5 rounded-full ${m.dot}`} />{m.label}
                  </button>
                )
              })}
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Notes</label>
            <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Kondisi, catatan, dsb."
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-[#adee2b]" />
          </div>
        </div>
        <div className="flex gap-3 pt-1">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-[10px] font-black uppercase text-slate-500 hover:bg-slate-50">Cancel</button>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 py-2.5 rounded-xl bg-black text-[#adee2b] text-[10px] font-black uppercase hover:opacity-80 disabled:opacity-50 flex items-center justify-center gap-2">
            {saving && <span className="material-symbols-outlined animate-spin" style={{ fontSize: 13 }}>progress_activity</span>}
            {initial?.id ? 'Save' : 'Add Unit'}
          </button>
        </div>
      </div>
    </div>
    </ModalPortal>
  )
}

function AssetsTab() {
  const qc = useQueryClient()
  const { data: assets = [], isLoading } = useQuery<Asset[]>({ queryKey: ['assets'], queryFn: getAssets })
  const { data: rooms = [] } = useQuery<Room[]>({ queryKey: ['rooms'], queryFn: getRooms })

  const [search, setSearch]             = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [expanded, setExpanded]         = useState<Set<number>>(new Set())
  const [typeModal, setTypeModal]       = useState<{ open: boolean; target: Asset | null }>({ open: false, target: null })
  const [unitModal, setUnitModal]       = useState<{ open: boolean; asset: Asset | null; unit: AssetUnit | null }>({ open: false, asset: null, unit: null })
  const [deleteAssetTarget, setDeleteAssetTarget] = useState<Asset | null>(null)
  const [deleteUnitTarget, setDeleteUnitTarget]   = useState<{ asset: Asset; unit: AssetUnit } | null>(null)
  const [deleting, setDeleting] = useState(false)

  function toggleExpand(id: number) {
    setExpanded(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

  // Counts across all units
  const unitCounts = useMemo(() => {
    const c: Record<string, number> = { total: 0 }
    ASSET_STATUSES.forEach(s => { c[s] = 0 })
    ;(assets as Asset[]).forEach(a => (a.units ?? []).forEach(u => { c.total++; c[u.status] = (c[u.status] ?? 0) + 1 }))
    return c
  }, [assets])

  const categories = useMemo(() =>
    [...new Set((assets as Asset[]).map(a => a.category).filter(Boolean))].sort() as string[]
  , [assets])

  const filtered = useMemo(() => (assets as Asset[]).filter(a => {
    if (categoryFilter && a.category !== categoryFilter) return false
    if (search && !a.name.toLowerCase().includes(search.toLowerCase()) && !(a.category ?? '').toLowerCase().includes(search.toLowerCase())) return false
    return true
  }), [assets, search, categoryFilter])

  async function handleSaveType(data: Partial<Asset>) {
    if (typeModal.target?.id) { await updateAsset(typeModal.target.id, data) }
    else { const a = await createAsset(data); setExpanded(p => new Set(p).add(a.id)) }
    qc.invalidateQueries({ queryKey: ['assets'] })
  }

  async function handleSaveUnit(asset: Asset, data: Partial<AssetUnit>, unitId?: number) {
    if (unitId) await updateAssetUnit(asset.id, unitId, data)
    else await createAssetUnit(asset.id, data)
    qc.invalidateQueries({ queryKey: ['assets'] })
  }

  async function handleDeleteAsset() {
    if (!deleteAssetTarget) return
    setDeleting(true)
    try { await deleteAsset(deleteAssetTarget.id); qc.invalidateQueries({ queryKey: ['assets'] }); setDeleteAssetTarget(null) }
    finally { setDeleting(false) }
  }

  async function handleDeleteUnit() {
    if (!deleteUnitTarget) return
    setDeleting(true)
    try { await deleteAssetUnit(deleteUnitTarget.asset.id, deleteUnitTarget.unit.id); qc.invalidateQueries({ queryKey: ['assets'] }); setDeleteUnitTarget(null) }
    finally { setDeleting(false) }
  }

  async function quickUnitStatus(asset: Asset, unit: AssetUnit, status: AssetStatus) {
    await updateAssetUnit(asset.id, unit.id, { status })
    qc.invalidateQueries({ queryKey: ['assets'] })
  }

  return (
    <div className="space-y-5 max-w-5xl">
      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <p className="text-[9px] font-black uppercase tracking-[0.25em] text-slate-400 mb-1">Inventory</p>
          <h1 className="text-3xl font-black italic tracking-tighter uppercase">Assets</h1>
        </div>
        <button onClick={() => setTypeModal({ open: true, target: null })}
          className="flex items-center gap-2 px-5 py-2.5 bg-black text-[#adee2b] rounded-2xl text-[10px] font-black uppercase hover:opacity-80 transition-all">
          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>add</span>Register Asset
        </button>
      </div>

      {/* Stat cards — unit-level counts */}
      <div className="grid grid-cols-6 gap-3">
        {([
          { label: 'Total Units', value: unitCounts.total, cls: 'bg-black', valCls: 'text-[#adee2b]', subCls: 'text-slate-500' },
          ...ASSET_STATUSES.map(s => { const m = STATUS_META[s]; return { label: m.label, value: unitCounts[s] ?? 0, cls: 'bg-white border border-slate-100', valCls: m.text, subCls: 'text-slate-400' } }),
        ] as { label: string; value: number; cls: string; valCls: string; subCls: string }[]).map(c => (
          <div key={c.label} className={`${c.cls} rounded-2xl p-4`}>
            <p className={`text-[8px] font-black uppercase tracking-widest ${c.subCls}`}>{c.label}</p>
            <p className={`text-2xl font-black italic mt-0.5 ${c.valCls}`}>{c.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none" style={{ fontSize: 15 }}>search</span>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search asset types..."
            className="w-52 bg-white border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-[11px] font-bold focus:outline-none focus:ring-2 focus:ring-[#adee2b] focus:border-transparent" />
        </div>
        {categories.length > 0 && (
          <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}
            className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-[11px] font-bold focus:outline-none focus:ring-2 focus:ring-[#adee2b] text-slate-600">
            <option value="">All Categories</option>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        )}
        <span className="text-[10px] font-black text-slate-400">{filtered.length} types · {unitCounts.total} units</span>
      </div>

      {/* Asset list */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <span className="material-symbols-outlined animate-spin text-3xl text-slate-300">progress_activity</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <span className="material-symbols-outlined text-slate-200" style={{ fontSize: 48 }}>inventory_2</span>
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-300">
            {(assets as Asset[]).length === 0 ? 'No assets registered yet' : 'No assets match the filter'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(asset => {
            const units = asset.units ?? []
            const isOpen = expanded.has(asset.id)
            const unitStatusCounts = ASSET_STATUSES.map(s => ({ s, n: units.filter(u => u.status === s).length })).filter(x => x.n > 0)

            return (
              <div key={asset.id} className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
                {/* Asset type row */}
                <div className="flex items-center gap-4 px-5 py-4 hover:bg-slate-50 transition-colors cursor-pointer" onClick={() => toggleExpand(asset.id)}>
                  {/* Expand chevron */}
                  <span className={`material-symbols-outlined text-slate-300 transition-transform duration-200 shrink-0 ${isOpen ? 'rotate-90' : ''}`} style={{ fontSize: 18 }}>chevron_right</span>

                  {/* Icon + name */}
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="size-9 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
                      <span className="material-symbols-outlined text-slate-500" style={{ fontSize: 18 }}>{asset.icon || 'inventory_2'}</span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-[12px] font-black text-slate-800">{asset.name}</p>
                      {asset.notes && <p className="text-[9px] text-slate-400 truncate">{asset.notes}</p>}
                    </div>
                  </div>

                  {/* Category */}
                  {asset.category && (
                    <span className="px-2.5 py-1 bg-slate-100 rounded-lg text-[9px] font-black uppercase text-slate-500 shrink-0">{asset.category}</span>
                  )}

                  {/* Unit status summary */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    {units.length === 0 ? (
                      <span className="text-[9px] font-black text-slate-300 uppercase">No units</span>
                    ) : (
                      <>
                        <span className="text-[10px] font-black text-slate-400">{units.length} unit{units.length !== 1 ? 's' : ''}</span>
                        <span className="text-slate-200">·</span>
                        {unitStatusCounts.map(({ s, n }) => {
                          const m = STATUS_META[s]
                          return (
                            <span key={s} className={`flex items-center gap-1 px-2 py-0.5 rounded-lg text-[8px] font-black uppercase ${m.bg} ${m.text}`}>
                              <span className={`size-1 rounded-full ${m.dot}`} />{n}
                            </span>
                          )
                        })}
                      </>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                    <button onClick={() => setUnitModal({ open: true, asset, unit: null })}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-100 text-slate-600 text-[9px] font-black uppercase hover:bg-slate-200 transition-colors">
                      <span className="material-symbols-outlined" style={{ fontSize: 13 }}>add</span>Unit
                    </button>
                    <button onClick={() => setTypeModal({ open: true, target: asset })}
                      className="size-7 flex items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 transition-colors">
                      <span className="material-symbols-outlined" style={{ fontSize: 14 }}>edit</span>
                    </button>
                    <button onClick={() => setDeleteAssetTarget(asset)}
                      className="size-7 flex items-center justify-center rounded-xl text-slate-300 hover:bg-red-50 hover:text-red-500 transition-colors">
                      <span className="material-symbols-outlined" style={{ fontSize: 14 }}>delete</span>
                    </button>
                  </div>
                </div>

                {/* Sub-tree: units */}
                {isOpen && (
                  <div className="border-t border-slate-50">
                    {units.length === 0 ? (
                      <div className="flex items-center gap-3 px-14 py-4 text-slate-300">
                        <span className="material-symbols-outlined" style={{ fontSize: 16 }}>subdirectory_arrow_right</span>
                        <span className="text-[10px] font-black uppercase tracking-wider">No units yet —</span>
                        <button onClick={() => setUnitModal({ open: true, asset, unit: null })}
                          className="text-[10px] font-black uppercase text-slate-500 underline underline-offset-2 hover:text-black transition-colors">Add first unit</button>
                      </div>
                    ) : (
                      <table className="w-full">
                        <thead>
                          <tr className="bg-slate-50/70">
                            <th className="w-8" />
                            <th className="text-left px-4 py-2.5 text-[8px] font-black uppercase tracking-widest text-slate-400">Unit Code</th>
                            <th className="text-left px-4 py-2.5 text-[8px] font-black uppercase tracking-widest text-slate-400">Room</th>
                            <th className="text-left px-4 py-2.5 text-[8px] font-black uppercase tracking-widest text-slate-400">Building</th>
                            <th className="text-left px-4 py-2.5 text-[8px] font-black uppercase tracking-widest text-slate-400">Status</th>
                            <th className="text-left px-4 py-2.5 text-[8px] font-black uppercase tracking-widest text-slate-400">Notes</th>
                            <th />
                          </tr>
                        </thead>
                        <tbody>
                          {units.map((unit, i) => (
                            <tr key={unit.id} className={`hover:bg-slate-50 transition-colors ${i < units.length - 1 ? 'border-b border-slate-50' : ''}`}>
                              <td className="pl-5 pr-1 py-3 text-slate-200">
                                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>subdirectory_arrow_right</span>
                              </td>
                              <td className="px-4 py-3">
                                <span className="text-[11px] font-black text-slate-700 font-mono">{unit.unit_code || <span className="text-slate-300">—</span>}</span>
                              </td>
                              <td className="px-4 py-3">
                                <span className="text-[11px] font-bold text-slate-600">{unit.room?.name ?? <span className="text-slate-300">Gudang / Unassigned</span>}</span>
                              </td>
                              <td className="px-4 py-3">
                                <span className="text-[10px] font-bold text-slate-400">{unit.room?.building?.name ?? '—'}</span>
                              </td>
                              <td className="px-4 py-3">
                                <StatusBadge status={unit.status} onChange={s => quickUnitStatus(asset, unit, s)} />
                              </td>
                              <td className="px-4 py-3">
                                <span className="text-[10px] text-slate-400 truncate max-w-[140px] block">{unit.notes || '—'}</span>
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-1 justify-end">
                                  <button onClick={() => setUnitModal({ open: true, asset, unit })}
                                    className="size-7 flex items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 transition-colors">
                                    <span className="material-symbols-outlined" style={{ fontSize: 13 }}>edit</span>
                                  </button>
                                  <button onClick={() => setDeleteUnitTarget({ asset, unit })}
                                    className="size-7 flex items-center justify-center rounded-xl text-slate-300 hover:bg-red-50 hover:text-red-500 transition-colors">
                                    <span className="material-symbols-outlined" style={{ fontSize: 13 }}>delete</span>
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Modals */}
      {typeModal.open && (
        <AssetTypeModal initial={typeModal.target ?? undefined} onSave={handleSaveType} onClose={() => setTypeModal({ open: false, target: null })} />
      )}
      {unitModal.open && unitModal.asset && (
        <AssetUnitModal
          assetName={unitModal.asset.name}
          rooms={rooms as Room[]}
          initial={unitModal.unit ?? undefined}
          onSave={d => handleSaveUnit(unitModal.asset!, d, unitModal.unit?.id)}
          onClose={() => setUnitModal({ open: false, asset: null, unit: null })}
        />
      )}

      {/* Delete asset confirm */}
      {deleteAssetTarget && (
        <ModalPortal>
        <div className="fixed inset-0 z-[1000] flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(8px)' }} onClick={() => setDeleteAssetTarget(null)}>
          <div className="bg-white rounded-3xl p-7 w-80 space-y-4 shadow-2xl" onClick={e => e.stopPropagation()}>
            <p className="text-sm font-black uppercase">Delete Asset Type?</p>
            <p className="text-[11px] text-slate-500">Semua <span className="font-black text-slate-800">{deleteAssetTarget.units?.length ?? 0} unit</span> dari <span className="font-black text-slate-800">{deleteAssetTarget.name}</span> juga akan dihapus.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteAssetTarget(null)} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-[10px] font-black uppercase text-slate-500 hover:bg-slate-50">Cancel</button>
              <button onClick={handleDeleteAsset} disabled={deleting} className="flex-1 py-2.5 rounded-xl bg-red-500 text-white text-[10px] font-black uppercase hover:bg-red-600 disabled:opacity-50">
                {deleting ? 'Deleting...' : 'Delete All'}
              </button>
            </div>
          </div>
        </div>
        </ModalPortal>
      )}

      {/* Delete unit confirm */}
      {deleteUnitTarget && (
        <ModalPortal>
        <div className="fixed inset-0 z-[1000] flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(8px)' }} onClick={() => setDeleteUnitTarget(null)}>
          <div className="bg-white rounded-3xl p-7 w-80 space-y-4 shadow-2xl" onClick={e => e.stopPropagation()}>
            <p className="text-sm font-black uppercase">Remove Unit?</p>
            <p className="text-[11px] text-slate-500">Unit <span className="font-black text-slate-800">{deleteUnitTarget.unit.unit_code || `#${deleteUnitTarget.unit.id}`}</span> dari {deleteUnitTarget.asset.name} akan dihapus.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteUnitTarget(null)} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-[10px] font-black uppercase text-slate-500 hover:bg-slate-50">Cancel</button>
              <button onClick={handleDeleteUnit} disabled={deleting} className="flex-1 py-2.5 rounded-xl bg-red-500 text-white text-[10px] font-black uppercase hover:bg-red-600 disabled:opacity-50">
                {deleting ? 'Deleting...' : 'Remove'}
              </button>
            </div>
          </div>
        </div>
        </ModalPortal>
      )}
    </div>
  )
}

// ── Users Tab ────────────────────────────────────────────────────────────────

const ROLE_META: Record<UserRole, { label: string; bg: string; text: string }> = {
  admin:          { label: 'Super Admin',    bg: 'bg-black',       text: 'text-[#adee2b]' },
  building_admin: { label: 'Building Admin', bg: 'bg-blue-100',    text: 'text-blue-700' },
  receptionist:   { label: 'Receptionist',  bg: 'bg-purple-100',  text: 'text-purple-700' },
  user:           { label: 'User',           bg: 'bg-slate-100',   text: 'text-slate-500' },
}
const ALL_ROLES: UserRole[] = ['admin', 'building_admin', 'receptionist', 'user']

// ── Shared building picker (used in Add + Edit modals) ───────────────────────
function BuildingPicker({ role, bldIds, buildings, locations, onToggle }: {
  role: UserRole
  bldIds: number[]
  buildings: Building[]
  locations: Location[]
  onToggle: (id: number) => void
}) {
  const withLocation    = buildings.filter(b => b.location_id)
  const withoutLocation = buildings.filter(b => !b.location_id)
  const locGroups = locations
    .map(loc => ({ loc, buildings: withLocation.filter(b => b.location_id === loc.id) }))
    .filter(g => g.buildings.length > 0)

  function Row({ b }: { b: Building }) {
    const checked = bldIds.includes(b.id)
    return (
      <button onClick={() => onToggle(b.id)}
        className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl border mb-1 transition-all text-left
          ${checked ? 'bg-blue-50 border-blue-200 text-blue-800' : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'}`}>
        <span className={`size-4 rounded-md border-2 flex items-center justify-center shrink-0 transition-all ${checked ? 'bg-blue-500 border-blue-500' : 'border-slate-300'}`}>
          {checked && <span className="material-symbols-outlined text-white" style={{ fontSize: 11 }}>check</span>}
        </span>
        <div className="min-w-0">
          <p className="text-[11px] font-black truncate">{b.name}</p>
          {b.address && <p className="text-[9px] text-slate-400 truncate">{b.address}</p>}
        </div>
      </button>
    )
  }

  return (
    <div className="space-y-2">
      <p className="text-[9px] font-black uppercase tracking-wider text-slate-400">
        {role === 'building_admin' ? 'Assigned Buildings' : 'Assigned Location / Buildings'}
      </p>
      <div className="flex flex-col gap-0 max-h-52 overflow-y-auto pr-1" style={{ scrollbarWidth: 'thin' }}>
        {locGroups.map(({ loc, buildings: grp }) => (
          <div key={loc.id}>
            <p className="text-[8px] font-black uppercase tracking-widest text-slate-400 px-1 pt-2 pb-1 flex items-center gap-1">
              <span className="material-symbols-outlined" style={{ fontSize: 10 }}>location_city</span>
              {loc.name}{loc.code ? ` · ${loc.code}` : ''}
            </p>
            {grp.map(b => <Row key={b.id} b={b} />)}
          </div>
        ))}
        {withoutLocation.length > 0 && (
          <div>
            {locGroups.length > 0 && (
              <p className="text-[8px] font-black uppercase tracking-widest text-slate-400 px-1 pt-2 pb-1">Other</p>
            )}
            {withoutLocation.map(b => <Row key={b.id} b={b} />)}
          </div>
        )}
      </div>
      {bldIds.length === 0 && role === 'building_admin' && (
        <p className="text-[9px] text-orange-500 font-bold">⚠ Select at least 1 building for this building admin</p>
      )}
    </div>
  )
}

// ── Add User modal ────────────────────────────────────────────────────────────
function AddUserModal({ buildings, locations, departments, onSave, onClose }: {
  buildings: Building[]
  locations: Location[]
  departments: Department[]
  onSave: (data: { name: string; email: string; password: string; department_id: number | null; role: UserRole; ext: string; building_ids: number[] }) => Promise<void>
  onClose: () => void
}) {
  const [name, setName]         = useState('')
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm]   = useState('')
  const [showPw, setShowPw]     = useState(false)
  const [showCf, setShowCf]     = useState(false)
  const [deptId, setDeptId]     = useState<number | null>(null)
  const [ext, setExt]           = useState('')
  const [role, setRole]         = useState<UserRole>('user')
  const [bldIds, setBldIds]     = useState<number[]>([])
  const [saving, setSaving]     = useState(false)
  const [err, setErr]           = useState('')

  const pwTooShort  = password.length > 0 && password.length < 8
  const pwMismatch  = confirm.length > 0 && confirm !== password

  function toggleBuilding(id: number) {
    setBldIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  async function handleSave() {
    if (!name.trim() || !email.trim() || !password) { setErr('Name, email, and password are required'); return }
    if (password.length < 8) { setErr('Password must be at least 8 characters'); return }
    if (password !== confirm) { setErr('Passwords do not match'); return }
    if (role === 'building_admin' && bldIds.length === 0) { setErr('Assign at least one building for Building Admin'); return }
    setSaving(true); setErr('')
    try {
      await onSave({ name: name.trim(), email: email.trim(), password, department_id: deptId, role, ext: ext.trim(), building_ids: bldIds })
      onClose()
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { errors?: { email?: string[] } } } })?.response?.data?.errors?.email?.[0]
      setErr(msg ?? 'Failed to create user.')
    } finally { setSaving(false) }
  }

  const inputBase = 'w-full bg-slate-50 border rounded-xl pl-10 pr-4 py-2.5 text-sm font-bold focus:outline-none focus:ring-2 focus:border-transparent transition-all'

  return (
    <ModalPortal>
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(12px)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-[480px] flex flex-col rounded-[2rem] shadow-2xl overflow-hidden"
        style={{
          height: 640,
          background: 'rgba(255,255,255,0.90)',
          backdropFilter: 'blur(48px) saturate(200%)',
          border: '1px solid rgba(255,255,255,0.7)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div className="flex items-center justify-between px-7 pt-7 pb-5 border-b border-slate-100 shrink-0">
          <div>
            <p className="text-[9px] font-black uppercase tracking-[0.25em] text-slate-400">Admin · Users</p>
            <h2 className="text-2xl font-black italic tracking-tighter uppercase mt-0.5">Add User</h2>
          </div>
          <button onClick={onClose}
            className="size-9 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors">
            <span className="material-symbols-outlined text-slate-500" style={{ fontSize: 18 }}>close</span>
          </button>
        </div>

        {/* ── Scrollable body ── */}
        <div className="flex-1 overflow-y-auto px-7 py-5 space-y-5" style={{ scrollbarWidth: 'thin' }}>

          {/* Error banner */}
          {err && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-100 text-red-600 text-[11px] font-bold px-4 py-3 rounded-xl">
              <span className="material-symbols-outlined" style={{ fontSize: 15 }}>error</span>
              {err}
            </div>
          )}

          {/* ── Section: Basic Info ── */}
          <div className="space-y-3">
            <p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">Basic Info</p>

            {/* Name */}
            <div className="space-y-1.5">
              <label className="text-[9px] font-black uppercase text-slate-400 tracking-wider px-1">Full Name *</label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-300" style={{ fontSize: 16 }}>person</span>
                <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Budi Santoso"
                  className={`${inputBase} focus:ring-[#adee2b] border-slate-200`} />
              </div>
            </div>

            {/* Email */}
            <div className="space-y-1.5">
              <label className="text-[9px] font-black uppercase text-slate-400 tracking-wider px-1">Email *</label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-300" style={{ fontSize: 16 }}>mail</span>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="e.g. budi@company.com"
                  className={`${inputBase} focus:ring-[#adee2b] border-slate-200`} />
              </div>
            </div>

            {/* Dept + Ext */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-[9px] font-black uppercase text-slate-400 tracking-wider px-1">Department</label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none" style={{ fontSize: 16 }}>corporate_fare</span>
                  <select value={deptId ?? ''} onChange={e => setDeptId(e.target.value ? Number(e.target.value) : null)}
                    className={`${inputBase} focus:ring-[#adee2b] border-slate-200 appearance-none cursor-pointer`}>
                    <option value="">— No department —</option>
                    {departments.map(d => <option key={d.id} value={d.id}>{d.name}{d.code ? ` (${d.code})` : ''}</option>)}
                  </select>
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-[9px] font-black uppercase text-slate-400 tracking-wider px-1">Ext (phone)</label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-300" style={{ fontSize: 16 }}>phone</span>
                  <input value={ext} onChange={e => setExt(e.target.value)} placeholder="e.g. 1234"
                    className={`${inputBase} focus:ring-[#adee2b] border-slate-200`} />
                </div>
              </div>
            </div>
          </div>

          {/* ── Section: Password ── */}
          <div className="space-y-3">
            <p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">Password</p>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between px-1">
                <label className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Password *</label>
                <span className="text-[9px] text-slate-400">Min. 8 characters</span>
              </div>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-300" style={{ fontSize: 16 }}>lock</span>
                <input type={showPw ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••"
                  className={`${inputBase} pr-10 ${pwTooShort ? 'border-orange-300 focus:ring-orange-400' : 'border-slate-200 focus:ring-[#adee2b]'}`} />
                <button type="button" onClick={() => setShowPw(v => !v)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500 transition-colors">
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>{showPw ? 'visibility_off' : 'visibility'}</span>
                </button>
              </div>
              {pwTooShort && (
                <p className="flex items-center gap-1.5 text-[10px] text-orange-500 font-bold px-1">
                  <span className="material-symbols-outlined" style={{ fontSize: 12 }}>warning</span>
                  Password too short ({password.length}/8 characters)
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="text-[9px] font-black uppercase text-slate-400 tracking-wider px-1">Confirm Password *</label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-300" style={{ fontSize: 16 }}>lock_reset</span>
                <input type={showCf ? 'text' : 'password'} value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="Re-enter password"
                  className={`${inputBase} pr-10 ${pwMismatch ? 'border-red-300 focus:ring-red-400' : confirm && confirm === password ? 'border-green-300 focus:ring-green-400' : 'border-slate-200 focus:ring-[#adee2b]'}`} />
                <button type="button" onClick={() => setShowCf(v => !v)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500 transition-colors">
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>{showCf ? 'visibility_off' : 'visibility'}</span>
                </button>
              </div>
              {pwMismatch && (
                <p className="flex items-center gap-1.5 text-[10px] text-red-500 font-bold px-1">
                  <span className="material-symbols-outlined" style={{ fontSize: 12 }}>error</span>
                  Passwords do not match
                </p>
              )}
              {!pwMismatch && confirm && confirm === password && (
                <p className="flex items-center gap-1.5 text-[10px] text-green-600 font-bold px-1">
                  <span className="material-symbols-outlined" style={{ fontSize: 12 }}>check_circle</span>
                  Passwords match
                </p>
              )}
            </div>
          </div>

          {/* ── Section: Role ── */}
          <div className="space-y-3">
            <p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">Role</p>
            <div className="grid grid-cols-2 gap-2">
              {ALL_ROLES.map(r => {
                const m = ROLE_META[r]
                return (
                  <button key={r} onClick={() => setRole(r)}
                    className={`flex items-center gap-2.5 px-3.5 py-3 rounded-xl border text-[10px] font-black uppercase tracking-wide transition-all
                      ${role === r ? `${m.bg} ${m.text} border-transparent shadow-sm` : 'bg-white border-slate-200 text-slate-400 hover:border-slate-300 hover:bg-slate-50'}`}>
                    <span className={`size-2 rounded-full shrink-0 ${role === r ? 'bg-current' : 'bg-slate-200'}`} />
                    {m.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* ── Section: Building ── */}
          {(role === 'building_admin' || role === 'receptionist') && (
            <div className="space-y-3">
              <p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">Buildings</p>
              <BuildingPicker role={role} bldIds={bldIds} buildings={buildings} locations={locations} onToggle={toggleBuilding} />
            </div>
          )}

        </div>

        {/* ── Footer ── */}
        <div className="px-7 py-5 border-t border-slate-100 shrink-0 flex gap-3">
          <button onClick={onClose}
            className="flex-1 py-3.5 rounded-full text-[10px] font-black uppercase tracking-[0.15em] bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors">
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving || pwTooShort || pwMismatch}
            className="flex-1 py-3.5 rounded-full text-[10px] font-black uppercase tracking-[0.15em] transition-all duration-200
              bg-black text-[#adee2b] hover:bg-slate-800 shadow-lg shadow-black/10
              disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed disabled:shadow-none
              flex items-center justify-center gap-2">
            {saving && <span className="material-symbols-outlined animate-spin" style={{ fontSize: 13 }}>progress_activity</span>}
            {saving ? 'Saving...' : 'Create User →'}
          </button>
        </div>
      </div>
    </div>
    </ModalPortal>
  )
}

// ── Import / Export modal ─────────────────────────────────────────────────────
type ImportTab = 'excel' | 'csv' | 'sql'

const IMPORT_COLS = ['name', 'email', 'password', 'department', 'role', 'ext']
const EXPORT_COLS = ['name', 'email', 'password', 'department', 'role', 'ext']

type ImportRow = { name: string; email: string; password: string; department?: string; role?: string; ext?: string }

function ImportExportModal({ users, onImport, onClose }: {
  users: User[]
  onImport: (rows: ImportRow[]) => Promise<void>
  onClose: () => void
}) {
  const [tab, setTab] = useState<ImportTab>('excel')
  const [preview, setPreview] = useState<ImportRow[] | null>(null)
  const [parseErr, setParseErr] = useState('')
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<{ created: number; errors: string[] } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  // ── Export helpers ──────────────────────────────────────────────────────────
  const [exporting, setExporting] = useState(false)

  async function fetchExportData() {
    setExporting(true)
    try { return await exportUsers() }
    finally { setExporting(false) }
  }

  async function doExportCSV() {
    const data = await fetchExportData()
    const rows = [EXPORT_COLS.join(','), ...data.map(u =>
      EXPORT_COLS.map(c => {
        const v = (u as Record<string, string>)[c] ?? ''
        return v.includes(',') || v.includes('"') ? `"${v.replace(/"/g, '""')}"` : v
      }).join(',')
    )]
    download('users_export.csv', rows.join('\n'), 'text/csv')
  }

  async function doExportExcel() {
    const data = await fetchExportData()
    const ws = XLSX.utils.json_to_sheet(data.map(u => ({
      name: u.name, email: u.email, password: u.password,
      department: u.department, role: u.role, ext: u.ext,
    })))
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Users')
    XLSX.writeFile(wb, 'users_export.xlsx')
  }

  async function doExportSQL() {
    const data = await fetchExportData()
    const rows = data.map(u => {
      const vals = [u.name, u.email, u.password, u.department, u.role, u.ext]
        .map(v => `'${String(v ?? '').replace(/'/g, "''")}'`).join(', ')
      return `  (${vals})`
    }).join(',\n')
    const sql = `-- MBRS Users Export (${new Date().toISOString().slice(0, 10)})\n-- Password diekspor sebagai bcrypt hash. Saat diimpor kembali akan dikenali otomatis.\nINSERT INTO users (name, email, password, department, role, ext) VALUES\n${rows};`
    download('users_export.sql', sql, 'text/plain')
  }

  function download(filename: string, content: string, type: string) {
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([content], { type }))
    a.download = filename
    a.click()
  }

  // ── Import: download template ───────────────────────────────────────────────
  function downloadTemplate(fmt: 'xlsx' | 'csv') {
    const example: Record<string, string>[] = [
      { name: 'Budi Santoso', email: 'budi@company.com', password: 'password123', department: 'IT', role: 'user', ext: '1001' },
      { name: 'Siti Rahayu', email: 'siti@company.com', password: 'password123', department: 'HR', role: 'receptionist', ext: '' },
    ]
    if (fmt === 'xlsx') {
      const ws = XLSX.utils.json_to_sheet(example, { header: IMPORT_COLS })
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Users')
      XLSX.writeFile(wb, 'users_import_template.xlsx')
    } else {
      const rows = [IMPORT_COLS.join(','), ...example.map(r => IMPORT_COLS.map(c => r[c] ?? '').join(','))]
      download('users_import_template.csv', rows.join('\n'), 'text/csv')
    }
  }

  // ── Import: parse file ──────────────────────────────────────────────────────
  const handleFile = useCallback((file: File) => {
    setParseErr(''); setPreview(null); setImportResult(null)
    const ext = file.name.split('.').pop()?.toLowerCase()

    const parseRows = (raw: unknown[][]): ImportRow[] => {
      if (!raw.length) throw new Error('File is empty')
      // First row is header — find column indices
      const header = (raw[0] as string[]).map(h => String(h ?? '').trim().toLowerCase())
      const idx = (col: string) => header.indexOf(col)
      const nameI = idx('name'), emailI = idx('email'), pwI = idx('password')
      if (nameI < 0 || emailI < 0 || pwI < 0)
        throw new Error('Missing required columns: name, email, password')
      return raw.slice(1).filter(r => r[nameI] || r[emailI]).map(r => ({
        name:       String(r[nameI] ?? '').trim(),
        email:      String(r[emailI] ?? '').trim(),
        password:   String(r[pwI] ?? '').trim(),
        department: idx('department') >= 0 ? String(r[idx('department')] ?? '').trim() : '',
        role:       idx('role') >= 0 ? String(r[idx('role')] ?? '').trim() : 'user',
        ext:        idx('ext') >= 0 ? String(r[idx('ext')] ?? '').trim() : '',
      }))
    }

    if (ext === 'csv' || ext === 'sql') {
      const reader = new FileReader()
      reader.onload = e => {
        try {
          const text = e.target!.result as string
          if (ext === 'sql') {
            // Parse: extract VALUES rows from INSERT INTO ... VALUES (...),(...)
            const match = text.match(/VALUES\s*([\s\S]+?);/i)
            if (!match) throw new Error('No INSERT VALUES block found in SQL file')
            const rowMatches = [...match[1].matchAll(/\(([^)]+)\)/g)]
            if (!rowMatches.length) throw new Error('No data rows found')
            // Build pseudo-table: assume fixed column order name,email,password,department,role,ext
            const fakeHeader = [IMPORT_COLS]
            const dataRows = rowMatches.map(m =>
              m[1].split(',').map(v => v.trim().replace(/^'|'$/g, '').replace(/''/g, "'"))
            )
            setPreview(parseRows([...fakeHeader, ...dataRows]))
          } else {
            // CSV
            const wb = XLSX.read(text, { type: 'string' })
            const ws = wb.Sheets[wb.SheetNames[0]]
            const raw = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1 })
            setPreview(parseRows(raw as unknown[][]))
          }
        } catch (err) { setParseErr(String(err)) }
      }
      reader.readAsText(file)
    } else {
      // xlsx
      const reader = new FileReader()
      reader.onload = e => {
        try {
          const wb = XLSX.read(e.target!.result, { type: 'binary' })
          const ws = wb.Sheets[wb.SheetNames[0]]
          const raw = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1 })
          setPreview(parseRows(raw as unknown[][]))
        } catch (err) { setParseErr(String(err)) }
      }
      reader.readAsBinaryString(file)
    }
  }, [])

  async function handleImport() {
    if (!preview?.length) return
    setImporting(true); setImportResult(null)
    try {
      const result = await onImport(preview)
      setImportResult(result)
      setPreview(null)
      if (fileRef.current) fileRef.current.value = ''
    } finally { setImporting(false) }
  }

  const TABS: { key: ImportTab; label: string; icon: string }[] = [
    { key: 'excel', label: 'Excel (.xlsx)', icon: 'table' },
    { key: 'csv',   label: 'CSV (.csv)',    icon: 'description' },
    { key: 'sql',   label: 'SQL (.sql)',    icon: 'database' },
  ]

  return (
    <ModalPortal>
    <div className="fixed inset-0 z-[1000] flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(12px)' }} onClick={onClose}>
      <div className="bg-white rounded-3xl shadow-2xl w-[640px] max-h-[90vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between px-7 pt-6 pb-4 border-b border-slate-100">
          <div>
            <h3 className="text-lg font-black uppercase tracking-tight">Import / Export Users</h3>
            <p className="text-[10px] text-slate-400 font-medium mt-0.5">{users.length} users currently in system</p>
          </div>
          <button onClick={onClose} className="size-8 flex items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-600">
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>close</span>
          </button>
        </div>

        {/* Export strip */}
        <div className="px-7 py-4 bg-slate-50 border-b border-slate-100">
          <p className="text-[8px] font-black uppercase tracking-widest text-slate-400 mb-2">Export Current Users</p>
          <div className="flex gap-2">
            <button onClick={doExportExcel} disabled={exporting}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 text-white text-[10px] font-black uppercase hover:bg-emerald-700 disabled:opacity-50 transition-colors">
              {exporting ? <span className="material-symbols-outlined animate-spin" style={{ fontSize: 13 }}>progress_activity</span> : <span className="material-symbols-outlined" style={{ fontSize: 13 }}>table</span>}Excel
            </button>
            <button onClick={doExportCSV} disabled={exporting}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-blue-500 text-white text-[10px] font-black uppercase hover:bg-blue-600 disabled:opacity-50 transition-colors">
              {exporting ? <span className="material-symbols-outlined animate-spin" style={{ fontSize: 13 }}>progress_activity</span> : <span className="material-symbols-outlined" style={{ fontSize: 13 }}>description</span>}CSV
            </button>
            <button onClick={doExportSQL} disabled={exporting}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-700 text-white text-[10px] font-black uppercase hover:bg-slate-800 disabled:opacity-50 transition-colors">
              {exporting ? <span className="material-symbols-outlined animate-spin" style={{ fontSize: 13 }}>progress_activity</span> : <span className="material-symbols-outlined" style={{ fontSize: 13 }}>database</span>}SQL
            </button>
          </div>
          <p className="text-[9px] text-slate-400 mt-2">Password diekspor sebagai bcrypt hash — saat diimpor kembali akan dikenali otomatis.</p>
        </div>

        {/* Import section */}
        <div className="flex-1 overflow-y-auto px-7 py-5 space-y-4">
          <p className="text-[8px] font-black uppercase tracking-widest text-slate-400">Import Users</p>

          {/* Format tabs */}
          <div className="flex gap-1 bg-slate-100 rounded-xl p-1 w-fit">
            {TABS.map(t => (
              <button key={t.key} onClick={() => { setTab(t.key); setPreview(null); setParseErr(''); setImportResult(null) }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${tab === t.key ? 'bg-white shadow text-slate-800' : 'text-slate-400 hover:text-slate-600'}`}>
                <span className="material-symbols-outlined" style={{ fontSize: 12 }}>{t.icon}</span>
                {t.label}
              </button>
            ))}
          </div>

          {/* Format docs */}
          <div className="bg-slate-50 rounded-2xl p-4 space-y-3 text-[11px]">
            {tab === 'excel' && (
              <>
                <p className="font-black text-slate-700">Format Excel (.xlsx)</p>
                <div className="overflow-x-auto">
                  <table className="text-[10px] border-collapse w-full">
                    <thead>
                      <tr className="bg-slate-200">
                        {['Col A', 'Col B', 'Col C', 'Col D', 'Col E', 'Col F'].map(c => (
                          <th key={c} className="px-3 py-1.5 text-left font-black text-slate-600 border border-slate-300">{c}</th>
                        ))}
                      </tr>
                      <tr className="bg-slate-100">
                        {IMPORT_COLS.map(c => (
                          <th key={c} className="px-3 py-1.5 text-left font-bold text-slate-500 border border-slate-200 font-mono">{c}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="bg-white">
                        {['Budi Santoso', 'budi@co.com', 'pass1234', 'IT', 'user', '1001'].map((v, i) => (
                          <td key={i} className="px-3 py-1.5 border border-slate-100 text-slate-600">{v}</td>
                        ))}
                      </tr>
                      <tr className="bg-slate-50">
                        {['Siti Rahayu', 'siti@co.com', 'pass1234', 'HR', 'receptionist', ''].map((v, i) => (
                          <td key={i} className="px-3 py-1.5 border border-slate-100 text-slate-500 italic">{v || '(kosong)'}</td>
                        ))}
                      </tr>
                    </tbody>
                  </table>
                </div>
                <ul className="space-y-1 text-slate-500 list-disc pl-4">
                  <li>Baris pertama = header (wajib ada, boleh nama kolom apa saja — <em>urutan kolom yang menentukan</em>)</li>
                  <li>Kolom A–C wajib; D–F opsional</li>
                  <li>Role: <span className="font-mono bg-slate-200 px-1 rounded">user</span> · <span className="font-mono bg-slate-200 px-1 rounded">admin</span> · <span className="font-mono bg-slate-200 px-1 rounded">receptionist</span> · <span className="font-mono bg-slate-200 px-1 rounded">building_admin</span> (default: <span className="font-mono">user</span>)</li>
                  <li>Password akan di-hash otomatis di server</li>
                </ul>
                <button onClick={() => downloadTemplate('xlsx')}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 text-white text-[9px] font-black uppercase hover:bg-emerald-700 transition-colors">
                  <span className="material-symbols-outlined" style={{ fontSize: 13 }}>download</span>Download Template (.xlsx)
                </button>
              </>
            )}

            {tab === 'csv' && (
              <>
                <p className="font-black text-slate-700">Format CSV (.csv)</p>
                <div className="bg-white rounded-xl border border-slate-200 p-3 font-mono text-[10px] text-slate-600 space-y-0.5">
                  <p className="text-slate-400">name,email,password,department,role,ext</p>
                  <p>Budi Santoso,budi@co.com,pass1234,IT,user,1001</p>
                  <p>Siti Rahayu,siti@co.com,pass1234,HR,receptionist,</p>
                </div>
                <ul className="space-y-1 text-slate-500 list-disc pl-4">
                  <li>Separator: koma <span className="font-mono bg-slate-200 px-1 rounded">,</span> — jika nilai mengandung koma, bungkus dengan tanda kutip ganda</li>
                  <li>Baris pertama = header (nama kolom dipakai untuk mapping, bukan urutan)</li>
                  <li>Kolom <span className="font-mono">name</span>, <span className="font-mono">email</span>, <span className="font-mono">password</span> wajib</li>
                  <li>Encoding: UTF-8</li>
                </ul>
                <button onClick={() => downloadTemplate('csv')}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-blue-500 text-white text-[9px] font-black uppercase hover:bg-blue-600 transition-colors">
                  <span className="material-symbols-outlined" style={{ fontSize: 13 }}>download</span>Download Template (.csv)
                </button>
              </>
            )}

            {tab === 'sql' && (
              <>
                <p className="font-black text-slate-700">Format SQL (.sql)</p>
                <div className="bg-white rounded-xl border border-slate-200 p-3 font-mono text-[10px] text-slate-600 space-y-0.5">
                  <p className="text-slate-400">-- Urutan kolom wajib: name, email, password, department, role, ext</p>
                  <p>INSERT INTO users (name, email, password, department, role, ext) VALUES</p>
                  <p className="pl-2">('Budi Santoso', 'budi@co.com', 'pass1234', 'IT', 'user', '1001'),</p>
                  <p className="pl-2">('Siti Rahayu', 'siti@co.com', 'pass1234', 'HR', 'receptionist', NULL);</p>
                </div>
                <ul className="space-y-1 text-slate-500 list-disc pl-4">
                  <li>Hanya satu blok <span className="font-mono">INSERT INTO ... VALUES (...)</span> yang diproses</li>
                  <li>Urutan kolom dalam VALUES harus: <span className="font-mono">name, email, password, department, role, ext</span></li>
                  <li>Gunakan <span className="font-mono">NULL</span> atau string kosong <span className="font-mono">''</span> untuk field opsional</li>
                  <li>Password bisa plain text (akan di-hash) atau bcrypt hash dari hasil export (dikenali otomatis)</li>
                  <li>Tidak support multi-statement atau subquery</li>
                </ul>
              </>
            )}
          </div>

          {/* File input */}
          {!importResult && (
            <div>
              <label className="text-[9px] font-black uppercase text-slate-400 tracking-wider block mb-2">Pilih File</label>
              <input
                ref={fileRef}
                type="file"
                accept={tab === 'excel' ? '.xlsx,.xls' : tab === 'csv' ? '.csv' : '.sql'}
                onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])}
                className="block w-full text-[11px] text-slate-500 font-bold
                  file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0
                  file:text-[10px] file:font-black file:uppercase
                  file:bg-black file:text-[#adee2b] hover:file:bg-slate-800 file:cursor-pointer"
              />
              {parseErr && <p className="text-xs text-red-500 font-bold mt-2">{parseErr}</p>}
            </div>
          )}

          {/* Preview table */}
          {preview && preview.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Preview — {preview.length} rows</p>
                <button onClick={() => { setPreview(null); if (fileRef.current) fileRef.current.value = '' }}
                  className="text-[9px] text-slate-400 hover:text-slate-600 font-bold">Clear</button>
              </div>
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full text-[10px]">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      {IMPORT_COLS.map(c => (
                        <th key={c} className="px-3 py-2 text-left font-black text-slate-500 uppercase">{c}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.slice(0, 8).map((row, i) => (
                      <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                        <td className="px-3 py-1.5 font-bold text-slate-700">{row.name}</td>
                        <td className="px-3 py-1.5 text-slate-500">{row.email}</td>
                        <td className="px-3 py-1.5 text-slate-400 font-mono">{'•'.repeat(Math.min(row.password?.length ?? 0, 8))}</td>
                        <td className="px-3 py-1.5 text-slate-500">{row.department ?? '—'}</td>
                        <td className="px-3 py-1.5">
                          {row.role && ROLE_META[row.role as UserRole] ? (
                            <span className={`px-2 py-0.5 rounded-md text-[8px] font-black uppercase ${ROLE_META[row.role as UserRole].bg} ${ROLE_META[row.role as UserRole].text}`}>{row.role}</span>
                          ) : <span className="text-slate-400">{row.role || 'user'}</span>}
                        </td>
                        <td className="px-3 py-1.5 text-slate-400">{row.ext || '—'}</td>
                      </tr>
                    ))}
                    {preview.length > 8 && (
                      <tr>
                        <td colSpan={6} className="px-3 py-2 text-center text-[9px] text-slate-400 font-bold">
                          +{preview.length - 8} more rows...
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <button onClick={handleImport} disabled={importing}
                className="w-full py-3 rounded-2xl bg-black text-[#adee2b] text-[10px] font-black uppercase hover:bg-slate-800 disabled:opacity-40 transition-colors flex items-center justify-center gap-2">
                {importing && <span className="material-symbols-outlined animate-spin" style={{ fontSize: 13 }}>progress_activity</span>}
                Import {preview.length} Users
              </button>
            </div>
          )}

          {/* Import result */}
          {importResult && (
            <div className="space-y-3">
              <div className={`rounded-2xl p-4 ${importResult.errors.length === 0 ? 'bg-green-50 border border-green-100' : 'bg-amber-50 border border-amber-100'}`}>
                <p className={`text-sm font-black ${importResult.errors.length === 0 ? 'text-green-700' : 'text-amber-700'}`}>
                  {importResult.created} user{importResult.created !== 1 ? 's' : ''} berhasil dibuat
                  {importResult.errors.length > 0 ? `, ${importResult.errors.length} baris gagal` : ' — semua berhasil!'}
                </p>
                {importResult.errors.length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {importResult.errors.map((e, i) => (
                      <li key={i} className="text-[10px] text-amber-600 font-medium">• {e}</li>
                    ))}
                  </ul>
                )}
              </div>
              <button onClick={() => setImportResult(null)}
                className="text-[9px] text-slate-400 hover:text-slate-600 font-bold">Import lagi</button>
            </div>
          )}
        </div>
      </div>
    </div>
    </ModalPortal>
  )
}

// ── Departments Section ──────────────────────────────────────────────────────
function DepartmentsSection({ departments, qc }: { departments: Department[]; qc: ReturnType<typeof useQueryClient> }) {
  const [collapsed, setCollapsed] = useState(true)
  const [addName, setAddName]     = useState('')
  const [addCode, setAddCode]     = useState('')
  const [addSaving, setAddSaving] = useState(false)
  const [addErr, setAddErr]       = useState('')
  const [editId, setEditId]       = useState<number | null>(null)
  const [editName, setEditName]   = useState('')
  const [editCode, setEditCode]   = useState('')
  const [editSaving, setEditSaving] = useState(false)
  const [editErr, setEditErr]     = useState('')
  const [delErr, setDelErr]       = useState('')

  async function handleAdd() {
    if (!addName.trim()) { setAddErr('Name is required'); return }
    setAddSaving(true); setAddErr('')
    try {
      await createDepartment({ name: addName.trim(), code: addCode.trim() || undefined })
      qc.invalidateQueries({ queryKey: ['departments'] })
      setAddName(''); setAddCode('')
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
      setAddErr(msg ?? 'Failed to create department.')
    } finally { setAddSaving(false) }
  }

  function openEdit(d: Department) {
    setEditId(d.id); setEditName(d.name); setEditCode(d.code ?? ''); setEditErr('')
  }

  async function handleEdit() {
    if (!editId || !editName.trim()) return
    setEditSaving(true); setEditErr('')
    try {
      await updateDepartment(editId, { name: editName.trim(), code: editCode.trim() || null })
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

  const inputCls = 'border border-slate-200 rounded-xl px-3 py-2 text-[11px] font-bold focus:outline-none focus:ring-2 focus:ring-[#adee2b]'

  return (
    <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
      {/* Header row */}
      <button onClick={() => setCollapsed(v => !v)}
        className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-slate-50 transition-colors text-left">
        <span className="material-symbols-outlined text-slate-400" style={{ fontSize: 16 }}>corporate_fare</span>
        <span className="flex-1 text-[10px] font-black uppercase tracking-wider text-slate-700">Departments</span>
        <span className="text-[9px] text-slate-400 font-bold">{departments.length} dept{departments.length !== 1 ? 's' : ''}</span>
        <span className="material-symbols-outlined text-slate-300" style={{ fontSize: 16 }}>{collapsed ? 'expand_more' : 'expand_less'}</span>
      </button>

      {!collapsed && (
        <div className="border-t border-slate-50 px-5 py-4 space-y-3">
          {delErr && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-100 text-red-600 text-[11px] font-bold px-3 py-2 rounded-xl">
              <span className="material-symbols-outlined shrink-0" style={{ fontSize: 13 }}>error</span>{delErr}
            </div>
          )}

          {/* List */}
          {departments.length > 0 && (
            <div className="space-y-1">
              {departments.map(d => (
                <div key={d.id}>
                  {editId === d.id ? (
                    <div className="flex items-center gap-2 bg-slate-50 rounded-xl px-3 py-2">
                      <input value={editName} onChange={e => setEditName(e.target.value)} placeholder="Name"
                        className={`flex-1 ${inputCls}`} />
                      <input value={editCode} onChange={e => setEditCode(e.target.value)} placeholder="Code" style={{ width: 72 }}
                        className={inputCls} />
                      {editErr && <span className="text-[9px] text-red-500 font-bold">{editErr}</span>}
                      <button onClick={handleEdit} disabled={editSaving}
                        className="px-3 py-2 rounded-xl bg-black text-[#adee2b] text-[9px] font-black uppercase disabled:opacity-40">
                        {editSaving ? '...' : 'Save'}
                      </button>
                      <button onClick={() => setEditId(null)} className="px-3 py-2 rounded-xl bg-slate-200 text-slate-600 text-[9px] font-black uppercase">
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3 px-2 py-1.5 rounded-xl hover:bg-slate-50 group">
                      <span className="flex-1 text-[12px] font-black text-slate-800">{d.name}</span>
                      {d.code && <span className="px-2 py-0.5 bg-slate-100 text-slate-500 rounded-lg text-[8px] font-black uppercase">{d.code}</span>}
                      <span className="text-[9px] text-slate-400 font-bold">{d.users_count ?? 0} user{(d.users_count ?? 0) !== 1 ? 's' : ''}</span>
                      <button onClick={() => openEdit(d)}
                        className="size-7 flex items-center justify-center rounded-lg text-slate-300 hover:bg-slate-100 hover:text-slate-600 opacity-0 group-hover:opacity-100 transition-all">
                        <span className="material-symbols-outlined" style={{ fontSize: 13 }}>edit</span>
                      </button>
                      <button onClick={() => handleDelete(d)}
                        className="size-7 flex items-center justify-center rounded-lg text-slate-300 hover:bg-red-50 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all">
                        <span className="material-symbols-outlined" style={{ fontSize: 13 }}>delete</span>
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Add row */}
          <div className="flex items-center gap-2 pt-1">
            <input value={addName} onChange={e => setAddName(e.target.value)} placeholder="New department name"
              className={`flex-1 ${inputCls}`} onKeyDown={e => e.key === 'Enter' && handleAdd()} />
            <input value={addCode} onChange={e => setAddCode(e.target.value)} placeholder="Code" style={{ width: 80 }}
              className={inputCls} onKeyDown={e => e.key === 'Enter' && handleAdd()} />
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

function UsersTab() {
  const qc = useQueryClient()
  const { data: users = [], isLoading } = useQuery<User[]>({ queryKey: ['users'], queryFn: getUsers })
  const { data: buildings = [] } = useQuery<Building[]>({ queryKey: ['buildings'], queryFn: getBuildings })
  const { data: locations = [] } = useQuery<Location[]>({ queryKey: ['locations'], queryFn: getLocations })
  const { data: departments = [] } = useQuery<Department[]>({ queryKey: ['departments'], queryFn: getDepartments })

  const [editUser, setEditUser]         = useState<User | null>(null)
  const [roleValue, setRoleValue]       = useState<UserRole>('user')
  const [bldIds, setBldIds]             = useState<number[]>([])
  const [saving, setSaving]             = useState(false)
  const [search, setSearch]             = useState('')
  const [addModal, setAddModal]         = useState(false)
  const [importExportModal, setIEModal] = useState(false)
  const [deleteUserTarget, setDeleteUserTarget] = useState<User | null>(null)
  const [confirmUserInput, setConfirmUserInput] = useState('')
  const [deletingUser, setDeletingUser]         = useState(false)
  const [deleteUserErr, setDeleteUserErr]       = useState('')
  const [deleteBlockedUser, setDeleteBlockedUser] = useState<User | null>(null)
  const [editName, setEditName]               = useState('')
  const [editEmail, setEditEmail]             = useState('')
  const [editDeptId, setEditDeptId]           = useState<number | null>(null)
  const [editExt, setEditExt]                 = useState('')
  const [editPw, setEditPw]                   = useState('')
  const [editConfirmPw, setEditConfirmPw]     = useState('')
  const [editShowPw, setEditShowPw]           = useState(false)
  const [editAvatar, setEditAvatar]           = useState('')
  const [editErr, setEditErr]                 = useState('')

  function openEdit(u: User) {
    setEditUser(u)
    setRoleValue(u.role)
    setBldIds((u.admin_buildings ?? []).map(b => b.id))
    setEditName(u.name)
    setEditEmail(u.email)
    setEditDeptId(u.department_id ?? null)
    setEditExt(u.ext ?? '')
    setEditPw('')
    setEditConfirmPw('')
    setEditAvatar(u.avatar ?? '')
    setEditShowPw(false)
    setEditErr('')
  }

  async function handleSave() {
    if (!editUser) return
    if (!editName.trim() || !editEmail.trim()) { setEditErr('Name and email are required'); return }
    if (editPw && editPw.length < 8) { setEditErr('Password must be at least 8 characters'); return }
    if (editPw && editPw !== editConfirmPw) { setEditErr('Passwords do not match'); return }
    setSaving(true); setEditErr('')
    try {
      await updateUser(editUser.id, {
        name: editName.trim(),
        email: editEmail.trim(),
        department_id: editDeptId,
        ext: editExt.trim() || undefined,
        ...(editPw ? { password: editPw } : {}),
        ...(editAvatar !== (editUser.avatar ?? '') ? { avatar: editAvatar || null } : {}),
      })
      await updateUserRole(editUser.id, roleValue)
      if (roleValue === 'building_admin' || roleValue === 'receptionist') {
        await assignUserBuildings(editUser.id, bldIds)
      }
      qc.invalidateQueries({ queryKey: ['users'] })
      setEditUser(null)
    } catch (e: unknown) {
      const resp = (e as { response?: { data?: { message?: string; errors?: { email?: string[] } } } })?.response?.data
      setEditErr(resp?.message ?? resp?.errors?.email?.[0] ?? 'Failed to save changes.')
    } finally { setSaving(false) }
  }

  function toggleBuilding(id: number) {
    setBldIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  async function handleAddUser(data: Parameters<typeof createUser>[0] & { building_ids: number[] }) {
    const { building_ids, ...userData } = data
    const user = await createUser(userData)
    // always refresh list even if building assignment fails below
    qc.invalidateQueries({ queryKey: ['users'] })
    if ((userData.role === 'building_admin' || userData.role === 'receptionist') && building_ids.length > 0) {
      try { await assignUserBuildings(user.id, building_ids) } catch { /* non-fatal */ }
    }
  }

  async function handleDeleteUser() {
    if (!deleteUserTarget) return
    setDeletingUser(true); setDeleteUserErr('')
    try {
      await deleteUser(deleteUserTarget.id)
      qc.invalidateQueries({ queryKey: ['users'] })
      setDeleteUserTarget(null)
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
      setDeleteUserErr(msg ?? 'Failed to delete user.')
    } finally { setDeletingUser(false) }
  }

  async function handleImport(rows: ImportRow[]) {
    const result = await importUsers(rows)
    qc.invalidateQueries({ queryKey: ['users'] })
    return result
  }

  const filtered = useMemo(() =>
    (users as User[]).filter(u => !search || u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase()) || u.department?.toLowerCase().includes(search.toLowerCase()))
  , [users, search])

  const grouped = useMemo(() => {
    const g: Partial<Record<UserRole, User[]>> = {}
    filtered.forEach(u => { if (!g[u.role]) g[u.role] = []; g[u.role]!.push(u) })
    return g
  }, [filtered])

  return (
    <div className="space-y-5 max-w-3xl">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex-1 min-w-0">
          <p className="text-[9px] font-black uppercase tracking-[0.25em] text-slate-400 mb-1">Management</p>
          <h1 className="text-3xl font-black italic tracking-tighter uppercase">Users</h1>
        </div>
        {/* Search */}
        <div className="relative">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none" style={{ fontSize: 15 }}>search</span>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search users..."
            className="w-44 bg-white border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-[11px] font-bold focus:outline-none focus:ring-2 focus:ring-[#adee2b] focus:border-transparent" />
        </div>
        {/* Import / Export */}
        <button onClick={() => setIEModal(true)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 text-slate-600 text-[10px] font-black uppercase hover:bg-slate-200 transition-colors">
          <span className="material-symbols-outlined" style={{ fontSize: 14 }}>import_export</span>
          Import / Export
        </button>
        {/* Add User */}
        <button onClick={() => setAddModal(true)}
          className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-black text-[#adee2b] text-[10px] font-black uppercase hover:bg-slate-800 transition-colors">
          <span className="material-symbols-outlined" style={{ fontSize: 14 }}>person_add</span>
          Add User
        </button>
      </div>

      {/* ── Departments section ── */}
      <DepartmentsSection departments={departments as Department[]} qc={qc} />

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <span className="material-symbols-outlined animate-spin text-3xl text-slate-300">progress_activity</span>
        </div>
      ) : (
        <div className="space-y-4">
          {ALL_ROLES.filter(r => grouped[r]?.length).map(role => {
            const m = ROLE_META[role]
            const isUserRole = role === 'user'
            return (
              <div key={role} className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
                {/* Group header */}
                <div className="flex items-center gap-3 px-5 py-3 border-b border-slate-50">
                  <span className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase ${m.bg} ${m.text}`}>{m.label}</span>
                  <span className="text-[9px] font-black text-slate-300">{grouped[role]!.length} user{grouped[role]!.length !== 1 ? 's' : ''}</span>
                </div>

                {isUserRole ? (
                  /* Table layout for role='user' */
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="border-b border-slate-50">
                          <th className="px-4 py-2 text-[8px] font-black uppercase text-slate-400 tracking-wider w-8">No.</th>
                          <th className="px-4 py-2 text-[8px] font-black uppercase text-slate-400 tracking-wider">Name</th>
                          <th className="px-4 py-2 text-[8px] font-black uppercase text-slate-400 tracking-wider">Email</th>
                          <th className="px-4 py-2 text-[8px] font-black uppercase text-slate-400 tracking-wider">Department</th>
                          <th className="px-4 py-2 text-[8px] font-black uppercase text-slate-400 tracking-wider w-16">Ext</th>
                          <th className="px-4 py-2 text-[8px] font-black uppercase text-slate-400 tracking-wider w-8"></th>
                          <th className="px-4 py-2 text-[8px] font-black uppercase text-slate-400 tracking-wider w-8"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {grouped[role]!.map((u, i) => (
                          <tr key={u.id} className={`hover:bg-slate-50 transition-colors ${i < grouped[role]!.length - 1 ? 'border-b border-slate-50' : ''}`}>
                            <td className="px-4 py-2.5 text-[10px] font-bold text-slate-300">{i + 1}</td>
                            <td className="px-4 py-2.5">
                              <div className="flex items-center gap-2">
                                <img src={u.avatar ?? `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(u.name)}`}
                                  className="size-6 rounded-full bg-slate-100 shrink-0 object-cover" />
                                <span className="text-[11px] font-black text-slate-800 whitespace-nowrap">{u.name}</span>
                              </div>
                            </td>
                            <td className="px-4 py-2.5 text-[10px] text-slate-400 font-medium">{u.email}</td>
                            <td className="px-4 py-2.5 text-[10px] text-slate-500 font-bold uppercase">{u.department || '—'}</td>
                            <td className="px-4 py-2.5 text-[10px] text-slate-400 font-medium">{u.ext || '—'}</td>
                            <td className="px-2 py-2.5">
                              <button onClick={() => openEdit(u)}
                                className="size-7 flex items-center justify-center rounded-lg text-slate-300 hover:bg-slate-100 hover:text-slate-600 transition-colors">
                                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>edit</span>
                              </button>
                            </td>
                            <td className="px-2 py-2.5">
                              <button onClick={() => { setDeleteUserTarget(u); setConfirmUserInput(''); setDeleteUserErr('') }}
                                className="size-7 flex items-center justify-center rounded-lg text-slate-300 hover:bg-red-50 hover:text-red-500 transition-colors">
                                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>delete</span>
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  /* Card layout for admin roles */
                  <>
                    {grouped[role]!.map((u, i) => (
                      <div key={u.id} className={`flex items-center gap-4 px-5 py-3.5 hover:bg-slate-50 transition-colors ${i < grouped[role]!.length - 1 ? 'border-b border-slate-50' : ''}`}>
                        <img src={u.avatar ?? `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(u.name)}`}
                          className="size-9 rounded-full bg-slate-100 shrink-0 object-cover" />
                        <div className="flex-1 min-w-0">
                          <p className="text-[12px] font-black text-slate-800">{u.name}</p>
                          <p className="text-[10px] text-slate-400 font-bold">{u.email}</p>
                        </div>
                        <span className="text-[9px] font-bold text-slate-400 uppercase shrink-0">{u.department}</span>
                        {/* Building tags */}
                        <div className="flex gap-1 flex-wrap max-w-[200px] justify-end">
                          {(u.admin_buildings ?? []).length === 0
                            ? <span className="text-[9px] text-orange-400 font-black uppercase">No buildings</span>
                            : (u.admin_buildings ?? []).map(b => (
                              <span key={b.id} className="px-2 py-0.5 bg-blue-50 text-blue-600 rounded-lg text-[8px] font-black uppercase">{b.name}</span>
                            ))
                          }
                        </div>
                        <button onClick={() => openEdit(u)}
                          className="size-8 flex items-center justify-center rounded-xl text-slate-300 hover:bg-slate-100 hover:text-slate-600 transition-colors shrink-0">
                          <span className="material-symbols-outlined" style={{ fontSize: 15 }}>edit</span>
                        </button>
                        <button onClick={() => {
                            const isLastAdmin = u.role === 'admin' && (users as User[]).filter(x => x.role === 'admin').length <= 1
                            if (isLastAdmin) { setDeleteBlockedUser(u); return }
                            setDeleteUserTarget(u); setConfirmUserInput(''); setDeleteUserErr('')
                          }}
                          className="size-8 flex items-center justify-center rounded-xl text-slate-300 hover:bg-red-50 hover:text-red-500 transition-colors shrink-0">
                          <span className="material-symbols-outlined" style={{ fontSize: 15 }}>delete</span>
                        </button>
                      </div>
                    ))}
                  </>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Delete blocked — last super admin */}
      {deleteBlockedUser && (
        <ModalPortal>
        <div className="fixed inset-0 z-[1001] flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(16px)' }}
          onClick={() => setDeleteBlockedUser(null)}>
          <div
            className="w-[400px] rounded-[2rem] shadow-2xl overflow-hidden"
            style={{ background: 'rgba(255,255,255,0.94)', backdropFilter: 'blur(48px) saturate(200%)', border: '1px solid rgba(255,255,255,0.7)' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="px-7 pt-7 pb-5 bg-amber-50 border-b border-amber-100 flex items-center gap-3">
              <div className="size-11 rounded-2xl bg-amber-100 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-amber-500" style={{ fontSize: 22, fontVariationSettings: "'FILL' 1" }}>shield_lock</span>
              </div>
              <div>
                <p className="text-[9px] font-black uppercase tracking-[0.2em] text-amber-500">Action Blocked</p>
                <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight mt-0.5">Cannot Delete</h3>
              </div>
            </div>
            <div className="px-7 py-6 space-y-4">
              <div className="bg-slate-50 rounded-xl px-4 py-3 flex items-center gap-3">
                <div className="size-9 rounded-xl overflow-hidden shrink-0">
                  <img src={deleteBlockedUser.avatar ?? `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(deleteBlockedUser.name)}`}
                    className="w-full h-full object-cover" />
                </div>
                <div>
                  <p className="text-sm font-black text-slate-800">{deleteBlockedUser.name}</p>
                  <p className="text-[10px] text-slate-400 font-medium">{deleteBlockedUser.email}</p>
                </div>
                <span className="ml-auto px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-black text-[#adee2b] shrink-0">Super Admin</span>
              </div>
              <p className="text-[12px] text-slate-600 font-medium leading-relaxed">
                This is the <span className="font-black text-slate-900">only Super Admin</span> in the system. Deleting them would leave the system with no administrator.
              </p>
              <p className="text-[11px] text-slate-400 font-medium leading-relaxed">
                Promote another user to Super Admin first, then come back to delete this account.
              </p>
              <button onClick={() => setDeleteBlockedUser(null)}
                className="w-full py-3.5 rounded-full text-[10px] font-black uppercase tracking-[0.15em] bg-black text-white hover:bg-slate-800 transition-colors">
                Got It
              </button>
            </div>
          </div>
        </div>
        </ModalPortal>
      )}

      {/* Delete user confirm */}
      {deleteUserTarget && (
        <ModalPortal>
        <div className="fixed inset-0 z-[1001] flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(16px)' }}
          onClick={() => { setDeleteUserTarget(null); setConfirmUserInput('') }}>
          <div
            className="w-[420px] rounded-[2rem] shadow-2xl overflow-hidden"
            style={{ background: 'rgba(255,255,255,0.94)', backdropFilter: 'blur(48px) saturate(200%)', border: '1px solid rgba(255,255,255,0.7)' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="px-7 pt-7 pb-5 bg-red-50 border-b border-red-100 flex items-center gap-3">
              <div className="size-11 rounded-2xl bg-red-100 flex items-center justify-center shrink-0 overflow-hidden">
                <img src={deleteUserTarget.avatar ?? `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(deleteUserTarget.name)}`}
                  className="w-full h-full object-cover" />
              </div>
              <div>
                <p className="text-[9px] font-black uppercase tracking-[0.2em] text-red-400">Danger Zone</p>
                <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight mt-0.5">Delete User?</h3>
              </div>
            </div>
            <div className="px-7 py-5 space-y-4">
              <div className="bg-slate-50 rounded-xl px-4 py-3 flex items-center gap-3">
                <span className="material-symbols-outlined text-slate-300 shrink-0" style={{ fontSize: 20 }}>person</span>
                <div>
                  <p className="text-sm font-black text-slate-800">{deleteUserTarget.name}</p>
                  <p className="text-[10px] text-slate-400 font-medium mt-0.5">
                    {deleteUserTarget.email}
                    {deleteUserTarget.department ? ` · ${deleteUserTarget.department}` : ''}
                  </p>
                </div>
                <span className={`ml-auto shrink-0 px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${ROLE_META[deleteUserTarget.role].bg} ${ROLE_META[deleteUserTarget.role].text}`}>
                  {ROLE_META[deleteUserTarget.role].label}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 font-medium leading-relaxed">
                This account and all associated data will be permanently removed. <span className="font-black text-slate-700">This cannot be undone.</span>
              </p>
              <div className="space-y-1.5">
                <label className="text-[9px] font-black uppercase tracking-wider text-slate-400 px-1">
                  Type <span className="normal-case text-slate-700">"{deleteUserTarget.name}"</span> to confirm
                </label>
                <input
                  value={confirmUserInput}
                  onChange={e => setConfirmUserInput(e.target.value)}
                  placeholder={deleteUserTarget.name}
                  autoFocus
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-red-300 focus:border-transparent"
                />
              </div>
              {deleteUserErr && (
                <div className="flex items-center gap-2 bg-red-50 border border-red-100 text-red-600 text-[11px] font-bold px-3 py-2.5 rounded-xl">
                  <span className="material-symbols-outlined shrink-0" style={{ fontSize: 14 }}>error</span>
                  {deleteUserErr}
                </div>
              )}
              <div className="flex gap-3 pt-1">
                <button onClick={() => { setDeleteUserTarget(null); setConfirmUserInput('') }}
                  className="flex-1 py-3.5 rounded-full text-[10px] font-black uppercase tracking-[0.15em] bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors">
                  Cancel
                </button>
                <button onClick={handleDeleteUser} disabled={deletingUser || confirmUserInput !== deleteUserTarget.name}
                  className="flex-1 py-3.5 rounded-full text-[10px] font-black uppercase tracking-[0.15em] bg-red-500 text-white hover:bg-red-600 disabled:opacity-30 flex items-center justify-center gap-2 transition-all">
                  {deletingUser && <span className="material-symbols-outlined animate-spin" style={{ fontSize: 13 }}>progress_activity</span>}
                  {deletingUser ? 'Deleting...' : 'Delete User'}
                </button>
              </div>
            </div>
          </div>
        </div>
        </ModalPortal>
      )}

      {/* Add user modal */}
      {addModal && (
        <AddUserModal
          buildings={buildings as Building[]}
          locations={locations as Location[]}
          departments={departments as Department[]}
          onSave={handleAddUser}
          onClose={() => setAddModal(false)}
        />
      )}

      {/* Import / Export modal */}
      {importExportModal && (
        <ImportExportModal
          users={users as User[]}
          onImport={handleImport}
          onClose={() => setIEModal(false)}
        />
      )}

      {/* Edit user modal */}
      {editUser && (
        <ModalPortal>
        <div className="fixed inset-0 z-[1000] flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(12px)' }} onClick={() => setEditUser(null)}>
          <div className="w-[460px] flex flex-col rounded-3xl shadow-2xl overflow-hidden"
            style={{ height: 680, background: 'rgba(255,255,255,0.94)', backdropFilter: 'blur(48px) saturate(200%)', border: '1px solid rgba(255,255,255,0.7)' }}
            onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center gap-3 px-7 pt-6 pb-5 border-b border-slate-100 shrink-0">
              <img
                src={editAvatar || `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(editUser.name)}`}
                className="size-12 rounded-2xl bg-slate-100 object-cover shrink-0" />
              <div>
                <h3 className="text-sm font-black uppercase tracking-tight">Edit User</h3>
                <p className="text-[10px] text-slate-400">{editUser.email}</p>
              </div>
            </div>

            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto px-7 py-5 space-y-4" style={{ scrollbarWidth: 'thin' }}>

            {editErr && <div className="flex items-center gap-2 bg-red-50 border border-red-100 text-red-600 text-[11px] font-bold px-3 py-2.5 rounded-xl"><span className="material-symbols-outlined shrink-0" style={{ fontSize: 14 }}>error</span>{editErr}</div>}

            {/* Avatar picker */}
            {(() => {
              const PRESET_AVATARS = [
                'https://api.dicebear.com/9.x/adventurer/svg?seed=Felix',
                'https://api.dicebear.com/9.x/adventurer/svg?seed=Lily',
                'https://api.dicebear.com/9.x/adventurer/svg?seed=Max',
                'https://api.dicebear.com/9.x/adventurer/svg?seed=Zoe',
                'https://api.dicebear.com/9.x/adventurer/svg?seed=Oliver',
                'https://api.dicebear.com/9.x/adventurer/svg?seed=Mia',
                'https://api.dicebear.com/9.x/adventurer/svg?seed=Leo',
                'https://api.dicebear.com/9.x/adventurer/svg?seed=Emma',
                'https://api.dicebear.com/9.x/adventurer/svg?seed=Kai',
                'https://api.dicebear.com/9.x/adventurer/svg?seed=Nora',
              ]
              return (
                <div className="space-y-2">
                  <label className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Avatar</label>
                  <div className="flex gap-2 flex-wrap">
                    {PRESET_AVATARS.map(url => (
                      <button key={url} type="button" onClick={() => setEditAvatar(editAvatar === url ? '' : url)}
                        className={`size-9 rounded-xl overflow-hidden border-2 transition-all ${editAvatar === url ? 'border-[#adee2b] shadow-md scale-110' : 'border-transparent hover:border-slate-300'}`}>
                        <img src={url} className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-slate-400">Custom URL</label>
                    <input value={editAvatar} onChange={e => setEditAvatar(e.target.value)} placeholder="https://..."
                      className="w-full border border-slate-200 rounded-xl px-3 py-2 text-[11px] font-bold focus:outline-none focus:ring-2 focus:ring-[#adee2b]" />
                  </div>
                </div>
              )
            })()}

            {/* Info fields */}
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 space-y-1">
                <label className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Full Name *</label>
                <input value={editName} onChange={e => setEditName(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-[#adee2b]" />
              </div>
              <div className="col-span-2 space-y-1">
                <label className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Email *</label>
                <input type="email" value={editEmail} onChange={e => setEditEmail(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-[#adee2b]" />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Department</label>
                <select value={editDeptId ?? ''} onChange={e => setEditDeptId(e.target.value ? Number(e.target.value) : null)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-[#adee2b] appearance-none cursor-pointer">
                  <option value="">— No department —</option>
                  {(departments as Department[]).map(d => <option key={d.id} value={d.id}>{d.name}{d.code ? ` (${d.code})` : ''}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Ext (phone)</label>
                <input value={editExt} onChange={e => setEditExt(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-[#adee2b]" />
              </div>
              <div className="col-span-2 space-y-1">
                <label className="text-[9px] font-black uppercase text-slate-400 tracking-wider">New Password <span className="normal-case font-medium">(leave blank to keep)</span></label>
                <div className="relative">
                  <input type={editShowPw ? 'text' : 'password'} value={editPw} onChange={e => setEditPw(e.target.value)} placeholder="min. 8 characters"
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 pr-10 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-[#adee2b]" />
                  <button type="button" onClick={() => setEditShowPw(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                    <span className="material-symbols-outlined" style={{ fontSize: 16 }}>{editShowPw ? 'visibility_off' : 'visibility'}</span>
                  </button>
                </div>
              </div>
              {editPw && (
                <div className="col-span-2 space-y-1">
                  <label className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Confirm New Password</label>
                  <div className="relative">
                    <input type={editShowPw ? 'text' : 'password'} value={editConfirmPw} onChange={e => setEditConfirmPw(e.target.value)} placeholder="Re-enter new password"
                      className={`w-full border rounded-xl px-3 py-2 pr-10 text-sm font-bold focus:outline-none focus:ring-2 ${editConfirmPw && editConfirmPw !== editPw ? 'border-red-300 focus:ring-red-400' : editConfirmPw && editConfirmPw === editPw ? 'border-green-300 focus:ring-green-400' : 'border-slate-200 focus:ring-[#adee2b]'}`} />
                  </div>
                  {editConfirmPw && editConfirmPw !== editPw && (
                    <p className="flex items-center gap-1 text-[10px] text-red-500 font-bold">
                      <span className="material-symbols-outlined" style={{ fontSize: 11 }}>error</span>Passwords do not match
                    </p>
                  )}
                  {editConfirmPw && editConfirmPw === editPw && (
                    <p className="flex items-center gap-1 text-[10px] text-green-600 font-bold">
                      <span className="material-symbols-outlined" style={{ fontSize: 11 }}>check_circle</span>Passwords match
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Role selector */}
            {(() => {
              const adminCount = (users as User[]).filter(u => u.role === 'admin').length
              const isLastAdmin = editUser?.role === 'admin' && adminCount <= 1
              return (
                <div className="space-y-2">
                  <p className="text-[9px] font-black uppercase tracking-wider text-slate-400">Role</p>
                  <div className="grid grid-cols-2 gap-2">
                    {ALL_ROLES.map(r => {
                      const m = ROLE_META[r]
                      const blocked = isLastAdmin && r !== 'admin'
                      return (
                        <button key={r}
                          onClick={() => !blocked && setRoleValue(r)}
                          disabled={blocked}
                          title={blocked ? 'Cannot demote the last Super Admin' : undefined}
                          className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-[10px] font-black uppercase transition-all
                            ${blocked ? 'opacity-30 cursor-not-allowed bg-white border-slate-200 text-slate-400'
                              : roleValue === r ? `${m.bg} ${m.text} border-transparent`
                              : 'bg-white border-slate-200 text-slate-400 hover:border-slate-300'}`}>
                          <span className={`size-2 rounded-full ${roleValue === r ? 'bg-current' : 'bg-slate-200'}`} />
                          {m.label}
                        </button>
                      )
                    })}
                  </div>
                  {isLastAdmin && (
                    <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5">
                      <span className="material-symbols-outlined text-amber-500 shrink-0 mt-0.5" style={{ fontSize: 14 }}>warning</span>
                      <p className="text-[10px] font-bold text-amber-700 leading-relaxed">
                        This is the only Super Admin. Promote another user to Super Admin before changing this role.
                      </p>
                    </div>
                  )}
                </div>
              )
            })()}

            {/* Building assignment */}
            {(roleValue === 'building_admin' || roleValue === 'receptionist') && (
              <BuildingPicker
                role={roleValue}
                bldIds={bldIds}
                buildings={buildings as Building[]}
                locations={locations as Location[]}
                onToggle={toggleBuilding}
              />
            )}

            </div>{/* end scrollable body */}

            {/* Footer — pinned */}
            <div className="px-7 py-5 border-t border-slate-100 shrink-0 flex gap-3">
              <button onClick={() => setEditUser(null)} className="flex-1 py-3.5 rounded-full text-[10px] font-black uppercase tracking-[0.15em] bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors">Cancel</button>
              <button onClick={handleSave} disabled={saving || (roleValue === 'building_admin' && bldIds.length === 0)}
                className="flex-1 py-3.5 rounded-full text-[10px] font-black uppercase tracking-[0.15em] bg-black text-[#adee2b] hover:bg-slate-800 disabled:opacity-40 flex items-center justify-center gap-2 transition-all">
                {saving && <span className="material-symbols-outlined animate-spin" style={{ fontSize: 13 }}>progress_activity</span>}
                Save Changes
              </button>
            </div>
          </div>
        </div>
        </ModalPortal>
      )}
    </div>
  )
}

// ── Settings Tab ─────────────────────────────────────────────────────────────
function SettingsTab() {
  const queryClient = useQueryClient()
  const { data: hours } = useQuery({ queryKey: ['booking-hours'], queryFn: getBookingHours })
  const [localStart, setLocalStart] = useState(hours?.start ?? '07:00')
  const [localEnd,   setLocalEnd]   = useState(hours?.end   ?? '19:00')
  const [saved, setSaved] = useState<{ trimmed: number; cancelled: number } | null>(null)

  const { data: weekend } = useQuery({ queryKey: ['weekend-settings'], queryFn: getWeekendSettings })
  const [wkSat, setWkSat] = useState(weekend?.saturday ?? true)
  const [wkSun, setWkSun] = useState(weekend?.sunday   ?? true)
  const [wkSaved, setWkSaved] = useState(false)

  useEffect(() => {
    if (weekend) { setWkSat(weekend.saturday); setWkSun(weekend.sunday) }
  }, [weekend?.saturday, weekend?.sunday])

  const { mutate: saveWeekend, isPending: wkPending } = useMutation({
    mutationFn: () => updateWeekendSettings(wkSat, wkSun),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['weekend-settings'] })
      setWkSaved(true)
      setTimeout(() => setWkSaved(false), 3000)
    },
  })

  useEffect(() => {
    if (hours) { setLocalStart(hours.start); setLocalEnd(hours.end) }
  }, [hours?.start, hours?.end])

  function toMin(hhmm: string) { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m }
  const isValid = toMin(localEnd) - toMin(localStart) >= 30

  const { mutate, isPending, isError } = useMutation({
    mutationFn: () => updateBookingHours(localStart, localEnd),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['booking-hours'] })
      setSaved({ trimmed: res.trimmed_count, cancelled: res.cancelled_count })
      setTimeout(() => setSaved(null), 6000)
    },
  })

  return (
    <div className="max-w-lg space-y-6">
      <div>
        <p className="text-[9px] font-black uppercase tracking-[0.25em] text-slate-400 mb-1">Admin Dashboard</p>
        <h1 className="text-3xl font-black italic tracking-tighter uppercase">Settings</h1>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 p-6 space-y-5">
        <div>
          <p className="text-[11px] font-black uppercase tracking-wider text-slate-700">Booking Hours</p>
          <p className="text-[10px] text-slate-400 mt-0.5">Set the global time window during which rooms can be booked.</p>
        </div>

        <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-[10px] text-amber-700 font-semibold leading-relaxed">
          <span className="font-black">Warning:</span> Tightening these hours will automatically trim or cancel existing future bookings that fall outside the new window.
        </div>

        <div className="flex items-end gap-4">
          <div className="space-y-1.5">
            <label className="text-[9px] font-black uppercase text-slate-400 tracking-wider px-1">Start Time</label>
            <GlassTimePicker value={localStart} onChange={setLocalStart} min="00:00" max="23:00" step={30} panelWidth={140}>
              {() => (
                <button type="button"
                  className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl text-[13px] font-black px-4 py-2.5 hover:border-[#adee2b] transition-all tabular-nums">
                  <span className="material-symbols-outlined text-slate-400" style={{ fontSize: 16 }}>schedule</span>
                  {localStart}
                </button>
              )}
            </GlassTimePicker>
          </div>

          <span className="text-slate-300 text-lg font-black pb-2.5">→</span>

          <div className="space-y-1.5">
            <label className="text-[9px] font-black uppercase text-slate-400 tracking-wider px-1">End Time</label>
            <GlassTimePicker value={localEnd} onChange={setLocalEnd} min="00:30" max="23:30" step={30} panelWidth={140}>
              {() => (
                <button type="button"
                  className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl text-[13px] font-black px-4 py-2.5 hover:border-[#adee2b] transition-all tabular-nums">
                  <span className="material-symbols-outlined text-slate-400" style={{ fontSize: 16 }}>schedule</span>
                  {localEnd}
                </button>
              )}
            </GlassTimePicker>
          </div>
        </div>

        {!isValid && (
          <p className="text-[10px] text-red-500 font-semibold">End time must be at least 30 minutes after start time.</p>
        )}

        {isError && (
          <p className="text-[10px] text-red-500 font-semibold">Failed to save. Please try again.</p>
        )}

        {saved && (
          <div className="p-3 bg-[#f0ffe0] border border-[#adee2b] rounded-xl text-[10px] font-semibold text-slate-700">
            Saved. {saved.trimmed > 0 && <span>{saved.trimmed} booking{saved.trimmed !== 1 ? 's' : ''} trimmed. </span>}
            {saved.cancelled > 0 && <span>{saved.cancelled} booking{saved.cancelled !== 1 ? 's' : ''} cancelled.</span>}
            {saved.trimmed === 0 && saved.cancelled === 0 && <span>No existing bookings were affected.</span>}
          </div>
        )}

        <button
          type="button"
          onClick={() => mutate()}
          disabled={!isValid || isPending}
          className="px-5 py-2.5 bg-black text-[#adee2b] text-[10px] font-black uppercase rounded-xl hover:opacity-80 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed">
          {isPending ? 'Saving...' : 'Save Changes'}
        </button>
      </div>

      {/* Weekend / Red Date Settings */}
      <div className="bg-white rounded-2xl border border-slate-100 p-6 space-y-5">
        <div>
          <p className="text-[11px] font-black uppercase tracking-wider text-slate-700">Weekend (Red Dates)</p>
          <p className="text-[10px] text-slate-400 mt-0.5">Mark Saturday and/or Sunday as weekend days — shown in red on all calendars.</p>
        </div>

        <div className="space-y-3">
          {/* Saturday toggle */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="size-8 rounded-xl flex items-center justify-center" style={{ background: wkSat ? 'rgba(239,68,68,0.1)' : 'rgba(0,0,0,0.04)' }}>
                <span className="material-symbols-outlined" style={{ fontSize: 16, color: wkSat ? '#ef4444' : '#94a3b8' }}>calendar_today</span>
              </div>
              <div>
                <p className="text-[12px] font-black text-slate-700">Saturday</p>
                <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">{wkSat ? 'Shown as red / weekend' : 'Regular day'}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setWkSat(v => !v)}
              className="relative shrink-0 transition-all"
              style={{ width: 44, height: 24 }}
            >
              <div className="absolute inset-0 rounded-full transition-colors" style={{ background: wkSat ? '#ef4444' : '#e2e8f0' }} />
              <div className="absolute top-1 transition-all rounded-full bg-white shadow-sm" style={{ width: 16, height: 16, left: wkSat ? 24 : 4 }} />
            </button>
          </div>

          <div className="border-t border-slate-50" />

          {/* Sunday toggle */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="size-8 rounded-xl flex items-center justify-center" style={{ background: wkSun ? 'rgba(239,68,68,0.1)' : 'rgba(0,0,0,0.04)' }}>
                <span className="material-symbols-outlined" style={{ fontSize: 16, color: wkSun ? '#ef4444' : '#94a3b8' }}>calendar_today</span>
              </div>
              <div>
                <p className="text-[12px] font-black text-slate-700">Sunday</p>
                <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">{wkSun ? 'Shown as red / weekend' : 'Regular day'}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setWkSun(v => !v)}
              className="relative shrink-0 transition-all"
              style={{ width: 44, height: 24 }}
            >
              <div className="absolute inset-0 rounded-full transition-colors" style={{ background: wkSun ? '#ef4444' : '#e2e8f0' }} />
              <div className="absolute top-1 transition-all rounded-full bg-white shadow-sm" style={{ width: 16, height: 16, left: wkSun ? 24 : 4 }} />
            </button>
          </div>
        </div>

        {wkSaved && (
          <div className="p-3 bg-[#f0ffe0] border border-[#adee2b] rounded-xl text-[10px] font-semibold text-slate-700">
            Saved. Calendar weekend highlights updated.
          </div>
        )}

        <button
          type="button"
          onClick={() => saveWeekend()}
          disabled={wkPending}
          className="px-5 py-2.5 bg-black text-[#adee2b] text-[10px] font-black uppercase rounded-xl hover:opacity-80 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed">
          {wkPending ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </div>
  )
}

// ── Main AdminPage ───────────────────────────────────────────────────────────
export default function AdminPage() {
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'
  const [tab, setTab] = useState<Tab>('overview')
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [sortKey, setSortKey] = useState<SortKey>('start_at')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('desc') }
  }

  const now = new Date()

  const sortedBookings = useMemo(() => {
    const upcoming = mockBookings.filter(b => new Date(b.end_at) >= now)
    const past = mockBookings.filter(b => new Date(b.end_at) < now)
    function sortFn(a: typeof mockBookings[0], b: typeof mockBookings[0]) {
      let va = '', vb = ''
      if (sortKey === 'start_at') return sortDir === 'desc'
        ? new Date(b.start_at).getTime() - new Date(a.start_at).getTime()
        : new Date(a.start_at).getTime() - new Date(b.start_at).getTime()
      if (sortKey === 'title') { va = a.title; vb = b.title }
      else if (sortKey === 'room') { va = a.room?.name ?? ''; vb = b.room?.name ?? '' }
      else if (sortKey === 'user') { va = a.user?.name ?? ''; vb = b.user?.name ?? '' }
      else if (sortKey === 'status') { va = a.status; vb = b.status }
      return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va)
    }
    return [...upcoming.sort(sortFn), ...past.sort(sortFn)]
  }, [sortKey, sortDir])

  const recentBookings = useMemo(() =>
    [...mockBookings].sort((a, b) => new Date(b.start_at).getTime() - new Date(a.start_at).getTime()).slice(0, 5)
  , [])

  const totalBookings = mockBookings.length
  const confirmedBookings = mockBookings.filter(b => b.status === 'confirmed').length
  const totalRooms = mockRooms.filter(r => r.is_active).length
  const totalUsers = mockUsers.length

  const mainTabs: { key: Tab; label: string; icon: string }[] = [
    { key: 'overview',  label: 'Overview',  icon: 'dashboard' },
    { key: 'bookings',  label: 'Bookings',  icon: 'event' },
    { key: 'buildings', label: 'Buildings', icon: 'domain' },
    { key: 'assets',    label: 'Assets',    icon: 'inventory_2' },
    { key: 'users',     label: 'Users',     icon: 'group' },
  ]
  const settingsTabDef = isAdmin ? { key: 'settings' as Tab, label: 'Settings', icon: 'tune' } : null
  const tabs = [...mainTabs, ...(settingsTabDef ? [settingsTabDef] : [])]

  return (
    <div className="flex flex-1 overflow-hidden bg-[#f7f8f6]">
      <style>{`
        @keyframes admin-tab-in {
          from { opacity: 0; transform: translateY(10px) }
          to   { opacity: 1; transform: translateY(0) }
        }
        .admin-tab-in { animation: admin-tab-in 0.22s cubic-bezier(0.4,0,0.2,1) both }
      `}</style>
      {/* Sidebar — floating dark panel */}
      <div className={`shrink-0 p-3 transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] ${sidebarCollapsed ? 'w-[76px]' : 'w-[200px]'}`}>
        <div className="bg-white rounded-3xl h-full flex flex-col py-4 px-2 shadow-sm border border-slate-100">

          {/* Label — expanded only */}
          <div className={`px-2 mb-3 transition-all duration-200 overflow-hidden ${sidebarCollapsed ? 'h-0 opacity-0 mb-0' : 'h-7 opacity-100'}`}>
            <p className="text-[9px] font-black uppercase tracking-[0.3em] text-slate-300 whitespace-nowrap">Admin Panel</p>
          </div>

          {/* Nav items */}
          <div className="flex flex-col gap-0.5 flex-1">
            {mainTabs.map(t => (
              <div key={t.key} className="relative group">
                <button onClick={() => setTab(t.key)}
                  className={`w-full flex items-center gap-3 rounded-2xl transition-all duration-150 text-[10px] font-black uppercase overflow-hidden
                    ${sidebarCollapsed ? 'justify-center py-3 px-0' : 'px-3 py-2.5'}
                    ${tab === t.key
                      ? 'bg-[#adee2b]/20 text-black'
                      : 'text-slate-400 hover:text-slate-800 hover:bg-slate-50'
                    }`}>
                  <span className="material-symbols-outlined shrink-0" style={{ fontSize: 20 }}>{t.icon}</span>
                  {!sidebarCollapsed && <span className="whitespace-nowrap tracking-wide">{t.label}</span>}
                </button>

                {/* Fluid glass tooltip — collapsed only */}
                {sidebarCollapsed && (
                  <div className="absolute left-full top-1/2 -translate-y-1/2 ml-3 z-[200] pointer-events-none
                    opacity-0 translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-200">
                    <div style={{
                      background: 'rgba(255,255,255,0.75)',
                      backdropFilter: 'blur(20px)',
                      WebkitBackdropFilter: 'blur(20px)',
                      border: '1px solid rgba(255,255,255,0.6)',
                      boxShadow: '0 8px 32px rgba(0,0,0,0.10), 0 1px 4px rgba(0,0,0,0.06)',
                    }} className="px-3.5 py-2 rounded-xl whitespace-nowrap">
                      <span className="text-[10px] font-black uppercase tracking-widest text-slate-700">{t.label}</span>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Settings — pinned at bottom */}
          {settingsTabDef && (
            <div className="relative group border-t border-slate-100 pt-1 mt-1">
              <button onClick={() => setTab(settingsTabDef.key)}
                className={`w-full flex items-center gap-3 rounded-2xl transition-all duration-150 text-[10px] font-black uppercase overflow-hidden
                  ${sidebarCollapsed ? 'justify-center py-3 px-0' : 'px-3 py-2.5'}
                  ${tab === settingsTabDef.key
                    ? 'bg-[#adee2b]/20 text-black'
                    : 'text-slate-400 hover:text-slate-800 hover:bg-slate-50'
                  }`}>
                <span className="material-symbols-outlined shrink-0" style={{ fontSize: 20 }}>{settingsTabDef.icon}</span>
                {!sidebarCollapsed && <span className="whitespace-nowrap tracking-wide">{settingsTabDef.label}</span>}
              </button>
              {sidebarCollapsed && (
                <div className="absolute left-full top-1/2 -translate-y-1/2 ml-3 z-[200] pointer-events-none
                  opacity-0 translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-200">
                  <div style={{
                    background: 'rgba(255,255,255,0.75)',
                    backdropFilter: 'blur(20px)',
                    WebkitBackdropFilter: 'blur(20px)',
                    border: '1px solid rgba(255,255,255,0.6)',
                    boxShadow: '0 8px 32px rgba(0,0,0,0.10), 0 1px 4px rgba(0,0,0,0.06)',
                  }} className="px-3.5 py-2 rounded-xl whitespace-nowrap">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-700">{settingsTabDef.label}</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Toggle */}
          <div className="pt-2 mt-1 border-t border-slate-100">
            <button onClick={() => setSidebarCollapsed(s => !s)}
              className="w-full flex items-center justify-center py-2 rounded-xl text-slate-300 hover:text-slate-500 hover:bg-slate-50 transition-all">
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                {sidebarCollapsed ? 'keyboard_double_arrow_right' : 'keyboard_double_arrow_left'}
              </span>
            </button>
          </div>

        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-8" style={{ scrollbarWidth: 'thin' }}>

        {tab === 'overview' && (
          <div className="max-w-4xl space-y-6 admin-tab-in">
            <div>
              <p className="text-[9px] font-black uppercase tracking-[0.25em] text-slate-400 mb-1">Admin Dashboard</p>
              <h1 className="text-3xl font-black italic tracking-tighter uppercase">Overview</h1>
            </div>
            <div className="grid grid-cols-4 gap-4">
              <StatCard label="Total Bookings" value={String(totalBookings)} sub="all time" dark />
              <StatCard label="Confirmed" value={String(confirmedBookings)} sub="active bookings" />
              <StatCard label="Active Rooms" value={String(totalRooms)} sub="available" />
              <StatCard label="Users" value={String(totalUsers)} sub="registered" />
            </div>
            <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                <h3 className="text-sm font-black uppercase">Recent Bookings</h3>
                <button onClick={() => setTab('bookings')} className="text-[9px] font-black uppercase text-[#adee2b] bg-black px-3 py-1.5 rounded-lg hover:opacity-80">View All</button>
              </div>
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-100">
                    {['Title', 'Room', 'User', 'Date', 'Status'].map(h => (
                      <th key={h} className="px-6 py-3 text-left text-[8px] font-black uppercase text-slate-400 tracking-widest">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {recentBookings.map(b => (
                    <tr key={b.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-3 text-xs font-bold">{b.title}</td>
                      <td className="px-6 py-3 text-xs text-slate-500">{b.room?.name}</td>
                      <td className="px-6 py-3">
                        <div className="flex items-center gap-2">
                          <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${b.user?.name}`} className="size-6 rounded-full bg-slate-100" />
                          <div>
                            <p className="text-xs text-slate-500">{b.user?.name}</p>
                            {b.booked_for && <p className="text-[9px] text-slate-400 font-bold flex items-center gap-0.5"><span className="material-symbols-outlined" style={{ fontSize: 10 }}>person_pin</span>for {b.booked_for}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-3 text-xs text-slate-500">
                        {new Date(b.start_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                      </td>
                      <td className="px-6 py-3">
                        <span className={`text-[8px] font-black uppercase px-2 py-1 rounded-full
                          ${b.status === 'confirmed' ? 'bg-[#adee2b] text-black' : b.status === 'tentative' ? 'bg-slate-100 text-slate-500' : 'bg-red-100 text-red-500'}`}>
                          {b.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === 'bookings' && (
          <div className="max-w-5xl space-y-4 admin-tab-in">
            <div className="flex items-end justify-between">
              <div>
                <p className="text-[9px] font-black uppercase tracking-[0.25em] text-slate-400 mb-1">Admin Dashboard</p>
                <h1 className="text-3xl font-black italic tracking-tighter uppercase">All Bookings</h1>
              </div>
              <p className="text-[9px] font-bold text-slate-400">Upcoming first · Past at bottom</p>
            </div>
            <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50">
                    <th className="px-4 py-3 text-left text-[8px] font-black uppercase text-slate-400 tracking-widest">#</th>
                    {([
                      { label: 'Title', key: 'title' },
                      { label: 'Room', key: 'room' },
                      { label: 'User / Dept', key: 'user' },
                      { label: 'Start', key: 'start_at' },
                      { label: 'Status', key: 'status' },
                    ] as { label: string; key: SortKey }[]).map(h => (
                      <th key={h.key} className="px-4 py-3 text-left">
                        <button onClick={() => toggleSort(h.key)}
                          className="flex items-center gap-1 text-[8px] font-black uppercase tracking-widest hover:text-slate-700 transition-colors"
                          style={{ color: sortKey === h.key ? '#000' : '' }}>
                          <span className={sortKey === h.key ? 'text-black' : 'text-slate-400'}>{h.label}</span>
                          <span className="material-symbols-outlined text-[10px] leading-none" style={{ color: sortKey === h.key ? '#000' : '#cbd5e1' }}>
                            {sortKey === h.key ? (sortDir === 'asc' ? 'arrow_upward' : 'arrow_downward') : 'unfold_more'}
                          </span>
                        </button>
                      </th>
                    ))}
                    <th className="px-4 py-3 text-left text-[8px] font-black uppercase text-slate-400 tracking-widest">End</th>
                    <th className="px-4 py-3 text-left text-[8px] font-black uppercase text-slate-400 tracking-widest">Type</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedBookings.map(b => {
                    const isPast = new Date(b.end_at) < now
                    return (
                      <tr key={b.id} className={`border-b border-slate-50 transition-colors ${isPast ? 'opacity-40 hover:opacity-60' : 'hover:bg-slate-50'}`}>
                        <td className="px-4 py-3 text-[10px] font-black text-slate-300">{b.id}</td>
                        <td className="px-4 py-3 text-xs font-bold">{b.title}</td>
                        <td className="px-4 py-3 text-xs text-slate-500">{b.room?.name}</td>
                        <td className="px-4 py-3">
                          <p className="text-xs font-bold">{b.user?.name}</p>
                          <p className="text-[9px] text-slate-400">{b.user?.department_name ?? (typeof b.user?.department === 'string' ? b.user.department : '')}</p>
                          {b.booked_for && <p className="text-[9px] text-slate-400 font-bold flex items-center gap-0.5 mt-0.5"><span className="material-symbols-outlined" style={{ fontSize: 10 }}>person_pin</span>for {b.booked_for}</p>}
                        </td>
                        <td className="px-4 py-3 text-[10px] text-slate-500">
                          {new Date(b.start_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                          {' '}{new Date(b.start_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-[8px] font-black uppercase px-2 py-1 rounded-full
                            ${b.status === 'confirmed' ? 'bg-[#adee2b] text-black' : b.status === 'tentative' ? 'bg-slate-100 text-slate-500' : 'bg-red-100 text-red-500'}`}>
                            {b.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-[10px] text-slate-500">
                          {new Date(b.end_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td className="px-4 py-3 text-[9px] text-slate-400 uppercase font-bold">{b.type}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === 'buildings' && <div className="admin-tab-in"><BuildingsTab /></div>}

        {tab === 'assets' && <div className="admin-tab-in"><AssetsTab /></div>}

        {tab === 'users' && <div className="admin-tab-in"><UsersTab /></div>}

        {tab === 'settings' && <div className="admin-tab-in"><SettingsTab /></div>}
      </div>
    </div>
  )
}
