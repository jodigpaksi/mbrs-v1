import { useSettings, type ViewPref, type TypePref, type LangPref, type StartDayPref } from '../../context/SettingsContext'

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
    t,
  } = useSettings()

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center">
      <style>{`
        @keyframes sm-in {
          from { opacity: 0; transform: scale(0.95) translateY(10px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>

      {/* Backdrop — pure dim, no blur (lets panel glass show app content) */}
      <div
        className="absolute inset-0"
        onClick={onClose}
        style={{ background: 'rgba(0,0,0,0.22)' }}
      />

      {/* Glass panel */}
      <div
        className="relative w-[460px] overflow-hidden"
        style={{
          background: 'rgba(255,255,255,0.82)',
          backdropFilter: 'blur(48px) saturate(200%)',
          WebkitBackdropFilter: 'blur(48px) saturate(200%)',
          border: '1px solid rgba(255,255,255,0.90)',
          borderRadius: 24,
          boxShadow: '0 32px 72px rgba(0,0,0,0.16), 0 8px 24px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,1)',
          animation: 'sm-in 0.22s cubic-bezier(0.34,1.04,0.64,1) both',
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
