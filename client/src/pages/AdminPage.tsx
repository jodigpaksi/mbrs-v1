import { useState, useMemo, useRef, useEffect } from 'react'
import { ResponsiveLine } from '@nivo/line'
import { ResponsivePie } from '@nivo/pie'
import { ResponsiveBar } from '@nivo/bar'
import { getAnalyticsOverview, downloadAnalyticsExport } from '../api/analytics'
import type { SectionPeriod } from '../api/analytics'
import { useModalHotkeys } from '../hooks/useModalHotkeys'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getBuildings } from '../api/buildings'
import { getGeneralSettings, updateGeneralSettings } from '../api/settings'
import WifiLoader from '../components/ui/WifiLoader'
import { useAuth } from '../context/AuthContext'
import KioskTab from '../components/admin/KioskTab'
import ActivityLogTab from '../components/admin/ActivityLogTab'
import { ModalPortal, InfoTooltip } from '../components/admin/shared'
import BuildingsTab from '../components/admin/buildings/BuildingsTab'
import UsersTab from '../components/admin/users/UsersTab'
import ArchiveTab from '../components/admin/ArchiveTab'
import SettingsTab from '../components/admin/SettingsTab'
import SensorTab from '../components/admin/SensorTab'
import DisputesTab from '../components/admin/DisputesTab'

type Tab = 'overview' | 'users' | 'buildings' | 'settings' | 'archive' | 'kiosk' | 'sensor' | 'activity' | 'disputes'

function StatCard({ label, value, sub, dark, period, onPeriodChange }: {
  label: string; value: string; sub: string; dark?: boolean
  period?: 'month' | 'all'; onPeriodChange?: (p: 'month' | 'all') => void
}) {
  return (
    <div className={`p-5 rounded-2xl ${dark ? 'bg-black' : 'bg-[var(--ds-bg-surface)] border border-[var(--ds-border-sub)]'}`}>
      <div className="flex items-center justify-between gap-2">
        <p className={`text-[8px] font-black uppercase tracking-widest ${dark ? 'text-slate-500' : 'text-[var(--ds-text-3)]'}`}>{label}</p>
        {period && onPeriodChange && (
          <div className="relative flex p-0.5 rounded-lg shrink-0" style={{ background: dark ? 'rgba(255,255,255,0.08)' : 'var(--ds-bg-raised)' }}>
            <div className="absolute top-0.5 bottom-0.5 rounded-[5px] pointer-events-none transition-transform duration-200 ease-out"
              style={{ width: 'calc(50% - 2px)', left: 2, background: dark ? 'rgba(255,255,255,0.14)' : 'var(--ds-bg-surface)', transform: period === 'all' ? 'translateX(100%)' : 'translateX(0)', boxShadow: dark ? 'none' : '0 1px 2px rgba(0,0,0,0.08)' }} />
            {(['month', 'all'] as const).map(p => (
              <button key={p} type="button" onClick={() => onPeriodChange(p)}
                className="relative z-10 px-1.5 py-0.5 rounded-[5px] text-[7px] font-black uppercase tracking-wide transition-colors"
                style={{ color: period === p ? (dark ? '#fff' : 'var(--ds-text-1)') : (dark ? 'rgba(255,255,255,0.4)' : 'var(--ds-text-4)') }}>
                {p === 'month' ? 'Month' : 'All'}
              </button>
            ))}
          </div>
        )}
      </div>
      <p className={`text-4xl font-black italic mt-1 ${dark ? 'text-[#adee2b]' : 'text-[var(--ds-text-1)]'}`}>{value}</p>
      <p className={`text-[9px] font-bold mt-0.5 ${dark ? 'text-slate-500' : 'text-[var(--ds-text-3)]'}`}>{sub}</p>
    </div>
  )
}

export default function AdminPage() {
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'
  const isBuildingAdmin = user?.role === 'building_admin'
  const [tab, setTab] = useState<Tab>(isBuildingAdmin ? 'buildings' : 'overview')
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  // Read anti_ghost_enabled to gate Disputes tab visibility
  const { data: rootSettings } = useQuery({
    queryKey: ['settings-general'],
    queryFn: getGeneralSettings,
    staleTime: 5 * 60_000,
  })
  const antiGhostActive = rootSettings?.anti_ghost_enabled ?? false

  // If anti-ghost gets disabled while on Disputes tab, bounce back to overview
  useEffect(() => {
    if (!antiGhostActive && tab === 'disputes') setTab('overview')
  }, [antiGhostActive, tab])

  // Overview
  const [overviewPeriod, setOverviewPeriod]   = useState<7 | 30 | 'all'>(7)
  const [totalBookingsPeriod, setTotalBookingsPeriod] = useState<'month' | 'all'>('all')
  const [confirmedPeriod, setConfirmedPeriod]         = useState<'month' | 'all'>('all')
  const [statusPeriod, setStatusPeriod]       = useState<SectionPeriod>('month')
  const [roomsPeriod, setRoomsPeriod]         = useState<SectionPeriod>('month')
  const [hoursPeriod, setHoursPeriod]         = useState<SectionPeriod>('month')
  const [overviewBuilding, setOverviewBuilding] = useState<number | null>(null)
  const [storageLimitMb, setStorageLimitMb] = useState(5120)
  const [storageLimitRaw, setStorageLimitRaw] = useState('5120')
  const [storageLimitOpen, setStorageLimitOpen] = useState(false)
  const [exportModal, setExportModal]         = useState(false)
  const [exportMonth, setExportMonth]         = useState(() => new Date().toISOString().slice(0, 7))
  const [exportAllTime, setExportAllTime]     = useState(false)
  const [exportBuildingIds, setExportBuildingIds] = useState<number[]>([])
  const [exporting, setExporting]             = useState(false)
  const [chartSettingsOpen, setChartSettingsOpen] = useState(false)

  const { data: overviewBuildingsList = [] } = useQuery({
    queryKey: ['buildings'],
    queryFn: getBuildings,
    staleTime: 300_000,
    enabled: tab === 'overview',
  })

  const { data: chartGeneral } = useQuery({ queryKey: ['settings-general'], queryFn: getGeneralSettings, staleTime: 60_000 })
  const parsedChartColors = useMemo(() => { try { return JSON.parse(chartGeneral?.chart_colors ?? '{}') } catch { return {} } }, [chartGeneral?.chart_colors])
  const cc = {
    trend:     (parsedChartColors.trend     ?? '#6366f1') as string,
    confirmed: (parsedChartColors.confirmed ?? '#adee2b') as string,
    tentative: (parsedChartColors.tentative ?? '#f59e0b') as string,
    cancelled: (parsedChartColors.cancelled ?? '#ef4444') as string,
    rooms:     (parsedChartColors.rooms     ?? '#6366f1') as string,
    hours:     (parsedChartColors.hours     ?? '#adee2b') as string,
  }
  const peakFrom = chartGeneral?.chart_peak_hour_from ?? 0
  const peakTo   = chartGeneral?.chart_peak_hour_to   ?? 23

  const { data: overviewData, isLoading: overviewLoading } = useQuery({
    queryKey: ['analytics-overview', overviewPeriod, statusPeriod, roomsPeriod, hoursPeriod, overviewBuilding],
    queryFn: () => getAnalyticsOverview(overviewPeriod, statusPeriod, roomsPeriod, hoursPeriod, overviewBuilding),
    staleTime: 60_000,
    enabled: tab === 'overview',
  })

  const peakHoursFull = useMemo(() => {
    const map = new Map((overviewData?.peak_hours ?? []).map(h => [h.hour, h.count]))
    return Array.from({ length: 24 }, (_, i) => ({ hour: i, count: map.get(i) ?? 0 }))
      .filter(h => h.hour >= peakFrom && h.hour <= peakTo)
  }, [overviewData?.peak_hours, peakFrom, peakTo])

  const qc = useQueryClient()
  async function saveChartColor(key: string, value: string) {
    const next = { ...parsedChartColors, [key]: value }
    await updateGeneralSettings({ chart_colors: JSON.stringify(next) })
    qc.invalidateQueries({ queryKey: ['settings-general'] })
  }
  async function saveChartPeakHour(from: number, to: number) {
    await updateGeneralSettings({ chart_peak_hour_from: from, chart_peak_hour_to: to })
    qc.invalidateQueries({ queryKey: ['settings-general'] })
  }

  async function handleExport() {
    setExporting(true)
    try {
      const buildingIds = exportBuildingIds.length > 0 ? exportBuildingIds : undefined
      if (exportAllTime) {
        await downloadAnalyticsExport({ building_ids: buildingIds })
      } else {
        const [y, m] = exportMonth.split('-').map(Number)
        const from = `${exportMonth}-01`
        const lastDay = new Date(y, m, 0).getDate()
        const to = `${exportMonth}-${String(lastDay).padStart(2, '0')}`
        await downloadAnalyticsExport({ from, to, building_ids: buildingIds })
      }
      setExportModal(false)
    } finally { setExporting(false) }
  }

  useModalHotkeys(exportModal, handleExport, () => setExportModal(false))
  useModalHotkeys(chartSettingsOpen, undefined, () => setChartSettingsOpen(false))

  function SectionPill({ value, onChange }: { value: SectionPeriod; onChange: (v: SectionPeriod) => void }) {
    return (
      <div className="flex gap-0.5 p-0.5 rounded-xl" style={{ background: 'var(--ds-bg-raised)' }}>
        {(['month', 'all'] as const).map(p => (
          <button key={p} onClick={() => onChange(p)}
            className="text-[8px] font-black px-2.5 py-1 rounded-[9px] transition-all uppercase tracking-wide"
            style={{ background: value === p ? 'var(--ds-bg-surface)' : 'transparent', color: value === p ? 'var(--ds-text-1)' : 'var(--ds-text-4)', boxShadow: value === p ? '0 1px 3px rgba(0,0,0,0.1)' : 'none' }}>
            {p === 'month' ? 'This Month' : 'All Time'}
          </button>
        ))}
      </div>
    )
  }

  // building_admin gets a reduced, building-scoped menu: Buildings & Rooms, Users (view-only).
  // Everything else (Overview, Archive, Kiosk, Sensor, Settings, Disputes, Activity Log) is admin-only.
  const mainTabs: { key: Tab; label: string; icon: string }[] = isBuildingAdmin
    ? [
        { key: 'buildings', label: 'Buildings', icon: 'domain' },
        { key: 'users',     label: 'Users',     icon: 'group' },
      ]
    : [
        { key: 'overview',   label: 'Overview',   icon: 'dashboard' },
        { key: 'buildings',  label: 'Buildings',  icon: 'domain' },
        { key: 'users',      label: 'Users',      icon: 'group' },
        { key: 'archive',    label: 'Archive',    icon: 'archive' },
        { key: 'kiosk',      label: 'Kiosk',      icon: 'tablet' },
        { key: 'sensor',     label: 'Sensor',     icon: 'sensors' },
        { key: 'activity',   label: 'Activity',   icon: 'history' },
        ...(antiGhostActive ? [{ key: 'disputes' as Tab, label: 'Disputes', icon: 'gavel' }] : []),
      ]
  const settingsTabDef = isAdmin ? { key: 'settings' as Tab, label: 'Settings', icon: 'tune' } : null

  // Sidebar sliding pill
  const sidebarNavRef  = useRef<HTMLDivElement>(null)
  const sidebarBtnRefs = useRef<Record<string, HTMLButtonElement | null>>({})
  const [pillY, setPillY] = useState(0)
  const [pillH, setPillH] = useState(36)
  const [sidebarTooltip, setSidebarTooltip] = useState<{ label: string; y: number } | null>(null)
  useEffect(() => {
    const measure = () => {
      const nav = sidebarNavRef.current
      const btn = sidebarBtnRefs.current[tab]
      if (!nav || !btn) return
      const navRect = nav.getBoundingClientRect()
      const btnRect = btn.getBoundingClientRect()
      setPillY(btnRect.top - navRect.top)
      setPillH(btnRect.height)
    }
    measure()
    const raf = requestAnimationFrame(measure)
    // Re-measure after collapse transition finishes (300ms easing)
    const timer = setTimeout(measure, 320)
    window.addEventListener('resize', measure)
    return () => { cancelAnimationFrame(raf); clearTimeout(timer); window.removeEventListener('resize', measure) }
  }, [tab, sidebarCollapsed])

  return (
    <div className="flex flex-1 overflow-hidden bg-[var(--ds-bg-surface)]">
      <style>{`
        @keyframes admin-tab-in {
          from { opacity: 0; transform: translateY(10px) }
          to   { opacity: 1; transform: translateY(0) }
        }
        .admin-tab-in { animation: admin-tab-in 0.22s cubic-bezier(0.4,0,0.2,1) both }

        @keyframes admin-modal-in {
          from { opacity: 0; transform: translateY(20px) scale(0.96) }
          to   { opacity: 1; transform: translateY(0) scale(1) }
        }
        .admin-modal-in { animation: admin-modal-in 0.25s cubic-bezier(0.34,1.15,0.64,1) both }

        @keyframes admin-backdrop-in {
          from { opacity: 0 }
          to   { opacity: 1 }
        }
        .admin-backdrop-in { animation: admin-backdrop-in 0.18s ease both }

        @keyframes admin-dropdown-in {
          from { opacity: 0; transform: translateY(-6px) }
          to   { opacity: 1; transform: translateY(0) }
        }
        .admin-dropdown-in { animation: admin-dropdown-in 0.2s cubic-bezier(0.4,0,0.2,1) both }
      `}</style>
      {/* Sidebar */}
      <div className={`shrink-0 p-3 transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] ${sidebarCollapsed ? 'w-[68px]' : 'w-[196px]'}`}>
        <div className="h-full flex flex-col rounded-3xl py-3 px-2"
          style={{ background: 'rgba(15,20,45,0.92)', border: '1px solid rgba(255,255,255,0.07)', boxShadow: '0 8px 40px rgba(0,0,0,0.18)', transform: 'translateZ(0)', willChange: 'transform' }}>

          {/* Label */}
          <div className={`px-2 mb-2 transition-all duration-200 overflow-hidden ${sidebarCollapsed ? 'h-0 opacity-0 pointer-events-none' : 'h-6 opacity-100'}`}>
            <p className="text-[8px] font-black uppercase tracking-[0.35em] whitespace-nowrap" style={{ color: 'rgba(255,255,255,0.2)' }}>Admin Panel</p>
          </div>

          {/* Nav items — all in one ref container for the sliding pill */}
          <div ref={sidebarNavRef} className="relative flex flex-col gap-0.5 flex-1">
            {/* Sliding pill */}
            <div className="absolute inset-x-1 rounded-2xl pointer-events-none"
              style={{ top: pillY, height: pillH, background: 'rgba(173,238,43,0.12)', border: '1px solid rgba(173,238,43,0.22)', boxShadow: 'inset 0 0 0 1px rgba(173,238,43,0.04)', transition: 'top 0.24s cubic-bezier(0.34,1.3,0.64,1), height 0.24s cubic-bezier(0.34,1.3,0.64,1)' }} />

            {mainTabs.map(t => {
              const active = tab === t.key
              return (
                <div key={t.key}>
                  <button ref={el => { sidebarBtnRefs.current[t.key] = el }} onClick={() => setTab(t.key)}
                    onMouseEnter={sidebarCollapsed ? e => setSidebarTooltip({ label: t.label, y: e.currentTarget.getBoundingClientRect().top + e.currentTarget.getBoundingClientRect().height / 2 }) : undefined}
                    onMouseLeave={sidebarCollapsed ? () => setSidebarTooltip(null) : undefined}
                    className={`w-full flex items-center gap-3 rounded-2xl transition-colors duration-150 overflow-hidden relative
                      ${sidebarCollapsed ? 'justify-center py-3 px-0' : 'px-3 py-2.5'}`}>
                    <span className="material-symbols-outlined shrink-0 transition-colors duration-200" style={{ fontSize: 19, color: active ? '#adee2b' : 'rgba(255,255,255,0.3)' }}>{t.icon}</span>
                    {!sidebarCollapsed && (
                      <span className="text-[10px] font-black uppercase tracking-wide whitespace-nowrap transition-colors duration-200" style={{ color: active ? '#fff' : 'rgba(255,255,255,0.4)' }}>{t.label}</span>
                    )}
                  </button>
                </div>
              )
            })}

            {/* Settings — pinned at bottom */}
            {settingsTabDef && (() => {
              const active = tab === settingsTabDef.key
              return (
                <div className="mt-auto pt-2" style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
                  <button ref={el => { sidebarBtnRefs.current[settingsTabDef.key] = el }} onClick={() => setTab(settingsTabDef.key)}
                    onMouseEnter={sidebarCollapsed ? e => setSidebarTooltip({ label: settingsTabDef.label, y: e.currentTarget.getBoundingClientRect().top + e.currentTarget.getBoundingClientRect().height / 2 }) : undefined}
                    onMouseLeave={sidebarCollapsed ? () => setSidebarTooltip(null) : undefined}
                    className={`w-full flex items-center gap-3 rounded-2xl transition-colors duration-150 overflow-hidden relative
                      ${sidebarCollapsed ? 'justify-center py-3 px-0' : 'px-3 py-2.5'}`}>
                    <span className="material-symbols-outlined shrink-0 transition-colors duration-200" style={{ fontSize: 19, color: active ? '#adee2b' : 'rgba(255,255,255,0.3)' }}>{settingsTabDef.icon}</span>
                    {!sidebarCollapsed && (
                      <span className="text-[10px] font-black uppercase tracking-wide whitespace-nowrap transition-colors duration-200" style={{ color: active ? '#fff' : 'rgba(255,255,255,0.4)' }}>{settingsTabDef.label}</span>
                    )}
                  </button>
                </div>
              )
            })()}
          </div>

          {/* Fixed tooltip portal — outside overflow-hidden containers */}
          {sidebarCollapsed && sidebarTooltip && (
            <ModalPortal>
              <div className="pointer-events-none" style={{ position: 'fixed', left: 76, top: sidebarTooltip.y, transform: 'translateY(-50%)', zIndex: 9999 }}>
                <div className="px-3.5 py-2 rounded-xl whitespace-nowrap"
                  style={{ background: 'rgba(15,20,45,0.96)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 8px 24px rgba(0,0,0,0.3)' }}>
                  <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: '#fff' }}>{sidebarTooltip.label}</span>
                </div>
              </div>
            </ModalPortal>
          )}

          {/* Toggle */}
          <div className="pt-2 mt-2" style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
            <button onClick={() => setSidebarCollapsed(s => !s)}
              className="w-full flex items-center justify-center py-2 rounded-xl transition-all"
              style={{ color: 'rgba(255,255,255,0.2)' }}
              onMouseEnter={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.6)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.2)')}>
              <span className="material-symbols-outlined" style={{ fontSize: 15 }}>
                {sidebarCollapsed ? 'keyboard_double_arrow_right' : 'keyboard_double_arrow_left'}
              </span>
            </button>
          </div>

        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-8" style={{ scrollbarWidth: 'thin', willChange: 'scroll-position' }}>

        {tab === 'overview' && (
          <div className="max-w-5xl space-y-6 admin-tab-in">
            <div className="flex items-end justify-between">
              <div>
                <p className="text-[9px] font-black uppercase tracking-[0.25em] text-[var(--ds-text-3)] mb-1">Admin Dashboard</p>
                <h1 className="text-3xl font-black italic tracking-tighter uppercase">Overview</h1>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => setChartSettingsOpen(true)}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-wide transition-all hover:opacity-80"
                  style={{ background: 'var(--ds-bg-surface)', border: '1px solid var(--ds-border-sub)', color: 'var(--ds-text-2)' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 15 }}>palette</span>Chart
                </button>
                <button onClick={() => setExportModal(true)}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-wide transition-all hover:opacity-80"
                  style={{ background: 'var(--ds-bg-surface)', border: '1px solid var(--ds-border-sub)', color: 'var(--ds-text-2)' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 15 }}>download</span>Export
                </button>
              </div>
            </div>

            {overviewLoading ? (
              <div className="flex items-center justify-center py-20">
                <WifiLoader />
              </div>
            ) : overviewData && (<>
              {/* ── Global stats: Unique Visitors + Storage (no building filter) ── */}
              <div className="grid grid-cols-2 gap-4">
                {/* Unique visitors */}
                <div className="rounded-2xl border border-[var(--ds-border-sub)] p-5"
                  style={{ background: 'var(--ds-bg-surface)' }}>
                  <div className="flex items-center gap-2 mb-4">
                    <div className="size-8 rounded-xl flex items-center justify-center" style={{ background: 'rgba(99,102,241,0.1)' }}>
                      <span className="material-symbols-outlined" style={{ fontSize: 16, color: '#6366f1', fontVariationSettings: "'FILL' 1" }}>group</span>
                    </div>
                    <div>
                      <p className="text-[9px] font-black uppercase tracking-[0.18em] text-[var(--ds-text-3)]">Unique Visitors</p>
                      <p className="text-[10px] font-bold text-[var(--ds-text-4)]">Active users by period — all buildings</p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {(() => {
                      const fmtShortDate = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
                      const st = overviewData.stats
                      const items = [
                        { label: 'Today', val: st.unique_visitors_today, range: fmtShortDate(st.unique_visitors_today_date) },
                        { label: 'This Week', val: st.unique_visitors_week, range: `${fmtShortDate(st.unique_visitors_week_start)} – ${fmtShortDate(st.unique_visitors_week_end)}` },
                        { label: 'This Month', val: st.unique_visitors_month, range: `${fmtShortDate(st.unique_visitors_month_start)} – ${fmtShortDate(st.unique_visitors_month_end)}` },
                        { label: 'All Time', val: st.unique_visitors_all ?? 0, range: st.unique_visitors_all_since ? `Since ${fmtShortDate(st.unique_visitors_all_since)}` : 'No activity recorded yet' },
                      ] as const
                      return items.map(item => (
                        <div key={item.label} className="flex items-center justify-between px-3 py-2.5 rounded-xl" style={{ background: 'var(--ds-bg-raised)' }}>
                          <span className="flex items-center gap-1.5 text-[11px] font-bold text-[var(--ds-text-3)]">
                            {item.label}
                            <InfoTooltip text={item.range} width={180} />
                          </span>
                          <span className="text-[15px] font-black text-[var(--ds-text-1)] tabular-nums">{item.val.toLocaleString()}</span>
                        </div>
                      ))
                    })()}
                  </div>
                </div>

                {/* Storage */}
                {overviewData.stats.storage && (() => {
                  const s = overviewData.stats.storage
                  const fmtMb = (mb: number) => mb >= 1024 ? `${(mb / 1024).toFixed(2)} GB` : `${mb.toFixed(2)} MB`
                  const totalMb = s.db_mb + s.uploads_mb + (s.logs_mb ?? 0)
                  const usedPct = storageLimitMb > 0 ? Math.min(100, (totalMb / storageLimitMb) * 100) : 0
                  const isWarn = usedPct >= 70 && usedPct < 90
                  const isCrit = usedPct >= 90
                  const totalBarColor = isCrit ? '#ef4444' : isWarn ? '#f59e0b' : '#adee2b'
                  const bars = [
                    { label: 'Database',      mb: s.db_mb,             color: '#6366f1' },
                    { label: 'Room Photos',   mb: s.room_photos_mb,    color: '#3b82f6' },
                    { label: 'Avatars',       mb: s.avatars_mb,        color: '#a855f7' },
                    { label: 'App Logo',      mb: s.logo_mb ?? 0,      color: '#14b8a6' },
                    { label: 'Login Photo',   mb: s.login_photo_mb ?? 0, color: '#ec4899' },
                    { label: 'Other Uploads', mb: s.other_uploads_mb ?? 0, color: '#94a3b8' },
                    { label: 'Activity Log',  mb: s.logs_mb ?? 0,      color: '#f59e0b' },
                  ]
                  return (
                    <div className="rounded-2xl border border-[var(--ds-border-sub)] p-5"
                      style={{ background: 'var(--ds-bg-surface)' }}>
                      {/* Header */}
                      <div className="flex items-center gap-2 mb-3">
                        <div className="size-8 rounded-xl flex items-center justify-center" style={{ background: 'rgba(239,68,68,0.1)' }}>
                          <span className="material-symbols-outlined" style={{ fontSize: 16, color: '#ef4444', fontVariationSettings: "'FILL' 1" }}>database</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[9px] font-black uppercase tracking-[0.18em] text-[var(--ds-text-3)]">Storage Usage</p>
                          <p className="text-[10px] font-bold text-[var(--ds-text-4)]">Total uploads: {fmtMb(s.uploads_mb)} · DB: {fmtMb(s.db_mb)}</p>
                        </div>
                      </div>

                      {/* Total vs limit bar */}
                      <div className="mb-4 p-3 rounded-xl border" style={{ borderColor: 'var(--ds-border-sub)' }}>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-[10px] font-black text-[var(--ds-text-2)]">
                            {fmtMb(totalMb)}
                            <span className="text-[var(--ds-text-4)] font-bold"> / {fmtMb(storageLimitMb)}</span>
                          </span>
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] font-black tabular-nums" style={{ color: totalBarColor }}>
                              {usedPct.toFixed(1)}%
                            </span>
                            {/* (i) tooltip */}
                            <div className="relative group">
                              <button type="button" className="size-4 rounded-full flex items-center justify-center text-[9px] font-black leading-none border transition-colors"
                                style={{ borderColor: 'var(--ds-border)', color: 'var(--ds-text-4)', background: 'var(--ds-bg-surface-2)' }}>
                                i
                              </button>
                              <div className="absolute right-0 top-5 z-50 w-52 p-2.5 rounded-xl shadow-xl pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-150 text-[10px] font-medium leading-relaxed"
                                style={{ background: 'rgba(15,20,45,0.92)', backdropFilter: 'blur(12px)', color: 'rgba(255,255,255,0.75)', border: '1px solid rgba(255,255,255,0.08)' }}>
                                This limit only affects the chart display. It has no effect on actual folder size or server storage capacity.
                              </div>
                            </div>
                            {/* Settings toggle */}
                            <button type="button"
                              onClick={() => setStorageLimitOpen(o => !o)}
                              className="size-5 rounded-lg flex items-center justify-center transition-colors"
                              style={{ background: storageLimitOpen ? '#adee2b' : 'var(--ds-bg-surface-2)', color: storageLimitOpen ? '#000' : 'var(--ds-text-4)' }}>
                              <span className="material-symbols-outlined" style={{ fontSize: 12 }}>tune</span>
                            </button>
                          </div>
                        </div>
                        <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--ds-bg-surface-2)' }}>
                          <div className="h-full rounded-full transition-all duration-700"
                            style={{ width: `${Math.max(2, usedPct)}%`, background: totalBarColor }} />
                        </div>

                        {/* Accordion: limit settings */}
                        {storageLimitOpen && (
                          <div className="mt-3 pt-3 border-t flex items-center gap-1.5 flex-wrap" style={{ borderColor: 'var(--ds-border-sub)' }}>
                            <span className="text-[9px] font-black uppercase tracking-wider text-[var(--ds-text-4)]">Limit</span>
                            <input
                              type="text"
                              inputMode="numeric"
                              value={storageLimitRaw}
                              onChange={e => {
                                const raw = e.target.value.replace(/\D/g, '')
                                setStorageLimitRaw(raw)
                                const v = parseInt(raw)
                                if (!isNaN(v) && v > 0) setStorageLimitMb(v)
                              }}
                              onBlur={e => {
                                const v = parseInt(e.target.value)
                                const clamped = isNaN(v) || v <= 0 ? 5120 : v
                                setStorageLimitMb(clamped)
                                setStorageLimitRaw(String(clamped))
                              }}
                              className="w-20 text-[10px] font-black text-center tabular-nums bg-transparent border-b focus:outline-none transition-colors"
                              style={{ borderColor: 'var(--ds-border)', caretColor: '#adee2b' }}
                              onFocus={e => { e.target.style.borderColor = '#adee2b'; e.target.select() }}
                              onBlurCapture={e => { e.target.style.borderColor = 'var(--ds-border)' }}
                            />
                            <span className="text-[9px] font-bold text-[var(--ds-text-4)]">MB</span>
                            {[1024, 5120, 10240, 20480].map(preset => (
                              <button key={preset} type="button"
                                onClick={() => { setStorageLimitMb(preset); setStorageLimitRaw(String(preset)) }}
                                className="text-[8px] font-black uppercase px-1.5 py-0.5 rounded-md transition-colors"
                                style={{
                                  background: storageLimitMb === preset ? '#adee2b' : 'var(--ds-bg-surface-2)',
                                  color: storageLimitMb === preset ? '#000' : 'var(--ds-text-4)',
                                }}>
                                {preset >= 1024 ? `${preset / 1024}G` : `${preset}M`}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Per-segment bars (relative to limit) */}
                      <div className="space-y-2.5">
                        {bars.map(b => {
                          const pct = storageLimitMb > 0 ? Math.min(100, (b.mb / storageLimitMb) * 100) : 0
                          return (
                            <div key={b.label}>
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-[10px] font-bold text-[var(--ds-text-2)]">{b.label}</span>
                                <span className="text-[10px] font-black text-[var(--ds-text-1)]">{fmtMb(b.mb)}</span>
                              </div>
                              <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--ds-bg-raised)' }}>
                                <div className="h-full rounded-full transition-all duration-700"
                                  style={{ width: `${Math.max(pct > 0 ? 2 : 0, pct)}%`, background: b.color }} />
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })()}
              </div>

              {/* ── Divider ── */}
              <div className="border-t border-[var(--ds-border-sub)]" />

              {/* ── Building filter toggle ── */}
              {overviewBuildingsList.length > 0 && (
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="text-[9px] font-black uppercase tracking-[0.18em] text-[var(--ds-text-3)] shrink-0">Filter by building</span>
                  <div className="flex gap-1.5 flex-wrap">
                    <button
                      onClick={() => setOverviewBuilding(null)}
                      className="px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wide transition-all"
                      style={{
                        background: overviewBuilding === null ? '#111827' : 'var(--ds-bg-raised)',
                        color: overviewBuilding === null ? '#adee2b' : 'var(--ds-text-3)',
                        border: overviewBuilding === null ? '1px solid transparent' : '1px solid var(--ds-border)',
                      }}>
                      All
                    </button>
                    {overviewBuildingsList.map(b => (
                      <button key={b.id}
                        onClick={() => setOverviewBuilding(overviewBuilding === b.id ? null : b.id)}
                        className="px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wide transition-all"
                        style={{
                          background: overviewBuilding === b.id ? '#111827' : 'var(--ds-bg-raised)',
                          color: overviewBuilding === b.id ? '#adee2b' : 'var(--ds-text-3)',
                          border: overviewBuilding === b.id ? '1px solid transparent' : '1px solid var(--ds-border)',
                        }}>
                        {b.code ?? b.name}
                      </button>
                    ))}
                  </div>
                  {overviewBuilding !== null && (
                    <span className="text-[10px] text-[var(--ds-text-4)] font-bold">
                      {overviewBuildingsList.find(b => b.id === overviewBuilding)?.name}
                    </span>
                  )}
                </div>
              )}

              {/* ── Stats (filtered by building) ── */}
              <div className="grid grid-cols-4 gap-4">
                <StatCard label="Total Bookings"
                  value={String(totalBookingsPeriod === 'month' ? overviewData.stats.total_bookings_month : overviewData.stats.total_bookings)}
                  sub={overviewBuilding ? 'this building' : totalBookingsPeriod === 'month' ? 'this month' : 'all time'}
                  period={totalBookingsPeriod} onPeriodChange={setTotalBookingsPeriod} />
                <StatCard label="Confirmed"
                  value={String(confirmedPeriod === 'month' ? overviewData.stats.confirmed_month : overviewData.stats.confirmed)}
                  sub={confirmedPeriod === 'month' ? 'bookings this month' : 'bookings all time'}
                  period={confirmedPeriod} onPeriodChange={setConfirmedPeriod} />
                <StatCard label="Active Rooms" value={String(overviewData.stats.active_rooms)} sub={overviewBuilding ? 'in building' : 'available'} />
                <StatCard label="Users" value={String(overviewData.stats.total_users)} sub="registered" />
              </div>

              {/* Trend + Status */}
              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-2 rounded-2xl border border-[var(--ds-border-sub)] p-5 overflow-hidden relative"
                  style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.08) 0%, var(--ds-bg-surface) 60%)' }}>
                  <div className="flex items-center justify-between mb-5">
                    <div>
                      <p className="text-[9px] font-black uppercase tracking-[0.2em] text-[var(--ds-text-3)]">Booking Trend</p>
                      <p className="text-[11px] font-black text-[var(--ds-text-2)] mt-0.5">{overviewPeriod === 'all' ? 'All time' : `Last ${overviewPeriod} days`}</p>
                    </div>
                    <div className="flex gap-0.5 p-0.5 rounded-xl" style={{ background: 'var(--ds-bg-raised)' }}>
                      {([7, 30, 'all'] as const).map(p => (
                        <button key={p} onClick={() => setOverviewPeriod(p)}
                          className="text-[8px] font-black px-2.5 py-1 rounded-[9px] transition-all uppercase tracking-wide"
                          style={{ background: overviewPeriod === p ? 'var(--ds-bg-surface)' : 'transparent', color: overviewPeriod === p ? 'var(--ds-text-1)' : 'var(--ds-text-4)', boxShadow: overviewPeriod === p ? '0 1px 3px rgba(0,0,0,0.1)' : 'none' }}>
                          {p === 7 ? '7 Days' : p === 30 ? '30 Days' : 'All Time'}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div style={{ height: 150 }}>
                    <ResponsiveLine
                      data={[{ id: 'bookings', data: overviewData.trend.map(d => ({ x: d.date, y: d.count })) }]}
                      margin={{ top: 8, right: 8, bottom: 28, left: 36 }}
                      xScale={{ type: 'point' }}
                      yScale={{ type: 'linear', min: 0, nice: true }}
                      curve="monotoneX"
                      enableArea={true}
                      areaOpacity={1}
                      colors={[cc.trend]}
                      lineWidth={2.5}
                      enablePoints={false}
                      enableGridX={false}
                      gridYValues={4}
                      enableCrosshair={true}
                      crosshairType="x"
                      theme={{
                        grid: { line: { stroke: 'rgba(148,163,184,0.08)', strokeDasharray: '3 3' } },
                        axis: { ticks: { text: { fontSize: 9, fill: 'rgba(148,163,184,0.55)', fontWeight: 700 } }, domain: { line: { strokeWidth: 0 } } },
                        crosshair: { line: { stroke: 'rgba(99,102,241,0.35)', strokeWidth: 1 } },
                      }}
                      axisBottom={{
                        tickSize: 0,
                        tickPadding: 8,
                        tickValues: overviewData.trend.filter((_, i) => i % Math.ceil(overviewData.trend.length / 6) === 0).map(d => d.date),
                        format: (d: string) => new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
                      }}
                      axisLeft={{
                        tickSize: 0,
                        tickPadding: 8,
                        tickValues: 4,
                        format: (v: number) => Number.isInteger(v) ? String(v) : '',
                      }}
                      useMesh={true}
                      tooltip={({ point }) => (
                        <div style={{ background: 'rgba(15,20,45,0.95)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, fontSize: 11, color: '#fff', fontWeight: 700, padding: '8px 12px', whiteSpace: 'nowrap' }}>
                          {new Date(String(point.data.x)).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })} · {String(point.data.y)} bookings
                        </div>
                      )}
                      defs={[{ id: 'trendGrad', type: 'linearGradient', colors: [{ offset: 0, color: cc.trend, opacity: 0.22 }, { offset: 100, color: cc.trend, opacity: 0 }] }]}
                      fill={[{ match: '*', id: 'trendGrad' }]}
                    />
                  </div>
                </div>

                <div className="rounded-2xl border border-[var(--ds-border-sub)] p-5 flex flex-col"
                  style={{ background: 'var(--ds-bg-surface)' }}>
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="text-[9px] font-black uppercase tracking-[0.2em] text-[var(--ds-text-3)]">Status</p>
                      <p className="text-[11px] font-black text-[var(--ds-text-2)] mt-0.5">Breakdown</p>
                    </div>
                    <SectionPill value={statusPeriod} onChange={setStatusPeriod} />
                  </div>
                  <div style={{ height: 130 }}>
                    <ResponsivePie
                      data={overviewData.status_breakdown.length ? overviewData.status_breakdown.map(s => ({
                        id: s.status,
                        label: s.status,
                        value: s.count,
                        color: s.status === 'confirmed' ? cc.confirmed : s.status === 'tentative' ? cc.tentative : cc.cancelled,
                      })) : [{ id: 'empty', label: 'No data', value: 1, color: 'rgba(148,163,184,0.1)' }]}
                      margin={{ top: 8, right: 8, bottom: 8, left: 8 }}
                      innerRadius={0.68}
                      padAngle={3}
                      cornerRadius={2}
                      colors={{ datum: 'data.color' }}
                      borderWidth={0}
                      enableArcLabels={false}
                      enableArcLinkLabels={false}
                      activeOuterRadiusOffset={5}
                      tooltip={({ datum }) => datum.id === 'empty' ? <></> : (
                        <div style={{ background: 'rgba(15,20,45,0.95)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, fontSize: 11, color: '#fff', fontWeight: 700, padding: '8px 12px', whiteSpace: 'nowrap' }}>
                          <span style={{ color: datum.color }}>{datum.label}</span>: {datum.value}
                        </div>
                      )}
                      layers={['arcs', 'arcLabels', 'arcLinkLabels', 'legends', ({ centerX, centerY }) => {
                        const total = overviewData.status_breakdown.reduce((s, d) => s + d.count, 0)
                        return total > 0 ? (
                          <text x={centerX} y={centerY} textAnchor="middle" dominantBaseline="central" style={{ fontSize: 18, fontWeight: 900, fill: 'var(--ds-text-1)' }}>{total}</text>
                        ) : <></>
                      }]}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5 mt-2">
                    {overviewData.status_breakdown.map(s => (
                      <div key={s.status} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="size-2 rounded-full shrink-0" style={{ background: s.status === 'confirmed' ? cc.confirmed : s.status === 'tentative' ? cc.tentative : cc.cancelled }} />
                          <span className="text-[10px] font-bold capitalize text-[var(--ds-text-2)]">{s.status}</span>
                        </div>
                        <span className="text-[10px] font-black text-[var(--ds-text-1)]">{s.count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Top Rooms + Peak Hours */}
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-2xl border border-[var(--ds-border-sub)] p-5"
                  style={{ background: 'var(--ds-bg-surface)' }}>
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <p className="text-[9px] font-black uppercase tracking-[0.2em] text-[var(--ds-text-3)]">Top Rooms</p>
                      <p className="text-[11px] font-black text-[var(--ds-text-2)] mt-0.5">Most booked</p>
                    </div>
                    <SectionPill value={roomsPeriod} onChange={setRoomsPeriod} />
                  </div>
                  <div style={{ height: 150 }}>
                    <ResponsiveBar
                      data={overviewData.top_rooms}
                      keys={['count']}
                      indexBy="room"
                      layout="horizontal"
                      margin={{ top: 0, right: 8, bottom: 4, left: 100 }}
                      colors={[cc.rooms]}
                      borderRadius={6}
                      enableGridX={false}
                      enableGridY={false}
                      axisTop={null}
                      axisRight={null}
                      axisBottom={null}
                      axisLeft={{ tickSize: 0, tickPadding: 8 }}
                      enableLabel={true}
                      label={d => `${d.value}`}
                      labelSkipWidth={18}
                      labelTextColor="#fff"
                      theme={{
                        axis: { ticks: { text: { fontSize: 9, fill: 'rgba(148,163,184,0.7)', fontWeight: 700 } }, domain: { line: { strokeWidth: 0 } } },
                        labels: { text: { fontSize: 9, fontWeight: 700 } },
                      }}
                      tooltip={({ indexValue, value }) => (
                        <div style={{ background: 'rgba(15,20,45,0.95)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, fontSize: 11, color: '#fff', fontWeight: 700, padding: '8px 12px', whiteSpace: 'nowrap' }}>
                          {indexValue}: {value}
                        </div>
                      )}
                    />
                  </div>
                </div>

                <div className="rounded-2xl border border-[var(--ds-border-sub)] p-5 overflow-hidden relative"
                  style={{ background: 'linear-gradient(135deg, rgba(173,238,43,0.06) 0%, var(--ds-bg-surface) 60%)' }}>
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <p className="text-[9px] font-black uppercase tracking-[0.2em] text-[var(--ds-text-3)]">Peak Hours</p>
                      <p className="text-[11px] font-black text-[var(--ds-text-2)] mt-0.5">Busiest booking times</p>
                    </div>
                    <SectionPill value={hoursPeriod} onChange={setHoursPeriod} />
                  </div>
                  <div style={{ height: 150 }}>
                    <ResponsiveBar
                      data={peakHoursFull}
                      keys={['count']}
                      indexBy="hour"
                      margin={{ top: 4, right: 4, bottom: 28, left: 36 }}
                      colors={[cc.hours]}
                      borderRadius={4}
                      padding={0.2}
                      enableGridX={false}
                      gridYValues={4}
                      axisTop={null}
                      axisRight={null}
                      axisBottom={{
                        tickSize: 0,
                        tickPadding: 8,
                        tickValues: Array.from({ length: 24 }, (_, i) => i).filter(h => h >= peakFrom && h <= peakTo && (h - peakFrom) % Math.max(1, Math.ceil((peakTo - peakFrom) / 6)) === 0),
                        format: (h: number) => `${h}:00`,
                      }}
                      axisLeft={{
                        tickSize: 0,
                        tickPadding: 8,
                        tickValues: 4,
                        format: (v: number) => Number.isInteger(v) ? String(v) : '',
                      }}
                      enableLabel={false}
                      theme={{
                        grid: { line: { stroke: 'rgba(148,163,184,0.08)', strokeDasharray: '3 3' } },
                        axis: { ticks: { text: { fontSize: 9, fill: 'rgba(148,163,184,0.55)', fontWeight: 700 } }, domain: { line: { strokeWidth: 0 } } },
                      }}
                      tooltip={({ indexValue, value }) => (
                        <div style={{ background: 'rgba(15,20,45,0.95)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, fontSize: 11, color: '#fff', fontWeight: 700, padding: '8px 12px', whiteSpace: 'nowrap' }}>
                          {indexValue}:00 · {value} bookings
                        </div>
                      )}
                      defs={[{ id: 'peakGrad', type: 'linearGradient', x1: '0%', y1: '0%', x2: '0%', y2: '100%', colors: [{ offset: 0, color: cc.hours, opacity: 1 }, { offset: 100, color: cc.hours, opacity: 0.7 }] }]}
                      fill={[{ match: '*', id: 'peakGrad' }]}
                    />
                  </div>
                </div>
              </div>
            </>)}
          </div>
        )}

        {/* Export Modal */}
        {exportModal && (
          <ModalPortal>
          <div className="fixed inset-0 z-[1000] flex items-center justify-center admin-backdrop-in" style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(12px)' }} onClick={() => setExportModal(false)}>
            <div className="rounded-3xl shadow-2xl w-[360px] p-7 space-y-5 admin-modal-in" style={{ background: 'var(--ds-bg-surface)', border: '1px solid var(--ds-border-sub)' }} onClick={e => e.stopPropagation()}>
              <div>
                <p className="text-[9px] font-black uppercase tracking-[0.2em] text-[var(--ds-text-3)]">Analytics</p>
                <h3 className="text-base font-black uppercase tracking-tight mt-0.5 text-[var(--ds-text-1)]">Export Bookings</h3>
              </div>

              <div className="space-y-4">
                {/* All time toggle */}
                <label className="flex items-center gap-3 cursor-pointer group">
                  <div className="relative shrink-0" onClick={() => setExportAllTime(v => !v)}>
                    <div className="w-9 h-5 rounded-full transition-colors" style={{ background: exportAllTime ? '#adee2b' : 'var(--ds-bg-surface-2)', border: '1px solid var(--ds-border)' }} />
                    <div className="absolute top-0.5 left-0.5 size-4 rounded-full bg-white transition-transform shadow-sm" style={{ transform: exportAllTime ? 'translateX(16px)' : 'translateX(0)' }} />
                  </div>
                  <span className="text-[11px] font-bold text-[var(--ds-text-2)]">Export all time</span>
                </label>

                {/* Month picker */}
                {!exportAllTime && (
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-black uppercase tracking-wider text-[var(--ds-text-3)]">Month</label>
                    <input
                      type="month"
                      value={exportMonth}
                      max={new Date().toISOString().slice(0, 7)}
                      onChange={e => setExportMonth(e.target.value)}
                      className="w-full border border-[var(--ds-border)] rounded-xl px-3 py-2.5 text-[11px] font-bold focus:outline-none focus:ring-2 focus:ring-[#adee2b] bg-[var(--ds-bg-surface)] text-[var(--ds-text-1)]"
                    />
                  </div>
                )}

                {/* Building filter */}
                {overviewBuildingsList.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-[9px] font-black uppercase tracking-wider text-[var(--ds-text-3)]">
                      Buildings <span className="text-[var(--ds-text-4)] normal-case font-bold">(leave all unchecked = all buildings)</span>
                    </p>
                    <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1" style={{ scrollbarWidth: 'thin' }}>
                      {overviewBuildingsList.map(b => {
                        const checked = exportBuildingIds.includes(b.id)
                        return (
                          <label key={b.id} className="flex items-center gap-2.5 cursor-pointer group px-3 py-2 rounded-xl transition-colors hover:bg-[var(--ds-bg-raised)]">
                            <div
                              className="size-4 rounded-md flex items-center justify-center shrink-0 transition-all"
                              style={{ background: checked ? '#111827' : 'var(--ds-bg-raised)', border: checked ? '1px solid #111827' : '1px solid var(--ds-border)' }}
                              onClick={() => setExportBuildingIds(ids => checked ? ids.filter(i => i !== b.id) : [...ids, b.id])}>
                              {checked && <span className="material-symbols-outlined" style={{ fontSize: 11, color: '#adee2b', fontVariationSettings: "'FILL' 1" }}>check</span>}
                            </div>
                            <span className="text-[11px] font-bold text-[var(--ds-text-2)]">
                              {b.name}{b.code ? ` (${b.code})` : ''}
                            </span>
                          </label>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex gap-3 pt-1">
                <button onClick={() => setExportModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-[var(--ds-border)] text-[10px] font-black uppercase text-[var(--ds-text-2)] hover:bg-[var(--ds-bg-raised)] transition-colors">
                  Cancel
                </button>
                <button onClick={handleExport} disabled={exporting}
                  className="flex-1 py-2.5 rounded-xl bg-black text-[#adee2b] text-[10px] font-black uppercase hover:opacity-80 disabled:opacity-50 flex items-center justify-center gap-2 transition-all">
                  {exporting
                    ? <><span className="material-symbols-outlined animate-spin" style={{ fontSize: 13 }}>progress_activity</span>Exporting…</>
                    : <><span className="material-symbols-outlined" style={{ fontSize: 13 }}>download</span>Download Analytics</>}
                </button>
              </div>
            </div>
          </div>
          </ModalPortal>
        )}

        {/* Chart Settings Modal */}
        {chartSettingsOpen && (
          <ModalPortal>
            <div className="fixed inset-0 z-[1000] flex items-center justify-center admin-backdrop-in" style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(12px)' }} onClick={() => setChartSettingsOpen(false)}>
              <div className="rounded-3xl shadow-2xl w-[400px] p-7 space-y-6 admin-modal-in" style={{ background: 'var(--ds-bg-surface)', border: '1px solid var(--ds-border-sub)' }} onClick={e => e.stopPropagation()}>
                <div>
                  <p className="text-[9px] font-black uppercase tracking-[0.2em] text-[var(--ds-text-3)]">Overview</p>
                  <h3 className="text-base font-black uppercase tracking-tight mt-0.5 text-[var(--ds-text-1)]">Chart Settings</h3>
                </div>

                {/* Colors */}
                <div className="space-y-3">
                  <p className="text-[9px] font-black uppercase tracking-widest text-[var(--ds-text-3)]">Colors</p>
                  {([
                    { key: 'trend',     label: 'Booking Trend',    default: '#6366f1' },
                    { key: 'confirmed', label: 'Confirmed',        default: '#adee2b' },
                    { key: 'tentative', label: 'Tentative',        default: '#f59e0b' },
                    { key: 'cancelled', label: 'Cancelled',        default: '#ef4444' },
                    { key: 'rooms',     label: 'Top Rooms Bar',    default: '#6366f1' },
                    { key: 'hours',     label: 'Peak Hours Bar',   default: '#adee2b' },
                  ] as const).map(({ key, label, default: def }) => (
                    <div key={key} className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-[var(--ds-text-2)]">{label}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono text-[var(--ds-text-3)]">{(parsedChartColors[key] ?? def).toUpperCase()}</span>
                        <label className="relative cursor-pointer">
                          <span className="size-7 rounded-xl border-2 border-[var(--ds-border)] block" style={{ background: parsedChartColors[key] ?? def }} />
                          <input type="color" defaultValue={parsedChartColors[key] ?? def}
                            className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                            onChange={e => saveChartColor(key, e.target.value)} />
                        </label>
                        {parsedChartColors[key] && parsedChartColors[key] !== def && (
                          <button onClick={() => saveChartColor(key, def)} title="Reset"
                            className="text-[var(--ds-text-4)] hover:text-[var(--ds-text-2)] transition-colors">
                            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>refresh</span>
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Peak Hours Range */}
                <div className="space-y-3">
                  <p className="text-[9px] font-black uppercase tracking-widest text-[var(--ds-text-3)]">Peak Hours Range</p>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 space-y-1">
                      <p className="text-[9px] font-black uppercase tracking-wider text-[var(--ds-text-3)]">From</p>
                      <select value={peakFrom} onChange={e => saveChartPeakHour(Number(e.target.value), peakTo)}
                        className="w-full border border-[var(--ds-border)] rounded-xl px-3 py-2 text-[11px] font-bold bg-[var(--ds-bg-surface)] text-[var(--ds-text-1)] focus:outline-none focus:ring-2 focus:ring-[#adee2b]">
                        {Array.from({ length: 24 }, (_, h) => (
                          <option key={h} value={h} disabled={h >= peakTo}>{String(h).padStart(2, '0')}:00</option>
                        ))}
                      </select>
                    </div>
                    <span className="text-[var(--ds-text-3)] mt-4">→</span>
                    <div className="flex-1 space-y-1">
                      <p className="text-[9px] font-black uppercase tracking-wider text-[var(--ds-text-3)]">To</p>
                      <select value={peakTo} onChange={e => saveChartPeakHour(peakFrom, Number(e.target.value))}
                        className="w-full border border-[var(--ds-border)] rounded-xl px-3 py-2 text-[11px] font-bold bg-[var(--ds-bg-surface)] text-[var(--ds-text-1)] focus:outline-none focus:ring-2 focus:ring-[#adee2b]">
                        {Array.from({ length: 24 }, (_, h) => (
                          <option key={h} value={h} disabled={h <= peakFrom}>{String(h).padStart(2, '0')}:00</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <p className="text-[10px] text-[var(--ds-text-3)] font-bold">
                    Menampilkan jam {String(peakFrom).padStart(2,'0')}:00 – {String(peakTo).padStart(2,'0')}:59 · {peakTo - peakFrom + 1} jam
                  </p>
                </div>

                <button onClick={() => setChartSettingsOpen(false)}
                  className="w-full py-2.5 rounded-xl bg-black text-[#adee2b] text-[10px] font-black uppercase hover:opacity-80 transition-all">
                  Done
                </button>
              </div>
            </div>
          </ModalPortal>
        )}

        {tab === 'buildings' && <div className="admin-tab-in"><BuildingsTab /></div>}


        {tab === 'users' && <div className="admin-tab-in"><UsersTab /></div>}

        {tab === 'archive'  && <div className="admin-tab-in"><ArchiveTab /></div>}
        {tab === 'settings' && <div className="admin-tab-in"><SettingsTab /></div>}
        {tab === 'kiosk'     && <div className="admin-tab-in"><KioskTab /></div>}
        {tab === 'sensor'    && <div className="admin-tab-in"><SensorTab /></div>}
        {tab === 'activity'  && <div className="admin-tab-in"><ActivityLogTab /></div>}
        {tab === 'disputes'  && <div className="admin-tab-in"><DisputesTab /></div>}
      </div>
    </div>
  )
}
