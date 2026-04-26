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
import NurseryRFQs from './pages/NurseryRFQs'
import RFQNew from './pages/RFQNew'
import RFQList from './pages/RFQList'
import RFQDetail from './pages/RFQDetail'
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
            path="/nursery/rfq"
            element={
              <ProtectedRoute>
                <NurseryRFQs />
              </ProtectedRoute>
            }
          />
          <Route
            path="/rfq/new"
            element={
              <ProtectedRoute>
                <RFQNew />
              </ProtectedRoute>
            }
          />
          <Route
            path="/rfq/my"
            element={
              <ProtectedRoute>
                <RFQList />
              </ProtectedRoute>
            }
          />
          <Route
            path="/rfq/:id"
            element={
              <ProtectedRoute>
                <RFQDetail />
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
