import { useQuery } from '@tanstack/react-query'
import { useSettings } from '../../context/SettingsContext'
import { getGeneralSettings, getCachedBranding } from '../../api/settings'
import { useModalHotkeys } from '../../hooks/useModalHotkeys'

interface Props {
  open: boolean
  onClose: () => void
}

const APP_VERSION = '1.0.0'
const GITHUB_URL = 'https://github.com/your-org/mrbs-v1'

const OSS_LICENSES = [
  { name: 'Laravel Framework', license: 'MIT', url: 'https://github.com/laravel/framework/blob/master/LICENSE.md' },
  { name: 'Laravel Reverb', license: 'MIT', url: 'https://github.com/laravel/reverb/blob/master/LICENSE.md' },
  { name: 'Laravel Sanctum', license: 'MIT', url: 'https://github.com/laravel/sanctum/blob/master/LICENSE.md' },
  { name: 'PhpSpreadsheet', license: 'MIT', url: 'https://github.com/PHPOffice/PhpSpreadsheet/blob/master/LICENSE' },
  { name: 'laravel-dompdf', license: 'MIT', url: 'https://github.com/barryvdh/laravel-dompdf/blob/master/LICENSE' },
  { name: 'React', license: 'MIT', url: 'https://github.com/facebook/react/blob/main/LICENSE' },
  { name: 'React Router', license: 'MIT', url: 'https://github.com/remix-run/react-router/blob/main/LICENSE.md' },
  { name: 'TanStack Query', license: 'MIT', url: 'https://github.com/TanStack/query/blob/main/LICENSE' },
  { name: 'Vite', license: 'MIT', url: 'https://github.com/vitejs/vite/blob/main/LICENSE' },
  { name: 'Tailwind CSS', license: 'MIT', url: 'https://github.com/tailwindlabs/tailwindcss/blob/main/LICENSE' },
  { name: 'Axios', license: 'MIT', url: 'https://github.com/axios/axios/blob/v1.x/LICENSE' },
  { name: 'ExcelJS', license: 'MIT', url: 'https://github.com/exceljs/exceljs/blob/master/LICENSE' },
  { name: 'jsPDF', license: 'MIT', url: 'https://github.com/parallax/jsPDF/blob/master/LICENSE' },
  { name: 'SheetJS (xlsx)', license: 'Apache-2.0', url: 'https://www.apache.org/licenses/LICENSE-2.0' },
  { name: 'Nivo', license: 'MIT', url: 'https://github.com/plouc/nivo/blob/master/LICENSE.md' },
  { name: 'Laravel Echo', license: 'MIT', url: 'https://github.com/laravel/echo/blob/master/LICENSE.md' },
  { name: 'Pusher JS', license: 'MIT', url: 'https://github.com/pusher/pusher-js/blob/master/LICENSE.md' },
  { name: 'Material Symbols', license: 'Apache-2.0', url: 'https://github.com/google/material-design-icons/blob/master/LICENSE' },
]

export default function AboutModal({ open, onClose }: Props) {
  const { language } = useSettings()
  const id = language === 'id'
  const { data: general } = useQuery({ queryKey: ['settings-general'], queryFn: getGeneralSettings })
  const branding = getCachedBranding()
  const appName = general?.app_name ?? branding.app_name ?? 'RoomSync Pro'
  const appFullName = general?.app_full_name ?? branding.app_full_name ?? ''
  const logoUrl = general?.app_logo_url ?? branding.app_logo_url

  useModalHotkeys(open, undefined, onClose)

  if (!open) return null

  const links = [
    { icon: 'code', label: 'GitHub Repository', href: GITHUB_URL },
  ]

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div
        className="relative flex flex-col rounded-3xl shadow-2xl w-full max-w-[420px] overflow-y-auto"
        style={{ background: 'var(--ds-bg-surface)', border: '1px solid var(--ds-border-sub)', maxHeight: '86vh' }}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 size-8 rounded-full flex items-center justify-center transition-colors hover:bg-[var(--ds-bg-raised)] z-10"
          style={{ color: 'var(--ds-text-3)', background: 'var(--ds-bg-surface)' }}
        >
          <span className="material-symbols-outlined text-base">close</span>
        </button>

        <div className="flex flex-col items-center text-center px-8 pt-9 pb-6">
          {logoUrl ? (
            <img src={logoUrl} alt={appName} className="h-14 w-14 object-contain mb-4" />
          ) : (
            <div className="size-14 rounded-2xl flex items-center justify-center mb-4" style={{ background: '#0f141e' }}>
              <span className="material-symbols-outlined text-2xl" style={{ color: '#adee2b' }}>info</span>
            </div>
          )}
          <p className="text-[17px] font-black" style={{ color: 'var(--ds-text-1)' }}>{appName}</p>
          {appFullName && (
            <p className="text-[11px] font-bold mt-0.5" style={{ color: 'var(--ds-text-3)' }}>{appFullName}</p>
          )}
          <span className="mt-2.5 text-[9px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full" style={{ background: 'rgba(173,238,43,0.12)', color: '#4d7c00' }}>
            {id ? 'Versi' : 'Version'} {APP_VERSION}
          </span>
          <p className="text-[12px] leading-relaxed font-medium mt-4" style={{ color: 'var(--ds-text-2)' }}>
            {id
              ? 'Sistem pemesanan ruang rapat internal — booking realtime dengan tampilan harian, mingguan, dan bulanan.'
              : 'Internal meeting room booking system — realtime booking with daily, weekly, and monthly views.'}
          </p>
        </div>

        <div className="px-4 pb-4 space-y-1.5">
          {links.map(l => (
            <a
              key={l.label}
              href={l.href}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full flex items-center gap-2.5 px-4 py-2.5 rounded-xl transition-colors hover:bg-[var(--ds-bg-raised)] text-[11px] font-black"
              style={{ color: 'var(--ds-text-2)' }}
            >
              <span className="material-symbols-outlined text-base" style={{ color: 'var(--ds-text-3)' }}>{l.icon}</span>
              {l.label}
              <span className="material-symbols-outlined text-sm ml-auto" style={{ color: 'var(--ds-text-4)' }}>open_in_new</span>
            </a>
          ))}
        </div>

        <div className="px-4 pb-4">
          <p className="px-2 pb-2 text-[9px] font-black uppercase tracking-widest" style={{ color: 'var(--ds-text-4)' }}>
            {id ? 'Lisensi Pihak Ketiga' : 'Third-Party Licenses'}
          </p>
          <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--ds-border-sub)' }}>
            <div className="max-h-52 overflow-y-auto divide-y" style={{ borderColor: 'var(--ds-border-sub)' }}>
              {OSS_LICENSES.map(lib => (
                <a
                  key={lib.name}
                  href={lib.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between gap-2 px-3.5 py-2 transition-colors hover:bg-[var(--ds-bg-raised)]"
                  style={{ borderColor: 'var(--ds-border-sub)' }}
                >
                  <span className="text-[11px] font-bold" style={{ color: 'var(--ds-text-2)' }}>{lib.name}</span>
                  <span className="flex items-center gap-1.5 shrink-0">
                    <span className="text-[8px] font-black uppercase tracking-wide px-1.5 py-0.5 rounded" style={{ background: 'var(--ds-bg-raised)', color: 'var(--ds-text-3)' }}>
                      {lib.license}
                    </span>
                    <span className="material-symbols-outlined text-xs" style={{ color: 'var(--ds-text-4)' }}>open_in_new</span>
                  </span>
                </a>
              ))}
            </div>
          </div>
        </div>

        <div className="pb-5 text-center">
          <p className="text-[9px] font-bold uppercase tracking-widest" style={{ color: 'var(--ds-text-4)' }}>
            &copy; {new Date().getFullYear()} {appName}
          </p>
        </div>
      </div>
    </div>
  )
}
