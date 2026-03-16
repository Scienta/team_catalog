import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { ProtectedRoute } from './components/ProtectedRoute'
import { LoginPage } from './pages/LoginPage'

function ConsultantListPage() {
  return <div>Consultant List</div>
}

function ConsultantDetailPage() {
  return <div>Consultant Detail</div>
}

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
