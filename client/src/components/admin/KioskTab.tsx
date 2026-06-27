import { useState, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createPortal } from 'react-dom'
import { getKioskConfigs, createKioskConfig, updateKioskConfig, deleteKioskConfig } from '../../api/kiosk'
import { getRooms } from '../../api/rooms'
import type { KioskConfig, KioskTheme, KioskLayout } from '../../types'

// ── Presets ───────────────────────────────────────────────────────────────────

const THEME_PRESETS: { label: string; value: KioskTheme }[] = [
  { label: 'Dark',  value: { mode: 'dark',  accent: '#adee2b', bg: '#0a0e1a', surface: '#141826', text: '#ffffff' } },
  { label: 'Light', value: { mode: 'light', accent: '#1d4ed8', bg: '#f1f5f9', surface: '#ffffff', text: '#1a2030' } },
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

// Derive light/dark mode from a background hex (so the kiosk's secondary colors adapt).
function modeFromBg(hex: string): 'dark' | 'light' {
  const h = hex.replace('#', '')
  if (h.length < 6) return 'dark'
  const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16)
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 < 0.5 ? 'dark' : 'light'
}

// ── Searchable, building-grouped room picker ────────────────────────────────────
interface PickerRoom { id: number; name: string; floor: string; building: string }

function RoomPicker({ rooms, value, onChange }: { rooms: PickerRoom[]; value: number | ''; onChange: (id: number | '') => void }) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [open])

  const selected = rooms.find(r => r.id === value)
  const q = search.trim().toLowerCase()
  const filtered = q
    ? rooms.filter(r => r.name.toLowerCase().includes(q) || r.building.toLowerCase().includes(q) || (r.floor ?? '').toLowerCase().includes(q))
    : rooms
  const groups = filtered.reduce<Record<string, PickerRoom[]>>((acc, r) => { (acc[r.building] ??= []).push(r); return acc }, {})

  return (
    <div className="relative" ref={ref}>
      <button type="button" onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-[12px] font-bold bg-[var(--ds-bg-raised)] border border-[var(--ds-border)] text-[var(--ds-text-1)] hover:border-[#adee2b]/40 transition-colors">
        <span className="truncate flex items-center gap-2">
          {selected
            ? <><span className="material-symbols-outlined text-[var(--ds-text-3)]" style={{ fontSize: 16 }}>meeting_room</span>{selected.name}{selected.floor ? ` · Fl ${selected.floor}` : ''}</>
            : <span className="text-[var(--ds-text-4)]">— No room —</span>}
        </span>
        <span className="material-symbols-outlined text-[var(--ds-text-3)] shrink-0" style={{ fontSize: 18 }}>{open ? 'expand_less' : 'expand_more'}</span>
      </button>
      {open && (
        <div className="absolute z-50 mt-1.5 w-full rounded-2xl overflow-hidden shadow-2xl" style={{ background: 'var(--ds-bg-surface)', border: '1px solid var(--ds-border)' }}>
          <div className="p-2 border-b border-[var(--ds-border)]">
            <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-[var(--ds-bg-raised)]">
              <span className="material-symbols-outlined text-[var(--ds-text-4)]" style={{ fontSize: 16 }}>search</span>
              <input autoFocus value={search} onChange={e => setSearch(e.target.value)} placeholder="Search room or building…"
                className="flex-1 bg-transparent text-[12px] font-medium text-[var(--ds-text-1)] focus:outline-none placeholder:text-[var(--ds-text-4)]" />
            </div>
          </div>
          <div className="max-h-[240px] overflow-y-auto p-1.5" style={{ scrollbarWidth: 'thin' }}>
            <button type="button" onClick={() => { onChange(''); setOpen(false); setSearch('') }}
              className="w-full text-left px-3 py-2 rounded-lg text-[12px] font-bold text-[var(--ds-text-3)] hover:bg-[var(--ds-bg-raised)] transition-colors">— No room —</button>
            {Object.entries(groups).map(([building, list]) => (
              <div key={building} className="mt-1">
                <p className="px-3 pt-2 pb-1 text-[9px] font-black uppercase tracking-[0.2em] text-[var(--ds-text-4)]">{building}</p>
                {list.map(r => {
                  const sel = r.id === value
                  return (
                    <button key={r.id} type="button" onClick={() => { onChange(r.id); setOpen(false); setSearch('') }}
                      className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-left hover:bg-[var(--ds-bg-raised)] transition-colors"
                      style={{ background: sel ? 'rgba(173,238,43,0.12)' : undefined }}>
                      <span className="text-[12px] font-bold text-[var(--ds-text-1)] truncate flex items-center gap-1.5">
                        {sel && <span className="material-symbols-outlined text-[#7aa81e]" style={{ fontSize: 14 }}>check</span>}
                        {r.name}
                      </span>
                      <span className="text-[10px] font-bold text-[var(--ds-text-4)] shrink-0">{r.floor ? `Fl ${r.floor}` : ''}</span>
                    </button>
                  )
                })}
              </div>
            ))}
            {filtered.length === 0 && <p className="px-3 py-5 text-center text-[11px] text-[var(--ds-text-4)]">No rooms found</p>}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Edit/Create modal ─────────────────────────────────────────────────────────

interface EditModalProps {
  initial?: KioskConfig
  rooms: PickerRoom[]
  onSave: (data: Partial<KioskConfig>) => Promise<void>
  onClose: () => void
}

const DEFAULT_THEME: KioskTheme       = THEME_PRESETS[0].value
const DEFAULT_LAYOUT: KioskLayout     = { show_clock: true, show_bookings: true, show_book_btn: true, show_confirm_btn: false, orientation: 'landscape', book_btn_url: '', upcoming_count: 2 }

// ── Live preview ──────────────────────────────────────────────────────────────
// Faithful miniature of the real kiosk. Uses container-query units (cqmin) so it
// scales to the preview box exactly like the real kiosk scales to the viewport
// with vmin. Mock data + a live clock; reacts to theme / layout / orientation.

const PREVIEW_UPCOMING = [
  { id: 1, start: '10:30', end: '11:30', title: 'Design Review', user: 'Mark Lee', dept: 'Product' },
  { id: 2, start: '13:00', end: '14:00', title: 'Client Sync',   user: 'Ana Putri', dept: 'Sales' },
]
const PREVIEW_CURRENT = { title: 'Daily Standup', start: '09:00', end: '10:00', user: 'Sarah Chen', dept: 'Engineering' }

function KioskPreview({ theme, layout, roomName }: { theme: KioskTheme; layout: KioskLayout; roomName: string }) {
  const [now, setNow] = useState(new Date())
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(t) }, [])

  const hh = String(now.getHours()).padStart(2, '0')
  const mm = String(now.getMinutes()).padStart(2, '0')
  const ss = String(now.getSeconds()).padStart(2, '0')
  const dateStr = now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

  const isPortrait = layout.orientation === 'portrait'
  const isDark = theme.mode === 'dark'
  const count = Math.min(2, Math.max(1, layout.upcoming_count ?? 2))
  const upcoming = PREVIEW_UPCOMING.slice(0, count)
  const ok = '#ef4444' // preview shows an "in use" room so every element is visible
  const text2 = isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.45)'
  const border = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.09)'
  const meta = '8 seats'

  const stage: React.CSSProperties = {
    aspectRatio: isPortrait ? '3 / 4' : '4 / 3',
    containerType: 'size',
    background: theme.bg, color: theme.text,
    borderRadius: 16, overflow: 'hidden', position: 'relative',
    border: `1px solid ${border}`,
    boxShadow: '0 10px 30px rgba(0,0,0,0.18)',
  } as React.CSSProperties

  // ── Portrait mini ──
  const portrait = (
    <div style={stage}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '0.6cqmin', background: ok }} />
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', textAlign: 'center', alignItems: 'center', padding: '0 7cqmin' }}>
        {layout.show_clock && (
          <div style={{ paddingTop: '6cqmin', paddingBottom: '3cqmin' }}>
            <p style={{ fontWeight: 900, fontSize: '10.5cqmin', lineHeight: 1, letterSpacing: '-0.04em' }}>
              {hh}:{mm}<span style={{ fontSize: '5cqmin', color: text2 }}>:{ss}</span>
            </p>
            <p style={{ fontWeight: 900, fontSize: '3.4cqmin', marginTop: '1.4cqmin' }}>{dateStr}</p>
          </div>
        )}
        <p style={{ fontWeight: 900, fontSize: '7.5cqmin', lineHeight: 1.05, marginTop: '2cqmin' }}>{roomName}</p>
        <p style={{ fontWeight: 600, fontSize: '3.3cqmin', color: text2, marginTop: '1cqmin' }}>{meta}</p>
        <div style={{ width: '30%', height: 1, background: `${ok}55`, margin: '3.5cqmin 0' }} />
        <div style={{ width: '100%', textAlign: 'left', background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '3cqmin', padding: '3cqmin 3.6cqmin' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.6cqmin', marginBottom: '1.6cqmin' }}>
            <span style={{ width: '1.6cqmin', height: '1.6cqmin', borderRadius: 99, background: '#ef4444' }} />
            <p style={{ fontWeight: 900, fontSize: '2.4cqmin', color: '#ef4444', textTransform: 'uppercase', letterSpacing: '0.2em' }}>In Use</p>
          </div>
          <p style={{ fontWeight: 900, fontSize: '5cqmin', lineHeight: 1.15 }}>{PREVIEW_CURRENT.title}</p>
          <p style={{ fontWeight: 700, fontSize: '3.4cqmin', marginTop: '1.2cqmin' }}>{PREVIEW_CURRENT.start} — {PREVIEW_CURRENT.end}</p>
          <p style={{ fontWeight: 600, fontSize: '2.8cqmin', color: text2, marginTop: '0.7cqmin' }}>{PREVIEW_CURRENT.user} - {PREVIEW_CURRENT.dept}</p>
        </div>
        {layout.show_confirm_btn && (
          <div style={{ width: '100%', marginTop: '2.6cqmin', textAlign: 'center', background: 'rgba(255,255,255,0.08)', border: `1px solid ${border}`, borderRadius: '3cqmin', padding: '3cqmin 0', fontWeight: 900, fontSize: '3cqmin', color: text2, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Confirm Presence</div>
        )}
        {layout.show_bookings && (
          <div style={{ width: '100%', marginTop: 'auto', borderTop: `1px solid ${border}`, padding: '2.8cqmin 0', textAlign: 'left' }}>
            <p style={{ fontWeight: 900, fontSize: '2.5cqmin', color: text2, textTransform: 'uppercase', letterSpacing: '0.2em', marginBottom: '2.4cqmin' }}>{count > 1 ? 'Next Up' : 'Upcoming'}</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '3cqmin' }}>
              {upcoming.map(b => (
                <div key={b.id} style={{ display: 'flex', alignItems: 'center', gap: '2.8cqmin' }}>
                  <div style={{ width: '15cqmin', textAlign: 'right', flexShrink: 0 }}>
                    <p style={{ fontWeight: 900, fontSize: '3.5cqmin', color: theme.accent, lineHeight: 1.1 }}>{b.start}</p>
                    <p style={{ fontWeight: 600, fontSize: '2.5cqmin', color: text2 }}>{b.end}</p>
                  </div>
                  <div style={{ width: 3, alignSelf: 'stretch', borderRadius: 99, background: border, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontWeight: 900, fontSize: '3.5cqmin', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{b.title}</p>
                    <p style={{ fontWeight: 600, fontSize: '2.5cqmin', color: text2 }}>{b.user} - {b.dept}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )

  // ── Landscape mini ──
  const landscape = (
    <div style={stage}>
      <div style={{ height: '100%', display: 'flex' }}>
        {/* Left status panel */}
        <div style={{ width: '38%', flexShrink: 0, display: 'flex', flexDirection: 'column', background: isDark ? 'rgba(239,68,68,0.13)' : 'rgba(239,68,68,0.08)', borderRight: `1px solid ${ok}30` }}>
          <div style={{ height: '0.7cqmin', background: ok }} />
          <div style={{ padding: '3cqmin 3.2cqmin', borderBottom: `1px solid ${border}` }}>
            <p style={{ fontWeight: 900, fontSize: '1.7cqmin', color: ok, textTransform: 'uppercase', letterSpacing: '0.2em' }}>In Use</p>
            <p style={{ fontWeight: 900, fontSize: '4cqmin', lineHeight: 1.1, marginTop: '0.6cqmin' }}>{roomName}</p>
            <p style={{ fontWeight: 600, fontSize: '1.9cqmin', color: text2, marginTop: '0.6cqmin' }}>{meta}</p>
          </div>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '2cqmin 3.2cqmin', gap: '1.5cqmin' }}>
            <p style={{ fontWeight: 900, fontSize: '4.6cqmin', lineHeight: 1.1, letterSpacing: '-0.03em' }}>{PREVIEW_CURRENT.title}</p>
            <p style={{ fontWeight: 700, fontSize: '2.2cqmin', color: text2 }}>{PREVIEW_CURRENT.start} — {PREVIEW_CURRENT.end}</p>
            <p style={{ fontWeight: 700, fontSize: '2.2cqmin', color: text2 }}>{PREVIEW_CURRENT.user} - {PREVIEW_CURRENT.dept}</p>
          </div>
          {layout.show_confirm_btn && (
            <div style={{ margin: '0 3.2cqmin 3.2cqmin', textAlign: 'center', background: 'rgba(255,255,255,0.08)', border: `1px solid ${border}`, borderRadius: '2.4cqmin', padding: '2cqmin 0', fontWeight: 900, fontSize: '2cqmin', color: text2, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Confirm Presence</div>
          )}
        </div>
        {/* Right schedule panel */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', background: theme.bg }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '2.6cqmin 3.2cqmin', borderBottom: `1px solid ${border}` }}>
            {layout.show_clock ? (
              <>
                <p style={{ fontWeight: 900, fontSize: '2.4cqmin' }}>{dateStr}</p>
                <p style={{ fontWeight: 900, fontSize: '6cqmin', color: theme.accent, letterSpacing: '-0.04em', lineHeight: 1 }}>
                  {hh}:{mm}<span style={{ fontSize: '2.6cqmin', color: text2 }}>:{ss}</span>
                </p>
              </>
            ) : <p style={{ fontWeight: 900, fontSize: '2cqmin', color: text2, textTransform: 'uppercase', letterSpacing: '0.25em' }}>Today's Schedule</p>}
          </div>
          {layout.show_bookings && (
            <div style={{ padding: '2.4cqmin 3.2cqmin', display: 'flex', flexDirection: 'column', gap: '2cqmin' }}>
              {upcoming.map(b => (
                <div key={b.id} style={{ display: 'flex', alignItems: 'center', gap: '2.4cqmin' }}>
                  <div style={{ width: '11cqmin', textAlign: 'right', flexShrink: 0 }}>
                    <p style={{ fontWeight: 900, fontSize: '2.4cqmin', color: theme.accent }}>{b.start}</p>
                    <p style={{ fontWeight: 600, fontSize: '1.8cqmin', color: text2 }}>{b.end}</p>
                  </div>
                  <div style={{ width: 2, alignSelf: 'stretch', borderRadius: 99, background: border, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontWeight: 900, fontSize: '2.4cqmin', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{b.title}</p>
                    <p style={{ fontWeight: 600, fontSize: '1.8cqmin', color: text2 }}>{b.user} - {b.dept}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )

  return (
    <div>
      <div style={{ width: '100%', maxWidth: isPortrait ? 300 : 480, margin: '0 auto' }}>
        {isPortrait ? portrait : landscape}
      </div>
      <p className="text-center text-[10px] font-bold text-[var(--ds-text-4)] mt-3 uppercase tracking-wider">
        {isPortrait ? 'Portrait' : 'Landscape'} · live preview · sample data
      </p>
    </div>
  )
}

function EditModal({ initial, rooms, onSave, onClose }: EditModalProps) {
  const [name,     setName]     = useState(initial?.name ?? '')
  const [slug,     setSlug]     = useState(initial?.slug ?? '')
  const [roomId,   setRoomId]   = useState<number | ''>(initial?.room_id ?? '')
  const [pin,      setPin]      = useState(initial?.pin ?? '')
  const [active,   setActive]   = useState(initial?.active ?? true)
  const [theme,    setTheme]    = useState<KioskTheme>(initial?.theme    ?? DEFAULT_THEME)
  const [layout,   setLayout]   = useState<KioskLayout>({ ...DEFAULT_LAYOUT, ...(initial?.layout ?? {}) })
  const [saving,   setSaving]   = useState(false)
  const [err,      setErr]      = useState('')

  const selectedRoomName = roomId === '' ? 'Meeting Room' : (rooms.find(r => r.id === roomId)?.name ?? 'Meeting Room')

  function applyThemePreset(p: KioskTheme) { setTheme(p) }

  const isCustomTheme = !THEME_PRESETS.some(p => JSON.stringify(p.value) === JSON.stringify(theme))

  async function handleSave() {
    if (!name.trim()) { setErr('Name is required'); return }
    if (pin && !/^\d{4}$/.test(pin)) { setErr('PIN must be exactly 4 digits'); return }
    if (slug.trim() && !/^[a-z0-9][a-z0-9-]*$/.test(slug.trim())) { setErr('Custom ID: lowercase letters, numbers and hyphens only'); return }
    setSaving(true); setErr('')
    try {
      await onSave({
        name: name.trim(),
        slug: slug.trim() || null,
        room_id: roomId === '' ? null : roomId,
        pin: pin.trim() || null as any,
        theme, layout, active,
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
                <label className={labelCls}>Custom ID <span className="normal-case text-[var(--ds-text-4)]">(for the link)</span></label>
                <input className={inputCls} value={slug} maxLength={40}
                  onChange={e => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                  placeholder="e.g. lobby-1" />
                <p className="text-[9px] text-[var(--ds-text-4)] font-mono mt-1 truncate">/kiosk/{slug.trim() || (initial?.id ?? 'auto')}</p>
              </div>
              <div>
                <label className={labelCls}>Room</label>
                <RoomPicker rooms={rooms} value={roomId} onChange={setRoomId} />
              </div>
              <div>
                <label className={labelCls}>PIN <span className="normal-case text-[var(--ds-text-4)]">(optional · 4 digits)</span></label>
                <input className={`${inputCls} tracking-[0.4em] font-mono`} inputMode="numeric" maxLength={4} value={pin}
                  onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  placeholder="••••" />
              </div>
              {/* Active toggle — full-width row */}
              <div className="col-span-2 flex items-center justify-between px-4 py-3 rounded-xl bg-[var(--ds-bg-raised)] border border-[var(--ds-border)]">
                <div className="flex items-center gap-2.5">
                  <span className="size-2 rounded-full" style={{ background: active ? '#22c55e' : 'var(--ds-text-4)', boxShadow: active ? '0 0 6px #22c55e88' : 'none' }} />
                  <div>
                    <p className="text-[12px] font-black text-[var(--ds-text-1)]">{active ? 'Active' : 'Inactive'}</p>
                    <p className="text-[10px] text-[var(--ds-text-3)]">{active ? 'Kiosk is publicly accessible' : 'Kiosk returns 404'}</p>
                  </div>
                </div>
                <button onClick={() => setActive(a => !a)} type="button"
                  className="relative rounded-full transition-colors shrink-0"
                  style={{ width: 46, height: 26, background: active ? '#adee2b' : 'var(--ds-bg-surface-2)', border: '1px solid var(--ds-border)' }}>
                  <span className="absolute top-[3px] rounded-full transition-all" style={{ width: 18, height: 18, background: active ? '#1a3a00' : 'var(--ds-text-3)', left: active ? 24 : 3 }} />
                </button>
              </div>
            </div>
          </section>

          {/* Theme */}
          <section>
            <p className={sectionHd}>Theme</p>
            <div className="flex flex-wrap items-center gap-2 mb-4">
              {THEME_PRESETS.map(p => {
                const active = JSON.stringify(theme) === JSON.stringify(p.value)
                return (
                  <button key={p.label} onClick={() => applyThemePreset(p.value)}
                    className="px-4 py-1.5 rounded-xl text-[10px] font-black transition-all"
                    style={{
                      background: active ? '#adee2b' : 'var(--ds-bg-raised)',
                      color: active ? '#1a3a00' : 'var(--ds-text-2)',
                      border: '1px solid var(--ds-border)',
                    }}>
                    {p.label}
                  </button>
                )
              })}
              <span className="px-4 py-1.5 rounded-xl text-[10px] font-black" title="Edit any colour below to make a custom theme"
                style={{
                  background: isCustomTheme ? '#adee2b' : 'transparent',
                  color: isCustomTheme ? '#1a3a00' : 'var(--ds-text-4)',
                  border: '1px dashed var(--ds-border)',
                }}>
                Custom
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <ColorField label="Background"  value={theme.bg}      onChange={v => setTheme(t => ({ ...t, bg: v, mode: modeFromBg(v) }))} />
              <ColorField label="Surface"     value={theme.surface} onChange={v => setTheme(t => ({ ...t, surface: v }))} />
              <ColorField label="Accent"      value={theme.accent}  onChange={v => setTheme(t => ({ ...t, accent: v }))} />
              <ColorField label="Text"        value={theme.text}    onChange={v => setTheme(t => ({ ...t, text: v }))} />
            </div>
          </section>

          {/* Layout */}
          <section>
            <p className={sectionHd}>Layout</p>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className={labelCls}>Preview Orientation <span className="text-[var(--ds-text-4)] normal-case">(live kiosk auto-fits the screen)</span></label>
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
              {([
                ['show_clock',       'Show Clock'],
                ['show_bookings',    'Show Bookings List'],
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
              {layout.show_bookings && (
                <div className="col-span-2">
                  <label className={labelCls}>Next Bookings to Show</label>
                  <div className="flex gap-2">
                    {[1, 2].map(n => {
                      const sel = (layout.upcoming_count ?? 2) === n
                      return (
                        <button key={n} onClick={() => setLayout(l => ({ ...l, upcoming_count: n }))}
                          className="flex-1 px-3 py-2 rounded-xl text-[12px] font-black transition-all"
                          style={{
                            background: sel ? '#adee2b' : 'var(--ds-bg-raised)',
                            color: sel ? '#1a3a00' : 'var(--ds-text-2)',
                            border: '1px solid var(--ds-border)',
                          }}>
                          {n} {n === 1 ? 'booking' : 'bookings'}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* Live preview */}
          <section>
            <p className={sectionHd}>Live Preview</p>
            <KioskPreview theme={theme} layout={layout} roomName={selectedRoomName} />
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

  function kioskUrl(k: { id: number; slug: string | null }) {
    return `${window.location.origin}/kiosk/${k.slug || k.id}`
  }

  function copyUrl(k: { id: number; slug: string | null }) {
    navigator.clipboard.writeText(kioskUrl(k))
    setCopied(k.id)
    setTimeout(() => setCopied(null), 1500)
  }

  const flatRooms = rooms.map((r: any) => ({ id: r.id, name: r.name, floor: r.floor ?? '', building: r.building?.name ?? r.building?.code ?? 'Unassigned' }))

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
          <p className="text-[12px] text-[var(--ds-text-3)] mt-1">Tablet kiosks for room status displays — auto-responsive, custom theme &amp; link.</p>
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
                  {k.has_pin ? ' · PIN locked' : ''}
                </p>
                <p className="text-[10px] text-[var(--ds-text-4)] font-mono mt-0.5 truncate">/kiosk/{k.slug || k.id}</p>
              </div>

              {/* Theme preview chips */}
              <div className="flex gap-1.5 shrink-0">
                {[k.theme.bg, k.theme.surface, k.theme.accent].map((c, ci) => (
                  <div key={ci} className="size-4 rounded-full border border-black/10" style={{ background: c }} />
                ))}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1 shrink-0">
                <a href={kioskUrl(k)} target="_blank" rel="noopener noreferrer"
                  className="size-8 flex items-center justify-center rounded-xl text-[var(--ds-text-3)] hover:text-[var(--ds-text-1)] transition-colors"
                  title="Open kiosk">
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>open_in_new</span>
                </a>
                <button onClick={() => copyUrl(k)}
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
