import type { Booking } from '../../types/index'
import { deptColors } from '../../data/mockData'

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
  const isMaint = booking.type === 'maintenance' || booking.type === 'repairment'

  const bgColor = isMaint ? '#fb923c' : colors.bg
  const textColor = isMaint ? '#7c2d12' : 'black'

  const typeLabel = isMaint
    ? (booking.type === 'repairment' ? 'REPAIR' : 'MAINT')
    : booking.type === 'external' ? 'EXT' : 'INT'

  const typeBadgeBg = isMaint ? 'rgba(0,0,0,0.12)' : booking.type === 'external' ? '#ffedd5' : '#dbeafe'
  const typeBadgeText = isMaint ? '#7c2d12' : booking.type === 'external' ? '#c2410c' : '#1d4ed8'

  return (
    <div
      className={`absolute inset-y-2 left-1 right-1 rounded-xl flex items-center px-2.5 gap-1.5 overflow-hidden z-10 transition-all
        hover:brightness-105 hover:z-30 group/bar
        ${isMe ? 'outline outline-2 outline-blue-500 outline-offset-[-2px]' : ''}
        ${isDragging ? 'opacity-60 scale-[0.98] cursor-grabbing z-50' : isMe ? 'cursor-grab' : 'cursor-pointer'}
        hover:scale-[1.02]`}
      style={{
        backgroundColor: bgColor,
        opacity: isTentative ? (isDragging ? 0.5 : 0.75) : isDragging ? 0.6 : 1,
        backgroundImage: isTentative
          ? 'repeating-linear-gradient(45deg, transparent, transparent 4px, rgba(0,0,0,0.06) 4px, rgba(0,0,0,0.06) 8px)'
          : isMaint
          ? 'repeating-linear-gradient(45deg, transparent, transparent 6px, rgba(0,0,0,0.06) 6px, rgba(0,0,0,0.06) 12px)'
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

      {isMaint
        ? <span className="material-symbols-outlined shrink-0" style={{ fontSize: 13, color: textColor }}>construction</span>
        : <span className="text-[10px] font-black truncate shrink-0" style={{ color: textColor }}>{dept}</span>
      }
      <span
        className="text-[8px] font-black uppercase px-1.5 py-0.5 rounded-md shrink-0 leading-none"
        style={{ backgroundColor: typeBadgeBg, color: typeBadgeText }}
      >
        {typeLabel}
      </span>
      {isMe && !isMaint && (
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
