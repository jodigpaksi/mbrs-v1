import { useState, useRef, useEffect } from 'react'
import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { Booking, Room } from '../../types/index'
import { submitDispute } from '../../api/bookings'
import { checkAvailability } from '../../api/rooms'
import { useSettings } from '../../context/SettingsContext'
import UserHoverCard from '../ui/UserHoverCard'
import ElasticCheckbox from '../ui/ElasticCheckbox'
import { parseLocal } from '../../utils/date'
import {
  typeStyle, dur, fmtTime, toHHMM, fmtTableDate, fmtTableDay,
  isActuallyPast, fmtSkipDate, parseSkipDate, fmtInvalidSkipDate,
  type CardSharedProps, type SeriesGroup,
} from './scheduleHelpers'

function BookingCard({ b, index = 0, animate, activeTab, pendingCancelIds, exitingCancelIds, onEdit, onCancel, onTentativeAction }: { b: Booking; index?: number } & CardSharedProps) {
  const { language } = useSettings()
  const isConf = b.status === 'confirmed'
  const isCancelled = b.status === 'cancelled'
  const isTentative = b.status === 'tentative'
  const isPast = isActuallyPast(b)
  const isPastTab = activeTab === 'past'
  const isPending = pendingCancelIds.has(b.id)
  const isExiting = exitingCancelIds.has(b.id)
  const canEdit = !isPast && !isCancelled
  const canCancel = !isCancelled
  const tStyle = typeStyle[b.type] || typeStyle.internal

  const cardBg = isCancelled ? 'bg-red-50 dark:bg-red-950/30 border border-red-100 dark:border-red-900/40'
    : isConf ? 'bg-[#adee2b] dark:bg-[#adee2b]/75' : ''
  const titleClr = isPastTab ? 'text-[var(--ds-text-2)]' : isCancelled ? 'text-red-700 dark:text-red-400' : isTentative ? 'text-[var(--ds-text-2)]' : isConf ? 'text-black' : 'text-[var(--ds-text-1)]'
  const loc  = isPastTab ? 'text-[var(--ds-text-3)]' : isCancelled ? 'text-red-400' : isTentative ? 'text-[var(--ds-text-3)]' : isConf ? 'text-black/50' : 'text-[var(--ds-text-3)]'
  const desc = isPastTab ? 'text-[var(--ds-text-3)]' : isCancelled ? 'text-red-300' : isTentative ? 'text-[var(--ds-text-3)]' : isConf ? 'text-black/40' : 'text-[var(--ds-text-3)]'
  const t1   = isPastTab ? 'text-[var(--ds-text-2)]' : isCancelled ? 'text-red-400' : isTentative ? 'text-[var(--ds-text-2)]' : isConf ? 'text-black/80' : 'text-[var(--ds-text-2)]'
  const t2   = isPastTab ? 'text-[var(--ds-text-3)]' : isCancelled ? 'text-red-300' : isTentative ? 'text-[var(--ds-text-3)]' : isConf ? 'text-black/50' : 'text-[var(--ds-text-3)]'
  const td   = isPastTab ? 'text-[var(--ds-text-4)]' : isCancelled ? 'text-red-200' : isTentative ? 'text-[var(--ds-text-4)]' : isConf ? 'text-black/30' : 'text-[var(--ds-text-4)]'
  const badge = isPastTab ? 'bg-[var(--ds-bg-raised)] text-[var(--ds-text-2)]'
    : isCancelled ? 'bg-red-200 dark:bg-red-900/50 text-red-600 dark:text-red-400'
    : isPast ? 'bg-[var(--ds-bg-raised)] text-[var(--ds-text-3)]' : isConf ? 'bg-black text-[#adee2b]' : 'bg-[var(--ds-bg-raised)] text-[var(--ds-text-2)]'

  const baseCardStyle = isTentative
    ? { backgroundColor: 'var(--ds-bg-surface-2)', border: '1px solid var(--ds-border)' }
    : (!isCancelled && !isConf)
      ? { backgroundColor: isPastTab ? 'var(--ds-bg-surface-2)' : 'var(--ds-bg-surface)', border: '1px solid var(--ds-border-sub)' }
      : {}

  return (
    <div
      onClick={() => { if (canEdit) { if (isTentative && onTentativeAction) onTentativeAction(b); else onEdit(b) } }}
      className={`rounded-2xl px-5 pt-5 group relative overflow-hidden ${canCancel ? 'pb-12' : 'pb-5'} ${isTentative ? 't-hatch' : ''} ${cardBg} ${canEdit ? 'cursor-pointer hover:-translate-y-0.5 hover:shadow-md' : ''}`}
      style={{
        ...baseCardStyle,
        animation: animate ? `card-in 0.25s cubic-bezier(0.4,0,0.2,1) ${index * 45}ms both` : undefined,
        opacity: isExiting ? 0 : isPending ? 0.3 : 1,
        transform: isExiting ? 'scale(0.95)' : isPending ? 'scale(0.98)' : undefined,
        outline: isPending ? '2px solid #fca5a5' : 'none',
        outlineOffset: -2,
        transition: 'opacity 0.35s ease, transform 0.35s ease, box-shadow 0.2s',
      }}
    >
      {/* Badges row — lean: status + type + optional meta. for/by pushed to right */}
      <div className="flex items-center gap-2 mb-3">
        <span
          className={`text-[9px] font-black uppercase px-2.5 py-1 rounded-full ${isTentative ? 't-badge-hatch' : badge}`}
          style={isTentative ? { backgroundColor: 'var(--ds-bg-raised)', color: 'var(--ds-text-2)' } : undefined}
        >{b.status}</span>
        {b.cancel_reason === 'ghost_release' && b.dispute_status !== 'approved' && (
          <span className="flex items-center gap-0.5 text-[8px] font-black uppercase px-2 py-1 rounded-full bg-orange-500/15 text-orange-600 dark:text-orange-400">
            <span className="material-symbols-outlined" style={{ fontSize: 10 }}>person_off</span>Auto-Released
          </span>
        )}
        {b.dispute_status === 'approved' && (
          <span className="flex items-center gap-0.5 text-[8px] font-black uppercase px-2 py-1 rounded-full bg-green-500/15 text-green-600 dark:text-green-400">
            <span className="material-symbols-outlined" style={{ fontSize: 10 }}>gavel</span>Reinstated
          </span>
        )}
        <span className="text-[9px] font-black uppercase px-2.5 py-1 rounded-full"
          style={{ backgroundColor: tStyle.bg, color: tStyle.text }}>{tStyle.label}</span>
        {b.series_id && (
          <span className="flex items-center gap-0.5 text-[8px] font-black uppercase px-2 py-1 rounded-full bg-blue-500/15 text-blue-500 dark:text-blue-400">
            <span className="material-symbols-outlined" style={{ fontSize: 10 }}>link</span>Series
          </span>
        )}
        {b.room?.requires_contact && (
          <span className="flex items-center gap-0.5 text-[8px] font-black uppercase px-2 py-1 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400">
            <span className="material-symbols-outlined" style={{ fontSize: 10 }}>star</span>Special
          </span>
        )}
        {(b.booked_for && !b.is_recipient) || (b.is_recipient && b.user) ? (
          <div className="ml-auto flex items-center gap-2">
            {b.booked_for && !b.is_recipient && (
              <UserHoverCard name={b.booked_for} userId={b.booked_for_user_id}>
                <span className={`flex items-center gap-1 text-[9px] font-black uppercase px-2.5 py-1 rounded-full ${isConf ? 'bg-black/15 text-black' : isCancelled ? 'bg-red-500/15 text-red-700 dark:text-red-300' : 'bg-[var(--ds-text-1)]/10 text-[var(--ds-text-1)]'}`}>
                  <span className="material-symbols-outlined" style={{ fontSize: 10 }}>person</span>
                  for {b.booked_for}
                </span>
              </UserHoverCard>
            )}
            {b.is_recipient && b.user && (
              <UserHoverCard name={b.user.name} user={b.user}>
                <span className={`flex items-center gap-1 text-[9px] font-black uppercase px-2.5 py-1 rounded-full ${isConf ? 'bg-black/15 text-black' : isCancelled ? 'bg-red-500/15 text-red-700 dark:text-red-300' : 'bg-[#adee2b]/30 text-[#2d5000] dark:text-[#adee2b]'}`}>
                  <span className="material-symbols-outlined" style={{ fontSize: 10 }}>person</span>
                  by {b.user.name}
                </span>
              </UserHoverCard>
            )}
          </div>
        ) : null}
      </div>

      {/* Main content — left: title/room, right: date + time stack */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h4 className={`text-base font-black uppercase tracking-tight leading-tight ${titleClr}`}>{b.title}</h4>
          {b.description && <p className={`text-sm font-medium mt-1.5 leading-relaxed line-clamp-2 ${desc}`}>{b.description}</p>}
          <p className={`text-[11px] font-bold mt-2 flex items-center gap-1.5 flex-wrap ${loc}`}>
            <span className="material-symbols-outlined" style={{ fontSize: 13 }}>meeting_room</span>{b.room?.name}
            {b.room?.building && (
              <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${isConf ? 'bg-black/10 text-black/50' : isTentative ? 'bg-[var(--ds-bg-raised)] text-[var(--ds-text-3)]' : isCancelled ? 'bg-red-500/15 text-red-400' : 'bg-[var(--ds-bg-raised)] text-[var(--ds-text-3)]'}`}>
                {b.room.building.code || b.room.building.name}
              </span>
            )}
          </p>
        </div>
        <div className="text-right shrink-0 relative">
          <p className={`text-[9px] font-black uppercase tracking-wide leading-none mb-2 ${t2}`}>{fmtTableDate(b.start_at, language)}</p>
          <p className={`text-2xl font-black tabular-nums leading-none ${t1}`}>{fmtTime(b.start_at, language)}</p>
          <p className={`text-sm font-bold mt-1 ${t2}`}>{fmtTime(b.end_at, language)}</p>
          <p className={`text-[11px] font-bold mt-0.5 ${td}`}>{dur(b.start_at, b.end_at)}</p>
        </div>
      </div>
      {canCancel && (
        <>
          {canEdit && (
            <span className={`absolute bottom-3.5 left-5 text-[9px] font-black uppercase tracking-wider flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity ${isConf ? 'text-black/35' : 'text-[var(--ds-text-4)]'}`}>
              <span className="material-symbols-outlined" style={{ fontSize: 12 }}>{isTentative ? 'tune' : 'edit'}</span>
              {isTentative ? 'Click to manage' : 'Click to edit'}
            </span>
          )}
          <button
            onClick={e => { e.stopPropagation(); onCancel(b) }}
            disabled={isPending}
            className={`absolute bottom-0 right-0 px-5 py-3 rounded-tl-2xl text-[11px] font-black uppercase transition-all disabled:opacity-40
              ${isConf ? 'bg-black/10 text-black/50 hover:bg-black hover:text-[#adee2b]' : 'bg-[var(--ds-bg-surface-2)] text-[var(--ds-text-3)] hover:bg-red-50 dark:hover:bg-red-950/30 hover:text-red-500'}`}
          >
            Cancel
          </button>
        </>
      )}
      {/* Dispute section — only for the confirmation target (booked_for user, or creator if no booked_for) */}
      {b.cancel_reason === 'ghost_release' && (!b.booked_for_user_id || b.is_recipient === true) && <DisputeSection b={b} />}
    </div>
  )
}

function DisputeSection({ b }: { b: Booking }) {
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(b.dispute_status ?? null)

  if (done === 'pending') return (
    <div className="mt-3 flex items-center gap-2 px-3 py-2 rounded-xl bg-orange-500/10 border border-orange-500/20">
      <span className="material-symbols-outlined text-orange-500" style={{ fontSize: 14 }}>hourglass_top</span>
      <p className="text-[10px] font-black text-orange-600 dark:text-orange-400">Dispute submitted — pending admin review</p>
    </div>
  )
  if (done === 'approved') return (
    <div className="mt-3 flex items-center gap-2 px-3 py-2 rounded-xl bg-green-500/10 border border-green-500/20">
      <span className="material-symbols-outlined text-green-500" style={{ fontSize: 14 }}>check_circle</span>
      <p className="text-[10px] font-black text-green-600 dark:text-green-400">Dispute approved — booking reinstated</p>
    </div>
  )
  if (done === 'rejected') return (
    <div className="mt-3 flex items-center gap-2 px-3 py-2 rounded-xl bg-red-500/10 border border-red-500/20">
      <span className="material-symbols-outlined text-red-500" style={{ fontSize: 14 }}>cancel</span>
      <p className="text-[10px] font-black text-red-500 dark:text-red-400">Dispute rejected by admin</p>
    </div>
  )

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    try {
      await submitDispute(b.id, note.trim() || undefined)
      setDone('pending')
      qc.invalidateQueries({ queryKey: ['my-bookings'] })
    } catch { /* ignore */ }
    finally { setSubmitting(false) }
  }

  return (
    <div className="mt-3" onClick={e => e.stopPropagation()}>
      {!open ? (
        <button onClick={() => setOpen(true)}
          className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider px-3 py-2 rounded-xl transition-all"
          style={{ background: 'rgba(249,115,22,0.08)', border: '1px solid rgba(249,115,22,0.25)', color: '#ea580c' }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(249,115,22,0.15)' }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(249,115,22,0.08)' }}>
          <span className="material-symbols-outlined" style={{ fontSize: 13 }}>gavel</span>
          Dispute auto-release
        </button>
      ) : (
        <form onSubmit={handleSubmit} className="rounded-xl p-3 space-y-2.5" style={{ background: 'rgba(249,115,22,0.06)', border: '1px solid rgba(249,115,22,0.2)' }}>
          <p className="text-[10px] font-black uppercase tracking-wider text-orange-600 dark:text-orange-400">Dispute Auto-Release</p>
          <p className="text-[10px] font-medium text-[var(--ds-text-3)]">Were you in the room but forgot to confirm? Describe the situation — admin will review.</p>
          <textarea
            value={note}
            onChange={e => setNote(e.target.value)}
            rows={3}
            maxLength={500}
            placeholder="Optional: I was in the room at [time]..."
            className="w-full text-[11px] font-medium rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-orange-400"
            style={{ background: 'var(--ds-bg-raised)', border: '1px solid var(--ds-border)', color: 'var(--ds-text-1)' }}
          />
          <div className="flex gap-2">
            <button type="button" onClick={() => setOpen(false)}
              className="flex-1 py-2 rounded-lg text-[10px] font-black uppercase transition-colors"
              style={{ background: 'var(--ds-bg-raised)', border: '1px solid var(--ds-border)', color: 'var(--ds-text-2)' }}>
              Cancel
            </button>
            <button type="submit" disabled={submitting}
              className="flex-1 py-2 rounded-lg text-[10px] font-black uppercase transition-all disabled:opacity-50"
              style={{ background: 'rgba(249,115,22,0.15)', border: '1px solid rgba(249,115,22,0.4)', color: '#ea580c' }}>
              {submitting ? 'Submitting…' : 'Submit Dispute'}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}

function BookingListItem({ b, index = 0, animate, activeTab, pendingCancelIds, exitingCancelIds, onEdit, onCancel, onTentativeAction }: { b: Booking; index?: number } & CardSharedProps) {
  const { language } = useSettings()
  const isConf = b.status === 'confirmed'
  const isCancelled = b.status === 'cancelled'
  const isTentative = b.status === 'tentative'
  const isPast = isActuallyPast(b)
  const isPastTab = activeTab === 'past'
  const isPending = pendingCancelIds.has(b.id)
  const isExiting = exitingCancelIds.has(b.id)
  const canEdit = !isPast && !isCancelled
  const canCancel = !isCancelled
  const tStyle = typeStyle[b.type] || typeStyle.internal

  const rowBg = isCancelled ? 'bg-red-50 dark:bg-red-950/30 border-red-100 dark:border-red-900/40'
    : isConf ? 'bg-[#adee2b] dark:bg-[#adee2b]/75 border-transparent' : ''
  const dot     = isPastTab ? 'bg-[var(--ds-text-4)]' : isCancelled ? 'bg-red-400' : isTentative ? 'bg-[var(--ds-text-3)]' : isConf ? 'bg-black' : 'bg-[var(--ds-text-3)]'
  const titleClr = isPastTab ? 'text-[var(--ds-text-2)]' : isCancelled ? 'text-red-700 dark:text-red-400' : isTentative ? 'text-[var(--ds-text-2)]' : isConf ? 'text-black' : 'text-[var(--ds-text-1)]'
  const subClr  = isPastTab ? 'text-[var(--ds-text-3)]' : isCancelled ? 'text-red-400' : isTentative ? 'text-[var(--ds-text-3)]' : isConf ? 'text-black/50' : 'text-[var(--ds-text-3)]'
  const timeClr = isPastTab ? 'text-[var(--ds-text-2)]' : isCancelled ? 'text-red-400' : isTentative ? 'text-[var(--ds-text-2)]' : isConf ? 'text-black/80' : 'text-[var(--ds-text-1)]'
  return (
    <div
      onClick={() => { if (canEdit) { if (isTentative && onTentativeAction) onTentativeAction(b); else onEdit(b) } }}
      className={`flex items-center gap-4 px-4 py-3 rounded-2xl border ${isTentative ? 't-hatch' : ''} ${rowBg} ${canEdit ? 'cursor-pointer hover:shadow-sm' : ''}`}
      style={{
        ...(isTentative ? { backgroundColor: 'var(--ds-bg-surface-2)', borderColor: 'var(--ds-border)' } : !isCancelled && !isConf ? { backgroundColor: 'var(--ds-bg-surface)', borderColor: 'var(--ds-border-sub)' } : {}),
        animation: animate ? `card-in 0.22s cubic-bezier(0.4,0,0.2,1) ${index * 35}ms both` : undefined,
        opacity: isExiting ? 0 : isPending ? 0.3 : 1,
        transform: isExiting ? 'scale(0.97) translateY(4px)' : undefined,
        outline: isPending ? '2px solid #fca5a5' : 'none',
        outlineOffset: -2,
        filter: isPastTab ? 'grayscale(1) brightness(0.97)' : undefined,
        transition: 'opacity 0.35s ease, transform 0.35s ease, box-shadow 0.15s, filter 0.3s',
      }}
    >
      <div className={`size-2.5 rounded-full shrink-0 ${dot}`} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 min-w-0 flex-wrap">
          <span className={`text-[14px] font-black uppercase leading-tight shrink-0 ${titleClr}`}>{b.title}</span>
          <span className={`text-[12px] font-bold truncate ${subClr}`}>{b.room?.name}</span>
          {b.room?.building && (
            <span className={`text-[10px] font-black uppercase px-1.5 py-0.5 rounded-full shrink-0 ${isConf ? 'bg-black/10 text-black/50' : isTentative ? 'bg-[var(--ds-bg-raised)] text-[var(--ds-text-3)]' : isCancelled ? 'bg-red-500/15 text-red-400' : 'bg-[var(--ds-bg-raised)] text-[var(--ds-text-3)]'}`}>
              {b.room.building.code || b.room.building.name}
            </span>
          )}
        </div>
        {b.description && <p className={`text-[10px] font-medium truncate mt-0.5 ${subClr}`}>{b.description}</p>}
      </div>
      {b.booked_for && !b.is_recipient && (
        <UserHoverCard name={b.booked_for} userId={b.booked_for_user_id}>
          <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-[var(--ds-bg-raised)] text-[var(--ds-text-2)] shrink-0">for {b.booked_for}</span>
        </UserHoverCard>
      )}
      {b.is_recipient && b.user && (
        <UserHoverCard name={b.user.name} user={b.user}>
          <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full shrink-0 bg-[#ecfccb] text-[#3a5c00] dark:bg-[#adee2b]/15 dark:text-[#adee2b]">by {b.user.name}</span>
        </UserHoverCard>
      )}
      <span className="text-[8px] font-black uppercase px-2 py-0.5 rounded-full shrink-0"
        style={{ backgroundColor: tStyle.bg, color: tStyle.text }}>{tStyle.label}</span>
      {b.cancel_reason === 'ghost_release' && b.dispute_status !== 'approved' && (
        <span className="flex items-center gap-0.5 text-[8px] font-black uppercase px-2 py-0.5 rounded-full shrink-0 bg-orange-500/15 text-orange-600 dark:text-orange-400" title="Auto-cancelled: presence not confirmed in time">
          <span className="material-symbols-outlined" style={{ fontSize: 10 }}>person_off</span>Auto-Released
        </span>
      )}
      {b.dispute_status === 'approved' && (
        <span className="flex items-center gap-0.5 text-[8px] font-black uppercase px-2 py-0.5 rounded-full shrink-0 bg-green-500/15 text-green-600 dark:text-green-400" title="Auto-release disputed and reinstated">
          <span className="material-symbols-outlined" style={{ fontSize: 10 }}>gavel</span>Reinstated
        </span>
      )}
      {b.series_id && (
        <span className="material-symbols-outlined text-blue-400 shrink-0" style={{ fontSize: 13 }} title="Series booking">link</span>
      )}
      {b.room?.requires_contact && (
        <span className="material-symbols-outlined text-amber-400 shrink-0" style={{ fontSize: 13 }} title="Special room">star</span>
      )}
      <div className={`text-[13px] font-bold text-right shrink-0 leading-tight ${subClr}`}>
        <p>{fmtTableDate(b.start_at, language)}</p>
        <p className="opacity-60 text-[11px]">{fmtTableDay(b.start_at, language)}</p>
      </div>
      <div className={`text-[14px] font-black tabular-nums shrink-0 ${timeClr}`}>
        {fmtTime(b.start_at, language)}–{fmtTime(b.end_at, language)}
      </div>
      {canEdit ? (
        <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
          <button onClick={() => { if (isTentative && onTentativeAction) onTentativeAction(b); else onEdit(b) }}
            className={`size-7 flex items-center justify-center rounded-lg transition-all ${isConf ? 'bg-black/10 text-black/60 hover:bg-black hover:text-[#adee2b]' : 'bg-[var(--ds-bg-surface-2)] text-[var(--ds-text-3)] hover:bg-black hover:text-[#adee2b]'}`}>
            <span className="material-symbols-outlined" style={{ fontSize: 13 }}>{isTentative ? 'tune' : 'edit'}</span>
          </button>
          <button onClick={() => onCancel(b)}
            className="size-7 flex items-center justify-center rounded-lg bg-[var(--ds-bg-raised)] text-[var(--ds-text-3)] hover:bg-red-500/15 hover:text-red-500 transition-all">
            <span className="material-symbols-outlined" style={{ fontSize: 13 }}>cancel</span>
          </button>
        </div>
      ) : canCancel ? (
        <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
          <button onClick={() => onCancel(b)}
            className="size-7 flex items-center justify-center rounded-lg bg-[var(--ds-bg-raised)] text-[var(--ds-text-3)] hover:bg-red-500/15 hover:text-red-500 transition-all">
            <span className="material-symbols-outlined" style={{ fontSize: 13 }}>cancel</span>
          </button>
        </div>
      ) : <div className="w-[62px] shrink-0" />}
    </div>
  )
}

function SeriesGroupRow({
  group,
  pendingCancelIds,
  onEdit,
  onCancel,
  onCancelSeries,
  onExport,
  resolvedSkips,
  index,
  isPast = false,
}: {
  group: SeriesGroup
  pendingCancelIds: Set<number>
  onEdit: (b: Booking) => void
  onCancel: (b: Booking) => void
  onCancelSeries: (group: SeriesGroup) => void
  onExport: (group: SeriesGroup, format: 'excel' | 'pdf', includePast: boolean) => void
  resolvedSkips: Record<string, Booking>
  index: number
  isPast?: boolean
}) {
  const { language } = useSettings()
  const [open, setOpen] = useState(false)
  const [closing, setClosing] = useState(false)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const [showAllSkipped, setShowAllSkipped] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)
  const [exportIncludePast, setExportIncludePast] = useState(false)
  const [exportPos, setExportPos] = useState<{ top: number; right: number } | null>(null)
  const exportBtnRef = useRef<HTMLButtonElement>(null)
  const exportPanelRef = useRef<HTMLDivElement>(null)

  function toggleExportOpen() {
    if (!exportOpen) {
      const rect = exportBtnRef.current?.getBoundingClientRect()
      if (rect) setExportPos({ top: rect.bottom + 6, right: window.innerWidth - rect.right })
    }
    setExportOpen(o => !o)
  }

  useEffect(() => {
    if (!exportOpen) return
    const fn = (e: MouseEvent) => {
      const target = e.target as Node
      if (exportBtnRef.current?.contains(target)) return
      if (exportPanelRef.current?.contains(target)) return
      setExportOpen(false)
    }
    document.addEventListener('mousedown', fn)
    return () => document.removeEventListener('mousedown', fn)
  }, [exportOpen])

  function toggleOpen() {
    if (open && !closing) {
      setClosing(true)
      closeTimer.current = setTimeout(() => { setOpen(false); setClosing(false) }, 160)
    } else if (!open) {
      setOpen(true)
    }
  }
  useEffect(() => () => { clearTimeout(closeTimer.current) }, [])

  const { bookings } = group
  const first = bookings[0]
  const last = bookings[bookings.length - 1]

  const confirmedCount = bookings.filter(b => b.status === 'confirmed').length
  const tentativeCount = bookings.filter(b => b.status === 'tentative').length
  const cancelledCount = bookings.filter(b => b.status === 'cancelled').length
  const allCancelled = cancelledCount === bookings.length

  const fmtSeriesDate = (iso: string) =>
    parseLocal(iso).toLocaleDateString(language === 'id' ? 'id-ID' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric' })

  const dateRange = first === last
    ? fmtSeriesDate(first.start_at)
    : `${fmtSeriesDate(first.start_at)} – ${fmtSeriesDate(last.start_at)}`

  return (
    <tbody>
      <tr
        className={`border-b border-[var(--ds-border-sub)] transition-colors hover:bg-[var(--ds-bg-raised)] cursor-pointer ${allCancelled ? 'opacity-40' : ''}`}
        onClick={toggleOpen}
        style={{ animation: 'tbl-group-enter 0.28s ease-out backwards', animationDelay: `${index * 45}ms` }}
      >
        <td className="px-3 py-3.5">
          <span
            className="material-symbols-outlined text-[var(--ds-text-3)] transition-transform duration-200"
            style={{ fontSize: 16, display: 'block', transform: open ? 'rotate(90deg)' : 'rotate(0deg)' }}
          >chevron_right</span>
        </td>
        <td className="px-3 py-3.5">
          <div>
            <p className="text-xs font-black text-[var(--ds-text-1)]">{first.room?.name ?? '—'}</p>
            {first.room?.building && (
              <p className="text-[9px] font-bold text-[var(--ds-text-3)] mt-0.5">{first.room.building.code || first.room.building.name}</p>
            )}
          </div>
        </td>
        <td className="px-3 py-3.5 text-xs font-black text-[var(--ds-text-1)]">{first.title}</td>
        <td className="px-3 py-3.5">
          <p className="text-xs font-bold text-[var(--ds-text-2)] whitespace-nowrap">{dateRange}</p>
        </td>
        <td className="px-3 py-3.5">
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-100 text-blue-700 text-[9px] font-black uppercase whitespace-nowrap">
            <span className="material-symbols-outlined" style={{ fontSize: 11 }}>repeat</span>
            {bookings.length} dates
          </span>
        </td>
        <td className="px-3 py-3.5">
          <div className="flex items-center gap-2 text-[9px] font-bold whitespace-nowrap">
            {confirmedCount > 0 && <span className="text-green-600">{confirmedCount} confirmed</span>}
            {tentativeCount > 0 && <span className="text-amber-500">{tentativeCount} tentative</span>}
            {cancelledCount > 0 && <span className="text-red-400">{cancelledCount} cancelled</span>}
          </div>
        </td>
        <td className="px-3 py-3.5">
          <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
            <button
              onClick={() => onEdit(first)}
              disabled={isPast}
              title={isPast ? "Series has ended — can't edit" : 'Edit series'}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[var(--ds-bg-surface-2)] text-[var(--ds-text-2)] text-[9px] font-black uppercase hover:bg-black hover:text-[#adee2b] transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-[var(--ds-bg-surface-2)] disabled:hover:text-[var(--ds-text-2)]"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 12 }}>edit</span>
              Series
            </button>
            <div className="relative shrink-0">
              <button
                ref={exportBtnRef}
                onClick={toggleExportOpen}
                title="Export this series"
                className="size-7 flex items-center justify-center rounded-lg bg-[var(--ds-bg-raised)] text-[var(--ds-text-3)] hover:bg-black hover:text-[#adee2b] transition-all"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>download</span>
              </button>
              {exportOpen && exportPos && createPortal(
                <div ref={exportPanelRef} className="fixed z-50 rounded-2xl p-4 w-64 dropdown-enter-right"
                  style={{ top: exportPos.top, right: exportPos.right, background: 'var(--ds-glass-bg)', backdropFilter: 'blur(32px)', WebkitBackdropFilter: 'blur(32px)', border: '1px solid var(--ds-glass-border)', boxShadow: 'var(--ds-glass-shadow)' }}>
                  <p className="text-[10px] font-black uppercase tracking-widest text-[var(--ds-text-3)] mb-3">Export this series</p>
                  <ElasticCheckbox checked={exportIncludePast} onChange={setExportIncludePast} color="#000" className="mb-4">
                    <span className="text-[12px] font-bold text-[var(--ds-text-2)] flex-1">Include past dates</span>
                  </ElasticCheckbox>
                  <div className="pt-3 border-t border-[var(--ds-border-sub)] flex items-center gap-1.5">
                    <button
                      onClick={() => { onExport(group, 'excel', exportIncludePast); setExportOpen(false) }}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 text-[11px] font-black uppercase hover:bg-emerald-500/25 transition-colors border border-emerald-500/25 flex-1 justify-center"
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: 13 }}>table_view</span>Excel
                    </button>
                    <button
                      onClick={() => { onExport(group, 'pdf', exportIncludePast); setExportOpen(false) }}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-red-500/15 text-red-600 dark:text-red-400 text-[11px] font-black uppercase hover:bg-red-500/25 transition-colors border border-red-500/25 flex-1 justify-center"
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: 13 }}>picture_as_pdf</span>PDF
                    </button>
                  </div>
                </div>,
                document.body
              )}
            </div>
            {!allCancelled && (
              <button
                onClick={() => onCancelSeries(group)}
                title="Cancel entire series"
                className="size-7 flex items-center justify-center rounded-lg bg-[var(--ds-bg-raised)] text-[var(--ds-text-3)] hover:bg-red-500/15 hover:text-red-500 transition-all"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>cancel</span>
              </button>
            )}
          </div>
        </td>
      </tr>
      {(open || closing) && bookings.map((b, i) => {
        const isPast = isActuallyPast(b)
        const isConf = b.status === 'confirmed'
        const isCancelled = b.status === 'cancelled'
        return (
          <tr key={b.id}
            className={`border-b border-[var(--ds-border-sub)] bg-[var(--ds-bg-surface-2)]/30 ${isPast || isCancelled ? 'opacity-50' : ''}`}
            style={{
              animation: closing
                ? `tbl-row-exit 0.13s ease-in forwards`
                : `tbl-row-enter 0.18s ease-out backwards`,
              animationDelay: closing ? `${i * 8}ms` : `${i * 18}ms`,
            }}
          >
            <td className="pl-8 pr-3 py-2.5">
              <div className="w-3 h-px bg-[var(--ds-border)] ml-1" />
            </td>
            <td className="px-3 py-2.5 text-[10px] text-[var(--ds-text-3)] font-bold whitespace-nowrap">
              {fmtTableDate(b.start_at, language)} <span className="text-[var(--ds-text-4)]">{fmtTableDay(b.start_at, language)}</span>
            </td>
            <td className="px-3 py-2.5 text-[10px] font-bold text-[var(--ds-text-2)] whitespace-nowrap tabular-nums">
              {fmtTime(b.start_at, language)} – {fmtTime(b.end_at, language)}
              <span className="text-[var(--ds-text-4)] ml-1">{dur(b.start_at, b.end_at)}</span>
            </td>
            <td className="px-3 py-2.5" />
            <td className="px-3 py-2.5">
              <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-full
                ${isCancelled ? 'bg-red-500/15 text-red-400'
                  : isConf ? 'bg-[#adee2b] text-black'
                  : 'bg-amber-500/15 text-amber-600 dark:text-amber-400'}`}>
                {b.status}
              </span>
            </td>
            <td className="px-3 py-2.5" />
            <td className="px-3 py-2.5">
              {!isPast && !isCancelled && (
                <div className="flex items-center gap-1">
                  <button onClick={() => onEdit(b)} title="Edit this date"
                    className="size-6 flex items-center justify-center rounded-md bg-[var(--ds-bg-raised)] text-[var(--ds-text-3)] hover:bg-black hover:text-[#adee2b] transition-all">
                    <span className="material-symbols-outlined" style={{ fontSize: 12 }}>edit</span>
                  </button>
                  <button onClick={() => onCancel(b)} disabled={pendingCancelIds.has(b.id)} title="Cancel this date"
                    className="size-6 flex items-center justify-center rounded-md bg-[var(--ds-bg-raised)] text-[var(--ds-text-3)] hover:bg-red-500/15 hover:text-red-500 transition-all disabled:opacity-40">
                    <span className="material-symbols-outlined" style={{ fontSize: 12 }}>cancel</span>
                  </button>
                </div>
              )}
            </td>
          </tr>
        )
      })}
      {(open || closing) && (() => {
        const skipped = first.series_skipped_dates
        if (!skipped || skipped.length === 0) return null
        const unresolvedCount = skipped.filter(d => !resolvedSkips[`${group.series_id}:${parseSkipDate(d).real}`]).length
        const visibleSkipped = showAllSkipped ? skipped : skipped.slice(0, 2)
        const hiddenCount = skipped.length - visibleSkipped.length
        return (
          <tr style={{
            animation: closing
              ? 'tbl-row-exit 0.13s ease-in forwards'
              : `tbl-row-enter 0.18s ease-out backwards`,
            animationDelay: closing ? `${bookings.length * 8}ms` : `${bookings.length * 18}ms`,
          }}>
            <td colSpan={7} className="px-0 pt-0 pb-1">
              <div className="mx-8 mb-2 rounded-xl border border-red-200 dark:border-red-500/20 bg-red-50 dark:bg-red-500/5 overflow-hidden">
                <div className="flex items-center gap-2 px-3 py-2 border-b border-red-200 dark:border-red-500/20">
                  <span className="material-symbols-outlined text-red-400" style={{ fontSize: 15 }}>event_busy</span>
                  <span className="text-[11px] font-black uppercase tracking-wider text-red-500">
                    {unresolvedCount > 0 ? `${unresolvedCount} date${unresolvedCount !== 1 ? 's' : ''} skipped — conflict at time of booking` : `${skipped.length} date${skipped.length !== 1 ? 's' : ''} skipped — all rebooked`}
                  </span>
                  {first.room?.name && (
                    <span className="text-[11px] font-bold text-red-400/80 dark:text-red-400/70 truncate">· {first.room.name}</span>
                  )}
                </div>
                <div className="divide-y divide-red-200/60 dark:divide-red-500/10">
                  {visibleSkipped.map(d => {
                    const { real, invalidDay } = parseSkipDate(d)
                    const resolved = resolvedSkips[`${group.series_id}:${real}`]
                    return resolved
                      ? <ResolvedSkipRow key={d} date={real} invalidDay={invalidDay} booking={resolved} pendingCancelIds={pendingCancelIds} onEdit={onEdit} onCancel={onCancel} />
                      : <SkippedDateRow key={d} date={real} invalidDay={invalidDay} room={first.room} startTime={toHHMM(first.start_at)} endTime={toHHMM(first.end_at)} seriesId={group.series_id} disabled={isPast} />
                  })}
                </div>
                {hiddenCount > 0 && (
                  <button
                    onClick={() => setShowAllSkipped(true)}
                    className="w-full text-center py-2 text-[11px] font-black text-red-500 hover:text-red-600 uppercase tracking-wide border-t border-red-200/60 dark:border-red-500/10"
                  >
                    +{hiddenCount} more…
                  </button>
                )}
                {showAllSkipped && skipped.length > 2 && (
                  <button
                    onClick={() => setShowAllSkipped(false)}
                    className="w-full text-center py-2 text-[11px] font-black text-red-400 hover:text-red-500 uppercase tracking-wide border-t border-red-200/60 dark:border-red-500/10"
                  >
                    Show less
                  </button>
                )}
              </div>
            </td>
          </tr>
        )
      })()}
    </tbody>
  )
}

function MoreTooltip({ label, items }: { label: string; items: string[] }) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  const btnRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  function openTooltip() {
    const rect = btnRef.current?.getBoundingClientRect()
    if (rect) setPos({ top: rect.bottom + 6, left: rect.left })
    setOpen(true)
  }

  useEffect(() => {
    if (!open) return
    const fn = (e: MouseEvent) => {
      if (btnRef.current?.contains(e.target as Node)) return
      if (panelRef.current?.contains(e.target as Node)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', fn)
    return () => document.removeEventListener('mousedown', fn)
  }, [open])

  return (
    <>
      <button
        ref={btnRef}
        onMouseEnter={openTooltip}
        onMouseLeave={() => setOpen(false)}
        onClick={() => (open ? setOpen(false) : openTooltip())}
        className="text-[11px] font-black text-red-400 hover:text-red-500 underline decoration-dotted underline-offset-2"
      >
        {label}
      </button>
      {open && pos && createPortal(
        <div ref={panelRef} className="fixed z-50 rounded-xl p-3 w-72 space-y-1.5"
          style={{ top: pos.top, left: pos.left, background: 'var(--ds-glass-bg)', backdropFilter: 'blur(32px)', WebkitBackdropFilter: 'blur(32px)', border: '1px solid var(--ds-glass-border)', boxShadow: 'var(--ds-glass-shadow)' }}>
          {items.map((it, i) => (
            <p key={i} className="text-[12px] font-semibold text-[var(--ds-text-2)] leading-snug">{it}</p>
          ))}
        </div>,
        document.body
      )}
    </>
  )
}

function SkippedDateRow({ date, invalidDay, room, startTime, endTime, seriesId, disabled = false }: {
  date: string
  invalidDay?: number
  room?: Room
  startTime: string
  endTime: string
  seriesId: string
  disabled?: boolean
}) {
  const { language } = useSettings()
  const { data } = useQuery({
    queryKey: ['skip-conflicts', room?.id, date, startTime, endTime],
    queryFn: () => checkAvailability(room!.id, `${date} ${startTime}:00`, `${date} ${endTime}:00`),
    enabled: !!room && !invalidDay,
    staleTime: 60_000,
  })
  const conflicts = (data?.conflicts ?? []) as Booking[]
  const shown = conflicts.slice(0, 2)
  const rest = conflicts.slice(2)

  const fmtConflict = (b: Booking) => {
    const dept = b.user?.department_name
    return `${b.title} - ${b.user?.name ?? '—'}${dept ? ` (${dept})` : ''} ${fmtTime(b.start_at, language)}-${fmtTime(b.end_at, language)}`
  }

  // Invalid monthly date (e.g. 31st in Feb) — search from the 1st of that month instead of the
  // clamped placeholder date, but resolveSkip must still key off the real stored date so it
  // matches series_skipped_dates / resolves_skipped_date for the "resolved" lookup.
  const searchDate = invalidDay ? `${date.slice(0, 7)}-01` : date

  return (
    <div className="flex items-start justify-between gap-3 px-3 py-2">
      <div className="flex items-start gap-2 min-w-0">
        <span className="material-symbols-outlined text-red-300 mt-0.5" style={{ fontSize: 12 }}>{invalidDay ? 'event_busy' : 'block'}</span>
        <div className="min-w-0">
          <span className="text-[13px] font-bold text-red-600 dark:text-red-400 block">
            {invalidDay ? fmtInvalidSkipDate(date, invalidDay, language) : fmtSkipDate(date)}
          </span>
          {invalidDay ? (
            <p className="text-[11px] font-semibold text-red-400/90 dark:text-red-400/80">
              {language === 'id' ? 'Tanggal tidak ada di bulan itu' : "Date doesn't exist that month"}
            </p>
          ) : shown.length > 0 && (
            <div className="mt-1 space-y-1">
              {shown.map(c => (
                <p key={c.id} className="text-[11.5px] font-semibold text-red-400/90 dark:text-red-400/80 truncate max-w-[320px]">{fmtConflict(c)}</p>
              ))}
              {rest.length > 0 && <MoreTooltip label={`+${rest.length} more…`} items={rest.map(fmtConflict)} />}
            </div>
          )}
        </div>
      </div>
      <button
        onClick={() => document.dispatchEvent(new CustomEvent('available-rooms-prefill', {
          detail: { date: searchDate, startTime, endTime, resolveSkip: { seriesId, date } },
        }))}
        disabled={disabled}
        title={disabled ? "Series has ended — can't rebook" : undefined}
        className="shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-black uppercase tracking-wide transition-all
          bg-[var(--ds-bg-surface)] border border-[var(--ds-border)] text-[var(--ds-text-2)]
          hover:border-[#adee2b] hover:text-[#adee2b] hover:bg-[#adee2b]/5
          disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:border-[var(--ds-border)] disabled:hover:text-[var(--ds-text-2)] disabled:hover:bg-[var(--ds-bg-surface)]"
      >
        <span className="material-symbols-outlined" style={{ fontSize: 13 }}>search</span>
        Find another slot
      </button>
    </div>
  )
}

function ResolvedSkipRow({ date, invalidDay, booking, pendingCancelIds, onEdit, onCancel }: {
  date: string
  invalidDay?: number
  booking: Booking
  pendingCancelIds: Set<number>
  onEdit: (b: Booking) => void
  onCancel: (b: Booking) => void
}) {
  const { language } = useSettings()
  return (
    <div className="flex items-center justify-between gap-3 px-3 py-2 bg-green-50 dark:bg-green-500/5">
      <div className="flex items-center gap-2 min-w-0">
        <span className="material-symbols-outlined text-green-500 shrink-0" style={{ fontSize: 13 }}>check_circle</span>
        <span className="text-[13px] font-bold text-green-700 dark:text-green-400 shrink-0">
          {invalidDay
            ? `${fmtInvalidSkipDate(date, invalidDay, language)} (${language === 'id' ? 'Invalid, tanggal tidak ada di bulan itu' : "Invalid, date doesn't exist that month"})`
            : fmtSkipDate(date)} — rebooked:
        </span>
        <span className="text-[12px] font-semibold text-green-600 dark:text-green-400/80 truncate">
          {booking.title} · {booking.room?.name}{booking.room?.building?.name ? `, ${booking.room.building.name}` : ''} · {fmtTableDate(booking.start_at, language)} {fmtTime(booking.start_at, language)}–{fmtTime(booking.end_at, language)}
        </span>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <button onClick={() => onEdit(booking)} title="Edit this booking"
          className="size-6 flex items-center justify-center rounded-md bg-[var(--ds-bg-raised)] text-green-600 dark:text-green-400 hover:bg-black hover:text-[#adee2b] transition-all">
          <span className="material-symbols-outlined" style={{ fontSize: 12 }}>edit</span>
        </button>
        <button onClick={() => onCancel(booking)} disabled={pendingCancelIds.has(booking.id)} title="Cancel this booking"
          className="size-6 flex items-center justify-center rounded-md bg-[var(--ds-bg-raised)] text-green-600 dark:text-green-400 hover:bg-red-500/15 hover:text-red-500 transition-all disabled:opacity-40">
          <span className="material-symbols-outlined" style={{ fontSize: 12 }}>cancel</span>
        </button>
      </div>
    </div>
  )
}

function HCalCompactCard({ b, expanded, onToggle, onEdit, onCancel, clickable = true, highlighted = false, onHover, onUnhover }: {
  b: Booking
  expanded: boolean
  onToggle: () => void
  onEdit: () => void
  onCancel: () => void
  clickable?: boolean
  highlighted?: boolean
  onHover?: () => void
  onUnhover?: () => void
}) {
  const { language } = useSettings()
  const isConf = b.status === 'confirmed'
  const isCancelled = b.status === 'cancelled'
  const isTentative = b.status === 'tentative'
  const tStyle = typeStyle[b.type] ?? typeStyle.internal
  const accentBg = isConf ? '#adee2b' : isTentative ? '#fbbf24' : isCancelled ? '#fca5a5' : '#adee2b'
  const accentText = isConf ? 'rgba(0,0,0,0.75)' : isTentative ? '#78350f' : '#9f1239'
  const ACTION_H = 44
  return (
    <div
      onMouseEnter={onHover}
      onMouseLeave={onUnhover}
      style={{
        width: 260, flexShrink: 0, position: 'relative',
        paddingBottom: expanded ? 28 + ACTION_H : 28,
        transition: 'padding-bottom 0.3s cubic-bezier(0.34,1.04,0.64,1)',
      }}>
      {/* Dark action layer */}
      <div style={{
        position: 'absolute', top: 16, left: 0, right: 0,
        bottom: expanded ? 0 : 8,
        background: '#0f172a', borderRadius: 22, zIndex: 0,
        display: 'flex', alignItems: 'flex-end',
        padding: '0 12px 12px', gap: 8,
        transition: 'bottom 0.3s cubic-bezier(0.34,1.04,0.64,1)',
      }}>
        <div style={{
          display: 'flex', width: '100%', gap: 8,
          opacity: expanded ? 1 : 0,
          transition: expanded ? 'opacity 0.18s ease 0.14s' : 'opacity 0.1s ease',
        }}>
          <button onClick={e => { e.stopPropagation(); onEdit() }} style={{
            flex: 1, background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.18)',
            borderRadius: 10, padding: '8px 0', color: 'white',
            fontSize: 10, fontWeight: 900, letterSpacing: '0.08em', textTransform: 'uppercase', cursor: 'pointer',
          }}>Edit</button>
          <button onClick={e => { e.stopPropagation(); onCancel() }} style={{
            flex: 1, background: 'rgba(239,68,68,0.14)', border: '1px solid rgba(239,68,68,0.32)',
            borderRadius: 10, padding: '8px 0', color: '#fca5a5',
            fontSize: 10, fontWeight: 900, letterSpacing: '0.08em', textTransform: 'uppercase', cursor: 'pointer',
          }}>Cancel</button>
        </div>
      </div>
      {/* Accent layer */}
      <div style={{
        position: 'absolute', top: 8, left: 0, right: 0,
        bottom: expanded ? ACTION_H : 0,
        background: accentBg, borderRadius: 22, zIndex: 1,
        display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
        padding: '0 16px 9px',
        transition: 'bottom 0.3s cubic-bezier(0.34,1.04,0.64,1)',
      }}>
        <span style={{ fontSize: 9, fontWeight: 900, color: accentText, textTransform: 'uppercase', letterSpacing: '0.07em' }}>{b.status}</span>
        <span style={{ fontSize: 9, fontWeight: 900, color: accentText, textTransform: 'uppercase', letterSpacing: '0.07em' }}>{tStyle.label}</span>
      </div>
      {/* Top card */}
      <div onClick={clickable ? onToggle : undefined} style={{
        position: 'relative', zIndex: 2, cursor: clickable ? 'pointer' : 'default',
        background: 'var(--ds-bg-surface)',
        border: expanded ? '1.5px solid rgba(173,238,43,0.6)' : '1px solid var(--ds-border-sub)',
        borderRadius: 22, padding: '16px 16px 15px',
        boxShadow: highlighted
          ? `0 0 0 2px ${accentBg}, 0 0 18px 6px ${accentBg}66, 0 4px 16px rgba(0,0,0,0.13)`
          : expanded
          ? '0 0 0 3px rgba(173,238,43,0.15), 0 4px 16px rgba(0,0,0,0.11)'
          : '0 2px 10px rgba(0,0,0,0.07), 0 1px 3px rgba(0,0,0,0.05)',
        transition: 'border 0.2s ease, box-shadow 0.2s ease',
      }}>
        <p style={{ fontSize: 17, fontWeight: 900, color: 'var(--ds-text-1)', lineHeight: 1.25, marginBottom: 10, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.title}</p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 5, overflow: 'hidden' }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--ds-text-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, minWidth: 0 }}>{b.room?.name ?? '—'}</p>
          {b.room?.building && (
            <span style={{ flexShrink: 0, fontSize: 9, fontWeight: 900, color: 'var(--ds-text-3)', textTransform: 'uppercase', letterSpacing: '0.05em', background: 'var(--ds-bg-raised)', borderRadius: 6, padding: '2px 6px' }}>
              {b.room.building.code || b.room.building.name}
            </span>
          )}
          {b.room?.requires_contact && (
            <span className="material-symbols-outlined shrink-0" style={{ fontSize: 12, color: '#d97706' }} title="Special room">star</span>
          )}
        </div>
        {b.is_recipient && b.user ? (
          <UserHoverCard name={b.user.name} user={b.user}>
            <p className="dark:text-[#adee2b]" style={{ fontSize: 12, fontWeight: 900, color: '#3a5c00', marginBottom: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 3 }}>
              <span className="material-symbols-outlined" style={{ fontSize: 13 }}>person</span>
              by {b.user.name}
            </p>
          </UserHoverCard>
        ) : b.booked_for ? (
          <UserHoverCard name={b.booked_for} userId={b.booked_for_user_id}>
            <p style={{ fontSize: 12, fontWeight: 900, color: 'var(--ds-text-2)', marginBottom: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 3 }}>
              <span className="material-symbols-outlined" style={{ fontSize: 13 }}>person_pin</span>
              for {b.booked_for}
            </p>
          </UserHoverCard>
        ) : null}
        <p style={{ fontSize: 13, fontWeight: 900, color: 'var(--ds-text-2)', fontVariantNumeric: 'tabular-nums' }}>{fmtTime(b.start_at, language)} – {fmtTime(b.end_at, language)}</p>
      </div>
    </div>
  )
}

function SlideWrapper({ exiting, children }: { exiting: boolean; children: ReactNode }) {
  const wrapRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = wrapRef.current
    if (!el || !exiting) return
    const h = el.scrollHeight
    el.style.height = `${h}px`
    el.style.overflow = 'hidden'
    el.getBoundingClientRect() // force reflow so transition fires
    el.style.transition = 'height 0.32s cubic-bezier(0.4,0,0.2,1)'
    el.style.height = '0'
  }, [exiting])
  return <div ref={wrapRef}>{children}</div>
}
export {
  BookingCard, DisputeSection, BookingListItem, SeriesGroupRow, MoreTooltip,
  SkippedDateRow, ResolvedSkipRow, HCalCompactCard, SlideWrapper,
}
