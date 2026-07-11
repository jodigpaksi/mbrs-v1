import { useState, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useQuery } from '@tanstack/react-query'
import { getDirectory } from '../../api/users'
import UserAvatar from './UserAvatar'
import type { User } from '../../types'

interface Props {
  name: string
  userId?: number
  user?: User
  children: ReactNode
}

type DirUser = { id: number; name: string; email: string; ext?: string; department: string }

const CARD_W = 230
const DELAY = 280

export default function UserHoverCard({ name, userId, user: propUser, children }: Props) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const wrapRef = useRef<HTMLDivElement>(null)

  const { data: directory = [] } = useQuery<DirUser[]>({
    queryKey: ['user-directory'],
    queryFn: getDirectory,
    staleTime: 60_000,
    enabled: !propUser && !!userId,
  })

  const dirUser: DirUser | undefined = userId ? directory.find(u => u.id === userId) : undefined
  const resolved = propUser ?? dirUser

  function show(e: React.PointerEvent) {
    if (timerRef.current) clearTimeout(timerRef.current)
    const x = e.clientX, y = e.clientY
    timerRef.current = setTimeout(() => setPos({ x, y }), DELAY)
  }

  function hide(e: React.PointerEvent) {
    if (wrapRef.current?.contains(e.relatedTarget as Node)) return
    if (timerRef.current) clearTimeout(timerRef.current)
    setPos(null)
  }

  function move(e: React.PointerEvent) {
    if (pos) setPos({ x: e.clientX, y: e.clientY })
  }

  const px = pos ? Math.min(pos.x + 14, window.innerWidth - CARD_W - 8) : 0
  const py = pos ? Math.max(pos.y - 148, 8) : 0

  const dept = (resolved as User | DirUser | undefined)?.department
    ?? (resolved as User | undefined)?.department_name

  return (
    <>
      <div
        ref={wrapRef}
        style={{ display: 'contents' }}
        onPointerOver={show}
        onPointerOut={hide}
        onPointerMove={move}
      >
        {children}
      </div>

      {pos && createPortal(
        <div style={{
          position: 'fixed',
          left: px,
          top: py,
          zIndex: 9999,
          pointerEvents: 'none',
          background: 'var(--ds-glass-bg)',
          backdropFilter: 'blur(48px) saturate(200%)',
          WebkitBackdropFilter: 'blur(48px) saturate(200%)',
          border: '1px solid var(--ds-glass-border)',
          borderRadius: '1.25rem',
          width: CARD_W,
          boxShadow: 'var(--ds-glass-shadow)',
          padding: '14px 16px',
        }} className="hover-card-pop-in">

          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: resolved ? 10 : 0 }}>
            <UserAvatar name={name} avatar={(propUser as User | undefined)?.avatar} size={38} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 13, fontWeight: 900, color: 'var(--ds-text-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {name}
              </p>
              {dept && (
                <p style={{ fontSize: 9, fontWeight: 800, color: 'var(--ds-text-3)', textTransform: 'uppercase', letterSpacing: '0.07em', marginTop: 2 }}>
                  {dept}
                </p>
              )}
            </div>
          </div>

          {/* Details */}
          {resolved && (
            <div style={{ borderTop: '1px solid var(--ds-border-sub)', paddingTop: 10, display: 'flex', flexDirection: 'column', gap: 5 }}>
              {(resolved as DirUser).email && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 12, color: 'var(--ds-text-3)', flexShrink: 0 }}>mail</span>
                  <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--ds-text-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {(resolved as DirUser).email}
                  </span>
                </div>
              )}
              {(resolved as DirUser).ext && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 12, color: 'var(--ds-text-3)', flexShrink: 0 }}>call</span>
                  <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--ds-text-2)' }}>
                    ext. {(resolved as DirUser).ext}
                  </span>
                </div>
              )}
              {(propUser as User | undefined)?.role && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 12, color: 'var(--ds-text-3)', flexShrink: 0 }}>badge</span>
                  <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--ds-text-2)', textTransform: 'capitalize' }}>
                    {(propUser as User).role}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>,
        document.body,
      )}
    </>
  )
}
