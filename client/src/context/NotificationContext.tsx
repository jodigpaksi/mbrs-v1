import { createContext, useContext, useState, type ReactNode } from 'react'

interface NotificationContextValue {
  open: boolean
  openNotifications: () => void
  closeNotifications: () => void
}

const NotificationContext = createContext<NotificationContextValue | null>(null)

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)

  return (
    <NotificationContext.Provider value={{
      open,
      openNotifications: () => setOpen(true),
      closeNotifications: () => setOpen(false),
    }}>
      {children}
    </NotificationContext.Provider>
  )
}

export function useNotification() {
  const ctx = useContext(NotificationContext)
  if (!ctx) throw new Error('useNotification must be used within NotificationProvider')
  return ctx
}
