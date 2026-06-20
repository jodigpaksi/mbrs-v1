import axios from './axios'
import type { Building } from '../types/index'

export async function getBuildings(): Promise<Building[]> {
  const res = await axios.get('/buildings')
  return res.data
}

export async function getBuilding(id: number): Promise<Building> {
  const res = await axios.get(`/buildings/${id}`)
  return res.data
}

export async function createBuilding(data: Partial<Building>): Promise<Building> {
  const res = await axios.post('/buildings', data)
  return res.data
}

export async function updateBuilding(id: number, data: Partial<Building>): Promise<Building> {
  const res = await axios.patch(`/buildings/${id}`, data)
  return res.data
}

export async function deleteBuilding(id: number): Promise<void> {
  await axios.delete(`/buildings/${id}`)
}
