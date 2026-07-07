import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useQuery } from '@tanstack/react-query'
import { getAfterHoursContacts } from '../../api/settings'
import type { AfterHoursContact } from '../../api/settings'
import UserAvatar from '../ui/UserAvatar'
import { useModalHotkeys } from '../../hooks/useModalHotkeys'

interface AfterHoursModalProps {
  open: boolean
  onClose: () => void
  workingHoursEnd: string
  buildingId?: number | null
  onChangeTime?: () => void
}

function ContactCard({ c }: { c: AfterHoursContact }) {
  const [copied, setCopied] = useState(false)

  function copyEmail() {
    navigator.clipboard.writeText(c.email).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    })
  }

  return (
    <div className="flex items-start gap-4 px-4 py-4 rounded-2xl"
      style={{ background: 'rgba(0,0,0,0.04)' }}>
      <UserAvatar name={c.name} avatar={c.avatar} size={48} />
      <div className="flex-1 min-w-0">
        <p className="text-[16px] font-black leading-tight" style={{ color: 'var(--ds-text-1)' }}>{c.name}</p>
        <p className="text-[12px] font-semibold capitalize mt-0.5" style={{ color: 'var(--ds-text-3)' }}>
          {c.role.replace('_', ' ')}{c.department ? ` · ${c.department}` : ''}
        </p>
        {c.ext && (
          <div className="flex items-center gap-2 mt-2.5">
            <span className="material-symbols-outlined shrink-0" style={{ fontSize: 15, color: 'var(--ds-text-4)' }}>call</span>
            <span className="text-[14px] font-bold" style={{ color: 'var(--ds-text-1)' }}>Ext. {c.ext}</span>
          </div>
        )}
        {c.email && (
          <div className="flex items-center gap-2 mt-1.5">
            <span className="material-symbols-outlined shrink-0" style={{ fontSize: 15, color: 'var(--ds-text-4)' }}>mail</span>
            <span className="text-[13px] font-medium flex-1 min-w-0 truncate" style={{ color: 'var(--ds-text-2)' }}>{c.email}</span>
            <button
              onClick={copyEmail}
              className="shrink-0 size-7 rounded-lg flex items-center justify-center transition-all active:scale-90"
              style={{
                background: copied ? 'rgba(173,238,43,0.22)' : 'rgba(0,0,0,0.06)',
                color: copied ? '#4d7c00' : 'var(--ds-text-3)',
              }}
              title="Copy email"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 13 }}>
                {copied ? 'check' : 'content_copy'}
              </span>
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default function AfterHoursModal({ open, onClose, workingHoursEnd, buildingId, onChangeTime }: AfterHoursModalProps) {
  const { data: contacts = [], isLoading } = useQuery({
    queryKey: ['after-hours-contacts', buildingId ?? null],
    queryFn: () => getAfterHoursContacts(buildingId ?? undefined),
    staleTime: 60_000,
    enabled: open,
  })

  useModalHotkeys(open, onChangeTime ? () => { onClose(); onChangeTime() } : undefined, onClose)

  if (!open) return null

  const receptionists = contacts.filter(c => c.role === 'receptionist')
  const pics = contacts.filter(c => c.role !== 'receptionist')
  const groups = [
    { label: 'Receptionist', items: receptionists },
    { label: 'PIC', items: pics },
  ].filter(g => g.items.length > 0)

  return createPortal(
    <div className="fixed inset-0 z-[9998] flex items-center justify-center p-4">
      <style>{`
        @keyframes ah-in {
          from { opacity: 0; transform: scale(0.96) translateY(8px) }
          to   { opacity: 1; transform: scale(1) translateY(0) }
        }
        .dark [data-ah-dark] {
          background: rgba(18,21,35,0.88) !important;
          border-color: rgba(255,255,255,0.07) !important;
          box-shadow: 0 32px 72px rgba(0,0,0,0.55), 0 8px 24px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05) !important;
        }
        .dark [data-ah-card] { background: rgba(255,255,255,0.05) !important; }
      `}</style>

      {/* Backdrop */}
      <div className="absolute inset-0" onClick={onClose} style={{ background: 'rgba(0,0,0,0.22)' }} />

      {/* Glass panel */}
      <div
        className="relative w-full max-w-[440px] overflow-hidden"
        data-ah-dark=""
        style={{
          background: 'rgba(255,255,255,0.82)',
          backdropFilter: 'blur(48px) saturate(200%)',
          WebkitBackdropFilter: 'blur(48px) saturate(200%)',
          border: '1px solid rgba(255,255,255,0.90)',
          borderRadius: 28,
          boxShadow: '0 32px 72px rgba(0,0,0,0.16), 0 8px 24px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,1)',
          animation: 'ah-in 0.22s cubic-bezier(0.34,1.04,0.64,1) both',
        }}
      >
        {/* Header */}
        <div className="px-6 pt-6 pb-5">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="size-11 rounded-2xl flex items-center justify-center shrink-0"
              style={{ background: 'rgba(99,102,241,0.12)' }}>
              <span className="material-symbols-outlined" style={{ fontSize: 24, color: '#6366f1', fontVariationSettings: "'FILL' 1" }}>schedule</span>
            </div>
            <button
              onClick={onClose}
              className="size-8 rounded-xl flex items-center justify-center transition-all hover:scale-110 active:scale-95"
              style={{ background: 'rgba(0,0,0,0.06)', color: 'var(--ds-text-2)' }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>close</span>
            </button>
          </div>
          <p className="text-[18px] font-black leading-tight" style={{ color: 'var(--ds-text-1)' }}>
            After-Hours Booking
          </p>
          <p className="text-[13px] font-medium mt-1.5 leading-relaxed" style={{ color: 'var(--ds-text-3)' }}>
            Bookings after{' '}
            <span className="font-black px-1.5 py-0.5 rounded-lg" style={{ color: '#6366f1', background: 'rgba(99,102,241,0.1)' }}>
              {workingHoursEnd}
            </span>
            {' '}require approval. Contact one of the following:
          </p>
        </div>

        <div style={{ height: 1, background: 'rgba(0,0,0,0.06)', margin: '0 24px' }} />

        {/* Contact list */}
        <div className="px-4 py-4 flex flex-col gap-4 max-h-[400px] overflow-y-auto modal-scroll">
          {isLoading && (
            <div className="flex items-center justify-center py-10">
              <span className="material-symbols-outlined animate-spin" style={{ fontSize: 28, color: 'var(--ds-text-4)' }}>progress_activity</span>
            </div>
          )}
          {!isLoading && contacts.length === 0 && (
            <div className="flex flex-col items-center justify-center py-10 gap-2">
              <span className="material-symbols-outlined" style={{ fontSize: 36, color: 'var(--ds-text-4)' }}>person_off</span>
              <p className="text-[13px] font-bold" style={{ color: 'var(--ds-text-3)' }}>No contact available</p>
            </div>
          )}
          {!isLoading && groups.map(group => (
            <div key={group.label} className="flex flex-col gap-2">
              <p className="text-[10px] font-black uppercase tracking-widest px-1" style={{ color: 'var(--ds-text-4)' }}>
                {group.label}
              </p>
              {group.items.map(c => <ContactCard key={c.id} c={c} />)}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-5 pb-5 pt-3">
          <button
            onClick={() => { onClose(); onChangeTime?.() }}
            className="w-full py-3.5 rounded-2xl text-[13px] font-black transition-all hover:scale-[1.01] active:scale-[0.99]"
            style={{ background: 'rgba(0,0,0,0.07)', color: 'var(--ds-text-2)' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(0,0,0,0.11)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'rgba(0,0,0,0.07)')}
          >
            Change Booking Time
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
