import { useRef, useState } from 'react'
import { useBookingHours } from '../../hooks/useBookingHours'

function fromMin(min: number) { return `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}` }
function toMin(hhmm: string) { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m }

interface Props {
  open: boolean
  onClose: () => void
}

interface FaqItem { q: string; a: string }
interface Section { key: string; icon: string; label: string; items: FaqItem[] }

function buildSections(start: string, end: string, latestStart: string): Section[] {
  return [
    {
      key: 'getting-started',
      icon: 'rocket_launch',
      label: 'Getting Started',
      items: [
        {
          q: 'What is the Timeline view?',
          a: 'The Timeline (home page) shows all rooms in a horizontal grid for the current day. Each row is one room; each column block is a booking. Click any empty slot to start a new booking pre-filled with that room and time.',
        },
        {
          q: 'What is the My Bookings page?',
          a: 'My Bookings shows a calendar of your own bookings. Switch between Day, Week, and Month views using the toggle at the top. Day view supports drag-and-drop to move or resize bookings.',
        },
        {
          q: 'What is the Rooms page?',
          a: 'The Rooms directory lists every available room with photos, capacity, floor, and facilities. Click a room card to see full details and check its availability before booking.',
        },
        {
          q: 'How do I navigate between pages?',
          a: 'Use the icon buttons in the top navigation bar: the grid icon for Timeline, the calendar icon for My Bookings, and the door icon for Rooms. Your role may show additional tabs.',
        },
      ],
    },
    {
      key: 'making-bookings',
      icon: 'edit_calendar',
      label: 'Making Bookings',
      items: [
        {
          q: 'How do I book a room?',
          a: 'Click the "New Booking" button on any page, or click an empty slot on the Timeline to pre-fill the room and time. Fill in the title, adjust the time range if needed, then click Save.',
        },
        {
          q: 'What are the booking time limits?',
          a: `Bookings can start between ${start}–${latestStart} during working hours, in 30-minute increments. For sessions that end after working hours (up to ${end}), please contact a receptionist to arrange it.`,
        },
        {
          q: 'Can I book a room for someone else?',
          a: 'If the "Book on behalf of others" feature is enabled by your admin, you will see a "Booking for" field in the booking form. Search for a colleague\'s name to assign the booking to them.',
        },
        {
          q: 'What does "tentative" mean?',
          a: 'Certain rooms require admin approval. A tentative booking holds the slot but is marked as pending. You will receive a notification once an admin confirms or rejects it.',
        },
        {
          q: 'Can I see if a room is available before booking?',
          a: 'Yes — open the Rooms page and click on any room to view its daily availability. You can also use the Available Rooms panel (the door icon on the toolbar) to filter rooms by time range.',
        },
      ],
    },
    {
      key: 'managing-bookings',
      icon: 'manage_history',
      label: 'Managing Bookings',
      items: [
        {
          q: 'How do I edit a booking?',
          a: 'Click the booking on the Timeline or My Bookings page to open its detail card, then click Edit. You can change the title, time, or notes. Note: you cannot change the room after booking.',
        },
        {
          q: 'How do I cancel a booking?',
          a: 'Open the booking and click Cancel. A confirmation toast will appear at the bottom-right with a 10-second undo button. After 10 seconds the cancellation is permanent.',
        },
        {
          q: 'How do I drag-and-resize bookings?',
          a: 'Switch to Day view on the My Bookings page. Drag a booking bar left or right to move it to a new time. Drag its left or right edge to shorten or extend it. Changes are saved automatically.',
        },
        {
          q: 'What happens if a booking conflicts?',
          a: 'The system checks for conflicts in real time. If the time slot is taken you will see an error message and the booking will not save. Choose a different time or room.',
        },
        {
          q: 'Can I recover a cancelled booking?',
          a: 'Only within the 10-second undo window shown in the toast notification. After that, the cancellation cannot be reversed — you would need to create a new booking.',
        },
      ],
    },
    {
      key: 'rooms',
      icon: 'meeting_room',
      label: 'Rooms',
      items: [
        {
          q: 'How do I view room details?',
          a: 'Go to the Rooms page and click any room card. You will see the room\'s capacity, floor, building, facilities (projector, whiteboard, etc.), and a photo gallery.',
        },
        {
          q: 'What is a Special Room?',
          a: 'Special rooms require approval before a booking is confirmed. When you book one, the booking starts as "tentative". A designated contact will be notified and will confirm or decline.',
        },
        {
          q: 'What does the "Available Rooms" panel do?',
          a: 'Click the door icon in the toolbar to open the Available Rooms panel. Enter a date and time range to instantly see which rooms are free during that window.',
        },
        {
          q: 'How do facilities symbols work?',
          a: 'Each room card shows small icons for its facilities (e.g., projector, TV, whiteboard). Hover over an icon to see its label. Facilities are set by your admin.',
        },
      ],
    },
    {
      key: 'notifications',
      icon: 'notifications',
      label: 'Notifications',
      items: [
        {
          q: 'What triggers a notification?',
          a: 'You will receive notifications when: a booking you made is confirmed or rejected, a booking is cancelled by an admin, or your presence check-in is required (if Anti-Ghost mode is active).',
        },
        {
          q: 'How do I view my notifications?',
          a: 'Click the bell icon in the top navigation bar. A number badge shows how many unread notifications you have. Click any notification to dismiss it.',
        },
        {
          q: 'How do I clear all notifications?',
          a: 'Open the notification panel and click "Clear all" at the top. Individual notifications can also be dismissed by clicking the × on each item.',
        },
        {
          q: 'What is a presence check-in?',
          a: 'If your admin has enabled Anti-Ghost mode, you may need to confirm your presence at the room before or shortly after your booking starts — via the Kiosk screen, a sensor, or the web confirm button shown on your booking card.',
        },
      ],
    },
    {
      key: 'account',
      icon: 'account_circle',
      label: 'Account',
      items: [
        {
          q: 'How do I update my profile photo?',
          a: 'Click your avatar in the top-right corner → User Profile → click the avatar circle to upload a new photo. Supported formats: JPG, PNG (max 2 MB).',
        },
        {
          q: 'How do I change my password?',
          a: 'Go to avatar → Setting → Change Password. Enter your current password and your new password twice. If the Change Password option is not visible, it may be disabled by your admin.',
        },
        {
          q: 'How do I log out?',
          a: 'Click your avatar in the top-right corner and select "Logout" at the bottom of the dropdown menu.',
        },
      ],
    },
  ]
}

function AccordionItem({ q, a }: FaqItem) {
  const [open, setOpen] = useState(false)
  return (
    <div className="rounded-2xl overflow-hidden border" style={{ borderColor: 'var(--ds-border-sub)' }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-[var(--ds-bg-raised)]"
      >
        <span className="text-[12px] font-black" style={{ color: 'var(--ds-text-1)' }}>{q}</span>
        <span
          className="material-symbols-outlined shrink-0 transition-transform"
          style={{ fontSize: 18, color: 'var(--ds-text-3)', transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}
        >
          keyboard_arrow_down
        </span>
      </button>
      {open && (
        <div className="px-4 pb-4 pt-1" style={{ background: 'var(--ds-bg-raised)' }}>
          <p className="text-[12px] leading-relaxed font-medium" style={{ color: 'var(--ds-text-2)' }}>{a}</p>
        </div>
      )}
    </div>
  )
}

export default function HelpModal({ open, onClose }: Props) {
  const { start, end } = useBookingHours()
  const latestStart = fromMin(toMin(end) - 30)
  const sections = buildSections(start, end, latestStart)
  const [activeKey, setActiveKey] = useState(sections[0].key)
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({})
  const scrollRef = useRef<HTMLDivElement>(null)

  function scrollToSection(key: string) {
    setActiveKey(key)
    const el = sectionRefs.current[key]
    if (el && scrollRef.current) {
      scrollRef.current.scrollTo({ top: el.offsetTop - 16, behavior: 'smooth' })
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div
        className="relative flex flex-col rounded-3xl shadow-2xl w-full max-w-[780px]"
        style={{
          background: 'var(--ds-bg-surface)',
          border: '1px solid var(--ds-border-sub)',
          maxHeight: '82vh',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-7 py-5 shrink-0 rounded-t-3xl"
          style={{ borderBottom: '1px solid var(--ds-border-sub)', background: 'var(--ds-bg-surface)' }}
        >
          <div className="flex items-center gap-3">
            <div className="size-9 rounded-xl flex items-center justify-center" style={{ background: '#0f141e' }}>
              <span className="material-symbols-outlined text-base" style={{ color: '#adee2b' }}>help</span>
            </div>
            <div>
              <p className="text-[14px] font-black" style={{ color: 'var(--ds-text-1)' }}>Help & FAQ</p>
              <p className="text-[9px] font-bold uppercase tracking-wider" style={{ color: 'var(--ds-text-3)' }}>RoomSync Pro</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="size-8 rounded-full flex items-center justify-center transition-colors hover:bg-[var(--ds-bg-raised)]"
            style={{ color: 'var(--ds-text-3)' }}
          >
            <span className="material-symbols-outlined text-base">close</span>
          </button>
        </div>

        {/* Body */}
        <div className="flex flex-1 min-h-0">
          {/* Left sidebar */}
          <div
            className="w-44 shrink-0 flex flex-col gap-1 p-3 overflow-y-auto"
            style={{ borderRight: '1px solid var(--ds-border-sub)' }}
          >
            {sections.map(sec => {
              const isActive = activeKey === sec.key
              return (
                <button
                  key={sec.key}
                  type="button"
                  onClick={() => scrollToSection(sec.key)}
                  className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left transition-colors"
                  style={{
                    background: isActive ? 'rgba(173,238,43,0.12)' : 'transparent',
                    color: isActive ? '#4d7c00' : 'var(--ds-text-2)',
                  }}
                >
                  <span
                    className="material-symbols-outlined shrink-0"
                    style={{ fontSize: 17, color: isActive ? '#4d7c00' : 'var(--ds-text-3)' }}
                  >
                    {sec.icon}
                  </span>
                  <span className="text-[11px] font-black leading-tight">{sec.label}</span>
                </button>
              )
            })}
          </div>

          {/* Right content */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-8">
            {sections.map(sec => (
              <section
                key={sec.key}
                ref={el => { sectionRefs.current[sec.key] = el }}
              >
                <div className="flex items-center gap-2 mb-4">
                  <span
                    className="material-symbols-outlined"
                    style={{ fontSize: 18, color: '#adee2b' }}
                  >
                    {sec.icon}
                  </span>
                  <p className="text-[13px] font-black uppercase tracking-wider" style={{ color: 'var(--ds-text-1)' }}>
                    {sec.label}
                  </p>
                </div>
                <div className="space-y-2">
                  {sec.items.map(item => (
                    <AccordionItem key={item.q} {...item} />
                  ))}
                </div>
              </section>
            ))}

            {/* Footer */}
            <div className="pt-2 pb-1 text-center">
              <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--ds-text-3)' }}>
                Still need help? Contact IT Support at ext. 100
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
