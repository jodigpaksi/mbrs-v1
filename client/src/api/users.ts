import api from './axios'
import type { User, UserRole } from '../types/index'

export async function getUsers(): Promise<User[]> {
  const res = await api.get('/users')
  return res.data
}

export async function createUser(data: {
  name: string; email: string; password: string; alias?: string | null
  department_id?: number | null; role?: UserRole; ext?: string
}): Promise<User> {
  const res = await api.post('/users', data)
  return res.data
}

export async function importUsers(rows: {
  name: string; email: string; password: string; alias?: string
  department?: string; role?: string; ext?: string
}[]): Promise<{ created: number; errors: string[] }> {
  const res = await api.post('/users/import', { users: rows })
  return res.data
}

export async function updateUser(id: number, data: {
  name?: string; email?: string; alias?: string | null; department_id?: number | null; ext?: string; password?: string; avatar?: string | null
}): Promise<User> {
  const res = await api.patch(`/users/${id}`, data)
  return res.data
}

export async function updateUserRole(id: number, role: UserRole): Promise<User> {
  const res = await api.patch(`/users/${id}/role`, { role })
  return res.data
}

export async function assignUserBuildings(id: number, buildingIds: number[], defaultBuildingId?: number | null): Promise<User> {
  const body: Record<string, unknown> = { building_ids: buildingIds }
  if (defaultBuildingId !== undefined) body.default_building_id = defaultBuildingId
  const res = await api.put(`/users/${id}/buildings`, body)
  return res.data
}

export async function deleteUser(id: number): Promise<void> {
  await api.delete(`/users/${id}`)
}

export async function getDirectory(): Promise<{ id: number; name: string; email: string; alias?: string; ext?: string; role: string; avatar?: string; department: string; buildings?: { id: number; name: string }[] }[]> {
  const res = await api.get('/users/directory')
  return res.data
}

export async function exportUsers(): Promise<{ name: string; email: string; alias: string; password: string; department: string; department_location: string; role: string; ext: string; default_building: string; assigned_buildings: string; created_at?: string; updated_at?: string }[]> {
  const res = await api.get('/users/export')
  return res.data
}
