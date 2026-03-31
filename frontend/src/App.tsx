import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { ProtectedRoute } from './components/ProtectedRoute'
import { Layout } from './components/Layout'
import { LoginPage } from './pages/LoginPage'
import { DashboardPage } from './pages/DashboardPage'
import { BoardPage, BoardClientPage } from './pages/BoardPage'
import { ConsultantListPage } from './pages/ConsultantListPage'
import { ConsultantDetailPage } from './pages/ConsultantDetailPage'
import { AdminsPage } from './pages/AdminsPage'
import { ClientsPage } from './pages/ClientsPage'
import { ClientDetailPage } from './pages/ClientDetailPage'
import { TimelinePage } from './pages/TimelinePage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<ProtectedRoute><Layout><DashboardPage /></Layout></ProtectedRoute>} />
        <Route
          path="/consultants"
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
        <Route path="/board" element={<ProtectedRoute><Layout><BoardPage /></Layout></ProtectedRoute>} />
        <Route path="/board/:clientId" element={<ProtectedRoute><Layout><BoardClientPage /></Layout></ProtectedRoute>} />
        <Route path="/timeline" element={<ProtectedRoute><Layout><TimelinePage /></Layout></ProtectedRoute>} />
        <Route path="/clients" element={<ProtectedRoute><Layout><ClientsPage /></Layout></ProtectedRoute>} />
        <Route path="/clients/:id" element={<ProtectedRoute><Layout><ClientDetailPage /></Layout></ProtectedRoute>} />
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
