import api from './axios'

export interface OverviewStats {
  total_bookings: number
  confirmed: number
  tentative: number
  cancelled: number
  active_rooms: number
  total_users: number
}

export interface AnalyticsOverview {
  stats: OverviewStats
  trend: { date: string; count: number }[]
  top_rooms: { room: string; count: number }[]
  status_breakdown: { status: string; count: number }[]
  peak_hours: { hour: number; count: number }[]
}

export interface AnalyticsReportItem {
  id: number
  title: string
  status: string
  type: string
  start_at: string
  end_at: string
  room: { id: number; name: string } | null
  user: { id: number; name: string; department_name: string } | null
}

export interface AnalyticsSummary {
  total: number
  confirmed: number
  cancelled: number
  unique_users: number
  unique_rooms: number
}

export interface AnalyticsReport {
  summary: AnalyticsSummary
  data: AnalyticsReportItem[]
  meta: { current_page: number; last_page: number; total: number }
}

export interface AnalyticsFilters {
  from?: string
  to?: string
  room_id?: number | ''
  building_id?: number | ''
  dept_id?: number | ''
  page?: number
}

export type SectionPeriod = 'month' | 'all'

export async function getAnalyticsOverview(
  period: 7 | 30 = 7,
  statusPeriod: SectionPeriod = 'month',
  roomsPeriod: SectionPeriod = 'month',
  hoursPeriod: SectionPeriod = 'month',
): Promise<AnalyticsOverview> {
  const { data } = await api.get('/analytics/overview', {
    params: { period, status_period: statusPeriod, rooms_period: roomsPeriod, hours_period: hoursPeriod },
  })
  return data
}

export async function getAnalyticsReport(filters: AnalyticsFilters = {}): Promise<AnalyticsReport> {
  const params: Record<string, unknown> = {}
  if (filters.from) params.from = filters.from
  if (filters.to) params.to = filters.to
  if (filters.room_id) params.room_id = filters.room_id
  if (filters.building_id) params.building_id = filters.building_id
  if (filters.dept_id) params.dept_id = filters.dept_id
  if (filters.page && filters.page > 1) params.page = filters.page
  const { data } = await api.get('/analytics/report', { params })
  return data
}

export async function downloadAnalyticsExport(filters: AnalyticsFilters = {}): Promise<void> {
  const params: Record<string, unknown> = {}
  if (filters.from) params.from = filters.from
  if (filters.to) params.to = filters.to
  if (filters.room_id) params.room_id = filters.room_id
  if (filters.building_id) params.building_id = filters.building_id
  if (filters.dept_id) params.dept_id = filters.dept_id

  const response = await api.get('/analytics/export', { params, responseType: 'blob' })
  const url = URL.createObjectURL(new Blob([response.data]))
  const a = document.createElement('a')
  a.href = url
  a.download = `bookings-${new Date().toISOString().slice(0, 10)}.xlsx`
  a.click()
  URL.revokeObjectURL(url)
}
