import { useState, useMemo } from 'react'
import { mockBookings, mockRooms, mockUsers } from '../data/mockData'

type Tab = 'overview' | 'bookings' | 'rooms' | 'users'
type SortKey = 'start_at' | 'title' | 'room' | 'user' | 'status'
type SortDir = 'asc' | 'desc'

function StatCard({ label, value, sub, dark }: { label: string; value: string; sub: string; dark?: boolean }) {
  return (
    <div className={`p-5 rounded-2xl ${dark ? 'bg-black' : 'bg-white border border-slate-100'}`}>
      <p className={`text-[8px] font-black uppercase tracking-widest ${dark ? 'text-slate-500' : 'text-slate-400'}`}>{label}</p>
      <p className={`text-4xl font-black italic mt-1 ${dark ? 'text-[#adee2b]' : 'text-slate-800'}`}>{value}</p>
      <p className={`text-[9px] font-bold mt-0.5 ${dark ? 'text-slate-500' : 'text-slate-400'}`}>{sub}</p>
    </div>
  )
}

export default function AdminPage() {
  const [tab, setTab] = useState<Tab>('overview')
  const [sortKey, setSortKey] = useState<SortKey>('start_at')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('desc') }
  }

  const now = new Date()

  const sortedBookings = useMemo(() => {
    const upcoming = mockBookings.filter(b => new Date(b.end_at) >= now)
    const past = mockBookings.filter(b => new Date(b.end_at) < now)

    function sortFn(a: typeof mockBookings[0], b: typeof mockBookings[0]) {
      let va = '', vb = ''
      if (sortKey === 'start_at') return sortDir === 'desc'
        ? new Date(b.start_at).getTime() - new Date(a.start_at).getTime()
        : new Date(a.start_at).getTime() - new Date(b.start_at).getTime()
      if (sortKey === 'title') { va = a.title; vb = b.title }
      else if (sortKey === 'room') { va = a.room?.name ?? ''; vb = b.room?.name ?? '' }
      else if (sortKey === 'user') { va = a.user?.name ?? ''; vb = b.user?.name ?? '' }
      else if (sortKey === 'status') { va = a.status; vb = b.status }
      return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va)
    }

    return [...upcoming.sort(sortFn), ...past.sort(sortFn)]
  }, [sortKey, sortDir])

  const recentBookings = useMemo(() => {
    return [...mockBookings]
      .sort((a, b) => new Date(b.start_at).getTime() - new Date(a.start_at).getTime())
      .slice(0, 5)
  }, [])

  const totalBookings = mockBookings.length
  const confirmedBookings = mockBookings.filter(b => b.status === 'confirmed').length
  const totalRooms = mockRooms.filter(r => r.is_active).length
  const totalUsers = mockUsers.length

  const tabs: { key: Tab; label: string; icon: string }[] = [
    { key: 'overview', label: 'Overview', icon: 'dashboard' },
    { key: 'bookings', label: 'Bookings', icon: 'event' },
    { key: 'rooms', label: 'Rooms', icon: 'meeting_room' },
    { key: 'users', label: 'Users', icon: 'group' },
  ]

  return (
    <div className="flex flex-1 overflow-hidden bg-[#f7f8f6]">

      {/* Sidebar */}
      <div className="w-56 bg-white border-r border-slate-100 flex flex-col shrink-0 p-4">
        <div className="mb-6">
          <p className="text-[9px] font-black uppercase tracking-[0.25em] text-slate-400 px-2">Admin Panel</p>
        </div>
        <nav className="space-y-1">
          {tabs.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all
                ${tab === t.key ? 'bg-black text-[#adee2b]' : 'text-slate-400 hover:bg-slate-50 hover:text-slate-700'}`}>
              <span className="material-symbols-outlined text-sm">{t.icon}</span>
              {t.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-8" style={{ scrollbarWidth: 'thin' }}>

        {tab === 'overview' && (
          <div className="max-w-4xl space-y-6">
            <div>
              <p className="text-[9px] font-black uppercase tracking-[0.25em] text-slate-400 mb-1">Admin Dashboard</p>
              <h1 className="text-3xl font-black italic tracking-tighter uppercase">Overview</h1>
            </div>
            <div className="grid grid-cols-4 gap-4">
              <StatCard label="Total Bookings" value={String(totalBookings)} sub="all time" dark />
              <StatCard label="Confirmed" value={String(confirmedBookings)} sub="active bookings" />
              <StatCard label="Active Rooms" value={String(totalRooms)} sub="available" />
              <StatCard label="Users" value={String(totalUsers)} sub="registered" />
            </div>

            {/* Recent bookings */}
            <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                <h3 className="text-sm font-black uppercase">Recent Bookings</h3>
                <button onClick={() => setTab('bookings')} className="text-[9px] font-black uppercase text-[#adee2b] bg-black px-3 py-1.5 rounded-lg hover:opacity-80">View All</button>
              </div>
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-100">
                    {['Title', 'Room', 'User', 'Date', 'Status'].map(h => (
                      <th key={h} className="px-6 py-3 text-left text-[8px] font-black uppercase text-slate-400 tracking-widest">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {recentBookings.map(b => (
                    <tr key={b.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-3 text-xs font-bold">{b.title}</td>
                      <td className="px-6 py-3 text-xs text-slate-500">{b.room?.name}</td>
                      <td className="px-6 py-3">
                        <div className="flex items-center gap-2">
                          <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${b.user?.name}`} className="size-6 rounded-full bg-slate-100" />
                          <span className="text-xs text-slate-500">{b.user?.name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-3 text-xs text-slate-500">
                        {new Date(b.start_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                      </td>
                      <td className="px-6 py-3">
                        <span className={`text-[8px] font-black uppercase px-2 py-1 rounded-full
                          ${b.status === 'confirmed' ? 'bg-[#adee2b] text-black' : b.status === 'tentative' ? 'bg-slate-100 text-slate-500' : 'bg-red-100 text-red-500'}`}>
                          {b.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === 'bookings' && (
          <div className="max-w-5xl space-y-4">
            <div className="flex items-end justify-between">
              <div>
                <p className="text-[9px] font-black uppercase tracking-[0.25em] text-slate-400 mb-1">Admin Dashboard</p>
                <h1 className="text-3xl font-black italic tracking-tighter uppercase">All Bookings</h1>
              </div>
              <p className="text-[9px] font-bold text-slate-400">Upcoming first · Past at bottom</p>
            </div>
            <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50">
                    <th className="px-4 py-3 text-left text-[8px] font-black uppercase text-slate-400 tracking-widest">#</th>
                    {([
                      { label: 'Title', key: 'title' },
                      { label: 'Room', key: 'room' },
                      { label: 'User / Dept', key: 'user' },
                      { label: 'Start', key: 'start_at' },
                      { label: 'Status', key: 'status' },
                    ] as { label: string; key: SortKey }[]).map(h => (
                      <th key={h.key} className="px-4 py-3 text-left">
                        <button onClick={() => toggleSort(h.key)}
                          className="flex items-center gap-1 text-[8px] font-black uppercase tracking-widest hover:text-slate-700 transition-colors"
                          style={{ color: sortKey === h.key ? '#000' : '' }}>
                          <span className={sortKey === h.key ? 'text-black' : 'text-slate-400'}>{h.label}</span>
                          <span className="material-symbols-outlined text-[10px] leading-none" style={{ color: sortKey === h.key ? '#000' : '#cbd5e1' }}>
                            {sortKey === h.key ? (sortDir === 'asc' ? 'arrow_upward' : 'arrow_downward') : 'unfold_more'}
                          </span>
                        </button>
                      </th>
                    ))}
                    <th className="px-4 py-3 text-left text-[8px] font-black uppercase text-slate-400 tracking-widest">End</th>
                    <th className="px-4 py-3 text-left text-[8px] font-black uppercase text-slate-400 tracking-widest">Type</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedBookings.map(b => {
                    const isPast = new Date(b.end_at) < now
                    return (
                      <tr key={b.id} className={`border-b border-slate-50 transition-colors ${isPast ? 'opacity-40 hover:opacity-60' : 'hover:bg-slate-50'}`}>
                        <td className="px-4 py-3 text-[10px] font-black text-slate-300">{b.id}</td>
                        <td className="px-4 py-3 text-xs font-bold">{b.title}</td>
                        <td className="px-4 py-3 text-xs text-slate-500">{b.room?.name}</td>
                        <td className="px-4 py-3">
                          <p className="text-xs font-bold">{b.user?.name}</p>
                          <p className="text-[9px] text-slate-400">{b.user?.department}</p>
                        </td>
                        <td className="px-4 py-3 text-[10px] text-slate-500">
                          {new Date(b.start_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                          {' '}
                          {new Date(b.start_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-[8px] font-black uppercase px-2 py-1 rounded-full
                            ${b.status === 'confirmed' ? 'bg-[#adee2b] text-black' : b.status === 'tentative' ? 'bg-slate-100 text-slate-500' : 'bg-red-100 text-red-500'}`}>
                            {b.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-[10px] text-slate-500">
                          {new Date(b.end_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td className="px-4 py-3 text-[9px] text-slate-400 uppercase font-bold">{b.type}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === 'rooms' && (
          <div className="max-w-4xl space-y-4">
            <h1 className="text-3xl font-black italic tracking-tighter uppercase">Rooms</h1>
            <div className="grid grid-cols-3 gap-4">
              {mockRooms.map(r => {
                const dotColor = r.type === 'Ballroom' ? 'bg-purple-400' : r.type === 'Executive' ? 'bg-blue-400' : 'bg-green-400'
                return (
                  <div key={r.id} className="bg-white rounded-2xl border border-slate-100 overflow-hidden hover:shadow-md transition-shadow">
                    {r.photos[0] && <img src={r.photos[0]} className="w-full h-32 object-cover" />}
                    <div className="p-4">
                      <div className="flex items-center gap-2 mb-1">
                        <div className={`size-2 rounded-full ${dotColor}`} />
                        <p className="text-xs font-black">{r.name}</p>
                      </div>
                      <p className="text-[9px] text-slate-400 font-bold">{r.capacity} pax · Floor {r.floor}</p>
                      <div className="flex flex-wrap gap-1 mt-2">
                        {r.facilities.slice(0, 3).map(f => (
                          <span key={f.name} className="text-[8px] font-bold bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">{f.name}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {tab === 'users' && (
          <div className="max-w-2xl space-y-4">
            <h1 className="text-3xl font-black italic tracking-tighter uppercase">Users</h1>
            <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
              {mockUsers.map(u => (
                <div key={u.id} className="flex items-center gap-4 px-6 py-4 border-b border-slate-50 hover:bg-slate-50 transition-colors">
                  <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${u.name}`} className="size-10 rounded-full bg-slate-100 border-2 border-[#adee2b] p-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-black">{u.name}</p>
                    <p className="text-[10px] text-slate-400 font-bold">{u.email}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-[8px] font-black uppercase px-2 py-1 rounded-full bg-slate-100 text-slate-500">{u.department}</span>
                    <p className="text-[8px] text-slate-300 font-bold mt-1">{u.role}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
