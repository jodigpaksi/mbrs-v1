import { queryClient } from '../main'
import { getGeneralSettings, getBookingHours, getWeekendSettings } from './settings'
import { getRooms } from './rooms'
import { getMyBookings } from './bookings'
import { getDirectory } from './users'
import { getNotifications } from './notifications'

const MIN5  = 5  * 60_000
const MIN10 = 10 * 60_000

export async function prefetchAfterLogin() {
  await Promise.allSettled([
    queryClient.prefetchQuery({ queryKey: ['settings-general'],  queryFn: getGeneralSettings,  staleTime: MIN5  }),
    queryClient.prefetchQuery({ queryKey: ['booking-hours'],     queryFn: getBookingHours,     staleTime: MIN10 }),
    queryClient.prefetchQuery({ queryKey: ['weekend-settings'],  queryFn: getWeekendSettings,  staleTime: MIN10 }),
    queryClient.prefetchQuery({ queryKey: ['rooms'],             queryFn: getRooms,            staleTime: MIN5  }),
    queryClient.prefetchQuery({ queryKey: ['my-bookings'],       queryFn: getMyBookings,       staleTime: 30_000 }),
    queryClient.prefetchQuery({ queryKey: ['user-directory'],    queryFn: getDirectory,        staleTime: MIN10 }),
    queryClient.prefetchQuery({ queryKey: ['notifications'],     queryFn: getNotifications,    staleTime: 30_000 }),
  ])
}
