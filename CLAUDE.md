# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

MRBS v1 (RoomSync Pro) — internal meeting room booking system. Laravel 12 API (`server/`) + React 19 SPA (`client/`), talking over REST (no SSR, no Vite proxy — the client hits the API by absolute URL). Realtime updates via Laravel Reverb (WebSocket), not polling.

## Commands

All backend commands run from `server/`, all frontend commands from `client/`.

**Dev (backend services at once, from `server/`):**
```
composer run dev
```
Runs `php artisan serve` + `queue:listen` + `pail` (log viewer) concurrently. This does **not** start the frontend — `npm run dev` must be run separately from `client/` (there's a leftover `server/package.json`/`vite` from the default Laravel skeleton, unused since this app has no Blade views; don't let `composer run dev` try to invoke it, `server/node_modules` was never installed and it will error). Reverb (`php artisan reverb:start`) is also **not** included in this script and must be started separately in its own terminal for realtime sync to work.

**Backend:**
```
composer install
php artisan migrate                  # add --force in production
php artisan serve                    # API on :8000
php artisan reverb:start             # WebSocket server (separate long-running process)
php artisan queue:listen --tries=1   # or queue:work in production
php artisan test                     # composer test — runs PHPUnit
php artisan test --filter=TestName   # single test
```
There is no meaningful test suite yet (`tests/Feature/ExampleTest.php` is the default Laravel stub) — verifying backend behavior in this codebase is conventionally done via `php artisan tinker --execute="..."` against real models/controllers, not by writing PHPUnit tests. Also run `php -l path/to/File.php` after editing PHP files to catch syntax errors before Tinker-testing.

**Frontend (from `client/`):**
```
npm install
npm run dev        # Vite dev server on :5173
npm run build       # tsc -b && vite build — type-checks then builds
npm run lint        # eslint .
```
No frontend test runner is configured (no Jest/Vitest). Type-check with `npx tsc --noEmit -p .` after edits; this is the primary correctness gate for TypeScript changes.

**Windows/XAMPP note:** this is normally developed inside XAMPP's `htdocs`. `php`/`composer`/`node` must resolve to versions matching `composer.json`'s `^8.2` / README's Node 20.x — mismatches between the XAMPP-bundled PHP and system PHP are a common source of confusing bugs.

**LAN exposure (this machine only, not portable via repo clone):** on this dev PC, `C:\XAMPP\apache\conf\extra\httpd-vhosts.conf` has vhosts that serve the API from Apache on `:8000` (DocumentRoot `server/public`, replacing `php artisan serve`) and a production `client/dist` build on `:8002` (`FallbackResource /index.html` for the SPA), so other devices on the LAN can reach the app via this PC's IP. That vhost config lives outside the repo and is not checked in — a fresh clone/machine has no LAN exposure until someone sets it up the same way. `client/.env`'s `VITE_API_URL`/`VITE_REVERB_HOST` point at this PC's LAN IP as a result; if API calls stop working after a network change, check those first.

## Architecture

### Two independent apps, joined by a Bearer token
`server/` (Laravel API only, no Blade views except email templates) and `client/` (Vite SPA) are deployed and run separately. Auth is Laravel Sanctum **token** auth (not cookie/session) — `client/src/api/axios.ts` sends `Authorization: Bearer <token>` from `localStorage`, and `AuthContext` resolves the current user by calling `GET /me` with that token on load. There is no Vite dev proxy; `axios.ts` points directly at `http://localhost:8000/api`, so CORS is handled Laravel-side (`HandleCors` middleware).

### Settings are a generic key-value store, not a fixed schema
`App\Models\Setting` is just `{key, value}` rows — there's no dedicated settings table per feature. Every feature that needs admin-configurable state (booking hours, anti-ghost windows, branding, Microsoft 365 credentials, etc.) adds new keys and reads them via `Setting::where('key', ...)->value('value')` with an inline default, aggregated into a handful of controller methods (`SettingController::generalSettings()`, `branding()`, `m365Settings()`, etc.) rather than one settings object. When adding a new admin-configurable field: add the key read in the relevant `*Settings()` GET method, add validation + write in the matching `update*Settings()` PATCH method, then wire the field into `AdminPage.tsx` (all admin settings UI lives in this one large file, organized into card sections, not separate pages/tabs per concern except where `type Tab` explicitly branches).

### RBAC: route-group gates + one important gap
Roles: `user`, `admin`, `receptionist`, `building_admin`, `guest` (enum on `users.role`, extended via migrations — see `2026_06_14_000008_add_building_admin_role.php` and `2026_07_05_000009_add_guest_role.php` for the pattern to extend it further). Gates (`admin`, `building_admin`, `receptionist`) are defined once in `AppServiceProvider::boot()` and applied as `can:` middleware on whole route groups in `routes/api.php` — admin/building/user-management endpoints are cleanly gated this way. **Booking create/update/delete is not gated by role at all** — any authenticated user can write bookings; per-owner/per-privilege checks happen inline inside `BookingController` methods instead (ownership checks, dispute/transfer role checks). `building_admin` scoping (which buildings a non-super-admin can manage) is done via `User::managedBuildingIds()`/`canManageBuilding()`, not gates.

The `guest` role is a **single shared account** (`guest@system.local`, created lazily by `POST /login/guest`, no password) rather than per-user guest accounts. It's kept read-only by one global middleware, `App\Http\Middleware\BlockGuestWrites` (alias `guest.readonly`), applied to the entire authenticated route group in `routes/api.php` — it blocks every non-GET/HEAD request for that role except `/logout`. New write endpoints added under that group are guest-safe automatically; no per-controller guest check is needed.

### Realtime sync (Reverb)
`App\Events\BookingChanged` broadcasts on a **public** channel (not per-user private channels — see `broadcastOn()`), so any connected client refreshes on any booking change. Frontend: `useBookingRealtime` hook subscribes via `lib/echo.ts` and invalidates the relevant React Query cache keys — there is deliberately no `refetchInterval` polling anywhere alongside Reverb (mixing both caused UI flicker; see the poll-blink fix history if touching pages with live data).

### File uploads always go through the `public` disk explicitly
Any code building a public file URL must call `Storage::disk('public')->url($path)`, never the bare `Storage::url($path)` — the app's default filesystem disk (`FILESYSTEM_DISK` in `.env`) is `local`, not `public`, so the bare helper silently returns a host-relative URL that 404s when the frontend and API run on different origins/ports in dev. This bit multiple upload features (logo, avatar, room photos) before being fixed everywhere — keep using the disk-qualified form for new uploads.

### Microsoft 365 / Graph integration (mail + calendar), off by default
`App\Services\Microsoft365\GraphClient` holds the shared client-credentials token logic; `GraphCalendarSync` (best-effort, never throws) creates an Outlook Calendar event on booking creation; `App\Mail\Transport\GraphTransport` is a custom Laravel mail transport that Graph-sends mail instead of SMTP. Both are gated by boolean Settings (`m365_mail_enabled`, `m365_calendar_sync_enabled`) that default to `false` — the app must keep working on the plain SMTP mailer with these off. Tenant/Client ID are plain Settings values; the Client Secret is encrypted at rest with `Crypt::encryptString()` and is never returned to the frontend (only a `has_secret` boolean).

### Frontend structural conventions
- **`MainLayout.tsx`** wraps most authenticated routes and owns all globally-floating UI: `AiAgentFab`, `KeyboardShortcutsFab`, `TodayPanel`, `AvailableRoomsPanel`, `BookingPanel`. Any new floating action button must be added here (not per-page) and must stack above the existing FABs (`AiAgentFab` occupies `right:28, bottom:28`, size 56) rather than overlapping them.
- **Cross-component actions go through `CustomEvent`s on `document`**, not prop drilling — e.g. global keyboard shortcuts in `Navbar.tsx` (`Ctrl+F`, `Alt+N`, `N`, `T`) dispatch events like `new-booking-shortcut` / `available-rooms-toggle` that `MainLayout`/`TimelinePage` listen for. `Ctrl+N` is unusable (browser-reserved for "new window"); `Alt+N` is used instead.
- **Popover/dropdown panels** (`GlassDatePicker`, `GlassTimePicker`, notification panel, etc.) render via `createPortal(..., document.body)` with manually computed `position: fixed` coordinates from `getBoundingClientRect()`, not CSS-anchored dropdowns — when adding a new one, account for viewport-edge clipping (`GlassDatePicker` flips above its trigger via a `useLayoutEffect` measurement if it would overflow the bottom of the screen; copy that pattern rather than assuming `top: trigger.bottom` is always safe).
- **Dark mode** is CSS custom properties (`var(--ds-bg-surface)`, `--ds-text-1/2/3/4`, `--ds-border`, `--ds-glass-bg`, etc.), not Tailwind `dark:` class variants scattered through markup — new UI should read these tokens rather than hardcoding light-mode colors or adding ad hoc `dark:` overrides.
- **Branding fields** (app name, logo, login page copy/photo) are fetched from the API but also cached to `localStorage` (`app_branding_cache`) and read synchronously as the initial state (plus inline in `index.html`) specifically to avoid a flash of default values before the first API response.
- i18n: `client/src/i18n/translations.ts` + `SettingsContext` (`language` state), not a library like `react-i18next`.

### Scheduled commands (`server/app/Console/Commands/`)
- `bookings:send-reminders` — emails users whose booking starts within `reminder_minutes` (Setting), marks `reminder_sent`.
- `bookings:release-ghosts` — auto-cancels bookings past the anti-ghost confirmation window (`anti_ghost_*` Settings) and both creates an in-app `Notification` and sends an email.
Both must run via Laravel's scheduler (`* * * * * php artisan schedule:run`) in addition to the always-on Reverb/queue processes — see README's production section for the full process list.
