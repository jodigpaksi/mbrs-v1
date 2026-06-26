import { useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getAfterHoursContacts, updateAfterHoursContacts } from '../api/settings'
import type { AfterHoursContact } from '../api/settings'
import { getDirectory } from '../api/users'
import type { User } from '../types'
import UserAvatar from '../components/ui/UserAvatar'

export default function ReceptionistPage() {
  const queryClient = useQueryClient()
  const [contactSearch, setContactSearch] = useState('')
  const [showPicker, setShowPicker] = useState(false)
  const [saved, setSaved] = useState(false)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const { data: contacts = [], isLoading } = useQuery({
    queryKey: ['after-hours-contacts'],
    queryFn: getAfterHoursContacts,
    staleTime: 30_000,
  })

  const { data: directory = [] } = useQuery<User[]>({
    queryKey: ['user-directory'],
    queryFn: getDirectory,
    staleTime: 5 * 60_000,
    enabled: showPicker,
  })

  const mutation = useMutation({
    mutationFn: updateAfterHoursContacts,
    onSuccess: (data) => {
      queryClient.setQueryData(['after-hours-contacts'], data)
      setSaved(true)
      if (saveTimer.current) clearTimeout(saveTimer.current)
      saveTimer.current = setTimeout(() => setSaved(false), 2500)
    },
  })

  const currentIds = contacts.map((c: AfterHoursContact) => c.id)

  function toggleContact(user: User) {
    const next = currentIds.includes(user.id)
      ? currentIds.filter(id => id !== user.id)
      : [...currentIds, user.id]
    mutation.mutate(next)
  }

  function removeContact(id: number) {
    mutation.mutate(currentIds.filter(x => x !== id))
  }

  const pickerFiltered = (directory as User[]).filter(u =>
    u.name.toLowerCase().includes(contactSearch.toLowerCase()) ||
    (u.email ?? '').toLowerCase().includes(contactSearch.toLowerCase())
  )

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
            Manage after-hours contact settings for your organisation.
          </p>
        </div>

        {/* After-Hours Contacts card */}
        <div className="rounded-3xl overflow-hidden" style={{
          background: 'var(--ds-bg-surface)',
          border: '1px solid var(--ds-border-sub)',
          boxShadow: '0 2px 16px rgba(0,0,0,0.04)',
        }}>
          {/* Card header */}
          <div className="px-6 py-5 flex items-start justify-between gap-4 border-b" style={{ borderColor: 'var(--ds-border-sub)' }}>
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <span className="material-symbols-outlined" style={{ fontSize: 16, color: '#6366f1' }}>schedule</span>
                <p className="text-[13px] font-black" style={{ color: 'var(--ds-text-1)' }}>After-Hours Contacts</p>
                {saved && (
                  <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full"
                    style={{ background: '#adee2b', color: '#000' }}>Saved</span>
                )}
              </div>
              <p className="text-[11px] font-medium leading-relaxed" style={{ color: 'var(--ds-text-3)' }}>
                Users shown to staff when attempting a booking after working hours.
                Leave empty to auto-show all on-duty receptionists.
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
                <p className="text-[11px] font-bold text-center" style={{ color: 'var(--ds-text-3)' }}>
                  No custom contacts set — all on-duty receptionists shown by default
                </p>
              </div>
            )}
            <div className="flex flex-col gap-2">
              {contacts.map((c: AfterHoursContact) => (
                <div key={c.id} className="flex items-center gap-3 px-3 py-3 rounded-2xl group"
                  style={{ background: 'var(--ds-bg-raised)' }}>
                  <UserAvatar name={c.name} avatar={c.avatar} size={36} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-[12px] font-black truncate" style={{ color: 'var(--ds-text-1)' }}>{c.name}</p>
                      {c.on_duty && (
                        <span className="text-[7px] font-black uppercase px-1.5 py-0.5 rounded-full shrink-0"
                          style={{ background: '#adee2b', color: '#000' }}>On Duty</span>
                      )}
                    </div>
                    <p className="text-[10px] font-medium mt-0.5 truncate" style={{ color: 'var(--ds-text-3)' }}>
                      {c.ext ? `Ext. ${c.ext}` : ''}{c.ext && c.email ? ' · ' : ''}{c.email}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <span className="text-[9px] font-bold px-2 py-0.5 rounded-full capitalize"
                      style={{ background: 'var(--ds-bg-surface)', color: 'var(--ds-text-3)' }}>
                      {c.role}
                    </span>
                    <button
                      onClick={() => removeContact(c.id)}
                      className="size-7 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all hover:bg-red-50 dark:hover:bg-red-900/20"
                      style={{ color: 'var(--ds-text-4)' }}
                      onMouseEnter={e => (e.currentTarget.style.color = '#ef4444')}
                      onMouseLeave={e => (e.currentTarget.style.color = 'var(--ds-text-4)')}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: 14 }}>remove_circle</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* User picker */}
          {showPicker && (
            <div className="border-t px-4 pb-4 pt-3" style={{ borderColor: 'var(--ds-border-sub)' }}>
              <p className="text-[9px] font-black uppercase tracking-widest mb-2.5" style={{ color: 'var(--ds-text-3)' }}>
                Add from user directory
              </p>
              {/* Search */}
              <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl mb-3"
                style={{ background: 'var(--ds-bg-raised)', border: '1px solid var(--ds-border-sub)' }}>
                <span className="material-symbols-outlined shrink-0" style={{ fontSize: 14, color: 'var(--ds-text-3)' }}>search</span>
                <input
                  autoFocus
                  value={contactSearch}
                  onChange={e => setContactSearch(e.target.value)}
                  placeholder="Search name or email…"
                  className="flex-1 bg-transparent text-[11px] font-medium outline-none"
                  style={{ color: 'var(--ds-text-1)' }}
                />
              </div>
              {/* User list */}
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
                          {u.role}{u.ext ? ` · Ext. ${u.ext}` : ''}
                        </p>
                      </div>
                      <div className="size-5 rounded-full flex items-center justify-center shrink-0 transition-colors"
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

      </div>
    </div>
  )
}
