import api from './axios'
import type { User, UserRole } from '../types/index'

export async function getUsers(): Promise<User[]> {
  const res = await api.get('/users')
  return res.data
}

export async function createUser(data: {
  name: string; email: string; password: string
  department_id?: number | null; role?: UserRole; ext?: string
}): Promise<User> {
  const res = await api.post('/users', data)
  return res.data
}

export async function importUsers(rows: {
  name: string; email: string; password: string
  department?: string; role?: string; ext?: string
}[]): Promise<{ created: number; errors: string[] }> {
  const res = await api.post('/users/import', { users: rows })
  return res.data
}

export async function updateUser(id: number, data: {
  name?: string; email?: string; department_id?: number | null; ext?: string; password?: string; avatar?: string | null
}): Promise<User> {
  const res = await api.patch(`/users/${id}`, data)
  return res.data
}

export async function updateUserRole(id: number, role: UserRole): Promise<User> {
  const res = await api.patch(`/users/${id}/role`, { role })
  return res.data
}

export async function assignUserBuildings(id: number, buildingIds: number[]): Promise<User> {
  const res = await api.put(`/users/${id}/buildings`, { building_ids: buildingIds })
  return res.data
}

export async function deleteUser(id: number): Promise<void> {
  await api.delete(`/users/${id}`)
}

export async function getDirectory(): Promise<{ id: number; name: string; email: string; ext?: string; department: string }[]> {
  const res = await api.get('/users/directory')
  return res.data
}

export async function exportUsers(): Promise<{ name: string; email: string; password: string; department: string; role: string; ext: string }[]> {
  const res = await api.get('/users/export')
  return res.data
}
