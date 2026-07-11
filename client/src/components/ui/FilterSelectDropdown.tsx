import { useEffect, useRef, useState } from 'react'

interface Option { value: string; label: string }

interface FilterSelectDropdownProps {
  value: string
  onChange: (v: string) => void
  options: Option[]
  placeholder: string
  searchable?: boolean
  searchPlaceholder?: string
  icon?: string
  accentColor?: string
  width?: number
}

/** Glass-style searchable dropdown — matches the app's Building/Room selector popovers (dropdown-enter, ds-glass-*). */
export default function FilterSelectDropdown({
  value, onChange, options, placeholder, searchable = true, searchPlaceholder = 'Search...',
  icon = 'filter_alt', accentColor = '#f59e0b', width = 190,
}: FilterSelectDropdownProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const ref = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) { setOpen(false); setQuery('') }
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [])

  useEffect(() => {
    if (open && searchable) inputRef.current?.focus()
  }, [open, searchable])

  const filtered = query.trim()
    ? options.filter(o => o.label.toLowerCase().includes(query.trim().toLowerCase()))
    : options

  const selectedLabel = options.find(o => o.value === value)?.label

  return (
    <div ref={ref} className="relative" style={{ minWidth: width }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 bg-[var(--ds-bg-surface)] border border-[var(--ds-border)] rounded-xl px-3.5 py-2.5 hover:border-[var(--ds-border)] transition-all group"
        style={{ borderColor: value ? accentColor : undefined }}
      >
        <span className="material-symbols-outlined text-[var(--ds-text-3)] shrink-0" style={{ fontSize: 15, color: value ? accentColor : undefined }}>{icon}</span>
        <span className="text-[11px] font-bold text-[var(--ds-text-1)] flex-1 text-left truncate">
          {selectedLabel ?? placeholder}
        </span>
        <span className={`material-symbols-outlined text-[var(--ds-text-3)] shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} style={{ fontSize: 16 }}>expand_more</span>
      </button>

      {open && (
        <div
          className="dropdown-enter absolute top-full left-0 mt-2 rounded-2xl z-[200] p-1.5 flex flex-col"
          style={{
            width: Math.max(width, 220),
            maxHeight: 320,
            background: 'var(--ds-glass-bg)',
            backdropFilter: 'blur(32px) saturate(180%)',
            WebkitBackdropFilter: 'blur(32px) saturate(180%)',
            border: '1px solid var(--ds-glass-border)',
            boxShadow: 'var(--ds-glass-shadow)',
          }}
        >
          {searchable && (
            <div className="p-1.5 pb-2">
              <div className="relative flex items-center">
                <span className="material-symbols-outlined absolute left-2.5 text-[var(--ds-text-3)]" style={{ fontSize: 15 }}>search</span>
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder={searchPlaceholder}
                  className="w-full pl-8 pr-3 py-2 rounded-xl text-[11px] font-bold bg-[var(--ds-bg-surface)] border border-[var(--ds-border)] text-[var(--ds-text-1)] focus:outline-none focus:ring-2 transition-all"
                  style={{ ['--tw-ring-color' as string]: accentColor }}
                />
              </div>
            </div>
          )}
          <div className="overflow-y-auto flex-1" style={{ maxHeight: 240 }}>
            <button
              onClick={() => { onChange(''); setOpen(false); setQuery('') }}
              className={`w-full flex items-center px-3 py-2.5 rounded-xl text-left text-[11px] font-bold transition-colors ${!value ? 'text-black' : 'text-[var(--ds-text-2)] hover:bg-[var(--ds-bg-raised)]'}`}
              style={!value ? { background: accentColor } : undefined}
            >
              {placeholder}
            </button>
            {filtered.map(o => (
              <button
                key={o.value}
                onClick={() => { onChange(o.value); setOpen(false); setQuery('') }}
                className={`w-full flex items-center px-3 py-2.5 rounded-xl text-left text-[11px] font-bold transition-colors truncate ${value === o.value ? 'text-black' : 'text-[var(--ds-text-2)] hover:bg-[var(--ds-bg-raised)]'}`}
                style={value === o.value ? { background: accentColor } : undefined}
              >
                {o.label}
              </button>
            ))}
            {filtered.length === 0 && (
              <p className="px-3 py-4 text-[10px] font-bold text-[var(--ds-text-4)] text-center">No matches</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
