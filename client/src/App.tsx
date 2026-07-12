import { lazy, Suspense } from 'react'
import { Routes, Route } from 'react-router-dom'
import MainLayout from './components/layout/MainLayout'
import LoginPage from './pages/LoginPage'
import ProtectedRoute from './components/auth/ProtectedRoute'
import NotificationPanel from './components/layout/NotificationPanel'
import NotificationToast from './components/layout/NotificationToast'
import WifiLoader from './components/ui/WifiLoader'
import { useBookingRealtime } from './hooks/useBookingRealtime'

// Route-level code splitting — each page (and its heavy deps: AdminPage pulls in nivo charts +
// exceljs + xlsx, SchedulePage pulls in jspdf) becomes its own chunk, loaded only when its route
// is visited, instead of everything landing in one ~3.5 MB first-paint bundle. LoginPage stays
// eager since it's the unauthenticated entry point and must render without a chunk fetch.
const TimelinePage      = lazy(() => import('./pages/TimelinePage'))
const SchedulePage      = lazy(() => import('./pages/SchedulePage'))
const AdminPage         = lazy(() => import('./pages/AdminPage'))
const ReceptionistPage  = lazy(() => import('./pages/ReceptionistPage'))
const RoomsPage         = lazy(() => import('./pages/RoomsPage'))
const KioskPage         = lazy(() => import('./pages/KioskPage'))
const PublicBookingPage = lazy(() => import('./pages/PublicBookingPage'))

function FullPageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--ds-bg-base)' }}>
      <WifiLoader />
    </div>
  )
}

function App() {
  useBookingRealtime()
  return (
    <>
    <NotificationPanel />
    <NotificationToast />
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/kiosk/:id" element={<Suspense fallback={<FullPageLoader />}><KioskPage /></Suspense>} />
      <Route path="/booking/:id" element={<Suspense fallback={<FullPageLoader />}><PublicBookingPage /></Suspense>} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <MainLayout>
              <TimelinePage />
            </MainLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/schedule"
        element={
          <ProtectedRoute>
            <MainLayout>
              <SchedulePage />
            </MainLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/rooms"
        element={
          <ProtectedRoute>
            <MainLayout>
              <RoomsPage />
            </MainLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin"
        element={
          <ProtectedRoute>
            <MainLayout>
              <AdminPage />
            </MainLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/receptionist"
        element={
          <ProtectedRoute>
            <MainLayout>
              <ReceptionistPage />
            </MainLayout>
          </ProtectedRoute>
        }
      />
    </Routes>
    </>
  )
}

export default App
