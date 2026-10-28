import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import ProtectedRoute from './components/ProtectedRoute'
import Landing from './pages/public/Landing'
import Login from './pages/Login'

/**
 * The console is code-split away from the marketing site. Recharts and the console
 * pages are a large share of the bundle, and a first-time visitor reading the
 * landing page should not pay for them.
 */
const Layout = lazy(() => import('./components/layout/Layout'))
const Dashboard = lazy(() => import('./pages/Dashboard'))
const Findings = lazy(() => import('./pages/compliance/Findings'))
const Frameworks = lazy(() => import('./pages/compliance/Frameworks'))
const Remediation = lazy(() => import('./pages/compliance/Remediation'))
const Evidence = lazy(() => import('./pages/compliance/Evidence'))
const Agents = lazy(() => import('./pages/admin/Agents'))
const Integrations = lazy(() => import('./pages/admin/Integrations'))
const Users = lazy(() => import('./pages/admin/Users'))
const Readiness = lazy(() => import('./pages/auditor/Readiness'))
const AuditLog = lazy(() => import('./pages/auditor/AuditLog'))

const ALL_ROLES = ['ADMIN', 'COMPLIANCE', 'AUDITOR']
const STAFF = ['ADMIN', 'COMPLIANCE']

const Loading = () => <div className="spinner-row">Loading console...</div>

export default function App() {
  return (
    <Suspense fallback={<Loading />}>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />

        <Route
          path="/app"
          element={
            <ProtectedRoute allowedRoles={ALL_ROLES}>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/app/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="findings" element={<Findings />} />
          <Route path="frameworks" element={<Frameworks />} />
          <Route path="evidence" element={<Evidence />} />
          <Route path="readiness" element={<Readiness />} />
          <Route path="audit-log" element={<AuditLog />} />

          <Route
            path="remediation"
            element={<ProtectedRoute allowedRoles={STAFF}><Remediation /></ProtectedRoute>}
          />
          <Route
            path="agents"
            element={<ProtectedRoute allowedRoles={['ADMIN']}><Agents /></ProtectedRoute>}
          />
          <Route
            path="integrations"
            element={<ProtectedRoute allowedRoles={['ADMIN']}><Integrations /></ProtectedRoute>}
          />
          <Route
            path="users"
            element={<ProtectedRoute allowedRoles={['ADMIN']}><Users /></ProtectedRoute>}
          />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  )
}
