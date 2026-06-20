import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getMyBookings } from '../../api/bookings'
import type { Booking } from '../../types'

function parseLocal(s: string): Date {
  const [date, time] = s.replace('T', ' ').split(' ')
  const [y, mo, d] = date.split('-').map(Number)
  const [h, mi] = (time ?? '').split(':').map(Number)
  return new Date(y, mo - 1, d, h || 0, mi || 0)
}

function fmtTime(s: string): string {
  const d = parseLocal(s)
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

const STATUS_STYLE: Record<string, string> = {
  confirmed: 'bg-[#adee2b] text-black',
  tentative: 'bg-amber-100 text-amber-700',
  cancelled: 'bg-red-100 text-red-500',
}

export default function TodayPanel() {
  const [open, setOpen] = useState(false)
  const [visible, setVisible] = useState(false)
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    function onToggle() { setOpen(o => !o) }
    document.addEventListener('today-panel-toggle', onToggle)
    return () => document.removeEventListener('today-panel-toggle', onToggle)
  }, [])

  useEffect(() => {
    if (open) {
      setVisible(true)
    } else {
      const t = setTimeout(() => setVisible(false), 420)
      return () => clearTimeout(t)
    }
  }, [open])

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000)
    return () => clearInterval(id)
  }, [])

  const { data: myBookings = [] } = useQuery<Booking[]>({
    queryKey: ['my-bookings'],
    queryFn: getMyBookings,
    enabled: open,
    staleTime: 30_000,
  })

  const today = new Date()
  const todayList = (myBookings as Booking[])
    .filter(b => parseLocal(b.start_at).toDateString() === today.toDateString())
    .sort((a, b) => parseLocal(a.start_at).getTime() - parseLocal(b.start_at).getTime())

  const todayLabel = today.toLocaleDateString('en-GB', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })

  return (
    <>
      {/* Backdrop */}
      {open && (
        <div className="fixed inset-0 z-[115]" onClick={() => setOpen(false)} />
      )}

      {/* Slide-in panel */}
      <div
        className={`fixed top-0 right-0 h-full z-[120] flex flex-col transition-transform duration-[400ms] ease-[cubic-bezier(0.32,0.72,0,1)]
          ${open ? 'translate-x-0' : 'translate-x-full'}`}
        style={{
          width: 360,
          background: 'rgba(255,255,255,0.96)',
          backdropFilter: 'blur(48px) saturate(200%)',
          borderLeft: '1px solid rgba(0,0,0,0.08)',
          boxShadow: '-20px 0 80px rgba(0,0,0,0.12)',
          visibility: visible ? 'visible' : 'hidden',
        }}
      >
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-3">
            <div className="size-9 rounded-xl bg-black flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-[#adee2b]" style={{ fontSize: 18 }}>calendar_today</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">My Schedule</p>
              <p className="text-[11px] font-black text-slate-800 uppercase tracking-tight truncate">{todayLabel}</p>
            </div>
            <button onClick={() => setOpen(false)}
              className="size-8 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors shrink-0">
              <span className="material-symbols-outlined text-slate-500" style={{ fontSize: 16 }}>close</span>
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-3" style={{ scrollbarWidth: 'thin' }}>
          {todayList.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-center py-12">
              <span className="material-symbols-outlined text-slate-200" style={{ fontSize: 52 }}>event_available</span>
              <p className="text-[12px] font-black text-slate-400 uppercase tracking-wide">No bookings today</p>
              <p className="text-[11px] text-slate-400 font-medium">Your schedule is clear for today.</p>
            </div>
          ) : (() => {
            const active = todayList.filter(b => parseLocal(b.end_at) > now)
            const past   = todayList.filter(b => parseLocal(b.end_at) <= now)

            const renderCard = (b: Booking) => {
              const ongoing = parseLocal(b.start_at) <= now && parseLocal(b.end_at) > now
              const isPast  = parseLocal(b.end_at) <= now
              return (
                <div key={b.id}
                  className={`rounded-2xl px-4 py-3.5 space-y-2 transition-colors ${
                    ongoing
                      ? 'bg-[#f6ffe0] border-2 border-[#adee2b]'
                      : isPast
                        ? 'bg-slate-50 border border-slate-100 opacity-60'
                        : 'bg-white border border-slate-100 hover:border-slate-200'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-[12px] font-black text-slate-800 leading-tight flex-1">{b.title}</p>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {ongoing && (
                        <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[8px] font-black uppercase bg-[#adee2b] text-black">
                          <span className="size-1.5 rounded-full bg-black/40 animate-pulse inline-block" />
                          On Going
                        </span>
                      )}
                      <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase ${STATUS_STYLE[b.status] ?? 'bg-slate-100 text-slate-500'}`}>
                        {b.status}
                      </span>
                    </div>
                  </div>
                  {b.booked_for && (
                    <div className="flex items-center gap-2 text-[10px] text-slate-400 font-bold">
                      <span className="material-symbols-outlined shrink-0" style={{ fontSize: 13 }}>person_pin</span>
                      <span className="truncate">for {b.booked_for}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-[10px] text-slate-500 font-bold">
                    <span className="material-symbols-outlined shrink-0" style={{ fontSize: 13 }}>schedule</span>
                    <span className="tabular-nums">{fmtTime(b.start_at)} – {fmtTime(b.end_at)}</span>
                  </div>
                  {b.room && (
                    <div className="flex items-center gap-2 text-[10px] text-slate-400 font-medium">
                      <span className="material-symbols-outlined shrink-0" style={{ fontSize: 13 }}>meeting_room</span>
                      <span className="truncate">{b.room.name}{b.room.building ? ` · ${b.room.building.code ?? b.room.building.name}` : ''}</span>
                    </div>
                  )}
                </div>
              )
            }

            return (
              <>
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                  {todayList.length} booking{todayList.length !== 1 ? 's' : ''} today
                </p>
                {active.map(renderCard)}
                {past.length > 0 && (
                  <>
                    <div className="flex items-center gap-2 pt-1">
                      <div className="flex-1 h-px bg-slate-100" />
                      <span className="text-[9px] font-black uppercase tracking-widest text-slate-300">Past</span>
                      <div className="flex-1 h-px bg-slate-100" />
                    </div>
                    {past.map(renderCard)}
                  </>
                )}
              </>
            )
          })()}
        </div>
      </div>
    </>
  )
}
