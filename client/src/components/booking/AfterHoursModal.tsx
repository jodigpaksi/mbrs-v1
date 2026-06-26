import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useQuery } from '@tanstack/react-query'
import { getAfterHoursContacts } from '../../api/settings'
import UserAvatar from '../ui/UserAvatar'

interface AfterHoursModalProps {
  open: boolean
  onClose: () => void
  workingHoursEnd: string
}

export default function AfterHoursModal({ open, onClose, workingHoursEnd }: AfterHoursModalProps) {
  const { data: contacts = [], isLoading } = useQuery({
    queryKey: ['after-hours-contacts'],
    queryFn: getAfterHoursContacts,
    staleTime: 60_000,
    enabled: open,
  })

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return createPortal(
    <div
      className="fixed inset-0 z-[9998] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)' }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        className="w-full max-w-[420px] rounded-3xl overflow-hidden"
        style={{
          background: 'var(--ds-glass-bg)',
          backdropFilter: 'blur(48px) saturate(200%)',
          WebkitBackdropFilter: 'blur(48px) saturate(200%)',
          border: '1px solid var(--ds-glass-border)',
          boxShadow: 'var(--ds-glass-shadow)',
        }}
      >
        {/* Header */}
        <div className="px-6 pt-6 pb-4 flex items-start gap-4">
          <div className="size-12 rounded-2xl flex items-center justify-center shrink-0"
            style={{ background: 'rgba(99,102,241,0.12)' }}>
            <span className="material-symbols-outlined" style={{ fontSize: 26, color: '#6366f1', fontVariationSettings: "'FILL' 1" }}>schedule</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[15px] font-black leading-tight" style={{ color: 'var(--ds-text-1)' }}>
              After-Hours Booking
            </p>
            <p className="text-[11px] font-medium mt-1 leading-relaxed" style={{ color: 'var(--ds-text-3)' }}>
              Bookings after <span className="font-black" style={{ color: 'var(--ds-text-2)' }}>{workingHoursEnd}</span> require approval from
              a duty receptionist. Please contact one of the following:
            </p>
          </div>
          <button
            onClick={onClose}
            className="size-7 rounded-xl flex items-center justify-center shrink-0 hover:bg-[var(--ds-bg-raised)] transition-colors"
            style={{ color: 'var(--ds-text-3)' }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>close</span>
          </button>
        </div>

        {/* Divider */}
        <div style={{ height: 1, background: 'var(--ds-border-sub)', margin: '0 24px' }} />

        {/* Contact list */}
        <div className="px-4 py-4 flex flex-col gap-3 max-h-[360px] overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
          {isLoading && (
            <div className="flex items-center justify-center py-8">
              <span className="material-symbols-outlined animate-spin text-[var(--ds-text-4)]" style={{ fontSize: 24 }}>progress_activity</span>
            </div>
          )}
          {!isLoading && contacts.length === 0 && (
            <div className="flex flex-col items-center justify-center py-8 gap-2">
              <span className="material-symbols-outlined" style={{ fontSize: 32, color: 'var(--ds-text-4)' }}>person_off</span>
              <p className="text-[11px] font-bold" style={{ color: 'var(--ds-text-3)' }}>No contact available</p>
            </div>
          )}
          {!isLoading && (() => {
            const receptionists = contacts.filter(c => c.role === 'receptionist')
            const pics = contacts.filter(c => c.role !== 'receptionist')
            const groups = [
              { label: 'Receptionist', items: receptionists },
              { label: 'PIC', items: pics },
            ].filter(g => g.items.length > 0)

            return groups.map(group => (
              <div key={group.label}>
                <p className="text-[9px] font-black uppercase tracking-widest mb-1.5 px-1" style={{ color: 'var(--ds-text-4)' }}>
                  {group.label}
                </p>
                <div className="flex flex-col gap-1.5">
                  {group.items.map(c => (
                    <div key={c.id} className="flex items-center gap-3 px-3 py-3 rounded-2xl"
                      style={{ background: 'var(--ds-bg-raised)' }}>
                      <UserAvatar name={c.name} avatar={c.avatar} size={36} />
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] font-black truncate" style={{ color: 'var(--ds-text-1)' }}>{c.name}</p>
                        <p className="text-[9px] font-bold capitalize mt-0.5 truncate" style={{ color: 'var(--ds-text-4)' }}>
                          {c.role.replace('_', ' ')}{c.department ? ` · ${c.department}` : ''}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          {c.ext && (
                            <span className="flex items-center gap-0.5 text-[10px] font-bold" style={{ color: 'var(--ds-text-2)' }}>
                              <span className="material-symbols-outlined" style={{ fontSize: 11 }}>call</span>
                              Ext. {c.ext}
                            </span>
                          )}
                          {c.ext && c.email && <span style={{ color: 'var(--ds-text-4)', fontSize: 9 }}>·</span>}
                          {c.email && (
                            <span className="text-[10px] font-bold truncate" style={{ color: 'var(--ds-text-3)' }}>
                              {c.email}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {c.ext && (
                          <a href={`tel:${c.ext}`}
                            className="size-8 rounded-xl flex items-center justify-center transition-colors hover:bg-[#adee2b]/15"
                            style={{ color: '#adee2b' }}
                            title={`Call ext. ${c.ext}`}
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: 15, fontVariationSettings: "'FILL' 1" }}>call</span>
                          </a>
                        )}
                        <a href={`mailto:${c.email}`}
                          className="size-8 rounded-xl flex items-center justify-center transition-colors hover:bg-[var(--ds-bg-surface)]"
                          style={{ color: 'var(--ds-text-3)' }}
                          title={`Email ${c.name}`}
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: 15, fontVariationSettings: "'FILL' 1" }}>mail</span>
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          })()}
        </div>

        {/* Footer */}
        <div className="px-6 pb-6 pt-2">
          <button
            onClick={onClose}
            className="w-full py-3 rounded-2xl text-[12px] font-black transition-colors"
            style={{ background: 'var(--ds-bg-raised)', color: 'var(--ds-text-2)' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--ds-border)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'var(--ds-bg-raised)')}
          >
            Change Booking Time
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
