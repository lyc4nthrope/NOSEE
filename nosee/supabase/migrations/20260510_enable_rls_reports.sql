-- Migration: enable_rls_reports
-- Habilita RLS en la tabla reports y define políticas de acceso
-- Creado: 2026-05-10
--
-- Contexto: La tabla reports fue creada en el schema inicial (no trackeado en migraciones).
-- Actualmente NO tiene RLS, permitiendo que cualquier usuario autenticado lea/modifique
-- reportes ajenos. Las views admin_reports_summary y admin_overview_summary con
-- security_invoker=true NO protegen si la tabla base no tiene RLS.
--
-- Sistema de roles (desde public.users.role_id):
--   1 = Usuario regular
--   2 = Moderador
--   3 = Admin
--   4 = Repartidor

-- =============================================================================
-- 1. Habilitar RLS
-- =============================================================================
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- 2. Políticas RLS
-- =============================================================================

-- 2a. Admins y moderadores: SELECT todos los reportes (para moderación)
CREATE POLICY IF NOT EXISTS "admin_mod_select_reports"
  ON public.reports
  AS PERMISSIVE
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

-- 2b. Usuarios propietarios: SELECT solo sus propios reportes
CREATE POLICY IF NOT EXISTS "user_select_own_reports"
  ON public.reports
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (
    reporter_user_id = auth.uid()
  );

-- 2c. Usuarios autenticados: INSERT reportes (denunciar contenido)
-- El WITH CHECK asegura que reporter_user_id sea el propio usuario
CREATE POLICY IF NOT EXISTS "user_insert_reports"
  ON public.reports
  AS PERMISSIVE
  FOR INSERT
  TO authenticated
  WITH CHECK (
    reporter_user_id = auth.uid()
  );

-- 2d. Usuarios propietarios: UPDATE razón/descripción de sus reportes
CREATE POLICY IF NOT EXISTS "user_update_own_reports"
  ON public.reports
  AS PERMISSIVE
  FOR UPDATE
  TO authenticated
  USING (
    reporter_user_id = auth.uid()
  )
  WITH CHECK (
    reporter_user_id = auth.uid()
  );

-- 2e. Admins y moderadores: UPDATE estado/revisión de cualquier reporte
CREATE POLICY IF NOT EXISTS "admin_mod_update_reports"
  ON public.reports
  AS PERMISSIVE
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
        AND users.role_id IN (2, 3)
        AND users.is_active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
        AND users.role_id IN (2, 3)
        AND users.is_active = true
    )
  );

-- 2f. Usuarios propietarios: DELETE sus propios reportes (vía RPC delete_own_report)
CREATE POLICY IF NOT EXISTS "user_delete_own_reports"
  ON public.reports
  AS PERMISSIVE
  FOR DELETE
  TO authenticated
  USING (
    reporter_user_id = auth.uid()
  );

-- =============================================================================
-- 3. Comentarios de documentación
-- =============================================================================

COMMENT ON POLICY "admin_mod_select_reports" ON public.reports IS
  'Admins (role_id=3) y moderadores (role_id=2) activos pueden leer todos los reportes para moderación';

COMMENT ON POLICY "user_select_own_reports" ON public.reports IS
  'Cada usuario autenticado puede ver solo sus propios reportes';

COMMENT ON POLICY "user_insert_reports" ON public.reports IS
  'Usuarios autenticados pueden reportar contenido; reporter_user_id debe coincidir con auth.uid()';

COMMENT ON POLICY "user_update_own_reports" ON public.reports IS
  'Usuarios pueden editar razón/descripción de sus propios reportes';

COMMENT ON POLICY "admin_mod_update_reports" ON public.reports IS
  'Admins y moderadores pueden actualizar estado, mod_notes, action_taken, reviewed_by y resolved_at';

COMMENT ON POLICY "user_delete_own_reports" ON public.reports IS
  'Usuarios pueden eliminar sus propios reportes (vía RPC delete_own_report)';

-- =============================================================================
-- DOWN
-- =============================================================================
-- DROP POLICY IF EXISTS "admin_mod_select_reports" ON public.reports;
-- DROP POLICY IF EXISTS "user_select_own_reports" ON public.reports;
-- DROP POLICY IF EXISTS "user_insert_reports" ON public.reports;
-- DROP POLICY IF EXISTS "user_update_own_reports" ON public.reports;
-- DROP POLICY IF EXISTS "admin_mod_update_reports" ON public.reports;
-- DROP POLICY IF EXISTS "user_delete_own_reports" ON public.reports;
-- ALTER TABLE public.reports DISABLE ROW LEVEL SECURITY;
