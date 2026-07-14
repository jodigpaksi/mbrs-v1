import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import type { Room } from '../../types/index'
import { useModalHotkeys } from '../../hooks/useModalHotkeys'
import { getBuildings } from '../../api/buildings'
import { getRooms, regenerateSensorCode } from '../../api/rooms'
import { getGeneralSettings, updateGeneralSettings } from '../../api/settings'
import { useCancelToast } from '../../context/CancelToastContext'

function SensorTab() {
  const { addInfoToast } = useCancelToast()
  const qc = useQueryClient()
  const { data: general } = useQuery({ queryKey: ['settings-general'], queryFn: getGeneralSettings, staleTime: 60_000 })
  const { data: rooms = [] } = useQuery<Room[]>({ queryKey: ['rooms'], queryFn: getRooms, staleTime: 60_000 })

  const antiGhostEnabled = general?.anti_ghost_enabled ?? false
  const sensorEnabled    = antiGhostEnabled && (general?.anti_ghost_mode ?? '').split(',').includes('sensor')
  const token            = general?.sensor_api_token ?? ''

  const { mutateAsync: doSaveGeneral } = useMutation({
    mutationFn: (patch: Partial<import('../../api/settings').GeneralSettings>) => updateGeneralSettings(patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['settings-general'] }),
  })

  const [regeneratingSensor, setRegeneratingSensor] = useState<number | null>(null)
  const [regenTokenModal, setRegenTokenModal] = useState(false)
  const [regenTokenInput, setRegenTokenInput] = useState('')
  const [regenTokenLoading, setRegenTokenLoading] = useState(false)
  const [sensorBuildingFilter, setSensorBuildingFilter] = useState<number | null>(null)

  async function handleRegenToken() {
    setRegenTokenLoading(true)
    try {
      const newToken = Array.from(crypto.getRandomValues(new Uint8Array(16))).map(b => b.toString(16).padStart(2, '0')).join('')
      await doSaveGeneral({ sensor_api_token: newToken })
      addInfoToast('Sensor API token regenerated — reflash all ESP32s')
      setRegenTokenModal(false)
      setRegenTokenInput('')
    } finally { setRegenTokenLoading(false) }
  }

  useModalHotkeys(
    regenTokenModal,
    regenTokenInput === 'Regenerate' ? handleRegenToken : undefined,
    () => { setRegenTokenModal(false); setRegenTokenInput('') },
  )

  async function handleRegenCode(room: Room) {
    setRegeneratingSensor(room.id)
    try {
      const updated = await regenerateSensorCode(room.id)
      qc.setQueryData(['rooms'], (old: Room[]) => old.map(r => r.id === room.id ? { ...r, sensor_code: updated.sensor_code } : r))
      addInfoToast(`Sensor code regenerated for ${room.name}`)
    } finally { setRegeneratingSensor(null) }
  }

  if (!sensorEnabled) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-5 text-center px-8">
        <div className="size-24 rounded-3xl flex items-center justify-center" style={{ background: 'var(--ds-bg-surface)', border: '1px solid var(--ds-border)' }}>
          <span className="material-symbols-outlined" style={{ fontSize: 48, color: 'var(--ds-text-4)' }}>sensors_off</span>
        </div>
        <div>
          <p className="text-xl font-black uppercase tracking-wide" style={{ color: 'var(--ds-text-2)' }}>Sensor Mode Disabled</p>
          <p className="text-sm font-medium mt-2 leading-relaxed" style={{ color: 'var(--ds-text-4)' }}>
            Enable it in <span className="font-black" style={{ color: 'var(--ds-text-3)' }}>Settings → Anti-Ghost Booking → Detection Method</span>
          </p>
        </div>
      </div>
    )
  }

  const { data: sensorBuildings = [] } = useQuery({ queryKey: ['buildings'], queryFn: getBuildings, staleTime: 300_000 })
  const allSensorRooms = (rooms as Room[]).filter(r => r.is_active).sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
  const sensorRooms = sensorBuildingFilter !== null
    ? allSensorRooms.filter(r => r.building_id === sensorBuildingFilter)
    : allSensorRooms

  return (
    <div className="space-y-6 pb-10">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-1">
          <span className="size-2.5 rounded-full bg-[#adee2b] animate-pulse shrink-0" />
          <p className="text-sm font-black uppercase tracking-wider" style={{ color: '#4d7c00' }}>Sensor Mode Active</p>
        </div>
        <p className="text-sm font-medium" style={{ color: 'var(--ds-text-3)' }}>
          ESP32 sensors auto-confirm presence by pinging this server. Configure tokens below, flash each device, and you're done.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-5">
        {/* Left column — API Token + Request format + Response */}
        <div className="space-y-5">
          {/* API Token */}
          <div className="bg-[var(--ds-bg-surface)] rounded-2xl border border-[var(--ds-border-sub)] p-5 space-y-3">
            <p className="text-xs font-black uppercase tracking-wider" style={{ color: 'var(--ds-text-3)' }}>API Token</p>
            <p className="text-sm font-medium leading-relaxed" style={{ color: 'var(--ds-text-4)' }}>
              Flash this into every ESP32 as the <code className="font-mono text-xs px-1.5 py-0.5 rounded" style={{ background: 'var(--ds-bg-raised)' }}>X-Sensor-Token</code> header. Shared across all rooms.
            </p>
            <div className="flex items-center gap-2 p-3 rounded-xl" style={{ background: 'var(--ds-bg-raised)', border: '1px solid var(--ds-border)' }}>
              <span className="material-symbols-outlined shrink-0" style={{ fontSize: 18, color: 'var(--ds-text-3)' }}>key</span>
              <code className="flex-1 min-w-0 text-sm font-mono truncate" style={{ color: 'var(--ds-text-2)' }}>{token || '—'}</code>
              <button onClick={() => token && navigator.clipboard.writeText(token).then(() => addInfoToast('Token copied'))}
                className="shrink-0 size-8 flex items-center justify-center rounded-lg transition-colors"
                style={{ background: 'var(--ds-bg-surface)', border: '1px solid var(--ds-border)' }} title="Copy">
                <span className="material-symbols-outlined" style={{ fontSize: 16, color: 'var(--ds-text-3)' }}>content_copy</span>
              </button>
            </div>
            {/* Danger zone */}
            <div className="rounded-2xl p-4 space-y-3" style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)' }}>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-red-500">Danger Zone</p>
              <div className="flex items-center justify-between gap-4">
                <p className="text-xs font-medium leading-relaxed" style={{ color: '#f87171' }}>
                  Regenerate token — all ESP32s must be reflashed afterwards.
                </p>
                <button onClick={() => { setRegenTokenModal(true); setRegenTokenInput('') }}
                  className="shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-black uppercase transition-colors"
                  style={{ background: 'var(--ds-bg-surface)', border: '1px solid rgba(239,68,68,0.4)', color: '#ef4444' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 14 }}>refresh</span>
                  Regenerate
                </button>
              </div>
            </div>
          </div>

          {/* Request format */}
          <div className="bg-[var(--ds-bg-surface)] rounded-2xl border border-[var(--ds-border-sub)] p-5 space-y-3">
            <p className="text-xs font-black uppercase tracking-wider" style={{ color: 'var(--ds-text-3)' }}>ESP32 Request</p>
            <div className="rounded-xl p-4" style={{ background: 'rgba(15,20,45,0.75)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <pre className="text-xs font-mono leading-relaxed whitespace-pre-wrap break-all" style={{ color: 'rgba(255,255,255,0.7)' }}>{`POST /api/sensor/ping\nX-Sensor-Token: ${token || '<token>'}\nContent-Type: application/json\n\n{ "sensor_code": "<room-sensor-code>" }`}</pre>
            </div>
            <button onClick={() => navigator.clipboard.writeText(`POST /api/sensor/ping\nX-Sensor-Token: ${token}\nContent-Type: application/json\n\n{ "sensor_code": "<room-sensor-code>" }`).then(() => addInfoToast('Request format copied'))}
              className="flex items-center gap-1.5 text-xs font-black" style={{ color: 'var(--ds-text-3)' }}>
              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>content_copy</span>
              Copy
            </button>
          </div>

          {/* Response codes */}
          <div className="bg-[var(--ds-bg-surface)] rounded-2xl border border-[var(--ds-border-sub)] p-5 space-y-3">
            <p className="text-xs font-black uppercase tracking-wider" style={{ color: 'var(--ds-text-3)' }}>Response Reference</p>
            <div className="space-y-2">
              {([
                { resp: '{ "confirmed": true, "booking_id": 42 }', note: '200 — confirmed',           color: '#22c55e' },
                { resp: '{ "confirmed": false }',                  note: '200 — no booking in window', color: 'var(--ds-text-3)' },
                { resp: '401 Unauthorized',                        note: 'Wrong token',                color: '#ef4444' },
                { resp: '403 Forbidden',                           note: 'Sensor mode off',            color: '#f59e0b' },
                { resp: '404 Not Found',                           note: 'Unknown sensor_code',        color: '#f59e0b' },
              ] as const).map((r, i) => (
                <div key={i} className="flex items-start gap-3 p-2.5 rounded-lg" style={{ background: 'var(--ds-bg-raised)', border: '1px solid var(--ds-border)' }}>
                  <code className="text-xs font-mono flex-1 min-w-0 break-all leading-relaxed" style={{ color: r.color }}>{r.resp}</code>
                  <span className="text-xs font-bold shrink-0 text-right" style={{ color: 'var(--ds-text-4)', minWidth: 100 }}>{r.note}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right column — Setup guide + Room codes */}
        <div className="space-y-5">
          {/* Setup guide */}
          <div className="bg-[var(--ds-bg-surface)] rounded-2xl border border-[var(--ds-border-sub)] p-5 space-y-3">
            <p className="text-xs font-black uppercase tracking-wider" style={{ color: 'var(--ds-text-3)' }}>Setup Guide</p>
            <div className="space-y-2">
              {([
                { n: '1', title: 'Enable sensor mode',   body: 'Settings → Anti-Ghost Booking → Detection Method → check Sensor.' },
                { n: '2', title: 'Copy API token',        body: "Copy the token on the left. It's shared by all ESP32s in your system." },
                { n: '3', title: 'Get the room code',     body: 'Each room below has a unique 16-char Sensor Code. Copy it for the matching ESP32.' },
                { n: '4', title: 'Flash the ESP32',       body: 'Set SERVER_URL, API_TOKEN (from step 2), and SENSOR_CODE (from step 3) in your firmware, then flash.' },
                { n: '5', title: 'Test the connection',   body: 'Power on the device. On motion it POSTs to /api/sensor/ping. If a booking is in the confirmation window, presence is auto-confirmed.' },
                { n: '6', title: 'Configure the window',  body: 'Settings → Confirmation Window sets how many minutes before/after start time sensors can confirm.' },
              ] as const).map(step => (
                <div key={step.n} className="flex gap-3 p-3.5 rounded-xl" style={{ background: 'var(--ds-bg-raised)', border: '1px solid var(--ds-border)' }}>
                  <div className="size-6 rounded-lg flex items-center justify-center shrink-0 mt-0.5" style={{ background: 'var(--ds-bg-surface-2)' }}>
                    <span className="text-xs font-black" style={{ color: 'var(--ds-text-3)' }}>{step.n}</span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-black" style={{ color: 'var(--ds-text-1)' }}>{step.title}</p>
                    <p className="text-xs font-medium leading-relaxed mt-0.5" style={{ color: 'var(--ds-text-4)' }}>{step.body}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Room sensor codes */}
          <div className="bg-[var(--ds-bg-surface)] rounded-2xl border border-[var(--ds-border-sub)] p-5 space-y-3">
            <p className="text-xs font-black uppercase tracking-wider" style={{ color: 'var(--ds-text-3)' }}>Room Sensor Codes</p>

            {/* Building filter */}
            {sensorBuildings.length > 0 && (
              <div className="flex gap-1.5 flex-wrap">
                <button onClick={() => setSensorBuildingFilter(null)}
                  className="px-3 py-1 rounded-xl text-xs font-black uppercase tracking-wide transition-all"
                  style={{
                    background: sensorBuildingFilter === null ? '#111827' : 'var(--ds-bg-raised)',
                    color: sensorBuildingFilter === null ? '#adee2b' : 'var(--ds-text-3)',
                    border: sensorBuildingFilter === null ? '1px solid transparent' : '1px solid var(--ds-border)',
                  }}>All</button>
                {sensorBuildings.map(b => (
                  <button key={b.id} onClick={() => setSensorBuildingFilter(sensorBuildingFilter === b.id ? null : b.id)}
                    className="px-3 py-1 rounded-xl text-xs font-black uppercase tracking-wide transition-all"
                    style={{
                      background: sensorBuildingFilter === b.id ? '#111827' : 'var(--ds-bg-raised)',
                      color: sensorBuildingFilter === b.id ? '#adee2b' : 'var(--ds-text-3)',
                      border: sensorBuildingFilter === b.id ? '1px solid transparent' : '1px solid var(--ds-border)',
                    }}>{b.code ?? b.name}</button>
                ))}
              </div>
            )}

            <div className="space-y-2 max-h-80 overflow-y-auto pr-1" style={{ scrollbarWidth: 'thin' }}>
              {sensorRooms.length === 0 ? (
                <p className="text-sm text-[var(--ds-text-4)] py-2">No active rooms found.</p>
              ) : sensorRooms.map(room => {
                const bldg = sensorBuildings.find(b => b.id === room.building_id)
                return (
                  <div key={room.id} className="flex items-center gap-2.5 p-3 rounded-xl" style={{ background: 'var(--ds-bg-raised)', border: '1px solid var(--ds-border)' }}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <p className="text-sm font-black truncate" style={{ color: 'var(--ds-text-1)' }}>{room.name}</p>
                        {bldg && sensorBuildingFilter === null && (
                          <span className="text-[9px] font-black px-1.5 py-0.5 rounded-md shrink-0"
                            style={{ background: 'var(--ds-bg-surface-2)', color: 'var(--ds-text-4)' }}>
                            {bldg.code ?? bldg.name}
                          </span>
                        )}
                      </div>
                      <code className="text-xs font-mono" style={{ color: 'var(--ds-text-3)' }}>{room.sensor_code ?? '—'}</code>
                    </div>
                    <button onClick={() => room.sensor_code && navigator.clipboard.writeText(room.sensor_code).then(() => addInfoToast(`Code copied: ${room.name}`))}
                      className="size-8 flex items-center justify-center rounded-lg shrink-0 transition-colors hover:bg-[var(--ds-bg-surface)]"
                      title="Copy sensor code">
                      <span className="material-symbols-outlined" style={{ fontSize: 15, color: 'var(--ds-text-3)' }}>content_copy</span>
                    </button>
                    <button onClick={() => handleRegenCode(room)}
                      disabled={regeneratingSensor === room.id}
                      className="size-8 flex items-center justify-center rounded-lg shrink-0 transition-colors disabled:opacity-50"
                      style={{ color: '#ef4444' }}
                      title="Regenerate — must reflash ESP32">
                      {regeneratingSensor === room.id
                        ? <span className="material-symbols-outlined animate-spin" style={{ fontSize: 15 }}>progress_activity</span>
                        : <span className="material-symbols-outlined" style={{ fontSize: 15 }}>refresh</span>}
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Regenerate token confirm modal */}
      {regenTokenModal && createPortal(
        <div className="fixed inset-0 z-[1000] flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(16px)' }}
          onClick={() => { setRegenTokenModal(false); setRegenTokenInput('') }}>
          <div className="w-[420px] rounded-[2rem] overflow-hidden shadow-2xl"
            style={{ background: 'var(--ds-bg-surface)', border: '1px solid rgba(128,128,128,0.15)' }}
            onClick={e => e.stopPropagation()}>
            <div className="px-7 pt-7 pb-5 border-b flex items-center gap-3" style={{ background: 'rgba(239,68,68,0.08)', borderColor: 'rgba(239,68,68,0.15)' }}>
              <div className="size-10 rounded-2xl bg-red-100 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-red-500" style={{ fontSize: 22 }}>key_off</span>
              </div>
              <div>
                <p className="text-base font-black text-[var(--ds-text-1)]">Regenerate Sensor API Token</p>
                <p className="text-[11px] text-[var(--ds-text-2)]">All ESP32s will stop working until reflashed.</p>
              </div>
            </div>
            <div className="px-7 py-6 space-y-5">
              <p className="text-sm text-[var(--ds-text-2)] leading-relaxed">
                The current token will be <span className="font-black text-red-500">immediately invalidated</span>. Every ESP32 in your system must be reflashed with the new token before presence detection resumes.
              </p>
              <div className="space-y-1.5">
                <p className="text-[10px] font-black text-[var(--ds-text-2)] uppercase tracking-wider">Confirm action</p>
                <p className="text-[11px] text-[var(--ds-text-2)]">Type <span className="font-black text-red-500 font-mono">Regenerate</span> to confirm</p>
                <input
                  type="text"
                  value={regenTokenInput}
                  onChange={e => setRegenTokenInput(e.target.value)}
                  placeholder="Regenerate"
                  autoFocus
                  className="w-full px-4 py-3 rounded-xl border border-[var(--ds-border)] text-[13px] font-semibold focus:outline-none focus:ring-2 focus:ring-red-300 focus:border-red-300 placeholder:text-[var(--ds-text-3)] bg-[var(--ds-bg-raised)] text-[var(--ds-text-1)]"
                />
              </div>
              <div className="flex gap-3 justify-end">
                <button onClick={() => { setRegenTokenModal(false); setRegenTokenInput('') }}
                  className="px-5 py-2.5 rounded-xl border border-[var(--ds-border)] text-[var(--ds-text-2)] text-[11px] font-black uppercase hover:bg-[var(--ds-bg-raised)] transition-colors">
                  Cancel
                </button>
                <button onClick={handleRegenToken}
                  disabled={regenTokenInput !== 'Regenerate' || regenTokenLoading}
                  className="px-5 py-2.5 rounded-xl bg-red-500 text-white text-[11px] font-black uppercase hover:bg-red-600 disabled:opacity-40 transition-all flex items-center gap-2">
                  {regenTokenLoading && <span className="material-symbols-outlined animate-spin" style={{ fontSize: 13 }}>progress_activity</span>}
                  Regenerate Token
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}

export { SensorTab as default }
