import { useState, useRef, useEffect } from 'react'
import type { Building, Location, Department } from '../../../types/index'
import type { UserRole } from '../../../types/index'
import { useModalHotkeys } from '../../../hooks/useModalHotkeys'
import { ModalPortal } from '../shared'
import { ROLE_META, ALL_ROLES } from './roleMeta'

function DefaultBuildingSelect({ buildings, value, onChange }: {
  buildings: Building[]
  value: number | null
  onChange: (v: number | null) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const selected = value != null ? buildings.find(b => b.id === value) : null

  useEffect(() => {
    if (!open) return
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  function label(b: Building) {
    let s = b.name
    if (b.code) s += ` (${b.code})`
    if (b.location?.name) s += ` — ${b.location.name}`
    return s
  }

  return (
    <div className="space-y-1.5">
      <p className="text-[9px] font-black uppercase tracking-wider text-[var(--ds-text-3)]">Default Building</p>
      <div ref={ref} className="relative">
        <button
          type="button"
          onClick={() => setOpen(o => !o)}
          className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl border text-sm font-bold transition-all text-left"
          style={{ background: 'var(--ds-bg-surface)', border: '1px solid var(--ds-border)', color: selected ? 'var(--ds-text-1)' : 'var(--ds-text-3)' }}
        >
          <span className="truncate">{selected ? label(selected) : '— None (auto) —'}</span>
          <span className="material-symbols-outlined shrink-0 ml-2 transition-transform" style={{ fontSize: 16, color: 'var(--ds-text-3)', transform: open ? 'rotate(180deg)' : 'none' }}>expand_more</span>
        </button>

        {open && (
          <div
            className="absolute left-0 right-0 z-[200] rounded-xl overflow-hidden mt-1"
            style={{ background: 'var(--ds-bg-surface)', border: '1px solid var(--ds-border)', boxShadow: '0 8px 32px rgba(0,0,0,0.18)' }}
          >
            {/* None option */}
            <button
              type="button"
              onClick={() => { onChange(null); setOpen(false) }}
              className="w-full px-3.5 py-2.5 text-left text-[11px] font-bold transition-colors flex items-center justify-between"
              style={{ color: value == null ? '#6b8f00' : 'var(--ds-text-3)', background: value == null ? 'rgba(173,238,43,0.08)' : 'transparent' }}
              onMouseEnter={e => { if (value != null) e.currentTarget.style.background = 'var(--ds-bg-surface-2)' }}
              onMouseLeave={e => { if (value != null) e.currentTarget.style.background = 'transparent' }}
            >
              <span>— None (auto) —</span>
              {value == null && <span className="material-symbols-outlined" style={{ fontSize: 13, color: '#6b8f00' }}>check</span>}
            </button>

            {buildings.map((b, i) => {
              const active = b.id === value
              return (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => { onChange(b.id); setOpen(false) }}
                  className="w-full px-3.5 py-2.5 text-left transition-colors flex items-center justify-between gap-2"
                  style={{
                    background: active ? 'rgba(173,238,43,0.08)' : 'transparent',
                    borderTop: i === 0 ? '1px solid var(--ds-border)' : '1px solid var(--ds-border-sub)',
                  }}
                  onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'var(--ds-bg-surface-2)' }}
                  onMouseLeave={e => { if (!active) e.currentTarget.style.background = active ? 'rgba(173,238,43,0.08)' : 'transparent' }}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[12px] font-black truncate" style={{ color: active ? '#6b8f00' : 'var(--ds-text-1)' }}>{b.name}</span>
                      {b.code && (
                        <span className="text-[9px] font-black px-1.5 py-0.5 rounded-md shrink-0" style={{ background: 'var(--ds-bg-raised)', color: 'var(--ds-text-3)' }}>{b.code}</span>
                      )}
                    </div>
                    {b.location?.name && (
                      <p className="text-[10px] font-medium mt-0.5 flex items-center gap-1" style={{ color: 'var(--ds-text-3)' }}>
                        <span className="material-symbols-outlined" style={{ fontSize: 10 }}>location_on</span>
                        {b.location.name}
                      </p>
                    )}
                  </div>
                  {active && <span className="material-symbols-outlined shrink-0" style={{ fontSize: 14, color: '#6b8f00' }}>check</span>}
                </button>
              )
            })}
          </div>
        )}
      </div>
      <p className="text-[9px] text-[var(--ds-text-3)] font-medium px-1">User can override this in their own Settings.</p>
    </div>
  )
}

function BuildingPicker({ role, bldIds, buildings, locations, onToggle, defaultBuildingId, onSetDefault }: {
  role: UserRole
  bldIds: number[]
  buildings: Building[]
  locations: Location[]
  onToggle: (id: number) => void
  defaultBuildingId?: number | null
  onSetDefault?: (id: number | null) => void
}) {
  const withLocation    = buildings.filter(b => b.location_id)
  const withoutLocation = buildings.filter(b => !b.location_id)
  const locGroups = locations
    .map(loc => ({ loc, buildings: withLocation.filter(b => b.location_id === loc.id) }))
    .filter(g => g.buildings.length > 0)
  const showDefault = !!onSetDefault

  function Row({ b }: { b: Building }) {
    const checked    = bldIds.includes(b.id)
    const isDefault  = defaultBuildingId === b.id
    return (
      <div className={`flex items-center gap-2 mb-1 rounded-xl border transition-all
        ${checked ? 'bg-blue-500/10 border-blue-500/30' : 'bg-[var(--ds-bg-surface)] border-[var(--ds-border)]'}`}>
        <button onClick={() => onToggle(b.id)}
          className="flex items-center gap-3 px-3 py-2 flex-1 min-w-0 text-left">
          <span className={`size-4 rounded-md border-2 flex items-center justify-center shrink-0 transition-all ${checked ? 'bg-blue-500 border-blue-500' : 'border-[var(--ds-border)]'}`}>
            {checked && <span className="material-symbols-outlined text-white" style={{ fontSize: 11 }}>check</span>}
          </span>
          <div className="min-w-0">
            <p className={`text-[11px] font-black truncate ${checked ? 'text-blue-400' : 'text-[var(--ds-text-2)]'}`}>{b.name}</p>
            {b.address && <p className="text-[9px] text-[var(--ds-text-3)] truncate">{b.address}</p>}
          </div>
        </button>
        {showDefault && checked && (
          <button onClick={() => onSetDefault!(isDefault ? null : b.id)}
            className="shrink-0 mr-2 flex items-center gap-1 px-2 py-1 rounded-lg text-[8px] font-black uppercase tracking-wide transition-all"
            style={isDefault
              ? { background: 'rgba(173,238,43,0.18)', color: '#4d7c00', border: '1px solid rgba(100,160,0,0.35)' }
              : { background: 'var(--ds-bg-raised)', color: 'var(--ds-text-3)', border: '1px solid var(--ds-border)' }}>
            <span className="material-symbols-outlined" style={{ fontSize: 10 }}>{isDefault ? 'home' : 'home'}</span>
            {isDefault ? 'Default' : 'Set Default'}
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <p className="text-[9px] font-black uppercase tracking-wider text-[var(--ds-text-3)]">
        {role === 'building_admin' ? 'Assigned Buildings' : 'Assigned Location / Buildings'}
      </p>
      <div className="flex flex-col gap-0 max-h-52 overflow-y-auto pr-1" style={{ scrollbarWidth: 'thin' }}>
        {locGroups.map(({ loc, buildings: grp }) => (
          <div key={loc.id}>
            <p className="text-[8px] font-black uppercase tracking-widest text-[var(--ds-text-3)] px-1 pt-2 pb-1 flex items-center gap-1">
              <span className="material-symbols-outlined" style={{ fontSize: 10 }}>location_city</span>
              {loc.name}{loc.code ? ` · ${loc.code}` : ''}
            </p>
            {grp.map(b => <Row key={b.id} b={b} />)}
          </div>
        ))}
        {withoutLocation.length > 0 && (
          <div>
            {locGroups.length > 0 && (
              <p className="text-[8px] font-black uppercase tracking-widest text-[var(--ds-text-3)] px-1 pt-2 pb-1">Other</p>
            )}
            {withoutLocation.map(b => <Row key={b.id} b={b} />)}
          </div>
        )}
      </div>
      {bldIds.length === 0 && role === 'building_admin' && (
        <p className="text-[9px] text-orange-500 font-bold">⚠ Select at least 1 building for this building admin</p>
      )}
    </div>
  )
}

function AddUserModal({ buildings, locations, departments, onSave, onClose }: {
  buildings: Building[]
  locations: Location[]
  departments: Department[]
  onSave: (data: { name: string; email: string; alias: string; nik: string | null; password: string; department_id: number | null; role: UserRole; ext: string; building_ids: number[]; default_building_id: number | null }) => Promise<void>
  onClose: () => void
}) {
  const [name, setName]         = useState('')
  const [email, setEmail]       = useState('')
  const [alias, setAlias]       = useState('')
  const [nik, setNik]           = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm]   = useState('')
  const [showPw, setShowPw]     = useState(false)
  const [showCf, setShowCf]     = useState(false)
  const [deptId, setDeptId]     = useState<number | null>(null)
  const [ext, setExt]           = useState('')
  const [role, setRole]         = useState<UserRole>('user')
  const [bldIds, setBldIds]     = useState<number[]>([])
  const [defaultBldId, setDefaultBldId] = useState<number | null>(null)
  const [saving, setSaving]     = useState(false)
  const [err, setErr]           = useState('')
  const scrollBodyRef = useRef<HTMLDivElement>(null)

  const pwTooShort  = password.length > 0 && password.length < 8
  const pwMismatch  = confirm.length > 0 && confirm !== password

  function selectRole(r: UserRole) {
    setRole(r)
    if (r !== 'admin') {
      setTimeout(() => scrollBodyRef.current?.scrollTo({ top: scrollBodyRef.current.scrollHeight, behavior: 'smooth' }), 50)
    }
  }

  function toggleBuilding(id: number) {
    setBldIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  async function handleSave() {
    if (!name.trim() || !email.trim() || !password) { setErr('Name, email, and password are required'); return }
    if (password.length < 8) { setErr('Password must be at least 8 characters'); return }
    if (password !== confirm) { setErr('Passwords do not match'); return }
    if (role === 'building_admin' && bldIds.length === 0) { setErr('Assign at least one building for Building Admin'); return }
    setSaving(true); setErr('')
    try {
      await onSave({ name: name.trim(), email: email.trim(), alias: alias.trim(), nik: role !== 'admin' && nik.trim() ? nik.trim() : null, password, department_id: deptId, role, ext: ext.trim(), building_ids: bldIds, default_building_id: defaultBldId })
      onClose()
    } catch (e: unknown) {
      const errs = (e as { response?: { data?: { errors?: { name?: string[]; email?: string[]; alias?: string[]; nik?: string[] } } } })?.response?.data?.errors
      const msg = errs?.name?.[0] ?? errs?.email?.[0] ?? errs?.alias?.[0] ?? errs?.nik?.[0]
      setErr(msg ?? 'Failed to create user.')
    } finally { setSaving(false) }
  }

  useModalHotkeys(true, handleSave, onClose)

  const inputBase = 'w-full bg-[var(--ds-bg-raised)] border rounded-xl pl-10 pr-4 py-2.5 text-sm font-bold focus:outline-none focus:ring-2 focus:border-transparent transition-all text-[var(--ds-text-1)]'

  return (
    <ModalPortal>
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(12px)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-[560px] flex flex-col rounded-[2rem] shadow-2xl overflow-hidden"
        style={{
          height: 640,
          background: 'var(--ds-bg-surface)',
          backdropFilter: 'blur(48px) saturate(200%)',
          border: '1px solid rgba(128,128,128,0.15)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div className="flex items-center justify-between px-7 pt-7 pb-5 border-b border-[var(--ds-border)] shrink-0">
          <div>
            <p className="text-[9px] font-black uppercase tracking-[0.25em] text-[var(--ds-text-3)]">Admin · Users</p>
            <h2 className="text-2xl font-black italic tracking-tighter uppercase mt-0.5 text-[var(--ds-text-1)]">Add User</h2>
          </div>
          <button onClick={onClose}
            className="size-9 rounded-xl bg-[var(--ds-bg-surface-2)] hover:bg-[var(--ds-bg-raised)] flex items-center justify-center transition-colors">
            <span className="material-symbols-outlined text-[var(--ds-text-2)]" style={{ fontSize: 18 }}>close</span>
          </button>
        </div>

        {/* ── Scrollable body ── */}
        <div ref={scrollBodyRef} className="flex-1 overflow-y-auto px-7 py-5 space-y-5" style={{ scrollbarWidth: 'thin' }}>

          {/* Error banner */}
          {err && (
            <div className="flex items-center gap-2 text-[11px] font-bold px-4 py-3 rounded-xl" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171' }}>
              <span className="material-symbols-outlined" style={{ fontSize: 15 }}>error</span>
              {err}
            </div>
          )}

          {/* ── Section: Basic Info ── */}
          <div className="space-y-3">
            <p className="text-[9px] font-black uppercase tracking-[0.2em] text-[var(--ds-text-3)]">Basic Info</p>

            {/* Name */}
            <div className="space-y-1.5">
              <label className="text-[9px] font-black uppercase text-[var(--ds-text-3)] tracking-wider px-1">Full Name *</label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--ds-text-3)]" style={{ fontSize: 16 }}>person</span>
                <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Budi Santoso"
                  className={`${inputBase} focus:ring-[#adee2b] border-[var(--ds-border)]`} />
              </div>
            </div>

            {/* Email */}
            <div className="space-y-1.5">
              <label className="text-[9px] font-black uppercase text-[var(--ds-text-3)] tracking-wider px-1">Email *</label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--ds-text-3)]" style={{ fontSize: 16 }}>mail</span>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="e.g. budi@company.com"
                  className={`${inputBase} focus:ring-[#adee2b] border-[var(--ds-border)]`} />
              </div>
            </div>

            {/* Alias / Username */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between px-1">
                <label className="text-[9px] font-black uppercase text-[var(--ds-text-3)] tracking-wider">Username / Alias</label>
                <span className="text-[9px] text-[var(--ds-text-3)]">Optional — defaults to email prefix</span>
              </div>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--ds-text-3)]" style={{ fontSize: 16 }}>alternate_email</span>
                <input value={alias} onChange={e => setAlias(e.target.value.toLowerCase())} placeholder="e.g. budi.santoso"
                  className={`${inputBase} focus:ring-[#adee2b] border-[var(--ds-border)]`} />
              </div>
            </div>

            {/* NIK — not applicable for Super Admin */}
            {role !== 'admin' && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between px-1">
                  <label className="text-[9px] font-black uppercase text-[var(--ds-text-3)] tracking-wider">NIK</label>
                  <span className="text-[9px] text-[var(--ds-text-3)]">Optional</span>
                </div>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--ds-text-3)]" style={{ fontSize: 16 }}>badge</span>
                  <input value={nik} onChange={e => setNik(e.target.value)} placeholder="e.g. 3201xxxxxxxxxxxx"
                    className={`${inputBase} focus:ring-[#adee2b] border-[var(--ds-border)]`} />
                </div>
              </div>
            )}

            {/* Dept + Ext */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-[9px] font-black uppercase text-[var(--ds-text-3)] tracking-wider px-1">Department</label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--ds-text-3)] pointer-events-none" style={{ fontSize: 16 }}>corporate_fare</span>
                  <select value={deptId ?? ''} onChange={e => setDeptId(e.target.value ? Number(e.target.value) : null)}
                    className={`${inputBase} focus:ring-[#adee2b] border-[var(--ds-border)] appearance-none cursor-pointer`}>
                    <option value="">— No department —</option>
                    {departments.map(d => <option key={d.id} value={d.id}>{d.name}{d.code ? ` (${d.code})` : ''}</option>)}
                  </select>
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-[9px] font-black uppercase text-[var(--ds-text-3)] tracking-wider px-1">Ext (phone)</label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--ds-text-3)]" style={{ fontSize: 16 }}>phone</span>
                  <input value={ext} onChange={e => setExt(e.target.value)} placeholder="e.g. 1234"
                    className={`${inputBase} focus:ring-[#adee2b] border-[var(--ds-border)]`} />
                </div>
              </div>
            </div>
          </div>

          {/* ── Section: Password ── */}
          <div className="space-y-3">
            <p className="text-[9px] font-black uppercase tracking-[0.2em] text-[var(--ds-text-3)]">Password</p>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between px-1">
                <label className="text-[9px] font-black uppercase text-[var(--ds-text-3)] tracking-wider">Password *</label>
                <span className="text-[9px] text-[var(--ds-text-3)]">Min. 8 characters</span>
              </div>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--ds-text-3)]" style={{ fontSize: 16 }}>lock</span>
                <input type={showPw ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••"
                  className={`${inputBase} pr-10 ${pwTooShort ? 'border-orange-300 focus:ring-orange-400' : 'border-[var(--ds-border)] focus:ring-[#adee2b]'}`} />
                <button type="button" onClick={() => setShowPw(v => !v)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[var(--ds-text-3)] hover:text-[var(--ds-text-1)] transition-colors">
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>{showPw ? 'visibility_off' : 'visibility'}</span>
                </button>
              </div>
              {pwTooShort && (
                <p className="flex items-center gap-1.5 text-[10px] text-orange-500 font-bold px-1">
                  <span className="material-symbols-outlined" style={{ fontSize: 12 }}>warning</span>
                  Password too short ({password.length}/8 characters)
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="text-[9px] font-black uppercase text-[var(--ds-text-3)] tracking-wider px-1">Confirm Password *</label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--ds-text-3)]" style={{ fontSize: 16 }}>lock_reset</span>
                <input type={showCf ? 'text' : 'password'} value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="Re-enter password"
                  className={`${inputBase} pr-10 ${pwMismatch ? 'border-red-300 focus:ring-red-400' : confirm && confirm === password ? 'border-green-300 focus:ring-green-400' : 'border-[var(--ds-border)] focus:ring-[#adee2b]'}`} />
                <button type="button" onClick={() => setShowCf(v => !v)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[var(--ds-text-3)] hover:text-[var(--ds-text-1)] transition-colors">
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>{showCf ? 'visibility_off' : 'visibility'}</span>
                </button>
              </div>
              {pwMismatch && (
                <p className="flex items-center gap-1.5 text-[10px] text-red-500 font-bold px-1">
                  <span className="material-symbols-outlined" style={{ fontSize: 12 }}>error</span>
                  Passwords do not match
                </p>
              )}
              {!pwMismatch && confirm && confirm === password && (
                <p className="flex items-center gap-1.5 text-[10px] text-green-600 font-bold px-1">
                  <span className="material-symbols-outlined" style={{ fontSize: 12 }}>check_circle</span>
                  Passwords match
                </p>
              )}
            </div>
          </div>

          {/* ── Section: Role ── */}
          <div className="space-y-3">
            <p className="text-[9px] font-black uppercase tracking-[0.2em] text-[var(--ds-text-3)]">Role</p>
            <div className="grid grid-cols-2 gap-2">
              {ALL_ROLES.map(r => {
                const m = ROLE_META[r]
                return (
                  <div key={r} className="relative group/role">
                    <button onClick={() => selectRole(r)}
                      className={`w-full flex items-center gap-2.5 px-3.5 py-3 rounded-xl border text-[10px] font-black uppercase tracking-wide transition-all
                        ${role === r ? `${m.bg} ${m.text} border-transparent shadow-sm` : 'bg-[var(--ds-bg-surface)] border-[var(--ds-border)] text-[var(--ds-text-3)] hover:border-[var(--ds-text-3)] hover:bg-[var(--ds-bg-raised)]'}`}>
                      <span className={`size-2 rounded-full shrink-0 ${role === r ? 'bg-current' : 'bg-slate-200'}`} />
                      <span className="flex-1 text-left">{m.label}</span>
                      <span className="size-3.5 rounded-full flex items-center justify-center text-[8px] font-black shrink-0 opacity-50 group-hover/role:opacity-100 transition-opacity"
                        style={{ background: 'rgba(128,128,128,0.15)', color: 'inherit' }}>i</span>
                    </button>
                    {/* Per-role tooltip */}
                    <div className={`absolute bottom-[calc(100%+10px)] z-[300] w-[280px] pointer-events-none opacity-0 translate-y-1 group-hover/role:opacity-100 group-hover/role:translate-y-0 transition-all duration-200 ${ALL_ROLES.indexOf(r) % 2 === 0 ? 'left-0' : 'right-0'}`}>
                      <div className="rounded-2xl p-4 shadow-2xl space-y-3"
                        style={{ background: 'rgba(15,20,45,0.97)', border: '1px solid rgba(255,255,255,0.1)', backdropFilter: 'blur(20px)' }}>
                        <div>
                          <p className="text-[13px] font-black" style={{ color: '#fff' }}>{m.label}</p>
                          <p className="text-[11px] leading-relaxed mt-0.5" style={{ color: 'rgba(255,255,255,0.5)' }}>{m.desc}</p>
                        </div>
                        <div className="space-y-1.5" style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 10 }}>
                          {m.perms.map((p, i) => (
                            <div key={i} className="flex items-start gap-2">
                              <span className="material-symbols-outlined mt-0.5 shrink-0" style={{ fontSize: 12, color: 'rgba(173,238,43,0.8)' }}>check</span>
                              <span className="text-[11px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.55)' }}>{p}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* ── Section: Building ── */}
          {role === 'user' && (
            <DefaultBuildingSelect buildings={buildings} value={defaultBldId} onChange={setDefaultBldId} />
          )}
          {(role === 'building_admin' || role === 'receptionist') && (
            <div className="space-y-3">
              <p className="text-[9px] font-black uppercase tracking-[0.2em] text-[var(--ds-text-3)]">Buildings</p>
              <BuildingPicker role={role} bldIds={bldIds} buildings={buildings} locations={locations} onToggle={toggleBuilding}
                defaultBuildingId={defaultBldId} onSetDefault={setDefaultBldId} />
            </div>
          )}

        </div>

        {/* ── Footer ── */}
        <div className="px-7 py-5 border-t border-[var(--ds-border)] shrink-0 flex gap-3">
          <button onClick={onClose}
            className="flex-1 py-3.5 rounded-full text-[10px] font-black uppercase tracking-[0.15em] bg-[var(--ds-bg-surface-2)] text-[var(--ds-text-2)] hover:bg-[var(--ds-bg-raised)] transition-colors">
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving || pwTooShort || pwMismatch}
            className="flex-1 py-3.5 rounded-full text-[10px] font-black uppercase tracking-[0.15em] transition-all duration-200
              bg-black text-[#adee2b] hover:bg-slate-800 shadow-lg shadow-black/10
              disabled:bg-[var(--ds-bg-surface-2)] disabled:text-[var(--ds-text-3)] disabled:cursor-not-allowed disabled:shadow-none
              flex items-center justify-center gap-2">
            {saving && <span className="material-symbols-outlined animate-spin" style={{ fontSize: 13 }}>progress_activity</span>}
            {saving ? 'Saving...' : 'Create User →'}
          </button>
        </div>
      </div>
    </div>
    </ModalPortal>
  )
}

export { DefaultBuildingSelect, BuildingPicker, AddUserModal as default }
