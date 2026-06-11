interface Props {
  open: boolean
  onClose: () => void
}

const FAQ = [
  {
    q: 'How do I book a room?',
    a: 'Click "New Booking" on the Schedule page, or click any empty slot in the timeline to pre-fill the time.',
  },
  {
    q: 'Can I edit or cancel a booking?',
    a: 'Yes — open the booking from My Bookings or the timeline, then click Edit or Cancel. Cancellations can be undone within 10 seconds.',
  },
  {
    q: 'What are tentative bookings?',
    a: 'Tentative bookings hold the slot but show as pending approval. They turn confirmed once an admin approves.',
  },
  {
    q: 'How do I drag-and-resize bookings?',
    a: 'On the Day view, drag a booking bar to move it, or drag its left/right edge to resize. Changes save automatically.',
  },
  {
    q: 'What are the booking time limits?',
    a: 'Bookings must start between 07:00–18:30 and end by 19:00, in 30-minute increments.',
  },
]

export default function HelpModal({ open, onClose }: Props) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-3xl shadow-2xl w-[480px] max-h-[80vh] overflow-auto">

        {/* Header */}
        <div className="flex items-center justify-between px-8 py-6 border-b border-slate-100 sticky top-0 bg-white rounded-t-3xl">
          <div className="flex items-center gap-3">
            <div className="size-9 rounded-xl bg-slate-900 flex items-center justify-center">
              <span className="material-symbols-outlined text-[#adee2b] text-base">help</span>
            </div>
            <div>
              <p className="text-[13px] font-black text-slate-900">Help & FAQ</p>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">RoomSync Pro</p>
            </div>
          </div>
          <button onClick={onClose} className="size-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 hover:bg-slate-200 transition-colors">
            <span className="material-symbols-outlined text-sm">close</span>
          </button>
        </div>

        <div className="px-8 py-6 space-y-4">
          {FAQ.map(({ q, a }) => (
            <div key={q} className="p-4 bg-slate-50 rounded-2xl">
              <p className="text-[11px] font-black text-slate-800 mb-1.5">{q}</p>
              <p className="text-[11px] font-medium text-slate-500 leading-relaxed">{a}</p>
            </div>
          ))}

          <div className="pt-2 text-center">
            <p className="text-[9px] text-slate-300 font-bold uppercase tracking-wider">
              Still need help? Contact IT support at ext. 100
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
