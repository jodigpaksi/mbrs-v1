export type UserRole = 'user' | 'admin' | 'receptionist' | 'building_admin'

export interface Department {
  id: number
  name: string
  code?: string
  location_id?: number | null
  location?: { id: number; name: string; code?: string }
  users_count?: number
}

export interface User {
  id: number
  name: string
  email: string
  alias?: string | null
  department: string       // name string, returned from backend for display (auth context)
  department_name?: string  // flat string from appended accessor on booking user relations
  department_id?: number | null
  role: UserRole
  avatar?: string
  ext?: string
  on_duty?: boolean
  can_book_special?: boolean
  default_building_id?: number | null
  department_location?: { id: number; name: string; code?: string } | null
  admin_buildings?: { id: number; name: string; address?: string; location?: { id: number; name: string } }[]
}

export interface Facility {
  name: string
  icon: string
}

export interface Location {
  id: number
  name: string
  code?: string
  buildings_count?: number
}

export interface Building {
  id: number
  location_id?: number
  location?: Location
  name: string
  code?: string
  address?: string
  floors: number
  notes?: string
  is_active: boolean
  rooms?: Room[]
}

export interface AvailableSlot {
  start: string   // ISO datetime e.g. "2026-06-16T09:00:00"
  end: string
}

export interface Room {
  id: number
  building_id?: number
  building?: Building
  sort_order?: number
  name: string
  capacity: number
  floor: string
  facilities: Facility[]
  photos: string[]
  notes?: string
  is_active: boolean
  status: 'active' | 'maintenance'
  requires_contact: boolean
  sensor_code?: string | null
  available_slots?: AvailableSlot[]
  is_fully_free?: boolean
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
  type: 'internal' | 'external' | 'maintenance' | 'repairment'
  cancelled_at?: string
  series_id?: string
  series_skipped_dates?: string[] | null
  resolves_series_id?: string | null
  resolves_skipped_date?: string | null
  booked_for?: string
  booked_for_user_id?: number
  is_recipient?: boolean
  presence_confirmed_at?: string | null
  cancel_reason?: string | null
  dispute_status?: 'pending' | 'approved' | 'rejected' | null
  dispute_note?: string | null
  disputed_at?: string | null
  dispute_resolved_at?: string | null
  dispute_resolved_by?: number | null
}

export interface AppNotification {
  id: number
  booking_id: number
  type: string
  message: string
  read_at: string | null
  created_at: string
  booking?: Booking
}


export interface PantryItem {
  icon: string
  label: string
  quantity: number
}

export interface KioskTheme {
  mode:    'dark' | 'light'
  accent:  string
  bg:      string
  surface: string
  text:    string
}

export interface KioskLayout {
  show_clock:       boolean
  show_bookings:    boolean
  show_book_btn:    boolean
  show_confirm_btn: boolean
  orientation:      'landscape' | 'portrait'
  book_btn_url:     string
  upcoming_count:   number
}

export interface KioskResolution {
  preset: 'ipad' | 'ipad-pro-11' | 'ipad-pro-13' | 'surface' | 'fullhd' | 'custom'
  width:  number
  height: number
}

export interface KioskConfig {
  id:         number
  name:       string
  slug:       string | null
  room_id:    number | null
  room?:      { id: number; name: string; floor: string; building_id?: number }
  has_pin:    boolean
  pin?:       string
  theme:      KioskTheme
  layout:     KioskLayout
  resolution: KioskResolution
  active:     boolean
  created_at: string
  updated_at: string
}

export interface KioskStatus {
  room: { id: number; name: string; status: string; capacity: number; floor: string } | null
  current: {
    id: number; title: string; start_at: string; end_at: string
    user: string | null; department: string | null; type: string; status: string
    presence_confirmed_at: string | null
  } | null
  upcoming: Array<{
    id: number; title: string; start_at: string; end_at: string
    user: string | null; department: string | null; type: string; status: string
    presence_confirmed_at: string | null
  }>
  free_until:  string | null
  free_from:   string | null
  server_time: string
}

export interface PantryOrder {
  id?: number
  booking_id?: number
  items: PantryItem[]
  special_request?: string
}
