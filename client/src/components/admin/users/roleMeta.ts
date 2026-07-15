import type { UserRole } from '../../../types/index'

const ROLE_META: Record<UserRole, { label: string; bg: string; text: string; desc: string; perms: string[] }> = {
  admin: {
    label: 'Super Admin', bg: 'bg-black', text: 'text-[#adee2b]',
    desc: 'Unrestricted access to all system features.',
    perms: ['Manage all users & roles', 'Manage buildings, rooms & locations', 'Access analytics & export', 'Change all system settings', 'Manage archive & export schedule'],
  },
  building_admin: {
    label: 'Building Admin', bg: 'bg-blue-500/10', text: 'text-blue-400',
    desc: 'Manages rooms within assigned buildings.',
    perms: ['Add / edit / delete rooms', 'Upload room photos', 'Reorder rooms', 'Cannot change system settings', 'Cannot manage other users'],
  },
  receptionist: {
    label: 'Receptionist', bg: 'bg-purple-500/10', text: 'text-purple-400',
    desc: 'Manages bookings with elevated privileges.',
    perms: ['Edit & delete any booking', 'Bypass after-hours restrictions', 'Access special rooms without extra permission', 'Cannot manage rooms or system settings'],
  },
  user: {
    label: 'User', bg: 'bg-[var(--ds-bg-raised)]', text: 'text-[var(--ds-text-3)]',
    desc: 'Standard user with basic booking access.',
    perms: ['Create & manage own bookings', 'View room schedule & availability', 'Cannot manage users or rooms'],
  },
}
const ALL_ROLES: UserRole[] = ['admin', 'building_admin', 'receptionist', 'user']

export { ROLE_META, ALL_ROLES }
