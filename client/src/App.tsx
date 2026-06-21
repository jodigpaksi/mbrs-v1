import { Routes, Route } from 'react-router-dom'
import MainLayout from './components/layout/MainLayout'
import TimelinePage from './pages/TimelinePage'
import SchedulePage from './pages/SchedulePage'
import AdminPage from './pages/AdminPage'
import RoomsPage from './pages/RoomsPage'
import LoginPage from './pages/LoginPage'
import ProtectedRoute from './components/auth/ProtectedRoute'
import NotificationPanel from './components/layout/NotificationPanel'
import NotificationToast from './components/layout/NotificationToast'
function App() {
  return (
    <>
    <NotificationPanel />
    <NotificationToast />
    <Routes>
      <Route path="/login" element={<LoginPage />} />
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
    </Routes>
    </>
  )
}

export default App
