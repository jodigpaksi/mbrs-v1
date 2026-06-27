import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import {
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  clearAllNotifications,
} from '../../api/notifications'
import { confirmPresenceWeb, getMyBookings } from '../../api/bookings'
import { getGeneralSettings } from '../../api/settings'
import { useNotification } from '../../context/NotificationContext'
import type { AppNotification, Booking } from '../../types'

function parseLocal(s: string): Date {
  const [date, time] = s.replace('T', ' ').split(' ')
  const [y, mo, d] = date.split('-').map(Number)
  const [h, mi] = (time ?? '').split(':').map(Number)
  return new Date(y, mo - 1, d, h || 0, mi || 0)
}

function timeAgo(iso: string) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

export default function NotificationPanel() {
  const { open, closeNotifications } = useNotification()
  const qc = useQueryClient()
  const panelRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  const [confirmClear, setConfirmClear] = useState(false)
  const [confirmingId, setConfirmingId] = useState<number | null>(null)

  const { data: notifData, refetch } = useQuery({
    queryKey: ['notifications'],
    queryFn: getNotifications,
    refetchInterval: 10_000,
    refetchOnWindowFocus: true,
    enabled: open,
  })
  const unreadCount = notifData?.unread_count ?? 0
  const items: AppNotification[] = notifData?.items ?? []

  // Only load settings when panel is opened — staleTime means cache is reused
  const { data: generalSettings } = useQuery({
    queryKey: ['settings-general'],
    queryFn: getGeneralSettings,
    staleTime: 5 * 60_000,
    enabled: open,
  })
  const webConfirmEnabled = generalSettings?.web_confirm_enabled       ?? false
  const windowBefore      = generalSettings?.anti_ghost_window_before  ?? 5
  const windowAfter       = generalSettings?.anti_ghost_window_after   ?? 10

  // Load my bookings only when panel is open AND feature is enabled. No refetchInterval —
  // Reverb + ['my-bookings'] invalidation handle real-time updates.
  const { data: myBookings = [] } = useQuery<Booking[]>({
    queryKey: ['my-bookings'],
    queryFn: getMyBookings,
    enabled: open && webConfirmEnabled,
    staleTime: 30_000,
  })

  useEffect(() => {
    if (!open) { setConfirmClear(false); return }
    refetch()
    function onMouseDown(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        closeNotifications()
      }
    }
    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [open])

  type NotifCache = { unread_count: number; items: AppNotification[] }

  function optimistic(updater: (old: NotifCache) => NotifCache) {
    qc.setQueryData<NotifCache>(['notifications'], old =>
      old ? updater(old) : old
    )
  }

  async function handleMarkRead(id: number) {
    optimistic(old => ({
      unread_count: Math.max(0, old.unread_count - (old.items.find(n => n.id === id && !n.read_at) ? 1 : 0)),
      items: old.items.map(n => n.id === id ? { ...n, read_at: new Date().toISOString() } : n),
    }))
    await markNotificationRead(id).catch(() => qc.invalidateQueries({ queryKey: ['notifications'] }))
  }

  function handleClickNotif(n: AppNotification) {
    if (!n.read_at) handleMarkRead(n.id)
    closeNotifications()
    const startAt = n.booking?.start_at
    if (!startAt) return
    const date = startAt.slice(0, 10)
    navigate(`/?date=${date}&highlight=${n.booking_id}`)
  }

  async function handleMarkAllRead() {
    if (unreadCount === 0) return
    const now = new Date().toISOString()
    optimistic(old => ({
      unread_count: 0,
      items: old.items.map(n => ({ ...n, read_at: n.read_at ?? now })),
    }))
    await markAllNotificationsRead().catch(() => qc.invalidateQueries({ queryKey: ['notifications'] }))
  }

  async function handleClearAll() {
    if (items.length === 0) return
    optimistic(() => ({ unread_count: 0, items: [] }))
    setConfirmClear(false)
    await clearAllNotifications().catch(() => qc.invalidateQueries({ queryKey: ['notifications'] }))
  }

  async function handleConfirmPresence(b: Booking) {
    setConfirmingId(b.id)
    try {
      await confirmPresenceWeb(b.id)
      qc.invalidateQueries({ queryKey: ['my-bookings'] })
    } catch { /* ignore */ }
    finally { setConfirmingId(null) }
  }

  // Compute presence reminders inline (no extra state needed)
  const now = new Date()
  const today = now.toDateString()
  const presenceReminders: Booking[] = webConfirmEnabled
    ? (myBookings as Booking[]).filter(b => {
        try {
          const start       = parseLocal(b.start_at)
          const windowOpen  = new Date(start.getTime() - windowBefore * 60_000)
          const windowClose = new Date(start.getTime() + windowAfter  * 60_000)
          const isToday    = start.toDateString() === today
          const inWindow   = now >= windowOpen && now <= windowClose
          const notConfirmed = !b.presence_confirmed_at
          const isTarget     = !b.booked_for_user_id || b.is_recipient === true
          return isToday && inWindow && notConfirmed && isTarget
        } catch { return false }
      })
    : []

  if (!open) return null

  return createPortal(
    <div
      ref={panelRef}
      style={{
        position: 'fixed',
        top: 64,
        right: 20,
        width: 360,
        zIndex: 99998,
        background: 'var(--ds-glass-bg)',
        backdropFilter: 'blur(48px) saturate(200%)',
        WebkitBackdropFilter: 'blur(48px) saturate(200%)',
        border: '1px solid var(--ds-glass-border)',
        borderRadius: 24,
        boxShadow: 'var(--ds-glass-shadow)',
        display: 'flex',
        flexDirection: 'column',
        maxHeight: 520,
        overflow: 'hidden',
        animation: 'notif-in 0.22s cubic-bezier(0.34,1.04,0.64,1)',
      }}
    >
      <style>{`@keyframes notif-in{from{opacity:0;transform:translateY(-8px) scale(0.97)}to{opacity:1;transform:translateY(0) scale(1)}}`}</style>

      {/* Header */}
      <div style={{ padding: '16px 18px 14px', borderBottom: '1px solid var(--ds-border-sub)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="material-symbols-outlined" style={{ fontSize: 18, color: 'var(--ds-text-3)' }}>notifications</span>
          <p style={{ fontSize: 12, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--ds-text-1)' }}>Notifications</p>
          {unreadCount > 0 && (
            <span style={{ fontSize: 9, fontWeight: 900, background: '#adee2b', color: '#000', borderRadius: 99, padding: '2px 7px', lineHeight: 1.6 }}>{unreadCount}</span>
          )}
        </div>
        <button
          onClick={closeNotifications}
          style={{ width: 28, height: 28, borderRadius: 10, border: '1px solid var(--ds-border-sub)', background: 'var(--ds-bg-surface-2)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ds-text-3)' }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 15 }}>close</span>
        </button>
      </div>

      {/* Presence confirmation reminders — only when feature enabled and there are ongoing bookings */}
      {presenceReminders.length > 0 && (
        <div style={{ borderBottom: '1px solid var(--ds-border-sub)', flexShrink: 0 }}>
          {presenceReminders.map(b => (
            <div key={b.id} style={{ padding: '12px 18px', display: 'flex', gap: 12, alignItems: 'center', background: 'rgba(99,102,241,0.07)' }}>
              <div style={{ width: 34, height: 34, borderRadius: 12, background: 'rgba(99,102,241,0.18)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span className="material-symbols-outlined" style={{ fontSize: 16, color: '#6366f1', fontVariationSettings: "'FILL' 1" }}>how_to_reg</span>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 11, fontWeight: 800, color: 'var(--ds-text-1)', lineHeight: 1.4, marginBottom: 2 }}>Confirm your presence</p>
                <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--ds-text-3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {b.title}{b.room ? ` · ${b.room.name}` : ''}
                </p>
              </div>
              <button
                onClick={() => handleConfirmPresence(b)}
                disabled={confirmingId === b.id}
                style={{ flexShrink: 0, padding: '5px 12px', borderRadius: 10, border: '1.5px solid rgba(99,102,241,0.5)', background: 'rgba(99,102,241,0.12)', fontSize: 10, fontWeight: 900, color: '#6366f1', cursor: 'pointer', opacity: confirmingId === b.id ? 0.6 : 1, transition: 'all 0.15s', textTransform: 'uppercase', letterSpacing: '0.06em' }}
              >
                {confirmingId === b.id ? '…' : 'Confirm'}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Notification list */}
      <div style={{ flex: 1, overflowY: 'auto', scrollbarWidth: 'thin' }}>
        {items.length === 0 ? (
          <div style={{ padding: '48px 16px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
            <span className="material-symbols-outlined" style={{ fontSize: 36, color: 'var(--ds-text-4)' }}>notifications_off</span>
            <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--ds-text-4)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>No notifications</p>
          </div>
        ) : (
          items.map(n => (
            <div
              key={n.id}
              onClick={() => handleClickNotif(n)}
              style={{
                display: 'flex', gap: 12, padding: '14px 18px',
                borderBottom: '1px solid var(--ds-border-sub)',
                background: n.read_at ? 'transparent' : 'rgba(173,238,43,0.06)',
                transition: 'background 0.2s',
                cursor: n.booking?.start_at ? 'pointer' : 'default',
              }}
              onMouseEnter={e => { if (n.booking?.start_at) (e.currentTarget as HTMLDivElement).style.background = n.read_at ? 'var(--ds-bg-raised)' : 'rgba(173,238,43,0.12)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = n.read_at ? 'transparent' : 'rgba(173,238,43,0.06)' }}
            >
              {/* Icon */}
              <div style={{ width: 34, height: 34, borderRadius: 12, background: n.read_at ? 'var(--ds-bg-raised)' : 'rgba(173,238,43,0.18)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span className="material-symbols-outlined" style={{ fontSize: 16, color: n.read_at ? 'var(--ds-text-3)' : '#4d7c00' }}>person_pin</span>
              </div>

              {/* Content */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 12, fontWeight: n.read_at ? 600 : 800, color: n.read_at ? 'var(--ds-text-2)' : 'var(--ds-text-1)', lineHeight: 1.45, marginBottom: 4 }}>{n.message}</p>
                <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--ds-text-3)' }}>{timeAgo(n.created_at)}</p>
              </div>

              {/* Unread dot + mark read */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, flexShrink: 0, paddingTop: 2 }}>
                {!n.read_at ? (
                  <>
                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#adee2b', display: 'block', flexShrink: 0 }} />
                    <button
                      onClick={e => { e.stopPropagation(); handleMarkRead(n.id) }}
                      title="Mark as read"
                      style={{ width: 26, height: 26, borderRadius: 8, border: '1px solid var(--ds-border)', background: 'var(--ds-bg-surface-2)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ds-text-3)', transition: 'all 0.15s' }}
                      onMouseEnter={e => { const b = e.currentTarget; b.style.background = '#adee2b'; b.style.color = '#000'; b.style.borderColor = '#adee2b' }}
                      onMouseLeave={e => { const b = e.currentTarget; b.style.background = 'var(--ds-bg-surface-2)'; b.style.color = 'var(--ds-text-3)'; b.style.borderColor = 'var(--ds-border)' }}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: 13 }}>done</span>
                    </button>
                  </>
                ) : (
                  <span className="material-symbols-outlined" style={{ fontSize: 15, color: 'var(--ds-text-4)' }}>done_all</span>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Footer */}
      <div style={{ borderTop: '1px solid var(--ds-border-sub)', flexShrink: 0 }}>
        {confirmClear ? (
          <div style={{ padding: '12px 18px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--ds-text-2)', textAlign: 'center' }}>
              Clear all <span style={{ fontWeight: 900, color: 'var(--ds-text-1)' }}>{items.length}</span> notification{items.length !== 1 ? 's' : ''}?
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => setConfirmClear(false)}
                style={{ flex: 1, padding: '7px 0', borderRadius: 10, border: '1px solid var(--ds-border)', background: 'var(--ds-bg-surface-2)', fontSize: 10, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--ds-text-2)', cursor: 'pointer', transition: 'all 0.15s' }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--ds-bg-raised)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--ds-bg-surface-2)' }}
              >
                Cancel
              </button>
              <button
                onClick={handleClearAll}
                style={{ flex: 1, padding: '7px 0', borderRadius: 10, border: '1px solid #ef4444', background: '#ef4444', fontSize: 10, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'white', cursor: 'pointer', transition: 'all 0.15s' }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = '#dc2626'; (e.currentTarget as HTMLButtonElement).style.borderColor = '#dc2626' }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = '#ef4444'; (e.currentTarget as HTMLButtonElement).style.borderColor = '#ef4444' }}
              >
                Clear all
              </button>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 18px', gap: 8 }}>
            <button
              onClick={handleMarkAllRead}
              disabled={unreadCount === 0}
              style={{ fontSize: 10, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.08em', color: unreadCount > 0 ? 'var(--ds-text-2)' : 'var(--ds-text-4)', background: 'none', border: 'none', cursor: unreadCount > 0 ? 'pointer' : 'default', padding: '4px 0', transition: 'color 0.15s' }}
            >
              Mark all as read
            </button>
            <button
              onClick={() => items.length > 0 && setConfirmClear(true)}
              disabled={items.length === 0}
              style={{ fontSize: 10, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.08em', color: items.length > 0 ? '#ef4444' : 'var(--ds-text-4)', background: 'none', border: 'none', cursor: items.length > 0 ? 'pointer' : 'default', padding: '4px 0', transition: 'color 0.15s' }}
            >
              Clear all
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body
  )
}

export function useNotificationUnreadCount() {
  const { data } = useQuery({
    queryKey: ['notifications'],
    queryFn: getNotifications,
    refetchInterval: 10_000,
    refetchOnWindowFocus: true,
  })
  return data?.unread_count ?? 0
}
