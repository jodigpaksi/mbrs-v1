import api from './axios'

export async function getBookings(params?: { date?: string; date_from?: string; date_to?: string; room_id?: number; user_id?: number; special_rooms?: boolean; series_id?: string }) {
  const res = await api.get('/bookings', { params })
  return res.data
}

export async function getMyBookings() {
  const res = await api.get('/bookings/my')
  return res.data
}

export async function confirmPresenceWeb(bookingId: number): Promise<{ presence_confirmed_at: string }> {
  const res = await api.post(`/bookings/${bookingId}/confirm-presence`)
  return res.data
}

export async function submitDispute(bookingId: number, note?: string): Promise<{ dispute_status: string }> {
  const res = await api.post(`/bookings/${bookingId}/dispute`, { note })
  return res.data
}

export async function getDisputes(status: 'pending' | 'resolved' | 'all' = 'pending') {
  const res = await api.get('/disputes', { params: { status } })
  return res.data
}

export async function resolveDispute(bookingId: number, action: 'approve' | 'reject'): Promise<{ dispute_status: string }> {
  const res = await api.post(`/disputes/${bookingId}/resolve`, { action })
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
  resolves_series_id?: string
  resolves_skipped_date?: string
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

export async function transferBooking(id: number, bookedForUserId: number) {
  const res = await api.post(`/bookings/${id}/transfer`, { booked_for_user_id: bookedForUserId })
  return res.data
}

export async function clearCancelledBookings() {
  const res = await api.delete('/bookings/clear-cancelled')
  return res.data
}
