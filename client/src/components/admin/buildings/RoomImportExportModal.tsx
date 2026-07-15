import { useState, useRef, useCallback } from 'react'
import type { Room } from '../../../types/index'
import { useModalHotkeys } from '../../../hooks/useModalHotkeys'
import { loadXlsx, loadExcelJs } from '../../../utils/lazyExport'
import { exportRooms } from '../../../api/rooms'
import { ModalPortal } from '../shared'
import { download, applyDropdown, type ImportTab } from '../sharedUtils'

const ROOM_COLS = ['name', 'building', 'capacity', 'floor', 'facilities', 'notes', 'is_active', 'status', 'requires_contact']

type RoomImportRow = {
  name: string; building?: string; capacity: string; floor: string
  facilities?: string; notes?: string; is_active?: string; status?: string; requires_contact?: string
}

function RoomImportExportModal({ rooms, onImport, onClose }: {
  rooms: Room[]
  onImport: (rows: RoomImportRow[]) => Promise<{ created: number; errors: string[] }>
  onClose: () => void
}) {
  const [tab, setTab] = useState<ImportTab>('excel')
  const [preview, setPreview] = useState<RoomImportRow[] | null>(null)
  const [parseErr, setParseErr] = useState('')
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<{ created: number; errors: string[] } | null>(null)
  const [exporting, setExporting] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  async function fetchExportData() {
    setExporting(true)
    try { return await exportRooms() }
    finally { setExporting(false) }
  }

  async function doExportCSV() {
    const data = await fetchExportData()
    const rows = [ROOM_COLS.join(','), ...data.map(r =>
      ROOM_COLS.map(c => {
        const v = (r as Record<string, string>)[c] ?? ''
        return v.includes(',') || v.includes('"') ? `"${v.replace(/"/g, '""')}"` : v
      }).join(',')
    )]
    download('rooms_export.csv', rows.join('\n'), 'text/csv')
  }

  async function doExportExcel() {
    const data = await fetchExportData()
    const XLSX = await loadXlsx()
    const ws = XLSX.utils.json_to_sheet(data)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Rooms')
    XLSX.writeFile(wb, 'rooms_export.xlsx')
  }

  async function doExportSQL() {
    const data = await fetchExportData()
    const rows = data.map(r => {
      const vals = ROOM_COLS.map(c => (r as Record<string, string>)[c])
        .map(v => `'${String(v ?? '').replace(/'/g, "''")}'`).join(', ')
      return `  (${vals})`
    }).join(',\n')
    const sql = `-- MRBS Rooms Export (${new Date().toISOString().slice(0, 10)})\nINSERT INTO rooms (${ROOM_COLS.join(', ')}) VALUES\n${rows};`
    download('rooms_export.sql', sql, 'text/plain')
  }

  const TEMPLATE_EXAMPLE: Record<string, string>[] = [
    { name: 'Meeting Room 1', building: 'Tower A', capacity: '10', floor: '3', facilities: 'Projector, WiFi, Whiteboard', notes: '', is_active: 'yes', status: 'active', requires_contact: 'no' },
    { name: 'Board Room', building: 'Tower A', capacity: '20', floor: '5', facilities: 'TV Screen, WiFi', notes: 'Executive use', is_active: 'yes', status: 'active', requires_contact: 'yes' },
  ]

  async function downloadTemplate(fmt: 'xlsx' | 'csv') {
    if (fmt === 'xlsx') {
      const ExcelJS = await loadExcelJs()
      const wb = new ExcelJS.Workbook()
      const ws = wb.addWorksheet('Rooms')
      ws.columns = ROOM_COLS.map(c => ({ header: c, key: c, width: 22 }))
      ws.getRow(1).font = { bold: true }
      TEMPLATE_EXAMPLE.forEach(r => ws.addRow(r))
      applyDropdown(ws, 'is_active', ['yes', 'no'])
      applyDropdown(ws, 'status', ['active', 'maintenance'])
      applyDropdown(ws, 'requires_contact', ['yes', 'no'])
      const buf = await wb.xlsx.writeBuffer()
      const a = document.createElement('a')
      a.href = URL.createObjectURL(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }))
      a.download = 'rooms_import_template.xlsx'
      a.click()
    } else {
      const rows = [ROOM_COLS.join(','), ...TEMPLATE_EXAMPLE.map(r => ROOM_COLS.map(c => r[c] ?? '').join(','))]
      download('rooms_import_template.csv', rows.join('\n'), 'text/csv')
    }
  }

  const handleFile = useCallback((file: File) => {
    setParseErr(''); setPreview(null); setImportResult(null)
    const ext = file.name.split('.').pop()?.toLowerCase()

    const parseRows = (raw: unknown[][]): RoomImportRow[] => {
      if (!raw.length) throw new Error('File is empty')
      const header = (raw[0] as string[]).map(h => String(h ?? '').trim().toLowerCase())
      const idx = (col: string) => header.indexOf(col)
      const nameI = idx('name'), capI = idx('capacity'), floorI = idx('floor')
      if (nameI < 0 || capI < 0 || floorI < 0)
        throw new Error('Missing required columns: name, capacity, floor')
      return raw.slice(1).filter(r => r[nameI]).map(r => {
        const get = (col: string) => idx(col) >= 0 ? String(r[idx(col)] ?? '').trim() : ''
        return {
          name: String(r[nameI] ?? '').trim(),
          capacity: String(r[capI] ?? '').trim(),
          floor: String(r[floorI] ?? '').trim(),
          building: get('building'), facilities: get('facilities'), notes: get('notes'),
          is_active: get('is_active'), status: get('status') || 'active', requires_contact: get('requires_contact'),
        }
      })
    }

    if (ext === 'csv' || ext === 'sql') {
      const reader = new FileReader()
      reader.onload = async e => {
        try {
          const text = e.target!.result as string
          if (ext === 'sql') {
            const match = text.match(/VALUES\s*([\s\S]+?);/i)
            if (!match) throw new Error('No INSERT VALUES block found in SQL file')
            const rowMatches = [...match[1].matchAll(/\(([^)]+)\)/g)]
            if (!rowMatches.length) throw new Error('No data rows found')
            const dataRows = rowMatches.map(m => m[1].split(',').map(v => v.trim().replace(/^'|'$/g, '').replace(/''/g, "'")))
            setPreview(parseRows([ROOM_COLS, ...dataRows]))
          } else {
            const XLSX = await loadXlsx()
            const wb = XLSX.read(text, { type: 'string' })
            const raw = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[wb.SheetNames[0]], { header: 1 })
            setPreview(parseRows(raw as unknown[][]))
          }
        } catch (err) { setParseErr(String(err)) }
      }
      reader.readAsText(file)
    } else {
      const reader = new FileReader()
      reader.onload = async e => {
        try {
          const XLSX = await loadXlsx()
          const wb = XLSX.read(e.target!.result, { type: 'binary' })
          const raw = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[wb.SheetNames[0]], { header: 1 })
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
      <div className="bg-[var(--ds-bg-surface)] rounded-3xl shadow-2xl w-[640px] max-h-[90vh] flex flex-col overflow-hidden admin-modal-in" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-7 pt-6 pb-4 border-b border-[var(--ds-border)] shrink-0">
          <div>
            <p className="text-[9px] font-black uppercase tracking-[0.25em] text-[var(--ds-text-3)]">Admin · Rooms</p>
            <h3 className="text-xl font-black uppercase tracking-tight text-[var(--ds-text-1)] mt-0.5">Import / Export</h3>
          </div>
          <button onClick={onClose} className="size-8 flex items-center justify-center rounded-xl text-[var(--ds-text-3)] hover:bg-[var(--ds-bg-surface-2)] hover:text-[var(--ds-text-1)]">
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>close</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>

        <div className="px-7 pt-5 pb-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="size-6 rounded-lg flex items-center justify-center" style={{ background: 'rgba(16,185,129,0.12)' }}>
              <span className="material-symbols-outlined" style={{ fontSize: 14, color: '#10b981' }}>upload</span>
            </div>
            <p className="text-[11px] font-black uppercase tracking-[0.15em]" style={{ color: '#10b981' }}>Export Rooms</p>
            <span className="text-[10px] font-bold text-[var(--ds-text-3)]">— {rooms.length} rooms</span>
          </div>
          <div className="rounded-2xl border p-4 space-y-3" style={{ background: 'rgba(16,185,129,0.04)', borderColor: 'rgba(16,185,129,0.18)' }}>
            <p className="text-[10px] text-[var(--ds-text-2)] font-medium">Columns: <span className="font-mono text-[var(--ds-text-1)]">{ROOM_COLS.join(', ')}</span></p>
            <div className="flex gap-2">
              <button onClick={doExportExcel} disabled={exporting} className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 text-white text-[10px] font-black uppercase hover:bg-emerald-700 disabled:opacity-50 transition-colors">
                {exporting ? <span className="material-symbols-outlined animate-spin" style={{ fontSize: 13 }}>progress_activity</span> : <span className="material-symbols-outlined" style={{ fontSize: 13 }}>table</span>}Excel
              </button>
              <button onClick={doExportCSV} disabled={exporting} className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-500 text-white text-[10px] font-black uppercase hover:bg-blue-600 disabled:opacity-50 transition-colors">
                {exporting ? <span className="material-symbols-outlined animate-spin" style={{ fontSize: 13 }}>progress_activity</span> : <span className="material-symbols-outlined" style={{ fontSize: 13 }}>description</span>}CSV
              </button>
              <button onClick={doExportSQL} disabled={exporting} className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-700 text-white text-[10px] font-black uppercase hover:bg-slate-800 disabled:opacity-50 transition-colors">
                {exporting ? <span className="material-symbols-outlined animate-spin" style={{ fontSize: 13 }}>progress_activity</span> : <span className="material-symbols-outlined" style={{ fontSize: 13 }}>database</span>}SQL
              </button>
            </div>
          </div>
        </div>

        <div className="mx-7 border-t border-[var(--ds-border)]" />

        <div className="px-7 pt-4 pb-6 space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <div className="size-6 rounded-lg flex items-center justify-center" style={{ background: 'rgba(99,102,241,0.12)' }}>
              <span className="material-symbols-outlined" style={{ fontSize: 14, color: '#6366f1' }}>download</span>
            </div>
            <p className="text-[11px] font-black uppercase tracking-[0.15em]" style={{ color: '#6366f1' }}>Import Rooms</p>
          </div>

          <div className="flex gap-1 bg-[var(--ds-bg-surface-2)] rounded-xl p-1 w-fit">
            {TABS.map(t => (
              <button key={t.key} onClick={() => { setTab(t.key); setPreview(null); setParseErr(''); setImportResult(null) }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${tab === t.key ? 'bg-[var(--ds-bg-surface)] shadow text-[var(--ds-text-1)]' : 'text-[var(--ds-text-3)] hover:text-[var(--ds-text-2)]'}`}>
                <span className="material-symbols-outlined" style={{ fontSize: 12 }}>{t.icon}</span>{t.label}
              </button>
            ))}
          </div>

          <div className="bg-[var(--ds-bg-raised)] rounded-2xl p-4 space-y-3 text-[11px]">
            {tab === 'excel' && (
              <>
                <p className="font-black text-[var(--ds-text-1)]">Format Excel (.xlsx)</p>
                <div className="overflow-x-auto">
                  <table className="text-[10px] border-collapse w-full">
                    <thead>
                      <tr className="bg-[var(--ds-border)]">
                        {ROOM_COLS.map((_, i) => <th key={i} className="px-3 py-1.5 text-left font-black text-[var(--ds-text-1)] border border-[var(--ds-border)]">Col {String.fromCharCode(65 + i)}</th>)}
                      </tr>
                      <tr className="bg-[var(--ds-bg-surface-2)]">
                        {ROOM_COLS.map(c => <th key={c} className="px-3 py-1.5 text-left font-bold text-[var(--ds-text-2)] border border-[var(--ds-border)] font-mono">{c}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {TEMPLATE_EXAMPLE.map((r, i) => (
                        <tr key={i} className={i % 2 === 0 ? 'bg-[var(--ds-bg-surface)]' : 'bg-[var(--ds-bg-raised)]'}>
                          {ROOM_COLS.map(c => <td key={c} className="px-3 py-1.5 border border-[var(--ds-border-sub)] text-[var(--ds-text-2)]">{r[c] || '(empty)'}</td>)}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <ul className="space-y-1 text-[var(--ds-text-2)] list-disc pl-4">
                  <li>First row must be a header — column order determines mapping</li>
                  <li>Required: <span className="font-mono">name</span> (Col A), <span className="font-mono">capacity</span> (Col C), <span className="font-mono">floor</span> (Col D)</li>
                  <li>Building (Col B) must match an existing building name exactly — strongly recommended, though technically optional</li>
                  <li>Facilities (Col E): comma-separated names, e.g. <span className="font-mono">Projector, WiFi, Whiteboard</span></li>
                  <li>Status: <span className="font-mono">active</span>/<span className="font-mono">maintenance</span>, Is Active &amp; Requires Contact: <span className="font-mono">yes</span>/<span className="font-mono">no</span> — the downloaded template has dropdowns on these columns</li>
                  <li>Sensor code is always auto-generated on the server, not imported</li>
                </ul>
                <button onClick={() => downloadTemplate('xlsx')} className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 text-white text-[9px] font-black uppercase hover:bg-emerald-700 transition-colors">
                  <span className="material-symbols-outlined" style={{ fontSize: 13 }}>download</span>Download Template (.xlsx)
                </button>
              </>
            )}
            {tab === 'csv' && (
              <>
                <p className="font-black text-[var(--ds-text-1)]">Format CSV (.csv)</p>
                <div className="bg-[var(--ds-bg-surface)] rounded-xl border border-[var(--ds-border)] p-3 font-mono text-[10px] text-[var(--ds-text-2)] space-y-0.5 overflow-x-auto whitespace-nowrap">
                  <p className="text-[var(--ds-text-3)]">{ROOM_COLS.join(',')}</p>
                  {TEMPLATE_EXAMPLE.map((r, i) => <p key={i}>{ROOM_COLS.map(c => c === 'facilities' ? `"${r[c] ?? ''}"` : (r[c] ?? '')).join(',')}</p>)}
                </div>
                <ul className="space-y-1 text-[var(--ds-text-2)] list-disc pl-4">
                  <li>Separator: comma — wrap values containing commas (e.g. facilities list) in double quotes</li>
                  <li>First row = header (column names used for mapping, order doesn't matter)</li>
                  <li>Required: <span className="font-mono">name</span>, <span className="font-mono">capacity</span>, <span className="font-mono">floor</span></li>
                  <li>Building must match an existing building name exactly</li>
                  <li>Status must be <span className="font-mono">active</span> or <span className="font-mono">maintenance</span> (default: <span className="font-mono">active</span>)</li>
                  <li>Sensor code is always auto-generated on the server, not imported</li>
                </ul>
                <button onClick={() => downloadTemplate('csv')} className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-blue-500 text-white text-[9px] font-black uppercase hover:bg-blue-600 transition-colors">
                  <span className="material-symbols-outlined" style={{ fontSize: 13 }}>download</span>Download Template (.csv)
                </button>
              </>
            )}
            {tab === 'sql' && (
              <>
                <p className="font-black text-[var(--ds-text-1)]">Format SQL (.sql)</p>
                <div className="bg-[var(--ds-bg-surface)] rounded-xl border border-[var(--ds-border)] p-3 font-mono text-[10px] text-[var(--ds-text-2)] space-y-0.5 overflow-x-auto whitespace-nowrap">
                  <p className="text-[var(--ds-text-3)]">-- Column order required: {ROOM_COLS.join(', ')}</p>
                  <p>INSERT INTO rooms ({ROOM_COLS.join(', ')}) VALUES</p>
                  {TEMPLATE_EXAMPLE.map((r, i) => <p key={i} className="pl-2">({ROOM_COLS.map(c => `'${r[c] ?? ''}'`).join(', ')}){i < TEMPLATE_EXAMPLE.length - 1 ? ',' : ';'}</p>)}
                </div>
                <ul className="space-y-1 text-[var(--ds-text-2)] list-disc pl-4">
                  <li>Only one <span className="font-mono">INSERT INTO ... VALUES (...)</span> block is processed</li>
                  <li>Column order in VALUES must be: <span className="font-mono">{ROOM_COLS.join(', ')}</span></li>
                  <li>Required: <span className="font-mono">name</span>, <span className="font-mono">capacity</span>, <span className="font-mono">floor</span> — use <span className="font-mono">NULL</span> or empty string for the rest</li>
                  <li>Sensor code is always auto-generated on the server, not imported</li>
                  <li>Multi-statement and subqueries are not supported</li>
                </ul>
              </>
            )}
          </div>

          {!importResult && (
            <div>
              <label className="text-[9px] font-black uppercase text-[var(--ds-text-3)] tracking-wider block mb-2">Choose File</label>
              <input ref={fileRef} type="file" accept={tab === 'excel' ? '.xlsx,.xls' : tab === 'csv' ? '.csv' : '.sql'}
                onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])}
                className="block w-full text-[11px] text-[var(--ds-text-2)] font-bold file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-[10px] file:font-black file:uppercase file:bg-black file:text-[#adee2b] hover:file:bg-slate-800 file:cursor-pointer" />
              {parseErr && <p className="text-xs text-red-500 font-bold mt-2">{parseErr}</p>}
            </div>
          )}

          {preview && preview.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-[9px] font-black uppercase tracking-widest text-[var(--ds-text-3)]">Preview — {preview.length} rows</p>
                <button onClick={() => { setPreview(null); if (fileRef.current) fileRef.current.value = '' }} className="text-[9px] text-[var(--ds-text-3)] hover:text-[var(--ds-text-1)] font-bold">Clear</button>
              </div>
              <div className="overflow-x-auto rounded-xl border border-[var(--ds-border)]">
                <table className="w-full text-[10px]">
                  <thead>
                    <tr className="bg-[var(--ds-bg-raised)] border-b border-[var(--ds-border)]">
                      {ROOM_COLS.map(c => <th key={c} className="px-3 py-2 text-left font-black text-[var(--ds-text-2)] uppercase">{c}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.slice(0, 8).map((row, i) => (
                      <tr key={i} className={i % 2 === 0 ? 'bg-[var(--ds-bg-surface)]' : 'bg-[var(--ds-bg-raised)]'}>
                        {ROOM_COLS.map(c => <td key={c} className="px-3 py-1.5 text-[var(--ds-text-2)]">{(row as Record<string, string>)[c] || '—'}</td>)}
                      </tr>
                    ))}
                    {preview.length > 8 && (
                      <tr><td colSpan={ROOM_COLS.length} className="px-3 py-2 text-center text-[9px] text-[var(--ds-text-3)] font-bold">+{preview.length - 8} more rows...</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
              <button onClick={handleImport} disabled={importing} className="w-full py-3 rounded-2xl bg-black text-[#adee2b] text-[10px] font-black uppercase hover:bg-slate-800 disabled:opacity-40 transition-colors flex items-center justify-center gap-2">
                {importing && <span className="material-symbols-outlined animate-spin" style={{ fontSize: 13 }}>progress_activity</span>}Import {preview.length} Rooms
              </button>
            </div>
          )}

          {importResult && (
            <div className="space-y-3">
              <div className={`rounded-2xl p-4 ${importResult.errors.length === 0 ? 'bg-green-500/10 border border-green-500/20' : 'bg-amber-500/10 border border-amber-500/20'}`}>
                <p className={`text-sm font-black ${importResult.errors.length === 0 ? 'text-green-400' : 'text-amber-400'}`}>
                  {importResult.created} room{importResult.created !== 1 ? 's' : ''} created successfully
                  {importResult.errors.length > 0 ? ` — ${importResult.errors.length} row${importResult.errors.length !== 1 ? 's' : ''} failed` : ' — all done!'}
                </p>
                {importResult.errors.length > 0 && (
                  <ul className="mt-2 space-y-1">{importResult.errors.map((e, i) => <li key={i} className="text-[10px] text-amber-400 font-medium">• {e}</li>)}</ul>
                )}
              </div>
              <button onClick={() => setImportResult(null)} className="text-[9px] text-[var(--ds-text-3)] hover:text-[var(--ds-text-1)] font-bold">Import more</button>
            </div>
          )}
        </div>
        </div>
      </div>
    </div>
    </ModalPortal>
  )
}

export { RoomImportExportModal as default }
