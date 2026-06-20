import { cn } from '@/lib/utils'

interface BackgroundProps {
  className?: string
  children?: React.ReactNode
}

export function YellowGlowBackground({ className, children }: BackgroundProps) {
  return (
    <div className={cn('min-h-screen w-full relative bg-white', className)}>
      <div
        className="absolute inset-0 z-0"
        style={{
          backgroundImage: `radial-gradient(circle at center, #FFF991 0%, transparent 70%)`,
          opacity: 0.6,
          mixBlendMode: 'multiply',
        }}
      />
      {children}
    </div>
  )
}

export function TealGlowBackground({ className, children }: BackgroundProps) {
  return (
    <div className={cn('min-h-screen w-full relative bg-white', className)}>
      <div
        className="absolute inset-0 z-0"
        style={{
          background: '#ffffff',
          backgroundImage: `radial-gradient(circle at top right, rgba(56, 193, 182, 0.5), transparent 70%)`,
          filter: 'blur(80px)',
          backgroundRepeat: 'no-repeat',
        }}
      />
      {children}
    </div>
  )
}

export default TealGlowBackground
