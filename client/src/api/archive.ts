import api from './axios'
import type { Booking } from '../types'

export interface ArchivePage {
  data: (Booking & { archived_at: string })[]
  total: number
  last_page: number
  page: number
  oldest: string | null
  purge_date: string | null
  settings: {
    archive_after_days: number
    archive_delete_after_days: number
  }
}

export interface ArchiveParams {
  date_from?: string
  date_to?: string
  search?: string
  page?: number
}

export async function getArchive(params: ArchiveParams = {}): Promise<ArchivePage> {
  const res = await api.get('/archive', { params })
  return res.data
}

export async function runArchive(): Promise<{ archived: number; purged: number }> {
  const res = await api.post('/archive/run')
  return res.data
}

export async function restoreBooking(id: number): Promise<void> {
  await api.patch(`/archive/${id}/restore`)
}

export async function restoreAllBookings(): Promise<{ restored: number }> {
  const res = await api.post('/archive/restore-all')
  return res.data
}

export async function purgeArchive(): Promise<{ deleted: number }> {
  const res = await api.delete('/archive/purge')
  return res.data
}

export async function importArchive(file: File): Promise<{ created: number; errors: string[] }> {
  const form = new FormData()
  form.append('file', file)
  const res = await api.post('/archive/import', form, { headers: { 'Content-Type': 'multipart/form-data' } })
  return res.data
}

