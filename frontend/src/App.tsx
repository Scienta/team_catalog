import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { ProtectedRoute } from './components/ProtectedRoute'
import { Layout } from './components/Layout'
import { LoginPage } from './pages/LoginPage'
import { ConsultantListPage } from './pages/ConsultantListPage'
import { ConsultantDetailPage } from './pages/ConsultantDetailPage'
import { AdminsPage } from './pages/AdminsPage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Layout><ConsultantListPage /></Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/consultant/:id"
          element={
            <ProtectedRoute>
              <Layout><ConsultantDetailPage /></Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admins"
          element={
            <ProtectedRoute>
              <Layout><AdminsPage /></Layout>
            </ProtectedRoute>
          }
        />
      </Routes>
    </BrowserRouter>
  )
}
