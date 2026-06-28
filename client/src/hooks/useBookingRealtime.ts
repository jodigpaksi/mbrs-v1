import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { echo } from '../lib/echo'

/**
 * Subscribes to the public 'bookings' channel and invalidates booking-related
 * queries whenever the server broadcasts a BookingChanged event. This replaces
 * the old 15s `refetchInterval` polling — data now refreshes only when something
 * actually changes, so there is no periodic UI "blink".
 */
export function useBookingRealtime() {
  const qc = useQueryClient()

  useEffect(() => {
    const channel = echo.channel('bookings')
    channel.listen('.BookingChanged', () => {
      qc.invalidateQueries({ queryKey: ['bookings'] })
      qc.invalidateQueries({ queryKey: ['bookings-month'] })
      qc.invalidateQueries({ queryKey: ['my-bookings'] })
      qc.invalidateQueries({ queryKey: ['all-my-bookings'] })
      qc.invalidateQueries({ queryKey: ['special-bookings'] })
    })
    return () => {
      echo.leaveChannel('bookings')
    }
  }, [qc])
}
