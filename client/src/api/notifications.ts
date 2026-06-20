import api from './axios'
import type { AppNotification } from '../types'

export async function getNotifications(): Promise<{ unread_count: number; items: AppNotification[] }> {
  const res = await api.get('/notifications')
  return res.data
}

export async function markNotificationRead(id: number): Promise<void> {
  await api.patch(`/notifications/${id}/read`)
}

export async function markAllNotificationsRead(): Promise<void> {
  await api.post('/notifications/read-all')
}

export async function clearAllNotifications(): Promise<void> {
  await api.delete('/notifications')
}
