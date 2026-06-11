import { useRef, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { updateAvatar, updatePassword } from '../../api/auth'

interface Props {
  open: boolean
  onClose: () => void
}

export default function UserProfileModal({ open, onClose }: Props) {
  const { user, setUser } = useAuth()
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<'profile' | 'password'>('profile')
  const [currentPw, setCurrentPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [pwLoading, setPwLoading] = useState(false)
  const [pwError, setPwError] = useState<string | null>(null)
  const [pwSuccess, setPwSuccess] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)

  if (!open || !user) return null

  const avatarSrc = user.avatar?.startsWith('http') || user.avatar?.startsWith('/storage')
    ? user.avatar
    : `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.avatar || user.name}`

  function copyField(label: string, value: string) {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(label)
      setTimeout(() => setCopied(null), 1500)
    })
  }

  async function handleChangePw(e: React.FormEvent) {
    e.preventDefault()
    if (newPw !== confirmPw) { setPwError('Passwords do not match.'); return }
    if (newPw.length < 8) { setPwError('Min. 8 characters.'); return }
    setPwLoading(true); setPwError(null); setPwSuccess(false)
    try {
      await updatePassword(currentPw, newPw, confirmPw)
      setPwSuccess(true)
      setCurrentPw(''); setNewPw(''); setConfirmPw('')
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      setPwError(msg || 'Failed to update password.')
    } finally { setPwLoading(false) }
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true); setError(null)
    try {
      const updated = await updateAvatar(file)
      setUser(updated)
    } catch { setError('Upload failed. Max 2MB, images only.') }
    finally { setUploading(false); if (fileRef.current) fileRef.current.value = '' }
  }

  const FIELDS = [
    { label: 'Full Name', value: user.name, icon: 'person', copyable: true },
    { label: 'Email', value: user.email, icon: 'mail', copyable: true },
    { label: 'Department', value: user.department, icon: 'business', copyable: true },
    { label: 'Extension', value: user.ext || '—', icon: 'call', copyable: true },
    { label: 'Role', value: user.role, icon: 'badge', copyable: false },
  ]

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-3xl shadow-2xl w-[440px] overflow-hidden" style={{ height: 620 }}>

        {/* Header band */}
        <div className="h-28 bg-gradient-to-br from-slate-900 to-slate-700 shrink-0" />

        {/* Avatar */}
        <div className="absolute left-1/2 -translate-x-1/2 top-12">
          <div className="relative group">
            {user.avatar?.startsWith('http') || user.avatar?.startsWith('/storage')
              ? <img src={avatarSrc} className="size-28 rounded-full border-4 border-white object-cover shadow-xl" />
              : <img src={avatarSrc} className="size-28 rounded-full border-4 border-white bg-slate-100 p-1 shadow-xl" />
            }
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
            >
              {uploading
                ? <span className="material-symbols-outlined text-white animate-spin">progress_activity</span>
                : <span className="material-symbols-outlined text-white text-lg">photo_camera</span>
              }
            </button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
          </div>
        </div>

        {/* Close */}
        <button onClick={onClose} className="absolute top-4 right-4 size-8 rounded-full bg-white/20 flex items-center justify-center text-white hover:bg-white/30 transition-colors">
          <span className="material-symbols-outlined text-sm">close</span>
        </button>

        {/* Segmented tabs */}
        <div className="px-6 pt-20 pb-0 flex shrink-0">
          <div className="relative flex w-full bg-slate-100 rounded-2xl p-1">
            <div
              className="absolute top-1 bottom-1 w-[calc(50%-2px)] bg-white rounded-xl shadow-sm pointer-events-none transition-transform duration-200 ease-[cubic-bezier(0.4,0,0.2,1)]"
              style={{ transform: tab === 'password' ? 'translateX(calc(100% + 4px))' : 'translateX(0)' }}
            />
            {([
              { key: 'profile', label: 'Profile' },
              { key: 'password', label: 'Change Password' },
            ] as const).map(t => (
              <button
                key={t.key}
                onClick={() => { setTab(t.key); setPwError(null); setPwSuccess(false) }}
                className={`relative z-10 flex-1 py-2 text-[11px] font-black uppercase tracking-wide rounded-xl transition-colors duration-150 ${tab === t.key ? 'text-slate-900' : 'text-slate-400 hover:text-slate-600'}`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Body — fixed container, content switches with opacity */}
        <div className="relative flex-1 overflow-hidden" style={{ height: 380 }}>

          {/* Profile tab */}
          <div
            className="absolute inset-0 px-6 py-4 overflow-y-auto"
            style={{
              opacity: tab === 'profile' ? 1 : 0,
              transform: tab === 'profile' ? 'translateX(0)' : 'translateX(-16px)',
              transition: 'opacity 200ms ease, transform 200ms ease',
              pointerEvents: tab === 'profile' ? 'auto' : 'none',
            }}
          >
            {error && <p className="text-[11px] font-bold text-red-500 mb-3 text-center">{error}</p>}
            <div className="space-y-2.5">
              {FIELDS.map(({ label, value, icon, copyable }) => (
                <div key={label} className="flex items-center gap-3 px-4 py-3 bg-slate-50 rounded-2xl group">
                  <span className="material-symbols-outlined text-slate-300 shrink-0" style={{ fontSize: 18 }}>{icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</p>
                    <p className="text-[13px] font-black text-slate-800 truncate mt-0.5">{value}</p>
                  </div>
                  {copyable && (
                    <button
                      onClick={() => copyField(label, value)}
                      className="shrink-0 size-7 rounded-lg flex items-center justify-center text-slate-300 hover:text-slate-600 hover:bg-white transition-all opacity-0 group-hover:opacity-100"
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: 15 }}>
                        {copied === label ? 'check' : 'content_copy'}
                      </span>
                    </button>
                  )}
                </div>
              ))}
            </div>
            <p className="text-center text-[10px] text-slate-300 font-bold mt-4 uppercase tracking-wider">
              Contact IT to update name, email, or department
            </p>
          </div>

          {/* Password tab */}
          <div
            className="absolute inset-0 px-6 py-4"
            style={{
              opacity: tab === 'password' ? 1 : 0,
              transform: tab === 'password' ? 'translateX(0)' : 'translateX(16px)',
              transition: 'opacity 200ms ease, transform 200ms ease',
              pointerEvents: tab === 'password' ? 'auto' : 'none',
            }}
          >
            <form onSubmit={handleChangePw} className="space-y-3">
              {[
                { label: 'Current Password', value: currentPw, setter: setCurrentPw },
                { label: 'New Password', value: newPw, setter: setNewPw },
                { label: 'Confirm New Password', value: confirmPw, setter: setConfirmPw },
              ].map(({ label, value, setter }) => (
                <div key={label}>
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1.5 px-1">{label}</label>
                  <input
                    type="password"
                    value={value}
                    onChange={e => setter(e.target.value)}
                    required
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-[13px] font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#adee2b] focus:border-transparent transition-all"
                    placeholder="••••••••"
                  />
                </div>
              ))}

              {pwError && <p className="text-[11px] font-bold text-red-500 px-1">{pwError}</p>}
              {pwSuccess && <p className="text-[11px] font-bold text-green-600 px-1">Password updated!</p>}

              <button
                type="submit"
                disabled={pwLoading}
                className="w-full py-3 rounded-2xl bg-slate-900 text-white text-[12px] font-black uppercase tracking-wide hover:bg-black transition-colors disabled:opacity-50 mt-1"
              >
                {pwLoading ? 'Updating...' : 'Update Password'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}
