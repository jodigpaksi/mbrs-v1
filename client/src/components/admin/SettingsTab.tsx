import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import { toMin } from '../../utils/date'
import ToggleSwitch from '../ui/ToggleSwitch'
import GlassTimePicker from '../ui/GlassTimePicker'
import { useCancelToast } from '../../context/CancelToastContext'
import {
  getBookingHours, updateBookingHours, getWeekendSettings, updateWeekendSettings,
  getGeneralSettings, updateGeneralSettings, uploadAppLogo, deleteAppLogo,
  uploadLoginPhoto, deleteLoginPhoto, getM365Settings, updateM365Settings,
  testM365Connection, sendM365TestEmail, getMailerSettings, updateMailerSettings,
  sendMailerTestEmail, type ActiveMailer,
} from '../../api/settings'
import { runBackupExport, listBackupExports, getBackupDownloadUrl, deleteAllBackupExports } from '../../api/backup'

const SETTINGS_SECTIONS = [
  { key: 'branding',  label: 'Branding',       icon: 'palette' },
  { key: 'hours',    label: 'Booking Hours',  icon: 'schedule' },
  { key: 'weekend',  label: 'Weekend',        icon: 'calendar_today' },
  { key: 'system',   label: 'System',         icon: 'settings' },
  { key: 'rules',    label: 'Booking Rules',  icon: 'rule' },
  { key: 'ghost',    label: 'Anti-Ghost',     icon: 'person_off' },
  { key: 'features', label: 'Features',       icon: 'tune' },
  { key: 'm365',     label: 'Microsoft 365',  icon: 'cloud' },
  { key: 'mailer',   label: 'Mailer',         icon: 'mail' },
  { key: 'reminders', label: 'Reminders',     icon: 'notifications_active' },
  { key: 'archive',  label: 'Archive',         icon: 'inventory_2' },
  { key: 'backup',   label: 'Auto Backup',     icon: 'backup' },
] as const
type SettingsSection = typeof SETTINGS_SECTIONS[number]['key']

function SettingsTab() {
  const queryClient = useQueryClient()
  const { addInfoToast } = useCancelToast()
  const [dirty, setDirty] = useState(false)
  const [applying, setApplying] = useState(false)

  // Section refs + active tracking
  const secRefs = useRef<Record<SettingsSection, HTMLDivElement | null>>({ branding: null, hours: null, weekend: null, system: null, rules: null, reminders: null, ghost: null, features: null, m365: null, mailer: null, archive: null, backup: null })
  const [activeSection, setActiveSection] = useState<SettingsSection>('hours')

  useEffect(() => {
    const latest: Record<string, number> = {}
    let rafId: number
    const observers: IntersectionObserver[] = []
    SETTINGS_SECTIONS.forEach(({ key }) => {
      const el = secRefs.current[key]
      if (!el) return
      const obs = new IntersectionObserver(([entry]) => {
        latest[key] = entry.intersectionRatio
        cancelAnimationFrame(rafId)
        rafId = requestAnimationFrame(() => {
          const best = SETTINGS_SECTIONS.reduce((a, b) => (latest[b.key] ?? 0) > (latest[a.key] ?? 0) ? b : a)
          setActiveSection(best.key)
        })
      }, { threshold: [0, 0.25, 0.5, 0.75, 1] })
      obs.observe(el)
      observers.push(obs)
    })
    return () => { observers.forEach(o => o.disconnect()); cancelAnimationFrame(rafId) }
  }, [])

  function scrollTo(key: SettingsSection) {
    secRefs.current[key]?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  // Booking Hours (keep save button — destructive side effects)
  const { data: hours } = useQuery({ queryKey: ['booking-hours'], queryFn: getBookingHours })
  const [localStart, setLocalStart] = useState(hours?.start ?? '07:00')
  const [localEnd,   setLocalEnd]   = useState(hours?.end   ?? '19:00')
  const [saved, setSaved] = useState<{ trimmed: number; cancelled: number } | null>(null)
  useEffect(() => { if (hours) { setLocalStart(hours.start); setLocalEnd(hours.end) } }, [hours?.start, hours?.end])
  const isValid = toMin(localEnd) - toMin(localStart) >= 30
  const { mutate: saveHours, isPending: hoursPending, isError: hoursError } = useMutation({
    mutationFn: () => updateBookingHours(localStart, localEnd),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['booking-hours'] })
      setSaved({ trimmed: res.trimmed_count, cancelled: res.cancelled_count })
      setTimeout(() => setSaved(null), 6000)
    },
  })

  // Weekend — draft, applied via the global Apply button
  const { data: weekend } = useQuery({ queryKey: ['weekend-settings'], queryFn: getWeekendSettings })
  const [wkSat, setWkSat] = useState(weekend?.saturday ?? true)
  const [wkSun, setWkSun] = useState(weekend?.sunday   ?? true)
  useEffect(() => { if (weekend) { setWkSat(weekend.saturday); setWkSun(weekend.sunday) } }, [weekend?.saturday, weekend?.sunday])
  function toggleSat() { setWkSat(v => !v); setDirty(true) }
  function toggleSun() { setWkSun(v => !v); setDirty(true) }

  // General — draft, applied via the global Apply button
  const { data: general } = useQuery({ queryKey: ['settings-general'], queryFn: getGeneralSettings })
  const [appName,      setAppName]      = useState(general?.app_name ?? 'RoomSync Pro')
  const [appFullName,  setAppFullName]  = useState(general?.app_full_name ?? '')
  const [appLogoUrl,   setAppLogoUrl]   = useState<string | null>(general?.app_logo_url ?? null)
  const [logoUploading, setLogoUploading] = useState(false)
  const logoInputRef = useRef<HTMLInputElement>(null)
  const [loginPhotoUrl, setLoginPhotoUrl] = useState<string | null>(general?.login_photo_url ?? null)
  const [loginPhotoUploading, setLoginPhotoUploading] = useState(false)
  const loginPhotoInputRef = useRef<HTMLInputElement>(null)
  const [loginPhotoPosX, setLoginPhotoPosX] = useState(general?.login_photo_pos_x ?? 50)
  const [loginPhotoPosY, setLoginPhotoPosY] = useState(general?.login_photo_pos_y ?? 50)
  const [loginHeadline,    setLoginHeadline]    = useState(general?.login_headline ?? 'Booking made easy')
  const [loginSubheadline, setLoginSubheadline] = useState(general?.login_subheadline ?? 'Book meeting rooms without the back-and-forth')
  const [loginFooterText,  setLoginFooterText]  = useState(general?.login_footer_text ?? '')

  // Microsoft 365 integration (Tenant/Client ID + Client Secret, used later for Teams/Email/Outlook Calendar) — draft, applied via the global Apply button
  const { data: m365 } = useQuery({ queryKey: ['settings-m365'], queryFn: getM365Settings })
  const [m365TenantId, setM365TenantId] = useState('')
  const [m365ClientId, setM365ClientId] = useState('')
  const [m365ClientSecret, setM365ClientSecret] = useState('')
  const [m365SenderEmail, setM365SenderEmail] = useState('')
  const [m365CalendarSync, setM365CalendarSync] = useState(false)
  const [m365Testing, setM365Testing] = useState(false)
  const [m365TestResult, setM365TestResult] = useState<{ success: boolean; message: string } | null>(null)
  const [m365TestingEmail, setM365TestingEmail] = useState(false)
  const [m365EmailTestResult, setM365EmailTestResult] = useState<{ success: boolean; message: string } | null>(null)
  useEffect(() => {
    if (m365) {
      setM365TenantId(m365.tenant_id); setM365ClientId(m365.client_id); setM365SenderEmail(m365.sender_email)
      setM365CalendarSync(m365.calendar_sync_enabled)
    }
  }, [m365?.tenant_id, m365?.client_id, m365?.sender_email, m365?.calendar_sync_enabled])
  function onM365Field(setter: (v: string) => void) {
    return (v: string) => { setter(v); setDirty(true) }
  }
  async function handleTestM365() {
    setM365Testing(true)
    setM365TestResult(null)
    try {
      const res = await testM365Connection()
      setM365TestResult(res)
    } catch (err: any) {
      setM365TestResult({ success: false, message: err?.response?.data?.message ?? 'Test failed — please try again.' })
    } finally {
      setM365Testing(false)
    }
  }
  function toggleM365CalendarSync() { setM365CalendarSync(v => !v); setDirty(true) }
  async function handleSendM365TestEmail() {
    setM365TestingEmail(true)
    setM365EmailTestResult(null)
    try {
      const res = await sendM365TestEmail()
      setM365EmailTestResult(res)
    } catch (err: any) {
      setM365EmailTestResult({ success: false, message: err?.response?.data?.message ?? 'Test email failed — please try again.' })
    } finally {
      setM365TestingEmail(false)
    }
  }

  // Mailer — active provider (Default/M365/Resend/Brevo), draft applied via the global Apply button
  const { data: mailer } = useQuery({ queryKey: ['settings-mailer'], queryFn: getMailerSettings })
  const [activeMailer, setActiveMailer] = useState<ActiveMailer>('default')
  const [resendApiKey, setResendApiKey] = useState('')
  const [resendFromAddress, setResendFromAddress] = useState('')
  const [resendFromName, setResendFromName] = useState('')
  const [brevoApiKey, setBrevoApiKey] = useState('')
  const [brevoFromAddress, setBrevoFromAddress] = useState('')
  const [brevoFromName, setBrevoFromName] = useState('')
  const [mailerTestingEmail, setMailerTestingEmail] = useState(false)
  const [mailerEmailTestResult, setMailerEmailTestResult] = useState<{ success: boolean; message: string } | null>(null)
  useEffect(() => {
    if (mailer) {
      setActiveMailer(mailer.active_mailer)
      setResendFromAddress(mailer.resend.from_address); setResendFromName(mailer.resend.from_name)
      setBrevoFromAddress(mailer.brevo.from_address); setBrevoFromName(mailer.brevo.from_name)
    }
  }, [mailer?.active_mailer, mailer?.resend?.from_address, mailer?.resend?.from_name, mailer?.brevo?.from_address, mailer?.brevo?.from_name])
  function onMailerField(setter: (v: string) => void) {
    return (v: string) => { setter(v); setDirty(true) }
  }
  function selectActiveMailer(v: ActiveMailer) {
    setActiveMailer(v)
    if (v === 'default') setReminderEnabled(false)
    setDirty(true)
  }
  async function handleSendMailerTestEmail() {
    setMailerTestingEmail(true)
    setMailerEmailTestResult(null)
    try {
      const res = await sendMailerTestEmail()
      setMailerEmailTestResult(res)
    } catch (err: any) {
      setMailerEmailTestResult({ success: false, message: err?.response?.data?.message ?? 'Test email failed — please try again.' })
    } finally {
      setMailerTestingEmail(false)
    }
  }

  const [maxDays,      setMaxDays]      = useState(general?.max_advance_days ?? 30)
  const [allowBookFor,      setAllowBookFor]      = useState(general?.allow_book_for_others ?? true)
  const [allowPasswordChange, setAllowPasswordChange] = useState(general?.allow_password_change ?? true)
  const [allowAvatarUpload,   setAllowAvatarUpload]   = useState(general?.allow_avatar_upload   ?? true)
  const [restrictAH,   setRestrictAH]   = useState(general?.restrict_after_hours ?? false)
  const [workEnd,      setWorkEnd]      = useState(general?.working_hours_end ?? '17:00')
  const [aiChat,       setAiChat]       = useState(general?.feature_ai_chat ?? true)
  const [roomsGrid,    setRoomsGrid]    = useState(general?.rooms_grid_cols ?? 3)
  const [titleMaxLen,  setTitleMaxLen]  = useState(general?.booking_title_max_length ?? 45)
  const [descMaxLen,   setDescMaxLen]   = useState(general?.booking_description_max_length ?? 65)
  const [archiveDays,      setArchiveDays]      = useState(general?.archive_after_days ?? 30)
  const [deleteDays,       setDeleteDays]       = useState(general?.archive_delete_after_days ?? 90)
  const [antiGhostEnabled,      setAntiGhostEnabled]      = useState(general?.anti_ghost_enabled ?? false)
  const [antiGhostModes,        setAntiGhostModes]        = useState<Set<string>>(() => new Set((general?.anti_ghost_mode ?? 'kiosk').split(',').filter(Boolean)))
  const [ghostWindowBefore,     setGhostWindowBefore]     = useState(general?.anti_ghost_window_before ?? 5)
  const [ghostWindowAfter,      setGhostWindowAfter]      = useState(general?.anti_ghost_window_after ?? 10)
  const [webConfirmEnabled,     setWebConfirmEnabled]      = useState(general?.web_confirm_enabled ?? false)
  const [antiGhostEmailEnabled, setAntiGhostEmailEnabled]  = useState(general?.anti_ghost_email_enabled ?? false)
  const [ghostCancelEmailEnabled, setGhostCancelEmailEnabled] = useState(general?.ghost_cancel_email_enabled ?? true)
  const [reminderEnabled,       setReminderEnabled]        = useState(general?.reminder_enabled ?? true)
  const [reminderMinutes,       setReminderMinutes]        = useState(general?.reminder_minutes ?? 10)
  const [businessTz,            setBusinessTz]             = useState(general?.business_timezone ?? 'Asia/Jakarta')
  useEffect(() => {
    if (general) {
      setAppName(general.app_name ?? 'RoomSync Pro')
      setAppFullName(general.app_full_name ?? '')
      setAppLogoUrl(general.app_logo_url ?? null)
      setLoginPhotoUrl(general.login_photo_url ?? null)
      setLoginPhotoPosX(general.login_photo_pos_x ?? 50)
      setLoginPhotoPosY(general.login_photo_pos_y ?? 50)
      setLoginHeadline(general.login_headline ?? 'Booking made easy')
      setLoginSubheadline(general.login_subheadline ?? 'Book meeting rooms without the back-and-forth')
      setLoginFooterText(general.login_footer_text ?? '')
      setMaxDays(general.max_advance_days); setAllowBookFor(general.allow_book_for_others)
      setAllowPasswordChange(general.allow_password_change ?? true)
      setAllowAvatarUpload(general.allow_avatar_upload ?? true)
      setRestrictAH(general.restrict_after_hours); setWorkEnd(general.working_hours_end)
      setAiChat(general.feature_ai_chat); setRoomsGrid(general.rooms_grid_cols)
      setTitleMaxLen(general.booking_title_max_length ?? 45)
      setDescMaxLen(general.booking_description_max_length ?? 65)
      setArchiveDays(general.archive_after_days); setDeleteDays(general.archive_delete_after_days)
      setAntiGhostEnabled(general.anti_ghost_enabled ?? false)
      setAntiGhostModes(new Set((general.anti_ghost_mode ?? 'kiosk').split(',').filter(Boolean)))
      setGhostWindowBefore(general.anti_ghost_window_before ?? 5)
      setGhostWindowAfter(general.anti_ghost_window_after ?? 10)
      setWebConfirmEnabled(general.web_confirm_enabled ?? false)
      setAntiGhostEmailEnabled(general.anti_ghost_email_enabled ?? false)
      setGhostCancelEmailEnabled(general.ghost_cancel_email_enabled ?? true)
      setReminderEnabled(general.reminder_enabled ?? true)
      setReminderMinutes(general.reminder_minutes ?? 10)
      setBusinessTz(general.business_timezone ?? 'Asia/Jakarta')
    }
  }, [general?.max_advance_days, general?.allow_book_for_others, general?.allow_password_change, general?.restrict_after_hours, general?.working_hours_end, general?.feature_ai_chat, general?.rooms_grid_cols, general?.archive_after_days, general?.archive_delete_after_days, general?.anti_ghost_enabled, general?.anti_ghost_mode, general?.anti_ghost_window_before, general?.anti_ghost_window_after, general?.web_confirm_enabled, general?.anti_ghost_email_enabled, general?.ghost_cancel_email_enabled, general?.reminder_enabled, general?.reminder_minutes, general?.business_timezone, general?.app_name, general?.app_full_name, general?.app_logo_url, general?.login_photo_url, general?.login_photo_pos_x, general?.login_photo_pos_y, general?.login_headline, general?.login_subheadline])

  const { mutateAsync: doSaveGeneral } = useMutation({
    mutationFn: (patch: Parameters<typeof updateGeneralSettings>[0]) => updateGeneralSettings(patch),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['settings-general'] }),
  })
  async function saveGeneralNow(patch: Parameters<typeof updateGeneralSettings>[0], msg: string) {
    await doSaveGeneral(patch)
    addInfoToast(msg)
  }
  function onAppNameChange(v: string) { setAppName(v); setDirty(true) }
  function onAppFullNameChange(v: string) { setAppFullName(v); setDirty(true) }
  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setLogoUploading(true)
    try {
      const res = await uploadAppLogo(file)
      setAppLogoUrl(res.app_logo_url)
      queryClient.invalidateQueries({ queryKey: ['settings-general'] })
      addInfoToast('App logo updated')
    } catch {
      addInfoToast('Logo upload failed', true)
    } finally {
      setLogoUploading(false)
      if (logoInputRef.current) logoInputRef.current.value = ''
    }
  }
  async function handleDeleteLogo() {
    await deleteAppLogo()
    setAppLogoUrl(null)
    queryClient.invalidateQueries({ queryKey: ['settings-general'] })
    addInfoToast('App logo removed', true)
  }
  async function handleLoginPhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setLoginPhotoUploading(true)
    try {
      const res = await uploadLoginPhoto(file)
      setLoginPhotoUrl(res.login_photo_url)
      queryClient.invalidateQueries({ queryKey: ['settings-general'] })
      addInfoToast('Login page photo updated')
    } catch {
      addInfoToast('Photo upload failed', true)
    } finally {
      setLoginPhotoUploading(false)
      if (loginPhotoInputRef.current) loginPhotoInputRef.current.value = ''
    }
  }
  async function handleDeleteLoginPhoto() {
    await deleteLoginPhoto()
    setLoginPhotoUrl(null)
    queryClient.invalidateQueries({ queryKey: ['settings-general'] })
    addInfoToast('Login page photo removed', true)
  }
  function onLoginPhotoPosChange(axis: 'x' | 'y', v: number) {
    if (axis === 'x') setLoginPhotoPosX(v); else setLoginPhotoPosY(v)
    setDirty(true)
  }
  function onLoginHeadlineChange(v: string) { setLoginHeadline(v); setDirty(true) }
  function onLoginSubheadlineChange(v: string) { setLoginSubheadline(v); setDirty(true) }
  function onLoginFooterTextChange(v: string) { setLoginFooterText(v); setDirty(true) }
  function toggleAllowBookFor()        { setAllowBookFor(v => !v);       setDirty(true) }
  function toggleAllowPasswordChange() { setAllowPasswordChange(v => !v); setDirty(true) }
  function toggleAllowAvatarUpload()   { setAllowAvatarUpload(v => !v);   setDirty(true) }
  function toggleRestrictAH()  { setRestrictAH(v => !v);   setDirty(true) }
  function toggleAiChat()      { setAiChat(v => !v);       setDirty(true) }
  function setRoomsGridCols(v: number) { setRoomsGrid(v); setDirty(true) }
  function onArchiveDaysChange(v: number) { setArchiveDays(v); setDirty(true) }
  function onDeleteDaysChange(v: number) { setDeleteDays(v); setDirty(true) }
  function onWorkEndChange(v: string) { setWorkEnd(v); setDirty(true) }
  function onMaxDaysChange(v: number) { setMaxDays(v); setDirty(true) }
  function toggleAntiGhost() {
    const v = !antiGhostEnabled
    setAntiGhostEnabled(v)
    if (v) {
      // Re-enabling: if no methods selected, auto-pick web confirm as safe default
      const noMethods = antiGhostModes.size === 0 && !webConfirmEnabled && !antiGhostEmailEnabled
      if (noMethods) setWebConfirmEnabled(true)
    } else {
      setWebConfirmEnabled(false)
      setAntiGhostEmailEnabled(false)
    }
    setDirty(true)
  }
  function toggleMethod(key: 'kiosk' | 'sensor' | 'web' | 'email') {
    if (key === 'web' || key === 'email') {
      const newVal = key === 'web' ? !webConfirmEnabled : !antiGhostEmailEnabled
      const otherBoolean = key === 'web' ? antiGhostEmailEnabled : webConfirmEnabled
      const anyLeft = newVal || otherBoolean || antiGhostModes.has('kiosk') || antiGhostModes.has('sensor')
      if (key === 'web') setWebConfirmEnabled(anyLeft ? newVal : false)
      else setAntiGhostEmailEnabled(anyLeft ? newVal : false)
      if (!anyLeft) setAntiGhostEnabled(false)
    } else {
      const next = new Set(antiGhostModes)
      if (next.has(key)) next.delete(key); else next.add(key)
      const anyLeft = next.size > 0 || webConfirmEnabled || antiGhostEmailEnabled
      setAntiGhostModes(anyLeft ? next : new Set())
      if (!anyLeft) setAntiGhostEnabled(false)
    }
    setDirty(true)
  }
  function onGhostWindowBeforeChange(v: number) { setGhostWindowBefore(Math.max(0, Math.min(20, v))); setDirty(true) }
  function onGhostWindowAfterChange(v: number) { setGhostWindowAfter(Math.max(0, Math.min(20, v))); setDirty(true) }
  function toggleGhostCancelEmailEnabled() { setGhostCancelEmailEnabled(v => !v); setDirty(true) }

  function toggleReminderEnabled() {
    if (activeMailer === 'default') return
    setReminderEnabled(v => !v)
    setDirty(true)
  }
  function onReminderMinutesChange(v: number) { setReminderMinutes(Math.max(1, Math.min(120, v))); setDirty(true) }

  function onBusinessTzChange(v: string) { setBusinessTz(v); setDirty(true) }

  // Auto Backup — one bundled batch (archive, activity log, users/buildings/rooms), single schedule
  const [backupEnabled,       setBackupEnabled]       = useState(general?.backup_enabled ?? false)
  const [backupFrequency,     setBackupFrequency]     = useState(general?.backup_frequency ?? 'weekly')
  const [backupTime,          setBackupTime]          = useState(general?.backup_time ?? '02:00')
  const [backupDow,           setBackupDow]           = useState(general?.backup_day_of_week ?? 1)
  const [backupDom,           setBackupDom]           = useState(general?.backup_day_of_month ?? 1)
  const [backupFormats,       setBackupFormats]       = useState<string[]>((general?.backup_formats ?? 'excel,csv').split(',').filter(Boolean))
  const [backupIncludeArchive, setBackupIncludeArchive] = useState(general?.backup_include_archive ?? true)
  const [backupIncludeLog,     setBackupIncludeLog]     = useState(general?.backup_include_log ?? true)
  const [backupIncludeData,    setBackupIncludeData]    = useState(general?.backup_include_data ?? true)
  useEffect(() => {
    if (general) {
      setBackupEnabled(general.backup_enabled ?? false)
      setBackupFrequency(general.backup_frequency ?? 'weekly')
      setBackupTime(general.backup_time ?? '02:00')
      setBackupDow(general.backup_day_of_week ?? 1)
      setBackupDom(general.backup_day_of_month ?? 1)
      setBackupFormats((general.backup_formats ?? 'excel,csv').split(',').filter(Boolean))
      setBackupIncludeArchive(general.backup_include_archive ?? true)
      setBackupIncludeLog(general.backup_include_log ?? true)
      setBackupIncludeData(general.backup_include_data ?? true)
    }
  }, [general?.backup_enabled, general?.backup_frequency, general?.backup_time, general?.backup_day_of_week, general?.backup_day_of_month, general?.backup_formats, general?.backup_include_archive, general?.backup_include_log, general?.backup_include_data])
  function toggleBackupEnabled() { setBackupEnabled(v => !v); setDirty(true) }
  function onBackupFrequencyChange(v: string) { setBackupFrequency(v); setDirty(true) }
  function onBackupTimeChange(v: string) { setBackupTime(v); setDirty(true) }
  function onBackupDowChange(v: number) { setBackupDow(v); setDirty(true) }
  function onBackupDomChange(v: number) { setBackupDom(v); setDirty(true) }
  function toggleBackupFormat(fmt: string) {
    const next = backupFormats.includes(fmt) ? backupFormats.filter(f => f !== fmt) : [...backupFormats, fmt]
    if (!next.length) return
    setBackupFormats(next)
    setDirty(true)
  }
  function toggleBackupInclude(key: 'archive' | 'log' | 'data') {
    const cur = { archive: backupIncludeArchive, log: backupIncludeLog, data: backupIncludeData }
    const next = !cur[key]
    const wouldBeEmpty = !next && !Object.entries(cur).filter(([k]) => k !== key).some(([, v]) => v)
    if (wouldBeEmpty) return
    if (key === 'archive') setBackupIncludeArchive(next)
    if (key === 'log')     setBackupIncludeLog(next)
    if (key === 'data')    setBackupIncludeData(next)
    setDirty(true)
  }

  const { data: backupExports = [] } = useQuery({
    queryKey: ['backup-exports'],
    queryFn: listBackupExports,
    staleTime: 30_000,
  })
  const { mutate: doBackupNow, isPending: backupRunning } = useMutation({
    mutationFn: () => runBackupExport(backupFormats.length ? backupFormats : ['excel', 'csv'], { archive: backupIncludeArchive, log: backupIncludeLog, data: backupIncludeData }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['backup-exports'] })
      addInfoToast(`Backup generated: ${res.files} file${res.files !== 1 ? 's' : ''} saved to server`)
    },
  })
  const [deleteBackupsConfirm, setDeleteBackupsConfirm] = useState(false)
  const [deleteBackupsInput,   setDeleteBackupsInput]   = useState('')
  const [deletingBackups,      setDeletingBackups]      = useState(false)
  async function doDeleteAllBackups() {
    setDeletingBackups(true)
    try {
      const res = await deleteAllBackupExports()
      queryClient.invalidateQueries({ queryKey: ['backup-exports'] })
      addInfoToast(`${res.deleted} backup batch${res.deleted !== 1 ? 'es' : ''} deleted`)
      setDeleteBackupsConfirm(false)
      setDeleteBackupsInput('')
    } catch {
      addInfoToast('Delete failed', true)
    } finally {
      setDeletingBackups(false)
    }
  }

  async function handleApplyAll() {
    setApplying(true)
    try {
      const generalPatch: Parameters<typeof updateGeneralSettings>[0] = {
        app_name: appName, app_full_name: appFullName,
        login_photo_pos_x: loginPhotoPosX, login_photo_pos_y: loginPhotoPosY,
        login_headline: loginHeadline, login_subheadline: loginSubheadline,
        login_footer_text: loginFooterText,
        max_advance_days: maxDays, allow_book_for_others: allowBookFor,
        allow_password_change: allowPasswordChange, allow_avatar_upload: allowAvatarUpload,
        restrict_after_hours: restrictAH, working_hours_end: workEnd,
        feature_ai_chat: aiChat, rooms_grid_cols: roomsGrid,
        booking_title_max_length: titleMaxLen, booking_description_max_length: descMaxLen,
        archive_after_days: archiveDays, archive_delete_after_days: deleteDays,
        anti_ghost_enabled: antiGhostEnabled, anti_ghost_mode: [...antiGhostModes].sort().join(','),
        anti_ghost_window_before: ghostWindowBefore, anti_ghost_window_after: ghostWindowAfter,
        web_confirm_enabled: webConfirmEnabled, anti_ghost_email_enabled: antiGhostEmailEnabled,
        ghost_cancel_email_enabled: ghostCancelEmailEnabled,
        reminder_enabled: reminderEnabled, reminder_minutes: reminderMinutes,
        business_timezone: businessTz,
        backup_enabled: backupEnabled, backup_frequency: backupFrequency, backup_time: backupTime,
        backup_day_of_week: backupDow, backup_day_of_month: backupDom,
        backup_formats: backupFormats.join(','), backup_include_archive: backupIncludeArchive,
        backup_include_log: backupIncludeLog, backup_include_data: backupIncludeData,
      }
      const m365Patch: Parameters<typeof updateM365Settings>[0] = {
        tenant_id: m365TenantId, client_id: m365ClientId, sender_email: m365SenderEmail,
        calendar_sync_enabled: m365CalendarSync,
      }
      if (m365ClientSecret) m365Patch.client_secret = m365ClientSecret

      const mailerPatch: Parameters<typeof updateMailerSettings>[0] = {
        active_mailer: activeMailer,
        resend_from_address: resendFromAddress, resend_from_name: resendFromName,
        brevo_from_address: brevoFromAddress, brevo_from_name: brevoFromName,
      }
      if (resendApiKey) mailerPatch.resend_api_key = resendApiKey
      if (brevoApiKey) mailerPatch.brevo_api_key = brevoApiKey

      await Promise.all([
        updateGeneralSettings(generalPatch),
        updateWeekendSettings(wkSat, wkSun),
        updateM365Settings(m365Patch),
        updateMailerSettings(mailerPatch),
      ])
      setM365ClientSecret('')
      setResendApiKey('')
      setBrevoApiKey('')
      queryClient.invalidateQueries({ queryKey: ['settings-general'] })
      queryClient.invalidateQueries({ queryKey: ['weekend-settings'] })
      queryClient.invalidateQueries({ queryKey: ['settings-m365'] })
      queryClient.invalidateQueries({ queryKey: ['settings-mailer'] })
      setDirty(false)
      addInfoToast('Settings applied')
    } catch (e: unknown) {
      console.error('Apply settings failed:', e)
      const msg = (e as { response?: { data?: { message?: string; errors?: Record<string, string[]> } } })?.response?.data
      const firstFieldError = msg?.errors ? Object.values(msg.errors)[0]?.[0] : undefined
      addInfoToast(firstFieldError ?? msg?.message ?? 'Failed to apply settings — please try again', true)
    } finally {
      setApplying(false)
    }
  }

  function handleDiscardAll() {
    if (general) {
      setAppName(general.app_name ?? 'RoomSync Pro')
      setAppFullName(general.app_full_name ?? '')
      setLoginPhotoPosX(general.login_photo_pos_x ?? 50)
      setLoginPhotoPosY(general.login_photo_pos_y ?? 50)
      setLoginHeadline(general.login_headline ?? 'Booking made easy')
      setLoginSubheadline(general.login_subheadline ?? 'Book meeting rooms without the back-and-forth')
      setLoginFooterText(general.login_footer_text ?? '')
      setMaxDays(general.max_advance_days); setAllowBookFor(general.allow_book_for_others)
      setAllowPasswordChange(general.allow_password_change ?? true)
      setAllowAvatarUpload(general.allow_avatar_upload ?? true)
      setRestrictAH(general.restrict_after_hours); setWorkEnd(general.working_hours_end)
      setAiChat(general.feature_ai_chat); setRoomsGrid(general.rooms_grid_cols)
      setTitleMaxLen(general.booking_title_max_length ?? 45)
      setDescMaxLen(general.booking_description_max_length ?? 65)
      setArchiveDays(general.archive_after_days); setDeleteDays(general.archive_delete_after_days)
      setAntiGhostEnabled(general.anti_ghost_enabled ?? false)
      setAntiGhostModes(new Set((general.anti_ghost_mode ?? 'kiosk').split(',').filter(Boolean)))
      setGhostWindowBefore(general.anti_ghost_window_before ?? 5)
      setGhostWindowAfter(general.anti_ghost_window_after ?? 10)
      setWebConfirmEnabled(general.web_confirm_enabled ?? false)
      setAntiGhostEmailEnabled(general.anti_ghost_email_enabled ?? false)
      setGhostCancelEmailEnabled(general.ghost_cancel_email_enabled ?? true)
      setReminderEnabled(general.reminder_enabled ?? true)
      setReminderMinutes(general.reminder_minutes ?? 10)
      setBusinessTz(general.business_timezone ?? 'Asia/Jakarta')
      setBackupEnabled(general.backup_enabled ?? false)
      setBackupFrequency(general.backup_frequency ?? 'weekly')
      setBackupTime(general.backup_time ?? '02:00')
      setBackupDow(general.backup_day_of_week ?? 1)
      setBackupDom(general.backup_day_of_month ?? 1)
      setBackupFormats((general.backup_formats ?? 'excel,csv').split(',').filter(Boolean))
      setBackupIncludeArchive(general.backup_include_archive ?? true)
      setBackupIncludeLog(general.backup_include_log ?? true)
      setBackupIncludeData(general.backup_include_data ?? true)
    }
    if (weekend) { setWkSat(weekend.saturday); setWkSun(weekend.sunday) }
    if (m365) {
      setM365TenantId(m365.tenant_id); setM365ClientId(m365.client_id); setM365SenderEmail(m365.sender_email)
      setM365CalendarSync(m365.calendar_sync_enabled)
    }
    if (mailer) {
      setActiveMailer(mailer.active_mailer)
      setResendFromAddress(mailer.resend.from_address); setResendFromName(mailer.resend.from_name)
      setBrevoFromAddress(mailer.brevo.from_address); setBrevoFromName(mailer.brevo.from_name)
    }
    setM365ClientSecret('')
    setResendApiKey('')
    setBrevoApiKey('')
    setDirty(false)
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[9px] font-black uppercase tracking-[0.25em] text-[var(--ds-text-3)] mb-1">Admin Dashboard</p>
        <h1 className="text-3xl font-black italic tracking-tighter uppercase">Settings</h1>
      </div>

      <div className="flex gap-8 items-start">

      {/* ── Main sections ── */}
      <div className="flex-1 min-w-0 max-w-2xl space-y-6 pb-32">

      {/* Branding */}
      <div ref={el => { secRefs.current.branding = el }} className="bg-[var(--ds-bg-surface)] rounded-2xl border border-[var(--ds-border-sub)] p-6 space-y-6">
        <div>
          <p className="text-[13px] font-black uppercase tracking-wider text-[var(--ds-text-1)]">Branding</p>
          <p className="text-[12px] text-[var(--ds-text-3)] mt-0.5">Customize the app name and logo shown in the navbar and throughout the app.</p>
        </div>

        {/* App Name */}
        <div className="space-y-2">
          <label className="text-[9px] font-black uppercase tracking-widest text-[var(--ds-text-3)] px-1">App Name</label>
          <input
            type="text"
            value={appName}
            onChange={e => onAppNameChange(e.target.value)}
            maxLength={100}
            className="w-full bg-[var(--ds-bg-raised)] border border-[var(--ds-border)] rounded-xl px-4 py-2.5 text-[14px] font-black text-[var(--ds-text-1)] focus:outline-none focus:ring-2 focus:ring-[#adee2b] transition-all"
            placeholder="RoomSync Pro"
          />
          <p className="text-[10px] text-[var(--ds-text-3)] px-1">Updates navbar, page title, and all app references.</p>
        </div>

        {/* App Full Name */}
        <div className="space-y-2">
          <label className="text-[9px] font-black uppercase tracking-widest text-[var(--ds-text-3)] px-1">App Full Name (optional)</label>
          <input
            type="text"
            value={appFullName}
            onChange={e => onAppFullNameChange(e.target.value)}
            maxLength={150}
            className="w-full bg-[var(--ds-bg-raised)] border border-[var(--ds-border)] rounded-xl px-4 py-2.5 text-[14px] font-semibold text-[var(--ds-text-1)] focus:outline-none focus:ring-2 focus:ring-[#adee2b] transition-all"
            placeholder="e.g. Meeting Room Booking System"
          />
          <p className="text-[10px] text-[var(--ds-text-3)] px-1">Shown as a subtitle next to the app name on the login page. Leave empty to hide it.</p>
        </div>

        {/* Logo Upload */}
        <div className="space-y-2">
          <label className="text-[9px] font-black uppercase tracking-widest text-[var(--ds-text-3)] px-1">Navbar Logo</label>
          {appLogoUrl ? (
            <div className="flex items-center gap-4">
              <div className="h-16 min-w-16 max-w-[220px] rounded-2xl overflow-hidden bg-white flex items-center justify-center shrink-0 px-2">
                <img src={appLogoUrl} alt="App logo" className="h-full w-auto max-w-[204px] object-contain" />
              </div>
              <div className="space-y-2">
                <p className="text-[12px] font-semibold text-[var(--ds-text-2)]">Custom logo active</p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => logoInputRef.current?.click()}
                    disabled={logoUploading}
                    className="px-3 py-1.5 text-[10px] font-black uppercase rounded-lg bg-[var(--ds-bg-raised)] border border-[var(--ds-border)] text-[var(--ds-text-2)] hover:border-[#adee2b] transition-all disabled:opacity-50"
                  >
                    Replace
                  </button>
                  <button
                    type="button"
                    onClick={handleDeleteLogo}
                    disabled={logoUploading}
                    className="px-3 py-1.5 text-[10px] font-black uppercase rounded-lg bg-red-500/10 border border-red-500/20 text-red-500 hover:bg-red-500/20 transition-all disabled:opacity-50"
                  >
                    Remove
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <label htmlFor="app-logo-upload-input" className="flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed cursor-pointer transition-all hover:border-[#adee2b] hover:bg-[#adee2b]/5"
              style={{ borderColor: 'var(--ds-border)', minHeight: 100 }}>
              {logoUploading
                ? <span className="text-[12px] font-semibold text-[var(--ds-text-3)]">Uploading...</span>
                : <>
                  <span className="material-symbols-outlined text-[var(--ds-text-3)]" style={{ fontSize: 28 }}>add_photo_alternate</span>
                  <span className="text-[11px] font-black text-[var(--ds-text-3)] uppercase tracking-wide">Click to upload logo</span>
                  <span className="text-[9px] text-[var(--ds-text-4)]">PNG, SVG, JPG · max 8 MB · square or rectangular</span>
                </>
              }
            </label>
          )}
          <input id="app-logo-upload-input" ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
          <p className="text-[10px] text-[var(--ds-text-3)] px-1">Appears in the navbar. Square or rectangular images both work (logo fits a 36px-tall slot, up to 160px wide). Leave empty to use the default icon.</p>
        </div>

        {/* Login Page */}
        <div className="space-y-3 pt-2 border-t" style={{ borderColor: 'var(--ds-border-sub)' }}>
          <div className="pt-3">
            <label className="text-[9px] font-black uppercase tracking-widest text-[var(--ds-text-3)] px-1">Login Page</label>
            <p className="text-[12px] text-[var(--ds-text-3)] mt-0.5">Customize the photo and copy shown on the left panel of the login screen.</p>
          </div>

          <div className="flex flex-col sm:flex-row gap-5">
            {/* Live preview */}
            <div className="shrink-0 mx-auto sm:mx-0">
              <div
                className="w-[200px] aspect-[4/5] rounded-2xl overflow-hidden relative border"
                style={{
                  borderColor: 'var(--ds-border)',
                  backgroundImage: loginPhotoUrl
                    ? `linear-gradient(180deg, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0.8) 100%), url(${loginPhotoUrl})`
                    : 'radial-gradient(130% 130% at 15% 10%, #1a1f08 0%, #0c0c0c 55%, #000 100%)',
                  backgroundSize: 'cover',
                  backgroundPosition: loginPhotoUrl ? `${loginPhotoPosX}% ${loginPhotoPosY}%` : 'center',
                }}
              >
                <div className="absolute inset-0 p-3.5 flex flex-col justify-end">
                  <div>
                    <p className="text-[6.5px] font-black uppercase tracking-[0.2em] text-[#adee2b] mb-1 truncate">{loginHeadline || 'Booking made easy'}</p>
                    <p className="text-[9.5px] font-black italic uppercase leading-snug text-white line-clamp-3">{loginSubheadline || 'Book meeting rooms without the back-and-forth'}</p>
                  </div>
                </div>
              </div>
              <p className="text-[9px] text-[var(--ds-text-4)] text-center mt-1.5">Live preview</p>
            </div>

            {/* Controls */}
            <div className="flex-1 space-y-4 min-w-0">
              {/* Photo upload */}
              {loginPhotoUrl ? (
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-[12px] font-semibold text-[var(--ds-text-2)] flex-1 min-w-[120px]">Custom photo active</p>
                  <button
                    type="button"
                    onClick={() => loginPhotoInputRef.current?.click()}
                    disabled={loginPhotoUploading}
                    className="px-3 py-1.5 text-[10px] font-black uppercase rounded-lg bg-[var(--ds-bg-raised)] border border-[var(--ds-border)] text-[var(--ds-text-2)] hover:border-[#adee2b] transition-all disabled:opacity-50"
                  >
                    Replace
                  </button>
                  <button
                    type="button"
                    onClick={handleDeleteLoginPhoto}
                    disabled={loginPhotoUploading}
                    className="px-3 py-1.5 text-[10px] font-black uppercase rounded-lg bg-red-500/10 border border-red-500/20 text-red-500 hover:bg-red-500/20 transition-all disabled:opacity-50"
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <label htmlFor="login-photo-upload-input" className="flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed cursor-pointer transition-all hover:border-[#adee2b] hover:bg-[#adee2b]/5"
                  style={{ borderColor: 'var(--ds-border)', minHeight: 90 }}>
                  {loginPhotoUploading
                    ? <span className="text-[12px] font-semibold text-[var(--ds-text-3)]">Uploading...</span>
                    : <>
                      <span className="material-symbols-outlined text-[var(--ds-text-3)]" style={{ fontSize: 24 }}>add_photo_alternate</span>
                      <span className="text-[11px] font-black text-[var(--ds-text-3)] uppercase tracking-wide">Click to upload photo</span>
                      <span className="text-[9px] text-[var(--ds-text-4)]">JPG or PNG · max 8 MB · any aspect ratio</span>
                    </>
                  }
                </label>
              )}
              <input id="login-photo-upload-input" ref={loginPhotoInputRef} type="file" accept="image/*" className="hidden" onChange={handleLoginPhotoUpload} />

              {/* Position adjustment */}
              {loginPhotoUrl && (
                <div className="space-y-2">
                  <label className="text-[9px] font-black uppercase tracking-widest text-[var(--ds-text-3)] px-1">Photo Position (fits the frame)</label>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-[var(--ds-text-3)] w-14 shrink-0">Horizontal</span>
                    <input type="range" min={0} max={100} value={loginPhotoPosX} onChange={e => onLoginPhotoPosChange('x', Number(e.target.value))} className="flex-1 accent-[#adee2b]" />
                    <span className="text-[10px] font-bold text-[var(--ds-text-3)] w-8 text-right">{loginPhotoPosX}%</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-[var(--ds-text-3)] w-14 shrink-0">Vertical</span>
                    <input type="range" min={0} max={100} value={loginPhotoPosY} onChange={e => onLoginPhotoPosChange('y', Number(e.target.value))} className="flex-1 accent-[#adee2b]" />
                    <span className="text-[10px] font-bold text-[var(--ds-text-3)] w-8 text-right">{loginPhotoPosY}%</span>
                  </div>
                </div>
              )}

              {/* Copy */}
              <div className="space-y-1.5">
                <label className="text-[9px] font-black uppercase text-[var(--ds-text-3)] tracking-wider px-1">Small headline</label>
                <input
                  type="text"
                  value={loginHeadline}
                  onChange={e => onLoginHeadlineChange(e.target.value)}
                  maxLength={120}
                  className="w-full bg-[var(--ds-bg-raised)] border border-[var(--ds-border)] rounded-xl px-3 py-2 text-sm font-semibold text-[var(--ds-text-1)] focus:outline-none focus:ring-2 focus:ring-[#adee2b]"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[9px] font-black uppercase text-[var(--ds-text-3)] tracking-wider px-1">Headline</label>
                <textarea
                  value={loginSubheadline}
                  onChange={e => onLoginSubheadlineChange(e.target.value)}
                  maxLength={200}
                  rows={2}
                  className="w-full bg-[var(--ds-bg-raised)] border border-[var(--ds-border)] rounded-xl px-3 py-2 text-sm font-semibold text-[var(--ds-text-1)] focus:outline-none focus:ring-2 focus:ring-[#adee2b] resize-none"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[9px] font-black uppercase text-[var(--ds-text-3)] tracking-wider px-1">Footer text</label>
                <input
                  type="text"
                  value={loginFooterText}
                  onChange={e => onLoginFooterTextChange(e.target.value)}
                  maxLength={150}
                  placeholder={`${appName || 'RoomSync Pro'} · ${new Date().getFullYear()}`}
                  className="w-full bg-[var(--ds-bg-raised)] border border-[var(--ds-border)] rounded-xl px-3 py-2 text-sm font-semibold text-[var(--ds-text-1)] focus:outline-none focus:ring-2 focus:ring-[#adee2b]"
                />
                <p className="text-[10.5px] text-[var(--ds-text-4)] px-1">Shown at the bottom of the login screen and the Timeline page. Leave blank to use "{appName || 'RoomSync Pro'} · {new Date().getFullYear()}".</p>
              </div>
            </div>
          </div>
        </div>

        {/* Favicon guide */}
        <div className="rounded-xl p-4 space-y-2" style={{ background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.15)' }}>
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined" style={{ fontSize: 16, color: '#6366f1' }}>info</span>
            <p className="text-[11px] font-black uppercase tracking-wider" style={{ color: '#6366f1' }}>Changing the Favicon (Browser Tab Icon)</p>
          </div>
          <p className="text-[11px] text-[var(--ds-text-2)] leading-relaxed">The browser tab icon is bundled at build time and cannot be changed here. To update it:</p>
          <ol className="text-[11px] text-[var(--ds-text-2)] leading-relaxed list-decimal list-inside space-y-1">
            <li>Prepare a square icon (32×32 or 64×64 px) in <strong>SVG or PNG</strong> format.</li>
            <li>Rename it to <code className="bg-black/10 dark:bg-white/10 px-1 rounded text-[10px]">favicon.svg</code>.</li>
            <li>Replace the file at <code className="bg-black/10 dark:bg-white/10 px-1 rounded text-[10px]">client/public/favicon.svg</code>.</li>
            <li>Rebuild the frontend (<code className="bg-black/10 dark:bg-white/10 px-1 rounded text-[10px]">npm run build</code>) for the change to take effect.</li>
          </ol>
        </div>
      </div>

      {/* Booking Hours — keep save button (destructive) */}
      <div ref={el => { secRefs.current.hours = el }} className="bg-[var(--ds-bg-surface)] rounded-2xl border border-[var(--ds-border-sub)] p-6 space-y-5">
        <div>
          <p className="text-[13px] font-black uppercase tracking-wider text-[var(--ds-text-1)]">Booking Hours</p>
          <p className="text-[12px] text-[var(--ds-text-3)] mt-0.5">Set the global time window during which rooms can be booked.</p>
        </div>
        <div className="p-3.5 rounded-xl text-[10px] font-semibold leading-relaxed" style={{ background: 'rgba(217,119,6,0.10)', border: '1px solid rgba(217,119,6,0.25)', color: '#f59e0b' }}>
          <span className="font-black">Warning:</span> Tightening these hours will automatically trim or cancel existing future bookings that fall outside the new window.
        </div>
        <div className="flex items-end gap-4">
          <div className="space-y-1.5">
            <label className="text-[9px] font-black uppercase text-[var(--ds-text-3)] tracking-wider px-1">Start Time</label>
            <GlassTimePicker value={localStart} onChange={setLocalStart} min="00:00" max="23:00" step={30} panelWidth={140}>
              {() => (<button type="button" className="flex items-center gap-2 bg-[var(--ds-bg-raised)] border border-[var(--ds-border)] rounded-xl text-[13px] font-black px-4 py-2.5 hover:border-[#adee2b] transition-all tabular-nums text-[var(--ds-text-1)]"><span className="material-symbols-outlined text-[var(--ds-text-3)]" style={{ fontSize: 16 }}>schedule</span>{localStart}</button>)}
            </GlassTimePicker>
          </div>
          <span className="text-[var(--ds-text-3)] text-lg font-black pb-2.5">→</span>
          <div className="space-y-1.5">
            <label className="text-[9px] font-black uppercase text-[var(--ds-text-3)] tracking-wider px-1">End Time</label>
            <GlassTimePicker value={localEnd} onChange={setLocalEnd} min="00:30" max="23:30" step={30} panelWidth={140}>
              {() => (<button type="button" className="flex items-center gap-2 bg-[var(--ds-bg-raised)] border border-[var(--ds-border)] rounded-xl text-[13px] font-black px-4 py-2.5 hover:border-[#adee2b] transition-all tabular-nums text-[var(--ds-text-1)]"><span className="material-symbols-outlined text-[var(--ds-text-3)]" style={{ fontSize: 16 }}>schedule</span>{localEnd}</button>)}
            </GlassTimePicker>
          </div>
        </div>
        {!isValid && <p className="text-[10px] text-red-500 font-semibold">End time must be at least 30 minutes after start time.</p>}
        {hoursError && <p className="text-[10px] text-red-500 font-semibold">Failed to save. Please try again.</p>}
        {saved && (
          <div className="p-3 bg-[#f0ffe0] border border-[#adee2b] rounded-xl text-[10px] font-semibold text-[var(--ds-text-1)]">
            Saved. {saved.trimmed > 0 && <span>{saved.trimmed} booking{saved.trimmed !== 1 ? 's' : ''} trimmed. </span>}
            {saved.cancelled > 0 && <span>{saved.cancelled} booking{saved.cancelled !== 1 ? 's' : ''} cancelled.</span>}
            {saved.trimmed === 0 && saved.cancelled === 0 && <span>No existing bookings were affected.</span>}
          </div>
        )}
        <button type="button" onClick={() => saveHours()} disabled={!isValid || hoursPending}
          className="px-5 py-2.5 bg-black text-[#adee2b] text-[10px] font-black uppercase rounded-xl hover:opacity-80 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed">
          {hoursPending ? 'Saving...' : 'Save Changes'}
        </button>
      </div>

      {/* Weekend */}
      <div ref={el => { secRefs.current.weekend = el }} className="bg-[var(--ds-bg-surface)] rounded-2xl border border-[var(--ds-border-sub)] p-6 space-y-5">
        <div>
          <p className="text-[13px] font-black uppercase tracking-wider text-[var(--ds-text-1)]">Weekend (Red Dates)</p>
          <p className="text-[12px] text-[var(--ds-text-3)] mt-0.5">Mark Saturday and/or Sunday as weekend days — shown in red on all calendars.</p>
        </div>
        <div className="space-y-3">
          {([{ label: 'Saturday', val: wkSat, toggle: toggleSat }, { label: 'Sunday', val: wkSun, toggle: toggleSun }] as const).map(({ label, val, toggle }, i) => (
            <div key={label}>
              {i > 0 && <div className="border-t border-[var(--ds-border-sub)] mb-3" />}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="size-10 rounded-2xl flex items-center justify-center" style={{ background: val ? 'rgba(239,68,68,0.1)' : 'rgba(0,0,0,0.04)' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 20, color: val ? '#ef4444' : '#94a3b8' }}>calendar_today</span>
                  </div>
                  <div>
                    <p className="text-[14px] font-black text-[var(--ds-text-1)]">{label}</p>
                    <p className="text-[11px] text-[var(--ds-text-3)] font-bold uppercase tracking-wider">{val ? 'Shown as red / weekend' : 'Regular day'}</p>
                  </div>
                </div>
                <ToggleSwitch checked={val} onChange={toggle} onColor="#ef4444" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* System */}
      <div ref={el => { secRefs.current.system = el }} className="bg-[var(--ds-bg-surface)] rounded-2xl border border-[var(--ds-border-sub)] p-6 space-y-5">
        <div>
          <p className="text-[13px] font-black uppercase tracking-wider text-[var(--ds-text-1)]">System</p>
          <p className="text-[12px] text-[var(--ds-text-3)] mt-0.5">Core runtime configuration for the application.</p>
        </div>

        {/* Business Timezone */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(99,102,241,0.1)' }}>
              <span className="material-symbols-outlined" style={{ fontSize: 20, color: '#6366f1' }}>schedule</span>
            </div>
            <div>
              <p className="text-[14px] font-black text-[var(--ds-text-1)]">Business Timezone</p>
              <p className="text-[11px] text-[var(--ds-text-3)] font-bold uppercase tracking-wider">Used for booking logic, schedules &amp; exports</p>
            </div>
          </div>
          <select value={businessTz} onChange={e => onBusinessTzChange(e.target.value)}
            className="text-[13px] font-bold bg-[var(--ds-bg-raised)] border border-[var(--ds-border)] rounded-xl px-3 py-2 focus:ring-2 focus:ring-[#adee2b] focus:outline-none text-[var(--ds-text-1)]">
            <optgroup label="Asia — Indonesia">
              <option value="Asia/Jakarta">Asia/Jakarta (WIB, UTC+7)</option>
              <option value="Asia/Makassar">Asia/Makassar (WITA, UTC+8)</option>
              <option value="Asia/Jayapura">Asia/Jayapura (WIT, UTC+9)</option>
            </optgroup>
            <optgroup label="Asia — Southeast">
              <option value="Asia/Singapore">Asia/Singapore (SGT, UTC+8)</option>
              <option value="Asia/Kuala_Lumpur">Asia/Kuala_Lumpur (MYT, UTC+8)</option>
              <option value="Asia/Bangkok">Asia/Bangkok (ICT, UTC+7)</option>
              <option value="Asia/Manila">Asia/Manila (PHT, UTC+8)</option>
              <option value="Asia/Ho_Chi_Minh">Asia/Ho_Chi_Minh (ICT, UTC+7)</option>
            </optgroup>
            <optgroup label="Asia — East">
              <option value="Asia/Tokyo">Asia/Tokyo (JST, UTC+9)</option>
              <option value="Asia/Seoul">Asia/Seoul (KST, UTC+9)</option>
              <option value="Asia/Shanghai">Asia/Shanghai (CST, UTC+8)</option>
              <option value="Asia/Hong_Kong">Asia/Hong_Kong (HKT, UTC+8)</option>
            </optgroup>
            <optgroup label="Asia — South &amp; West">
              <option value="Asia/Kolkata">Asia/Kolkata (IST, UTC+5:30)</option>
              <option value="Asia/Dubai">Asia/Dubai (GST, UTC+4)</option>
              <option value="Asia/Riyadh">Asia/Riyadh (AST, UTC+3)</option>
            </optgroup>
            <optgroup label="Europe">
              <option value="Europe/London">Europe/London (GMT/BST)</option>
              <option value="Europe/Paris">Europe/Paris (CET, UTC+1)</option>
            </optgroup>
            <optgroup label="Americas">
              <option value="America/New_York">America/New_York (EST, UTC-5)</option>
              <option value="America/Los_Angeles">America/Los_Angeles (PST, UTC-8)</option>
            </optgroup>
            <optgroup label="Other">
              <option value="UTC">UTC</option>
            </optgroup>
          </select>
        </div>
      </div>

      {/* Booking Rules */}
      <div ref={el => { secRefs.current.rules = el }} className="bg-[var(--ds-bg-surface)] rounded-2xl border border-[var(--ds-border-sub)] p-6 space-y-5">
        <div>
          <p className="text-[13px] font-black uppercase tracking-wider text-[var(--ds-text-1)]">Booking Rules</p>
          <p className="text-[12px] text-[var(--ds-text-3)] mt-0.5">Control how users can create bookings across the system.</p>
        </div>

        {/* Max advance days */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(99,102,241,0.1)' }}>
              <span className="material-symbols-outlined" style={{ fontSize: 20, color: '#6366f1' }}>event_upcoming</span>
            </div>
            <div>
              <p className="text-[14px] font-black text-[var(--ds-text-1)]">Max Advance Booking</p>
              <p className="text-[11px] text-[var(--ds-text-3)] font-bold uppercase tracking-wider">How many days ahead users can book</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input type="number" min={1} max={365} value={maxDays}
              onChange={e => onMaxDaysChange(Math.max(1, Math.min(365, Number(e.target.value))))}
              className="w-16 text-center text-[13px] font-black bg-[var(--ds-bg-raised)] border border-[var(--ds-border)] rounded-xl p-2 focus:ring-2 focus:ring-[#adee2b] focus:outline-none text-[var(--ds-text-1)]" />
            <span className="text-[12px] font-bold text-[var(--ds-text-3)]">days</span>
          </div>
        </div>

        <div className="border-t border-[var(--ds-border-sub)]" />

        {/* Meeting title max length */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(99,102,241,0.1)' }}>
              <span className="material-symbols-outlined" style={{ fontSize: 20, color: '#6366f1' }}>short_text</span>
            </div>
            <div>
              <p className="text-[14px] font-black text-[var(--ds-text-1)]">Meeting Title Max Length</p>
              <p className="text-[11px] text-[var(--ds-text-3)] font-bold uppercase tracking-wider">Keeps long titles from breaking the UI/exports</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input type="number" min={10} max={255} value={titleMaxLen}
              onChange={e => { setTitleMaxLen(Math.max(10, Math.min(255, Number(e.target.value)))); setDirty(true) }}
              className="w-16 text-center text-[13px] font-black bg-[var(--ds-bg-raised)] border border-[var(--ds-border)] rounded-xl p-2 focus:ring-2 focus:ring-[#adee2b] focus:outline-none text-[var(--ds-text-1)]" />
            <span className="text-[12px] font-bold text-[var(--ds-text-3)]">chars</span>
          </div>
        </div>

        <div className="border-t border-[var(--ds-border-sub)]" />

        {/* Meeting description max length */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(99,102,241,0.1)' }}>
              <span className="material-symbols-outlined" style={{ fontSize: 20, color: '#6366f1' }}>notes</span>
            </div>
            <div>
              <p className="text-[14px] font-black text-[var(--ds-text-1)]">Meeting Description Max Length</p>
              <p className="text-[11px] text-[var(--ds-text-3)] font-bold uppercase tracking-wider">Keeps long descriptions from breaking the UI/exports</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input type="number" min={10} max={1000} value={descMaxLen}
              onChange={e => { setDescMaxLen(Math.max(10, Math.min(1000, Number(e.target.value)))); setDirty(true) }}
              className="w-16 text-center text-[13px] font-black bg-[var(--ds-bg-raised)] border border-[var(--ds-border)] rounded-xl p-2 focus:ring-2 focus:ring-[#adee2b] focus:outline-none text-[var(--ds-text-1)]" />
            <span className="text-[12px] font-bold text-[var(--ds-text-3)]">chars</span>
          </div>
        </div>

        <div className="border-t border-[var(--ds-border-sub)]" />

        {/* Allow book for others */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-2xl flex items-center justify-center" style={{ background: allowBookFor ? 'rgba(173,238,43,0.12)' : 'rgba(0,0,0,0.04)' }}>
              <span className="material-symbols-outlined" style={{ fontSize: 20, color: allowBookFor ? '#4d7c00' : '#94a3b8' }}>person_add</span>
            </div>
            <div>
              <p className="text-[14px] font-black text-[var(--ds-text-1)]">Book on Behalf of Others</p>
              <p className="text-[11px] text-[var(--ds-text-3)] font-bold uppercase tracking-wider">{allowBookFor ? 'Users can book for others' : 'Disabled — own bookings only'}</p>
            </div>
          </div>
          <ToggleSwitch checked={allowBookFor} onChange={toggleAllowBookFor} />
        </div>

        <div className="border-t border-[var(--ds-border-sub)]" />

        {/* After-hours restriction */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-2xl flex items-center justify-center" style={{ background: restrictAH ? 'rgba(99,102,241,0.1)' : 'rgba(0,0,0,0.04)' }}>
                <span className="material-symbols-outlined" style={{ fontSize: 20, color: restrictAH ? '#6366f1' : '#94a3b8' }}>schedule</span>
              </div>
              <div>
                <p className="text-[14px] font-black text-[var(--ds-text-1)]">After-Hours Restriction</p>
                <p className="text-[11px] text-[var(--ds-text-3)] font-bold uppercase tracking-wider">{restrictAH ? `Users cannot book after ${workEnd}` : 'No restriction — any booking hour'}</p>
              </div>
            </div>
            <button type="button" onClick={toggleRestrictAH} className="relative shrink-0" style={{ width: 44, height: 24 }}>
              <div className="absolute inset-0 rounded-full transition-colors" style={{ background: restrictAH ? '#6366f1' : '#e2e8f0' }} />
              <div className="absolute top-1 transition-all rounded-full bg-white shadow-sm" style={{ width: 16, height: 16, left: restrictAH ? 24 : 4 }} />
            </button>
          </div>
          {restrictAH && (
            <div className="flex items-center gap-3 pl-11">
              <p className="text-[10px] font-black text-[var(--ds-text-2)] uppercase tracking-wider">Working hours end:</p>
              <GlassTimePicker value={workEnd} onChange={onWorkEndChange} min="12:00" max="22:00" step={30} panelWidth={140}>
                {() => (<button type="button" className="flex items-center gap-2 bg-[var(--ds-bg-raised)] border border-[var(--ds-border)] rounded-xl text-[12px] font-black px-3 py-2 hover:border-[#adee2b] transition-all tabular-nums text-[var(--ds-text-1)]"><span className="material-symbols-outlined text-[var(--ds-text-3)]" style={{ fontSize: 14 }}>schedule</span>{workEnd}</button>)}
              </GlassTimePicker>
            </div>
          )}
        </div>
      </div>

      {/* Anti-Ghost Booking */}
      <div ref={el => { secRefs.current.ghost = el }} className="bg-[var(--ds-bg-surface)] rounded-2xl border border-[var(--ds-border-sub)] p-6 space-y-5">
        <div>
          <p className="text-[13px] font-black uppercase tracking-wider text-[var(--ds-text-1)]">Anti-Ghost Booking</p>
          <p className="text-[12px] text-[var(--ds-text-3)] mt-0.5">Auto-cancel bookings where no one shows up. Requires presence confirmation on the kiosk within 10 minutes of start time.</p>
        </div>

        {/* Master toggle */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-2xl flex items-center justify-center" style={{ background: antiGhostEnabled ? 'rgba(173,238,43,0.12)' : 'var(--ds-bg-raised)' }}>
              <span className="material-symbols-outlined" style={{ fontSize: 20, color: antiGhostEnabled ? '#4d7c00' : '#94a3b8' }}>person_off</span>
            </div>
            <div>
              <p className="text-[14px] font-black text-[var(--ds-text-1)]">Enable Anti-Ghost</p>
              <p className="text-[11px] text-[var(--ds-text-3)] font-bold uppercase tracking-wider">
                {antiGhostEnabled ? 'Unconfirmed bookings are auto-cancelled after +10 min' : 'No-show detection is off'}
              </p>
            </div>
          </div>
          <button type="button" onClick={toggleAntiGhost} className="relative shrink-0" style={{ width: 44, height: 24 }}>
            <div className="absolute inset-0 rounded-full transition-colors" style={{ background: antiGhostEnabled ? '#adee2b' : 'var(--ds-bg-raised)', border: '1px solid var(--ds-border)' }} />
            <div className="absolute top-[3px] transition-all rounded-full" style={{ width: 18, height: 18, background: antiGhostEnabled ? '#1a3a00' : 'var(--ds-text-3)', left: antiGhostEnabled ? 22 : 3 }} />
          </button>
        </div>

        {antiGhostEnabled && (
          <>
            <div className="border-t border-[var(--ds-border-sub)]" />
            <div>
              <p className="text-[11px] font-black uppercase tracking-wider text-[var(--ds-text-3)] mb-1">Confirmation Method</p>
              <p className="text-[10px] font-medium text-[var(--ds-text-4)] mb-3">At least one must be selected — booking confirmed if any method detects presence. Deselecting all disables Anti-Ghost.</p>
              <div className="grid grid-cols-2 gap-2">
                {([
                  { key: 'kiosk',  label: 'Kiosk',       icon: 'tablet',      desc: 'User taps Confirm on the room kiosk device' },
                  { key: 'sensor', label: 'Sensor',       icon: 'sensors',     desc: 'Motion/occupancy sensor auto-confirms via ESP32 ping' },
                  { key: 'web',    label: 'Web Confirm',  icon: 'how_to_reg',  desc: 'User confirms from My Schedule or notification in the app' },
                  { key: 'email',  label: 'Email',        icon: 'mail',        desc: 'Confirm/Cancel link sent in the reminder email, no login needed' },
                ] as const).map(opt => {
                  const sel = opt.key === 'web' ? webConfirmEnabled : opt.key === 'email' ? antiGhostEmailEnabled : antiGhostModes.has(opt.key)
                  return (
                    <button key={opt.key} type="button"
                      onClick={() => toggleMethod(opt.key)}
                      className="flex-1 flex flex-col gap-2 p-4 rounded-xl text-left transition-all"
                      style={{
                        background: sel ? 'rgba(173,238,43,0.07)' : 'var(--ds-bg-raised)',
                        border: sel ? '2px solid rgba(173,238,43,0.55)' : '2px solid var(--ds-border)',
                        cursor: 'pointer',
                      }}>
                      <div className="flex items-center gap-2.5">
                        <div className="size-4 rounded-md flex items-center justify-center shrink-0 transition-all"
                          style={{ background: sel ? '#adee2b' : 'var(--ds-bg-surface)', border: sel ? '2px solid #adee2b' : '2px solid var(--ds-border)' }}>
                          {sel && <span className="material-symbols-outlined text-black" style={{ fontSize: 11, fontVariationSettings: "'wght' 900" }}>check</span>}
                        </div>
                        <span className="material-symbols-outlined" style={{ fontSize: 16, color: sel ? '#4d7c00' : 'var(--ds-text-3)' }}>{opt.icon}</span>
                        <span className="text-[12px] font-black" style={{ color: sel ? 'var(--ds-text-1)' : 'var(--ds-text-2)' }}>{opt.label}</span>
                      </div>
                      <p className="text-[10px] font-medium leading-relaxed" style={{ color: sel ? 'var(--ds-text-3)' : 'var(--ds-text-4)' }}>{opt.desc}</p>
                    </button>
                  )
                })}
              </div>
            </div>
            {/* Confirmation time window */}
            <div>
              <p className="text-[11px] font-black uppercase tracking-wider text-[var(--ds-text-3)] mb-3">Confirmation Window</p>
              <p className="text-[10px] text-[var(--ds-text-4)] font-medium mb-4">
                How many minutes before/after the booking start time the confirm button is available. Auto-cancel fires when the window closes with no confirmation.
              </p>

              {/* Visual timeline */}
              <div className="relative h-8 mb-4 flex items-center">
                <div className="absolute inset-x-0 h-px bg-[var(--ds-border)]" />
                {/* Window highlight */}
                <div className="absolute h-2.5 rounded-full" style={{
                  left:  `${50 - (ghostWindowBefore / 20) * 50}%`,
                  right: `${50 - (ghostWindowAfter  / 20) * 50}%`,
                  background: 'rgba(99,102,241,0.25)',
                  border: '1px solid rgba(99,102,241,0.5)',
                  minWidth: 4,
                }} />
                {/* Start marker */}
                <div className="absolute left-1/2 -translate-x-1/2 flex flex-col items-center gap-1">
                  <div className="w-px h-4 bg-[#adee2b]" />
                  <span className="text-[8px] font-black uppercase tracking-wider text-[#adee2b]">Start</span>
                </div>
                {/* Before label */}
                <span className="absolute left-0 text-[9px] font-black text-[#6366f1]">-{ghostWindowBefore}m</span>
                {/* After label */}
                <span className="absolute right-0 text-[9px] font-black text-[#6366f1]">+{ghostWindowAfter}m</span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[9px] font-black uppercase tracking-wider text-[var(--ds-text-3)] block mb-1.5">
                    Opens before start <span className="text-[var(--ds-text-4)] normal-case">(0–20 min)</span>
                  </label>
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={() => onGhostWindowBeforeChange(ghostWindowBefore - 1)} disabled={ghostWindowBefore <= 0}
                      className="size-7 flex items-center justify-center rounded-lg text-[var(--ds-text-2)] disabled:opacity-30 transition-colors"
                      style={{ background: 'var(--ds-bg-raised)', border: '1px solid var(--ds-border)' }}>
                      <span className="material-symbols-outlined" style={{ fontSize: 14 }}>remove</span>
                    </button>
                    <input type="number" min={0} max={20} value={ghostWindowBefore}
                      onChange={e => onGhostWindowBeforeChange(Number(e.target.value))}
                      className="w-14 text-center text-[13px] font-black bg-[var(--ds-bg-raised)] border border-[var(--ds-border)] rounded-xl p-2 focus:ring-2 focus:ring-[#6366f1] focus:outline-none text-[var(--ds-text-1)]" />
                    <button type="button" onClick={() => onGhostWindowBeforeChange(ghostWindowBefore + 1)} disabled={ghostWindowBefore >= 20}
                      className="size-7 flex items-center justify-center rounded-lg text-[var(--ds-text-2)] disabled:opacity-30 transition-colors"
                      style={{ background: 'var(--ds-bg-raised)', border: '1px solid var(--ds-border)' }}>
                      <span className="material-symbols-outlined" style={{ fontSize: 14 }}>add</span>
                    </button>
                    <span className="text-[11px] font-bold text-[var(--ds-text-3)]">min</span>
                  </div>
                </div>
                <div>
                  <label className="text-[9px] font-black uppercase tracking-wider text-[var(--ds-text-3)] block mb-1.5">
                    Closes after start <span className="text-[var(--ds-text-4)] normal-case">(0–20 min)</span>
                  </label>
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={() => onGhostWindowAfterChange(ghostWindowAfter - 1)} disabled={ghostWindowAfter <= 0}
                      className="size-7 flex items-center justify-center rounded-lg text-[var(--ds-text-2)] disabled:opacity-30 transition-colors"
                      style={{ background: 'var(--ds-bg-raised)', border: '1px solid var(--ds-border)' }}>
                      <span className="material-symbols-outlined" style={{ fontSize: 14 }}>remove</span>
                    </button>
                    <input type="number" min={0} max={20} value={ghostWindowAfter}
                      onChange={e => onGhostWindowAfterChange(Number(e.target.value))}
                      className="w-14 text-center text-[13px] font-black bg-[var(--ds-bg-raised)] border border-[var(--ds-border)] rounded-xl p-2 focus:ring-2 focus:ring-[#6366f1] focus:outline-none text-[var(--ds-text-1)]" />
                    <button type="button" onClick={() => onGhostWindowAfterChange(ghostWindowAfter + 1)} disabled={ghostWindowAfter >= 20}
                      className="size-7 flex items-center justify-center rounded-lg text-[var(--ds-text-2)] disabled:opacity-30 transition-colors"
                      style={{ background: 'var(--ds-bg-raised)', border: '1px solid var(--ds-border)' }}>
                      <span className="material-symbols-outlined" style={{ fontSize: 14 }}>add</span>
                    </button>
                    <span className="text-[11px] font-bold text-[var(--ds-text-3)]">min</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Sensor API Token — only when sensor mode active */}
            {antiGhostModes.has('sensor') && (
              <div>
                <p className="text-[11px] font-black uppercase tracking-wider text-[var(--ds-text-3)] mb-1">Sensor API Token</p>
                <p className="text-[10px] font-medium text-[var(--ds-text-4)] mb-3">
                  Flash this token into your ESP32 as the <code className="font-mono bg-[var(--ds-bg-raised)] px-1 py-0.5 rounded text-[9px]">X-Sensor-Token</code> header. Each room has its own <strong>Sensor Code</strong> visible in the Buildings tab.
                </p>
                <div className="flex items-center gap-2 p-3 rounded-xl" style={{ background: 'var(--ds-bg-raised)', border: '1px solid var(--ds-border)' }}>
                  <span className="material-symbols-outlined shrink-0" style={{ fontSize: 16, color: 'var(--ds-text-3)' }}>key</span>
                  <code className="flex-1 text-[11px] font-mono text-[var(--ds-text-2)] truncate">{general?.sensor_api_token ?? '—'}</code>
                  <button type="button"
                    onClick={() => { if (general?.sensor_api_token) { navigator.clipboard.writeText(general.sensor_api_token).then(() => addInfoToast('Sensor token copied')) } }}
                    className="shrink-0 size-7 flex items-center justify-center rounded-lg transition-colors"
                    style={{ background: 'var(--ds-bg-surface)', border: '1px solid var(--ds-border)' }}
                    title="Copy token">
                    <span className="material-symbols-outlined" style={{ fontSize: 14, color: 'var(--ds-text-3)' }}>content_copy</span>
                  </button>
                  <button type="button"
                    onClick={async () => {
                      const newToken = Array.from(crypto.getRandomValues(new Uint8Array(16))).map(b => b.toString(16).padStart(2, '0')).join('')
                      await saveGeneralNow({ sensor_api_token: newToken }, 'Sensor API token regenerated')
                    }}
                    className="shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-black transition-colors"
                    style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', color: '#ef4444' }}
                    title="Regenerate token — all ESP32s must be reflashed">
                    <span className="material-symbols-outlined" style={{ fontSize: 12 }}>refresh</span>
                    Regenerate
                  </button>
                </div>
                <div className="mt-2 p-3 rounded-xl" style={{ background: 'rgba(15,20,45,0.55)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <p className="text-[9px] font-black uppercase tracking-wider mb-1.5" style={{ color: 'rgba(173,238,43,0.7)' }}>ESP32 Request Format</p>
                  <pre className="text-[9px] font-mono leading-relaxed whitespace-pre-wrap break-all" style={{ color: 'rgba(255,255,255,0.6)' }}>{`POST /api/sensor/ping\nX-Sensor-Token: ${general?.sensor_api_token ?? '<token>'}\nContent-Type: application/json\n\n{ "sensor_code": "<room-sensor-code>" }`}</pre>
                </div>
              </div>
            )}

            <div className="border-t border-[var(--ds-border-sub)]" />
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-[12px] font-black text-[var(--ds-text-1)]">Send auto-cancel notification email</p>
                <p className="text-[10px] text-[var(--ds-text-3)] mt-0.5">
                  Emails the recipient when a booking is auto-cancelled for a missed presence confirmation. The in-app notification and Activity Log entry always happen regardless of this toggle.
                </p>
              </div>
              <ToggleSwitch checked={ghostCancelEmailEnabled} onChange={toggleGhostCancelEmailEnabled} />
            </div>

            <div className="p-3.5 rounded-xl text-[10px] font-semibold leading-relaxed" style={{ background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.18)', color: '#818cf8' }}>
              <span className="font-black">How it works:</span> Every minute, the system checks for bookings past the window close with no presence confirmed. Those bookings are auto-cancelled and logged in Activity Log. The kiosk display updates immediately.
            </div>
          </>
        )}
      </div>

      {/* Features */}
      <div ref={el => { secRefs.current.features = el }} className="bg-[var(--ds-bg-surface)] rounded-2xl border border-[var(--ds-border-sub)] p-6 space-y-5">
        <div>
          <p className="text-[13px] font-black uppercase tracking-wider text-[var(--ds-text-1)]">Features</p>
          <p className="text-[12px] text-[var(--ds-text-3)] mt-0.5">Enable or disable system-wide features.</p>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-2xl flex items-center justify-center" style={{ background: aiChat ? 'rgba(173,238,43,0.12)' : 'rgba(0,0,0,0.04)' }}>
              <span className="material-symbols-outlined" style={{ fontSize: 20, color: aiChat ? '#4d7c00' : '#94a3b8' }}>smart_toy</span>
            </div>
            <div>
              <p className="text-[14px] font-black text-[var(--ds-text-1)]">AI Chat</p>
              <p className="text-[11px] text-[var(--ds-text-3)] font-bold uppercase tracking-wider">{aiChat ? 'AI FAB visible to all users' : 'Hidden — reduce server load'}</p>
            </div>
          </div>
          <ToggleSwitch checked={aiChat} onChange={toggleAiChat} />
        </div>

        <div className="border-t border-[var(--ds-border-sub)]" />

        {/* Allow password change */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-2xl flex items-center justify-center" style={{ background: allowPasswordChange ? 'rgba(173,238,43,0.12)' : 'rgba(0,0,0,0.04)' }}>
              <span className="material-symbols-outlined" style={{ fontSize: 20, color: allowPasswordChange ? '#4d7c00' : '#94a3b8' }}>lock_reset</span>
            </div>
            <div>
              <p className="text-[14px] font-black text-[var(--ds-text-1)]">Password Change</p>
              <p className="text-[11px] text-[var(--ds-text-3)] font-bold uppercase tracking-wider">{allowPasswordChange ? 'Users can change their own password' : 'Disabled — superadmin only'}</p>
            </div>
          </div>
          <ToggleSwitch checked={allowPasswordChange} onChange={toggleAllowPasswordChange} />
        </div>

        <div className="border-t border-[var(--ds-border-sub)]" />

        {/* Avatar upload toggle */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-2xl flex items-center justify-center" style={{ background: allowAvatarUpload ? 'rgba(173,238,43,0.12)' : 'rgba(0,0,0,0.04)' }}>
              <span className="material-symbols-outlined" style={{ fontSize: 20, color: allowAvatarUpload ? '#4d7c00' : '#94a3b8' }}>add_a_photo</span>
            </div>
            <div>
              <p className="text-[14px] font-black text-[var(--ds-text-1)]">Profile Photo Upload</p>
              <p className="text-[11px] text-[var(--ds-text-3)] font-bold uppercase tracking-wider">{allowAvatarUpload ? 'Users can upload & change their photo' : 'Disabled — photo upload locked'}</p>
            </div>
          </div>
          <ToggleSwitch checked={allowAvatarUpload} onChange={toggleAllowAvatarUpload} />
        </div>

        <div className="border-t border-[var(--ds-border-sub)]" />

        {/* Rooms grid columns */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(99,102,241,0.1)' }}>
              <span className="material-symbols-outlined" style={{ fontSize: 20, color: '#6366f1' }}>grid_view</span>
            </div>
            <div>
              <p className="text-[14px] font-black text-[var(--ds-text-1)]">Rooms Grid Columns</p>
              <p className="text-[11px] text-[var(--ds-text-3)] font-bold uppercase tracking-wider">Cards per row on Rooms page</p>
            </div>
          </div>
          <div className="flex items-center gap-1 p-1 rounded-xl bg-[var(--ds-bg-raised)] border border-[var(--ds-border)]">
            {[2, 3, 4, 5].map(n => (
              <button
                key={n}
                type="button"
                onClick={() => setRoomsGridCols(n)}
                className="w-8 h-7 rounded-lg text-[11px] font-black transition-all"
                style={roomsGrid === n
                  ? { background: '#000', color: '#adee2b' }
                  : { background: 'transparent', color: '#94a3b8' }
                }
              >
                {n}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Microsoft 365 Integration */}
      <div ref={el => { secRefs.current.m365 = el }} className="bg-[var(--ds-bg-surface)] rounded-2xl border border-[var(--ds-border-sub)] p-6 space-y-5">
        <div>
          <p className="text-[13px] font-black uppercase tracking-wider text-[var(--ds-text-1)]">Microsoft 365 Integration</p>
          <p className="text-[12px] text-[var(--ds-text-3)] mt-0.5">
            Azure AD App Registration credentials, shared by future Teams, Email, and Outlook Calendar integrations.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-[9px] font-black uppercase text-[var(--ds-text-3)] tracking-wider px-1">Tenant ID</label>
            <input
              type="text"
              value={m365TenantId}
              onChange={e => onM365Field(setM365TenantId)(e.target.value)}
              placeholder="e.g. 3f2a1b8c-....-....-....-............"
              className="w-full bg-[var(--ds-bg-raised)] border border-[var(--ds-border)] rounded-xl px-3 py-2 text-sm font-semibold text-[var(--ds-text-1)] focus:outline-none focus:ring-2 focus:ring-[#adee2b]"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[9px] font-black uppercase text-[var(--ds-text-3)] tracking-wider px-1">Client ID (Application ID)</label>
            <input
              type="text"
              value={m365ClientId}
              onChange={e => onM365Field(setM365ClientId)(e.target.value)}
              placeholder="e.g. 7c9d4e21-....-....-....-............"
              className="w-full bg-[var(--ds-bg-raised)] border border-[var(--ds-border)] rounded-xl px-3 py-2 text-sm font-semibold text-[var(--ds-text-1)] focus:outline-none focus:ring-2 focus:ring-[#adee2b]"
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <label className="text-[9px] font-black uppercase text-[var(--ds-text-3)] tracking-wider px-1">Client Secret</label>
            <input
              type="password"
              value={m365ClientSecret}
              onChange={e => onM365Field(setM365ClientSecret)(e.target.value)}
              placeholder={m365?.has_secret ? '•••••••• (already set — type to replace)' : 'Paste the client secret value'}
              className="w-full bg-[var(--ds-bg-raised)] border border-[var(--ds-border)] rounded-xl px-3 py-2 text-sm font-semibold text-[var(--ds-text-1)] focus:outline-none focus:ring-2 focus:ring-[#adee2b]"
            />
            <p className="text-[10px] text-[var(--ds-text-3)] px-1">Stored encrypted. Leave blank when saving to keep the current secret unchanged.</p>
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <label className="text-[9px] font-black uppercase text-[var(--ds-text-3)] tracking-wider px-1">Sender Mailbox</label>
            <input
              type="text"
              value={m365SenderEmail}
              onChange={e => onM365Field(setM365SenderEmail)(e.target.value)}
              placeholder="e.g. noreply@domain.com"
              className="w-full bg-[var(--ds-bg-raised)] border border-[var(--ds-border)] rounded-xl px-3 py-2 text-sm font-semibold text-[var(--ds-text-1)] focus:outline-none focus:ring-2 focus:ring-[#adee2b]"
            />
            <p className="text-[10px] text-[var(--ds-text-3)] px-1">A real, licensed mailbox in this tenant that the app will send email as. Must have Graph <code className="bg-black/10 dark:bg-white/10 px-1 rounded text-[9px]">Mail.Send</code> permission granted.</p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={handleTestM365}
            disabled={m365Testing || !m365?.configured}
            title={!m365?.configured ? 'Save Tenant ID, Client ID and Client Secret first' : ''}
            className="px-4 py-2 text-[10px] font-black uppercase rounded-lg bg-[var(--ds-bg-raised)] border border-[var(--ds-border)] text-[var(--ds-text-2)] hover:border-[#adee2b] transition-all disabled:opacity-50"
          >
            {m365Testing ? 'Testing...' : 'Test Connection'}
          </button>
          {m365?.configured && (
            <span className="text-[10px] font-black uppercase text-[var(--ds-text-3)] flex items-center gap-1">
              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>check_circle</span>
              Credentials saved
            </span>
          )}
        </div>

        {m365TestResult && (
          <div className="rounded-xl p-3.5 text-[11px] font-semibold leading-relaxed"
            style={m365TestResult.success
              ? { background: 'rgba(34,197,94,0.10)', border: '1px solid rgba(34,197,94,0.25)', color: '#16a34a' }
              : { background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.20)', color: '#ef4444' }}
          >
            {m365TestResult.message}
          </div>
        )}

        {/* Email sending test — the on/off switch for which mailer actually sends app emails now lives in the Mailer section below */}
        <div className="pt-4 border-t space-y-3" style={{ borderColor: 'var(--ds-border-sub)' }}>
          <div>
            <p className="text-[12px] font-black text-[var(--ds-text-1)]">Test Graph Mail Sending</p>
            <p className="text-[10px] text-[var(--ds-text-3)] mt-0.5">
              Sends a one-off test email via Microsoft Graph, regardless of which mailer is currently active. To make M365 the app's active mailer, select it in the Mailer section below.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={handleSendM365TestEmail}
              disabled={m365TestingEmail || !m365?.mail_ready}
              title={!m365?.mail_ready ? 'Set Tenant ID, Client ID, Client Secret, and Sender Mailbox first' : ''}
              className="px-4 py-2 text-[10px] font-black uppercase rounded-lg bg-[var(--ds-bg-raised)] border border-[var(--ds-border)] text-[var(--ds-text-2)] hover:border-[#adee2b] transition-all disabled:opacity-50"
            >
              {m365TestingEmail ? 'Sending...' : 'Send Test Email'}
            </button>
            <span className="text-[10px] text-[var(--ds-text-3)]">Sends to your own account email, regardless of the switch above.</span>
          </div>

          {m365EmailTestResult && (
            <div className="rounded-xl p-3.5 text-[11px] font-semibold leading-relaxed"
              style={m365EmailTestResult.success
                ? { background: 'rgba(34,197,94,0.10)', border: '1px solid rgba(34,197,94,0.25)', color: '#16a34a' }
                : { background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.20)', color: '#ef4444' }}
            >
              {m365EmailTestResult.message}
            </div>
          )}

        </div>

        {/* Calendar sync switch */}
        <div className="pt-4 border-t space-y-3" style={{ borderColor: 'var(--ds-border-sub)' }}>
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-[12px] font-black text-[var(--ds-text-1)]">Sync new bookings to Outlook/Teams Calendar</p>
              <p className="text-[10px] text-[var(--ds-text-3)] mt-0.5">
                Every booking automatically becomes a calendar event in the booker's mailbox — it shows up in both Outlook and Teams (same calendar, no extra setup). Requires Graph <code className="bg-black/10 dark:bg-white/10 px-1 rounded text-[9px]">Calendars.ReadWrite</code> permission on the App Registration. Edits/cancellations don't sync back yet — only booking creation.
              </p>
            </div>
            <button
              type="button"
              onClick={toggleM365CalendarSync}
              disabled={!m365?.calendar_sync_ready}
              title={!m365?.calendar_sync_ready ? 'Save Tenant ID, Client ID and Client Secret first' : ''}
              className={`shrink-0 w-12 h-7 rounded-full relative transition-all disabled:opacity-40 ${m365CalendarSync ? 'bg-[#adee2b]' : 'bg-[var(--ds-border)]'}`}
            >
              <span className="absolute top-1 size-5 rounded-full bg-white shadow-sm transition-all" style={{ left: m365CalendarSync ? 26 : 4 }} />
            </button>
          </div>
        </div>

        <div className="rounded-xl p-4 space-y-2" style={{ background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.15)' }}>
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined" style={{ fontSize: 16, color: '#6366f1' }}>info</span>
            <p className="text-[11px] font-black uppercase tracking-wider" style={{ color: '#6366f1' }}>Where to get these values</p>
          </div>
          <ol className="text-[11px] text-[var(--ds-text-2)] leading-relaxed list-decimal list-inside space-y-1">
            <li>Go to <strong>entra.microsoft.com</strong> → <strong>App registrations</strong> → <strong>New registration</strong>.</li>
            <li>After creating it, copy the <strong>Application (client) ID</strong> and <strong>Directory (tenant) ID</strong> from its Overview page.</li>
            <li>Go to <strong>Certificates &amp; secrets</strong> → <strong>New client secret</strong> — copy the secret <strong>Value</strong> (shown once).</li>
            <li>Under <strong>API permissions</strong>, add the Microsoft Graph application permissions this app will need (e.g. <code className="bg-black/10 dark:bg-white/10 px-1 rounded text-[10px]">Mail.Send</code>, <code className="bg-black/10 dark:bg-white/10 px-1 rounded text-[10px]">Calendars.ReadWrite</code>), then click <strong>Grant admin consent</strong>.</li>
          </ol>
        </div>
      </div>

      {/* Mailer */}
      <div ref={el => { secRefs.current.mailer = el }} className="bg-[var(--ds-bg-surface)] rounded-2xl border border-[var(--ds-border-sub)] p-6 space-y-5">
        <div>
          <p className="text-[13px] font-black uppercase tracking-wider text-[var(--ds-text-1)]">Mailer</p>
          <p className="text-[12px] text-[var(--ds-text-3)] mt-0.5">Choose which provider actually sends app emails (reminders, cancellations, etc). Only one can be active at a time.</p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {([
            { key: 'default' as const, label: 'Default', icon: 'block', ready: true },
            { key: 'm365' as const,    label: 'Microsoft 365', icon: 'cloud', ready: mailer?.m365?.ready ?? false },
            { key: 'resend' as const,  label: 'Resend', icon: 'send', ready: mailer?.resend?.ready ?? false },
            { key: 'brevo' as const,   label: 'Brevo', icon: 'forward_to_inbox', ready: mailer?.brevo?.ready ?? false },
          ]).map(opt => (
            <button key={opt.key} type="button" onClick={() => selectActiveMailer(opt.key)}
              className="flex flex-col items-center gap-1.5 p-3 rounded-xl text-center transition-all"
              style={{
                background: activeMailer === opt.key ? 'rgba(173,238,43,0.07)' : 'var(--ds-bg-raised)',
                border: activeMailer === opt.key ? '2px solid rgba(173,238,43,0.55)' : '2px solid var(--ds-border)',
              }}>
              <span className="material-symbols-outlined" style={{ fontSize: 20, color: activeMailer === opt.key ? '#4d7c00' : 'var(--ds-text-3)' }}>{opt.icon}</span>
              <span className="text-[11px] font-black" style={{ color: activeMailer === opt.key ? 'var(--ds-text-1)' : 'var(--ds-text-2)' }}>{opt.label}</span>
              {opt.key !== 'default' && (
                <span className="text-[8px] font-black uppercase tracking-wider" style={{ color: opt.ready ? '#4d7c00' : 'var(--ds-text-4)' }}>
                  {opt.ready ? 'Configured' : 'Not set up'}
                </span>
              )}
            </button>
          ))}
        </div>
        {activeMailer === 'default' && (
          <p className="text-[10px] text-[var(--ds-text-3)] px-1">No provider selected — app emails use the server's default mailer (currently discards mail unless configured in `.env`).</p>
        )}

        {activeMailer === 'resend' && (
          <div className="pt-4 border-t space-y-4" style={{ borderColor: 'var(--ds-border-sub)' }}>
            <p className="text-[11px] font-black uppercase tracking-wider text-[var(--ds-text-3)]">Resend</p>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-1.5 sm:col-span-2">
                <label className="text-[9px] font-black uppercase text-[var(--ds-text-3)] tracking-wider px-1">API Key</label>
                <input type="password" value={resendApiKey} onChange={e => onMailerField(setResendApiKey)(e.target.value)}
                  placeholder={mailer?.resend?.has_key ? '•••••••• (already set — type to replace)' : 're_...'}
                  className="w-full bg-[var(--ds-bg-raised)] border border-[var(--ds-border)] rounded-xl px-3 py-2 text-sm font-semibold text-[var(--ds-text-1)] focus:outline-none focus:ring-2 focus:ring-[#adee2b]" />
                <p className="text-[10px] text-[var(--ds-text-3)] px-1">Stored encrypted. From <strong>resend.com</strong> → API Keys.</p>
              </div>
              <div className="space-y-1.5">
                <label className="text-[9px] font-black uppercase text-[var(--ds-text-3)] tracking-wider px-1">From Address</label>
                <input type="text" value={resendFromAddress} onChange={e => onMailerField(setResendFromAddress)(e.target.value)}
                  placeholder="e.g. noreply@domain.com"
                  className="w-full bg-[var(--ds-bg-raised)] border border-[var(--ds-border)] rounded-xl px-3 py-2 text-sm font-semibold text-[var(--ds-text-1)] focus:outline-none focus:ring-2 focus:ring-[#adee2b]" />
                <p className="text-[10px] text-[var(--ds-text-3)] px-1">Must be on a domain verified in your Resend account.</p>
              </div>
              <div className="space-y-1.5">
                <label className="text-[9px] font-black uppercase text-[var(--ds-text-3)] tracking-wider px-1">From Name (optional)</label>
                <input type="text" value={resendFromName} onChange={e => onMailerField(setResendFromName)(e.target.value)}
                  placeholder="e.g. RoomSync Pro"
                  className="w-full bg-[var(--ds-bg-raised)] border border-[var(--ds-border)] rounded-xl px-3 py-2 text-sm font-semibold text-[var(--ds-text-1)] focus:outline-none focus:ring-2 focus:ring-[#adee2b]" />
              </div>
            </div>
          </div>
        )}

        {activeMailer === 'brevo' && (
          <div className="pt-4 border-t space-y-4" style={{ borderColor: 'var(--ds-border-sub)' }}>
            <p className="text-[11px] font-black uppercase tracking-wider text-[var(--ds-text-3)]">Brevo</p>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-1.5 sm:col-span-2">
                <label className="text-[9px] font-black uppercase text-[var(--ds-text-3)] tracking-wider px-1">API Key</label>
                <input type="password" value={brevoApiKey} onChange={e => onMailerField(setBrevoApiKey)(e.target.value)}
                  placeholder={mailer?.brevo?.has_key ? '•••••••• (already set — type to replace)' : 'xkeysib-...'}
                  className="w-full bg-[var(--ds-bg-raised)] border border-[var(--ds-border)] rounded-xl px-3 py-2 text-sm font-semibold text-[var(--ds-text-1)] focus:outline-none focus:ring-2 focus:ring-[#adee2b]" />
                <p className="text-[10px] text-[var(--ds-text-3)] px-1">Stored encrypted. From <strong>app.brevo.com</strong> → SMTP &amp; API → API Keys.</p>
              </div>
              <div className="space-y-1.5">
                <label className="text-[9px] font-black uppercase text-[var(--ds-text-3)] tracking-wider px-1">From Address</label>
                <input type="text" value={brevoFromAddress} onChange={e => onMailerField(setBrevoFromAddress)(e.target.value)}
                  placeholder="e.g. noreply@domain.com"
                  className="w-full bg-[var(--ds-bg-raised)] border border-[var(--ds-border)] rounded-xl px-3 py-2 text-sm font-semibold text-[var(--ds-text-1)] focus:outline-none focus:ring-2 focus:ring-[#adee2b]" />
                <p className="text-[10px] text-[var(--ds-text-3)] px-1">Must be a verified sender in your Brevo account.</p>
              </div>
              <div className="space-y-1.5">
                <label className="text-[9px] font-black uppercase text-[var(--ds-text-3)] tracking-wider px-1">From Name (optional)</label>
                <input type="text" value={brevoFromName} onChange={e => onMailerField(setBrevoFromName)(e.target.value)}
                  placeholder="e.g. RoomSync Pro"
                  className="w-full bg-[var(--ds-bg-raised)] border border-[var(--ds-border)] rounded-xl px-3 py-2 text-sm font-semibold text-[var(--ds-text-1)] focus:outline-none focus:ring-2 focus:ring-[#adee2b]" />
              </div>
            </div>
          </div>
        )}

        {activeMailer !== 'default' && (
          <div className="pt-4 border-t space-y-3" style={{ borderColor: 'var(--ds-border-sub)' }}>
            <div className="flex items-center gap-2 flex-wrap">
              <button type="button" onClick={handleSendMailerTestEmail} disabled={mailerTestingEmail || dirty}
                title={dirty ? 'Apply your changes first' : ''}
                className="px-4 py-2 text-[10px] font-black uppercase rounded-lg bg-[var(--ds-bg-raised)] border border-[var(--ds-border)] text-[var(--ds-text-2)] hover:border-[#adee2b] transition-all disabled:opacity-50">
                {mailerTestingEmail ? 'Sending...' : 'Send Test Email'}
              </button>
              <span className="text-[10px] text-[var(--ds-text-3)]">Sends to your own account email, using whichever mailer is currently active (applied &amp; saved).</span>
            </div>
            {mailerEmailTestResult && (
              <div className="rounded-xl p-3.5 text-[11px] font-semibold leading-relaxed"
                style={mailerEmailTestResult.success
                  ? { background: 'rgba(34,197,94,0.10)', border: '1px solid rgba(34,197,94,0.25)', color: '#16a34a' }
                  : { background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.20)', color: '#ef4444' }}>
                {mailerEmailTestResult.message}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Reminders */}
      <div ref={el => { secRefs.current.reminders = el }} className="bg-[var(--ds-bg-surface)] rounded-2xl border border-[var(--ds-border-sub)] p-6 space-y-5">
        <div>
          <p className="text-[13px] font-black uppercase tracking-wider text-[var(--ds-text-1)]">Reminders</p>
          <p className="text-[12px] text-[var(--ds-text-3)] mt-0.5">Email a booking's recipient shortly before it starts.</p>
        </div>

        {activeMailer === 'default' && (
          <div className="rounded-xl p-3.5 text-[11px] font-semibold leading-relaxed" style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.18)', color: '#ef4444' }}>
            Select an active mailer above (Microsoft 365, Resend, or Brevo) before you can enable reminders — there's currently nothing configured to send them.
          </div>
        )}

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-2xl flex items-center justify-center" style={{ background: reminderEnabled ? 'rgba(173,238,43,0.12)' : 'rgba(0,0,0,0.04)' }}>
              <span className="material-symbols-outlined" style={{ fontSize: 20, color: reminderEnabled ? '#4d7c00' : '#94a3b8' }}>notifications_active</span>
            </div>
            <div>
              <p className="text-[14px] font-black text-[var(--ds-text-1)]">Reminder Email</p>
              <p className="text-[11px] text-[var(--ds-text-3)] font-bold uppercase tracking-wider">{reminderEnabled ? `Sent ${reminderMinutes} min before start` : 'Disabled'}</p>
            </div>
          </div>
          <ToggleSwitch checked={reminderEnabled} onChange={toggleReminderEnabled} disabled={activeMailer === 'default'}
            title={activeMailer === 'default' ? 'Select an active mailer first' : ''} />
        </div>

        {reminderEnabled && (
          <>
            <div className="border-t border-[var(--ds-border-sub)]" />
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[14px] font-black text-[var(--ds-text-1)]">Send Before Start</p>
                <p className="text-[11px] text-[var(--ds-text-3)] font-bold uppercase tracking-wider">How many minutes ahead to email the reminder</p>
              </div>
              <div className="flex items-center gap-2">
                <input type="number" min={1} max={120} value={reminderMinutes}
                  onChange={e => onReminderMinutesChange(Number(e.target.value))}
                  className="w-16 text-center text-[13px] font-black bg-[var(--ds-bg-raised)] border border-[var(--ds-border)] rounded-xl p-2 focus:ring-2 focus:ring-[#adee2b] focus:outline-none text-[var(--ds-text-1)]" />
                <span className="text-[12px] font-bold text-[var(--ds-text-3)]">min</span>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Archive settings */}
      <div ref={el => { secRefs.current.archive = el }} className="bg-[var(--ds-bg-surface)] rounded-2xl border border-[var(--ds-border-sub)] p-6 space-y-5">
        <div>
          <p className="text-[13px] font-black uppercase tracking-wider text-[var(--ds-text-1)]">Archive</p>
          <p className="text-[12px] text-[var(--ds-text-3)] mt-0.5">Control when bookings are archived and auto-deleted.</p>
        </div>

        {/* Archive after N days */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(99,102,241,0.1)' }}>
              <span className="material-symbols-outlined" style={{ fontSize: 20, color: '#6366f1' }}>inventory_2</span>
            </div>
            <div>
              <p className="text-[14px] font-black text-[var(--ds-text-1)]">Archive After</p>
              <p className="text-[11px] text-[var(--ds-text-3)] font-bold uppercase tracking-wider">Past bookings hidden from all views</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input type="number" min={1} max={365} value={archiveDays}
              onChange={e => onArchiveDaysChange(Math.max(1, Math.min(365, Number(e.target.value))))}
              className="w-16 text-center text-[13px] font-black bg-[var(--ds-bg-raised)] border border-[var(--ds-border)] rounded-xl p-2 focus:ring-2 focus:ring-[#adee2b] focus:outline-none text-[var(--ds-text-1)]" />
            <span className="text-[12px] font-bold text-[var(--ds-text-3)]">days</span>
          </div>
        </div>

        <div className="border-t border-[var(--ds-border-sub)]" />

        {/* Auto-delete after N days */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(239,68,68,0.1)' }}>
              <span className="material-symbols-outlined" style={{ fontSize: 20, color: '#ef4444' }}>delete_sweep</span>
            </div>
            <div>
              <p className="text-[14px] font-black text-[var(--ds-text-1)]">Auto-Delete Archive After</p>
              <p className="text-[11px] text-[var(--ds-text-3)] font-bold uppercase tracking-wider">Permanently delete from archive</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input type="number" min={1} max={730} value={deleteDays}
              onChange={e => onDeleteDaysChange(Math.max(1, Math.min(730, Number(e.target.value))))}
              className="w-16 text-center text-[13px] font-black bg-[var(--ds-bg-raised)] border border-[var(--ds-border)] rounded-xl p-2 focus:ring-2 focus:ring-[#adee2b] focus:outline-none text-[var(--ds-text-1)]" />
            <span className="text-[12px] font-bold text-[var(--ds-text-3)]">days</span>
          </div>
        </div>

        <div className="p-3 bg-[var(--ds-bg-raised)] rounded-xl text-[10px] text-[var(--ds-text-2)] font-semibold leading-relaxed">
          Bookings older than <span className="font-black text-[var(--ds-text-1)]">{archiveDays} days</span> move to archive.
          Archive entries older than <span className="font-black text-[var(--ds-text-1)]">{deleteDays} days</span> are permanently deleted nightly at 02:00.
        </div>
      </div>

      {/* ── Auto Backup (one bundled batch) ── */}
      <div ref={el => { secRefs.current.backup = el }} className="bg-[var(--ds-bg-surface)] rounded-2xl border border-[var(--ds-border-sub)] p-6 space-y-5">
        <div>
          <p className="text-[13px] font-black uppercase tracking-wider text-[var(--ds-text-1)]">Auto Backup</p>
          <p className="text-[12px] text-[var(--ds-text-3)] mt-0.5">Exports the bookings archive, activity log, and users/buildings/rooms together as a single scheduled batch.</p>
        </div>

        {/* Enable toggle */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-2xl flex items-center justify-center" style={{ background: backupEnabled ? 'rgba(173,238,43,0.12)' : 'rgba(0,0,0,0.04)' }}>
              <span className="material-symbols-outlined" style={{ fontSize: 20, color: backupEnabled ? '#4d7c00' : '#94a3b8' }}>backup</span>
            </div>
            <div>
              <p className="text-[14px] font-black text-[var(--ds-text-1)]">Auto Backup</p>
              <p className="text-[11px] text-[var(--ds-text-3)] font-bold uppercase tracking-wider">{backupEnabled ? 'Enabled — runs on schedule' : 'Disabled'}</p>
            </div>
          </div>
          <ToggleSwitch checked={backupEnabled} onChange={toggleBackupEnabled} />
        </div>

        {backupEnabled && (<>
          <div className="border-t border-[var(--ds-border-sub)]" />

          {/* Frequency */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-2xl flex items-center justify-center bg-[var(--ds-bg-raised)]">
                <span className="material-symbols-outlined" style={{ fontSize: 20, color: 'var(--ds-text-2)' }}>repeat</span>
              </div>
              <p className="text-[14px] font-black text-[var(--ds-text-1)]">Frequency</p>
            </div>
            <div className="flex items-center gap-1 p-1 rounded-xl bg-[var(--ds-bg-raised)] border border-[var(--ds-border)]">
              {(['daily', 'weekly', 'monthly'] as const).map(f => (
                <button key={f} type="button" onClick={() => onBackupFrequencyChange(f)}
                  className="px-3 h-7 rounded-lg text-[10px] font-black uppercase transition-all"
                  style={backupFrequency === f ? { background: '#000', color: '#adee2b' } : { background: 'transparent', color: '#94a3b8' }}>
                  {f}
                </button>
              ))}
            </div>
          </div>

          {/* Time */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-2xl flex items-center justify-center bg-[var(--ds-bg-raised)]">
                <span className="material-symbols-outlined" style={{ fontSize: 20, color: 'var(--ds-text-2)' }}>schedule</span>
              </div>
              <p className="text-[14px] font-black text-[var(--ds-text-1)]">Time</p>
            </div>
            <GlassTimePicker value={backupTime} onChange={onBackupTimeChange} min="00:00" max="23:30" step={30} panelWidth={140}>
              {() => (<button type="button" className="flex items-center gap-2 bg-[var(--ds-bg-raised)] border border-[var(--ds-border)] rounded-xl text-[12px] font-black px-3 py-2 hover:border-[#adee2b] transition-all tabular-nums text-[var(--ds-text-1)]"><span className="material-symbols-outlined text-[var(--ds-text-3)]" style={{ fontSize: 14 }}>schedule</span>{backupTime}</button>)}
            </GlassTimePicker>
          </div>

          {/* Day of week (weekly) */}
          {backupFrequency === 'weekly' && (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-2xl flex items-center justify-center bg-[var(--ds-bg-raised)]">
                  <span className="material-symbols-outlined" style={{ fontSize: 20, color: 'var(--ds-text-2)' }}>today</span>
                </div>
                <p className="text-[14px] font-black text-[var(--ds-text-1)]">Day of Week</p>
              </div>
              <div className="flex items-center gap-1 p-1 rounded-xl bg-[var(--ds-bg-raised)] border border-[var(--ds-border)]">
                {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map((d, i) => (
                  <button key={i} type="button" onClick={() => onBackupDowChange(i)}
                    className="w-8 h-7 rounded-lg text-[10px] font-black transition-all"
                    style={backupDow === i ? { background: '#000', color: '#adee2b' } : { background: 'transparent', color: '#94a3b8' }}>
                    {d}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Day of month (monthly) */}
          {backupFrequency === 'monthly' && (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-2xl flex items-center justify-center bg-[var(--ds-bg-raised)]">
                  <span className="material-symbols-outlined" style={{ fontSize: 20, color: 'var(--ds-text-2)' }}>calendar_month</span>
                </div>
                <p className="text-[14px] font-black text-[var(--ds-text-1)]">Day of Month</p>
              </div>
              <div className="flex items-center gap-2">
                <input type="number" min={1} max={28} value={backupDom}
                  onChange={e => onBackupDomChange(Math.max(1, Math.min(28, Number(e.target.value))))}
                  className="w-14 text-center text-[13px] font-black bg-[var(--ds-bg-raised)] border border-[var(--ds-border)] rounded-xl p-2 focus:ring-2 focus:ring-[#adee2b] focus:outline-none text-[var(--ds-text-1)]" />
                <span className="text-[12px] font-bold text-[var(--ds-text-3)]">of month</span>
              </div>
            </div>
          )}

          <div className="border-t border-[var(--ds-border-sub)]" />

          {/* Formats */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-2xl flex items-center justify-center bg-[var(--ds-bg-raised)]">
                <span className="material-symbols-outlined" style={{ fontSize: 20, color: 'var(--ds-text-2)' }}>description</span>
              </div>
              <p className="text-[14px] font-black text-[var(--ds-text-1)]">File Formats</p>
            </div>
            <div className="flex items-center gap-2">
              {(['excel', 'csv', 'pdf'] as const).map(fmt => (
                <button key={fmt} type="button" onClick={() => toggleBackupFormat(fmt)}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-xl border text-[10px] font-black uppercase transition-all"
                  style={backupFormats.includes(fmt)
                    ? { background: 'rgba(173,238,43,0.1)', borderColor: 'rgba(173,238,43,0.5)', color: '#4d7c00' }
                    : { background: 'var(--ds-bg-raised)', borderColor: 'var(--ds-border)', color: '#94a3b8' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 11, fontVariationSettings: backupFormats.includes(fmt) ? "'FILL' 1" : "'FILL' 0" }}>check_circle</span>
                  {fmt}
                </button>
              ))}
            </div>
          </div>
          <p className="text-[10px] text-[var(--ds-text-3)] -mt-2">PDF applies to the bookings archive only. Activity log is always <code className="text-[10px] bg-[var(--ds-bg-raised)] px-1 py-0.5 rounded">.txt</code>.</p>

          <div className="border-t border-[var(--ds-border-sub)]" />

          {/* Include */}
          <div className="space-y-2">
            <p className="text-[10px] font-black uppercase tracking-wider text-[var(--ds-text-3)]">Include in Batch</p>
            <div className="flex items-center gap-2 flex-wrap">
              {([
                { key: 'archive' as const, label: 'Bookings Archive', on: backupIncludeArchive, icon: 'inventory_2' },
                { key: 'log' as const,     label: 'Activity Log',     on: backupIncludeLog,     icon: 'history' },
                { key: 'data' as const,    label: 'Users, Buildings & Rooms', on: backupIncludeData, icon: 'storage' },
              ]).map(item => (
                <button key={item.key} type="button" onClick={() => toggleBackupInclude(item.key)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl border text-[11px] font-black transition-all"
                  style={item.on
                    ? { background: 'rgba(173,238,43,0.1)', borderColor: 'rgba(173,238,43,0.5)', color: '#4d7c00' }
                    : { background: 'var(--ds-bg-raised)', borderColor: 'var(--ds-border)', color: '#94a3b8' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 13, fontVariationSettings: item.on ? "'FILL' 1" : "'FILL' 0" }}>check_circle</span>
                  <span className="material-symbols-outlined" style={{ fontSize: 13 }}>{item.icon}</span>
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        </>)}

        <div className="border-t border-[var(--ds-border-sub)]" />

        {/* Backup Log */}
        <div className="rounded-2xl border border-[var(--ds-border-sub)] overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 bg-[var(--ds-bg-raised)]">
            <div>
              <p className="text-[11px] font-black uppercase tracking-wider text-[var(--ds-text-1)]">Backup Log</p>
              <p className="text-[10px] text-[var(--ds-text-3)] mt-0.5">Batches generated by scheduler or manual export</p>
            </div>
            <button onClick={() => doBackupNow()} disabled={backupRunning}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-black text-[#adee2b] text-[10px] font-black uppercase hover:opacity-80 disabled:opacity-40 transition-opacity">
              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>save</span>
              {backupRunning ? 'Backing up…' : 'Backup Now'}
            </button>
          </div>
          {backupExports.length === 0 ? (
            <p className="px-4 py-6 text-center text-[var(--ds-text-3)] text-sm font-bold">No backups yet.</p>
          ) : (
            <div className="divide-y divide-[var(--ds-border-sub)]">
              {backupExports.map(e => (
                <div key={e.label} className="px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    <p className="text-[13px] font-black text-[var(--ds-text-1)]">{e.label}</p>
                    <p className="text-[11px] text-[var(--ds-text-3)] mt-0.5">{new Date(e.created_at * 1000).toLocaleString('en-GB')}</p>
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {e.files.map(f => (
                      <a key={f.path} href={getBackupDownloadUrl(f.path)}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-[var(--ds-border)] text-[var(--ds-text-2)] text-[9px] font-black uppercase hover:bg-[var(--ds-bg-raised)] transition-colors">
                        <span className="material-symbols-outlined" style={{ fontSize: 12 }}>download</span>
                        {f.name.replace(/_.*\./, '.').split('.')[0]}.{f.name.split('.').pop()?.toUpperCase()}
                        <span className="text-[var(--ds-text-3)] font-normal">({(f.size / 1024).toFixed(0)}kb)</span>
                      </a>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {backupExports.length > 0 && (
            <div className="mx-4 mb-4 mt-2 rounded-2xl p-3.5 flex items-center justify-between gap-4" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)' }}>
              <div>
                <p className="text-[10px] font-black text-red-500 uppercase tracking-wider">Danger Zone</p>
                <p className="text-[10px] text-red-400 mt-0.5">Delete all {backupExports.length} backup batch{backupExports.length !== 1 ? 'es' : ''} and their files permanently.</p>
              </div>
              <button onClick={() => { setDeleteBackupsConfirm(true); setDeleteBackupsInput('') }}
                className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-red-300 bg-[var(--ds-bg-surface)] text-red-500 text-[10px] font-black uppercase hover:bg-red-100 transition-colors">
                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>delete_forever</span>
                Delete All
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Delete all backups confirm modal */}
      {deleteBackupsConfirm && createPortal(
        <div className="fixed inset-0 z-[1000] flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(16px)' }}
          onClick={() => setDeleteBackupsConfirm(false)}>
          <div className="w-[420px] rounded-[2rem] overflow-hidden shadow-2xl"
            style={{ background: 'var(--ds-bg-surface)', backdropFilter: 'blur(48px)', border: '1px solid rgba(128,128,128,0.15)' }}
            onClick={e => e.stopPropagation()}>
            <div className="px-7 pt-7 pb-5 border-b flex items-center gap-3" style={{ background: 'rgba(239,68,68,0.08)', borderColor: 'rgba(239,68,68,0.15)' }}>
              <div className="size-10 rounded-2xl bg-red-100 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-red-500" style={{ fontSize: 22 }}>delete_forever</span>
              </div>
              <div>
                <p className="text-base font-black text-[var(--ds-text-1)]">Delete All Backup Records</p>
                <p className="text-[11px] text-[var(--ds-text-2)]">This will permanently delete all files from the server.</p>
              </div>
            </div>
            <div className="px-7 py-6 space-y-5">
              <p className="text-[12px] text-[var(--ds-text-2)] leading-relaxed">
                All <span className="font-black text-[var(--ds-text-1)]">{backupExports.length} backup batch{backupExports.length !== 1 ? 'es' : ''}</span> and their files will be permanently removed from the server. This action <span className="font-black text-red-500">cannot be undone</span>.
              </p>
              <div className="space-y-1.5">
                <p className="text-[10px] font-black text-[var(--ds-text-2)] uppercase tracking-wider">Confirm action</p>
                <p className="text-[11px] text-[var(--ds-text-2)]">Type <span className="font-black text-red-500 font-mono">Delete all records</span> to confirm</p>
                <input
                  type="text"
                  value={deleteBackupsInput}
                  onChange={e => setDeleteBackupsInput(e.target.value)}
                  placeholder="Delete all records"
                  autoFocus
                  onKeyDown={e => { if (e.key === 'Enter' && deleteBackupsInput === 'Delete all records') doDeleteAllBackups() }}
                  className="w-full px-4 py-3 rounded-xl border border-[var(--ds-border)] text-[13px] font-semibold focus:outline-none focus:ring-2 focus:ring-red-300 focus:border-red-300 placeholder:text-[var(--ds-text-3)] bg-[var(--ds-bg-raised)] text-[var(--ds-text-1)]"
                />
              </div>
              <div className="flex gap-3 justify-end">
                <button onClick={() => setDeleteBackupsConfirm(false)}
                  className="px-5 py-2.5 rounded-xl border border-[var(--ds-border)] text-[var(--ds-text-2)] text-[11px] font-black uppercase hover:bg-[var(--ds-bg-raised)] transition-colors">
                  Cancel
                </button>
                <button onClick={doDeleteAllBackups} disabled={deleteBackupsInput !== 'Delete all records' || deletingBackups}
                  className="px-5 py-2.5 rounded-xl bg-red-500 text-white text-[11px] font-black uppercase hover:bg-red-600 disabled:opacity-40 transition-colors">
                  {deletingBackups ? 'Deleting…' : 'Delete Permanently'}
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      </div>{/* end main sections */}

      {/* ── Floating TOC sidebar ── */}
      <div className="w-44 shrink-0 sticky top-4">
        <div className="rounded-2xl border border-[var(--ds-border-sub)] bg-[var(--ds-bg-surface)] shadow-sm overflow-hidden">
          <p className="text-[8px] font-black uppercase tracking-[0.2em] text-[var(--ds-text-3)] px-4 pt-4 pb-2">On this page</p>
          <div className="pb-2">
            {SETTINGS_SECTIONS.map(s => (
              <button
                key={s.key}
                type="button"
                onClick={() => scrollTo(s.key)}
                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-left transition-colors group"
                style={{ background: activeSection === s.key ? 'rgba(173,238,43,0.08)' : 'transparent' }}
              >
                <span
                  className="material-symbols-outlined shrink-0 transition-colors"
                  style={{ fontSize: 14, color: activeSection === s.key ? '#4d7c00' : '#cbd5e1' }}
                >
                  {s.icon}
                </span>
                <span
                  className="text-[11px] font-black transition-colors"
                  style={{ color: activeSection === s.key ? 'var(--ds-text-1)' : '#94a3b8' }}
                >
                  {s.label}
                </span>
                {activeSection === s.key && (
                  <span className="ml-auto w-1 h-1 rounded-full bg-[#adee2b] shrink-0" />
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      </div>{/* end flex 2-col */}

      {dirty && createPortal(
        <div className="fixed z-[9997] flex items-center gap-3 px-5 py-3.5 rounded-[1.5rem]" style={{
          bottom: 40, left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(15,20,45,0.55)',
          backdropFilter: 'blur(48px) saturate(200%)',
          WebkitBackdropFilter: 'blur(48px) saturate(200%)',
          border: '1px solid rgba(255,255,255,0.14)',
          boxShadow: '0 24px 56px -8px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.12)',
          animation: 'ds-apply-bar-in 0.24s cubic-bezier(0.34,1.04,0.64,1)',
        }}>
          <style>{`@keyframes ds-apply-bar-in{from{opacity:0;transform:translateX(-50%) translateY(14px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}`}</style>
          <span className="text-[12px] font-bold whitespace-nowrap" style={{ color: 'rgba(255,255,255,0.85)' }}>You have unsaved changes</span>
          <button type="button" onClick={handleDiscardAll} disabled={applying}
            className="text-[11px] font-black uppercase px-2 disabled:opacity-40 transition-colors"
            style={{ color: 'rgba(255,255,255,0.45)' }}
            onMouseEnter={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.85)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.45)')}>
            Discard
          </button>
          <button type="button" onClick={handleApplyAll} disabled={applying}
            className="px-5 py-2 rounded-full text-[11px] font-black uppercase whitespace-nowrap transition-all disabled:opacity-50"
            style={{ background: '#adee2b', color: '#000' }}>
            {applying ? 'Applying...' : 'Apply Changes'}
          </button>
        </div>,
        document.body
      )}
    </div>
  )
}

export { SettingsTab as default }
