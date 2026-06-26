import { useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../../context/AuthContext'
import { updateAvatar, updatePassword, removeAvatar } from '../../api/auth'
import { getGeneralSettings } from '../../api/settings'
import UserAvatar from '../ui/UserAvatar'

interface Props {
  open: boolean
  onClose: () => void
}

const ROLE_LABEL: Record<string, string> = {
  admin: 'Administrator', building_admin: 'Building Admin',
  receptionist: 'Receptionist', user: 'User',
}

export default function UserProfileModal({ open, onClose }: Props) {
  const { user, setUser } = useAuth()
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [removing,  setRemoving]  = useState(false)
  const [error,     setError]     = useState<string | null>(null)
  const [tab,       setTab]       = useState<'profile' | 'password'>('profile')
  const [currentPw, setCurrentPw] = useState('')
  const [newPw,     setNewPw]     = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [showPw,    setShowPw]    = useState(false)
  const [pwLoading, setPwLoading] = useState(false)
  const [pwError,   setPwError]   = useState<string | null>(null)
  const [pwSuccess, setPwSuccess] = useState(false)
  const [copied,    setCopied]    = useState<string | null>(null)

  const { data: generalSettings } = useQuery({
    queryKey: ['settings-general'],
    queryFn: getGeneralSettings,
    staleTime: 5 * 60_000,
    enabled: open,
  })

  if (!open || !user) return null

  const isSuperAdmin = user.role === 'superadmin'
  const canChangePassword = isSuperAdmin || (generalSettings?.allow_password_change !== false)

  function copyField(label: string, value: string) {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(label); setTimeout(() => setCopied(null), 1500)
    })
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true); setError(null)
    try { const updated = await updateAvatar(file); setUser(updated) }
    catch { setError('Upload failed. Max 2MB, images only.') }
    finally { setUploading(false); if (fileRef.current) fileRef.current.value = '' }
  }

  async function handleRemoveAvatar() {
    setRemoving(true); setError(null)
    try {
      await removeAvatar()
      setUser({ ...user, avatar: undefined })
    } catch { setError('Remove failed.') }
    finally { setRemoving(false) }
  }

  async function handleChangePw(e: React.FormEvent) {
    e.preventDefault()
    if (newPw !== confirmPw) { setPwError('Passwords do not match.'); return }
    if (newPw.length < 8) { setPwError('Min. 8 characters.'); return }
    setPwLoading(true); setPwError(null); setPwSuccess(false)
    try {
      await updatePassword(currentPw, newPw, confirmPw)
      setPwSuccess(true); setCurrentPw(''); setNewPw(''); setConfirmPw('')
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      setPwError(msg || 'Failed to update password.')
    } finally { setPwLoading(false) }
  }

  const hasRealAvatar = !!(user.avatar && (user.avatar.startsWith('http') || user.avatar.startsWith('/storage')))

  const FIELDS = [
    { label: 'Full Name',  value: user.name,         icon: 'person' },
    { label: 'Email',      value: user.email,         icon: 'mail' },
    { label: 'Department', value: user.department,    icon: 'business' },
    { label: 'Extension',  value: user.ext || '—',   icon: 'call' },
    { label: 'Role',       value: ROLE_LABEL[user.role] ?? user.role, icon: 'badge' },
  ]

  const tabIdx = tab === 'password' ? 1 : 0

  return createPortal(
    <div className="fixed inset-0 z-[300] flex items-center justify-center">
      <style>{`
        @keyframes prof-in {
          from { opacity: 0; transform: scale(0.96) translateY(8px) }
          to   { opacity: 1; transform: scale(1) translateY(0) }
        }
      `}</style>

      {/* Backdrop */}
      <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.32)' }} onClick={onClose} />

      {/* Glass panel */}
      <div className="relative w-[520px] overflow-hidden"
        style={{
          background: 'var(--ds-glass-bg)',
          backdropFilter: 'blur(48px) saturate(200%)',
          WebkitBackdropFilter: 'blur(48px) saturate(200%)',
          border: '1px solid var(--ds-glass-border)',
          borderRadius: 28,
          boxShadow: 'var(--ds-glass-shadow)',
          animation: 'prof-in 0.22s cubic-bezier(0.34,1.04,0.64,1) both',
        }}>

        {/* Header */}
        <div className="px-6 py-5 flex items-center justify-between" style={{ borderBottom: '1px solid var(--ds-border-sub)' }}>
          <div className="flex items-center gap-3">
            <div className="size-9 rounded-xl flex items-center justify-center" style={{ background: 'var(--ds-bg-surface-2)' }}>
              <span className="material-symbols-outlined" style={{ fontSize: 18, color: '#adee2b', WebkitTextStroke: '0.5px rgba(0,0,0,0.3)' }}>account_circle</span>
            </div>
            <div>
              <p className="text-[14px] font-black" style={{ color: 'var(--ds-text-1)' }}>My Profile</p>
              <p className="text-[9px] font-bold uppercase tracking-widest" style={{ color: 'var(--ds-text-3)' }}>{ROLE_LABEL[user.role] ?? user.role}</p>
            </div>
          </div>
          <button onClick={onClose}
            className="size-8 rounded-full flex items-center justify-center transition-all hover:scale-110 active:scale-95"
            style={{ background: 'var(--ds-bg-surface-2)', color: 'var(--ds-text-2)' }}>
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>close</span>
          </button>
        </div>

        {/* Avatar section */}
        <div className="flex items-center gap-4 px-6 py-5" style={{ borderBottom: '1px solid var(--ds-border-sub)' }}>
          <div className="relative group shrink-0">
            <UserAvatar name={user.name} avatar={user.avatar} size={72}
              style={{ border: '3px solid var(--ds-glass-border)', boxShadow: '0 4px 16px rgba(0,0,0,0.12)' }} />
            <button onClick={() => fileRef.current?.click()} disabled={uploading || removing}
              className="absolute inset-0 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              style={{ background: 'rgba(0,0,0,0.50)' }}>
              {uploading
                ? <span className="material-symbols-outlined text-white animate-spin" style={{ fontSize: 20 }}>progress_activity</span>
                : <span className="material-symbols-outlined text-white" style={{ fontSize: 20 }}>photo_camera</span>
              }
            </button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[16px] font-black truncate" style={{ color: 'var(--ds-text-1)' }}>{user.name}</p>
            <p className="text-[12px] font-medium truncate" style={{ color: 'var(--ds-text-3)' }}>{user.email}</p>
            <div className="flex items-center gap-2 mt-2">
              <button onClick={() => fileRef.current?.click()} disabled={uploading || removing}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase transition-colors disabled:opacity-40"
                style={{ background: 'var(--ds-bg-surface-2)', color: 'var(--ds-text-2)' }}>
                <span className="material-symbols-outlined" style={{ fontSize: 13 }}>upload</span>
                {uploading ? 'Uploading…' : 'Upload Photo'}
              </button>
              <button onClick={handleRemoveAvatar} disabled={removing || uploading || !hasRealAvatar}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase transition-colors disabled:opacity-40"
                style={{ background: hasRealAvatar ? 'rgba(239,68,68,0.08)' : 'var(--ds-bg-surface-2)', color: hasRealAvatar ? '#dc2626' : 'var(--ds-text-4)' }}>
                <span className="material-symbols-outlined" style={{ fontSize: 13 }}>delete</span>
                {removing ? 'Removing…' : 'Remove Photo'}
              </button>
            </div>
            {error && <p className="text-[10px] font-bold text-red-500 mt-1.5">{error}</p>}
          </div>
        </div>

        {/* Tabs — only show if password change is allowed */}
        {canChangePassword && (
          <div className="px-6 pt-4 pb-0">
            <div className="relative flex p-1 rounded-[14px]" style={{ background: 'var(--ds-bg-surface-2)' }}>
              <div className="absolute top-1 bottom-1 rounded-[10px] pointer-events-none transition-all duration-200"
                style={{
                  width: 'calc((100% - 8px) / 2)',
                  left: `calc(4px + ${tabIdx} * (100% - 8px) / 2)`,
                  background: 'var(--ds-pill-bg)',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.10), inset 0 1px 0 rgba(255,255,255,0.8)',
                  transition: 'left 0.24s cubic-bezier(0.4,0,0.2,1)',
                }} />
              {([{ key: 'profile', label: 'Profile' }, { key: 'password', label: 'Change Password' }] as const).map(t => (
                <button key={t.key} onClick={() => { setTab(t.key); setPwError(null); setPwSuccess(false) }}
                  className="relative z-10 flex-1 py-2 text-[11px] font-black uppercase tracking-wide rounded-[10px] transition-colors duration-150"
                  style={{ color: tab === t.key ? 'var(--ds-text-1)' : 'var(--ds-text-3)' }}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Body */}
        <div className="relative overflow-hidden" style={{ height: 460 }}>

          {/* Profile tab */}
          <div className="absolute inset-0 px-6 py-4 overflow-y-auto space-y-2"
            style={{
              opacity: tab === 'profile' ? 1 : 0,
              transform: tab === 'profile' ? 'translateX(0)' : 'translateX(-16px)',
              transition: 'opacity 200ms ease, transform 200ms ease',
              pointerEvents: tab === 'profile' ? 'auto' : 'none',
            }}>
            {FIELDS.map(({ label, value, icon }) => (
              <div key={label} className="flex items-center gap-3 px-4 py-3 rounded-2xl group"
                style={{ background: 'var(--ds-bg-surface-2)' }}>
                <span className="material-symbols-outlined shrink-0" style={{ fontSize: 18, color: 'var(--ds-text-4)' }}>{icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-[9px] font-black uppercase tracking-widest" style={{ color: 'var(--ds-text-3)' }}>{label}</p>
                  <p className="text-[13px] font-black truncate mt-0.5" style={{ color: 'var(--ds-text-1)' }}>{value}</p>
                </div>
                <button onClick={() => copyField(label, value)}
                  className="shrink-0 size-7 rounded-lg flex items-center justify-center transition-all opacity-0 group-hover:opacity-100"
                  style={{ background: 'var(--ds-bg-raised)', color: copied === label ? '#adee2b' : 'var(--ds-text-3)' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 14 }}>
                    {copied === label ? 'check' : 'content_copy'}
                  </span>
                </button>
              </div>
            ))}
            <p className="text-center text-[10px] font-bold pt-1 uppercase tracking-wider" style={{ color: 'var(--ds-text-4)' }}>
              Contact IT to update name, email or department
            </p>
          </div>

          {/* Password tab */}
          <div className="absolute inset-0 px-6 py-4"
            style={{
              opacity: tab === 'password' ? 1 : 0,
              transform: tab === 'password' ? 'translateX(0)' : 'translateX(16px)',
              transition: 'opacity 200ms ease, transform 200ms ease',
              pointerEvents: tab === 'password' ? 'auto' : 'none',
            }}>
            <form onSubmit={handleChangePw} className="space-y-3">
              {[
                { label: 'Current Password', value: currentPw, setter: setCurrentPw },
                { label: 'New Password',     value: newPw,     setter: setNewPw },
                { label: 'Confirm Password', value: confirmPw, setter: setConfirmPw },
              ].map(({ label, value, setter }) => (
                <div key={label}>
                  <label className="text-[10px] font-black uppercase tracking-widest block mb-1.5 px-1" style={{ color: 'var(--ds-text-3)' }}>{label}</label>
                  <input type={showPw ? 'text' : 'password'} value={value} onChange={e => setter(e.target.value)} required
                    className="w-full px-4 py-2.5 rounded-2xl text-[13px] font-bold focus:outline-none focus:ring-2 focus:ring-[#adee2b] transition-all"
                    style={{ background: 'var(--ds-bg-surface-2)', border: '1px solid var(--ds-border-sub)', color: 'var(--ds-text-1)' }}
                    placeholder="••••••••" />
                </div>
              ))}
              <label className="flex items-center gap-2.5 px-1 cursor-pointer select-none">
                <button type="button" onClick={() => setShowPw(v => !v)} className="relative shrink-0" style={{ width: 36, height: 20 }}>
                  <div className="absolute inset-0 rounded-full transition-colors duration-200" style={{ background: showPw ? '#adee2b' : 'var(--ds-border)' }} />
                  <div className="absolute top-1 rounded-full transition-all duration-200" style={{ width: 12, height: 12, left: showPw ? 22 : 4, background: showPw ? '#1a1a1a' : 'var(--ds-text-3)' }} />
                </button>
                <span className="text-[11px] font-bold" style={{ color: 'var(--ds-text-2)' }}>Show passwords</span>
              </label>
              {pwError   && <p className="text-[11px] font-bold text-red-500 px-1">{pwError}</p>}
              {pwSuccess && <p className="text-[11px] font-bold px-1" style={{ color: '#4d7c00' }}>Password updated successfully!</p>}
              <button type="submit" disabled={pwLoading}
                className="w-full py-2.5 rounded-2xl text-[12px] font-black uppercase tracking-wide transition-colors disabled:opacity-50"
                style={{ background: 'var(--ds-text-1)', color: '#adee2b' }}>
                {pwLoading ? 'Updating…' : 'Update Password'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}
