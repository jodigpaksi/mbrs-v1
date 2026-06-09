import type { Room, Booking, User } from '../types/index'

export const mockRooms: Room[] = [
  {
    id: 1, name: 'Ballroom 101', type: 'Ballroom', capacity: 100, floor: 'B1', is_active: true,
    photos: ['https://images.unsplash.com/photo-1517457373958-b7bdd4587205?q=80&w=800', 'https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?q=80&w=800'],
    facilities: [{ name: 'Sound', icon: 'volume_up' }, { name: 'Stage', icon: 'layers' }, { name: 'Projector', icon: 'videocam' }, { name: 'AC', icon: 'ac_unit' }],
    notes: 'Suitable for large-scale events. Coordinate with GA team 48hrs before for stage/AV setup.'
  },
  {
    id: 2, name: 'Ballroom 102', type: 'Ballroom', capacity: 100, floor: 'B1', is_active: true,
    photos: ['https://images.unsplash.com/photo-1492684223066-81342ee5ff30?q=80&w=800'],
    facilities: [{ name: 'Sound', icon: 'volume_up' }, { name: 'Stage', icon: 'layers' }, { name: 'AC', icon: 'ac_unit' }],
    notes: 'Suitable for large-scale events.'
  },
  {
    id: 3, name: 'Ballroom 103', type: 'Ballroom', capacity: 80, floor: 'B1', is_active: true,
    photos: ['https://images.unsplash.com/photo-1517457373958-b7bdd4587205?q=80&w=800'],
    facilities: [{ name: 'Projector', icon: 'videocam' }, { name: 'AC', icon: 'ac_unit' }],
    notes: 'Medium ballroom for events up to 80 pax.'
  },
  {
    id: 4, name: 'Executive 101', type: 'Executive', capacity: 12, floor: '5F', is_active: true,
    photos: ['https://images.unsplash.com/photo-1497366811353-6870744d04b2?q=80&w=800', 'https://images.unsplash.com/photo-1462826303086-329426d1aef5?q=80&w=800'],
    facilities: [{ name: '4K TV', icon: 'tv' }, { name: 'Webcam', icon: 'photo_camera' }, { name: 'Wifi', icon: 'wifi' }, { name: 'Whiteboard', icon: 'border_color' }],
    notes: 'For senior leadership and external meetings. Video conferencing pre-configured.'
  },
  {
    id: 5, name: 'Executive 102', type: 'Executive', capacity: 12, floor: '5F', is_active: true,
    photos: ['https://images.unsplash.com/photo-1560472354-b33ff0c44a43?q=80&w=800'],
    facilities: [{ name: '4K TV', icon: 'tv' }, { name: 'Wifi', icon: 'wifi' }, { name: 'Whiteboard', icon: 'border_color' }],
    notes: 'Executive suite with full AV setup.'
  },
  {
    id: 6, name: 'Executive 103', type: 'Executive', capacity: 8, floor: '4F', is_active: true,
    photos: ['https://images.unsplash.com/photo-1497366811353-6870744d04b2?q=80&w=800'],
    facilities: [{ name: 'TV', icon: 'tv' }, { name: 'Wifi', icon: 'wifi' }],
    notes: 'Smaller executive room for focused discussions.'
  },
  {
    id: 7, name: 'Focus 101', type: 'Focus', capacity: 4, floor: '3F', is_active: true,
    photos: ['https://images.unsplash.com/photo-1505409859467-3a799be57c8f?q=80&w=800', 'https://images.unsplash.com/photo-1521737711867-e3b97375f902?q=80&w=800'],
    facilities: [{ name: 'AC', icon: 'ac_unit' }, { name: 'Wifi', icon: 'wifi' }],
    notes: 'Quiet zone — no phone calls. Max 4 pax strictly enforced.'
  },
  {
    id: 8, name: 'Focus 102', type: 'Focus', capacity: 4, floor: '3F', is_active: true,
    photos: ['https://images.unsplash.com/photo-1497366216548-37526070297c?q=80&w=800'],
    facilities: [{ name: 'AC', icon: 'ac_unit' }, { name: 'Wifi', icon: 'wifi' }],
    notes: 'Quiet zone for focused work.'
  },
  {
    id: 9, name: 'Focus 103', type: 'Focus', capacity: 6, floor: '2F', is_active: true,
    photos: ['https://images.unsplash.com/photo-1505409859467-3a799be57c8f?q=80&w=800'],
    facilities: [{ name: 'Whiteboard', icon: 'border_color' }, { name: 'Wifi', icon: 'wifi' }],
    notes: 'Small meeting room for quick discussions.'
  },
]

export const mockUsers: User[] = [
  { id: 1, name: 'Anita Wijaya', email: 'anita.w@corp.com', department: 'GAA', role: 'admin', ext: '102', avatar: 'Anita' },
  { id: 2, name: 'Jessica Miller', email: 'jess.m@corp.com', department: 'HRD', role: 'user', ext: '801', avatar: 'Aria' },
  { id: 3, name: 'Fixer Team', email: 'mtc@corp.com', department: 'MTC', role: 'user', ext: '000', avatar: 'Felix' },
]

export const mockBookings: Booking[] = [
  { id: 1, user_id: 1, room_id: 1, title: 'Weekly Facility Audit', description: 'Monthly walkthrough covering all floors.', start_at: '2026-06-07T09:00:00', end_at: '2026-06-07T10:30:00', status: 'confirmed', type: 'internal', user: mockUsers[0], room: mockRooms[0] },
  { id: 2, user_id: 2, room_id: 4, title: 'Internal Recruitment', description: 'Panel interview for 2 open positions.', start_at: '2026-06-07T11:00:00', end_at: '2026-06-07T13:00:00', status: 'tentative', type: 'internal', user: mockUsers[1], room: mockRooms[3] },
  { id: 3, user_id: 3, room_id: 7, title: 'AC Repair', description: 'Urgent AC repair session.', start_at: '2026-06-07T14:00:00', end_at: '2026-06-07T16:00:00', status: 'confirmed', type: 'internal', user: mockUsers[2], room: mockRooms[6] },
  { id: 4, user_id: 1, room_id: 5, title: 'Vendor Meeting', description: 'Q2 procurement discussion.', start_at: '2026-06-07T13:00:00', end_at: '2026-06-07T14:00:00', status: 'confirmed', type: 'external', user: mockUsers[0], room: mockRooms[4] },
  { id: 5, user_id: 2, room_id: 2, title: 'Budget Review', description: 'Finance sync — Q1 actuals vs forecast.', start_at: '2026-06-07T15:00:00', end_at: '2026-06-07T16:30:00', status: 'confirmed', type: 'internal', user: mockUsers[1], room: mockRooms[1] },
]

export const deptColors: Record<string, { bg: string; text: string; dot: string }> = {
  GAA: { bg: '#adee2b', text: '#000', dot: '#84cc16' },
  HRD: { bg: '#d1d5db', text: '#000', dot: '#94a3b8' },
  MTC: { bg: '#fb923c', text: '#fff', dot: '#f97316' },
}
