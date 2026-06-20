import { useState, useMemo } from 'react'
import { flushSync } from 'react-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { Room, Building, Booking } from '../types/index'
import { getRooms, updateRoomStatus, updateRoom } from '../api/rooms'
import { getBuildings } from '../api/buildings'
import { getBookings } from '../api/bookings'
import { useAuth } from '../context/AuthContext'
import { useSettings } from '../context/SettingsContext'
import RoomDetailModal from '../components/room/RoomDetailModal'
import BookingPanel from '../components/booking/BookingPanel'
import ContactReceptionistModal from '../components/room/ContactReceptionistModal'

function toLocalDateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// Apply a CSS view-transition-name (typed loosely — not in all @types/react versions)
function vtStyle(name?: string): React.CSSProperties | undefined {
  return name ? ({ viewTransitionName: name } as unknown as React.CSSProperties) : undefined
}

// Subtle film grain — layered behind the glass UI for depth
const GRAIN = "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")"

// Fluid glass tooltip (light) — shown on hover of a `group/tip` parent
function GlassTip({ label }: { label: string }) {
  return (
    <div className="absolute top-full right-0 mt-2 z-20 pointer-events-none opacity-0 translate-y-1 group-hover/tip:opacity-100 group-hover/tip:translate-y-0 transition-all duration-200">
      <div className="px-3 py-1.5 rounded-xl whitespace-nowrap"
        style={{ background: 'rgba(255,255,255,0.7)', backdropFilter: 'blur(20px) saturate(180%)', WebkitBackdropFilter: 'blur(20px) saturate(180%)', border: '1px solid rgba(255,255,255,0.6)', boxShadow: '0 8px 32px rgba(0,0,0,0.12), 0 1px 4px rgba(0,0,0,0.06)' }}>
        <span className="text-[9px] font-black uppercase tracking-widest text-slate-700">{label}</span>
      </div>
    </div>
  )
}

export default function RoomsPage() {
  const { user } = useAuth()
  const { defaultBuilding } = useSettings()
  const isPrivileged = user?.role === 'admin' || user?.role === 'receptionist'
  const queryClient = useQueryClient()

  const [viewMode, setViewMode] = useState<'card' | 'list'>('card')
  const [search, setSearch] = useState('')
  const [buildingFilter, setBuildingFilter] = useState<number | null>(defaultBuilding)
  const [floorFilter, setFloorFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState<'' | 'maintenance'>('')
  const [detailRoom, setDetailRoom] = useState<Room | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [vtId, setVtId] = useState<number | null>(null)
  const [bookingPanelOpen, setBookingPanelOpen] = useState(false)
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null)
  const [contactOpen, setContactOpen] = useState(false)
  const [contactRoom, setContactRoom] = useState<Room | null>(null)
  const [togglingRoomId, setTogglingRoomId] = useState<number | null>(null)
  const [quickAvailable, setQuickAvailable] = useState(false)
  const [quickBig, setQuickBig] = useState(false)

  const today = toLocalDateStr(new Date())

  const { data: rooms = [], isLoading } = useQuery<Room[]>({ queryKey: ['rooms'], queryFn: getRooms })
  const { data: buildings = [] } = useQuery<Building[]>({ queryKey: ['buildings'], queryFn: getBuildings })
  const { data: todayBookings = [] } = useQuery<Booking[]>({ queryKey: ['bookings', today], queryFn: () => getBookings({ date: today }) })

  const floors = useMemo(() => {
    const src = buildingFilter ? (rooms as Room[]).filter(r => r.building_id === buildingFilter) : (rooms as Room[])
    return [...new Set(src.map(r => r.floor).filter(Boolean))].sort()
  }, [rooms, buildingFilter])

  const filtered = useMemo(() => (rooms as Room[]).filter(r => {
    if (buildingFilter && r.building_id !== buildingFilter) return false
    if (search && !r.name.toLowerCase().includes(search.toLowerCase())) return false
    if (floorFilter && r.floor !== floorFilter) return false
    if (statusFilter && r.status !== statusFilter) return false
    if (quickAvailable && (r.status === 'maintenance' || isOccupiedNow(r))) return false
    if (quickBig && (r.capacity ?? 0) <= 10) return false
    return true
  }), [rooms, buildingFilter, search, floorFilter, statusFilter, quickAvailable, quickBig, todayBookings])

  const availableNowRooms = useMemo(() =>
    (rooms as Room[]).filter(r =>
      r.status !== 'maintenance' &&
      !isOccupiedNow(r) &&
      (buildingFilter === null || r.building_id === buildingFilter)
    ),
    [rooms, todayBookings, buildingFilter]
  )

  // For "All" view: group filtered rooms by building
  const grouped = useMemo(() => {
    if (buildingFilter !== null) return null
    const map = new Map<number | undefined, Room[]>()
    filtered.forEach(r => {
      const key = r.building_id
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(r)
    })
    // sort by building order in buildings list
    return Array.from(map.entries()).sort(([a], [b]) => {
      const ia = (buildings as Building[]).findIndex(bld => bld.id === a)
      const ib = (buildings as Building[]).findIndex(bld => bld.id === b)
      return ia - ib
    })
  }, [filtered, buildingFilter, buildings])

  function getBuildingName(id?: number) {
    if (!id) return 'No Building'
    return (buildings as Building[]).find(b => b.id === id)?.name ?? 'Unknown'
  }

  function getBuildingCode(id?: number) {
    if (!id) return 'No Building'
    const b = (buildings as Building[]).find(b => b.id === id)
    return b?.code || b?.name || 'Unknown'
  }

  function isOccupiedNow(room: Room) {
    const now = new Date()
    return (todayBookings as Booking[]).some(b => {
      if (b.room_id !== room.id || b.status === 'cancelled') return false
      const s = new Date(b.start_at.replace('Z', ''))
      const e = new Date(b.end_at.replace('Z', ''))
      return s <= now && now < e
    })
  }

  function selectBuilding(id: number | null) {
    setBuildingFilter(id)
    setFloorFilter('')
    setStatusFilter('')
  }

  function openDetail(room: Room) {
    // Shared-element morph: card photo → modal hero (View Transitions API)
    const vt = (document as Document & { startViewTransition?: (cb: () => void) => { finished: Promise<void> } }).startViewTransition
    if (!vt || !room.photos?.[0]) { setDetailRoom(room); setDetailOpen(true); return }
    flushSync(() => setVtId(room.id))            // tag the source card before snapshot
    const t = vt.call(document, () => {
      flushSync(() => { setDetailRoom(room); setDetailOpen(true) })
    })
    t.finished.finally(() => setVtId(null))
  }

  function handleBook(room: Room) {
    if (room.requires_contact) { setContactRoom(room); setContactOpen(true) }
    else { setSelectedRoom(room); setDetailOpen(false); setBookingPanelOpen(true) }
  }

  async function toggleMaintenance(room: Room, e: React.MouseEvent) {
    e.stopPropagation()
    const next = room.status === 'maintenance' ? 'active' : 'maintenance'
    setTogglingRoomId(room.id)
    try { await updateRoomStatus(room.id, next); queryClient.invalidateQueries({ queryKey: ['rooms'] }) }
    finally { setTogglingRoomId(null) }
  }

  async function toggleSpecialRoom(room: Room, e: React.MouseEvent) {
    e.stopPropagation()
    setTogglingRoomId(room.id)
    try { await updateRoom(room.id, { requires_contact: !room.requires_contact }); queryClient.invalidateQueries({ queryKey: ['rooms'] }) }
    finally { setTogglingRoomId(null) }
  }

  const showFloorMaint = buildingFilter !== null

  function renderRoomCard(room: Room, idx: number) {
    const occupied = isOccupiedNow(room)
    const isMaintenance = room.status === 'maintenance'
    const photo = room.photos?.[0]
    return (
      <div
        key={room.id}
        onClick={() => openDetail(room)}
        className="group relative rounded-[24px] overflow-hidden cursor-pointer aspect-[4/3] shadow-sm hover:shadow-2xl transition-all duration-300"
        style={{
          animation: occupied && !isMaintenance
            ? `fadeSlideUp 250ms ease ${idx * 40}ms both, liveGlow 2.6s ease-in-out ${400 + idx * 40}ms infinite`
            : `fadeSlideUp 250ms ease ${idx * 40}ms both`,
        }}
      >
        {/* Photo */}
        {photo
          ? <img src={photo} alt={room.name} style={vtStyle(vtId === room.id && !detailOpen ? 'room-hero' : undefined)} className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
          : <div className="absolute inset-0 bg-gradient-to-br from-slate-300 to-slate-400 flex items-center justify-center">
              <span className="material-symbols-outlined text-white/40" style={{ fontSize: 72 }}>meeting_room</span>
            </div>
        }
        {/* Legibility gradient */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/55 via-black/0 to-black/40" />

        {/* Top-right controls */}
        <div className="absolute top-3.5 right-3.5 flex items-center gap-1.5 z-10">
          {isPrivileged ? (
            <>
              <div className="relative group/tip">
                <button onClick={e => toggleSpecialRoom(room, e)} disabled={togglingRoomId === room.id}
                  className="size-8 rounded-full flex items-center justify-center bg-white/15 backdrop-blur-md border border-white/25 hover:bg-white/25 transition-all disabled:opacity-40">
                  <span className="material-symbols-outlined" style={{ fontSize: 16, color: room.requires_contact ? '#fbbf24' : 'rgba(255,255,255,0.7)', fontVariationSettings: room.requires_contact ? "'FILL' 1" : "'FILL' 0" }}>star</span>
                </button>
                <GlassTip label={room.requires_contact ? 'Special room (click to unset)' : 'Not special (click to set)'} />
              </div>
              <div className="relative group/tip">
                <button onClick={e => toggleMaintenance(room, e)} disabled={togglingRoomId === room.id}
                  className={`size-8 rounded-full flex items-center justify-center backdrop-blur-md border transition-all disabled:opacity-40 ${isMaintenance ? 'bg-orange-500/90 border-orange-400 text-white' : 'bg-white/15 border-white/25 text-white/70 hover:bg-white/25'}`}>
                  {togglingRoomId === room.id
                    ? <span className="material-symbols-outlined animate-spin" style={{ fontSize: 15 }}>progress_activity</span>
                    : <span className="material-symbols-outlined" style={{ fontSize: 15 }}>construction</span>}
                </button>
                <GlassTip label={isMaintenance ? 'End maintenance' : 'Set maintenance'} />
              </div>
            </>
          ) : room.requires_contact ? (
            <div className="relative group/tip">
              <span className="size-8 rounded-full flex items-center justify-center bg-white/15 backdrop-blur-md border border-white/25">
                <span className="material-symbols-outlined" style={{ fontSize: 16, color: '#fbbf24', fontVariationSettings: "'FILL' 1" }}>star</span>
              </span>
              <GlassTip label="Special — contact required to book" />
            </div>
          ) : null}
        </div>

        {/* Title + status (top center) */}
        <div className="absolute top-0 inset-x-0 pt-7 px-6 text-center">
          <p className="text-[19px] font-black text-white leading-tight tracking-tight drop-shadow-sm truncate">{room.name}</p>
          <div className="flex items-center justify-center gap-1.5 mt-1.5">
            {isMaintenance ? (
              <>
                <span className="material-symbols-outlined text-orange-300" style={{ fontSize: 14 }}>construction</span>
                <span className="text-[11px] font-bold text-white/85">Maintenance</span>
              </>
            ) : (
              <>
                <span className={`size-2 rounded-full ${occupied ? 'bg-red-400' : 'bg-[#adee2b] animate-pulse'}`} />
                <span className="text-[11px] font-bold text-white/85">{occupied ? 'Occupied' : 'Available'}</span>
              </>
            )}
          </div>
        </div>

        {/* Bottom gradient-blur caption */}
        <div className="absolute inset-x-0 bottom-0 pt-12 px-4 pb-3.5 flex items-end justify-between gap-3"
          style={{ background: 'linear-gradient(to top, rgba(8,10,20,0.80) 35%, rgba(8,10,20,0))', backdropFilter: 'blur(3px)', WebkitBackdropFilter: 'blur(3px)' }}>
          {/* Meta */}
          <div className="min-w-0">
            <p className="text-[14px] font-black text-white truncate leading-tight">{getBuildingCode(room.building_id)}</p>
            <div className="flex items-center gap-1.5 mt-0.5 text-white/75">
              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>event_seat</span>
              <span className="text-[11px] font-bold truncate">{room.capacity} seats · {room.floor}</span>
            </div>
          </div>
          {/* Action pill */}
          {room.requires_contact ? (
            <button onClick={e => { e.stopPropagation(); setContactRoom(room); setContactOpen(true) }}
              className="shrink-0 flex items-center gap-1.5 px-4 py-2.5 rounded-full bg-amber-400 text-amber-900 text-[11px] font-black hover:bg-amber-300 transition-all">
              <span className="material-symbols-outlined" style={{ fontSize: 15 }}>support_agent</span>Contact
            </button>
          ) : isMaintenance ? (
            <span className="shrink-0 px-4 py-2.5 rounded-full bg-white/10 text-white/50 text-[11px] font-black border border-white/15">Unavailable</span>
          ) : (
            <button onClick={e => { e.stopPropagation(); handleBook(room) }}
              className="shrink-0 flex items-center gap-1 pl-3 pr-4 py-2.5 rounded-full bg-[#adee2b] text-black text-[11px] font-black hover:bg-white transition-all">
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>add</span>Book
            </button>
          )}
        </div>
      </div>
    )
  }

  function renderRoomRow(room: Room, i: number, total: number) {
    const occupied = isOccupiedNow(room)
    const isMaintenance = room.status === 'maintenance'
    return (
      <tr key={room.id} onClick={() => openDetail(room)}
        className={`cursor-pointer hover:bg-slate-50 transition-colors border-b border-slate-50 ${i === total - 1 ? 'border-b-0' : ''}`}
        style={{ animation: `fadeSlideUp 200ms ease ${i * 30}ms both` }}>
        <td className="px-5 py-3.5">
          <div>
            <span className="text-[12px] font-black text-slate-800">{room.name}</span>
            {isPrivileged ? (
              <button onClick={e => toggleSpecialRoom(room, e)} disabled={togglingRoomId === room.id} title={room.requires_contact ? 'Special room (click to unset)' : 'Click to set as special'} className="ml-1.5 inline-flex items-center transition-all disabled:opacity-40">
                <span className="material-symbols-outlined" style={{ fontSize: 13, color: room.requires_contact ? '#d97706' : '#d1d5db', fontVariationSettings: room.requires_contact ? "'FILL' 1" : "'FILL' 0" }}>star</span>
              </button>
            ) : room.requires_contact ? (
              <span className="ml-1.5 inline-flex"><span className="material-symbols-outlined" style={{ fontSize: 13, color: '#d97706', fontVariationSettings: "'FILL' 1" }}>star</span></span>
            ) : null}
          </div>
        </td>
        <td className="px-5 py-3.5">
          <span className="px-2.5 py-1 bg-slate-100 text-slate-600 rounded-lg text-[9px] font-black uppercase">{room.floor}</span>
        </td>
        <td className="px-5 py-3.5">
          <span className="text-[11px] font-bold text-slate-500">{room.capacity} pax</span>
        </td>
        <td className="px-5 py-3.5">
          {isMaintenance ? (
            <span className="flex items-center gap-1 text-[9px] font-black uppercase text-orange-600">
              <span className="material-symbols-outlined" style={{ fontSize: 12 }}>construction</span>Maintenance
            </span>
          ) : (
            <span className={`flex items-center gap-1 text-[9px] font-black uppercase ${occupied ? 'text-red-500' : 'text-green-600'}`}>
              <span className={`size-1.5 rounded-full ${occupied ? 'bg-red-500' : 'bg-green-500 animate-pulse'}`} />
              {occupied ? 'Occupied' : 'Available'}
            </span>
          )}
        </td>
        <td className="px-5 py-3.5">
          <span className="text-[11px] font-bold text-slate-400">{room.facilities?.length ?? 0} items</span>
        </td>
        <td className="px-5 py-3.5">
          <div className="flex items-center gap-2 justify-end">
            {isPrivileged && (
              <button onClick={e => toggleMaintenance(room, e)} disabled={togglingRoomId === room.id}
                className={`px-2.5 py-1.5 rounded-xl text-[9px] font-black uppercase transition-all ${isMaintenance ? 'bg-orange-100 text-orange-700 hover:bg-orange-200' : 'bg-slate-100 text-slate-500 hover:bg-orange-100 hover:text-orange-700'}`}>
                <span className="material-symbols-outlined" style={{ fontSize: 12 }}>construction</span>
              </button>
            )}
            {room.requires_contact ? (
              <button onClick={e => { e.stopPropagation(); setContactRoom(room); setContactOpen(true) }}
                className="px-3 py-1.5 rounded-xl text-[9px] font-black uppercase bg-amber-400 text-amber-900 hover:bg-amber-300 transition-all">Contact</button>
            ) : !isMaintenance ? (
              <button onClick={e => { e.stopPropagation(); handleBook(room) }}
                className="px-4 py-1.5 rounded-xl text-[9px] font-black uppercase bg-slate-900 text-white hover:bg-[#adee2b] hover:text-black transition-all">Book</button>
            ) : null}
          </div>
        </td>
      </tr>
    )
  }

  return (
    <div className="relative flex flex-col flex-1 overflow-hidden"
      style={{
        backgroundColor: '#f4f5f2',
        backgroundImage: 'radial-gradient(circle at 12% -5%, rgba(173,238,43,0.10), transparent 38%), radial-gradient(circle at 92% 108%, rgba(99,102,241,0.07), transparent 42%)',
      }}>
      {/* Film grain overlay — adds depth behind the glass UI */}
      <div className="pointer-events-none absolute inset-0 z-0 opacity-[0.04] mix-blend-multiply"
        style={{ backgroundImage: GRAIN, backgroundSize: '180px 180px' }} />
      <div className="relative z-[1] flex flex-col flex-1 overflow-hidden">

      {/* Toolbar */}
      <div className="bg-white border-b border-slate-100 px-8 shrink-0">
        {/* Row 1: title + search + view toggle */}
        <div className="flex items-center justify-between py-3 gap-4">
          <div className="flex items-center gap-3">
            <h1 className="text-[16px] font-black text-slate-900 uppercase tracking-tight">Rooms</h1>
            {!isLoading && (
              <span className="px-2.5 py-1 bg-slate-100 rounded-lg text-[10px] font-black text-slate-500 uppercase">
                {filtered.length} room{filtered.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            {/* Search */}
            <div className="relative flex items-center">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 text-base pointer-events-none">search</span>
              <input type="text" placeholder="Search rooms..." value={search} onChange={e => setSearch(e.target.value)}
                className="w-44 bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-[11px] font-bold focus:outline-none focus:ring-2 focus:ring-[#adee2b] focus:border-transparent transition-all" />
            </div>
            {/* View toggle */}
            <div className="flex gap-0.5 bg-slate-100 rounded-xl p-1 shrink-0">
              <button onClick={() => setViewMode('card')} title="Card view"
                className={`size-8 flex items-center justify-center rounded-lg transition-all ${viewMode === 'card' ? 'bg-white shadow text-slate-800' : 'text-slate-400 hover:text-slate-600'}`}>
                <span className="material-symbols-outlined" style={{ fontSize: 17 }}>grid_view</span>
              </button>
              <button onClick={() => setViewMode('list')} title="List view"
                className={`size-8 flex items-center justify-center rounded-lg transition-all ${viewMode === 'list' ? 'bg-white shadow text-slate-800' : 'text-slate-400 hover:text-slate-600'}`}>
                <span className="material-symbols-outlined" style={{ fontSize: 17 }}>view_list</span>
              </button>
            </div>
          </div>
        </div>

        {/* Row 2: building pills + floor/maint (only when building selected) */}
        <div className="flex items-center gap-2 pb-3">
          {/* Building pills */}
          <div className="flex items-center bg-slate-100 rounded-xl p-1 gap-0.5">
            <button onClick={() => selectBuilding(null)}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${buildingFilter === null ? 'bg-white shadow text-slate-800' : 'text-slate-400 hover:text-slate-600'}`}>
              All
            </button>
            {(buildings as Building[]).map(b => (
              <button key={b.id} onClick={() => selectBuilding(b.id)}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all whitespace-nowrap ${buildingFilter === b.id ? 'bg-white shadow text-slate-800' : 'text-slate-400 hover:text-slate-600'}`}>
                {b.code || b.name}{(b.location?.name || b.address) ? ` - ${b.location?.name || b.address}` : ''}
              </button>
            ))}
          </div>

          {/* Floor + Maint — only when a building is selected */}
          {showFloorMaint && floors.length > 0 && (
            <>
              <div className="w-px h-5 bg-slate-200 shrink-0" />
              <div className="flex items-center bg-slate-100 rounded-xl p-1 gap-0.5">
                <button onClick={() => { setFloorFilter(''); setStatusFilter('') }}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${!floorFilter && !statusFilter ? 'bg-white shadow text-slate-800' : 'text-slate-400 hover:text-slate-600'}`}>
                  All
                </button>
                {floors.map(f => (
                  <button key={f} onClick={() => { setFloorFilter(floorFilter === f ? '' : f); setStatusFilter('') }}
                    className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${floorFilter === f ? 'bg-white shadow text-slate-800' : 'text-slate-400 hover:text-slate-600'}`}>
                    {f}
                  </button>
                ))}
                <div className="w-px h-4 bg-slate-300/60 mx-0.5" />
                <button onClick={() => { setStatusFilter(statusFilter === 'maintenance' ? '' : 'maintenance'); setFloorFilter('') }}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all flex items-center gap-1 ${statusFilter === 'maintenance' ? 'bg-orange-100 text-orange-700 shadow' : 'text-slate-400 hover:text-slate-600'}`}>
                  <span className="material-symbols-outlined" style={{ fontSize: 12 }}>construction</span>Maint.
                </button>
              </div>
            </>
          )}

          {/* Quick-filter chips */}
          <div className="flex items-center gap-1.5 ml-auto">
            {defaultBuilding != null && buildingFilter !== defaultBuilding && (
              <button onClick={() => selectBuilding(defaultBuilding)}
                className="flex items-center gap-1 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wide border bg-white border-slate-200 text-slate-400 hover:border-indigo-300 hover:text-indigo-600 transition-all">
                <span className="material-symbols-outlined" style={{ fontSize: 13 }}>business</span>My Building
              </button>
            )}
            <button onClick={() => setQuickBig(v => !v)}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wide border transition-all ${quickBig ? 'bg-slate-900 border-slate-900 text-white' : 'bg-white border-slate-200 text-slate-400 hover:border-slate-400 hover:text-slate-600'}`}>
              <span className="material-symbols-outlined" style={{ fontSize: 13 }}>group</span>10+ seats
            </button>
            <button onClick={() => setQuickAvailable(v => !v)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wide border transition-all ${quickAvailable ? 'bg-[#adee2b] border-[#adee2b] text-black' : 'bg-white border-slate-200 text-slate-400 hover:border-[#adee2b]/60 hover:text-slate-600'}`}>
              <span className={`size-1.5 rounded-full shrink-0 ${quickAvailable ? 'bg-black' : 'bg-[#adee2b] animate-pulse'}`} />
              Available now
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto px-8 py-6">
        {/* Hero strip — rooms free right now */}
        {!isLoading && availableNowRooms.length > 0 && !quickAvailable && (
          <div className="mb-5" style={{ animation: 'fadeSlideUp 300ms ease both' }}>
            <div className="rounded-2xl overflow-hidden" style={{
              background: 'rgba(10,15,40,0.84)',
              backdropFilter: 'blur(28px) saturate(180%)',
              WebkitBackdropFilter: 'blur(28px) saturate(180%)',
              border: '1px solid rgba(173,238,43,0.22)',
              boxShadow: '0 0 0 1px rgba(173,238,43,0.08), 0 8px 32px rgba(0,0,0,0.18)',
            }}>
              <div className="flex items-center gap-4 px-5 py-3">
                {/* Count */}
                <div className="flex items-center gap-2 shrink-0">
                  <span className="size-2 rounded-full bg-[#adee2b] animate-pulse shrink-0" />
                  <span className="text-[12px] font-black text-white whitespace-nowrap">
                    {availableNowRooms.length} free now
                  </span>
                </div>
                <div className="w-px h-5 bg-white/10 shrink-0" />
                {/* Scrollable room chips */}
                <div className="flex items-center gap-2 flex-1 overflow-x-auto" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                  {availableNowRooms.map(r => (
                    <button key={r.id}
                      onClick={() => r.requires_contact ? (setContactRoom(r), setContactOpen(true)) : handleBook(r)}
                      className="group/strip flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/10 bg-white/5 hover:bg-[#adee2b]/15 hover:border-[#adee2b]/40 transition-all shrink-0">
                      <span className="text-[11px] font-black text-white/75 group-hover/strip:text-[#adee2b] whitespace-nowrap transition-colors">{r.name}</span>
                      <span className="text-[9px] font-bold text-white/30 whitespace-nowrap">{getBuildingCode(r.building_id)}</span>
                      <span className="material-symbols-outlined text-white/25 group-hover/strip:text-[#adee2b] transition-colors" style={{ fontSize: 13 }}>arrow_forward</span>
                    </button>
                  ))}
                </div>
                {/* Filter action */}
                <button onClick={() => setQuickAvailable(true)}
                  className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#adee2b]/10 border border-[#adee2b]/25 text-[#adee2b] text-[10px] font-black uppercase tracking-wide hover:bg-[#adee2b]/20 transition-all whitespace-nowrap">
                  View all
                  <span className="material-symbols-outlined" style={{ fontSize: 13 }}>tune</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {isLoading && (
          <div className="flex items-center justify-center py-24">
            <span className="material-symbols-outlined animate-spin text-4xl text-slate-300">progress_activity</span>
          </div>
        )}

        {!isLoading && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 gap-5">
            <div className="relative">
              <div className="absolute inset-0 rounded-full bg-[#adee2b]/25 blur-2xl animate-pulse" />
              <div className="relative size-24 rounded-[28px] bg-white border border-slate-100 shadow-sm flex items-center justify-center rotate-3">
                <span className="material-symbols-outlined text-slate-300" style={{ fontSize: 46 }}>meeting_room</span>
              </div>
              <div className="absolute -bottom-2 -right-2 size-9 rounded-2xl bg-slate-900 flex items-center justify-center shadow-lg -rotate-6">
                <span className="material-symbols-outlined text-[#adee2b]" style={{ fontSize: 18 }}>search_off</span>
              </div>
            </div>
            <div className="text-center">
              <p className="text-[14px] font-black text-slate-700 uppercase tracking-tight">No rooms found</p>
              <p className="text-[11px] font-bold text-slate-400 mt-1">Try adjusting your search or filters</p>
            </div>
            {(search || floorFilter || statusFilter || buildingFilter !== null || quickAvailable || quickBig) && (
              <button
                onClick={() => { setSearch(''); setFloorFilter(''); setStatusFilter(''); setQuickAvailable(false); setQuickBig(false); selectBuilding(null) }}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-full bg-slate-900 text-white text-[10px] font-black uppercase tracking-wide hover:bg-[#adee2b] hover:text-black transition-all active:scale-95"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>restart_alt</span>Reset filters
              </button>
            )}
          </div>
        )}

        {/* Card view */}
        {!isLoading && viewMode === 'card' && filtered.length > 0 && (
          <div>
            {grouped ? (
              // All buildings — grouped with dividers
              grouped.map(([bid, bRooms]) => {
                const occ = bRooms.filter(isOccupiedNow).length
                const pct = bRooms.length ? Math.round((occ / bRooms.length) * 100) : 0
                return (
                <div key={bid ?? 'none'} className="mb-10">
                  <div className="flex items-end gap-4 mb-4">
                    <div className="min-w-0">
                      <p className="text-[9px] font-black uppercase tracking-[0.25em] text-slate-400 leading-none mb-1.5">{getBuildingName(bid)}</p>
                      <div className="flex items-center gap-2">
                        {/* Occupancy meter */}
                        <div className="w-28 h-1.5 rounded-full bg-slate-200 overflow-hidden">
                          <div className="h-full rounded-full transition-all duration-700"
                            style={{ width: `${pct}%`, background: pct >= 75 ? '#ef4444' : pct >= 40 ? '#fb923c' : '#adee2b' }} />
                        </div>
                        <span className="text-[9px] font-black uppercase tracking-wide text-slate-400">{pct}% busy</span>
                      </div>
                    </div>
                    <div className="flex-1 h-px bg-slate-200 mb-1" />
                    {/* Decorative count */}
                    <div className="flex items-baseline gap-1 shrink-0">
                      <span className="text-3xl font-black italic tracking-tighter text-slate-300 tabular-nums leading-none">{bRooms.length}</span>
                      <span className="text-[8px] font-black uppercase tracking-widest text-slate-300">rooms</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                    {bRooms.map((room, idx) => renderRoomCard(room, idx))}
                  </div>
                </div>
                )
              })
            ) : (
              // Single building
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {filtered.map((room, idx) => renderRoomCard(room, idx))}
              </div>
            )}
          </div>
        )}

        {/* List view */}
        {!isLoading && viewMode === 'list' && filtered.length > 0 && (
          <div>
            {grouped ? (
              // All buildings — grouped with dividers
              grouped.map(([bid, bRooms]) => (
                <div key={bid ?? 'none'} className="mb-6">
                  <div className="flex items-center gap-3 mb-2">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 whitespace-nowrap">{getBuildingName(bid)}</p>
                    <div className="flex-1 h-px bg-slate-200" />
                    <span className="text-[9px] font-black text-slate-300">{bRooms.length}</span>
                  </div>
                  <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-slate-100">
                          {['Room', 'Floor', 'Capacity', 'Status', 'Facilities', ''].map(h => (
                            <th key={h} className="text-left px-5 py-3 text-[9px] font-black uppercase tracking-widest text-slate-400">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>{bRooms.map((r, i) => renderRoomRow(r, i, bRooms.length))}</tbody>
                    </table>
                  </div>
                </div>
              ))
            ) : (
              // Single building
              <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-100">
                      {['Room', 'Floor', 'Capacity', 'Status', 'Facilities', ''].map(h => (
                        <th key={h} className="text-left px-5 py-3 text-[9px] font-black uppercase tracking-widest text-slate-400">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>{filtered.map((r, i) => renderRoomRow(r, i, filtered.length))}</tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
      </div>

      <BookingPanel
        open={bookingPanelOpen}
        onClose={() => setBookingPanelOpen(false)}
        initialRoom={selectedRoom}
        editBooking={null}
        prefillStart=""
        prefillEnd=""
        onSubmit={() => setBookingPanelOpen(false)}
      />
      {bookingPanelOpen && (
        <div className="fixed inset-0 z-[99] bg-black/30 backdrop-blur-sm" onClick={() => setBookingPanelOpen(false)} />
      )}

      <RoomDetailModal room={detailRoom} open={detailOpen} onClose={() => setDetailOpen(false)} onBook={handleBook} bookings={todayBookings as Booking[]} />
      <ContactReceptionistModal open={contactOpen} onClose={() => setContactOpen(false)} roomName={contactRoom?.name} />

      <style>{`
        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes liveGlow {
          0%, 100% { box-shadow: 0 6px 20px rgba(0,0,0,0.06), 0 0 0 0 rgba(251,146,60,0); }
          50%      { box-shadow: 0 10px 28px rgba(0,0,0,0.10), 0 0 0 3px rgba(251,146,60,0.30); }
        }
        ::view-transition-group(room-hero) {
          animation-duration: 0.42s;
          animation-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
        }
        ::view-transition-old(room-hero),
        ::view-transition-new(room-hero) { animation-duration: 0.42s; }
      `}</style>
    </div>
  )
}
