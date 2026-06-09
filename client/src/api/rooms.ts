import api from './axios'

export async function getRooms() {
  const res = await api.get('/rooms')
  return res.data
}

export async function getRoom(id: number) {
  const res = await api.get(`/rooms/${id}`)
  return res.data
}

export async function getRoomStats(roomId: number) {
  const res = await api.get(`/rooms/${roomId}/stats`)
  return res.data as { bookings_this_month: number; utilization: number; peak_hours: number[] }
}

export async function checkAvailability(roomId: number, startAt: string, endAt: string, excludeId?: number) {
  const res = await api.get(`/rooms/${roomId}/availability`, {
    params: { start_at: startAt, end_at: endAt, exclude_booking_id: excludeId },
  })
  return res.data
}
