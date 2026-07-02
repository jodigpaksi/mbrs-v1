# MBRS v1 (RoomSync Pro)

Meeting Room Booking System — aplikasi internal untuk booking ruang meeting, lengkap dengan timeline drag-and-drop, notifikasi realtime, kiosk mode, analytics, dan panel admin.

## Tech Stack & Versi

### Backend (`server/`)
| Komponen | Versi |
|---|---|
| PHP | ^8.2 (minimum) |
| Laravel Framework | ^12.0 |
| Laravel Sanctum (auth token) | ^4.3 |
| Laravel Reverb (WebSocket realtime) | ^1.10 |
| Laravel Tinker | ^2.10.1 |
| barryvdh/laravel-dompdf (export PDF) | ^3.1 |
| phpoffice/phpspreadsheet (export Excel) | ^5.8 |
| Composer | ^2.x |

### Frontend (`client/`)
| Komponen | Versi |
|---|---|
| Node.js | ^20.x LTS (disarankan) |
| React | ^19.2 |
| React Router DOM | ^7.17 |
| TypeScript | ~6.0 |
| Vite | ^8.0 |
| TailwindCSS | ^4.3 |
| @tanstack/react-query | ^5.101 |
| @nivo (bar/line/pie charts) | ^0.99 |
| laravel-echo + pusher-js (WebSocket client) | ^2.3 / ^8.5 |
| axios | ^1.17 |
| jspdf + jspdf-autotable | export PDF client-side |
| xlsx | export Excel client-side |

### Database
- MySQL / MariaDB (disarankan untuk production) — atau SQLite (default `.env.example`, cocok untuk dev cepat)

---

## Fitur Utama

- **Timeline Booking** — grid drag-and-drop per ruangan (view Day/Week/Month), resize durasi booking langsung di timeline
- **Jadwal Saya** — tab booking pribadi (upcoming/past/cancelled), export ke ICS (kalender)
- **Realtime sync** — perubahan booking (create/update/cancel) langsung ter-refresh di semua client via Laravel Reverb (WebSocket), tanpa polling
- **Notifikasi** — bell notification, reminder email (Mailable + scheduler)
- **Anti-Ghost Booking** — auto-release booking yang tidak dikonfirmasi kehadirannya (window konfigurasi via admin), termasuk mode sensor ESP32 dan konfirmasi manual via web
- **Kiosk Mode** — tampilan status ruangan real-time untuk layar depan ruang meeting, tema custom (dark/light), auto-orientation
- **Analytics/Dashboard Admin** — grafik pemakaian ruangan (Nivo charts), filter per gedung & periode, export laporan (PDF/Excel/aktivitas .txt)
- **Activity Log** — audit trail admin (login, perubahan role, export, settings, dll)
- **Manajemen Ruangan & Gedung** — foto ruangan, status khusus/spesial, kapasitas, kode sensor
- **Role-based Access** — user, admin, superadmin, receptionist
- **i18n** — Bahasa Indonesia & English
- **Dark Mode** — full dark theme di seluruh halaman
- **Branding kustom** — nama aplikasi & logo dapat diubah admin
- **Export** — ICS (kalender), PDF, Excel, log aktivitas .txt terjadwal

---

## Minimum Requirement Server

| Requirement | Minimum |
|---|---|
| PHP | 8.2+ (dengan ekstensi: `openssl`, `pdo_mysql`, `mbstring`, `tokenizer`, `xml`, `ctype`, `json`, `bcmath`, `fileinfo`, `curl`, `gd`, `zip`) |
| Composer | 2.x |
| Node.js | 20.x LTS + npm |
| Web server | Apache (dengan `mod_rewrite` aktif) atau Nginx |
| Database | MySQL 8.0+ / MariaDB 10.4+ (atau SQLite untuk dev/small scale) |
| RAM | 1 GB minimum (2 GB+ disarankan bila Reverb + queue worker jalan bersamaan) |
| Storage | tergantung volume upload foto ruangan/avatar/log aktivitas |

Catatan: Laravel Reverb butuh proses PHP terpisah yang jalan terus (bukan cuma request-response biasa via Apache), jadi server harus bisa menjalankan long-running process (background service / supervisor).

---

## Setup Lokal dengan XAMPP (Development)

1. **Clone project ke folder `htdocs`**
   ```
   cd C:\XAMPP\htdocs
   git clone <repo-url> mbrs-v1
   ```

2. **Pastikan PHP XAMPP versi 8.2+**
   ```
   php -v
   ```
   Jika masih di bawah 8.2, upgrade XAMPP atau ganti PHP binary yang dipakai Apache.

3. **Install dependency backend**
   ```
   cd server
   composer install
   ```

4. **Setup environment**
   ```
   copy .env.example .env
   php artisan key:generate
   ```
   Edit `.env`:
   - `DB_CONNECTION` — `sqlite` (default, paling cepat untuk dev) atau `mysql` (isi `DB_HOST`, `DB_DATABASE`, `DB_USERNAME`, `DB_PASSWORD` sesuai MySQL XAMPP)
   - `BROADCAST_CONNECTION=reverb`
   - Tambahkan kredensial Reverb (generate sekali via `php artisan reverb:install` jika belum ada di `.env`): `REVERB_APP_ID`, `REVERB_APP_KEY`, `REVERB_APP_SECRET`, `REVERB_HOST`, `REVERB_PORT`, `REVERB_SCHEME`

5. **Migrasi database**
   ```
   php artisan migrate
   ```
   (kalau pakai SQLite, buat dulu file kosong `database/database.sqlite`)

6. **Install dependency frontend**
   ```
   cd ../client
   npm install
   ```
   Buat `client/.env` berisi `VITE_REVERB_APP_KEY`, `VITE_REVERB_HOST`, `VITE_REVERB_PORT`, `VITE_REVERB_SCHEME` (samakan dengan `REVERB_*` di server `.env`).

7. **Jalankan semua service (dev)**
   Dari folder `server/`, jalankan sekaligus (server, queue, log, vite):
   ```
   composer run dev
   ```
   Atau manual, tiap perintah di terminal terpisah:
   ```
   php artisan serve
   php artisan reverb:start
   php artisan queue:listen
   cd ../client && npm run dev
   ```

8. Akses aplikasi via URL yang ditampilkan `php artisan serve` (default `http://127.0.0.1:8000`) untuk API, dan URL Vite (default `http://localhost:5173`) untuk frontend saat dev.

---

## Deploy ke Server (Production)

### 1. Install stack di server
- PHP 8.2+ dengan ekstensi wajib (lihat tabel requirement)
- Composer, Node.js + npm
- MySQL/MariaDB
- Apache/Nginx dengan SSL (Let's Encrypt/Certbot untuk HTTPS)

### 2. Clone & install dependency
```
git clone <repo-url> mbrs-v1
cd mbrs-v1/server
composer install --no-dev --optimize-autoloader
```

### 3. Konfigurasi environment production
```
copy .env.example .env
php artisan key:generate
```
Set di `.env`:
- `APP_ENV=production`
- `APP_DEBUG=false`
- `APP_URL=https://domain-project-anda.com`
- `DB_CONNECTION=mysql` + kredensial DB production
- `BROADCAST_CONNECTION=reverb` + `REVERB_*` (gunakan port internal, misalnya 8080, di-proxy ke WSS lewat reverse proxy — lihat bagian Reverb di bawah)
- `MAIL_*` untuk email reminder booking
- `SESSION_DRIVER=database`, `QUEUE_CONNECTION=database` (atau redis bila tersedia)

### 4. Migrasi & optimasi
```
php artisan migrate --force
php artisan config:cache
php artisan route:cache
php artisan view:cache
```

### 5. Build frontend
```
cd ../client
npm install
npm run build
```
Hasil build ada di `client/dist` — arahkan web server untuk serve folder ini sebagai frontend statis, ATAU sajikan langsung via Laravel bila di-setup sebagai SPA fallback.

### 6. Arahkan Web Server
- **DocumentRoot** untuk API Laravel → `server/public` (bukan root `server/`)
- Aktifkan `mod_rewrite` (Apache) supaya `.htaccess` Laravel bekerja
- Frontend (`client/dist`) disajikan sebagai static site terpisah, atau digabung di belakang reverse proxy yang sama dengan domain utama

### 7. Jalankan proses background (wajib untuk fitur realtime & reminder)
Gunakan process manager (contoh: **Supervisor** di Linux, atau **NSSM**/Task Scheduler di Windows) untuk menjaga proses berikut tetap hidup:
```
php artisan reverb:start
php artisan queue:work --tries=1
```
Tambahkan juga cron/scheduler Laravel (untuk email reminder & anti-ghost release):
```
* * * * * php artisan schedule:run >> /dev/null 2>&1
```

### 8. Reverse Proxy untuk WebSocket (Reverb)
Reverb jalan di port internal (default `8080`), sedangkan client browser connect via WSS di port 443. Pasang reverse proxy (Nginx/Apache) agar path WebSocket (`/app/...` sesuai config Reverb) di-forward dari port 443 publik ke port internal Reverb, dengan SSL termination di proxy.

### 9. Storage & permission
```
php artisan storage:link
```
Pastikan folder `storage/` dan `bootstrap/cache/` writable oleh user web server.

---

## Catatan Tambahan

- Jika server menjalankan XAMPP dan software lain (mis. Laragon) secara bersamaan, port 80/443/3306 bisa bentrok — pastikan hanya satu stack aktif per port, atau gunakan port alternatif + reverse proxy.
- Samakan versi PHP antara environment dev dan production untuk menghindari bug yang tidak konsisten — `composer.json` sudah mengunci minimum `^8.2`, tapi sebaiknya minor version juga disamakan.
- Untuk detail arsitektur & keputusan desain lebih lengkap, lihat `prd.md` di root project.
