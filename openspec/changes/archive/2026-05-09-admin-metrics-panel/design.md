# Design: Admin Metrics Panel

## Technical Approach
Implementar el MVP como una capa de agregación admin-only en Supabase + un módulo `adminMetrics.api.js` + extracción mínima de secciones del dashboard. La meta NO es rehacer todo `AdminDashboard.jsx`, sino sacar de ahí overview/reportes/logs y reemplazar las queries inline por contratos claros.

## Architecture Decisions

| Decision | Choice | Alternatives considered | Rationale |
|---|---|---|---|
| Data aggregation | Views/RPCs admin-only en Supabase | Seguir con `Promise.all` desde React | Reduce acoplamiento, mejora seguridad y evita duplicar `getAdminOverviewStats()` |
| Frontend API boundary | Crear `nosee/src/services/api/adminMetrics.api.js` | Engordar `users.api.js` | Separa concerns: usuarios ≠ analytics/admin aggregates |
| MVP scope | Solo overview + reportes/moderación + logs clave | Incluir catálogo, órdenes, pagos, settings | Mantiene cambio implementable y alineado al contexto validado |
| Dashboard refactor strategy | Extraer secciones MVP a componentes hijos | Reescribir el dashboard completo | Minimiza riesgo en un archivo hoy monolítico |
| Observability split | `monitoring/*` queda separado | Embutir Prometheus/Grafana en admin | Evita mezclar métricas de producto con telemetría operativa |

## Data Flow

```text
AdminDashboard
  -> OverviewPanel / ReportsPanel / LogsPanel
      -> adminMetrics.api.js
          -> Supabase view/RPC admin_*
              -> tables: users, price_publications, publication_votes, reports,
                         dealer_applications, login_audit_logs,
                         user_activity_logs, admin_content_audit_log
```

### Sequence
```text
Admin opens /dashboard/admin
  -> section panel mounts
  -> panel calls adminMetrics.api.js
  -> API invokes admin-only view/RPC
  -> Supabase returns aggregated payload
  -> panel renders KPI cards / summaries / tables
```

## File Changes

| File | Action | Description |
|---|---|---|
| `openspec/changes/admin-metrics-panel/*` | Create | Artefactos SDD de este cambio |
| `nosee/src/services/api/adminMetrics.api.js` | Create | Contratos de overview, reports summary y logs summary |
| `nosee/src/services/api/users.api.js` | Modify | Quitar duplicación o dejar `getAdminOverviewStats()` como wrapper temporal |
| `nosee/src/features/dashboard/admin/AdminDashboard.jsx` | Modify | Delegar tabs MVP a componentes y dejar de consultar tablas inline |
| `nosee/src/features/dashboard/admin/components/OverviewPanel.jsx` | Create | KPIs overview + estados de carga/error |
| `nosee/src/features/dashboard/admin/components/ReportsPanel.jsx` | Create | Backlog de reportes + breakdown |
| `nosee/src/features/dashboard/admin/components/LogsPanel.jsx` | Create | Resumen de logs clave |
| `nosee/supabase/migrations/*admin_metrics*.sql` | Create | Views/RPCs, grants y cualquier índice necesario |

## Interfaces / Contracts

```js
// nosee/src/services/api/adminMetrics.api.js
export async function getAdminOverviewMetrics()
export async function getAdminReportsMetrics()
export async function getAdminLogsMetrics()
```

```ts
type AdminOverviewMetrics = {
  totalUsers: number
  publicationsToday: number
  validationsToday: number
  pendingReports: number
  pendingDealerApplications: number
  loginsLast24h: number
}
```

Supabase contract:
- `admin_overview_summary`: una fila con los 6 KPIs.
- `admin_reports_summary`: backlog, resolved count, breakdown por reason/status y últimos reportes.
- `admin_logs_summary`: contadores recientes + últimos eventos por canal.

## Postgres / Supabase Notes
- Preferir agregados server-side para evitar scans repetidos desde el cliente.
- Si hay filtros por status/created_at recurrentes, agregar índices específicos en migración.
- Evitar `SECURITY DEFINER` salvo necesidad real; si se usa RPC, documentar grants explícitos solo para admins.

## Testing Strategy

| Layer | What to Test | Approach |
|---|---|---|
| Unit | Mappers y fallback states de `adminMetrics.api.js`/panels | Vitest |
| Integration | `AdminDashboard` consume paneles MVP y deja de hacer queries inline | Testing Library con mocks |
| Integration | Contratos Supabase admin-only | SQL/manual verification against policies |

## Migration / Rollout
No migration de datos. Sí migración de acceso: agregar views/RPCs admin-only y reemplazar el wiring del overview/reportes/logs sin tocar `monitoring/*`.

## Open Questions
- [ ] Confirmar el nombre real de la tabla de solicitudes dealer en la implementación (`dealer_applications` vs `dealer_requests`) antes de escribir la migración final.
