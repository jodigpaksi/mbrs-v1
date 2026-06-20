import { useState, useRef, useEffect, useMemo, Fragment, type ReactNode } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import * as XLSX from 'xlsx'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { Booking } from '../types/index'
import { getMyBookings, cancelBooking, clearCancelledBookings, getBookings, updateBooking, cancelSeries } from '../api/bookings'
import { useAuth } from '../context/AuthContext'
import { useSettings } from '../context/SettingsContext'
import BookingPanel from '../components/booking/BookingPanel'
import { useBookingHours } from '../hooks/useBookingHours'
import { useWeekendSettings } from '../hooks/useWeekendSettings'

function parseLocal(iso: string) { return new Date(iso.replace('Z', '')) }
function dur(start: string, end: string) {
  const diff = (parseLocal(end).getTime() - parseLocal(start).getTime()) / 60000
  const h = Math.floor(diff / 60), m = diff % 60
  return h && m ? `${h}h ${m}m` : h ? `${h}h` : `${m}m`
}
function fmtTime(iso: string) {
  return parseLocal(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}
function fmtGroupLabel(iso: string) {
  const d = parseLocal(iso), today = new Date(), tomorrow = new Date()
  tomorrow.setDate(today.getDate() + 1)
  if (d.toDateString() === today.toDateString()) return 'Today'
  if (d.toDateString() === tomorrow.toDateString()) return 'Tomorrow'
  return d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).toUpperCase()
}
function fmtTableDate(iso: string) {
  return parseLocal(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
}
function fmtTableDay(iso: string) {
  return parseLocal(iso).toLocaleDateString('en-GB', { weekday: 'short' })
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
  internal: { bg: '#dbeafe', text: '#1d4ed8', label: 'Internal' },
  external: { bg: '#ffedd5', text: '#c2410c', label: 'External' },
}

type Tab = 'today' | 'upcoming' | 'all' | 'past' | 'cancelled' | 'tentative' | 'series' | 'hcal'
type AllSortKey = 'start_at' | 'title' | 'room' | 'status' | 'type'
type AllSortDir = 'asc' | 'desc'

const TAB_META: Record<Tab, { color: string; indicatorColor: string }> = {
  today:     { color: 'text-black',        indicatorColor: '#000' },
  upcoming:  { color: 'text-black',        indicatorColor: '#000' },
  all:       { color: 'text-black',        indicatorColor: '#000' },
  past:      { color: 'text-slate-500',    indicatorColor: '#64748b' },
  cancelled: { color: 'text-red-500',      indicatorColor: '#ef4444' },
  tentative: { color: 'text-amber-500',    indicatorColor: '#f59e0b' },
  series:    { color: 'text-blue-500',     indicatorColor: '#3b82f6' },
  hcal:      { color: 'text-violet-500',   indicatorColor: '#7c3aed' },
}

const PRIMARY_TABS: Tab[] = ['today', 'upcoming', 'all']
const SECONDARY_TABS: Tab[] = ['past', 'cancelled', 'tentative', 'series', 'hcal']

const TAB_TOOLTIP: Partial<Record<Tab, string>> = {
  past: 'Last 30 days only',
  cancelled: 'Within ±7 days',
}

interface ToastItem {
  id: string
  bookingId: number
  msg: string
  countdown: number
  isUndo: boolean
}

interface CardSharedProps {
  activeTab: Tab
  pendingCancelIds: Set<number>
  exitingCancelIds: Set<number>
  onEdit: (b: Booking) => void
  onCancel: (b: Booking) => void
  onTentativeAction?: (b: Booking) => void
}

function BookingCard({ b, index = 0, activeTab, pendingCancelIds, exitingCancelIds, onEdit, onCancel, onTentativeAction }: { b: Booking; index?: number } & CardSharedProps) {
  const isConf = b.status === 'confirmed'
  const isCancelled = b.status === 'cancelled'
  const isTentative = b.status === 'tentative'
  const isPast = isActuallyPast(b)
  const isPastTab = activeTab === 'past'
  const isPending = pendingCancelIds.has(b.id)
  const isExiting = exitingCancelIds.has(b.id)
  const canEdit = !isPast && !isCancelled
  const tStyle = typeStyle[b.type] || typeStyle.internal

  const cardBg = isCancelled ? 'bg-red-50 border border-red-100'
    : isConf ? 'bg-[#adee2b]' : ''
  const titleClr = isPastTab ? 'text-slate-500' : isCancelled ? 'text-red-700' : isTentative ? 'text-slate-600' : isConf ? 'text-black' : 'text-slate-700'
  const loc  = isPastTab ? 'text-slate-400' : isCancelled ? 'text-red-400' : isTentative ? 'text-slate-400' : isConf ? 'text-black/50' : 'text-slate-400'
  const desc = isPastTab ? 'text-slate-400' : isCancelled ? 'text-red-300' : isTentative ? 'text-slate-400' : isConf ? 'text-black/40' : 'text-slate-400'
  const t1   = isPastTab ? 'text-slate-500' : isCancelled ? 'text-red-400' : isTentative ? 'text-slate-500' : isConf ? 'text-black/80' : 'text-slate-500'
  const t2   = isPastTab ? 'text-slate-400' : isCancelled ? 'text-red-300' : isTentative ? 'text-slate-400' : isConf ? 'text-black/50' : 'text-slate-400'
  const td   = isPastTab ? 'text-slate-300' : isCancelled ? 'text-red-200' : isTentative ? 'text-slate-300' : isConf ? 'text-black/30' : 'text-slate-300'
  const badge = isPastTab ? 'bg-slate-100 text-slate-500'
    : isCancelled ? 'bg-red-200 text-red-600'
    : isPast ? 'bg-slate-200 text-slate-400' : isConf ? 'bg-black text-[#adee2b]' : 'bg-slate-100 text-slate-500'

  const TENTATIVE_HATCH_BG = '#f5f6f8'
  const TENTATIVE_HATCH_IMG = 'repeating-linear-gradient(45deg,transparent,transparent 5px,rgba(0,0,0,0.025) 5px,rgba(0,0,0,0.025) 10px)'
  const TENTATIVE_BADGE_HATCH = 'repeating-linear-gradient(45deg,transparent,transparent 3px,rgba(0,0,0,0.03) 3px,rgba(0,0,0,0.03) 6px)'

  const baseCardStyle = isTentative
    ? { backgroundColor: TENTATIVE_HATCH_BG, backgroundImage: TENTATIVE_HATCH_IMG, border: '1px solid #dde0e4' }
    : (!isCancelled && !isConf)
      ? { background: isPastTab ? '#f8f9fb' : 'var(--ds-bg-surface)', border: '1px solid var(--ds-border-sub)' }
      : {}

  return (
    <div
      onClick={() => { if (canEdit) { if (isTentative && onTentativeAction) onTentativeAction(b); else onEdit(b) } }}
      className={`rounded-2xl p-5 group ${cardBg} ${canEdit ? 'cursor-pointer hover:-translate-y-0.5 hover:shadow-md' : ''}`}
      style={{
        ...baseCardStyle,
        animation: `card-in 0.25s cubic-bezier(0.4,0,0.2,1) ${index * 45}ms both`,
        opacity: isExiting ? 0 : isPending ? 0.3 : 1,
        transform: isExiting ? 'scale(0.95)' : isPending ? 'scale(0.98)' : undefined,
        outline: isPending ? '2px solid #fca5a5' : 'none',
        outlineOffset: -2,
        transition: 'opacity 0.35s ease, transform 0.35s ease, box-shadow 0.2s',
      }}
    >
      <div className="flex items-center gap-2 mb-3">
        <span
          className={`text-[9px] font-black uppercase px-2.5 py-1 rounded-full ${isTentative ? '' : badge}`}
          style={isTentative ? { backgroundColor: '#e4e6ea', backgroundImage: TENTATIVE_BADGE_HATCH, color: '#4b5563' } : undefined}
        >{b.status}</span>
        <span className="text-[9px] font-black uppercase px-2.5 py-1 rounded-full"
          style={{ backgroundColor: tStyle.bg, color: tStyle.text }}>{tStyle.label}</span>
        {b.series_id && (
          <span className="flex items-center gap-0.5 text-[8px] font-black uppercase px-2 py-1 rounded-full bg-blue-50 text-blue-500">
            <span className="material-symbols-outlined" style={{ fontSize: 10 }}>link</span>Series
          </span>
        )}
      </div>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h4 className={`text-base font-black uppercase tracking-tight leading-tight ${titleClr}`}>{b.title}</h4>
          {b.description && <p className={`text-sm font-medium mt-1.5 leading-relaxed line-clamp-2 ${desc}`}>{b.description}</p>}
          <p className={`text-[11px] font-bold mt-2 flex items-center gap-1.5 flex-wrap ${loc}`}>
            <span className="material-symbols-outlined" style={{ fontSize: 13 }}>meeting_room</span>{b.room?.name}
            {b.room?.building && (
              <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${isConf ? 'bg-black/10 text-black/50' : isTentative ? 'bg-slate-200 text-slate-500' : isCancelled ? 'bg-red-100 text-red-400' : 'bg-slate-200 text-slate-500'}`}>
                {b.room.building.code || b.room.building.name}
              </span>
            )}
          </p>
        </div>
        <div className="text-right shrink-0">
          {b.booked_for && !b.is_recipient && (
            <p className="text-[9px] font-black text-slate-400 mb-1.5 truncate max-w-[110px]">for {b.booked_for}</p>
          )}
          {b.is_recipient && (
            <p className="text-[9px] font-black mb-1.5 truncate max-w-[110px]" style={{ color: '#6b9900' }}>by {b.user?.name}</p>
          )}
          <p className={`text-2xl font-black tabular-nums leading-none ${t1}`}>{fmtTime(b.start_at)}</p>
          <p className={`text-sm font-bold mt-1 ${t2}`}>{fmtTime(b.end_at)}</p>
          <p className={`text-[11px] font-bold mt-0.5 ${td}`}>{dur(b.start_at, b.end_at)}</p>
        </div>
      </div>
      {canEdit && (
        <div className={`flex items-center justify-between mt-4 pt-3 border-t ${isConf ? 'border-black/10' : 'border-slate-100'}`}>
          <span className="text-[9px] font-black uppercase tracking-wider flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity text-black/40">
            <span className="material-symbols-outlined" style={{ fontSize: 12 }}>{isTentative ? 'tune' : 'edit'}</span>{isTentative ? 'Click to manage' : 'Click to edit'}
          </span>
          <button onClick={e => { e.stopPropagation(); onCancel(b) }} disabled={isPending}
            className={`px-3 py-1.5 rounded-xl text-[11px] font-black uppercase transition-all disabled:opacity-40
              ${isConf ? 'bg-black/10 text-black/50 hover:bg-black hover:text-[#adee2b]' : 'bg-slate-100 text-slate-400 hover:bg-red-50 hover:text-red-500'}`}>
            Cancel
          </button>
        </div>
      )}
    </div>
  )
}

function BookingListItem({ b, index = 0, activeTab, pendingCancelIds, exitingCancelIds, onEdit, onCancel, onTentativeAction }: { b: Booking; index?: number } & CardSharedProps) {
  const isConf = b.status === 'confirmed'
  const isCancelled = b.status === 'cancelled'
  const isTentative = b.status === 'tentative'
  const isPast = isActuallyPast(b)
  const isPastTab = activeTab === 'past'
  const isPending = pendingCancelIds.has(b.id)
  const isExiting = exitingCancelIds.has(b.id)
  const canEdit = !isPast && !isCancelled
  const tStyle = typeStyle[b.type] || typeStyle.internal

  const rowBg = isCancelled ? 'bg-red-50 border-red-100'
    : isConf ? 'bg-[#adee2b] border-transparent' : ''
  const dot     = isPastTab ? 'bg-slate-300' : isCancelled ? 'bg-red-400' : isTentative ? 'bg-slate-400' : isConf ? 'bg-black' : 'bg-slate-400'
  const titleClr = isPastTab ? 'text-slate-500' : isCancelled ? 'text-red-700' : isTentative ? 'text-slate-600' : isConf ? 'text-black' : 'text-slate-700'
  const subClr  = isPastTab ? 'text-slate-400' : isCancelled ? 'text-red-400' : isTentative ? 'text-slate-400' : isConf ? 'text-black/50' : 'text-slate-400'
  const timeClr = isPastTab ? 'text-slate-500' : isCancelled ? 'text-red-400' : isTentative ? 'text-slate-500' : isConf ? 'text-black/80' : 'text-slate-700'
  const TENTATIVE_HATCH_BG = '#f5f6f8'
  const TENTATIVE_HATCH = 'repeating-linear-gradient(45deg,transparent,transparent 5px,rgba(0,0,0,0.025) 5px,rgba(0,0,0,0.025) 10px)'

  return (
    <div
      onClick={() => { if (canEdit) { if (isTentative && onTentativeAction) onTentativeAction(b); else onEdit(b) } }}
      className={`flex items-center gap-4 px-4 py-3 rounded-2xl border ${rowBg} ${canEdit ? 'cursor-pointer hover:shadow-sm' : ''}`}
      style={{
        ...(isTentative ? { backgroundColor: TENTATIVE_HATCH_BG, backgroundImage: TENTATIVE_HATCH, borderColor: '#dde0e4' } : !isCancelled && !isConf ? { background: 'var(--ds-bg-surface)', borderColor: 'var(--ds-border-sub)' } : {}),
        animation: `card-in 0.22s cubic-bezier(0.4,0,0.2,1) ${index * 35}ms both`,
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
          <span className={`text-[13px] font-black uppercase leading-tight shrink-0 ${titleClr}`}>{b.title}</span>
          <span className={`text-[10px] font-bold truncate ${subClr}`}>{b.room?.name}</span>
          {b.room?.building && (
            <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded-full shrink-0 ${isConf ? 'bg-black/10 text-black/50' : isTentative ? 'bg-slate-200 text-slate-500' : isCancelled ? 'bg-red-100 text-red-400' : 'bg-slate-200 text-slate-500'}`}>
              {b.room.building.code || b.room.building.name}
            </span>
          )}
        </div>
        {b.description && <p className={`text-[10px] font-medium truncate mt-0.5 ${subClr}`}>{b.description}</p>}
      </div>
      {b.booked_for && !b.is_recipient && (
        <span className="text-[8px] font-black px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 shrink-0">for {b.booked_for}</span>
      )}
      {b.is_recipient && (
        <span className="text-[8px] font-black px-2 py-0.5 rounded-full shrink-0" style={{ background: '#f7fee7', color: '#4d7c00' }}>by {b.user?.name}</span>
      )}
      <span className="text-[8px] font-black uppercase px-2 py-0.5 rounded-full shrink-0"
        style={{ backgroundColor: tStyle.bg, color: tStyle.text }}>{tStyle.label}</span>
      {b.series_id && (
        <span className="material-symbols-outlined text-blue-400 shrink-0" style={{ fontSize: 13 }} title="Series booking">link</span>
      )}
      <div className={`text-[11px] font-bold text-right shrink-0 leading-tight ${subClr}`}>
        <p>{fmtTableDate(b.start_at)}</p>
        <p className="opacity-60">{fmtTableDay(b.start_at)}</p>
      </div>
      <div className={`text-[12px] font-black tabular-nums shrink-0 ${timeClr}`}>
        {fmtTime(b.start_at)}–{fmtTime(b.end_at)}
      </div>
      {canEdit ? (
        <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
          <button onClick={() => { if (isTentative && onTentativeAction) onTentativeAction(b); else onEdit(b) }}
            className={`size-7 flex items-center justify-center rounded-lg transition-all ${isConf ? 'bg-black/10 text-black/60 hover:bg-black hover:text-[#adee2b]' : 'bg-slate-100 text-slate-400 hover:bg-black hover:text-[#adee2b]'}`}>
            <span className="material-symbols-outlined" style={{ fontSize: 13 }}>{isTentative ? 'tune' : 'edit'}</span>
          </button>
          <button onClick={() => onCancel(b)}
            className="size-7 flex items-center justify-center rounded-lg bg-slate-100/60 text-slate-400 hover:bg-red-50 hover:text-red-500 transition-all">
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
}: {
  group: SeriesGroup
  pendingCancelIds: Set<number>
  onEdit: (b: Booking) => void
  onCancel: (b: Booking) => void
  onCancelSeries: (group: SeriesGroup) => void
}) {
  const [open, setOpen] = useState(false)
  const { bookings } = group
  const first = bookings[0]
  const last = bookings[bookings.length - 1]

  const confirmedCount = bookings.filter(b => b.status === 'confirmed').length
  const tentativeCount = bookings.filter(b => b.status === 'tentative').length
  const cancelledCount = bookings.filter(b => b.status === 'cancelled').length
  const allCancelled = cancelledCount === bookings.length

  const fmtSeriesDate = (iso: string) =>
    parseLocal(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })

  const dateRange = first === last
    ? fmtSeriesDate(first.start_at)
    : `${fmtSeriesDate(first.start_at)} – ${fmtSeriesDate(last.start_at)}`

  return (
    <tbody>
      <tr
        className={`border-b border-slate-100 transition-colors hover:bg-blue-50/40 cursor-pointer ${allCancelled ? 'opacity-40' : ''}`}
        onClick={() => setOpen(o => !o)}
      >
        <td className="px-3 py-3.5">
          <span
            className="material-symbols-outlined text-slate-400 transition-transform duration-200"
            style={{ fontSize: 16, display: 'block', transform: open ? 'rotate(90deg)' : 'rotate(0deg)' }}
          >chevron_right</span>
        </td>
        <td className="px-3 py-3.5">
          <div>
            <p className="text-xs font-black text-slate-800">{first.room?.name ?? '—'}</p>
            {first.room?.building?.name && (
              <p className="text-[9px] font-bold text-slate-400 mt-0.5">{first.room.building.name}</p>
            )}
          </div>
        </td>
        <td className="px-3 py-3.5 text-xs font-black text-slate-700">{first.title}</td>
        <td className="px-3 py-3.5">
          <p className="text-xs font-bold text-slate-600 whitespace-nowrap">{dateRange}</p>
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
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-100 text-slate-600 text-[9px] font-black uppercase hover:bg-black hover:text-[#adee2b] transition-all"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 12 }}>edit</span>
              Series
            </button>
            {!allCancelled && (
              <button
                onClick={() => onCancelSeries(group)}
                title="Cancel entire series"
                className="size-7 flex items-center justify-center rounded-lg bg-slate-100 text-slate-400 hover:bg-red-50 hover:text-red-500 transition-all"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>cancel</span>
              </button>
            )}
          </div>
        </td>
      </tr>
      {open && bookings.map(b => {
        const isPast = isActuallyPast(b)
        const isConf = b.status === 'confirmed'
        const isCancelled = b.status === 'cancelled'
        return (
          <tr key={b.id} className={`border-b border-slate-50 bg-blue-50/20 ${isPast || isCancelled ? 'opacity-50' : ''}`}>
            <td className="pl-8 pr-3 py-2.5">
              <div className="w-3 h-px bg-slate-200 ml-1" />
            </td>
            <td className="px-3 py-2.5 text-[10px] text-slate-400 font-bold whitespace-nowrap">
              {fmtTableDate(b.start_at)} <span className="text-slate-300">{fmtTableDay(b.start_at)}</span>
            </td>
            <td className="px-3 py-2.5 text-[10px] font-bold text-slate-500 whitespace-nowrap tabular-nums">
              {fmtTime(b.start_at)} – {fmtTime(b.end_at)}
              <span className="text-slate-300 ml-1">{dur(b.start_at, b.end_at)}</span>
            </td>
            <td className="px-3 py-2.5" />
            <td className="px-3 py-2.5">
              <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-full
                ${isCancelled ? 'bg-red-100 text-red-400'
                  : isConf ? 'bg-[#adee2b] text-black'
                  : 'bg-amber-100 text-amber-600'}`}>
                {b.status}
              </span>
            </td>
            <td className="px-3 py-2.5" />
            <td className="px-3 py-2.5">
              {!isPast && !isCancelled && (
                <div className="flex items-center gap-1">
                  <button onClick={() => onEdit(b)} title="Edit this date"
                    className="size-6 flex items-center justify-center rounded-md bg-slate-100 text-slate-400 hover:bg-black hover:text-[#adee2b] transition-all">
                    <span className="material-symbols-outlined" style={{ fontSize: 12 }}>edit</span>
                  </button>
                  <button onClick={() => onCancel(b)} disabled={pendingCancelIds.has(b.id)} title="Cancel this date"
                    className="size-6 flex items-center justify-center rounded-md bg-slate-100 text-slate-400 hover:bg-red-50 hover:text-red-500 transition-all disabled:opacity-40">
                    <span className="material-symbols-outlined" style={{ fontSize: 12 }}>cancel</span>
                  </button>
                </div>
              )}
            </td>
          </tr>
        )
      })}
    </tbody>
  )
}

const MONTHS_LOWER = ['january','february','march','april','may','june','july','august','september','october','november','december']

function HCalCompactCard({ b, expanded, onToggle, onEdit, onCancel, clickable = true }: {
  b: Booking
  expanded: boolean
  onToggle: () => void
  onEdit: () => void
  onCancel: () => void
  clickable?: boolean
}) {
  const isConf = b.status === 'confirmed'
  const isCancelled = b.status === 'cancelled'
  const isTentative = b.status === 'tentative'
  const tStyle = typeStyle[b.type] ?? typeStyle.internal
  const accentBg = isConf ? '#adee2b' : isTentative ? '#fbbf24' : isCancelled ? '#fca5a5' : '#adee2b'
  const accentText = isConf ? 'rgba(0,0,0,0.75)' : isTentative ? '#78350f' : '#9f1239'
  const ACTION_H = 44
  return (
    <div style={{
      width: 210, flexShrink: 0, position: 'relative',
      paddingBottom: expanded ? 26 + ACTION_H : 26,
      transition: 'padding-bottom 0.3s cubic-bezier(0.34,1.04,0.64,1)',
    }}>
      {/* Dark action layer — deepest, peeks below accent when expanded */}
      <div style={{
        position: 'absolute', top: 16, left: 0, right: 0,
        bottom: expanded ? 0 : 8,
        background: '#0f172a', borderRadius: 18, zIndex: 0,
        display: 'flex', alignItems: 'flex-end',
        padding: '0 10px 10px', gap: 7,
        transition: 'bottom 0.3s cubic-bezier(0.34,1.04,0.64,1)',
      }}>
        <div style={{
          display: 'flex', width: '100%', gap: 7,
          opacity: expanded ? 1 : 0,
          transition: expanded ? 'opacity 0.18s ease 0.14s' : 'opacity 0.1s ease',
        }}>
          <button onClick={e => { e.stopPropagation(); onEdit() }} style={{
            flex: 1, background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.18)',
            borderRadius: 9, padding: '7px 0', color: 'white',
            fontSize: 9, fontWeight: 900, letterSpacing: '0.08em', textTransform: 'uppercase', cursor: 'pointer',
          }}>Edit</button>
          <button onClick={e => { e.stopPropagation(); onCancel() }} style={{
            flex: 1, background: 'rgba(239,68,68,0.14)', border: '1px solid rgba(239,68,68,0.32)',
            borderRadius: 9, padding: '7px 0', color: '#fca5a5',
            fontSize: 9, fontWeight: 900, letterSpacing: '0.08em', textTransform: 'uppercase', cursor: 'pointer',
          }}>Cancel</button>
        </div>
      </div>
      {/* Accent layer — zIndex 1, bottom lifts when expanded to reveal action */}
      <div style={{
        position: 'absolute', top: 8, left: 0, right: 0,
        bottom: expanded ? ACTION_H : 0,
        background: accentBg, borderRadius: 18, zIndex: 1,
        display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
        padding: '0 14px 8px',
        transition: 'bottom 0.3s cubic-bezier(0.34,1.04,0.64,1)',
      }}>
        <span style={{ fontSize: 8, fontWeight: 900, color: accentText, textTransform: 'uppercase', letterSpacing: '0.07em' }}>{b.status}</span>
        <span style={{ fontSize: 8, fontWeight: 900, color: accentText, textTransform: 'uppercase', letterSpacing: '0.07em' }}>{tStyle.label}</span>
      </div>
      {/* Top card — zIndex 2 */}
      <div onClick={clickable ? onToggle : undefined} style={{
        position: 'relative', zIndex: 2, cursor: clickable ? 'pointer' : 'default',
        background: 'rgba(255,255,255,0.97)',
        backdropFilter: 'blur(24px) saturate(160%)',
        WebkitBackdropFilter: 'blur(24px) saturate(160%)',
        border: expanded ? '1.5px solid rgba(173,238,43,0.6)' : '1px solid rgba(255,255,255,0.9)',
        borderRadius: 18, padding: '14px 14px 13px',
        boxShadow: expanded
          ? '0 0 0 3px rgba(173,238,43,0.15), 0 2px 16px rgba(0,0,0,0.11)'
          : '0 2px 16px rgba(0,0,0,0.09), 0 1px 3px rgba(0,0,0,0.06), inset 0 1px 0 rgba(255,255,255,1)',
        transition: 'border 0.2s ease, box-shadow 0.2s ease',
      }}>
        <p style={{ fontSize: 15, fontWeight: 900, color: '#1e293b', lineHeight: 1.25, marginBottom: 9, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.title}</p>
        <p style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', marginBottom: b.booked_for ? 3 : 5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.room?.name ?? '—'}</p>
        {b.booked_for && (
          <p style={{ fontSize: 9, fontWeight: 700, color: '#94a3b8', marginBottom: 5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 3 }}>
            <span className="material-symbols-outlined" style={{ fontSize: 10 }}>person_pin</span>
            for {b.booked_for}
          </p>
        )}
        <p style={{ fontSize: 11, fontWeight: 900, color: '#475569', fontVariantNumeric: 'tabular-nums' }}>{fmtTime(b.start_at)} – {fmtTime(b.end_at)}</p>
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
  const { t, defaultBuilding } = useSettings()
  const { start: bhStart, end: bhEnd } = useBookingHours()
  const { saturday: wkSat, sunday: wkSun } = useWeekendSettings()
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState<Tab>('today')
  const [editBooking, setEditBooking] = useState<Booking | null>(null)
  const [panelOpen, setPanelOpen] = useState(false)
  const [cancelTarget, setCancelTarget] = useState<Booking | null>(null)
  const [clearConfirm, setClearConfirm] = useState(false)
  const [viewMode, setViewMode] = useState<'card' | 'list'>('card')
  const [viewAnimKey, setViewAnimKey] = useState(0)
  const [overviewOpen, setOverviewOpen] = useState(false)
  const overviewHideRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [pendingCancelIds, setPendingCancelIds] = useState<Set<number>>(new Set())
  const [exitingCancelIds, setExitingCancelIds] = useState<Set<number>>(new Set())
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const [descTooltip, setDescTooltip] = useState<{ text: string; x: number; y: number } | null>(null)
  const cancelTimersRef = useRef<Map<number, { timer: ReturnType<typeof setTimeout>; interval: ReturnType<typeof setInterval> }>>(new Map())
  const [allSortKey, setAllSortKey] = useState<AllSortKey>('start_at')
  const [allSortDir, setAllSortDir] = useState<AllSortDir>('asc')
  const [allSearch, setAllSearch] = useState('')
  const [tentativeTarget, setTentativeTarget] = useState<Booking | null>(null)
  const [tentativeConfirming, setTentativeConfirming] = useState(false)
  const [buildingFilter, setBuildingFilter] = useState<number | null>(defaultBuilding)
  const [seriesCancelTarget, setSeriesCancelTarget] = useState<SeriesGroup | null>(null)
  const [seriesUndoToast, setSeriesUndoToast] = useState<{ id: string; seriesId: string; msg: string; countdown: number } | null>(null)
  const seriesCancelTimerRef = useRef<{ timer: ReturnType<typeof setTimeout>; interval: ReturnType<typeof setInterval> } | null>(null)
  const [hCalDate, setHCalDate] = useState<string>(() => toDateKey(new Date()))
  const [hCalMonth, setHCalMonth] = useState<{ yr: number; mo: number }>(() => {
    const d = new Date()
    return { yr: d.getFullYear(), mo: d.getMonth() }
  })
  const [hCalTimelineHover, setHCalTimelineHover] = useState<{ bookingId: number; x: number; y: number } | null>(null)
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

  const { data: myBookings = [], isLoading } = useQuery({
    queryKey: ['my-bookings'],
    queryFn: getMyBookings,
  })

  const { data: allMyBookings = [], isLoading: loadingAll } = useQuery({
    queryKey: ['all-my-bookings', user?.id],
    queryFn: () => getBookings({ user_id: user?.id }),
    enabled: !!user?.id,
  })

  const today = new Date()
  const minus7 = new Date(today); minus7.setDate(today.getDate() - 7)
  const plus7 = new Date(today); plus7.setDate(today.getDate() + 7)
  const past30 = new Date(today); past30.setDate(today.getDate() - 30)

  const todayList: Booking[]     = myBookings.filter((b: Booking) => parseLocal(b.start_at).toDateString() === today.toDateString())
  const upcomingList: Booking[]  = myBookings.filter((b: Booking) => parseLocal(b.start_at) > today)
  const allList: Booking[] = useMemo(() => {
    const upcoming = myBookings.filter((b: Booking) => !isActuallyPast(b))
    const past = myBookings.filter((b: Booking) => isActuallyPast(b))
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
  const pastList: Booking[]      = myBookings.filter((b: Booking) => isActuallyPast(b) && parseLocal(b.start_at) >= past30).sort((a: Booking, b: Booking) => parseLocal(b.start_at).getTime() - parseLocal(a.start_at).getTime())
  const cancelledList: Booking[] = (allMyBookings as Booking[]).filter((b: Booking) => b.status === 'cancelled' && b.cancelled_at && parseLocal(b.cancelled_at) >= minus7).sort((a: Booking, b: Booking) => parseLocal(b.start_at).getTime() - parseLocal(a.start_at).getTime())
  const tentativeList: Booking[] = myBookings.filter((b: Booking) => b.status === 'tentative' && !isActuallyPast(b)).sort((a: Booking, b: Booking) => parseLocal(a.start_at).getTime() - parseLocal(b.start_at).getTime())

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
      .sort((a, b) => parseLocal(a.bookings[0].start_at).getTime() - parseLocal(b.bookings[0].start_at).getTime())
  }, [myBookings])

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
    today: todayList.length, upcoming: upcomingList.length, all: allList.length,
    past: pastList.length, cancelled: cancelledList.length, tentative: tentativeList.length,
    series: seriesList.length, hcal: 0,
  }

  const tabLabels: Record<Tab, string> = {
    today: t('tab_today'), upcoming: t('tab_upcoming'), all: t('tab_all'),
    past: t('tab_past'), cancelled: t('tab_cancelled'), tentative: t('tab_tentative'),
    series: 'Series', hcal: 'H-Calendar',
  }

  const allTabsOrdered: Tab[] = [...PRIMARY_TABS, ...SECONDARY_TABS]

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

    const bid = booking.id
    const toastId = `cancel-${bid}-${Date.now()}`
    let count = 5

    setPendingCancelIds(prev => new Set([...prev, bid]))
    setToasts(prev => [...prev, { id: toastId, bookingId: bid, msg: `"${booking.title}" will be cancelled`, countdown: count, isUndo: true }])

    const interval = setInterval(() => {
      count -= 1
      setToasts(prev => prev.map(t => t.id === toastId ? { ...t, countdown: count } : t))
    }, 1000)

    const timer = setTimeout(async () => {
      clearInterval(interval)
      cancelTimersRef.current.delete(bid)
      setToasts(prev => prev.filter(t => t.id !== toastId))
      setExitingCancelIds(prev => new Set([...prev, bid]))
      setTimeout(async () => {
        setExitingCancelIds(prev => { const s = new Set(prev); s.delete(bid); return s })
        setPendingCancelIds(prev => { const s = new Set(prev); s.delete(bid); return s })
        await cancelBooking(bid)
        queryClient.invalidateQueries({ queryKey: ['my-bookings'] })
        queryClient.invalidateQueries({ queryKey: ['all-my-bookings', user?.id] })
        queryClient.invalidateQueries({ queryKey: ['bookings'] })
      }, 380)
    }, 5000)

    cancelTimersRef.current.set(bid, { timer, interval })
  }

  function undoCancel(toastId: string, bookingId: number) {
    const timers = cancelTimersRef.current.get(bookingId)
    if (timers) {
      clearTimeout(timers.timer)
      clearInterval(timers.interval)
      cancelTimersRef.current.delete(bookingId)
    }
    setToasts(prev => prev.filter(t => t.id !== toastId))
    setPendingCancelIds(prev => { const s = new Set(prev); s.delete(bookingId); return s })
    setExitingCancelIds(prev => { const s = new Set(prev); s.delete(bookingId); return s })
  }

  async function handleTentativeAction(action: 'confirm' | 'cancel') {
    if (!tentativeTarget) return
    const booking = tentativeTarget
    setTentativeTarget(null)
    setTentativeConfirming(true)
    try {
      if (action === 'confirm') await updateBooking(booking.id, { status: 'confirmed' })
      else if (action === 'cancel') await cancelBooking(booking.id)
      queryClient.invalidateQueries({ queryKey: ['my-bookings'] })
      queryClient.invalidateQueries({ queryKey: ['all-my-bookings', user?.id] })
    } finally { setTentativeConfirming(false) }
  }

  function confirmSeriesCancel() {
    if (!seriesCancelTarget) return
    const target = seriesCancelTarget
    setSeriesCancelTarget(null)

    const toastId = `series-${target.series_id}-${Date.now()}`
    let count = 5
    const activeCount = target.bookings.filter(b => b.status !== 'cancelled').length

    setSeriesUndoToast({ id: toastId, seriesId: target.series_id, msg: `"${target.bookings[0].title}" series (${activeCount} bookings) will be cancelled`, countdown: count })

    const interval = setInterval(() => {
      count -= 1
      setSeriesUndoToast(prev => prev?.id === toastId ? { ...prev, countdown: count } : prev)
    }, 1000)

    const timer = setTimeout(async () => {
      clearInterval(interval)
      seriesCancelTimerRef.current = null
      setSeriesUndoToast(null)
      await cancelSeries(target.series_id)
      queryClient.invalidateQueries({ queryKey: ['my-bookings'] })
      queryClient.invalidateQueries({ queryKey: ['all-my-bookings', user?.id] })
      queryClient.invalidateQueries({ queryKey: ['bookings'] })
    }, 5000)

    seriesCancelTimerRef.current = { timer, interval }
  }

  function undoSeriesCancel() {
    if (seriesCancelTimerRef.current) {
      clearTimeout(seriesCancelTimerRef.current.timer)
      clearInterval(seriesCancelTimerRef.current.interval)
      seriesCancelTimerRef.current = null
    }
    setSeriesUndoToast(null)
  }

  async function doClearCancelled() {
    setClearConfirm(false)
    await clearCancelledBookings()
    queryClient.invalidateQueries({ queryKey: ['my-bookings'] })
    queryClient.invalidateQueries({ queryKey: ['all-my-bookings', user?.id] })
    setToasts(prev => {
      const id = `clear-${Date.now()}`
      setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 3500)
      return [...prev, { id, bookingId: 0, msg: 'Cancelled bookings cleared', countdown: 0, isUndo: false }]
    })
  }

  const upcomingInAll = allList.filter((b: Booking) => !isActuallyPast(b))
  const pastInAll     = allList.filter((b: Booking) => isActuallyPast(b))
  const pastPreview   = pastInAll.slice(0, 5)
  const allListForDisplay = [...upcomingInAll, ...pastPreview]
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

  function exportExcel() {
    const rows = upcomingInAll.map((b: Booking) => ({
      Date: fmtTableDate(b.start_at), Day: fmtTableDay(b.start_at),
      'Start Time': fmtTime(b.start_at), 'End Time': fmtTime(b.end_at),
      Duration: dur(b.start_at, b.end_at), Room: b.room?.name ?? '',
      Floor: b.room?.floor ?? '', Title: b.title,
      Description: b.description ?? '', Status: b.status, Type: b.type,
    }))
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'My Bookings')
    XLSX.writeFile(wb, `bookings-${user?.name?.replace(' ', '-').toLowerCase()}.xlsx`)
  }

  function exportPDF() {
    const doc = new jsPDF()
    doc.setFontSize(14); doc.text(`My Bookings — ${user?.name}`, 14, 16)
    doc.setFontSize(9); doc.setTextColor(150)
    doc.text(`${user?.department} · Exported ${today.toLocaleDateString('en-GB')}`, 14, 22)
    autoTable(doc, {
      startY: 28,
      head: [['Date', 'Day', 'Time', 'Room', 'Title', 'Status']],
      body: upcomingInAll.map((b: Booking) => [
        fmtTableDate(b.start_at), fmtTableDay(b.start_at),
        `${fmtTime(b.start_at)} – ${fmtTime(b.end_at)}`,
        b.room?.name ?? '', b.title, b.status,
      ]),
      styles: { fontSize: 8, cellPadding: 3 },
      headStyles: { fillColor: [0, 0, 0], textColor: [173, 238, 43], fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 250, 252] },
    })
    doc.save(`bookings-${user?.name?.replace(' ', '-').toLowerCase()}.pdf`)
  }

  function getActiveList(): Booking[] {
    if (activeTab === 'today') return todayList
    if (activeTab === 'upcoming') return upcomingList
    if (activeTab === 'all') return allList
    if (activeTab === 'past') return pastList
    if (activeTab === 'cancelled') return cancelledList
    if (activeTab === 'series') return myBookings.filter((b: Booking) => !!b.series_id)
    if (activeTab === 'hcal') return []
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

  const displayList = buildingFilter
    ? activeList.filter((b: Booking) => b.room?.building_id === buildingFilter)
    : activeList

  const displaySeriesList = buildingFilter
    ? seriesList.filter(g => g.bookings.some(b => b.room?.building_id === buildingFilter))
    : seriesList

  const grouped = groupByDate(displayList)
  const meta = TAB_META[activeTab]
  const isSecondary = SECONDARY_TABS.includes(activeTab)

  const cardSharedProps: CardSharedProps = {
    activeTab,
    pendingCancelIds,
    exitingCancelIds,
    onEdit: (b) => { setEditBooking(b); setPanelOpen(true) },
    onCancel: handleCancel,
    onTentativeAction: (b) => setTentativeTarget(b),
  }

  return (
    <div className="flex flex-col flex-1 overflow-hidden" style={{ background: 'var(--ds-bg-surface)' }}>
      <style>{`@keyframes card-in{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}`}</style>

      {/* Top header */}
      <div className="px-8 pt-6 shrink-0" style={{ background: 'var(--ds-bg-surface)', borderBottom: '1px solid var(--ds-border-sub)' }}>
        <div className="flex items-start justify-between mb-5">
          <div>
            <h2 className="text-3xl font-black tracking-tighter uppercase leading-none" style={{ color: 'var(--ds-text-1)' }}>{user?.name}</h2>
            <p className="text-sm font-bold mt-1.5 capitalize" style={{ color: 'var(--ds-text-3)' }}>
              {user?.role}{user?.department ? <> &middot; {user.department}</> : ''}{user?.ext ? <> &middot; Ext. {user.ext}</> : ''}
            </p>
          </div>
          <button
            onClick={() => { setEditBooking(null); setPanelOpen(true) }}
            className="flex items-center gap-1.5 px-3 sm:px-5 py-2.5 rounded-xl text-[10px] font-black uppercase shadow-lg shadow-lime-300/30 transition-all duration-200 bg-[#adee2b] text-black hover:bg-black hover:text-[#adee2b]"
          >
            <span className="material-symbols-outlined text-base">add</span>
            <span className="hidden sm:inline">New Booking</span>
          </button>
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
          <div className="mx-5 mb-3 w-px h-4 bg-slate-200 self-end" />

          {/* Secondary tabs */}
          <div className="flex items-end gap-5">
            {SECONDARY_TABS.map((key, i) => {
              const m = TAB_META[key]
              const tabTip = TAB_TOOLTIP[key]
              return (
                <button key={key} ref={el => { tabRefs.current[PRIMARY_TABS.length + i] = el }}
                  onClick={() => setActiveTab(key)}
                  className={`relative group/stab flex items-center gap-2 pb-3 text-[12px] font-black uppercase tracking-wide transition-colors duration-200
                    ${activeTab === key ? m.color : 'text-slate-300 hover:text-slate-400'}`}>
                  {tabLabels[key]}
                  {tabCounts[key] > 0 && (
                    <span className={`text-[9px] font-black px-2 py-0.5 rounded-full transition-colors
                      ${activeTab === key
                        ? key === 'cancelled' ? 'bg-red-100 text-red-500'
                          : key === 'tentative' ? 'bg-amber-100 text-amber-600'
                          : 'bg-slate-200 text-slate-500'
                        : 'bg-slate-100 text-slate-300'}`}>
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
              className={`size-8 flex items-center justify-center rounded-lg transition-all ${overviewOpen ? 'bg-black text-[#adee2b] shadow' : 'bg-slate-100 text-slate-400 hover:text-slate-600'}`}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 17 }}>bar_chart</span>
            </button>

            {/* View toggle */}
            <div className={`flex gap-0.5 bg-slate-100 rounded-xl p-1 ${(activeTab === 'all' || activeTab === 'series' || activeTab === 'hcal') ? 'opacity-35' : ''}`}>
              <button
                onClick={() => { if (activeTab !== 'all' && activeTab !== 'series' && activeTab !== 'hcal' && viewMode !== 'card') { setViewMode('card'); setViewAnimKey(k => k + 1) } }}
                title="Card view"
                className={`size-8 flex items-center justify-center rounded-lg transition-all ${viewMode === 'card' ? 'bg-white shadow text-slate-800' : 'text-slate-400 hover:text-slate-600'}`}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 17 }}>grid_view</span>
              </button>
              <button
                onClick={() => { if (activeTab !== 'all' && activeTab !== 'series' && activeTab !== 'hcal' && viewMode !== 'list') { setViewMode('list'); setViewAnimKey(k => k + 1) } }}
                title="List view"
                className={`size-8 flex items-center justify-center rounded-lg transition-all ${viewMode === 'list' ? 'bg-white shadow text-slate-800' : 'text-slate-400 hover:text-slate-600'}`}
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
                  { label: 'This Month', value: String(thisMonthCount).padStart(2, '0'), sub: 'bookings', icon: 'calendar_month', clr: '#6366f1' },
                  { label: 'Hours Used', value: `${totalHours.toFixed(0)}h`, sub: 'this month', icon: 'schedule', clr: '#06b6d4' },
                  { label: 'Today', value: String(todayList.length).padStart(2, '0'), sub: 'bookings', icon: 'today', clr: '#f59e0b' },
                  { label: 'Upcoming', value: String(upcomingList.length).padStart(2, '0'), sub: 'scheduled', icon: 'upcoming', clr: '#adee2b' },
                ] as const).map((card, idx) => (
                  <div key={card.label} style={{
                    width: 190,
                    borderRadius: 18, padding: '14px 16px',
                    background: 'rgba(255,255,255,0.92)',
                    backdropFilter: 'blur(24px) saturate(180%)',
                    WebkitBackdropFilter: 'blur(24px) saturate(180%)',
                    border: '1px solid rgba(255,255,255,0.95)',
                    boxShadow: '0 12px 32px rgba(0,0,0,0.1), 0 2px 8px rgba(0,0,0,0.05), inset 0 1px 0 rgba(255,255,255,1)',
                    animation: `overview-card-in 0.3s cubic-bezier(0.34,1.04,0.64,1) ${idx * 50}ms both`,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                      <div style={{ width: 30, height: 30, borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', background: `${card.clr}1a` }}>
                        <span className="material-symbols-outlined" style={{ fontSize: 16, color: card.clr }}>{card.icon}</span>
                      </div>
                      <p style={{ fontSize: 8, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#94a3b8' }}>{card.label}</p>
                    </div>
                    <p style={{ fontSize: 32, fontWeight: 900, lineHeight: 1, fontVariantNumeric: 'tabular-nums', color: '#0f172a' }}>{card.value}</p>
                    <p style={{ fontSize: 9, fontWeight: 700, marginTop: 5, color: '#94a3b8' }}>{card.sub}</p>
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
        <div className="flex-1 overflow-y-auto px-8 py-6 bg-slate-50" style={{ scrollbarWidth: 'thin' }}>
          {(isLoading || loadingAll) ? (
            <div className="flex items-center justify-center h-full">
              <span className="material-symbols-outlined animate-spin text-4xl text-slate-300">progress_activity</span>
            </div>
          ) : (activeList.length === 0 && activeTab !== 'hcal') ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-slate-300">
              <span className="material-symbols-outlined text-5xl">
                {activeTab === 'cancelled' ? 'cancel' : activeTab === 'tentative' ? 'pending' : activeTab === 'past' ? 'history' : activeTab === 'series' ? 'repeat' : 'calendar_month'}
              </span>
              <p className="text-sm font-black uppercase">
                {activeTab === 'today' ? 'No bookings today'
                  : activeTab === 'upcoming' ? 'No upcoming bookings'
                  : activeTab === 'past' ? 'No past bookings (last 30 days)'
                  : activeTab === 'cancelled' ? 'No cancelled bookings (±7 days)'
                  : activeTab === 'tentative' ? 'No tentative bookings'
                  : activeTab === 'series' ? 'No repeat bookings'
                  : 'No bookings yet'}
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
                          ${isActive ? 'bg-black text-[#adee2b]' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                      >
                        {bld.code || bld.name}{(bld.locationName || bld.address) ? ` - ${bld.locationName || bld.address}` : ''}
                        <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full leading-none
                          ${isActive ? 'bg-white/15 text-[#adee2b]' : 'bg-slate-200 text-slate-400'}`}>
                          {count}
                        </span>
                      </button>
                    )
                  })}
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
                const maxEnabledMonth = today.getMonth() + 3
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
                        Calendar <span className="text-slate-400 font-black">#{yr}</span>
                      </h2>
                      <div className="mt-3 h-px bg-slate-200" />
                    </div>

                    {/* Month row */}
                    <div className="flex items-end gap-6 mb-6 flex-wrap">
                      {MONTHS_LOWER.map((mName, mi) => {
                        if (mi < today.getMonth()) return null
                        const isCurMo = mi === mo
                        const isEnabled = mi <= maxEnabledMonth
                        return (
                          <button key={mi}
                            disabled={!isEnabled}
                            onClick={() => {
                              if (!isEnabled) return
                              const newDate = mi === today.getMonth() ? toDateKey(today) : toDateKey(new Date(yr, mi, 1))
                              setHCalMonth({ yr, mo: mi })
                              setHCalDate(newDate)
                            }}
                            className="leading-none transition-all shrink-0 disabled:cursor-default"
                          >
                            <span className={`text-[22px] transition-all ${
                              isCurMo ? 'font-black text-slate-900'
                              : isEnabled ? 'font-semibold text-slate-400 hover:text-slate-700'
                              : 'font-medium text-slate-200'
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
                                ${isToday || isSel ? '' : 'hover:bg-slate-100'}`}
                              style={{ width: 52 }}
                            >
                              <div
                                className="w-9 h-9 rounded-full flex items-center justify-center font-black transition-all"
                                style={{
                                  fontSize: 16,
                                  background: isToday ? '#adee2b' : isSel ? 'rgba(173,238,43,0.22)' : 'transparent',
                                  color: isToday ? '#000' : isSel ? '#3a6800' : isWeekend ? '#ef4444' : '#334155',
                                }}
                              >
                                {di + 1}
                              </div>
                              <span className={`text-[10px] font-bold uppercase leading-none ${isWeekend && !isToday ? 'text-red-400' : 'text-slate-400'}`}>
                                {d.toLocaleDateString('en-GB', { weekday: 'short' }).slice(0, 2)}
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
                        background: hCalDatesSbHover ? 'rgba(0,0,0,0.07)' : 'transparent',
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
                          background: hCalDatesSbHover ? 'rgba(0,0,0,0.38)' : 'rgba(0,0,0,0.22)',
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
                          <div style={{ position: 'relative', height: 10, background: '#e2e8f0', borderRadius: 999, overflow: 'visible' }}>
                            {/* Booked segments — hover target + glow */}
                            {hCalDayBkgs.map(b => {
                              const left = bookingToPos(b.start_at)
                              const right = bookingToPos(b.end_at)
                              const isConf = b.status === 'confirmed'
                              const isTent = b.status === 'tentative'
                              const color = isConf ? '#adee2b' : isTent ? '#fbbf24' : '#fca5a5'
                              const isHov = hCalTimelineHover?.bookingId === b.id
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
                                  onMouseMove={e => setHCalTimelineHover({ bookingId: b.id, x: e.clientX, y: e.clientY })}
                                  onMouseLeave={() => setHCalTimelineHover(null)}
                                />
                              )
                            })}

                            {/* Dots — visual markers, pointer-events none */}
                            {hCalDayBkgs.map(b => {
                              const pos = bookingToPos(b.start_at)
                              const isConf = b.status === 'confirmed'
                              const isTent = b.status === 'tentative'
                              const color = isConf ? '#adee2b' : isTent ? '#fbbf24' : '#fca5a5'
                              const isHov = hCalTimelineHover?.bookingId === b.id
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
                                <span className="text-[9px] font-black text-slate-400 tabular-nums" style={{ position: 'absolute', left: 0 }}>{bhStart}</span>
                                {showNoon && (
                                  <span className="text-[9px] font-black text-slate-300 tabular-nums" style={{ position: 'absolute', left: `${noonPos}%`, transform: 'translateX(-50%)' }}>12:00</span>
                                )}
                                {showPm430 && (
                                  <span className="text-[9px] font-black text-slate-300 tabular-nums" style={{ position: 'absolute', left: `${pm430Pos}%`, transform: 'translateX(-50%)' }}>16:30</span>
                                )}
                                <span className="text-[9px] font-black text-slate-400 tabular-nums" style={{ position: 'absolute', right: 0 }}>{bhEnd}</span>
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
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 whitespace-nowrap">{hCalLabel}</p>
                      <div className="flex-1 h-px bg-slate-200" />
                      <span className="text-[9px] font-black text-slate-300">{hCalDayBkgs.length}</span>
                    </div>

                    {/* Booking cards */}
                    {hCalDayBkgs.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-10 gap-3">
                        <span className="material-symbols-outlined text-4xl text-slate-300">event_available</span>
                        <p className="text-[11px] font-black uppercase tracking-wide text-slate-300">No bookings on this date</p>
                        <button
                          onClick={() => { setEditBooking(null); setPanelOpen(true) }}
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
                              style={{ paddingTop: 6, paddingBottom: 10, paddingLeft: 8, marginLeft: -8 }}
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
                            background: hCalCardsSbHover ? 'rgba(0,0,0,0.07)' : 'transparent',
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
                              background: hCalCardsSbHover ? 'rgba(0,0,0,0.38)' : 'rgba(0,0,0,0.22)',
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
                              style={{ paddingTop: 6, paddingBottom: 10, paddingLeft: 8, marginLeft: -8, filter: 'saturate(0.25)', opacity: 0.5 }}
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
                                background: hCalPastSbHover ? 'rgba(0,0,0,0.07)' : 'transparent',
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
                                  background: hCalPastSbHover ? 'rgba(0,0,0,0.38)' : 'rgba(0,0,0,0.22)',
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
              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-slate-900 border-b border-slate-700">
                      <th className="px-3 py-3.5 w-8" />
                      {(['Room', 'Title', 'Date Range', 'Count', 'Status Summary', ''] as string[]).map((h, i) => (
                        <th key={i} className="px-3 py-3.5 text-left text-[10px] font-black uppercase tracking-widest text-slate-400">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  {displaySeriesList.map(group => (
                    <SeriesGroupRow
                      key={group.series_id}
                      group={group}
                      pendingCancelIds={pendingCancelIds}
                      onEdit={b => { setEditBooking(b); setPanelOpen(true) }}
                      onCancel={handleCancel}
                      onCancelSeries={setSeriesCancelTarget}
                    />
                  ))}
                </table>
              </div>
              ) : activeTab === 'all' ? (
              <>
              {/* Search + Export row */}
              <div className="flex items-center gap-3 mb-4">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 shrink-0">
                  {allSearch ? `${allListFiltered.length} result${allListFiltered.length !== 1 ? 's' : ''}` : `${upcomingInAll.length} upcoming${pastInAll.length > 0 ? ` · ${pastInAll.length} past` : ''}`}
                </p>
                <div className="relative flex-1">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none" style={{ fontSize: 16 }}>search</span>
                  <input
                    type="text"
                    placeholder="Search title, room, type, status..."
                    value={allSearch}
                    onChange={e => setAllSearch(e.target.value)}
                    className={`w-full pl-9 pr-8 py-2 border rounded-xl text-[11px] font-bold focus:outline-none focus:ring-2 focus:ring-[#adee2b] focus:border-transparent transition-all
                      ${allSearch ? 'border-[#adee2b] bg-[#f7fee7]' : 'border-slate-200 bg-slate-50'}`}
                  />
                  {allSearch && (
                    <button onClick={() => setAllSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 size-5 flex items-center justify-center rounded-md text-slate-400 hover:text-slate-700 transition-colors">
                      <span className="material-symbols-outlined" style={{ fontSize: 14 }}>close</span>
                    </button>
                  )}
                </div>
                <div className="flex gap-2 shrink-0">
                  <button onClick={exportExcel}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[10px] font-black uppercase border border-slate-200 bg-white hover:border-green-400 hover:text-green-600 hover:bg-green-50 transition-all">
                    <span className="material-symbols-outlined text-sm">table_view</span>Excel
                  </button>
                  <button onClick={exportPDF}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[10px] font-black uppercase border border-slate-200 bg-white hover:border-red-400 hover:text-red-600 hover:bg-red-50 transition-all">
                    <span className="material-symbols-outlined text-sm">picture_as_pdf</span>PDF
                  </button>
                </div>
              </div>
              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                <table className="w-full text-left">
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
                            <span className="text-[11px] font-black uppercase tracking-widest text-slate-400">{h.label}</span>
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
                            <tr className="bg-slate-100">
                              <td colSpan={9} className="px-4 py-2">
                                <div className="flex items-center gap-3">
                                  <span className="material-symbols-outlined text-slate-400" style={{ fontSize: 14 }}>history</span>
                                  <span className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">Past Bookings</span>
                                  <div className="flex-1 h-px bg-slate-300" />
                                </div>
                              </td>
                            </tr>
                          )}
                          <tr
                          onClick={() => { if (!isPast) { setEditBooking(b); setPanelOpen(true) } }}
                          className={`border-b border-slate-50 transition-colors
                            ${isPast ? 'opacity-40' : 'hover:bg-[#f7fee7] cursor-pointer'}
                            ${i % 2 !== 0 ? 'bg-slate-50/50' : ''}`}
                        >
                          <td className="px-4 py-3 text-xs font-black text-slate-700 whitespace-nowrap">{fmtTableDate(b.start_at)}</td>
                          <td className="px-4 py-3 text-xs font-bold text-slate-400 whitespace-nowrap">{fmtTableDay(b.start_at)}</td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <p className="text-sm font-black text-slate-800 tabular-nums">{fmtTime(b.start_at)} &ndash; {fmtTime(b.end_at)}</p>
                            <p className="text-[10px] font-bold text-slate-400 mt-0.5">{dur(b.start_at, b.end_at)}</p>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <p className="text-xs font-bold text-slate-600">{b.room?.name}</p>
                            <p className="text-[9px] font-bold text-slate-300">{b.room?.floor}</p>
                          </td>
                          <td className="px-4 py-3 text-xs font-black text-slate-800 max-w-[160px] truncate">{b.title}</td>
                          <td className="px-4 py-3 max-w-[200px]"
                            onMouseEnter={e => b.description && setDescTooltip({ text: b.description, x: e.clientX, y: e.clientY })}
                            onMouseMove={e => b.description && setDescTooltip(prev => prev ? { ...prev, x: e.clientX, y: e.clientY } : null)}
                            onMouseLeave={() => setDescTooltip(null)}
                          >
                            {b.description
                              ? <span className="text-xs text-slate-400 truncate block max-w-[180px] cursor-default">{b.description}</span>
                              : <span className="text-slate-200 text-xs">&mdash;</span>
                            }
                          </td>
                          <td className="px-4 py-3">
                            <span className={`text-[8px] font-black uppercase px-2.5 py-1 rounded-full whitespace-nowrap
                              ${isConf ? 'bg-[#adee2b] text-black' : 'bg-slate-100 text-slate-500'}`}>
                              {b.status}
                            </span>
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
                                  className="size-7 flex items-center justify-center rounded-lg bg-slate-100 text-slate-500 hover:bg-black hover:text-[#adee2b] transition-all">
                                  <span className="material-symbols-outlined" style={{ fontSize: 14 }}>edit</span>
                                </button>
                                <button onClick={() => handleCancel(b)} disabled={pendingCancelIds.has(b.id)} title="Cancel"
                                  className="size-7 flex items-center justify-center rounded-lg bg-slate-100 text-slate-500 hover:bg-red-50 hover:text-red-500 transition-all disabled:opacity-40">
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
                        <td colSpan={9} className="px-4 py-3 bg-slate-50/70">
                          <button
                            onClick={() => setActiveTab('past')}
                            className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-700 transition-colors group/more"
                          >
                            <span className="material-symbols-outlined group-hover/more:text-black transition-colors" style={{ fontSize: 14 }}>history</span>
                            Show {pastInAll.length - 5} more past booking{pastInAll.length - 5 !== 1 ? 's' : ''} →
                          </button>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
              ) : (
              <div key={viewAnimKey} className="space-y-8" style={{ animation: 'view-slide-in 0.22s cubic-bezier(0.4,0,0.2,1)' }}>
              {isSecondary && activeTab === 'cancelled' && (
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                    Cancelled bookings within &plusmn;7 days
                  </p>
                  {cancelledList.length > 0 && (
                    <button
                      onClick={() => setClearConfirm(true)}
                      className="flex items-center gap-2 text-[11px] font-black uppercase tracking-wide text-red-400 hover:text-red-600 transition-colors px-3.5 py-2 rounded-xl border border-red-100 hover:border-red-200 hover:bg-red-50"
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: 16 }}>delete_sweep</span>
                      Clear All
                    </button>
                  )}
                </div>
              )}
              {grouped.map(([dateKey, bookings]) => (
                <div key={dateKey}>
                  <div className="flex items-center gap-3 mb-3">
                    <p className={`text-[10px] font-black uppercase tracking-[0.2em] whitespace-nowrap
                      ${activeTab === 'cancelled' ? 'text-red-400'
                        : activeTab === 'tentative' ? 'text-amber-400'
                        : 'text-slate-400'}`}>
                      {fmtGroupLabel(bookings[0].start_at)}
                    </p>
                    <div className={`flex-1 h-px
                      ${activeTab === 'cancelled' ? 'bg-red-100'
                        : activeTab === 'tentative' ? 'bg-amber-100'
                        : 'bg-slate-200'}`} />
                    <span className="text-[9px] font-black text-slate-300">{bookings.length}</span>
                  </div>
                  {viewMode === 'card' ? (
                    <div className="flex gap-3">
                      {([0, 1] as const).map(col => (
                        <div key={col} className="flex-1 flex flex-col gap-3">
                          {bookings
                            .filter((_, i) => i % 2 === col)
                            .map((b, colIdx) => (
                              <SlideWrapper key={b.id} exiting={exitingCancelIds.has(b.id)}>
                                <BookingCard b={b} index={colIdx * 2 + col} {...cardSharedProps} />
                              </SlideWrapper>
                            ))}
                        </div>
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
        onClose={() => setPanelOpen(false)}
        editBooking={editBooking}
        buildingId={buildingFilter ?? defaultBuilding}
        onSubmit={() => {
          setPanelOpen(false)
          queryClient.invalidateQueries({ queryKey: ['my-bookings'] })
          queryClient.invalidateQueries({ queryKey: ['all-my-bookings', user?.id] })
          queryClient.invalidateQueries({ queryKey: ['bookings'] })
        }}
        onCancel={(b) => { setPanelOpen(false); handleCancel(b) }}
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
                {fmtTime(ttB.start_at)} – {fmtTime(ttB.end_at)}
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

      {/* Stacked toasts */}
      <div className="fixed z-[9999] flex flex-col-reverse gap-2 items-end" style={{ bottom: 28, right: 96 }}>
        {seriesUndoToast && (
          <div
            key={seriesUndoToast.id}
            style={{
              background: 'rgba(15,20,45,0.55)',
              backdropFilter: 'blur(48px) saturate(200%)',
              WebkitBackdropFilter: 'blur(48px) saturate(200%)',
              border: '1px solid rgba(255,255,255,0.14)',
              borderRadius: '1.5rem',
              padding: '14px 18px',
              boxShadow: '0 24px 56px -8px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.12)',
              display: 'flex', alignItems: 'center', gap: 12,
              minWidth: 300,
              animation: 'toast-in 0.22s cubic-bezier(0.34,1.04,0.64,1)',
            }}
          >
            <span className="material-symbols-outlined shrink-0" style={{ fontSize: 22, color: '#f87171' }}>repeat</span>
            <span className="text-white text-[12px] font-black flex-1">{seriesUndoToast.msg}</span>
            <span style={{ fontSize: 12, fontWeight: 900, color: 'rgba(255,255,255,0.45)', minWidth: 22, textAlign: 'right' }}>
              {seriesUndoToast.countdown}s
            </span>
            <button
              onClick={undoSeriesCancel}
              style={{
                background: '#adee2b', color: '#000', border: 'none',
                borderRadius: 10, padding: '5px 12px',
                fontSize: 10, fontWeight: 900, textTransform: 'uppercase',
                cursor: 'pointer', letterSpacing: '0.05em', flexShrink: 0,
              }}
            >
              Undo
            </button>
          </div>
        )}
        {toasts.map(toast => (
          <div
            key={toast.id}
            style={{
              background: 'rgba(15,20,45,0.55)',
              backdropFilter: 'blur(48px) saturate(200%)',
              WebkitBackdropFilter: 'blur(48px) saturate(200%)',
              border: '1px solid rgba(255,255,255,0.14)',
              borderRadius: '1.5rem',
              padding: '14px 18px',
              boxShadow: '0 24px 56px -8px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.12)',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              minWidth: 300,
              animation: 'toast-in 0.22s cubic-bezier(0.34,1.04,0.64,1)',
            }}
          >
            <span className="material-symbols-outlined shrink-0" style={{ fontSize: 22, color: '#f87171' }}>cancel</span>
            <span className="text-white text-[12px] font-black flex-1">{toast.msg}</span>
            <span style={{ fontSize: 12, fontWeight: 900, color: 'rgba(255,255,255,0.45)', minWidth: 22, textAlign: 'right' }}>
              {toast.countdown}s
            </span>
            <button
              onClick={() => undoCancel(toast.id, toast.bookingId)}
              style={{
                background: '#adee2b', color: '#000', border: 'none',
                borderRadius: 10, padding: '5px 12px',
                fontSize: 10, fontWeight: 900, textTransform: 'uppercase',
                cursor: 'pointer', letterSpacing: '0.05em', flexShrink: 0,
              }}
            >
              Undo
            </button>
          </div>
        ))}
      </div>
      <style>{`
        @keyframes toast-in{from{opacity:0;transform:translateY(12px) scale(0.95)}to{opacity:1;transform:translateY(0) scale(1)}}
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
              background: 'rgba(255,255,255,0.82)',
              backdropFilter: 'blur(48px) saturate(200%)',
              WebkitBackdropFilter: 'blur(48px) saturate(200%)',
              border: '1px solid rgba(255,255,255,0.95)',
              borderRadius: 22,
              boxShadow: '0 24px 64px rgba(0,0,0,0.14), 0 6px 20px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,1)',
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
                <h3 className="text-base font-black text-slate-900">Cancel Booking?</h3>
                <p className="text-xs text-slate-400 font-medium mt-0.5">This action cannot be undone.</p>
              </div>
            </div>
            <div className="rounded-2xl p-4 mb-6 space-y-2.5"
              style={{ background: 'rgba(0,0,0,0.04)', border: '1px solid rgba(0,0,0,0.06)' }}>
              <p className="text-sm font-black text-slate-800 leading-snug">{cancelTarget.title}</p>
              <div className="w-full h-px" style={{ background: 'rgba(0,0,0,0.07)' }} />
              <p className="text-xs font-bold text-slate-500 flex items-center gap-2">
                <span className="material-symbols-outlined text-slate-400 shrink-0" style={{ fontSize: 14 }}>location_on</span>
                {cancelTarget.room?.name} &middot; {cancelTarget.room?.floor}
              </p>
              <p className="text-xs font-bold text-slate-500 flex items-center gap-2">
                <span className="material-symbols-outlined text-slate-400 shrink-0" style={{ fontSize: 14 }}>schedule</span>
                {fmtTime(cancelTarget.start_at)} &ndash; {fmtTime(cancelTarget.end_at)} &middot; {dur(cancelTarget.start_at, cancelTarget.end_at)}
              </p>
              <p className="text-xs font-bold text-slate-500 flex items-center gap-2">
                <span className="material-symbols-outlined text-slate-400 shrink-0" style={{ fontSize: 14 }}>calendar_today</span>
                {fmtTableDate(cancelTarget.start_at)} &middot; {fmtTableDay(cancelTarget.start_at)}
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setCancelTarget(null)}
                className="flex-1 py-3 rounded-2xl text-[11px] font-black uppercase transition-colors"
                style={{ background: 'rgba(0,0,0,0.06)', color: '#475569' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(0,0,0,0.10)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'rgba(0,0,0,0.06)')}
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
              background: 'rgba(255,255,255,0.88)',
              backdropFilter: 'blur(48px) saturate(200%)',
              WebkitBackdropFilter: 'blur(48px) saturate(200%)',
              border: '1px solid rgba(255,255,255,0.95)',
              borderRadius: 22,
              boxShadow: '0 24px 64px rgba(0,0,0,0.14), 0 6px 20px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,1)',
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
                <h3 className="text-base font-black text-slate-900">Manage Tentative Booking</h3>
                <p className="text-xs text-slate-400 font-medium mt-0.5">What would you like to do with this booking?</p>
              </div>
            </div>

            <div className="rounded-2xl p-4 mb-5 space-y-2"
              style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.15)' }}>
              <p className="text-sm font-black text-slate-800 leading-snug">{tentativeTarget.title}</p>
              <div className="w-full h-px" style={{ background: 'rgba(0,0,0,0.07)' }} />
              <p className="text-xs font-bold text-slate-500 flex items-center gap-2">
                <span className="material-symbols-outlined text-slate-400 shrink-0" style={{ fontSize: 14 }}>location_on</span>
                {tentativeTarget.room?.name}
              </p>
              <p className="text-xs font-bold text-slate-500 flex items-center gap-2">
                <span className="material-symbols-outlined text-slate-400 shrink-0" style={{ fontSize: 14 }}>schedule</span>
                {fmtTableDate(tentativeTarget.start_at)} &middot; {fmtTime(tentativeTarget.start_at)} &ndash; {fmtTime(tentativeTarget.end_at)}
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
                style={{ background: 'rgba(0,0,0,0.06)', color: '#475569', transformOrigin: 'center' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(0,0,0,0.10)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'rgba(0,0,0,0.06)')}
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
              background: 'rgba(255,255,255,0.88)',
              backdropFilter: 'blur(48px) saturate(200%)',
              WebkitBackdropFilter: 'blur(48px) saturate(200%)',
              border: '1px solid rgba(255,255,255,0.95)',
              borderRadius: 22,
              boxShadow: '0 24px 64px rgba(0,0,0,0.14), 0 6px 20px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,1)',
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
                <h3 className="text-base font-black text-slate-900">Cancel Entire Series?</h3>
                <p className="text-xs text-slate-400 font-medium mt-0.5">All {seriesCancelTarget.bookings.filter(b => b.status !== 'cancelled').length} active bookings in this series will be cancelled.</p>
              </div>
            </div>
            <div className="rounded-2xl p-4 mb-6 space-y-2"
              style={{ background: 'rgba(0,0,0,0.04)', border: '1px solid rgba(0,0,0,0.06)' }}>
              <p className="text-sm font-black text-slate-800">{seriesCancelTarget.bookings[0].title}</p>
              <p className="text-xs font-bold text-slate-500 flex items-center gap-2">
                <span className="material-symbols-outlined text-slate-400 shrink-0" style={{ fontSize: 14 }}>location_on</span>
                {seriesCancelTarget.bookings[0].room?.name}
              </p>
              <p className="text-xs font-bold text-slate-500 flex items-center gap-2">
                <span className="material-symbols-outlined text-slate-400 shrink-0" style={{ fontSize: 14 }}>repeat</span>
                {seriesCancelTarget.bookings.length} dates in this series
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setSeriesCancelTarget(null)}
                className="flex-1 py-3 rounded-2xl text-[11px] font-black uppercase transition-colors"
                style={{ background: 'rgba(0,0,0,0.06)', color: '#475569' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(0,0,0,0.10)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'rgba(0,0,0,0.06)')}
              >
                Keep Series
              </button>
              <button
                onClick={confirmSeriesCancel}
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
              background: 'rgba(255,255,255,0.82)',
              backdropFilter: 'blur(48px) saturate(200%)',
              WebkitBackdropFilter: 'blur(48px) saturate(200%)',
              border: '1px solid rgba(255,255,255,0.95)',
              borderRadius: 22,
              boxShadow: '0 24px 64px rgba(0,0,0,0.14), 0 6px 20px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,1)',
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
                <h3 className="text-base font-black text-slate-900">Clear Cancelled Bookings?</h3>
                <p className="text-xs text-slate-400 font-medium mt-0.5">All {cancelledList.length} cancelled booking{cancelledList.length !== 1 ? 's' : ''} will be permanently removed.</p>
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
                style={{ background: 'rgba(0,0,0,0.06)', color: '#475569' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(0,0,0,0.10)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'rgba(0,0,0,0.06)')}
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
