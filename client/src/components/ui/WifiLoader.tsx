import type { CSSProperties } from 'react'

interface Props {
  text?: string
  textColor?: string
}

export default function WifiLoader({ text = '', textColor }: Props) {
  return (
    <div className="wifi-loader" style={textColor ? ({ '--wifi-text': textColor } as CSSProperties) : undefined}>
      <svg viewBox="0 0 86 86" className="circle-outer">
        <circle r={40} cy={43} cx={43} className="back" />
        <circle r={40} cy={43} cx={43} className="front" />
      </svg>
      <svg viewBox="0 0 60 60" className="circle-middle">
        <circle r={27} cy={30} cx={30} className="back" />
        <circle r={27} cy={30} cx={30} className="front" />
      </svg>
      {text && <div data-text={text} className="text" />}
    </div>
  )
}
