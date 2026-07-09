interface ToggleSwitchProps {
  checked: boolean
  onChange: () => void
  onColor?: string
  disabled?: boolean
  title?: string
}

/** Shared 44x24 pill toggle switch — matches the markup repeated throughout AdminPage.tsx's Settings tab. */
export default function ToggleSwitch({ checked, onChange, onColor = '#adee2b', disabled = false, title }: ToggleSwitchProps) {
  return (
    <button type="button" onClick={onChange} disabled={disabled} title={title}
      className="relative shrink-0 disabled:opacity-40" style={{ width: 44, height: 24 }}>
      <div className="absolute inset-0 rounded-full transition-colors" style={{ background: checked ? onColor : 'var(--ds-bg-raised)' }} />
      <div className="absolute top-1 transition-all rounded-full shadow-sm" style={{ width: 16, height: 16, left: checked ? 24 : 4, background: 'var(--ds-bg-surface)' }} />
    </button>
  )
}
