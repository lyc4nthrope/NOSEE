-- Migration: create_admin_audit_tables
-- Crea tablas de auditoría faltantes: admin_content_audit_log, login_audit_logs
-- NOTA: Debe ejecutarse ANTES que create_admin_metrics_views (las views referencian estas tablas)
-- Creado: 2026-05-09

-- =============================================================================
-- 1. admin_content_audit_log
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.admin_content_audit_log (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  actor_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  resource_type TEXT NOT NULL,
  resource_id   TEXT NOT NULL,
  action_type   TEXT NOT NULL,
  reason        TEXT,
  metadata      JSONB DEFAULT '{}'::jsonb NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE  public.admin_content_audit_log
  IS 'Registro de acciones de administración/moderación (ocultar publicaciones, banear usuarios, cambiar roles)';
COMMENT ON COLUMN public.admin_content_audit_log.actor_user_id
  IS 'Usuario que realizó la acción (admin/moderador)';
COMMENT ON COLUMN public.admin_content_audit_log.resource_type
  IS 'Tipo de recurso afectado: publication, store, brand, product, user';
COMMENT ON COLUMN public.admin_content_audit_log.resource_id
  IS 'ID del recurso afectado (texto)';
COMMENT ON COLUMN public.admin_content_audit_log.action_type
  IS 'Tipo de acción: hide, ban_user, change_role, hide_from_report, hide_full, unban_user, descartado';
COMMENT ON COLUMN public.admin_content_audit_log.reason
  IS 'Motivo opcional de la acción';
COMMENT ON COLUMN public.admin_content_audit_log.metadata
  IS 'Metadatos adicionales según contexto (storeName, brandName, prevRole, newRole, reportId, userName, ...)';
COMMENT ON COLUMN public.admin_content_audit_log.created_at
  IS 'Momento en que se registró la acción';

-- =============================================================================
-- 2. login_audit_logs
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.login_audit_logs (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  metadata   JSONB DEFAULT '{}'::jsonb NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE  public.login_audit_logs
  IS 'Registro de eventos de inicio/cierre de sesión';
COMMENT ON COLUMN public.login_audit_logs.user_id
  IS 'Usuario que realizó el evento (puede ser NULL en login fallido sin sesión activa)';
COMMENT ON COLUMN public.login_audit_logs.event_type
  IS 'Tipo de evento: login, logout, login_fallido, login_google, restablecimiento_contrasena';
COMMENT ON COLUMN public.login_audit_logs.ip_address
  IS 'Dirección IP desde donde se realizó el evento (poblado server-side)';
COMMENT ON COLUMN public.login_audit_logs.user_agent
  IS 'User-Agent del navegador';
COMMENT ON COLUMN public.login_audit_logs.metadata
  IS 'Metadatos adicionales (attemptedEmail, provider, ...)';
COMMENT ON COLUMN public.login_audit_logs.created_at
  IS 'Momento del evento';

-- =============================================================================
-- 3. RLS
-- =============================================================================
ALTER TABLE public.admin_content_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.login_audit_logs ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- 4. Políticas RLS para admin_content_audit_log
-- =============================================================================

-- SELECT: solo admins (role_id = 3) y moderadores (role_id = 2) pueden leer
CREATE POLICY "admin_content_audit_log_select"
  ON public.admin_content_audit_log
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
        AND users.role_id IN (2, 3)
        AND users.is_active = true
    )
  );

-- INSERT: admins y moderadores pueden insertar (deben coincidir con actor_user_id)
CREATE POLICY "admin_content_audit_log_insert"
  ON public.admin_content_audit_log
  FOR INSERT
  TO authenticated
  WITH CHECK (
    actor_user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
        AND users.role_id IN (2, 3)
        AND users.is_active = true
    )
  );

-- UPDATE/DELETE no tienen policy → denegado por defecto (tabla append-only)

-- =============================================================================
-- 5. Políticas RLS para login_audit_logs
-- =============================================================================

-- SELECT: solo admins y moderadores pueden leer logs de login
CREATE POLICY "login_audit_logs_select"
  ON public.login_audit_logs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
        AND users.role_id IN (2, 3)
        AND users.is_active = true
    )
  );

-- INSERT: anon puede insertar login_fallido (user_id = null),
-- authenticated puede insertar sus propios eventos
CREATE POLICY "login_audit_logs_insert"
  ON public.login_audit_logs
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    user_id IS NULL
    OR user_id = auth.uid()
  );

-- UPDATE/DELETE no tienen policy → denegado por defecto (tabla append-only)

-- =============================================================================
-- 6. Índices adicionales
-- NOTA: idx_login_audit_logs_created_at e idx_admin_content_audit_log_created_at
-- ya existen en 20260509_create_admin_metrics_views.sql — no se duplican.
-- =============================================================================

-- admin_content_audit_log: filtrar por actor (admin/moderador)
CREATE INDEX IF NOT EXISTS idx_admin_content_audit_actor
  ON public.admin_content_audit_log (actor_user_id);

-- admin_content_audit_log: buscar acciones sobre un recurso específico
CREATE INDEX IF NOT EXISTS idx_admin_content_audit_resource
  ON public.admin_content_audit_log (resource_type, resource_id);

-- admin_content_audit_log: filtrar por tipo de acción
CREATE INDEX IF NOT EXISTS idx_admin_content_audit_action
  ON public.admin_content_audit_log (action_type);

-- login_audit_logs: buscar eventos de un usuario específico
CREATE INDEX IF NOT EXISTS idx_login_audit_logs_user
  ON public.login_audit_logs (user_id);

-- login_audit_logs: filtrar por tipo de evento
CREATE INDEX IF NOT EXISTS idx_login_audit_logs_event
  ON public.login_audit_logs (event_type);

-- =============================================================================
-- DOWN
-- =============================================================================
-- DROP INDEX IF EXISTS idx_login_audit_logs_event;
-- DROP INDEX IF EXISTS idx_login_audit_logs_user;
-- DROP INDEX IF EXISTS idx_admin_content_audit_action;
-- DROP INDEX IF EXISTS idx_admin_content_audit_resource;
-- DROP INDEX IF EXISTS idx_admin_content_audit_actor;
-- DROP TABLE IF EXISTS public.login_audit_logs CASCADE;
-- DROP TABLE IF EXISTS public.admin_content_audit_log CASCADE;
