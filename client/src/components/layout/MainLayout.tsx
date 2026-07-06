import { ReactNode, useState, useEffect, useRef } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import Navbar from './Navbar'
import AiAgentFab from '../ai/AiAgentFab'
import KeyboardShortcutsFab from '../ui/KeyboardShortcutsFab'
import TodayPanel from '../booking/TodayPanel'
import AvailableRoomsPanel from '../room/AvailableRoomsPanel'
import BookingPanel from '../booking/BookingPanel'
import { getGeneralSettings } from '../../api/settings'
import type { Room } from '../../types'

interface MainLayoutProps {
  children: ReactNode
}

function MainLayoutInner({ children }: MainLayoutProps) {
  const queryClient = useQueryClient()
  const { data: generalSettings } = useQuery({ queryKey: ['settings-general'], queryFn: getGeneralSettings, staleTime: 5 * 60_000 })
  const [availableOpen, setAvailableOpen] = useState(false)
  const [selectedRoom, setSelectedRoom]   = useState<Room | null>(null)
  const [prefillDate, setPrefillDate]     = useState('')
  const [prefillStart, setPrefillStart]   = useState('')
  const [prefillEnd, setPrefillEnd]       = useState('')
  const [prefillVersion, setPrefillVersion] = useState(0)
  const [availPrefillDate, setAvailPrefillDate]   = useState<string | undefined>(undefined)
  const [availPrefillStart, setAvailPrefillStart] = useState<string | undefined>(undefined)
  const [availPrefillEnd, setAvailPrefillEnd]     = useState<string | undefined>(undefined)
  const [toast, setToast] = useState<string | null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const fn = () => setAvailableOpen(o => !o)
    document.addEventListener('available-rooms-toggle', fn)
    return () => document.removeEventListener('available-rooms-toggle', fn)
  }, [])

  useEffect(() => {
    const fn = (e: Event) => {
      const { date, startTime, endTime } = (e as CustomEvent<{ date: string; startTime: string; endTime: string }>).detail
      setAvailPrefillDate(date)
      setAvailPrefillStart(startTime)
      setAvailPrefillEnd(endTime)
      setAvailableOpen(true)
    }
    document.addEventListener('available-rooms-prefill', fn)
    return () => document.removeEventListener('available-rooms-prefill', fn)
  }, [])

  function handleRoomSelect(room: Room, date: string, st = '', et = '') {
    const wasOpen = selectedRoom !== null
    setSelectedRoom(room)
    setPrefillDate(date)
    setPrefillStart(st)
    setPrefillEnd(et)
    if (wasOpen) setPrefillVersion(v => v + 1)
  }

  function showToast(msg: string) {
    setToast(msg)
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), 3000)
  }

  function handleBookingSubmit() {
    const bookedDate = prefillDate
    setSelectedRoom(null)
    setAvailableOpen(false)
    queryClient.invalidateQueries({ queryKey: ['bookings', bookedDate] })
    showToast('Booking saved successfully')
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden antialiased" style={{ background: 'var(--ds-bg-base)', color: 'var(--ds-text-1)' }}>
      <Navbar />
      <main className="flex-1 overflow-hidden flex flex-col">
        {children}
      </main>
      {generalSettings?.feature_ai_chat !== false && <AiAgentFab />}
      <KeyboardShortcutsFab stackAboveAiFab={generalSettings?.feature_ai_chat !== false} />
      <TodayPanel />
      <AvailableRoomsPanel
        open={availableOpen}
        bookingOpen={selectedRoom !== null}
        onClose={() => { setAvailableOpen(false); setSelectedRoom(null); setAvailPrefillDate(undefined); setAvailPrefillStart(undefined); setAvailPrefillEnd(undefined) }}
        onRoomSelect={handleRoomSelect}
        prefillDate={availPrefillDate}
        prefillStartTime={availPrefillStart}
        prefillEndTime={availPrefillEnd}
      />
      <BookingPanel
        open={selectedRoom !== null}
        onClose={() => setSelectedRoom(null)}
        initialRoom={selectedRoom}
        prefillDate={prefillDate}
        prefillStart={prefillStart}
        prefillEnd={prefillEnd}
        prefillVersion={prefillVersion}
        onSubmit={handleBookingSubmit}
      />

      {/* Toast — booking saved / layout-level info */}
      <div
        className="fixed z-[9999] transition-all duration-300 pointer-events-none"
        style={{ bottom: 28, right: 96, transform: toast ? 'translateY(0)' : 'translateY(80px)', opacity: toast ? 1 : 0 }}
      >
        <div style={{
          background: 'rgba(15,20,45,0.55)',
          backdropFilter: 'blur(48px) saturate(200%)',
          WebkitBackdropFilter: 'blur(48px) saturate(200%)',
          border: '1px solid rgba(255,255,255,0.14)',
          borderRadius: '1.5rem',
          padding: '16px 20px',
          boxShadow: '0 24px 56px -8px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.12)',
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          minWidth: 320,
        }}>
          <span className="material-symbols-outlined shrink-0" style={{ fontSize: 24, color: '#adee2b' }}>check_circle</span>
          <span className="text-white text-[13px] font-black flex-1">{toast}</span>
        </div>
      </div>

    </div>
  )
}

export default function MainLayout({ children }: MainLayoutProps) {
  return <MainLayoutInner>{children}</MainLayoutInner>
}
