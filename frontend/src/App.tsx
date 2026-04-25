import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './hooks/useAuth'
import ProtectedRoute from './components/ProtectedRoute'
import AdminRoute from './components/AdminRoute'
import Landing from './pages/Landing'
import Login from './pages/Login'
import Signup from './pages/Signup'
import Chat from './pages/Chat'
import Explore from './pages/Explore'
import Nurseries from './pages/Nurseries'
import NurseryDetail from './pages/NurseryDetail'
import NurserySignup from './pages/NurserySignup'
import NurseryDashboard from './pages/NurseryDashboard'
import Curation from './pages/admin/Curation'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/explore" element={<Explore />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route
            path="/chat"
            element={
              <ProtectedRoute>
                <Chat />
              </ProtectedRoute>
            }
          />
          <Route path="/nurseries" element={<Nurseries />} />
          <Route path="/nurseries/:slug" element={<NurseryDetail />} />
          <Route
            path="/nursery/signup"
            element={
              <ProtectedRoute>
                <NurserySignup />
              </ProtectedRoute>
            }
          />
          <Route
            path="/nursery/dashboard"
            element={
              <ProtectedRoute>
                <NurseryDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/curation"
            element={
              <AdminRoute>
                <Curation />
              </AdminRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
