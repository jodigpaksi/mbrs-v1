import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getMyBookings } from '../../api/bookings'
import {
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  clearAllNotifications,
} from '../../api/notifications'
import type { Booking, AppNotification } from '../../types'

function parseLocal(s: string): Date {
  const [date, time] = s.replace('T', ' ').split(' ')
  const [y, mo, d] = date.split('-').map(Number)
  const [h, mi] = (time ?? '').split(':').map(Number)
  return new Date(y, mo - 1, d, h || 0, mi || 0)
}

function fmtTime(s: string) {
  return parseLocal(s).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

interface Props {
  anchorEl: HTMLElement | null
  open: boolean
  onClose: () => void
}

export default function NotificationPanel({ anchorEl, open, onClose }: Props) {
  const qc = useQueryClient()
  const panelRef = useRef<HTMLDivElement>(null)
  const now = new Date()

  const { data: notifData, refetch } = useQuery({
    queryKey: ['notifications'],
    queryFn: getNotifications,
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  })
  const unreadCount = notifData?.unread_count ?? 0
  const notifItems: AppNotification[] = notifData?.items ?? []

  const { data: myBookings = [] } = useQuery<Booking[]>({
    queryKey: ['my-bookings'],
    queryFn: getMyBookings,
    staleTime: 30_000,
  })
  const ongoingBookings = myBookings.filter(b => {
    const start = parseLocal(b.start_at)
    const end = parseLocal(b.end_at)
    return start <= now && end > now && start.toDateString() === now.toDateString()
  })

  // Close on outside mousedown
  useEffect(() => {
    if (!open) return
    function onMouseDown(e: MouseEvent) {
      if (
        panelRef.current &&
        !panelRef.current.contains(e.target as Node) &&
        anchorEl &&
        !anchorEl.contains(e.target as Node)
      ) {
        onClose()
      }
    }
    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [open, anchorEl, onClose])

  if (!open) return null

  const rect = anchorEl?.getBoundingClientRect()
  const top = (rect?.bottom ?? 60) + 8
  const right = window.innerWidth - (rect?.right ?? 320)

  async function handleMarkRead(id: number) {
    await markNotificationRead(id)
    qc.invalidateQueries({ queryKey: ['notifications'] })
    refetch()
  }

  async function handleMarkAllRead() {
    await markAllNotificationsRead()
    qc.invalidateQueries({ queryKey: ['notifications'] })
    refetch()
  }

  async function handleClearAll() {
    if (!window.confirm('Hapus semua notifikasi?')) return
    await clearAllNotifications()
    qc.invalidateQueries({ queryKey: ['notifications'] })
    refetch()
  }

  return createPortal(
    <div
      ref={panelRef}
      style={{
        position: 'fixed',
        top,
        right,
        width: 320,
        zIndex: 9999,
        background: 'rgba(255,255,255,0.97)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        border: '1px solid rgba(0,0,0,0.08)',
        borderRadius: 20,
        boxShadow: '0 12px 40px rgba(0,0,0,0.16)',
        display: 'flex',
        flexDirection: 'column',
        maxHeight: 500,
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div style={{ padding: '14px 16px 12px', borderBottom: '1px solid #f1f5f9', flexShrink: 0 }}>
        <p style={{ fontSize: 11, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#475569' }}>
          Notifications
        </p>
      </div>

      {/* List */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {ongoingBookings.length === 0 && notifItems.length === 0 ? (
          <div style={{ padding: '40px 16px', textAlign: 'center' }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: '#cbd5e1', textTransform: 'uppercase' }}>No notifications</p>
          </div>
        ) : (
          <>
            {/* Ongoing meetings */}
            {ongoingBookings.map(b => (
              <div key={`og-${b.id}`} style={{ display: 'flex', gap: 12, padding: '12px 16px', borderBottom: '1px solid #f1f5f9', background: 'rgba(173,238,43,0.07)' }}>
                <span className="material-symbols-outlined" style={{ fontSize: 16, color: '#4d7c00', flexShrink: 0, marginTop: 2 }}>meeting_room</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 11, fontWeight: 900, color: '#1e293b', marginBottom: 2 }}>Meeting in progress</p>
                  <p style={{ fontSize: 10, fontWeight: 700, color: '#475569', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.title}</p>
                  {b.room && (
                    <p style={{ fontSize: 9, fontWeight: 700, color: '#94a3b8', marginTop: 2 }}>
                      {b.room.name}{b.room.building ? ` · ${b.room.building.code ?? b.room.building.name}` : ''}
                    </p>
                  )}
                  <p style={{ fontSize: 9, fontWeight: 900, color: '#4d7c00', marginTop: 4 }}>{fmtTime(b.start_at)} – {fmtTime(b.end_at)}</p>
                </div>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#adee2b', flexShrink: 0, marginTop: 6, animation: 'pulse 2s infinite' }} />
              </div>
            ))}

            {/* Backend notifications */}
            {notifItems.map(n => (
              <div key={n.id} style={{ display: 'flex', gap: 12, padding: '12px 16px', borderBottom: '1px solid #f1f5f9', background: n.read_at ? 'white' : 'rgba(248,250,252,1)' }}>
                <span className="material-symbols-outlined" style={{ fontSize: 16, color: '#94a3b8', flexShrink: 0, marginTop: 2 }}>person_pin</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 11, fontWeight: 700, color: '#334155', lineHeight: 1.4 }}>{n.message}</p>
                  <p style={{ fontSize: 9, fontWeight: 700, color: '#94a3b8', marginTop: 4 }}>
                    {new Date(n.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                    {' · '}
                    {new Date(n.created_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                  {!n.read_at ? (
                    <>
                      <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#adee2b', display: 'inline-block' }} />
                      <button
                        onClick={() => handleMarkRead(n.id)}
                        title="Mark as read"
                        style={{
                          width: 26, height: 26, borderRadius: 8, border: '1px solid #e2e8f0',
                          background: 'white', cursor: 'pointer', display: 'flex',
                          alignItems: 'center', justifyContent: 'center', color: '#64748b',
                        }}
                        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = '#adee2b'; (e.currentTarget as HTMLButtonElement).style.color = '#000'; (e.currentTarget as HTMLButtonElement).style.borderColor = '#adee2b' }}
                        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'white'; (e.currentTarget as HTMLButtonElement).style.color = '#64748b'; (e.currentTarget as HTMLButtonElement).style.borderColor = '#e2e8f0' }}
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: 13 }}>done</span>
                      </button>
                    </>
                  ) : (
                    <span className="material-symbols-outlined" style={{ fontSize: 14, color: '#cbd5e1' }}>done_all</span>
                  )}
                </div>
              </div>
            ))}
          </>
        )}
      </div>

      {/* Footer */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 16px', borderTop: '1px solid #f1f5f9', flexShrink: 0 }}>
        <button
          onClick={handleMarkAllRead}
          style={{
            fontSize: 9, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.08em',
            color: unreadCount > 0 ? '#475569' : '#cbd5e1',
            background: 'none', border: 'none', cursor: unreadCount > 0 ? 'pointer' : 'default', padding: '4px 0',
          }}
        >
          Mark all read
        </button>
        <button
          onClick={handleClearAll}
          style={{
            fontSize: 9, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.08em',
            color: notifItems.length > 0 ? '#ef4444' : '#cbd5e1',
            background: 'none', border: 'none', cursor: notifItems.length > 0 ? 'pointer' : 'default', padding: '4px 0',
          }}
        >
          Clear all
        </button>
      </div>
    </div>,
    document.body
  )
}
