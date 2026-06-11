import { useState, useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { Room, Booking } from '../types/index'
import { getRooms, updateRoomStatus } from '../api/rooms'
import { getBookings } from '../api/bookings'
import { useAuth } from '../context/AuthContext'
import RoomDetailModal from '../components/room/RoomDetailModal'
import BookingPanel from '../components/booking/BookingPanel'
import ContactReceptionistModal from '../components/room/ContactReceptionistModal'

function toLocalDateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function RoomsPage() {
  const { user } = useAuth()
  const isPrivileged = user?.role === 'admin' || user?.role === 'receptionist'
  const queryClient = useQueryClient()

  const [viewMode, setViewMode] = useState<'card' | 'list'>('card')
  const [prevViewMode, setPrevViewMode] = useState<'card' | 'list'>('card')
  const [transitioning, setTransitioning] = useState(false)
  const [search, setSearch] = useState('')
  const [floorFilter, setFloorFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState<'' | 'active' | 'maintenance'>('')

  const [detailRoom, setDetailRoom] = useState<Room | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [bookingPanelOpen, setBookingPanelOpen] = useState(false)
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null)
  const [contactOpen, setContactOpen] = useState(false)
  const [contactRoom, setContactRoom] = useState<Room | null>(null)
  const [togglingRoomId, setTogglingRoomId] = useState<number | null>(null)

  const today = toLocalDateStr(new Date())

  const { data: rooms = [], isLoading } = useQuery<Room[]>({
    queryKey: ['rooms'],
    queryFn: getRooms,
  })

  const { data: todayBookings = [] } = useQuery<Booking[]>({
    queryKey: ['bookings', today],
    queryFn: () => getBookings({ date: today }),
  })

  const floors = useMemo(() => {
    const all = (rooms as Room[]).map(r => r.floor).filter(Boolean)
    return [...new Set(all)].sort()
  }, [rooms])

  const filtered = (rooms as Room[]).filter(r => {
    const matchSearch = !search || r.name.toLowerCase().includes(search.toLowerCase())
    const matchFloor = !floorFilter || r.floor === floorFilter
    const matchStatus = !statusFilter || r.status === statusFilter
    return matchSearch && matchFloor && matchStatus
  })

  function isOccupiedNow(room: Room) {
    const now = new Date()
    return (todayBookings as Booking[]).some(b => {
      if (b.room_id !== room.id || b.status === 'cancelled') return false
      const s = new Date(b.start_at.replace('Z', ''))
      const e = new Date(b.end_at.replace('Z', ''))
      return s <= now && now < e
    })
  }

  function switchView(next: 'card' | 'list') {
    if (next === viewMode || transitioning) return
    setPrevViewMode(viewMode)
    setTransitioning(true)
    setTimeout(() => {
      setViewMode(next)
      setTransitioning(false)
    }, 180)
  }

  function openDetail(room: Room) { setDetailRoom(room); setDetailOpen(true) }

  function handleBook(room: Room) {
    if (room.requires_contact) {
      setContactRoom(room); setContactOpen(true)
    } else {
      setSelectedRoom(room); setDetailOpen(false); setBookingPanelOpen(true)
    }
  }

  async function toggleMaintenance(room: Room, e: React.MouseEvent) {
    e.stopPropagation()
    const next = room.status === 'maintenance' ? 'active' : 'maintenance'
    setTogglingRoomId(room.id)
    try {
      await updateRoomStatus(room.id, next)
      queryClient.invalidateQueries({ queryKey: ['rooms'] })
    } finally {
      setTogglingRoomId(null)
    }
  }

  const TYPE_DOT: Record<string, string> = {
    Ballroom: 'bg-purple-400',
    Executive: 'bg-blue-400',
    Focus: 'bg-green-400',
  }

  return (
    <div className="flex flex-col flex-1 overflow-hidden bg-slate-50">

      {/* Toolbar */}
      <div className="bg-white border-b border-slate-100 px-8 py-3 flex items-center justify-between shrink-0">
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
            <input
              type="text"
              placeholder="Search rooms..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-40 bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-[11px] font-bold focus:outline-none focus:ring-2 focus:ring-[#adee2b] focus:border-transparent transition-all"
            />
          </div>

          {/* Floor filter */}
          <div className="flex items-center bg-slate-100 rounded-xl p-1 gap-0.5">
            <button
              onClick={() => { setFloorFilter(''); setStatusFilter('') }}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${!floorFilter && !statusFilter ? 'bg-white shadow text-slate-800' : 'text-slate-400 hover:text-slate-600'}`}
            >All</button>
            {floors.map(f => (
              <button
                key={f}
                onClick={() => { setFloorFilter(floorFilter === f ? '' : f); setStatusFilter('') }}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${floorFilter === f ? 'bg-white shadow text-slate-800' : 'text-slate-400 hover:text-slate-600'}`}
              >{f}</button>
            ))}
            <div className="w-px h-4 bg-slate-300/60 mx-0.5" />
            <button
              onClick={() => { setStatusFilter(statusFilter === 'maintenance' ? '' : 'maintenance'); setFloorFilter('') }}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all flex items-center gap-1 ${statusFilter === 'maintenance' ? 'bg-orange-100 text-orange-700 shadow' : 'text-slate-400 hover:text-slate-600'}`}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 12 }}>construction</span>
              Maint.
            </button>
          </div>

          {/* View toggle with animation */}
          <div className="relative flex items-center bg-slate-100 rounded-xl p-1">
            <div
              className="absolute top-1 bottom-1 w-[calc(50%-2px)] bg-white rounded-lg shadow-sm pointer-events-none transition-transform duration-200 ease-[cubic-bezier(0.4,0,0.2,1)]"
              style={{ transform: viewMode === 'list' ? 'translateX(calc(100% + 4px))' : 'translateX(0)' }}
            />
            <button
              onClick={() => switchView('card')}
              className={`relative z-10 size-8 flex items-center justify-center rounded-lg transition-colors ${viewMode === 'card' ? 'text-slate-800' : 'text-slate-400 hover:text-slate-600'}`}
            >
              <span className="material-symbols-outlined text-base">grid_view</span>
            </button>
            <button
              onClick={() => switchView('list')}
              className={`relative z-10 size-8 flex items-center justify-center rounded-lg transition-colors ${viewMode === 'list' ? 'text-slate-800' : 'text-slate-400 hover:text-slate-600'}`}
            >
              <span className="material-symbols-outlined text-base">view_list</span>
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto px-8 py-6">
        {isLoading && (
          <div className="flex items-center justify-center py-24">
            <span className="material-symbols-outlined animate-spin text-4xl text-slate-300">progress_activity</span>
          </div>
        )}

        {!isLoading && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <span className="material-symbols-outlined text-slate-200" style={{ fontSize: 48 }}>meeting_room</span>
            <p className="text-[11px] font-black text-slate-300 uppercase tracking-widest">No rooms found</p>
          </div>
        )}

        {/* Card view */}
        {!isLoading && viewMode === 'card' && filtered.length > 0 && (
          <div
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5"
            style={{ opacity: transitioning ? 0 : 1, transition: 'opacity 180ms ease' }}
          >
            {filtered.map((room, idx) => {
              const occupied = isOccupiedNow(room)
              const isMaintenance = room.status === 'maintenance'
              const photo = room.photos?.[0]
              return (
                <div
                  key={room.id}
                  onClick={() => openDetail(room)}
                  className="relative rounded-2xl overflow-hidden border border-slate-100 hover:border-slate-300 hover:shadow-xl transition-all cursor-pointer group h-56"
                  style={{
                    animationDelay: `${idx * 40}ms`,
                    animation: transitioning ? undefined : 'fadeSlideUp 250ms ease both',
                  }}
                >
                  {/* Background photo */}
                  {photo
                    ? <img src={photo} alt={room.name} className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                    : <div className="absolute inset-0 bg-gradient-to-br from-slate-200 to-slate-300 flex items-center justify-center">
                        <span className="material-symbols-outlined text-slate-100" style={{ fontSize: 64 }}>meeting_room</span>
                      </div>
                  }

                  {/* Dark gradient overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

                  {/* Top tags */}
                  <div className="absolute top-3 left-3 right-3 flex items-center justify-between">
                    <span className="px-2.5 py-1 rounded-lg text-[9px] font-black uppercase bg-white/20 backdrop-blur-sm text-white border border-white/20">
                      {room.floor}
                    </span>
                    <div className="flex items-center gap-1.5">
                      {isMaintenance ? (
                        <span className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[9px] font-black uppercase bg-orange-500/90 backdrop-blur-sm text-white">
                          <span className="material-symbols-outlined" style={{ fontSize: 11 }}>construction</span>
                          Maintenance
                        </span>
                      ) : (
                        <span className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[9px] font-black uppercase backdrop-blur-sm ${occupied ? 'bg-red-500/80 text-white' : 'bg-green-500/80 text-white'}`}>
                          <span className={`size-1.5 rounded-full ${occupied ? 'bg-white' : 'bg-white animate-pulse'}`} />
                          {occupied ? 'Occupied' : 'Available'}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Bottom glass overlay */}
                  <div className="absolute bottom-0 left-0 right-0 px-4 pt-3 pb-4"
                    style={{
                      background: 'rgba(10,10,20,0.28)',
                      backdropFilter: 'blur(24px)',
                      WebkitBackdropFilter: 'blur(24px)',
                      borderTop: '1px solid rgba(255,255,255,0.10)',
                    }}
                  >
                    <div className="flex items-end justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-[15px] font-black text-white truncate leading-tight">{room.name}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="flex items-center gap-1 text-[11px] font-bold text-white/70">
                            <span className="material-symbols-outlined" style={{ fontSize: 13 }}>groups</span>
                            {room.capacity} seats
                          </span>
                          {room.requires_contact && (
                            <span className="flex items-center gap-0.5 text-[10px] font-black text-amber-300 uppercase">
                              <span className="material-symbols-outlined" style={{ fontSize: 12 }}>support_agent</span>
                              Contact
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {/* Maintenance toggle for privileged */}
                        {isPrivileged && (
                          <button
                            onClick={e => toggleMaintenance(room, e)}
                            disabled={togglingRoomId === room.id}
                            className={`px-3 py-2 rounded-xl text-[10px] font-black uppercase transition-all border ${isMaintenance ? 'bg-orange-500 text-white border-orange-400' : 'bg-white/10 text-white/60 border-white/20 hover:bg-orange-500/80 hover:text-white hover:border-orange-400'}`}
                            title={isMaintenance ? 'Set Active' : 'Set Maintenance'}
                          >
                            {togglingRoomId === room.id
                              ? <span className="material-symbols-outlined animate-spin" style={{ fontSize: 14 }}>progress_activity</span>
                              : <span className="material-symbols-outlined" style={{ fontSize: 14 }}>construction</span>
                            }
                          </button>
                        )}

                        {room.requires_contact ? (
                          <button
                            onClick={e => { e.stopPropagation(); setContactRoom(room); setContactOpen(true) }}
                            className="px-4 py-2 rounded-xl text-[10px] font-black uppercase bg-amber-400 text-amber-900 hover:bg-amber-300 transition-all flex items-center gap-1.5"
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: 13 }}>support_agent</span>
                            Contact
                          </button>
                        ) : isMaintenance ? (
                          <span className="px-4 py-2 rounded-xl text-[10px] font-black uppercase bg-white/10 text-white/40 border border-white/10">
                            Unavailable
                          </span>
                        ) : (
                          <button
                            onClick={e => { e.stopPropagation(); handleBook(room) }}
                            className="px-4 py-2 rounded-xl text-[10px] font-black uppercase bg-[#adee2b] text-black hover:bg-white transition-all"
                          >
                            Book
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* List view */}
        {!isLoading && viewMode === 'list' && filtered.length > 0 && (
          <div
            className="bg-white rounded-2xl border border-slate-100 overflow-hidden"
            style={{ opacity: transitioning ? 0 : 1, transition: 'opacity 180ms ease' }}
          >
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100">
                  {['Room', 'Floor', 'Capacity', 'Status', 'Facilities', ''].map(h => (
                    <th key={h} className="text-left px-5 py-3 text-[9px] font-black uppercase tracking-widest text-slate-400">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((room, i) => {
                  const occupied = isOccupiedNow(room)
                  const isMaintenance = room.status === 'maintenance'
                  return (
                    <tr
                      key={room.id}
                      onClick={() => openDetail(room)}
                      className={`cursor-pointer hover:bg-slate-50 transition-colors border-b border-slate-50 ${i === filtered.length - 1 ? 'border-b-0' : ''}`}
                      style={{ animation: 'fadeSlideUp 200ms ease both', animationDelay: `${i * 30}ms` }}
                    >
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className={`size-2 rounded-full shrink-0 ${TYPE_DOT[room.type]}`} />
                          <div>
                            <span className="text-[12px] font-black text-slate-800">{room.name}</span>
                            {room.requires_contact && (
                              <span className="ml-2 text-[8px] font-black uppercase text-amber-500 bg-amber-50 px-1.5 py-0.5 rounded">Contact</span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <span className="px-2.5 py-1 bg-slate-100 text-slate-600 rounded-lg text-[9px] font-black uppercase">{room.floor}</span>
                      </td>
                      <td className="px-5 py-4">
                        <span className="text-[11px] font-bold text-slate-500">{room.capacity} pax</span>
                      </td>
                      <td className="px-5 py-4">
                        {isMaintenance ? (
                          <span className="flex items-center gap-1 text-[9px] font-black uppercase text-orange-600">
                            <span className="material-symbols-outlined" style={{ fontSize: 12 }}>construction</span>
                            Maintenance
                          </span>
                        ) : (
                          <span className={`flex items-center gap-1 text-[9px] font-black uppercase ${occupied ? 'text-red-500' : 'text-green-600'}`}>
                            <span className={`size-1.5 rounded-full ${occupied ? 'bg-red-500' : 'bg-green-500 animate-pulse'}`} />
                            {occupied ? 'Occupied' : 'Available'}
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <span className="text-[11px] font-bold text-slate-400">{room.facilities?.length ?? 0} items</span>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          {isPrivileged && (
                            <button
                              onClick={e => toggleMaintenance(room, e)}
                              disabled={togglingRoomId === room.id}
                              className={`px-2.5 py-1.5 rounded-xl text-[9px] font-black uppercase transition-all ${isMaintenance ? 'bg-orange-100 text-orange-700 hover:bg-orange-200' : 'bg-slate-100 text-slate-500 hover:bg-orange-100 hover:text-orange-700'}`}
                            >
                              <span className="material-symbols-outlined" style={{ fontSize: 12 }}>construction</span>
                            </button>
                          )}
                          {room.requires_contact ? (
                            <button
                              onClick={e => { e.stopPropagation(); setContactRoom(room); setContactOpen(true) }}
                              className="px-3 py-1.5 rounded-xl text-[9px] font-black uppercase bg-amber-400 text-amber-900 hover:bg-amber-300 transition-all"
                            >
                              Contact
                            </button>
                          ) : !isMaintenance ? (
                            <button
                              onClick={e => { e.stopPropagation(); handleBook(room) }}
                              className="px-4 py-1.5 rounded-xl text-[9px] font-black uppercase bg-slate-900 text-white hover:bg-[#adee2b] hover:text-black transition-all"
                            >
                              Book
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* BookingPanel with slide-in animation */}
      <div
        className="fixed inset-y-0 right-0 z-[100] pointer-events-none"
        style={{
          transform: bookingPanelOpen ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 320ms cubic-bezier(0.4,0,0.2,1)',
          pointerEvents: bookingPanelOpen ? 'auto' : 'none',
        }}
      >
        <BookingPanel
          open={bookingPanelOpen}
          onClose={() => setBookingPanelOpen(false)}
          initialRoom={selectedRoom}
          editBooking={null}
          prefillStart=""
          prefillEnd=""
          onSubmit={() => setBookingPanelOpen(false)}
        />
      </div>
      {bookingPanelOpen && (
        <div className="fixed inset-0 z-[99] bg-black/30 backdrop-blur-sm" onClick={() => setBookingPanelOpen(false)} />
      )}

      <RoomDetailModal
        room={detailRoom}
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        onBook={handleBook}
        bookings={todayBookings as Booking[]}
      />

      <ContactReceptionistModal
        open={contactOpen}
        onClose={() => setContactOpen(false)}
        roomName={contactRoom?.name}
      />

      <style>{`
        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}
