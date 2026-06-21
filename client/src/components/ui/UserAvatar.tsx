import { useState } from 'react'

interface Props {
  name: string
  avatar?: string | null
  size?: number
  className?: string
  style?: React.CSSProperties
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  return name.slice(0, 2).toUpperCase()
}

function colorFromName(name: string) {
  const palette = [
    ['#dbeafe','#1d4ed8'], ['#dcfce7','#15803d'], ['#fef9c3','#a16207'],
    ['#fce7f3','#be185d'], ['#ede9fe','#6d28d9'], ['#ffedd5','#c2410c'],
    ['#e0f2fe','#0369a1'], ['#f0fdf4','#166534'],
  ]
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffffffff
  const [bg, text] = palette[Math.abs(h) % palette.length]
  return { bg, text }
}

export default function UserAvatar({ name, avatar, size = 36, className = '', style }: Props) {
  const [imgErr, setImgErr] = useState(false)
  const isReal = !!avatar && (avatar.startsWith('http') || avatar.startsWith('/storage')) && !imgErr

  if (isReal) {
    return (
      <img
        src={avatar!}
        alt={name}
        className={className}
        style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, ...style }}
        onError={() => setImgErr(true)}
      />
    )
  }

  const { bg, text } = colorFromName(name)
  const fontSize = Math.round(size * 0.36)
  return (
    <div
      className={className}
      style={{
        width: size, height: size, borderRadius: '50%', flexShrink: 0,
        background: bg, color: text,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize, fontWeight: 900, letterSpacing: '-0.02em', userSelect: 'none',
        ...style,
      }}
    >
      {initials(name)}
    </div>
  )
}
