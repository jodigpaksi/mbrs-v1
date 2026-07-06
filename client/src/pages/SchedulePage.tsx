import { useState, useRef, useEffect, useMemo, Fragment, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useSearchParams } from 'react-router-dom'
import { useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import * as XLSX from 'xlsx'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { Booking, Room } from '../types/index'
import { getMyBookings, clearCancelledBookings, getBookings, updateBooking, submitDispute } from '../api/bookings'
import { checkAvailability } from '../api/rooms'
import { getGeneralSettings } from '../api/settings'
import { useAuth } from '../context/AuthContext'
import { useSettings } from '../context/SettingsContext'
import { useCancelToast } from '../context/CancelToastContext'
import BookingPanel from '../components/booking/BookingPanel'
import { useBookingHours } from '../hooks/useBookingHours'
import { useWeekendSettings } from '../hooks/useWeekendSettings'
import UserHoverCard from '../components/ui/UserHoverCard'

function parseLocal(iso: string) { return new Date(iso.replace('Z', '')) }
function dur(start: string, end: string) {
  const diff = (parseLocal(end).getTime() - parseLocal(start).getTime()) / 60000
  const h = Math.floor(diff / 60), m = diff % 60
  return h && m ? `${h}h ${m}m` : h ? `${h}h` : `${m}m`
}
function fmtTime(iso: string, lang = 'en') {
  return parseLocal(iso).toLocaleTimeString(lang === 'id' ? 'id-ID' : 'en-GB', { hour: '2-digit', minute: '2-digit' })
}
function toHHMM(iso: string) {
  const d = parseLocal(iso)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}
function fmtGroupLabel(iso: string, todayLabel: string, tomorrowLabel: string, lang = 'en') {
  const d = parseLocal(iso), today = new Date(), tomorrow = new Date()
  tomorrow.setDate(today.getDate() + 1)
  if (d.toDateString() === today.toDateString()) return todayLabel
  if (d.toDateString() === tomorrow.toDateString()) return tomorrowLabel
  return d.toLocaleDateString(lang === 'id' ? 'id-ID' : 'en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).toUpperCase()
}
function fmtTableDate(iso: string, lang = 'en') {
  return parseLocal(iso).toLocaleDateString(lang === 'id' ? 'id-ID' : 'en-GB', { day: '2-digit', month: 'short' })
}
function fmtTableDay(iso: string, lang = 'en') {
  return parseLocal(iso).toLocaleDateString(lang === 'id' ? 'id-ID' : 'en-GB', { weekday: 'short' })
}
function groupByDate(bookings: Booking[]) {
  const groups: Record<string, Booking[]> = {}
  bookings.forEach(b => {
    const key = parseLocal(b.start_at).toDateString()
    if (!groups[key]) groups[key] = []
    groups[key].push(b)
  })
  return Object.entries(groups)
}
function isActuallyPast(b: Booking) {
  const today = new Date()
  return parseLocal(b.end_at) < new Date(today.getFullYear(), today.getMonth(), today.getDate())
}
function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const typeStyle: Record<string, { bg: string; text: string; label: string }> = {
  internal: { bg: 'var(--ds-type-int-bg)', text: 'var(--ds-type-int-text)', label: 'Internal' },
  external: { bg: 'var(--ds-type-ext-bg)', text: 'var(--ds-type-ext-text)', label: 'External' },
}

type Tab = 'today' | 'upcoming' | 'all' | 'past' | 'cancelled' | 'tentative' | 'series' | 'hcal' | 'special'
type AllSortKey = 'start_at' | 'title' | 'room' | 'status' | 'type'
type AllSortDir = 'asc' | 'desc'

const TAB_META: Record<Tab, { color: string; indicatorColor: string }> = {
  today:     { color: 'text-[var(--ds-text-1)]', indicatorColor: 'var(--ds-text-1)' },
  upcoming:  { color: 'text-[var(--ds-text-1)]', indicatorColor: 'var(--ds-text-1)' },
  all:       { color: 'text-[var(--ds-text-1)]', indicatorColor: 'var(--ds-text-1)' },
  past:      { color: 'text-[var(--ds-text-2)]', indicatorColor: 'var(--ds-text-2)' },
  cancelled: { color: 'text-red-500',      indicatorColor: '#ef4444' },
  tentative: { color: 'text-amber-500',    indicatorColor: '#f59e0b' },
  series:    { color: 'text-blue-500',     indicatorColor: '#3b82f6' },
  hcal:      { color: 'text-violet-500',   indicatorColor: '#7c3aed' },
  special:   { color: 'text-amber-500',    indicatorColor: '#f59e0b' },
}

const PRIMARY_TABS: Tab[] = ['today', 'upcoming', 'all']
const SECONDARY_TABS: Tab[] = ['past', 'cancelled', 'tentative', 'series', 'hcal']

type TabTooltipKey = 'past' | 'cancelled' | 'series' | 'tentative' | 'hcal' | 'special'
const TAB_TOOLTIP_KEY: Partial<Record<Tab, TabTooltipKey>> = {
  past: 'past', cancelled: 'cancelled', series: 'series', tentative: 'tentative', hcal: 'hcal', special: 'special',
}


interface CardSharedProps {
  activeTab: Tab
  pendingCancelIds: Set<number>
  exitingCancelIds: Set<number>
  animate: boolean
  onEdit: (b: Booking) => void
  onCancel: (b: Booking) => void
  onTentativeAction?: (b: Booking) => void
}

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
      className={`rounded-2xl px-5 pt-5 group relative overflow-hidden ${canEdit ? 'pb-12' : 'pb-5'} ${isTentative ? 't-hatch' : ''} ${cardBg} ${canEdit ? 'cursor-pointer hover:-translate-y-0.5 hover:shadow-md' : ''}`}
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
      {canEdit && (
        <>
          <span className={`absolute bottom-3.5 left-5 text-[9px] font-black uppercase tracking-wider flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity ${isConf ? 'text-black/35' : 'text-[var(--ds-text-4)]'}`}>
            <span className="material-symbols-outlined" style={{ fontSize: 12 }}>{isTentative ? 'tune' : 'edit'}</span>
            {isTentative ? 'Click to manage' : 'Click to edit'}
          </span>
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
      ) : <div className="w-[62px] shrink-0" />}
    </div>
  )
}

interface SeriesGroup {
  series_id: string
  bookings: Booking[]
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
}: {
  group: SeriesGroup
  pendingCancelIds: Set<number>
  onEdit: (b: Booking) => void
  onCancel: (b: Booking) => void
  onCancelSeries: (group: SeriesGroup) => void
  onExport: (group: SeriesGroup, format: 'excel' | 'pdf', includePast: boolean) => void
  resolvedSkips: Record<string, Booking>
  index: number
}) {
  const { language } = useSettings()
  const [open, setOpen] = useState(false)
  const [closing, setClosing] = useState(false)
  const closeTimer = useRef<ReturnType<typeof setTimeout>>()
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
              title="Edit series"
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[var(--ds-bg-surface-2)] text-[var(--ds-text-2)] text-[9px] font-black uppercase hover:bg-black hover:text-[#adee2b] transition-all"
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
                  <label className="flex items-center gap-2.5 cursor-pointer mb-4">
                    <input type="checkbox" checked={exportIncludePast} onChange={e => setExportIncludePast(e.target.checked)} className="accent-black w-4 h-4" />
                    <span className="text-[12px] font-bold text-[var(--ds-text-2)] flex-1">Include past dates</span>
                  </label>
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
        const unresolvedCount = skipped.filter(d => !resolvedSkips[`${group.series_id}:${d}`]).length
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
                  <span className="material-symbols-outlined text-red-400" style={{ fontSize: 13 }}>event_busy</span>
                  <span className="text-[9px] font-black uppercase tracking-wider text-red-500">
                    {unresolvedCount > 0 ? `${unresolvedCount} date${unresolvedCount !== 1 ? 's' : ''} skipped — conflict at time of booking` : `${skipped.length} date${skipped.length !== 1 ? 's' : ''} skipped — all rebooked`}
                  </span>
                </div>
                <div className="divide-y divide-red-200/60 dark:divide-red-500/10">
                  {skipped.map(d => {
                    const resolved = resolvedSkips[`${group.series_id}:${d}`]
                    return resolved
                      ? <ResolvedSkipRow key={d} date={d} booking={resolved} />
                      : <SkippedDateRow key={d} date={d} room={first.room} startTime={toHHMM(first.start_at)} endTime={toHHMM(first.end_at)} seriesId={group.series_id} />
                  })}
                </div>
              </div>
            </td>
          </tr>
        )
      })()}
    </tbody>
  )
}

function fmtSkipDate(iso: string) {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
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
        className="text-[9px] font-black text-red-400 hover:text-red-500 underline decoration-dotted underline-offset-2"
      >
        {label}
      </button>
      {open && pos && createPortal(
        <div ref={panelRef} className="fixed z-50 rounded-xl p-2.5 w-64 space-y-1"
          style={{ top: pos.top, left: pos.left, background: 'var(--ds-glass-bg)', backdropFilter: 'blur(32px)', WebkitBackdropFilter: 'blur(32px)', border: '1px solid var(--ds-glass-border)', boxShadow: 'var(--ds-glass-shadow)' }}>
          {items.map((it, i) => (
            <p key={i} className="text-[10px] font-semibold text-[var(--ds-text-2)] leading-snug">{it}</p>
          ))}
        </div>,
        document.body
      )}
    </>
  )
}

function SkippedDateRow({ date, room, startTime, endTime, seriesId }: {
  date: string
  room?: Room
  startTime: string
  endTime: string
  seriesId: string
}) {
  const { language } = useSettings()
  const { data } = useQuery({
    queryKey: ['skip-conflicts', room?.id, date, startTime, endTime],
    queryFn: () => checkAvailability(room!.id, `${date} ${startTime}:00`, `${date} ${endTime}:00`),
    enabled: !!room,
    staleTime: 60_000,
  })
  const conflicts = (data?.conflicts ?? []) as Booking[]
  const shown = conflicts.slice(0, 2)
  const rest = conflicts.slice(2)

  const fmtConflict = (b: Booking) => {
    const dept = b.user?.department_name
    return `${b.title} - ${b.user?.name ?? '—'}${dept ? ` (${dept})` : ''} ${fmtTime(b.start_at, language)}-${fmtTime(b.end_at, language)}`
  }

  return (
    <div className="flex items-start justify-between gap-3 px-3 py-2">
      <div className="flex items-start gap-2 min-w-0">
        <span className="material-symbols-outlined text-red-300 mt-0.5" style={{ fontSize: 12 }}>block</span>
        <div className="min-w-0">
          <span className="text-[11px] font-bold text-red-600 dark:text-red-400 block">{fmtSkipDate(date)}</span>
          {shown.length > 0 && (
            <div className="mt-1 space-y-0.5">
              {shown.map(c => (
                <p key={c.id} className="text-[9px] font-semibold text-red-400/90 dark:text-red-400/80 truncate max-w-[280px]">{fmtConflict(c)}</p>
              ))}
              {rest.length > 0 && <MoreTooltip label={`+${rest.length} more…`} items={rest.map(fmtConflict)} />}
            </div>
          )}
        </div>
      </div>
      <button
        onClick={() => document.dispatchEvent(new CustomEvent('available-rooms-prefill', {
          detail: { date, startTime, endTime, resolveSkip: { seriesId, date } },
        }))}
        className="shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wide transition-all
          bg-[var(--ds-bg-surface)] border border-[var(--ds-border)] text-[var(--ds-text-2)]
          hover:border-[#adee2b] hover:text-[#adee2b] hover:bg-[#adee2b]/5"
      >
        <span className="material-symbols-outlined" style={{ fontSize: 11 }}>search</span>
        Find another slot
      </button>
    </div>
  )
}

function ResolvedSkipRow({ date, booking }: { date: string; booking: Booking }) {
  const { language } = useSettings()
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null)
  const btnRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  function toggleOpen() {
    if (!open) {
      const rect = btnRef.current?.getBoundingClientRect()
      if (rect) setPos({ top: rect.bottom + 6, right: window.innerWidth - rect.right })
    }
    setOpen(o => !o)
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
    <div className="flex items-center justify-between px-3 py-2 bg-green-50 dark:bg-green-500/5">
      <div className="flex items-center gap-2">
        <span className="material-symbols-outlined text-green-500" style={{ fontSize: 13 }}>check_circle</span>
        <span className="text-[11px] font-bold text-green-700 dark:text-green-400">{fmtSkipDate(date)} — rebooked</span>
      </div>
      <button ref={btnRef} onClick={toggleOpen}
        className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wide transition-all
          bg-[var(--ds-bg-surface)] border border-green-300/60 dark:border-green-500/30 text-green-600 dark:text-green-400
          hover:bg-green-500/10"
      >
        <span className="material-symbols-outlined" style={{ fontSize: 11 }}>info</span>
        View booking
      </button>
      {open && pos && createPortal(
        <div ref={panelRef} className="fixed z-50 rounded-xl p-3 w-64 space-y-1"
          style={{ top: pos.top, right: pos.right, background: 'var(--ds-glass-bg)', backdropFilter: 'blur(32px)', WebkitBackdropFilter: 'blur(32px)', border: '1px solid var(--ds-glass-border)', boxShadow: 'var(--ds-glass-shadow)' }}>
          <p className="text-[11px] font-black text-[var(--ds-text-1)]">{booking.title}</p>
          <p className="text-[10px] font-bold text-[var(--ds-text-2)]">{booking.room?.name}{booking.room?.building?.name ? `, ${booking.room.building.name}` : ''}</p>
          <p className="text-[10px] font-semibold text-[var(--ds-text-3)]">{fmtTableDate(booking.start_at, language)} · {fmtTime(booking.start_at, language)}–{fmtTime(booking.end_at, language)}</p>
        </div>,
        document.body
      )}
    </div>
  )
}

const MONTHS_LOWER = ['january','february','march','april','may','june','july','august','september','october','november','december']

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

function toMin(hhmm: string) { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m }

export default function SchedulePage() {
  const { user } = useAuth()
  const { t, language, defaultBuilding } = useSettings()
  const hCalMonths = language === 'id'
    ? ['januari','februari','maret','april','mei','juni','juli','agustus','september','oktober','november','desember']
    : MONTHS_LOWER
  const { start: bhStart, end: bhEnd } = useBookingHours()
  const { saturday: wkSat, sunday: wkSun } = useWeekendSettings()
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState<Tab>('today')
  const [editBooking, setEditBooking] = useState<Booking | null>(null)
  const [panelOpen, setPanelOpen] = useState(false)
  const [panelPrefillDate, setPanelPrefillDate] = useState<string | undefined>(undefined)
  const [cancelTarget, setCancelTarget] = useState<Booking | null>(null)
  const [clearConfirm, setClearConfirm] = useState(false)
  const [viewMode, setViewMode] = useState<'card' | 'list'>('card')
  const [viewAnimKey, setViewAnimKey] = useState(0)
  // Entrance animation only plays on user navigation (tab/view/filter change),
  // never on background poll refetches — prevents the grid "blinking" every 15s.
  const [animateCards, setAnimateCards] = useState(true)
  const [overviewOpen, setOverviewOpen] = useState(false)
  const overviewHideRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const { pendingCancelIds, exitingCancelIds, addCancelToast, addInfoToast, undoCancel, confirmSeriesCancel, undoSeriesCancel } = useCancelToast()
  const [descTooltip, setDescTooltip] = useState<{ text: string; x: number; y: number } | null>(null)
  const [allSortKey, setAllSortKey] = useState<AllSortKey>('start_at')
  const [allSortDir, setAllSortDir] = useState<AllSortDir>('asc')
  const [searchParams, setSearchParams] = useSearchParams()
  const allSearch = searchParams.get('q') ?? ''
  const seriesSearch = searchParams.get('qs') ?? ''
  function setAllSearch(v: string) {
    setSearchParams(p => { v ? p.set('q', v) : p.delete('q'); return p }, { replace: true })
  }
  function setSeriesSearch(v: string) {
    setSearchParams(p => { v ? p.set('qs', v) : p.delete('qs'); return p }, { replace: true })
  }
  const [tentativeTarget, setTentativeTarget] = useState<Booking | null>(null)
  const [tentativeConfirming, setTentativeConfirming] = useState(false)
  const [buildingFilter, setBuildingFilter] = useState<number | null>(defaultBuilding)
  const [seriesCancelTarget, setSeriesCancelTarget] = useState<SeriesGroup | null>(null)
  const [hCalDate, setHCalDate] = useState<string>(() => toDateKey(new Date()))
  const [hCalMonth, setHCalMonth] = useState<{ yr: number; mo: number }>(() => {
    const d = new Date()
    return { yr: d.getFullYear(), mo: d.getMonth() }
  })
  const [hCalTimelineHover, setHCalTimelineHover] = useState<{ bookingId: number; x: number; y: number } | null>(null)
  const [hCalHoverId, setHCalHoverId] = useState<number | null>(null)
  const [hCalCardExpanded, setHCalCardExpanded] = useState<number | null>(null)
  const hCalTodayRef = useRef<HTMLButtonElement>(null)
  const hCalDatesRef = useRef<HTMLDivElement>(null)
  const hCalCardsRef = useRef<HTMLDivElement>(null)
  const [hCalDatesSb, setHCalDatesSb] = useState({ vis: false, left: 0, w: 100 })
  const [hCalCardsSb, setHCalCardsSb] = useState({ vis: false, left: 0, w: 100 })
  const [hCalDatesSbHover, setHCalDatesSbHover] = useState(false)
  const [hCalCardsSbHover, setHCalCardsSbHover] = useState(false)
  const [hCalPastSbHover, setHCalPastSbHover] = useState(false)
  const hCalDatesHideTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hCalCardsHideTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hCalPastHideTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hCalSbDrag = useRef<{ container: HTMLDivElement; startX: number; startScroll: number } | null>(null)
  const hCalPastRef = useRef<HTMLDivElement>(null)
  const [hCalPastSb, setHCalPastSb] = useState({ vis: false, left: 0, w: 100 })

  function calcSb(el: HTMLDivElement) {
    const sc = el.scrollWidth - el.clientWidth
    if (sc <= 0) return null
    const w = (el.clientWidth / el.scrollWidth) * 100
    const left = (el.scrollLeft / sc) * (100 - w)
    return { vis: true, left, w }
  }
  function showDatesSb() {
    const el = hCalDatesRef.current; if (!el) return
    const s = calcSb(el); if (!s) return
    if (hCalDatesHideTimer.current) clearTimeout(hCalDatesHideTimer.current)
    setHCalDatesSb(s)
  }
  function hideDatesSb(delay = 1300) {
    if (hCalDatesHideTimer.current) clearTimeout(hCalDatesHideTimer.current)
    hCalDatesHideTimer.current = setTimeout(() => setHCalDatesSb(s => ({ ...s, vis: false })), delay)
  }
  function showCardsSb() {
    const el = hCalCardsRef.current; if (!el) return
    const s = calcSb(el); if (!s) return
    if (hCalCardsHideTimer.current) clearTimeout(hCalCardsHideTimer.current)
    setHCalCardsSb(s)
  }
  function hideCardsSb(delay = 1300) {
    if (hCalCardsHideTimer.current) clearTimeout(hCalCardsHideTimer.current)
    hCalCardsHideTimer.current = setTimeout(() => setHCalCardsSb(s => ({ ...s, vis: false })), delay)
  }
  function showPastSb() {
    const el = hCalPastRef.current; if (!el) return
    const s = calcSb(el); if (!s) return
    if (hCalPastHideTimer.current) clearTimeout(hCalPastHideTimer.current)
    setHCalPastSb(s)
  }
  function hidePastSb(delay = 1300) {
    if (hCalPastHideTimer.current) clearTimeout(hCalPastHideTimer.current)
    hCalPastHideTimer.current = setTimeout(() => setHCalPastSb(s => ({ ...s, vis: false })), delay)
  }

  function toggleAllSort(key: AllSortKey) {
    if (allSortKey === key) setAllSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setAllSortKey(key); setAllSortDir('desc') }
  }

  const tabRefs = useRef<(HTMLButtonElement | null)[]>([])
  const [indicator, setIndicator] = useState({ left: 0, width: 0 })

  const { data: generalSettings } = useQuery({
    queryKey: ['settings-general'],
    queryFn: getGeneralSettings,
    staleTime: 60_000,
  })

  const { data: myBookings = [], isLoading } = useQuery({
    queryKey: ['my-bookings'],
    queryFn: getMyBookings,
    staleTime: 10_000,
    placeholderData: keepPreviousData,
  })

  const { data: allMyBookings = [], isLoading: loadingAll } = useQuery({
    queryKey: ['all-my-bookings', user?.id],
    queryFn: () => getBookings({ user_id: user?.id }),
    enabled: !!user?.id,
    staleTime: 10_000,
    placeholderData: keepPreviousData,
  })

  const isReceptionist = user?.role === 'receptionist'
  const { data: specialBookings = [], isLoading: loadingSpecial } = useQuery({
    queryKey: ['special-bookings'],
    queryFn: () => getBookings({ special_rooms: true, date_from: toDateStr(past90), date_to: toDateStr(future90) }),
    enabled: isReceptionist,
    staleTime: 10_000,
    placeholderData: keepPreviousData,
  })
  const [spShowPast, setSpShowPast]           = useState(true)
  const [spShowCancelled, setSpShowCancelled] = useState(false)
  const [spExportOpen, setSpExportOpen]       = useState<'excel' | 'pdf' | null>(null)
  const [spExportGroups, setSpExportGroups]   = useState({ active: true, past: true, cancelled: false })
  const [spSortCol, setSpSortCol]             = useState<string | null>(null)
  const [spSortDir, setSpSortDir]             = useState<'asc' | 'desc'>('asc')
  const spExportRef = useRef<HTMLDivElement>(null)

  const [allExportOpen, setAllExportOpen]     = useState(false)
  const [allExportGroups, setAllExportGroups] = useState({ upcoming: true, past: true, cancelled: false })
  const allExportRef = useRef<HTMLDivElement>(null)

  const [seriesExportOpen, setSeriesExportOpen]           = useState(false)
  const [seriesIncludePastAll, setSeriesIncludePastAll]   = useState(false)
  const seriesExportRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!spExportOpen) return
    const fn = (e: MouseEvent) => { if (spExportRef.current && !spExportRef.current.contains(e.target as Node)) setSpExportOpen(null) }
    document.addEventListener('mousedown', fn)
    return () => document.removeEventListener('mousedown', fn)
  }, [spExportOpen])

  useEffect(() => {
    if (!allExportOpen) return
    const fn = (e: MouseEvent) => { if (allExportRef.current && !allExportRef.current.contains(e.target as Node)) setAllExportOpen(false) }
    document.addEventListener('mousedown', fn)
    return () => document.removeEventListener('mousedown', fn)
  }, [allExportOpen])

  useEffect(() => {
    if (!seriesExportOpen) return
    const fn = (e: MouseEvent) => { if (seriesExportRef.current && !seriesExportRef.current.contains(e.target as Node)) setSeriesExportOpen(false) }
    document.addEventListener('mousedown', fn)
    return () => document.removeEventListener('mousedown', fn)
  }, [seriesExportOpen])

  // Skipped-date resolution: "Find another slot" → booked elsewhere → row turns green + counts toward series export
  const [resolvedSkips, setResolvedSkips] = useState<Record<string, Booking>>({})
  useEffect(() => {
    const fn = (e: Event) => {
      const { seriesId, date, booking } = (e as CustomEvent<{ seriesId: string; date: string; booking: Booking }>).detail
      setResolvedSkips(prev => ({ ...prev, [`${seriesId}:${date}`]: booking }))
    }
    document.addEventListener('series-skip-resolved', fn)
    return () => document.removeEventListener('series-skip-resolved', fn)
  }, [])

  function resolvedSkipsForSeries(seriesId: string): Booking[] {
    const prefix = `${seriesId}:`
    return Object.entries(resolvedSkips).filter(([k]) => k.startsWith(prefix)).map(([, b]) => b)
  }

  // Global search: open booking edit panel when triggered from navbar search
  useEffect(() => {
    const fn = (e: Event) => {
      const booking = (e as CustomEvent<Booking>).detail
      setEditBooking(booking)
      setPanelOpen(true)
    }
    document.addEventListener('open-booking-edit', fn)
    return () => document.removeEventListener('open-booking-edit', fn)
  }, [])

  const today = new Date()
  const minus7 = new Date(today); minus7.setDate(today.getDate() - 7)
  const plus7 = new Date(today); plus7.setDate(today.getDate() + 7)
  const past30 = new Date(today); past30.setDate(today.getDate() - 30)
  const archiveAfterDays = generalSettings?.archive_after_days ?? 30
  const archiveCutoff = new Date(today); archiveCutoff.setDate(today.getDate() - archiveAfterDays)
  const past90 = new Date(today); past90.setDate(today.getDate() - 90)
  const future90 = new Date(today); future90.setDate(today.getDate() + 90)
  const toDateStr = (d: Date) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`

  const todayList: Booking[]     = myBookings.filter((b: Booking) => parseLocal(b.start_at).toDateString() === today.toDateString())
  const now = new Date()
  // Cancelled bookings always go to past; never show as active even if end_at is still future
  const todayActiveList: Booking[] = todayList.filter((b: Booking) => b.status !== 'cancelled' && parseLocal(b.end_at) >= now)
  const todayPastList: Booking[]   = todayList.filter((b: Booking) => b.status === 'cancelled' || parseLocal(b.end_at) < now)
  const upcomingList: Booking[]  = myBookings.filter((b: Booking) => b.status !== 'cancelled' && parseLocal(b.start_at) > today)
  const allList: Booking[] = useMemo(() => {
    const upcoming = myBookings.filter((b: Booking) => b.status !== 'cancelled' && !isActuallyPast(b))
    const past = myBookings.filter((b: Booking) => b.status !== 'cancelled' && isActuallyPast(b))
    function sortFn(a: Booking, b: Booking) {
      if (allSortKey === 'start_at') return allSortDir === 'desc'
        ? parseLocal(b.start_at).getTime() - parseLocal(a.start_at).getTime()
        : parseLocal(a.start_at).getTime() - parseLocal(b.start_at).getTime()
      let va = '', vb = ''
      if (allSortKey === 'title') { va = a.title; vb = b.title }
      else if (allSortKey === 'room') { va = a.room?.name ?? ''; vb = b.room?.name ?? '' }
      else if (allSortKey === 'status') { va = a.status; vb = b.status }
      else if (allSortKey === 'type') { va = a.type; vb = b.type }
      return allSortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va)
    }
    return [...upcoming.sort(sortFn), ...past.sort(sortFn)]
  }, [myBookings, allSortKey, allSortDir])
  const pastList: Booking[]      = myBookings.filter((b: Booking) => {
    const ended = parseLocal(b.end_at) < new Date()
    return b.status !== 'cancelled' && ended && parseLocal(b.start_at) >= past30
  }).sort((a: Booking, b: Booking) => parseLocal(b.start_at).getTime() - parseLocal(a.start_at).getTime())
  const cancelledList: Booking[] = (allMyBookings as Booking[]).filter((b: Booking) => b.status === 'cancelled' && b.cancelled_at && parseLocal(b.cancelled_at) >= minus7).sort((a: Booking, b: Booking) => parseLocal(b.start_at).getTime() - parseLocal(a.start_at).getTime())
  const tentativeList: Booking[] = myBookings.filter((b: Booking) => b.status === 'tentative' && parseLocal(b.end_at) >= new Date()).sort((a: Booking, b: Booking) => parseLocal(a.start_at).getTime() - parseLocal(b.start_at).getTime())

  const seriesList = useMemo((): SeriesGroup[] => {
    const map = new Map<string, Booking[]>()
    myBookings.forEach((b: Booking) => {
      if (!b.series_id) return
      if (!map.has(b.series_id)) map.set(b.series_id, [])
      map.get(b.series_id)!.push(b)
    })
    return Array.from(map.entries())
      .map(([sid, bookings]) => ({
        series_id: sid,
        bookings: [...bookings].sort((a, b) => parseLocal(a.start_at).getTime() - parseLocal(b.start_at).getTime()),
      }))
      .filter(g => {
        const last = g.bookings[g.bookings.length - 1]
        return parseLocal(last.start_at) >= archiveCutoff
      })
      .sort((a, b) => parseLocal(a.bookings[0].start_at).getTime() - parseLocal(b.bookings[0].start_at).getTime())
  }, [myBookings, archiveCutoff])

  const hCalMonthStart = new Date(today.getFullYear(), 0, 1)
  const hCalMonthEnd   = new Date(today.getFullYear(), 11, 31)
  const hCalBookingMap = useMemo(() => {
    const map = new Map<string, Booking[]>()
    myBookings.forEach((b: Booking) => {
      if (b.status === 'cancelled') return
      const d = parseLocal(b.start_at)
      if (d < hCalMonthStart || d > hCalMonthEnd) return
      const key = toDateKey(d)
      map.set(key, [...(map.get(key) ?? []), b])
    })
    return map
  }, [myBookings])

  const thisMonthCount = myBookings.filter((b: Booking) => {
    const d = parseLocal(b.start_at)
    return d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear()
  }).length

  const totalHours = myBookings.filter((b: Booking) => {
    const d = parseLocal(b.start_at)
    return d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear()
  }).reduce((acc: number, b: Booking) =>
    acc + (parseLocal(b.end_at).getTime() - parseLocal(b.start_at).getTime()) / 3600000, 0
  )

  const tabCounts: Record<Tab, number> = {
    today: todayList.length, upcoming: upcomingList.length, all: todayList.length + upcomingList.length,
    past: pastList.length, cancelled: cancelledList.length, tentative: tentativeList.length,
    series: seriesList.length, hcal: 0, special: (specialBookings as Booking[]).length,
  }

  const tabLabels: Record<Tab, string> = {
    today: t('tab_today'), upcoming: t('tab_upcoming'), all: t('tab_all'),
    past: t('tab_past'), cancelled: t('tab_cancelled'), tentative: t('tab_tentative'),
    series: t('tab_series'), hcal: t('tab_hcal'), special: t('tab_special'),
  }

  const visibleSecondaryTabs: Tab[] = [...SECONDARY_TABS, ...(isReceptionist ? ['special' as Tab] : [])]
  const allTabsOrdered: Tab[] = [...PRIMARY_TABS, ...visibleSecondaryTabs]

  useEffect(() => {
    const idx = allTabsOrdered.indexOf(activeTab)
    const el = tabRefs.current[idx]
    if (el) setIndicator({ left: el.offsetLeft, width: el.offsetWidth })
  }, [activeTab])

  useEffect(() => {
    if (activeTab === 'hcal') {
      setTimeout(() => {
        hCalTodayRef.current?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
      }, 50)
    }
  }, [activeTab])

  useEffect(() => {
    if (activeTab !== 'hcal') return
    const dates = hCalDatesRef.current
    const cards = hCalCardsRef.current

    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      ;(e.currentTarget as HTMLElement).scrollBy({ left: e.deltaY, behavior: 'smooth' })
    }

    const addDragScroll = (el: HTMLDivElement) => {
      let isDragging = false, startX = 0, scrollLeft = 0
      const onMouseDown = (e: MouseEvent) => {
        isDragging = true; startX = e.pageX - el.offsetLeft; scrollLeft = el.scrollLeft
        el.classList.add('is-dragging')
      }
      const onMouseUp = () => { isDragging = false; el.classList.remove('is-dragging') }
      const onMouseLeave = () => { if (isDragging) { isDragging = false; el.classList.remove('is-dragging') } }
      const onMouseMove = (e: MouseEvent) => {
        if (!isDragging) return
        e.preventDefault()
        el.scrollLeft = scrollLeft - (e.pageX - el.offsetLeft - startX)
      }
      el.addEventListener('mousedown', onMouseDown)
      el.addEventListener('mouseup', onMouseUp)
      el.addEventListener('mouseleave', onMouseLeave)
      el.addEventListener('mousemove', onMouseMove)
      return () => {
        el.removeEventListener('mousedown', onMouseDown)
        el.removeEventListener('mouseup', onMouseUp)
        el.removeEventListener('mouseleave', onMouseLeave)
        el.removeEventListener('mousemove', onMouseMove)
      }
    }

    const past = hCalPastRef.current

    dates?.addEventListener('wheel', onWheel, { passive: false })
    cards?.addEventListener('wheel', onWheel, { passive: false })
    past?.addEventListener('wheel', onWheel, { passive: false })
    const cleanupDates = dates ? addDragScroll(dates) : undefined
    const cleanupCards = cards ? addDragScroll(cards) : undefined
    const cleanupPast = past ? addDragScroll(past) : undefined

    return () => {
      dates?.removeEventListener('wheel', onWheel)
      cards?.removeEventListener('wheel', onWheel)
      past?.removeEventListener('wheel', onWheel)
      cleanupDates?.()
      cleanupCards?.()
      cleanupPast?.()
    }
  }, [activeTab])

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const drag = hCalSbDrag.current; if (!drag) return
      const el = drag.container
      const sc = el.scrollWidth - el.clientWidth; if (sc <= 0) return
      const thumbFraction = el.clientWidth / el.scrollWidth
      const moveable = el.clientWidth * (1 - thumbFraction)
      if (moveable <= 0) return
      el.scrollLeft = Math.max(0, Math.min(sc, drag.startScroll + ((e.clientX - drag.startX) / moveable) * sc))
    }
    const onUp = () => { hCalSbDrag.current = null }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
    return () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
  }, [])

  function handleCancel(b: Booking) {
    setCancelTarget(b)
  }

  function confirmCancel() {
    if (!cancelTarget) return
    const booking = cancelTarget
    setCancelTarget(null)
    addCancelToast(booking)
  }

  async function handleTentativeAction(action: 'confirm' | 'cancel') {
    if (!tentativeTarget) return
    const booking = tentativeTarget
    setTentativeTarget(null)
    setTentativeConfirming(true)
    try {
      if (action === 'confirm') await updateBooking(booking.id, { status: 'confirmed' })
      else if (action === 'cancel') addCancelToast(booking)
      queryClient.invalidateQueries({ queryKey: ['my-bookings'] })
      queryClient.invalidateQueries({ queryKey: ['all-my-bookings', user?.id] })
      queryClient.invalidateQueries({ queryKey: ['bookings'] })
      queryClient.refetchQueries({ queryKey: ['special-bookings'] })
    } finally { setTentativeConfirming(false) }
  }

  function doConfirmSeriesCancel() {
    if (!seriesCancelTarget) return
    const target = seriesCancelTarget
    setSeriesCancelTarget(null)
    confirmSeriesCancel(target)
  }

  async function doClearCancelled() {
    setClearConfirm(false)
    await clearCancelledBookings()
    queryClient.invalidateQueries({ queryKey: ['my-bookings'] })
    queryClient.invalidateQueries({ queryKey: ['all-my-bookings', user?.id] })
    queryClient.invalidateQueries({ queryKey: ['bookings'] })
    addInfoToast('Cancelled bookings cleared')
  }

  const upcomingInAll = allList.filter((b: Booking) => !isActuallyPast(b))
  const pastInAll     = allList.filter((b: Booking) => isActuallyPast(b))
  const pastPreview   = pastInAll.slice(0, 5)
  const allListForDisplay = [...upcomingInAll, ...pastPreview]
  const allExportRows = [
    ...(allExportGroups.upcoming ? upcomingInAll : []),
    ...(allExportGroups.past ? pastInAll : []),
    ...(allExportGroups.cancelled ? cancelledList : []),
  ]
  const allListFiltered = useMemo(() => {
    let list = allListForDisplay
    if (buildingFilter) list = list.filter((b: Booking) => b.room?.building_id === buildingFilter)
    if (!allSearch.trim()) return list
    const q = allSearch.toLowerCase()
    return list.filter((b: Booking) =>
      b.title.toLowerCase().includes(q) ||
      b.room?.name?.toLowerCase().includes(q) ||
      b.description?.toLowerCase().includes(q) ||
      b.type.toLowerCase().includes(q) ||
      b.status.toLowerCase().includes(q)
    )
  }, [allListForDisplay, allSearch, buildingFilter])

  interface AllExportCounts { upcoming: number | null; past: number | null; cancelled: number | null }

  function exportAllExcel(rows: Booking[], counts: AllExportCounts) {
    const exportedAt = today.toLocaleDateString('en-GB')
    const summaryParts = [
      counts.upcoming != null ? `Upcoming & Today: ${counts.upcoming}` : null,
      counts.past      != null ? `Past: ${counts.past}`               : null,
      counts.cancelled != null ? `Cancelled: ${counts.cancelled}`     : null,
    ].filter(Boolean).join('   |   ')

    const headers = ['No.', 'Date', 'Day', 'Start Time', 'End Time', 'Duration', 'Room', 'Building', 'Floor', 'Title', 'Description', 'Booked For', 'Status', 'Type']
    const aoa: (string | number)[][] = [
      [`My Bookings — ${user?.name ?? ''}`],
      [`${user?.department ?? ''}   ·   Exported ${exportedAt}   ·   Total: ${rows.length}`],
      [summaryParts],
      [],
      headers,
      ...rows.map((b: Booking, i: number) => [
        i + 1,
        fmtTableDate(b.start_at, language), fmtTableDay(b.start_at, language),
        fmtTime(b.start_at, language), fmtTime(b.end_at, language),
        dur(b.start_at, b.end_at), b.room?.name ?? '',
        b.room?.building?.code || b.room?.building?.name || '',
        b.room?.floor ?? '', b.title,
        b.description ?? '', b.booked_for ?? '',
        b.status, b.type,
      ]),
    ]
    const ws = XLSX.utils.aoa_to_sheet(aoa)
    ws['!cols'] = [{ wch: 8 }, { wch: 12 }, { wch: 6 }, { wch: 10 }, { wch: 10 }, { wch: 8 }, { wch: 20 }, { wch: 12 }, { wch: 6 }, { wch: 28 }, { wch: 24 }, { wch: 18 }, { wch: 10 }, { wch: 12 }]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'My Bookings')
    XLSX.writeFile(wb, `my-bookings-${user?.name?.replace(' ', '-').toLowerCase()}.xlsx`)
  }

  function exportAllPDF(rows: Booking[], counts: AllExportCounts) {
    const doc = new jsPDF()
    doc.setFontSize(14); doc.text(`My Bookings — ${user?.name}`, 14, 16)
    doc.setFontSize(9); doc.setTextColor(150)
    doc.text(`${user?.department ?? ''}   ·   Exported ${today.toLocaleDateString('en-GB')}   ·   Total: ${rows.length}`, 14, 22)
    const summaryParts = [
      counts.upcoming != null ? `Upcoming & Today: ${counts.upcoming}` : null,
      counts.past      != null ? `Past: ${counts.past}`               : null,
      counts.cancelled != null ? `Cancelled: ${counts.cancelled}`     : null,
    ].filter(Boolean).join('   |   ')
    doc.setFontSize(8); doc.setTextColor(120)
    doc.text(summaryParts, 14, 28)
    autoTable(doc, {
      startY: 34,
      head: [['No.', 'Date', 'Day', 'Time', 'Room', 'Title', 'For', 'Status']],
      body: rows.map((b: Booking, i: number) => [
        i + 1,
        fmtTableDate(b.start_at, language), fmtTableDay(b.start_at, language),
        `${fmtTime(b.start_at, language)} – ${fmtTime(b.end_at, language)}`,
        b.room?.name ?? '', b.title, b.booked_for ?? '', b.status,
      ]),
      styles: { fontSize: 8, cellPadding: 3 },
      headStyles: { fillColor: [0, 0, 0], textColor: [173, 238, 43], fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: { 0: { cellWidth: 12, halign: 'center' } },
    })
    doc.save(`my-bookings-${user?.name?.replace(' ', '-').toLowerCase()}.pdf`)
  }

  interface SpExportCounts { active: number | null; past: number | null; cancelled: number | null }

  function exportSpecialExcel(rows: Booking[], counts: SpExportCounts) {
    const exportedAt = today.toLocaleDateString('en-GB')
    const summaryParts = [
      counts.active    != null ? `Upcoming & Today: ${counts.active}`  : null,
      counts.past      != null ? `Past: ${counts.past}`                : null,
      counts.cancelled != null ? `Cancelled: ${counts.cancelled}`      : null,
    ].filter(Boolean).join('   |   ')

    const headers = ['No.', 'Date', 'Day', 'Start Time', 'End Time', 'Duration', 'Room', 'Building', 'Booker', 'Role', 'Department', 'Title', 'Description', 'Booked For', 'Status', 'Type']
    const aoa: (string | number)[][] = [
      ['Special Room Bookings'],
      [`±90 days   ·   Exported ${exportedAt}   ·   Total: ${rows.length}`],
      [summaryParts],
      [],
      headers,
      ...rows.map((b: Booking, i: number) => [
        i + 1,
        fmtTableDate(b.start_at, language), fmtTableDay(b.start_at, language),
        fmtTime(b.start_at, language), fmtTime(b.end_at, language),
        dur(b.start_at, b.end_at), b.room?.name ?? '',
        b.room?.building?.code || b.room?.building?.name || '',
        b.user?.name ?? '', b.user?.role ?? '', b.user?.department_name ?? '',
        b.title, b.description ?? '', b.booked_for ?? '', b.status, b.type,
      ]),
    ]
    const ws = XLSX.utils.aoa_to_sheet(aoa)
    ws['!cols'] = [{ wch: 8 }, { wch: 12 }, { wch: 6 }, { wch: 10 }, { wch: 10 }, { wch: 8 }, { wch: 20 }, { wch: 12 }, { wch: 20 }, { wch: 10 }, { wch: 16 }, { wch: 28 }, { wch: 24 }, { wch: 18 }, { wch: 10 }, { wch: 12 }]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Special Room Bookings')
    XLSX.writeFile(wb, `special-room-bookings-${toDateStr(today)}.xlsx`)
  }

  function exportSpecialPDF(rows: Booking[], counts: SpExportCounts) {
    const doc = new jsPDF({ orientation: 'landscape' })
    doc.setFontSize(14); doc.text('Special Room Bookings', 14, 16)
    doc.setFontSize(9); doc.setTextColor(150)
    doc.text(`±90 days   ·   Exported ${today.toLocaleDateString('en-GB')}   ·   Total: ${rows.length}`, 14, 22)
    const summaryParts = [
      counts.active    != null ? `Upcoming & Today: ${counts.active}`  : null,
      counts.past      != null ? `Past: ${counts.past}`                : null,
      counts.cancelled != null ? `Cancelled: ${counts.cancelled}`      : null,
    ].filter(Boolean).join('   |   ')
    doc.setFontSize(8); doc.setTextColor(120)
    doc.text(summaryParts, 14, 28)
    autoTable(doc, {
      startY: 34,
      head: [['No.', 'Date', 'Time', 'Room', 'Building', 'Booker', 'Role', 'Dept', 'Title', 'For', 'Status']],
      body: rows.map((b: Booking, i: number) => [
        i + 1,
        fmtTableDate(b.start_at, language),
        `${fmtTime(b.start_at, language)} – ${fmtTime(b.end_at, language)}`,
        b.room?.name ?? '',
        b.room?.building?.code || b.room?.building?.name || '',
        b.user?.name ?? '', b.user?.role ?? '', b.user?.department_name ?? '',
        b.title, b.booked_for ?? '', b.status,
      ]),
      styles: { fontSize: 7.5, cellPadding: 2.5 },
      headStyles: { fillColor: [245, 158, 11], textColor: [255, 255, 255], fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [255, 251, 235] },
      columnStyles: { 0: { cellWidth: 12, halign: 'center' } },
    })
    doc.save(`special-room-bookings-${toDateStr(today)}.pdf`)
  }

  function seriesExportRows(bookings: Booking[], includePast: boolean): Booking[] {
    return includePast ? bookings : bookings.filter(b => !isActuallyPast(b))
  }

  function exportSeriesExcel(rows: Booking[], label: string, includePast: boolean, fileSlug: string) {
    const exportedAt = today.toLocaleDateString('en-GB')
    const headers = ['No.', 'Date', 'Day', 'Start Time', 'End Time', 'Duration', 'Room', 'Building', 'Title', 'Description', 'Booked For', 'Status', 'Type']
    const aoa: (string | number)[][] = [
      [label],
      [`${includePast ? 'All dates' : 'Upcoming dates only'}   ·   Exported ${exportedAt}   ·   Total: ${rows.length}`],
      [],
      headers,
      ...rows.map((b: Booking, i: number) => [
        i + 1,
        fmtTableDate(b.start_at, language), fmtTableDay(b.start_at, language),
        fmtTime(b.start_at, language), fmtTime(b.end_at, language),
        dur(b.start_at, b.end_at), b.room?.name ?? '',
        b.room?.building?.code || b.room?.building?.name || '',
        b.title, b.description ?? '', b.booked_for ?? '',
        b.status, b.type,
      ]),
    ]
    const ws = XLSX.utils.aoa_to_sheet(aoa)
    ws['!cols'] = [{ wch: 8 }, { wch: 12 }, { wch: 6 }, { wch: 10 }, { wch: 10 }, { wch: 8 }, { wch: 20 }, { wch: 12 }, { wch: 28 }, { wch: 24 }, { wch: 18 }, { wch: 10 }, { wch: 12 }]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Series')
    XLSX.writeFile(wb, `${fileSlug}.xlsx`)
  }

  function exportSeriesPDF(rows: Booking[], label: string, includePast: boolean, fileSlug: string) {
    const doc = new jsPDF()
    doc.setFontSize(14); doc.text(label, 14, 16)
    doc.setFontSize(9); doc.setTextColor(150)
    doc.text(`${includePast ? 'All dates' : 'Upcoming dates only'}   ·   Exported ${today.toLocaleDateString('en-GB')}   ·   Total: ${rows.length}`, 14, 22)
    autoTable(doc, {
      startY: 30,
      head: [['No.', 'Date', 'Day', 'Time', 'Room', 'Title', 'For', 'Status']],
      body: rows.map((b: Booking, i: number) => [
        i + 1,
        fmtTableDate(b.start_at, language), fmtTableDay(b.start_at, language),
        `${fmtTime(b.start_at, language)} – ${fmtTime(b.end_at, language)}`,
        b.room?.name ?? '', b.title, b.booked_for ?? '', b.status,
      ]),
      styles: { fontSize: 8, cellPadding: 3 },
      headStyles: { fillColor: [0, 0, 0], textColor: [173, 238, 43], fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: { 0: { cellWidth: 12, halign: 'center' } },
    })
    doc.save(`${fileSlug}.pdf`)
  }

  function handleExportSeriesRow(group: SeriesGroup, format: 'excel' | 'pdf', includePast: boolean) {
    const first = group.bookings[0]
    const rebooked = seriesExportRows(resolvedSkipsForSeries(group.series_id), includePast)
    const rows = [...seriesExportRows(group.bookings, includePast), ...rebooked]
    const label = `${first.title} — ${first.room?.name ?? ''}`
    const slug = `series-${first.title.replace(/\s+/g, '-').toLowerCase()}-${toDateStr(parseLocal(first.start_at))}`
    if (format === 'excel') exportSeriesExcel(rows, label, includePast, slug)
    else exportSeriesPDF(rows, label, includePast, slug)
  }

  function getActiveList(): Booking[] {
    if (activeTab === 'today') return todayActiveList
    if (activeTab === 'upcoming') return upcomingList
    if (activeTab === 'all') return allList
    if (activeTab === 'past') return pastList
    if (activeTab === 'cancelled') return cancelledList
    if (activeTab === 'series') return myBookings.filter((b: Booking) => !!b.series_id)
    if (activeTab === 'hcal') return []
    if (activeTab === 'special') return specialBookings as Booking[]
    return tentativeList
  }

  const activeList = getActiveList()

  const buildingsInView = useMemo(() => {
    const seen = new Map<number, { name: string; code?: string; locationName?: string; address?: string }>()
    ;(myBookings as Booking[]).forEach((b: Booking) => {
      const bid = b.room?.building_id
      const bld = b.room?.building
      if (bid && bld?.name) seen.set(bid, { name: bld.name, code: bld.code, locationName: (bld as any).location?.name, address: bld.address })
    })
    return Array.from(seen.entries()).map(([id, bld]) => ({ id, ...bld }))
  }, [myBookings])

  const buildingCounts = useMemo(() => {
    const counts = new Map<number, number>()
    activeList.forEach((b: Booking) => {
      const bid = b.room?.building_id
      if (bid) counts.set(bid, (counts.get(bid) ?? 0) + 1)
    })
    return counts
  }, [activeList])

  useEffect(() => { setBuildingFilter(defaultBuilding) }, [activeTab])

  // Replay entrance animation only when the user navigates (tab / view / building filter),
  // then switch it off so background poll refetches don't re-trigger it.
  useEffect(() => {
    setAnimateCards(true)
    const id = setTimeout(() => setAnimateCards(false), 1200)
    return () => clearTimeout(id)
  }, [activeTab, viewMode, buildingFilter])

  const displayList = buildingFilter
    ? activeList.filter((b: Booking) => b.room?.building_id === buildingFilter)
    : activeList

  const displaySeriesList = useMemo(() => {
    const base = buildingFilter
      ? seriesList.filter(g => g.bookings.some(b => b.room?.building_id === buildingFilter))
      : seriesList
    if (!seriesSearch.trim()) return base
    const q = seriesSearch.toLowerCase()
    return base.filter(g => {
      const first = g.bookings[0]
      return (
        first.title?.toLowerCase().includes(q) ||
        first.room?.name?.toLowerCase().includes(q) ||
        first.room?.building?.name?.toLowerCase().includes(q) ||
        first.room?.building?.code?.toLowerCase().includes(q)
      )
    })
  }, [seriesList, buildingFilter, seriesSearch])

  // A series is "past" once every occurrence in it has ended — grouped separately below the active ones.
  // Fully-past series disappear entirely once their last occurrence crosses the admin's Archive-after-N-days
  // setting (handled by the archiveCutoff filter on seriesList above).
  const activeSeriesList = displaySeriesList.filter(g => g.bookings.some(b => parseLocal(b.end_at) >= now))
  const pastSeriesList   = displaySeriesList.filter(g => g.bookings.every(b => parseLocal(b.end_at) < now))

  const grouped = groupByDate(displayList)
  const meta = TAB_META[activeTab]
  const isSecondary = visibleSecondaryTabs.includes(activeTab)

  const cardSharedProps: CardSharedProps = {
    activeTab,
    pendingCancelIds,
    exitingCancelIds,
    animate: animateCards,
    onEdit: (b) => { setEditBooking(b); setPanelOpen(true) },
    onCancel: handleCancel,
    onTentativeAction: (b) => setTentativeTarget(b),
  }

  return (
    <div className="flex flex-col flex-1 overflow-hidden" style={{ background: 'var(--ds-bg-surface)' }}>
      <style>{`
        @keyframes card-in{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
        .t-hatch{background-image:repeating-linear-gradient(45deg,transparent,transparent 5px,rgba(0,0,0,0.025) 5px,rgba(0,0,0,0.025) 10px)}
        .dark .t-hatch{background-image:repeating-linear-gradient(45deg,transparent,transparent 5px,rgba(255,255,255,0.04) 5px,rgba(255,255,255,0.04) 10px)}
        .t-badge-hatch{background-image:repeating-linear-gradient(45deg,transparent,transparent 3px,rgba(0,0,0,0.05) 3px,rgba(0,0,0,0.05) 6px)}
        .dark .t-badge-hatch{background-image:repeating-linear-gradient(45deg,transparent,transparent 3px,rgba(255,255,255,0.08) 3px,rgba(255,255,255,0.08) 6px)}
      `}</style>

      {/* Top header */}
      <div className="px-8 pt-6 shrink-0" style={{ background: 'var(--ds-bg-surface)', borderBottom: '1px solid var(--ds-border-sub)' }}>
        <div className="flex items-start justify-between mb-5">
          <div>
            <h2 className="text-3xl font-black tracking-tighter uppercase leading-none" style={{ color: 'var(--ds-text-1)' }}>{user?.name}</h2>
            <p className="text-sm font-bold mt-1.5 capitalize" style={{ color: 'var(--ds-text-3)' }}>
              {user?.role}{user?.department ? <> &middot; {user.department}</> : ''}{user?.ext ? <> &middot; Ext. {user.ext}</> : ''}
            </p>
          </div>
          {user?.role !== 'guest' && (
            <button
              onClick={() => { setEditBooking(null); setPanelOpen(true) }}
              className="flex items-center gap-1.5 px-3 sm:px-5 py-2.5 rounded-xl text-[10px] font-black uppercase shadow-lg shadow-lime-300/30 transition-all duration-200 bg-[#adee2b] text-black hover:bg-black hover:text-[#adee2b]"
            >
              <span className="material-symbols-outlined text-base">add</span>
              <span className="hidden sm:inline">New Booking</span>
            </button>
          )}
        </div>

        {/* Tabs */}
        <div className="relative flex items-end">
          {/* Primary tabs */}
          <div className="flex items-end gap-6">
            {PRIMARY_TABS.map((key, i) => (
              <button key={key} ref={el => { tabRefs.current[i] = el }}
                onClick={() => setActiveTab(key)}
                className="flex items-center gap-2 pb-3 text-[13px] font-black uppercase tracking-wide transition-colors duration-200"
                style={{ color: activeTab === key ? 'var(--ds-text-1)' : 'var(--ds-text-3)' }}>
                {tabLabels[key]}
                {tabCounts[key] > 0 && (
                  <span className="text-[9px] font-black px-2 py-0.5 rounded-full transition-colors"
                    style={{ background: activeTab === key ? 'var(--ds-text-1)' : 'var(--ds-bg-raised)', color: activeTab === key ? 'var(--ds-bg-surface)' : 'var(--ds-text-3)' }}>
                    {tabCounts[key]}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Divider */}
          <div className="mx-5 mb-3 w-px h-4 bg-[var(--ds-border)] self-end" />

          {/* Secondary tabs */}
          <div className="flex items-end gap-5">
            {visibleSecondaryTabs.map((key, i) => {
              const m = TAB_META[key]
              const tabTipKey = TAB_TOOLTIP_KEY[key]
              const tabTip = tabTipKey ? t(`tooltip_${tabTipKey}` as Parameters<typeof t>[0]) : undefined
              return (
                <button key={key} ref={el => { tabRefs.current[PRIMARY_TABS.length + i] = el }}
                  onClick={() => setActiveTab(key)}
                  className={`relative group/stab flex items-center gap-2 pb-3 text-[12px] font-black uppercase tracking-wide transition-colors duration-200
                    ${activeTab === key ? m.color : 'text-[var(--ds-text-3)] hover:text-[var(--ds-text-2)]'}`}>
                  {tabLabels[key]}
                  {tabCounts[key] > 0 && (
                    <span className={`text-[9px] font-black px-2 py-0.5 rounded-full transition-colors
                      ${activeTab === key
                        ? key === 'cancelled' ? 'bg-red-100 dark:bg-red-900/40 text-red-500 dark:text-red-400'
                          : key === 'tentative' ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400'
                          : 'bg-[var(--ds-bg-surface-2)] dark:ring-1 dark:ring-white/10 text-[var(--ds-text-2)]'
                        : 'bg-[var(--ds-bg-surface-2)] text-[var(--ds-text-3)]'}`}>
                      {tabCounts[key]}
                    </span>
                  )}
                  {tabTip && (
                    <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1.5 bg-slate-900 text-white text-[9px] font-bold rounded-lg whitespace-nowrap opacity-0 group-hover/stab:opacity-100 pointer-events-none transition-opacity z-50 shadow-xl">
                      {tabTip}
                    </span>
                  )}
                </button>
              )
            })}
          </div>

          {/* View toggle + Overview */}
          <div className="ml-auto mb-2.5 flex items-center gap-2 shrink-0 relative">
            {/* Overview toggle */}
            <button
              onClick={() => {
                if (overviewHideRef.current) { clearTimeout(overviewHideRef.current); overviewHideRef.current = null }
                setOverviewOpen(o => !o)
              }}
              title="Overview stats"
              className={`size-8 flex items-center justify-center rounded-lg transition-all ${overviewOpen ? 'bg-black text-[#adee2b] shadow' : 'bg-[var(--ds-bg-surface-2)] text-[var(--ds-text-3)] hover:text-[var(--ds-text-2)]'}`}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 17 }}>bar_chart</span>
            </button>

            {/* View toggle */}
            <div className={`flex gap-0.5 bg-[var(--ds-bg-surface-2)] rounded-xl p-1 ${(activeTab === 'all' || activeTab === 'series' || activeTab === 'hcal' || activeTab === 'special') ? 'opacity-35' : ''}`}>
              <button
                onClick={() => { if (activeTab !== 'all' && activeTab !== 'series' && activeTab !== 'hcal' && activeTab !== 'special' && viewMode !== 'card') { setViewMode('card'); setViewAnimKey(k => k + 1) } }}
                title="Card view"
                className={`size-8 flex items-center justify-center rounded-lg transition-all ${viewMode === 'card' ? 'bg-[var(--ds-bg-surface)] shadow text-[var(--ds-text-1)] dark:ring-1 dark:ring-white/[0.09]' : 'text-[var(--ds-text-3)] hover:text-[var(--ds-text-2)]'}`}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 17 }}>grid_view</span>
              </button>
              <button
                onClick={() => { if (activeTab !== 'all' && activeTab !== 'series' && activeTab !== 'hcal' && activeTab !== 'special' && viewMode !== 'list') { setViewMode('list'); setViewAnimKey(k => k + 1) } }}
                title="List view"
                className={`size-8 flex items-center justify-center rounded-lg transition-all ${viewMode === 'list' ? 'bg-[var(--ds-bg-surface)] shadow text-[var(--ds-text-1)] dark:ring-1 dark:ring-white/[0.09]' : 'text-[var(--ds-text-3)] hover:text-[var(--ds-text-2)]'}`}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 17 }}>view_list</span>
              </button>
            </div>

            {/* Overview dropdown */}
            {overviewOpen && (
              <div
                onMouseEnter={() => { if (overviewHideRef.current) { clearTimeout(overviewHideRef.current); overviewHideRef.current = null } }}
                onMouseLeave={() => { overviewHideRef.current = setTimeout(() => setOverviewOpen(false), 2000) }}
                style={{
                  position: 'absolute', top: 'calc(100% + 10px)', right: 0,
                  display: 'flex', flexDirection: 'column', gap: 8,
                  zIndex: 50, animation: 'overview-dropdown-in 0.22s cubic-bezier(0.34,1.04,0.64,1)',
                }}
              >
                {([
                  { label: t('label_this_month'), value: String(thisMonthCount).padStart(2, '0'), sub: t('label_bookings'), icon: 'calendar_month', clr: '#6366f1' },
                  { label: t('label_hours_used'), value: `${totalHours.toFixed(0)}h`, sub: t('label_this_month_sub'), icon: 'schedule', clr: '#06b6d4' },
                  { label: t('label_today'), value: String(todayList.length).padStart(2, '0'), sub: t('label_bookings'), icon: 'today', clr: '#f59e0b' },
                  { label: t('tab_upcoming'), value: String(upcomingList.length).padStart(2, '0'), sub: t('label_scheduled'), icon: 'upcoming', clr: '#adee2b' },
                ] as const).map((card, idx) => (
                  <div key={card.label} style={{
                    width: 190,
                    borderRadius: 18, padding: '14px 16px',
                    background: 'var(--ds-glass-bg)',
                    backdropFilter: 'blur(24px) saturate(180%)',
                    WebkitBackdropFilter: 'blur(24px) saturate(180%)',
                    border: '1px solid var(--ds-glass-border)',
                    boxShadow: 'var(--ds-glass-shadow)',
                    animation: `overview-card-in 0.3s cubic-bezier(0.34,1.04,0.64,1) ${idx * 50}ms both`,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                      <div style={{ width: 30, height: 30, borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', background: `${card.clr}1a` }}>
                        <span className="material-symbols-outlined" style={{ fontSize: 16, color: card.clr }}>{card.icon}</span>
                      </div>
                      <p style={{ fontSize: 8, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--ds-text-3)' }}>{card.label}</p>
                    </div>
                    <p style={{ fontSize: 32, fontWeight: 900, lineHeight: 1, fontVariantNumeric: 'tabular-nums', color: 'var(--ds-text-1)' }}>{card.value}</p>
                    <p style={{ fontSize: 9, fontWeight: 700, marginTop: 5, color: 'var(--ds-text-3)' }}>{card.sub}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Animated indicator */}
          <div
            className="absolute bottom-0 h-0.5 rounded-full transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] pointer-events-none"
            style={{ left: indicator.left, width: indicator.width, backgroundColor: meta.indicatorColor }}
          />
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">

        {/* Main content */}
        <div className="flex-1 overflow-y-auto px-8 py-6 bg-[var(--ds-bg-base)]" style={{ scrollbarWidth: 'thin' }}>
          {(isLoading || loadingAll) && myBookings.length === 0 && allMyBookings.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <span className="material-symbols-outlined animate-spin text-4xl text-[var(--ds-text-4)]">progress_activity</span>
            </div>
          ) : (activeList.length === 0 && activeTab !== 'hcal' && activeTab !== 'special' && !(activeTab === 'today' && todayPastList.length > 0)) ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-[var(--ds-text-4)]">
              <span className="material-symbols-outlined text-5xl">
                {activeTab === 'cancelled' ? 'cancel' : activeTab === 'tentative' ? 'pending' : activeTab === 'past' ? 'history' : activeTab === 'series' ? 'repeat' : 'calendar_month'}
              </span>
              <p className="text-sm font-black uppercase">
                {activeTab === 'today' ? t('empty_today')
                  : activeTab === 'upcoming' ? t('empty_upcoming')
                  : activeTab === 'past' ? t('empty_past')
                  : activeTab === 'cancelled' ? t('empty_cancelled')
                  : activeTab === 'tentative' ? t('empty_tentative')
                  : activeTab === 'series' ? t('empty_series')
                  : t('empty_no_bookings_yet')}
              </p>
            </div>
          ) : (
            <>
              {/* Building filter pills — shown on all tabs when user has 2+ buildings */}
              {buildingsInView.length >= 2 && (
                <div className="flex items-center gap-2 flex-wrap mb-6">
                  {buildingsInView.map(bld => {
                    const count = buildingCounts.get(bld.id) ?? 0
                    if (count === 0) return null
                    const isActive = buildingFilter === bld.id
                    return (
                      <button
                        key={bld.id}
                        onClick={() => setBuildingFilter(isActive ? null : bld.id)}
                        className={`flex items-center gap-1.5 pl-3 pr-2 py-1.5 rounded-full text-[10px] font-black uppercase transition-all
                          ${isActive ? 'bg-black text-[#adee2b]' : 'bg-[var(--ds-bg-surface-2)] dark:border dark:border-white/10 text-[var(--ds-text-2)] hover:bg-[var(--ds-bg-raised)]'}`}
                      >
                        {bld.code || bld.name}{(bld.locationName || bld.address) ? ` - ${bld.locationName || bld.address}` : ''}
                        <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full leading-none
                          ${isActive ? 'bg-white/15 text-[#adee2b]' : 'bg-[var(--ds-bg-raised)] text-[var(--ds-text-3)]'}`}>
                          {count}
                        </span>
                      </button>
                    )
                  })}
                </div>
              )}
              {activeTab === 'special' && (
                <div>
                  {/* Header row */}
                  {(() => {
                    const spNow = new Date()
                    const allSp = specialBookings as Booking[]
                    const spActive    = allSp.filter(b => b.status !== 'cancelled' && parseLocal(b.end_at) >= spNow).sort((a,b) => parseLocal(a.start_at).getTime() - parseLocal(b.start_at).getTime())
                    const spPast      = allSp.filter(b => b.status !== 'cancelled' && parseLocal(b.end_at) < spNow).sort((a,b) => parseLocal(b.start_at).getTime() - parseLocal(a.start_at).getTime())
                    const spCancelled = allSp.filter(b => b.status === 'cancelled').sort((a,b) => parseLocal(b.start_at).getTime() - parseLocal(a.start_at).getTime())

                    const spExportRows = [
                      ...(spExportGroups.active ? spActive : []),
                      ...(spExportGroups.past ? spPast : []),
                      ...(spExportGroups.cancelled ? spCancelled : []),
                    ]

                    // sort helper — when spSortCol is set, override default; otherwise keep group-native order
                    const applySort = (rows: Booking[], defaultDir: 'asc'|'desc') => {
                      const col = spSortCol
                      const dir = col ? spSortDir : defaultDir
                      const sign = dir === 'asc' ? 1 : -1
                      const key = (b: Booking): string | number => {
                        if (!col || col === 'date' || col === 'time') return parseLocal(b.start_at).getTime()
                        if (col === 'room')   return (b.room?.name ?? '').toLowerCase()
                        if (col === 'booker') return (b.user?.name ?? '').toLowerCase()
                        if (col === 'dept')   return (b.user?.department_name ?? '').toLowerCase()
                        if (col === 'title')  return (b.title ?? '').toLowerCase()
                        if (col === 'for')    return (b.booked_for ?? '').toLowerCase()
                        if (col === 'status') return b.status ?? ''
                        return parseLocal(b.start_at).getTime()
                      }
                      return [...rows].sort((a, b) => {
                        const ka = key(a), kb = key(b)
                        return ka < kb ? -sign : ka > kb ? sign : 0
                      })
                    }

                    return (
                      <>
                        <div className="flex items-center justify-between mb-5">
                          <div>
                            <p className="text-[11px] font-black uppercase tracking-widest text-amber-500 mb-0.5">Special Room Bookings</p>
                            <p className="text-[10px] text-[var(--ds-text-3)] font-bold">±90 days · {allSp.length} bookings</p>
                          </div>
                          <div className="flex items-center gap-2" ref={spExportRef}>
                            <div className="relative">
                              <button
                                onClick={() => setSpExportOpen(o => o ? null : 'excel')}
                                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-black uppercase transition-colors border ${spExportOpen ? 'bg-slate-800 text-white border-slate-700' : 'bg-[var(--ds-bg-surface-2)] text-[var(--ds-text-2)] border-[var(--ds-border)] hover:bg-[var(--ds-bg-raised)]'}`}
                              >
                                <span className="material-symbols-outlined" style={{ fontSize: 15 }}>download</span>Export
                                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>{spExportOpen ? 'expand_less' : 'expand_more'}</span>
                              </button>
                              {spExportOpen && (
                                <div className="absolute right-0 top-full mt-2 z-50 rounded-2xl p-4 w-72 dropdown-enter-right"
                                  style={{ background: 'var(--ds-glass-bg)', backdropFilter: 'blur(32px)', WebkitBackdropFilter: 'blur(32px)', border: '1px solid var(--ds-glass-border)', boxShadow: 'var(--ds-glass-shadow)' }}>
                                  <p className="text-[10px] font-black uppercase tracking-widest text-[var(--ds-text-3)] mb-3">Select groups to export</p>
                                  <div className="space-y-2.5 mb-4">
                                    <label className="flex items-center gap-2.5 cursor-pointer">
                                      <input type="checkbox" checked={spExportGroups.active} onChange={e => setSpExportGroups(g => ({ ...g, active: e.target.checked }))} className="accent-amber-500 w-4 h-4" />
                                      <span className="text-[12px] font-bold text-[var(--ds-text-2)] flex-1">Upcoming &amp; Today</span>
                                      <span className="text-[11px] font-black text-amber-400">{spActive.length}</span>
                                    </label>
                                    <label className="flex items-center gap-2.5 cursor-pointer">
                                      <input type="checkbox" checked={spExportGroups.past} onChange={e => setSpExportGroups(g => ({ ...g, past: e.target.checked }))} className="accent-slate-400 w-4 h-4" />
                                      <span className="text-[12px] font-bold text-[var(--ds-text-2)] flex-1">Past</span>
                                      <span className="text-[11px] font-black text-[var(--ds-text-3)]">{spPast.length}</span>
                                    </label>
                                    <label className="flex items-center gap-2.5 cursor-pointer">
                                      <input type="checkbox" checked={spExportGroups.cancelled} onChange={e => setSpExportGroups(g => ({ ...g, cancelled: e.target.checked }))} className="accent-red-400 w-4 h-4" />
                                      <span className="text-[12px] font-bold text-[var(--ds-text-2)] flex-1">Cancelled</span>
                                      <span className="text-[11px] font-black text-red-400">{spCancelled.length}</span>
                                    </label>
                                  </div>
                                  <div className="pt-3 border-t border-[var(--ds-border-sub)] flex items-center gap-1.5">
                                    <button
                                      onClick={() => setSpExportGroups({ active: true, past: true, cancelled: true })}
                                      className="text-[10px] font-black uppercase text-[var(--ds-text-3)] hover:text-[var(--ds-text-1)] transition-colors px-2 py-1 rounded-lg hover:bg-[var(--ds-bg-raised)] flex-1"
                                    >All</button>
                                    <button
                                      disabled={spExportRows.length === 0}
                                      onClick={() => { exportSpecialExcel(spExportRows, { active: spExportGroups.active ? spActive.length : null, past: spExportGroups.past ? spPast.length : null, cancelled: spExportGroups.cancelled ? spCancelled.length : null }); setSpExportOpen(null) }}
                                      className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 text-[11px] font-black uppercase hover:bg-emerald-500/25 transition-colors border border-emerald-500/25 disabled:opacity-40 disabled:cursor-not-allowed"
                                    >
                                      <span className="material-symbols-outlined" style={{ fontSize: 13 }}>table_view</span>Excel
                                    </button>
                                    <button
                                      disabled={spExportRows.length === 0}
                                      onClick={() => { exportSpecialPDF(spExportRows, { active: spExportGroups.active ? spActive.length : null, past: spExportGroups.past ? spPast.length : null, cancelled: spExportGroups.cancelled ? spCancelled.length : null }); setSpExportOpen(null) }}
                                      className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-red-500/15 text-red-600 dark:text-red-400 text-[11px] font-black uppercase hover:bg-red-500/25 transition-colors border border-red-500/25 disabled:opacity-40 disabled:cursor-not-allowed"
                                    >
                                      <span className="material-symbols-outlined" style={{ fontSize: 13 }}>picture_as_pdf</span>PDF
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        {loadingSpecial && specialBookings.length === 0 && (
                          <div className="flex items-center justify-center py-16">
                            <span className="material-symbols-outlined animate-spin text-3xl text-[var(--ds-text-4)]">progress_activity</span>
                          </div>
                        )}
                        {!loadingSpecial && allSp.length === 0 && (
                          <div className="flex flex-col items-center justify-center py-16 gap-3 text-[var(--ds-text-4)]">
                            <span className="material-symbols-outlined text-5xl">star</span>
                            <p className="text-sm font-black uppercase">No special room bookings</p>
                          </div>
                        )}
                        {!loadingSpecial && allSp.length > 0 && (() => {
                          const COLS: { key: string; label: string }[] = [
                            { key: 'date', label: 'Date' }, { key: 'time', label: 'Time' },
                            { key: 'room', label: 'Room' }, { key: 'booker', label: 'Booker' },
                            { key: 'dept', label: 'Dept' }, { key: 'title', label: 'Title' },
                            { key: 'for', label: 'For' }, { key: 'status', label: 'Status' },
                            { key: '', label: '' },
                          ]

                          const handleSortCol = (key: string) => {
                            if (!key) return
                            if (spSortCol === key) setSpSortDir(d => d === 'asc' ? 'desc' : 'asc')
                            else { setSpSortCol(key); setSpSortDir('asc') }
                          }

                          const renderTable = (rows: Booking[], variant: 'active'|'past'|'cancelled' = 'active') => {
                            const isCancelled = variant === 'cancelled'
                            const isActive = variant === 'active'
                            const defaultDir = isActive ? 'asc' : 'desc'
                            const sorted = applySort(rows, defaultDir)
                            return (
                              <div className={`overflow-x-auto rounded-2xl border ${isCancelled ? 'border-red-500/20 opacity-55' : isActive ? 'border-amber-500/20' : 'border-[var(--ds-border)] opacity-60'}`}>
                                <table className="w-full text-left border-collapse">
                                  <thead>
                                    <tr className={`border-b ${isCancelled ? 'bg-red-500/10 border-red-500/20' : isActive ? 'bg-amber-500/10 border-amber-500/20' : 'bg-[var(--ds-bg-surface-2)] border-[var(--ds-border)]'}`}>
                                      {COLS.map(({ key, label }) => {
                                        const active = spSortCol === key
                                        const baseColor = isCancelled ? 'text-red-400' : isActive ? 'text-amber-600 dark:text-amber-400' : 'text-[var(--ds-text-3)]'
                                        return (
                                          <th key={key}
                                            onClick={() => handleSortCol(key)}
                                            className={`px-4 py-3 text-[10px] font-black uppercase tracking-widest whitespace-nowrap select-none ${key ? 'cursor-pointer hover:opacity-70' : ''} ${active ? (isCancelled ? 'text-red-500' : isActive ? 'text-amber-700 dark:text-amber-300' : 'text-[var(--ds-text-1)]') : baseColor}`}
                                          >
                                            <span className="inline-flex items-center gap-1">
                                              {label}
                                              {key && (
                                                <span className="material-symbols-outlined" style={{ fontSize: 11, opacity: active ? 1 : 0.3 }}>
                                                  {active ? (spSortDir === 'asc' ? 'arrow_upward' : 'arrow_downward') : 'unfold_more'}
                                                </span>
                                              )}
                                            </span>
                                          </th>
                                        )
                                      })}
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {sorted.map((b: Booking, idx: number) => (
                                      <tr key={b.id} className={`border-b border-[var(--ds-border-sub)] ${idx % 2 === 0 ? 'bg-[var(--ds-bg-surface)]' : 'bg-[var(--ds-bg-surface-2)]/50'} ${isCancelled ? 'hover:bg-red-500/5' : isActive ? 'hover:bg-amber-500/5' : 'hover:bg-[var(--ds-bg-raised)]'} transition-colors`}>
                                        <td className="px-4 py-3 whitespace-nowrap">
                                          <span className="text-[12px] font-bold text-[var(--ds-text-2)]">{fmtTableDate(b.start_at, language)}</span>
                                          <span className="text-[var(--ds-text-4)] ml-1 text-[11px]">{fmtTableDay(b.start_at, language)}</span>
                                        </td>
                                        <td className="px-4 py-3 text-[11px] font-bold text-[var(--ds-text-2)] whitespace-nowrap tabular-nums">{fmtTime(b.start_at, language)} – {fmtTime(b.end_at, language)}</td>
                                        <td className="px-4 py-3">
                                          <p className="text-[12px] font-black text-[var(--ds-text-1)]">{b.room?.name ?? '—'}</p>
                                          <p className="text-[10px] text-[var(--ds-text-3)] font-bold">{b.room?.building?.code || b.room?.building?.name || ''}</p>
                                        </td>
                                        <td className="px-4 py-3">
                                          <p className="text-[11px] font-bold text-[var(--ds-text-2)] whitespace-nowrap">{b.user?.name ?? '—'}</p>
                                          <p className="text-[9px] font-black uppercase text-[var(--ds-text-4)]">{b.user?.role ?? ''}</p>
                                        </td>
                                        <td className="px-4 py-3 text-[10px] font-bold text-[var(--ds-text-3)] uppercase">{b.user?.department_name ?? ''}</td>
                                        <td className="px-4 py-3 text-[12px] font-black text-[var(--ds-text-1)] max-w-[160px] truncate">{b.title}</td>
                                        <td className="px-4 py-3 text-[11px] font-bold text-[var(--ds-text-3)]">{b.booked_for || '—'}</td>
                                        <td className="px-4 py-3">
                                          <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${b.status === 'confirmed' ? 'bg-[#adee2b]/20 text-[#3a6800] dark:text-[#adee2b]' : b.status === 'tentative' ? 'bg-amber-500/15 text-amber-700 dark:text-amber-400' : 'bg-red-500/15 text-red-600 dark:text-red-400'}`}>
                                            {b.status}
                                          </span>
                                        </td>
                                        <td className="px-3 py-3">
                                          {!isCancelled && (
                                            <div className="flex items-center gap-1">
                                              <button
                                                onClick={() => { setEditBooking(b); setPanelOpen(true) }}
                                                className="size-7 flex items-center justify-center rounded-lg text-[var(--ds-text-4)] hover:text-amber-600 hover:bg-amber-500/10 transition-colors"
                                                title="Edit booking"
                                              >
                                                <span className="material-symbols-outlined" style={{ fontSize: 15 }}>edit</span>
                                              </button>
                                              <button
                                                onClick={() => handleCancel(b)}
                                                disabled={pendingCancelIds.has(b.id)}
                                                className="size-7 flex items-center justify-center rounded-lg text-[var(--ds-text-4)] hover:text-red-500 hover:bg-red-500/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                                                title="Cancel booking"
                                              >
                                                <span className="material-symbols-outlined" style={{ fontSize: 15 }}>
                                                  {pendingCancelIds.has(b.id) ? 'progress_activity' : 'cancel'}
                                                </span>
                                              </button>
                                            </div>
                                          )}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            )
                          }

                          const SectionHeader = ({ label, color, count, show, onToggle }: { label: string; color: string; count: number; show?: boolean; onToggle?: () => void }) => (
                            <div className="flex items-center gap-3 mb-3">
                              <p className={`text-[13px] font-black uppercase tracking-[0.15em] whitespace-nowrap ${color}`}>{label}</p>
                              <div className={`flex-1 h-px ${color.includes('amber') ? 'bg-amber-500/20' : color.includes('red') ? 'bg-red-500/20' : 'bg-[var(--ds-border)]'}`} />
                              <span className={`text-[11px] font-black ${color}`}>{count}</span>
                              {onToggle !== undefined && (
                                <button onClick={onToggle} className={`flex items-center gap-1 text-[10px] font-black uppercase px-2.5 py-1 rounded-full transition-colors ${show ? 'bg-[var(--ds-bg-raised)] text-[var(--ds-text-2)] hover:bg-[var(--ds-border)]' : 'bg-[var(--ds-bg-surface-2)] text-[var(--ds-text-4)] hover:bg-[var(--ds-bg-raised)] hover:text-[var(--ds-text-2)]'}`}>
                                  <span className="material-symbols-outlined" style={{ fontSize: 12 }}>{show ? 'expand_less' : 'expand_more'}</span>
                                  {show ? 'Hide' : 'Show'}
                                </button>
                              )}
                            </div>
                          )

                          return (
                            <div className="space-y-8">
                              {spActive.length > 0 && (
                                <div>
                                  <SectionHeader label="Upcoming & Today" color="text-amber-500" count={spActive.length} />
                                  {renderTable(spActive, 'active')}
                                </div>
                              )}
                              {spPast.length > 0 && (
                                <div>
                                  <SectionHeader label="Past" color="text-[var(--ds-text-3)]" count={spPast.length} show={spShowPast} onToggle={() => setSpShowPast(v => !v)} />
                                  {spShowPast && renderTable(spPast, 'past')}
                                </div>
                              )}
                              {spCancelled.length > 0 && (
                                <div>
                                  <SectionHeader label="Cancelled" color="text-red-400" count={spCancelled.length} show={spShowCancelled} onToggle={() => setSpShowCancelled(v => !v)} />
                                  {spShowCancelled && renderTable(spCancelled, 'cancelled')}
                                </div>
                              )}
                            </div>
                          )
                        })()}
                      </>
                    )
                  })()}
                </div>
              )}

              {activeTab === 'hcal' ? (() => {
                const yr = hCalMonth.yr
                const mo = hCalMonth.mo
                const daysInSelMonth = new Date(yr, mo + 1, 0).getDate()
                const hCalDayBkgs = hCalBookingMap.get(hCalDate) ?? []
                const _hCalNow = new Date()
                const hCalUpcoming = hCalDayBkgs
                  .filter(b => parseLocal(b.end_at) >= _hCalNow)
                  .sort((a, b2) => parseLocal(a.start_at).getTime() - parseLocal(b2.start_at).getTime())
                const hCalPast = hCalDayBkgs
                  .filter(b => parseLocal(b.end_at) < _hCalNow)
                  .sort((a, b2) => parseLocal(a.start_at).getTime() - parseLocal(b2.start_at).getTime())
                const hCalHasBoth = hCalUpcoming.length > 0 && hCalPast.length > 0
                const hCalParsed = new Date(hCalDate + 'T00:00:00')
                const hCalLabel = hCalParsed.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).toUpperCase()
                // Months accessible = ceil(maxAdvanceDays / 30), always rounded up to a whole month count.
                // e.g. 61d → ceil(2.03) = 3 months; 80d → ceil(2.67) = 3 months; 91d → 4 months.
                const maxAdvanceDays  = generalSettings?.max_advance_days ?? 30
                const monthsAllowed   = Math.ceil(maxAdvanceDays / 30)
                // First day of the last accessible month (offset from today's month)
                const maxAllowedFirst = new Date(today.getFullYear(), today.getMonth() + monthsAllowed - 1, 1)
                const isMonthEnabled  = (y: number, m: number) =>
                  new Date(y, m, 1) <= maxAllowedFirst
                const bhStartMin = toMin(bhStart)
                const bhEndMin   = toMin(bhEnd)
                const bhTotalMin = bhEndMin - bhStartMin
                const bookingToPos = (iso: string) => {
                  const d = parseLocal(iso)
                  const mins = d.getHours() * 60 + d.getMinutes()
                  return Math.max(0, Math.min(100, ((mins - bhStartMin) / bhTotalMin) * 100))
                }
                return (
                  <div>
                    <style>{`
                      .hcal-dates{cursor:grab;overflow-x:scroll;scrollbar-width:none}
                      .hcal-dates::-webkit-scrollbar{display:none}
                      .hcal-dates.is-dragging{cursor:grabbing;user-select:none}
                      .hcal-cards{cursor:grab;overflow-x:scroll;scrollbar-width:none}
                      .hcal-cards::-webkit-scrollbar{display:none}
                      .hcal-cards.is-dragging{cursor:grabbing;user-select:none}
                      @keyframes hcal-fade-up{from{opacity:0;transform:translateY(7px)}to{opacity:1;transform:translateY(0)}}
                      @keyframes hcal-fade-in{from{opacity:0}to{opacity:1}}
                      .hcal-anim{animation:hcal-fade-up 0.2s cubic-bezier(0.34,1.04,0.64,1) both}
                      .hcal-anim-fast{animation:hcal-fade-up 0.16s ease both}
                    `}</style>

                    {/* Title */}
                    <div className="mb-6">
                      <h2 className="text-3xl font-black uppercase leading-tight tracking-tighter" style={{ color: 'var(--ds-text-1)' }}>
                        Horizontal<br />
                        Calendar <span className="text-[var(--ds-text-3)] font-black">#{yr}</span>
                      </h2>
                      <div className="mt-3 h-px bg-[var(--ds-border)]" />
                    </div>

                    {/* Month row */}
                    <div className="flex items-end gap-6 mb-6 flex-wrap">
                      {hCalMonths.map((mName, mi) => {
                        if (yr === today.getFullYear() && mi < today.getMonth()) return null
                        const isCurMo = mi === mo
                        const isEnabled = isMonthEnabled(yr, mi)
                        return (
                          <button key={mi}
                            disabled={!isEnabled}
                            onClick={() => {
                              if (!isEnabled) return
                              const newDate = mi === today.getMonth() && yr === today.getFullYear()
                                ? toDateKey(today)
                                : toDateKey(new Date(yr, mi, 1))
                              setHCalMonth({ yr, mo: mi })
                              setHCalDate(newDate)
                            }}
                            className="leading-none transition-all shrink-0 disabled:cursor-default"
                          >
                            <span className={`text-[22px] transition-all ${
                              isCurMo ? 'font-black text-[var(--ds-text-1)]'
                              : isEnabled ? 'font-semibold text-[var(--ds-text-3)] hover:text-[var(--ds-text-2)]'
                              : 'font-medium text-[var(--ds-text-4)]'
                            }`}>
                              {mName}
                            </span>
                          </button>
                        )
                      })}
                    </div>

                    {/* Date row — ~25-visible carousel */}
                    <div
                      ref={hCalDatesRef}
                      className="hcal-dates pb-2 select-none"
                      onScroll={() => { showDatesSb(); hideDatesSb() }}
                      onMouseEnter={showDatesSb}
                      onMouseLeave={() => hideDatesSb(200)}
                    >
                      <div key={`${yr}-${mo}`} className="flex gap-1 hcal-anim-fast">
                        {Array.from({ length: daysInSelMonth }, (_, di) => {
                          const d = new Date(yr, mo, di + 1)
                          const key = toDateKey(d)
                          const isToday = d.toDateString() === today.toDateString()
                          const isSel = key === hCalDate && !isToday
                          const isPastDate = d < today && !isToday
                          if (isPastDate) return null
                          const hasBkg = hCalBookingMap.has(key)
                          const dow = d.getDay()
                          const isWeekend = (dow === 6 && wkSat) || (dow === 0 && wkSun)
                          return (
                            <button
                              key={di}
                              ref={isToday ? hCalTodayRef : undefined}
                              onClick={() => setHCalDate(key)}
                              className={`flex flex-col items-center gap-1 py-2 rounded-2xl transition-all shrink-0
                                ${isToday || isSel ? '' : 'hover:bg-[var(--ds-bg-raised)]'}`}
                              style={{ width: 52 }}
                            >
                              <div
                                className="w-9 h-9 rounded-full flex items-center justify-center font-black transition-all"
                                style={{
                                  fontSize: 16,
                                  background: isToday ? '#adee2b' : isSel ? 'rgba(173,238,43,0.22)' : 'transparent',
                                  color: isToday ? (isWeekend ? '#ef4444' : '#000') : isSel ? 'var(--ds-text-1)' : isWeekend ? '#ef4444' : 'var(--ds-text-1)',
                                }}
                              >
                                {di + 1}
                              </div>
                              <span className={`text-[10px] font-bold uppercase leading-none ${isWeekend ? 'text-red-400' : 'text-[var(--ds-text-3)]'}`}>
                                {d.toLocaleDateString(language === 'id' ? 'id-ID' : 'en-GB', { weekday: 'short' }).slice(0, 2)}
                              </span>
                              <span className="size-1.5 rounded-full" style={{ background: '#72ddf7', opacity: hasBkg ? 1 : 0 }} />
                            </button>
                          )
                        })}
                      </div>
                    </div>
                    {/* Custom scrollbar — dates */}
                    <div
                      style={{
                        height: hCalDatesSbHover ? 6 : 3,
                        position: 'relative', marginTop: 4, marginBottom: 16,
                        opacity: (hCalDatesSb.vis || hCalDatesSbHover) ? 1 : 0,
                        transition: 'opacity 0.3s ease, height 0.18s ease',
                        background: hCalDatesSbHover ? 'var(--ds-border)' : 'transparent',
                        borderRadius: 9999, cursor: 'pointer',
                      }}
                      onMouseEnter={() => {
                        setHCalDatesSbHover(true)
                        if (hCalDatesHideTimer.current) clearTimeout(hCalDatesHideTimer.current)
                        showDatesSb()
                      }}
                      onMouseLeave={() => { setHCalDatesSbHover(false); hideDatesSb(300) }}
                      onClick={(e) => {
                        const el = hCalDatesRef.current; if (!el) return
                        const rect = e.currentTarget.getBoundingClientRect()
                        el.scrollLeft = ((e.clientX - rect.left) / rect.width) * (el.scrollWidth - el.clientWidth)
                      }}
                    >
                      <div
                        style={{
                          position: 'absolute', left: `${hCalDatesSb.left}%`, width: `${hCalDatesSb.w}%`,
                          height: '100%', borderRadius: 9999,
                          background: hCalDatesSbHover ? 'var(--ds-text-3)' : 'var(--ds-border)',
                          transition: 'background 0.18s ease',
                          cursor: 'grab',
                        }}
                        onMouseDown={(e) => {
                          e.preventDefault(); e.stopPropagation()
                          const el = hCalDatesRef.current; if (!el) return
                          hCalSbDrag.current = { container: el, startX: e.clientX, startScroll: el.scrollLeft }
                        }}
                      />
                    </div>

                    {/* Day timeline bar */}
                    {(() => {
                      const now = new Date()
                      const nowMins = now.getHours() * 60 + now.getMinutes()
                      const nowPos = ((nowMins - bhStartMin) / bhTotalMin) * 100
                      const isSelToday = hCalDate === toDateKey(today)
                      const showNow = isSelToday && nowMins >= bhStartMin && nowMins <= bhEndMin
                      return (
                        <div className="mb-5" style={{ position: 'relative' }}>
                          {/* Track */}
                          <div style={{ position: 'relative', height: 10, background: 'var(--ds-border)', borderRadius: 999, overflow: 'visible' }}>
                            {/* Booked segments — hover target + glow */}
                            {hCalDayBkgs.map(b => {
                              const left = bookingToPos(b.start_at)
                              const right = bookingToPos(b.end_at)
                              const isConf = b.status === 'confirmed'
                              const isTent = b.status === 'tentative'
                              const color = isConf ? '#adee2b' : isTent ? '#fbbf24' : '#fca5a5'
                              const isHov = hCalHoverId === b.id
                              return (
                                <div
                                  key={b.id}
                                  style={{
                                    position: 'absolute',
                                    left: `${left}%`, width: `${Math.max(right - left, 1.5)}%`,
                                    top: isHov ? -4 : 0, bottom: isHov ? -4 : 0,
                                    background: color,
                                    borderRadius: 999,
                                    opacity: isHov ? 1 : 0.82,
                                    boxShadow: isHov ? `0 0 0 3px white, 0 0 14px 5px ${color}88` : 'none',
                                    cursor: 'pointer',
                                    zIndex: isHov ? 5 : 2,
                                    transition: 'top 0.15s ease, bottom 0.15s ease, box-shadow 0.15s ease, opacity 0.15s ease',
                                  }}
                                  onMouseMove={e => { setHCalTimelineHover({ bookingId: b.id, x: e.clientX, y: e.clientY }); setHCalHoverId(b.id) }}
                                  onMouseLeave={() => { setHCalTimelineHover(null); setHCalHoverId(null) }}
                                />
                              )
                            })}

                            {/* Dots — visual markers, pointer-events none */}
                            {hCalDayBkgs.map(b => {
                              const pos = bookingToPos(b.start_at)
                              const isConf = b.status === 'confirmed'
                              const isTent = b.status === 'tentative'
                              const color = isConf ? '#adee2b' : isTent ? '#fbbf24' : '#fca5a5'
                              const isHov = hCalHoverId === b.id
                              return (
                                <div key={b.id} style={{
                                  position: 'absolute', left: `${pos}%`, top: '50%',
                                  transform: 'translate(-50%, -50%)',
                                  width: isHov ? 14 : 10, height: isHov ? 14 : 10,
                                  borderRadius: '50%',
                                  background: color,
                                  border: `2px solid white`,
                                  boxShadow: isHov ? `0 0 0 2px ${color}` : `0 0 0 1.5px ${color}88`,
                                  zIndex: 6,
                                  pointerEvents: 'none',
                                  transition: 'width 0.15s ease, height 0.15s ease, box-shadow 0.15s ease',
                                }} />
                              )
                            })}

                            {/* Now indicator — thin red cutter line */}
                            {showNow && (
                              <div style={{
                                position: 'absolute', left: `${nowPos}%`, top: -7, bottom: -7,
                                width: 1.5, background: '#ef4444',
                                transform: 'translateX(-50%)',
                                zIndex: 6, borderRadius: 999,
                              }}>
                                <div style={{
                                  position: 'absolute', top: -4, left: '50%', transform: 'translateX(-50%)',
                                  width: 0, height: 0,
                                  borderLeft: '4px solid transparent',
                                  borderRight: '4px solid transparent',
                                  borderTop: '5px solid #ef4444',
                                }} />
                              </div>
                            )}
                          </div>

                          {/* Time labels */}
                          {(() => {
                            const noonPos    = ((720  - bhStartMin) / bhTotalMin) * 100
                            const pm430Pos   = ((990  - bhStartMin) / bhTotalMin) * 100
                            const showNoon   = noonPos  > 8 && noonPos  < 92
                            const showPm430  = pm430Pos > 8 && pm430Pos < 92 && Math.abs(pm430Pos - 100) > 10
                            return (
                              <div style={{ position: 'relative', height: 16, marginTop: 6 }}>
                                <span className="text-[9px] font-black text-[var(--ds-text-3)] tabular-nums" style={{ position: 'absolute', left: 0 }}>{bhStart}</span>
                                {showNoon && (
                                  <span className="text-[9px] font-black text-[var(--ds-text-4)] tabular-nums" style={{ position: 'absolute', left: `${noonPos}%`, transform: 'translateX(-50%)' }}>12:00</span>
                                )}
                                {showPm430 && (
                                  <span className="text-[9px] font-black text-[var(--ds-text-4)] tabular-nums" style={{ position: 'absolute', left: `${pm430Pos}%`, transform: 'translateX(-50%)' }}>16:30</span>
                                )}
                                <span className="text-[9px] font-black text-[var(--ds-text-3)] tabular-nums" style={{ position: 'absolute', right: 0 }}>{bhEnd}</span>
                              </div>
                            )
                          })()}
                        </div>
                      )
                    })()}

                    {/* Selected date label + cards — keyed on date for animation */}
                    <div key={hCalDate} className="hcal-anim">
                    {/* Selected date label */}
                    <div className="flex items-center gap-3 mb-4">
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--ds-text-3)] whitespace-nowrap">{hCalLabel}</p>
                      <div className="flex-1 h-px bg-[var(--ds-border)]" />
                      <span className="text-[9px] font-black text-[var(--ds-text-4)]">{hCalDayBkgs.length}</span>
                    </div>

                    {/* Booking cards */}
                    {hCalDayBkgs.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-10 gap-3">
                        <span className="material-symbols-outlined text-4xl text-[var(--ds-text-4)]">event_available</span>
                        <p className="text-[11px] font-black uppercase tracking-wide text-[var(--ds-text-4)]">No bookings on this date</p>
                        <button
                          onClick={() => { setEditBooking(null); setPanelPrefillDate(hCalDate); setPanelOpen(true) }}
                          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wide transition-all"
                          style={{ background: '#adee2b', color: '#1a3a00', letterSpacing: '0.07em' }}
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: 14 }}>add</span>
                          Book {new Date(hCalDate + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                        </button>
                      </div>
                    ) : (
                      <>
                        {hCalUpcoming.length > 0 && (
                          <>
                            <div
                              ref={hCalCardsRef}
                              className="hcal-cards select-none"
                              style={{ paddingTop: 10, paddingBottom: 16, paddingLeft: 8, marginLeft: -8 }}
                              onScroll={() => { showCardsSb(); hideCardsSb() }}
                              onMouseEnter={showCardsSb}
                              onMouseLeave={() => hideCardsSb(200)}
                            >
                              <div className="flex gap-3" style={{ width: 'max-content', alignItems: 'flex-start' }}>
                                {hCalUpcoming.map((b, idx) => (
                                  <div key={b.id} style={{ animation: 'hcal-fade-up 0.22s cubic-bezier(0.34,1.04,0.64,1) both', animationDelay: `${idx * 50}ms` }}>
                                    <HCalCompactCard
                                      b={b}
                                      expanded={hCalCardExpanded === b.id}
                                      highlighted={hCalHoverId === b.id}
                                      onHover={() => setHCalHoverId(b.id)}
                                      onUnhover={() => setHCalHoverId(null)}
                                      onToggle={() => setHCalCardExpanded(prev => prev === b.id ? null : b.id)}
                                      onEdit={() => { setEditBooking(b); setPanelOpen(true); setHCalCardExpanded(null) }}
                                      onCancel={() => { handleCancel(b); setHCalCardExpanded(null) }}
                                    />
                                  </div>
                                ))}
                              </div>
                            </div>
                            {/* Custom scrollbar — cards */}
                        <div
                          style={{
                            height: hCalCardsSbHover ? 6 : 3,
                            position: 'relative', marginTop: 6,
                            opacity: (hCalCardsSb.vis || hCalCardsSbHover) ? 1 : 0,
                            transition: 'opacity 0.3s ease, height 0.18s ease',
                            background: hCalCardsSbHover ? 'var(--ds-border)' : 'transparent',
                            borderRadius: 9999, cursor: 'pointer',
                          }}
                          onMouseEnter={() => {
                            setHCalCardsSbHover(true)
                            if (hCalCardsHideTimer.current) clearTimeout(hCalCardsHideTimer.current)
                            showCardsSb()
                          }}
                          onMouseLeave={() => { setHCalCardsSbHover(false); hideCardsSb(300) }}
                          onClick={(e) => {
                            const el = hCalCardsRef.current; if (!el) return
                            const rect = e.currentTarget.getBoundingClientRect()
                            el.scrollLeft = ((e.clientX - rect.left) / rect.width) * (el.scrollWidth - el.clientWidth)
                          }}
                        >
                          <div
                            style={{
                              position: 'absolute', left: `${hCalCardsSb.left}%`, width: `${hCalCardsSb.w}%`,
                              height: '100%', borderRadius: 9999,
                              background: hCalCardsSbHover ? 'var(--ds-text-3)' : 'var(--ds-border)',
                              transition: 'background 0.18s ease',
                              cursor: 'grab',
                            }}
                            onMouseDown={(e) => {
                              e.preventDefault(); e.stopPropagation()
                              const el = hCalCardsRef.current; if (!el) return
                              hCalSbDrag.current = { container: el, startX: e.clientX, startScroll: el.scrollLeft }
                            }}
                          />
                        </div>
                          </>
                        )}

                        {/* Past section — separate row below */}
                        {hCalPast.length > 0 && (
                          <div key="past-section" className="mt-5">
                            <p className="text-[9px] font-black uppercase tracking-[0.18em] mb-2" style={{ color: '#c4c9d4' }}>Past</p>
                            <div
                              ref={hCalPastRef}
                              className="hcal-cards select-none"
                              style={{ paddingTop: 10, paddingBottom: 16, paddingLeft: 8, marginLeft: -8, filter: 'saturate(0.25)', opacity: 0.5 }}
                              onScroll={() => { showPastSb(); hidePastSb() }}
                              onMouseEnter={showPastSb}
                              onMouseLeave={() => hidePastSb(200)}
                            >
                              <div className="flex gap-3" style={{ width: 'max-content', alignItems: 'flex-start' }}>
                                {hCalPast.map((b, idx) => (
                                  <div key={b.id} style={{ animation: 'hcal-fade-up 0.22s cubic-bezier(0.34,1.04,0.64,1) both', animationDelay: `${idx * 50}ms` }}>
                                    <HCalCompactCard
                                      b={b}
                                      expanded={false}
                                      clickable={false}
                                      highlighted={hCalHoverId === b.id}
                                      onHover={() => setHCalHoverId(b.id)}
                                      onUnhover={() => setHCalHoverId(null)}
                                      onToggle={() => {}}
                                      onEdit={() => {}}
                                      onCancel={() => {}}
                                    />
                                  </div>
                                ))}
                              </div>
                            </div>
                            {/* Custom scrollbar — past */}
                            <div
                              style={{
                                height: hCalPastSbHover ? 6 : 3,
                                position: 'relative', marginTop: 6,
                                opacity: (hCalPastSb.vis || hCalPastSbHover) ? 1 : 0,
                                transition: 'opacity 0.3s ease, height 0.18s ease',
                                background: hCalPastSbHover ? 'var(--ds-border)' : 'transparent',
                                borderRadius: 9999, cursor: 'pointer',
                              }}
                              onMouseEnter={() => {
                                setHCalPastSbHover(true)
                                if (hCalPastHideTimer.current) clearTimeout(hCalPastHideTimer.current)
                                showPastSb()
                              }}
                              onMouseLeave={() => { setHCalPastSbHover(false); hidePastSb(300) }}
                              onClick={(e) => {
                                const el = hCalPastRef.current; if (!el) return
                                const rect = e.currentTarget.getBoundingClientRect()
                                el.scrollLeft = ((e.clientX - rect.left) / rect.width) * (el.scrollWidth - el.clientWidth)
                              }}
                            >
                              <div
                                style={{
                                  position: 'absolute', left: `${hCalPastSb.left}%`, width: `${hCalPastSb.w}%`,
                                  height: '100%', borderRadius: 9999,
                                  background: hCalPastSbHover ? 'var(--ds-text-3)' : 'var(--ds-border)',
                                  transition: 'background 0.18s ease', cursor: 'grab',
                                }}
                                onMouseDown={(e) => {
                                  e.preventDefault(); e.stopPropagation()
                                  const el = hCalPastRef.current; if (!el) return
                                  hCalSbDrag.current = { container: el, startX: e.clientX, startScroll: el.scrollLeft }
                                }}
                              />
                            </div>
                          </div>
                        )}

                      </>
                    )}
                    </div>{/* end key={hCalDate} */}
                  </div>
                )
              })() : activeTab === 'series' ? (
              <div style={{ animation: 'tab-section-enter 0.3s ease-out' }}>
                <div className="flex items-center gap-3 mb-4">
                  <p className="text-[10px] font-black uppercase tracking-widest text-[var(--ds-text-3)] shrink-0">
                    {seriesSearch ? `${displaySeriesList.length} result${displaySeriesList.length !== 1 ? 's' : ''}` : `${displaySeriesList.length} series`}
                  </p>
                  <div className="relative flex-1 max-w-xs">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ds-text-4)] pointer-events-none" style={{ fontSize: 16 }}>search</span>
                    <input
                      type="text"
                      placeholder="Search title, room..."
                      value={seriesSearch}
                      onChange={e => setSeriesSearch(e.target.value)}
                      className={`w-full pl-9 pr-8 py-2 border rounded-xl text-[11px] font-bold text-[var(--ds-text-1)] placeholder:text-[var(--ds-text-4)] focus:outline-none focus:ring-2 focus:ring-[#adee2b] focus:border-transparent transition-all
                        ${seriesSearch ? 'border-[#adee2b] bg-[#adee2b]/10' : 'border-[var(--ds-border)] bg-[var(--ds-bg-surface-2)]'}`}
                    />
                    {seriesSearch && (
                      <button onClick={() => setSeriesSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 size-5 flex items-center justify-center rounded-md text-[var(--ds-text-3)] hover:text-[var(--ds-text-1)] transition-colors">
                        <span className="material-symbols-outlined" style={{ fontSize: 14 }}>close</span>
                      </button>
                    )}
                  </div>
                  <div className="relative shrink-0" ref={seriesExportRef}>
                    <button
                      onClick={() => setSeriesExportOpen(o => !o)}
                      disabled={displaySeriesList.length === 0}
                      className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-black uppercase transition-colors border disabled:opacity-40 disabled:cursor-not-allowed ${seriesExportOpen ? 'bg-slate-800 text-white border-slate-700' : 'bg-[var(--ds-bg-surface-2)] text-[var(--ds-text-2)] border-[var(--ds-border)] hover:bg-[var(--ds-bg-raised)]'}`}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: 15 }}>download</span>Export All
                      <span className="material-symbols-outlined" style={{ fontSize: 14 }}>{seriesExportOpen ? 'expand_less' : 'expand_more'}</span>
                    </button>
                    {seriesExportOpen && (
                      <div className="absolute right-0 top-full mt-2 z-50 rounded-2xl p-4 w-72 dropdown-enter-right"
                        style={{ background: 'var(--ds-glass-bg)', backdropFilter: 'blur(32px)', WebkitBackdropFilter: 'blur(32px)', border: '1px solid var(--ds-glass-border)', boxShadow: 'var(--ds-glass-shadow)' }}>
                        <p className="text-[10px] font-black uppercase tracking-widest text-[var(--ds-text-3)] mb-3">Export all {displaySeriesList.length} series</p>
                        <label className="flex items-center gap-2.5 cursor-pointer mb-4">
                          <input type="checkbox" checked={seriesIncludePastAll} onChange={e => setSeriesIncludePastAll(e.target.checked)} className="accent-black w-4 h-4" />
                          <span className="text-[12px] font-bold text-[var(--ds-text-2)] flex-1">Include past dates</span>
                        </label>
                        <div className="pt-3 border-t border-[var(--ds-border-sub)] flex items-center gap-1.5">
                          <button
                            onClick={() => {
                              const allRebooked = displaySeriesList.flatMap(g => resolvedSkipsForSeries(g.series_id))
                              const rows = seriesExportRows([...displaySeriesList.flatMap(g => g.bookings), ...allRebooked], seriesIncludePastAll)
                              exportSeriesExcel(rows, `All Series — ${user?.name ?? ''}`, seriesIncludePastAll, `all-series-${user?.name?.replace(' ', '-').toLowerCase()}`)
                              setSeriesExportOpen(false)
                            }}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 text-[11px] font-black uppercase hover:bg-emerald-500/25 transition-colors border border-emerald-500/25 flex-1 justify-center"
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: 13 }}>table_view</span>Excel
                          </button>
                          <button
                            onClick={() => {
                              const allRebooked = displaySeriesList.flatMap(g => resolvedSkipsForSeries(g.series_id))
                              const rows = seriesExportRows([...displaySeriesList.flatMap(g => g.bookings), ...allRebooked], seriesIncludePastAll)
                              exportSeriesPDF(rows, `All Series — ${user?.name ?? ''}`, seriesIncludePastAll, `all-series-${user?.name?.replace(' ', '-').toLowerCase()}`)
                              setSeriesExportOpen(false)
                            }}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-red-500/15 text-red-600 dark:text-red-400 text-[11px] font-black uppercase hover:bg-red-500/25 transition-colors border border-red-500/25 flex-1 justify-center"
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: 13 }}>picture_as_pdf</span>PDF
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                <div className="bg-[var(--ds-bg-surface)] rounded-2xl border border-[var(--ds-border)] overflow-hidden">
                <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-left">
                  <thead>
                    <tr className="bg-slate-900 border-b border-slate-700">
                      <th className="px-3 py-3.5 w-8" />
                      {(['Room', 'Title', 'Date Range', 'Count', 'Status Summary', ''] as string[]).map((h, i) => (
                        <th key={i} className="px-3 py-3.5 text-left text-[10px] font-black uppercase tracking-widest text-[#94a3b8]">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  {activeSeriesList.map((group, idx) => (
                    <SeriesGroupRow
                      key={group.series_id}
                      group={group}
                      index={idx}
                      pendingCancelIds={pendingCancelIds}
                      onEdit={b => { setEditBooking(b); setPanelOpen(true) }}
                      onCancel={handleCancel}
                      onCancelSeries={setSeriesCancelTarget}
                      onExport={handleExportSeriesRow}
                      resolvedSkips={resolvedSkips}
                    />
                  ))}
                  {pastSeriesList.length > 0 && (
                    <tbody>
                      <tr>
                        <td colSpan={7} className="px-3 pt-5 pb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-[9px] font-black uppercase tracking-widest text-[var(--ds-text-4)]">Past</span>
                            <div className="flex-1 h-px bg-[var(--ds-border-sub)]" />
                            <span className="text-[9px] font-black text-[var(--ds-text-4)]">{pastSeriesList.length}</span>
                          </div>
                        </td>
                      </tr>
                    </tbody>
                  )}
                  {pastSeriesList.map((group, idx) => (
                    <SeriesGroupRow
                      key={group.series_id}
                      group={group}
                      index={activeSeriesList.length + idx}
                      pendingCancelIds={pendingCancelIds}
                      onEdit={b => { setEditBooking(b); setPanelOpen(true) }}
                      onCancel={handleCancel}
                      onCancelSeries={setSeriesCancelTarget}
                      onExport={handleExportSeriesRow}
                      resolvedSkips={resolvedSkips}
                    />
                  ))}
                </table>
                </div>
                </div>
              </div>
              ) : activeTab === 'all' ? (
              <div style={{ animation: 'tab-section-enter 0.3s ease-out' }}>
              {/* Search + Export row */}
              <div className="flex items-center gap-3 mb-4">
                <p className="text-[10px] font-black uppercase tracking-widest text-[var(--ds-text-3)] shrink-0">
                  {allSearch ? `${allListFiltered.length} result${allListFiltered.length !== 1 ? 's' : ''}` : `${upcomingInAll.length} upcoming${pastInAll.length > 0 ? ` · ${pastInAll.length} past` : ''}`}
                </p>
                <div className="relative flex-1">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ds-text-4)] pointer-events-none" style={{ fontSize: 16 }}>search</span>
                  <input
                    type="text"
                    placeholder="Search title, room, type, status..."
                    value={allSearch}
                    onChange={e => setAllSearch(e.target.value)}
                    className={`w-full pl-9 pr-8 py-2 border rounded-xl text-[11px] font-bold text-[var(--ds-text-1)] placeholder:text-[var(--ds-text-4)] focus:outline-none focus:ring-2 focus:ring-[#adee2b] focus:border-transparent transition-all
                      ${allSearch ? 'border-[#adee2b] bg-[#adee2b]/10' : 'border-[var(--ds-border)] bg-[var(--ds-bg-surface-2)]'}`}
                  />
                  {allSearch && (
                    <button onClick={() => setAllSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 size-5 flex items-center justify-center rounded-md text-[var(--ds-text-3)] hover:text-[var(--ds-text-1)] transition-colors">
                      <span className="material-symbols-outlined" style={{ fontSize: 14 }}>close</span>
                    </button>
                  )}
                </div>
                <div className="relative shrink-0" ref={allExportRef}>
                  <button
                    onClick={() => setAllExportOpen(o => !o)}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-black uppercase transition-colors border ${allExportOpen ? 'bg-slate-800 text-white border-slate-700' : 'bg-[var(--ds-bg-surface-2)] text-[var(--ds-text-2)] border-[var(--ds-border)] hover:bg-[var(--ds-bg-raised)]'}`}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 15 }}>download</span>Export
                    <span className="material-symbols-outlined" style={{ fontSize: 14 }}>{allExportOpen ? 'expand_less' : 'expand_more'}</span>
                  </button>
                  {allExportOpen && (
                    <div className="absolute right-0 top-full mt-2 z-50 rounded-2xl p-4 w-72 dropdown-enter-right"
                      style={{ background: 'var(--ds-glass-bg)', backdropFilter: 'blur(32px)', WebkitBackdropFilter: 'blur(32px)', border: '1px solid var(--ds-glass-border)', boxShadow: 'var(--ds-glass-shadow)' }}>
                      <p className="text-[10px] font-black uppercase tracking-widest text-[var(--ds-text-3)] mb-3">Select groups to export</p>
                      <div className="space-y-2.5 mb-4">
                        <label className="flex items-center gap-2.5 cursor-pointer">
                          <input type="checkbox" checked={allExportGroups.upcoming} onChange={e => setAllExportGroups(g => ({ ...g, upcoming: e.target.checked }))} className="accent-black w-4 h-4" />
                          <span className="text-[12px] font-bold text-[var(--ds-text-2)] flex-1">Upcoming &amp; Today</span>
                          <span className="text-[11px] font-black text-[var(--ds-text-1)]">{upcomingInAll.length}</span>
                        </label>
                        <label className="flex items-center gap-2.5 cursor-pointer">
                          <input type="checkbox" checked={allExportGroups.past} onChange={e => setAllExportGroups(g => ({ ...g, past: e.target.checked }))} className="accent-slate-400 w-4 h-4" />
                          <span className="text-[12px] font-bold text-[var(--ds-text-2)] flex-1">Past</span>
                          <span className="text-[11px] font-black text-[var(--ds-text-3)]">{pastInAll.length}</span>
                        </label>
                        <label className="flex items-center gap-2.5 cursor-pointer">
                          <input type="checkbox" checked={allExportGroups.cancelled} onChange={e => setAllExportGroups(g => ({ ...g, cancelled: e.target.checked }))} className="accent-red-400 w-4 h-4" />
                          <span className="text-[12px] font-bold text-[var(--ds-text-2)] flex-1">Cancelled <span className="text-[9px] font-bold text-[var(--ds-text-4)] normal-case">last 7 days</span></span>
                          <span className="text-[11px] font-black text-red-400">{cancelledList.length}</span>
                        </label>
                      </div>
                      <div className="pt-3 border-t border-[var(--ds-border-sub)] flex items-center gap-1.5">
                        <button
                          onClick={() => setAllExportGroups({ upcoming: true, past: true, cancelled: true })}
                          className="text-[10px] font-black uppercase text-[var(--ds-text-3)] hover:text-[var(--ds-text-1)] transition-colors px-2 py-1 rounded-lg hover:bg-[var(--ds-bg-raised)] flex-1"
                        >All</button>
                        <button
                          disabled={allExportRows.length === 0}
                          onClick={() => { exportAllExcel(allExportRows, { upcoming: allExportGroups.upcoming ? upcomingInAll.length : null, past: allExportGroups.past ? pastInAll.length : null, cancelled: allExportGroups.cancelled ? cancelledList.length : null }); setAllExportOpen(false) }}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 text-[11px] font-black uppercase hover:bg-emerald-500/25 transition-colors border border-emerald-500/25 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: 13 }}>table_view</span>Excel
                        </button>
                        <button
                          disabled={allExportRows.length === 0}
                          onClick={() => { exportAllPDF(allExportRows, { upcoming: allExportGroups.upcoming ? upcomingInAll.length : null, past: allExportGroups.past ? pastInAll.length : null, cancelled: allExportGroups.cancelled ? cancelledList.length : null }); setAllExportOpen(false) }}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-red-500/15 text-red-600 dark:text-red-400 text-[11px] font-black uppercase hover:bg-red-500/25 transition-colors border border-red-500/25 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: 13 }}>picture_as_pdf</span>PDF
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <div className="bg-[var(--ds-bg-surface)] rounded-2xl border border-[var(--ds-border)] overflow-hidden">
                <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-left">
                  <thead>
                    <tr className="bg-slate-900 border-b border-slate-700">
                      {([
                        { label: 'Date', key: 'start_at' },
                        { label: 'Day', key: null },
                        { label: 'Time', key: null },
                        { label: 'Room', key: 'room' },
                        { label: 'Title', key: 'title' },
                        { label: 'Description', key: null },
                        { label: 'Status', key: 'status' },
                        { label: 'Type', key: 'type' },
                        { label: '', key: null },
                      ] as { label: string; key: AllSortKey | null }[]).map((h, i) => (
                        <th key={i} className="px-4 py-3.5 text-left whitespace-nowrap">
                          {h.key ? (
                            <button onClick={() => toggleAllSort(h.key!)}
                              className="flex items-center gap-1 text-[11px] font-black uppercase tracking-widest transition-colors"
                              style={{ color: allSortKey === h.key ? '#adee2b' : '#94a3b8' }}>
                              {h.label}
                              <span className="material-symbols-outlined" style={{ fontSize: 12, color: allSortKey === h.key ? '#adee2b' : '#64748b' }}>
                                {allSortKey === h.key ? (allSortDir === 'asc' ? 'arrow_upward' : 'arrow_downward') : 'unfold_more'}
                              </span>
                            </button>
                          ) : (
                            <span className="text-[11px] font-black uppercase tracking-widest text-[#94a3b8]">{h.label}</span>
                          )}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {allListFiltered.map((b: Booking, i: number) => {
                      const isPast = isActuallyPast(b)
                      const prevIsActive = i > 0 && !isActuallyPast(allListFiltered[i - 1])
                      const isFirstPast = isPast && prevIsActive
                      const isConf = b.status === 'confirmed'
                      const tStyle = typeStyle[b.type] || typeStyle.internal
                      return (
                        <Fragment key={b.id}>
                          {isFirstPast && (
                            <tr className="bg-[var(--ds-bg-surface-2)]">
                              <td colSpan={9} className="px-4 py-2">
                                <div className="flex items-center gap-3">
                                  <span className="material-symbols-outlined text-[var(--ds-text-3)]" style={{ fontSize: 14 }}>history</span>
                                  <span className="text-[9px] font-black uppercase tracking-[0.2em] text-[var(--ds-text-3)]">Past Bookings</span>
                                  <div className="flex-1 h-px bg-[var(--ds-border)]" />
                                </div>
                              </td>
                            </tr>
                          )}
                          <tr
                          onClick={() => { if (!isPast) { setEditBooking(b); setPanelOpen(true) } }}
                          className={`border-b border-[var(--ds-border-sub)] transition-colors
                            ${isPast ? 'opacity-40' : 'hover:bg-[#adee2b]/5 cursor-pointer'}
                            ${i % 2 !== 0 ? 'bg-[var(--ds-bg-surface-2)]/50' : ''}`}
                          style={{ animation: 'tbl-row-enter 0.22s ease-out backwards', animationDelay: `${Math.min(i * 28, 320)}ms` }}
                        >
                          <td className="px-4 py-3 text-xs font-black text-[var(--ds-text-1)] whitespace-nowrap">{fmtTableDate(b.start_at, language)}</td>
                          <td className="px-4 py-3 text-xs font-bold text-[var(--ds-text-3)] whitespace-nowrap">{fmtTableDay(b.start_at, language)}</td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <p className="text-sm font-black text-[var(--ds-text-1)] tabular-nums">{fmtTime(b.start_at, language)} &ndash; {fmtTime(b.end_at, language)}</p>
                            <p className="text-[10px] font-bold text-[var(--ds-text-3)] mt-0.5">{dur(b.start_at, b.end_at)}</p>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <p className="text-xs font-bold text-[var(--ds-text-2)]">{b.room?.name}</p>
                            <p className="text-[9px] font-bold text-[var(--ds-text-4)]">{b.room?.floor}</p>
                          </td>
                          <td className="px-4 py-3 text-xs font-black text-[var(--ds-text-1)] max-w-[160px] truncate">{b.title}</td>
                          <td className="px-4 py-3 max-w-[200px]"
                            onMouseEnter={e => b.description && setDescTooltip({ text: b.description, x: e.clientX, y: e.clientY })}
                            onMouseMove={e => b.description && setDescTooltip(prev => prev ? { ...prev, x: e.clientX, y: e.clientY } : null)}
                            onMouseLeave={() => setDescTooltip(null)}
                          >
                            {b.description
                              ? <span className="text-xs text-[var(--ds-text-3)] truncate block max-w-[180px] cursor-default">{b.description}</span>
                              : <span className="text-[var(--ds-text-4)] text-xs">&mdash;</span>
                            }
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex flex-col gap-1 items-start">
                              <span className={`text-[8px] font-black uppercase px-2.5 py-1 rounded-full whitespace-nowrap
                                ${isConf ? 'bg-[#adee2b] text-black' : 'bg-[var(--ds-bg-raised)] text-[var(--ds-text-2)]'}`}>
                                {b.status}
                              </span>
                              {b.series_id && (
                                <span className="inline-flex items-center gap-0.5 text-[7px] font-black uppercase px-1.5 py-0.5 rounded-full whitespace-nowrap bg-blue-500/10 text-blue-500 dark:text-blue-400">
                                  <span className="material-symbols-outlined" style={{ fontSize: 9 }}>repeat</span>
                                  series
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-[8px] font-black uppercase px-2.5 py-1 rounded-full whitespace-nowrap"
                              style={{ backgroundColor: tStyle.bg, color: tStyle.text }}>
                              {tStyle.label}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            {!isPast && (
                              <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                                <button onClick={() => { setEditBooking(b); setPanelOpen(true) }} title="Edit"
                                  className="size-7 flex items-center justify-center rounded-lg bg-[var(--ds-bg-raised)] text-[var(--ds-text-2)] hover:bg-black hover:text-[#adee2b] transition-all">
                                  <span className="material-symbols-outlined" style={{ fontSize: 14 }}>edit</span>
                                </button>
                                <button onClick={() => handleCancel(b)} disabled={pendingCancelIds.has(b.id)} title="Cancel"
                                  className="size-7 flex items-center justify-center rounded-lg bg-[var(--ds-bg-raised)] text-[var(--ds-text-2)] hover:bg-red-500/15 hover:text-red-500 transition-all disabled:opacity-40">
                                  <span className="material-symbols-outlined" style={{ fontSize: 14 }}>cancel</span>
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                        </Fragment>
                      )
                    })}
                    {pastInAll.length > 5 && (
                      <tr>
                        <td colSpan={9} className="px-4 py-3 bg-[var(--ds-bg-surface-2)]">
                          <button
                            onClick={() => setActiveTab('past')}
                            className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-[var(--ds-text-3)] hover:text-[var(--ds-text-1)] transition-colors group/more"
                          >
                            <span className="material-symbols-outlined group-hover/more:text-[var(--ds-text-1)] transition-colors" style={{ fontSize: 14 }}>history</span>
                            Show {pastInAll.length - 5} more past booking{pastInAll.length - 5 !== 1 ? 's' : ''} →
                          </button>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
                </div>
              </div>
              </div>
              ) : activeTab === 'special' ? null : (
              <div key={viewAnimKey} className="space-y-8" style={{ animation: 'view-slide-in 0.22s cubic-bezier(0.4,0,0.2,1)' }}>
              {isSecondary && activeTab === 'cancelled' && (
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-black uppercase tracking-widest text-[var(--ds-text-3)]">
                    Cancelled bookings within &plusmn;7 days
                  </p>
                  {cancelledList.length > 0 && (
                    <button
                      onClick={() => setClearConfirm(true)}
                      className="flex items-center gap-2 text-[11px] font-black uppercase tracking-wide text-red-400 hover:text-red-600 transition-colors px-3.5 py-2 rounded-xl border border-red-500/20 hover:border-red-500/30 hover:bg-red-500/10"
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: 16 }}>delete_sweep</span>
                      Clear All
                    </button>
                  )}
                </div>
              )}
              {activeTab === 'today' && activeList.length === 0 && todayPastList.length > 0 && (
                <div className="flex flex-col items-center justify-center py-12 gap-2 text-[var(--ds-text-4)]">
                  <span className="material-symbols-outlined text-4xl">wb_sunny</span>
                  <p className="text-sm font-black uppercase">All done for today</p>
                </div>
              )}
              {grouped.map(([dateKey, bookings]) => (
                <div key={dateKey}>
                  <div className="flex items-center gap-3 mb-3">
                    <p className={`text-[10px] font-black uppercase tracking-[0.2em] whitespace-nowrap
                      ${activeTab === 'cancelled' ? 'text-red-400'
                        : activeTab === 'tentative' ? 'text-amber-400'
                        : 'text-[var(--ds-text-3)]'}`}>
                      {fmtGroupLabel(bookings[0].start_at, t('label_today'), t('label_tomorrow'), language)}
                    </p>
                    <div className={`flex-1 h-px
                      ${activeTab === 'cancelled' ? 'bg-red-500/20'
                        : activeTab === 'tentative' ? 'bg-amber-500/20'
                        : 'bg-[var(--ds-border)]'}`} />
                    <span className="text-[9px] font-black text-[var(--ds-text-4)]">{bookings.length}</span>
                  </div>
                  {viewMode === 'card' ? (
                    <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))' }}>
                      {bookings.map((b, idx) => (
                        <SlideWrapper key={b.id} exiting={exitingCancelIds.has(b.id)}>
                          <BookingCard b={b} index={idx} {...cardSharedProps} />
                        </SlideWrapper>
                      ))}
                    </div>
                  ) : (
                    <div>
                      {bookings.map((b, idx) => (
                        <SlideWrapper key={b.id} exiting={exitingCancelIds.has(b.id)}>
                          <div style={{ paddingBottom: idx < bookings.length - 1 ? 8 : 0 }}>
                            <BookingListItem b={b} index={idx} {...cardSharedProps} />
                          </div>
                        </SlideWrapper>
                      ))}
                    </div>
                  )}
                </div>
              ))}

              {/* Today — past group */}
              {activeTab === 'today' && todayPastList.length > 0 && (
                <div className={activeList.length > 0 ? 'mt-8' : ''}>
                  <div className="flex items-center gap-3 mb-3">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] whitespace-nowrap text-[var(--ds-text-4)]">Earlier Today</p>
                    <div className="flex-1 h-px bg-[var(--ds-border)]" />
                    <span className="text-[9px] font-black text-[var(--ds-text-4)]">{todayPastList.length}</span>
                  </div>
                  <div className="opacity-50">
                    {viewMode === 'card' ? (
                      <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))' }}>
                        {todayPastList.map((b, idx) => (
                          <SlideWrapper key={b.id} exiting={exitingCancelIds.has(b.id)}>
                            <BookingCard b={b} index={idx} {...cardSharedProps} />
                          </SlideWrapper>
                        ))}
                      </div>
                    ) : (
                      <div>
                        {todayPastList.map((b, idx) => (
                          <SlideWrapper key={b.id} exiting={exitingCancelIds.has(b.id)}>
                            <div style={{ paddingBottom: idx < todayPastList.length - 1 ? 8 : 0 }}>
                              <BookingListItem b={b} index={idx} {...cardSharedProps} />
                            </div>
                          </SlideWrapper>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
              )}
            </>
          )}
        </div>

      </div>

      {/* Click-outside backdrop for overview dropdown */}
      {overviewOpen && (
        <div className="fixed inset-0 z-[49]" onClick={() => setOverviewOpen(false)} />
      )}

      <BookingPanel
        open={panelOpen}
        onClose={() => { setPanelOpen(false); setPanelPrefillDate(undefined) }}
        editBooking={editBooking}
        prefillDate={panelPrefillDate}
        buildingId={buildingFilter ?? defaultBuilding}
        onSubmit={() => {
          setPanelOpen(false)
          setPanelPrefillDate(undefined)
          queryClient.invalidateQueries({ queryKey: ['my-bookings'] })
          queryClient.invalidateQueries({ queryKey: ['all-my-bookings', user?.id] })
          queryClient.invalidateQueries({ queryKey: ['bookings'] })
          queryClient.refetchQueries({ queryKey: ['special-bookings'] })
        }}
        onCancel={(b) => { setPanelOpen(false); setPanelPrefillDate(undefined); handleCancel(b) }}
      />

      {/* H-Calendar day timeline hover tooltip */}
      {hCalTimelineHover && activeTab === 'hcal' && (() => {
        const ttB = (myBookings as Booking[]).find(b => b.id === hCalTimelineHover.bookingId)
        if (!ttB) return null
        const isConf = ttB.status === 'confirmed'
        const isTent = ttB.status === 'tentative'
        const accentColor = isConf ? '#adee2b' : isTent ? '#fbbf24' : '#fca5a5'
        return (
          <div className="fixed pointer-events-none z-[9999]" style={{ left: hCalTimelineHover.x, top: hCalTimelineHover.y - 12, transform: 'translate(-50%, -100%)' }}>
            <div style={{
              background: 'rgba(15,20,45,0.82)',
              backdropFilter: 'blur(28px) saturate(180%)',
              WebkitBackdropFilter: 'blur(28px) saturate(180%)',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: 14,
              padding: '10px 13px',
              minWidth: 190,
              boxShadow: '0 12px 32px rgba(0,0,0,0.35)',
              animation: 'toast-in 0.12s cubic-bezier(0.34,1.04,0.64,1)',
            }}>
              <p style={{ fontSize: 10, fontWeight: 900, color: accentColor, letterSpacing: '0.1em', marginBottom: 6, textTransform: 'uppercase' }}>{ttB.status}</p>
              <p style={{ fontSize: 16, fontWeight: 900, color: 'white', lineHeight: 1.2, marginBottom: 5 }}>{ttB.title}</p>
              <p style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.55)' }}>
                {ttB.room?.name}{ttB.room?.building ? ` · ${ttB.room.building.code || ttB.room.building.name}` : ''}
              </p>
              <p style={{ fontSize: 13, fontWeight: 900, color: 'rgba(255,255,255,0.8)', marginTop: 6, tabularNums: true } as React.CSSProperties}>
                {fmtTime(ttB.start_at, language)} – {fmtTime(ttB.end_at, language)}
                <span style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.4)', marginLeft: 6 }}>{dur(ttB.start_at, ttB.end_at)}</span>
              </p>
            </div>
            <div style={{ width: 0, height: 0, borderLeft: '6px solid transparent', borderRight: '6px solid transparent', borderTop: '6px solid rgba(15,20,45,0.82)', margin: '0 auto' }} />
          </div>
        )
      })()}

      {/* Fixed description tooltip (avoids table overflow-hidden clipping) */}
      {descTooltip && (
        <div
          className="fixed pointer-events-none z-[9999]"
          style={{ left: descTooltip.x + 16, top: descTooltip.y - 88 }}
        >
          <div className="bg-slate-900/95 backdrop-blur-md border border-white/10 text-white text-xs font-medium px-4 py-3 rounded-2xl shadow-2xl leading-relaxed max-w-[320px]">
            {descTooltip.text}
          </div>
          <div className="absolute top-full left-5 w-2.5 h-2.5 bg-slate-900/95 border-r border-b border-white/10 rotate-45 -mt-1.5" />
        </div>
      )}

      <style>{`
        @keyframes overview-card-in{from{opacity:0;transform:translateY(-6px) scale(0.96)}to{opacity:1;transform:translateY(0) scale(1)}}
        @keyframes overview-dropdown-in{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:translateY(0)}}
        @keyframes view-slide-in{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
      `}</style>

      {/* Cancel confirm modal */}
      {(cancelTarget || clearConfirm || !!seriesCancelTarget) && (
        <style>{`@keyframes sp-modal-in{from{opacity:0;transform:scale(0.93) translateY(10px)}to{opacity:1;transform:scale(1) translateY(0)}}`}</style>
      )}
      {cancelTarget && (
        <div
          className="fixed inset-0 z-[1000] flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.28)', backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)' }}
          onClick={() => setCancelTarget(null)}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              width: 380,
              background: 'var(--ds-glass-bg)',
              backdropFilter: 'blur(48px) saturate(200%)',
              WebkitBackdropFilter: 'blur(48px) saturate(200%)',
              border: '1px solid var(--ds-glass-border)',
              borderRadius: 22,
              boxShadow: 'var(--ds-glass-shadow)',
              padding: 28,
              animation: 'sp-modal-in 0.18s cubic-bezier(0.4,0,0.2,1)',
            }}
          >
            <div className="flex items-center gap-3.5 mb-6">
              <div className="size-11 rounded-2xl flex items-center justify-center shrink-0"
                style={{ background: 'rgba(239,68,68,0.1)' }}>
                <span className="material-symbols-outlined text-red-500 text-xl">cancel</span>
              </div>
              <div>
                <h3 className="text-base font-black text-[var(--ds-text-1)]">Cancel Booking?</h3>
                <p className="text-xs text-[var(--ds-text-3)] font-medium mt-0.5">This action cannot be undone.</p>
              </div>
            </div>
            <div className="rounded-2xl p-4 mb-6 space-y-2.5"
              style={{ background: 'var(--ds-bg-surface-2)', border: '1px solid var(--ds-border-sub)' }}>
              <p className="text-sm font-black text-[var(--ds-text-1)] leading-snug">{cancelTarget.title}</p>
              <div className="w-full h-px" style={{ background: 'var(--ds-border-sub)' }} />
              <p className="text-xs font-bold text-[var(--ds-text-2)] flex items-center gap-2">
                <span className="material-symbols-outlined text-[var(--ds-text-3)] shrink-0" style={{ fontSize: 14 }}>location_on</span>
                {cancelTarget.room?.name} &middot; {cancelTarget.room?.floor}
              </p>
              <p className="text-xs font-bold text-[var(--ds-text-2)] flex items-center gap-2">
                <span className="material-symbols-outlined text-[var(--ds-text-3)] shrink-0" style={{ fontSize: 14 }}>schedule</span>
                {fmtTime(cancelTarget.start_at, language)} &ndash; {fmtTime(cancelTarget.end_at, language)} &middot; {dur(cancelTarget.start_at, cancelTarget.end_at)}
              </p>
              <p className="text-xs font-bold text-[var(--ds-text-2)] flex items-center gap-2">
                <span className="material-symbols-outlined text-[var(--ds-text-3)] shrink-0" style={{ fontSize: 14 }}>calendar_today</span>
                {fmtTableDate(cancelTarget.start_at, language)} &middot; {fmtTableDay(cancelTarget.start_at, language)}
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setCancelTarget(null)}
                className="flex-1 py-3 rounded-2xl text-[11px] font-black uppercase transition-colors"
                style={{ background: 'var(--ds-bg-raised)', color: 'var(--ds-text-2)' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--ds-border)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'var(--ds-bg-raised)')}
              >
                Keep Booking
              </button>
              <button
                onClick={confirmCancel}
                className="flex-1 py-3 rounded-2xl text-[11px] font-black uppercase bg-red-500 text-white hover:bg-red-600 transition-colors"
              >
                Yes, Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tentative action popup */}
      {tentativeTarget && (
        <div
          className="fixed inset-0 z-[1000] flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.28)', backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)' }}
          onClick={() => setTentativeTarget(null)}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              width: 400,
              background: 'var(--ds-glass-bg)',
              backdropFilter: 'blur(48px) saturate(200%)',
              WebkitBackdropFilter: 'blur(48px) saturate(200%)',
              border: '1px solid var(--ds-glass-border)',
              borderRadius: 22,
              boxShadow: 'var(--ds-glass-shadow)',
              padding: 28,
              animation: 'sp-modal-in 0.18s cubic-bezier(0.4,0,0.2,1)',
            }}
          >
            <div className="flex items-center gap-3.5 mb-5">
              <div className="size-11 rounded-2xl flex items-center justify-center shrink-0"
                style={{ background: 'rgba(245,158,11,0.12)' }}>
                <span className="material-symbols-outlined text-xl" style={{ color: '#d97706' }}>pending_actions</span>
              </div>
              <div>
                <h3 className="text-base font-black text-[var(--ds-text-1)]">Manage Tentative Booking</h3>
                <p className="text-xs text-[var(--ds-text-3)] font-medium mt-0.5">What would you like to do with this booking?</p>
              </div>
            </div>

            <div className="rounded-2xl p-4 mb-5 space-y-2"
              style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.15)' }}>
              <p className="text-sm font-black text-[var(--ds-text-1)] leading-snug">{tentativeTarget.title}</p>
              <div className="w-full h-px" style={{ background: 'var(--ds-border-sub)' }} />
              <p className="text-xs font-bold text-[var(--ds-text-2)] flex items-center gap-2">
                <span className="material-symbols-outlined text-[var(--ds-text-3)] shrink-0" style={{ fontSize: 14 }}>location_on</span>
                {tentativeTarget.room?.name}
              </p>
              <p className="text-xs font-bold text-[var(--ds-text-2)] flex items-center gap-2">
                <span className="material-symbols-outlined text-[var(--ds-text-3)] shrink-0" style={{ fontSize: 14 }}>schedule</span>
                {fmtTableDate(tentativeTarget.start_at, language)} &middot; {fmtTime(tentativeTarget.start_at, language)} &ndash; {fmtTime(tentativeTarget.end_at, language)}
              </p>
            </div>

            <div className="space-y-2">
              <button
                onClick={() => handleTentativeAction('confirm')}
                disabled={tentativeConfirming}
                className="w-full py-3 rounded-2xl text-[12px] font-black uppercase tracking-wide bg-[#adee2b] text-black hover:bg-[#9fe020] active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                style={{ transformOrigin: 'center' }}
              >
                <span className="material-symbols-outlined text-base">check_circle</span>
                Confirm Booking
              </button>
              <button
                onClick={() => { const b = tentativeTarget; setTentativeTarget(null); setEditBooking(b); setPanelOpen(true) }}
                className="w-full py-3 rounded-2xl text-[12px] font-black uppercase tracking-wide bg-blue-50 text-blue-600 hover:bg-blue-500 hover:text-white active:scale-95 transition-all flex items-center justify-center gap-2"
                style={{ transformOrigin: 'center' }}
              >
                <span className="material-symbols-outlined text-base">edit</span>
                Edit Booking
              </button>
              <button
                onClick={() => setTentativeTarget(null)}
                className="w-full py-3 rounded-2xl text-[12px] font-black uppercase tracking-wide active:scale-95 transition-all flex items-center justify-center gap-2"
                style={{ background: 'var(--ds-bg-raised)', color: 'var(--ds-text-2)', transformOrigin: 'center' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--ds-border)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'var(--ds-bg-raised)')}
              >
                <span className="material-symbols-outlined text-base">hourglass_empty</span>
                Keep Tentative
              </button>
              <button
                onClick={() => handleTentativeAction('cancel')}
                disabled={tentativeConfirming}
                className="w-full py-3 rounded-2xl text-[12px] font-black uppercase tracking-wide bg-red-50 text-red-500 hover:bg-red-500 hover:text-white active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                style={{ transformOrigin: 'center' }}
              >
                <span className="material-symbols-outlined text-base">cancel</span>
                Cancel Booking
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Series cancel confirm modal */}
      {seriesCancelTarget && (
        <div
          className="fixed inset-0 z-[1000] flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.28)', backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)' }}
          onClick={() => setSeriesCancelTarget(null)}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              width: 400,
              background: 'var(--ds-glass-bg)',
              backdropFilter: 'blur(48px) saturate(200%)',
              WebkitBackdropFilter: 'blur(48px) saturate(200%)',
              border: '1px solid var(--ds-glass-border)',
              borderRadius: 22,
              boxShadow: 'var(--ds-glass-shadow)',
              padding: 28,
              animation: 'sp-modal-in 0.18s cubic-bezier(0.4,0,0.2,1)',
            }}
          >
            <div className="flex items-center gap-3.5 mb-5">
              <div className="size-11 rounded-2xl flex items-center justify-center shrink-0"
                style={{ background: 'rgba(239,68,68,0.1)' }}>
                <span className="material-symbols-outlined text-red-500 text-xl">repeat</span>
              </div>
              <div>
                <h3 className="text-base font-black text-[var(--ds-text-1)]">Cancel Entire Series?</h3>
                <p className="text-xs text-[var(--ds-text-3)] font-medium mt-0.5">All {seriesCancelTarget.bookings.filter(b => b.status !== 'cancelled').length} active bookings in this series will be cancelled.</p>
              </div>
            </div>
            <div className="rounded-2xl p-4 mb-6 space-y-2"
              style={{ background: 'var(--ds-bg-surface-2)', border: '1px solid var(--ds-border-sub)' }}>
              <p className="text-sm font-black text-[var(--ds-text-1)]">{seriesCancelTarget.bookings[0].title}</p>
              <p className="text-xs font-bold text-[var(--ds-text-2)] flex items-center gap-2">
                <span className="material-symbols-outlined text-[var(--ds-text-3)] shrink-0" style={{ fontSize: 14 }}>location_on</span>
                {seriesCancelTarget.bookings[0].room?.name}
              </p>
              <p className="text-xs font-bold text-[var(--ds-text-2)] flex items-center gap-2">
                <span className="material-symbols-outlined text-[var(--ds-text-3)] shrink-0" style={{ fontSize: 14 }}>repeat</span>
                {seriesCancelTarget.bookings.length} dates in this series
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setSeriesCancelTarget(null)}
                className="flex-1 py-3 rounded-2xl text-[11px] font-black uppercase transition-colors"
                style={{ background: 'var(--ds-bg-raised)', color: 'var(--ds-text-2)' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--ds-border)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'var(--ds-bg-raised)')}
              >
                Keep Series
              </button>
              <button
                onClick={doConfirmSeriesCancel}
                className="flex-1 py-3 rounded-2xl text-[11px] font-black uppercase bg-red-500 text-white hover:bg-red-600 transition-colors"
              >
                Yes, Cancel Series
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Clear cancelled modal */}
      {clearConfirm && (
        <div
          className="fixed inset-0 z-[1000] flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.28)', backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)' }}
          onClick={() => setClearConfirm(false)}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              width: 380,
              background: 'var(--ds-glass-bg)',
              backdropFilter: 'blur(48px) saturate(200%)',
              WebkitBackdropFilter: 'blur(48px) saturate(200%)',
              border: '1px solid var(--ds-glass-border)',
              borderRadius: 22,
              boxShadow: 'var(--ds-glass-shadow)',
              padding: 28,
              animation: 'sp-modal-in 0.18s cubic-bezier(0.4,0,0.2,1)',
            }}
          >
            <div className="flex items-center gap-3.5 mb-5">
              <div className="size-11 rounded-2xl flex items-center justify-center shrink-0"
                style={{ background: 'rgba(239,68,68,0.1)' }}>
                <span className="material-symbols-outlined text-red-500 text-xl">delete_sweep</span>
              </div>
              <div>
                <h3 className="text-base font-black text-[var(--ds-text-1)]">Clear Cancelled Bookings?</h3>
                <p className="text-xs text-[var(--ds-text-3)] font-medium mt-0.5">All {cancelledList.length} cancelled booking{cancelledList.length !== 1 ? 's' : ''} will be permanently removed.</p>
              </div>
            </div>
            <div className="rounded-2xl p-4 mb-6"
              style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.12)' }}>
              <p className="text-xs font-bold text-red-500 leading-relaxed">
                This permanently deletes all your cancelled bookings from history. This cannot be undone.
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setClearConfirm(false)}
                className="flex-1 py-3 rounded-2xl text-[11px] font-black uppercase transition-colors"
                style={{ background: 'var(--ds-bg-raised)', color: 'var(--ds-text-2)' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--ds-border)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'var(--ds-bg-raised)')}
              >
                Keep
              </button>
              <button
                onClick={doClearCancelled}
                className="flex-1 py-3 rounded-2xl text-[11px] font-black uppercase bg-red-500 text-white hover:bg-red-600 transition-colors"
              >
                Clear All
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
