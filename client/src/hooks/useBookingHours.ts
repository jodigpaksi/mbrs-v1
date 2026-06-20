import { useQuery } from '@tanstack/react-query'
import { getBookingHours } from '../api/settings'

const DEFAULT = { start: '07:00', end: '19:00' }

export function useBookingHours() {
  const { data } = useQuery({
    queryKey: ['booking-hours'],
    queryFn: getBookingHours,
    staleTime: 5 * 60_000,
  })
  return data ?? DEFAULT
}
