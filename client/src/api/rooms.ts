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
  return res.data as { available: boolean; other_viewers: number; conflicts: unknown[] }
}

export async function clearRoomView(roomId: number) {
  await api.delete(`/rooms/${roomId}/view`).catch(() => {})
}

export async function updateRoomStatus(roomId: number, status: 'active' | 'maintenance') {
  const res = await api.patch(`/rooms/${roomId}/status`, { status })
  return res.data
}

export async function getReceptionists() {
  const res = await api.get('/users/receptionists')
  return res.data as { id: number; name: string; department: string; ext: string; avatar?: string }[]
}
