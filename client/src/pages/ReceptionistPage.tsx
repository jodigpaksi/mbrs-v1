import { useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  getAfterHoursContacts, updateAfterHoursContacts,
  getSpecialRoomContacts, updateSpecialRoomContacts,
  getGeneralSettings,
} from '../api/settings'
import type { AfterHoursContact } from '../api/settings'
import { getDisputes, resolveDispute } from '../api/bookings'
import { getDirectory } from '../api/users'
import type { Booking, User } from '../types'
import UserAvatar from '../components/ui/UserAvatar'
import { useSettings } from '../context/SettingsContext'
import { parseLocal } from '../utils/date'

type Tab = 'contacts' | 'disputes'

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

function ContactSection({ queryKey, fetchFn, saveFn, icon, iconColor, iconBg, title, description, emptyNote, enabled, enabledLabel, disabledLabel, loadingStatus }: ContactSectionProps) {
  const { t } = useSettings()
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

  const elActive = enabledLabel ?? t('rec_active')
  const elInactive = disabledLabel ?? t('rec_inactive')

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
                style={{ background: '#adee2b', color: '#000' }}>{t('rec_saved')}</span>
            )}
            {loadingStatus ? (
              <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full"
                style={{ background: 'var(--ds-bg-raised)', color: 'var(--ds-text-4)' }}>…</span>
            ) : enabled === true ? (
              <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase px-2 py-0.5 rounded-full"
                style={{ background: 'rgba(173,238,43,0.18)', color: '#4d7c00' }}>
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#65a30d', display: 'inline-block' }} />
                {elActive}
              </span>
            ) : enabled === false ? (
              <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase px-2 py-0.5 rounded-full"
                style={{ background: 'rgba(148,163,184,0.12)', color: 'var(--ds-text-4)' }}>
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--ds-text-4)', display: 'inline-block' }} />
                {elInactive}
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
          {showPicker ? t('btn_done') : 'Edit'}
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
                  <p className="text-[11px] mt-2 italic" style={{ color: 'var(--ds-text-4)' }}>{t('rec_no_buildings')}</p>
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
            {t('rec_add_from_dir')}
          </p>
          <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl mb-3"
            style={{ background: 'var(--ds-bg-raised)', border: '1px solid var(--ds-border-sub)' }}>
            <span className="material-symbols-outlined shrink-0" style={{ fontSize: 14, color: 'var(--ds-text-3)' }}>search</span>
            <input
              autoFocus
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={t('rec_search_placeholder')}
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
              <p className="text-[11px] text-center py-4" style={{ color: 'var(--ds-text-4)' }}>{t('rec_user_not_found')}</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function DisputesSection() {
  const { t, language } = useSettings()
  const qc = useQueryClient()
  const [statusFilter, setStatusFilter] = useState<'pending' | 'resolved'>('pending')
  const [resolvingId, setResolvingId] = useState<number | null>(null)

  const { data: disputes = [], isLoading } = useQuery<Booking[]>({
    queryKey: ['disputes', statusFilter],
    queryFn: () => getDisputes(statusFilter),
    staleTime: 30_000,
  })

  const loc = language === 'id' ? 'id-ID' : 'en-GB'
  function fmtDt(s: string) {
    const d = parseLocal(s)
    return d.toLocaleDateString(loc, { day: 'numeric', month: 'short', year: 'numeric' }) + ' ' +
      d.toLocaleTimeString(loc, { hour: '2-digit', minute: '2-digit' })
  }
  function fmtTime(s: string) { return parseLocal(s).toLocaleTimeString(loc, { hour: '2-digit', minute: '2-digit' }) }

  async function handleResolve(b: Booking, action: 'approve' | 'reject') {
    setResolvingId(b.id)
    try {
      await resolveDispute(b.id, action)
      qc.invalidateQueries({ queryKey: ['disputes'] })
    } catch { /* ignore */ }
    finally { setResolvingId(null) }
  }

  return (
    <div className="space-y-5">
      {/* Filter */}
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          {(['pending', 'resolved'] as const).map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className="px-4 py-2 rounded-2xl text-[10px] font-black uppercase tracking-wide transition-all"
              style={statusFilter === s
                ? { background: '#adee2b', color: '#000' }
                : { background: 'var(--ds-bg-surface)', border: '1px solid var(--ds-border)', color: 'var(--ds-text-2)' }}>
              {s === 'pending' ? t('rec_pending') : t('rec_resolved')}
            </button>
          ))}
        </div>
      </div>

      {statusFilter === 'pending' && (
        <div className="p-3.5 rounded-xl text-[10px] font-semibold leading-relaxed"
          style={{ background: 'rgba(249,115,22,0.06)', border: '1px solid rgba(249,115,22,0.2)', color: '#ea580c' }}>
          <span className="font-black">{t('rec_approve_restore').split('—')[0].trim()}</span>
          {language === 'id' ? ' untuk memulihkan pemesanan. ' : ' to restore the booking. '}
          <span className="font-black">{t('rec_reject')}</span>
          {language === 'id' ? ' untuk mengonfirmasi pembatalan otomatis.' : ' to confirm auto-cancellation.'}
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="size-8 border-2 border-[var(--ds-border)] border-t-[#adee2b] rounded-full animate-spin" />
        </div>
      ) : disputes.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
          <span className="material-symbols-outlined text-[var(--ds-text-4)]" style={{ fontSize: 48 }}>gavel</span>
          <p className="text-[11px] font-black uppercase tracking-wider text-[var(--ds-text-4)]">
            {statusFilter === 'pending' ? t('rec_no_disputes_pending') : t('rec_no_disputes_resolved')}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {disputes.map(b => {
            const isPending  = b.dispute_status === 'pending'
            const isApproved = b.dispute_status === 'approved'
            const resolving  = resolvingId === b.id
            return (
              <div key={b.id} className="rounded-2xl p-5 space-y-4"
                style={{ background: 'var(--ds-bg-surface)', border: '1px solid var(--ds-border-sub)' }}>
                <div className="flex items-start gap-4">
                  <UserAvatar name={b.user?.name ?? '?'} avatar={b.user?.avatar} size={38} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <p className="text-[13px] font-black text-[var(--ds-text-1)]">{b.user?.name ?? 'Unknown User'}</p>
                      <span className="text-[9px] font-bold text-[var(--ds-text-4)]">{b.user?.email}</span>
                    </div>
                    <p className="text-[12px] font-black uppercase tracking-tight text-[var(--ds-text-1)]">{b.title}</p>
                    <div className="flex items-center gap-3 mt-1 flex-wrap">
                      <span className="flex items-center gap-1 text-[10px] font-bold text-[var(--ds-text-3)]">
                        <span className="material-symbols-outlined" style={{ fontSize: 12 }}>meeting_room</span>
                        {b.room?.name}{b.room?.building ? ` · ${b.room.building.code ?? b.room.building.name}` : ''}
                      </span>
                      <span className="flex items-center gap-1 text-[10px] font-bold text-[var(--ds-text-3)]">
                        <span className="material-symbols-outlined" style={{ fontSize: 12 }}>schedule</span>
                        {b.start_at ? fmtDt(b.start_at).split(' ').slice(0, 3).join(' ') : ''} · {b.start_at ? fmtTime(b.start_at) : ''}–{b.end_at ? fmtTime(b.end_at) : ''}
                      </span>
                    </div>
                  </div>
                  <div className="shrink-0">
                    {isPending  && <span className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[9px] font-black uppercase bg-orange-500/15 text-orange-600 dark:text-orange-400"><span className="material-symbols-outlined" style={{ fontSize: 10 }}>hourglass_top</span>{t('rec_pending')}</span>}
                    {isApproved && <span className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[9px] font-black uppercase bg-green-500/15 text-green-600 dark:text-green-400"><span className="material-symbols-outlined" style={{ fontSize: 10 }}>check_circle</span>{t('rec_approved')}</span>}
                    {b.dispute_status === 'rejected' && <span className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[9px] font-black uppercase bg-red-500/15 text-red-500"><span className="material-symbols-outlined" style={{ fontSize: 10 }}>cancel</span>{t('rec_rejected')}</span>}
                  </div>
                </div>

                {b.dispute_note ? (
                  <div className="px-4 py-3 rounded-xl" style={{ background: 'var(--ds-bg-raised)', border: '1px solid var(--ds-border-sub)' }}>
                    <p className="text-[9px] font-black uppercase tracking-wider text-[var(--ds-text-4)] mb-1">{t('rec_user_note')}</p>
                    <p className="text-[11px] font-medium text-[var(--ds-text-2)] leading-relaxed">{b.dispute_note}</p>
                  </div>
                ) : (
                  <p className="text-[10px] font-medium text-[var(--ds-text-4)] italic">{t('rec_no_note')}</p>
                )}

                <div className="flex items-center gap-4 text-[9px] font-bold text-[var(--ds-text-4)]">
                  <span>{t('rec_disputed_at')} {b.disputed_at ? fmtDt(b.disputed_at) : '—'}</span>
                  {b.dispute_resolved_at && <span>{t('rec_resolved_at')} {fmtDt(b.dispute_resolved_at)}</span>}
                </div>

                {isPending && (
                  <div className="flex gap-3 pt-1">
                    <button onClick={() => handleResolve(b, 'approve')} disabled={resolving}
                      className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-wide transition-all disabled:opacity-50 hover:opacity-80"
                      style={{ background: '#adee2b', color: '#000' }}>
                      <span className="material-symbols-outlined" style={{ fontSize: 14 }}>check_circle</span>
                      {resolving ? '…' : t('rec_approve_restore')}
                    </button>
                    <button onClick={() => handleResolve(b, 'reject')} disabled={resolving}
                      className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-wide transition-all disabled:opacity-50 hover:opacity-80"
                      style={{ background: 'rgba(239,68,68,0.12)', border: '1.5px solid rgba(239,68,68,0.3)', color: '#ef4444' }}>
                      <span className="material-symbols-outlined" style={{ fontSize: 14 }}>cancel</span>
                      {resolving ? '…' : t('rec_reject')}
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default function ReceptionistPage() {
  const { t } = useSettings()
  const [tab, setTab] = useState<Tab>('contacts')
  const { data: generalSettings, isLoading: loadingSettings } = useQuery({
    queryKey: ['settings-general'],
    queryFn: getGeneralSettings,
    staleTime: 60_000,
  })
  const antiGhostEnabled = generalSettings?.anti_ghost_enabled ?? false

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
            <h1 className="text-[22px] font-black" style={{ color: 'var(--ds-text-1)' }}>{t('rec_page_title')}</h1>
          </div>
          <p className="text-[11px] font-medium" style={{ color: 'var(--ds-text-3)' }}>
            {t('rec_page_subtitle')}
          </p>
        </div>

        {/* Tab bar */}
        <div className="flex gap-2 mb-6">
          <button onClick={() => setTab('contacts')}
            className="flex items-center gap-1.5 px-4 py-2 rounded-2xl text-[10px] font-black uppercase tracking-wide transition-all"
            style={tab === 'contacts'
              ? { background: '#adee2b', color: '#000' }
              : { background: 'var(--ds-bg-surface)', border: '1px solid var(--ds-border)', color: 'var(--ds-text-2)' }}>
            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>contacts</span>
            {t('rec_tab_contacts')}
          </button>
          {antiGhostEnabled && (
            <button onClick={() => setTab('disputes')}
              className="flex items-center gap-1.5 px-4 py-2 rounded-2xl text-[10px] font-black uppercase tracking-wide transition-all"
              style={tab === 'disputes'
                ? { background: '#adee2b', color: '#000' }
                : { background: 'var(--ds-bg-surface)', border: '1px solid var(--ds-border)', color: 'var(--ds-text-2)' }}>
              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>gavel</span>
              {t('rec_tab_disputes')}
            </button>
          )}
        </div>

        {tab === 'contacts' && (
          <div className="flex flex-col gap-5">
            <ContactSection
              queryKey="after-hours-contacts"
              fetchFn={getAfterHoursContacts}
              saveFn={updateAfterHoursContacts}
              icon="schedule"
              iconColor="#6366f1"
              iconBg="rgba(99,102,241,0.1)"
              title={t('rec_after_hours_title')}
              description={t('rec_after_hours_desc')}
              emptyNote={t('rec_empty_contacts')}
              enabled={generalSettings?.restrict_after_hours}
              enabledLabel={t('rec_restriction_active')}
              disabledLabel={t('rec_restriction_inactive')}
              loadingStatus={loadingSettings}
            />

            <ContactSection
              queryKey="special-room-contacts"
              fetchFn={getSpecialRoomContacts}
              saveFn={updateSpecialRoomContacts}
              icon="star"
              iconColor="#f59e0b"
              iconBg="rgba(251,191,36,0.1)"
              title={t('rec_special_room_title')}
              description={t('rec_special_room_desc')}
              emptyNote={t('rec_empty_contacts')}
              enabled={true}
              enabledLabel={t('rec_always_active')}
              loadingStatus={false}
            />
          </div>
        )}

        {tab === 'disputes' && antiGhostEnabled && <DisputesSection />}

      </div>
    </div>
  )
}
