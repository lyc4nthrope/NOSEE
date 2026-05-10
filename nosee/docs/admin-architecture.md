# Panel Admin — Arquitectura

## Ubicación
`src/features/dashboard/admin/` — feature completa autocontenida.

## Capas

```
Components (JSX)  →  Hooks  →  API Layer  →  Supabase RPCs
     ↓                  ↓            ↓              ↓
   Render            Estado      Queries        Server-side
   UI puro          Lógica      Supabase       Lógica BD
```

## Flujo de Datos
1. Componentes llaman hooks (`loadUsers`, `loadReports`, etc.)
2. Hooks orquestan estado (loading, error, data) y llaman a API layer
3. API layer ejecuta queries Supabase (`select`, `rpc`, etc.)
4. RPCs ejecutan lógica server-side en PostgreSQL

## Componentes (21 archivos .jsx)

### Dashboard
- `AdminDashboard.jsx` (284 líneas) — orquestador principal, lazy loads OverviewPanel, OrdersPanel, SettingsPanel
- `AdminSidebar.jsx` — navegación lateral con badges de reportes/solicitudes pendientes

### Paneles
- `OverviewPanel.jsx` — KPIs y métricas (lazy)
- `OrdersPanel.jsx` — órdenes y pagos (lazy)
- `SettingsPanel.jsx` — configuración del sistema (lazy)
- `CatalogPanel.jsx` — gestión de catálogo
- `LogsPanel.jsx` — resumen de logs
- `ReportsPanel.jsx` — resumen de reportes

### Secciones (Section wrappers)
- `AdminUsersSection.jsx`
- `AdminContentSection.jsx`
- `AdminCatalogSection.jsx`
- `AdminReportsSection.jsx`
- `AdminLogsSection.jsx`
- `AdminDealersSection.jsx`
- `AdminPanelSection.jsx` — wrapper genérico (Overview, Orders, Settings)
- `AdminModalsSection.jsx` — renderiza banModal + confirmModal

### Tablas (4)
- `UsersTable.jsx`
- `PublicationsTable.jsx`
- `UnpublishedResourcesTable.jsx`
- `DealerApplicationsTable.jsx`

### Modales (6)
- `BanModal.jsx`
- `ReportDetailsModal.jsx`
- `ProductDetailModal.jsx`
- `StoreDetailModal.jsx`
- `BrandDetailModal.jsx`
- `PublicationDetailModal.jsx`

### UI Primitivas
- `KpiCard.jsx`
- `ConfirmModal.jsx`
- `SummaryCard.jsx`
- `ReportCard.jsx`
- `AdminLogTable.jsx`
- `AdminPrimitives.jsx`

## Hooks (9)

| Hook | Propósito |
|------|-----------|
| `useAdminUsers` | CRUD usuarios, cambio de rol, ban/unban |
| `useAdminPublications` | Publicaciones, filtros, CRUD, recursos no publicados |
| `useAdminReports` | Reportes, filtros, sorting, acciones rápidas |
| `useAdminLogs` | Logs de acceso, actividad, admin; filtros por fecha/categoría |
| `useAdminDealers` | Solicitudes de repartidor (aprobar/rechazar) |
| `useAdminCategories` | Categorías de productos + parámetros de reputación |
| `useAdminConfirmHandlers` | Handlers de confirmación para ocultar/eliminar |
| `useAdminSessionTimeout` | Cierre de sesión por inactividad |
| `useFocusTrap` | Foco en modales accesibles |

## API Layer (4 archivos, 33 funciones)

| Archivo | Funciones | Propósito |
|---------|-----------|-----------|
| `adminCatalog.api.js` | 24 | Productos, tiendas, marcas, publicaciones, categorías |
| `adminOrders.api.js` | 2 | Órdenes y pagos |
| `adminMetrics.api.js` | 3 | KPIs desde views (overview, reports, logs) |
| `adminConfig.api.js` | 4 | Configuración de reputación + categorías |

## Archivos de Soporte

- `adminStyles.js` — objetos de estilo JS (inline styles)
- `adminConstants.js` — constantes, enums, helpers de formato
- `adminUtils.js` — hooks de formateo de fechas según locale
- `logHelpers.js` — helpers para parsear/describir eventos de log

## Decisiones Arquitectónicas Clave

1. **Componentes NO llaman Supabase directo** — clean architecture, los hooks abstraen
2. **RPCs reemplazan hydration client-side** — `get_admin_reports_detail` eliminó 6 queries paralelas del frontend
3. **SECURITY INVOKER hereda RLS** — las RPCs ejecutan con permisos del usuario autenticado
4. **Cache in-memory con TTL + pendingQueue** — evita thundering herd en métricas y config
5. **Barrel files eliminados** — imports directos para tree-shaking
6. **Sistema i18n custom** — LanguageContext, sin react-i18next
7. **Lazy loading** — OverviewPanel, OrdersPanel, SettingsPanel con `React.lazy`
8. **Sin TypeScript** — proyecto JS puro con JSDoc para documentación de tipos
