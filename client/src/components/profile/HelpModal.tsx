import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useBookingHours } from '../../hooks/useBookingHours'
import { useSettings } from '../../context/SettingsContext'
import { getGeneralSettings } from '../../api/settings'
import { useModalHotkeys } from '../../hooks/useModalHotkeys'

function fromMin(min: number) { return `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}` }
function toMin(hhmm: string) { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m }

interface Props {
  open: boolean
  onClose: () => void
}

interface FaqItem { q: string; a: string }
interface Section { key: string; icon: string; label: string; items: FaqItem[] }

function buildSections(start: string, end: string, latestStart: string, lang: string): Section[] {
  const id = lang === 'id'
  return [
    {
      key: 'getting-started',
      icon: 'rocket_launch',
      label: id ? 'Memulai' : 'Getting Started',
      items: [
        {
          q: id ? 'Apa itu tampilan Timeline?' : 'What is the Timeline view?',
          a: id
            ? 'Timeline (halaman utama) menampilkan semua ruangan dalam grid horizontal untuk hari ini. Setiap baris adalah satu ruangan; setiap blok adalah pemesanan. Klik slot kosong untuk langsung membuat pemesanan dengan ruangan dan waktu yang sudah terisi otomatis.'
            : 'The Timeline (home page) shows all rooms in a horizontal grid for today. Each row is a room; each block is a booking. Click an empty slot to instantly create a booking with the room and time pre-filled.',
        },
        {
          q: id ? 'Apa itu halaman Pemesanan Saya?' : 'What is the My Bookings page?',
          a: id
            ? 'Pemesanan Saya menampilkan kalender pemesanan milik kamu sendiri. Ganti tampilan antara Hari, Minggu, dan Bulan menggunakan tombol toggle di atas. Tampilan Hari mendukung drag-and-drop untuk memindahkan atau mengubah durasi pemesanan.'
            : 'My Bookings shows your own booking calendar. Switch between Day, Week, and Month views using the toggle buttons at the top. Day view supports drag-and-drop to move or resize bookings.',
        },
        {
          q: id ? 'Apa itu halaman Ruangan?' : 'What is the Rooms page?',
          a: id
            ? 'Direktori Ruangan menampilkan semua ruangan yang tersedia beserta foto, kapasitas, lantai, dan fasilitas. Klik kartu ruangan untuk melihat detail lengkap dan cek ketersediaan sebelum memesan.'
            : 'The Rooms directory lists all available rooms with photos, capacity, floor, and facilities. Click any room card to see full details and check availability before booking.',
        },
        {
          q: id ? 'Bagaimana cara berpindah halaman?' : 'How do I navigate between pages?',
          a: id
            ? 'Gunakan ikon di navigasi bar atas: ikon grid untuk Timeline, ikon kalender untuk Pemesanan Saya, dan ikon pintu untuk Ruangan. Tab tambahan mungkin muncul sesuai peran kamu.'
            : 'Use the icons in the top navigation bar: the grid icon for Timeline, the calendar icon for My Bookings, and the door icon for Rooms. Additional tabs may appear based on your role.',
        },
      ],
    },
    {
      key: 'making-bookings',
      icon: 'edit_calendar',
      label: id ? 'Membuat Pemesanan' : 'Making Bookings',
      items: [
        {
          q: id ? 'Bagaimana cara memesan ruangan?' : 'How do I book a room?',
          a: id
            ? 'Klik tombol "Pemesanan Baru" di halaman mana pun, atau klik slot kosong di Timeline untuk mengisi ruangan dan waktu secara otomatis. Isi judul, sesuaikan rentang waktu jika perlu, lalu klik Simpan.'
            : 'Click the "New Booking" button on any page, or click an empty slot on the Timeline to pre-fill the room and time. Enter a title, adjust the time range if needed, then click Save.',
        },
        {
          q: id ? 'Apa batas waktu pemesanan?' : 'What are the booking time limits?',
          a: id
            ? `Pemesanan dapat dimulai antara pukul ${start}–${latestStart} selama jam kerja, dengan kelipatan 30 menit. Untuk sesi yang berakhir setelah jam kerja (hingga pukul ${end}), hubungi resepsionis untuk pengaturan lebih lanjut.`
            : `Bookings can start between ${start}–${latestStart} during working hours, in 30-minute increments. For sessions ending after working hours (up to ${end}), contact reception for further arrangements.`,
        },
        {
          q: id ? 'Bisakah saya memesan untuk orang lain?' : 'Can I book on behalf of someone else?',
          a: id
            ? 'Jika fitur "Pesan atas nama orang lain" diaktifkan oleh admin, kamu akan melihat kolom "Dipesan untuk" di formulir pemesanan. Cari nama rekan kamu untuk menetapkan pemesanan kepada mereka.'
            : 'If the "Book on behalf" feature is enabled by your admin, you\'ll see a "Booked for" field in the booking form. Search for a colleague\'s name to assign the booking to them.',
        },
        {
          q: id ? 'Bisakah saya cek ketersediaan ruangan sebelum memesan?' : 'Can I check room availability before booking?',
          a: id
            ? 'Buka halaman Ruangan dan klik ruangan mana pun untuk melihat ketersediaannya hari ini. Kamu juga bisa menggunakan panel Ruangan Tersedia — buka lewat tombol pencarian di navbar, lalu klik "Cari Ruangan Tersedia" di bagian bawah dropdown pencarian.'
            : 'Open the Rooms page and click any room to see its availability today. You can also use the Available Rooms panel — open it via the search bar in the navbar, then click "Search Available Rooms" at the bottom of the search dropdown.',
        },
      ],
    },
    {
      key: 'managing-bookings',
      icon: 'manage_history',
      label: id ? 'Kelola Pemesanan' : 'Managing Bookings',
      items: [
        {
          q: id ? 'Bagaimana cara mengubah pemesanan?' : 'How do I edit a booking?',
          a: id
            ? 'Klik pemesanan di Timeline atau halaman Pemesanan Saya untuk membuka kartu detailnya, lalu klik Edit. Kamu bisa mengubah ruangan, judul, waktu, atau catatan.'
            : 'Click a booking on the Timeline or My Bookings page to open its detail card, then click Edit. You can change the room, title, time, or notes.',
        },
        {
          q: id ? 'Bagaimana cara membatalkan pemesanan?' : 'How do I cancel a booking?',
          a: id
            ? 'Buka pemesanan dan klik Batalkan. Sebuah toast akan muncul di kanan bawah dengan tombol undo selama 5 detik — klik untuk membatalkan pembatalan. Setelah 5 detik, pembatalan bersifat permanen.'
            : 'Open the booking and click Cancel. A toast will appear at the bottom-right with an undo button for 5 seconds — click it to reverse the cancellation. After 5 seconds, the cancellation is permanent.',
        },
        {
          q: id ? 'Bagaimana cara drag-and-resize pemesanan?' : 'How do I drag or resize a booking?',
          a: id
            ? 'Beralih ke tampilan Hari di halaman Pemesanan Saya. Seret bilah pemesanan ke kiri atau kanan untuk memindahkan ke waktu baru. Seret tepi kiri atau kanannya untuk memperpendek atau memperpanjang durasi. Perubahan tersimpan otomatis.'
            : 'Switch to Day view on the My Bookings page. Drag the booking bar left or right to move it to a new time. Drag its left or right edge to shorten or extend the duration. Changes are saved automatically.',
        },
        {
          q: id ? 'Apa yang terjadi jika terjadi konflik pemesanan?' : 'What happens if there is a booking conflict?',
          a: id
            ? 'Sistem memeriksa konflik secara real-time. Jika slot waktu sudah terisi, akan muncul pesan error dan pemesanan tidak akan tersimpan. Pilih waktu atau ruangan yang berbeda.'
            : 'The system checks for conflicts in real time. If the time slot is already taken, an error message will appear and the booking will not be saved. Choose a different time or room.',
        },
        {
          q: id ? 'Bisakah pemesanan yang dibatalkan dikembalikan?' : 'Can a cancelled booking be undone?',
          a: id
            ? 'Hanya dalam jendela undo 5 detik yang ditampilkan di toast. Setelah itu, pembatalan tidak bisa dibalik — kamu perlu membuat pemesanan baru.'
            : 'Only within the 5-second undo window shown in the toast. After that, the cancellation cannot be reversed — you will need to create a new booking.',
        },
      ],
    },
    {
      key: 'rooms',
      icon: 'meeting_room',
      label: id ? 'Ruangan' : 'Rooms',
      items: [
        {
          q: id ? 'Bagaimana cara melihat detail ruangan?' : 'How do I view room details?',
          a: id
            ? 'Buka halaman Ruangan dan klik kartu ruangan mana pun. Kamu akan melihat kapasitas, lantai, gedung, fasilitas (proyektor, papan tulis, dll.), dan galeri foto ruangan.'
            : 'Open the Rooms page and click any room card. You will see the capacity, floor, building, facilities (projector, whiteboard, etc.), and a photo gallery of the room.',
        },
        {
          q: id ? 'Apa itu Ruangan Khusus?' : 'What is a Special Room?',
          a: id
            ? 'Ruangan khusus adalah ruangan yang hanya bisa dipesan oleh resepsionis atau admin. Jika kamu mencoba membukanya, akan muncul informasi kontak resepsionis. Hubungi resepsionis untuk meminta pemesanan atas namamu.'
            : 'Special rooms can only be booked by a receptionist or admin. If you try to open one, you will see the receptionist contact details. Reach out to reception to request a booking on your behalf.',
        },
        {
          q: id ? 'Apa fungsi panel "Ruangan Tersedia"?' : 'What does the "Available Rooms" panel do?',
          a: id
            ? 'Panel Ruangan Tersedia memungkinkan kamu mencari ruangan bebas berdasarkan tanggal dan rentang waktu. Buka lewat tombol pencarian di navbar, lalu klik "Cari Ruangan Tersedia" di bagian bawah dropdown pencarian.'
            : 'The Available Rooms panel lets you search for free rooms by date and time range. Open it via the search bar in the navbar, then click "Search Available Rooms" at the bottom of the search dropdown.',
        },
        {
          q: id ? 'Bagaimana cara kerja ikon fasilitas?' : 'How do facility icons work?',
          a: id
            ? 'Setiap kartu ruangan menampilkan ikon kecil untuk fasilitasnya (misalnya, proyektor, TV, papan tulis). Arahkan kursor ke ikon untuk melihat keterangannya. Fasilitas diatur oleh admin.'
            : 'Each room card shows small icons for its facilities (e.g. projector, TV, whiteboard). Hover over an icon to see its label. Facilities are managed by your admin.',
        },
      ],
    },
    {
      key: 'notifications',
      icon: 'notifications',
      label: id ? 'Notifikasi' : 'Notifications',
      items: [
        {
          q: id ? 'Apa yang memicu notifikasi?' : 'What triggers notifications?',
          a: id
            ? 'Kamu akan menerima notifikasi saat: pemesananmu dikonfirmasi atau ditolak, pemesanan dibatalkan oleh admin, atau konfirmasi kehadiran diperlukan (jika mode Anti-Ghost aktif).'
            : 'You will receive notifications when: your booking is confirmed or declined, a booking is cancelled by an admin, or attendance confirmation is required (if Anti-Ghost mode is active).',
        },
        {
          q: id ? 'Bagaimana cara melihat notifikasi?' : 'How do I view notifications?',
          a: id
            ? 'Klik ikon lonceng di navigasi bar atas. Badge angka menunjukkan jumlah notifikasi yang belum dibaca. Klik notifikasi untuk menutupnya.'
            : 'Click the bell icon in the top navigation bar. The number badge shows how many unread notifications you have. Click a notification to dismiss it.',
        },
        {
          q: id ? 'Bagaimana cara menghapus semua notifikasi?' : 'How do I clear all notifications?',
          a: id
            ? 'Buka panel notifikasi dan klik "Hapus semua" di bagian atas. Notifikasi individual juga bisa ditutup dengan mengklik × pada masing-masing item.'
            : 'Open the notification panel and click "Clear all" at the top. Individual notifications can also be dismissed by clicking × on each item.',
        },
        {
          q: id ? 'Apa itu konfirmasi kehadiran?' : 'What is attendance confirmation?',
          a: id
            ? 'Jika admin mengaktifkan mode Anti-Ghost, kamu mungkin perlu mengonfirmasi kehadiranmu di ruangan sebelum atau sesaat setelah pemesanan dimulai — melalui layar Kiosk, sensor, atau tombol konfirmasi web yang ditampilkan di kartu pemesananmu.'
            : 'If your admin has enabled Anti-Ghost mode, you may need to confirm your presence in the room before or shortly after the booking starts — via the Kiosk screen, a sensor, or the web confirmation button shown on your booking card.',
        },
      ],
    },
    {
      key: 'account',
      icon: 'account_circle',
      label: id ? 'Akun' : 'Account',
      items: [
        {
          q: id ? 'Bagaimana cara mengubah foto profil?' : 'How do I change my profile photo?',
          a: id
            ? 'Klik avatarmu di pojok kanan atas → Profil Pengguna → klik lingkaran avatar untuk mengunggah foto baru. Format yang didukung: JPG, PNG (maks. 2 MB).'
            : 'Click your avatar in the top-right corner → User Profile → click the avatar circle to upload a new photo. Supported formats: JPG, PNG (max 2 MB).',
        },
        {
          q: id ? 'Bagaimana cara mengganti kata sandi?' : 'How do I change my password?',
          a: id
            ? 'Buka avatar → Pengaturan → Ganti Kata Sandi. Masukkan kata sandi lama dan kata sandi baru dua kali. Jika opsi ini tidak terlihat, mungkin dinonaktifkan oleh admin.'
            : 'Go to avatar → Settings → Change Password. Enter your old password and your new password twice. If this option is not visible, it may have been disabled by your admin.',
        },
        {
          q: id ? 'Bagaimana cara keluar (logout)?' : 'How do I log out?',
          a: id
            ? 'Klik avatarmu di pojok kanan atas dan pilih "Keluar" di bagian bawah menu dropdown.'
            : 'Click your avatar in the top-right corner and select "Log out" at the bottom of the dropdown menu.',
        },
      ],
    },
  ]
}

function AccordionItem({ q, a }: FaqItem) {
  const [open, setOpen] = useState(false)
  return (
    <div className="rounded-2xl overflow-hidden border" style={{ borderColor: 'var(--ds-border-sub)' }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-[var(--ds-bg-raised)]"
      >
        <span className="text-[12px] font-black" style={{ color: 'var(--ds-text-1)' }}>{q}</span>
        <span
          className="material-symbols-outlined shrink-0 transition-transform"
          style={{ fontSize: 18, color: 'var(--ds-text-3)', transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}
        >
          keyboard_arrow_down
        </span>
      </button>
      {open && (
        <div className="px-4 pb-4 pt-1" style={{ background: 'var(--ds-bg-raised)' }}>
          <p className="text-[12px] leading-relaxed font-medium" style={{ color: 'var(--ds-text-2)' }}>{a}</p>
        </div>
      )}
    </div>
  )
}

export default function HelpModal({ open, onClose }: Props) {
  const { start, end } = useBookingHours()
  const { language } = useSettings()
  const { data: general } = useQuery({ queryKey: ['settings-general'], queryFn: getGeneralSettings })
  const workingEnd = general?.working_hours_end ?? '17:00'
  const latestStart = fromMin(toMin(workingEnd) - 30)
  const sections = buildSections(start, end, latestStart, language)
  const [activeKey, setActiveKey] = useState(sections[0].key)
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({})
  const scrollRef = useRef<HTMLDivElement>(null)

  useModalHotkeys(open, undefined, onClose)

  const id = language === 'id'

  // Scroll-spy: update active nav item as user scrolls
  useEffect(() => {
    const container = scrollRef.current
    if (!container) return
    function onScroll() {
      const keys = sections.map(s => s.key)
      // Walk in reverse to find the last section whose top is within the visible area
      for (let i = keys.length - 1; i >= 0; i--) {
        const el = sectionRefs.current[keys[i]]
        if (el && el.offsetTop - 32 <= container!.scrollTop) {
          setActiveKey(keys[i])
          return
        }
      }
      setActiveKey(keys[0])
    }
    container.addEventListener('scroll', onScroll, { passive: true })
    return () => container.removeEventListener('scroll', onScroll)
  }, [sections])

  function scrollToSection(key: string) {
    setActiveKey(key)
    const el = sectionRefs.current[key]
    if (el && scrollRef.current) {
      scrollRef.current.scrollTo({ top: el.offsetTop - 16, behavior: 'smooth' })
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div
        className="relative flex flex-col rounded-3xl shadow-2xl w-full max-w-[780px]"
        style={{
          background: 'var(--ds-bg-surface)',
          border: '1px solid var(--ds-border-sub)',
          maxHeight: '82vh',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-7 py-5 shrink-0 rounded-t-3xl"
          style={{ borderBottom: '1px solid var(--ds-border-sub)', background: 'var(--ds-bg-surface)' }}
        >
          <div className="flex items-center gap-3">
            <div className="size-9 rounded-xl flex items-center justify-center" style={{ background: '#0f141e' }}>
              <span className="material-symbols-outlined text-base" style={{ color: '#adee2b' }}>help</span>
            </div>
            <div>
              <p className="text-[14px] font-black" style={{ color: 'var(--ds-text-1)' }}>{id ? 'Bantuan & FAQ' : 'Help & FAQ'}</p>
              <p className="text-[9px] font-bold uppercase tracking-wider" style={{ color: 'var(--ds-text-3)' }}>{general?.app_name ?? 'RoomSync Pro'}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="size-8 rounded-full flex items-center justify-center transition-colors hover:bg-[var(--ds-bg-raised)]"
            style={{ color: 'var(--ds-text-3)' }}
          >
            <span className="material-symbols-outlined text-base">close</span>
          </button>
        </div>

        {/* Body */}
        <div className="flex flex-1 min-h-0">
          {/* Left sidebar */}
          <div
            className="w-44 shrink-0 flex flex-col gap-1 p-3 overflow-y-auto"
            style={{ borderRight: '1px solid var(--ds-border-sub)' }}
          >
            {sections.map(sec => {
              const isActive = activeKey === sec.key
              return (
                <button
                  key={sec.key}
                  type="button"
                  onClick={() => scrollToSection(sec.key)}
                  className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left transition-colors"
                  style={{
                    background: isActive ? 'rgba(173,238,43,0.12)' : 'transparent',
                    color: isActive ? '#4d7c00' : 'var(--ds-text-2)',
                  }}
                >
                  <span
                    className="material-symbols-outlined shrink-0"
                    style={{ fontSize: 17, color: isActive ? '#4d7c00' : 'var(--ds-text-3)' }}
                  >
                    {sec.icon}
                  </span>
                  <span className="text-[11px] font-black leading-tight">{sec.label}</span>
                </button>
              )
            })}
          </div>

          {/* Right content */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-8">
            {sections.map(sec => (
              <section
                key={sec.key}
                ref={el => { sectionRefs.current[sec.key] = el }}
              >
                <div className="flex items-center gap-2 mb-4">
                  <span className="material-symbols-outlined" style={{ fontSize: 18, color: '#adee2b' }}>
                    {sec.icon}
                  </span>
                  <p className="text-[13px] font-black uppercase tracking-wider" style={{ color: 'var(--ds-text-1)' }}>
                    {sec.label}
                  </p>
                </div>
                <div className="space-y-2">
                  {sec.items.map(item => (
                    <AccordionItem key={item.q} {...item} />
                  ))}
                </div>
              </section>
            ))}

            {/* Footer */}
            <div className="pt-2 pb-1 text-center">
              <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--ds-text-3)' }}>
                {id ? 'Masih butuh bantuan? Hubungi IT Support di ext. 100' : 'Still need help? Contact IT Support at ext. 100'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
