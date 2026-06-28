# PRD — Extension Number Record App (`ext-v1`)

## Overview

Aplikasi direktori nomor extension perusahaan yang berdiri sendiri sebagai project terpisah (`ext-v1`), namun **berbagi database yang sama dengan MBRS**. Setiap perubahan data di salah satu app langsung tercermin di app lainnya — tidak perlu update dua tempat.

**Stack:** Laravel 12 + React + Vite + TypeScript + Tailwind  
**DB:** Shared dengan MBRS (`mbrs` database)  
**Folder:** `C:\XAMPP\htdocs\ext-v1\` (server/ + client/)

---

## Fitur Utama

- Search direktori internal (karyawan: nama, NIK, ext, dept, gedung, kota)
- Search direktori eksternal (vendor, restoran, hotel, dll)
- Edit data user oleh receptionist/admin
- Import dari Excel + Export ke Excel
- Log history: siapa edit apa, kapan
- **Public/guest** bisa search tanpa login. Login hanya untuk edit/tambah/import/log.

---

## Database Changes

### Yang SUDAH ADA (tidak perlu diubah)

```
locations:  id | name ("Jakarta") | code ("JKT")
buildings:  id | name | code | address | location_id → locations | ...
```

Kota/lokasi user didapat via: `user → building → location.name`

### Migration A — Tambah kolom ke `users` (jalankan di MBRS server)

```php
$table->string('nik', 50)->nullable()->unique()->after('name');
$table->foreignId('building_id')->nullable()->constrained('buildings')->nullOnDelete()->after('ext');
```

- `nik` = Nomor Induk Karyawan
- `building_id` = gedung tempat user bekerja (FK → buildings, beda dengan `admin_buildings` yang untuk assignment staff)

### Migration B — Tabel baru `ext_edit_logs` (jalankan di MBRS server)

```
id                bigint PK
target_user_id    FK → users.id (cascade delete)
editor_user_id    FK → users.id (set null on delete)
changed_fields    json  →  [{ field, old, new }, ...]
created_at        timestamp
```

Satu baris per aksi simpan. JSON menyimpan semua field yang berubah sekaligus.

### Tabel baru `ext_contacts` (jalankan di ext-v1 server, masuk DB yang sama)

```
id             bigint PK
name           string
category       string  →  "vendor" / "restoran" / "hotel" / dll
phone          string nullable
ext            string nullable
email          string nullable
address        string nullable
notes          text nullable
building_id    FK → buildings nullable
created_by     FK → users
timestamps
```

### MBRS Model Updates

- `User::$fillable` += `nik`, `building_id`
- `User::$casts` += `building_id => 'integer'`
- Tambah relasi `workBuilding()` BelongsTo(Building) — berbeda dengan `adminBuildings()`

---

## Backend — Routes & Controllers

### Auth

```
POST  /api/auth/login    →  Sanctum token (hanya receptionist, building_admin, admin)
POST  /api/auth/logout
GET   /api/auth/me
```

Guest (tanpa token) bisa akses endpoint search/view. Edit/import/log butuh auth.

### Directory (Internal — dari tabel `users`)

```
GET    /api/directory           →  search + filter users (public)
PATCH  /api/directory/{user}    →  update fields + tulis log (auth required)
```

**GET params:** `q` (nama/NIK/ext), `dept_id`, `location_id`, `building_id`, `page` (50/page)

**PATCH fields:** `name`, `nik`, `department_id`, `ext`, `building_id` — semua `sometimes`. Kota tidak bisa diedit langsung, ikut building.

### External Contacts

```
GET    /api/contacts            →  list + search ext_contacts (public)
POST   /api/contacts            →  tambah kontak (auth)
PATCH  /api/contacts/{contact}  →  edit kontak (auth)
DELETE /api/contacts/{contact}  →  hapus kontak (auth)
```

### Import / Export

```
GET   /api/directory/export  →  download .xlsx
POST  /api/directory/import  →  smart import dari .xlsx
```

**Smart import logic:**
1. Parse Excel dengan PhpSpreadsheet
2. Match user by `email` (primary) atau `nik` (secondary)
3. Bandingkan tiap field — update **hanya yang berubah**
4. Tidak ketemu = skip (tidak buat user baru, itu urusan MBRS)
5. Building tidak terdaftar = baris ditolak → masuk summary "invalid"
6. Tulis `ext_edit_logs` untuk tiap user yang berubah
7. Return summary: `{ updated, skipped, not_found, invalid, changes }`

### Edit Log

```
GET  /api/logs?user_id=&editor_id=&from=&to=&page=
```

---

## Frontend — Halaman

### `/` — Directory Search *(public)*
- Search bar besar (nama / NIK / ext)
- Filter: Gedung dropdown, Kota dropdown
- Tab: **Internal** | **External**
- Hasil: card list — nama besar, ext highlight, dept · gedung · kota kecil
- Tombol Login di kanan atas

### `/login`
- Form email + password
- Setelah login → redirect `/`, tombol Edit muncul di tiap card

### `/users/:id/edit` *(login required)*
- Form: Name, NIK, Dept (dropdown), Ext, Building (dropdown)
- Kota: read-only, auto-isi dari building yang dipilih
- Simpan → PATCH → log otomatis
- Riwayat 5 edit terakhir user ini di bawah form

### `/contacts` — External Contacts *(public view, edit login required)*
- List kontak eksternal dengan filter kategori
- Tombol Add/Edit/Delete hanya muncul kalau sudah login

### `/import` *(login required)*
- Upload `.xlsx` → preview: updated / skipped / invalid per baris
- Confirm → proses import + tulis log

### `/logs` *(login required)*
- Tabel: Tanggal | Editor | Target User | Field berubah (old → new)
- Filter by editor / target user
- Paginated

---

## Excel Template

Urutan kolom:

| Email* | Name | NIK | Department | Extension | Building | Kota |
|--------|------|-----|------------|-----------|----------|------|

- `Email` = match key, wajib diisi
- Kolom lain opsional — kalau kosong, field di-skip (tidak di-nullkan)
- Kolom **Building**: ada Excel Data Validation dropdown berisi gedung terdaftar (di-generate saat export)
- Kolom **Kota**: locked/read-only, auto-isi reference dari building
- Import backend juga validasi: building tidak ada di DB → baris ditolak

---

## UI Style

Simple & clean minimalis — bukan glass MBRS. Plain white background, tipografi bersih, fokus readability. Tailwind utility classes only.

---

## Access Control

| Fitur | Guest | Receptionist | Admin |
|-------|-------|-------------|-------|
| Search internal | ✓ | ✓ | ✓ |
| Search external | ✓ | ✓ | ✓ |
| Edit user | ✗ | ✓ | ✓ |
| Add/Edit/Delete external contact | ✗ | ✓ | ✓ |
| Import / Export | ✗ | ✓ | ✓ |
| Lihat log history | ✗ | ✓ | ✓ |

---

## Verification Checklist

- [ ] Migration A & B jalan di MBRS server → `users` punya `nik`, `building_id`; tabel `ext_edit_logs` ada
- [ ] `POST /api/auth/login` dengan akun receptionist MBRS → dapat token
- [ ] `GET /api/directory?q=john` → return data user dengan building + kota
- [ ] `PATCH /api/directory/5` `{ ext: "1234" }` → ext terupdate, log tercatat
- [ ] Export → buka Excel → kolom Building ada dropdown gedung terdaftar
- [ ] Import → edit 1 baris di Excel → re-import → hanya field itu yang update, log tercatat
- [ ] Buka MBRS → user yang sama sudah berubah (shared DB confirmed)
- [ ] `/logs` → tampil riwayat dengan nama editor, target user, field berubah, waktu
