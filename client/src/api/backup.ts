import api from './axios'

export interface BackupFile { path: string; name: string; size: number }
export interface BackupEntry { label: string; files: BackupFile[]; created_at: number }
export interface BackupInclude { archive: boolean; log: boolean; data: boolean }

export async function runBackupExport(formats: string[], include: BackupInclude): Promise<{ files: number }> {
  const res = await api.post('/backup/export', { formats, include })
  return res.data
}

export async function listBackupExports(): Promise<BackupEntry[]> {
  const res = await api.get('/backups')
  return res.data
}

export async function deleteAllBackupExports(): Promise<{ deleted: number }> {
  const res = await api.delete('/backups/all')
  return res.data
}

export function getBackupDownloadUrl(path: string): string {
  return `/api/backups/download?path=${encodeURIComponent(path)}`
}
