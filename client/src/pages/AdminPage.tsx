import { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import { ResponsiveLine } from '@nivo/line'
import { ResponsivePie } from '@nivo/pie'
import { ResponsiveBar } from '@nivo/bar'
import { getAnalyticsOverview, downloadAnalyticsExport } from '../api/analytics'
import type { SectionPeriod } from '../api/analytics'
import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import * as XLSX from 'xlsx'
import ExcelJS from 'exceljs'
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import { mockBookings, mockRooms, mockUsers } from '../data/mockData'
import type { Building, Room, Location, User, Department } from '../types/index'
import { getBuildings, createBuilding, updateBuilding, deleteBuilding, exportBuildings, importBuildings } from '../api/buildings'
import { getRooms, createRoom, updateRoom, updateRoomStatus, updateRoomSpecial, deleteRoom, reorderRooms, uploadRoomPhoto, deleteRoomPhoto, regenerateSensorCode, exportRooms, importRooms } from '../api/rooms'
import { getUsers, createUser, updateUser, importUsers, updateUserRole, assignUserBuildings, deleteUser, exportUsers } from '../api/users'
import { getLocations, createLocation, updateLocation, deleteLocation } from '../api/locations'
import { getDepartments, createDepartment, updateDepartment, deleteDepartment } from '../api/departments'
import { getBookingHours, updateBookingHours, getWeekendSettings, updateWeekendSettings, getGeneralSettings, updateGeneralSettings, toggleUserSpecialAccess, uploadAppLogo, deleteAppLogo, uploadLoginPhoto, deleteLoginPhoto, getM365Settings, updateM365Settings, testM365Connection, sendM365TestEmail, sendSmtpTestEmail } from '../api/settings'
import { getArchive, runArchive, restoreBooking, restoreAllBookings, purgeArchive, importArchive } from '../api/archive'
import type { ArchiveParams } from '../api/archive'
import { runBackupExport, listBackupExports, getBackupDownloadUrl, deleteAllBackupExports } from '../api/backup'
import type { UserRole } from '../types/index'
import { SpecialRoomBadge } from '../components/ui/SpecialRoomBadge'
import UserAvatar from '../components/ui/UserAvatar'
import GlassTimePicker from '../components/ui/GlassTimePicker'
import { useAuth } from '../context/AuthContext'
import { useCancelToast } from '../context/CancelToastContext'
import KioskTab from '../components/admin/KioskTab'
import ActivityLogTab from '../components/admin/ActivityLogTab'
import { getDisputes, resolveDispute } from '../api/bookings'
import type { Booking } from '../types/index'

type Tab = 'overview' | 'users' | 'buildings' | 'settings' | 'archive' | 'kiosk' | 'sensor' | 'activity' | 'disputes'

function ModalPortal({ children }: { children: ReactNode }) {
  return <>{createPortal(children, document.body)}</>
}

function StatCard({ label, value, sub, dark }: { label: string; value: string; sub: string; dark?: boolean }) {
  return (
    <div className={`p-5 rounded-2xl ${dark ? 'bg-black' : 'bg-[var(--ds-bg-surface)] border border-[var(--ds-border-sub)]'}`}>
      <p className={`text-[8px] font-black uppercase tracking-widest ${dark ? 'text-slate-500' : 'text-[var(--ds-text-3)]'}`}>{label}</p>
      <p className={`text-4xl font-black italic mt-1 ${dark ? 'text-[#adee2b]' : 'text-[var(--ds-text-1)]'}`}>{value}</p>
      <p className={`text-[9px] font-bold mt-0.5 ${dark ? 'text-slate-500' : 'text-[var(--ds-text-3)]'}`}>{sub}</p>
    </div>
  )
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
    } catch { setErr('Failed to save building.') } finally { setSaving(false) }
  }

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

// ── Room form modal (within a building) ─────────────────────────────────────
const PRESET_FACILITIES = [
  // AV / Display
  { name: 'TV / Monitor',        icon: 'tv' },
  { name: 'Projector',           icon: 'present_to_all' },
  { name: 'Smart Display',       icon: 'smart_display' },
  { name: 'Video Conference',    icon: 'video_call' },
  { name: 'Webcam',              icon: 'camera_alt' },
  { name: 'Document Camera',     icon: 'document_scanner' },
  { name: 'Laser Pointer',       icon: 'highlight' },
  // Audio
  { name: 'Microphone',          icon: 'mic' },
  { name: 'Speaker',             icon: 'speaker' },
  { name: 'Headset',             icon: 'headset' },
  { name: 'Speakerphone',        icon: 'record_voice_over' },
  // Board / Writing
  { name: 'Whiteboard',          icon: 'edit_square' },
  { name: 'Flip Chart / Easel',  icon: 'draw' },
  // Connectivity
  { name: 'WiFi',                icon: 'wifi' },
  { name: 'HDMI Cable',          icon: 'cable' },
  { name: 'DP Cable',            icon: 'cable' },
  { name: 'USB Hub',             icon: 'usb' },
  { name: 'Adapter Kit',         icon: 'settings_input_component' },
  { name: 'Power Strip',         icon: 'electrical_services' },
  { name: 'Extension Cord',      icon: 'extension' },
  // Devices
  { name: 'Laptop',              icon: 'laptop' },
  { name: 'Desktop PC',          icon: 'desktop_windows' },
  { name: 'Tablet',              icon: 'tablet' },
  // Office
  { name: 'Printer',             icon: 'print' },
  { name: 'Scanner',             icon: 'scanner' },
  { name: 'Phone / Intercom',    icon: 'phone' },
  // Climate
  { name: 'Air Conditioner',     icon: 'ac_unit' },
  { name: 'Ceiling Fan',         icon: 'mode_fan' },
  { name: 'Air Purifier',        icon: 'air' },
  // Food & Beverage
  { name: 'Coffee Machine',      icon: 'coffee_maker' },
  { name: 'Water Dispenser',     icon: 'water_drop' },
  { name: 'Mini Refrigerator',   icon: 'kitchen' },
  { name: 'Snack Station',       icon: 'restaurant' },
  // Room
  { name: 'Standing Desk',       icon: 'desk' },
  { name: 'Locker / Storage',    icon: 'inventory_2' },
  // Safety
  { name: 'First Aid Kit',       icon: 'medical_services' },
  { name: 'Fire Extinguisher',   icon: 'fire_extinguisher' },
  // Accessibility
  { name: 'Accessible Seating',  icon: 'accessible' },
]

const ICON_CATEGORIES: Record<string, string[]> = {
  'AV / Display': [
    'tv', 'desktop_windows', 'laptop', 'laptop_chromebook', 'tablet', 'smartphone',
    'smart_display', 'present_to_all', 'cast', 'screen_share', 'videocam',
    'video_call', 'camera_alt', 'photo_camera', 'document_scanner',
    'slideshow', 'movie', 'live_tv', 'highlight', 'airplay',
  ],
  'Audio': [
    'mic', 'mic_none', 'speaker', 'speaker_group', 'volume_up',
    'headset', 'headphones', 'earbuds', 'record_voice_over',
    'surround_sound', 'hearing', 'graphic_eq', 'equalizer', 'music_note',
  ],
  'Connectivity': [
    'wifi', 'wifi_off', 'bluetooth', 'bluetooth_connected',
    'usb', 'cable', 'electrical_services', 'outlet', 'extension',
    'lan', 'router', 'hub', 'device_hub', 'settings_input_component',
    'settings_input_hdmi', 'cast_connected', 'nfc', 'signal_wifi_4_bar',
  ],
  'Office': [
    'print', 'scanner', 'fax', 'edit', 'edit_square', 'draw',
    'brush', 'format_paint', 'email', 'mail', 'description',
    'article', 'inventory_2', 'folder', 'cloud', 'calculate',
    'sticky_note_2', 'note', 'bookmark', 'label', 'content_copy',
  ],
  'Room / Furniture': [
    'meeting_room', 'chair', 'desk', 'table_restaurant', 'weekend',
    'door_open', 'window', 'king_bed', 'hotel', 'corporate_fare',
    'apartment', 'home', 'local_parking', 'stairs', 'elevator',
    'accessible', 'balcony', 'deck',
  ],
  'Climate': [
    'ac_unit', 'thermostat', 'device_thermostat', 'air', 'mode_fan',
    'humidity_high', 'water_drop', 'wb_sunny', 'wb_cloudy', 'wind_power',
  ],
  'Food / Beverage': [
    'coffee', 'coffee_maker', 'local_cafe', 'restaurant', 'dining',
    'kitchen', 'microwave', 'water_full', 'local_bar',
    'emoji_food_beverage', 'lunch_dining', 'fastfood', 'cake',
    'set_meal', 'bakery_dining', 'local_drink',
  ],
  'Safety': [
    'lock', 'lock_open', 'security', 'fire_extinguisher',
    'emergency', 'medical_services', 'health_and_safety', 'shield',
    'gpp_good', 'verified_user', 'local_hospital', 'medication',
  ],
  'Tools & Misc': [
    'build', 'handyman', 'construction', 'hardware', 'plumbing',
    'cleaning_services', 'recycling', 'star', 'favorite', 'flag',
    'notifications', 'alarm', 'schedule', 'timer', 'hourglass_empty',
    'event', 'calendar_today', 'groups', 'people', 'person',
    'local_florist', 'spa', 'fitness_center', 'sports', 'devices',
    'phone', 'watch', 'key', 'badge',
  ],
}

function IconPickerModal({ current, onSelect, onClose }: {
  current: string
  onSelect: (icon: string) => void
  onClose: () => void
}) {
  const [search, setSearch]   = useState('')
  const [cat, setCat]         = useState('All')
  const allIcons               = Object.values(ICON_CATEGORIES).flat()
  const cats                   = ['All', ...Object.keys(ICON_CATEGORIES)]
  const baseIcons              = cat === 'All' ? allIcons : (ICON_CATEGORIES[cat] ?? [])
  const query                  = search.toLowerCase().trim()
  const filtered               = query
    ? allIcons.filter(i => i.replace(/_/g, ' ').includes(query))
    : baseIcons

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-[1100] flex items-center justify-center p-4"
        style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
        onClick={onClose}>
        <div className="bg-[var(--ds-bg-surface)] rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col overflow-hidden"
          style={{ height: '80vh' }}
          onClick={e => e.stopPropagation()}>

          {/* Header */}
          <div className="flex items-center gap-3 px-5 py-4 border-b border-[var(--ds-border)] shrink-0">
            <span className="material-symbols-outlined text-[var(--ds-text-3)]" style={{ fontSize: 18 }}>emoji_symbols</span>
            <span className="flex-1 text-[11px] font-black uppercase tracking-widest text-[var(--ds-text-1)]">Choose Icon</span>
            <button onClick={onClose} className="size-8 flex items-center justify-center rounded-xl hover:bg-[var(--ds-bg-raised)] text-[var(--ds-text-3)] transition-colors">
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>close</span>
            </button>
          </div>

          {/* Search */}
          <div className="px-5 pt-3 pb-2 shrink-0">
            <div className="relative">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ds-text-3)] pointer-events-none" style={{ fontSize: 16 }}>search</span>
              <input autoFocus value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search icons..."
                className="w-full pl-9 pr-4 py-2.5 bg-[var(--ds-bg-raised)] border border-[var(--ds-border)] rounded-xl text-[11px] font-bold focus:outline-none focus:ring-2 focus:ring-[#adee2b] text-[var(--ds-text-1)]" />
            </div>
          </div>

          {/* Category tabs */}
          {!query && (
            <div className="flex gap-1.5 px-5 pb-3 overflow-x-auto shrink-0" style={{ scrollbarWidth: 'none' }}>
              {cats.map(c => (
                <button key={c} onClick={() => setCat(c)}
                  className={`shrink-0 px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-wide transition-all
                    ${cat === c ? 'bg-black text-[#adee2b]' : 'bg-[var(--ds-bg-raised)] text-[var(--ds-text-2)] hover:bg-[var(--ds-bg-surface-2)]'}`}>
                  {c}
                </button>
              ))}
            </div>
          )}

          {/* Icon grid */}
          <div className="overflow-y-auto flex-1 px-5 pb-5 pt-1">
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-[var(--ds-text-4)]">
                <span className="material-symbols-outlined mb-2" style={{ fontSize: 32 }}>search_off</span>
                <p className="text-[11px] font-bold">No icons found</p>
              </div>
            ) : (
              <div className="grid gap-1" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(68px, 1fr))' }}>
                {filtered.map(icon => {
                  const active = icon === current
                  return (
                    <button key={icon} onClick={() => { onSelect(icon); onClose() }}
                      title={icon.replace(/_/g, ' ')}
                      className={`flex flex-col items-center gap-1.5 px-1 py-3 rounded-xl transition-all
                        ${active
                          ? 'ring-2 ring-[#adee2b]'
                          : 'hover:bg-[var(--ds-bg-raised)]'}`}
                      style={{ background: active ? 'rgba(173,238,43,0.12)' : undefined }}>
                      <span className="material-symbols-outlined" style={{ fontSize: 24, color: active ? '#4d7c00' : 'var(--ds-text-1)' }}>{icon}</span>
                      <span className="text-[7.5px] font-bold text-[var(--ds-text-3)] text-center leading-tight w-full truncate px-1"
                        style={{ fontVariantLigatures: 'none' }}>
                        {icon.replace(/_/g, ' ')}
                      </span>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </ModalPortal>
  )
}

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
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [uploadErr, setUploadErr]           = useState('')
  const [showUrlInput, setShowUrlInput]     = useState(false)
  const photoFileRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)

  // Facilities
  const [facilities, setFacilities]         = useState<{ name: string; icon: string }[]>(initial?.facilities ?? [])
  const [showPresets, setShowPresets]       = useState(false)
  const [customName, setCustomName]         = useState('')
  const [customIcon, setCustomIcon]         = useState('devices')
  const [iconPickerOpen, setIconPickerOpen] = useState(false)
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
  async function handlePhotoFiles(files: FileList | File[]) {
    if (!initial?.id) return
    setUploadErr(''); setUploadingPhoto(true)
    try {
      for (const file of Array.from(files)) {
        const res = await uploadRoomPhoto(initial.id, file)
        setPhotos(res.photos)
      }
      qc.invalidateQueries({ queryKey: ['rooms'] })
    } catch { setUploadErr('Upload failed. Max 5MB per image.') }
    finally { setUploadingPhoto(false); if (photoFileRef.current) photoFileRef.current.value = '' }
  }
  async function handleDeletePhoto(url: string) {
    if (!initial?.id) return
    try {
      const res = await deleteRoomPhoto(initial.id, url)
      setPhotos(res.photos)
      qc.invalidateQueries({ queryKey: ['rooms'] })
    } catch { /* silent */ }
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
    activeTab === 'photos'     ? { label: 'Done',                                                fn: onClose,        busy: false } :
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
            background: 'var(--ds-bg-surface)',
            backdropFilter: 'blur(48px) saturate(200%)',
            border: '1px solid rgba(128,128,128,0.15)',
          }}
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-7 pt-7 pb-5 border-b border-[var(--ds-border)] shrink-0">
            <div>
              <p className="text-[9px] font-black uppercase tracking-[0.25em] text-[var(--ds-text-3)]">Buildings · Room</p>
              <h2 className="text-2xl font-black italic tracking-tighter uppercase mt-0.5 text-[var(--ds-text-1)]">{isEdit ? initial?.name ?? 'Edit Room' : 'Add Room'}</h2>
            </div>
            <button onClick={onClose} className="size-9 rounded-xl bg-[var(--ds-bg-surface-2)] hover:bg-[var(--ds-bg-raised)] flex items-center justify-center transition-colors">
              <span className="material-symbols-outlined text-[var(--ds-text-3)]" style={{ fontSize: 18 }}>close</span>
            </button>
          </div>

          {/* Tab bar */}
          <div className="flex gap-1 px-7 pt-4 pb-0 shrink-0">
            {TABS.map(t => (
              <button key={t.key} disabled={t.disabled}
                onClick={() => switchTab(t.key)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-t-xl text-[9px] font-black uppercase tracking-wider transition-all
                  ${t.disabled ? 'text-[var(--ds-text-3)] cursor-not-allowed' : activeTab === t.key ? 'bg-[var(--ds-bg-surface)] border border-b-[var(--ds-bg-surface)] border-[var(--ds-border)] text-[var(--ds-text-1)] shadow-sm' : 'text-[var(--ds-text-3)] hover:text-[var(--ds-text-2)]'}`}
                title={t.disabled ? 'Save room first to manage this' : undefined}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 13 }}>{t.icon}</span>
                {t.label}
                {t.key === 'photos' && isEdit && photos.length > 0 && (
                  <span className="ml-0.5 size-4 rounded-full bg-[var(--ds-bg-raised)] text-[var(--ds-text-2)] text-[8px] flex items-center justify-center font-black">{photos.length}</span>
                )}
                {t.key === 'facilities' && isEdit && facilities.length > 0 && (
                  <span className="ml-0.5 size-4 rounded-full bg-[var(--ds-bg-raised)] text-[var(--ds-text-2)] text-[8px] flex items-center justify-center font-black">{facilities.length}</span>
                )}
              </button>
            ))}
          </div>

          {/* Tab content — fixed area, scrolls internally */}
          <div className="flex-1 border-t border-[var(--ds-border)] overflow-hidden relative">
            <div
              key={activeTab}
              className={`absolute inset-0 overflow-y-auto ${animDirRef.current === 'right' ? 'tab-anim-right' : 'tab-anim-left'}`}
              style={{ scrollbarWidth: 'thin' }}
            >

              {/* ── Basic ── */}
              {activeTab === 'basic' && (
                <div className="px-7 py-5 space-y-4">
                  {err && <div className="flex items-center gap-2 text-[11px] font-bold px-4 py-3 rounded-xl" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171' }}><span className="material-symbols-outlined" style={{ fontSize: 15 }}>error</span>{err}</div>}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2 space-y-1.5">
                      <label className="text-[9px] font-black uppercase text-[var(--ds-text-3)] tracking-wider px-1">Room Name *</label>
                      <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Executive Suite 2A"
                        className="w-full bg-[var(--ds-bg-raised)] border border-[var(--ds-border)] rounded-xl px-3 py-2.5 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-[#adee2b] focus:border-transparent text-[var(--ds-text-1)]" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[9px] font-black uppercase text-[var(--ds-text-3)] tracking-wider px-1">Capacity *</label>
                      <div className="relative">
                        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ds-text-3)]" style={{ fontSize: 15 }}>groups</span>
                        <input type="number" min={1} value={capacity} onChange={e => setCapacity(e.target.value)} placeholder="e.g. 10"
                          className="w-full bg-[var(--ds-bg-raised)] border border-[var(--ds-border)] rounded-xl pl-9 pr-3 py-2.5 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-[#adee2b] focus:border-transparent text-[var(--ds-text-1)]" />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[9px] font-black uppercase text-[var(--ds-text-3)] tracking-wider px-1">Floor *</label>
                      <div className="relative">
                        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ds-text-3)]" style={{ fontSize: 15 }}>layers</span>
                        <input value={floor} onChange={e => setFloor(e.target.value)} placeholder="e.g. 2F"
                          className="w-full bg-[var(--ds-bg-raised)] border border-[var(--ds-border)] rounded-xl pl-9 pr-3 py-2.5 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-[#adee2b] focus:border-transparent text-[var(--ds-text-1)]" />
                      </div>
                    </div>
                    <div className="col-span-2 space-y-1.5">
                      <label className="text-[9px] font-black uppercase text-[var(--ds-text-3)] tracking-wider px-1">Notes</label>
                      <textarea rows={2} value={notes} onChange={e => setNotes(e.target.value)}
                        className="w-full bg-[var(--ds-bg-raised)] border border-[var(--ds-border)] rounded-xl px-3 py-2.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#adee2b] focus:border-transparent resize-none text-[var(--ds-text-1)]" />
                    </div>
                    <div className="col-span-2">
                      <button type="button" onClick={() => setRequiresContact(v => !v)}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 transition-all text-left
                          ${requiresContact ? 'border-amber-400 bg-amber-50' : 'border-[var(--ds-border)] bg-[var(--ds-bg-raised)] hover:border-[var(--ds-border)]'}`}>
                        <div className={`size-5 rounded-md flex items-center justify-center shrink-0 transition-all ${requiresContact ? 'bg-amber-400' : 'bg-[var(--ds-bg-surface)] border-2 border-[var(--ds-border)]'}`}>
                          {requiresContact && <span className="material-symbols-outlined text-white" style={{ fontSize: 14 }}>check</span>}
                        </div>
                        <div>
                          <p className={`text-[10px] font-black uppercase ${requiresContact ? 'text-amber-700' : 'text-[var(--ds-text-2)]'}`}>Requires Receptionist / GAA</p>
                          <p className="text-[9px] font-medium text-[var(--ds-text-3)] mt-0.5">Room can only be booked through Receptionist or GAA</p>
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
                  <div className="flex items-center justify-between">
                    <p className="text-[9px] font-black uppercase tracking-widest text-[var(--ds-text-3)]">{photos.length} photo{photos.length !== 1 ? 's' : ''} · first is cover</p>
                    {photos.length > 0 && (
                      <button onClick={savePhotos} disabled={savingPhotos}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[8px] font-black uppercase bg-[#adee2b]/15 text-[#3a6800] dark:text-[#adee2b] hover:bg-[#adee2b]/30 transition-colors disabled:opacity-40">
                        <span className="material-symbols-outlined" style={{ fontSize: 11 }}>{savingPhotos ? 'progress_activity' : 'save'}</span>
                        {savingPhotos ? 'Saving…' : 'Save Order'}
                      </button>
                    )}
                  </div>

                  {/* Photo grid */}
                  {photos.length > 0 && (
                    <div className="grid grid-cols-3 gap-3">
                      {photos.map((url, i) => (
                        <div key={url + i} className="relative group aspect-video rounded-xl overflow-hidden bg-[var(--ds-bg-raised)]">
                          <img src={url} alt="" className="w-full h-full object-cover" onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
                          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5">
                            {i > 0 && (
                              <button onClick={() => setPhotos(prev => { const a = [...prev]; [a[i-1], a[i]] = [a[i], a[i-1]]; return a })}
                                className="size-7 flex items-center justify-center rounded-lg bg-white/20 text-white hover:bg-white/40 transition-colors">
                                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>arrow_back</span>
                              </button>
                            )}
                            <button onClick={() => handleDeletePhoto(url)}
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

                  {/* Drop zone */}
                  <div
                    className={`relative border-2 border-dashed rounded-2xl flex flex-col items-center justify-center gap-2 py-7 transition-all cursor-pointer
                      ${dragOver ? 'border-[#adee2b] bg-[#adee2b]/8' : 'border-[var(--ds-border)] hover:border-[var(--ds-text-3)]'}`}
                    onClick={() => photoFileRef.current?.click()}
                    onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={e => { e.preventDefault(); setDragOver(false); if (e.dataTransfer.files.length) handlePhotoFiles(e.dataTransfer.files) }}
                  >
                    <input ref={photoFileRef} type="file" accept="image/*" multiple className="hidden"
                      onChange={e => { if (e.target.files?.length) handlePhotoFiles(e.target.files) }} />
                    {uploadingPhoto ? (
                      <>
                        <span className="material-symbols-outlined animate-spin text-[#adee2b]" style={{ fontSize: 28 }}>progress_activity</span>
                        <p className="text-[10px] font-black uppercase text-[var(--ds-text-3)]">Uploading…</p>
                      </>
                    ) : (
                      <>
                        <span className="material-symbols-outlined text-[var(--ds-text-3)]" style={{ fontSize: 28 }}>add_a_photo</span>
                        <p className="text-[11px] font-black text-[var(--ds-text-2)]">Click or drag photos here</p>
                        <p className="text-[9px] font-bold text-[var(--ds-text-4)] uppercase tracking-wider">JPG · PNG · WEBP · max 5 MB each</p>
                      </>
                    )}
                  </div>

                  {uploadErr && (
                    <p className="text-[10px] font-bold text-red-500 flex items-center gap-1">
                      <span className="material-symbols-outlined" style={{ fontSize: 13 }}>error</span>{uploadErr}
                    </p>
                  )}

                  {/* URL fallback */}
                  <div>
                    <button onClick={() => setShowUrlInput(v => !v)}
                      className="flex items-center gap-1 text-[9px] font-black uppercase tracking-wider text-[var(--ds-text-4)] hover:text-[var(--ds-text-2)] transition-colors">
                      <span className="material-symbols-outlined" style={{ fontSize: 12 }}>{showUrlInput ? 'expand_less' : 'expand_more'}</span>
                      Or paste image URL
                    </button>
                    {showUrlInput && (
                      <div className="flex gap-2 mt-2">
                        <input value={newUrl} onChange={e => setNewUrl(e.target.value)} onKeyDown={e => e.key === 'Enter' && addPhoto()}
                          placeholder="https://..."
                          className="flex-1 bg-[var(--ds-bg-raised)] border border-[var(--ds-border)] rounded-xl px-3 py-2 text-[11px] font-bold focus:outline-none focus:ring-2 focus:ring-[#adee2b] focus:border-transparent text-[var(--ds-text-1)]" />
                        <button onClick={addPhoto}
                          className="px-3 py-2 bg-[var(--ds-bg-surface-2)] text-[var(--ds-text-2)] rounded-xl text-[9px] font-black uppercase hover:bg-[var(--ds-bg-raised)] flex items-center gap-1 transition-all shrink-0">
                          <span className="material-symbols-outlined" style={{ fontSize: 13 }}>add</span>Add
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ── Facilities ── */}
              {activeTab === 'facilities' && (
                <div className="px-7 py-5 space-y-4">
                  <p className="text-[9px] font-black uppercase tracking-widest text-[var(--ds-text-3)]">{facilities.length} item{facilities.length !== 1 ? 's' : ''}</p>
                  {facilities.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {facilities.map((f, i) => (
                        <div key={i} className="flex items-center gap-2 pl-2.5 pr-1.5 py-1.5 bg-[var(--ds-bg-surface-2)] rounded-xl group">
                          <span className="material-symbols-outlined text-[var(--ds-text-2)]" style={{ fontSize: 15 }}>{f.icon}</span>
                          <span className="text-[10px] font-black uppercase text-[var(--ds-text-2)]">{f.name}</span>
                          <button onClick={() => setFacilities(prev => prev.filter((_, j) => j !== i))}
                            className="size-4 flex items-center justify-center rounded text-[var(--ds-text-3)] hover:text-red-500 transition-colors ml-0.5">
                            <span className="material-symbols-outlined" style={{ fontSize: 12 }}>close</span>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  {showPresets && (
                    <div className="p-3.5 bg-[var(--ds-bg-raised)] rounded-xl border border-[var(--ds-border-sub)]">
                      <p className="text-[9px] font-black uppercase tracking-widest text-[var(--ds-text-3)] mb-2.5">Quick Add</p>
                      <div className="flex flex-wrap gap-1.5">
                        {PRESET_FACILITIES.map(f => {
                          const exists = facilities.some(x => x.name === f.name)
                          return (
                            <button key={f.name} onClick={() => !exists && addPreset(f)} disabled={exists}
                              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[9px] font-black uppercase transition-all
                                ${exists ? 'bg-[var(--ds-bg-surface-2)] text-[var(--ds-text-3)] cursor-not-allowed' : 'bg-[var(--ds-bg-surface)] border border-[var(--ds-border)] text-[var(--ds-text-2)] hover:border-black hover:text-black hover:shadow-sm dark:hover:border-white dark:hover:text-white'}`}>
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
                        ${showPresets ? 'bg-black text-[#adee2b]' : 'bg-[var(--ds-bg-surface-2)] text-[var(--ds-text-2)] hover:bg-[var(--ds-bg-raised)]'}`}>
                      <span className="material-symbols-outlined" style={{ fontSize: 14 }}>bolt</span>Presets
                    </button>
                    <button onClick={() => setIconPickerOpen(true)}
                      className="flex items-center gap-2 px-3 py-2.5 bg-[var(--ds-bg-raised)] border border-[var(--ds-border)] rounded-xl hover:border-[#adee2b] transition-all shrink-0 group">
                      <span className="material-symbols-outlined text-[var(--ds-text-1)]" style={{ fontSize: 18 }}>{customIcon || 'devices'}</span>
                      <span className="text-[9px] font-bold text-[var(--ds-text-3)] uppercase group-hover:text-[var(--ds-text-1)] transition-colors">Icon</span>
                      <span className="material-symbols-outlined text-[var(--ds-text-4)]" style={{ fontSize: 13 }}>expand_more</span>
                    </button>
                    <input value={customName} onChange={e => setCustomName(e.target.value)} onKeyDown={e => e.key === 'Enter' && addCustom()}
                      placeholder="Facility / asset name..."
                      className="flex-1 bg-[var(--ds-bg-raised)] border border-[var(--ds-border)] rounded-xl px-3 py-2.5 text-[11px] font-bold focus:outline-none focus:ring-2 focus:ring-[#adee2b] focus:border-transparent text-[var(--ds-text-1)]" />
                    <button onClick={addCustom}
                      className="px-4 py-2.5 bg-[var(--ds-bg-surface-2)] text-[var(--ds-text-2)] rounded-xl text-[9px] font-black uppercase hover:bg-[var(--ds-bg-raised)] flex items-center gap-1.5 shrink-0 transition-all">
                      <span className="material-symbols-outlined" style={{ fontSize: 14 }}>add</span>Add
                    </button>
                  </div>
                  {iconPickerOpen && (
                    <IconPickerModal current={customIcon} onSelect={setCustomIcon} onClose={() => setIconPickerOpen(false)} />
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Footer — always visible, action changes per tab */}
          <div className="px-7 py-5 border-t border-[var(--ds-border)] shrink-0 flex gap-3">
            <button onClick={onClose} className="flex-1 py-3.5 rounded-full text-[10px] font-black uppercase tracking-[0.15em] bg-[var(--ds-bg-surface-2)] text-[var(--ds-text-2)] hover:bg-[var(--ds-bg-raised)] transition-colors">Cancel</button>
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
function RoomList({ rooms, buildingId, sensorMode, onEdit, onDelete, onReordered, onStatusChange, onSpecialChange, onSensorCodeChange }: {
  rooms: Room[]
  buildingId: number
  sensorMode: boolean
  onEdit: (r: Room) => void
  onDelete: (r: Room) => void
  onReordered: (rooms: Room[]) => void
  onStatusChange: (roomId: number, status: 'active' | 'maintenance') => void
  onSpecialChange: (roomId: number, special: boolean) => void
  onSensorCodeChange: (roomId: number, code: string) => void
}) {
  const { addInfoToast } = useCancelToast()
  const dragIdx = useRef<number | null>(null)
  const [overIdx, setOverIdx] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [togglingStatus, setTogglingStatus] = useState<number | null>(null)
  const [togglingSpecial, setTogglingSpecial] = useState<number | null>(null)
  const [regeneratingSensor, setRegeneratingSensor] = useState<number | null>(null)

  async function handleToggleStatus(r: Room) {
    const next = r.status === 'active' ? 'maintenance' : 'active'
    setTogglingStatus(r.id)
    try { await updateRoomStatus(r.id, next); onStatusChange(r.id, next) }
    finally { setTogglingStatus(null) }
  }

  async function handleToggleSpecial(r: Room) {
    const next = !r.requires_contact
    setTogglingSpecial(r.id)
    try { await updateRoomSpecial(r.id, next); onSpecialChange(r.id, next) }
    finally { setTogglingSpecial(null) }
  }

  async function handleRegenerateSensorCode(r: Room) {
    setRegeneratingSensor(r.id)
    try {
      const updated = await regenerateSensorCode(r.id)
      if (updated.sensor_code) onSensorCodeChange(r.id, updated.sensor_code)
      addInfoToast('Sensor code regenerated')
    } finally { setRegeneratingSensor(null) }
  }

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
      {saving && <p className="text-[9px] font-black uppercase text-[var(--ds-text-3)] tracking-wider px-1">Saving order...</p>}
      {rooms.map((r, i) => (
        <div
          key={r.id}
          draggable
          onDragStart={() => onDragStart(i)}
          onDragOver={e => onDragOver(e, i)}
          onDragLeave={onDragLeave}
          onDrop={e => onDrop(e, i)}
          className={`flex flex-col gap-0 bg-[var(--ds-bg-surface)] rounded-xl border transition-all select-none
            ${overIdx === i ? 'border-[#adee2b] bg-[#f7fee7] dark:bg-[#1a2a0a] scale-[1.01]' : 'border-[var(--ds-border)]'}`}
        >
          {/* Main row */}
          <div className="flex items-center gap-3 px-3 py-2.5">
            <span className="material-symbols-outlined text-[var(--ds-text-3)] cursor-grab active:cursor-grabbing shrink-0" style={{ fontSize: 20 }}>drag_indicator</span>
            <span className="text-xs font-black text-[var(--ds-text-3)] w-5 text-center shrink-0">{i + 1}</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-black text-[var(--ds-text-1)] leading-tight truncate">{r.name}</p>
              <p className="text-[11px] text-[var(--ds-text-3)] font-bold mt-0.5">
                <span className="inline-flex items-center gap-0.5"><span className="material-symbols-outlined" style={{ fontSize: 11 }}>groups</span>{r.capacity} pax</span>
                {' · '}
                <span className="inline-flex items-center gap-0.5"><span className="material-symbols-outlined" style={{ fontSize: 11 }}>layers</span>{r.floor}</span>
              </p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={() => handleToggleStatus(r)}
                disabled={togglingStatus === r.id}
                title={r.status === 'active' ? 'Set to Maintenance' : 'Set to Active'}
                className={`flex items-center gap-1 text-[9px] font-black px-2 py-1 rounded-full border transition-all disabled:opacity-50
                  ${r.status === 'maintenance'
                    ? 'bg-orange-50 text-orange-600 border-orange-200 hover:bg-orange-100'
                    : 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100'}`}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 10, fontVariationSettings: "'FILL' 1" }}>
                  {r.status === 'maintenance' ? 'build' : 'check_circle'}
                </span>
                {togglingStatus === r.id ? '...' : r.status === 'maintenance' ? 'Maint.' : 'Active'}
              </button>
              <button
                onClick={() => handleToggleSpecial(r)}
                disabled={togglingSpecial === r.id}
                title={r.requires_contact ? 'Remove special access requirement' : 'Set as special room'}
                className={`flex items-center gap-1 text-[9px] font-black px-2 py-1 rounded-full border transition-all disabled:opacity-50
                  ${r.requires_contact
                    ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/30'
                    : 'bg-[var(--ds-bg-raised)] text-[var(--ds-text-3)] border-[var(--ds-border)] hover:bg-indigo-500/10 hover:text-indigo-400 hover:border-indigo-500/30'}`}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 10, fontVariationSettings: r.requires_contact ? "'FILL' 1" : "'FILL' 0" }}>star</span>
                {togglingSpecial === r.id ? '...' : r.requires_contact ? 'Special' : 'Regular'}
              </button>
            </div>
            <button
              onClick={() => onEdit(r)}
              className="size-8 flex items-center justify-center rounded-lg bg-[var(--ds-bg-surface-2)] text-[var(--ds-text-3)] hover:bg-black hover:text-[#adee2b] transition-all shrink-0"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 15 }}>edit</span>
            </button>
            <button
              onClick={() => onDelete(r)}
              className="size-8 flex items-center justify-center rounded-lg bg-[var(--ds-bg-surface-2)] text-[var(--ds-text-3)] hover:bg-red-500 hover:text-white transition-all shrink-0"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 15 }}>delete</span>
            </button>
          </div>

          {/* Sensor code row — visible only when sensor mode is enabled */}
          {sensorMode && (
            <div className="flex items-center gap-2 px-3 pb-2.5 pt-0">
              <span className="material-symbols-outlined shrink-0" style={{ fontSize: 13, color: 'var(--ds-text-4)' }}>sensors</span>
              <span className="text-[9px] font-black uppercase tracking-wider shrink-0" style={{ color: 'var(--ds-text-4)' }}>Sensor Code</span>
              <code className="flex-1 min-w-0 text-[10px] font-mono truncate" style={{ color: 'var(--ds-text-3)' }}>{r.sensor_code ?? '—'}</code>
              <button
                type="button"
                onClick={() => r.sensor_code && navigator.clipboard.writeText(r.sensor_code).then(() => addInfoToast('Sensor code copied'))}
                className="shrink-0 size-5 flex items-center justify-center rounded transition-colors hover:bg-[var(--ds-bg-raised)]"
                title="Copy sensor code"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 12, color: 'var(--ds-text-3)' }}>content_copy</span>
              </button>
              <button
                type="button"
                onClick={() => handleRegenerateSensorCode(r)}
                disabled={regeneratingSensor === r.id}
                className="shrink-0 flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-black disabled:opacity-50 transition-colors"
                style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444' }}
                title="Regenerate — must reflash ESP32"
              >
                {regeneratingSensor === r.id
                  ? <span className="material-symbols-outlined animate-spin" style={{ fontSize: 10 }}>progress_activity</span>
                  : <span className="material-symbols-outlined" style={{ fontSize: 10 }}>refresh</span>}
                Regen
              </button>
            </div>
          )}
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
    } catch { setErr('Failed to save.') } finally { setSaving(false) }
  }

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

// ── Buildings Tab ────────────────────────────────────────────────────────────
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


// ── Users Tab ────────────────────────────────────────────────────────────────

const ROLE_META: Record<UserRole, { label: string; bg: string; text: string; desc: string; perms: string[] }> = {
  admin: {
    label: 'Super Admin', bg: 'bg-black', text: 'text-[#adee2b]',
    desc: 'Unrestricted access to all system features.',
    perms: ['Manage all users & roles', 'Manage buildings, rooms & locations', 'Access analytics & export', 'Change all system settings', 'Manage archive & export schedule'],
  },
  building_admin: {
    label: 'Building Admin', bg: 'bg-blue-500/10', text: 'text-blue-400',
    desc: 'Manages rooms within assigned buildings.',
    perms: ['Add / edit / delete rooms', 'Upload room photos', 'Reorder rooms', 'Cannot change system settings', 'Cannot manage other users'],
  },
  receptionist: {
    label: 'Receptionist', bg: 'bg-purple-500/10', text: 'text-purple-400',
    desc: 'Manages bookings with elevated privileges.',
    perms: ['Edit & delete any booking', 'Bypass after-hours restrictions', 'Access special rooms without extra permission', 'Cannot manage rooms or system settings'],
  },
  user: {
    label: 'User', bg: 'bg-[var(--ds-bg-raised)]', text: 'text-[var(--ds-text-3)]',
    desc: 'Standard user with basic booking access.',
    perms: ['Create & manage own bookings', 'View room schedule & availability', 'Cannot manage users or rooms'],
  },
}
const ALL_ROLES: UserRole[] = ['admin', 'building_admin', 'receptionist', 'user']

// ── Default building dropdown (user role only) ────────────────────────────────
function DefaultBuildingSelect({ buildings, value, onChange }: {
  buildings: Building[]
  value: number | null
  onChange: (v: number | null) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const selected = value != null ? buildings.find(b => b.id === value) : null

  useEffect(() => {
    if (!open) return
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  function label(b: Building) {
    let s = b.name
    if (b.code) s += ` (${b.code})`
    if (b.location?.name) s += ` — ${b.location.name}`
    return s
  }

  return (
    <div className="space-y-1.5">
      <p className="text-[9px] font-black uppercase tracking-wider text-[var(--ds-text-3)]">Default Building</p>
      <div ref={ref} className="relative">
        <button
          type="button"
          onClick={() => setOpen(o => !o)}
          className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl border text-sm font-bold transition-all text-left"
          style={{ background: 'var(--ds-bg-surface)', border: '1px solid var(--ds-border)', color: selected ? 'var(--ds-text-1)' : 'var(--ds-text-3)' }}
        >
          <span className="truncate">{selected ? label(selected) : '— None (auto) —'}</span>
          <span className="material-symbols-outlined shrink-0 ml-2 transition-transform" style={{ fontSize: 16, color: 'var(--ds-text-3)', transform: open ? 'rotate(180deg)' : 'none' }}>expand_more</span>
        </button>

        {open && (
          <div
            className="absolute left-0 right-0 z-[200] rounded-xl overflow-hidden mt-1"
            style={{ background: 'var(--ds-bg-surface)', border: '1px solid var(--ds-border)', boxShadow: '0 8px 32px rgba(0,0,0,0.18)' }}
          >
            {/* None option */}
            <button
              type="button"
              onClick={() => { onChange(null); setOpen(false) }}
              className="w-full px-3.5 py-2.5 text-left text-[11px] font-bold transition-colors flex items-center justify-between"
              style={{ color: value == null ? '#6b8f00' : 'var(--ds-text-3)', background: value == null ? 'rgba(173,238,43,0.08)' : 'transparent' }}
              onMouseEnter={e => { if (value != null) e.currentTarget.style.background = 'var(--ds-bg-surface-2)' }}
              onMouseLeave={e => { if (value != null) e.currentTarget.style.background = 'transparent' }}
            >
              <span>— None (auto) —</span>
              {value == null && <span className="material-symbols-outlined" style={{ fontSize: 13, color: '#6b8f00' }}>check</span>}
            </button>

            {buildings.map((b, i) => {
              const active = b.id === value
              return (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => { onChange(b.id); setOpen(false) }}
                  className="w-full px-3.5 py-2.5 text-left transition-colors flex items-center justify-between gap-2"
                  style={{
                    background: active ? 'rgba(173,238,43,0.08)' : 'transparent',
                    borderTop: i === 0 ? '1px solid var(--ds-border)' : '1px solid var(--ds-border-sub)',
                  }}
                  onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'var(--ds-bg-surface-2)' }}
                  onMouseLeave={e => { if (!active) e.currentTarget.style.background = active ? 'rgba(173,238,43,0.08)' : 'transparent' }}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[12px] font-black truncate" style={{ color: active ? '#6b8f00' : 'var(--ds-text-1)' }}>{b.name}</span>
                      {b.code && (
                        <span className="text-[9px] font-black px-1.5 py-0.5 rounded-md shrink-0" style={{ background: 'var(--ds-bg-raised)', color: 'var(--ds-text-3)' }}>{b.code}</span>
                      )}
                    </div>
                    {b.location?.name && (
                      <p className="text-[10px] font-medium mt-0.5 flex items-center gap-1" style={{ color: 'var(--ds-text-3)' }}>
                        <span className="material-symbols-outlined" style={{ fontSize: 10 }}>location_on</span>
                        {b.location.name}
                      </p>
                    )}
                  </div>
                  {active && <span className="material-symbols-outlined shrink-0" style={{ fontSize: 14, color: '#6b8f00' }}>check</span>}
                </button>
              )
            })}
          </div>
        )}
      </div>
      <p className="text-[9px] text-[var(--ds-text-3)] font-medium px-1">User can override this in their own Settings.</p>
    </div>
  )
}

// ── Shared building picker (used in Add + Edit modals) ───────────────────────
function BuildingPicker({ role, bldIds, buildings, locations, onToggle, defaultBuildingId, onSetDefault }: {
  role: UserRole
  bldIds: number[]
  buildings: Building[]
  locations: Location[]
  onToggle: (id: number) => void
  defaultBuildingId?: number | null
  onSetDefault?: (id: number | null) => void
}) {
  const withLocation    = buildings.filter(b => b.location_id)
  const withoutLocation = buildings.filter(b => !b.location_id)
  const locGroups = locations
    .map(loc => ({ loc, buildings: withLocation.filter(b => b.location_id === loc.id) }))
    .filter(g => g.buildings.length > 0)
  const showDefault = !!onSetDefault

  function Row({ b }: { b: Building }) {
    const checked    = bldIds.includes(b.id)
    const isDefault  = defaultBuildingId === b.id
    return (
      <div className={`flex items-center gap-2 mb-1 rounded-xl border transition-all
        ${checked ? 'bg-blue-500/10 border-blue-500/30' : 'bg-[var(--ds-bg-surface)] border-[var(--ds-border)]'}`}>
        <button onClick={() => onToggle(b.id)}
          className="flex items-center gap-3 px-3 py-2 flex-1 min-w-0 text-left">
          <span className={`size-4 rounded-md border-2 flex items-center justify-center shrink-0 transition-all ${checked ? 'bg-blue-500 border-blue-500' : 'border-[var(--ds-border)]'}`}>
            {checked && <span className="material-symbols-outlined text-white" style={{ fontSize: 11 }}>check</span>}
          </span>
          <div className="min-w-0">
            <p className={`text-[11px] font-black truncate ${checked ? 'text-blue-400' : 'text-[var(--ds-text-2)]'}`}>{b.name}</p>
            {b.address && <p className="text-[9px] text-[var(--ds-text-3)] truncate">{b.address}</p>}
          </div>
        </button>
        {showDefault && checked && (
          <button onClick={() => onSetDefault!(isDefault ? null : b.id)}
            className="shrink-0 mr-2 flex items-center gap-1 px-2 py-1 rounded-lg text-[8px] font-black uppercase tracking-wide transition-all"
            style={isDefault
              ? { background: 'rgba(173,238,43,0.18)', color: '#4d7c00', border: '1px solid rgba(100,160,0,0.35)' }
              : { background: 'var(--ds-bg-raised)', color: 'var(--ds-text-3)', border: '1px solid var(--ds-border)' }}>
            <span className="material-symbols-outlined" style={{ fontSize: 10 }}>{isDefault ? 'home' : 'home'}</span>
            {isDefault ? 'Default' : 'Set Default'}
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <p className="text-[9px] font-black uppercase tracking-wider text-[var(--ds-text-3)]">
        {role === 'building_admin' ? 'Assigned Buildings' : 'Assigned Location / Buildings'}
      </p>
      <div className="flex flex-col gap-0 max-h-52 overflow-y-auto pr-1" style={{ scrollbarWidth: 'thin' }}>
        {locGroups.map(({ loc, buildings: grp }) => (
          <div key={loc.id}>
            <p className="text-[8px] font-black uppercase tracking-widest text-[var(--ds-text-3)] px-1 pt-2 pb-1 flex items-center gap-1">
              <span className="material-symbols-outlined" style={{ fontSize: 10 }}>location_city</span>
              {loc.name}{loc.code ? ` · ${loc.code}` : ''}
            </p>
            {grp.map(b => <Row key={b.id} b={b} />)}
          </div>
        ))}
        {withoutLocation.length > 0 && (
          <div>
            {locGroups.length > 0 && (
              <p className="text-[8px] font-black uppercase tracking-widest text-[var(--ds-text-3)] px-1 pt-2 pb-1">Other</p>
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
  onSave: (data: { name: string; email: string; alias: string; password: string; department_id: number | null; role: UserRole; ext: string; building_ids: number[]; default_building_id: number | null }) => Promise<void>
  onClose: () => void
}) {
  const [name, setName]         = useState('')
  const [email, setEmail]       = useState('')
  const [alias, setAlias]       = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm]   = useState('')
  const [showPw, setShowPw]     = useState(false)
  const [showCf, setShowCf]     = useState(false)
  const [deptId, setDeptId]     = useState<number | null>(null)
  const [ext, setExt]           = useState('')
  const [role, setRole]         = useState<UserRole>('user')
  const [bldIds, setBldIds]     = useState<number[]>([])
  const [defaultBldId, setDefaultBldId] = useState<number | null>(null)
  const [saving, setSaving]     = useState(false)
  const [err, setErr]           = useState('')
  const scrollBodyRef = useRef<HTMLDivElement>(null)

  const pwTooShort  = password.length > 0 && password.length < 8
  const pwMismatch  = confirm.length > 0 && confirm !== password

  function selectRole(r: UserRole) {
    setRole(r)
    if (r !== 'admin') {
      setTimeout(() => scrollBodyRef.current?.scrollTo({ top: scrollBodyRef.current.scrollHeight, behavior: 'smooth' }), 50)
    }
  }

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
      await onSave({ name: name.trim(), email: email.trim(), alias: alias.trim(), password, department_id: deptId, role, ext: ext.trim(), building_ids: bldIds, default_building_id: defaultBldId })
      onClose()
    } catch (e: unknown) {
      const errs = (e as { response?: { data?: { errors?: { email?: string[]; alias?: string[] } } } })?.response?.data?.errors
      const msg = errs?.email?.[0] ?? errs?.alias?.[0]
      setErr(msg ?? 'Failed to create user.')
    } finally { setSaving(false) }
  }

  const inputBase = 'w-full bg-[var(--ds-bg-raised)] border rounded-xl pl-10 pr-4 py-2.5 text-sm font-bold focus:outline-none focus:ring-2 focus:border-transparent transition-all text-[var(--ds-text-1)]'

  return (
    <ModalPortal>
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(12px)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-[560px] flex flex-col rounded-[2rem] shadow-2xl overflow-hidden"
        style={{
          height: 640,
          background: 'var(--ds-bg-surface)',
          backdropFilter: 'blur(48px) saturate(200%)',
          border: '1px solid rgba(128,128,128,0.15)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div className="flex items-center justify-between px-7 pt-7 pb-5 border-b border-[var(--ds-border)] shrink-0">
          <div>
            <p className="text-[9px] font-black uppercase tracking-[0.25em] text-[var(--ds-text-3)]">Admin · Users</p>
            <h2 className="text-2xl font-black italic tracking-tighter uppercase mt-0.5 text-[var(--ds-text-1)]">Add User</h2>
          </div>
          <button onClick={onClose}
            className="size-9 rounded-xl bg-[var(--ds-bg-surface-2)] hover:bg-[var(--ds-bg-raised)] flex items-center justify-center transition-colors">
            <span className="material-symbols-outlined text-[var(--ds-text-2)]" style={{ fontSize: 18 }}>close</span>
          </button>
        </div>

        {/* ── Scrollable body ── */}
        <div ref={scrollBodyRef} className="flex-1 overflow-y-auto px-7 py-5 space-y-5" style={{ scrollbarWidth: 'thin' }}>

          {/* Error banner */}
          {err && (
            <div className="flex items-center gap-2 text-[11px] font-bold px-4 py-3 rounded-xl" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171' }}>
              <span className="material-symbols-outlined" style={{ fontSize: 15 }}>error</span>
              {err}
            </div>
          )}

          {/* ── Section: Basic Info ── */}
          <div className="space-y-3">
            <p className="text-[9px] font-black uppercase tracking-[0.2em] text-[var(--ds-text-3)]">Basic Info</p>

            {/* Name */}
            <div className="space-y-1.5">
              <label className="text-[9px] font-black uppercase text-[var(--ds-text-3)] tracking-wider px-1">Full Name *</label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--ds-text-3)]" style={{ fontSize: 16 }}>person</span>
                <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Budi Santoso"
                  className={`${inputBase} focus:ring-[#adee2b] border-[var(--ds-border)]`} />
              </div>
            </div>

            {/* Email */}
            <div className="space-y-1.5">
              <label className="text-[9px] font-black uppercase text-[var(--ds-text-3)] tracking-wider px-1">Email *</label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--ds-text-3)]" style={{ fontSize: 16 }}>mail</span>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="e.g. budi@company.com"
                  className={`${inputBase} focus:ring-[#adee2b] border-[var(--ds-border)]`} />
              </div>
            </div>

            {/* Alias / Username */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between px-1">
                <label className="text-[9px] font-black uppercase text-[var(--ds-text-3)] tracking-wider">Username / Alias</label>
                <span className="text-[9px] text-[var(--ds-text-3)]">Optional — defaults to email prefix</span>
              </div>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--ds-text-3)]" style={{ fontSize: 16 }}>alternate_email</span>
                <input value={alias} onChange={e => setAlias(e.target.value.toLowerCase())} placeholder="e.g. budi.santoso"
                  className={`${inputBase} focus:ring-[#adee2b] border-[var(--ds-border)]`} />
              </div>
            </div>

            {/* Dept + Ext */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-[9px] font-black uppercase text-[var(--ds-text-3)] tracking-wider px-1">Department</label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--ds-text-3)] pointer-events-none" style={{ fontSize: 16 }}>corporate_fare</span>
                  <select value={deptId ?? ''} onChange={e => setDeptId(e.target.value ? Number(e.target.value) : null)}
                    className={`${inputBase} focus:ring-[#adee2b] border-[var(--ds-border)] appearance-none cursor-pointer`}>
                    <option value="">— No department —</option>
                    {departments.map(d => <option key={d.id} value={d.id}>{d.name}{d.code ? ` (${d.code})` : ''}</option>)}
                  </select>
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-[9px] font-black uppercase text-[var(--ds-text-3)] tracking-wider px-1">Ext (phone)</label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--ds-text-3)]" style={{ fontSize: 16 }}>phone</span>
                  <input value={ext} onChange={e => setExt(e.target.value)} placeholder="e.g. 1234"
                    className={`${inputBase} focus:ring-[#adee2b] border-[var(--ds-border)]`} />
                </div>
              </div>
            </div>
          </div>

          {/* ── Section: Password ── */}
          <div className="space-y-3">
            <p className="text-[9px] font-black uppercase tracking-[0.2em] text-[var(--ds-text-3)]">Password</p>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between px-1">
                <label className="text-[9px] font-black uppercase text-[var(--ds-text-3)] tracking-wider">Password *</label>
                <span className="text-[9px] text-[var(--ds-text-3)]">Min. 8 characters</span>
              </div>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--ds-text-3)]" style={{ fontSize: 16 }}>lock</span>
                <input type={showPw ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••"
                  className={`${inputBase} pr-10 ${pwTooShort ? 'border-orange-300 focus:ring-orange-400' : 'border-[var(--ds-border)] focus:ring-[#adee2b]'}`} />
                <button type="button" onClick={() => setShowPw(v => !v)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[var(--ds-text-3)] hover:text-[var(--ds-text-1)] transition-colors">
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
              <label className="text-[9px] font-black uppercase text-[var(--ds-text-3)] tracking-wider px-1">Confirm Password *</label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--ds-text-3)]" style={{ fontSize: 16 }}>lock_reset</span>
                <input type={showCf ? 'text' : 'password'} value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="Re-enter password"
                  className={`${inputBase} pr-10 ${pwMismatch ? 'border-red-300 focus:ring-red-400' : confirm && confirm === password ? 'border-green-300 focus:ring-green-400' : 'border-[var(--ds-border)] focus:ring-[#adee2b]'}`} />
                <button type="button" onClick={() => setShowCf(v => !v)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[var(--ds-text-3)] hover:text-[var(--ds-text-1)] transition-colors">
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
            <p className="text-[9px] font-black uppercase tracking-[0.2em] text-[var(--ds-text-3)]">Role</p>
            <div className="grid grid-cols-2 gap-2">
              {ALL_ROLES.map(r => {
                const m = ROLE_META[r]
                return (
                  <div key={r} className="relative group/role">
                    <button onClick={() => selectRole(r)}
                      className={`w-full flex items-center gap-2.5 px-3.5 py-3 rounded-xl border text-[10px] font-black uppercase tracking-wide transition-all
                        ${role === r ? `${m.bg} ${m.text} border-transparent shadow-sm` : 'bg-[var(--ds-bg-surface)] border-[var(--ds-border)] text-[var(--ds-text-3)] hover:border-[var(--ds-text-3)] hover:bg-[var(--ds-bg-raised)]'}`}>
                      <span className={`size-2 rounded-full shrink-0 ${role === r ? 'bg-current' : 'bg-slate-200'}`} />
                      <span className="flex-1 text-left">{m.label}</span>
                      <span className="size-3.5 rounded-full flex items-center justify-center text-[8px] font-black shrink-0 opacity-50 group-hover/role:opacity-100 transition-opacity"
                        style={{ background: 'rgba(128,128,128,0.15)', color: 'inherit' }}>i</span>
                    </button>
                    {/* Per-role tooltip */}
                    <div className={`absolute bottom-[calc(100%+10px)] z-[300] w-[280px] pointer-events-none opacity-0 translate-y-1 group-hover/role:opacity-100 group-hover/role:translate-y-0 transition-all duration-200 ${ALL_ROLES.indexOf(r) % 2 === 0 ? 'left-0' : 'right-0'}`}>
                      <div className="rounded-2xl p-4 shadow-2xl space-y-3"
                        style={{ background: 'rgba(15,20,45,0.97)', border: '1px solid rgba(255,255,255,0.1)', backdropFilter: 'blur(20px)' }}>
                        <div>
                          <p className="text-[13px] font-black" style={{ color: '#fff' }}>{m.label}</p>
                          <p className="text-[11px] leading-relaxed mt-0.5" style={{ color: 'rgba(255,255,255,0.5)' }}>{m.desc}</p>
                        </div>
                        <div className="space-y-1.5" style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 10 }}>
                          {m.perms.map((p, i) => (
                            <div key={i} className="flex items-start gap-2">
                              <span className="material-symbols-outlined mt-0.5 shrink-0" style={{ fontSize: 12, color: 'rgba(173,238,43,0.8)' }}>check</span>
                              <span className="text-[11px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.55)' }}>{p}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* ── Section: Building ── */}
          {role === 'user' && (
            <DefaultBuildingSelect buildings={buildings} value={defaultBldId} onChange={setDefaultBldId} />
          )}
          {(role === 'building_admin' || role === 'receptionist') && (
            <div className="space-y-3">
              <p className="text-[9px] font-black uppercase tracking-[0.2em] text-[var(--ds-text-3)]">Buildings</p>
              <BuildingPicker role={role} bldIds={bldIds} buildings={buildings} locations={locations} onToggle={toggleBuilding}
                defaultBuildingId={defaultBldId} onSetDefault={setDefaultBldId} />
            </div>
          )}

        </div>

        {/* ── Footer ── */}
        <div className="px-7 py-5 border-t border-[var(--ds-border)] shrink-0 flex gap-3">
          <button onClick={onClose}
            className="flex-1 py-3.5 rounded-full text-[10px] font-black uppercase tracking-[0.15em] bg-[var(--ds-bg-surface-2)] text-[var(--ds-text-2)] hover:bg-[var(--ds-bg-raised)] transition-colors">
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving || pwTooShort || pwMismatch}
            className="flex-1 py-3.5 rounded-full text-[10px] font-black uppercase tracking-[0.15em] transition-all duration-200
              bg-black text-[#adee2b] hover:bg-slate-800 shadow-lg shadow-black/10
              disabled:bg-[var(--ds-bg-surface-2)] disabled:text-[var(--ds-text-3)] disabled:cursor-not-allowed disabled:shadow-none
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

const EXPORT_COLS = ['name', 'email', 'alias', 'password', 'department', 'department_location', 'role', 'ext', 'default_building', 'assigned_buildings']
const IMPORT_COLS = EXPORT_COLS
const ROLE_OPTIONS = ['user', 'admin', 'receptionist', 'building_admin']

type ImportRow = {
  name: string; email: string; alias?: string; password: string
  department?: string; department_location?: string; role?: string; ext?: string
  default_building?: string; assigned_buildings?: string
}

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
      name: u.name, email: u.email, alias: u.alias, password: u.password,
      department: u.department, department_location: u.department_location,
      role: u.role, ext: u.ext,
      default_building: u.default_building, assigned_buildings: u.assigned_buildings,
    })))
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Users')
    XLSX.writeFile(wb, 'users_export.xlsx')
  }

  async function doExportSQL() {
    const data = await fetchExportData()
    const rows = data.map(u => {
      const vals = [u.name, u.email, u.alias, u.password, u.department, u.department_location, u.role, u.ext, u.default_building, u.assigned_buildings]
        .map(v => `'${String(v ?? '').replace(/'/g, "''")}'`).join(', ')
      return `  (${vals})`
    }).join(',\n')
    const sql = `-- MRBS Users Export (${new Date().toISOString().slice(0, 10)})\n-- Passwords exported as bcrypt hash — recognized automatically on re-import.\nINSERT INTO users (name, email, alias, password, department, department_location, role, ext, default_building, assigned_buildings) VALUES\n${rows};`
    download('users_export.sql', sql, 'text/plain')
  }

  // ── Import: download template ───────────────────────────────────────────────
  const TEMPLATE_EXAMPLE: Record<string, string>[] = [
    { name: 'Budi Santoso', email: 'budi@company.com', alias: 'budi', password: 'password123', department: 'IT', department_location: 'Jakarta', role: 'user', ext: '1001', default_building: 'Tower A', assigned_buildings: '' },
    { name: 'Siti Rahayu', email: 'siti@company.com', alias: 'siti.rahayu', password: 'password123', department: 'HR', department_location: 'Jakarta', role: 'receptionist', ext: '', default_building: '', assigned_buildings: 'Tower A, Tower B' },
  ]

  async function downloadTemplate(fmt: 'xlsx' | 'csv') {
    if (fmt === 'xlsx') {
      const wb = new ExcelJS.Workbook()
      const ws = wb.addWorksheet('Users')
      ws.columns = IMPORT_COLS.map(c => ({ header: c, key: c, width: 22 }))
      ws.getRow(1).font = { bold: true }
      TEMPLATE_EXAMPLE.forEach(r => ws.addRow(r))
      applyDropdown(ws, 'role', ROLE_OPTIONS)

      const buf = await wb.xlsx.writeBuffer()
      const a = document.createElement('a')
      a.href = URL.createObjectURL(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }))
      a.download = 'users_import_template.xlsx'
      a.click()
    } else {
      const rows = [IMPORT_COLS.join(','), ...TEMPLATE_EXAMPLE.map(r => IMPORT_COLS.map(c => r[c] ?? '').join(','))]
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
      return raw.slice(1).filter(r => r[nameI] || r[emailI]).map(r => {
        const get = (col: string) => idx(col) >= 0 ? String(r[idx(col)] ?? '').trim() : ''
        return {
          name:                String(r[nameI] ?? '').trim(),
          email:               String(r[emailI] ?? '').trim(),
          alias:               get('alias'),
          password:            String(r[pwI] ?? '').trim(),
          department:          get('department'),
          department_location: get('department_location'),
          role:                get('role') || 'user',
          ext:                 get('ext'),
          default_building:    get('default_building'),
          assigned_buildings:  get('assigned_buildings'),
        }
      })
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
    <div className="fixed inset-0 z-[1000] flex items-center justify-center admin-backdrop-in" style={{ background: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(12px)' }} onClick={onClose}>
      <div className="bg-[var(--ds-bg-surface)] rounded-3xl shadow-2xl w-[640px] max-h-[90vh] flex flex-col overflow-hidden admin-modal-in" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between px-7 pt-6 pb-4 border-b border-[var(--ds-border)] shrink-0">
          <div>
            <p className="text-[9px] font-black uppercase tracking-[0.25em] text-[var(--ds-text-3)]">Admin · Users</p>
            <h3 className="text-xl font-black uppercase tracking-tight text-[var(--ds-text-1)] mt-0.5">Import / Export</h3>
          </div>
          <button onClick={onClose} className="size-8 flex items-center justify-center rounded-xl text-[var(--ds-text-3)] hover:bg-[var(--ds-bg-surface-2)] hover:text-[var(--ds-text-1)]">
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>close</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>

        {/* ── EXPORT SECTION ── */}
        <div className="px-7 pt-5 pb-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="size-6 rounded-lg flex items-center justify-center" style={{ background: 'rgba(16,185,129,0.12)' }}>
              <span className="material-symbols-outlined" style={{ fontSize: 14, color: '#10b981' }}>upload</span>
            </div>
            <p className="text-[11px] font-black uppercase tracking-[0.15em]" style={{ color: '#10b981' }}>Export Users</p>
            <span className="text-[10px] font-bold text-[var(--ds-text-3)]">— {users.length} users</span>
          </div>
          <div className="rounded-2xl border p-4 space-y-3" style={{ background: 'rgba(16,185,129,0.04)', borderColor: 'rgba(16,185,129,0.18)' }}>
            <p className="text-[10px] text-[var(--ds-text-2)] font-medium">Downloads all user records including hashed passwords and default building. Columns: <span className="font-mono text-[var(--ds-text-1)]">name, email, password, department, role, ext, default_building</span></p>
            <div className="flex gap-2">
              <button onClick={doExportExcel} disabled={exporting}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 text-white text-[10px] font-black uppercase hover:bg-emerald-700 disabled:opacity-50 transition-colors">
                {exporting ? <span className="material-symbols-outlined animate-spin" style={{ fontSize: 13 }}>progress_activity</span> : <span className="material-symbols-outlined" style={{ fontSize: 13 }}>table</span>}Excel
              </button>
              <button onClick={doExportCSV} disabled={exporting}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-500 text-white text-[10px] font-black uppercase hover:bg-blue-600 disabled:opacity-50 transition-colors">
                {exporting ? <span className="material-symbols-outlined animate-spin" style={{ fontSize: 13 }}>progress_activity</span> : <span className="material-symbols-outlined" style={{ fontSize: 13 }}>description</span>}CSV
              </button>
              <button onClick={doExportSQL} disabled={exporting}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-700 text-white text-[10px] font-black uppercase hover:bg-slate-800 disabled:opacity-50 transition-colors">
                {exporting ? <span className="material-symbols-outlined animate-spin" style={{ fontSize: 13 }}>progress_activity</span> : <span className="material-symbols-outlined" style={{ fontSize: 13 }}>database</span>}SQL
              </button>
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="mx-7 border-t border-[var(--ds-border)]" />

        {/* ── IMPORT SECTION ── */}
        <div className="px-7 pt-4 pb-6 space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <div className="size-6 rounded-lg flex items-center justify-center" style={{ background: 'rgba(99,102,241,0.12)' }}>
              <span className="material-symbols-outlined" style={{ fontSize: 14, color: '#6366f1' }}>download</span>
            </div>
            <p className="text-[11px] font-black uppercase tracking-[0.15em]" style={{ color: '#6366f1' }}>Import Users</p>
          </div>

          {/* Format tabs */}
          <div className="flex gap-1 bg-[var(--ds-bg-surface-2)] rounded-xl p-1 w-fit">
            {TABS.map(t => (
              <button key={t.key} onClick={() => { setTab(t.key); setPreview(null); setParseErr(''); setImportResult(null) }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${tab === t.key ? 'bg-[var(--ds-bg-surface)] shadow text-[var(--ds-text-1)]' : 'text-[var(--ds-text-3)] hover:text-[var(--ds-text-2)]'}`}>
                <span className="material-symbols-outlined" style={{ fontSize: 12 }}>{t.icon}</span>
                {t.label}
              </button>
            ))}
          </div>

          {/* Format docs */}
          <div className="bg-[var(--ds-bg-raised)] rounded-2xl p-4 space-y-3 text-[11px]">
            {tab === 'excel' && (
              <>
                <p className="font-black text-[var(--ds-text-1)]">Format Excel (.xlsx)</p>
                <div className="overflow-x-auto">
                  <table className="text-[10px] border-collapse w-full">
                    <thead>
                      <tr className="bg-[var(--ds-border)]">
                        {IMPORT_COLS.map((_, i) => (
                          <th key={i} className="px-3 py-1.5 text-left font-black text-[var(--ds-text-1)] border border-[var(--ds-border)]">Col {String.fromCharCode(65 + i)}</th>
                        ))}
                      </tr>
                      <tr className="bg-[var(--ds-bg-surface-2)]">
                        {IMPORT_COLS.map(c => (
                          <th key={c} className="px-3 py-1.5 text-left font-bold text-[var(--ds-text-2)] border border-[var(--ds-border)] font-mono">{c}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="bg-[var(--ds-bg-surface)]">
                        {['Budi Santoso', 'budi@co.com', 'budi', 'pass1234', 'IT', 'Jakarta', 'user', '1001', 'Tower A', ''].map((v, i) => (
                          <td key={i} className="px-3 py-1.5 border border-[var(--ds-border-sub)] text-[var(--ds-text-2)]">{v}</td>
                        ))}
                      </tr>
                      <tr className="bg-[var(--ds-bg-raised)]">
                        {['Siti Rahayu', 'siti@co.com', 'siti.rahayu', 'pass1234', 'HR', 'Jakarta', 'receptionist', '', '', 'Tower A, Tower B'].map((v, i) => (
                          <td key={i} className="px-3 py-1.5 border border-[var(--ds-border-sub)] text-[var(--ds-text-2)] italic">{v || '(empty)'}</td>
                        ))}
                      </tr>
                    </tbody>
                  </table>
                </div>
                <ul className="space-y-1 text-[var(--ds-text-2)] list-disc pl-4">
                  <li>First row must be a header — column names can be anything, <em>column order determines mapping</em></li>
                  <li>Required: <span className="font-mono">name</span> (Col A), <span className="font-mono">email</span> (Col B), <span className="font-mono">password</span> (Col D). All other columns are optional</li>
                  <li>Alias (Col C): login username, e.g. <span className="font-mono">jodi.ginandra@gmail.com</span> → <span className="font-mono">jodi.ginandra</span>. Leave blank to auto-generate from the email prefix</li>
                  <li>Role: <span className="font-mono bg-[var(--ds-bg-raised)] px-1 rounded">user</span> · <span className="font-mono bg-[var(--ds-bg-raised)] px-1 rounded">admin</span> · <span className="font-mono bg-[var(--ds-bg-raised)] px-1 rounded">receptionist</span> · <span className="font-mono bg-[var(--ds-bg-raised)] px-1 rounded">building_admin</span> (default: <span className="font-mono">user</span>) — the downloaded template has a dropdown on this column</li>
                  <li>Department location (Col F) is only used when the department name is new (creates it with that location)</li>
                  <li>Default/assigned building (Col I–J) must match an existing building name exactly; separate multiple assigned buildings with commas</li>
                  <li>Password is hashed automatically on the server</li>
                </ul>
                <button onClick={() => downloadTemplate('xlsx')}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 text-white text-[9px] font-black uppercase hover:bg-emerald-700 transition-colors">
                  <span className="material-symbols-outlined" style={{ fontSize: 13 }}>download</span>Download Template (.xlsx)
                </button>
              </>
            )}

            {tab === 'csv' && (
              <>
                <p className="font-black text-[var(--ds-text-1)]">Format CSV (.csv)</p>
                <div className="bg-[var(--ds-bg-surface)] rounded-xl border border-[var(--ds-border)] p-3 font-mono text-[10px] text-[var(--ds-text-2)] space-y-0.5 overflow-x-auto whitespace-nowrap">
                  <p className="text-[var(--ds-text-3)]">{IMPORT_COLS.join(',')}</p>
                  <p>Budi Santoso,budi@co.com,budi,pass1234,IT,Jakarta,user,1001,Tower A,</p>
                  <p>Siti Rahayu,siti@co.com,siti.rahayu,pass1234,HR,Jakarta,receptionist,,,&quot;Tower A, Tower B&quot;</p>
                </div>
                <ul className="space-y-1 text-[var(--ds-text-2)] list-disc pl-4">
                  <li>Separator: comma <span className="font-mono bg-[var(--ds-bg-raised)] px-1 rounded">,</span> — wrap values containing commas (e.g. multiple assigned buildings) in double quotes</li>
                  <li>First row = header (column names used for mapping, order doesn't matter)</li>
                  <li>Columns <span className="font-mono">name</span>, <span className="font-mono">email</span>, <span className="font-mono">password</span> are required — all others are optional</li>
                  <li>Alias: login username, e.g. <span className="font-mono">jodi.ginandra@gmail.com</span> → <span className="font-mono">jodi.ginandra</span>. Leave blank to auto-generate from the email prefix</li>
                  <li>Role must be one of <span className="font-mono">user</span>, <span className="font-mono">admin</span>, <span className="font-mono">receptionist</span>, <span className="font-mono">building_admin</span> (default: <span className="font-mono">user</span>)</li>
                  <li>Default/assigned building must match an existing building name exactly; separate multiple assigned buildings with commas inside quotes</li>
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
                <p className="font-black text-[var(--ds-text-1)]">Format SQL (.sql)</p>
                <div className="bg-[var(--ds-bg-surface)] rounded-xl border border-[var(--ds-border)] p-3 font-mono text-[10px] text-[var(--ds-text-2)] space-y-0.5 overflow-x-auto whitespace-nowrap">
                  <p className="text-[var(--ds-text-3)]">-- Column order required: {IMPORT_COLS.join(', ')}</p>
                  <p>INSERT INTO users ({IMPORT_COLS.join(', ')}) VALUES</p>
                  <p className="pl-2">('Budi Santoso', 'budi@co.com', 'budi', 'pass1234', 'IT', 'Jakarta', 'user', '1001', 'Tower A', ''),</p>
                  <p className="pl-2">('Siti Rahayu', 'siti@co.com', 'siti.rahayu', 'pass1234', 'HR', 'Jakarta', 'receptionist', NULL, NULL, 'Tower A, Tower B');</p>
                </div>
                <ul className="space-y-1 text-[var(--ds-text-2)] list-disc pl-4">
                  <li>Only one <span className="font-mono">INSERT INTO ... VALUES (...)</span> block is processed</li>
                  <li>Column order in VALUES must be: <span className="font-mono">{IMPORT_COLS.join(', ')}</span></li>
                  <li>Use <span className="font-mono">NULL</span> or empty string <span className="font-mono">''</span> for optional fields — only <span className="font-mono">name</span>, <span className="font-mono">email</span>, <span className="font-mono">password</span> are required</li>
                  <li>Alias: login username. Leave <span className="font-mono">NULL</span>/empty to auto-generate from the email prefix (e.g. <span className="font-mono">jodi.ginandra@gmail.com</span> → <span className="font-mono">jodi.ginandra</span>)</li>
                  <li>Role must be one of <span className="font-mono">user</span>, <span className="font-mono">admin</span>, <span className="font-mono">receptionist</span>, <span className="font-mono">building_admin</span> (default: <span className="font-mono">user</span>)</li>
                  <li>Default/assigned building must match an existing building name exactly; separate multiple assigned buildings with commas</li>
                  <li>Password can be plain text (auto-hashed) or a bcrypt hash from an export (recognized automatically)</li>
                  <li>Multi-statement and subqueries are not supported</li>
                </ul>
              </>
            )}
          </div>

          {/* File input */}
          {!importResult && (
            <div>
              <label className="text-[9px] font-black uppercase text-[var(--ds-text-3)] tracking-wider block mb-2">Choose File</label>
              <input
                ref={fileRef}
                type="file"
                accept={tab === 'excel' ? '.xlsx,.xls' : tab === 'csv' ? '.csv' : '.sql'}
                onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])}
                className="block w-full text-[11px] text-[var(--ds-text-2)] font-bold
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
                <p className="text-[9px] font-black uppercase tracking-widest text-[var(--ds-text-3)]">Preview — {preview.length} rows</p>
                <button onClick={() => { setPreview(null); if (fileRef.current) fileRef.current.value = '' }}
                  className="text-[9px] text-[var(--ds-text-3)] hover:text-[var(--ds-text-1)] font-bold">Clear</button>
              </div>
              <div className="overflow-x-auto rounded-xl border border-[var(--ds-border)]">
                <table className="w-full text-[10px]">
                  <thead>
                    <tr className="bg-[var(--ds-bg-raised)] border-b border-[var(--ds-border)]">
                      {IMPORT_COLS.map(c => (
                        <th key={c} className="px-3 py-2 text-left font-black text-[var(--ds-text-2)] uppercase">{c}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.slice(0, 8).map((row, i) => (
                      <tr key={i} className={i % 2 === 0 ? 'bg-[var(--ds-bg-surface)]' : 'bg-[var(--ds-bg-raised)]'}>
                        <td className="px-3 py-1.5 font-bold text-[var(--ds-text-1)]">{row.name}</td>
                        <td className="px-3 py-1.5 text-[var(--ds-text-2)]">{row.email}</td>
                        <td className="px-3 py-1.5 text-[var(--ds-text-3)]">{row.alias || '—'}</td>
                        <td className="px-3 py-1.5 text-[var(--ds-text-3)] font-mono">{'•'.repeat(Math.min(row.password?.length ?? 0, 8))}</td>
                        <td className="px-3 py-1.5 text-[var(--ds-text-2)]">{row.department || '—'}</td>
                        <td className="px-3 py-1.5 text-[var(--ds-text-3)]">{row.department_location || '—'}</td>
                        <td className="px-3 py-1.5">
                          {row.role && ROLE_META[row.role as UserRole] ? (
                            <span className={`px-2 py-0.5 rounded-md text-[8px] font-black uppercase ${ROLE_META[row.role as UserRole].bg} ${ROLE_META[row.role as UserRole].text}`}>{row.role}</span>
                          ) : <span className="text-[var(--ds-text-3)]">{row.role || 'user'}</span>}
                        </td>
                        <td className="px-3 py-1.5 text-[var(--ds-text-3)]">{row.ext || '—'}</td>
                        <td className="px-3 py-1.5 text-[var(--ds-text-3)]">{row.default_building || '—'}</td>
                        <td className="px-3 py-1.5 text-[var(--ds-text-3)]">{row.assigned_buildings || '—'}</td>
                      </tr>
                    ))}
                    {preview.length > 8 && (
                      <tr>
                        <td colSpan={IMPORT_COLS.length} className="px-3 py-2 text-center text-[9px] text-[var(--ds-text-3)] font-bold">
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
              <div className={`rounded-2xl p-4 ${importResult.errors.length === 0 ? 'bg-green-500/10 border border-green-500/20' : 'bg-amber-500/10 border border-amber-500/20'}`}>
                <p className={`text-sm font-black ${importResult.errors.length === 0 ? 'text-green-400' : 'text-amber-400'}`}>
                  {importResult.created} user{importResult.created !== 1 ? 's' : ''} created successfully
                  {importResult.errors.length > 0 ? ` — ${importResult.errors.length} row${importResult.errors.length !== 1 ? 's' : ''} failed` : ' — all done!'}
                </p>
                {importResult.errors.length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {importResult.errors.map((e, i) => (
                      <li key={i} className="text-[10px] text-amber-400 font-medium">• {e}</li>
                    ))}
                  </ul>
                )}
              </div>
              <button onClick={() => setImportResult(null)}
                className="text-[9px] text-[var(--ds-text-3)] hover:text-[var(--ds-text-1)] font-bold">Import more</button>
            </div>
          )}
        </div>{/* end import section */}
        </div>{/* end scrollable */}
      </div>
    </div>
    </ModalPortal>
  )
}

function download(filename: string, content: string, type: string) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([content], { type }))
  a.download = filename
  a.click()
}

// Applies a real Excel dropdown (data validation) restricted to `options` on rows 2-500 of `col`
function applyDropdown(ws: ExcelJS.Worksheet, col: string, options: string[]) {
  const letter = ws.getColumn(col).letter
  for (let row = 2; row <= 500; row++) {
    ws.getCell(`${letter}${row}`).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: [`"${options.join(',')}"`],
      showErrorMessage: true,
      errorTitle: `Invalid ${col}`,
      error: `${col} must be one of: ${options.join(', ')}`,
    }
  }
}

// ── Building Import / Export modal ────────────────────────────────────────────
const BUILDING_COLS = ['name', 'code', 'location', 'address', 'floors', 'notes', 'is_active']

type BuildingImportRow = {
  name: string; code?: string; location?: string; address?: string
  floors?: string; notes?: string; is_active?: string
}

function BuildingImportExportModal({ buildings, onImport, onClose }: {
  buildings: Building[]
  onImport: (rows: BuildingImportRow[]) => Promise<{ created: number; errors: string[] }>
  onClose: () => void
}) {
  const [tab, setTab] = useState<ImportTab>('excel')
  const [preview, setPreview] = useState<BuildingImportRow[] | null>(null)
  const [parseErr, setParseErr] = useState('')
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<{ created: number; errors: string[] } | null>(null)
  const [exporting, setExporting] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  async function fetchExportData() {
    setExporting(true)
    try { return await exportBuildings() }
    finally { setExporting(false) }
  }

  async function doExportCSV() {
    const data = await fetchExportData()
    const rows = [BUILDING_COLS.join(','), ...data.map(b =>
      BUILDING_COLS.map(c => {
        const v = (b as Record<string, string>)[c] ?? ''
        return v.includes(',') || v.includes('"') ? `"${v.replace(/"/g, '""')}"` : v
      }).join(',')
    )]
    download('buildings_export.csv', rows.join('\n'), 'text/csv')
  }

  async function doExportExcel() {
    const data = await fetchExportData()
    const ws = XLSX.utils.json_to_sheet(data)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Buildings')
    XLSX.writeFile(wb, 'buildings_export.xlsx')
  }

  async function doExportSQL() {
    const data = await fetchExportData()
    const rows = data.map(b => {
      const vals = BUILDING_COLS.map(c => (b as Record<string, string>)[c])
        .map(v => `'${String(v ?? '').replace(/'/g, "''")}'`).join(', ')
      return `  (${vals})`
    }).join(',\n')
    const sql = `-- MRBS Buildings Export (${new Date().toISOString().slice(0, 10)})\nINSERT INTO buildings (${BUILDING_COLS.join(', ')}) VALUES\n${rows};`
    download('buildings_export.sql', sql, 'text/plain')
  }

  const TEMPLATE_EXAMPLE: Record<string, string>[] = [
    { name: 'Tower A', code: 'TWR-A', location: 'Jakarta', address: 'Jl. Sudirman No. 1', floors: '10', notes: 'Main office tower', is_active: 'yes' },
    { name: 'Tower B', code: 'TWR-B', location: 'Jakarta', address: 'Jl. Sudirman No. 2', floors: '5', notes: '', is_active: 'yes' },
  ]

  async function downloadTemplate(fmt: 'xlsx' | 'csv') {
    if (fmt === 'xlsx') {
      const wb = new ExcelJS.Workbook()
      const ws = wb.addWorksheet('Buildings')
      ws.columns = BUILDING_COLS.map(c => ({ header: c, key: c, width: 22 }))
      ws.getRow(1).font = { bold: true }
      TEMPLATE_EXAMPLE.forEach(r => ws.addRow(r))
      applyDropdown(ws, 'is_active', ['yes', 'no'])
      const buf = await wb.xlsx.writeBuffer()
      const a = document.createElement('a')
      a.href = URL.createObjectURL(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }))
      a.download = 'buildings_import_template.xlsx'
      a.click()
    } else {
      const rows = [BUILDING_COLS.join(','), ...TEMPLATE_EXAMPLE.map(r => BUILDING_COLS.map(c => r[c] ?? '').join(','))]
      download('buildings_import_template.csv', rows.join('\n'), 'text/csv')
    }
  }

  const handleFile = useCallback((file: File) => {
    setParseErr(''); setPreview(null); setImportResult(null)
    const ext = file.name.split('.').pop()?.toLowerCase()

    const parseRows = (raw: unknown[][]): BuildingImportRow[] => {
      if (!raw.length) throw new Error('File is empty')
      const header = (raw[0] as string[]).map(h => String(h ?? '').trim().toLowerCase())
      const idx = (col: string) => header.indexOf(col)
      const nameI = idx('name')
      if (nameI < 0) throw new Error('Missing required column: name')
      return raw.slice(1).filter(r => r[nameI]).map(r => {
        const get = (col: string) => idx(col) >= 0 ? String(r[idx(col)] ?? '').trim() : ''
        return {
          name: String(r[nameI] ?? '').trim(),
          code: get('code'), location: get('location'), address: get('address'),
          floors: get('floors'), notes: get('notes'), is_active: get('is_active'),
        }
      })
    }

    if (ext === 'csv' || ext === 'sql') {
      const reader = new FileReader()
      reader.onload = e => {
        try {
          const text = e.target!.result as string
          if (ext === 'sql') {
            const match = text.match(/VALUES\s*([\s\S]+?);/i)
            if (!match) throw new Error('No INSERT VALUES block found in SQL file')
            const rowMatches = [...match[1].matchAll(/\(([^)]+)\)/g)]
            if (!rowMatches.length) throw new Error('No data rows found')
            const dataRows = rowMatches.map(m => m[1].split(',').map(v => v.trim().replace(/^'|'$/g, '').replace(/''/g, "'")))
            setPreview(parseRows([BUILDING_COLS, ...dataRows]))
          } else {
            const wb = XLSX.read(text, { type: 'string' })
            const raw = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[wb.SheetNames[0]], { header: 1 })
            setPreview(parseRows(raw as unknown[][]))
          }
        } catch (err) { setParseErr(String(err)) }
      }
      reader.readAsText(file)
    } else {
      const reader = new FileReader()
      reader.onload = e => {
        try {
          const wb = XLSX.read(e.target!.result, { type: 'binary' })
          const raw = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[wb.SheetNames[0]], { header: 1 })
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
    <div className="fixed inset-0 z-[1000] flex items-center justify-center admin-backdrop-in" style={{ background: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(12px)' }} onClick={onClose}>
      <div className="bg-[var(--ds-bg-surface)] rounded-3xl shadow-2xl w-[640px] max-h-[90vh] flex flex-col overflow-hidden admin-modal-in" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-7 pt-6 pb-4 border-b border-[var(--ds-border)] shrink-0">
          <div>
            <p className="text-[9px] font-black uppercase tracking-[0.25em] text-[var(--ds-text-3)]">Admin · Buildings</p>
            <h3 className="text-xl font-black uppercase tracking-tight text-[var(--ds-text-1)] mt-0.5">Import / Export</h3>
          </div>
          <button onClick={onClose} className="size-8 flex items-center justify-center rounded-xl text-[var(--ds-text-3)] hover:bg-[var(--ds-bg-surface-2)] hover:text-[var(--ds-text-1)]">
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>close</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>

        <div className="px-7 pt-5 pb-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="size-6 rounded-lg flex items-center justify-center" style={{ background: 'rgba(16,185,129,0.12)' }}>
              <span className="material-symbols-outlined" style={{ fontSize: 14, color: '#10b981' }}>upload</span>
            </div>
            <p className="text-[11px] font-black uppercase tracking-[0.15em]" style={{ color: '#10b981' }}>Export Buildings</p>
            <span className="text-[10px] font-bold text-[var(--ds-text-3)]">— {buildings.length} buildings</span>
          </div>
          <div className="rounded-2xl border p-4 space-y-3" style={{ background: 'rgba(16,185,129,0.04)', borderColor: 'rgba(16,185,129,0.18)' }}>
            <p className="text-[10px] text-[var(--ds-text-2)] font-medium">Columns: <span className="font-mono text-[var(--ds-text-1)]">{BUILDING_COLS.join(', ')}</span></p>
            <div className="flex gap-2">
              <button onClick={doExportExcel} disabled={exporting} className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 text-white text-[10px] font-black uppercase hover:bg-emerald-700 disabled:opacity-50 transition-colors">
                {exporting ? <span className="material-symbols-outlined animate-spin" style={{ fontSize: 13 }}>progress_activity</span> : <span className="material-symbols-outlined" style={{ fontSize: 13 }}>table</span>}Excel
              </button>
              <button onClick={doExportCSV} disabled={exporting} className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-500 text-white text-[10px] font-black uppercase hover:bg-blue-600 disabled:opacity-50 transition-colors">
                {exporting ? <span className="material-symbols-outlined animate-spin" style={{ fontSize: 13 }}>progress_activity</span> : <span className="material-symbols-outlined" style={{ fontSize: 13 }}>description</span>}CSV
              </button>
              <button onClick={doExportSQL} disabled={exporting} className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-700 text-white text-[10px] font-black uppercase hover:bg-slate-800 disabled:opacity-50 transition-colors">
                {exporting ? <span className="material-symbols-outlined animate-spin" style={{ fontSize: 13 }}>progress_activity</span> : <span className="material-symbols-outlined" style={{ fontSize: 13 }}>database</span>}SQL
              </button>
            </div>
          </div>
        </div>

        <div className="mx-7 border-t border-[var(--ds-border)]" />

        <div className="px-7 pt-4 pb-6 space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <div className="size-6 rounded-lg flex items-center justify-center" style={{ background: 'rgba(99,102,241,0.12)' }}>
              <span className="material-symbols-outlined" style={{ fontSize: 14, color: '#6366f1' }}>download</span>
            </div>
            <p className="text-[11px] font-black uppercase tracking-[0.15em]" style={{ color: '#6366f1' }}>Import Buildings</p>
          </div>

          <div className="flex gap-1 bg-[var(--ds-bg-surface-2)] rounded-xl p-1 w-fit">
            {TABS.map(t => (
              <button key={t.key} onClick={() => { setTab(t.key); setPreview(null); setParseErr(''); setImportResult(null) }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${tab === t.key ? 'bg-[var(--ds-bg-surface)] shadow text-[var(--ds-text-1)]' : 'text-[var(--ds-text-3)] hover:text-[var(--ds-text-2)]'}`}>
                <span className="material-symbols-outlined" style={{ fontSize: 12 }}>{t.icon}</span>{t.label}
              </button>
            ))}
          </div>

          <div className="bg-[var(--ds-bg-raised)] rounded-2xl p-4 space-y-3 text-[11px]">
            {tab === 'excel' && (
              <>
                <p className="font-black text-[var(--ds-text-1)]">Format Excel (.xlsx)</p>
                <div className="overflow-x-auto">
                  <table className="text-[10px] border-collapse w-full">
                    <thead>
                      <tr className="bg-[var(--ds-border)]">
                        {BUILDING_COLS.map((_, i) => <th key={i} className="px-3 py-1.5 text-left font-black text-[var(--ds-text-1)] border border-[var(--ds-border)]">Col {String.fromCharCode(65 + i)}</th>)}
                      </tr>
                      <tr className="bg-[var(--ds-bg-surface-2)]">
                        {BUILDING_COLS.map(c => <th key={c} className="px-3 py-1.5 text-left font-bold text-[var(--ds-text-2)] border border-[var(--ds-border)] font-mono">{c}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {TEMPLATE_EXAMPLE.map((r, i) => (
                        <tr key={i} className={i % 2 === 0 ? 'bg-[var(--ds-bg-surface)]' : 'bg-[var(--ds-bg-raised)]'}>
                          {BUILDING_COLS.map(c => <td key={c} className="px-3 py-1.5 border border-[var(--ds-border-sub)] text-[var(--ds-text-2)]">{r[c] || '(empty)'}</td>)}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <ul className="space-y-1 text-[var(--ds-text-2)] list-disc pl-4">
                  <li>First row must be a header — column order determines mapping</li>
                  <li>Required: <span className="font-mono">name</span> (Col A). All other columns are optional</li>
                  <li>Location (Col C) is resolved by name — created automatically if it doesn't exist yet</li>
                  <li>Floors default to 1 if left blank</li>
                  <li>Is Active: <span className="font-mono">yes</span>/<span className="font-mono">no</span> (default: <span className="font-mono">yes</span>) — the downloaded template has a dropdown on this column</li>
                </ul>
                <button onClick={() => downloadTemplate('xlsx')} className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 text-white text-[9px] font-black uppercase hover:bg-emerald-700 transition-colors">
                  <span className="material-symbols-outlined" style={{ fontSize: 13 }}>download</span>Download Template (.xlsx)
                </button>
              </>
            )}
            {tab === 'csv' && (
              <>
                <p className="font-black text-[var(--ds-text-1)]">Format CSV (.csv)</p>
                <div className="bg-[var(--ds-bg-surface)] rounded-xl border border-[var(--ds-border)] p-3 font-mono text-[10px] text-[var(--ds-text-2)] space-y-0.5 overflow-x-auto whitespace-nowrap">
                  <p className="text-[var(--ds-text-3)]">{BUILDING_COLS.join(',')}</p>
                  {TEMPLATE_EXAMPLE.map((r, i) => <p key={i}>{BUILDING_COLS.map(c => r[c] ?? '').join(',')}</p>)}
                </div>
                <ul className="space-y-1 text-[var(--ds-text-2)] list-disc pl-4">
                  <li>Separator: comma — wrap values containing commas in double quotes</li>
                  <li>First row = header (column names used for mapping, order doesn't matter)</li>
                  <li>Only <span className="font-mono">name</span> is required</li>
                  <li>Location is resolved by name — created automatically if it doesn't exist yet</li>
                  <li>Is Active: <span className="font-mono">yes</span>/<span className="font-mono">no</span> (default: <span className="font-mono">yes</span>)</li>
                </ul>
                <button onClick={() => downloadTemplate('csv')} className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-blue-500 text-white text-[9px] font-black uppercase hover:bg-blue-600 transition-colors">
                  <span className="material-symbols-outlined" style={{ fontSize: 13 }}>download</span>Download Template (.csv)
                </button>
              </>
            )}
            {tab === 'sql' && (
              <>
                <p className="font-black text-[var(--ds-text-1)]">Format SQL (.sql)</p>
                <div className="bg-[var(--ds-bg-surface)] rounded-xl border border-[var(--ds-border)] p-3 font-mono text-[10px] text-[var(--ds-text-2)] space-y-0.5 overflow-x-auto whitespace-nowrap">
                  <p className="text-[var(--ds-text-3)]">-- Column order required: {BUILDING_COLS.join(', ')}</p>
                  <p>INSERT INTO buildings ({BUILDING_COLS.join(', ')}) VALUES</p>
                  {TEMPLATE_EXAMPLE.map((r, i) => <p key={i} className="pl-2">({BUILDING_COLS.map(c => `'${r[c] ?? ''}'`).join(', ')}){i < TEMPLATE_EXAMPLE.length - 1 ? ',' : ';'}</p>)}
                </div>
                <ul className="space-y-1 text-[var(--ds-text-2)] list-disc pl-4">
                  <li>Only one <span className="font-mono">INSERT INTO ... VALUES (...)</span> block is processed</li>
                  <li>Column order in VALUES must be: <span className="font-mono">{BUILDING_COLS.join(', ')}</span></li>
                  <li>Use <span className="font-mono">NULL</span> or empty string for optional fields — only <span className="font-mono">name</span> is required</li>
                  <li>Multi-statement and subqueries are not supported</li>
                </ul>
              </>
            )}
          </div>

          {!importResult && (
            <div>
              <label className="text-[9px] font-black uppercase text-[var(--ds-text-3)] tracking-wider block mb-2">Choose File</label>
              <input ref={fileRef} type="file" accept={tab === 'excel' ? '.xlsx,.xls' : tab === 'csv' ? '.csv' : '.sql'}
                onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])}
                className="block w-full text-[11px] text-[var(--ds-text-2)] font-bold file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-[10px] file:font-black file:uppercase file:bg-black file:text-[#adee2b] hover:file:bg-slate-800 file:cursor-pointer" />
              {parseErr && <p className="text-xs text-red-500 font-bold mt-2">{parseErr}</p>}
            </div>
          )}

          {preview && preview.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-[9px] font-black uppercase tracking-widest text-[var(--ds-text-3)]">Preview — {preview.length} rows</p>
                <button onClick={() => { setPreview(null); if (fileRef.current) fileRef.current.value = '' }} className="text-[9px] text-[var(--ds-text-3)] hover:text-[var(--ds-text-1)] font-bold">Clear</button>
              </div>
              <div className="overflow-x-auto rounded-xl border border-[var(--ds-border)]">
                <table className="w-full text-[10px]">
                  <thead>
                    <tr className="bg-[var(--ds-bg-raised)] border-b border-[var(--ds-border)]">
                      {BUILDING_COLS.map(c => <th key={c} className="px-3 py-2 text-left font-black text-[var(--ds-text-2)] uppercase">{c}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.slice(0, 8).map((row, i) => (
                      <tr key={i} className={i % 2 === 0 ? 'bg-[var(--ds-bg-surface)]' : 'bg-[var(--ds-bg-raised)]'}>
                        {BUILDING_COLS.map(c => <td key={c} className="px-3 py-1.5 text-[var(--ds-text-2)]">{(row as Record<string, string>)[c] || '—'}</td>)}
                      </tr>
                    ))}
                    {preview.length > 8 && (
                      <tr><td colSpan={BUILDING_COLS.length} className="px-3 py-2 text-center text-[9px] text-[var(--ds-text-3)] font-bold">+{preview.length - 8} more rows...</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
              <button onClick={handleImport} disabled={importing} className="w-full py-3 rounded-2xl bg-black text-[#adee2b] text-[10px] font-black uppercase hover:bg-slate-800 disabled:opacity-40 transition-colors flex items-center justify-center gap-2">
                {importing && <span className="material-symbols-outlined animate-spin" style={{ fontSize: 13 }}>progress_activity</span>}Import {preview.length} Buildings
              </button>
            </div>
          )}

          {importResult && (
            <div className="space-y-3">
              <div className={`rounded-2xl p-4 ${importResult.errors.length === 0 ? 'bg-green-500/10 border border-green-500/20' : 'bg-amber-500/10 border border-amber-500/20'}`}>
                <p className={`text-sm font-black ${importResult.errors.length === 0 ? 'text-green-400' : 'text-amber-400'}`}>
                  {importResult.created} building{importResult.created !== 1 ? 's' : ''} created successfully
                  {importResult.errors.length > 0 ? ` — ${importResult.errors.length} row${importResult.errors.length !== 1 ? 's' : ''} failed` : ' — all done!'}
                </p>
                {importResult.errors.length > 0 && (
                  <ul className="mt-2 space-y-1">{importResult.errors.map((e, i) => <li key={i} className="text-[10px] text-amber-400 font-medium">• {e}</li>)}</ul>
                )}
              </div>
              <button onClick={() => setImportResult(null)} className="text-[9px] text-[var(--ds-text-3)] hover:text-[var(--ds-text-1)] font-bold">Import more</button>
            </div>
          )}
        </div>
        </div>
      </div>
    </div>
    </ModalPortal>
  )
}

// ── Room Import / Export modal ────────────────────────────────────────────────
const ROOM_COLS = ['name', 'building', 'capacity', 'floor', 'facilities', 'notes', 'is_active', 'status', 'requires_contact']

type RoomImportRow = {
  name: string; building?: string; capacity: string; floor: string
  facilities?: string; notes?: string; is_active?: string; status?: string; requires_contact?: string
}

function RoomImportExportModal({ rooms, onImport, onClose }: {
  rooms: Room[]
  onImport: (rows: RoomImportRow[]) => Promise<{ created: number; errors: string[] }>
  onClose: () => void
}) {
  const [tab, setTab] = useState<ImportTab>('excel')
  const [preview, setPreview] = useState<RoomImportRow[] | null>(null)
  const [parseErr, setParseErr] = useState('')
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<{ created: number; errors: string[] } | null>(null)
  const [exporting, setExporting] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  async function fetchExportData() {
    setExporting(true)
    try { return await exportRooms() }
    finally { setExporting(false) }
  }

  async function doExportCSV() {
    const data = await fetchExportData()
    const rows = [ROOM_COLS.join(','), ...data.map(r =>
      ROOM_COLS.map(c => {
        const v = (r as Record<string, string>)[c] ?? ''
        return v.includes(',') || v.includes('"') ? `"${v.replace(/"/g, '""')}"` : v
      }).join(',')
    )]
    download('rooms_export.csv', rows.join('\n'), 'text/csv')
  }

  async function doExportExcel() {
    const data = await fetchExportData()
    const ws = XLSX.utils.json_to_sheet(data)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Rooms')
    XLSX.writeFile(wb, 'rooms_export.xlsx')
  }

  async function doExportSQL() {
    const data = await fetchExportData()
    const rows = data.map(r => {
      const vals = ROOM_COLS.map(c => (r as Record<string, string>)[c])
        .map(v => `'${String(v ?? '').replace(/'/g, "''")}'`).join(', ')
      return `  (${vals})`
    }).join(',\n')
    const sql = `-- MRBS Rooms Export (${new Date().toISOString().slice(0, 10)})\nINSERT INTO rooms (${ROOM_COLS.join(', ')}) VALUES\n${rows};`
    download('rooms_export.sql', sql, 'text/plain')
  }

  const TEMPLATE_EXAMPLE: Record<string, string>[] = [
    { name: 'Meeting Room 1', building: 'Tower A', capacity: '10', floor: '3', facilities: 'Projector, WiFi, Whiteboard', notes: '', is_active: 'yes', status: 'active', requires_contact: 'no' },
    { name: 'Board Room', building: 'Tower A', capacity: '20', floor: '5', facilities: 'TV Screen, WiFi', notes: 'Executive use', is_active: 'yes', status: 'active', requires_contact: 'yes' },
  ]

  async function downloadTemplate(fmt: 'xlsx' | 'csv') {
    if (fmt === 'xlsx') {
      const wb = new ExcelJS.Workbook()
      const ws = wb.addWorksheet('Rooms')
      ws.columns = ROOM_COLS.map(c => ({ header: c, key: c, width: 22 }))
      ws.getRow(1).font = { bold: true }
      TEMPLATE_EXAMPLE.forEach(r => ws.addRow(r))
      applyDropdown(ws, 'is_active', ['yes', 'no'])
      applyDropdown(ws, 'status', ['active', 'maintenance'])
      applyDropdown(ws, 'requires_contact', ['yes', 'no'])
      const buf = await wb.xlsx.writeBuffer()
      const a = document.createElement('a')
      a.href = URL.createObjectURL(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }))
      a.download = 'rooms_import_template.xlsx'
      a.click()
    } else {
      const rows = [ROOM_COLS.join(','), ...TEMPLATE_EXAMPLE.map(r => ROOM_COLS.map(c => r[c] ?? '').join(','))]
      download('rooms_import_template.csv', rows.join('\n'), 'text/csv')
    }
  }

  const handleFile = useCallback((file: File) => {
    setParseErr(''); setPreview(null); setImportResult(null)
    const ext = file.name.split('.').pop()?.toLowerCase()

    const parseRows = (raw: unknown[][]): RoomImportRow[] => {
      if (!raw.length) throw new Error('File is empty')
      const header = (raw[0] as string[]).map(h => String(h ?? '').trim().toLowerCase())
      const idx = (col: string) => header.indexOf(col)
      const nameI = idx('name'), capI = idx('capacity'), floorI = idx('floor')
      if (nameI < 0 || capI < 0 || floorI < 0)
        throw new Error('Missing required columns: name, capacity, floor')
      return raw.slice(1).filter(r => r[nameI]).map(r => {
        const get = (col: string) => idx(col) >= 0 ? String(r[idx(col)] ?? '').trim() : ''
        return {
          name: String(r[nameI] ?? '').trim(),
          capacity: String(r[capI] ?? '').trim(),
          floor: String(r[floorI] ?? '').trim(),
          building: get('building'), facilities: get('facilities'), notes: get('notes'),
          is_active: get('is_active'), status: get('status') || 'active', requires_contact: get('requires_contact'),
        }
      })
    }

    if (ext === 'csv' || ext === 'sql') {
      const reader = new FileReader()
      reader.onload = e => {
        try {
          const text = e.target!.result as string
          if (ext === 'sql') {
            const match = text.match(/VALUES\s*([\s\S]+?);/i)
            if (!match) throw new Error('No INSERT VALUES block found in SQL file')
            const rowMatches = [...match[1].matchAll(/\(([^)]+)\)/g)]
            if (!rowMatches.length) throw new Error('No data rows found')
            const dataRows = rowMatches.map(m => m[1].split(',').map(v => v.trim().replace(/^'|'$/g, '').replace(/''/g, "'")))
            setPreview(parseRows([ROOM_COLS, ...dataRows]))
          } else {
            const wb = XLSX.read(text, { type: 'string' })
            const raw = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[wb.SheetNames[0]], { header: 1 })
            setPreview(parseRows(raw as unknown[][]))
          }
        } catch (err) { setParseErr(String(err)) }
      }
      reader.readAsText(file)
    } else {
      const reader = new FileReader()
      reader.onload = e => {
        try {
          const wb = XLSX.read(e.target!.result, { type: 'binary' })
          const raw = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[wb.SheetNames[0]], { header: 1 })
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
    <div className="fixed inset-0 z-[1000] flex items-center justify-center admin-backdrop-in" style={{ background: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(12px)' }} onClick={onClose}>
      <div className="bg-[var(--ds-bg-surface)] rounded-3xl shadow-2xl w-[640px] max-h-[90vh] flex flex-col overflow-hidden admin-modal-in" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-7 pt-6 pb-4 border-b border-[var(--ds-border)] shrink-0">
          <div>
            <p className="text-[9px] font-black uppercase tracking-[0.25em] text-[var(--ds-text-3)]">Admin · Rooms</p>
            <h3 className="text-xl font-black uppercase tracking-tight text-[var(--ds-text-1)] mt-0.5">Import / Export</h3>
          </div>
          <button onClick={onClose} className="size-8 flex items-center justify-center rounded-xl text-[var(--ds-text-3)] hover:bg-[var(--ds-bg-surface-2)] hover:text-[var(--ds-text-1)]">
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>close</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>

        <div className="px-7 pt-5 pb-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="size-6 rounded-lg flex items-center justify-center" style={{ background: 'rgba(16,185,129,0.12)' }}>
              <span className="material-symbols-outlined" style={{ fontSize: 14, color: '#10b981' }}>upload</span>
            </div>
            <p className="text-[11px] font-black uppercase tracking-[0.15em]" style={{ color: '#10b981' }}>Export Rooms</p>
            <span className="text-[10px] font-bold text-[var(--ds-text-3)]">— {rooms.length} rooms</span>
          </div>
          <div className="rounded-2xl border p-4 space-y-3" style={{ background: 'rgba(16,185,129,0.04)', borderColor: 'rgba(16,185,129,0.18)' }}>
            <p className="text-[10px] text-[var(--ds-text-2)] font-medium">Columns: <span className="font-mono text-[var(--ds-text-1)]">{ROOM_COLS.join(', ')}</span></p>
            <div className="flex gap-2">
              <button onClick={doExportExcel} disabled={exporting} className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 text-white text-[10px] font-black uppercase hover:bg-emerald-700 disabled:opacity-50 transition-colors">
                {exporting ? <span className="material-symbols-outlined animate-spin" style={{ fontSize: 13 }}>progress_activity</span> : <span className="material-symbols-outlined" style={{ fontSize: 13 }}>table</span>}Excel
              </button>
              <button onClick={doExportCSV} disabled={exporting} className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-500 text-white text-[10px] font-black uppercase hover:bg-blue-600 disabled:opacity-50 transition-colors">
                {exporting ? <span className="material-symbols-outlined animate-spin" style={{ fontSize: 13 }}>progress_activity</span> : <span className="material-symbols-outlined" style={{ fontSize: 13 }}>description</span>}CSV
              </button>
              <button onClick={doExportSQL} disabled={exporting} className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-700 text-white text-[10px] font-black uppercase hover:bg-slate-800 disabled:opacity-50 transition-colors">
                {exporting ? <span className="material-symbols-outlined animate-spin" style={{ fontSize: 13 }}>progress_activity</span> : <span className="material-symbols-outlined" style={{ fontSize: 13 }}>database</span>}SQL
              </button>
            </div>
          </div>
        </div>

        <div className="mx-7 border-t border-[var(--ds-border)]" />

        <div className="px-7 pt-4 pb-6 space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <div className="size-6 rounded-lg flex items-center justify-center" style={{ background: 'rgba(99,102,241,0.12)' }}>
              <span className="material-symbols-outlined" style={{ fontSize: 14, color: '#6366f1' }}>download</span>
            </div>
            <p className="text-[11px] font-black uppercase tracking-[0.15em]" style={{ color: '#6366f1' }}>Import Rooms</p>
          </div>

          <div className="flex gap-1 bg-[var(--ds-bg-surface-2)] rounded-xl p-1 w-fit">
            {TABS.map(t => (
              <button key={t.key} onClick={() => { setTab(t.key); setPreview(null); setParseErr(''); setImportResult(null) }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${tab === t.key ? 'bg-[var(--ds-bg-surface)] shadow text-[var(--ds-text-1)]' : 'text-[var(--ds-text-3)] hover:text-[var(--ds-text-2)]'}`}>
                <span className="material-symbols-outlined" style={{ fontSize: 12 }}>{t.icon}</span>{t.label}
              </button>
            ))}
          </div>

          <div className="bg-[var(--ds-bg-raised)] rounded-2xl p-4 space-y-3 text-[11px]">
            {tab === 'excel' && (
              <>
                <p className="font-black text-[var(--ds-text-1)]">Format Excel (.xlsx)</p>
                <div className="overflow-x-auto">
                  <table className="text-[10px] border-collapse w-full">
                    <thead>
                      <tr className="bg-[var(--ds-border)]">
                        {ROOM_COLS.map((_, i) => <th key={i} className="px-3 py-1.5 text-left font-black text-[var(--ds-text-1)] border border-[var(--ds-border)]">Col {String.fromCharCode(65 + i)}</th>)}
                      </tr>
                      <tr className="bg-[var(--ds-bg-surface-2)]">
                        {ROOM_COLS.map(c => <th key={c} className="px-3 py-1.5 text-left font-bold text-[var(--ds-text-2)] border border-[var(--ds-border)] font-mono">{c}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {TEMPLATE_EXAMPLE.map((r, i) => (
                        <tr key={i} className={i % 2 === 0 ? 'bg-[var(--ds-bg-surface)]' : 'bg-[var(--ds-bg-raised)]'}>
                          {ROOM_COLS.map(c => <td key={c} className="px-3 py-1.5 border border-[var(--ds-border-sub)] text-[var(--ds-text-2)]">{r[c] || '(empty)'}</td>)}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <ul className="space-y-1 text-[var(--ds-text-2)] list-disc pl-4">
                  <li>First row must be a header — column order determines mapping</li>
                  <li>Required: <span className="font-mono">name</span> (Col A), <span className="font-mono">capacity</span> (Col C), <span className="font-mono">floor</span> (Col D)</li>
                  <li>Building (Col B) must match an existing building name exactly — strongly recommended, though technically optional</li>
                  <li>Facilities (Col E): comma-separated names, e.g. <span className="font-mono">Projector, WiFi, Whiteboard</span></li>
                  <li>Status: <span className="font-mono">active</span>/<span className="font-mono">maintenance</span>, Is Active &amp; Requires Contact: <span className="font-mono">yes</span>/<span className="font-mono">no</span> — the downloaded template has dropdowns on these columns</li>
                  <li>Sensor code is always auto-generated on the server, not imported</li>
                </ul>
                <button onClick={() => downloadTemplate('xlsx')} className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 text-white text-[9px] font-black uppercase hover:bg-emerald-700 transition-colors">
                  <span className="material-symbols-outlined" style={{ fontSize: 13 }}>download</span>Download Template (.xlsx)
                </button>
              </>
            )}
            {tab === 'csv' && (
              <>
                <p className="font-black text-[var(--ds-text-1)]">Format CSV (.csv)</p>
                <div className="bg-[var(--ds-bg-surface)] rounded-xl border border-[var(--ds-border)] p-3 font-mono text-[10px] text-[var(--ds-text-2)] space-y-0.5 overflow-x-auto whitespace-nowrap">
                  <p className="text-[var(--ds-text-3)]">{ROOM_COLS.join(',')}</p>
                  {TEMPLATE_EXAMPLE.map((r, i) => <p key={i}>{ROOM_COLS.map(c => c === 'facilities' ? `"${r[c] ?? ''}"` : (r[c] ?? '')).join(',')}</p>)}
                </div>
                <ul className="space-y-1 text-[var(--ds-text-2)] list-disc pl-4">
                  <li>Separator: comma — wrap values containing commas (e.g. facilities list) in double quotes</li>
                  <li>First row = header (column names used for mapping, order doesn't matter)</li>
                  <li>Required: <span className="font-mono">name</span>, <span className="font-mono">capacity</span>, <span className="font-mono">floor</span></li>
                  <li>Building must match an existing building name exactly</li>
                  <li>Status must be <span className="font-mono">active</span> or <span className="font-mono">maintenance</span> (default: <span className="font-mono">active</span>)</li>
                  <li>Sensor code is always auto-generated on the server, not imported</li>
                </ul>
                <button onClick={() => downloadTemplate('csv')} className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-blue-500 text-white text-[9px] font-black uppercase hover:bg-blue-600 transition-colors">
                  <span className="material-symbols-outlined" style={{ fontSize: 13 }}>download</span>Download Template (.csv)
                </button>
              </>
            )}
            {tab === 'sql' && (
              <>
                <p className="font-black text-[var(--ds-text-1)]">Format SQL (.sql)</p>
                <div className="bg-[var(--ds-bg-surface)] rounded-xl border border-[var(--ds-border)] p-3 font-mono text-[10px] text-[var(--ds-text-2)] space-y-0.5 overflow-x-auto whitespace-nowrap">
                  <p className="text-[var(--ds-text-3)]">-- Column order required: {ROOM_COLS.join(', ')}</p>
                  <p>INSERT INTO rooms ({ROOM_COLS.join(', ')}) VALUES</p>
                  {TEMPLATE_EXAMPLE.map((r, i) => <p key={i} className="pl-2">({ROOM_COLS.map(c => `'${r[c] ?? ''}'`).join(', ')}){i < TEMPLATE_EXAMPLE.length - 1 ? ',' : ';'}</p>)}
                </div>
                <ul className="space-y-1 text-[var(--ds-text-2)] list-disc pl-4">
                  <li>Only one <span className="font-mono">INSERT INTO ... VALUES (...)</span> block is processed</li>
                  <li>Column order in VALUES must be: <span className="font-mono">{ROOM_COLS.join(', ')}</span></li>
                  <li>Required: <span className="font-mono">name</span>, <span className="font-mono">capacity</span>, <span className="font-mono">floor</span> — use <span className="font-mono">NULL</span> or empty string for the rest</li>
                  <li>Sensor code is always auto-generated on the server, not imported</li>
                  <li>Multi-statement and subqueries are not supported</li>
                </ul>
              </>
            )}
          </div>

          {!importResult && (
            <div>
              <label className="text-[9px] font-black uppercase text-[var(--ds-text-3)] tracking-wider block mb-2">Choose File</label>
              <input ref={fileRef} type="file" accept={tab === 'excel' ? '.xlsx,.xls' : tab === 'csv' ? '.csv' : '.sql'}
                onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])}
                className="block w-full text-[11px] text-[var(--ds-text-2)] font-bold file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-[10px] file:font-black file:uppercase file:bg-black file:text-[#adee2b] hover:file:bg-slate-800 file:cursor-pointer" />
              {parseErr && <p className="text-xs text-red-500 font-bold mt-2">{parseErr}</p>}
            </div>
          )}

          {preview && preview.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-[9px] font-black uppercase tracking-widest text-[var(--ds-text-3)]">Preview — {preview.length} rows</p>
                <button onClick={() => { setPreview(null); if (fileRef.current) fileRef.current.value = '' }} className="text-[9px] text-[var(--ds-text-3)] hover:text-[var(--ds-text-1)] font-bold">Clear</button>
              </div>
              <div className="overflow-x-auto rounded-xl border border-[var(--ds-border)]">
                <table className="w-full text-[10px]">
                  <thead>
                    <tr className="bg-[var(--ds-bg-raised)] border-b border-[var(--ds-border)]">
                      {ROOM_COLS.map(c => <th key={c} className="px-3 py-2 text-left font-black text-[var(--ds-text-2)] uppercase">{c}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.slice(0, 8).map((row, i) => (
                      <tr key={i} className={i % 2 === 0 ? 'bg-[var(--ds-bg-surface)]' : 'bg-[var(--ds-bg-raised)]'}>
                        {ROOM_COLS.map(c => <td key={c} className="px-3 py-1.5 text-[var(--ds-text-2)]">{(row as Record<string, string>)[c] || '—'}</td>)}
                      </tr>
                    ))}
                    {preview.length > 8 && (
                      <tr><td colSpan={ROOM_COLS.length} className="px-3 py-2 text-center text-[9px] text-[var(--ds-text-3)] font-bold">+{preview.length - 8} more rows...</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
              <button onClick={handleImport} disabled={importing} className="w-full py-3 rounded-2xl bg-black text-[#adee2b] text-[10px] font-black uppercase hover:bg-slate-800 disabled:opacity-40 transition-colors flex items-center justify-center gap-2">
                {importing && <span className="material-symbols-outlined animate-spin" style={{ fontSize: 13 }}>progress_activity</span>}Import {preview.length} Rooms
              </button>
            </div>
          )}

          {importResult && (
            <div className="space-y-3">
              <div className={`rounded-2xl p-4 ${importResult.errors.length === 0 ? 'bg-green-500/10 border border-green-500/20' : 'bg-amber-500/10 border border-amber-500/20'}`}>
                <p className={`text-sm font-black ${importResult.errors.length === 0 ? 'text-green-400' : 'text-amber-400'}`}>
                  {importResult.created} room{importResult.created !== 1 ? 's' : ''} created successfully
                  {importResult.errors.length > 0 ? ` — ${importResult.errors.length} row${importResult.errors.length !== 1 ? 's' : ''} failed` : ' — all done!'}
                </p>
                {importResult.errors.length > 0 && (
                  <ul className="mt-2 space-y-1">{importResult.errors.map((e, i) => <li key={i} className="text-[10px] text-amber-400 font-medium">• {e}</li>)}</ul>
                )}
              </div>
              <button onClick={() => setImportResult(null)} className="text-[9px] text-[var(--ds-text-3)] hover:text-[var(--ds-text-1)] font-bold">Import more</button>
            </div>
          )}
        </div>
        </div>
      </div>
    </div>
    </ModalPortal>
  )
}

// ── Departments Section ──────────────────────────────────────────────────────
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

function UsersTab() {
  const qc = useQueryClient()
  const { user: currentUser } = useAuth()
  const isReadOnly = currentUser?.role === 'building_admin'
  const { data: users = [], isLoading } = useQuery<User[]>({ queryKey: ['users'], queryFn: getUsers })
  const { data: buildings = [] } = useQuery<Building[]>({ queryKey: ['buildings'], queryFn: getBuildings })
  const { data: locations = [] } = useQuery<Location[]>({ queryKey: ['locations'], queryFn: getLocations })
  const { data: departments = [] } = useQuery<Department[]>({ queryKey: ['departments'], queryFn: getDepartments })

  const [editUser, setEditUser]         = useState<User | null>(null)
  const [roleValue, setRoleValue]       = useState<UserRole>('user')
  const [bldIds, setBldIds]             = useState<number[]>([])
  const [saving, setSaving]             = useState(false)
  const editScrollBodyRef = useRef<HTMLDivElement>(null)

  function selectEditRole(r: UserRole, blocked: boolean) {
    if (blocked) return
    setRoleValue(r)
    if (r !== 'admin') {
      setTimeout(() => editScrollBodyRef.current?.scrollTo({ top: editScrollBodyRef.current.scrollHeight, behavior: 'smooth' }), 50)
    }
  }
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
  const [editAlias, setEditAlias]             = useState('')
  const [editDeptId, setEditDeptId]           = useState<number | null>(null)
  const [editExt, setEditExt]                 = useState('')
  const [editPw, setEditPw]                   = useState('')
  const [editConfirmPw, setEditConfirmPw]     = useState('')
  const [editShowPw, setEditShowPw]           = useState(false)
  const [editAvatar, setEditAvatar]           = useState('')
  const [editErr, setEditErr]                 = useState('')
  const [editDefaultBldId, setEditDefaultBldId] = useState<number | null>(null)

  function openEdit(u: User) {
    setEditUser(u)
    setRoleValue(u.role)
    setBldIds((u.admin_buildings ?? []).map(b => b.id))
    setEditDefaultBldId(u.default_building_id ?? null)
    setEditName(u.name)
    setEditEmail(u.email)
    setEditAlias(u.alias ?? '')
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
        alias: editAlias.trim() || null,
        department_id: editDeptId,
        ext: editExt.trim() || undefined,
        ...(editPw ? { password: editPw } : {}),
        ...(editAvatar !== (editUser.avatar ?? '') ? { avatar: editAvatar || null } : {}),
      })
      await updateUserRole(editUser.id, roleValue)
      if (roleValue !== 'admin') {
        await assignUserBuildings(editUser.id, bldIds, editDefaultBldId)
      }
      qc.invalidateQueries({ queryKey: ['users'] })
      setEditUser(null)
    } catch (e: unknown) {
      const resp = (e as { response?: { data?: { message?: string; errors?: { email?: string[]; alias?: string[] } } } })?.response?.data
      setEditErr(resp?.message ?? resp?.errors?.email?.[0] ?? resp?.errors?.alias?.[0] ?? 'Failed to save changes.')
    } finally { setSaving(false) }
  }

  function toggleBuilding(id: number) {
    setBldIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  async function handleAddUser(data: Parameters<typeof createUser>[0] & { building_ids: number[]; default_building_id: number | null }) {
    const { building_ids, default_building_id, ...userData } = data
    const user = await createUser(userData)
    qc.invalidateQueries({ queryKey: ['users'] })
    if (userData.role !== 'admin' && (building_ids.length > 0 || default_building_id != null)) {
      try { await assignUserBuildings(user.id, building_ids, default_building_id) } catch { /* non-fatal */ }
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
    (users as User[]).filter(u => !search || u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase()) || u.alias?.toLowerCase().includes(search.toLowerCase()) || u.department?.toLowerCase().includes(search.toLowerCase()))
  , [users, search])

  const grouped = useMemo(() => {
    const g: Partial<Record<UserRole, User[]>> = {}
    filtered.forEach(u => { if (!g[u.role]) g[u.role] = []; g[u.role]!.push(u) })
    return g
  }, [filtered])

  return (
    <div className="space-y-5 max-w-5xl">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex-1 min-w-0">
          <p className="text-[9px] font-black uppercase tracking-[0.25em] text-[var(--ds-text-3)] mb-1">Management</p>
          <h1 className="text-3xl font-black italic tracking-tighter uppercase">Users</h1>
        </div>
        {/* Search */}
        <div className="relative">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ds-text-3)] pointer-events-none" style={{ fontSize: 16 }}>search</span>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search users..."
            className="w-56 bg-[var(--ds-bg-surface)] border border-[var(--ds-border)] rounded-xl pl-9 pr-3 py-2.5 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-[#adee2b] focus:border-transparent text-[var(--ds-text-1)]" />
        </div>
        {!isReadOnly && (<>
        {/* Import / Export */}
        <button onClick={() => setIEModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--ds-bg-surface-2)] text-[var(--ds-text-2)] text-[11px] font-black uppercase hover:bg-[var(--ds-bg-raised)] transition-colors">
          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>import_export</span>
          Import / Export
        </button>
        {/* Add User */}
        <button onClick={() => setAddModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-black text-[#adee2b] text-[11px] font-black uppercase hover:bg-slate-800 transition-colors">
          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>person_add</span>
          Add User
        </button>
        </>)}
      </div>

      {/* ── Departments section — admin only ── */}
      {!isReadOnly && <DepartmentsSection departments={departments as Department[]} locations={locations as Location[]} qc={qc} />}

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <span className="material-symbols-outlined animate-spin text-3xl text-[var(--ds-text-3)]">progress_activity</span>
        </div>
      ) : (
        <div className="space-y-4">
          {ALL_ROLES.filter(r => grouped[r]?.length).map(role => {
            const m = ROLE_META[role]
            const isUserRole = role === 'user'
            return (
              <div key={role} className="bg-[var(--ds-bg-surface)] rounded-2xl border border-[var(--ds-border-sub)] overflow-hidden">
                {/* Group header */}
                <div className="flex items-center gap-3 px-5 py-3.5 border-b border-[var(--ds-border-sub)]">
                  <span className={`px-3 py-1.5 rounded-lg text-[11px] font-black uppercase ${m.bg} ${m.text}`}>{m.label}</span>
                  <span className="text-[11px] font-black text-[var(--ds-text-3)]">{grouped[role]!.length} user{grouped[role]!.length !== 1 ? 's' : ''}</span>
                </div>

                {isUserRole ? (
                  /* Table layout for role='user' */
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="border-b border-[var(--ds-border-sub)]">
                          <th className="px-5 py-3 text-[10px] font-black uppercase text-[var(--ds-text-3)] tracking-wider w-10">No.</th>
                          <th className="px-5 py-3 text-[10px] font-black uppercase text-[var(--ds-text-3)] tracking-wider">Name</th>
                          <th className="px-5 py-3 text-[10px] font-black uppercase text-[var(--ds-text-3)] tracking-wider">Email</th>
                          <th className="px-5 py-3 text-[10px] font-black uppercase text-[var(--ds-text-3)] tracking-wider">Department</th>
                          <th className="px-5 py-3 text-[10px] font-black uppercase text-[var(--ds-text-3)] tracking-wider w-20">Ext</th>
                          {role === 'user' && <th className="px-5 py-3 text-[10px] font-black uppercase text-[var(--ds-text-3)] tracking-wider">Default Building</th>}
                          {role === 'user' && <th className="px-5 py-3 text-[10px] font-black uppercase text-[var(--ds-text-3)] tracking-wider">Special Access</th>}
                          <th className="px-2 py-3 w-10"></th>
                          <th className="px-2 py-3 w-10"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {grouped[role]!.map((u, i) => (
                          <tr key={u.id} className={`hover:bg-[var(--ds-bg-raised)] transition-colors ${i < grouped[role]!.length - 1 ? 'border-b border-[var(--ds-border-sub)]' : ''}`}>
                            <td className="px-5 py-3.5 text-[11px] font-bold text-[var(--ds-text-3)]">{i + 1}</td>
                            <td className="px-5 py-3.5">
                              <div className="flex items-center gap-2.5">
                                <UserAvatar name={u.name} avatar={u.avatar} size={32} />
                                <span className="text-[13px] font-black text-[var(--ds-text-1)] whitespace-nowrap">{u.name}</span>
                              </div>
                            </td>
                            <td className="px-5 py-3.5 text-[12px] text-[var(--ds-text-3)] font-medium">
                              <div>{u.email}</div>
                              {u.alias && <div className="text-[10px] text-[var(--ds-text-4)]">@{u.alias}</div>}
                            </td>
                            <td className="px-5 py-3.5">
                              {u.department ? (
                                <span className="flex items-center gap-1.5">
                                  <span className="text-[12px] font-black text-[var(--ds-text-1)] uppercase">{u.department}</span>
                                  {u.department_location && (
                                    <span className="text-[10px] font-bold text-[var(--ds-text-3)]">
                                      | {u.department_location.code ?? u.department_location.name}
                                    </span>
                                  )}
                                </span>
                              ) : <span className="text-[var(--ds-text-4)]">—</span>}
                            </td>
                            <td className="px-5 py-3.5 text-[12px] text-[var(--ds-text-3)] font-medium">{u.ext || '—'}</td>
                            {role === 'user' && (() => {
                              const bld = u.default_building_id != null ? (buildings as Building[]).find(b => b.id === u.default_building_id) : null
                              return (
                                <td className="px-5 py-3.5">
                                  {bld ? (
                                    <span className="flex items-center gap-1.5">
                                      <span className="text-[11px] font-black text-[var(--ds-text-1)]">{bld.name}</span>
                                      {bld.code && <span className="text-[9px] font-black px-1.5 py-0.5 rounded-md" style={{ background: 'var(--ds-bg-raised)', color: 'var(--ds-text-3)' }}>{bld.code}</span>}
                                    </span>
                                  ) : (
                                    <span className="text-[11px] text-[var(--ds-text-4)] font-medium">—</span>
                                  )}
                                </td>
                              )
                            })()}
                            {role === 'user' && (
                              <td className="px-5 py-3.5">
                                <button
                                  disabled={isReadOnly}
                                  onClick={async () => { await toggleUserSpecialAccess(u.id); qc.invalidateQueries({ queryKey: ['users'] }) }}
                                  className="group flex items-center gap-1.5 px-3 py-1.5 rounded-xl border transition-all text-[11px] font-black uppercase tracking-wider whitespace-nowrap"
                                  style={u.can_book_special
                                    ? { background: 'rgba(173,238,43,0.1)', borderColor: 'rgba(173,238,43,0.4)', color: '#4d7c00' }
                                    : { background: 'var(--ds-bg-surface)', borderColor: 'var(--ds-border)', color: '#94a3b8' }
                                  }
                                  onMouseEnter={e => {
                                    const b = e.currentTarget
                                    if (u.can_book_special) { b.style.background = 'rgba(239,68,68,0.08)'; b.style.borderColor = 'rgba(239,68,68,0.35)'; b.style.color = '#dc2626' }
                                    else { b.style.background = 'rgba(173,238,43,0.08)'; b.style.borderColor = 'rgba(173,238,43,0.4)'; b.style.color = '#4d7c00' }
                                  }}
                                  onMouseLeave={e => {
                                    const b = e.currentTarget
                                    if (u.can_book_special) { b.style.background = 'rgba(173,238,43,0.1)'; b.style.borderColor = 'rgba(173,238,43,0.4)'; b.style.color = '#4d7c00' }
                                    else { b.style.background = 'var(--ds-bg-surface)'; b.style.borderColor = 'var(--ds-border)'; b.style.color = '#94a3b8' }
                                  }}
                                >
                                  <span className="material-symbols-outlined" style={{ fontSize: 13, fontVariationSettings: u.can_book_special ? "'FILL' 1" : "'FILL' 0" }}>star</span>
                                  {u.can_book_special ? 'Special' : 'Grant Access'}
                                </button>
                              </td>
                            )}
                            <td className="px-2 py-3.5">
                              {!isReadOnly && (
                                <button onClick={() => openEdit(u)}
                                  className="size-8 flex items-center justify-center rounded-lg text-[var(--ds-text-3)] hover:bg-[var(--ds-bg-surface-2)] hover:text-[var(--ds-text-1)] transition-colors">
                                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>edit</span>
                                </button>
                              )}
                            </td>
                            <td className="px-2 py-3.5">
                              {!isReadOnly && (
                                <button onClick={() => { setDeleteUserTarget(u); setConfirmUserInput(''); setDeleteUserErr('') }}
                                  className="size-8 flex items-center justify-center rounded-lg text-[var(--ds-text-3)] hover:bg-red-500/10 hover:text-red-400 transition-colors">
                                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>delete</span>
                                </button>
                              )}
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
                      <div key={u.id} className={`flex items-center gap-4 px-5 py-4 hover:bg-[var(--ds-bg-raised)] transition-colors ${i < grouped[role]!.length - 1 ? 'border-b border-[var(--ds-border-sub)]' : ''}`}>
                        <UserAvatar name={u.name} avatar={u.avatar} size={44} />
                        <div className="flex-1 min-w-0">
                          <p className="text-[14px] font-black text-[var(--ds-text-1)]">{u.name}</p>
                          <p className="text-[12px] text-[var(--ds-text-3)] font-bold">{u.email}{u.alias && <span className="text-[var(--ds-text-4)] font-medium"> · @{u.alias}</span>}</p>
                        </div>
                        <span className="flex items-center gap-1.5 shrink-0">
                          {u.department && <span className="text-[11px] font-bold text-[var(--ds-text-3)] uppercase">{u.department}</span>}
                          {u.department_location && <span className="text-[10px] font-bold text-[var(--ds-text-4)]">| {u.department_location.code ?? u.department_location.name}</span>}
                        </span>
                        {/* Building tags */}
                        <div className="flex gap-1.5 flex-wrap max-w-[220px] justify-end">
                          {(u.admin_buildings ?? []).length === 0
                            ? <span className="text-[11px] text-orange-400 font-black uppercase">No buildings</span>
                            : (u.admin_buildings ?? []).map(b => (
                              <span key={b.id} className="px-2.5 py-1 bg-blue-50 text-blue-600 rounded-lg text-[10px] font-black uppercase">{b.name}</span>
                            ))
                          }
                        </div>
                        {/* Special room access — only for regular users */}
                        {u.role === 'user' && !isReadOnly && (
                          <button
                            title={u.can_book_special ? 'Revoke special room access' : 'Grant special room access'}
                            onClick={async () => {
                              await toggleUserSpecialAccess(u.id)
                              qc.invalidateQueries({ queryKey: ['users'] })
                            }}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition-colors shrink-0 text-[11px] font-black uppercase tracking-wider"
                            style={{ background: u.can_book_special ? 'rgba(173,238,43,0.12)' : 'rgba(0,0,0,0.04)', color: u.can_book_special ? '#4d7c00' : '#94a3b8' }}
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>star</span>
                            {u.can_book_special ? 'Special' : 'Regular'}
                          </button>
                        )}
                        {!isReadOnly && (<>
                        <button onClick={() => openEdit(u)}
                          className="size-9 flex items-center justify-center rounded-xl text-[var(--ds-text-3)] hover:bg-[var(--ds-bg-surface-2)] hover:text-[var(--ds-text-1)] transition-colors shrink-0">
                          <span className="material-symbols-outlined" style={{ fontSize: 17 }}>edit</span>
                        </button>
                        <button onClick={() => {
                            const isLastAdmin = u.role === 'admin' && (users as User[]).filter(x => x.role === 'admin').length <= 1
                            if (isLastAdmin) { setDeleteBlockedUser(u); return }
                            setDeleteUserTarget(u); setConfirmUserInput(''); setDeleteUserErr('')
                          }}
                          className="size-8 flex items-center justify-center rounded-xl text-[var(--ds-text-3)] hover:bg-red-500/10 hover:text-red-400 transition-colors shrink-0">
                          <span className="material-symbols-outlined" style={{ fontSize: 15 }}>delete</span>
                        </button>
                        </>)}
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
            style={{ background: 'var(--ds-bg-surface)', backdropFilter: 'blur(48px) saturate(200%)', border: '1px solid rgba(128,128,128,0.15)' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="px-7 pt-7 pb-5 bg-amber-50 border-b border-amber-100 flex items-center gap-3">
              <div className="size-11 rounded-2xl bg-amber-100 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-amber-500" style={{ fontSize: 22, fontVariationSettings: "'FILL' 1" }}>shield_lock</span>
              </div>
              <div>
                <p className="text-[9px] font-black uppercase tracking-[0.2em] text-amber-500">Action Blocked</p>
                <h3 className="text-lg font-black text-[var(--ds-text-1)] uppercase tracking-tight mt-0.5">Cannot Delete</h3>
              </div>
            </div>
            <div className="px-7 py-6 space-y-4">
              <div className="bg-[var(--ds-bg-raised)] rounded-xl px-4 py-3 flex items-center gap-3">
                <div className="size-9 rounded-xl overflow-hidden shrink-0">
                  <UserAvatar name={deleteBlockedUser.name} avatar={deleteBlockedUser.avatar} size={40}
                    className="w-full h-full object-cover" />
                </div>
                <div>
                  <p className="text-sm font-black text-[var(--ds-text-1)]">{deleteBlockedUser.name}</p>
                  <p className="text-[10px] text-[var(--ds-text-3)] font-medium">{deleteBlockedUser.email}</p>
                </div>
                <span className="ml-auto px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-black text-[#adee2b] shrink-0">Super Admin</span>
              </div>
              <p className="text-[12px] text-[var(--ds-text-2)] font-medium leading-relaxed">
                This is the <span className="font-black text-[var(--ds-text-1)]">only Super Admin</span> in the system. Deleting them would leave the system with no administrator.
              </p>
              <p className="text-[11px] text-[var(--ds-text-3)] font-medium leading-relaxed">
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
            style={{ background: 'var(--ds-bg-surface)', backdropFilter: 'blur(48px) saturate(200%)', border: '1px solid rgba(128,128,128,0.15)' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="px-7 pt-7 pb-5 border-b flex items-center gap-3" style={{ background: 'rgba(239,68,68,0.08)', borderColor: 'rgba(239,68,68,0.15)' }}>
              <div className="size-11 rounded-2xl bg-red-100 flex items-center justify-center shrink-0 overflow-hidden">
                <UserAvatar name={deleteUserTarget.name} avatar={deleteUserTarget.avatar} size={40} />
              </div>
              <div>
                <p className="text-[9px] font-black uppercase tracking-[0.2em] text-red-500">Danger Zone</p>
                <h3 className="text-lg font-black text-[var(--ds-text-1)] uppercase tracking-tight mt-0.5">Delete User?</h3>
              </div>
            </div>
            <div className="px-7 py-5 space-y-4">
              <div className="bg-[var(--ds-bg-raised)] rounded-xl px-4 py-3 flex items-center gap-3">
                <span className="material-symbols-outlined text-[var(--ds-text-3)] shrink-0" style={{ fontSize: 20 }}>person</span>
                <div>
                  <p className="text-sm font-black text-[var(--ds-text-1)]">{deleteUserTarget.name}</p>
                  <p className="text-[10px] text-[var(--ds-text-3)] font-medium mt-0.5">
                    {deleteUserTarget.email}
                    {deleteUserTarget.department ? ` · ${deleteUserTarget.department}` : ''}
                  </p>
                </div>
                <span className={`ml-auto shrink-0 px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${ROLE_META[deleteUserTarget.role].bg} ${ROLE_META[deleteUserTarget.role].text}`}>
                  {ROLE_META[deleteUserTarget.role].label}
                </span>
              </div>
              <p className="text-[11px] text-[var(--ds-text-2)] font-medium leading-relaxed">
                This account and all associated data will be permanently removed. <span className="font-black text-[var(--ds-text-1)]">This cannot be undone.</span>
              </p>
              <div className="space-y-1.5">
                <label className="text-[9px] font-black uppercase tracking-wider text-[var(--ds-text-3)] px-1">
                  Type <span className="normal-case text-[var(--ds-text-1)]">"{deleteUserTarget.name}"</span> to confirm
                </label>
                <input
                  value={confirmUserInput}
                  onChange={e => setConfirmUserInput(e.target.value)}
                  placeholder={deleteUserTarget.name}
                  autoFocus
                  className="w-full bg-[var(--ds-bg-raised)] border border-[var(--ds-border)] rounded-xl px-3 py-2.5 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-red-300 focus:border-transparent text-[var(--ds-text-1)]"
                />
              </div>
              {deleteUserErr && (
                <div className="flex items-center gap-2 text-[11px] font-bold px-3 py-2.5 rounded-xl" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171' }}>
                  <span className="material-symbols-outlined shrink-0" style={{ fontSize: 14 }}>error</span>
                  {deleteUserErr}
                </div>
              )}
              <div className="flex gap-3 pt-1">
                <button onClick={() => { setDeleteUserTarget(null); setConfirmUserInput('') }}
                  className="flex-1 py-3.5 rounded-full text-[10px] font-black uppercase tracking-[0.15em] bg-[var(--ds-bg-surface-2)] text-[var(--ds-text-2)] hover:bg-[var(--ds-bg-raised)] transition-colors">
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
        <div className="fixed inset-0 z-[1000] flex items-center justify-center admin-backdrop-in" style={{ background: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(12px)' }} onClick={() => setEditUser(null)}>
          <div className="w-[540px] flex flex-col rounded-3xl shadow-2xl overflow-hidden admin-modal-in"
            style={{ height: 680, background: 'var(--ds-bg-surface)', backdropFilter: 'blur(48px) saturate(200%)', border: '1px solid rgba(128,128,128,0.15)' }}
            onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center gap-3 px-7 pt-6 pb-5 border-b border-[var(--ds-border-sub)] shrink-0">
              <UserAvatar name={editUser.name} avatar={editAvatar || editUser.avatar} size={48}
                style={{ borderRadius: 16 }} />
              <div>
                <h3 className="text-sm font-black uppercase tracking-tight text-[var(--ds-text-1)]">Edit User</h3>
                <p className="text-[10px] text-[var(--ds-text-3)]">{editUser.email}</p>
              </div>
            </div>

            {/* Scrollable body */}
            <div ref={editScrollBodyRef} className="flex-1 overflow-y-auto px-7 py-5 space-y-4" style={{ scrollbarWidth: 'thin' }}>

            {editErr && <div className="flex items-center gap-2 text-[11px] font-bold px-3 py-2.5 rounded-xl" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171' }}><span className="material-symbols-outlined shrink-0" style={{ fontSize: 14 }}>error</span>{editErr}</div>}

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
                  <label className="text-[9px] font-black uppercase text-[var(--ds-text-3)] tracking-wider">Avatar</label>
                  <div className="flex gap-2 flex-wrap">
                    {PRESET_AVATARS.map(url => (
                      <button key={url} type="button" onClick={() => setEditAvatar(editAvatar === url ? '' : url)}
                        className={`size-9 rounded-xl overflow-hidden border-2 transition-all ${editAvatar === url ? 'border-[#adee2b] shadow-md scale-110' : 'border-transparent hover:border-[var(--ds-border)]'}`}>
                        <img src={url} className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-[var(--ds-text-3)]">Custom URL</label>
                    <input value={editAvatar} onChange={e => setEditAvatar(e.target.value)} placeholder="https://..."
                      className="w-full border border-[var(--ds-border)] rounded-xl px-3 py-2 text-[11px] font-bold focus:outline-none focus:ring-2 focus:ring-[#adee2b] bg-[var(--ds-bg-surface)] text-[var(--ds-text-1)]" />
                  </div>
                </div>
              )
            })()}

            {/* Info fields */}
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 space-y-1">
                <label className="text-[9px] font-black uppercase text-[var(--ds-text-3)] tracking-wider">Full Name *</label>
                <input value={editName} onChange={e => setEditName(e.target.value)}
                  className="w-full border border-[var(--ds-border)] rounded-xl px-3 py-2 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-[#adee2b] bg-[var(--ds-bg-surface)] text-[var(--ds-text-1)]" />
              </div>
              <div className="col-span-2 space-y-1">
                <label className="text-[9px] font-black uppercase text-[var(--ds-text-3)] tracking-wider">Email *</label>
                <input type="email" value={editEmail} onChange={e => setEditEmail(e.target.value)}
                  className="w-full border border-[var(--ds-border)] rounded-xl px-3 py-2 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-[#adee2b] bg-[var(--ds-bg-surface)] text-[var(--ds-text-1)]" />
              </div>
              <div className="col-span-2 space-y-1">
                <label className="text-[9px] font-black uppercase text-[var(--ds-text-3)] tracking-wider">Username / Alias</label>
                <input value={editAlias} onChange={e => setEditAlias(e.target.value.toLowerCase())} placeholder="e.g. budi.santoso"
                  className="w-full border border-[var(--ds-border)] rounded-xl px-3 py-2 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-[#adee2b] bg-[var(--ds-bg-surface)] text-[var(--ds-text-1)]" />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-black uppercase text-[var(--ds-text-3)] tracking-wider">Department</label>
                <select value={editDeptId ?? ''} onChange={e => setEditDeptId(e.target.value ? Number(e.target.value) : null)}
                  className="w-full border border-[var(--ds-border)] rounded-xl px-3 py-2 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-[#adee2b] appearance-none cursor-pointer bg-[var(--ds-bg-surface)] text-[var(--ds-text-1)]">
                  <option value="">— No department —</option>
                  {(departments as Department[]).map(d => <option key={d.id} value={d.id}>{d.name}{d.code ? ` (${d.code})` : ''}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-black uppercase text-[var(--ds-text-3)] tracking-wider">Ext (phone)</label>
                <input value={editExt} onChange={e => setEditExt(e.target.value)}
                  className="w-full border border-[var(--ds-border)] rounded-xl px-3 py-2 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-[#adee2b] bg-[var(--ds-bg-surface)] text-[var(--ds-text-1)]" />
              </div>
              <div className="col-span-2 space-y-1">
                <label className="text-[9px] font-black uppercase text-[var(--ds-text-3)] tracking-wider">New Password <span className="normal-case font-medium">(leave blank to keep)</span></label>
                <div className="relative">
                  <input type={editShowPw ? 'text' : 'password'} value={editPw} onChange={e => setEditPw(e.target.value)} placeholder="min. 8 characters"
                    className="w-full border border-[var(--ds-border)] rounded-xl px-3 py-2 pr-10 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-[#adee2b] bg-[var(--ds-bg-surface)] text-[var(--ds-text-1)]" />
                  <button type="button" onClick={() => setEditShowPw(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--ds-text-3)] hover:text-[var(--ds-text-1)]">
                    <span className="material-symbols-outlined" style={{ fontSize: 16 }}>{editShowPw ? 'visibility_off' : 'visibility'}</span>
                  </button>
                </div>
              </div>
              {editPw && (
                <div className="col-span-2 space-y-1">
                  <label className="text-[9px] font-black uppercase text-[var(--ds-text-3)] tracking-wider">Confirm New Password</label>
                  <div className="relative">
                    <input type={editShowPw ? 'text' : 'password'} value={editConfirmPw} onChange={e => setEditConfirmPw(e.target.value)} placeholder="Re-enter new password"
                      className={`w-full border rounded-xl px-3 py-2 pr-10 text-sm font-bold focus:outline-none focus:ring-2 bg-[var(--ds-bg-surface)] text-[var(--ds-text-1)] ${editConfirmPw && editConfirmPw !== editPw ? 'border-red-300 focus:ring-red-400' : editConfirmPw && editConfirmPw === editPw ? 'border-green-300 focus:ring-green-400' : 'border-[var(--ds-border)] focus:ring-[#adee2b]'}`} />
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
                  <p className="text-[9px] font-black uppercase tracking-wider text-[var(--ds-text-3)]">Role</p>
                  <div className="grid grid-cols-2 gap-2">
                    {ALL_ROLES.map(r => {
                      const m = ROLE_META[r]
                      const blocked = isLastAdmin && r !== 'admin'
                      return (
                        <div key={r} className="relative group/role">
                          <button
                            onClick={() => selectEditRole(r, blocked)}
                            disabled={blocked}
                            title={blocked ? 'Cannot demote the last Super Admin' : undefined}
                            className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-xl border text-[10px] font-black uppercase transition-all
                              ${blocked ? 'opacity-30 cursor-not-allowed bg-[var(--ds-bg-surface)] border-[var(--ds-border)] text-[var(--ds-text-3)]'
                                : roleValue === r ? `${m.bg} ${m.text} border-transparent`
                                : 'bg-[var(--ds-bg-surface)] border-[var(--ds-border)] text-[var(--ds-text-3)] hover:border-[var(--ds-border)]'}`}>
                            <span className={`size-2 rounded-full shrink-0 ${roleValue === r ? 'bg-current' : 'bg-slate-200'}`} />
                            <span className="flex-1 text-left">{m.label}</span>
                            {!blocked && <span className="size-3.5 rounded-full flex items-center justify-center text-[8px] font-black shrink-0 opacity-50 group-hover/role:opacity-100 transition-opacity"
                              style={{ background: 'rgba(128,128,128,0.15)', color: 'inherit' }}>i</span>}
                          </button>
                          {!blocked && (
                            <div className="absolute left-0 right-0 bottom-[calc(100%+8px)] z-[300] pointer-events-none opacity-0 translate-y-1 group-hover/role:opacity-100 group-hover/role:translate-y-0 transition-all duration-200">
                              <div className="rounded-2xl p-3.5 shadow-2xl space-y-2"
                                style={{ background: 'rgba(15,20,45,0.97)', border: '1px solid rgba(255,255,255,0.1)', backdropFilter: 'blur(20px)' }}>
                                <p className="text-[10px] font-black" style={{ color: '#fff' }}>{m.label}</p>
                                <p className="text-[10px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.55)' }}>{m.desc}</p>
                                <div className="pt-1.5 space-y-1" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                                  {m.perms.map((p, i) => (
                                    <div key={i} className="flex items-start gap-1.5">
                                      <span className="material-symbols-outlined mt-0.5 shrink-0" style={{ fontSize: 10, color: 'rgba(173,238,43,0.7)' }}>check</span>
                                      <span className="text-[9px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.5)' }}>{p}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
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
            {roleValue === 'user' && (
              <DefaultBuildingSelect
                buildings={buildings as Building[]}
                value={editDefaultBldId}
                onChange={setEditDefaultBldId}
              />
            )}
            {(roleValue === 'building_admin' || roleValue === 'receptionist') && (
              <div className="space-y-2">
                <p className="text-[9px] font-black uppercase tracking-wider text-[var(--ds-text-3)]">Buildings</p>
                <BuildingPicker
                  role={roleValue}
                  bldIds={bldIds}
                  buildings={buildings as Building[]}
                  locations={locations as Location[]}
                  onToggle={toggleBuilding}
                  defaultBuildingId={editDefaultBldId}
                  onSetDefault={setEditDefaultBldId}
                />
              </div>
            )}

            </div>{/* end scrollable body */}

            {/* Footer — pinned */}
            <div className="px-7 py-5 border-t border-[var(--ds-border-sub)] shrink-0 flex gap-3">
              <button onClick={() => setEditUser(null)} className="flex-1 py-3.5 rounded-full text-[10px] font-black uppercase tracking-[0.15em] bg-[var(--ds-bg-surface-2)] text-[var(--ds-text-2)] hover:bg-[var(--ds-bg-raised)] transition-colors">Cancel</button>
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

// ── Archive Tab ──────────────────────────────────────────────────────────────
function ArchiveTab() {
  const qc = useQueryClient()
  const { addInfoToast } = useCancelToast()
  const [params, setParams] = useState<ArchiveParams>({ page: 1 })
  const [search, setSearch] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo]   = useState('')
  const [purgeConfirm, setPurgeConfirm] = useState(false)
  const [activeSection, setActiveSection] = useState<'bookings' | 'exports'>('bookings')
  const importRef = useRef<HTMLInputElement>(null)
  const searchDebounce = useRef<ReturnType<typeof setTimeout>>()

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
      addInfoToast('Restore all failed: ' + (msg ?? 'unknown error'))
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
      addInfoToast('Restore failed: ' + (msg ?? 'unknown error'))
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
    return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
  }
  function fmtTime(iso: string) {
    return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  }

  function exportExcel() {
    if (!data?.data.length) return
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
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Archive')
    XLSX.writeFile(wb, `bookings-archive-${new Date().toISOString().slice(0, 10)}.xlsx`)
  }

  function exportCsv() {
    if (!data?.data.length) return
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
          <button onClick={exportExcel} disabled={!data?.data.length}
            className="flex items-center gap-1.5 px-3.5 h-9 rounded-xl border border-[var(--ds-border)] bg-[var(--ds-bg-surface)] text-[var(--ds-text-2)] text-[10px] font-black uppercase hover:bg-[var(--ds-bg-raised)] transition-colors disabled:opacity-30">
            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>table_view</span>Excel
          </button>
          <button onClick={exportCsv} disabled={!data?.data.length}
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
            {!data?.data.length && !isFetching && (
              <tr><td colSpan={8} className="px-5 py-12 text-center text-[var(--ds-text-3)] text-sm font-bold">No archived bookings found.</td></tr>
            )}
            {data?.data.map(b => (
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

// ── Settings Tab ─────────────────────────────────────────────────────────────
const SETTINGS_SECTIONS = [
  { key: 'branding',  label: 'Branding',       icon: 'palette' },
  { key: 'hours',    label: 'Booking Hours',  icon: 'schedule' },
  { key: 'weekend',  label: 'Weekend',        icon: 'calendar_today' },
  { key: 'system',   label: 'System',         icon: 'settings' },
  { key: 'rules',    label: 'Booking Rules',  icon: 'rule' },
  { key: 'ghost',    label: 'Anti-Ghost',     icon: 'person_off' },
  { key: 'features', label: 'Features',       icon: 'tune' },
  { key: 'm365',     label: 'Microsoft 365',  icon: 'cloud' },
  { key: 'archive',  label: 'Archive',         icon: 'inventory_2' },
  { key: 'backup',   label: 'Auto Backup',     icon: 'backup' },
] as const
type SettingsSection = typeof SETTINGS_SECTIONS[number]['key']

function SettingsTab() {
  const queryClient = useQueryClient()
  const { addInfoToast } = useCancelToast()
  const maxDaysDebounce = useRef<ReturnType<typeof setTimeout>>()

  // Section refs + active tracking
  const secRefs = useRef<Record<SettingsSection, HTMLDivElement | null>>({ branding: null, hours: null, weekend: null, system: null, rules: null, ghost: null, features: null, m365: null, archive: null, backup: null })
  const [activeSection, setActiveSection] = useState<SettingsSection>('hours')

  useEffect(() => {
    const latest: Record<string, number> = {}
    let rafId: number
    const observers: IntersectionObserver[] = []
    SETTINGS_SECTIONS.forEach(({ key }) => {
      const el = secRefs.current[key]
      if (!el) return
      const obs = new IntersectionObserver(([entry]) => {
        latest[key] = entry.intersectionRatio
        cancelAnimationFrame(rafId)
        rafId = requestAnimationFrame(() => {
          const best = SETTINGS_SECTIONS.reduce((a, b) => (latest[b.key] ?? 0) > (latest[a.key] ?? 0) ? b : a)
          setActiveSection(best.key)
        })
      }, { threshold: [0, 0.25, 0.5, 0.75, 1] })
      obs.observe(el)
      observers.push(obs)
    })
    return () => { observers.forEach(o => o.disconnect()); cancelAnimationFrame(rafId) }
  }, [])

  function scrollTo(key: SettingsSection) {
    secRefs.current[key]?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  // Booking Hours (keep save button — destructive side effects)
  const { data: hours } = useQuery({ queryKey: ['booking-hours'], queryFn: getBookingHours })
  const [localStart, setLocalStart] = useState(hours?.start ?? '07:00')
  const [localEnd,   setLocalEnd]   = useState(hours?.end   ?? '19:00')
  const [saved, setSaved] = useState<{ trimmed: number; cancelled: number } | null>(null)
  useEffect(() => { if (hours) { setLocalStart(hours.start); setLocalEnd(hours.end) } }, [hours?.start, hours?.end])
  function toMin(hhmm: string) { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m }
  const isValid = toMin(localEnd) - toMin(localStart) >= 30
  const { mutate: saveHours, isPending: hoursPending, isError: hoursError } = useMutation({
    mutationFn: () => updateBookingHours(localStart, localEnd),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['booking-hours'] })
      setSaved({ trimmed: res.trimmed_count, cancelled: res.cancelled_count })
      setTimeout(() => setSaved(null), 6000)
    },
  })

  // Weekend — auto-save on toggle
  const { data: weekend } = useQuery({ queryKey: ['weekend-settings'], queryFn: getWeekendSettings })
  const [wkSat, setWkSat] = useState(weekend?.saturday ?? true)
  const [wkSun, setWkSun] = useState(weekend?.sunday   ?? true)
  useEffect(() => { if (weekend) { setWkSat(weekend.saturday); setWkSun(weekend.sunday) } }, [weekend?.saturday, weekend?.sunday])
  const { mutateAsync: doSaveWeekend } = useMutation({
    mutationFn: (vals: { sat: boolean; sun: boolean }) => updateWeekendSettings(vals.sat, vals.sun),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['weekend-settings'] }); addInfoToast('Weekend settings saved') },
  })
  async function toggleSat() { const v = !wkSat; setWkSat(v); await doSaveWeekend({ sat: v, sun: wkSun }) }
  async function toggleSun() { const v = !wkSun; setWkSun(v); await doSaveWeekend({ sat: wkSat, sun: v }) }

  // General — auto-save each field
  const { data: general } = useQuery({ queryKey: ['settings-general'], queryFn: getGeneralSettings })
  const [appName,      setAppName]      = useState(general?.app_name ?? 'RoomSync Pro')
  const [appFullName,  setAppFullName]  = useState(general?.app_full_name ?? '')
  const [appLogoUrl,   setAppLogoUrl]   = useState<string | null>(general?.app_logo_url ?? null)
  const [logoUploading, setLogoUploading] = useState(false)
  const logoInputRef = useRef<HTMLInputElement>(null)
  const appNameDebounce = useRef<ReturnType<typeof setTimeout>>()
  const appFullNameDebounce = useRef<ReturnType<typeof setTimeout>>()
  const [loginPhotoUrl, setLoginPhotoUrl] = useState<string | null>(general?.login_photo_url ?? null)
  const [loginPhotoUploading, setLoginPhotoUploading] = useState(false)
  const loginPhotoInputRef = useRef<HTMLInputElement>(null)
  const [loginPhotoPosX, setLoginPhotoPosX] = useState(general?.login_photo_pos_x ?? 50)
  const [loginPhotoPosY, setLoginPhotoPosY] = useState(general?.login_photo_pos_y ?? 50)
  const [loginHeadline,    setLoginHeadline]    = useState(general?.login_headline ?? 'Booking made easy')
  const [loginSubheadline, setLoginSubheadline] = useState(general?.login_subheadline ?? 'Book meeting rooms without the back-and-forth')
  const loginPhotoPosDebounce = useRef<ReturnType<typeof setTimeout>>()
  const loginHeadlineDebounce = useRef<ReturnType<typeof setTimeout>>()
  const loginSubheadlineDebounce = useRef<ReturnType<typeof setTimeout>>()

  // Microsoft 365 integration (Tenant/Client ID + Client Secret, used later for Teams/Email/Outlook Calendar)
  const { data: m365 } = useQuery({ queryKey: ['settings-m365'], queryFn: getM365Settings })
  const [m365TenantId, setM365TenantId] = useState('')
  const [m365ClientId, setM365ClientId] = useState('')
  const [m365ClientSecret, setM365ClientSecret] = useState('')
  const [m365SenderEmail, setM365SenderEmail] = useState('')
  const [m365Saving, setM365Saving] = useState(false)
  const [m365Testing, setM365Testing] = useState(false)
  const [m365TestResult, setM365TestResult] = useState<{ success: boolean; message: string } | null>(null)
  const [m365TestingEmail, setM365TestingEmail] = useState(false)
  const [m365EmailTestResult, setM365EmailTestResult] = useState<{ success: boolean; message: string } | null>(null)
  const [smtpHost, setSmtpHost] = useState('')
  const [smtpPort, setSmtpPort] = useState(587)
  const [smtpEncryption, setSmtpEncryption] = useState<'tls' | 'ssl' | 'none'>('tls')
  const [smtpUsername, setSmtpUsername] = useState('')
  const [smtpPassword, setSmtpPassword] = useState('')
  const [smtpFromName, setSmtpFromName] = useState('')
  const [smtpSaving, setSmtpSaving] = useState(false)
  const [smtpTesting, setSmtpTesting] = useState(false)
  const [smtpTestResult, setSmtpTestResult] = useState<{ success: boolean; message: string } | null>(null)
  useEffect(() => {
    if (m365) { setM365TenantId(m365.tenant_id); setM365ClientId(m365.client_id); setM365SenderEmail(m365.sender_email) }
  }, [m365?.tenant_id, m365?.client_id, m365?.sender_email])
  useEffect(() => {
    if (m365) {
      setSmtpHost(m365.smtp_host); setSmtpPort(m365.smtp_port); setSmtpEncryption(m365.smtp_encryption)
      setSmtpUsername(m365.smtp_username); setSmtpFromName(m365.smtp_from_name)
    }
  }, [m365?.smtp_host, m365?.smtp_port, m365?.smtp_encryption, m365?.smtp_username, m365?.smtp_from_name])
  async function saveSmtp() {
    setSmtpSaving(true)
    try {
      // From Address always mirrors Username — Gmail (and most SMTP providers) reject or silently
      // override a From address that doesn't match the authenticated account.
      const patch: { smtp_host: string; smtp_port: number; smtp_encryption: 'tls' | 'ssl' | 'none'; smtp_username: string; smtp_from_address: string; smtp_from_name: string; smtp_password?: string } = {
        smtp_host: smtpHost, smtp_port: smtpPort, smtp_encryption: smtpEncryption, smtp_username: smtpUsername, smtp_from_address: smtpUsername, smtp_from_name: smtpFromName,
      }
      if (smtpPassword) patch.smtp_password = smtpPassword
      await updateM365Settings(patch)
      setSmtpPassword('')
      queryClient.invalidateQueries({ queryKey: ['settings-m365'] })
      addInfoToast('SMTP settings saved')
    } catch {
      addInfoToast('Failed to save SMTP settings')
    } finally {
      setSmtpSaving(false)
    }
  }
  async function handleSendSmtpTestEmail() {
    setSmtpTesting(true)
    setSmtpTestResult(null)
    try {
      const res = await sendSmtpTestEmail()
      setSmtpTestResult(res)
    } catch (err: any) {
      setSmtpTestResult({ success: false, message: err?.response?.data?.message ?? 'Test failed — please try again.' })
    } finally {
      setSmtpTesting(false)
    }
  }
  async function saveM365() {
    setM365Saving(true)
    setM365TestResult(null)
    try {
      const patch: { tenant_id: string; client_id: string; client_secret?: string; sender_email: string } = { tenant_id: m365TenantId, client_id: m365ClientId, sender_email: m365SenderEmail }
      if (m365ClientSecret) patch.client_secret = m365ClientSecret
      await updateM365Settings(patch)
      setM365ClientSecret('')
      queryClient.invalidateQueries({ queryKey: ['settings-m365'] })
      addInfoToast('Microsoft 365 settings saved')
    } catch {
      addInfoToast('Failed to save Microsoft 365 settings')
    } finally {
      setM365Saving(false)
    }
  }
  async function handleTestM365() {
    setM365Testing(true)
    setM365TestResult(null)
    try {
      const res = await testM365Connection()
      setM365TestResult(res)
    } catch (err: any) {
      setM365TestResult({ success: false, message: err?.response?.data?.message ?? 'Test failed — please try again.' })
    } finally {
      setM365Testing(false)
    }
  }
  async function toggleM365MailEnabled() {
    const v = !m365?.mail_enabled
    try {
      await updateM365Settings({ mail_enabled: v })
      queryClient.invalidateQueries({ queryKey: ['settings-m365'] })
      addInfoToast(v ? 'App emails will now send via Microsoft 365' : 'App emails switched back to the default mailer')
    } catch {
      addInfoToast('Failed to update mail switch')
    }
  }
  async function changeMailFallbackDriver(driver: 'smtp' | 'log' | 'array') {
    try {
      await updateM365Settings({ mail_fallback_driver: driver })
      queryClient.invalidateQueries({ queryKey: ['settings-m365'] })
      addInfoToast('Fallback mailer updated')
    } catch {
      addInfoToast('Failed to update fallback mailer')
    }
  }
  async function toggleM365CalendarSync() {
    const v = !m365?.calendar_sync_enabled
    try {
      await updateM365Settings({ calendar_sync_enabled: v })
      queryClient.invalidateQueries({ queryKey: ['settings-m365'] })
      addInfoToast(v ? 'New bookings will now sync to Outlook/Teams Calendar' : 'Calendar sync turned off')
    } catch {
      addInfoToast('Failed to update calendar sync switch')
    }
  }
  async function handleSendM365TestEmail() {
    setM365TestingEmail(true)
    setM365EmailTestResult(null)
    try {
      const res = await sendM365TestEmail()
      setM365EmailTestResult(res)
    } catch (err: any) {
      setM365EmailTestResult({ success: false, message: err?.response?.data?.message ?? 'Test email failed — please try again.' })
    } finally {
      setM365TestingEmail(false)
    }
  }

  const [maxDays,      setMaxDays]      = useState(general?.max_advance_days ?? 30)
  const [allowBookFor,      setAllowBookFor]      = useState(general?.allow_book_for_others ?? true)
  const [allowPasswordChange, setAllowPasswordChange] = useState(general?.allow_password_change ?? true)
  const [allowAvatarUpload,   setAllowAvatarUpload]   = useState(general?.allow_avatar_upload   ?? true)
  const [restrictAH,   setRestrictAH]   = useState(general?.restrict_after_hours ?? false)
  const [workEnd,      setWorkEnd]      = useState(general?.working_hours_end ?? '17:00')
  const [aiChat,       setAiChat]       = useState(general?.feature_ai_chat ?? true)
  const [roomsGrid,    setRoomsGrid]    = useState(general?.rooms_grid_cols ?? 3)
  const [archiveDays,      setArchiveDays]      = useState(general?.archive_after_days ?? 30)
  const [deleteDays,       setDeleteDays]       = useState(general?.archive_delete_after_days ?? 90)
  const [antiGhostEnabled,      setAntiGhostEnabled]      = useState(general?.anti_ghost_enabled ?? false)
  const [antiGhostModes,        setAntiGhostModes]        = useState<Set<string>>(() => new Set((general?.anti_ghost_mode ?? 'kiosk').split(',').filter(Boolean)))
  const [ghostWindowBefore,     setGhostWindowBefore]     = useState(general?.anti_ghost_window_before ?? 5)
  const [ghostWindowAfter,      setGhostWindowAfter]      = useState(general?.anti_ghost_window_after ?? 10)
  const [webConfirmEnabled,     setWebConfirmEnabled]      = useState(general?.web_confirm_enabled ?? false)
  const [businessTz,            setBusinessTz]             = useState(general?.business_timezone ?? 'Asia/Jakarta')
  const ghostWindowBeforeDebounce = useRef<ReturnType<typeof setTimeout>>()
  const ghostWindowAfterDebounce  = useRef<ReturnType<typeof setTimeout>>()
  const archiveDaysDebounce    = useRef<ReturnType<typeof setTimeout>>()
  const deleteDaysDebounce     = useRef<ReturnType<typeof setTimeout>>()
  const tzDebounce             = useRef<ReturnType<typeof setTimeout>>()
  useEffect(() => {
    if (general) {
      setAppName(general.app_name ?? 'RoomSync Pro')
      setAppFullName(general.app_full_name ?? '')
      setAppLogoUrl(general.app_logo_url ?? null)
      setLoginPhotoUrl(general.login_photo_url ?? null)
      setLoginPhotoPosX(general.login_photo_pos_x ?? 50)
      setLoginPhotoPosY(general.login_photo_pos_y ?? 50)
      setLoginHeadline(general.login_headline ?? 'Booking made easy')
      setLoginSubheadline(general.login_subheadline ?? 'Book meeting rooms without the back-and-forth')
      setMaxDays(general.max_advance_days); setAllowBookFor(general.allow_book_for_others)
      setAllowPasswordChange(general.allow_password_change ?? true)
      setAllowAvatarUpload(general.allow_avatar_upload ?? true)
      setRestrictAH(general.restrict_after_hours); setWorkEnd(general.working_hours_end)
      setAiChat(general.feature_ai_chat); setRoomsGrid(general.rooms_grid_cols)
      setArchiveDays(general.archive_after_days); setDeleteDays(general.archive_delete_after_days)
      setAntiGhostEnabled(general.anti_ghost_enabled ?? false)
      setAntiGhostModes(new Set((general.anti_ghost_mode ?? 'kiosk').split(',').filter(Boolean)))
      setGhostWindowBefore(general.anti_ghost_window_before ?? 5)
      setGhostWindowAfter(general.anti_ghost_window_after ?? 10)
      setWebConfirmEnabled(general.web_confirm_enabled ?? false)
      setBusinessTz(general.business_timezone ?? 'Asia/Jakarta')
    }
  }, [general?.max_advance_days, general?.allow_book_for_others, general?.allow_password_change, general?.restrict_after_hours, general?.working_hours_end, general?.feature_ai_chat, general?.rooms_grid_cols, general?.archive_after_days, general?.archive_delete_after_days, general?.anti_ghost_enabled, general?.anti_ghost_mode, general?.anti_ghost_window_before, general?.anti_ghost_window_after, general?.web_confirm_enabled, general?.business_timezone, general?.app_name, general?.app_full_name, general?.app_logo_url, general?.login_photo_url, general?.login_photo_pos_x, general?.login_photo_pos_y, general?.login_headline, general?.login_subheadline])

  const { mutateAsync: doSaveGeneral } = useMutation({
    mutationFn: (patch: Parameters<typeof updateGeneralSettings>[0]) => updateGeneralSettings(patch),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['settings-general'] }),
  })
  async function saveGeneral(patch: Parameters<typeof updateGeneralSettings>[0], msg: string) {
    await doSaveGeneral(patch)
    addInfoToast(msg)
  }
  function onAppNameChange(v: string) {
    setAppName(v)
    clearTimeout(appNameDebounce.current)
    appNameDebounce.current = setTimeout(() => saveGeneral({ app_name: v }, `App name set to "${v}"`), 800)
  }
  function onAppFullNameChange(v: string) {
    setAppFullName(v)
    clearTimeout(appFullNameDebounce.current)
    appFullNameDebounce.current = setTimeout(() => saveGeneral({ app_full_name: v }, v ? `App full name set to "${v}"` : 'App full name cleared'), 800)
  }
  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setLogoUploading(true)
    try {
      const res = await uploadAppLogo(file)
      setAppLogoUrl(res.app_logo_url)
      queryClient.invalidateQueries({ queryKey: ['settings-general'] })
      addInfoToast('App logo updated')
    } catch {
      addInfoToast('Logo upload failed')
    } finally {
      setLogoUploading(false)
      if (logoInputRef.current) logoInputRef.current.value = ''
    }
  }
  async function handleDeleteLogo() {
    await deleteAppLogo()
    setAppLogoUrl(null)
    queryClient.invalidateQueries({ queryKey: ['settings-general'] })
    addInfoToast('App logo removed')
  }
  async function handleLoginPhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setLoginPhotoUploading(true)
    try {
      const res = await uploadLoginPhoto(file)
      setLoginPhotoUrl(res.login_photo_url)
      queryClient.invalidateQueries({ queryKey: ['settings-general'] })
      addInfoToast('Login page photo updated')
    } catch {
      addInfoToast('Photo upload failed')
    } finally {
      setLoginPhotoUploading(false)
      if (loginPhotoInputRef.current) loginPhotoInputRef.current.value = ''
    }
  }
  async function handleDeleteLoginPhoto() {
    await deleteLoginPhoto()
    setLoginPhotoUrl(null)
    queryClient.invalidateQueries({ queryKey: ['settings-general'] })
    addInfoToast('Login page photo removed')
  }
  function onLoginPhotoPosChange(axis: 'x' | 'y', v: number) {
    if (axis === 'x') setLoginPhotoPosX(v); else setLoginPhotoPosY(v)
    clearTimeout(loginPhotoPosDebounce.current)
    loginPhotoPosDebounce.current = setTimeout(() => {
      saveGeneral(
        axis === 'x' ? { login_photo_pos_x: v } : { login_photo_pos_y: v },
        'Login photo position updated'
      )
    }, 500)
  }
  function onLoginHeadlineChange(v: string) {
    setLoginHeadline(v)
    clearTimeout(loginHeadlineDebounce.current)
    loginHeadlineDebounce.current = setTimeout(() => saveGeneral({ login_headline: v }, 'Login headline updated'), 800)
  }
  function onLoginSubheadlineChange(v: string) {
    setLoginSubheadline(v)
    clearTimeout(loginSubheadlineDebounce.current)
    loginSubheadlineDebounce.current = setTimeout(() => saveGeneral({ login_subheadline: v }, 'Login subheadline updated'), 800)
  }
  async function toggleAllowBookFor()        { const v = !allowBookFor;       setAllowBookFor(v);       await saveGeneral({ allow_book_for_others: v },    v ? 'Book for others enabled' : 'Book for others disabled') }
  async function toggleAllowPasswordChange() { const v = !allowPasswordChange; setAllowPasswordChange(v); await saveGeneral({ allow_password_change: v }, v ? 'Password change enabled' : 'Password change disabled') }
  async function toggleAllowAvatarUpload()   { const v = !allowAvatarUpload;   setAllowAvatarUpload(v);   await saveGeneral({ allow_avatar_upload: v },   v ? 'Avatar upload enabled' : 'Avatar upload disabled') }
  async function toggleRestrictAH()  { const v = !restrictAH;   setRestrictAH(v);   await saveGeneral({ restrict_after_hours: v }, v ? 'After-hours restriction enabled' : 'After-hours restriction disabled') }
  async function toggleAiChat()      { const v = !aiChat;       setAiChat(v);       await saveGeneral({ feature_ai_chat: v }, v ? 'AI Chat enabled' : 'AI Chat disabled') }
  async function setRoomsGridCols(v: number) { setRoomsGrid(v); await saveGeneral({ rooms_grid_cols: v }, `Rooms grid set to ${v} columns`) }
  function onArchiveDaysChange(v: number) {
    setArchiveDays(v)
    clearTimeout(archiveDaysDebounce.current)
    archiveDaysDebounce.current = setTimeout(() => saveGeneral({ archive_after_days: v }, `Archive after ${v} days`), 800)
  }
  function onDeleteDaysChange(v: number) {
    setDeleteDays(v)
    clearTimeout(deleteDaysDebounce.current)
    deleteDaysDebounce.current = setTimeout(() => saveGeneral({ archive_delete_after_days: v }, `Auto-delete archive after ${v} days`), 800)
  }
  async function onWorkEndChange(v: string) { setWorkEnd(v); await saveGeneral({ working_hours_end: v }, `Working hours end set to ${v}`) }
  function onMaxDaysChange(v: number) {
    setMaxDays(v)
    clearTimeout(maxDaysDebounce.current)
    maxDaysDebounce.current = setTimeout(() => saveGeneral({ max_advance_days: v }, `Max advance booking set to ${v} days`), 800)
  }
  async function toggleAntiGhost() {
    const v = !antiGhostEnabled
    setAntiGhostEnabled(v)
    if (v) {
      // Re-enabling: if no methods selected, auto-pick web confirm as safe default
      const noMethods = antiGhostModes.size === 0 && !webConfirmEnabled
      if (noMethods) {
        setWebConfirmEnabled(true)
        await saveGeneral({ anti_ghost_enabled: true, web_confirm_enabled: true }, 'Anti-ghost enabled (web confirm auto-selected)')
      } else {
        await saveGeneral({ anti_ghost_enabled: true }, 'Anti-ghost booking enabled')
      }
    } else {
      await saveGeneral({ anti_ghost_enabled: false }, 'Anti-ghost booking disabled')
    }
  }
  async function toggleMethod(key: 'kiosk' | 'sensor' | 'web') {
    if (key === 'web') {
      const newVal = !webConfirmEnabled
      const anyLeft = newVal || antiGhostModes.has('kiosk') || antiGhostModes.has('sensor')
      if (!anyLeft) {
        setWebConfirmEnabled(false)
        setAntiGhostEnabled(false)
        await saveGeneral({ web_confirm_enabled: false, anti_ghost_enabled: false }, 'Anti-ghost disabled (no method selected)')
      } else {
        setWebConfirmEnabled(newVal)
        await saveGeneral({ web_confirm_enabled: newVal }, newVal ? 'Web confirm enabled' : 'Web confirm disabled')
      }
    } else {
      const next = new Set(antiGhostModes)
      if (next.has(key)) next.delete(key); else next.add(key)
      const anyLeft = next.size > 0 || webConfirmEnabled
      if (!anyLeft) {
        setAntiGhostModes(new Set())
        setAntiGhostEnabled(false)
        await saveGeneral({ anti_ghost_mode: '', anti_ghost_enabled: false }, 'Anti-ghost disabled (no method selected)')
      } else {
        setAntiGhostModes(next)
        await saveGeneral({ anti_ghost_mode: [...next].sort().join(',') }, `Anti-ghost mode: ${[...next].sort().join(', ')}`)
      }
    }
  }
  function onGhostWindowBeforeChange(v: number) {
    const clamped = Math.max(0, Math.min(20, v))
    setGhostWindowBefore(clamped)
    clearTimeout(ghostWindowBeforeDebounce.current)
    ghostWindowBeforeDebounce.current = setTimeout(() => saveGeneral({ anti_ghost_window_before: clamped }, `Confirm window: opens ${clamped}min before start`), 800)
  }
  function onGhostWindowAfterChange(v: number) {
    const clamped = Math.max(0, Math.min(20, v))
    setGhostWindowAfter(clamped)
    clearTimeout(ghostWindowAfterDebounce.current)
    ghostWindowAfterDebounce.current = setTimeout(() => saveGeneral({ anti_ghost_window_after: clamped }, `Confirm window: closes ${clamped}min after start`), 800)
  }
  async function toggleWebConfirm() { const v = !webConfirmEnabled; setWebConfirmEnabled(v); await saveGeneral({ web_confirm_enabled: v }, v ? 'Web presence confirm enabled' : 'Web presence confirm disabled') }

  function onBusinessTzChange(v: string) {
    setBusinessTz(v)
    clearTimeout(tzDebounce.current)
    tzDebounce.current = setTimeout(() => saveGeneral({ business_timezone: v }, `Business timezone set to ${v}`), 800)
  }

  // Auto Backup — one bundled batch (archive, activity log, users/buildings/rooms), single schedule
  const [backupEnabled,       setBackupEnabled]       = useState(general?.backup_enabled ?? false)
  const [backupFrequency,     setBackupFrequency]     = useState(general?.backup_frequency ?? 'weekly')
  const [backupTime,          setBackupTime]          = useState(general?.backup_time ?? '02:00')
  const [backupDow,           setBackupDow]           = useState(general?.backup_day_of_week ?? 1)
  const [backupDom,           setBackupDom]           = useState(general?.backup_day_of_month ?? 1)
  const [backupFormats,       setBackupFormats]       = useState<string[]>((general?.backup_formats ?? 'excel,csv').split(',').filter(Boolean))
  const [backupIncludeArchive, setBackupIncludeArchive] = useState(general?.backup_include_archive ?? true)
  const [backupIncludeLog,     setBackupIncludeLog]     = useState(general?.backup_include_log ?? true)
  const [backupIncludeData,    setBackupIncludeData]    = useState(general?.backup_include_data ?? true)
  useEffect(() => {
    if (general) {
      setBackupEnabled(general.backup_enabled ?? false)
      setBackupFrequency(general.backup_frequency ?? 'weekly')
      setBackupTime(general.backup_time ?? '02:00')
      setBackupDow(general.backup_day_of_week ?? 1)
      setBackupDom(general.backup_day_of_month ?? 1)
      setBackupFormats((general.backup_formats ?? 'excel,csv').split(',').filter(Boolean))
      setBackupIncludeArchive(general.backup_include_archive ?? true)
      setBackupIncludeLog(general.backup_include_log ?? true)
      setBackupIncludeData(general.backup_include_data ?? true)
    }
  }, [general?.backup_enabled, general?.backup_frequency, general?.backup_time, general?.backup_day_of_week, general?.backup_day_of_month, general?.backup_formats, general?.backup_include_archive, general?.backup_include_log, general?.backup_include_data])
  async function toggleBackupEnabled() { const v = !backupEnabled; setBackupEnabled(v); await saveGeneral({ backup_enabled: v }, v ? 'Auto backup enabled' : 'Auto backup disabled') }
  async function onBackupFrequencyChange(v: string) { setBackupFrequency(v); await saveGeneral({ backup_frequency: v }, `Backup frequency: ${v}`) }
  async function onBackupTimeChange(v: string) { setBackupTime(v); await saveGeneral({ backup_time: v }, `Backup time set to ${v}`) }
  async function onBackupDowChange(v: number) { setBackupDow(v); await saveGeneral({ backup_day_of_week: v }, 'Backup day updated') }
  async function onBackupDomChange(v: number) { setBackupDom(v); await saveGeneral({ backup_day_of_month: v }, 'Backup day updated') }
  async function toggleBackupFormat(fmt: string) {
    const next = backupFormats.includes(fmt) ? backupFormats.filter(f => f !== fmt) : [...backupFormats, fmt]
    if (!next.length) return
    setBackupFormats(next)
    await saveGeneral({ backup_formats: next.join(',') }, `Backup formats: ${next.join(', ')}`)
  }
  async function toggleBackupInclude(key: 'archive' | 'log' | 'data') {
    const cur = { archive: backupIncludeArchive, log: backupIncludeLog, data: backupIncludeData }
    const next = !cur[key]
    const wouldBeEmpty = !next && !Object.entries(cur).filter(([k]) => k !== key).some(([, v]) => v)
    if (wouldBeEmpty) return
    if (key === 'archive') setBackupIncludeArchive(next)
    if (key === 'log')     setBackupIncludeLog(next)
    if (key === 'data')    setBackupIncludeData(next)
    const settingKey = key === 'archive' ? 'backup_include_archive' : key === 'log' ? 'backup_include_log' : 'backup_include_data'
    const label = key === 'archive' ? 'Bookings archive' : key === 'log' ? 'Activity log' : 'Users/Buildings/Rooms'
    await saveGeneral({ [settingKey]: next }, `${label} ${next ? 'included' : 'excluded'} in backup`)
  }

  const { data: backupExports = [] } = useQuery({
    queryKey: ['backup-exports'],
    queryFn: listBackupExports,
    staleTime: 30_000,
  })
  const { mutate: doBackupNow, isPending: backupRunning } = useMutation({
    mutationFn: () => runBackupExport(backupFormats.length ? backupFormats : ['excel', 'csv'], { archive: backupIncludeArchive, log: backupIncludeLog, data: backupIncludeData }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['backup-exports'] })
      addInfoToast(`Backup generated: ${res.files} file${res.files !== 1 ? 's' : ''} saved to server`)
    },
  })
  const [deleteBackupsConfirm, setDeleteBackupsConfirm] = useState(false)
  const [deleteBackupsInput,   setDeleteBackupsInput]   = useState('')
  const [deletingBackups,      setDeletingBackups]      = useState(false)
  async function doDeleteAllBackups() {
    setDeletingBackups(true)
    try {
      const res = await deleteAllBackupExports()
      queryClient.invalidateQueries({ queryKey: ['backup-exports'] })
      addInfoToast(`${res.deleted} backup batch${res.deleted !== 1 ? 'es' : ''} deleted`)
      setDeleteBackupsConfirm(false)
      setDeleteBackupsInput('')
    } catch {
      addInfoToast('Delete failed')
    } finally {
      setDeletingBackups(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[9px] font-black uppercase tracking-[0.25em] text-[var(--ds-text-3)] mb-1">Admin Dashboard</p>
        <h1 className="text-3xl font-black italic tracking-tighter uppercase">Settings</h1>
      </div>

      <div className="flex gap-8 items-start">

      {/* ── Main sections ── */}
      <div className="flex-1 min-w-0 max-w-2xl space-y-6 pb-32">

      {/* Branding */}
      <div ref={el => { secRefs.current.branding = el }} className="bg-[var(--ds-bg-surface)] rounded-2xl border border-[var(--ds-border-sub)] p-6 space-y-6">
        <div>
          <p className="text-[13px] font-black uppercase tracking-wider text-[var(--ds-text-1)]">Branding</p>
          <p className="text-[12px] text-[var(--ds-text-3)] mt-0.5">Customize the app name and logo shown in the navbar and throughout the app.</p>
        </div>

        {/* App Name */}
        <div className="space-y-2">
          <label className="text-[9px] font-black uppercase tracking-widest text-[var(--ds-text-3)] px-1">App Name</label>
          <input
            type="text"
            value={appName}
            onChange={e => onAppNameChange(e.target.value)}
            maxLength={100}
            className="w-full bg-[var(--ds-bg-raised)] border border-[var(--ds-border)] rounded-xl px-4 py-2.5 text-[14px] font-black text-[var(--ds-text-1)] focus:outline-none focus:ring-2 focus:ring-[#adee2b] transition-all"
            placeholder="RoomSync Pro"
          />
          <p className="text-[10px] text-[var(--ds-text-3)] px-1">Auto-saved. Updates navbar, page title, and all app references.</p>
        </div>

        {/* App Full Name */}
        <div className="space-y-2">
          <label className="text-[9px] font-black uppercase tracking-widest text-[var(--ds-text-3)] px-1">App Full Name (optional)</label>
          <input
            type="text"
            value={appFullName}
            onChange={e => onAppFullNameChange(e.target.value)}
            maxLength={150}
            className="w-full bg-[var(--ds-bg-raised)] border border-[var(--ds-border)] rounded-xl px-4 py-2.5 text-[14px] font-semibold text-[var(--ds-text-1)] focus:outline-none focus:ring-2 focus:ring-[#adee2b] transition-all"
            placeholder="e.g. Meeting Room Booking System"
          />
          <p className="text-[10px] text-[var(--ds-text-3)] px-1">Shown as a subtitle next to the app name on the login page. Leave empty to hide it.</p>
        </div>

        {/* Logo Upload */}
        <div className="space-y-2">
          <label className="text-[9px] font-black uppercase tracking-widest text-[var(--ds-text-3)] px-1">Navbar Logo</label>
          {appLogoUrl ? (
            <div className="flex items-center gap-4">
              <div className="h-16 min-w-16 max-w-[220px] rounded-2xl overflow-hidden bg-white flex items-center justify-center shrink-0 px-2">
                <img src={appLogoUrl} alt="App logo" className="h-full w-auto max-w-[204px] object-contain" />
              </div>
              <div className="space-y-2">
                <p className="text-[12px] font-semibold text-[var(--ds-text-2)]">Custom logo active</p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => logoInputRef.current?.click()}
                    disabled={logoUploading}
                    className="px-3 py-1.5 text-[10px] font-black uppercase rounded-lg bg-[var(--ds-bg-raised)] border border-[var(--ds-border)] text-[var(--ds-text-2)] hover:border-[#adee2b] transition-all disabled:opacity-50"
                  >
                    Replace
                  </button>
                  <button
                    type="button"
                    onClick={handleDeleteLogo}
                    disabled={logoUploading}
                    className="px-3 py-1.5 text-[10px] font-black uppercase rounded-lg bg-red-500/10 border border-red-500/20 text-red-500 hover:bg-red-500/20 transition-all disabled:opacity-50"
                  >
                    Remove
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <label htmlFor="app-logo-upload-input" className="flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed cursor-pointer transition-all hover:border-[#adee2b] hover:bg-[#adee2b]/5"
              style={{ borderColor: 'var(--ds-border)', minHeight: 100 }}>
              {logoUploading
                ? <span className="text-[12px] font-semibold text-[var(--ds-text-3)]">Uploading...</span>
                : <>
                  <span className="material-symbols-outlined text-[var(--ds-text-3)]" style={{ fontSize: 28 }}>add_photo_alternate</span>
                  <span className="text-[11px] font-black text-[var(--ds-text-3)] uppercase tracking-wide">Click to upload logo</span>
                  <span className="text-[9px] text-[var(--ds-text-4)]">PNG, SVG, JPG · max 8 MB · square or rectangular</span>
                </>
              }
            </label>
          )}
          <input id="app-logo-upload-input" ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
          <p className="text-[10px] text-[var(--ds-text-3)] px-1">Appears in the navbar. Square or rectangular images both work (logo fits a 36px-tall slot, up to 160px wide). Leave empty to use the default icon.</p>
        </div>

        {/* Login Page */}
        <div className="space-y-3 pt-2 border-t" style={{ borderColor: 'var(--ds-border-sub)' }}>
          <div className="pt-3">
            <label className="text-[9px] font-black uppercase tracking-widest text-[var(--ds-text-3)] px-1">Login Page</label>
            <p className="text-[12px] text-[var(--ds-text-3)] mt-0.5">Customize the photo and copy shown on the left panel of the login screen.</p>
          </div>

          <div className="flex flex-col sm:flex-row gap-5">
            {/* Live preview */}
            <div className="shrink-0 mx-auto sm:mx-0">
              <div
                className="w-[200px] aspect-[4/5] rounded-2xl overflow-hidden relative border"
                style={{
                  borderColor: 'var(--ds-border)',
                  backgroundImage: loginPhotoUrl
                    ? `linear-gradient(180deg, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0.8) 100%), url(${loginPhotoUrl})`
                    : 'radial-gradient(130% 130% at 15% 10%, #1a1f08 0%, #0c0c0c 55%, #000 100%)',
                  backgroundSize: 'cover',
                  backgroundPosition: loginPhotoUrl ? `${loginPhotoPosX}% ${loginPhotoPosY}%` : 'center',
                }}
              >
                <div className="absolute inset-0 p-3.5 flex flex-col justify-end">
                  <div>
                    <p className="text-[6.5px] font-black uppercase tracking-[0.2em] text-[#adee2b] mb-1 truncate">{loginHeadline || 'Booking made easy'}</p>
                    <p className="text-[9.5px] font-black italic uppercase leading-snug text-white line-clamp-3">{loginSubheadline || 'Book meeting rooms without the back-and-forth'}</p>
                  </div>
                </div>
              </div>
              <p className="text-[9px] text-[var(--ds-text-4)] text-center mt-1.5">Live preview</p>
            </div>

            {/* Controls */}
            <div className="flex-1 space-y-4 min-w-0">
              {/* Photo upload */}
              {loginPhotoUrl ? (
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-[12px] font-semibold text-[var(--ds-text-2)] flex-1 min-w-[120px]">Custom photo active</p>
                  <button
                    type="button"
                    onClick={() => loginPhotoInputRef.current?.click()}
                    disabled={loginPhotoUploading}
                    className="px-3 py-1.5 text-[10px] font-black uppercase rounded-lg bg-[var(--ds-bg-raised)] border border-[var(--ds-border)] text-[var(--ds-text-2)] hover:border-[#adee2b] transition-all disabled:opacity-50"
                  >
                    Replace
                  </button>
                  <button
                    type="button"
                    onClick={handleDeleteLoginPhoto}
                    disabled={loginPhotoUploading}
                    className="px-3 py-1.5 text-[10px] font-black uppercase rounded-lg bg-red-500/10 border border-red-500/20 text-red-500 hover:bg-red-500/20 transition-all disabled:opacity-50"
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <label htmlFor="login-photo-upload-input" className="flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed cursor-pointer transition-all hover:border-[#adee2b] hover:bg-[#adee2b]/5"
                  style={{ borderColor: 'var(--ds-border)', minHeight: 90 }}>
                  {loginPhotoUploading
                    ? <span className="text-[12px] font-semibold text-[var(--ds-text-3)]">Uploading...</span>
                    : <>
                      <span className="material-symbols-outlined text-[var(--ds-text-3)]" style={{ fontSize: 24 }}>add_photo_alternate</span>
                      <span className="text-[11px] font-black text-[var(--ds-text-3)] uppercase tracking-wide">Click to upload photo</span>
                      <span className="text-[9px] text-[var(--ds-text-4)]">JPG or PNG · max 8 MB · any aspect ratio</span>
                    </>
                  }
                </label>
              )}
              <input id="login-photo-upload-input" ref={loginPhotoInputRef} type="file" accept="image/*" className="hidden" onChange={handleLoginPhotoUpload} />

              {/* Position adjustment */}
              {loginPhotoUrl && (
                <div className="space-y-2">
                  <label className="text-[9px] font-black uppercase tracking-widest text-[var(--ds-text-3)] px-1">Photo Position (fits the frame)</label>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-[var(--ds-text-3)] w-14 shrink-0">Horizontal</span>
                    <input type="range" min={0} max={100} value={loginPhotoPosX} onChange={e => onLoginPhotoPosChange('x', Number(e.target.value))} className="flex-1 accent-[#adee2b]" />
                    <span className="text-[10px] font-bold text-[var(--ds-text-3)] w-8 text-right">{loginPhotoPosX}%</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-[var(--ds-text-3)] w-14 shrink-0">Vertical</span>
                    <input type="range" min={0} max={100} value={loginPhotoPosY} onChange={e => onLoginPhotoPosChange('y', Number(e.target.value))} className="flex-1 accent-[#adee2b]" />
                    <span className="text-[10px] font-bold text-[var(--ds-text-3)] w-8 text-right">{loginPhotoPosY}%</span>
                  </div>
                </div>
              )}

              {/* Copy */}
              <div className="space-y-1.5">
                <label className="text-[9px] font-black uppercase text-[var(--ds-text-3)] tracking-wider px-1">Small headline</label>
                <input
                  type="text"
                  value={loginHeadline}
                  onChange={e => onLoginHeadlineChange(e.target.value)}
                  maxLength={120}
                  className="w-full bg-[var(--ds-bg-raised)] border border-[var(--ds-border)] rounded-xl px-3 py-2 text-sm font-semibold text-[var(--ds-text-1)] focus:outline-none focus:ring-2 focus:ring-[#adee2b]"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[9px] font-black uppercase text-[var(--ds-text-3)] tracking-wider px-1">Headline</label>
                <textarea
                  value={loginSubheadline}
                  onChange={e => onLoginSubheadlineChange(e.target.value)}
                  maxLength={200}
                  rows={2}
                  className="w-full bg-[var(--ds-bg-raised)] border border-[var(--ds-border)] rounded-xl px-3 py-2 text-sm font-semibold text-[var(--ds-text-1)] focus:outline-none focus:ring-2 focus:ring-[#adee2b] resize-none"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Favicon guide */}
        <div className="rounded-xl p-4 space-y-2" style={{ background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.15)' }}>
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined" style={{ fontSize: 16, color: '#6366f1' }}>info</span>
            <p className="text-[11px] font-black uppercase tracking-wider" style={{ color: '#6366f1' }}>Changing the Favicon (Browser Tab Icon)</p>
          </div>
          <p className="text-[11px] text-[var(--ds-text-2)] leading-relaxed">The browser tab icon is bundled at build time and cannot be changed here. To update it:</p>
          <ol className="text-[11px] text-[var(--ds-text-2)] leading-relaxed list-decimal list-inside space-y-1">
            <li>Prepare a square icon (32×32 or 64×64 px) in <strong>SVG or PNG</strong> format.</li>
            <li>Rename it to <code className="bg-black/10 dark:bg-white/10 px-1 rounded text-[10px]">favicon.svg</code>.</li>
            <li>Replace the file at <code className="bg-black/10 dark:bg-white/10 px-1 rounded text-[10px]">client/public/favicon.svg</code>.</li>
            <li>Rebuild the frontend (<code className="bg-black/10 dark:bg-white/10 px-1 rounded text-[10px]">npm run build</code>) for the change to take effect.</li>
          </ol>
        </div>
      </div>

      {/* Booking Hours — keep save button (destructive) */}
      <div ref={el => { secRefs.current.hours = el }} className="bg-[var(--ds-bg-surface)] rounded-2xl border border-[var(--ds-border-sub)] p-6 space-y-5">
        <div>
          <p className="text-[13px] font-black uppercase tracking-wider text-[var(--ds-text-1)]">Booking Hours</p>
          <p className="text-[12px] text-[var(--ds-text-3)] mt-0.5">Set the global time window during which rooms can be booked.</p>
        </div>
        <div className="p-3.5 rounded-xl text-[10px] font-semibold leading-relaxed" style={{ background: 'rgba(217,119,6,0.10)', border: '1px solid rgba(217,119,6,0.25)', color: '#f59e0b' }}>
          <span className="font-black">Warning:</span> Tightening these hours will automatically trim or cancel existing future bookings that fall outside the new window.
        </div>
        <div className="flex items-end gap-4">
          <div className="space-y-1.5">
            <label className="text-[9px] font-black uppercase text-[var(--ds-text-3)] tracking-wider px-1">Start Time</label>
            <GlassTimePicker value={localStart} onChange={setLocalStart} min="00:00" max="23:00" step={30} panelWidth={140}>
              {() => (<button type="button" className="flex items-center gap-2 bg-[var(--ds-bg-raised)] border border-[var(--ds-border)] rounded-xl text-[13px] font-black px-4 py-2.5 hover:border-[#adee2b] transition-all tabular-nums text-[var(--ds-text-1)]"><span className="material-symbols-outlined text-[var(--ds-text-3)]" style={{ fontSize: 16 }}>schedule</span>{localStart}</button>)}
            </GlassTimePicker>
          </div>
          <span className="text-[var(--ds-text-3)] text-lg font-black pb-2.5">→</span>
          <div className="space-y-1.5">
            <label className="text-[9px] font-black uppercase text-[var(--ds-text-3)] tracking-wider px-1">End Time</label>
            <GlassTimePicker value={localEnd} onChange={setLocalEnd} min="00:30" max="23:30" step={30} panelWidth={140}>
              {() => (<button type="button" className="flex items-center gap-2 bg-[var(--ds-bg-raised)] border border-[var(--ds-border)] rounded-xl text-[13px] font-black px-4 py-2.5 hover:border-[#adee2b] transition-all tabular-nums text-[var(--ds-text-1)]"><span className="material-symbols-outlined text-[var(--ds-text-3)]" style={{ fontSize: 16 }}>schedule</span>{localEnd}</button>)}
            </GlassTimePicker>
          </div>
        </div>
        {!isValid && <p className="text-[10px] text-red-500 font-semibold">End time must be at least 30 minutes after start time.</p>}
        {hoursError && <p className="text-[10px] text-red-500 font-semibold">Failed to save. Please try again.</p>}
        {saved && (
          <div className="p-3 bg-[#f0ffe0] border border-[#adee2b] rounded-xl text-[10px] font-semibold text-[var(--ds-text-1)]">
            Saved. {saved.trimmed > 0 && <span>{saved.trimmed} booking{saved.trimmed !== 1 ? 's' : ''} trimmed. </span>}
            {saved.cancelled > 0 && <span>{saved.cancelled} booking{saved.cancelled !== 1 ? 's' : ''} cancelled.</span>}
            {saved.trimmed === 0 && saved.cancelled === 0 && <span>No existing bookings were affected.</span>}
          </div>
        )}
        <button type="button" onClick={() => saveHours()} disabled={!isValid || hoursPending}
          className="px-5 py-2.5 bg-black text-[#adee2b] text-[10px] font-black uppercase rounded-xl hover:opacity-80 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed">
          {hoursPending ? 'Saving...' : 'Save Changes'}
        </button>
      </div>

      {/* Weekend — auto-save */}
      <div ref={el => { secRefs.current.weekend = el }} className="bg-[var(--ds-bg-surface)] rounded-2xl border border-[var(--ds-border-sub)] p-6 space-y-5">
        <div>
          <p className="text-[13px] font-black uppercase tracking-wider text-[var(--ds-text-1)]">Weekend (Red Dates)</p>
          <p className="text-[12px] text-[var(--ds-text-3)] mt-0.5">Mark Saturday and/or Sunday as weekend days — shown in red on all calendars.</p>
        </div>
        <div className="space-y-3">
          {([{ label: 'Saturday', val: wkSat, toggle: toggleSat }, { label: 'Sunday', val: wkSun, toggle: toggleSun }] as const).map(({ label, val, toggle }, i) => (
            <div key={label}>
              {i > 0 && <div className="border-t border-[var(--ds-border-sub)] mb-3" />}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="size-10 rounded-2xl flex items-center justify-center" style={{ background: val ? 'rgba(239,68,68,0.1)' : 'rgba(0,0,0,0.04)' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 20, color: val ? '#ef4444' : '#94a3b8' }}>calendar_today</span>
                  </div>
                  <div>
                    <p className="text-[14px] font-black text-[var(--ds-text-1)]">{label}</p>
                    <p className="text-[11px] text-[var(--ds-text-3)] font-bold uppercase tracking-wider">{val ? 'Shown as red / weekend' : 'Regular day'}</p>
                  </div>
                </div>
                <button type="button" onClick={toggle} className="relative shrink-0" style={{ width: 44, height: 24 }}>
                  <div className="absolute inset-0 rounded-full transition-colors" style={{ background: val ? '#ef4444' : 'var(--ds-bg-raised)' }} />
                  <div className="absolute top-1 transition-all rounded-full shadow-sm" style={{ width: 16, height: 16, left: val ? 24 : 4, background: 'var(--ds-bg-surface)' }} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* System — auto-save */}
      <div ref={el => { secRefs.current.system = el }} className="bg-[var(--ds-bg-surface)] rounded-2xl border border-[var(--ds-border-sub)] p-6 space-y-5">
        <div>
          <p className="text-[13px] font-black uppercase tracking-wider text-[var(--ds-text-1)]">System</p>
          <p className="text-[12px] text-[var(--ds-text-3)] mt-0.5">Core runtime configuration for the application.</p>
        </div>

        {/* Business Timezone */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(99,102,241,0.1)' }}>
              <span className="material-symbols-outlined" style={{ fontSize: 20, color: '#6366f1' }}>schedule</span>
            </div>
            <div>
              <p className="text-[14px] font-black text-[var(--ds-text-1)]">Business Timezone</p>
              <p className="text-[11px] text-[var(--ds-text-3)] font-bold uppercase tracking-wider">Used for booking logic, schedules &amp; exports</p>
            </div>
          </div>
          <select value={businessTz} onChange={e => onBusinessTzChange(e.target.value)}
            className="text-[13px] font-bold bg-[var(--ds-bg-raised)] border border-[var(--ds-border)] rounded-xl px-3 py-2 focus:ring-2 focus:ring-[#adee2b] focus:outline-none text-[var(--ds-text-1)]">
            <optgroup label="Asia — Indonesia">
              <option value="Asia/Jakarta">Asia/Jakarta (WIB, UTC+7)</option>
              <option value="Asia/Makassar">Asia/Makassar (WITA, UTC+8)</option>
              <option value="Asia/Jayapura">Asia/Jayapura (WIT, UTC+9)</option>
            </optgroup>
            <optgroup label="Asia — Southeast">
              <option value="Asia/Singapore">Asia/Singapore (SGT, UTC+8)</option>
              <option value="Asia/Kuala_Lumpur">Asia/Kuala_Lumpur (MYT, UTC+8)</option>
              <option value="Asia/Bangkok">Asia/Bangkok (ICT, UTC+7)</option>
              <option value="Asia/Manila">Asia/Manila (PHT, UTC+8)</option>
              <option value="Asia/Ho_Chi_Minh">Asia/Ho_Chi_Minh (ICT, UTC+7)</option>
            </optgroup>
            <optgroup label="Asia — East">
              <option value="Asia/Tokyo">Asia/Tokyo (JST, UTC+9)</option>
              <option value="Asia/Seoul">Asia/Seoul (KST, UTC+9)</option>
              <option value="Asia/Shanghai">Asia/Shanghai (CST, UTC+8)</option>
              <option value="Asia/Hong_Kong">Asia/Hong_Kong (HKT, UTC+8)</option>
            </optgroup>
            <optgroup label="Asia — South &amp; West">
              <option value="Asia/Kolkata">Asia/Kolkata (IST, UTC+5:30)</option>
              <option value="Asia/Dubai">Asia/Dubai (GST, UTC+4)</option>
              <option value="Asia/Riyadh">Asia/Riyadh (AST, UTC+3)</option>
            </optgroup>
            <optgroup label="Europe">
              <option value="Europe/London">Europe/London (GMT/BST)</option>
              <option value="Europe/Paris">Europe/Paris (CET, UTC+1)</option>
            </optgroup>
            <optgroup label="Americas">
              <option value="America/New_York">America/New_York (EST, UTC-5)</option>
              <option value="America/Los_Angeles">America/Los_Angeles (PST, UTC-8)</option>
            </optgroup>
            <optgroup label="Other">
              <option value="UTC">UTC</option>
            </optgroup>
          </select>
        </div>
      </div>

      {/* Booking Rules — auto-save */}
      <div ref={el => { secRefs.current.rules = el }} className="bg-[var(--ds-bg-surface)] rounded-2xl border border-[var(--ds-border-sub)] p-6 space-y-5">
        <div>
          <p className="text-[13px] font-black uppercase tracking-wider text-[var(--ds-text-1)]">Booking Rules</p>
          <p className="text-[12px] text-[var(--ds-text-3)] mt-0.5">Control how users can create bookings across the system.</p>
        </div>

        {/* Max advance days */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(99,102,241,0.1)' }}>
              <span className="material-symbols-outlined" style={{ fontSize: 20, color: '#6366f1' }}>event_upcoming</span>
            </div>
            <div>
              <p className="text-[14px] font-black text-[var(--ds-text-1)]">Max Advance Booking</p>
              <p className="text-[11px] text-[var(--ds-text-3)] font-bold uppercase tracking-wider">How many days ahead users can book</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input type="number" min={1} max={365} value={maxDays}
              onChange={e => onMaxDaysChange(Math.max(1, Math.min(365, Number(e.target.value))))}
              className="w-16 text-center text-[13px] font-black bg-[var(--ds-bg-raised)] border border-[var(--ds-border)] rounded-xl p-2 focus:ring-2 focus:ring-[#adee2b] focus:outline-none text-[var(--ds-text-1)]" />
            <span className="text-[12px] font-bold text-[var(--ds-text-3)]">days</span>
          </div>
        </div>

        <div className="border-t border-[var(--ds-border-sub)]" />

        {/* Allow book for others */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-2xl flex items-center justify-center" style={{ background: allowBookFor ? 'rgba(173,238,43,0.12)' : 'rgba(0,0,0,0.04)' }}>
              <span className="material-symbols-outlined" style={{ fontSize: 20, color: allowBookFor ? '#4d7c00' : '#94a3b8' }}>person_add</span>
            </div>
            <div>
              <p className="text-[14px] font-black text-[var(--ds-text-1)]">Book on Behalf of Others</p>
              <p className="text-[11px] text-[var(--ds-text-3)] font-bold uppercase tracking-wider">{allowBookFor ? 'Users can book for others' : 'Disabled — own bookings only'}</p>
            </div>
          </div>
          <button type="button" onClick={toggleAllowBookFor} className="relative shrink-0" style={{ width: 44, height: 24 }}>
            <div className="absolute inset-0 rounded-full transition-colors" style={{ background: allowBookFor ? '#adee2b' : 'var(--ds-bg-raised)' }} />
            <div className="absolute top-1 transition-all rounded-full shadow-sm" style={{ width: 16, height: 16, background: 'var(--ds-bg-surface)', left: allowBookFor ? 24 : 4 }} />
          </button>
        </div>

        <div className="border-t border-[var(--ds-border-sub)]" />

        {/* After-hours restriction */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-2xl flex items-center justify-center" style={{ background: restrictAH ? 'rgba(99,102,241,0.1)' : 'rgba(0,0,0,0.04)' }}>
                <span className="material-symbols-outlined" style={{ fontSize: 20, color: restrictAH ? '#6366f1' : '#94a3b8' }}>schedule</span>
              </div>
              <div>
                <p className="text-[14px] font-black text-[var(--ds-text-1)]">After-Hours Restriction</p>
                <p className="text-[11px] text-[var(--ds-text-3)] font-bold uppercase tracking-wider">{restrictAH ? `Users cannot book after ${workEnd}` : 'No restriction — any booking hour'}</p>
              </div>
            </div>
            <button type="button" onClick={toggleRestrictAH} className="relative shrink-0" style={{ width: 44, height: 24 }}>
              <div className="absolute inset-0 rounded-full transition-colors" style={{ background: restrictAH ? '#6366f1' : '#e2e8f0' }} />
              <div className="absolute top-1 transition-all rounded-full bg-white shadow-sm" style={{ width: 16, height: 16, left: restrictAH ? 24 : 4 }} />
            </button>
          </div>
          {restrictAH && (
            <div className="flex items-center gap-3 pl-11">
              <p className="text-[10px] font-black text-[var(--ds-text-2)] uppercase tracking-wider">Working hours end:</p>
              <GlassTimePicker value={workEnd} onChange={onWorkEndChange} min="12:00" max="22:00" step={30} panelWidth={140}>
                {() => (<button type="button" className="flex items-center gap-2 bg-[var(--ds-bg-raised)] border border-[var(--ds-border)] rounded-xl text-[12px] font-black px-3 py-2 hover:border-[#adee2b] transition-all tabular-nums text-[var(--ds-text-1)]"><span className="material-symbols-outlined text-[var(--ds-text-3)]" style={{ fontSize: 14 }}>schedule</span>{workEnd}</button>)}
              </GlassTimePicker>
            </div>
          )}
        </div>
      </div>

      {/* Anti-Ghost Booking */}
      <div ref={el => { secRefs.current.ghost = el }} className="bg-[var(--ds-bg-surface)] rounded-2xl border border-[var(--ds-border-sub)] p-6 space-y-5">
        <div>
          <p className="text-[13px] font-black uppercase tracking-wider text-[var(--ds-text-1)]">Anti-Ghost Booking</p>
          <p className="text-[12px] text-[var(--ds-text-3)] mt-0.5">Auto-cancel bookings where no one shows up. Requires presence confirmation on the kiosk within 10 minutes of start time.</p>
        </div>

        {/* Master toggle */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-2xl flex items-center justify-center" style={{ background: antiGhostEnabled ? 'rgba(173,238,43,0.12)' : 'var(--ds-bg-raised)' }}>
              <span className="material-symbols-outlined" style={{ fontSize: 20, color: antiGhostEnabled ? '#4d7c00' : '#94a3b8' }}>person_off</span>
            </div>
            <div>
              <p className="text-[14px] font-black text-[var(--ds-text-1)]">Enable Anti-Ghost</p>
              <p className="text-[11px] text-[var(--ds-text-3)] font-bold uppercase tracking-wider">
                {antiGhostEnabled ? 'Unconfirmed bookings are auto-cancelled after +10 min' : 'No-show detection is off'}
              </p>
            </div>
          </div>
          <button type="button" onClick={toggleAntiGhost} className="relative shrink-0" style={{ width: 44, height: 24 }}>
            <div className="absolute inset-0 rounded-full transition-colors" style={{ background: antiGhostEnabled ? '#adee2b' : 'var(--ds-bg-raised)', border: '1px solid var(--ds-border)' }} />
            <div className="absolute top-[3px] transition-all rounded-full" style={{ width: 18, height: 18, background: antiGhostEnabled ? '#1a3a00' : 'var(--ds-text-3)', left: antiGhostEnabled ? 22 : 3 }} />
          </button>
        </div>

        {antiGhostEnabled && (
          <>
            <div className="border-t border-[var(--ds-border-sub)]" />
            <div>
              <p className="text-[11px] font-black uppercase tracking-wider text-[var(--ds-text-3)] mb-1">Confirmation Method</p>
              <p className="text-[10px] font-medium text-[var(--ds-text-4)] mb-3">At least one must be selected — booking confirmed if any method detects presence. Deselecting all disables Anti-Ghost.</p>
              <div className="flex gap-2">
                {([
                  { key: 'kiosk',  label: 'Kiosk',       icon: 'tablet',      desc: 'User taps Confirm on the room kiosk device' },
                  { key: 'sensor', label: 'Sensor',       icon: 'sensors',     desc: 'Motion/occupancy sensor auto-confirms via ESP32 ping' },
                  { key: 'web',    label: 'Web Confirm',  icon: 'how_to_reg',  desc: 'User confirms from My Schedule or notification in the app' },
                ] as const).map(opt => {
                  const sel = opt.key === 'web' ? webConfirmEnabled : antiGhostModes.has(opt.key)
                  return (
                    <button key={opt.key} type="button"
                      onClick={() => toggleMethod(opt.key)}
                      className="flex-1 flex flex-col gap-2 p-4 rounded-xl text-left transition-all"
                      style={{
                        background: sel ? 'rgba(173,238,43,0.07)' : 'var(--ds-bg-raised)',
                        border: sel ? '2px solid rgba(173,238,43,0.55)' : '2px solid var(--ds-border)',
                        cursor: 'pointer',
                      }}>
                      <div className="flex items-center gap-2.5">
                        <div className="size-4 rounded-md flex items-center justify-center shrink-0 transition-all"
                          style={{ background: sel ? '#adee2b' : 'var(--ds-bg-surface)', border: sel ? '2px solid #adee2b' : '2px solid var(--ds-border)' }}>
                          {sel && <span className="material-symbols-outlined text-black" style={{ fontSize: 11, fontVariationSettings: "'wght' 900" }}>check</span>}
                        </div>
                        <span className="material-symbols-outlined" style={{ fontSize: 16, color: sel ? '#4d7c00' : 'var(--ds-text-3)' }}>{opt.icon}</span>
                        <span className="text-[12px] font-black" style={{ color: sel ? 'var(--ds-text-1)' : 'var(--ds-text-2)' }}>{opt.label}</span>
                      </div>
                      <p className="text-[10px] font-medium leading-relaxed" style={{ color: sel ? 'var(--ds-text-3)' : 'var(--ds-text-4)' }}>{opt.desc}</p>
                    </button>
                  )
                })}
              </div>
            </div>
            {/* Confirmation time window */}
            <div>
              <p className="text-[11px] font-black uppercase tracking-wider text-[var(--ds-text-3)] mb-3">Confirmation Window</p>
              <p className="text-[10px] text-[var(--ds-text-4)] font-medium mb-4">
                How many minutes before/after the booking start time the confirm button is available. Auto-cancel fires when the window closes with no confirmation.
              </p>

              {/* Visual timeline */}
              <div className="relative h-8 mb-4 flex items-center">
                <div className="absolute inset-x-0 h-px bg-[var(--ds-border)]" />
                {/* Window highlight */}
                <div className="absolute h-2.5 rounded-full" style={{
                  left:  `${50 - (ghostWindowBefore / 20) * 50}%`,
                  right: `${50 - (ghostWindowAfter  / 20) * 50}%`,
                  background: 'rgba(99,102,241,0.25)',
                  border: '1px solid rgba(99,102,241,0.5)',
                  minWidth: 4,
                }} />
                {/* Start marker */}
                <div className="absolute left-1/2 -translate-x-1/2 flex flex-col items-center gap-1">
                  <div className="w-px h-4 bg-[#adee2b]" />
                  <span className="text-[8px] font-black uppercase tracking-wider text-[#adee2b]">Start</span>
                </div>
                {/* Before label */}
                <span className="absolute left-0 text-[9px] font-black text-[#6366f1]">-{ghostWindowBefore}m</span>
                {/* After label */}
                <span className="absolute right-0 text-[9px] font-black text-[#6366f1]">+{ghostWindowAfter}m</span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[9px] font-black uppercase tracking-wider text-[var(--ds-text-3)] block mb-1.5">
                    Opens before start <span className="text-[var(--ds-text-4)] normal-case">(0–20 min)</span>
                  </label>
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={() => onGhostWindowBeforeChange(ghostWindowBefore - 1)} disabled={ghostWindowBefore <= 0}
                      className="size-7 flex items-center justify-center rounded-lg text-[var(--ds-text-2)] disabled:opacity-30 transition-colors"
                      style={{ background: 'var(--ds-bg-raised)', border: '1px solid var(--ds-border)' }}>
                      <span className="material-symbols-outlined" style={{ fontSize: 14 }}>remove</span>
                    </button>
                    <input type="number" min={0} max={20} value={ghostWindowBefore}
                      onChange={e => onGhostWindowBeforeChange(Number(e.target.value))}
                      className="w-14 text-center text-[13px] font-black bg-[var(--ds-bg-raised)] border border-[var(--ds-border)] rounded-xl p-2 focus:ring-2 focus:ring-[#6366f1] focus:outline-none text-[var(--ds-text-1)]" />
                    <button type="button" onClick={() => onGhostWindowBeforeChange(ghostWindowBefore + 1)} disabled={ghostWindowBefore >= 20}
                      className="size-7 flex items-center justify-center rounded-lg text-[var(--ds-text-2)] disabled:opacity-30 transition-colors"
                      style={{ background: 'var(--ds-bg-raised)', border: '1px solid var(--ds-border)' }}>
                      <span className="material-symbols-outlined" style={{ fontSize: 14 }}>add</span>
                    </button>
                    <span className="text-[11px] font-bold text-[var(--ds-text-3)]">min</span>
                  </div>
                </div>
                <div>
                  <label className="text-[9px] font-black uppercase tracking-wider text-[var(--ds-text-3)] block mb-1.5">
                    Closes after start <span className="text-[var(--ds-text-4)] normal-case">(0–20 min)</span>
                  </label>
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={() => onGhostWindowAfterChange(ghostWindowAfter - 1)} disabled={ghostWindowAfter <= 0}
                      className="size-7 flex items-center justify-center rounded-lg text-[var(--ds-text-2)] disabled:opacity-30 transition-colors"
                      style={{ background: 'var(--ds-bg-raised)', border: '1px solid var(--ds-border)' }}>
                      <span className="material-symbols-outlined" style={{ fontSize: 14 }}>remove</span>
                    </button>
                    <input type="number" min={0} max={20} value={ghostWindowAfter}
                      onChange={e => onGhostWindowAfterChange(Number(e.target.value))}
                      className="w-14 text-center text-[13px] font-black bg-[var(--ds-bg-raised)] border border-[var(--ds-border)] rounded-xl p-2 focus:ring-2 focus:ring-[#6366f1] focus:outline-none text-[var(--ds-text-1)]" />
                    <button type="button" onClick={() => onGhostWindowAfterChange(ghostWindowAfter + 1)} disabled={ghostWindowAfter >= 20}
                      className="size-7 flex items-center justify-center rounded-lg text-[var(--ds-text-2)] disabled:opacity-30 transition-colors"
                      style={{ background: 'var(--ds-bg-raised)', border: '1px solid var(--ds-border)' }}>
                      <span className="material-symbols-outlined" style={{ fontSize: 14 }}>add</span>
                    </button>
                    <span className="text-[11px] font-bold text-[var(--ds-text-3)]">min</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Sensor API Token — only when sensor mode active */}
            {antiGhostModes.has('sensor') && (
              <div>
                <p className="text-[11px] font-black uppercase tracking-wider text-[var(--ds-text-3)] mb-1">Sensor API Token</p>
                <p className="text-[10px] font-medium text-[var(--ds-text-4)] mb-3">
                  Flash this token into your ESP32 as the <code className="font-mono bg-[var(--ds-bg-raised)] px-1 py-0.5 rounded text-[9px]">X-Sensor-Token</code> header. Each room has its own <strong>Sensor Code</strong> visible in the Buildings tab.
                </p>
                <div className="flex items-center gap-2 p-3 rounded-xl" style={{ background: 'var(--ds-bg-raised)', border: '1px solid var(--ds-border)' }}>
                  <span className="material-symbols-outlined shrink-0" style={{ fontSize: 16, color: 'var(--ds-text-3)' }}>key</span>
                  <code className="flex-1 text-[11px] font-mono text-[var(--ds-text-2)] truncate">{general?.sensor_api_token ?? '—'}</code>
                  <button type="button"
                    onClick={() => { if (general?.sensor_api_token) { navigator.clipboard.writeText(general.sensor_api_token).then(() => addInfoToast('Sensor token copied')) } }}
                    className="shrink-0 size-7 flex items-center justify-center rounded-lg transition-colors"
                    style={{ background: 'var(--ds-bg-surface)', border: '1px solid var(--ds-border)' }}
                    title="Copy token">
                    <span className="material-symbols-outlined" style={{ fontSize: 14, color: 'var(--ds-text-3)' }}>content_copy</span>
                  </button>
                  <button type="button"
                    onClick={async () => {
                      const newToken = Array.from(crypto.getRandomValues(new Uint8Array(16))).map(b => b.toString(16).padStart(2, '0')).join('')
                      await saveGeneral({ sensor_api_token: newToken }, 'Sensor API token regenerated')
                    }}
                    className="shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-black transition-colors"
                    style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', color: '#ef4444' }}
                    title="Regenerate token — all ESP32s must be reflashed">
                    <span className="material-symbols-outlined" style={{ fontSize: 12 }}>refresh</span>
                    Regenerate
                  </button>
                </div>
                <div className="mt-2 p-3 rounded-xl" style={{ background: 'rgba(15,20,45,0.55)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <p className="text-[9px] font-black uppercase tracking-wider mb-1.5" style={{ color: 'rgba(173,238,43,0.7)' }}>ESP32 Request Format</p>
                  <pre className="text-[9px] font-mono leading-relaxed whitespace-pre-wrap break-all" style={{ color: 'rgba(255,255,255,0.6)' }}>{`POST /api/sensor/ping\nX-Sensor-Token: ${general?.sensor_api_token ?? '<token>'}\nContent-Type: application/json\n\n{ "sensor_code": "<room-sensor-code>" }`}</pre>
                </div>
              </div>
            )}

            <div className="p-3.5 rounded-xl text-[10px] font-semibold leading-relaxed" style={{ background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.18)', color: '#818cf8' }}>
              <span className="font-black">How it works:</span> Every minute, the system checks for bookings past the window close with no presence confirmed. Those bookings are auto-cancelled and logged in Activity Log. The kiosk display updates immediately.
            </div>
          </>
        )}
      </div>

      {/* Features — auto-save */}
      <div ref={el => { secRefs.current.features = el }} className="bg-[var(--ds-bg-surface)] rounded-2xl border border-[var(--ds-border-sub)] p-6 space-y-5">
        <div>
          <p className="text-[13px] font-black uppercase tracking-wider text-[var(--ds-text-1)]">Features</p>
          <p className="text-[12px] text-[var(--ds-text-3)] mt-0.5">Enable or disable system-wide features.</p>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-2xl flex items-center justify-center" style={{ background: aiChat ? 'rgba(173,238,43,0.12)' : 'rgba(0,0,0,0.04)' }}>
              <span className="material-symbols-outlined" style={{ fontSize: 20, color: aiChat ? '#4d7c00' : '#94a3b8' }}>smart_toy</span>
            </div>
            <div>
              <p className="text-[14px] font-black text-[var(--ds-text-1)]">AI Chat</p>
              <p className="text-[11px] text-[var(--ds-text-3)] font-bold uppercase tracking-wider">{aiChat ? 'AI FAB visible to all users' : 'Hidden — reduce server load'}</p>
            </div>
          </div>
          <button type="button" onClick={toggleAiChat} className="relative shrink-0" style={{ width: 44, height: 24 }}>
            <div className="absolute inset-0 rounded-full transition-colors" style={{ background: aiChat ? '#adee2b' : 'var(--ds-bg-raised)' }} />
            <div className="absolute top-1 transition-all rounded-full shadow-sm" style={{ width: 16, height: 16, background: 'var(--ds-bg-surface)', left: aiChat ? 24 : 4 }} />
          </button>
        </div>

        <div className="border-t border-[var(--ds-border-sub)]" />

        {/* Allow password change */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-2xl flex items-center justify-center" style={{ background: allowPasswordChange ? 'rgba(173,238,43,0.12)' : 'rgba(0,0,0,0.04)' }}>
              <span className="material-symbols-outlined" style={{ fontSize: 20, color: allowPasswordChange ? '#4d7c00' : '#94a3b8' }}>lock_reset</span>
            </div>
            <div>
              <p className="text-[14px] font-black text-[var(--ds-text-1)]">Password Change</p>
              <p className="text-[11px] text-[var(--ds-text-3)] font-bold uppercase tracking-wider">{allowPasswordChange ? 'Users can change their own password' : 'Disabled — superadmin only'}</p>
            </div>
          </div>
          <button type="button" onClick={toggleAllowPasswordChange} className="relative shrink-0" style={{ width: 44, height: 24 }}>
            <div className="absolute inset-0 rounded-full transition-colors" style={{ background: allowPasswordChange ? '#adee2b' : 'var(--ds-bg-raised)' }} />
            <div className="absolute top-1 transition-all rounded-full shadow-sm" style={{ width: 16, height: 16, background: 'var(--ds-bg-surface)', left: allowPasswordChange ? 24 : 4 }} />
          </button>
        </div>

        <div className="border-t border-[var(--ds-border-sub)]" />

        {/* Avatar upload toggle */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-2xl flex items-center justify-center" style={{ background: allowAvatarUpload ? 'rgba(173,238,43,0.12)' : 'rgba(0,0,0,0.04)' }}>
              <span className="material-symbols-outlined" style={{ fontSize: 20, color: allowAvatarUpload ? '#4d7c00' : '#94a3b8' }}>add_a_photo</span>
            </div>
            <div>
              <p className="text-[14px] font-black text-[var(--ds-text-1)]">Profile Photo Upload</p>
              <p className="text-[11px] text-[var(--ds-text-3)] font-bold uppercase tracking-wider">{allowAvatarUpload ? 'Users can upload & change their photo' : 'Disabled — photo upload locked'}</p>
            </div>
          </div>
          <button type="button" onClick={toggleAllowAvatarUpload} className="relative shrink-0" style={{ width: 44, height: 24 }}>
            <div className="absolute inset-0 rounded-full transition-colors" style={{ background: allowAvatarUpload ? '#adee2b' : 'var(--ds-bg-raised)' }} />
            <div className="absolute top-1 transition-all rounded-full shadow-sm" style={{ width: 16, height: 16, background: 'var(--ds-bg-surface)', left: allowAvatarUpload ? 24 : 4 }} />
          </button>
        </div>

        <div className="border-t border-[var(--ds-border-sub)]" />

        {/* Rooms grid columns */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(99,102,241,0.1)' }}>
              <span className="material-symbols-outlined" style={{ fontSize: 20, color: '#6366f1' }}>grid_view</span>
            </div>
            <div>
              <p className="text-[14px] font-black text-[var(--ds-text-1)]">Rooms Grid Columns</p>
              <p className="text-[11px] text-[var(--ds-text-3)] font-bold uppercase tracking-wider">Cards per row on Rooms page</p>
            </div>
          </div>
          <div className="flex items-center gap-1 p-1 rounded-xl bg-[var(--ds-bg-raised)] border border-[var(--ds-border)]">
            {[2, 3, 4, 5].map(n => (
              <button
                key={n}
                type="button"
                onClick={() => setRoomsGridCols(n)}
                className="w-8 h-7 rounded-lg text-[11px] font-black transition-all"
                style={roomsGrid === n
                  ? { background: '#000', color: '#adee2b' }
                  : { background: 'transparent', color: '#94a3b8' }
                }
              >
                {n}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Microsoft 365 Integration */}
      <div ref={el => { secRefs.current.m365 = el }} className="bg-[var(--ds-bg-surface)] rounded-2xl border border-[var(--ds-border-sub)] p-6 space-y-5">
        <div>
          <p className="text-[13px] font-black uppercase tracking-wider text-[var(--ds-text-1)]">Microsoft 365 Integration</p>
          <p className="text-[12px] text-[var(--ds-text-3)] mt-0.5">
            Azure AD App Registration credentials, shared by future Teams, Email, and Outlook Calendar integrations.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-[9px] font-black uppercase text-[var(--ds-text-3)] tracking-wider px-1">Tenant ID</label>
            <input
              type="text"
              value={m365TenantId}
              onChange={e => setM365TenantId(e.target.value)}
              placeholder="e.g. 3f2a1b8c-....-....-....-............"
              className="w-full bg-[var(--ds-bg-raised)] border border-[var(--ds-border)] rounded-xl px-3 py-2 text-sm font-semibold text-[var(--ds-text-1)] focus:outline-none focus:ring-2 focus:ring-[#adee2b]"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[9px] font-black uppercase text-[var(--ds-text-3)] tracking-wider px-1">Client ID (Application ID)</label>
            <input
              type="text"
              value={m365ClientId}
              onChange={e => setM365ClientId(e.target.value)}
              placeholder="e.g. 7c9d4e21-....-....-....-............"
              className="w-full bg-[var(--ds-bg-raised)] border border-[var(--ds-border)] rounded-xl px-3 py-2 text-sm font-semibold text-[var(--ds-text-1)] focus:outline-none focus:ring-2 focus:ring-[#adee2b]"
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <label className="text-[9px] font-black uppercase text-[var(--ds-text-3)] tracking-wider px-1">Client Secret</label>
            <input
              type="password"
              value={m365ClientSecret}
              onChange={e => setM365ClientSecret(e.target.value)}
              placeholder={m365?.has_secret ? '•••••••• (already set — type to replace)' : 'Paste the client secret value'}
              className="w-full bg-[var(--ds-bg-raised)] border border-[var(--ds-border)] rounded-xl px-3 py-2 text-sm font-semibold text-[var(--ds-text-1)] focus:outline-none focus:ring-2 focus:ring-[#adee2b]"
            />
            <p className="text-[10px] text-[var(--ds-text-3)] px-1">Stored encrypted. Leave blank when saving to keep the current secret unchanged.</p>
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <label className="text-[9px] font-black uppercase text-[var(--ds-text-3)] tracking-wider px-1">Sender Mailbox</label>
            <input
              type="text"
              value={m365SenderEmail}
              onChange={e => setM365SenderEmail(e.target.value)}
              placeholder="e.g. noreply@agc.com"
              className="w-full bg-[var(--ds-bg-raised)] border border-[var(--ds-border)] rounded-xl px-3 py-2 text-sm font-semibold text-[var(--ds-text-1)] focus:outline-none focus:ring-2 focus:ring-[#adee2b]"
            />
            <p className="text-[10px] text-[var(--ds-text-3)] px-1">A real, licensed mailbox in this tenant that the app will send email as. Must have Graph <code className="bg-black/10 dark:bg-white/10 px-1 rounded text-[9px]">Mail.Send</code> permission granted.</p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={saveM365}
            disabled={m365Saving}
            className="px-4 py-2 text-[10px] font-black uppercase rounded-lg bg-[#adee2b] text-black hover:bg-black hover:text-[#adee2b] transition-all disabled:opacity-50"
          >
            {m365Saving ? 'Saving...' : 'Save'}
          </button>
          <button
            type="button"
            onClick={handleTestM365}
            disabled={m365Testing || !m365?.configured}
            title={!m365?.configured ? 'Save Tenant ID, Client ID and Client Secret first' : ''}
            className="px-4 py-2 text-[10px] font-black uppercase rounded-lg bg-[var(--ds-bg-raised)] border border-[var(--ds-border)] text-[var(--ds-text-2)] hover:border-[#adee2b] transition-all disabled:opacity-50"
          >
            {m365Testing ? 'Testing...' : 'Test Connection'}
          </button>
          {m365?.configured && (
            <span className="text-[10px] font-black uppercase text-[var(--ds-text-3)] flex items-center gap-1">
              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>check_circle</span>
              Credentials saved
            </span>
          )}
        </div>

        {m365TestResult && (
          <div className="rounded-xl p-3.5 text-[11px] font-semibold leading-relaxed"
            style={m365TestResult.success
              ? { background: 'rgba(34,197,94,0.10)', border: '1px solid rgba(34,197,94,0.25)', color: '#16a34a' }
              : { background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.20)', color: '#ef4444' }}
          >
            {m365TestResult.message}
          </div>
        )}

        {/* Email sending switch */}
        <div className="pt-4 border-t space-y-3" style={{ borderColor: 'var(--ds-border-sub)' }}>
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-[12px] font-black text-[var(--ds-text-1)]">Send app emails via Microsoft 365</p>
              <p className="text-[10px] text-[var(--ds-text-3)] mt-0.5">
                When off, the app keeps using its current mailer. Only flip this on once Test Connection succeeds <em>and</em> the Sender Mailbox has Mail.Send permission and a real license.
              </p>
            </div>
            <button
              type="button"
              onClick={toggleM365MailEnabled}
              disabled={!m365?.mail_ready}
              title={!m365?.mail_ready ? 'Set Tenant ID, Client ID, Client Secret, and Sender Mailbox first' : ''}
              className={`shrink-0 w-12 h-7 rounded-full relative transition-all disabled:opacity-40 ${m365?.mail_enabled ? 'bg-[#adee2b]' : 'bg-[var(--ds-border)]'}`}
            >
              <span className="absolute top-1 size-5 rounded-full bg-white shadow-sm transition-all" style={{ left: m365?.mail_enabled ? 26 : 4 }} />
            </button>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={handleSendM365TestEmail}
              disabled={m365TestingEmail || !m365?.mail_ready}
              title={!m365?.mail_ready ? 'Set Tenant ID, Client ID, Client Secret, and Sender Mailbox first' : ''}
              className="px-4 py-2 text-[10px] font-black uppercase rounded-lg bg-[var(--ds-bg-raised)] border border-[var(--ds-border)] text-[var(--ds-text-2)] hover:border-[#adee2b] transition-all disabled:opacity-50"
            >
              {m365TestingEmail ? 'Sending...' : 'Send Test Email'}
            </button>
            <span className="text-[10px] text-[var(--ds-text-3)]">Sends to your own account email, regardless of the switch above.</span>
          </div>

          {m365EmailTestResult && (
            <div className="rounded-xl p-3.5 text-[11px] font-semibold leading-relaxed"
              style={m365EmailTestResult.success
                ? { background: 'rgba(34,197,94,0.10)', border: '1px solid rgba(34,197,94,0.25)', color: '#16a34a' }
                : { background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.20)', color: '#ef4444' }}
            >
              {m365EmailTestResult.message}
            </div>
          )}

          <div className="flex items-center justify-between gap-4 pt-1">
            <div>
              <p className="text-[12px] font-black text-[var(--ds-text-1)]">When Microsoft 365 mail is off, send via</p>
              <p className="text-[10px] text-[var(--ds-text-3)] mt-0.5">Used whenever the switch above is off — no <code className="bg-black/10 dark:bg-white/10 px-1 rounded text-[9px]">.env</code> edit needed.</p>
            </div>
            <select
              value={m365?.mail_fallback_driver ?? 'smtp'}
              onChange={e => changeMailFallbackDriver(e.target.value as 'smtp' | 'log' | 'array')}
              className="shrink-0 bg-[var(--ds-bg-raised)] border border-[var(--ds-border)] rounded-xl px-3 py-2 text-[11px] font-black uppercase text-[var(--ds-text-1)] focus:outline-none focus:ring-2 focus:ring-[#adee2b]"
            >
              <option value="smtp">SMTP (Gmail)</option>
              <option value="log">Log only (dev)</option>
              <option value="array">Discard (testing)</option>
            </select>
          </div>

          {m365?.mail_fallback_driver === 'smtp' && (
            <div className="pt-4 border-t space-y-3" style={{ borderColor: 'var(--ds-border-sub)' }}>
              <p className="text-[12px] font-black text-[var(--ds-text-1)]">SMTP Connection</p>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black uppercase text-[var(--ds-text-3)] tracking-wider px-1">Host</label>
                  <input type="text" value={smtpHost} onChange={e => setSmtpHost(e.target.value)} placeholder="smtp.gmail.com"
                    className="w-full bg-[var(--ds-bg-raised)] border border-[var(--ds-border)] rounded-xl px-3 py-2 text-sm font-semibold text-[var(--ds-text-1)] focus:outline-none focus:ring-2 focus:ring-[#adee2b]" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black uppercase text-[var(--ds-text-3)] tracking-wider px-1">Port &amp; Encryption</label>
                  <select
                    value={`${smtpPort}|${smtpEncryption}`}
                    onChange={e => {
                      const [port, enc] = e.target.value.split('|')
                      setSmtpPort(Number(port))
                      setSmtpEncryption(enc as 'tls' | 'ssl')
                    }}
                    className="w-full bg-[var(--ds-bg-raised)] border border-[var(--ds-border)] rounded-xl px-3 py-2 text-sm font-semibold text-[var(--ds-text-1)] focus:outline-none focus:ring-2 focus:ring-[#adee2b]"
                  >
                    <option value="587|tls">587 (TLS) — recommended</option>
                    <option value="465|ssl">465 (SSL)</option>
                  </select>
                  <p className="text-[10px] text-[var(--ds-text-3)] px-1">Port and encryption always change together — Gmail (and most providers) only accept these two pairings.</p>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black uppercase text-[var(--ds-text-3)] tracking-wider px-1">Username</label>
                  <input type="text" value={smtpUsername} onChange={e => setSmtpUsername(e.target.value)} placeholder="you@gmail.com"
                    className="w-full bg-[var(--ds-bg-raised)] border border-[var(--ds-border)] rounded-xl px-3 py-2 text-sm font-semibold text-[var(--ds-text-1)] focus:outline-none focus:ring-2 focus:ring-[#adee2b]" />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <label className="text-[9px] font-black uppercase text-[var(--ds-text-3)] tracking-wider px-1">Password</label>
                  <input type="password" value={smtpPassword} onChange={e => setSmtpPassword(e.target.value)}
                    placeholder={m365?.smtp_has_password ? '•••••••• (already set — type to replace)' : 'App password'}
                    className="w-full bg-[var(--ds-bg-raised)] border border-[var(--ds-border)] rounded-xl px-3 py-2 text-sm font-semibold text-[var(--ds-text-1)] focus:outline-none focus:ring-2 focus:ring-[#adee2b]" />
                  <p className="text-[10px] text-[var(--ds-text-3)] px-1">Stored encrypted. Leave blank when saving to keep the current password unchanged.</p>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black uppercase text-[var(--ds-text-3)] tracking-wider px-1">From Address</label>
                  <input type="text" value={smtpUsername} disabled readOnly
                    className="w-full bg-[var(--ds-bg-raised)] border border-[var(--ds-border)] rounded-xl px-3 py-2 text-sm font-semibold text-[var(--ds-text-3)] opacity-60 cursor-not-allowed" />
                  <p className="text-[10px] text-[var(--ds-text-3)] px-1">Always the same as Username — Gmail silently overrides a different From address anyway.</p>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black uppercase text-[var(--ds-text-3)] tracking-wider px-1">From Name</label>
                  <input type="text" value={smtpFromName} onChange={e => setSmtpFromName(e.target.value)} placeholder="RoomSync Pro"
                    className="w-full bg-[var(--ds-bg-raised)] border border-[var(--ds-border)] rounded-xl px-3 py-2 text-sm font-semibold text-[var(--ds-text-1)] focus:outline-none focus:ring-2 focus:ring-[#adee2b]" />
                </div>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <button type="button" onClick={saveSmtp} disabled={smtpSaving}
                  className="px-4 py-2 text-[10px] font-black uppercase rounded-lg bg-[#adee2b] text-black hover:bg-black hover:text-[#adee2b] transition-all disabled:opacity-50">
                  {smtpSaving ? 'Saving...' : 'Save SMTP Settings'}
                </button>
                <button type="button" onClick={handleSendSmtpTestEmail} disabled={smtpTesting || !m365?.smtp_has_password}
                  title={!m365?.smtp_has_password ? 'Save Host, Username and Password first' : ''}
                  className="px-4 py-2 text-[10px] font-black uppercase rounded-lg bg-[var(--ds-bg-raised)] border border-[var(--ds-border)] text-[var(--ds-text-2)] hover:border-[#adee2b] transition-all disabled:opacity-50">
                  {smtpTesting ? 'Sending...' : 'Send Test Email'}
                </button>
                <span className="text-[10px] text-[var(--ds-text-3)]">Sends to your own account email, using whatever is currently saved.</span>
              </div>
              {smtpTestResult && (
                <div className="rounded-xl p-3.5 text-[11px] font-semibold leading-relaxed"
                  style={smtpTestResult.success
                    ? { background: 'rgba(34,197,94,0.10)', border: '1px solid rgba(34,197,94,0.25)', color: '#16a34a' }
                    : { background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.20)', color: '#ef4444' }}
                >
                  {smtpTestResult.message}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Calendar sync switch */}
        <div className="pt-4 border-t space-y-3" style={{ borderColor: 'var(--ds-border-sub)' }}>
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-[12px] font-black text-[var(--ds-text-1)]">Sync new bookings to Outlook/Teams Calendar</p>
              <p className="text-[10px] text-[var(--ds-text-3)] mt-0.5">
                Every booking automatically becomes a calendar event in the booker's mailbox — it shows up in both Outlook and Teams (same calendar, no extra setup). Requires Graph <code className="bg-black/10 dark:bg-white/10 px-1 rounded text-[9px]">Calendars.ReadWrite</code> permission on the App Registration. Edits/cancellations don't sync back yet — only booking creation.
              </p>
            </div>
            <button
              type="button"
              onClick={toggleM365CalendarSync}
              disabled={!m365?.calendar_sync_ready}
              title={!m365?.calendar_sync_ready ? 'Save Tenant ID, Client ID and Client Secret first' : ''}
              className={`shrink-0 w-12 h-7 rounded-full relative transition-all disabled:opacity-40 ${m365?.calendar_sync_enabled ? 'bg-[#adee2b]' : 'bg-[var(--ds-border)]'}`}
            >
              <span className="absolute top-1 size-5 rounded-full bg-white shadow-sm transition-all" style={{ left: m365?.calendar_sync_enabled ? 26 : 4 }} />
            </button>
          </div>
        </div>

        <div className="rounded-xl p-4 space-y-2" style={{ background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.15)' }}>
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined" style={{ fontSize: 16, color: '#6366f1' }}>info</span>
            <p className="text-[11px] font-black uppercase tracking-wider" style={{ color: '#6366f1' }}>Where to get these values</p>
          </div>
          <ol className="text-[11px] text-[var(--ds-text-2)] leading-relaxed list-decimal list-inside space-y-1">
            <li>Go to <strong>entra.microsoft.com</strong> → <strong>App registrations</strong> → <strong>New registration</strong>.</li>
            <li>After creating it, copy the <strong>Application (client) ID</strong> and <strong>Directory (tenant) ID</strong> from its Overview page.</li>
            <li>Go to <strong>Certificates &amp; secrets</strong> → <strong>New client secret</strong> — copy the secret <strong>Value</strong> (shown once).</li>
            <li>Under <strong>API permissions</strong>, add the Microsoft Graph application permissions this app will need (e.g. <code className="bg-black/10 dark:bg-white/10 px-1 rounded text-[10px]">Mail.Send</code>, <code className="bg-black/10 dark:bg-white/10 px-1 rounded text-[10px]">Calendars.ReadWrite</code>), then click <strong>Grant admin consent</strong>.</li>
          </ol>
        </div>
      </div>

      {/* Archive settings */}
      <div ref={el => { secRefs.current.archive = el }} className="bg-[var(--ds-bg-surface)] rounded-2xl border border-[var(--ds-border-sub)] p-6 space-y-5">
        <div>
          <p className="text-[13px] font-black uppercase tracking-wider text-[var(--ds-text-1)]">Archive</p>
          <p className="text-[12px] text-[var(--ds-text-3)] mt-0.5">Control when bookings are archived and auto-deleted.</p>
        </div>

        {/* Archive after N days */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(99,102,241,0.1)' }}>
              <span className="material-symbols-outlined" style={{ fontSize: 20, color: '#6366f1' }}>inventory_2</span>
            </div>
            <div>
              <p className="text-[14px] font-black text-[var(--ds-text-1)]">Archive After</p>
              <p className="text-[11px] text-[var(--ds-text-3)] font-bold uppercase tracking-wider">Past bookings hidden from all views</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input type="number" min={1} max={365} value={archiveDays}
              onChange={e => onArchiveDaysChange(Math.max(1, Math.min(365, Number(e.target.value))))}
              className="w-16 text-center text-[13px] font-black bg-[var(--ds-bg-raised)] border border-[var(--ds-border)] rounded-xl p-2 focus:ring-2 focus:ring-[#adee2b] focus:outline-none text-[var(--ds-text-1)]" />
            <span className="text-[12px] font-bold text-[var(--ds-text-3)]">days</span>
          </div>
        </div>

        <div className="border-t border-[var(--ds-border-sub)]" />

        {/* Auto-delete after N days */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(239,68,68,0.1)' }}>
              <span className="material-symbols-outlined" style={{ fontSize: 20, color: '#ef4444' }}>delete_sweep</span>
            </div>
            <div>
              <p className="text-[14px] font-black text-[var(--ds-text-1)]">Auto-Delete Archive After</p>
              <p className="text-[11px] text-[var(--ds-text-3)] font-bold uppercase tracking-wider">Permanently delete from archive</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input type="number" min={1} max={730} value={deleteDays}
              onChange={e => onDeleteDaysChange(Math.max(1, Math.min(730, Number(e.target.value))))}
              className="w-16 text-center text-[13px] font-black bg-[var(--ds-bg-raised)] border border-[var(--ds-border)] rounded-xl p-2 focus:ring-2 focus:ring-[#adee2b] focus:outline-none text-[var(--ds-text-1)]" />
            <span className="text-[12px] font-bold text-[var(--ds-text-3)]">days</span>
          </div>
        </div>

        <div className="p-3 bg-[var(--ds-bg-raised)] rounded-xl text-[10px] text-[var(--ds-text-2)] font-semibold leading-relaxed">
          Bookings older than <span className="font-black text-[var(--ds-text-1)]">{archiveDays} days</span> move to archive.
          Archive entries older than <span className="font-black text-[var(--ds-text-1)]">{deleteDays} days</span> are permanently deleted nightly at 02:00.
        </div>
      </div>

      {/* ── Auto Backup (one bundled batch) ── */}
      <div ref={el => { secRefs.current.backup = el }} className="bg-[var(--ds-bg-surface)] rounded-2xl border border-[var(--ds-border-sub)] p-6 space-y-5">
        <div>
          <p className="text-[13px] font-black uppercase tracking-wider text-[var(--ds-text-1)]">Auto Backup</p>
          <p className="text-[12px] text-[var(--ds-text-3)] mt-0.5">Exports the bookings archive, activity log, and users/buildings/rooms together as a single scheduled batch.</p>
        </div>

        {/* Enable toggle */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-2xl flex items-center justify-center" style={{ background: backupEnabled ? 'rgba(173,238,43,0.12)' : 'rgba(0,0,0,0.04)' }}>
              <span className="material-symbols-outlined" style={{ fontSize: 20, color: backupEnabled ? '#4d7c00' : '#94a3b8' }}>backup</span>
            </div>
            <div>
              <p className="text-[14px] font-black text-[var(--ds-text-1)]">Auto Backup</p>
              <p className="text-[11px] text-[var(--ds-text-3)] font-bold uppercase tracking-wider">{backupEnabled ? 'Enabled — runs on schedule' : 'Disabled'}</p>
            </div>
          </div>
          <button type="button" onClick={toggleBackupEnabled} className="relative shrink-0" style={{ width: 44, height: 24 }}>
            <div className="absolute inset-0 rounded-full transition-colors" style={{ background: backupEnabled ? '#adee2b' : 'var(--ds-bg-raised)' }} />
            <div className="absolute top-1 transition-all rounded-full shadow-sm" style={{ width: 16, height: 16, background: 'var(--ds-bg-surface)', left: backupEnabled ? 24 : 4 }} />
          </button>
        </div>

        {backupEnabled && (<>
          <div className="border-t border-[var(--ds-border-sub)]" />

          {/* Frequency */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-2xl flex items-center justify-center bg-[var(--ds-bg-raised)]">
                <span className="material-symbols-outlined" style={{ fontSize: 20, color: 'var(--ds-text-2)' }}>repeat</span>
              </div>
              <p className="text-[14px] font-black text-[var(--ds-text-1)]">Frequency</p>
            </div>
            <div className="flex items-center gap-1 p-1 rounded-xl bg-[var(--ds-bg-raised)] border border-[var(--ds-border)]">
              {(['daily', 'weekly', 'monthly'] as const).map(f => (
                <button key={f} type="button" onClick={() => onBackupFrequencyChange(f)}
                  className="px-3 h-7 rounded-lg text-[10px] font-black uppercase transition-all"
                  style={backupFrequency === f ? { background: '#000', color: '#adee2b' } : { background: 'transparent', color: '#94a3b8' }}>
                  {f}
                </button>
              ))}
            </div>
          </div>

          {/* Time */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-2xl flex items-center justify-center bg-[var(--ds-bg-raised)]">
                <span className="material-symbols-outlined" style={{ fontSize: 20, color: 'var(--ds-text-2)' }}>schedule</span>
              </div>
              <p className="text-[14px] font-black text-[var(--ds-text-1)]">Time</p>
            </div>
            <GlassTimePicker value={backupTime} onChange={onBackupTimeChange} min="00:00" max="23:30" step={30} panelWidth={140}>
              {() => (<button type="button" className="flex items-center gap-2 bg-[var(--ds-bg-raised)] border border-[var(--ds-border)] rounded-xl text-[12px] font-black px-3 py-2 hover:border-[#adee2b] transition-all tabular-nums text-[var(--ds-text-1)]"><span className="material-symbols-outlined text-[var(--ds-text-3)]" style={{ fontSize: 14 }}>schedule</span>{backupTime}</button>)}
            </GlassTimePicker>
          </div>

          {/* Day of week (weekly) */}
          {backupFrequency === 'weekly' && (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-2xl flex items-center justify-center bg-[var(--ds-bg-raised)]">
                  <span className="material-symbols-outlined" style={{ fontSize: 20, color: 'var(--ds-text-2)' }}>today</span>
                </div>
                <p className="text-[14px] font-black text-[var(--ds-text-1)]">Day of Week</p>
              </div>
              <div className="flex items-center gap-1 p-1 rounded-xl bg-[var(--ds-bg-raised)] border border-[var(--ds-border)]">
                {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map((d, i) => (
                  <button key={i} type="button" onClick={() => onBackupDowChange(i)}
                    className="w-8 h-7 rounded-lg text-[10px] font-black transition-all"
                    style={backupDow === i ? { background: '#000', color: '#adee2b' } : { background: 'transparent', color: '#94a3b8' }}>
                    {d}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Day of month (monthly) */}
          {backupFrequency === 'monthly' && (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-2xl flex items-center justify-center bg-[var(--ds-bg-raised)]">
                  <span className="material-symbols-outlined" style={{ fontSize: 20, color: 'var(--ds-text-2)' }}>calendar_month</span>
                </div>
                <p className="text-[14px] font-black text-[var(--ds-text-1)]">Day of Month</p>
              </div>
              <div className="flex items-center gap-2">
                <input type="number" min={1} max={28} value={backupDom}
                  onChange={e => onBackupDomChange(Math.max(1, Math.min(28, Number(e.target.value))))}
                  className="w-14 text-center text-[13px] font-black bg-[var(--ds-bg-raised)] border border-[var(--ds-border)] rounded-xl p-2 focus:ring-2 focus:ring-[#adee2b] focus:outline-none text-[var(--ds-text-1)]" />
                <span className="text-[12px] font-bold text-[var(--ds-text-3)]">of month</span>
              </div>
            </div>
          )}

          <div className="border-t border-[var(--ds-border-sub)]" />

          {/* Formats */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-2xl flex items-center justify-center bg-[var(--ds-bg-raised)]">
                <span className="material-symbols-outlined" style={{ fontSize: 20, color: 'var(--ds-text-2)' }}>description</span>
              </div>
              <p className="text-[14px] font-black text-[var(--ds-text-1)]">File Formats</p>
            </div>
            <div className="flex items-center gap-2">
              {(['excel', 'csv', 'pdf'] as const).map(fmt => (
                <button key={fmt} type="button" onClick={() => toggleBackupFormat(fmt)}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-xl border text-[10px] font-black uppercase transition-all"
                  style={backupFormats.includes(fmt)
                    ? { background: 'rgba(173,238,43,0.1)', borderColor: 'rgba(173,238,43,0.5)', color: '#4d7c00' }
                    : { background: 'var(--ds-bg-raised)', borderColor: 'var(--ds-border)', color: '#94a3b8' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 11, fontVariationSettings: backupFormats.includes(fmt) ? "'FILL' 1" : "'FILL' 0" }}>check_circle</span>
                  {fmt}
                </button>
              ))}
            </div>
          </div>
          <p className="text-[10px] text-[var(--ds-text-3)] -mt-2">PDF applies to the bookings archive only. Activity log is always <code className="text-[10px] bg-[var(--ds-bg-raised)] px-1 py-0.5 rounded">.txt</code>.</p>

          <div className="border-t border-[var(--ds-border-sub)]" />

          {/* Include */}
          <div className="space-y-2">
            <p className="text-[10px] font-black uppercase tracking-wider text-[var(--ds-text-3)]">Include in Batch</p>
            <div className="flex items-center gap-2 flex-wrap">
              {([
                { key: 'archive' as const, label: 'Bookings Archive', on: backupIncludeArchive, icon: 'inventory_2' },
                { key: 'log' as const,     label: 'Activity Log',     on: backupIncludeLog,     icon: 'history' },
                { key: 'data' as const,    label: 'Users, Buildings & Rooms', on: backupIncludeData, icon: 'storage' },
              ]).map(item => (
                <button key={item.key} type="button" onClick={() => toggleBackupInclude(item.key)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl border text-[11px] font-black transition-all"
                  style={item.on
                    ? { background: 'rgba(173,238,43,0.1)', borderColor: 'rgba(173,238,43,0.5)', color: '#4d7c00' }
                    : { background: 'var(--ds-bg-raised)', borderColor: 'var(--ds-border)', color: '#94a3b8' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 13, fontVariationSettings: item.on ? "'FILL' 1" : "'FILL' 0" }}>check_circle</span>
                  <span className="material-symbols-outlined" style={{ fontSize: 13 }}>{item.icon}</span>
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        </>)}

        <div className="border-t border-[var(--ds-border-sub)]" />

        {/* Backup Log */}
        <div className="rounded-2xl border border-[var(--ds-border-sub)] overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 bg-[var(--ds-bg-raised)]">
            <div>
              <p className="text-[11px] font-black uppercase tracking-wider text-[var(--ds-text-1)]">Backup Log</p>
              <p className="text-[10px] text-[var(--ds-text-3)] mt-0.5">Batches generated by scheduler or manual export</p>
            </div>
            <button onClick={() => doBackupNow()} disabled={backupRunning}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-black text-[#adee2b] text-[10px] font-black uppercase hover:opacity-80 disabled:opacity-40 transition-opacity">
              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>save</span>
              {backupRunning ? 'Backing up…' : 'Backup Now'}
            </button>
          </div>
          {backupExports.length === 0 ? (
            <p className="px-4 py-6 text-center text-[var(--ds-text-3)] text-sm font-bold">No backups yet.</p>
          ) : (
            <div className="divide-y divide-[var(--ds-border-sub)]">
              {backupExports.map(e => (
                <div key={e.label} className="px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    <p className="text-[13px] font-black text-[var(--ds-text-1)]">{e.label}</p>
                    <p className="text-[11px] text-[var(--ds-text-3)] mt-0.5">{new Date(e.created_at * 1000).toLocaleString('en-GB')}</p>
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {e.files.map(f => (
                      <a key={f.path} href={getBackupDownloadUrl(f.path)}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-[var(--ds-border)] text-[var(--ds-text-2)] text-[9px] font-black uppercase hover:bg-[var(--ds-bg-raised)] transition-colors">
                        <span className="material-symbols-outlined" style={{ fontSize: 12 }}>download</span>
                        {f.name.replace(/_.*\./, '.').split('.')[0]}.{f.name.split('.').pop()?.toUpperCase()}
                        <span className="text-[var(--ds-text-3)] font-normal">({(f.size / 1024).toFixed(0)}kb)</span>
                      </a>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {backupExports.length > 0 && (
            <div className="mx-4 mb-4 mt-2 rounded-2xl p-3.5 flex items-center justify-between gap-4" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)' }}>
              <div>
                <p className="text-[10px] font-black text-red-500 uppercase tracking-wider">Danger Zone</p>
                <p className="text-[10px] text-red-400 mt-0.5">Delete all {backupExports.length} backup batch{backupExports.length !== 1 ? 'es' : ''} and their files permanently.</p>
              </div>
              <button onClick={() => { setDeleteBackupsConfirm(true); setDeleteBackupsInput('') }}
                className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-red-300 bg-[var(--ds-bg-surface)] text-red-500 text-[10px] font-black uppercase hover:bg-red-100 transition-colors">
                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>delete_forever</span>
                Delete All
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Delete all backups confirm modal */}
      {deleteBackupsConfirm && createPortal(
        <div className="fixed inset-0 z-[1000] flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(16px)' }}
          onClick={() => setDeleteBackupsConfirm(false)}>
          <div className="w-[420px] rounded-[2rem] overflow-hidden shadow-2xl"
            style={{ background: 'var(--ds-bg-surface)', backdropFilter: 'blur(48px)', border: '1px solid rgba(128,128,128,0.15)' }}
            onClick={e => e.stopPropagation()}>
            <div className="px-7 pt-7 pb-5 border-b flex items-center gap-3" style={{ background: 'rgba(239,68,68,0.08)', borderColor: 'rgba(239,68,68,0.15)' }}>
              <div className="size-10 rounded-2xl bg-red-100 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-red-500" style={{ fontSize: 22 }}>delete_forever</span>
              </div>
              <div>
                <p className="text-base font-black text-[var(--ds-text-1)]">Delete All Backup Records</p>
                <p className="text-[11px] text-[var(--ds-text-2)]">This will permanently delete all files from the server.</p>
              </div>
            </div>
            <div className="px-7 py-6 space-y-5">
              <p className="text-[12px] text-[var(--ds-text-2)] leading-relaxed">
                All <span className="font-black text-[var(--ds-text-1)]">{backupExports.length} backup batch{backupExports.length !== 1 ? 'es' : ''}</span> and their files will be permanently removed from the server. This action <span className="font-black text-red-500">cannot be undone</span>.
              </p>
              <div className="space-y-1.5">
                <p className="text-[10px] font-black text-[var(--ds-text-2)] uppercase tracking-wider">Confirm action</p>
                <p className="text-[11px] text-[var(--ds-text-2)]">Type <span className="font-black text-red-500 font-mono">Delete all records</span> to confirm</p>
                <input
                  type="text"
                  value={deleteBackupsInput}
                  onChange={e => setDeleteBackupsInput(e.target.value)}
                  placeholder="Delete all records"
                  autoFocus
                  onKeyDown={e => { if (e.key === 'Enter' && deleteBackupsInput === 'Delete all records') doDeleteAllBackups() }}
                  className="w-full px-4 py-3 rounded-xl border border-[var(--ds-border)] text-[13px] font-semibold focus:outline-none focus:ring-2 focus:ring-red-300 focus:border-red-300 placeholder:text-[var(--ds-text-3)] bg-[var(--ds-bg-raised)] text-[var(--ds-text-1)]"
                />
              </div>
              <div className="flex gap-3 justify-end">
                <button onClick={() => setDeleteBackupsConfirm(false)}
                  className="px-5 py-2.5 rounded-xl border border-[var(--ds-border)] text-[var(--ds-text-2)] text-[11px] font-black uppercase hover:bg-[var(--ds-bg-raised)] transition-colors">
                  Cancel
                </button>
                <button onClick={doDeleteAllBackups} disabled={deleteBackupsInput !== 'Delete all records' || deletingBackups}
                  className="px-5 py-2.5 rounded-xl bg-red-500 text-white text-[11px] font-black uppercase hover:bg-red-600 disabled:opacity-40 transition-colors">
                  {deletingBackups ? 'Deleting…' : 'Delete Permanently'}
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      </div>{/* end main sections */}

      {/* ── Floating TOC sidebar ── */}
      <div className="w-44 shrink-0 sticky top-4">
        <div className="rounded-2xl border border-[var(--ds-border-sub)] bg-[var(--ds-bg-surface)] shadow-sm overflow-hidden">
          <p className="text-[8px] font-black uppercase tracking-[0.2em] text-[var(--ds-text-3)] px-4 pt-4 pb-2">On this page</p>
          <div className="pb-2">
            {SETTINGS_SECTIONS.map(s => (
              <button
                key={s.key}
                type="button"
                onClick={() => scrollTo(s.key)}
                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-left transition-colors group"
                style={{ background: activeSection === s.key ? 'rgba(173,238,43,0.08)' : 'transparent' }}
              >
                <span
                  className="material-symbols-outlined shrink-0 transition-colors"
                  style={{ fontSize: 14, color: activeSection === s.key ? '#4d7c00' : '#cbd5e1' }}
                >
                  {s.icon}
                </span>
                <span
                  className="text-[11px] font-black transition-colors"
                  style={{ color: activeSection === s.key ? 'var(--ds-text-1)' : '#94a3b8' }}
                >
                  {s.label}
                </span>
                {activeSection === s.key && (
                  <span className="ml-auto w-1 h-1 rounded-full bg-[#adee2b] shrink-0" />
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      </div>{/* end flex 2-col */}
    </div>
  )
}

// ── Disputes Tab ─────────────────────────────────────────────────────────────
// ── Sensor Tab ────────────────────────────────────────────────────────────────
function SensorTab() {
  const { addInfoToast } = useCancelToast()
  const qc = useQueryClient()
  const { data: general } = useQuery({ queryKey: ['settings-general'], queryFn: getGeneralSettings, staleTime: 60_000 })
  const { data: rooms = [] } = useQuery<Room[]>({ queryKey: ['rooms'], queryFn: getRooms, staleTime: 60_000 })

  const antiGhostEnabled = general?.anti_ghost_enabled ?? false
  const sensorEnabled    = antiGhostEnabled && (general?.anti_ghost_mode ?? '').split(',').includes('sensor')
  const token            = general?.sensor_api_token ?? ''

  const { mutateAsync: doSaveGeneral } = useMutation({
    mutationFn: (patch: Partial<import('../api/settings').GeneralSettings>) => updateGeneralSettings(patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['settings-general'] }),
  })

  const [regeneratingSensor, setRegeneratingSensor] = useState<number | null>(null)
  const [regenTokenModal, setRegenTokenModal] = useState(false)
  const [regenTokenInput, setRegenTokenInput] = useState('')
  const [regenTokenLoading, setRegenTokenLoading] = useState(false)
  const [sensorBuildingFilter, setSensorBuildingFilter] = useState<number | null>(null)

  async function handleRegenToken() {
    setRegenTokenLoading(true)
    try {
      const newToken = Array.from(crypto.getRandomValues(new Uint8Array(16))).map(b => b.toString(16).padStart(2, '0')).join('')
      await doSaveGeneral({ sensor_api_token: newToken })
      addInfoToast('Sensor API token regenerated — reflash all ESP32s')
      setRegenTokenModal(false)
      setRegenTokenInput('')
    } finally { setRegenTokenLoading(false) }
  }

  async function handleRegenCode(room: Room) {
    setRegeneratingSensor(room.id)
    try {
      const updated = await regenerateSensorCode(room.id)
      qc.setQueryData(['rooms'], (old: Room[]) => old.map(r => r.id === room.id ? { ...r, sensor_code: updated.sensor_code } : r))
      addInfoToast(`Sensor code regenerated for ${room.name}`)
    } finally { setRegeneratingSensor(null) }
  }

  if (!sensorEnabled) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-5 text-center px-8">
        <div className="size-24 rounded-3xl flex items-center justify-center" style={{ background: 'var(--ds-bg-surface)', border: '1px solid var(--ds-border)' }}>
          <span className="material-symbols-outlined" style={{ fontSize: 48, color: 'var(--ds-text-4)' }}>sensors_off</span>
        </div>
        <div>
          <p className="text-xl font-black uppercase tracking-wide" style={{ color: 'var(--ds-text-2)' }}>Sensor Mode Disabled</p>
          <p className="text-sm font-medium mt-2 leading-relaxed" style={{ color: 'var(--ds-text-4)' }}>
            Enable it in <span className="font-black" style={{ color: 'var(--ds-text-3)' }}>Settings → Anti-Ghost Booking → Detection Method</span>
          </p>
        </div>
      </div>
    )
  }

  const { data: sensorBuildings = [] } = useQuery({ queryKey: ['buildings'], queryFn: getBuildings, staleTime: 300_000 })
  const allSensorRooms = (rooms as Room[]).filter(r => r.is_active).sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
  const sensorRooms = sensorBuildingFilter !== null
    ? allSensorRooms.filter(r => r.building_id === sensorBuildingFilter)
    : allSensorRooms

  return (
    <div className="space-y-6 pb-10">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-1">
          <span className="size-2.5 rounded-full bg-[#adee2b] animate-pulse shrink-0" />
          <p className="text-sm font-black uppercase tracking-wider" style={{ color: '#4d7c00' }}>Sensor Mode Active</p>
        </div>
        <p className="text-sm font-medium" style={{ color: 'var(--ds-text-3)' }}>
          ESP32 sensors auto-confirm presence by pinging this server. Configure tokens below, flash each device, and you're done.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-5">
        {/* Left column — API Token + Request format + Response */}
        <div className="space-y-5">
          {/* API Token */}
          <div className="bg-[var(--ds-bg-surface)] rounded-2xl border border-[var(--ds-border-sub)] p-5 space-y-3">
            <p className="text-xs font-black uppercase tracking-wider" style={{ color: 'var(--ds-text-3)' }}>API Token</p>
            <p className="text-sm font-medium leading-relaxed" style={{ color: 'var(--ds-text-4)' }}>
              Flash this into every ESP32 as the <code className="font-mono text-xs px-1.5 py-0.5 rounded" style={{ background: 'var(--ds-bg-raised)' }}>X-Sensor-Token</code> header. Shared across all rooms.
            </p>
            <div className="flex items-center gap-2 p-3 rounded-xl" style={{ background: 'var(--ds-bg-raised)', border: '1px solid var(--ds-border)' }}>
              <span className="material-symbols-outlined shrink-0" style={{ fontSize: 18, color: 'var(--ds-text-3)' }}>key</span>
              <code className="flex-1 min-w-0 text-sm font-mono truncate" style={{ color: 'var(--ds-text-2)' }}>{token || '—'}</code>
              <button onClick={() => token && navigator.clipboard.writeText(token).then(() => addInfoToast('Token copied'))}
                className="shrink-0 size-8 flex items-center justify-center rounded-lg transition-colors"
                style={{ background: 'var(--ds-bg-surface)', border: '1px solid var(--ds-border)' }} title="Copy">
                <span className="material-symbols-outlined" style={{ fontSize: 16, color: 'var(--ds-text-3)' }}>content_copy</span>
              </button>
            </div>
            {/* Danger zone */}
            <div className="rounded-2xl p-4 space-y-3" style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)' }}>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-red-500">Danger Zone</p>
              <div className="flex items-center justify-between gap-4">
                <p className="text-xs font-medium leading-relaxed" style={{ color: '#f87171' }}>
                  Regenerate token — all ESP32s must be reflashed afterwards.
                </p>
                <button onClick={() => { setRegenTokenModal(true); setRegenTokenInput('') }}
                  className="shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-black uppercase transition-colors"
                  style={{ background: 'var(--ds-bg-surface)', border: '1px solid rgba(239,68,68,0.4)', color: '#ef4444' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 14 }}>refresh</span>
                  Regenerate
                </button>
              </div>
            </div>
          </div>

          {/* Request format */}
          <div className="bg-[var(--ds-bg-surface)] rounded-2xl border border-[var(--ds-border-sub)] p-5 space-y-3">
            <p className="text-xs font-black uppercase tracking-wider" style={{ color: 'var(--ds-text-3)' }}>ESP32 Request</p>
            <div className="rounded-xl p-4" style={{ background: 'rgba(15,20,45,0.75)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <pre className="text-xs font-mono leading-relaxed whitespace-pre-wrap break-all" style={{ color: 'rgba(255,255,255,0.7)' }}>{`POST /api/sensor/ping\nX-Sensor-Token: ${token || '<token>'}\nContent-Type: application/json\n\n{ "sensor_code": "<room-sensor-code>" }`}</pre>
            </div>
            <button onClick={() => navigator.clipboard.writeText(`POST /api/sensor/ping\nX-Sensor-Token: ${token}\nContent-Type: application/json\n\n{ "sensor_code": "<room-sensor-code>" }`).then(() => addInfoToast('Request format copied'))}
              className="flex items-center gap-1.5 text-xs font-black" style={{ color: 'var(--ds-text-3)' }}>
              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>content_copy</span>
              Copy
            </button>
          </div>

          {/* Response codes */}
          <div className="bg-[var(--ds-bg-surface)] rounded-2xl border border-[var(--ds-border-sub)] p-5 space-y-3">
            <p className="text-xs font-black uppercase tracking-wider" style={{ color: 'var(--ds-text-3)' }}>Response Reference</p>
            <div className="space-y-2">
              {([
                { resp: '{ "confirmed": true, "booking_id": 42 }', note: '200 — confirmed',           color: '#22c55e' },
                { resp: '{ "confirmed": false }',                  note: '200 — no booking in window', color: 'var(--ds-text-3)' },
                { resp: '401 Unauthorized',                        note: 'Wrong token',                color: '#ef4444' },
                { resp: '403 Forbidden',                           note: 'Sensor mode off',            color: '#f59e0b' },
                { resp: '404 Not Found',                           note: 'Unknown sensor_code',        color: '#f59e0b' },
              ] as const).map((r, i) => (
                <div key={i} className="flex items-start gap-3 p-2.5 rounded-lg" style={{ background: 'var(--ds-bg-raised)', border: '1px solid var(--ds-border)' }}>
                  <code className="text-xs font-mono flex-1 min-w-0 break-all leading-relaxed" style={{ color: r.color }}>{r.resp}</code>
                  <span className="text-xs font-bold shrink-0 text-right" style={{ color: 'var(--ds-text-4)', minWidth: 100 }}>{r.note}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right column — Setup guide + Room codes */}
        <div className="space-y-5">
          {/* Setup guide */}
          <div className="bg-[var(--ds-bg-surface)] rounded-2xl border border-[var(--ds-border-sub)] p-5 space-y-3">
            <p className="text-xs font-black uppercase tracking-wider" style={{ color: 'var(--ds-text-3)' }}>Setup Guide</p>
            <div className="space-y-2">
              {([
                { n: '1', title: 'Enable sensor mode',   body: 'Settings → Anti-Ghost Booking → Detection Method → check Sensor.' },
                { n: '2', title: 'Copy API token',        body: "Copy the token on the left. It's shared by all ESP32s in your system." },
                { n: '3', title: 'Get the room code',     body: 'Each room below has a unique 16-char Sensor Code. Copy it for the matching ESP32.' },
                { n: '4', title: 'Flash the ESP32',       body: 'Set SERVER_URL, API_TOKEN (from step 2), and SENSOR_CODE (from step 3) in your firmware, then flash.' },
                { n: '5', title: 'Test the connection',   body: 'Power on the device. On motion it POSTs to /api/sensor/ping. If a booking is in the confirmation window, presence is auto-confirmed.' },
                { n: '6', title: 'Configure the window',  body: 'Settings → Confirmation Window sets how many minutes before/after start time sensors can confirm.' },
              ] as const).map(step => (
                <div key={step.n} className="flex gap-3 p-3.5 rounded-xl" style={{ background: 'var(--ds-bg-raised)', border: '1px solid var(--ds-border)' }}>
                  <div className="size-6 rounded-lg flex items-center justify-center shrink-0 mt-0.5" style={{ background: 'var(--ds-bg-surface-2)' }}>
                    <span className="text-xs font-black" style={{ color: 'var(--ds-text-3)' }}>{step.n}</span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-black" style={{ color: 'var(--ds-text-1)' }}>{step.title}</p>
                    <p className="text-xs font-medium leading-relaxed mt-0.5" style={{ color: 'var(--ds-text-4)' }}>{step.body}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Room sensor codes */}
          <div className="bg-[var(--ds-bg-surface)] rounded-2xl border border-[var(--ds-border-sub)] p-5 space-y-3">
            <p className="text-xs font-black uppercase tracking-wider" style={{ color: 'var(--ds-text-3)' }}>Room Sensor Codes</p>

            {/* Building filter */}
            {sensorBuildings.length > 0 && (
              <div className="flex gap-1.5 flex-wrap">
                <button onClick={() => setSensorBuildingFilter(null)}
                  className="px-3 py-1 rounded-xl text-xs font-black uppercase tracking-wide transition-all"
                  style={{
                    background: sensorBuildingFilter === null ? '#111827' : 'var(--ds-bg-raised)',
                    color: sensorBuildingFilter === null ? '#adee2b' : 'var(--ds-text-3)',
                    border: sensorBuildingFilter === null ? '1px solid transparent' : '1px solid var(--ds-border)',
                  }}>All</button>
                {sensorBuildings.map(b => (
                  <button key={b.id} onClick={() => setSensorBuildingFilter(sensorBuildingFilter === b.id ? null : b.id)}
                    className="px-3 py-1 rounded-xl text-xs font-black uppercase tracking-wide transition-all"
                    style={{
                      background: sensorBuildingFilter === b.id ? '#111827' : 'var(--ds-bg-raised)',
                      color: sensorBuildingFilter === b.id ? '#adee2b' : 'var(--ds-text-3)',
                      border: sensorBuildingFilter === b.id ? '1px solid transparent' : '1px solid var(--ds-border)',
                    }}>{b.code ?? b.name}</button>
                ))}
              </div>
            )}

            <div className="space-y-2 max-h-80 overflow-y-auto pr-1" style={{ scrollbarWidth: 'thin' }}>
              {sensorRooms.length === 0 ? (
                <p className="text-sm text-[var(--ds-text-4)] py-2">No active rooms found.</p>
              ) : sensorRooms.map(room => {
                const bldg = sensorBuildings.find(b => b.id === room.building_id)
                return (
                  <div key={room.id} className="flex items-center gap-2.5 p-3 rounded-xl" style={{ background: 'var(--ds-bg-raised)', border: '1px solid var(--ds-border)' }}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <p className="text-sm font-black truncate" style={{ color: 'var(--ds-text-1)' }}>{room.name}</p>
                        {bldg && sensorBuildingFilter === null && (
                          <span className="text-[9px] font-black px-1.5 py-0.5 rounded-md shrink-0"
                            style={{ background: 'var(--ds-bg-surface-2)', color: 'var(--ds-text-4)' }}>
                            {bldg.code ?? bldg.name}
                          </span>
                        )}
                      </div>
                      <code className="text-xs font-mono" style={{ color: 'var(--ds-text-3)' }}>{room.sensor_code ?? '—'}</code>
                    </div>
                    <button onClick={() => room.sensor_code && navigator.clipboard.writeText(room.sensor_code).then(() => addInfoToast(`Code copied: ${room.name}`))}
                      className="size-8 flex items-center justify-center rounded-lg shrink-0 transition-colors hover:bg-[var(--ds-bg-surface)]"
                      title="Copy sensor code">
                      <span className="material-symbols-outlined" style={{ fontSize: 15, color: 'var(--ds-text-3)' }}>content_copy</span>
                    </button>
                    <button onClick={() => handleRegenCode(room)}
                      disabled={regeneratingSensor === room.id}
                      className="size-8 flex items-center justify-center rounded-lg shrink-0 transition-colors disabled:opacity-50"
                      style={{ color: '#ef4444' }}
                      title="Regenerate — must reflash ESP32">
                      {regeneratingSensor === room.id
                        ? <span className="material-symbols-outlined animate-spin" style={{ fontSize: 15 }}>progress_activity</span>
                        : <span className="material-symbols-outlined" style={{ fontSize: 15 }}>refresh</span>}
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Regenerate token confirm modal */}
      {regenTokenModal && createPortal(
        <div className="fixed inset-0 z-[1000] flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(16px)' }}
          onClick={() => { setRegenTokenModal(false); setRegenTokenInput('') }}>
          <div className="w-[420px] rounded-[2rem] overflow-hidden shadow-2xl"
            style={{ background: 'var(--ds-bg-surface)', border: '1px solid rgba(128,128,128,0.15)' }}
            onClick={e => e.stopPropagation()}>
            <div className="px-7 pt-7 pb-5 border-b flex items-center gap-3" style={{ background: 'rgba(239,68,68,0.08)', borderColor: 'rgba(239,68,68,0.15)' }}>
              <div className="size-10 rounded-2xl bg-red-100 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-red-500" style={{ fontSize: 22 }}>key_off</span>
              </div>
              <div>
                <p className="text-base font-black text-[var(--ds-text-1)]">Regenerate Sensor API Token</p>
                <p className="text-[11px] text-[var(--ds-text-2)]">All ESP32s will stop working until reflashed.</p>
              </div>
            </div>
            <div className="px-7 py-6 space-y-5">
              <p className="text-sm text-[var(--ds-text-2)] leading-relaxed">
                The current token will be <span className="font-black text-red-500">immediately invalidated</span>. Every ESP32 in your system must be reflashed with the new token before presence detection resumes.
              </p>
              <div className="space-y-1.5">
                <p className="text-[10px] font-black text-[var(--ds-text-2)] uppercase tracking-wider">Confirm action</p>
                <p className="text-[11px] text-[var(--ds-text-2)]">Type <span className="font-black text-red-500 font-mono">Regenerate</span> to confirm</p>
                <input
                  type="text"
                  value={regenTokenInput}
                  onChange={e => setRegenTokenInput(e.target.value)}
                  placeholder="Regenerate"
                  autoFocus
                  onKeyDown={e => { if (e.key === 'Enter' && regenTokenInput === 'Regenerate') handleRegenToken() }}
                  className="w-full px-4 py-3 rounded-xl border border-[var(--ds-border)] text-[13px] font-semibold focus:outline-none focus:ring-2 focus:ring-red-300 focus:border-red-300 placeholder:text-[var(--ds-text-3)] bg-[var(--ds-bg-raised)] text-[var(--ds-text-1)]"
                />
              </div>
              <div className="flex gap-3 justify-end">
                <button onClick={() => { setRegenTokenModal(false); setRegenTokenInput('') }}
                  className="px-5 py-2.5 rounded-xl border border-[var(--ds-border)] text-[var(--ds-text-2)] text-[11px] font-black uppercase hover:bg-[var(--ds-bg-raised)] transition-colors">
                  Cancel
                </button>
                <button onClick={handleRegenToken}
                  disabled={regenTokenInput !== 'Regenerate' || regenTokenLoading}
                  className="px-5 py-2.5 rounded-xl bg-red-500 text-white text-[11px] font-black uppercase hover:bg-red-600 disabled:opacity-40 transition-all flex items-center gap-2">
                  {regenTokenLoading && <span className="material-symbols-outlined animate-spin" style={{ fontSize: 13 }}>progress_activity</span>}
                  Regenerate Token
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

function DisputesTab() {
  const qc = useQueryClient()
  const [statusFilter, setStatusFilter] = useState<'pending' | 'resolved'>('pending')
  const [resolvingId, setResolvingId] = useState<number | null>(null)

  const { data: disputes = [], isLoading } = useQuery<Booking[]>({
    queryKey: ['disputes', statusFilter],
    queryFn: () => getDisputes(statusFilter),
    staleTime: 30_000,
  })

  function parseLocal(s: string) { return new Date(s.replace('T', ' ').replace('Z', '')) }
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

  const pendingCount = statusFilter === 'pending' ? disputes.length : 0

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

// ── Main AdminPage ───────────────────────────────────────────────────────────
export default function AdminPage() {
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'
  const isBuildingAdmin = user?.role === 'building_admin'
  const [tab, setTab] = useState<Tab>(isBuildingAdmin ? 'buildings' : 'overview')
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  // Read anti_ghost_enabled to gate Disputes tab visibility
  const { data: rootSettings } = useQuery({
    queryKey: ['settings-general'],
    queryFn: getGeneralSettings,
    staleTime: 5 * 60_000,
  })
  const antiGhostActive = rootSettings?.anti_ghost_enabled ?? false

  // If anti-ghost gets disabled while on Disputes tab, bounce back to overview
  useEffect(() => {
    if (!antiGhostActive && tab === 'disputes') setTab('overview')
  }, [antiGhostActive, tab])

  // Overview
  const [overviewPeriod, setOverviewPeriod]   = useState<7 | 30>(7)
  const [statusPeriod, setStatusPeriod]       = useState<SectionPeriod>('month')
  const [roomsPeriod, setRoomsPeriod]         = useState<SectionPeriod>('month')
  const [hoursPeriod, setHoursPeriod]         = useState<SectionPeriod>('month')
  const [overviewBuilding, setOverviewBuilding] = useState<number | null>(null)
  const [storageLimitMb, setStorageLimitMb] = useState(5120)
  const [storageLimitRaw, setStorageLimitRaw] = useState('5120')
  const [storageLimitOpen, setStorageLimitOpen] = useState(false)
  const [exportModal, setExportModal]         = useState(false)
  const [exportMonth, setExportMonth]         = useState(() => new Date().toISOString().slice(0, 7))
  const [exportAllTime, setExportAllTime]     = useState(false)
  const [exportBuildingIds, setExportBuildingIds] = useState<number[]>([])
  const [exporting, setExporting]             = useState(false)
  const [chartSettingsOpen, setChartSettingsOpen] = useState(false)

  const { data: overviewBuildingsList = [] } = useQuery({
    queryKey: ['buildings'],
    queryFn: getBuildings,
    staleTime: 300_000,
    enabled: tab === 'overview',
  })

  const { data: chartGeneral } = useQuery({ queryKey: ['settings-general'], queryFn: getGeneralSettings, staleTime: 60_000 })
  const parsedChartColors = useMemo(() => { try { return JSON.parse(chartGeneral?.chart_colors ?? '{}') } catch { return {} } }, [chartGeneral?.chart_colors])
  const cc = {
    trend:     (parsedChartColors.trend     ?? '#6366f1') as string,
    confirmed: (parsedChartColors.confirmed ?? '#adee2b') as string,
    tentative: (parsedChartColors.tentative ?? '#f59e0b') as string,
    cancelled: (parsedChartColors.cancelled ?? '#ef4444') as string,
    rooms:     (parsedChartColors.rooms     ?? '#6366f1') as string,
    hours:     (parsedChartColors.hours     ?? '#adee2b') as string,
  }
  const peakFrom = chartGeneral?.chart_peak_hour_from ?? 0
  const peakTo   = chartGeneral?.chart_peak_hour_to   ?? 23

  const { data: overviewData, isLoading: overviewLoading } = useQuery({
    queryKey: ['analytics-overview', overviewPeriod, statusPeriod, roomsPeriod, hoursPeriod, overviewBuilding],
    queryFn: () => getAnalyticsOverview(overviewPeriod, statusPeriod, roomsPeriod, hoursPeriod, overviewBuilding),
    staleTime: 60_000,
    enabled: tab === 'overview',
  })

  const peakHoursFull = useMemo(() => {
    const map = new Map((overviewData?.peak_hours ?? []).map(h => [h.hour, h.count]))
    return Array.from({ length: 24 }, (_, i) => ({ hour: i, count: map.get(i) ?? 0 }))
      .filter(h => h.hour >= peakFrom && h.hour <= peakTo)
  }, [overviewData?.peak_hours, peakFrom, peakTo])

  const qc = useQueryClient()
  async function saveChartColor(key: string, value: string) {
    const next = { ...parsedChartColors, [key]: value }
    await updateGeneralSettings({ chart_colors: JSON.stringify(next) })
    qc.invalidateQueries({ queryKey: ['settings-general'] })
  }
  async function saveChartPeakHour(from: number, to: number) {
    await updateGeneralSettings({ chart_peak_hour_from: from, chart_peak_hour_to: to })
    qc.invalidateQueries({ queryKey: ['settings-general'] })
  }

  async function handleExport() {
    setExporting(true)
    try {
      const buildingIds = exportBuildingIds.length > 0 ? exportBuildingIds : undefined
      if (exportAllTime) {
        await downloadAnalyticsExport({ building_ids: buildingIds })
      } else {
        const [y, m] = exportMonth.split('-').map(Number)
        const from = `${exportMonth}-01`
        const lastDay = new Date(y, m, 0).getDate()
        const to = `${exportMonth}-${String(lastDay).padStart(2, '0')}`
        await downloadAnalyticsExport({ from, to, building_ids: buildingIds })
      }
      setExportModal(false)
    } finally { setExporting(false) }
  }

  function SectionPill({ value, onChange }: { value: SectionPeriod; onChange: (v: SectionPeriod) => void }) {
    return (
      <div className="flex gap-0.5 p-0.5 rounded-xl" style={{ background: 'var(--ds-bg-raised)' }}>
        {(['month', 'all'] as const).map(p => (
          <button key={p} onClick={() => onChange(p)}
            className="text-[8px] font-black px-2.5 py-1 rounded-[9px] transition-all uppercase tracking-wide"
            style={{ background: value === p ? 'var(--ds-bg-surface)' : 'transparent', color: value === p ? 'var(--ds-text-1)' : 'var(--ds-text-4)', boxShadow: value === p ? '0 1px 3px rgba(0,0,0,0.1)' : 'none' }}>
            {p === 'month' ? 'This Month' : 'All Time'}
          </button>
        ))}
      </div>
    )
  }

  // building_admin gets a reduced, building-scoped menu: Buildings & Rooms, Users (view-only), Activity Log.
  // Everything else (Overview, Archive, Kiosk, Sensor, Settings, Disputes) is admin-only.
  const mainTabs: { key: Tab; label: string; icon: string }[] = isBuildingAdmin
    ? [
        { key: 'buildings', label: 'Buildings', icon: 'domain' },
        { key: 'users',     label: 'Users',     icon: 'group' },
        { key: 'activity',  label: 'Activity',  icon: 'history' },
      ]
    : [
        { key: 'overview',   label: 'Overview',   icon: 'dashboard' },
        { key: 'buildings',  label: 'Buildings',  icon: 'domain' },
        { key: 'users',      label: 'Users',      icon: 'group' },
        { key: 'archive',    label: 'Archive',    icon: 'archive' },
        { key: 'kiosk',      label: 'Kiosk',      icon: 'tablet' },
        { key: 'sensor',     label: 'Sensor',     icon: 'sensors' },
        { key: 'activity',   label: 'Activity',   icon: 'history' },
        ...(antiGhostActive ? [{ key: 'disputes' as Tab, label: 'Disputes', icon: 'gavel' }] : []),
      ]
  const settingsTabDef = isAdmin ? { key: 'settings' as Tab, label: 'Settings', icon: 'tune' } : null
  const tabs = [...mainTabs, ...(settingsTabDef ? [settingsTabDef] : [])]

  // Sidebar sliding pill
  const sidebarNavRef  = useRef<HTMLDivElement>(null)
  const sidebarBtnRefs = useRef<Record<string, HTMLButtonElement | null>>({})
  const [pillY, setPillY] = useState(0)
  const [pillH, setPillH] = useState(36)
  const [sidebarTooltip, setSidebarTooltip] = useState<{ label: string; y: number } | null>(null)
  useEffect(() => {
    const measure = () => {
      const nav = sidebarNavRef.current
      const btn = sidebarBtnRefs.current[tab]
      if (!nav || !btn) return
      const navRect = nav.getBoundingClientRect()
      const btnRect = btn.getBoundingClientRect()
      setPillY(btnRect.top - navRect.top)
      setPillH(btnRect.height)
    }
    measure()
    const raf = requestAnimationFrame(measure)
    // Re-measure after collapse transition finishes (300ms easing)
    const timer = setTimeout(measure, 320)
    window.addEventListener('resize', measure)
    return () => { cancelAnimationFrame(raf); clearTimeout(timer); window.removeEventListener('resize', measure) }
  }, [tab, sidebarCollapsed])

  return (
    <div className="flex flex-1 overflow-hidden bg-[var(--ds-bg-surface)]">
      <style>{`
        @keyframes admin-tab-in {
          from { opacity: 0; transform: translateY(10px) }
          to   { opacity: 1; transform: translateY(0) }
        }
        .admin-tab-in { animation: admin-tab-in 0.22s cubic-bezier(0.4,0,0.2,1) both }

        @keyframes admin-modal-in {
          from { opacity: 0; transform: translateY(20px) scale(0.96) }
          to   { opacity: 1; transform: translateY(0) scale(1) }
        }
        .admin-modal-in { animation: admin-modal-in 0.25s cubic-bezier(0.34,1.15,0.64,1) both }

        @keyframes admin-backdrop-in {
          from { opacity: 0 }
          to   { opacity: 1 }
        }
        .admin-backdrop-in { animation: admin-backdrop-in 0.18s ease both }

        @keyframes admin-dropdown-in {
          from { opacity: 0; transform: translateY(-6px) }
          to   { opacity: 1; transform: translateY(0) }
        }
        .admin-dropdown-in { animation: admin-dropdown-in 0.2s cubic-bezier(0.4,0,0.2,1) both }
      `}</style>
      {/* Sidebar */}
      <div className={`shrink-0 p-3 transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] ${sidebarCollapsed ? 'w-[68px]' : 'w-[196px]'}`}>
        <div className="h-full flex flex-col rounded-3xl py-3 px-2"
          style={{ background: 'rgba(15,20,45,0.92)', border: '1px solid rgba(255,255,255,0.07)', boxShadow: '0 8px 40px rgba(0,0,0,0.18)', transform: 'translateZ(0)', willChange: 'transform' }}>

          {/* Label */}
          <div className={`px-2 mb-2 transition-all duration-200 overflow-hidden ${sidebarCollapsed ? 'h-0 opacity-0 pointer-events-none' : 'h-6 opacity-100'}`}>
            <p className="text-[8px] font-black uppercase tracking-[0.35em] whitespace-nowrap" style={{ color: 'rgba(255,255,255,0.2)' }}>Admin Panel</p>
          </div>

          {/* Nav items — all in one ref container for the sliding pill */}
          <div ref={sidebarNavRef} className="relative flex flex-col gap-0.5 flex-1">
            {/* Sliding pill */}
            <div className="absolute inset-x-1 rounded-2xl pointer-events-none"
              style={{ top: pillY, height: pillH, background: 'rgba(173,238,43,0.12)', border: '1px solid rgba(173,238,43,0.22)', boxShadow: 'inset 0 0 0 1px rgba(173,238,43,0.04)', transition: 'top 0.24s cubic-bezier(0.34,1.3,0.64,1), height 0.24s cubic-bezier(0.34,1.3,0.64,1)' }} />

            {mainTabs.map(t => {
              const active = tab === t.key
              return (
                <div key={t.key}>
                  <button ref={el => { sidebarBtnRefs.current[t.key] = el }} onClick={() => setTab(t.key)}
                    onMouseEnter={sidebarCollapsed ? e => setSidebarTooltip({ label: t.label, y: e.currentTarget.getBoundingClientRect().top + e.currentTarget.getBoundingClientRect().height / 2 }) : undefined}
                    onMouseLeave={sidebarCollapsed ? () => setSidebarTooltip(null) : undefined}
                    className={`w-full flex items-center gap-3 rounded-2xl transition-colors duration-150 overflow-hidden relative
                      ${sidebarCollapsed ? 'justify-center py-3 px-0' : 'px-3 py-2.5'}`}>
                    <span className="material-symbols-outlined shrink-0 transition-colors duration-200" style={{ fontSize: 19, color: active ? '#adee2b' : 'rgba(255,255,255,0.3)' }}>{t.icon}</span>
                    {!sidebarCollapsed && (
                      <span className="text-[10px] font-black uppercase tracking-wide whitespace-nowrap transition-colors duration-200" style={{ color: active ? '#fff' : 'rgba(255,255,255,0.4)' }}>{t.label}</span>
                    )}
                  </button>
                </div>
              )
            })}

            {/* Settings — pinned at bottom */}
            {settingsTabDef && (() => {
              const active = tab === settingsTabDef.key
              return (
                <div className="mt-auto pt-2" style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
                  <button ref={el => { sidebarBtnRefs.current[settingsTabDef.key] = el }} onClick={() => setTab(settingsTabDef.key)}
                    onMouseEnter={sidebarCollapsed ? e => setSidebarTooltip({ label: settingsTabDef.label, y: e.currentTarget.getBoundingClientRect().top + e.currentTarget.getBoundingClientRect().height / 2 }) : undefined}
                    onMouseLeave={sidebarCollapsed ? () => setSidebarTooltip(null) : undefined}
                    className={`w-full flex items-center gap-3 rounded-2xl transition-colors duration-150 overflow-hidden relative
                      ${sidebarCollapsed ? 'justify-center py-3 px-0' : 'px-3 py-2.5'}`}>
                    <span className="material-symbols-outlined shrink-0 transition-colors duration-200" style={{ fontSize: 19, color: active ? '#adee2b' : 'rgba(255,255,255,0.3)' }}>{settingsTabDef.icon}</span>
                    {!sidebarCollapsed && (
                      <span className="text-[10px] font-black uppercase tracking-wide whitespace-nowrap transition-colors duration-200" style={{ color: active ? '#fff' : 'rgba(255,255,255,0.4)' }}>{settingsTabDef.label}</span>
                    )}
                  </button>
                </div>
              )
            })()}
          </div>

          {/* Fixed tooltip portal — outside overflow-hidden containers */}
          {sidebarCollapsed && sidebarTooltip && (
            <ModalPortal>
              <div className="pointer-events-none" style={{ position: 'fixed', left: 76, top: sidebarTooltip.y, transform: 'translateY(-50%)', zIndex: 9999 }}>
                <div className="px-3.5 py-2 rounded-xl whitespace-nowrap"
                  style={{ background: 'rgba(15,20,45,0.96)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 8px 24px rgba(0,0,0,0.3)' }}>
                  <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: '#fff' }}>{sidebarTooltip.label}</span>
                </div>
              </div>
            </ModalPortal>
          )}

          {/* Toggle */}
          <div className="pt-2 mt-2" style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
            <button onClick={() => setSidebarCollapsed(s => !s)}
              className="w-full flex items-center justify-center py-2 rounded-xl transition-all"
              style={{ color: 'rgba(255,255,255,0.2)' }}
              onMouseEnter={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.6)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.2)')}>
              <span className="material-symbols-outlined" style={{ fontSize: 15 }}>
                {sidebarCollapsed ? 'keyboard_double_arrow_right' : 'keyboard_double_arrow_left'}
              </span>
            </button>
          </div>

        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-8" style={{ scrollbarWidth: 'thin', willChange: 'scroll-position' }}>

        {tab === 'overview' && (
          <div className="max-w-5xl space-y-6 admin-tab-in">
            <div className="flex items-end justify-between">
              <div>
                <p className="text-[9px] font-black uppercase tracking-[0.25em] text-[var(--ds-text-3)] mb-1">Admin Dashboard</p>
                <h1 className="text-3xl font-black italic tracking-tighter uppercase">Overview</h1>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => setChartSettingsOpen(true)}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-wide transition-all hover:opacity-80"
                  style={{ background: 'var(--ds-bg-surface)', border: '1px solid var(--ds-border-sub)', color: 'var(--ds-text-2)' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 15 }}>palette</span>Chart
                </button>
                <button onClick={() => setExportModal(true)}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-wide transition-all hover:opacity-80"
                  style={{ background: 'var(--ds-bg-surface)', border: '1px solid var(--ds-border-sub)', color: 'var(--ds-text-2)' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 15 }}>download</span>Export
                </button>
              </div>
            </div>

            {overviewLoading ? (
              <div className="flex items-center justify-center py-20">
                <span className="material-symbols-outlined animate-spin text-[var(--ds-text-4)]" style={{ fontSize: 32 }}>progress_activity</span>
              </div>
            ) : overviewData && (<>
              {/* ── Global stats: Unique Visitors + Storage (no building filter) ── */}
              <div className="grid grid-cols-2 gap-4">
                {/* Unique visitors */}
                <div className="rounded-2xl border border-[var(--ds-border-sub)] p-5"
                  style={{ background: 'var(--ds-bg-surface)' }}>
                  <div className="flex items-center gap-2 mb-4">
                    <div className="size-8 rounded-xl flex items-center justify-center" style={{ background: 'rgba(99,102,241,0.1)' }}>
                      <span className="material-symbols-outlined" style={{ fontSize: 16, color: '#6366f1', fontVariationSettings: "'FILL' 1" }}>group</span>
                    </div>
                    <div>
                      <p className="text-[9px] font-black uppercase tracking-[0.18em] text-[var(--ds-text-3)]">Unique Visitors</p>
                      <p className="text-[10px] font-bold text-[var(--ds-text-4)]">Active users by period — all buildings</p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {([
                      { label: 'Today', val: overviewData.stats.unique_visitors_today },
                      { label: 'This Week', val: overviewData.stats.unique_visitors_week },
                      { label: 'This Month', val: overviewData.stats.unique_visitors_month },
                      { label: 'All Time', val: overviewData.stats.unique_visitors_all ?? 0 },
                    ] as const).map(item => (
                      <div key={item.label} className="flex items-center justify-between px-3 py-2.5 rounded-xl" style={{ background: 'var(--ds-bg-raised)' }}>
                        <span className="text-[11px] font-bold text-[var(--ds-text-3)]">{item.label}</span>
                        <span className="text-[15px] font-black text-[var(--ds-text-1)] tabular-nums">{item.val.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Storage */}
                {overviewData.stats.storage && (() => {
                  const s = overviewData.stats.storage
                  const fmtMb = (mb: number) => mb >= 1024 ? `${(mb / 1024).toFixed(2)} GB` : `${mb.toFixed(2)} MB`
                  const totalMb = s.db_mb + s.uploads_mb + (s.logs_mb ?? 0)
                  const usedPct = storageLimitMb > 0 ? Math.min(100, (totalMb / storageLimitMb) * 100) : 0
                  const isWarn = usedPct >= 70 && usedPct < 90
                  const isCrit = usedPct >= 90
                  const totalBarColor = isCrit ? '#ef4444' : isWarn ? '#f59e0b' : '#adee2b'
                  const bars = [
                    { label: 'Database',    mb: s.db_mb,           color: '#6366f1' },
                    { label: 'Room Photos', mb: s.room_photos_mb,  color: '#3b82f6' },
                    { label: 'Avatars',     mb: s.avatars_mb,      color: '#a855f7' },
                    { label: 'Activity Log', mb: s.logs_mb ?? 0,  color: '#f59e0b' },
                  ]
                  return (
                    <div className="rounded-2xl border border-[var(--ds-border-sub)] p-5"
                      style={{ background: 'var(--ds-bg-surface)' }}>
                      {/* Header */}
                      <div className="flex items-center gap-2 mb-3">
                        <div className="size-8 rounded-xl flex items-center justify-center" style={{ background: 'rgba(239,68,68,0.1)' }}>
                          <span className="material-symbols-outlined" style={{ fontSize: 16, color: '#ef4444', fontVariationSettings: "'FILL' 1" }}>database</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[9px] font-black uppercase tracking-[0.18em] text-[var(--ds-text-3)]">Storage Usage</p>
                          <p className="text-[10px] font-bold text-[var(--ds-text-4)]">Total uploads: {fmtMb(s.uploads_mb)} · DB: {fmtMb(s.db_mb)}</p>
                        </div>
                      </div>

                      {/* Total vs limit bar */}
                      <div className="mb-4 p-3 rounded-xl border" style={{ borderColor: 'var(--ds-border-sub)' }}>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-[10px] font-black text-[var(--ds-text-2)]">
                            {fmtMb(totalMb)}
                            <span className="text-[var(--ds-text-4)] font-bold"> / {fmtMb(storageLimitMb)}</span>
                          </span>
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] font-black tabular-nums" style={{ color: totalBarColor }}>
                              {usedPct.toFixed(1)}%
                            </span>
                            {/* (i) tooltip */}
                            <div className="relative group">
                              <button type="button" className="size-4 rounded-full flex items-center justify-center text-[9px] font-black leading-none border transition-colors"
                                style={{ borderColor: 'var(--ds-border)', color: 'var(--ds-text-4)', background: 'var(--ds-bg-surface-2)' }}>
                                i
                              </button>
                              <div className="absolute right-0 top-5 z-50 w-52 p-2.5 rounded-xl shadow-xl pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-150 text-[10px] font-medium leading-relaxed"
                                style={{ background: 'rgba(15,20,45,0.92)', backdropFilter: 'blur(12px)', color: 'rgba(255,255,255,0.75)', border: '1px solid rgba(255,255,255,0.08)' }}>
                                This limit only affects the chart display. It has no effect on actual folder size or server storage capacity.
                              </div>
                            </div>
                            {/* Settings toggle */}
                            <button type="button"
                              onClick={() => setStorageLimitOpen(o => !o)}
                              className="size-5 rounded-lg flex items-center justify-center transition-colors"
                              style={{ background: storageLimitOpen ? '#adee2b' : 'var(--ds-bg-surface-2)', color: storageLimitOpen ? '#000' : 'var(--ds-text-4)' }}>
                              <span className="material-symbols-outlined" style={{ fontSize: 12 }}>tune</span>
                            </button>
                          </div>
                        </div>
                        <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--ds-bg-surface-2)' }}>
                          <div className="h-full rounded-full transition-all duration-700"
                            style={{ width: `${Math.max(2, usedPct)}%`, background: totalBarColor }} />
                        </div>

                        {/* Accordion: limit settings */}
                        {storageLimitOpen && (
                          <div className="mt-3 pt-3 border-t flex items-center gap-1.5 flex-wrap" style={{ borderColor: 'var(--ds-border-sub)' }}>
                            <span className="text-[9px] font-black uppercase tracking-wider text-[var(--ds-text-4)]">Limit</span>
                            <input
                              type="text"
                              inputMode="numeric"
                              value={storageLimitRaw}
                              onChange={e => {
                                const raw = e.target.value.replace(/\D/g, '')
                                setStorageLimitRaw(raw)
                                const v = parseInt(raw)
                                if (!isNaN(v) && v > 0) setStorageLimitMb(v)
                              }}
                              onBlur={e => {
                                const v = parseInt(e.target.value)
                                const clamped = isNaN(v) || v <= 0 ? 5120 : v
                                setStorageLimitMb(clamped)
                                setStorageLimitRaw(String(clamped))
                              }}
                              className="w-20 text-[10px] font-black text-center tabular-nums bg-transparent border-b focus:outline-none transition-colors"
                              style={{ borderColor: 'var(--ds-border)', caretColor: '#adee2b' }}
                              onFocus={e => { e.target.style.borderColor = '#adee2b'; e.target.select() }}
                              onBlurCapture={e => { e.target.style.borderColor = 'var(--ds-border)' }}
                            />
                            <span className="text-[9px] font-bold text-[var(--ds-text-4)]">MB</span>
                            {[1024, 5120, 10240, 20480].map(preset => (
                              <button key={preset} type="button"
                                onClick={() => { setStorageLimitMb(preset); setStorageLimitRaw(String(preset)) }}
                                className="text-[8px] font-black uppercase px-1.5 py-0.5 rounded-md transition-colors"
                                style={{
                                  background: storageLimitMb === preset ? '#adee2b' : 'var(--ds-bg-surface-2)',
                                  color: storageLimitMb === preset ? '#000' : 'var(--ds-text-4)',
                                }}>
                                {preset >= 1024 ? `${preset / 1024}G` : `${preset}M`}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Per-segment bars (relative to limit) */}
                      <div className="space-y-2.5">
                        {bars.map(b => {
                          const pct = storageLimitMb > 0 ? Math.min(100, (b.mb / storageLimitMb) * 100) : 0
                          return (
                            <div key={b.label}>
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-[10px] font-bold text-[var(--ds-text-2)]">{b.label}</span>
                                <span className="text-[10px] font-black text-[var(--ds-text-1)]">{fmtMb(b.mb)}</span>
                              </div>
                              <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--ds-bg-raised)' }}>
                                <div className="h-full rounded-full transition-all duration-700"
                                  style={{ width: `${Math.max(pct > 0 ? 2 : 0, pct)}%`, background: b.color }} />
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })()}
              </div>

              {/* ── Divider ── */}
              <div className="border-t border-[var(--ds-border-sub)]" />

              {/* ── Building filter toggle ── */}
              {overviewBuildingsList.length > 0 && (
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="text-[9px] font-black uppercase tracking-[0.18em] text-[var(--ds-text-3)] shrink-0">Filter by building</span>
                  <div className="flex gap-1.5 flex-wrap">
                    <button
                      onClick={() => setOverviewBuilding(null)}
                      className="px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wide transition-all"
                      style={{
                        background: overviewBuilding === null ? '#111827' : 'var(--ds-bg-raised)',
                        color: overviewBuilding === null ? '#adee2b' : 'var(--ds-text-3)',
                        border: overviewBuilding === null ? '1px solid transparent' : '1px solid var(--ds-border)',
                      }}>
                      All
                    </button>
                    {overviewBuildingsList.map(b => (
                      <button key={b.id}
                        onClick={() => setOverviewBuilding(overviewBuilding === b.id ? null : b.id)}
                        className="px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wide transition-all"
                        style={{
                          background: overviewBuilding === b.id ? '#111827' : 'var(--ds-bg-raised)',
                          color: overviewBuilding === b.id ? '#adee2b' : 'var(--ds-text-3)',
                          border: overviewBuilding === b.id ? '1px solid transparent' : '1px solid var(--ds-border)',
                        }}>
                        {b.code ?? b.name}
                      </button>
                    ))}
                  </div>
                  {overviewBuilding !== null && (
                    <span className="text-[10px] text-[var(--ds-text-4)] font-bold">
                      {overviewBuildingsList.find(b => b.id === overviewBuilding)?.name}
                    </span>
                  )}
                </div>
              )}

              {/* ── Stats (filtered by building) ── */}
              <div className="grid grid-cols-4 gap-4">
                <StatCard label="Total Bookings" value={String(overviewData.stats.total_bookings)} sub={overviewBuilding ? 'this building' : 'all time'} dark />
                <StatCard label="Confirmed" value={String(overviewData.stats.confirmed)} sub="bookings" />
                <StatCard label="Active Rooms" value={String(overviewData.stats.active_rooms)} sub={overviewBuilding ? 'in building' : 'available'} />
                <StatCard label="Users" value={String(overviewData.stats.total_users)} sub="registered" />
              </div>

              {/* Trend + Status */}
              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-2 rounded-2xl border border-[var(--ds-border-sub)] p-5 overflow-hidden relative"
                  style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.08) 0%, var(--ds-bg-surface) 60%)' }}>
                  <div className="flex items-center justify-between mb-5">
                    <div>
                      <p className="text-[9px] font-black uppercase tracking-[0.2em] text-[var(--ds-text-3)]">Booking Trend</p>
                      <p className="text-[11px] font-black text-[var(--ds-text-2)] mt-0.5">Last {overviewPeriod === 7 ? '7 days' : '30 days'}</p>
                    </div>
                    <div className="flex gap-0.5 p-0.5 rounded-xl" style={{ background: 'var(--ds-bg-raised)' }}>
                      {([7, 30] as const).map(p => (
                        <button key={p} onClick={() => setOverviewPeriod(p)}
                          className="text-[8px] font-black px-2.5 py-1 rounded-[9px] transition-all uppercase tracking-wide"
                          style={{ background: overviewPeriod === p ? 'var(--ds-bg-surface)' : 'transparent', color: overviewPeriod === p ? 'var(--ds-text-1)' : 'var(--ds-text-4)', boxShadow: overviewPeriod === p ? '0 1px 3px rgba(0,0,0,0.1)' : 'none' }}>
                          {p === 7 ? '7 Days' : '30 Days'}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div style={{ height: 150 }}>
                    <ResponsiveLine
                      data={[{ id: 'bookings', data: overviewData.trend.map(d => ({ x: d.date, y: d.count })) }]}
                      margin={{ top: 8, right: 8, bottom: 28, left: 36 }}
                      xScale={{ type: 'point' }}
                      yScale={{ type: 'linear', min: 0, nice: true }}
                      curve="monotoneX"
                      enableArea={true}
                      areaOpacity={1}
                      colors={[cc.trend]}
                      lineWidth={2.5}
                      enablePoints={false}
                      enableGridX={false}
                      gridYValues={4}
                      enableCrosshair={true}
                      crosshairType="x"
                      theme={{
                        grid: { line: { stroke: 'rgba(148,163,184,0.08)', strokeDasharray: '3 3' } },
                        axis: { ticks: { text: { fontSize: 9, fill: 'rgba(148,163,184,0.55)', fontWeight: 700 } }, domain: { line: { strokeWidth: 0 } } },
                        crosshair: { line: { stroke: 'rgba(99,102,241,0.35)', strokeWidth: 1 } },
                      }}
                      axisBottom={{
                        tickSize: 0,
                        tickPadding: 8,
                        tickValues: overviewData.trend.filter((_, i) => i % Math.ceil(overviewData.trend.length / 6) === 0).map(d => d.date),
                        format: (d: string) => new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
                      }}
                      axisLeft={{
                        tickSize: 0,
                        tickPadding: 8,
                        tickValues: 4,
                        format: (v: number) => Number.isInteger(v) ? String(v) : '',
                      }}
                      useMesh={true}
                      tooltip={({ point }) => (
                        <div style={{ background: 'rgba(15,20,45,0.95)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, fontSize: 11, color: '#fff', fontWeight: 700, padding: '8px 12px', whiteSpace: 'nowrap' }}>
                          {new Date(String(point.data.x)).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })} · {String(point.data.y)} bookings
                        </div>
                      )}
                      defs={[{ id: 'trendGrad', type: 'linearGradient', colors: [{ offset: 0, color: cc.trend, opacity: 0.22 }, { offset: 100, color: cc.trend, opacity: 0 }] }]}
                      fill={[{ match: '*', id: 'trendGrad' }]}
                    />
                  </div>
                </div>

                <div className="rounded-2xl border border-[var(--ds-border-sub)] p-5 flex flex-col"
                  style={{ background: 'var(--ds-bg-surface)' }}>
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="text-[9px] font-black uppercase tracking-[0.2em] text-[var(--ds-text-3)]">Status</p>
                      <p className="text-[11px] font-black text-[var(--ds-text-2)] mt-0.5">Breakdown</p>
                    </div>
                    <SectionPill value={statusPeriod} onChange={setStatusPeriod} />
                  </div>
                  <div style={{ height: 130 }}>
                    <ResponsivePie
                      data={overviewData.status_breakdown.length ? overviewData.status_breakdown.map(s => ({
                        id: s.status,
                        label: s.status,
                        value: s.count,
                        color: s.status === 'confirmed' ? cc.confirmed : s.status === 'tentative' ? cc.tentative : cc.cancelled,
                      })) : [{ id: 'empty', label: 'No data', value: 1, color: 'rgba(148,163,184,0.1)' }]}
                      margin={{ top: 8, right: 8, bottom: 8, left: 8 }}
                      innerRadius={0.68}
                      padAngle={3}
                      cornerRadius={2}
                      colors={{ datum: 'data.color' }}
                      borderWidth={0}
                      enableArcLabels={false}
                      enableArcLinkLabels={false}
                      activeOuterRadiusOffset={5}
                      tooltip={({ datum }) => datum.id === 'empty' ? <></> : (
                        <div style={{ background: 'rgba(15,20,45,0.95)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, fontSize: 11, color: '#fff', fontWeight: 700, padding: '8px 12px', whiteSpace: 'nowrap' }}>
                          <span style={{ color: datum.color }}>{datum.label}</span>: {datum.value}
                        </div>
                      )}
                      layers={['arcs', 'arcLabels', 'arcLinkLabels', 'legends', ({ centerX, centerY }) => {
                        const total = overviewData.status_breakdown.reduce((s, d) => s + d.count, 0)
                        return total > 0 ? (
                          <text x={centerX} y={centerY} textAnchor="middle" dominantBaseline="central" style={{ fontSize: 18, fontWeight: 900, fill: 'var(--ds-text-1)' }}>{total}</text>
                        ) : <></>
                      }]}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5 mt-2">
                    {overviewData.status_breakdown.map(s => (
                      <div key={s.status} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="size-2 rounded-full shrink-0" style={{ background: s.status === 'confirmed' ? cc.confirmed : s.status === 'tentative' ? cc.tentative : cc.cancelled }} />
                          <span className="text-[10px] font-bold capitalize text-[var(--ds-text-2)]">{s.status}</span>
                        </div>
                        <span className="text-[10px] font-black text-[var(--ds-text-1)]">{s.count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Top Rooms + Peak Hours */}
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-2xl border border-[var(--ds-border-sub)] p-5"
                  style={{ background: 'var(--ds-bg-surface)' }}>
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <p className="text-[9px] font-black uppercase tracking-[0.2em] text-[var(--ds-text-3)]">Top Rooms</p>
                      <p className="text-[11px] font-black text-[var(--ds-text-2)] mt-0.5">Most booked</p>
                    </div>
                    <SectionPill value={roomsPeriod} onChange={setRoomsPeriod} />
                  </div>
                  <div style={{ height: 150 }}>
                    <ResponsiveBar
                      data={overviewData.top_rooms}
                      keys={['count']}
                      indexBy="room"
                      layout="horizontal"
                      margin={{ top: 0, right: 8, bottom: 4, left: 100 }}
                      colors={[cc.rooms]}
                      borderRadius={6}
                      enableGridX={false}
                      enableGridY={false}
                      axisTop={null}
                      axisRight={null}
                      axisBottom={null}
                      axisLeft={{ tickSize: 0, tickPadding: 8 }}
                      enableLabel={true}
                      label={d => `${d.value}`}
                      labelSkipWidth={18}
                      labelTextColor="#fff"
                      theme={{
                        axis: { ticks: { text: { fontSize: 9, fill: 'rgba(148,163,184,0.7)', fontWeight: 700 } }, domain: { line: { strokeWidth: 0 } } },
                        labels: { text: { fontSize: 9, fontWeight: 700 } },
                      }}
                      tooltip={({ indexValue, value }) => (
                        <div style={{ background: 'rgba(15,20,45,0.95)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, fontSize: 11, color: '#fff', fontWeight: 700, padding: '8px 12px', whiteSpace: 'nowrap' }}>
                          {indexValue}: {value}
                        </div>
                      )}
                    />
                  </div>
                </div>

                <div className="rounded-2xl border border-[var(--ds-border-sub)] p-5 overflow-hidden relative"
                  style={{ background: 'linear-gradient(135deg, rgba(173,238,43,0.06) 0%, var(--ds-bg-surface) 60%)' }}>
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <p className="text-[9px] font-black uppercase tracking-[0.2em] text-[var(--ds-text-3)]">Peak Hours</p>
                      <p className="text-[11px] font-black text-[var(--ds-text-2)] mt-0.5">Busiest booking times</p>
                    </div>
                    <SectionPill value={hoursPeriod} onChange={setHoursPeriod} />
                  </div>
                  <div style={{ height: 150 }}>
                    <ResponsiveBar
                      data={peakHoursFull}
                      keys={['count']}
                      indexBy="hour"
                      margin={{ top: 4, right: 4, bottom: 28, left: 36 }}
                      colors={[cc.hours]}
                      borderRadius={4}
                      padding={0.2}
                      enableGridX={false}
                      gridYValues={4}
                      axisTop={null}
                      axisRight={null}
                      axisBottom={{
                        tickSize: 0,
                        tickPadding: 8,
                        tickValues: Array.from({ length: 24 }, (_, i) => i).filter(h => h >= peakFrom && h <= peakTo && (h - peakFrom) % Math.max(1, Math.ceil((peakTo - peakFrom) / 6)) === 0),
                        format: (h: number) => `${h}:00`,
                      }}
                      axisLeft={{
                        tickSize: 0,
                        tickPadding: 8,
                        tickValues: 4,
                        format: (v: number) => Number.isInteger(v) ? String(v) : '',
                      }}
                      enableLabel={false}
                      theme={{
                        grid: { line: { stroke: 'rgba(148,163,184,0.08)', strokeDasharray: '3 3' } },
                        axis: { ticks: { text: { fontSize: 9, fill: 'rgba(148,163,184,0.55)', fontWeight: 700 } }, domain: { line: { strokeWidth: 0 } } },
                      }}
                      tooltip={({ indexValue, value }) => (
                        <div style={{ background: 'rgba(15,20,45,0.95)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, fontSize: 11, color: '#fff', fontWeight: 700, padding: '8px 12px', whiteSpace: 'nowrap' }}>
                          {indexValue}:00 · {value} bookings
                        </div>
                      )}
                      defs={[{ id: 'peakGrad', type: 'linearGradient', x1: '0%', y1: '0%', x2: '0%', y2: '100%', colors: [{ offset: 0, color: cc.hours, opacity: 1 }, { offset: 100, color: cc.hours, opacity: 0.7 }] }]}
                      fill={[{ match: '*', id: 'peakGrad' }]}
                    />
                  </div>
                </div>
              </div>
            </>)}
          </div>
        )}

        {/* Export Modal */}
        {exportModal && (
          <ModalPortal>
          <div className="fixed inset-0 z-[1000] flex items-center justify-center admin-backdrop-in" style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(12px)' }} onClick={() => setExportModal(false)}>
            <div className="rounded-3xl shadow-2xl w-[360px] p-7 space-y-5 admin-modal-in" style={{ background: 'var(--ds-bg-surface)', border: '1px solid var(--ds-border-sub)' }} onClick={e => e.stopPropagation()}>
              <div>
                <p className="text-[9px] font-black uppercase tracking-[0.2em] text-[var(--ds-text-3)]">Analytics</p>
                <h3 className="text-base font-black uppercase tracking-tight mt-0.5 text-[var(--ds-text-1)]">Export Bookings</h3>
              </div>

              <div className="space-y-4">
                {/* All time toggle */}
                <label className="flex items-center gap-3 cursor-pointer group">
                  <div className="relative shrink-0" onClick={() => setExportAllTime(v => !v)}>
                    <div className="w-9 h-5 rounded-full transition-colors" style={{ background: exportAllTime ? '#adee2b' : 'var(--ds-bg-surface-2)', border: '1px solid var(--ds-border)' }} />
                    <div className="absolute top-0.5 left-0.5 size-4 rounded-full bg-white transition-transform shadow-sm" style={{ transform: exportAllTime ? 'translateX(16px)' : 'translateX(0)' }} />
                  </div>
                  <span className="text-[11px] font-bold text-[var(--ds-text-2)]">Export all time</span>
                </label>

                {/* Month picker */}
                {!exportAllTime && (
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-black uppercase tracking-wider text-[var(--ds-text-3)]">Month</label>
                    <input
                      type="month"
                      value={exportMonth}
                      max={new Date().toISOString().slice(0, 7)}
                      onChange={e => setExportMonth(e.target.value)}
                      className="w-full border border-[var(--ds-border)] rounded-xl px-3 py-2.5 text-[11px] font-bold focus:outline-none focus:ring-2 focus:ring-[#adee2b] bg-[var(--ds-bg-surface)] text-[var(--ds-text-1)]"
                    />
                  </div>
                )}

                {/* Building filter */}
                {overviewBuildingsList.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-[9px] font-black uppercase tracking-wider text-[var(--ds-text-3)]">
                      Buildings <span className="text-[var(--ds-text-4)] normal-case font-bold">(leave all unchecked = all buildings)</span>
                    </p>
                    <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1" style={{ scrollbarWidth: 'thin' }}>
                      {overviewBuildingsList.map(b => {
                        const checked = exportBuildingIds.includes(b.id)
                        return (
                          <label key={b.id} className="flex items-center gap-2.5 cursor-pointer group px-3 py-2 rounded-xl transition-colors hover:bg-[var(--ds-bg-raised)]">
                            <div
                              className="size-4 rounded-md flex items-center justify-center shrink-0 transition-all"
                              style={{ background: checked ? '#111827' : 'var(--ds-bg-raised)', border: checked ? '1px solid #111827' : '1px solid var(--ds-border)' }}
                              onClick={() => setExportBuildingIds(ids => checked ? ids.filter(i => i !== b.id) : [...ids, b.id])}>
                              {checked && <span className="material-symbols-outlined" style={{ fontSize: 11, color: '#adee2b', fontVariationSettings: "'FILL' 1" }}>check</span>}
                            </div>
                            <span className="text-[11px] font-bold text-[var(--ds-text-2)]">
                              {b.name}{b.code ? ` (${b.code})` : ''}
                            </span>
                          </label>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex gap-3 pt-1">
                <button onClick={() => setExportModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-[var(--ds-border)] text-[10px] font-black uppercase text-[var(--ds-text-2)] hover:bg-[var(--ds-bg-raised)] transition-colors">
                  Cancel
                </button>
                <button onClick={handleExport} disabled={exporting}
                  className="flex-1 py-2.5 rounded-xl bg-black text-[#adee2b] text-[10px] font-black uppercase hover:opacity-80 disabled:opacity-50 flex items-center justify-center gap-2 transition-all">
                  {exporting
                    ? <><span className="material-symbols-outlined animate-spin" style={{ fontSize: 13 }}>progress_activity</span>Exporting…</>
                    : <><span className="material-symbols-outlined" style={{ fontSize: 13 }}>download</span>Download Analytics</>}
                </button>
              </div>
            </div>
          </div>
          </ModalPortal>
        )}

        {/* Chart Settings Modal */}
        {chartSettingsOpen && (
          <ModalPortal>
            <div className="fixed inset-0 z-[1000] flex items-center justify-center admin-backdrop-in" style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(12px)' }} onClick={() => setChartSettingsOpen(false)}>
              <div className="rounded-3xl shadow-2xl w-[400px] p-7 space-y-6 admin-modal-in" style={{ background: 'var(--ds-bg-surface)', border: '1px solid var(--ds-border-sub)' }} onClick={e => e.stopPropagation()}>
                <div>
                  <p className="text-[9px] font-black uppercase tracking-[0.2em] text-[var(--ds-text-3)]">Overview</p>
                  <h3 className="text-base font-black uppercase tracking-tight mt-0.5 text-[var(--ds-text-1)]">Chart Settings</h3>
                </div>

                {/* Colors */}
                <div className="space-y-3">
                  <p className="text-[9px] font-black uppercase tracking-widest text-[var(--ds-text-3)]">Colors</p>
                  {([
                    { key: 'trend',     label: 'Booking Trend',    default: '#6366f1' },
                    { key: 'confirmed', label: 'Confirmed',        default: '#adee2b' },
                    { key: 'tentative', label: 'Tentative',        default: '#f59e0b' },
                    { key: 'cancelled', label: 'Cancelled',        default: '#ef4444' },
                    { key: 'rooms',     label: 'Top Rooms Bar',    default: '#6366f1' },
                    { key: 'hours',     label: 'Peak Hours Bar',   default: '#adee2b' },
                  ] as const).map(({ key, label, default: def }) => (
                    <div key={key} className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-[var(--ds-text-2)]">{label}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono text-[var(--ds-text-3)]">{(parsedChartColors[key] ?? def).toUpperCase()}</span>
                        <label className="relative cursor-pointer">
                          <span className="size-7 rounded-xl border-2 border-[var(--ds-border)] block" style={{ background: parsedChartColors[key] ?? def }} />
                          <input type="color" defaultValue={parsedChartColors[key] ?? def}
                            className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                            onChange={e => saveChartColor(key, e.target.value)} />
                        </label>
                        {parsedChartColors[key] && parsedChartColors[key] !== def && (
                          <button onClick={() => saveChartColor(key, def)} title="Reset"
                            className="text-[var(--ds-text-4)] hover:text-[var(--ds-text-2)] transition-colors">
                            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>refresh</span>
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Peak Hours Range */}
                <div className="space-y-3">
                  <p className="text-[9px] font-black uppercase tracking-widest text-[var(--ds-text-3)]">Peak Hours Range</p>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 space-y-1">
                      <p className="text-[9px] font-black uppercase tracking-wider text-[var(--ds-text-3)]">From</p>
                      <select value={peakFrom} onChange={e => saveChartPeakHour(Number(e.target.value), peakTo)}
                        className="w-full border border-[var(--ds-border)] rounded-xl px-3 py-2 text-[11px] font-bold bg-[var(--ds-bg-surface)] text-[var(--ds-text-1)] focus:outline-none focus:ring-2 focus:ring-[#adee2b]">
                        {Array.from({ length: 24 }, (_, h) => (
                          <option key={h} value={h} disabled={h >= peakTo}>{String(h).padStart(2, '0')}:00</option>
                        ))}
                      </select>
                    </div>
                    <span className="text-[var(--ds-text-3)] mt-4">→</span>
                    <div className="flex-1 space-y-1">
                      <p className="text-[9px] font-black uppercase tracking-wider text-[var(--ds-text-3)]">To</p>
                      <select value={peakTo} onChange={e => saveChartPeakHour(peakFrom, Number(e.target.value))}
                        className="w-full border border-[var(--ds-border)] rounded-xl px-3 py-2 text-[11px] font-bold bg-[var(--ds-bg-surface)] text-[var(--ds-text-1)] focus:outline-none focus:ring-2 focus:ring-[#adee2b]">
                        {Array.from({ length: 24 }, (_, h) => (
                          <option key={h} value={h} disabled={h <= peakFrom}>{String(h).padStart(2, '0')}:00</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <p className="text-[10px] text-[var(--ds-text-3)] font-bold">
                    Menampilkan jam {String(peakFrom).padStart(2,'0')}:00 – {String(peakTo).padStart(2,'0')}:59 · {peakTo - peakFrom + 1} jam
                  </p>
                </div>

                <button onClick={() => setChartSettingsOpen(false)}
                  className="w-full py-2.5 rounded-xl bg-black text-[#adee2b] text-[10px] font-black uppercase hover:opacity-80 transition-all">
                  Done
                </button>
              </div>
            </div>
          </ModalPortal>
        )}

        {tab === 'buildings' && <div className="admin-tab-in"><BuildingsTab /></div>}


        {tab === 'users' && <div className="admin-tab-in"><UsersTab /></div>}

        {tab === 'archive'  && <div className="admin-tab-in"><ArchiveTab /></div>}
        {tab === 'settings' && <div className="admin-tab-in"><SettingsTab /></div>}
        {tab === 'kiosk'     && <div className="admin-tab-in"><KioskTab /></div>}
        {tab === 'sensor'    && <div className="admin-tab-in"><SensorTab /></div>}
        {tab === 'activity'  && <div className="admin-tab-in"><ActivityLogTab /></div>}
        {tab === 'disputes'  && <div className="admin-tab-in"><DisputesTab /></div>}
      </div>
    </div>
  )
}
