import { useState, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import type { Room } from '../../../types/index'
import { useModalHotkeys } from '../../../hooks/useModalHotkeys'
import { updateRoom, updateRoomStatus, updateRoomSpecial, deleteRoomPhoto, uploadRoomPhoto, reorderRooms, regenerateSensorCode } from '../../../api/rooms'
import { useCancelToast } from '../../../context/CancelToastContext'
import { ModalPortal } from '../shared'

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
  useModalHotkeys(true, undefined, onClose)
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
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string; errors?: { name?: string[] } } } })?.response?.data?.errors?.name?.[0]
        ?? (e as { response?: { data?: { message?: string } } })?.response?.data?.message
      setErr(msg || 'Failed to save room.')
    } finally { setSaving(false) }
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

  useModalHotkeys(!iconPickerOpen, () => {
    if (activeTab === 'basic') handleSave()
    else if (activeTab === 'photos') savePhotos()
    else if (activeTab === 'facilities') saveFacilities()
  }, onClose)

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

function RoomList({ rooms, sensorMode, onEdit, onDelete, onReordered, onStatusChange, onSpecialChange, onSensorCodeChange }: {
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

export { RoomModal as default, RoomList }
