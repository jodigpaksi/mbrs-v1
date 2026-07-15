import api from './axios'

export interface OverviewStats {
  total_bookings: number
  total_bookings_month: number
  confirmed: number
  confirmed_month: number
  tentative: number
  cancelled: number
  active_rooms: number
  total_users: number
  unique_visitors_today: number
  unique_visitors_week: number
  unique_visitors_month: number
  unique_visitors_all: number
  unique_visitors_today_date: string
  unique_visitors_week_start: string
  unique_visitors_week_end: string
  unique_visitors_month_start: string
  unique_visitors_month_end: string
  unique_visitors_all_since: string | null
  storage: {
    db_mb: number
    room_photos_mb: number
    avatars_mb: number
    logo_mb: number
    login_photo_mb: number
    other_uploads_mb: number
    uploads_mb: number
    logs_mb: number
  }
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
  building_ids?: number[]
  dept_id?: number | ''
  page?: number
}

export type SectionPeriod = 'month' | 'all'

export async function getAnalyticsOverview(
  period: 7 | 30 | 'all' = 7,
  statusPeriod: SectionPeriod = 'month',
  roomsPeriod: SectionPeriod = 'month',
  hoursPeriod: SectionPeriod = 'month',
  buildingId?: number | null,
): Promise<AnalyticsOverview> {
  const { data } = await api.get('/analytics/overview', {
    params: {
      period,
      status_period: statusPeriod,
      rooms_period: roomsPeriod,
      hours_period: hoursPeriod,
      ...(buildingId ? { building_id: buildingId } : {}),
    },
  })
  return data
}

export async function downloadAnalyticsExport(filters: AnalyticsFilters = {}): Promise<void> {
  const params: Record<string, unknown> = {}
  if (filters.from) params.from = filters.from
  if (filters.to) params.to = filters.to
  if (filters.room_id) params.room_id = filters.room_id
  if (filters.building_id) params.building_id = filters.building_id
  if (filters.building_ids?.length) params['building_ids[]'] = filters.building_ids
  if (filters.dept_id) params.dept_id = filters.dept_id

  const response = await api.get('/analytics/export', { params, responseType: 'blob' })
  const url = URL.createObjectURL(new Blob([response.data]))
  const a = document.createElement('a')
  a.href = url
  a.download = `bookings-${new Date().toISOString().slice(0, 10)}.xlsx`
  a.click()
  URL.revokeObjectURL(url)
}
