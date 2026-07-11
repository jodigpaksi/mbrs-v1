import { useState, useRef, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useSettings, type ViewPref, type TypePref, type LangPref, type StartDayPref } from '../../context/SettingsContext'
import { useAuth } from '../../context/AuthContext'
import { updateOnDutyStatus } from '../../api/auth'
import { getBuildings } from '../../api/buildings'
import type { Building } from '../../types/index'
import { useModalHotkeys } from '../../hooks/useModalHotkeys'

interface Props {
  open: boolean
  onClose: () => void
}

function SegmentedPill<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T
  onChange: (v: T) => void
  options: { value: T; label: string }[]
}) {
  const idx = options.findIndex(o => o.value === value)
  const n   = options.length
  return (
    <div className="relative flex p-1 rounded-[14px]" style={{ background: 'rgba(0,0,0,0.06)' }}>
      {/* Sliding pill */}
      <div
        className="absolute top-1 bottom-1 rounded-[10px] pointer-events-none"
        style={{
          width: `calc((100% - 8px) / ${n})`,
          left: `calc(4px + ${idx} * (100% - 8px) / ${n})`,
          background: 'var(--ds-pill-bg)',
          boxShadow: '0 1px 3px rgba(0,0,0,0.10), 0 1px 0 rgba(255,255,255,0.9) inset',
          transition: 'left 0.24s cubic-bezier(0.4,0,0.2,1)',
        }}
      />
      {options.map(opt => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className="relative z-10 flex-1 py-2 text-[11px] font-black uppercase tracking-wide rounded-[10px] transition-colors duration-150"
          style={{ color: value === opt.value ? 'var(--ds-text-1)' : 'var(--ds-text-3)' }}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

function BuildingDropdown({ buildings, value, onChange, autoLabel }: {
  buildings: Building[]
  value: number | null
  onChange: (v: number | null) => void
  autoLabel: string
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  const selected = value != null ? buildings.find(b => b.id === value) : null
  const label = selected
    ? [selected.name, selected.code && `(${selected.code})`, selected.location?.name && `— ${selected.location.name}`].filter(Boolean).join(' ')
    : autoLabel

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-2.5 rounded-[14px] text-[12px] font-black transition-all"
        style={{ background: 'rgba(0,0,0,0.06)', color: 'var(--ds-text-1)', border: 'none', cursor: 'pointer' }}
      >
        <span className="truncate">{label}</span>
        <span className="material-symbols-outlined shrink-0 ml-2 transition-transform" style={{ fontSize: 16, color: 'var(--ds-text-3)', transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}>expand_more</span>
      </button>

      {open && (
        <div
          className="absolute left-0 right-0 rounded-2xl overflow-hidden z-50"
          style={{
            top: 'calc(100% + 6px)',
            background: 'var(--ds-bg-surface)',
            backdropFilter: 'blur(24px)',
            WebkitBackdropFilter: 'blur(24px)',
            border: '1px solid var(--ds-border)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
          }}
        >
          {/* Auto option */}
          <button
            type="button"
            onClick={() => { onChange(null); setOpen(false) }}
            className="w-full flex items-center justify-between px-4 py-2.5 text-[12px] font-black text-left transition-colors"
            style={{ color: value == null ? '#6b8f00' : 'var(--ds-text-2)', background: value == null ? 'rgba(173,238,43,0.08)' : 'transparent' }}
            onMouseEnter={e => { if (value != null) e.currentTarget.style.background = 'var(--ds-bg-surface-2)' }}
            onMouseLeave={e => { if (value != null) e.currentTarget.style.background = 'transparent' }}
          >
            <span>{autoLabel}</span>
            {value == null && <span className="material-symbols-outlined" style={{ fontSize: 14, color: '#6b8f00' }}>check</span>}
          </button>

          {buildings.map(b => {
            const active = b.id === value
            return (
              <button
                key={b.id}
                type="button"
                onClick={() => { onChange(b.id); setOpen(false) }}
                className="w-full flex items-center justify-between px-4 py-2.5 text-left transition-colors border-t border-[var(--ds-border)]"
                style={{ background: active ? 'rgba(173,238,43,0.08)' : 'transparent' }}
                onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'var(--ds-bg-surface-2)' }}
                onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent' }}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[12px] font-black truncate" style={{ color: active ? '#6b8f00' : 'var(--ds-text-1)' }}>{b.name}</span>
                    {b.code && (
                      <>
                        <span className="text-[10px]" style={{ color: 'var(--ds-text-3)' }}>|</span>
                        <span className="text-[10px] font-black shrink-0" style={{ color: 'var(--ds-text-3)' }}>{b.code}</span>
                      </>
                    )}
                  </div>
                  {b.location && (
                    <div className="flex items-center gap-1 mt-0.5">
                      <span className="material-symbols-outlined" style={{ fontSize: 10, color: 'var(--ds-text-3)' }}>location_on</span>
                      <span className="text-[9px] font-bold truncate" style={{ color: 'var(--ds-text-3)' }}>{b.location.name}</span>
                    </div>
                  )}
                </div>
                {active && <span className="material-symbols-outlined shrink-0 ml-2" style={{ fontSize: 14, color: '#6b8f00' }}>check</span>}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

function SettingRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[9px] font-black uppercase tracking-[0.14em] mb-2.5" style={{ color: 'var(--ds-text-3)' }}>
        {label}
      </p>
      {children}
    </div>
  )
}

export default function SettingModal({ open, onClose }: Props) {
  const {
    defaultView, setDefaultView,
    defaultType, setDefaultType,
    startDay,    setStartDay,
    language,    setLanguage,
    darkMode,    setDarkMode,
    defaultBuilding, setDefaultBuilding,
    showBarTitle, setShowBarTitle,
    showKeyboardShortcuts, setShowKeyboardShortcuts,
    t,
  } = useSettings()

  const { user, setUser } = useAuth()
  const [onDutySaving, setOnDutySaving] = useState(false)
  const isReceptionist = user?.role === 'receptionist'
  const onDuty = user?.on_duty ?? true

  useModalHotkeys(open, undefined, onClose)

  async function toggleOnDuty() {
    if (!user || onDutySaving) return
    setOnDutySaving(true)
    try {
      const res = await updateOnDutyStatus(!onDuty)
      setUser({ ...user, on_duty: res.on_duty })
    } finally {
      setOnDutySaving(false)
    }
  }

  const { data: buildings = [] } = useQuery<Building[]>({
    queryKey: ['buildings'],
    queryFn: getBuildings,
    staleTime: 5 * 60 * 1000,
    enabled: open,
  })

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center">
      {/* Backdrop — pure dim, no blur (lets panel glass show app content) */}
      <div
        className="absolute inset-0"
        onClick={onClose}
        style={{ background: 'rgba(0,0,0,0.22)' }}
      />

      {/* Glass panel */}
      <div
        className="relative w-[460px] overflow-hidden modal-pop-in"
        style={{
          background: 'rgba(255,255,255,0.82)',
          backdropFilter: 'blur(48px) saturate(200%)',
          WebkitBackdropFilter: 'blur(48px) saturate(200%)',
          border: '1px solid rgba(255,255,255,0.90)',
          borderRadius: 24,
          boxShadow: '0 32px 72px rgba(0,0,0,0.16), 0 8px 24px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,1)',
        }}
        /* dark mode override via CSS class */
        data-dark=""
      >
        <style>{`
          .dark [data-dark] {
            background: rgba(18,21,35,0.88) !important;
            border-color: rgba(255,255,255,0.07) !important;
            box-shadow: 0 32px 72px rgba(0,0,0,0.55), 0 8px 24px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05) !important;
          }
          .dark [data-dark] [data-pill-track] {
            background: rgba(255,255,255,0.06) !important;
          }
          .dark [data-dark] [data-pill-thumb] {
            background: rgba(255,255,255,0.12) !important;
            box-shadow: 0 1px 3px rgba(0,0,0,0.4) !important;
          }
        `}</style>

        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-5"
          style={{ borderBottom: '1px solid rgba(0,0,0,0.06)' }}
        >
          <div className="flex items-center gap-3">
            <div
              className="size-9 rounded-xl flex items-center justify-center"
              style={{ background: 'rgba(0,0,0,0.06)' }}
            >
              <span className="material-symbols-outlined text-base" style={{ color: '#adee2b', WebkitTextStroke: '0.5px rgba(0,0,0,0.3)' }}>settings</span>
            </div>
            <div>
              <p className="text-[14px] font-black" style={{ color: 'var(--ds-text-1)' }}>{t('settings_title')}</p>
              <p className="text-[9px] font-bold uppercase tracking-widest" style={{ color: 'var(--ds-text-3)' }}>{t('settings_subtitle')}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="size-8 rounded-full flex items-center justify-center transition-all hover:scale-110 active:scale-95"
            style={{ background: 'rgba(0,0,0,0.07)', color: 'var(--ds-text-2)' }}
          >
            <span className="material-symbols-outlined text-sm">close</span>
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-5">

          {/* Schedule View */}
          <SettingRow label={t('settings_default_view')}>
            <SegmentedPill<ViewPref>
              value={defaultView}
              onChange={setDefaultView}
              options={[
                { value: 'day',   label: t('view_day') },
                { value: 'week',  label: t('view_week') },
                { value: 'month', label: t('view_month') },
              ]}
            />
          </SettingRow>

          {/* Booking Type + Week Start — side by side */}
          <div className="grid grid-cols-2 gap-4">
            <SettingRow label={t('settings_default_type')}>
              <SegmentedPill<TypePref>
                value={defaultType}
                onChange={setDefaultType}
                options={[
                  { value: 'internal', label: t('type_internal') },
                  { value: 'external', label: t('type_external') },
                ]}
              />
            </SettingRow>

            <SettingRow label={t('settings_start_day')}>
              <SegmentedPill<StartDayPref>
                value={startDay}
                onChange={setStartDay}
                options={[
                  { value: 'mon', label: t('day_monday') },
                  { value: 'sun', label: t('day_sunday') },
                ]}
              />
            </SettingRow>
          </div>

          {/* Default Building */}
          {buildings.length > 0 && (
            <SettingRow label={t('settings_default_building')}>
              <BuildingDropdown
                buildings={buildings}
                value={defaultBuilding}
                onChange={setDefaultBuilding}
                autoLabel={t('settings_default_building_auto')}
              />
            </SettingRow>
          )}

          {/* Show title on booking bar */}
          <SettingRow label={t('settings_show_bar_title')}>
            <button
              onClick={() => setShowBarTitle(!showBarTitle)}
              className="w-full flex items-center justify-between px-4 py-3 rounded-[14px] transition-all active:scale-[0.99]"
              style={{ background: 'rgba(0,0,0,0.05)' }}
            >
              <div className="flex items-center gap-3">
                <div
                  className="size-8 rounded-xl flex items-center justify-center transition-all duration-300"
                  style={{ background: showBarTitle ? '#adee2b' : 'rgba(0,0,0,0.08)' }}
                >
                  <span
                    className="material-symbols-outlined transition-all duration-300"
                    style={{ fontSize: 17, color: showBarTitle ? '#000' : 'var(--ds-text-2)' }}
                  >
                    title
                  </span>
                </div>
                <p className="text-[12px] font-black" style={{ color: 'var(--ds-text-1)' }}>
                  {showBarTitle ? 'Title visible' : 'Title hidden'}
                </p>
              </div>
              <div
                className="relative shrink-0"
                style={{
                  width: 42, height: 23, borderRadius: 12,
                  background: showBarTitle ? '#adee2b' : 'rgba(0,0,0,0.18)',
                  transition: 'background 0.25s ease',
                }}
              >
                <div style={{
                  position: 'absolute', top: 2.5, width: 18, height: 18,
                  borderRadius: '50%', background: showBarTitle ? '#000' : 'white',
                  boxShadow: '0 1px 4px rgba(0,0,0,0.25)',
                  left: showBarTitle ? 21 : 2.5,
                  transition: 'left 0.22s cubic-bezier(0.4,0,0.2,1)',
                }} />
              </div>
            </button>
          </SettingRow>

          {/* Show keyboard shortcuts FAB */}
          <SettingRow label={t('settings_show_keyboard_shortcuts')}>
            <button
              onClick={() => setShowKeyboardShortcuts(!showKeyboardShortcuts)}
              className="w-full flex items-center justify-between px-4 py-3 rounded-[14px] transition-all active:scale-[0.99]"
              style={{ background: 'rgba(0,0,0,0.05)' }}
            >
              <div className="flex items-center gap-3">
                <div
                  className="size-8 rounded-xl flex items-center justify-center transition-all duration-300"
                  style={{ background: showKeyboardShortcuts ? '#adee2b' : 'rgba(0,0,0,0.08)' }}
                >
                  <span
                    className="material-symbols-outlined transition-all duration-300"
                    style={{ fontSize: 17, color: showKeyboardShortcuts ? '#000' : 'var(--ds-text-2)' }}
                  >
                    keyboard
                  </span>
                </div>
                <p className="text-[12px] font-black" style={{ color: 'var(--ds-text-1)' }}>
                  {showKeyboardShortcuts ? 'Button visible' : 'Button hidden'}
                </p>
              </div>
              <div
                className="relative shrink-0"
                style={{
                  width: 42, height: 23, borderRadius: 12,
                  background: showKeyboardShortcuts ? '#adee2b' : 'rgba(0,0,0,0.18)',
                  transition: 'background 0.25s ease',
                }}
              >
                <div style={{
                  position: 'absolute', top: 2.5, width: 18, height: 18,
                  borderRadius: '50%', background: showKeyboardShortcuts ? '#000' : 'white',
                  boxShadow: '0 1px 4px rgba(0,0,0,0.25)',
                  left: showKeyboardShortcuts ? 21 : 2.5,
                  transition: 'left 0.22s cubic-bezier(0.4,0,0.2,1)',
                }} />
              </div>
            </button>
          </SettingRow>

          {/* Language */}
          <SettingRow label={t('settings_language')}>
            <SegmentedPill<LangPref>
              value={language}
              onChange={setLanguage}
              options={[
                { value: 'en', label: 'English' },
                { value: 'id', label: 'Bahasa Indonesia' },
              ]}
            />
          </SettingRow>

          {/* On Duty Status — receptionist only */}
          {isReceptionist && (
            <SettingRow label="On Duty Status">
              <button
                onClick={toggleOnDuty}
                disabled={onDutySaving}
                className="w-full flex items-center justify-between px-4 py-3 rounded-[14px] transition-all active:scale-[0.99] disabled:opacity-60"
                style={{ background: 'rgba(0,0,0,0.05)' }}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="size-8 rounded-xl flex items-center justify-center transition-all duration-300"
                    style={{ background: onDuty ? '#adee2b' : 'rgba(0,0,0,0.08)' }}
                  >
                    {onDutySaving
                      ? <span className="material-symbols-outlined animate-spin" style={{ fontSize: 17, color: 'var(--ds-text-2)' }}>progress_activity</span>
                      : <span className="material-symbols-outlined transition-all duration-300" style={{ fontSize: 17, color: onDuty ? '#000' : 'var(--ds-text-2)' }}>
                          {onDuty ? 'badge' : 'no_accounts'}
                        </span>
                    }
                  </div>
                  <div className="text-left">
                    <p className="text-[12px] font-black" style={{ color: 'var(--ds-text-1)' }}>
                      {onDuty ? 'On Duty' : 'Off Duty'}
                    </p>
                    <p className="text-[9px] font-bold" style={{ color: 'var(--ds-text-3)' }}>
                      {onDuty ? 'Visible in Contact Receptionist' : 'Hidden from Contact Receptionist'}
                    </p>
                  </div>
                </div>
                <div
                  className="relative shrink-0"
                  style={{
                    width: 42, height: 23, borderRadius: 12,
                    background: onDuty ? '#adee2b' : 'rgba(0,0,0,0.18)',
                    transition: 'background 0.25s ease',
                  }}
                >
                  <div style={{
                    position: 'absolute', top: 2.5, width: 18, height: 18,
                    borderRadius: '50%', background: onDuty ? '#000' : 'white',
                    boxShadow: '0 1px 4px rgba(0,0,0,0.25)',
                    left: onDuty ? 21 : 2.5,
                    transition: 'left 0.22s cubic-bezier(0.4,0,0.2,1)',
                  }} />
                </div>
              </button>
            </SettingRow>
          )}

          {/* Dark mode row */}
          <SettingRow label={t('settings_appearance')}>
            <button
              onClick={() => setDarkMode(!darkMode)}
              className="w-full flex items-center justify-between px-4 py-3 rounded-[14px] transition-all active:scale-[0.99]"
              style={{ background: 'rgba(0,0,0,0.05)' }}
            >
              <div className="flex items-center gap-3">
                <div
                  className="size-8 rounded-xl flex items-center justify-center transition-all duration-300"
                  style={{ background: darkMode ? '#adee2b' : 'rgba(0,0,0,0.08)' }}
                >
                  <span
                    className="material-symbols-outlined transition-all duration-300"
                    style={{ fontSize: 17, color: darkMode ? '#000' : 'var(--ds-text-2)' }}
                  >
                    {darkMode ? 'dark_mode' : 'light_mode'}
                  </span>
                </div>
                <p className="text-[12px] font-black" style={{ color: 'var(--ds-text-1)' }}>
                  {darkMode ? t('settings_dark_mode') : t('settings_light_mode')}
                </p>
              </div>

              {/* Toggle */}
              <div
                className="relative shrink-0"
                style={{
                  width: 42,
                  height: 23,
                  borderRadius: 12,
                  background: darkMode ? '#adee2b' : 'rgba(0,0,0,0.18)',
                  transition: 'background 0.25s ease',
                }}
              >
                <div
                  style={{
                    position: 'absolute',
                    top: 2.5,
                    width: 18,
                    height: 18,
                    borderRadius: '50%',
                    background: darkMode ? '#000' : 'white',
                    boxShadow: '0 1px 4px rgba(0,0,0,0.25)',
                    left: darkMode ? 21 : 2.5,
                    transition: 'left 0.22s cubic-bezier(0.4,0,0.2,1)',
                  }}
                />
              </div>
            </button>
          </SettingRow>

        </div>

        {/* Footer */}
        <div
          className="px-6 py-3"
          style={{ borderTop: '1px solid rgba(0,0,0,0.05)' }}
        >
          <p className="text-center text-[9px] font-bold uppercase tracking-wider" style={{ color: 'var(--ds-text-4)' }}>
            {t('settings_browser_note')}
          </p>
        </div>
      </div>
    </div>
  )
}
