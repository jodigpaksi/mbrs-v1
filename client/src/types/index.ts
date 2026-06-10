export interface User {
  id: number
  name: string
  email: string
  department: string
  role: 'user' | 'admin'
  avatar?: string
  ext?: string
}

export interface Facility {
  name: string
  icon: string
}

export interface Room {
  id: number
  name: string
  type: 'Ballroom' | 'Executive' | 'Focus'
  capacity: number
  floor: string
  facilities: Facility[]
  photos: string[]
  notes?: string
  is_active: boolean
}

export interface Booking {
  id: number
  user_id: number
  room_id: number
  room?: Room
  user?: User
  title: string
  description?: string
  start_at: string
  end_at: string
  status: 'confirmed' | 'tentative' | 'cancelled'
  type: 'internal' | 'external'
  cancelled_at?: string
}

export interface PantryItem {
  icon: string
  label: string
  quantity: number
}

export interface PantryOrder {
  id?: number
  booking_id?: number
  items: PantryItem[]
  special_request?: string
}
