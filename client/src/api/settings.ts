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
  export_enabled: boolean
  export_frequency: string
  export_time: string
  export_day_of_week: number
  export_day_of_month: number
  export_formats: string
  chart_peak_hour_from: number
  chart_peak_hour_to: number
  chart_colors: string
  anti_ghost_enabled: boolean
  anti_ghost_mode: string
  anti_ghost_window_before: number
  anti_ghost_window_after: number
  web_confirm_enabled: boolean
  log_auto_export_enabled: boolean
  log_auto_export_interval: string
  log_auto_export_time: string
  sensor_api_token: string
  business_timezone: string
  app_name: string
  app_logo_url: string | null
}

export interface AppBranding {
  app_name: string
  app_logo_url: string | null
}

export async function getBranding(): Promise<AppBranding> {
  const res = await api.get('/settings/branding')
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
