# Proposal: Admin Metrics Panel

## Intent
El panel admin actual en `nosee/src/features/dashboard/admin/AdminDashboard.jsx` está demasiado acoplado: mezcla UI, consultas Supabase inline y operación manual. Además duplica `getAdminOverviewStats()` sin usar la capa API ya existente. Este cambio formaliza un MVP de métricas admin que prioriza seguridad, mantenibilidad y decisiones server-side antes de tocar más UI.

## Scope

### In Scope
- Crear una capa de datos admin-only para overview, moderación/reportes y logs clave.
- Reorganizar el panel admin para que `overview`, `reports` y `logs` consuman agregados dedicados.
- Separar explícitamente observabilidad operativa de `nosee/monitoring/*` del panel funcional admin.

### Out of Scope
- Catálogo, órdenes/pagos, oportunidades y settings persistentes.
- Reemplazo completo del `AdminDashboard` monolítico en un solo cambio.
- Nuevos dashboards Grafana/Prometheus o analytics conductual fino.

## Approach
1. Introducir agregados admin en Supabase (views/RPCs) consumidos desde `src/services/api/adminMetrics.api.js`.
2. Reutilizar `getAdminOverviewStats()` solo como compatibilidad temporal o absorberlo en la nueva API.
3. Extraer secciones MVP del dashboard a componentes pequeños con loading/error propios.

## Affected Areas
| Area | Impact | Description |
|------|--------|-------------|
| `nosee/src/features/dashboard/admin/AdminDashboard.jsx` | Modified | Dejar de resolver métricas inline y delegar tabs MVP |
| `nosee/src/features/dashboard/admin/components/` | New/Modified | Cards, panels y tablas de overview/reportes/logs |
| `nosee/src/services/api/` | New/Modified | Nueva API admin-only para agregados |
| `nosee/supabase/migrations/` | New | Views/RPCs admin-only + grants/policies |
| `nosee/monitoring/*` | Unchanged | Queda fuera del panel funcional |

## Risks
| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Exponer datos admin vía queries frontend directas | High | Mover agregación a views/RPCs con control de acceso |
| Mezclar observabilidad operativa con métricas funcionales | Med | Mantener frontera explícita `monitoring/*` vs admin dashboard |
| Seguir ampliando el componente monolítico | High | Extraer solo MVP a módulos concretos |

## Rollback Plan
Revertir el cambio removiendo la nueva API/admin views y volviendo temporalmente al overview inline actual. No requiere rollback de `monitoring/*`.

## Dependencies
- Supabase con capacidad para crear views/RPCs y revisar grants/RLS.
- Tablas ya existentes: `users`, `price_publications`, `publication_votes`, `reports`, `admin_content_audit_log`, `login_audit_logs`, `user_activity_logs`.

## Success Criteria
- [ ] El MVP del panel usa agregados admin-only en vez de consultas inline en `AdminDashboard.jsx`.
- [ ] Overview muestra KPIs y resúmenes de moderación/logs sin leer tablas crudas desde la UI.
- [ ] La documentación del cambio deja cerradas las decisiones críticas para implementación.
