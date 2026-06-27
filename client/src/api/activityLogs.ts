import api from './axios'

export interface ActivityLog {
  id: number
  action: string
  category: string
  description: string
  metadata: Record<string, unknown> | null
  ip_address: string | null
  created_at: string
  actor: { id: number; name: string; role: string } | null
}

export interface ActivityLogPage {
  data: ActivityLog[]
  meta: { current_page: number; last_page: number; total: number }
}

export async function getActivityLogs(params: {
  category?: string
  q?: string
  page?: number
} = {}): Promise<ActivityLogPage> {
  const res = await api.get('/activity-logs', { params })
  return res.data
}
