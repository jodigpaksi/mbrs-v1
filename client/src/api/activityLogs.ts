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

export async function exportActivityLogs(params: {
  format: 'excel' | 'pdf' | 'txt'
  category?: string
  q?: string
}): Promise<void> {
  const res = await api.get('/activity-logs/export', { params, responseType: 'blob' })
  const ext = params.format === 'pdf' ? 'pdf' : params.format === 'txt' ? 'txt' : 'xlsx'
  const url = URL.createObjectURL(new Blob([res.data]))
  const a = document.createElement('a')
  a.href = url
  a.download = `activity-log-${new Date().toISOString().slice(0, 10)}.${ext}`
  a.click()
  URL.revokeObjectURL(url)
}
