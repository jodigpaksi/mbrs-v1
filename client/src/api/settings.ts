import api from './axios'

export interface BookingHours { start: string; end: string }
export interface WeekendSettings { saturday: boolean; sunday: boolean }
export interface GeneralSettings {
  max_advance_days: number
  allow_book_for_others: boolean
  allow_password_change: boolean
  allow_avatar_upload: boolean
  restrict_after_hours: boolean
  working_hours_end: string
  feature_ai_chat: boolean
  rooms_grid_cols: number
  archive_after_days: number
  archive_delete_after_days: number
  chart_peak_hour_from: number
  chart_peak_hour_to: number
  chart_colors: string
  anti_ghost_enabled: boolean
  anti_ghost_mode: string
  anti_ghost_window_before: number
  anti_ghost_window_after: number
  web_confirm_enabled: boolean
  backup_enabled: boolean
  backup_frequency: string
  backup_time: string
  backup_day_of_week: number
  backup_day_of_month: number
  backup_formats: string
  backup_include_archive: boolean
  backup_include_log: boolean
  backup_include_data: boolean
  sensor_api_token: string
  business_timezone: string
  app_name: string
  app_full_name: string
  app_logo_url: string | null
  login_photo_url: string | null
  login_photo_pos_x: number
  login_photo_pos_y: number
  login_headline: string
  login_subheadline: string
}

export interface AppBranding {
  app_name: string
  app_full_name: string
  app_logo_url: string | null
  login_photo_url: string | null
  login_photo_pos_x: number
  login_photo_pos_y: number
  login_headline: string
  login_subheadline: string
}

const BRANDING_CACHE_KEY = 'app_branding_cache'
const DEFAULT_BRANDING: AppBranding = {
  app_name: 'RoomSync Pro',
  app_full_name: '',
  app_logo_url: null,
  login_photo_url: null,
  login_photo_pos_x: 50,
  login_photo_pos_y: 50,
  login_headline: 'Booking made easy',
  login_subheadline: 'Book meeting rooms without the back-and-forth',
}

export function getCachedBranding(): AppBranding {
  try {
    const raw = localStorage.getItem(BRANDING_CACHE_KEY)
    if (raw) return { ...DEFAULT_BRANDING, ...JSON.parse(raw) }
  } catch { /* ignore malformed cache */ }
  return DEFAULT_BRANDING
}

export function setCachedBranding(branding: AppBranding) {
  try { localStorage.setItem(BRANDING_CACHE_KEY, JSON.stringify(branding)) } catch { /* storage unavailable */ }
}

export async function getBranding(): Promise<AppBranding> {
  const res = await api.get('/settings/branding')
  setCachedBranding(res.data)
  return res.data
}

export async function uploadAppLogo(file: File): Promise<{ app_logo_url: string }> {
  const form = new FormData()
  form.append('logo', file)
  const res = await api.post('/settings/logo', form, { headers: { 'Content-Type': 'multipart/form-data' } })
  return res.data
}

export async function deleteAppLogo(): Promise<void> {
  await api.delete('/settings/logo')
}

export async function uploadLoginPhoto(file: File): Promise<{ login_photo_url: string }> {
  const form = new FormData()
  form.append('photo', file)
  const res = await api.post('/settings/login-photo', form, { headers: { 'Content-Type': 'multipart/form-data' } })
  return res.data
}

export async function deleteLoginPhoto(): Promise<void> {
  await api.delete('/settings/login-photo')
}

export async function getBookingHours(): Promise<BookingHours> {
  const res = await api.get('/settings/booking-hours')
  return res.data
}

export async function updateBookingHours(start: string, end: string) {
  const res = await api.patch('/settings/booking-hours', { start, end })
  return res.data as BookingHours & { trimmed_count: number; cancelled_count: number }
}

export async function getWeekendSettings(): Promise<WeekendSettings> {
  const res = await api.get('/settings/weekend')
  return res.data
}

export async function updateWeekendSettings(saturday: boolean, sunday: boolean): Promise<WeekendSettings> {
  const res = await api.patch('/settings/weekend', { saturday, sunday })
  return res.data
}

export async function getGeneralSettings(): Promise<GeneralSettings> {
  const res = await api.get('/settings/general')
  setCachedBranding({
    app_name: res.data.app_name,
    app_full_name: res.data.app_full_name,
    app_logo_url: res.data.app_logo_url,
    login_photo_url: res.data.login_photo_url,
    login_photo_pos_x: res.data.login_photo_pos_x,
    login_photo_pos_y: res.data.login_photo_pos_y,
    login_headline: res.data.login_headline,
    login_subheadline: res.data.login_subheadline,
  })
  return res.data
}

export async function updateGeneralSettings(patch: Partial<GeneralSettings>): Promise<GeneralSettings> {
  const res = await api.patch('/settings/general', patch)
  return res.data
}

export async function toggleUserSpecialAccess(userId: number): Promise<{ can_book_special: boolean }> {
  const res = await api.patch(`/users/${userId}/special-access`)
  return res.data
}

export interface AfterHoursContact {
  id: number
  name: string
  email: string
  ext: string | null
  role: string
  avatar: string | null
  on_duty: boolean
  department: string | null
  buildings: { id: number; name: string; code?: string | null }[]
}

export async function getAfterHoursContacts(buildingId?: number): Promise<AfterHoursContact[]> {
  const res = await api.get('/settings/after-hours-contacts', { params: buildingId ? { building_id: buildingId } : {} })
  return res.data
}

export async function updateAfterHoursContacts(userIds: number[]): Promise<AfterHoursContact[]> {
  const res = await api.patch('/settings/after-hours-contacts', { user_ids: userIds })
  return res.data
}

export async function getSpecialRoomContacts(buildingId?: number): Promise<AfterHoursContact[]> {
  const res = await api.get('/settings/special-room-contacts', { params: buildingId ? { building_id: buildingId } : {} })
  return res.data
}

export async function updateSpecialRoomContacts(userIds: number[]): Promise<AfterHoursContact[]> {
  const res = await api.patch('/settings/special-room-contacts', { user_ids: userIds })
  return res.data
}
