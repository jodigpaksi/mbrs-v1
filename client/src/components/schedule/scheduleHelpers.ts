import type { Booking } from '../../types/index'
import { parseLocal } from '../../utils/date'

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

interface CardSharedProps {
  activeTab: Tab
  pendingCancelIds: Set<number>
  exitingCancelIds: Set<number>
  animate: boolean
  onEdit: (b: Booking) => void
  onCancel: (b: Booking) => void
  onTentativeAction?: (b: Booking) => void
}

interface SeriesGroup {
  series_id: string
  bookings: Booking[]
}

function fmtSkipDate(iso: string) {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  const datePart = dt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
  const dayPart = dt.toLocaleDateString('en-GB', { weekday: 'short' })
  return `${datePart}, ${dayPart}`
}

// Monthly-repeat invalid dates are stored as "Y-m-d~D" — Y-m-d is a clamped placeholder (last real
// day of that month, needed so series_skipped_dates/resolves_skipped_date stay real dates), D is the
// originally-requested day-of-month that doesn't exist (e.g. "2026-09-30~31" — the 31st in Sep).
// See BookingPanel.tsx's SkippedEntry encoding — this must decode the exact same format.
function parseSkipDate(raw: string): { real: string; invalidDay?: number } {
  const [real, day] = raw.split('~')
  return { real, invalidDay: day ? Number(day) : undefined }
}

function fmtInvalidSkipDate(real: string, invalidDay: number, language: string) {
  const [y, m] = real.split('-').map(Number)
  const monthYear = new Date(y, m - 1, 1).toLocaleDateString(language === 'id' ? 'id-ID' : 'en-GB', { month: 'short', year: 'numeric' })
  return `${invalidDay} ${monthYear}`
}
export {
  typeStyle, dur, fmtTime, toHHMM, fmtGroupLabel, fmtTableDate, fmtTableDay,
  groupByDate, isActuallyPast, toDateKey, fmtSkipDate, parseSkipDate, fmtInvalidSkipDate,
}
export type { Tab, CardSharedProps, SeriesGroup }
