import api from './axios'
import type { Location } from '../types/index'

export async function getLocations(): Promise<Location[]> {
  const res = await api.get('/locations')
  return res.data
}

export async function createLocation(data: Partial<Location>): Promise<Location> {
  const res = await api.post('/locations', data)
  return res.data
}

export async function updateLocation(id: number, data: Partial<Location>): Promise<Location> {
  const res = await api.patch(`/locations/${id}`, data)
  return res.data
}

export async function deleteLocation(id: number): Promise<void> {
  await api.delete(`/locations/${id}`)
}
