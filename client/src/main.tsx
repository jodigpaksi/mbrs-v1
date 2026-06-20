import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from './context/AuthContext'
import { SettingsProvider } from './context/SettingsContext'
import { CancelToastProvider } from './context/CancelToastContext'
import './index.css'
import App from './App.tsx'

export const queryClient = new QueryClient()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        <SettingsProvider>
          <AuthProvider>
            <CancelToastProvider>
              <App />
            </CancelToastProvider>
          </AuthProvider>
        </SettingsProvider>
      </QueryClientProvider>
    </BrowserRouter>
  </StrictMode>,
)