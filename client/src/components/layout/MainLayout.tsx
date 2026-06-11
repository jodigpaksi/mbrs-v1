import { ReactNode } from 'react'
import Navbar from './Navbar'
import AiAgentFab from '../ai/AiAgentFab'

interface MainLayoutProps {
  children: ReactNode
}

export default function MainLayout({ children }: MainLayoutProps) {
  return (
    <div className="flex flex-col h-screen overflow-hidden antialiased" style={{ background: 'var(--ds-bg-base)', color: 'var(--ds-text-1)' }}>
      <Navbar />
      <main className="flex-1 overflow-hidden flex flex-col">
        {children}
      </main>
      <AiAgentFab />
    </div>
  )
}
