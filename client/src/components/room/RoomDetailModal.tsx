import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { Room, Booking } from '../../types/index'
import { deptColors } from '../../data/mockData'
import { getRoomStats } from '../../api/rooms'
import { SpecialRoomBadge } from '../ui/SpecialRoomBadge'

interface RoomDetailModalProps {
  room: Room | null
  open: boolean
  onClose: () => void
  onBook: (room: Room) => void
  bookings?: Booking[]
}

function parseLocal(iso: string) { return new Date(iso.replace('Z', '')) }
function fmtTime(iso: string) {
  return parseLocal(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

export default function RoomDetailModal({ room, open, onClose, onBook, bookings = [] }: RoomDetailModalProps) {
  const [photoIdx, setPhotoIdx] = useState(0)

  const { data: stats } = useQuery({
    queryKey: ['room-stats', room?.id],
    queryFn: () => getRoomStats(room!.id),
    enabled: !!room && open,
    staleTime: 60000,
  })

  if (!room) return null

  const dotColor = room.type === 'Ballroom' ? '#c084fc' : room.type === 'Executive' ? '#60a5fa' : '#4ade80'
  const photos = (room.photos ?? []).slice(0, 5)

  const now = new Date()
  const todayBookings = bookings
    .filter(b => b.room_id === room.id && b.status !== 'cancelled')
    .sort((a, b) => parseLocal(a.start_at).getTime() - parseLocal(b.start_at).getTime())

  const nowPct = Math.min(100, Math.max(0, ((now.getHours() - 7) * 60 + now.getMinutes()) / (12 * 60) * 100))
  const isAvailableNow = !todayBookings.some(b => parseLocal(b.start_at) <= now && now < parseLocal(b.end_at))

  const nextFreeAt = (() => {
    if (isAvailableNow) return null
    const current = todayBookings.find(b => parseLocal(b.start_at) <= now && now < parseLocal(b.end_at))
    return current ? fmtTime(current.end_at) : null
  })()

  const peakHours = stats?.peak_hours ?? Array(12).fill(0)
  const maxPeak = Math.max(...peakHours, 1)

  const glassCard: React.CSSProperties = {
    flex: 1,
    background: 'rgba(255,255,255,0.13)',
    backdropFilter: 'blur(28px) saturate(180%)',
    WebkitBackdropFilter: 'blur(28px) saturate(180%)',
    border: '1px solid rgba(255,255,255,0.22)',
    borderRadius: 14,
    padding: '10px 13px',
  }

  return (
    <div
      className={`fixed inset-0 z-[200] flex items-center justify-center transition-opacity duration-300
        ${open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
    >
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      <div
        className="relative bg-[#f7f8f6] rounded-2xl overflow-hidden shadow-2xl overflow-y-auto transition-transform duration-300"
        style={{ width: 980, maxHeight: '92vh', transform: open ? 'scale(1)' : 'scale(0.97)' }}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-50 size-9 rounded-full bg-black/20 hover:bg-black/50 flex items-center justify-center text-white backdrop-blur-sm transition-all"
        >
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>close</span>
        </button>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, padding: 10 }}>

          {/* ── Photo hero — spans rows 1+2 for columns 1-2 ── */}
          <div style={{ gridColumn: '1/3', gridRow: '1/3', borderRadius: 20, overflow: 'hidden', position: 'relative', background: '#0f172a', ...(open ? ({ viewTransitionName: 'room-hero' } as unknown as React.CSSProperties) : {}) }}>
            {/* Slideshow */}
            {photos.length > 0 ? (
              <div style={{ display: 'flex', height: '100%', transition: 'transform 0.4s', transform: `translateX(-${photoIdx * 100}%)` }}>
                {photos.map((p, i) => (
                  <img key={i} src={p} style={{ minWidth: '100%', height: '100%', objectFit: 'cover', flexShrink: 0 }} alt="" />
                ))}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 10, opacity: 0.25 }}>
                <span className="material-symbols-outlined" style={{ fontSize: 56, color: 'white' }}>meeting_room</span>
                <p style={{ fontSize: 11, fontWeight: 700, color: 'white', margin: 0, textTransform: 'uppercase', letterSpacing: '0.1em' }}>No photos yet</p>
              </div>
            )}
            {photos.length > 1 && (
              <>
                <button onClick={() => setPhotoIdx(Math.max(0, photoIdx - 1))} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', background: 'rgba(0,0,0,0.35)', border: 'none', color: 'white', width: 30, height: 30, borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 20 }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>chevron_left</span>
                </button>
                <button onClick={() => setPhotoIdx(Math.min(photos.length - 1, photoIdx + 1))} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'rgba(0,0,0,0.35)', border: 'none', color: 'white', width: 30, height: 30, borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 20 }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>chevron_right</span>
                </button>
                <div style={{ position: 'absolute', bottom: 'auto', top: 12, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 5, zIndex: 20 }}>
                  {photos.map((_, i) => (
                    <button key={i} onClick={() => setPhotoIdx(i)} style={{ width: i === photoIdx ? 20 : 6, height: 6, borderRadius: i === photoIdx ? 3 : '50%', background: i === photoIdx ? 'white' : 'rgba(255,255,255,0.35)', border: 'none', cursor: 'pointer', padding: 0, transition: 'all 0.2s' }} />
                  ))}
                </div>
                <div style={{ position: 'absolute', top: 12, right: 12, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(8px)', color: 'white', fontSize: 9, fontWeight: 700, padding: '3px 8px', borderRadius: 99, zIndex: 20 }}>
                  {photoIdx + 1} / {photos.length}
                </div>
              </>
            )}

            {/* Gradient — stronger at bottom for overlay readability */}
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.35) 50%, transparent 75%)', pointerEvents: 'none' }} />

            {/* Bottom overlay — room info + glass cards below */}
            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '0 14px 14px', zIndex: 10 }}>

              {/* Room name + badge */}
              <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
                <div>
                  <p style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.2em', color: 'rgba(255,255,255,0.45)', marginBottom: 3, marginTop: 0 }}>{room.type}</p>
                  <h2 style={{ fontSize: 28, fontWeight: 900, letterSpacing: '-0.04em', color: 'white', textTransform: 'uppercase', lineHeight: 1, margin: 0 }}>{room.name}</h2>
                </div>
                <div style={{ flexShrink: 0, textAlign: 'right' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                    <div style={{ background: room.status === 'maintenance' ? '#fb923c' : isAvailableNow ? '#adee2b' : '#ef4444', color: room.status === 'maintenance' ? '#fff' : isAvailableNow ? '#000' : '#fff', fontSize: 9, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.08em', padding: '6px 14px', borderRadius: 99 }}>
                      {room.status === 'maintenance' ? 'Maintenance' : isAvailableNow ? 'Available' : 'Occupied'}
                    </div>
                    {room.requires_contact && <SpecialRoomBadge size="xs" variant="dark" />}
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 8, marginBottom: 12 }}>
                <p style={{ fontSize: 12, fontWeight: 800, color: 'rgba(255,255,255,0.88)', display: 'flex', alignItems: 'center', gap: 5, margin: 0 }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 14, color: '#adee2b' }}>groups</span>
                  {room.capacity} seats
                </p>
                <p style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.45)', margin: 0 }}>Floor {room.floor}{room.building?.name ? ` · ${room.building.name}` : ''}</p>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: dotColor, marginLeft: 'auto' }} />
              </div>

              {/* Glass cards row — below room info */}
              <div style={{ display: 'flex', gap: 8 }}>

                {/* Facilities */}
                <div style={glassCard}>
                  <p style={{ fontSize: 7, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.15em', color: 'rgba(255,255,255,0.45)', margin: '0 0 7px' }}>Facilities</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {(room.facilities ?? []).map(f => (
                      <span key={f.name} style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.88)', fontSize: 8, fontWeight: 700, textTransform: 'uppercase', padding: '3px 8px', borderRadius: 99 }}>
                        <span className="material-symbols-outlined" style={{ fontSize: 9 }}>{f.icon}</span>{f.name}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Peak Hours */}
                <div style={glassCard}>
                  <p style={{ fontSize: 7, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.15em', color: 'rgba(255,255,255,0.45)', margin: '0 0 7px' }}>
                    Peak Hours <span style={{ color: 'rgba(255,255,255,0.25)', fontWeight: 600, textTransform: 'none' }}>(last 30d)</span>
                  </p>
                  {peakHours.every(v => v === 0) ? (
                    <p style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', fontWeight: 600, margin: 0 }}>No data yet</p>
                  ) : (
                    <>
                      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2.5, height: 36 }}>
                        {peakHours.map((v, i) => {
                          const pct = Math.round((v / maxPeak) * 100)
                          return <div key={i} style={{ flex: 1, height: `${Math.max(6, pct)}%`, background: pct > 70 ? '#adee2b' : 'rgba(255,255,255,0.25)', borderRadius: 3, transition: `height 0.4s ease ${i * 30}ms` }} />
                        })}
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 5 }}>
                        {['07','10','13','16','19'].map(t => <span key={t} style={{ fontSize: 7, fontWeight: 700, color: 'rgba(255,255,255,0.3)' }}>{t}</span>)}
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* ── Stats ── */}
          <div style={{ gridColumn: '3/4', gridRow: '1/2', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ background: 'white', borderRadius: 20, padding: '18px 20px', flex: 1, border: '0.5px solid #e2e8f0' }}>
              <p style={{ fontSize: 8, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.15em', color: '#94a3b8', margin: '0 0 6px' }}>This Month</p>
              <p style={{ fontSize: 40, fontWeight: 800, color: '#1e293b', lineHeight: 1, margin: 0 }}>{stats?.bookings_this_month ?? '–'}</p>
              <p style={{ fontSize: 8, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', margin: '4px 0 0' }}>bookings</p>
            </div>
            <div style={{ background: 'white', borderRadius: 20, padding: '18px 20px', flex: 1, border: '0.5px solid #e2e8f0' }}>
              <p style={{ fontSize: 8, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.15em', color: '#94a3b8', margin: '0 0 6px' }}>Utilization</p>
              <p style={{ fontSize: 40, fontWeight: 800, color: '#1e293b', lineHeight: 1, margin: 0 }}>{stats ? `${stats.utilization}%` : '–'}</p>
              <p style={{ fontSize: 8, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', margin: '4px 0 0' }}>this month</p>
            </div>
          </div>

          {/* ── Quick action ── */}
          <div style={{ gridColumn: '3/4', gridRow: '2/3', background: '#adee2b', borderRadius: 20, padding: '18px 20px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 10 }}>
            <div>
              <p style={{ fontSize: 8, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.15em', color: 'rgba(0,0,0,0.4)', margin: '0 0 6px' }}>Quick Action</p>
              <p style={{ fontSize: 13, fontWeight: 800, color: '#000', margin: 0, lineHeight: 1.3 }}>
                {room.status === 'maintenance' ? 'Room is under maintenance'
                  : room.requires_contact ? 'Special Room — Contact Receptionist / GAA to book'
                  : isAvailableNow ? 'Ready to book this room?'
                  : `Occupied until ${nextFreeAt ?? '–'}`}
              </p>
              {!isAvailableNow && nextFreeAt && (
                <p style={{ fontSize: 10, fontWeight: 600, color: 'rgba(0,0,0,0.45)', margin: '4px 0 0' }}>You can book from {nextFreeAt}</p>
              )}
            </div>
            <button
              onClick={() => { onClose(); onBook(room) }}
              style={{ width: '100%', padding: 11, background: room.requires_contact ? '#fef3c7' : '#000', color: room.requires_contact ? '#92400e' : '#adee2b', border: room.requires_contact ? '1.5px solid #fbbf24' : 'none', borderRadius: 14, fontSize: 9, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em', cursor: 'pointer', fontFamily: 'Manrope, sans-serif', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
            >
              {room.requires_contact && <span className="material-symbols-outlined" style={{ fontSize: 13 }}>support_agent</span>}
              {room.requires_contact ? 'Contact Receptionist' : 'Book This Room →'}
            </button>
          </div>

          {/* ── Today's Occupancy ── */}
          <div style={{ gridColumn: '1/3', gridRow: '3/4', background: 'white', borderRadius: 20, padding: '18px 20px', border: '0.5px solid #e2e8f0' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <p style={{ fontSize: 8, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.15em', color: '#94a3b8', margin: 0 }}>Today&rsquo;s Occupancy</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 8, fontWeight: 900, textTransform: 'uppercase', padding: '3px 10px', borderRadius: 99, background: room.status === 'maintenance' ? '#ffedd5' : isAvailableNow ? '#dcfce7' : '#fee2e2', color: room.status === 'maintenance' ? '#c2410c' : isAvailableNow ? '#16a34a' : '#ef4444' }}>
                  {room.status === 'maintenance' ? 'Under Maintenance' : isAvailableNow ? 'Free Now' : 'Currently Occupied'}
                </span>
                {room.requires_contact && <SpecialRoomBadge size="xs" />}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 9, fontWeight: 700, color: '#cbd5e1', width: 22, textAlign: 'right' }}>07</span>
              <div style={{ flex: 1, height: 28, background: '#f1f5f9', borderRadius: 8, position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', left: `${nowPct}%`, width: 2, height: '100%', background: '#ef4444', zIndex: 10 }} />
                {todayBookings.map(b => {
                  const startH = parseLocal(b.start_at).getHours() + parseLocal(b.start_at).getMinutes() / 60
                  const endH   = parseLocal(b.end_at).getHours()   + parseLocal(b.end_at).getMinutes() / 60
                  const left   = Math.max(0, ((startH - 7) / 12) * 100)
                  const width  = Math.min(100 - left, ((endH - startH) / 12) * 100)
                  const isMaintType = b.type === 'maintenance' || b.type === 'repairment'
                  const bDept = b.user?.department_name || (typeof b.user?.department === 'string' ? b.user.department : '') || 'GAA'
                  const colors = isMaintType ? { bg: '#fb923c', text: '#fff' } : (deptColors[bDept] || deptColors['GAA'])
                  return (
                    <div key={b.id} title={`${b.title} · ${b.user?.name}`} style={{ position: 'absolute', left: `${left}%`, width: `${width}%`, height: '100%', background: colors.bg, borderRadius: 6, display: 'flex', alignItems: 'center', paddingLeft: 6, overflow: 'hidden', boxSizing: 'border-box' }}>
                      <span style={{ fontSize: 8, fontWeight: 800, color: colors.text, whiteSpace: 'nowrap' }}>{isMaintType ? (b.type === 'maintenance' ? 'MAINT' : 'REPAIR') : bDept}</span>
                    </div>
                  )
                })}
              </div>
              <span style={{ fontSize: 9, fontWeight: 700, color: '#cbd5e1', width: 22 }}>19</span>
            </div>
            {todayBookings.length === 0 && (
              <p style={{ fontSize: 10, color: '#cbd5e1', fontWeight: 600, marginTop: 8, marginBottom: 0 }}>No bookings today — room is fully available</p>
            )}
          </div>

          {/* ── Notes ── */}
          <div style={{ gridColumn: '3/4', gridRow: '3/4', background: 'white', borderRadius: 20, padding: '18px 20px', border: '0.5px solid #e2e8f0' }}>
            <p style={{ fontSize: 8, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.15em', color: '#94a3b8', margin: '0 0 10px' }}>Notes</p>
            {room.notes ? (
              <p style={{ fontSize: 11, fontWeight: 500, color: '#64748b', lineHeight: 1.6, margin: 0 }}>{room.notes}</p>
            ) : (
              <p style={{ fontSize: 11, fontWeight: 500, color: '#cbd5e1', lineHeight: 1.6, margin: 0, fontStyle: 'italic' }}>No notes for this room.</p>
            )}
          </div>

        </div>
      </div>
    </div>
  )
}
