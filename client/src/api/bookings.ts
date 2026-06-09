import api from './axios'

export async function getBookings(params?: { date?: string; room_id?: number }) {
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
}) {
  const res = await api.post('/bookings', data)
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
