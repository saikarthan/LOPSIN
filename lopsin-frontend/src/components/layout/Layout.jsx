import { useState } from 'react'
import { Outlet, useLocation, Link } from 'react-router-dom'
import Sidebar from './Sidebar'
import { useAuth } from '../../context/AuthContext'

const TITLES = {
  '/app/dashboard': 'Posture Dashboard',
  '/app/findings': 'Findings',
  '/app/frameworks': 'Frameworks & Controls',
  '/app/agents': 'Agents',
  '/app/integrations': 'Integrations',
  '/app/remediation': 'Remediation',
  '/app/evidence': 'Evidence Register',
  '/app/readiness': 'Audit Readiness',
  '/app/users': 'Team Access',
  '/app/audit-log': 'Activity Log',
}

export default function Layout() {
  const { user, logout } = useAuth()
  const location = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)

  const title =
    TITLES[location.pathname] ||
    (location.pathname.startsWith('/app/frameworks/') ? 'Framework Detail' : 'Lopsin Console')

  return (
    <div className="app-shell">
      <Sidebar role={user.role} open={menuOpen} onNavigate={() => setMenuOpen(false)} />
      {menuOpen && <div className="sidebar-backdrop" onClick={() => setMenuOpen(false)} />}
      <div className="main-area">
        <header className="topbar">
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <button
              className="sidebar-toggle"
              onClick={() => setMenuOpen((open) => !open)}
              aria-label="Toggle navigation"
            >
              ☰
            </button>
            <div className="topbar-title">{title}</div>
          </div>
          <div className="topbar-user">
            <span className="topbar-user-badge">{user.role}</span>
            <span className="text-muted">{user.orgName}</span>
            <span>{user.fullName || user.email}</span>
            <Link className="btn btn-outline btn-sm" to="/">Site</Link>
            <button className="btn btn-outline btn-sm" onClick={logout}>Sign out</button>
          </div>
        </header>
        <main className="page-content">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
