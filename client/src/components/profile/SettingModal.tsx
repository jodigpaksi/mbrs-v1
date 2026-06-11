interface Props {
  open: boolean
  onClose: () => void
}

const SETTINGS = [
  {
    group: 'Notifications',
    items: [
      { label: 'Email reminders for upcoming bookings', defaultOn: true },
      { label: 'Notify when booking is approved/rejected', defaultOn: true },
      { label: 'Daily schedule digest', defaultOn: false },
    ],
  },
  {
    group: 'Display',
    items: [
      { label: 'Show past bookings dimmed in timeline', defaultOn: true },
      { label: 'Start week on Monday', defaultOn: true },
    ],
  },
]

export default function SettingModal({ open, onClose }: Props) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-3xl shadow-2xl w-[460px] max-h-[80vh] overflow-auto">

        {/* Header */}
        <div className="flex items-center justify-between px-8 py-6 border-b border-slate-100 sticky top-0 bg-white rounded-t-3xl">
          <div className="flex items-center gap-3">
            <div className="size-9 rounded-xl bg-slate-900 flex items-center justify-center">
              <span className="material-symbols-outlined text-[#adee2b] text-base">settings</span>
            </div>
            <div>
              <p className="text-[13px] font-black text-slate-900">Settings</p>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Preferences</p>
            </div>
          </div>
          <button onClick={onClose} className="size-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 hover:bg-slate-200 transition-colors">
            <span className="material-symbols-outlined text-sm">close</span>
          </button>
        </div>

        <div className="px-8 py-6 space-y-6">
          {SETTINGS.map(({ group, items }) => (
            <div key={group}>
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-3">{group}</p>
              <div className="space-y-2">
                {items.map(({ label, defaultOn }) => (
                  <label key={label} className="flex items-center justify-between px-4 py-3 bg-slate-50 rounded-2xl cursor-pointer group">
                    <span className="text-[11px] font-bold text-slate-700">{label}</span>
                    <div className={`relative w-9 h-5 rounded-full transition-colors ${defaultOn ? 'bg-[#adee2b]' : 'bg-slate-200'}`}>
                      <div className={`absolute top-0.5 size-4 rounded-full bg-white shadow transition-transform ${defaultOn ? 'translate-x-4' : 'translate-x-0.5'}`} />
                    </div>
                  </label>
                ))}
              </div>
            </div>
          ))}

          <p className="text-center text-[9px] text-slate-300 font-bold uppercase tracking-wider pt-2">
            Settings are saved automatically
          </p>
        </div>
      </div>
    </div>
  )
}
