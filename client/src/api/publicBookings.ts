import api from './axios'

export interface PublicBookingDetail {
  id: number
  title: string
  description: string | null
  start_at: string
  end_at: string
  status: 'confirmed' | 'tentative' | 'cancelled'
  recipient_name: string | null
  presence_confirmed_at: string | null
  room: { name: string | null; building: string | null }
  can_confirm: boolean
  can_cancel: boolean
}

export async function getPublicBooking(id: string, query: string): Promise<PublicBookingDetail> {
  const res = await api.get(`/public/bookings/${id}?${query}`)
  return res.data
}

export async function confirmPublicBookingPresence(id: string, query: string): Promise<{ presence_confirmed_at: string }> {
  const res = await api.post(`/public/bookings/${id}?${query}`, { action: 'confirm' })
  return res.data
}

export async function cancelPublicBooking(id: string, query: string): Promise<{ message: string }> {
  const res = await api.post(`/public/bookings/${id}?${query}`, { action: 'cancel' })
  return res.data
}
