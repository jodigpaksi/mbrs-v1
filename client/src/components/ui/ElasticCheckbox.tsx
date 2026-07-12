import type { CSSProperties, ReactNode } from 'react'

interface Props {
  checked: boolean
  onChange: (checked: boolean) => void
  color?: string
  className?: string
  children?: ReactNode
}

export default function ElasticCheckbox({ checked, onChange, color, className, children }: Props) {
  return (
    <label
      className={`elastic-checkbox-label ${className ?? ''}`}
      style={color ? ({ '--ec-primary': color } as CSSProperties) : undefined}
    >
      <input type="checkbox" className="elastic-input" checked={checked} onChange={e => onChange(e.target.checked)} />
      <div className="elastic-box">
        <svg className="elastic-checkmark" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </div>
      {children}
    </label>
  )
}
