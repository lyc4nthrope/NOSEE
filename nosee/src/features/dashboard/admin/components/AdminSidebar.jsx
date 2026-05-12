import { s } from '../adminStyles';
import { Icon } from '@/components/ui/Icon';
import { useAdminStore, selectActiveSection, selectSidebarCollapsed } from '../store/adminStore';

export default function AdminSidebar({ navSections }) {
  const activeSection = useAdminStore(selectActiveSection);
  const sidebarCollapsed = useAdminStore(selectSidebarCollapsed);
  const setActiveSection = useAdminStore((s) => s.setActiveSection);

  return (
    <aside aria-label="Barra lateral de navegación" style={{ ...s.sidebar, ...(sidebarCollapsed ? s.sidebarCollapsed : s.sidebarExpanded) }} className="admin-sidebar">
      <nav style={s.nav} className="admin-sidebar-nav">
        {navSections.map((item) => (
          <button
            key={item.key}
            style={{ ...s.navItem, ...(activeSection === item.key ? s.navActive : {}), ...(sidebarCollapsed ? s.navItemCollapsed : {}) }}
            onClick={() => setActiveSection(item.key)}
          >
            <Icon name={item.icon} />
            {!sidebarCollapsed && <span className="admin-nav-label">{item.label}</span>}
            {item.badge > 0 && !sidebarCollapsed && <span style={s.navBadge}>{item.badge}</span>}
          </button>
        ))}
      </nav>
      <button
        style={s.sidebarToggle}
        onClick={() => useAdminStore.getState().toggleSidebar()}
        aria-label={sidebarCollapsed ? 'Expandir barra lateral' : 'Contraer barra lateral'}
      >
        <Icon name={sidebarCollapsed ? 'ChevronRight' : 'ChevronLeft'} />
      </button>
    </aside>
  );
}
