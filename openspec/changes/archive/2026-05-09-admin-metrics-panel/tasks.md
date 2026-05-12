# Tasks: Admin Metrics Panel

## Phase 1: Data Layer Admin-only

- [ ] 1.1 Crear migración `nosee/supabase/migrations/*admin_metrics*.sql` con `admin_overview_summary`, `admin_reports_summary` y `admin_logs_summary`, más grants solo admin.
- [ ] 1.2 En la misma migración, agregar índices para filtros recurrentes de `reports.status`, `reports.created_at` y logs por `created_at` si faltan.
- [ ] 1.3 Crear `nosee/src/services/api/adminMetrics.api.js` con `getAdminOverviewMetrics`, `getAdminReportsMetrics` y `getAdminLogsMetrics`.
- [ ] 1.4 Ajustar `nosee/src/services/api/users.api.js` para eliminar la duplicación de `getAdminOverviewStats()` o convertirla en wrapper temporal hacia la nueva API.

## Phase 2: Admin Dashboard MVP Wiring

- [ ] 2.1 Crear `nosee/src/features/dashboard/admin/components/OverviewPanel.jsx` para renderizar los 6 KPIs MVP y fallback states.
- [ ] 2.2 Crear `nosee/src/features/dashboard/admin/components/ReportsPanel.jsx` con backlog, breakdown y últimos reportes accionables.
- [ ] 2.3 Crear `nosee/src/features/dashboard/admin/components/LogsPanel.jsx` con resumen de `login_audit_logs`, `user_activity_logs` y `admin_content_audit_log`.
- [ ] 2.4 Modificar `nosee/src/features/dashboard/admin/AdminDashboard.jsx` para delegar `overview`, `reports` y `logs` a los nuevos paneles.
- [ ] 2.5 Mantener `content`, `users`, `dealers` y `config` sin rediseño funcional en este cambio.

## Phase 3: Verification

- [ ] 3.1 Agregar pruebas unitarias de `adminMetrics.api.js` cubriendo payload válido, acceso denegado y fallback parcial.
- [ ] 3.2 Agregar pruebas de UI para `OverviewPanel`, `ReportsPanel` y `LogsPanel` validando loading/error/render.
- [ ] 3.3 Verificar que `AdminDashboard.jsx` ya no ejecute agregados Supabase inline para overview/reportes/logs.
- [ ] 3.4 Verificar manualmente que `monitoring/*` no fue modificado ni acoplado al panel admin.

## Phase 4: Handoff / Cleanup

- [ ] 4.1 Documentar en el PR los 6 KPIs MVP y la frontera explícita entre admin metrics y observabilidad operativa.
- [ ] 4.2 Registrar cualquier diferencia real de schema detectada durante implementación y reconciliarla con este OpenSpec antes de continuar a nuevas tabs.
