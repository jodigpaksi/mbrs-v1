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

export async function createRoom(data: Record<string, unknown>) {
  const res = await api.post('/rooms', data)
  return res.data
}

export async function updateRoom(id: number, data: Record<string, unknown>) {
  const res = await api.patch(`/rooms/${id}`, data)
  return res.data
}

export async function reorderRooms(rooms: { id: number; sort_order: number }[]) {
  const res = await api.post('/rooms/reorder', { rooms })
  return res.data
}

export async function deleteRoom(id: number) {
  await api.delete(`/rooms/${id}`)
}

export async function getAvailableRooms(startAt: string, endAt: string, buildingId?: number | null) {
  const res = await api.get('/rooms/available', {
    params: { start_at: startAt, end_at: endAt, ...(buildingId ? { building_id: buildingId } : {}) },
  })
  return res.data as import('../types').Room[]
}

export async function updateRoomSpecial(roomId: number, requiresContact: boolean) {
  const res = await api.patch(`/rooms/${roomId}/special`, { requires_contact: requiresContact })
  return res.data
}

export async function updateRoomStatus(roomId: number, status: 'active' | 'maintenance') {
  const res = await api.patch(`/rooms/${roomId}/status`, { status })
  return res.data
}

export async function uploadRoomPhoto(roomId: number, file: File): Promise<{ url: string; photos: string[] }> {
  const form = new FormData()
  form.append('photo', file)
  const res = await api.post(`/rooms/${roomId}/photo`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return res.data
}

export async function deleteRoomPhoto(roomId: number, url: string): Promise<{ photos: string[] }> {
  const res = await api.delete(`/rooms/${roomId}/photo`, { data: { url } })
  return res.data
}

export async function regenerateSensorCode(roomId: number): Promise<import('../types').Room> {
  const res = await api.post(`/rooms/${roomId}/sensor-code/regenerate`)
  return res.data
}

export async function getReceptionists() {
  const res = await api.get('/users/receptionists')
  return res.data as { id: number; name: string; department: string; ext: string; email: string; avatar?: string }[]
}
