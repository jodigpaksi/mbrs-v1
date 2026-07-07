# MRBS v1 — RoomSync Pro: Project Context for AI-Assisted Development

> **Purpose of this file:** Full context handoff for Claude AI (or any AI assistant) to continue development of this project without losing any knowledge. Read this before making any changes.

---

## 1. Project Overview

**Name:** MRBS v1 (Meeting Room Booking System) / "RoomSync Pro"  
**Purpose:** Internal office/hotel meeting room booking system — staff can see a live timeline, drag-create/move/resize bookings, manage their schedule, and admins can see all bookings.  
**Status:** Feature-complete MVP, actively developed. Not yet deployed — runs on XAMPP locally.  
**Language default:** UI text is Indonesian (`id`). Code comments/identifiers are English.

---

## 2. Tech Stack

| Layer | Technology |
|---|---|
| Backend | Laravel 11 + Sanctum (token auth) |
| Frontend | React 18 + TypeScript + Vite |
| Styling | TailwindCSS v3 + Material Symbols (Google Icons) |
| Data fetching | @tanstack/react-query v5 |
| HTTP client | Axios (with Sanctum token header) |
| Local server | XAMPP (PHP 8.x, MySQL) |

**Root path:** `C:\XAMPP\htdocs\mbrs-v1\`  
- Server: `server/` (Laravel)  
- Client: `client/` (React/Vite)

**Dev commands:**
```bash
# Server: XAMPP Apache must be running (manages PHP)
# Client:
cd client
npm run dev   # starts on port 5173 (or 5174 if occupied)
```

**API base:** `http://localhost/mbrs-v1/server/public/api`  
**CORS:** `server/config/cors.php` — `http://localhost:5173` and `http://localhost:5174` are whitelisted.

---

## 3. File Structure

```
mbrs-v1/
├── server/                        # Laravel 11
│   ├── app/Http/Controllers/Api/
│   │   ├── BookingController.php  # CRUD + myBookings + clearCancelled
│   │   ├── RoomController.php     # rooms + availability + stats
│   │   └── AuthController.php     # login, logout, me
│   ├── config/cors.php            # CORS allowed origins
│   └── routes/api.php             # All API routes
│
└── client/src/
    ├── api/
    │   ├── axios.ts               # Axios instance, token from localStorage
    │   ├── bookings.ts            # getBookings, getMyBookings, createBooking, updateBooking, cancelBooking, clearCancelledBookings
    │   └── rooms.ts               # getRooms, getRoom, getRoomStats, checkAvailability
    ├── context/
    │   └── AuthContext.tsx         # Auth state, login/logout, user object
    ├── components/
    │   ├── layout/
    │   │   ├── MainLayout.tsx      # Wraps all pages; mounts Navbar + AiAgentFab globally
    │   │   └── Navbar.tsx          # Top navigation bar
    │   ├── booking/
    │   │   ├── BookingPanel.tsx    # Slide-in form for create/edit bookings (right drawer)
    │   │   ├── BookingBar.tsx      # Visual booking bar in timeline grid
    │   │   └── BookingTooltip.tsx  # Glass hover card showing booking details
    │   ├── room/
    │   │   └── RoomDetailModal.tsx # Full room stats modal with photo slideshow
    │   ├── auth/
    │   │   └── ProtectedRoute.tsx  # Redirects to /login if not authenticated
    │   └── ai/
    │       └── AiAgentFab.tsx      # Floating Action Button + chat panel (UI only — no backend yet)
    └── pages/
        ├── LoginPage.tsx
        ├── TimelinePage.tsx        # Main timeline grid with drag/resize (most complex file)
        ├── SchedulePage.tsx        # My bookings — tabs: Active, Upcoming, Cancelled, All Bookings
        └── AdminPage.tsx           # Admin: all bookings table, overview stats
```

---

## 4. Routes (React)

| Path | Component | Description |
|---|---|---|
| `/login` | LoginPage | Public. Sanctum token auth. |
| `/` | TimelinePage | Default. Timeline grid, drag-create bookings. |
| `/schedule` | SchedulePage | My bookings management. |
| `/admin` | AdminPage | Admin-only all bookings table + stats. |

All non-login routes are wrapped in `<ProtectedRoute>` → `<MainLayout>`.

---

## 5. API Endpoints

### Auth
```
POST   /api/login              { email, password }  → { token, user }
POST   /api/logout             → 200
GET    /api/me                 → user object
```

### Rooms
```
GET    /api/rooms              → Room[]
GET    /api/rooms/:id          → Room
GET    /api/rooms/:id/stats    → { bookings_this_month, utilization, peak_hours[] }
GET    /api/rooms/:id/availability?start_at=&end_at=&exclude_booking_id=  → { available: bool }
```

### Bookings
```
GET    /api/bookings?date=YYYY-MM-DD&room_id=   → Booking[]  (filtered by date)
GET    /api/bookings/my                          → Booking[]  (current user, excludes cancelled)
GET    /api/bookings/all-my                      → Booking[]  (current user, includes cancelled)
POST   /api/bookings           { room_id, title, description?, start_at, end_at, status?, type? }
PATCH  /api/bookings/:id       (partial update — same fields)
DELETE /api/bookings/:id       → cancels booking (sets status=cancelled)
DELETE /api/bookings/clear-cancelled  → bulk delete all cancelled bookings for user
```

**Datetime format:** `"YYYY-MM-DD HH:MM:SS"` (no timezone suffix — server stores local time).  
**Conflict check:** Server uses strict overlap: `start_at < existing.end_at AND end_at > existing.start_at`.  
⚠️ **Known gap:** `PATCH /api/bookings/:id` (update) does NOT check for conflicts. Only `POST` does.

---

## 6. Data Models

```typescript
interface User {
  id: number
  name: string
  email: string
  department?: string
  phone?: string
  role: 'admin' | 'user'
}

interface Room {
  id: number
  name: string
  capacity: number
  department: string
  floor?: string
  description?: string
  photo?: string      // URL
  photos?: string[]   // array of URLs
  phone?: string
}

interface Booking {
  id: number
  room_id: number
  user_id: number
  title: string
  description?: string
  start_at: string    // "2026-06-09 09:00:00"
  end_at: string      // "2026-06-09 10:30:00"
  status: 'confirmed' | 'tentative' | 'cancelled'
  type: 'internal' | 'external' | 'training' | string
  room?: Room
  user?: User
}
```

---

## 7. Design System

### Colors
```
Primary accent:  #adee2b  (lime-green — buttons, highlights, booking bars)
Dark accent:     #7ecb00  (darker lime for gradients)
Background:      #f7f8f6  (warm off-white)
Text primary:    slate-900
Text secondary:  slate-500 / slate-400
```

### Glass Styles

**Dark glass** (FAB, chat panel, tooltips on dark bg):
```css
background: rgba(12,16,38,0.65);
backdrop-filter: blur(24px) saturate(200%);
border: 1px solid rgba(255,255,255,0.13);
box-shadow: 0 8px 32px rgba(0,0,0,0.28), inset 0 1px 0 rgba(255,255,255,0.10);
```

**Fluent glass** (modals, BookingTooltip, BookingPanel):
```css
background: rgba(255,255,255,0.82);
backdrop-filter: blur(48px) saturate(200%);
border: 1px solid rgba(255,255,255,0.6);
```

### Icons
Material Symbols Outlined (Google). Usage pattern:
```tsx
<span className="material-symbols-outlined" style={{ fontSize: 18, fontVariationSettings: "'FILL' 1" }}>
  icon_name
</span>
```
Common icons: `diamond`, `calendar_today`, `schedule`, `close`, `arrow_upward`, `filter_list`, `view_agenda`, `view_week`

### Animations
Spring bounce: `cubic-bezier(0.34,1.56,0.64,1)` — used for FAB appear, panel open  
Smooth ease: `cubic-bezier(0.4,0,0.2,1)` — used for slide/collapse transitions  
Panel appear: `panel-in` keyframe (translateY(24px) → 0, scale 0.97 → 1, 280ms)

---

## 8. TimelinePage — Core Architecture

The most complex file. Key concepts:

### Grid Layout
- Time range: **07:00 – 19:00** (12 hours)
- Slot width: `SLOT_W = 64px` per half-hour slot = 24 slots total
- Room rows: one row per room, fixed height
- Header: sticky time labels, click-to-scroll

### View Modes
```typescript
const [viewMode, setViewMode] = useState<'day' | 'week'>('day')
```
Toggle in unified filter pill (top toolbar). Week view fires 7 parallel queries via `useQueries`.

### Date Handling — CRITICAL
**Always use local date, never `toISOString()`.**  
`toISOString()` returns UTC — in UTC+7, before 07:00 local, it returns yesterday's date.

```typescript
// CORRECT helper — always use this:
function toLocalDateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// WRONG — causes date shift in timezones east of UTC:
d.toISOString().split('T')[0]  // ❌ NEVER use this for date queries
```

**Parsing server times — also important:**
```typescript
// Server stores without timezone suffix. Remove 'Z' before parsing to avoid UTC shift:
const d = new Date(isoString.replace('Z', ''))  // ✓
```

### Drag / Create / Resize System
```
cellDragRef  → dragging empty cell to create new booking
barDragRef   → dragging existing booking bar to move it
barResizeRef → resizing booking bar (right handle)
dragTick     → useState counter forces re-render during drag without stale closures
```

During drag: pill overlay shows current time range `"HH:MM – HH:MM"`.  
Sub-slot precision: `fracPx = deltaPixels - deltaSlot * SLOT_W` tracks pixel offset within slot.

### Conflict Detection (client-side)
`slotOverlaps()` checks against `queryClient.getQueryData` cache — may be stale. Server is authoritative.

### Week View Queries
```typescript
const weekResults = useQueries({
  queries: weekDates.map(d => ({
    queryKey: ['bookings', toLocalDateStr(d)],
    queryFn: () => getBookings({ date: toLocalDateStr(d) }),
    enabled: viewMode === 'week',
  }))
})
```
Cache is shared with day view — switching between days reuses cached data.

### Unified Filter Toolbar
```tsx
// Day/Week toggle + Dept filter in one pill group:
<div className="flex items-center bg-slate-100 rounded-2xl p-1 gap-0.5">
  <button onClick={() => setViewMode('day')}>Day</button>
  <button onClick={() => setViewMode('week')}>Week</button>
  <div className="w-px h-5 bg-slate-300/60 mx-0.5" />  {/* divider */}
  <div ref={deptRef} className="relative">
    {/* Department filter dropdown */}
  </div>
</div>
```

---

## 9. SchedulePage — Architecture

### Tabs
1. **Active** — upcoming/today confirmed+tentative bookings
2. **Upcoming** — next 7 days
3. **Cancelled** — cancelled bookings (filtered by `start_at` in ±7 day window — see Known Bugs)
4. **All Bookings** — sortable table, all statuses, past rows dimmed

### Card View (Masonry Grid)
Two-column masonry using independent flex columns (NOT CSS Grid — CSS Grid snaps on remove).
```tsx
// Two columns side by side, cards distributed by index parity
{[0, 1].map(col =>
  <div key={col} className="flex flex-col gap-4">
    {bookings.filter((_, i) => i % 2 === col).map(b => (
      <SlideWrapper key={b.id} exiting={exitingCancelId === b.id}>
        {/* card */}
      </SlideWrapper>
    ))}
  </div>
)}
```

### SlideWrapper — Smooth Card Removal
JS-measured height collapse. Must be defined **outside** the SchedulePage function component.
```typescript
function SlideWrapper({ exiting, children }: { exiting: boolean; children: ReactNode }) {
  const wrapRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = wrapRef.current
    if (!el || !exiting) return
    const h = el.scrollHeight
    el.style.height = `${h}px`
    el.style.overflow = 'hidden'
    el.getBoundingClientRect()  // force reflow — critical!
    el.style.transition = 'height 0.32s cubic-bezier(0.4,0,0.2,1)'
    el.style.height = '0'
  }, [exiting])
  return <div ref={wrapRef}>{children}</div>
}
```

### Two-Phase Cancel Flow
```
User clicks cancel →
  pendingCancelId = booking.id   (dims the card, shows undo button, 10s timer)
  → user can undo (clears pendingCancelId)
  → at 10s: exitingCancelId = booking.id (triggers SlideWrapper collapse, 380ms)
  → after 380ms: API DELETE call, queryClient.invalidate, clear both IDs
```

### View Toggle (Card | List)
Always rendered. Disabled (opacity-35) when `activeTab === 'all'` (All Bookings is always list/table). Click guarded: `activeTab !== 'all' && setView(...)`.

---

## 10. BookingPanel

Slide-in right drawer for creating and editing bookings.

### Availability Check
Real API check, debounced 600ms. Shows spinner while checking, green/red badge from `checkAvailability` endpoint. Submit blocked until API confirms available. Edit bookings pass `exclude_booking_id` to ignore the current booking in conflict check.

### Pre-fill from Timeline
When user drags empty cell → `BookingPanel` opens with `prefillDate`, `prefillRoom`, `prefillStart`, `prefillEnd` props. These use `toLocalDateStr()` to avoid UTC shift.

---

## 11. AiAgentFab (UI-only, no backend yet)

**File:** `client/src/components/ai/AiAgentFab.tsx`  
**Mounted in:** `MainLayout.tsx` — shows on every page.

### Visual
- Fixed bottom-right: `right: 28, bottom: 28`
- Dark glass style, 56×56px, borderRadius 18
- Diamond icon `#adee2b` — morphs to close (rotate 45°) when panel open
- Green pulse dot: `top:-3, right:-3`, bg `#34d399`

### Chat Panel
- `380×520px`, opens above FAB (`bottom: 96`)
- Same dark glass style
- Components: header (lime gradient avatar + "RoomSync AI" + "Powered by Claude"), welcome bubble, 3 suggestion chips, text input + send button
- Spring animation open: `cubic-bezier(0.34,1.56,0.64,1)`

### Planned Backend (NOT YET BUILT)
Architecture plan:
```
React chat UI → POST /api/ai/chat → Laravel proxy → Ollama localhost:11434
```
- Model: `qwen2.5:3b` (~2GB, supports Bahasa Indonesia)
- Ollama not yet installed on the server machine
- Steps to build: (1) Install Ollama, pull model, (2) Add Laravel route + AiController, (3) Wire up React input/message state

---

## 12. AdminPage

- **Overview tab:** Stats cards + 5 most recent bookings
- **All Bookings tab:** Full table with sort by Title/Room/User/Start/Status. Newest first default. Past rows dimmed at bottom.

---

## 13. Known Bugs & Risks

### 🔴 High Risk (data integrity)

**1. Conflict check missing on update**  
`BookingController::update()` does NOT check for booking conflicts. Only `store()` does. Dragging/resizing via timeline calls `PATCH /api/bookings/:id` → two users can move bookings to the same slot and both succeed.  
Fix: Add overlap check to `update()` using same logic as `store()`, excluding `$booking->id` from check.

**2. (PARTIALLY FIXED) Timezone / UTC date bug**  
Most occurrences of `toISOString().split('T')[0]` replaced with `toLocalDateStr()`. Remaining: `parseLocal()` in SchedulePage/BookingTooltip uses `.replace('Z', '')` which is OK since server stores local time (no `Z` suffix).

### 🟡 Medium Risk (logic errors)

**3. `slotOverlaps()` uses stale cache**  
Client-side conflict check reads `queryClient.getQueryData` — may be stale or empty for rooms not yet loaded. Can miss existing bookings. Server check is authoritative but only on `store()`.

**4. `cancelledList` filters by `start_at` not `cancelled_at`**  
Booking made 2 weeks ago, cancelled today → `start_at` is 2 weeks ago → falls outside the ±7 day window → doesn't appear in Cancelled tab.

**5. `myBookings` vs `all-my-bookings` inconsistency**  
`myBookings` endpoint excludes cancelled. `all-my-bookings` includes all. Mixed usage can cause inconsistent badge counts.

**6. `isActuallyPast()` midnight edge case**  
A booking ending at 00:30 is treated as past even if it just crossed midnight.

### 🟠 Edge Cases (rare)

**7. Booking spanning midnight** — `BookingPanel` doesn't block `end_at` next-day. `bookingToSlots()` can return negative `startSlot` or `span > 24`.

**8. Concurrent "Clear All"** — no server guard against simultaneous `clearCancelled` calls from two tabs.

**9. Drag to slot of pending-cancel booking** — during the 10s undo window, booking is still `confirmed` server-side. Another user can drag into that slot.

### Priority Fix Order
1. Conflict check on `update()` (server, high impact)
2. `cancelledList` filter use `cancelled_at`
3. `slotOverlaps` cache staleness
4. Midnight booking edge cases

---

## 14. Development Conventions

### Toast Positioning
Toast must be positioned to avoid the AI FAB (`right:28, width:56px`):
```tsx
// Use this in every page that has a toast:
style={{ bottom: 28, right: 96 }}
```

### Query Keys
```typescript
['bookings', dateStr]         // day view — invalidated on create/update/cancel
['bookings', 'mine']          // SchedulePage active/upcoming tabs
['bookings', 'all-mine']      // SchedulePage all tabs
['rooms']                     // room list (rarely changes)
['rooms', roomId, 'stats']    // room stats modal
```

### React Query v5 Notes
- `useQueries` syntax: `useQueries({ queries: [...] })`
- `enabled: false` → `isLoading = false` (query stays idle, not pending)
- `isLoading` = `status === 'pending' && fetchStatus === 'fetching'` — safe to use as loading guard

### Auth
Sanctum token stored in `localStorage`. `axios.ts` reads it per-request via interceptor. On 401, redirect to `/login`.

### Vite Config
`server.watch.usePolling: true` is required on Windows/XAMPP (HMR won't work without it).

---

## 15. Pending / Next Steps

| Priority | Task | Notes |
|---|---|---|
| 🔴 | Fix conflict check on booking update | Server: `BookingController::update()` — add same overlap SQL as `store()` |
| 🟡 | AI Chat backend | Install Ollama → AiController proxy → wire React UI |
| 🟡 | `cancelledList` filter | Use `cancelled_at` window instead of `start_at` |
| 🟡 | slotOverlaps stale cache | Re-fetch before drag release, or rely only on server |
| 🟠 | GitHub Codespaces setup | User wants to develop remotely without local install |
| 🟠 | DB export for Codespace | MySQL dump for dev environment portability |
| 🟠 | Smooth resize animation | Resize still slot-snaps (drag is smooth) |
| 🟠 | Toast on cancel in SchedulePage | Visual feedback when cancel fires |
| 🟠 | Pantry section minus button | Encoding issue: `âˆ'` instead of `−` |

---

## 16. Environment Notes

- **XAMPP** serves Laravel at `http://localhost/mbrs-v1/server/public`
- **Vite** dev server on `http://localhost:5173` (fallback: 5174)
- **Database:** MySQL via XAMPP, database name is likely `mbrs_v1` (check `.env` in `server/`)
- **PHP version:** XAMPP bundled (8.x)
- **Node:** Standard npm setup, `client/package.json` has all deps

---

*Last updated: 2026-06-10. Generated from active development session.*
