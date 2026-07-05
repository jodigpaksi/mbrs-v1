# MRBS v1 — RoomSync Pro: PRD v2
### Product Requirements Document · AI Development Handoff

> **Tujuan file ini:** Dokumen konteks lengkap untuk AI assistant (Claude atau lainnya) agar bisa melanjutkan pengembangan tanpa kehilangan pengetahuan. Baca sebelum membuat perubahan apapun.  
> **Bahasa UI:** Indonesia. Kode & komentar: English.  
> **Last updated:** 2026-06-24

---

## 1. Project Overview

**Nama produk:** MRBS v1 / RoomSync Pro  
**Deskripsi:** Sistem pemesanan ruang rapat internal untuk kantor/hotel — staf dapat melihat timeline langsung, membuat/memindahkan/meresize booking dengan drag, mengelola jadwal mereka, dan admin dapat melihat semua booking.  
**Status saat ini:** MVP feature-complete, aktif dikembangkan. Belum di-deploy — berjalan di XAMPP lokal.

---

## 2. Tech Stack

| Layer | Teknologi |
|---|---|
| Backend | Laravel 11 + Sanctum (token auth) |
| Frontend | React 18 + TypeScript + Vite |
| Styling | TailwindCSS v3 + Material Symbols (Google Icons) |
| Data fetching | @tanstack/react-query v5 |
| HTTP client | Axios (Sanctum token via interceptor) |
| Local server | XAMPP (PHP 8.x, MySQL) |

**Root path:** `C:\XAMPP\htdocs\mbrs-v1\`  
- Server: `server/` (Laravel)  
- Client: `client/` (React/Vite)

**Dev commands:**
```bash
# Server: XAMPP Apache harus running
# Client:
cd client
npm run dev   # port 5173 (fallback 5174)
```

**API base:** `http://localhost/mbrs-v1/server/public/api`  
**CORS:** `server/config/cors.php` — `http://localhost:5173` dan `http://localhost:5174` whitelisted.

---

## 3. File Structure

```
mbrs-v1/
├── server/                        # Laravel 11
│   ├── app/Http/Controllers/Api/
│   │   ├── BookingController.php  # CRUD + myBookings + clearCancelled
│   │   ├── RoomController.php     # rooms + availability + stats
│   │   └── AuthController.php     # login, logout, me
│   ├── config/cors.php
│   └── routes/api.php
│
└── client/src/
    ├── api/
    │   ├── axios.ts               # Axios instance, token dari localStorage
    │   ├── bookings.ts            # getBookings, getMyBookings, createBooking, updateBooking, cancelBooking, clearCancelledBookings
    │   ├── rooms.ts               # getRooms, getRoom, getRoomStats, checkAvailability
    │   └── prefetch.ts            # prefetchAfterLogin() — 7 parallel queries saat login
    ├── context/
    │   ├── AuthContext.tsx         # Auth state, login/logout, user object; calls queryClient.clear() on logout
    │   └── NotificationContext.tsx # openNotifications(), notif state
    ├── hooks/
    │   └── useBookingHours.ts     # Booking time window dari DB (fallback 07:00/19:00)
    ├── components/
    │   ├── layout/
    │   │   ├── MainLayout.tsx      # Wraps semua page; mount Navbar + AiAgentFab + NotificationToast
    │   │   ├── Navbar.tsx          # Top navigation, notification bell, today badge
    │   │   ├── NotificationPanel.tsx  # Slide-in notification panel
    │   │   └── NotificationToast.tsx  # Auto-dismiss toast for new notifications
    │   ├── booking/
    │   │   ├── BookingPanel.tsx    # Slide-in form create/edit booking (right drawer)
    │   │   ├── BookingBar.tsx      # Visual booking bar in timeline grid
    │   │   ├── BookingTooltip.tsx  # Glass hover card showing booking details
    │   │   └── TodayPanel.tsx      # Slide-in panel "Today's bookings" dari navbar
    │   ├── room/
    │   │   ├── RoomDetailModal.tsx        # Full room stats modal + photo slideshow
    │   │   ├── AvailableRoomsPanel.tsx    # Slide-in "available rooms" panel
    │   │   └── ContactReceptionistModal.tsx  # Modal kontak resepsionis
    │   ├── profile/
    │   │   ├── UserProfileModal.tsx  # Edit profil user (glass modal)
    │   │   ├── SettingModal.tsx      # Settings user (termasuk On Duty toggle)
    │   │   └── HelpModal.tsx         # Help / panduan
    │   ├── ui/
    │   │   ├── UserAvatar.tsx         # Avatar initials atau foto; TIDAK pakai DiceBear
    │   │   ├── UserHoverCard.tsx      # Popup hover untuk "for/by" user info
    │   │   ├── GlassTimePicker.tsx    # Custom time picker (glass style)
    │   │   ├── GlassDatePicker.tsx    # Custom date picker (glass style)
    │   │   ├── SpecialRoomBadge.tsx   # Badge untuk special rooms
    │   │   └── background-components.tsx  # Background decorative elements
    │   ├── auth/
    │   │   └── ProtectedRoute.tsx
    │   └── ai/
    │       └── AiAgentFab.tsx      # FAB + chat panel (UI only — backend belum ada)
    └── pages/
        ├── LoginPage.tsx
        ├── TimelinePage.tsx        # Main timeline grid dengan drag/resize
        ├── SchedulePage.tsx        # My bookings — tabs: Active, Upcoming, H-Calendar, Cancelled, All
        ├── RoomsPage.tsx           # Browse semua ruangan (landscape card grid)
        └── AdminPage.tsx           # Admin: all bookings + overview stats + settings
```

---

## 4. Routes (React)

| Path | Component | Deskripsi |
|---|---|---|
| `/login` | LoginPage | Public. Sanctum token auth. |
| `/` | TimelinePage | Default. Timeline grid drag-create booking. |
| `/schedule` | SchedulePage | My bookings management. |
| `/rooms` | RoomsPage | Browse ruangan dengan filter & status live. |
| `/admin` | AdminPage | Admin-only: all bookings + stats + settings. |

Semua non-login route dibungkus `<ProtectedRoute>` → `<MainLayout>`.

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
GET    /api/bookings?date=YYYY-MM-DD&room_id=   → Booking[]
GET    /api/bookings/my                          → Booking[] (user ini, exclude cancelled)
GET    /api/bookings/all-my                      → Booking[] (user ini, semua status)
POST   /api/bookings           { room_id, title, description?, start_at, end_at, status?, type? }
PATCH  /api/bookings/:id       (partial update — same fields)
DELETE /api/bookings/:id       → cancel booking (set status=cancelled)
DELETE /api/bookings/clear-cancelled  → bulk delete semua cancelled booking user ini
```

### Settings
```
GET    /api/settings/booking-hours  → { booking_start_time, booking_end_time }
```

**Datetime format:** `"YYYY-MM-DD HH:MM:SS"` (tanpa timezone suffix — server simpan local time).  
**Conflict check:** Server pakai strict overlap: `start_at < existing.end_at AND end_at > existing.start_at`. Ada di `store()` DAN `update()`.

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
  on_duty?: boolean        // setting yang disimpan di server
}

interface Room {
  id: number
  name: string
  capacity: number
  department: string
  floor?: string
  description?: string
  photo?: string           // URL
  photos?: string[]        // array URL
  phone?: string
  status?: 'available' | 'occupied' | 'maintenance'
  type?: string            // optional — selalu guard dengan ?.toLowerCase() sebelum dipakai
}

interface Building {
  id: number
  name: string
  code?: string            // misal "HO", "CT" — selalu tampilkan code, bukan name
  address?: string
  location?: { name: string }
  notes?: string
}

interface Booking {
  id: number
  room_id: number
  user_id: number
  title: string
  description?: string
  start_at: string         // "2026-06-09 09:00:00"
  end_at: string           // "2026-06-09 10:30:00"
  status: 'confirmed' | 'tentative' | 'cancelled'
  type: 'internal' | 'external' | 'training' | string
  cancelled_at?: string    // timestamp saat di-cancel
  room?: Room
  user?: User
}
```

---

## 7. Design System

### Color Palette
```
Primary accent:  #adee2b  (lime-green — buttons aktif, highlights, booking bars confirmed)
Dark accent:     #7ecb00  (darker lime, untuk gradient)
Background:      #f7f8f6  (warm off-white)
Text primary:    slate-900
Text secondary:  slate-500 / slate-400
```

### Status Colors
- **Confirmed:** `#adee2b` (lime green)
- **Tentative:** hatched pattern (diagonal stripes) — bukan solid warna
- **Cancelled:** `#fca5a5` (red-rose)

### Tentative "Arsir" Pattern
```css
/* Bukan solid warna — gunakan diagonal hatch: */
background: [base-color];
background-image: repeating-linear-gradient(
  45deg, transparent, transparent Npx, rgba(0,0,0,M) Npx, rgba(0,0,0,M) 2Npx
);
/* Card/list: base #f5f6f8, rgba(0,0,0,0.025), step 5px/10px */
/* Badge: base #e4e6ea, rgba(0,0,0,0.03), step 3px/6px */
/* BookingBar: base #d1d5db, rgba(0,0,0,0.04), step 4px/8px */
```

### Glass Styles

**Dark glass** (FAB, chat panel, tooltip gelap, admin sidebar):
```css
background: rgba(12,16,38,0.65);
backdrop-filter: blur(24px) saturate(200%);
border: 1px solid rgba(255,255,255,0.13);
box-shadow: 0 8px 32px rgba(0,0,0,0.28), inset 0 1px 0 rgba(255,255,255,0.10);
```

**Dark glass tooltip** (hover cards gelap):
```css
background: rgba(15,15,15,0.87);  /* opacity min 0.87 */
backdrop-filter: blur(64px) saturate(2);
border: 1px solid rgba(255,255,255,0.12);
box-shadow: 0 16px 48px rgba(0,0,0,0.5);
```

**Fluent glass light** (BookingPanel, modals, BookingTooltip):
```css
background: rgba(255,255,255,0.82);
backdrop-filter: blur(48px) saturate(200%);
border: 1px solid rgba(255,255,255,0.6);
```

**Fluent glass modal** (UserProfileModal, SettingModal):
```css
background: rgba(255,255,255,0.86);
backdrop-filter: blur(48px) saturate(200%);
border: 1px solid rgba(255,255,255,0.90);
border-radius: 28px;
box-shadow: 0 32px 72px rgba(0,0,0,0.16), 0 8px 24px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,1);
animation: spring-in 0.22s cubic-bezier(0.34,1.04,0.64,1) both;
```
Backdrop overlay: `rgba(0,0,0,0.22)` solid (TANPA blur pada overlay).

**Glass dropdown light**:
```css
background: rgba(255,255,255,0.78);
backdrop-filter: blur(32px);
border: 1px solid rgba(255,255,255,0.65);
box-shadow: 0 8px 32px rgba(0,0,0,0.10);
```

**Glass tooltip light** (icon button Navbar):
```css
background: rgba(255,255,255,0.75);
backdrop-filter: blur(20px);
border: 1px solid rgba(255,255,255,0.6);
box-shadow: 0 4px 16px rgba(0,0,0,0.08);
/* Text: text-[10px] font-black uppercase tracking-wide text-slate-500 */
```

**HCalCompactCard (schedule carousel)**:
```css
background: rgba(255,255,255,0.88);
backdrop-filter: blur(32px) saturate(180%);
border: 1px solid rgba(255,255,255,0.92);
box-shadow: 0 8px 28px rgba(0,0,0,0.07), 0 2px 8px rgba(0,0,0,0.04), inset 0 1px 0 rgba(255,255,255,1);
border-radius: 18px;
```

### Buttons
- **Primary action:** `bg-black text-[#adee2b] font-black uppercase`, `hover:opacity-80`
- **Hover in dropdown:** `hover:bg-[#adee2b]/25` (soft lime)
- **Active/selected item:** `bg-[#adee2b] text-black`
- **Dark glass pill active:** `bg-[rgba(10,15,40,0.82)] border-white/[0.12] text-[#adee2b]`
- **Dark glass pill inactive:** `bg-[rgba(10,15,40,0.26)] border-white/[0.08] text-white/60 hover:bg-[rgba(10,15,40,0.48)]`

> ⚠️ Untuk pill dengan hover color: PAKAI Tailwind arbitrary class, BUKAN inline style. Inline style menang specificity, `hover:bg-[...]` tidak akan bekerja.

### Icons
Material Symbols Outlined (Google). Contoh:
```tsx
<span className="material-symbols-outlined" style={{ fontSize: 18, fontVariationSettings: "'FILL' 1" }}>
  calendar_today
</span>
```

### Animations
- Spring bounce: `cubic-bezier(0.34,1.56,0.64,1)` — FAB appear, panel open
- Smooth ease: `cubic-bezier(0.4,0,0.2,1)` — slide/collapse transitions
- Panel appear: `panel-in` keyframe (translateY(24px)→0, scale 0.97→1, 280ms)
- UserHoverCard: `user-hover-in 0.16s cubic-bezier(0.4,0,0.2,1)` (scale + translateY)

### Toast Style (WAJIB pakai pattern ini)
```css
background: rgba(15,20,45,0.55);
backdrop-filter: blur(24px);
border: 1px solid rgba(255,255,255,0.10);
/* Posisi: bottom: 28, right: 96 — geser kiri dari AI FAB */
```
Auto-close panel sebelum tampilkan toast agar tidak terhalang.

---

## 8. TimelinePage — Core Architecture

File paling kompleks. Konsep kunci:

### Grid Layout
- Time range: **07:00 – 19:00** (dari `useBookingHours`, fallback hardcoded)
- Slot width: `SLOT_W = 64px` per half-hour slot = 24 slot total
- Room rows: satu row per ruangan, fixed height
- Header: sticky time labels, klik untuk scroll

### View Modes
```typescript
const [viewMode, setViewMode] = useState<'day' | 'week'>('day')
```
Week view: 7 parallel queries via `useQueries`.

### View Animations (ganttKey pattern)
```typescript
const [ganttKey, setGanttKey] = useState(0)
const [ganttAnim, setGanttAnim] = useState<'left' | 'right' | 'up' | 'fade'>('fade')

function switchViewMode(mode) { setGanttAnim('left'); setGanttKey(k=>k+1); setViewMode(mode) }
function switchBuilding(b) { setGanttAnim('up'); setGanttKey(k=>k+1); setLocation(b) }
function switchDept(d) { setGanttAnim('fade'); setGanttKey(k=>k+1); setDeptFilter(d) }
function navDate(forward) { setGanttAnim(forward?'left':'right'); setGanttKey(k=>k+1); ... }
```
Semua `<main>` view element pakai `key={ganttKey}` → React remount → CSS entry animation fire.

### Date Handling — CRITICAL
**Selalu pakai local date, JANGAN `toISOString()`.**

```typescript
// BENAR — selalu pakai ini:
function toLocalDateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

// SALAH — timezone shift di UTC+7:
d.toISOString().split('T')[0]  // ❌

// Parse server time — remove 'Z' agar tidak bergeser ke UTC:
const d = new Date(isoString.replace('Z', ''))  // ✓
```

### Drag / Create / Resize System
```
cellDragRef  → drag sel kosong untuk buat booking baru
barDragRef   → drag booking bar yang ada untuk memindahkan
barResizeRef → resize booking bar (handle kanan)
dragTick     → useState counter memaksa re-render saat drag tanpa stale closure
```
Pill overlay tampilkan time range `"HH:MM – HH:MM"` saat drag.  
Sub-slot precision: `fracPx = deltaPixels - deltaSlot * SLOT_W`.

### Conflict Detection (client-side)
`slotOverlaps()` cek `queryClient.getQueryData` — bisa stale. Server adalah authority.

---

## 9. SchedulePage — Architecture

### Tabs
1. **Active** — booking upcoming/today confirmed+tentative
2. **Upcoming** — 7 hari ke depan
3. **H-Calendar** — horizontal calendar view (pilih tanggal → lihat booking)
4. **Cancelled** — filter by `cancelled_at` (BUKAN `start_at`)
5. **All Bookings** — sortable table, semua status, past rows dimmed

### H-Calendar Structure
```typescript
hCalDate: string          // yyyy-MM-dd, tanggal terpilih
hCalMonth: { yr, mo }     // bulan terpilih
hCalBookingMap: Map<string, Booking[]>  // dari myBookings, cover full current year
```
- Month row: `MONTHS_LOWER`, sembunyikan past months (`return null` jika `mi < today.getMonth()`)
- Date row: skip past dates (return null), `hCalDatesRef` untuk wheel scroll
- Card carousel: `hCalCardsRef` untuk wheel scroll, `HCalCompactCard` glass light
- Auto-scroll today on tab open via `hCalTodayRef.scrollIntoView`

### H-Cal Date Colors
- **Today:** lingkaran lime `background:#adee2b`, `color:#000`
- **Selected (bukan today):** lingkaran abu `background:#f1f5f9`, `color:#475569`
- **Booking dot:** `#72ddf7`
- **Past dates:** `return null` (tidak dirender sama sekali)

### Card View (Masonry Grid)
Dua kolom independen (BUKAN CSS Grid — CSS Grid snap saat remove):
```tsx
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
Didefinisikan **di luar** function component SchedulePage:
```typescript
function SlideWrapper({ exiting, children }: { exiting: boolean; children: ReactNode }) {
  const wrapRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = wrapRef.current
    if (!el || !exiting) return
    const h = el.scrollHeight
    el.style.height = `${h}px`
    el.style.overflow = 'hidden'
    el.getBoundingClientRect()  // force reflow — PENTING!
    el.style.transition = 'height 0.32s cubic-bezier(0.4,0,0.2,1)'
    el.style.height = '0'
  }, [exiting])
  return <div ref={wrapRef}>{children}</div>
}
```

### Two-Phase Cancel Flow
```
Klik cancel →
  pendingCancelId = booking.id   (redup card, tampil undo button, timer 10 detik)
  → user bisa undo (clear pendingCancelId)
  → 10 detik: exitingCancelId = booking.id (trigger SlideWrapper collapse 380ms)
  → setelah 380ms: API DELETE, queryClient.invalidate, clear kedua ID
```

### Export (All Bookings)
Single **Export ▾** dropdown dengan grup:
- **Upcoming & Today** (hitam)
- **Past** (slate)
- **Cancelled** (merah, "last 7 days")
- "All" button pilih semua grup; Excel/PDF disabled jika 0 rows

---

## 10. RoomsPage — Architecture

### Layout
Grid landscape cards — inline style `repeat(N, minmax(0, 1fr))` (BUKAN dynamic Tailwind `grid-cols-N`, karena di-purge).

### Card Design (Landscape)
- `aspect-[4/3]`, `rounded-[24px]`
- Foto fills card (`object-cover`), legibility gradient `from-black/55 via-black/0 to-black/40`
- Top-center: nama ruangan + status badge
- Top-right: admin controls (bintang + maintenance) — glass buttons `size-8 rounded-full` dengan `GlassTip`
- Bottom: gradient-blur caption (`from rgba(8,10,20,0.80)` + `backdropFilter: blur(3px)`) — kiri: building CODE, seats, floor; kanan: action pill (Book / Contact / Unavailable)

### Building Display Format
Selalu tampilkan `{b.code || b.name}` (misal "HO"), bukan nama lengkap ("Head Office"). Format lengkap untuk pill: `{code} - {location}`.

### Available Now Strip
Strip dark glass di atas grid (hanya tampil jika quick-filter belum aktif):
```tsx
const availableNowRooms = useMemo(() =>
  (rooms as Room[]).filter(r => r.status !== 'maintenance' && !isOccupiedNow(r)),
  [rooms, todayBookings]
)
```
Ini computed dari **semua** rooms (independen dari filter aktif), agar count selalu akurat.

### Live Glow Animation (occupied rooms)
```css
@keyframes liveGlow {
  0%, 100% { box-shadow: 0 6px 20px rgba(0,0,0,0.06), 0 0 0 0 rgba(251,146,60,0); }
  50%      { box-shadow: 0 10px 28px rgba(0,0,0,0.10), 0 0 0 3px rgba(251,146,60,0.30); }
}
```

### Background Texture
```
Gradient mesh: radial-gradient lime + indigo di corner
Film grain overlay: inline SVG feTurbulence, opacity-[0.04] mix-blend-multiply, 180×180px tiled
```

---

## 11. BookingPanel

Slide-in right drawer untuk create dan edit booking.

### Availability Check
Real API call, debounced 600ms. Spinner saat check, badge hijau/merah dari `checkAvailability`. Submit diblokir sampai API konfirmasi available. Edit booking pass `exclude_booking_id` agar booking saat ini tidak dihitung conflict.

### Pre-fill dari Timeline
Drag sel kosong → BookingPanel buka dengan `prefillDate`, `prefillRoom`, `prefillStart`, `prefillEnd`. Pakai `toLocalDateStr()`.

### prefillVersion Pattern
Jika panel sudah terbuka dan user klik slot berbeda (ruangan sama):
```tsx
const [prefillVersion, setPrefillVersion] = useState(0)
// Jika panel sudah open: increment version → trigger glow/re-init tanpa remount
if (wasOpen) setPrefillVersion(v => v + 1)
```

### Booking Hours
Pakai `useBookingHours` hook — waktu batas dari DB settings, fallback 07:00/19:00.

---

## 12. BookingTooltip & UserHoverCard

### BookingTooltip
Glass hover card saat hover booking bar. Style fluent glass light. Tampil via `createPortal` ke body.

### UserHoverCard
Hover card untuk teks "for/by" di SchedulePage (card, list, H-Cal):
- Wrapper `display: contents`, `onPointerOver`/`onPointerOut` dengan delay 280ms
- Popup via `createPortal`, animasi `user-hover-in`, lebar 230px
- "by" case: pakai `b.user` (full User object)
- "for" case: lookup `b.booked_for_user_id` dari cache `user-directory`

---

## 13. AiAgentFab (UI only — backend belum ada)

**File:** `client/src/components/ai/AiAgentFab.tsx`  
**Dipasang di:** `MainLayout.tsx` — tampil di semua halaman.

### Visual
- Fixed bottom-right: `right: 28, bottom: 28`
- Dark glass style, 56×56px, borderRadius 18
- Icon diamond `#adee2b` — morph ke close (rotate 45°) saat panel open
- Green pulse dot: `top:-3, right:-3`, bg `#34d399`

### Chat Panel
- `380×520px`, membuka di atas FAB (`bottom: 96`)
- Dark glass style
- Komponen: header (lime gradient avatar + "RoomSync AI" + "Powered by Claude"), welcome bubble, 3 suggestion chips, text input + send button
- Spring animation open: `cubic-bezier(0.34,1.56,0.64,1)`

### Backend yang Harus Dibangun (BELUM ADA)
```
React chat UI → POST /api/ai/chat → Laravel proxy → Ollama localhost:11434
```
- Model: `qwen2.5:3b` (~2GB, support Bahasa Indonesia)
- Langkah: (1) Install Ollama, pull model, (2) tambah Laravel route + AiController, (3) wire React input/message state

---

## 14. AdminPage

- **Overview tab:** Stats cards + 5 booking terbaru
- **All Bookings tab:** Tabel dengan sort Title/Room/User/Start/Status. Default: terbaru dulu. Past rows dimmed di bawah.
- **Settings tab:** Admin settings (buildings, rooms, users, dll.)
  - Auto-save untuk toggle/input
  - Floating TOC sidebar layout
  - Inline room status/special toggle di BuildingsTab

### Admin Sidebar
```css
background: rgba(15,20,45,0.88);
will-change: transform;   /* GPU layer, mencegah scroll lag */
/* TANPA backdropFilter — menyebabkan scroll lag */
```
Active item: 3px left bar warna `#adee2b`.

---

## 15. Notification System

**Komponen:** `NotificationPanel.tsx` + `NotificationToast.tsx` — keduanya dipasang di `App.tsx`.  
**Context:** `NotificationContext` — `openNotifications()` dipanggil dari bell di Navbar.  
**Badge border Navbar:** pakai `border-[var(--ds-bg-surface)]` (bukan `border-white`).  
Status: **Fully wired dan working.**

---

## 16. Architecture Patterns — Wajib Diikuti

### Timezone — CRITICAL
```typescript
// BENAR:
function toLocalDateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}
// Selalu tambah T12:00:00 bukan midnight saat construct:
new Date(`${dateStr}T12:00:00`)
// Parse server response — hapus Z:
new Date(serverDateStr.replace('Z', ''))

// JANGAN:
d.toISOString().split('T')[0]  // ❌ UTC shift di timezones timur
```

### ModalPortal — Untuk Semua Overlay Fixed
`backdrop-filter` pada `position: fixed` yang punya ancestor `overflow: hidden` akan di-clip Chrome. Solusi:
```tsx
import { createPortal } from 'react-dom'
function ModalPortal({ children }: { children: ReactNode }) {
  return <>{createPortal(children, document.body)}</>
}
// Wrap setiap <div className="fixed inset-0 z-[1000] ..."> dengan <ModalPortal>
```

### Outside-Click — mousedown listener, bukan overlay div
```tsx
useEffect(() => {
  if (!open) return
  function handler(e: MouseEvent) {
    if (popupRef.current && !popupRef.current.contains(e.target as Node)) setOpen(false)
  }
  document.addEventListener('mousedown', handler)
  return () => document.removeEventListener('mousedown', handler)
}, [open])
```
⚠️ JANGAN kombinasikan dengan portal-rendered children — mousedown akan menutup parent sebelum button onClick fire.

### CustomEvent Bus
```typescript
// Cross-component tanpa prop drilling:
document.dispatchEvent(new CustomEvent('event-name', { detail: value }))
// Dipakai untuk: timeline-search, available-rooms-toggle, today-panel-toggle
```

### queryClient.clear() saat Logout
```typescript
// AuthContext.tsx — cegah data user lama ke user berikutnya:
async function logout() {
  try { await apiLogout() } catch {}
  queryClient.clear()
  setUser(null)
}
```

### prefetchAfterLogin — Warm Cache
```typescript
// LoginPage.tsx — panggil setelah setUser(), sebelum navigate('/'):
await prefetchAfterLogin()  // 7 parallel queries di api/prefetch.ts
```

### View Transitions API (RoomsPage card→modal)
```tsx
function openDetail(room: Room) {
  const vt = (document as any).startViewTransition
  if (!vt || !room.photos?.[0]) { setDetailRoom(room); setDetailOpen(true); return }
  flushSync(() => setVtId(room.id))
  const t = vt.call(document, () => {
    flushSync(() => { setDetailRoom(room); setDetailOpen(true) })
  })
  t.finished.finally(() => setVtId(null))
}
```

### UserAvatar — JANGAN DiceBear
Selalu pakai `<UserAvatar>` dari `src/components/ui/UserAvatar.tsx`. **Jangan pernah pakai `api.dicebear.com`.**

### CSS text-transform Cascade
`text-transform: uppercase` pada parent `<p>` cascade ke semua child. Jika ada teks child yang harus tetap lowercase: pisahkan ke elemen terpisah (bukan `<span>` dalam `<p className="uppercase">`).

### Optional Fields — Guard Selalu
```typescript
r.type?.toLowerCase() ?? ''   // ✓
r.type.toLowerCase()          // ❌ crash jika undefined
// Sama untuk: Building.address, Building.notes, Building.code
```

### formVisible + displayMode untuk Tab Fade
```typescript
function switchMode(next) {
  setFormVisible(false)
  setTimeout(() => { setDisplayMode(next); setFormVisible(true) }, 140)
}
// JSX fade berdasarkan formVisible, render displayMode (bukan mode)
```

### visibility:hidden setelah animasi (panel close shadow fix)
```tsx
const [visible, setVisible] = useState(false)
useEffect(() => {
  if (open) { setVisible(true) }
  else {
    const t = setTimeout(() => setVisible(false), 420)
    return () => clearTimeout(t)
  }
}, [open])
// style={{ visibility: visible ? 'visible' : 'hidden' }}
```

---

## 17. Query Keys

```typescript
['bookings', dateStr]           // day view — invalidated on create/update/cancel
['bookings', 'mine']            // SchedulePage active/upcoming tabs
['bookings', 'all-mine']        // SchedulePage all tabs
['rooms']                       // room list (jarang berubah)
['rooms', roomId, 'stats']      // room stats modal
['bookings/today']              // TodayPanel
['notifications']               // NotificationPanel
['user-directory']              // lookup untuk UserHoverCard "for" case
['settings', 'booking-hours']   // useBookingHours hook
```

### React Query v5 Notes
- `useQueries` syntax: `useQueries({ queries: [...] })`
- `enabled: false` → `isLoading = false` (query idle, bukan pending)
- `isLoading` = `status === 'pending' && fetchStatus === 'fetching'`

---

## 18. Toast Positioning (Semua Halaman)

```tsx
// Toast harus geser kiri dari AI FAB (right:28, width:56px):
style={{ bottom: 28, right: 96 }}
```

---

## 19. Panel Z-Index Stack

```
Backdrop overlay:        z-[100]
AvailableRoomsPanel:     z-[108]
BookingPanel:            z-[110]
TodayPanel:              z-[115] / z-[120] (panel)
UserHoverCard:           z-[200]
ModalPortal overlays:    z-[1000] +
```

---

## 20. DS Variables (Dark Mode)

CSS variables yang dipakai untuk dark mode theming:
```css
--ds-bg-surface     /* halaman background */
--ds-bg-surface-2   /* card / elevated surface */
--ds-bg-raised      /* dropdown / tooltip background */
--ds-border         /* border utama */
--ds-border-sub     /* border sekunder/subtle */
--ds-text-1         /* teks utama */
--ds-text-2         /* teks sekunder */
--ds-text-3         /* teks tersier */
--ds-text-4         /* placeholder / muted */
--ds-pill-bg        /* pill / badge background */
--ds-glass-bg       /* glass element background */
--ds-glass-border   /* glass border */
--ds-glass-shadow   /* glass shadow */
```

> ⚠️ **Dark mode saat ini broken** — implementasi 2026-06-23 dilakukan mass-replace oleh agents dan hasilnya "kacau". Pendekatan yang benar: fix satu halaman, test visual di browser, baru lanjut ke halaman berikutnya.

---

## 21. Known Bugs & Status

### ✅ Sudah Diperbaiki
- Conflict check pada `update()` — sudah ada di `BookingController::update()` baris 235-244
- `cancelledList` filter — sudah filter by `cancelled_at`, bukan `start_at`
- Timezone UTC date bug — `toLocalDateStr()` sudah dipakai
- Notification bell — fully wired

### 🔴 Aktif / Belum Diperbaiki

**Dark mode visual regression**  
Setelah mass-replace oleh agents, tampilan "kacau banget". Perlu investigasi visual per halaman dan fix manual (BookingPanel, RoomsPage, AdminPage adalah yang paling terdampak).

### 🟡 Edge Cases (belum di-fix)

**`slotOverlaps()` pakai stale cache**  
Client-side conflict check baca `queryClient.getQueryData` — bisa stale atau kosong untuk ruangan yang belum di-load. Server conflict check adalah authority. Solusi: re-fetch sebelum drag release, atau andalkan server saja.

**`isActuallyPast()` midnight edge case**  
Booking yang berakhir 00:30 dianggap past meskipun baru lewat tengah malam.

**Booking spanning midnight**  
`BookingPanel` tidak blokir `end_at` di hari berikutnya. `bookingToSlots()` bisa return `startSlot` negatif atau `span > 24`.

**Concurrent "Clear All"**  
Tidak ada server guard untuk simultaneous `clearCancelled` dari dua tab.

**Drag ke slot booking yang pending-cancel**  
Selama 10 detik undo window, booking masih `confirmed` di server — user lain bisa drag ke slot itu.

---

## 22. Backlog & Next Steps

### 🔴 Prioritas Tinggi
1. **Fix dark mode** — investigasi visual per halaman, fix variabel DS yang salah mapping

### 🟡 Feature Backlog

2. **AI Chat backend**  
   Install Ollama → pull `qwen2.5:3b` → tambah Laravel `POST /api/ai/chat` → `AiController` proxy → wire React `AiAgentFab` input/message state

3. **Pantry orders ke DB**  
   Tabel `pantry_orders` sudah ada di DB. UI state belum diwire — reload kehilangan pilihan pantry.

4. **Mobile responsive**  
   Timeline + halaman minimal — mobile list view. Touch drag sengaja di-skip.

5. **Search URL params**  
   Lift `?q=...` ke URL agar search bisa di-share/bookmark.

6. **Dark mode coverage (setelah #1 fix)**  
   Retry per halaman setelah implementasi broken diperbaiki.

---

## 23. Environment Notes

- **XAMPP** serve Laravel di `http://localhost/mbrs-v1/server/public`
- **Vite** dev server di `http://localhost:5173` (fallback: 5174)
- **Database:** MySQL via XAMPP, nama DB `mbrs_v1` (cek `.env` di `server/`)
- **PHP:** XAMPP bundled (8.x)
- **Vite config:** `server.watch.usePolling: true` WAJIB di Windows/XAMPP (HMR tidak jalan tanpa ini)

---

*PRD v2 — dibuat 2026-06-24. Mencakup semua perubahan dari sesi 2026-06-10 s/d 2026-06-23.*
