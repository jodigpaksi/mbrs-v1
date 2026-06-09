import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

const NAV_ITEMS = [
  { path: '/', label: 'Schedule', icon: 'grid_view' },
  { path: '/schedule', label: 'My Bookings', icon: 'calendar_month' },
]

interface NavbarProps {
  onSearch?: (q: string) => void
  onTodayClick?: () => void
}

export default function Navbar({ onSearch, onTodayClick }: NavbarProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, logout } = useAuth()

  const isActive = (path: string) => location.pathname === path

  const allItems = user?.role === 'admin'
    ? [...NAV_ITEMS, { path: '/admin', label: 'Admin', icon: 'admin_panel_settings' }]
    : NAV_ITEMS

  async function handleLogout() {
    await logout()
    navigate('/login')
  }

  return (
    <nav className="flex items-center justify-between px-8 bg-white border-b border-slate-100 sticky top-0 z-50 shrink-0" style={{ height: 60 }}>

      {/* Logo */}
      <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate('/')}>
        <div className="size-9 bg-black rounded-xl flex items-center justify-center text-[#adee2b]">
          <span className="material-symbols-outlined text-lg">sync_alt</span>
        </div>
        <span className="text-xl font-black tracking-tighter italic uppercase">
          RoomSync <span className="text-blue-600">Pro</span>
        </span>
      </div>

      {/* Page nav — segmented pill */}
      {(() => {
        const activeIndex = allItems.findIndex(item => isActive(item.path))
        const ITEM_W = 126
        return (
          <div className="relative flex items-center bg-slate-100 p-1 rounded-xl"
            style={{ width: allItems.length * ITEM_W + 8 }}>
            {/* Sliding pill */}
            <div
              className="absolute top-1 bottom-1 bg-white rounded-lg shadow-sm pointer-events-none transition-transform duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]"
              style={{ width: ITEM_W, transform: `translateX(${activeIndex * ITEM_W}px)` }}
            />
            {allItems.map(item => (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                style={{ width: ITEM_W }}
                className={`relative flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wide transition-colors duration-200 z-10
                  ${isActive(item.path) ? 'text-slate-900' : 'text-slate-400 hover:text-slate-600'}`}
              >
                <span className="material-symbols-outlined text-sm">{item.icon}</span>
                {item.label}
              </button>
            ))}
          </div>
        )
      })()}

      {/* Right actions */}
      <div className="flex items-center gap-3">
        <div className="relative">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 text-base">search</span>
          <input
            type="text"
            placeholder="Search rooms..."
            onChange={e => onSearch?.(e.target.value)}
            className="w-36 bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-[11px] font-bold focus:w-52 focus:outline-none focus:ring-2 focus:ring-[#adee2b] focus:border-transparent transition-all"
          />
        </div>

        <button
          onClick={onTodayClick}
          className="flex items-center gap-2 px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl hover:border-[#adee2b] hover:bg-[#f7fee7] transition-all text-[10px] font-black uppercase"
        >
          <span className="material-symbols-outlined text-base">today</span>
          Today
        </button>

        {/* Avatar + logout */}
        <div className="flex items-center gap-2 group relative">
          <img
            src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.avatar || user?.name}`}
            className="size-9 rounded-full border-2 border-[#adee2b] p-0.5 bg-slate-100 cursor-pointer"
            title={user?.name}
          />
          <div className="absolute right-0 top-full mt-2 w-48 bg-white border border-slate-100 rounded-2xl shadow-xl z-50 overflow-hidden
            opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-all duration-200 translate-y-1 group-hover:translate-y-0">
            <div className="px-4 py-3 border-b border-slate-100">
              <p className="text-[11px] font-black text-slate-800">{user?.name}</p>
              <p className="text-[9px] text-slate-400 font-bold uppercase">{user?.department} · {user?.role}</p>
            </div>
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-2.5 px-4 py-3 hover:bg-red-50 hover:text-red-600 text-slate-500 transition-colors text-[10px] font-black uppercase"
            >
              <span className="material-symbols-outlined text-sm">logout</span>
              Sign Out
            </button>
          </div>
        </div>
      </div>
    </nav>
  )
}
