import { useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useBookingHours } from '../../hooks/useBookingHours'
import { getGeneralSettings } from '../../api/settings'

function fromMin(min: number) { return `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}` }
function toMin(hhmm: string) { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m }

interface Props {
  open: boolean
  onClose: () => void
}

interface FaqItem { q: string; a: string }
interface Section { key: string; icon: string; label: string; items: FaqItem[] }

function buildSections(start: string, end: string, latestStart: string): Section[] {
  return [
    {
      key: 'getting-started',
      icon: 'rocket_launch',
      label: 'Memulai',
      items: [
        {
          q: 'Apa itu tampilan Timeline?',
          a: 'Timeline (halaman utama) menampilkan semua ruangan dalam grid horizontal untuk hari ini. Setiap baris adalah satu ruangan; setiap blok adalah pemesanan. Klik slot kosong untuk langsung membuat pemesanan dengan ruangan dan waktu yang sudah terisi otomatis.',
        },
        {
          q: 'Apa itu halaman Pemesanan Saya?',
          a: 'Pemesanan Saya menampilkan kalender pemesanan milik kamu sendiri. Ganti tampilan antara Hari, Minggu, dan Bulan menggunakan tombol toggle di atas. Tampilan Hari mendukung drag-and-drop untuk memindahkan atau mengubah durasi pemesanan.',
        },
        {
          q: 'Apa itu halaman Ruangan?',
          a: 'Direktori Ruangan menampilkan semua ruangan yang tersedia beserta foto, kapasitas, lantai, dan fasilitas. Klik kartu ruangan untuk melihat detail lengkap dan cek ketersediaan sebelum memesan.',
        },
        {
          q: 'Bagaimana cara berpindah halaman?',
          a: 'Gunakan ikon di navigasi bar atas: ikon grid untuk Timeline, ikon kalender untuk Pemesanan Saya, dan ikon pintu untuk Ruangan. Tab tambahan mungkin muncul sesuai peran kamu.',
        },
      ],
    },
    {
      key: 'making-bookings',
      icon: 'edit_calendar',
      label: 'Membuat Pemesanan',
      items: [
        {
          q: 'Bagaimana cara memesan ruangan?',
          a: 'Klik tombol "Pemesanan Baru" di halaman mana pun, atau klik slot kosong di Timeline untuk mengisi ruangan dan waktu secara otomatis. Isi judul, sesuaikan rentang waktu jika perlu, lalu klik Simpan.',
        },
        {
          q: 'Apa batas waktu pemesanan?',
          a: `Pemesanan dapat dimulai antara pukul ${start}–${latestStart} selama jam kerja, dengan kelipatan 30 menit. Untuk sesi yang berakhir setelah jam kerja (hingga pukul ${end}), hubungi resepsionis untuk pengaturan lebih lanjut.`,
        },
        {
          q: 'Bisakah saya memesan untuk orang lain?',
          a: 'Jika fitur "Pesan atas nama orang lain" diaktifkan oleh admin, kamu akan melihat kolom "Dipesan untuk" di formulir pemesanan. Cari nama rekan kamu untuk menetapkan pemesanan kepada mereka.',
        },
        {
          q: 'Apa arti status "Tentatif"?',
          a: 'Pemesanan tentatif menahan slot waktu namun belum dikonfirmasi. Ini terjadi saat kamu memesan ruangan khusus — kontak ruangan yang ditunjuk akan meninjau dan mengonfirmasi atau menolaknya. Kamu akan menerima notifikasi setelah keputusan dibuat.',
        },
        {
          q: 'Bisakah saya cek ketersediaan ruangan sebelum memesan?',
          a: 'Bisa — buka halaman Ruangan dan klik ruangan mana pun untuk melihat ketersediaannya hari ini. Kamu juga bisa menggunakan panel Ruangan Tersedia (ikon pintu di toolbar) untuk memfilter ruangan berdasarkan rentang waktu.',
        },
      ],
    },
    {
      key: 'managing-bookings',
      icon: 'manage_history',
      label: 'Kelola Pemesanan',
      items: [
        {
          q: 'Bagaimana cara mengubah pemesanan?',
          a: 'Klik pemesanan di Timeline atau halaman Pemesanan Saya untuk membuka kartu detailnya, lalu klik Edit. Kamu bisa mengubah judul, waktu, atau catatan. Catatan: ruangan tidak bisa diganti setelah pemesanan dibuat.',
        },
        {
          q: 'Bagaimana cara membatalkan pemesanan?',
          a: 'Buka pemesanan dan klik Batalkan. Sebuah toast akan muncul di kanan bawah dengan tombol undo selama 5 detik — klik untuk membatalkan pembatalan. Setelah 5 detik, pembatalan bersifat permanen.',
        },
        {
          q: 'Bagaimana cara drag-and-resize pemesanan?',
          a: 'Beralih ke tampilan Hari di halaman Pemesanan Saya. Seret bilah pemesanan ke kiri atau kanan untuk memindahkan ke waktu baru. Seret tepi kiri atau kanannya untuk memperpendek atau memperpanjang durasi. Perubahan tersimpan otomatis.',
        },
        {
          q: 'Apa yang terjadi jika terjadi konflik pemesanan?',
          a: 'Sistem memeriksa konflik secara real-time. Jika slot waktu sudah terisi, akan muncul pesan error dan pemesanan tidak akan tersimpan. Pilih waktu atau ruangan yang berbeda.',
        },
        {
          q: 'Bisakah pemesanan yang dibatalkan dikembalikan?',
          a: 'Hanya dalam jendela undo 5 detik yang ditampilkan di toast. Setelah itu, pembatalan tidak bisa dibalik — kamu perlu membuat pemesanan baru.',
        },
      ],
    },
    {
      key: 'rooms',
      icon: 'meeting_room',
      label: 'Ruangan',
      items: [
        {
          q: 'Bagaimana cara melihat detail ruangan?',
          a: 'Buka halaman Ruangan dan klik kartu ruangan mana pun. Kamu akan melihat kapasitas, lantai, gedung, fasilitas (proyektor, papan tulis, dll.), dan galeri foto ruangan.',
        },
        {
          q: 'Apa itu Ruangan Khusus?',
          a: 'Ruangan khusus memiliki kontak yang ditunjuk untuk mengelola akses. Saat kamu memesannya, status pemesanan dimulai sebagai "Tentatif" dan kontak tersebut akan diberitahu. Setelah dikonfirmasi, pemesananmu menjadi aktif. Detail kontak bisa dilihat di halaman detail ruangan.',
        },
        {
          q: 'Apa fungsi panel "Ruangan Tersedia"?',
          a: 'Klik ikon pintu di toolbar untuk membuka panel Ruangan Tersedia. Masukkan tanggal dan rentang waktu untuk langsung melihat ruangan mana yang bebas dalam rentang tersebut.',
        },
        {
          q: 'Bagaimana cara kerja ikon fasilitas?',
          a: 'Setiap kartu ruangan menampilkan ikon kecil untuk fasilitasnya (misalnya, proyektor, TV, papan tulis). Arahkan kursor ke ikon untuk melihat keterangannya. Fasilitas diatur oleh admin.',
        },
      ],
    },
    {
      key: 'notifications',
      icon: 'notifications',
      label: 'Notifikasi',
      items: [
        {
          q: 'Apa yang memicu notifikasi?',
          a: 'Kamu akan menerima notifikasi saat: pemesananmu dikonfirmasi atau ditolak, pemesanan dibatalkan oleh admin, atau konfirmasi kehadiran diperlukan (jika mode Anti-Ghost aktif).',
        },
        {
          q: 'Bagaimana cara melihat notifikasi?',
          a: 'Klik ikon lonceng di navigasi bar atas. Badge angka menunjukkan jumlah notifikasi yang belum dibaca. Klik notifikasi untuk menutupnya.',
        },
        {
          q: 'Bagaimana cara menghapus semua notifikasi?',
          a: 'Buka panel notifikasi dan klik "Hapus semua" di bagian atas. Notifikasi individual juga bisa ditutup dengan mengklik × pada masing-masing item.',
        },
        {
          q: 'Apa itu konfirmasi kehadiran?',
          a: 'Jika admin mengaktifkan mode Anti-Ghost, kamu mungkin perlu mengonfirmasi kehadiranmu di ruangan sebelum atau sesaat setelah pemesanan dimulai — melalui layar Kiosk, sensor, atau tombol konfirmasi web yang ditampilkan di kartu pemesananmu.',
        },
      ],
    },
    {
      key: 'account',
      icon: 'account_circle',
      label: 'Akun',
      items: [
        {
          q: 'Bagaimana cara mengubah foto profil?',
          a: 'Klik avatarmu di pojok kanan atas → Profil Pengguna → klik lingkaran avatar untuk mengunggah foto baru. Format yang didukung: JPG, PNG (maks. 2 MB).',
        },
        {
          q: 'Bagaimana cara mengganti kata sandi?',
          a: 'Buka avatar → Pengaturan → Ganti Kata Sandi. Masukkan kata sandi lama dan kata sandi baru dua kali. Jika opsi ini tidak terlihat, mungkin dinonaktifkan oleh admin.',
        },
        {
          q: 'Bagaimana cara keluar (logout)?',
          a: 'Klik avatarmu di pojok kanan atas dan pilih "Keluar" di bagian bawah menu dropdown.',
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
  const { data: general } = useQuery({ queryKey: ['settings-general'], queryFn: getGeneralSettings })
  const workingEnd = general?.working_hours_end ?? '17:00'
  const latestStart = fromMin(toMin(workingEnd) - 30)
  const sections = buildSections(start, end, latestStart)
  const [activeKey, setActiveKey] = useState(sections[0].key)
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({})
  const scrollRef = useRef<HTMLDivElement>(null)

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
              <p className="text-[14px] font-black" style={{ color: 'var(--ds-text-1)' }}>Bantuan & FAQ</p>
              <p className="text-[9px] font-bold uppercase tracking-wider" style={{ color: 'var(--ds-text-3)' }}>RoomSync Pro</p>
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
                  <span
                    className="material-symbols-outlined"
                    style={{ fontSize: 18, color: '#adee2b' }}
                  >
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
                Masih butuh bantuan? Hubungi IT Support di ext. 100
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
