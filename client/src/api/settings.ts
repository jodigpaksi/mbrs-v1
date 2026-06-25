import api from './axios'

export interface BookingHours { start: string; end: string }
export interface WeekendSettings { saturday: boolean; sunday: boolean }
export interface GeneralSettings {
  max_advance_days: number
  allow_book_for_others: boolean
  allow_password_change: boolean
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
