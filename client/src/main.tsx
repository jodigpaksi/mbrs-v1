import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from './context/AuthContext'
import { SettingsProvider } from './context/SettingsContext'
import { CancelToastProvider } from './context/CancelToastContext'
import { NotificationProvider } from './context/NotificationContext'
import './index.css'
import App from './App.tsx'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime:            30_000,   // data dianggap fresh 30 detik — tidak refetch ulang
      gcTime:          5 * 60_000,   // cache disimpan 5 menit setelah tidak dipakai
      retry:                    1,   // gagal → coba 1x lagi (default 3x, lambat)
      refetchOnWindowFocus:  false,  // tidak refetch tiap kali tab di-focus
    },
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        <SettingsProvider>
          <AuthProvider>
            <NotificationProvider>
              <CancelToastProvider>
                <App />
              </CancelToastProvider>
            </NotificationProvider>
          </AuthProvider>
        </SettingsProvider>
      </QueryClientProvider>
    </BrowserRouter>
  </StrictMode>,
)