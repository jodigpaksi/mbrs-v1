import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from './context/AuthContext'
import { SettingsProvider } from './context/SettingsContext'
import { CancelToastProvider } from './context/CancelToastContext'
import { SeriesProgressProvider } from './context/SeriesProgressContext'
import { NotificationProvider } from './context/NotificationContext'
import './index.css'
import App from './App.tsx'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime:       2 * 60_000,   // data fresh 2 menit — navigasi antar menu tidak refetch
      gcTime:         10 * 60_000,   // cache disimpan 10 menit setelah tidak dipakai
      retry:                    1,   // gagal → coba 1x lagi (default 3x, lambat)
      refetchOnWindowFocus:  false,  // tidak refetch tiap kali tab di-focus
    },
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <SettingsProvider>
            <NotificationProvider>
              <CancelToastProvider>
                <SeriesProgressProvider>
                  <App />
                </SeriesProgressProvider>
              </CancelToastProvider>
            </NotificationProvider>
          </SettingsProvider>
        </AuthProvider>
      </QueryClientProvider>
    </BrowserRouter>
  </StrictMode>,
)
