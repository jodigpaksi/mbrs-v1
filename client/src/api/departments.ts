import api from './axios'
import type { Department } from '../types'

export async function getDepartments(): Promise<Department[]> {
  const res = await api.get('/departments')
  return res.data
}

export async function createDepartment(data: { name: string; code?: string }): Promise<Department> {
  const res = await api.post('/departments', data)
  return res.data
}

export async function updateDepartment(id: number, data: { name?: string; code?: string | null }): Promise<Department> {
  const res = await api.patch(`/departments/${id}`, data)
  return res.data
}

export async function deleteDepartment(id: number): Promise<void> {
  await api.delete(`/departments/${id}`)
}
