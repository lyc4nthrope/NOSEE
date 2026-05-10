# Migraciones del Panel Admin

## Orden de ejecución (importante)
El orden está garantizado por el prefijo alfabético del nombre del archivo. Las migrations del panel admin se ejecutan después de las migrations existentes (202603xx, 202604xx).

### `20260509_create_admin_audit_tables.sql` (P0)
**Propósito**: Tablas de auditoría faltantes (existían en código, no en migrations)
- Crea `admin_content_audit_log` con RLS (select/insert para admin/mod, append-only)
- Crea `login_audit_logs` con RLS (permite INSERT anon para login fallido, select admin/mod)
- Índices: actor_user_id, resource_type+resource_id, action_type en audit_log; user_id, event_type en login_logs
- Nota: debe ejecutarse ANTES que `20260509_create_admin_metrics_views.sql` (las views referencian estas tablas)

### `20260509_create_admin_metrics_views.sql` (existente, no nuestra)
- Crea vistas `admin_overview_summary` (12 KPIs), `admin_reports_summary` (backlog + breakdown), `admin_logs_summary` (conteos 24h/7d + últimos 50 eventos)
- Crea índices en users, price_publications, orders, stores, products, dealer_applications, reports, login_audit_logs, user_activity_logs, admin_content_audit_log
- Grants: SELECT a authenticated (RLS filtra en tablas base)

### `20260510_enable_rls_reports.sql` (P1)
**Propósito**: Seguridad en tabla `reports` (gap crítico, no tenía RLS desde el schema inicial)
- `ALTER TABLE reports ENABLE ROW LEVEL SECURITY`
- 6 políticas:
  - `admin_mod_select_reports` — admins/moderadores activos pueden SELECT todos los reportes
  - `user_select_own_reports` — usuarios pueden SELECT solo sus propios reportes
  - `user_insert_reports` — usuarios pueden INSERT con `reporter_user_id = auth.uid()`
  - `user_update_own_reports` — usuarios pueden UPDATE sus propios reportes
  - `admin_mod_update_reports` — admins/moderadores pueden UPDATE cualquier reporte
  - `user_delete_own_reports` — usuarios pueden DELETE sus propios reportes

### `20260511_create_missing_rpcs.sql` (P2)
**Propósito**: Versionar RPCs que solo existían en schema inicial (se perderían con un `db reset`)
- Crea tabla `reputation_history` con RLS y 2 políticas (select admin/mod, insert authenticated)
- `increment_user_reputation(target_user_id UUID, reputation_delta INT)` → VOLATILE, SECURITY INVOKER
- `delete_own_report(p_report_id UUID)` → VOLATILE, SECURITY INVOKER
- `get_public_user_ranking(p_limit INT DEFAULT 10)` → STABLE, SECURITY INVOKER
- `hide_my_account()` → VOLATILE, SECURITY INVOKER

### `20260512_create_admin_reports_detail_rpc.sql` (P3)
**Propósito**: Reemplazar hydration client-side de reports (7 queries → 1 RPC)
- `get_admin_reports_detail(p_page INT DEFAULT 1, p_page_size INT DEFAULT 20)`
- Retorna reports con target resuelto según `reported_type` (publication, user, store, product, brand, comment)
- Incluye `reporter_name`, `reviewer_name`, `reported_name`, `target` (JSONB), `total_count`
- SECURITY INVOKER hereda RLS de reports (solo admin/mod pueden SELECT)
- Grants: solo authenticated

## Resumen

| Archivo | Prioridad | Tipo |
|---------|-----------|------|
| `20260509_create_admin_audit_tables.sql` | P0 | Tablas + RLS |
| `20260509_create_admin_metrics_views.sql` | P0 (existente) | Views + índices |
| `20260510_enable_rls_reports.sql` | P1 | RLS |
| `20260511_create_missing_rpcs.sql` | P2 | RPCs + tabla |
| `20260512_create_admin_reports_detail_rpc.sql` | P3 | RPC |
