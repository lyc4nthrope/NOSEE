-- Migration: create_missing_rpcs
-- Creado: 2026-05-11
--
-- Versiona 4 RPCs que existen en el schema inicial pero no están trackeadas en migraciones.
-- Un supabase db reset desde 0 las perdería sin esta migración.
--
-- RPCs incluidas:
--   1. increment_user_reputation(target_user_id UUID, reputation_delta INT)
--   2. delete_own_report(p_report_id UUID)
--   3. get_public_user_ranking(p_limit INT DEFAULT 10)
--   4. hide_my_account()
--
-- También crea la tabla reputation_history necesaria para la RPC #1.

-- =============================================================================
-- 1. Tabla reputation_history (auditoría de cambios de reputación)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.reputation_history (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  delta INTEGER NOT NULL,
  reason TEXT,
  reference_type TEXT,
  reference_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reputation_history_user_id
  ON public.reputation_history (user_id);

CREATE INDEX IF NOT EXISTS idx_reputation_history_created_at
  ON public.reputation_history (created_at DESC);

ALTER TABLE public.reputation_history ENABLE ROW LEVEL SECURITY;

-- Solo admins (role_id=3) y moderadores (role_id=2) activos pueden leer
CREATE POLICY "admin_mod_select_reputation_history"
  ON public.reputation_history
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

-- Solo escritura vía RPC (SECURITY INVOKER necesita permiso explícito)
CREATE POLICY "authenticated_insert_reputation_history"
  ON public.reputation_history
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- =============================================================================
-- 2. increment_user_reputation(target_user_id UUID, reputation_delta INT)
-- =============================================================================
--
-- Llamado desde:
--   - create_publication RPC (vía PERFORM, positional args)
--   - src/services/api/stores.api.js (crear tienda, +3)
--   - src/services/api/products.api.js (crear producto, +2 / crear marca, +1)
--   - src/services/api/comments.api.js (crear comentario, +1)
--   - src/services/api/reports.api.js (reportar contenido, +2)
--   - src/services/api/users.api.js (resolver reporte, -7 al reportado)
--
-- SECURITY INVOKER: hereda RLS de users y reputation_history.

CREATE OR REPLACE FUNCTION public.increment_user_reputation(
  target_user_id UUID,
  reputation_delta INT
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  IF target_user_id IS NULL THEN
    RAISE EXCEPTION 'target_user_id cannot be null';
  END IF;

  UPDATE public.users
  SET reputation_points = COALESCE(reputation_points, 0) + reputation_delta
  WHERE id = target_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'user_not_found';
  END IF;

  INSERT INTO public.reputation_history (user_id, delta)
  VALUES (target_user_id, reputation_delta);
END;
$$;

COMMENT ON FUNCTION public.increment_user_reputation(UUID, INT) IS
  'Incrementa (o decrementa) los puntos de reputación de un usuario y registra el cambio en reputation_history';

-- =============================================================================
-- 3. delete_own_report(p_report_id UUID)
-- =============================================================================
--
-- Llamado desde:
--   - src/services/api/users.api.js → deleteOwnReport(reportId)
--
-- La RLS policy "user_delete_own_reports" (20260510_enable_rls_reports) filtra
-- por reporter_user_id = auth.uid(). Al ser SECURITY INVOKER, se respeta.

CREATE OR REPLACE FUNCTION public.delete_own_report(
  p_report_id UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  IF p_report_id IS NULL THEN
    RAISE EXCEPTION 'report_id cannot be null';
  END IF;

  DELETE FROM public.reports
  WHERE id = p_report_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'report_not_found_or_not_owner';
  END IF;
END;
$$;

COMMENT ON FUNCTION public.delete_own_report(UUID) IS
  'Elimina un reporte propio del usuario autenticado (hereda RLS de reports)';

-- =============================================================================
-- 4. get_public_user_ranking(p_limit INT DEFAULT 10)
-- =============================================================================
--
-- Llamado desde:
--   - src/services/api/users.api.js → getTopUsersByReputation(limit = 20)
--
-- Retorna: id, full_name, avatar_url, reputation_points, role_name
-- Solo usuarios activos, ordenados por reputación descendente.

CREATE OR REPLACE FUNCTION public.get_public_user_ranking(
  p_limit INT DEFAULT 10
)
RETURNS TABLE (
  id UUID,
  full_name VARCHAR,
  avatar_url TEXT,
  reputation_points INT,
  role_name TEXT
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT
    u.id,
    u.full_name,
    u.avatar_url,
    COALESCE(u.reputation_points, 0) AS reputation_points,
    r.name AS role_name
  FROM public.users u
  LEFT JOIN public.roles r ON r.id = u.role_id
  WHERE u.is_active = true
  ORDER BY u.reputation_points DESC NULLS LAST
  LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 10), 100));
END;
$$;

COMMENT ON FUNCTION public.get_public_user_ranking(INT) IS
  'Retorna ranking público de usuarios activos ordenados por reputación descendente';

-- =============================================================================
-- 5. hide_my_account()
-- =============================================================================
--
-- Llamado desde:
--   - src/services/api/auth.api.js → deleteAccountPermanent()
--
-- Desactiva la cuenta (is_active = false) y oculta todas las publicaciones activas
-- del usuario autenticado. Soft delete profundo: no borra datos, mantiene auditoría.

CREATE OR REPLACE FUNCTION public.hide_my_account()
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  UPDATE public.users
  SET is_active = false
  WHERE id = v_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'user_not_found';
  END IF;

  UPDATE public.price_publications
  SET is_active = false
  WHERE user_id = v_user_id
    AND is_active = true;
END;
$$;

COMMENT ON FUNCTION public.hide_my_account() IS
  'Desactiva la cuenta del usuario autenticado y oculta todas sus publicaciones activas';

-- =============================================================================
-- 6. Grants
-- =============================================================================

REVOKE ALL ON FUNCTION public.increment_user_reputation(UUID, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_user_reputation(UUID, INT) TO authenticated;

REVOKE ALL ON FUNCTION public.delete_own_report(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_own_report(UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.get_public_user_ranking(INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_user_ranking(INT) TO authenticated;

REVOKE ALL ON FUNCTION public.hide_my_account() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.hide_my_account() TO authenticated;
