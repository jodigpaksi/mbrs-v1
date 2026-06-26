import api from './axios'

export async function getBookings(params?: { date?: string; date_from?: string; date_to?: string; room_id?: number; user_id?: number; special_rooms?: boolean }) {
  const res = await api.get('/bookings', { params })
  return res.data
}

export async function getMyBookings() {
  const res = await api.get('/bookings/my')
  return res.data
}

export async function createBooking(data: {
  room_id: number
  title: string
  description?: string
  start_at: string
  end_at: string
  status?: string
  type?: string
  series_id?: string
  series_skipped_dates?: string[]
  booked_for?: string
  booked_for_user_id?: number
}) {
  const res = await api.post('/bookings', data)
  return res.data
}

export async function cancelSeries(seriesId: string) {
  const res = await api.delete(`/bookings/series/${seriesId}`)
  return res.data
}

export async function updateSeries(seriesId: string, data: Partial<{
  title: string
  description: string
  status: string
  type: string
}>) {
  const res = await api.patch(`/bookings/series/${seriesId}`, data)
  return res.data
}

export async function updateBooking(id: number, data: Partial<{
  title: string
  description: string
  start_at: string
  end_at: string
  status: string
  type: string
}>) {
  const res = await api.patch(`/bookings/${id}`, data)
  return res.data
}

export async function cancelBooking(id: number) {
  const res = await api.delete(`/bookings/${id}`)
  return res.data
}

export async function clearCancelledBookings() {
  const res = await api.delete('/bookings/clear-cancelled')
  return res.data
}
