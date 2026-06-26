import { useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  getAfterHoursContacts, updateAfterHoursContacts,
  getSpecialRoomContacts, updateSpecialRoomContacts,
  getGeneralSettings,
} from '../api/settings'
import type { AfterHoursContact } from '../api/settings'
import { getDirectory } from '../api/users'
import type { User } from '../types'
import UserAvatar from '../components/ui/UserAvatar'

interface ContactSectionProps {
  queryKey: string
  fetchFn: () => Promise<AfterHoursContact[]>
  saveFn: (ids: number[]) => Promise<AfterHoursContact[]>
  icon: string
  iconColor: string
  iconBg: string
  title: string
  description: string
  emptyNote: string
  enabled?: boolean
  enabledLabel?: string
  disabledLabel?: string
  loadingStatus?: boolean
}

function ContactSection({ queryKey, fetchFn, saveFn, icon, iconColor, iconBg, title, description, emptyNote, enabled, enabledLabel = 'Enabled', disabledLabel = 'Disabled', loadingStatus }: ContactSectionProps) {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [showPicker, setShowPicker] = useState(false)
  const [saved, setSaved] = useState(false)
  const [newlyAddedIds, setNewlyAddedIds] = useState<Set<number>>(new Set())
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const { data: contacts = [], isLoading } = useQuery({
    queryKey: [queryKey],
    queryFn: () => fetchFn(),
    staleTime: 30_000,
  })

  const { data: directory = [] } = useQuery<User[]>({
    queryKey: ['user-directory'],
    queryFn: getDirectory,
    staleTime: 5 * 60_000,
    enabled: showPicker,
  })

  const mutation = useMutation({
    mutationFn: saveFn,
    onSuccess: (data) => {
      queryClient.setQueryData([queryKey], data)
      setSaved(true)
      if (saveTimer.current) clearTimeout(saveTimer.current)
      saveTimer.current = setTimeout(() => setSaved(false), 2500)
    },
  })

  const currentIds = contacts.map((c: AfterHoursContact) => c.id)

  function toggleContact(user: User) {
    const isAdding = !currentIds.includes(user.id)
    const next = isAdding
      ? [...currentIds, user.id]
      : currentIds.filter((id: number) => id !== user.id)
    if (isAdding) {
      setNewlyAddedIds(prev => new Set(prev).add(user.id))
      setTimeout(() => setNewlyAddedIds(prev => { const s = new Set(prev); s.delete(user.id); return s }), 500)
    }
    mutation.mutate(next)
  }

  function removeContact(id: number) {
    mutation.mutate(currentIds.filter((x: number) => x !== id))
  }

  const pickerFiltered = (directory as User[]).filter(u =>
    u.name.toLowerCase().includes(search.toLowerCase()) ||
    (u.email ?? '').toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="rounded-3xl overflow-hidden" style={{
      background: 'var(--ds-bg-surface)',
      border: '1px solid var(--ds-border-sub)',
      boxShadow: '0 2px 16px rgba(0,0,0,0.04)',
    }}>
      {/* Card header */}
      <div className="px-6 py-5 flex items-start justify-between gap-4 border-b" style={{ borderColor: 'var(--ds-border-sub)' }}>
        <div>
          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
            <span className="material-symbols-outlined" style={{ fontSize: 16, color: iconColor }}>{icon}</span>
            <p className="text-[13px] font-black" style={{ color: 'var(--ds-text-1)' }}>{title}</p>
            {saved && (
              <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full"
                style={{ background: '#adee2b', color: '#000' }}>Saved</span>
            )}
            {loadingStatus ? (
              <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full"
                style={{ background: 'var(--ds-bg-raised)', color: 'var(--ds-text-4)' }}>…</span>
            ) : enabled === true ? (
              <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase px-2 py-0.5 rounded-full"
                style={{ background: 'rgba(173,238,43,0.18)', color: '#4d7c00' }}>
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#65a30d', display: 'inline-block' }} />
                {enabledLabel}
              </span>
            ) : enabled === false ? (
              <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase px-2 py-0.5 rounded-full"
                style={{ background: 'rgba(148,163,184,0.12)', color: 'var(--ds-text-4)' }}>
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--ds-text-4)', display: 'inline-block' }} />
                {disabledLabel}
              </span>
            ) : null}
          </div>
          <p className="text-[11px] font-medium leading-relaxed" style={{ color: 'var(--ds-text-3)' }}>
            {description}
          </p>
        </div>
        <button
          onClick={() => setShowPicker(p => !p)}
          className="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-wide transition-colors"
          style={{ background: showPicker ? '#adee2b' : 'var(--ds-bg-raised)', color: showPicker ? '#000' : 'var(--ds-text-2)' }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 14 }}>{showPicker ? 'close' : 'person_add'}</span>
          {showPicker ? 'Done' : 'Edit'}
        </button>
      </div>

      {/* Current contacts */}
      <div className="px-4 py-4">
        {isLoading && (
          <div className="flex items-center justify-center py-6">
            <span className="material-symbols-outlined animate-spin text-[var(--ds-text-4)]" style={{ fontSize: 22 }}>progress_activity</span>
          </div>
        )}
        {!isLoading && contacts.length === 0 && (
          <div className="flex flex-col items-center justify-center py-8 gap-2">
            <span className="material-symbols-outlined" style={{ fontSize: 32, color: 'var(--ds-text-4)' }}>groups</span>
            <p className="text-[11px] font-bold text-center" style={{ color: 'var(--ds-text-3)' }}>{emptyNote}</p>
          </div>
        )}
        <div className="flex flex-col gap-2">
          {contacts.map((c: AfterHoursContact) => (
            <div key={c.id} className={`flex items-start gap-3 px-4 py-4 rounded-2xl group${newlyAddedIds.has(c.id) ? ' contact-enter' : ''}`}
              style={{ background: 'var(--ds-bg-raised)' }}>
              <UserAvatar name={c.name} avatar={c.avatar} size={44} />
              <div className="flex-1 min-w-0">
                <p className="text-[15px] font-black truncate" style={{ color: 'var(--ds-text-1)' }}>{c.name}</p>
                <p className="text-[11px] font-bold capitalize mt-0.5 truncate" style={{ color: 'var(--ds-text-3)' }}>
                  {c.role.replace('_', ' ')}{c.department ? ` · ${c.department}` : ''}
                </p>
                <div className="flex items-center gap-2 mt-1.5">
                  {c.ext && (
                    <span className="flex items-center gap-1 text-[12px] font-bold" style={{ color: 'var(--ds-text-2)' }}>
                      <span className="material-symbols-outlined" style={{ fontSize: 12 }}>call</span>
                      Ext. {c.ext}
                    </span>
                  )}
                  {c.ext && c.email && <span style={{ color: 'var(--ds-text-4)' }}>·</span>}
                  {c.email && (
                    <span className="text-[12px] font-medium truncate" style={{ color: 'var(--ds-text-3)' }}>{c.email}</span>
                  )}
                </div>
                {c.buildings && c.buildings.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5 mt-2.5">
                    {c.buildings.map(b => (
                      <span key={b.id}
                        className="inline-flex items-center gap-1 text-[11px] font-black px-2.5 py-1 rounded-full"
                        style={{ background: 'rgba(99,102,241,0.12)', color: '#6366f1' }}>
                        <span className="material-symbols-outlined" style={{ fontSize: 11 }}>apartment</span>
                        {b.code ?? b.name}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-[11px] mt-2 italic" style={{ color: 'var(--ds-text-4)' }}>No building assigned — handles all</p>
                )}
              </div>
              <button
                onClick={() => removeContact(c.id)}
                className="size-8 rounded-xl flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all"
                style={{ color: 'var(--ds-text-4)' }}
                onMouseEnter={e => (e.currentTarget.style.color = '#ef4444')}
                onMouseLeave={e => (e.currentTarget.style.color = 'var(--ds-text-4)')}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>remove_circle</span>
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* User picker */}
      {showPicker && (
        <div className="border-t px-4 pb-4 pt-3 picker-slide-in" style={{ borderColor: 'var(--ds-border-sub)' }}>
          <p className="text-[9px] font-black uppercase tracking-widest mb-2.5" style={{ color: 'var(--ds-text-3)' }}>
            Add from user directory
          </p>
          <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl mb-3"
            style={{ background: 'var(--ds-bg-raised)', border: '1px solid var(--ds-border-sub)' }}>
            <span className="material-symbols-outlined shrink-0" style={{ fontSize: 14, color: 'var(--ds-text-3)' }}>search</span>
            <input
              autoFocus
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search name or email…"
              className="flex-1 bg-transparent text-[11px] font-medium outline-none"
              style={{ color: 'var(--ds-text-1)' }}
            />
          </div>
          <div className="flex flex-col gap-1 max-h-[220px] overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
            {pickerFiltered.map((u: User) => {
              const selected = currentIds.includes(u.id)
              return (
                <button key={u.id}
                  onClick={() => toggleContact(u)}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors w-full"
                  style={{ background: selected ? 'rgba(173,238,43,0.08)' : 'transparent' }}
                  onMouseEnter={e => { if (!selected) e.currentTarget.style.background = 'var(--ds-bg-raised)' }}
                  onMouseLeave={e => { if (!selected) e.currentTarget.style.background = 'transparent' }}
                >
                  <UserAvatar name={u.name} avatar={u.avatar} size={30} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-black truncate" style={{ color: 'var(--ds-text-1)' }}>{u.name}</p>
                    <p className="text-[9px] font-medium truncate capitalize" style={{ color: 'var(--ds-text-3)' }}>
                      {(u.role ?? '').replace('_', ' ')}{u.ext ? ` · Ext. ${u.ext}` : ''}
                    </p>
                    {(u as any).buildings?.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {(u as any).buildings.map((b: { id: number; name: string; code?: string }) => (
                          <span key={b.id}
                            className="text-[8px] font-black px-1.5 py-0.5 rounded-full"
                            style={{ background: 'rgba(99,102,241,0.1)', color: '#6366f1' }}>
                            {b.code ?? b.name}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div key={`${u.id}-${selected}`}
                    className={`size-5 rounded-full flex items-center justify-center shrink-0 ${selected ? 'check-pop' : 'transition-colors duration-150'}`}
                    style={{ background: selected ? '#adee2b' : 'var(--ds-border)', color: selected ? '#000' : 'transparent' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 12 }}>check</span>
                  </div>
                </button>
              )
            })}
            {pickerFiltered.length === 0 && (
              <p className="text-[11px] text-center py-4" style={{ color: 'var(--ds-text-4)' }}>No users found</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default function ReceptionistPage() {
  const { data: generalSettings, isLoading: loadingSettings } = useQuery({
    queryKey: ['settings-general'],
    queryFn: getGeneralSettings,
    staleTime: 60_000,
  })

  return (
    <div className="flex-1 overflow-auto" style={{ background: 'var(--ds-bg-base)' }}>
      <div className="max-w-2xl mx-auto px-6 py-8">

        {/* Page header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-1">
            <div className="size-9 rounded-xl flex items-center justify-center"
              style={{ background: 'rgba(99,102,241,0.1)' }}>
              <span className="material-symbols-outlined" style={{ fontSize: 20, color: '#6366f1', fontVariationSettings: "'FILL' 1" }}>support_agent</span>
            </div>
            <h1 className="text-[22px] font-black" style={{ color: 'var(--ds-text-1)' }}>Receptionist</h1>
          </div>
          <p className="text-[11px] font-medium" style={{ color: 'var(--ds-text-3)' }}>
            Manage contact settings shown to users in booking restrictions.
          </p>
        </div>

        <div className="flex flex-col gap-5">
          <ContactSection
            queryKey="after-hours-contacts"
            fetchFn={getAfterHoursContacts}
            saveFn={updateAfterHoursContacts}
            icon="schedule"
            iconColor="#6366f1"
            iconBg="rgba(99,102,241,0.1)"
            title="After-Working Hours Contacts"
            description="Shown to staff attempting to book outside working hours. Leave empty to auto-show all on-duty receptionists."
            emptyNote="No custom contacts — all on-duty receptionists shown by default"
            enabled={generalSettings?.restrict_after_hours}
            enabledLabel="Restriction On"
            disabledLabel="Restriction Off"
            loadingStatus={loadingSettings}
          />

          <ContactSection
            queryKey="special-room-contacts"
            fetchFn={getSpecialRoomContacts}
            saveFn={updateSpecialRoomContacts}
            icon="star"
            iconColor="#f59e0b"
            iconBg="rgba(251,191,36,0.1)"
            title="Special Room Contacts"
            description="Shown when a user tries to book a special/contact-required room. Leave empty to auto-show all on-duty receptionists."
            emptyNote="No custom contacts — all on-duty receptionists shown by default"
            enabled={true}
            enabledLabel="Always Active"
            loadingStatus={false}
          />
        </div>

      </div>
    </div>
  )
}
