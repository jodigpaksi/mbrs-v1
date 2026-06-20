import api from './axios'
import type { Asset, AssetUnit } from '../types/index'

// Asset types (master registry)
export async function getAssets(): Promise<Asset[]> {
  const res = await api.get('/assets')
  return res.data
}

export async function createAsset(data: Partial<Asset>): Promise<Asset> {
  const res = await api.post('/assets', data)
  return res.data
}

export async function updateAsset(id: number, data: Partial<Asset>): Promise<Asset> {
  const res = await api.patch(`/assets/${id}`, data)
  return res.data
}

export async function deleteAsset(id: number): Promise<void> {
  await api.delete(`/assets/${id}`)
}

// Asset units (individual physical units)
export async function createAssetUnit(assetId: number, data: Partial<AssetUnit>): Promise<AssetUnit> {
  const res = await api.post(`/assets/${assetId}/units`, data)
  return res.data
}

export async function updateAssetUnit(assetId: number, unitId: number, data: Partial<AssetUnit>): Promise<AssetUnit> {
  const res = await api.patch(`/assets/${assetId}/units/${unitId}`, data)
  return res.data
}

export async function deleteAssetUnit(assetId: number, unitId: number): Promise<void> {
  await api.delete(`/assets/${assetId}/units/${unitId}`)
}
