import api from './axios'

export interface BookingHours { start: string; end: string }
export interface WeekendSettings { saturday: boolean; sunday: boolean }

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
