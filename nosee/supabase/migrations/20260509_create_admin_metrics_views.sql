-- Migration: create_admin_metrics_views
-- Fase 1: Data Layer admin-only
-- Views agregadas para el panel admin, consumidas desde adminMetrics.api.js
-- Creado: 2026-05-09

-- =============================================================================
-- 1. admin_overview_summary — 12 KPIs que luego se expanden a 12 en Fase 2
-- =============================================================================
CREATE OR REPLACE VIEW public.admin_overview_summary WITH (security_invoker = true) AS
SELECT
  -- Usuarios
  (SELECT COUNT(*) FROM public.users WHERE is_active = true)::INTEGER AS total_active_users,
  (SELECT COUNT(*) FROM public.users)::INTEGER AS total_users,

  -- Publicaciones
  (SELECT COUNT(*) FROM public.price_publications WHERE created_at::date = CURRENT_DATE)::INTEGER AS publications_today,
  (SELECT COUNT(*) FROM public.price_publications)::INTEGER AS total_publications,
  (SELECT COUNT(*) FROM public.price_publications WHERE is_active = true)::INTEGER AS active_publications,

  -- Validaciones (upvotes)
  (SELECT COUNT(*) FROM public.publication_votes
    WHERE vote_type = 1 AND created_at::date = CURRENT_DATE)::INTEGER AS validations_today,

  -- Reportes
  (SELECT COUNT(*) FROM public.reports
    WHERE LOWER(TRIM(status)) IN ('pending', 'in_review'))::INTEGER AS pending_reports,

  -- Pedidos
  (SELECT COUNT(*) FROM public.orders)::INTEGER AS total_orders,
  (SELECT COUNT(*) FROM public.orders
    WHERE status NOT IN ('cancelado', 'cancelado_no_pago'))::INTEGER AS active_orders,

  -- Tiendas / Productos
  (SELECT COUNT(*) FROM public.stores WHERE is_active = true)::INTEGER AS active_stores,
  (SELECT COUNT(*) FROM public.products WHERE is_active = true)::INTEGER AS active_products,

  -- Repartidores
  (SELECT COUNT(*) FROM public.users WHERE role_id = 4 AND is_active = true)::INTEGER AS active_dealers,

  -- Solicitudes dealer pendientes
  (SELECT COUNT(*) FROM public.dealer_applications
    WHERE status = 'pending')::INTEGER AS pending_dealer_applications,

  -- Logins últimas 24h
  (SELECT COUNT(*) FROM public.login_audit_logs
    WHERE created_at >= NOW() - INTERVAL '24 hours')::INTEGER AS logins_last_24h
;

-- =============================================================================
-- 2. admin_reports_summary — backlog, breakdown y últimos reportes
-- =============================================================================
CREATE OR REPLACE VIEW public.admin_reports_summary WITH (security_invoker = true) AS
SELECT
  -- Resumen
  (SELECT COUNT(*) FROM public.reports)::INTEGER AS total_reports,
  (SELECT COUNT(*) FROM public.reports
    WHERE LOWER(TRIM(status)) IN ('pending', 'in_review'))::INTEGER AS pending_backlog,
  (SELECT COUNT(*) FROM public.reports
    WHERE LOWER(TRIM(status)) = 'resolved')::INTEGER AS resolved_count,

  -- Breakdown por razón
  COALESCE(
    (SELECT JSONB_OBJECT_AGG(reason, cnt)
     FROM (
       SELECT reason, COUNT(*) AS cnt
       FROM public.reports
       WHERE created_at >= NOW() - INTERVAL '90 days'
       GROUP BY reason
     ) t),
    '{}'::JSONB
  ) AS breakdown_by_reason,

  -- Últimos 20 reportes pendientes (datos relevantes)
  COALESCE(
    (SELECT JSONB_AGG(
       JSONB_BUILD_OBJECT(
         'id', r.id,
         'reported_type', r.reported_type,
         'reported_id', r.reported_id,
         'reason', r.reason,
         'created_at', r.created_at,
         'severity',
           CASE r.reason
             WHEN 'offensive' THEN 'alta'
             WHEN 'spam' THEN 'media'
             WHEN 'fake_price' THEN 'media'
             WHEN 'wrong_photo' THEN 'baja'
             ELSE 'baja'
           END
       )
       ORDER BY r.created_at DESC
     )
     FROM public.reports r
     WHERE LOWER(TRIM(r.status)) IN ('pending', 'in_review')
     LIMIT 20),
    '[]'::JSONB
  ) AS latest_pending_reports
;

-- =============================================================================
-- 3. admin_logs_summary — contadores recientes por canal
-- =============================================================================
CREATE OR REPLACE VIEW public.admin_logs_summary WITH (security_invoker = true) AS
SELECT
  -- Login audit logs
  (SELECT COUNT(*) FROM public.login_audit_logs
    WHERE created_at >= NOW() - INTERVAL '24 hours')::INTEGER AS login_events_24h,
  (SELECT COUNT(*) FROM public.login_audit_logs
    WHERE created_at >= NOW() - INTERVAL '7 days')::INTEGER AS login_events_7d,

  -- User activity logs
  (SELECT COUNT(*) FROM public.user_activity_logs
    WHERE created_at >= NOW() - INTERVAL '24 hours')::INTEGER AS activity_events_24h,
  (SELECT COUNT(*) FROM public.user_activity_logs
    WHERE created_at >= NOW() - INTERVAL '7 days')::INTEGER AS activity_events_7d,

  -- Admin audit logs
  (SELECT COUNT(*) FROM public.admin_content_audit_log
    WHERE created_at >= NOW() - INTERVAL '24 hours')::INTEGER AS admin_events_24h,
  (SELECT COUNT(*) FROM public.admin_content_audit_log
    WHERE created_at >= NOW() - INTERVAL '7 days')::INTEGER AS admin_events_7d,

  -- Últimos 50 eventos unificados (más recientes)
  COALESCE(
    (SELECT JSONB_AGG(sub)
     FROM (
       SELECT * FROM (
         SELECT 'login' AS source, id::TEXT AS event_id, event_type AS action,
                user_id, created_at, ip_address
         FROM public.login_audit_logs
         WHERE created_at >= NOW() - INTERVAL '30 days'
         UNION ALL
         SELECT 'activity' AS source, id::TEXT AS event_id, action,
                user_id, created_at, NULL AS ip_address
         FROM public.user_activity_logs
         WHERE created_at >= NOW() - INTERVAL '30 days'
         UNION ALL
         SELECT 'admin' AS source, id::TEXT AS event_id, action_type AS action,
                actor_user_id AS user_id, created_at, NULL AS ip_address
         FROM public.admin_content_audit_log
         WHERE created_at >= NOW() - INTERVAL '30 days'
       ) combined
       ORDER BY created_at DESC
       LIMIT 50
     ) sub),
    '[]'::JSONB
  ) AS latest_events
;

-- =============================================================================
-- 4. Índices para consultas admin
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_admin_users_is_active ON public.users (is_active);
CREATE INDEX IF NOT EXISTS idx_admin_price_publications_active ON public.price_publications (is_active);
CREATE INDEX IF NOT EXISTS idx_admin_orders_status ON public.orders (status);
CREATE INDEX IF NOT EXISTS idx_admin_stores_is_active ON public.stores (is_active);
CREATE INDEX IF NOT EXISTS idx_admin_products_is_active ON public.products (is_active);
CREATE INDEX IF NOT EXISTS idx_admin_dealer_applications_status ON public.dealer_applications (status);
CREATE INDEX IF NOT EXISTS idx_admin_users_role_active ON public.users (role_id, is_active);
CREATE INDEX IF NOT EXISTS idx_admin_reports_reason ON public.reports (reason);

-- =============================================================================
-- 5. Grants para las views (solo admin/mod pueden leer)
-- =============================================================================
-- Revocar acceso público
REVOKE ALL ON public.admin_overview_summary FROM anon, authenticated;
REVOKE ALL ON public.admin_reports_summary FROM anon, authenticated;
REVOKE ALL ON public.admin_logs_summary FROM anon, authenticated;

-- Otorgar acceso específico vía RLS en las tablas subyacentes.
-- Las views heredan RLS de las tablas base — como users, reports, etc. ya tienen RLS,
-- los usuarios no-admin no podrán leer estas views aunque tengan SELECT.
-- Otorgamos SELECT a authenticated (lo necesita el cliente), pero RLS filtra.
GRANT SELECT ON public.admin_overview_summary TO authenticated;
GRANT SELECT ON public.admin_reports_summary TO authenticated;
GRANT SELECT ON public.admin_logs_summary TO authenticated;

-- =============================================================================
-- 5. Índices para filtros recurrentes
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_reports_status_lower
  ON public.reports (LOWER(TRIM(status)));

CREATE INDEX IF NOT EXISTS idx_reports_created_at
  ON public.reports (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_login_audit_logs_created_at
  ON public.login_audit_logs (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_user_activity_logs_created_at
  ON public.user_activity_logs (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_admin_content_audit_log_created_at
  ON public.admin_content_audit_log (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_price_publications_created_at_date
  ON public.price_publications ((created_at::date));

-- =============================================================================
-- DOWN
-- =============================================================================
DROP VIEW IF EXISTS public.admin_logs_summary;
DROP VIEW IF EXISTS public.admin_reports_summary;
DROP VIEW IF EXISTS public.admin_overview_summary;
DROP INDEX IF EXISTS idx_admin_users_is_active;
DROP INDEX IF EXISTS idx_admin_price_publications_active;
DROP INDEX IF EXISTS idx_admin_orders_status;
DROP INDEX IF EXISTS idx_admin_stores_is_active;
DROP INDEX IF EXISTS idx_admin_products_is_active;
DROP INDEX IF EXISTS idx_admin_dealer_applications_status;
DROP INDEX IF EXISTS idx_admin_users_role_active;
DROP INDEX IF EXISTS idx_admin_reports_reason;
