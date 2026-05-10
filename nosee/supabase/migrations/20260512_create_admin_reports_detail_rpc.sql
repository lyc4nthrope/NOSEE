-- Migration: get_admin_reports_detail RPC
-- Date: 2026-05-12
--
-- Reemplaza el hydration client-side de getAdminReports() en users.api.js
-- que hacía: 1 SELECT a reports (5000) → 6 queries paralelas → hydrate por tipo.
--
-- La RPC hace todo server-side con paginación, devolviendo:
--   - Todas las columnas de reports
--   - reporter_name, reported_name, reviewer_name (desde users.full_name)
--   - target (JSONB con datos de la entidad reportada según reported_type)
--   - total_count (para paginación)
--
-- SECURITY INVOKER: hereda RLS de reports (admin/mod pueden SELECT via policy)

CREATE OR REPLACE FUNCTION public.get_admin_reports_detail(
  p_page INT DEFAULT 1,
  p_page_size INT DEFAULT 20
)
RETURNS TABLE(
  id UUID,
  reported_type TEXT,
  reported_id TEXT,
  reported_user_id UUID,
  reporter_user_id UUID,
  reason TEXT,
  status TEXT,
  reviewed_by UUID,
  created_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  description TEXT,
  evidence_url TEXT,
  mod_notes TEXT,
  action_taken TEXT,
  reporter_name TEXT,
  reported_name TEXT,
  reviewer_name TEXT,
  target JSONB,
  total_count BIGINT
)
LANGUAGE plpgsql
SECURITY INVOKER
STABLE
SET search_path = ''
AS $$
DECLARE
  v_offset INT;
BEGIN
  v_offset := (p_page - 1) * p_page_size;

  RETURN QUERY
  WITH report_list AS (
    SELECT r.*
    FROM public.reports r
    ORDER BY r.created_at DESC
    LIMIT p_page_size
    OFFSET v_offset
  ),
  total_count AS (
    SELECT COUNT(*)::BIGINT AS cnt FROM public.reports
  )
  SELECT
    rl.id,
    rl.reported_type,
    rl.reported_id,
    rl.reported_user_id,
    rl.reporter_user_id,
    rl.reason,
    rl.status,
    rl.reviewed_by,
    rl.created_at,
    rl.resolved_at,
    rl.description,
    rl.evidence_url,
    rl.mod_notes,
    rl.action_taken,
    reporter.full_name AS reporter_name,
    reported.full_name AS reported_name,
    reviewer.full_name AS reviewer_name,
    CASE
      WHEN LOWER(rl.reported_type) = 'publication' THEN
        (SELECT jsonb_build_object(
           'id', p.id,
           'price', p.price,
           'photo_url', p.photo_url,
           'description', p.description,
           'is_active', p.is_active,
           'product_name', pr.name
         )
         FROM public.price_publications p
         LEFT JOIN public.products pr ON pr.id = p.product_id
         WHERE p.id::TEXT = rl.reported_id)
      WHEN LOWER(rl.reported_type) = 'user' THEN
        (SELECT jsonb_build_object(
           'id', u.id,
           'full_name', u.full_name,
           'role_id', u.role_id,
           'is_active', u.is_active
         )
         FROM public.users u
         WHERE u.id::TEXT = rl.reported_id)
      WHEN LOWER(rl.reported_type) = 'store' THEN
        (SELECT jsonb_build_object(
           'id', s.id,
           'name', s.name,
           'address', s.address,
           'is_active', s.is_active
         )
         FROM public.stores s
         WHERE s.id::TEXT = rl.reported_id)
      WHEN LOWER(rl.reported_type) = 'product' THEN
        (SELECT jsonb_build_object(
           'id', pr.id,
           'name', pr.name,
           'barcode', pr.barcode,
           'is_active', pr.is_active
         )
         FROM public.products pr
         WHERE pr.id::TEXT = rl.reported_id)
      WHEN LOWER(rl.reported_type) = 'brand' THEN
        (SELECT jsonb_build_object(
           'id', b.id,
           'name', b.name,
           'is_active', b.is_active
         )
         FROM public.brands b
         WHERE b.id::TEXT = rl.reported_id)
      WHEN LOWER(rl.reported_type) = 'comment' THEN
        (SELECT jsonb_build_object(
           'id', c.id,
           'content', c.content,
           'is_deleted', c.is_deleted,
           'publication_id', c.publication_id
         )
         FROM public.comments c
         WHERE c.id::TEXT = rl.reported_id)
      ELSE NULL
    END::JSONB AS target,
    tc.cnt AS total_count
  FROM report_list rl
  LEFT JOIN public.users reporter ON reporter.id = rl.reporter_user_id
  LEFT JOIN public.users reported ON reported.id = rl.reported_user_id
  LEFT JOIN public.users reviewer ON reviewer.id = rl.reviewed_by
  CROSS JOIN total_count tc
  ORDER BY rl.created_at DESC;
END;
$$;

COMMENT ON FUNCTION public.get_admin_reports_detail IS
  'Paginated admin reports with resolved target data, replacing client-side hydration';

-- Grants: solo admin/mod pueden ejecutar (RLS filtra en SECURITY INVOKER)
REVOKE ALL ON FUNCTION public.get_admin_reports_detail(INT, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_admin_reports_detail(INT, INT) TO authenticated;
