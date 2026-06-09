import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { Booking, Room } from '../../types/index'
import { getRooms, checkAvailability } from '../../api/rooms'
import { createBooking, updateBooking } from '../../api/bookings'

interface BookingPanelProps {
  open: boolean
  onClose: () => void
  initialRoom?: Room | null
  editBooking?: Booking | null
  prefillStart?: string
  prefillEnd?: string
  prefillDate?: string
  onSubmit?: () => void
}

export default function BookingPanel({ open, onClose, initialRoom, editBooking, prefillStart, prefillEnd, prefillDate, onSubmit }: BookingPanelProps) {
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null)
  const [title, setTitle] = useState('')
  const [desc, setDesc] = useState('')
  const [date, setDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const [status, setStatus] = useState<'confirmed' | 'tentative'>('confirmed')
  const [type, setType] = useState<'internal' | 'external'>('internal')
  const [repeat, setRepeat] = useState<'none' | 'daily' | 'weekly'>('none')
  const [pantryOpen, setPantryOpen] = useState(false)
  const [coffeeQty, setCoffeeQty] = useState(2)
  const [teaQty, setTeaQty] = useState(0)
  const [waterQty, setWaterQty] = useState(5)
  const [snackQty, setSnackQty] = useState(0)
  const [pantrySaved, setPantrySaved] = useState(false)
  const [roomSearch, setRoomSearch] = useState('')
  const [showRoomDrop, setShowRoomDrop] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const isEdit = !!editBooking
  const [availResult, setAvailResult] = useState<{ available: boolean } | null>(null)
  const [availChecking, setAvailChecking] = useState(false)
  const availTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const today = new Date().toISOString().split('T')[0]

  const { data: rooms = [] } = useQuery({ queryKey: ['rooms'], queryFn: getRooms })

  useEffect(() => {
    if (!open) return
    if (editBooking) {
      setTitle(editBooking.title)
      setDesc(editBooking.description || '')
      setDate(editBooking.start_at.split('T')[0])
      setEndDate(editBooking.end_at.split('T')[0])
      setStartTime(editBooking.start_at.split('T')[1]?.slice(0, 5))
      setEndTime(editBooking.end_at.split('T')[1]?.slice(0, 5))
      setStatus(editBooking.status as 'confirmed' | 'tentative')
      setType(editBooking.type)
      setSelectedRoom(editBooking.room || null)
    } else {
      setTitle('')
      setDesc('')
      setDate(prefillDate || today)
      setEndDate(prefillDate || today)
      setStartTime(prefillStart || '')
      setEndTime(prefillEnd || '')
      setStatus('confirmed')
      setType('internal')
      setRepeat('none')
      setSelectedRoom(initialRoom || null)
      setPantrySaved(false)
    }
  }, [open, editBooking, initialRoom])

  // Real-time availability check via API (debounced)
  useEffect(() => {
    if (!open) { setAvailResult(null); setAvailChecking(false); return }
    if (!selectedRoom || !date || !startTime || !endTime) { setAvailResult(null); return }
    const [h1, m1] = startTime.split(':').map(Number)
    const [h2, m2] = endTime.split(':').map(Number)
    if ((h2 * 60 + m2) <= (h1 * 60 + m1)) { setAvailResult(null); return }

    setAvailChecking(true)
    if (availTimer.current) clearTimeout(availTimer.current)
    availTimer.current = setTimeout(async () => {
      try {
        const res = await checkAvailability(
          selectedRoom.id,
          `${date} ${startTime}:00`,
          `${endDate || date} ${endTime}:00`,
          isEdit && editBooking ? editBooking.id : undefined,
        )
        setAvailResult({ available: !!res.available })
      } catch {
        setAvailResult(null)
      } finally {
        setAvailChecking(false)
      }
    }, 600)
    return () => { if (availTimer.current) clearTimeout(availTimer.current) }
  }, [open, selectedRoom?.id, date, endDate, startTime, endTime, editBooking?.id])

  function getDuration() {
    if (!startTime || !endTime) return '0.0 HOURS'
    const [h1, m1] = startTime.split(':').map(Number)
    const [h2, m2] = endTime.split(':').map(Number)
    const diff = (h2 + m2 / 60) - (h1 + m1 / 60)
    return diff > 0 ? `${diff.toFixed(1)} HOURS` : 'INVALID TIME'
  }

  function isTimeValid() {
    if (!startTime || !endTime) return null
    const [h1, m1] = startTime.split(':').map(Number)
    const [h2, m2] = endTime.split(':').map(Number)
    return (h2 * 60 + m2) > (h1 * 60 + m1)
  }

  function isAvailable(): boolean | null {
    if (!isTimeValid()) return isTimeValid() === false ? false : null
    if (!selectedRoom) return null
    if (availChecking) return null
    return availResult?.available ?? null
  }

  function isValid() {
    return !!(title.trim() && startTime && endTime && selectedRoom && isAvailable() === true)
  }

  async function handleSubmit() {
    if (!isValid() || !selectedRoom) return
    setSubmitting(true)
    setError('')
    try {
      const payload = {
        room_id: selectedRoom.id,
        title,
        description: desc,
        start_at: `${date} ${startTime}:00`,
        end_at: `${endDate} ${endTime}:00`,
        status,
        type,
      }
      if (isEdit && editBooking) {
        await updateBooking(editBooking.id, payload)
      } else {
        await createBooking(payload)
      }
      onSubmit?.()
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      setError(msg || 'Failed to save booking.')
    } finally {
      setSubmitting(false)
    }
  }

  const filteredRooms = (rooms as Room[]).filter((r: Room) =>
    r.name.toLowerCase().includes(roomSearch.toLowerCase()) ||
    r.type.toLowerCase().includes(roomSearch.toLowerCase())
  )

  const roomTypeColor = (type: string) =>
    type === 'Ballroom' ? 'bg-purple-400' : type === 'Executive' ? 'bg-blue-400' : 'bg-green-400'

  return (
    <>
      {/* Overlay */}
      <div
        className={`fixed inset-0 bg-black/40 backdrop-blur-sm z-[100] transition-opacity duration-300 ${open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className={`fixed top-0 right-0 h-full w-[440px] bg-white text-slate-900 z-[110] flex flex-col shadow-[-20px_0_80px_rgba(0,0,0,0.08)] border-l border-slate-100 transition-transform duration-[450ms] cubic-bezier(0.32,0.72,0,1) ${open ? 'translate-x-0' : 'translate-x-full'}`}
      >
        {/* Header */}
        <div className="p-7 pb-4 flex items-start justify-between shrink-0">
          <div>
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.25em] leading-none">
              {isEdit ? 'Edit Booking' : 'Create Booking'}
            </p>
            {/* Room selector */}
            <div className="relative mt-1">
              <button
                onClick={() => setShowRoomDrop(!showRoomDrop)}
                className="text-3xl font-black italic tracking-tighter text-blue-600 leading-none uppercase hover:text-blue-700 transition-colors flex items-center gap-2"
              >
                {selectedRoom?.name || 'Select a Room'}
                <span className="material-symbols-outlined text-lg text-blue-400">expand_more</span>
              </button>
              {showRoomDrop && (
                <div className="absolute top-full left-0 mt-2 w-72 bg-white border border-slate-100 rounded-2xl shadow-2xl z-50 overflow-hidden">
                  <div className="p-3 border-b border-slate-100">
                    <input
                      type="text"
                      placeholder="Search room..."
                      value={roomSearch}
                      onChange={e => setRoomSearch(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-[#adee2b]"
                      autoFocus
                    />
                  </div>
                  <div className="max-h-56 overflow-y-auto">
                    {filteredRooms.map(r => (
                      <button
                        key={r.id}
                        onClick={() => { setSelectedRoom(r); setShowRoomDrop(false); setRoomSearch('') }}
                        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[#f7fee7] transition-colors text-left"
                      >
                        <div className={`size-2 rounded-full shrink-0 ${roomTypeColor(r.type)}`} />
                        <div>
                          <p className="text-xs font-black">{r.name}</p>
                          <p className="text-[9px] text-slate-400 font-bold">{r.capacity} pax &middot; {r.floor}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="size-10 flex items-center justify-center rounded-full bg-slate-100 hover:bg-slate-900 hover:text-[#adee2b] transition-all group"
          >
            <span className="material-symbols-outlined text-lg group-hover:rotate-90 transition-transform">close</span>
          </button>
        </div>

        <div className="flex-1 overflow-hidden relative flex flex-col">
          {/* Pantry pull tab */}
          <button
            onClick={() => setPantryOpen(true)}
            className="absolute right-0 top-1/2 -translate-y-1/2 z-20 bg-black text-[#adee2b] py-8 px-2 rounded-l-2xl shadow-xl flex flex-col items-center gap-3 hover:pr-3 transition-all"
          >
            <span className="material-symbols-outlined text-sm">flatware</span>
            <span className="text-[9px] font-black uppercase tracking-widest" style={{ writingMode: 'vertical-lr' }}>Pantry</span>
          </button>

          {/* Main form */}
          <div className="flex-1 overflow-y-auto px-7 space-y-4 pb-4" style={{ scrollbarWidth: 'thin' }}>

            {/* Date & Time */}
            <div className="bg-slate-50 p-5 rounded-[1.8rem] border border-slate-100 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black uppercase text-slate-400 tracking-wider px-1">Start Date</label>
                  <input type="date" value={date} onChange={e => setDate(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl text-xs font-bold p-2.5 focus:ring-2 focus:ring-[#adee2b] focus:outline-none" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black uppercase text-slate-400 tracking-wider px-1">End Date</label>
                  <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl text-xs font-bold p-2.5 focus:ring-2 focus:ring-[#adee2b] focus:outline-none" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black uppercase text-slate-400 tracking-wider px-1">Start Time</label>
                  <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl text-xs font-bold p-2.5 focus:ring-2 focus:ring-[#adee2b] focus:outline-none" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black uppercase text-slate-400 tracking-wider px-1">End Time</label>
                  <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl text-xs font-bold p-2.5 focus:ring-2 focus:ring-[#adee2b] focus:outline-none" />
                </div>
              </div>
              <div className="flex justify-center">
                <div className="bg-black text-[#adee2b] text-[10px] font-black px-5 py-1.5 rounded-full border border-[#adee2b]/20">
                  {getDuration()}
                </div>
              </div>
            </div>

            {/* Details */}
            <div className="bg-slate-50 p-5 rounded-[1.8rem] border border-slate-100 space-y-3">
              <div className="space-y-1.5">
                <label className="text-[9px] font-black uppercase text-slate-400 tracking-wider px-1">Meeting Title *</label>
                <input type="text" value={title} onChange={e => setTitle(e.target.value)}
                  placeholder="e.g. Brand Strategy 2026"
                  className="w-full bg-white border border-slate-200 rounded-xl text-xs font-bold p-2.5 focus:ring-2 focus:ring-[#adee2b] focus:outline-none" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[9px] font-black uppercase text-slate-400 tracking-wider px-1">Description</label>
                <textarea rows={2} value={desc} onChange={e => setDesc(e.target.value)}
                  placeholder="Agenda, notes..."
                  className="w-full bg-white border border-slate-200 rounded-xl text-[11px] font-medium p-2.5 focus:ring-2 focus:ring-[#adee2b] focus:outline-none resize-none" />
              </div>
              {pantrySaved && (
                <div className="flex items-center gap-2 bg-slate-900 text-[#adee2b] px-4 py-3 rounded-2xl">
                  <span className="material-symbols-outlined text-sm">shopping_bag</span>
                  <span className="text-[9px] font-black uppercase tracking-widest">Pantry Request Added</span>
                </div>
              )}
            </div>

            {/* Options */}
            <div className="bg-slate-50 p-5 rounded-[1.8rem] border border-slate-100 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black uppercase text-slate-400 tracking-wider px-1">Type</label>
                  <div className="flex bg-slate-200/60 p-1 rounded-full gap-1 border border-black/5">
                    {(['internal', 'external'] as const).map(t => (
                      <button key={t} onClick={() => setType(t)}
                        className={`flex-1 py-1.5 text-[8px] font-black uppercase rounded-full transition-all ${type === t ? 'bg-white text-black shadow-sm' : 'text-slate-400'}`}>
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black uppercase text-slate-400 tracking-wider px-1">Status</label>
                  <div className="flex bg-slate-200/60 p-1 rounded-full gap-1 border border-black/5">
                    {(['confirmed', 'tentative'] as const).map(s => (
                      <button key={s} onClick={() => setStatus(s)}
                        className={`flex-1 py-1.5 text-[8px] font-black uppercase rounded-full transition-all ${status === s ? 'bg-black text-[#adee2b] shadow-sm' : 'text-slate-400'}`}>
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-[9px] font-black uppercase text-slate-400 tracking-wider px-1">Repeat</label>
                <div className="flex bg-slate-200/60 p-1 rounded-full gap-1 border border-black/5">
                  {(['none', 'daily', 'weekly'] as const).map(r => (
                    <button key={r} onClick={() => setRepeat(r)}
                      className={`flex-1 py-1.5 text-[8px] font-black uppercase rounded-full transition-all ${repeat === r ? 'bg-white text-black shadow-sm' : 'text-slate-400'}`}>
                      {r}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Availability */}
            {isTimeValid() === false && (
              <div className="flex items-center gap-3 px-4 py-3 rounded-2xl border-2 border-red-200 bg-red-50">
                <div className="size-8 rounded-xl bg-red-500 flex items-center justify-center text-white shrink-0">
                  <span className="material-symbols-outlined text-base">schedule</span>
                </div>
                <div>
                  <p className="text-[9px] font-black uppercase tracking-widest text-red-800">Invalid Time</p>
                  <p className="text-[9px] text-red-600 mt-0.5">End time must be after start time.</p>
                </div>
              </div>
            )}
            {isTimeValid() === true && availChecking && (
              <div className="flex items-center gap-3 px-4 py-3 rounded-2xl border-2 border-slate-100 bg-slate-50">
                <div className="size-8 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400 shrink-0">
                  <span className="material-symbols-outlined text-base animate-spin">progress_activity</span>
                </div>
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Checking availability&hellip;</p>
              </div>
            )}
            {isTimeValid() === true && !availChecking && isAvailable() === true && (
              <div className="flex items-center gap-3 px-4 py-3 rounded-2xl border-2 border-[#adee2b] bg-[#f7fee7]">
                <div className="size-8 rounded-xl bg-[#adee2b] flex items-center justify-center text-black shrink-0">
                  <span className="material-symbols-outlined text-base">verified</span>
                </div>
                <div>
                  <p className="text-[9px] font-black uppercase tracking-widest text-green-800">Room Available</p>
                  <p className="text-[9px] text-green-700 mt-0.5">No conflicts for this slot.</p>
                </div>
              </div>
            )}
            {isTimeValid() === true && !availChecking && isAvailable() === false && (
              <div className="flex items-center gap-3 px-4 py-3 rounded-2xl border-2 border-red-200 bg-red-50">
                <div className="size-8 rounded-xl bg-red-500 flex items-center justify-center text-white shrink-0">
                  <span className="material-symbols-outlined text-base">block</span>
                </div>
                <div>
                  <p className="text-[9px] font-black uppercase tracking-widest text-red-800">Room Conflict</p>
                  <p className="text-[9px] text-red-600 mt-0.5">Another booking exists at this time.</p>
                </div>
              </div>
            )}
          </div>

          {/* Pantry Slide */}
          <div
            className={`absolute inset-0 bg-white z-30 flex flex-col border-l-4 border-[#adee2b] transition-transform duration-500 ${pantryOpen ? 'translate-x-0' : 'translate-x-full'}`}
          >
            <div className="p-6 flex items-center justify-between border-b shrink-0">
              <div className="flex items-center gap-3">
                <div className="size-9 bg-black rounded-xl flex items-center justify-center text-[#adee2b]">
                  <span className="material-symbols-outlined text-base">flatware</span>
                </div>
                <h4 className="font-black uppercase tracking-tighter text-xl italic">Pantry Order</h4>
              </div>
              <button
                onClick={() => setPantryOpen(false)}
                className="size-8 bg-slate-100 rounded-full flex items-center justify-center hover:bg-black hover:text-[#adee2b] transition-all"
              >
                <span className="material-symbols-outlined text-sm">arrow_back</span>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-5 bg-slate-50/50">
              <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest px-1 mb-3">Hot Beverages</p>
              {[
                { label: 'Coffee', icon: 'coffee', qty: coffeeQty, set: setCoffeeQty, color: 'orange' },
                { label: 'Tea', icon: 'emoji_food_beverage', qty: teaQty, set: setTeaQty, color: 'green' },
              ].map(item => (
                <div key={item.label} className="bg-white p-4 rounded-3xl border border-slate-100 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`size-10 bg-${item.color}-50 text-${item.color}-500 rounded-2xl flex items-center justify-center`}>
                        <span className="material-symbols-outlined text-lg">{item.icon}</span>
                      </div>
                      <span className="text-xs font-black uppercase">{item.label}</span>
                    </div>
                    <div className="flex items-center bg-slate-100 rounded-full p-1 gap-1">
                      <button onClick={() => item.set(Math.max(0, item.qty - 1))} className="size-7 flex items-center justify-center text-sm font-black hover:bg-white rounded-full transition-colors">âˆ’</button>
                      <span className="w-6 text-center text-xs font-black">{item.qty}</span>
                      <button onClick={() => item.set(item.qty + 1)} className="size-7 flex items-center justify-center text-sm font-black hover:bg-white rounded-full transition-colors">+</button>
                    </div>
                  </div>
                </div>
              ))}
              <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest px-1 mt-4 mb-3">Others</p>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Water', icon: 'water_full', qty: waterQty, set: setWaterQty, color: 'blue' },
                  { label: 'Snacks', icon: 'cookie', qty: snackQty, set: setSnackQty, color: 'amber' },
                ].map(item => (
                  <div key={item.label} className="bg-white p-3 rounded-2xl border border-slate-100 flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                      <span className={`material-symbols-outlined text-${item.color}-400 text-base`}>{item.icon}</span>
                      <span className="text-[10px] font-black uppercase">{item.label}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => item.set(Math.max(0, item.qty - 1))} className="size-6 flex items-center justify-center text-sm font-black text-slate-400 hover:text-black">âˆ’</button>
                      <span className={`text-[10px] font-black text-${item.color}-600`}>{item.qty}</span>
                      <button onClick={() => item.set(item.qty + 1)} className="size-6 flex items-center justify-center text-sm font-black text-slate-400 hover:text-black">+</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="p-5 bg-white border-t shrink-0">
              <button
                onClick={() => { setPantryOpen(false); setPantrySaved(true) }}
                className="w-full py-4 bg-black text-[#adee2b] rounded-full text-[9px] font-black uppercase tracking-[0.2em] hover:scale-[1.02] active:scale-[0.98] transition-transform"
              >
                Save & Return â†’
              </button>
            </div>
          </div>
        </div>

        {/* Submit */}
        <div className="p-7 pt-3 shrink-0 space-y-3">
          {error && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-100 text-red-600 text-[11px] font-bold px-4 py-3 rounded-xl">
              <span className="material-symbols-outlined text-base">error</span>
              {error}
            </div>
          )}
          <button
            onClick={handleSubmit}
            disabled={!isValid() || submitting}
            className="w-full py-5 rounded-full text-[10px] font-black uppercase tracking-[0.2em] shadow-xl transition-all duration-200
              bg-[#adee2b] text-black hover:bg-black hover:text-[#adee2b] shadow-lime-400/20
              disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed disabled:shadow-none"
          >
            {submitting ? 'Saving...' : isEdit ? 'Save Changes' : 'Confirm Booking'}
          </button>
        </div>
      </div>
    </>
  )
}
