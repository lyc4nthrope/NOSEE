import { s } from '../adminStyles';

export default function AdminSidebar({ navSections, activeSection, setActiveSection }) {
  return (
    <aside aria-label="Barra lateral de navegación" style={s.sidebar} className="admin-sidebar">
      <nav style={s.nav} className="admin-sidebar-nav">
        {navSections.map((item) => (
          <button
            key={item.key}
            style={{ ...s.navItem, ...(activeSection === item.key ? s.navActive : {}) }}
            onClick={() => setActiveSection(item.key)}
          >
            <span aria-hidden="true" style={s.navIcon}>{item.icon}</span>
            <span className="admin-nav-label">{item.label}</span>
            {item.badge > 0 && <span style={s.navBadge}>{item.badge}</span>}
          </button>
        ))}
      </nav>
    </aside>
  );
}
