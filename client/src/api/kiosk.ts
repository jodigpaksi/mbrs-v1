import api from './axios'
import type { KioskConfig, KioskStatus } from '../types'

// ── Public (no auth) ────────────────────────────────────────────────────────

export async function getKioskConfig(id: string | number): Promise<KioskConfig & { room: KioskConfig['room'] & { building: string; photos: string[] } | null }> {
  const res = await api.get(`/kiosk/${id}/config`)
  return res.data
}

export async function verifyKioskPin(id: string | number, pin: string): Promise<{ ok: boolean }> {
  const res = await api.post(`/kiosk/${id}/verify`, { pin })
  return res.data
}

export async function getKioskStatus(id: string | number): Promise<KioskStatus> {
  const res = await api.get(`/kiosk/${id}/status`)
  return res.data
}

export async function confirmPresence(id: string | number, bookingId: number): Promise<{ presence_confirmed_at: string }> {
  const res = await api.post(`/kiosk/${id}/confirm`, { booking_id: bookingId })
  return res.data
}

// ── Admin CRUD ───────────────────────────────────────────────────────────────

export async function getKioskConfigs(): Promise<KioskConfig[]> {
  const res = await api.get('/kiosk-configs')
  return res.data
}

export async function createKioskConfig(data: Partial<KioskConfig>): Promise<KioskConfig> {
  const res = await api.post('/kiosk-configs', data)
  return res.data
}

export async function updateKioskConfig(id: number, data: Partial<KioskConfig>): Promise<KioskConfig> {
  const res = await api.patch(`/kiosk-configs/${id}`, data)
  return res.data
}

export async function deleteKioskConfig(id: number): Promise<void> {
  await api.delete(`/kiosk-configs/${id}`)
}
