import { useState } from 'react'

export default function AiAgentFab() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <style>{`
        @keyframes fab-in {
          from { opacity: 0; transform: scale(0.7) translateY(12px) }
          to   { opacity: 1; transform: scale(1) translateY(0) }
        }
        @keyframes panel-in {
          from { opacity: 0; transform: translateY(24px) scale(0.97) }
          to   { opacity: 1; transform: translateY(0) scale(1) }
        }
        @keyframes dot-pulse {
          0%, 100% { opacity: 1; transform: scale(1) }
          50%       { opacity: 0.5; transform: scale(0.8) }
        }
        @keyframes shimmer {
          from { background-position: -200% center }
          to   { background-position: 200% center }
        }
      `}</style>

      {/* Chat panel */}
      {open && (
        <div
          className="fixed z-[9998] flex flex-col"
          style={{
            right: 28,
            bottom: 96,
            width: 380,
            height: 520,
            background: 'rgba(12,16,38,0.72)',
            backdropFilter: 'blur(48px) saturate(200%)',
            WebkitBackdropFilter: 'blur(48px) saturate(200%)',
            border: '1px solid rgba(255,255,255,0.10)',
            borderRadius: 28,
            boxShadow: '0 24px 64px rgba(0,0,0,0.40), 0 8px 24px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.08)',
            animation: 'panel-in 0.28s cubic-bezier(0.34,1.56,0.64,1) both',
          }}
        >
          {/* Header */}
          <div className="flex items-center gap-3 px-5 pt-5 pb-4 shrink-0"
            style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
            <div className="relative shrink-0">
              <div className="size-9 rounded-xl flex items-center justify-center"
                style={{
                  background: 'linear-gradient(135deg, #adee2b 0%, #7ecb00 100%)',
                  boxShadow: '0 4px 12px rgba(173,238,43,0.35)',
                }}>
                <span className="material-symbols-outlined text-black" style={{ fontSize: 18, fontVariationSettings: "'FILL' 1" }}>
                  diamond
                </span>
              </div>
              <span className="absolute -top-0.5 -right-0.5 size-2.5 rounded-full bg-emerald-400 border-2"
                style={{ borderColor: 'rgba(12,16,38,0.72)', animation: 'dot-pulse 2.5s ease-in-out infinite' }} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-black text-white leading-none">RoomSync AI</p>
              <p className="text-[10px] font-bold mt-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>Powered by Claude</p>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="size-7 flex items-center justify-center rounded-xl transition-all"
              style={{ color: 'rgba(255,255,255,0.35)' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.08)', e.currentTarget.style.color = 'rgba(255,255,255,0.8)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent', e.currentTarget.style.color = 'rgba(255,255,255,0.35)')}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>close</span>
            </button>
          </div>

          {/* Messages area */}
          <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-3" style={{ scrollbarWidth: 'none' }}>
            {/* Welcome bubble */}
            <div className="flex items-end gap-2.5">
              <div className="size-7 rounded-xl shrink-0 flex items-center justify-center"
                style={{ background: 'linear-gradient(135deg, #adee2b 0%, #7ecb00 100%)' }}>
                <span className="material-symbols-outlined text-black" style={{ fontSize: 13, fontVariationSettings: "'FILL' 1" }}>diamond</span>
              </div>
              <div className="max-w-[80%] px-4 py-3 rounded-2xl rounded-bl-sm text-[12px] font-medium leading-relaxed"
                style={{
                  background: 'rgba(255,255,255,0.08)',
                  color: 'rgba(255,255,255,0.85)',
                  border: '1px solid rgba(255,255,255,0.07)',
                }}>
                Hi! I can help you check room availability, make a booking, or find schedules. What do you need?
              </div>
            </div>

            {/* Suggestion chips */}
            <div className="flex flex-wrap gap-2 pl-9 mt-1">
              {[
                'Rooms available today',
                'Quickest booking',
                'Schedule this week',
              ].map(chip => (
                <button key={chip}
                  className="text-[10px] font-black uppercase px-3 py-1.5 rounded-full transition-all"
                  style={{
                    background: 'rgba(173,238,43,0.10)',
                    color: '#adee2b',
                    border: '1px solid rgba(173,238,43,0.20)',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(173,238,43,0.20)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'rgba(173,238,43,0.10)')}
                >
                  {chip}
                </button>
              ))}
            </div>
          </div>

          {/* Input area */}
          <div className="px-4 pb-4 shrink-0">
            <div className="flex items-center gap-2 px-4 py-3 rounded-2xl"
              style={{
                background: 'rgba(255,255,255,0.07)',
                border: '1px solid rgba(255,255,255,0.10)',
              }}>
              <input
                placeholder="Ketik pesan..."
                className="flex-1 bg-transparent text-[12px] font-medium outline-none placeholder:font-medium"
                style={{ color: 'rgba(255,255,255,0.85)', caretColor: '#adee2b' }}
                onFocus={e => ((e.currentTarget.parentElement!.style.borderColor = 'rgba(173,238,43,0.35)'))}
                onBlur={e => ((e.currentTarget.parentElement!.style.borderColor = 'rgba(255,255,255,0.10)'))}
              />
              <button
                className="size-7 rounded-xl flex items-center justify-center transition-all shrink-0"
                style={{ background: 'rgba(173,238,43,0.15)', color: '#adee2b' }}
                onMouseEnter={e => (e.currentTarget.style.background = '#adee2b', e.currentTarget.style.color = '#000')}
                onMouseLeave={e => (e.currentTarget.style.background = 'rgba(173,238,43,0.15)', e.currentTarget.style.color = '#adee2b')}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 15 }}>arrow_upward</span>
              </button>
            </div>
            <p className="text-center text-[9px] font-bold mt-2" style={{ color: 'rgba(255,255,255,0.18)' }}>
              AI dapat membuat kesalahan. Verifikasi informasi penting.
            </p>
          </div>
        </div>
      )}

      {/* FAB */}
      <button
        onClick={() => setOpen(v => !v)}
        className="fixed z-[9999] flex items-center justify-center transition-all duration-200"
        style={{
          right: 28,
          bottom: 28,
          width: 56,
          height: 56,
          borderRadius: 18,
          background: open
            ? 'rgba(12,16,38,0.85)'
            : 'rgba(12,16,38,0.65)',
          backdropFilter: 'blur(24px) saturate(200%)',
          WebkitBackdropFilter: 'blur(24px) saturate(200%)',
          border: open
            ? '1px solid rgba(173,238,43,0.35)'
            : '1px solid rgba(255,255,255,0.13)',
          boxShadow: open
            ? '0 8px 32px rgba(173,238,43,0.20), 0 4px 16px rgba(0,0,0,0.30), inset 0 1px 0 rgba(255,255,255,0.10)'
            : '0 8px 32px rgba(0,0,0,0.28), 0 4px 12px rgba(0,0,0,0.20), inset 0 1px 0 rgba(255,255,255,0.10)',
          animation: 'fab-in 0.4s cubic-bezier(0.34,1.56,0.64,1) both',
          transform: open ? 'scale(1.05)' : 'scale(1)',
        }}
        onMouseEnter={e => {
          if (!open) {
            e.currentTarget.style.transform = 'scale(1.08)'
            e.currentTarget.style.boxShadow = '0 12px 40px rgba(173,238,43,0.18), 0 4px 16px rgba(0,0,0,0.28), inset 0 1px 0 rgba(255,255,255,0.12)'
            e.currentTarget.style.borderColor = 'rgba(173,238,43,0.25)'
          }
        }}
        onMouseLeave={e => {
          if (!open) {
            e.currentTarget.style.transform = 'scale(1)'
            e.currentTarget.style.boxShadow = '0 8px 32px rgba(0,0,0,0.28), 0 4px 12px rgba(0,0,0,0.20), inset 0 1px 0 rgba(255,255,255,0.10)'
            e.currentTarget.style.borderColor = 'rgba(255,255,255,0.13)'
          }
        }}
      >
        {/* Online indicator */}
        <span
          className="absolute rounded-full"
          style={{
            top: -3, right: -3,
            width: 10, height: 10,
            background: '#34d399',
            border: '2px solid #0c1026',
            animation: 'dot-pulse 2.5s ease-in-out infinite',
          }}
        />

        {/* Icon — rotates between diamond and close */}
        <span
          className="material-symbols-outlined transition-all duration-200"
          style={{
            fontSize: 22,
            fontVariationSettings: "'FILL' 1",
            color: open ? 'rgba(255,255,255,0.6)' : '#adee2b',
            transform: open ? 'rotate(45deg) scale(0.85)' : 'rotate(0deg) scale(1)',
          }}
        >
          {open ? 'close' : 'diamond'}
        </span>
      </button>
    </>
  )
}
