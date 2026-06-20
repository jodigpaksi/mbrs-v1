import type { Booking } from '../../types/index'

interface BookingBarProps {
  booking: Booking
  onMouseEnter: (e: React.MouseEvent, booking: Booking) => void
  onMouseLeave: () => void
  isMe?: boolean
  isDragging?: boolean
  showTitle?: boolean
  onBarMouseDown?: (e: React.MouseEvent) => void
  onResizeMouseDown?: (e: React.MouseEvent, edge: 'left' | 'right') => void
}

export default function BookingBar({
  booking, onMouseEnter, onMouseLeave, isMe, isDragging, showTitle,
  onBarMouseDown, onResizeMouseDown,
}: BookingBarProps) {
  const dept = booking.user?.department_name || (typeof booking.user?.department === 'string' ? booking.user.department : '') || 'GAA'
  const isTentative = booking.status === 'tentative'
  const isMaint = booking.type === 'maintenance' || booking.type === 'repairment'

  // Color system:
  // me + confirmed  → blue-500 solid
  // me + tentative  → blue-300 + stripes
  // other confirmed → lime solid
  // other tentative → gray + stripes
  // maintenance     → orange + stripes (regardless of owner)
  const bgColor = isMaint
    ? '#fb923c'
    : isMe
      ? (isTentative ? '#b0e8f8' : '#72ddf7')
      : (isTentative ? '#d1d5db' : '#adee2b')

  const textColor = isMaint
    ? '#7c2d12'
    : isMe
      ? (isTentative ? '#1e40af' : 'black')
      : (isTentative ? '#475569' : 'black')

  const typeLabel = isMaint
    ? (booking.type === 'repairment' ? 'REPAIR' : 'MAINT')
    : booking.type === 'external' ? 'EXT' : 'INT'

  // Type badge: white/translucent on blue bars, original on others
  const typeBadgeBg = isMaint
    ? 'rgba(0,0,0,0.12)'
    : booking.type === 'external' ? '#ffedd5' : '#dbeafe'
  const typeBadgeText = isMaint
    ? '#7c2d12'
    : booking.type === 'external' ? '#c2410c' : '#1d4ed8'

  return (
    <div
      className={`absolute inset-y-2 left-1 right-1 rounded-xl flex items-center px-2.5 gap-1.5 overflow-hidden z-10 transition-all
        hover:brightness-105 hover:z-30 group/bar
        ${isDragging ? 'opacity-60 scale-[0.98] cursor-grabbing z-50' : isMe ? 'cursor-grab' : 'cursor-pointer'}
        hover:scale-[1.02]`}
      style={{
        backgroundColor: bgColor,
        opacity: isDragging ? (isTentative ? 0.5 : 0.6) : 1,
        backgroundImage: isTentative
          ? 'repeating-linear-gradient(45deg, transparent, transparent 4px, rgba(0,0,0,0.04) 4px, rgba(0,0,0,0.04) 8px)'
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

      {/* Series indicator — white stripe (visible on any fill color) */}
      {booking.series_id && (
        <div className="absolute top-0 left-2 right-2 h-[3px] rounded-b-full bg-white/60 z-20" />
      )}

      {isMaint
        ? <span className="material-symbols-outlined shrink-0" style={{ fontSize: 13, color: textColor }}>construction</span>
        : <span className="text-[11px] font-black truncate shrink-0" style={{ color: textColor }}>{dept}</span>
      }
      <span
        className="text-[10px] font-black uppercase px-1.5 py-0.5 rounded-md shrink-0 leading-none"
        style={{ backgroundColor: typeBadgeBg, color: typeBadgeText }}
      >
        {typeLabel}
      </span>
      {booking.series_id && (
        <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded-md shrink-0 leading-none"
          style={{ backgroundColor: 'rgba(255,255,255,0.25)', color: textColor }}>
          series
        </span>
      )}
      {showTitle && !isMaint && (
        <span
          className="text-[11px] font-bold truncate flex-1 min-w-0"
          style={{ color: textColor, opacity: 0.8 }}
        >
          {booking.title}
        </span>
      )}
      {isMe && !isMaint && (
        <span className="material-symbols-outlined ml-auto shrink-0" style={{ fontSize: 12, color: textColor, opacity: 0.65 }}>
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
