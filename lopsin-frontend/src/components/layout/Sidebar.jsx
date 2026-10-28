import { NavLink } from 'react-router-dom'
import { NAV_CONFIG } from './navConfig'
import Logo from '../ui/Logo'

export default function Sidebar({ role, open, onNavigate }) {
  const sections = NAV_CONFIG[role] || []

  return (
    <aside className={`sidebar${open ? ' open' : ''}`}>
      <div className="sidebar-brand">
        <Logo size={26} />
        <div>
          <div className="sidebar-brand-text">Lopsin</div>
        </div>
      </div>
      <nav className="sidebar-nav">
        {sections.map((section) => (
          <div key={section.section}>
            <div className="sidebar-section-label">{section.section}</div>
            {section.links.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                onClick={onNavigate}
                className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}
              >
                <span className="sidebar-icon">{link.icon}</span>
                {link.label}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>
      <div className="sidebar-footer">
        <div className="text-muted" style={{ fontSize: 11.5, lineHeight: 1.6 }}>
          Zero-data-access mode
          <br />
          Telemetry and configuration only
        </div>
      </div>
    </aside>
  )
}
