import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getReceptionists } from '../../api/rooms'

interface Props {
  open: boolean
  onClose: () => void
  roomName?: string
}

export default function ContactReceptionistModal({ open, onClose, roomName }: Props) {
  const [copied, setCopied] = useState<string | null>(null)

  const { data: receptionists = [], isLoading } = useQuery({
    queryKey: ['receptionists'],
    queryFn: getReceptionists,
    enabled: open,
    staleTime: 60000,
  })

  function copyEmail(email: string) {
    navigator.clipboard.writeText(email).then(() => {
      setCopied(email)
      setTimeout(() => setCopied(null), 1800)
    })
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-3xl shadow-2xl w-[400px] overflow-hidden">

        {/* Header */}
        <div className="bg-slate-900 px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="size-9 rounded-xl bg-[#adee2b] flex items-center justify-center">
              <span className="material-symbols-outlined text-black text-base">support_agent</span>
            </div>
            <div>
              <p className="text-[12px] font-black text-white">Contact Receptionist</p>
              {roomName && <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">{roomName}</p>}
            </div>
          </div>
          <button onClick={onClose} className="size-8 rounded-full bg-white/10 flex items-center justify-center text-slate-400 hover:bg-white/20 transition-colors">
            <span className="material-symbols-outlined text-sm">close</span>
          </button>
        </div>

        <div className="px-6 py-5">
          <p className="text-[11px] text-slate-500 font-medium mb-4 leading-relaxed">
            This room requires assistance from our Receptionist or GAA team. Please contact one of the following to arrange your booking:
          </p>

          {isLoading && (
            <div className="flex items-center justify-center py-8">
              <span className="material-symbols-outlined animate-spin text-slate-300">progress_activity</span>
            </div>
          )}

          {!isLoading && receptionists.length === 0 && (
            <div className="text-center py-6">
              <span className="material-symbols-outlined text-slate-200 text-4xl block mb-2">person_off</span>
              <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">No receptionists on duty</p>
              <p className="text-[10px] text-slate-400 mt-1">Please contact GAA at ext. 100</p>
            </div>
          )}

          <div className="space-y-2">
            {receptionists.map(r => {
              const avatarSrc = r.avatar?.startsWith('http') || r.avatar?.startsWith('/storage')
                ? r.avatar
                : `https://api.dicebear.com/7.x/avataaars/svg?seed=${r.avatar || r.name}`
              const isCopied = copied === r.email
              return (
                <div key={r.id} className="p-3 bg-slate-50 rounded-2xl space-y-2.5">
                  {/* Top row: avatar + name + ext */}
                  <div className="flex items-center gap-3">
                    {r.avatar?.startsWith('http') || r.avatar?.startsWith('/storage')
                      ? <img src={avatarSrc} className="size-10 rounded-full object-cover border-2 border-white shadow shrink-0" />
                      : <img src={avatarSrc} className="size-10 rounded-full bg-slate-200 p-0.5 border-2 border-white shadow shrink-0" />
                    }
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-black text-slate-800">{r.name}</p>
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wide">{r.department}</p>
                    </div>
                    {r.ext && (
                      <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 rounded-xl shrink-0">
                        <span className="material-symbols-outlined text-[#adee2b]" style={{ fontSize: 13 }}>call</span>
                        <span className="text-[11px] font-black text-white">ext. {r.ext}</span>
                      </div>
                    )}
                  </div>

                  {/* Email row */}
                  {r.email && (
                    <div className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-xl">
                      <span className="material-symbols-outlined text-slate-400 shrink-0" style={{ fontSize: 13 }}>mail</span>
                      <span className="flex-1 text-[11px] font-bold text-slate-600 truncate">{r.email}</span>
                      <button
                        onClick={() => copyEmail(r.email)}
                        className="shrink-0 size-6 rounded-lg flex items-center justify-center transition-all hover:scale-110 active:scale-95"
                        style={{
                          background: isCopied ? '#adee2b' : 'rgba(0,0,0,0.06)',
                          color: isCopied ? '#000' : '#94a3b8',
                        }}
                        title="Copy email"
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: 13 }}>
                          {isCopied ? 'check' : 'content_copy'}
                        </span>
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* GAA fallback */}
          <div className="mt-4 flex items-center gap-2 px-4 py-3 bg-[#f7fee7] border border-[#adee2b]/40 rounded-2xl">
            <span className="material-symbols-outlined text-lime-600" style={{ fontSize: 16 }}>info</span>
            <p className="text-[10px] font-bold text-slate-600">
              GAA general line: <span className="font-black text-slate-900">ext. 100</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
