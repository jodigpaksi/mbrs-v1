import { ReactNode } from 'react'
import Navbar from './Navbar'
import AiAgentFab from '../ai/AiAgentFab'

interface MainLayoutProps {
  children: ReactNode
}

export default function MainLayout({ children }: MainLayoutProps) {
  return (
    <div className="flex flex-col h-screen overflow-hidden bg-[#f7f8f6] text-slate-900 antialiased">
      <Navbar />
      <main className="flex-1 overflow-hidden flex flex-col">
        {children}
      </main>
      <AiAgentFab />
    </div>
  )
}
