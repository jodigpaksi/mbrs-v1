import { useQuery } from '@tanstack/react-query'
import { getWeekendSettings } from '../api/settings'

const DEFAULT = { saturday: true, sunday: true }

export function useWeekendSettings() {
  const { data } = useQuery({
    queryKey: ['weekend-settings'],
    queryFn: getWeekendSettings,
    staleTime: 5 * 60_000,
  })
  return data ?? DEFAULT
}
