import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { ProtectedRoute } from './components/ProtectedRoute'
import { LoginPage } from './pages/LoginPage'
import { ConsultantListPage } from './pages/ConsultantListPage'
import { ConsultantDetailPage } from './pages/ConsultantDetailPage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <ConsultantListPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/consultant/:id"
          element={
            <ProtectedRoute>
              <ConsultantDetailPage />
            </ProtectedRoute>
          }
        />
      </Routes>
    </BrowserRouter>
  )
}
