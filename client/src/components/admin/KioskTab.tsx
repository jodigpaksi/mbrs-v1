import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createPortal } from 'react-dom'
import { getKioskConfigs, createKioskConfig, updateKioskConfig, deleteKioskConfig } from '../../api/kiosk'
import { getRooms } from '../../api/rooms'
import type { KioskConfig, KioskTheme, KioskLayout, KioskResolution } from '../../types'

// ── Presets ───────────────────────────────────────────────────────────────────

const THEME_PRESETS: { label: string; value: KioskTheme }[] = [
  { label: 'Dark Lime (Default)',  value: { mode: 'dark',  accent: '#adee2b', bg: '#0a0e1a', surface: '#141826', text: '#ffffff' } },
  { label: 'Dark Blue',           value: { mode: 'dark',  accent: '#60a5fa', bg: '#0c111d', surface: '#141d2e', text: '#ffffff' } },
  { label: 'Dark Coral',          value: { mode: 'dark',  accent: '#fb923c', bg: '#1a0c0a', surface: '#2d1a14', text: '#ffffff' } },
  { label: 'Carbon Cyan',         value: { mode: 'dark',  accent: '#22d3ee', bg: '#111111', surface: '#1e1e1e', text: '#ffffff' } },
  { label: 'Light Clean',         value: { mode: 'light', accent: '#1d4ed8', bg: '#f1f5f9', surface: '#ffffff', text: '#1a2030' } },
]

const RESOLUTION_PRESETS: { label: string; value: KioskResolution }[] = [
  { label: 'iPad (1024 × 768)',          value: { preset: 'ipad',         width: 1024, height: 768  } },
  { label: 'iPad Pro 11" (1194 × 834)',  value: { preset: 'ipad-pro-11',  width: 1194, height: 834  } },
  { label: 'iPad Pro 13" (1366 × 1024)', value: { preset: 'ipad-pro-13',  width: 1366, height: 1024 } },
  { label: 'Surface Pro (1920 × 1280)', value: { preset: 'surface',       width: 1920, height: 1280 } },
  { label: 'Full HD (1920 × 1080)',     value: { preset: 'fullhd',        width: 1920, height: 1080 } },
  { label: 'Custom',                    value: { preset: 'custom',        width: 1024, height: 768  } },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center gap-2">
      <div className="relative size-8 rounded-lg overflow-hidden shrink-0 border border-[var(--ds-border)] cursor-pointer">
        <input type="color" value={value} onChange={e => onChange(e.target.value)}
          className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" />
        <div className="absolute inset-0 rounded-lg" style={{ background: value }} />
      </div>
      <div className="flex-1">
        <p className="text-[9px] font-black uppercase tracking-wider text-[var(--ds-text-3)]">{label}</p>
        <p className="text-[11px] font-mono text-[var(--ds-text-2)]">{value}</p>
      </div>
    </div>
  )
}

// ── Edit/Create modal ─────────────────────────────────────────────────────────

interface EditModalProps {
  initial?: KioskConfig
  rooms: { id: number; name: string; floor: string }[]
  onSave: (data: Partial<KioskConfig>) => Promise<void>
  onClose: () => void
}

const DEFAULT_THEME: KioskTheme       = THEME_PRESETS[0].value
const DEFAULT_LAYOUT: KioskLayout     = { show_clock: true, show_bookings: true, show_book_btn: true, show_confirm_btn: false, orientation: 'landscape', book_btn_url: '' }
const DEFAULT_RES: KioskResolution    = RESOLUTION_PRESETS[0].value

function EditModal({ initial, rooms, onSave, onClose }: EditModalProps) {
  const [name,     setName]     = useState(initial?.name ?? '')
  const [roomId,   setRoomId]   = useState<number | ''>(initial?.room_id ?? '')
  const [pin,      setPin]      = useState(initial?.pin ?? '')
  const [active,   setActive]   = useState(initial?.active ?? true)
  const [theme,    setTheme]    = useState<KioskTheme>(initial?.theme    ?? DEFAULT_THEME)
  const [layout,   setLayout]   = useState<KioskLayout>(initial?.layout  ?? DEFAULT_LAYOUT)
  const [res,      setRes]      = useState<KioskResolution>(initial?.resolution ?? DEFAULT_RES)
  const [saving,   setSaving]   = useState(false)
  const [err,      setErr]      = useState('')

  function applyThemePreset(p: KioskTheme) { setTheme(p) }

  function applyResPreset(p: KioskResolution) {
    if (p.preset !== 'custom') setRes(p)
    else setRes(r => ({ ...r, preset: 'custom' }))
  }

  async function handleSave() {
    if (!name.trim()) { setErr('Name is required'); return }
    setSaving(true); setErr('')
    try {
      await onSave({
        name: name.trim(),
        room_id: roomId === '' ? null : roomId,
        pin: pin || null as any,
        theme, layout, resolution: res, active,
      })
      onClose()
    } catch (e: any) {
      setErr(e?.response?.data?.message ?? 'Failed to save')
    } finally { setSaving(false) }
  }

  const inputCls = 'w-full px-3 py-2 rounded-xl text-[12px] font-bold bg-[var(--ds-bg-raised)] border border-[var(--ds-border)] text-[var(--ds-text-1)] focus:outline-none focus:border-[#adee2b]/60 placeholder:text-[var(--ds-text-4)]'
  const labelCls = 'text-[9px] font-black uppercase tracking-wider text-[var(--ds-text-3)] mb-1.5 block'
  const sectionHd = 'text-[9px] font-black uppercase tracking-[0.25em] text-[#adee2b] mb-4'

  return createPortal(
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-6"
      style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)' }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-2xl max-h-[90vh] flex flex-col rounded-3xl overflow-hidden shadow-2xl"
        style={{ background: 'var(--ds-bg-surface)', border: '1px solid var(--ds-border)' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 shrink-0" style={{ borderBottom: '1px solid var(--ds-border)' }}>
          <div>
            <p className="text-[8px] font-black uppercase tracking-[0.3em] text-[var(--ds-text-3)]">Kiosk Config</p>
            <p className="font-black text-[17px] text-[var(--ds-text-1)]">{initial ? 'Edit Kiosk' : 'New Kiosk'}</p>
          </div>
          <button onClick={onClose} className="size-8 flex items-center justify-center rounded-full text-[var(--ds-text-3)] hover:text-[var(--ds-text-1)] transition-colors bg-[var(--ds-bg-raised)]">
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>close</span>
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 p-6 space-y-6" style={{ scrollbarWidth: 'thin' }}>

          {/* Basic */}
          <section>
            <p className={sectionHd}>Basics</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Kiosk Name *</label>
                <input className={inputCls} value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Lobby Kiosk" />
              </div>
              <div>
                <label className={labelCls}>Room</label>
                <select className={inputCls} value={roomId} onChange={e => setRoomId(e.target.value === '' ? '' : Number(e.target.value))}>
                  <option value="">— No room —</option>
                  {rooms.map(r => <option key={r.id} value={r.id}>{r.name}{r.floor ? ` · Floor ${r.floor}` : ''}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>PIN (optional)</label>
                <input className={inputCls} type="text" maxLength={20} value={pin} onChange={e => setPin(e.target.value)} placeholder="Leave blank for no PIN" />
              </div>
              <div className="flex items-center gap-3 pt-4">
                <button onClick={() => setActive(a => !a)}
                  className="relative rounded-full transition-colors shrink-0"
                  style={{ width: 44, height: 24, background: active ? '#adee2b' : 'var(--ds-bg-raised)', border: '1px solid var(--ds-border)' }}>
                  <span className="absolute top-0.5 rounded-full transition-all" style={{ width: 20, height: 20, background: active ? '#1a3a00' : 'var(--ds-text-3)', left: active ? 22 : 2 }} />
                </button>
                <div>
                  <p className="text-[11px] font-black text-[var(--ds-text-1)]">{active ? 'Active' : 'Inactive'}</p>
                  <p className="text-[9px] text-[var(--ds-text-3)]">{active ? 'Kiosk is publicly accessible' : 'Kiosk returns 404'}</p>
                </div>
              </div>
            </div>
          </section>

          {/* Theme */}
          <section>
            <p className={sectionHd}>Theme</p>
            <div className="flex flex-wrap gap-2 mb-4">
              {THEME_PRESETS.map(p => {
                const active = JSON.stringify(theme) === JSON.stringify(p.value)
                return (
                  <button key={p.label} onClick={() => applyThemePreset(p.value)}
                    className="px-3 py-1.5 rounded-xl text-[10px] font-black transition-all"
                    style={{
                      background: active ? '#adee2b' : 'var(--ds-bg-raised)',
                      color: active ? '#1a3a00' : 'var(--ds-text-2)',
                      border: '1px solid var(--ds-border)',
                    }}>
                    {p.label}
                  </button>
                )
              })}
            </div>
            <div className="grid grid-cols-3 gap-3">
              <ColorField label="Background"  value={theme.bg}      onChange={v => setTheme(t => ({ ...t, bg: v }))} />
              <ColorField label="Surface"     value={theme.surface} onChange={v => setTheme(t => ({ ...t, surface: v }))} />
              <ColorField label="Accent"      value={theme.accent}  onChange={v => setTheme(t => ({ ...t, accent: v }))} />
              <ColorField label="Text"        value={theme.text}    onChange={v => setTheme(t => ({ ...t, text: v }))} />
              <div className="col-span-2 flex items-center gap-3">
                <p className={labelCls}>Mode</p>
                <div className="flex gap-2">
                  {(['dark','light'] as const).map(m => (
                    <button key={m} onClick={() => setTheme(t => ({ ...t, mode: m }))}
                      className="px-3 py-1.5 rounded-xl text-[10px] font-black transition-all capitalize"
                      style={{
                        background: theme.mode === m ? '#adee2b' : 'var(--ds-bg-raised)',
                        color: theme.mode === m ? '#1a3a00' : 'var(--ds-text-2)',
                        border: '1px solid var(--ds-border)',
                      }}>
                      {m}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* Resolution */}
          <section>
            <p className={sectionHd}>Resolution</p>
            <div className="flex flex-wrap gap-2 mb-4">
              {RESOLUTION_PRESETS.map(p => (
                <button key={p.label} onClick={() => applyResPreset(p.value)}
                  className="px-3 py-1.5 rounded-xl text-[10px] font-black transition-all"
                  style={{
                    background: res.preset === p.value.preset ? '#adee2b' : 'var(--ds-bg-raised)',
                    color: res.preset === p.value.preset ? '#1a3a00' : 'var(--ds-text-2)',
                    border: '1px solid var(--ds-border)',
                  }}>
                  {p.label}
                </button>
              ))}
            </div>
            {res.preset === 'custom' && (
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className={labelCls}>Width (px)</label>
                  <input className={inputCls} type="number" min={320} max={3840} value={res.width} onChange={e => setRes(r => ({ ...r, width: Number(e.target.value) }))} />
                </div>
                <div className="flex-1">
                  <label className={labelCls}>Height (px)</label>
                  <input className={inputCls} type="number" min={240} max={2160} value={res.height} onChange={e => setRes(r => ({ ...r, height: Number(e.target.value) }))} />
                </div>
              </div>
            )}
            {res.preset !== 'custom' && (
              <p className="text-[11px] text-[var(--ds-text-3)] font-bold">{res.width} × {res.height} px</p>
            )}
          </section>

          {/* Layout */}
          <section>
            <p className={sectionHd}>Layout</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Orientation</label>
                <div className="flex gap-2">
                  {(['landscape','portrait'] as const).map(o => (
                    <button key={o} onClick={() => setLayout(l => ({ ...l, orientation: o }))}
                      className="flex-1 px-3 py-2 rounded-xl text-[10px] font-black transition-all capitalize"
                      style={{
                        background: layout.orientation === o ? '#adee2b' : 'var(--ds-bg-raised)',
                        color: layout.orientation === o ? '#1a3a00' : 'var(--ds-text-2)',
                        border: '1px solid var(--ds-border)',
                      }}>
                      {o}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className={labelCls}>Book Button URL</label>
                <input className={inputCls} value={layout.book_btn_url} onChange={e => setLayout(l => ({ ...l, book_btn_url: e.target.value }))} placeholder="https://…" />
              </div>
              {([
                ['show_clock',       'Show Clock'],
                ['show_bookings',    'Show Bookings List'],
                ['show_book_btn',    'Show Book Button'],
                ['show_confirm_btn', 'Show Confirm Presence Button'],
              ] as [keyof KioskLayout, string][]).map(([k, lbl]) => (
                <div key={k} className="flex items-center gap-3">
                  <button onClick={() => setLayout(l => ({ ...l, [k]: !l[k] }))}
                    className="relative rounded-full transition-colors shrink-0"
                    style={{ width: 36, height: 20, background: layout[k] ? '#adee2b' : 'var(--ds-bg-raised)', border: '1px solid var(--ds-border)' }}>
                    <span className="absolute top-0.5 rounded-full transition-all" style={{ width: 16, height: 16, background: layout[k] ? '#1a3a00' : 'var(--ds-text-3)', left: layout[k] ? 18 : 2 }} />
                  </button>
                  <p className="text-[11px] font-black text-[var(--ds-text-2)]">{lbl}</p>
                </div>
              ))}
            </div>
          </section>

        </div>

        {/* Footer */}
        <div className="px-6 py-4 shrink-0 flex items-center justify-between gap-3" style={{ borderTop: '1px solid var(--ds-border)' }}>
          {err && <p className="text-red-400 text-[11px] font-bold">{err}</p>}
          {!err && <div />}
          <div className="flex gap-3">
            <button onClick={onClose} className="px-5 py-2 rounded-2xl text-[11px] font-black text-[var(--ds-text-2)] hover:text-[var(--ds-text-1)] transition-colors bg-[var(--ds-bg-raised)]">
              Cancel
            </button>
            <button onClick={handleSave} disabled={saving}
              className="px-6 py-2 rounded-2xl text-[11px] font-black transition-all disabled:opacity-50"
              style={{ background: '#adee2b', color: '#1a3a00' }}>
              {saving ? 'Saving…' : initial ? 'Save Changes' : 'Create Kiosk'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}

// ── Main KioskTab ─────────────────────────────────────────────────────────────

export default function KioskTab() {
  const qc = useQueryClient()
  const [editTarget, setEditTarget] = useState<KioskConfig | null | 'new'>(null)
  const [deleteTarget, setDeleteTarget] = useState<KioskConfig | null>(null)
  const [copied, setCopied] = useState<number | null>(null)

  const { data: configs = [], isLoading } = useQuery({ queryKey: ['kiosk-configs'], queryFn: getKioskConfigs })
  const { data: rooms   = [] }            = useQuery({ queryKey: ['rooms'],          queryFn: getRooms })

  const createMut = useMutation({
    mutationFn: (d: Partial<KioskConfig>) => createKioskConfig(d),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['kiosk-configs'] }),
  })
  const updateMut = useMutation({
    mutationFn: ({ id, d }: { id: number; d: Partial<KioskConfig> }) => updateKioskConfig(id, d),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['kiosk-configs'] }),
  })
  const deleteMut = useMutation({
    mutationFn: (id: number) => deleteKioskConfig(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['kiosk-configs'] }); setDeleteTarget(null) },
  })

  function kioskUrl(id: number) {
    return `${window.location.origin}/kiosk/${id}`
  }

  function copyUrl(id: number) {
    navigator.clipboard.writeText(kioskUrl(id))
    setCopied(id)
    setTimeout(() => setCopied(null), 1500)
  }

  const flatRooms = rooms.map((r: any) => ({ id: r.id, name: r.name, floor: r.floor ?? '' }))

  return (
    <div className="max-w-4xl space-y-6">
      <style>{`
        @keyframes kiosk-row-in { from { opacity:0; transform:translateY(6px) } to { opacity:1; transform:translateY(0) } }
      `}</style>

      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <p className="text-[9px] font-black uppercase tracking-[0.25em] text-[var(--ds-text-3)] mb-1">Admin Panel</p>
          <h1 className="text-3xl font-black italic tracking-tighter uppercase">Kiosk Displays</h1>
          <p className="text-[12px] text-[var(--ds-text-3)] mt-1">Tablet kiosks for room status displays — server-configurable theme &amp; resolution.</p>
        </div>
        <button onClick={() => setEditTarget('new')}
          className="flex items-center gap-2 px-5 py-2.5 rounded-2xl text-[11px] font-black transition-all hover:brightness-110 active:scale-95"
          style={{ background: '#adee2b', color: '#1a3a00' }}>
          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>add</span>
          New Kiosk
        </button>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <span className="material-symbols-outlined animate-spin text-[var(--ds-text-4)]" style={{ fontSize: 28 }}>progress_activity</span>
        </div>
      ) : configs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3 rounded-3xl border border-dashed border-[var(--ds-border)]">
          <span className="material-symbols-outlined text-[var(--ds-text-4)]" style={{ fontSize: 40 }}>tablet</span>
          <p className="text-[12px] font-black text-[var(--ds-text-3)]">No kiosk configs yet</p>
          <button onClick={() => setEditTarget('new')} className="text-[11px] font-black text-[#adee2b] hover:underline">Create your first kiosk →</button>
        </div>
      ) : (
        <div className="space-y-3">
          {configs.map((k, i) => (
            <div key={k.id}
              className="flex items-center gap-4 rounded-2xl p-4 border border-[var(--ds-border)] bg-[var(--ds-bg-surface)]"
              style={{ animation: `kiosk-row-in 0.18s ease-out ${i * 0.04}s both` }}>

              {/* Status dot */}
              <div className="size-2 rounded-full shrink-0" style={{ background: k.active ? '#22c55e' : '#ef4444', boxShadow: k.active ? '0 0 6px #22c55e88' : 'none' }} />

              {/* Identity */}
              <div className="flex-1 min-w-0">
                <p className="font-black text-[14px] text-[var(--ds-text-1)] truncate">{k.name}</p>
                <p className="text-[11px] text-[var(--ds-text-3)] font-bold">
                  {k.room ? `${k.room.name}${k.room.floor ? ` · Floor ${k.room.floor}` : ''}` : 'No room assigned'}
                  {' · '}
                  {k.resolution.width}×{k.resolution.height}
                  {' · '}
                  <span className="capitalize">{k.layout?.orientation ?? 'landscape'}</span>
                  {k.has_pin ? ' · PIN locked' : ''}
                </p>
              </div>

              {/* Theme preview chips */}
              <div className="flex gap-1.5 shrink-0">
                {[k.theme.bg, k.theme.surface, k.theme.accent].map((c, ci) => (
                  <div key={ci} className="size-4 rounded-full border border-black/10" style={{ background: c }} />
                ))}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1 shrink-0">
                <a href={kioskUrl(k.id)} target="_blank" rel="noopener noreferrer"
                  className="size-8 flex items-center justify-center rounded-xl text-[var(--ds-text-3)] hover:text-[var(--ds-text-1)] transition-colors"
                  title="Open kiosk">
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>open_in_new</span>
                </a>
                <button onClick={() => copyUrl(k.id)}
                  className="size-8 flex items-center justify-center rounded-xl transition-colors"
                  style={{ color: copied === k.id ? '#adee2b' : 'var(--ds-text-3)' }}
                  title="Copy URL">
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>{copied === k.id ? 'check' : 'link'}</span>
                </button>
                <button onClick={() => setEditTarget(k)}
                  className="size-8 flex items-center justify-center rounded-xl text-[var(--ds-text-3)] hover:text-[var(--ds-text-1)] transition-colors"
                  title="Edit">
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>edit</span>
                </button>
                <button onClick={() => setDeleteTarget(k)}
                  className="size-8 flex items-center justify-center rounded-xl text-[var(--ds-text-3)] hover:text-red-400 transition-colors"
                  title="Delete">
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>delete</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create / Edit modal */}
      {editTarget !== null && (
        <EditModal
          initial={editTarget === 'new' ? undefined : editTarget}
          rooms={flatRooms}
          onSave={async d => {
            if (editTarget === 'new') await createMut.mutateAsync(d)
            else await updateMut.mutateAsync({ id: (editTarget as KioskConfig).id, d })
          }}
          onClose={() => setEditTarget(null)}
        />
      )}

      {/* Delete confirmation */}
      {deleteTarget && createPortal(
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-6"
          style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}>
          <div className="w-80 rounded-3xl p-6 text-center space-y-4 shadow-2xl"
            style={{ background: 'var(--ds-bg-surface)', border: '1px solid var(--ds-border)' }}>
            <span className="material-symbols-outlined text-red-400" style={{ fontSize: 36 }}>delete_forever</span>
            <div>
              <p className="font-black text-[15px] text-[var(--ds-text-1)]">Delete "{deleteTarget.name}"?</p>
              <p className="text-[11px] text-[var(--ds-text-3)] mt-1">This cannot be undone. The kiosk URL will stop working.</p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setDeleteTarget(null)}
                className="flex-1 py-2.5 rounded-2xl text-[11px] font-black text-[var(--ds-text-2)] hover:text-[var(--ds-text-1)] transition-colors bg-[var(--ds-bg-raised)]">
                Cancel
              </button>
              <button onClick={() => deleteMut.mutate(deleteTarget.id)} disabled={deleteMut.isPending}
                className="flex-1 py-2.5 rounded-2xl text-[11px] font-black text-white transition-all disabled:opacity-50"
                style={{ background: '#ef4444' }}>
                {deleteMut.isPending ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
