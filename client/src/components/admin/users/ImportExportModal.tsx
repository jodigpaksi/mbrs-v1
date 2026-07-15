import { useState, useRef, useCallback } from 'react'
import type { User, UserRole } from '../../../types/index'
import { useModalHotkeys } from '../../../hooks/useModalHotkeys'
import { loadXlsx, loadExcelJs } from '../../../utils/lazyExport'
import { exportUsers } from '../../../api/users'
import { ModalPortal } from '../shared'
import { download, applyDropdown } from '../sharedUtils'
import { ROLE_META } from './roleMeta'

type ImportTab = 'excel' | 'csv' | 'sql'

const IMPORT_COLS = ['name', 'nik', 'email', 'alias', 'password', 'department', 'department_location', 'role', 'ext', 'default_building', 'assigned_buildings']
const EXPORT_COLS = [...IMPORT_COLS, 'created_at', 'updated_at']
const ROLE_OPTIONS = ['user', 'admin', 'receptionist', 'building_admin']

type ImportRow = {
  name: string; nik?: string; email: string; alias?: string; password: string
  department?: string; department_location?: string; role?: string; ext?: string
  default_building?: string; assigned_buildings?: string
}

function ImportExportModal({ users, onImport, onClose }: {
  users: User[]
  onImport: (rows: ImportRow[]) => Promise<{ created: number; errors: string[] }>
  onClose: () => void
}) {
  const [mainTab, setMainTab] = useState<'export' | 'import'>('export')
  const [tab, setTab] = useState<ImportTab>('excel')
  const [docsOpen, setDocsOpen] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [preview, setPreview] = useState<ImportRow[] | null>(null)
  const [parseErr, setParseErr] = useState('')
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<{ created: number; errors: string[] } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  // ── Export helpers ──────────────────────────────────────────────────────────
  const [exporting, setExporting] = useState(false)

  async function fetchExportData() {
    setExporting(true)
    try { return await exportUsers() }
    finally { setExporting(false) }
  }

  async function doExportCSV() {
    const data = await fetchExportData()
    const rows = [EXPORT_COLS.join(','), ...data.map(u =>
      EXPORT_COLS.map(c => {
        const v = (u as Record<string, string>)[c] ?? ''
        return v.includes(',') || v.includes('"') ? `"${v.replace(/"/g, '""')}"` : v
      }).join(',')
    )]
    download('users_export.csv', rows.join('\n'), 'text/csv')
  }

  async function doExportExcel() {
    const XLSX = await loadXlsx()
    const data = await fetchExportData()
    const ws = XLSX.utils.json_to_sheet(data.map(u => ({
      name: u.name, nik: u.nik, email: u.email, alias: u.alias, password: u.password,
      department: u.department, department_location: u.department_location,
      role: u.role, ext: u.ext,
      default_building: u.default_building, assigned_buildings: u.assigned_buildings,
      created_at: u.created_at ?? '', updated_at: u.updated_at ?? '',
    })))
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Users')
    XLSX.writeFile(wb, 'users_export.xlsx')
  }

  async function doExportSQL() {
    const data = await fetchExportData()
    const rows = data.map(u => {
      const vals = [u.name, u.nik, u.email, u.alias, u.password, u.department, u.department_location, u.role, u.ext, u.default_building, u.assigned_buildings, u.created_at, u.updated_at]
        .map(v => `'${String(v ?? '').replace(/'/g, "''")}'`).join(', ')
      return `  (${vals})`
    }).join(',\n')
    const sql = `-- MRBS Users Export (${new Date().toISOString().slice(0, 10)})\n-- Passwords exported as bcrypt hash — recognized automatically on re-import.\nINSERT INTO users (name, nik, email, alias, password, department, department_location, role, ext, default_building, assigned_buildings, created_at, updated_at) VALUES\n${rows};`
    download('users_export.sql', sql, 'text/plain')
  }

  // ── Import: download template ───────────────────────────────────────────────
  const TEMPLATE_EXAMPLE: Record<string, string>[] = [
    { name: 'Budi Santoso', nik: '3201010101010001', email: 'budi@company.com', alias: 'budi', password: 'password123', department: 'IT', department_location: 'Jakarta', role: 'user', ext: '1001', default_building: 'Tower A', assigned_buildings: '' },
    { name: 'Siti Rahayu', nik: '', email: 'siti@company.com', alias: 'siti.rahayu', password: 'password123', department: 'HR', department_location: 'Jakarta', role: 'receptionist', ext: '', default_building: '', assigned_buildings: 'Tower A, Tower B' },
    { name: 'Andi Wibowo', nik: '', email: 'andi.wibowo@company.com', alias: '', password: 'password123', department: 'Finance', department_location: 'Jakarta', role: 'user', ext: '', default_building: '', assigned_buildings: '' },
  ]

  async function downloadTemplate(fmt: 'xlsx' | 'csv') {
    if (fmt === 'xlsx') {
      const ExcelJS = await loadExcelJs()
      const wb = new ExcelJS.Workbook()
      const ws = wb.addWorksheet('Users')
      ws.columns = IMPORT_COLS.map(c => ({ header: c, key: c, width: 22 }))
      ws.getRow(1).font = { bold: true }
      TEMPLATE_EXAMPLE.forEach(r => ws.addRow(r))
      applyDropdown(ws, 'role', ROLE_OPTIONS)

      const buf = await wb.xlsx.writeBuffer()
      const a = document.createElement('a')
      a.href = URL.createObjectURL(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }))
      a.download = 'users_import_template.xlsx'
      a.click()
    } else {
      const rows = [IMPORT_COLS.join(','), ...TEMPLATE_EXAMPLE.map(r => IMPORT_COLS.map(c => r[c] ?? '').join(','))]
      download('users_import_template.csv', rows.join('\n'), 'text/csv')
    }
  }

  // ── Import: parse file ──────────────────────────────────────────────────────
  const handleFile = useCallback((file: File) => {
    setParseErr(''); setPreview(null); setImportResult(null)
    const ext = file.name.split('.').pop()?.toLowerCase()

    const parseRows = (raw: unknown[][]): ImportRow[] => {
      if (!raw.length) throw new Error('File is empty')
      // First row is header — find column indices
      const header = (raw[0] as string[]).map(h => String(h ?? '').trim().toLowerCase())
      const idx = (col: string) => header.indexOf(col)
      const nameI = idx('name'), emailI = idx('email'), pwI = idx('password')
      if (nameI < 0 || emailI < 0 || pwI < 0)
        throw new Error('Missing required columns: name, email, password')
      return raw.slice(1).filter(r => r[nameI] || r[emailI]).map(r => {
        const get = (col: string) => idx(col) >= 0 ? String(r[idx(col)] ?? '').trim() : ''
        return {
          name:                String(r[nameI] ?? '').trim(),
          nik:                 get('nik'),
          email:               String(r[emailI] ?? '').trim(),
          alias:               get('alias'),
          password:            String(r[pwI] ?? '').trim(),
          department:          get('department'),
          department_location: get('department_location'),
          role:                get('role') || 'user',
          ext:                 get('ext'),
          default_building:    get('default_building'),
          assigned_buildings:  get('assigned_buildings'),
        }
      })
    }

    if (ext === 'csv' || ext === 'sql') {
      const reader = new FileReader()
      reader.onload = async e => {
        try {
          const text = e.target!.result as string
          if (ext === 'sql') {
            // Parse: extract VALUES rows from INSERT INTO ... VALUES (...),(...)
            const match = text.match(/VALUES\s*([\s\S]+?);/i)
            if (!match) throw new Error('No INSERT VALUES block found in SQL file')
            const rowMatches = [...match[1].matchAll(/\(([^)]+)\)/g)]
            if (!rowMatches.length) throw new Error('No data rows found')
            // Build pseudo-table: assume fixed column order name,email,password,department,role,ext
            const fakeHeader = [IMPORT_COLS]
            const dataRows = rowMatches.map(m =>
              m[1].split(',').map(v => v.trim().replace(/^'|'$/g, '').replace(/''/g, "'"))
            )
            setPreview(parseRows([...fakeHeader, ...dataRows]))
          } else {
            // CSV
            const XLSX = await loadXlsx()
            const wb = XLSX.read(text, { type: 'string' })
            const ws = wb.Sheets[wb.SheetNames[0]]
            const raw = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1 })
            setPreview(parseRows(raw as unknown[][]))
          }
        } catch (err) { setParseErr(String(err)) }
      }
      reader.readAsText(file)
    } else {
      // xlsx
      const reader = new FileReader()
      reader.onload = async e => {
        try {
          const XLSX = await loadXlsx()
          const wb = XLSX.read(e.target!.result, { type: 'binary' })
          const ws = wb.Sheets[wb.SheetNames[0]]
          const raw = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1 })
          setPreview(parseRows(raw as unknown[][]))
        } catch (err) { setParseErr(String(err)) }
      }
      reader.readAsBinaryString(file)
    }
  }, [])

  async function handleImport() {
    if (!preview?.length) return
    setImporting(true); setImportResult(null)
    try {
      const result = await onImport(preview)
      setImportResult(result)
      setPreview(null)
      if (fileRef.current) fileRef.current.value = ''
    } finally { setImporting(false) }
  }

  useModalHotkeys(true, handleImport, onClose)

  const TABS: { key: ImportTab; label: string; icon: string }[] = [
    { key: 'excel', label: 'Excel (.xlsx)', icon: 'table' },
    { key: 'csv',   label: 'CSV (.csv)',    icon: 'description' },
    { key: 'sql',   label: 'SQL (.sql)',    icon: 'database' },
  ]

  return (
    <ModalPortal>
    <div className="fixed inset-0 z-[1000] flex items-center justify-center admin-backdrop-in" style={{ background: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(12px)' }} onClick={onClose}>
      <div className="bg-[var(--ds-bg-surface)] rounded-3xl shadow-2xl w-[96vw] max-w-[1600px] flex flex-col overflow-hidden admin-modal-in" style={{ height: 720, maxHeight: '90vh' }} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between px-7 pt-6 pb-4 border-b border-[var(--ds-border)] shrink-0">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.25em] text-[var(--ds-text-3)]">Admin · Users</p>
            <h3 className="text-xl font-black uppercase tracking-tight text-[var(--ds-text-1)] mt-0.5">Import / Export</h3>
          </div>
          <button onClick={onClose} className="size-8 flex items-center justify-center rounded-xl text-[var(--ds-text-3)] hover:bg-[var(--ds-bg-surface-2)] hover:text-[var(--ds-text-1)]">
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>close</span>
          </button>
        </div>

        {/* Main tabs: Export / Import */}
        <div className="flex gap-1 px-7 pt-3 shrink-0 border-b border-[var(--ds-border)]">
          {([
            { key: 'export' as const, label: 'Export', icon: 'upload', color: '#10b981' },
            { key: 'import' as const, label: 'Import', icon: 'download', color: '#6366f1' },
          ]).map(mt => (
            <button key={mt.key} onClick={() => setMainTab(mt.key)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-t-xl text-[12px] font-black uppercase tracking-wider transition-colors border-b-2 -mb-px"
              style={mainTab === mt.key ? { borderColor: mt.color, color: 'var(--ds-text-1)' } : { borderColor: 'transparent', color: 'var(--ds-text-3)' }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 16, color: mainTab === mt.key ? mt.color : undefined }}>{mt.icon}</span>
              {mt.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>

        {/* ── EXPORT TAB ── */}
        {mainTab === 'export' && (
          <div className="px-7 py-5">
            <div className="rounded-2xl border p-4 space-y-3" style={{ background: 'rgba(16,185,129,0.04)', borderColor: 'rgba(16,185,129,0.18)' }}>
              <span className="text-[11px] font-bold text-[var(--ds-text-3)]">{users.length} user{users.length !== 1 ? 's' : ''} will be exported</span>
              <p className="text-[11px] text-[var(--ds-text-2)] font-medium">Downloads all user records including hashed passwords. Columns: <span className="font-mono text-[var(--ds-text-1)]">{EXPORT_COLS.join(', ')}</span>. <span className="italic">Date Created/Edited are read-only — not part of the import template.</span></p>
              <div className="flex gap-2">
                <button onClick={doExportExcel} disabled={exporting}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 text-white text-[11px] font-black uppercase hover:bg-emerald-700 disabled:opacity-50 transition-colors">
                  {exporting ? <span className="material-symbols-outlined animate-spin" style={{ fontSize: 13 }}>progress_activity</span> : <span className="material-symbols-outlined" style={{ fontSize: 13 }}>table</span>}Excel
                </button>
                <button onClick={doExportCSV} disabled={exporting}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-500 text-white text-[11px] font-black uppercase hover:bg-blue-600 disabled:opacity-50 transition-colors">
                  {exporting ? <span className="material-symbols-outlined animate-spin" style={{ fontSize: 13 }}>progress_activity</span> : <span className="material-symbols-outlined" style={{ fontSize: 13 }}>description</span>}CSV
                </button>
                <button onClick={doExportSQL} disabled={exporting}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-700 text-white text-[11px] font-black uppercase hover:bg-slate-800 disabled:opacity-50 transition-colors">
                  {exporting ? <span className="material-symbols-outlined animate-spin" style={{ fontSize: 13 }}>progress_activity</span> : <span className="material-symbols-outlined" style={{ fontSize: 13 }}>database</span>}SQL
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── IMPORT TAB ── */}
        {mainTab === 'import' && (
        <div className="px-7 py-5 space-y-4">

          {/* Format tabs */}
          <div className="flex gap-1 bg-[var(--ds-bg-surface-2)] rounded-xl p-1 w-fit">
            {TABS.map(t => (
              <button key={t.key} onClick={() => { setTab(t.key); setPreview(null); setParseErr(''); setImportResult(null); setDocsOpen(false) }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-black uppercase transition-all ${tab === t.key ? 'bg-[var(--ds-bg-surface)] shadow text-[var(--ds-text-1)]' : 'text-[var(--ds-text-3)] hover:text-[var(--ds-text-2)]'}`}>
                <span className="material-symbols-outlined" style={{ fontSize: 13 }}>{t.icon}</span>
                {t.label}
              </button>
            ))}
          </div>

          {/* Format docs — collapsible, collapsed by default */}
          <div className="bg-[var(--ds-bg-raised)] rounded-2xl overflow-hidden">
            <button type="button" onClick={() => setDocsOpen(o => !o)}
              className="w-full flex items-center justify-between gap-2 px-4 py-3 text-left">
              <span className="flex items-center gap-2 min-w-0">
                <span className="material-symbols-outlined text-[var(--ds-text-3)] shrink-0" style={{ fontSize: 16 }}>info</span>
                <span className="font-black text-[var(--ds-text-1)] text-[12px] truncate">
                  Format {tab === 'excel' ? 'Excel (.xlsx)' : tab === 'csv' ? 'CSV (.csv)' : 'SQL (.sql)'} — column guide &amp; example
                </span>
              </span>
              <span className="material-symbols-outlined text-[var(--ds-text-3)] shrink-0 transition-transform duration-200" style={{ fontSize: 18, transform: docsOpen ? 'rotate(180deg)' : 'none' }}>expand_more</span>
            </button>

            {docsOpen && (
              <div className="px-4 pb-4 pt-1 space-y-3 text-[12px] border-t border-[var(--ds-border-sub)]">
                {tab === 'excel' && (
                  <>
                    <div className="overflow-x-auto">
                      <table className="text-[11px] border-collapse w-full">
                        <thead>
                          <tr className="bg-[var(--ds-border)]">
                            {IMPORT_COLS.map((_, i) => (
                              <th key={i} className="px-3 py-1.5 text-left font-black text-[var(--ds-text-1)] border border-[var(--ds-border)]">Col {String.fromCharCode(65 + i)}</th>
                            ))}
                          </tr>
                          <tr className="bg-[var(--ds-bg-surface-2)]">
                            {IMPORT_COLS.map(c => (
                              <th key={c} className="px-3 py-1.5 text-left font-bold text-[var(--ds-text-2)] border border-[var(--ds-border)] font-mono">{c}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          <tr className="bg-[var(--ds-bg-surface)]">
                            {['Budi Santoso', '3201010101010001', 'budi@co.com', 'budi', 'pass1234', 'IT', 'Jakarta', 'user', '1001', 'Tower A', ''].map((v, i) => (
                              <td key={i} className="px-3 py-1.5 border border-[var(--ds-border-sub)] text-[var(--ds-text-2)]">{v}</td>
                            ))}
                          </tr>
                          <tr className="bg-[var(--ds-bg-raised)]">
                            {['Siti Rahayu', '', 'siti@co.com', 'siti.rahayu', 'pass1234', 'HR', 'Jakarta', 'receptionist', '', '', 'Tower A, Tower B'].map((v, i) => (
                              <td key={i} className="px-3 py-1.5 border border-[var(--ds-border-sub)] text-[var(--ds-text-2)] italic">{v || '(empty)'}</td>
                            ))}
                          </tr>
                          <tr className="bg-[var(--ds-bg-surface)]">
                            {['Andi Wibowo', '', 'andi.wibowo@co.com', '', 'pass1234', 'Finance', 'Jakarta', 'user', '', '', ''].map((v, i) => (
                              <td key={i} className="px-3 py-1.5 border border-[var(--ds-border-sub)] text-[var(--ds-text-2)] italic">{v || '(auto → andi.wibowo)'}</td>
                            ))}
                          </tr>
                        </tbody>
                      </table>
                    </div>
                    <ul className="space-y-1 text-[var(--ds-text-2)] list-disc pl-4">
                      <li>First row must be a header — column names can be anything, <em>column order determines mapping</em></li>
                      <li>Required: <span className="font-mono">name</span> (Col A), <span className="font-mono">email</span> (Col C), <span className="font-mono">password</span> (Col E). All other columns are optional</li>
                      <li>NIK (Col B): Indonesian national ID number, optional, must be unique if given. Not applicable for <span className="font-mono">admin</span> role — ignored if the row's role is admin</li>
                      <li>Alias (Col D): login username, e.g. <span className="font-mono">andi.wibowo@company.com</span> → <span className="font-mono">andi.wibowo</span>. Leave blank to auto-generate from the email prefix (see row 3 example above)</li>
                      <li>Role: <span className="font-mono bg-[var(--ds-bg-raised)] px-1 rounded">user</span> · <span className="font-mono bg-[var(--ds-bg-raised)] px-1 rounded">admin</span> · <span className="font-mono bg-[var(--ds-bg-raised)] px-1 rounded">receptionist</span> · <span className="font-mono bg-[var(--ds-bg-raised)] px-1 rounded">building_admin</span> (default: <span className="font-mono">user</span>) — the downloaded template has a dropdown on this column</li>
                      <li>Department location (Col G) is only used when the department name is new (creates it with that location)</li>
                      <li>Default/assigned building (Col J–K) must match an existing building name exactly; separate multiple assigned buildings with commas</li>
                      <li>Password is hashed automatically on the server</li>
                    </ul>
                    <button onClick={() => downloadTemplate('xlsx')}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 text-white text-[10px] font-black uppercase hover:bg-emerald-700 transition-colors">
                      <span className="material-symbols-outlined" style={{ fontSize: 13 }}>download</span>Download Template (.xlsx)
                    </button>
                  </>
                )}

                {tab === 'csv' && (
                  <>
                    <div className="bg-[var(--ds-bg-surface)] rounded-xl border border-[var(--ds-border)] p-3 font-mono text-[11px] text-[var(--ds-text-2)] space-y-0.5 overflow-x-auto whitespace-nowrap">
                      <p className="text-[var(--ds-text-3)]">{IMPORT_COLS.join(',')}</p>
                      <p>Budi Santoso,3201010101010001,budi@co.com,budi,pass1234,IT,Jakarta,user,1001,Tower A,</p>
                      <p>Siti Rahayu,,siti@co.com,siti.rahayu,pass1234,HR,Jakarta,receptionist,,,&quot;Tower A, Tower B&quot;</p>
                      <p>Andi Wibowo,,andi.wibowo@co.com,,pass1234,Finance,Jakarta,user,,,</p>
                    </div>
                    <ul className="space-y-1 text-[var(--ds-text-2)] list-disc pl-4">
                      <li>Separator: comma <span className="font-mono bg-[var(--ds-bg-raised)] px-1 rounded">,</span> — wrap values containing commas (e.g. multiple assigned buildings) in double quotes</li>
                      <li>First row = header (column names used for mapping, order doesn't matter)</li>
                      <li>Columns <span className="font-mono">name</span>, <span className="font-mono">email</span>, <span className="font-mono">password</span> are required — all others are optional</li>
                      <li>NIK: Indonesian national ID number, optional, must be unique if given. Not applicable for <span className="font-mono">admin</span> role — ignored if the row's role is admin</li>
                      <li>Alias: login username, e.g. <span className="font-mono">andi.wibowo@company.com</span> → <span className="font-mono">andi.wibowo</span>. Leave blank to auto-generate from the email prefix (see row 3 example above)</li>
                      <li>Role must be one of <span className="font-mono">user</span>, <span className="font-mono">admin</span>, <span className="font-mono">receptionist</span>, <span className="font-mono">building_admin</span> (default: <span className="font-mono">user</span>)</li>
                      <li>Default/assigned building must match an existing building name exactly; separate multiple assigned buildings with commas inside quotes</li>
                      <li>Encoding: UTF-8</li>
                    </ul>
                    <button onClick={() => downloadTemplate('csv')}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-blue-500 text-white text-[10px] font-black uppercase hover:bg-blue-600 transition-colors">
                      <span className="material-symbols-outlined" style={{ fontSize: 13 }}>download</span>Download Template (.csv)
                    </button>
                  </>
                )}

                {tab === 'sql' && (
                  <>
                    <div className="bg-[var(--ds-bg-surface)] rounded-xl border border-[var(--ds-border)] p-3 font-mono text-[11px] text-[var(--ds-text-2)] space-y-0.5 overflow-x-auto whitespace-nowrap">
                      <p className="text-[var(--ds-text-3)]">-- Column order required: {IMPORT_COLS.join(', ')}</p>
                      <p>INSERT INTO users ({IMPORT_COLS.join(', ')}) VALUES</p>
                      <p className="pl-2">('Budi Santoso', '3201010101010001', 'budi@co.com', 'budi', 'pass1234', 'IT', 'Jakarta', 'user', '1001', 'Tower A', ''),</p>
                      <p className="pl-2">('Siti Rahayu', NULL, 'siti@co.com', 'siti.rahayu', 'pass1234', 'HR', 'Jakarta', 'receptionist', NULL, NULL, 'Tower A, Tower B'),</p>
                      <p className="pl-2">('Andi Wibowo', NULL, 'andi.wibowo@co.com', NULL, 'pass1234', 'Finance', 'Jakarta', 'user', NULL, NULL, NULL);</p>
                    </div>
                    <ul className="space-y-1 text-[var(--ds-text-2)] list-disc pl-4">
                      <li>Only one <span className="font-mono">INSERT INTO ... VALUES (...)</span> block is processed</li>
                      <li>Column order in VALUES must be: <span className="font-mono">{IMPORT_COLS.join(', ')}</span></li>
                      <li>Use <span className="font-mono">NULL</span> or empty string <span className="font-mono">''</span> for optional fields — only <span className="font-mono">name</span>, <span className="font-mono">email</span>, <span className="font-mono">password</span> are required</li>
                      <li>NIK: Indonesian national ID number, optional, must be unique if given. Not applicable for <span className="font-mono">admin</span> role — ignored if the row's role is admin</li>
                      <li>Alias: login username. Leave <span className="font-mono">NULL</span>/empty to auto-generate from the email prefix (e.g. <span className="font-mono">andi.wibowo@company.com</span> → <span className="font-mono">andi.wibowo</span>, see row 3 example above)</li>
                      <li>Role must be one of <span className="font-mono">user</span>, <span className="font-mono">admin</span>, <span className="font-mono">receptionist</span>, <span className="font-mono">building_admin</span> (default: <span className="font-mono">user</span>)</li>
                      <li>Default/assigned building must match an existing building name exactly; separate multiple assigned buildings with commas</li>
                      <li>Password can be plain text (auto-hashed) or a bcrypt hash from an export (recognized automatically)</li>
                      <li>Multi-statement and subqueries are not supported</li>
                    </ul>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Drag & drop file chooser */}
          {!importResult && (
            <div
              onDragOver={e => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={e => {
                e.preventDefault(); setDragOver(false)
                const f = e.dataTransfer.files?.[0]
                if (f) handleFile(f)
              }}
              onClick={() => fileRef.current?.click()}
              className="rounded-2xl border-2 border-dashed flex flex-col items-center justify-center gap-1.5 py-8 px-4 cursor-pointer transition-colors"
              style={dragOver
                ? { borderColor: '#adee2b', background: 'rgba(173,238,43,0.06)' }
                : { borderColor: 'var(--ds-border)' }
              }
            >
              <span className="material-symbols-outlined text-[var(--ds-text-3)]" style={{ fontSize: 30 }}>cloud_upload</span>
              <p className="text-[12px] font-bold text-[var(--ds-text-2)] text-center">
                Drag &amp; drop your file here, or <span className="text-[var(--ds-text-1)] underline">browse</span>
              </p>
              <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--ds-text-3)]">
                Accepted: {tab === 'excel' ? '.xlsx, .xls' : tab === 'csv' ? '.csv' : '.sql'}
              </p>
              <input
                ref={fileRef}
                type="file"
                accept={tab === 'excel' ? '.xlsx,.xls' : tab === 'csv' ? '.csv' : '.sql'}
                onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])}
                className="hidden"
              />
              {parseErr && <p className="text-sm text-red-500 font-bold mt-1">{parseErr}</p>}
            </div>
          )}

          {/* Preview table */}
          {preview && preview.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-black uppercase tracking-widest text-[var(--ds-text-3)]">Preview — {preview.length} rows</p>
                <button onClick={() => { setPreview(null); if (fileRef.current) fileRef.current.value = '' }}
                  className="text-[10px] text-[var(--ds-text-3)] hover:text-[var(--ds-text-1)] font-bold">Clear</button>
              </div>
              <div className="overflow-x-auto rounded-xl border border-[var(--ds-border)]">
                <table className="w-full text-[11px]">
                  <thead>
                    <tr className="bg-[var(--ds-bg-raised)] border-b border-[var(--ds-border)]">
                      {IMPORT_COLS.map(c => (
                        <th key={c} className="px-3 py-2 text-left font-black text-[var(--ds-text-2)] uppercase">{c}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.slice(0, 8).map((row, i) => (
                      <tr key={i} className={i % 2 === 0 ? 'bg-[var(--ds-bg-surface)]' : 'bg-[var(--ds-bg-raised)]'}>
                        <td className="px-3 py-1.5 font-bold text-[var(--ds-text-1)]">{row.name}</td>
                        <td className="px-3 py-1.5 text-[var(--ds-text-3)]">{row.nik || '—'}</td>
                        <td className="px-3 py-1.5 text-[var(--ds-text-2)]">{row.email}</td>
                        <td className="px-3 py-1.5 text-[var(--ds-text-3)]">{row.alias || '—'}</td>
                        <td className="px-3 py-1.5 text-[var(--ds-text-3)] font-mono">{'•'.repeat(Math.min(row.password?.length ?? 0, 8))}</td>
                        <td className="px-3 py-1.5 text-[var(--ds-text-2)]">{row.department || '—'}</td>
                        <td className="px-3 py-1.5 text-[var(--ds-text-3)]">{row.department_location || '—'}</td>
                        <td className="px-3 py-1.5">
                          {row.role && ROLE_META[row.role as UserRole] ? (
                            <span className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase ${ROLE_META[row.role as UserRole].bg} ${ROLE_META[row.role as UserRole].text}`}>{row.role}</span>
                          ) : <span className="text-[var(--ds-text-3)]">{row.role || 'user'}</span>}
                        </td>
                        <td className="px-3 py-1.5 text-[var(--ds-text-3)]">{row.ext || '—'}</td>
                        <td className="px-3 py-1.5 text-[var(--ds-text-3)]">{row.default_building || '—'}</td>
                        <td className="px-3 py-1.5 text-[var(--ds-text-3)]">{row.assigned_buildings || '—'}</td>
                      </tr>
                    ))}
                    {preview.length > 8 && (
                      <tr>
                        <td colSpan={IMPORT_COLS.length} className="px-3 py-2 text-center text-[10px] text-[var(--ds-text-3)] font-bold">
                          +{preview.length - 8} more rows...
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <button onClick={handleImport} disabled={importing}
                className="w-full py-3 rounded-2xl bg-black text-[#adee2b] text-[11px] font-black uppercase hover:bg-slate-800 disabled:opacity-40 transition-colors flex items-center justify-center gap-2">
                {importing && <span className="material-symbols-outlined animate-spin" style={{ fontSize: 13 }}>progress_activity</span>}
                Import {preview.length} Users
              </button>
            </div>
          )}

          {/* Import result */}
          {importResult && (
            <div className="space-y-3">
              <div className={`rounded-2xl p-4 ${importResult.errors.length === 0 ? 'bg-green-500/10 border border-green-500/20' : 'bg-amber-500/10 border border-amber-500/20'}`}>
                <p className={`text-base font-black ${importResult.errors.length === 0 ? 'text-green-400' : 'text-amber-400'}`}>
                  {importResult.created} user{importResult.created !== 1 ? 's' : ''} created successfully
                  {importResult.errors.length > 0 ? ` — ${importResult.errors.length} row${importResult.errors.length !== 1 ? 's' : ''} failed` : ' — all done!'}
                </p>
                {importResult.errors.length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {importResult.errors.map((e, i) => (
                      <li key={i} className="text-[11px] text-amber-400 font-medium">• {e}</li>
                    ))}
                  </ul>
                )}
              </div>
              <button onClick={() => setImportResult(null)}
                className="text-[10px] text-[var(--ds-text-3)] hover:text-[var(--ds-text-1)] font-bold">Import more</button>
            </div>
          )}
        </div>
        )}{/* end import tab */}
        </div>{/* end scrollable */}
      </div>
    </div>
    </ModalPortal>
  )
}

export { ImportExportModal as default }
export type { ImportRow }
