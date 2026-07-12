import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { getNotifications, markNotificationRead } from '../../api/notifications'
import { useNotification } from '../../context/NotificationContext'
import { useAuth } from '../../context/AuthContext'
import type { AppNotification } from '../../types'

interface ToastNotif {
  notif: AppNotification
  id: string
  exiting: boolean
}

const MAX_VISIBLE = 3

export default function NotificationToast() {
  const { user } = useAuth()
  const { openNotifications } = useNotification()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const seenIds = useRef<Set<number>>(new Set())
  const [toasts, setToasts] = useState<ToastNotif[]>([])

  const { data } = useQuery({
    queryKey: ['notifications'],
    queryFn: getNotifications,
    refetchInterval: 10_000,
    enabled: !!user,
    staleTime: 0, // always fetch fresh on login
  })

  // Reset seenIds when user changes (logout → login)
  useEffect(() => {
    if (!user) {
      seenIds.current = new Set()
      setToasts([])
    }
  }, [user])

  useEffect(() => {
    if (!data?.items) return
    const newOnes = data.items.filter(n => !n.read_at && !seenIds.current.has(n.id))
    if (newOnes.length === 0) return
    newOnes.forEach(n => seenIds.current.add(n.id))
    // Show all — no auto-dismiss, user must click
    setToasts(prev => [
      ...newOnes.map(n => ({ notif: n, id: `nt-${n.id}-${Date.now()}`, exiting: false })),
      ...prev,
    ])
  }, [data])

  function dismiss(id: string) {
    setToasts(prev => prev.map(t => t.id === id ? { ...t, exiting: true } : t))
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 280)
  }

  function dismissAll() {
    setToasts(prev => prev.map(t => ({ ...t, exiting: true })))
    setTimeout(() => setToasts([]), 280)
  }

  async function handleClick(toast: ToastNotif) {
    dismiss(toast.id)
    await markNotificationRead(toast.notif.id)
    qc.invalidateQueries({ queryKey: ['notifications'] })
    const startAt = toast.notif.booking?.start_at
    if (startAt) {
      navigate(`/?date=${startAt.slice(0, 10)}&highlight=${toast.notif.booking_id}`)
    } else {
      openNotifications()
    }
  }

  if (toasts.length === 0) return null

  const visible = toasts.slice(0, MAX_VISIBLE)
  const hidden = toasts.length - MAX_VISIBLE

  return createPortal(
    <div style={{ position: 'fixed', top: 68, right: 20, zIndex: 99997, display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end', pointerEvents: 'none' }}>
      {/* "+N more" badge + dismiss all */}
      {hidden > 0 && (
        <div style={{ pointerEvents: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 10, fontWeight: 900, color: 'rgba(255,255,255,0.5)', background: 'rgba(15,20,45,0.6)', borderRadius: 99, padding: '3px 10px', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.08)' }}>
            +{hidden} more
          </span>
          <button
            onClick={dismissAll}
            style={{ fontSize: 10, fontWeight: 900, color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', padding: 0, textTransform: 'uppercase', letterSpacing: '0.08em' }}
          >
            Dismiss all
          </button>
        </div>
      )}

      {visible.map(t => (
        <div
          key={t.id}
          onClick={() => handleClick(t)}
          className={t.exiting ? 'toast-pop-out-top' : 'toast-pop-in-top'}
          style={{
            pointerEvents: 'auto',
            width: 300,
            background: 'rgba(15,20,45,0.75)',
            backdropFilter: 'blur(32px) saturate(180%)',
            WebkitBackdropFilter: 'blur(32px) saturate(180%)',
            border: '1px solid rgba(173,238,43,0.22)',
            borderRadius: 16,
            boxShadow: '0 8px 32px rgba(0,0,0,0.32)',
            padding: '12px 14px',
            display: 'flex',
            gap: 10,
            alignItems: 'flex-start',
            cursor: 'pointer',
          }}
        >
          <div style={{ width: 30, height: 30, borderRadius: 10, background: 'rgba(173,238,43,0.14)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span className="material-symbols-outlined" style={{ fontSize: 15, color: '#adee2b' }}>notifications</span>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 10, fontWeight: 900, color: '#adee2b', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 3 }}>Notification</p>
            <p style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.88)', lineHeight: 1.4 }}>{t.notif.message}</p>
            <p style={{ fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.3)', marginTop: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Click to view · × to dismiss</p>
          </div>
          <button
            onClick={e => { e.stopPropagation(); dismiss(t.id) }}
            style={{ width: 20, height: 20, borderRadius: 6, border: 'none', background: 'rgba(255,255,255,0.07)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.35)', flexShrink: 0, marginTop: 1 }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 12 }}>close</span>
          </button>
        </div>
      ))}
    </div>,
    document.body
  )
}
