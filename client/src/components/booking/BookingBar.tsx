import type { Booking } from '../../types/index'
import { deptColors } from '../../data/mockData'

const typeColors: Record<string, { bg: string; text: string }> = {
  internal: { bg: '#dbeafe', text: '#1d4ed8' },
  external: { bg: '#ffedd5', text: '#c2410c' },
}

interface BookingBarProps {
  booking: Booking
  onMouseEnter: (e: React.MouseEvent, booking: Booking) => void
  onMouseLeave: () => void
  isMe?: boolean
  isDragging?: boolean
  onBarMouseDown?: (e: React.MouseEvent) => void
  onResizeMouseDown?: (e: React.MouseEvent, edge: 'left' | 'right') => void
}

export default function BookingBar({
  booking, onMouseEnter, onMouseLeave, isMe, isDragging,
  onBarMouseDown, onResizeMouseDown,
}: BookingBarProps) {
  const dept = booking.user?.department || 'GAA'
  const colors = deptColors[dept] || deptColors['GAA']
  const isTentative = booking.status === 'tentative'
  const isMaintenance = booking.user?.department === 'MTC'
  const typeColor = typeColors[booking.type] || typeColors.internal

  return (
    <div
      className={`absolute inset-y-2 left-1 right-1 rounded-xl flex items-center px-2.5 gap-1.5 overflow-hidden z-10 transition-all
        hover:brightness-105 hover:z-30 group/bar
        ${isMe ? 'outline outline-2 outline-blue-500 outline-offset-[-2px]' : ''}
        ${isDragging ? 'opacity-60 scale-[0.98] cursor-grabbing z-50' : isMe ? 'cursor-grab' : 'cursor-pointer'}
        ${isMe ? 'hover:scale-[1.02]' : 'hover:scale-[1.02]'}`}
      style={{
        backgroundColor: colors.bg,
        opacity: isTentative ? (isDragging ? 0.5 : 0.75) : isDragging ? 0.6 : 1,
        backgroundImage: isTentative
          ? 'repeating-linear-gradient(45deg, transparent, transparent 4px, rgba(0,0,0,0.06) 4px, rgba(0,0,0,0.06) 8px)'
          : undefined,
      }}
      onMouseDown={isMe ? onBarMouseDown : undefined}
      onMouseEnter={e => onMouseEnter(e, booking)}
      onMouseLeave={onMouseLeave}
    >
      {/* Left resize handle */}
      {isMe && (
        <div
          onMouseDown={e => { e.stopPropagation(); onResizeMouseDown?.(e, 'left') }}
          className="absolute left-0 inset-y-0 w-2.5 cursor-col-resize z-20 opacity-0 group-hover/bar:opacity-100 bg-white/25 rounded-l-xl transition-opacity flex items-center justify-center"
          title="Drag to resize"
        >
          <div className="w-0.5 h-3 bg-white/50 rounded-full" />
        </div>
      )}

      <span className={`text-[10px] font-black truncate shrink-0 ${isMaintenance ? 'text-white' : 'text-black'}`}>
        {dept}
      </span>
      <span
        className="text-[8px] font-black uppercase px-1.5 py-0.5 rounded-md shrink-0 leading-none"
        style={{ backgroundColor: typeColor.bg, color: typeColor.text }}
      >
        {booking.type === 'external' ? 'EXT' : 'INT'}
      </span>
      {isMe && (
        <span className="material-symbols-outlined text-blue-700 ml-auto shrink-0" style={{ fontSize: 12 }}>
          person
        </span>
      )}

      {/* Right resize handle */}
      {isMe && (
        <div
          onMouseDown={e => { e.stopPropagation(); onResizeMouseDown?.(e, 'right') }}
          className="absolute right-0 inset-y-0 w-2.5 cursor-col-resize z-20 opacity-0 group-hover/bar:opacity-100 bg-white/25 rounded-r-xl transition-opacity flex items-center justify-center"
          title="Drag to resize"
        >
          <div className="w-0.5 h-3 bg-white/50 rounded-full" />
        </div>
      )}
    </div>
  )
}
