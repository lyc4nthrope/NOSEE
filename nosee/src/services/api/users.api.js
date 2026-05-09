/**
 * users.api.js
 * Capa de acceso a datos: operaciones sobre la tabla `users` (perfiles).
 *
 * La tabla `users` está relacionada con `roles`:
 *   users.role_id → roles.id
 *
 * El SELECT usa JOIN implícito con Supabase:
 *   .select('*, roles(name)')
 * lo que retorna: { ..., roles: { name: 'Admin' } }
 *
 * NOTA ESQUEMA: la tabla public.users NO tiene columna email.
 * El email siempre se obtiene de auth.users vía supabase.auth.getUser().
 */

import { supabase } from "@/services/supabase.client";
import { recordRoleAssignment } from "@/services/metrics";

// ─── Mapper BD → UI ───────────────────────────────────────────────────────────

/**
 * Convierte el objeto raw de la BD al shape que usa el store/UI.
 *
 * IMPORTANTE: `data.email` debe inyectarse antes de llamar esta función,
 * ya que la columna email no existe en public.users.
 *
 * @param {Object} data - Fila de la tabla users (con join de roles) + email inyectado
 * @returns {import('@/types').UserProfile}
 */
export function mapDBUserToUI(data) {
  if (!data) return null;
  return {
    id: data.id,
    fullName: data.full_name ?? "",
    email: data.email ?? "", // Inyectado desde auth.users
    roleId: data.role_id,
    role: data.roles?.name ?? "Usuario",
    reputationPoints: data.reputation_points ?? 0,
    publicationsCount: data.publicationsCount ?? 0,
    validationsCount: data.validationsCount ?? 0,
    isVerified: data.is_verified ?? false,
    isActive: data.is_active ?? true,
    avatarUrl: data.avatar_url ?? "",
    createdAt: data.created_at,
  };
}

// ─── Helper interno: obtener email de auth ────────────────────────────────────

async function getAuthEmail() {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.email ?? "";
}

// ─── Obtener perfil ───────────────────────────────────────────────────────────

/**
 * Obtiene el perfil completo del usuario autenticado (incluye su rol).
 * Combina public.users con auth.users para exponer el email.
 *
 * @param {string} userId - UUID del usuario
 */
export async function getUserProfile(userId) {
  const { data: profile, error } = await supabase
    .from("users")
    .select("*, roles(name)")
    .eq("id", userId)
    .single();

  if (error) return { success: false, error: error.message };

  const email = await getAuthEmail();

  // Contar publicaciones del usuario
  const { data: userPubs } = await supabase
    .from("price_publications")
    .select("id")
    .eq("user_id", userId);

  const publicationsCount = userPubs?.length ?? 0;

  // Contar validaciones recibidas (upvotes sobre las publicaciones del usuario)
  let validationsCount = 0;
  if (publicationsCount > 0) {
    const pubIds = userPubs.map((p) => p.id);
    const { count } = await supabase
      .from("publication_votes")
      .select("*", { count: "exact", head: true })
      .in("publication_id", pubIds)
      .eq("vote_type", 1);
    validationsCount = count ?? 0;
  }

  return {
    success: true,
    data: mapDBUserToUI({ ...profile, email, publicationsCount, validationsCount }),
  };
}

// ─── Crear perfil ─────────────────────────────────────────────────────────────

/**
 * Crea el perfil del usuario en la tabla `users` (fallback al trigger).
 * Usa upsert para no colisionar con el trigger handle_new_user.
 *
 * @param {string} userId
 * @param {string} fullName
 */
export async function createUserProfile(userId, fullName) {
  const { data, error } = await supabase
    .from("users")
    .upsert(
      { id: userId, role_id: 1, full_name: fullName, is_verified: false },
      { onConflict: "id" },
    )
    .select("*, roles(name)")
    .single();

  if (error) return { success: false, error: error.message };

  const email = await getAuthEmail();

  return { success: true, data: mapDBUserToUI({ ...data, email }) };
}

// ─── Actualizar perfil ────────────────────────────────────────────────────────

/**
 * Actualiza campos del perfil del usuario autenticado.
 * Re-inyecta el email desde auth.users para no perderlo en el store.
 *
 * @param {string} userId
 * @param {Object} updates - campos snake_case: full_name, etc.
 */
export async function updateUserProfile(userId, updates) {
  const { data, error } = await supabase
    .from("users")
    .update(updates)
    .eq("id", userId)
    .select("*, roles(name)")
    .single();

  if (error) return { success: false, error: error.message };

  // FIX: volver a inyectar email para que el store no lo pierda
  const email = await getAuthEmail();

  return { success: true, data: mapDBUserToUI({ ...data, email }) };
}

// ─── Listar usuarios (solo Admin) ─────────────────────────────────────────────

/**
 * Retorna todos los perfiles de usuario con sus roles.
 * Requiere RLS permiso de Admin.
 * NOTA: No inyecta email individual (operación masiva de admin).
 */
export async function getAllUsers() {
  const { data, error } = await supabase
    .from("users")
    .select("*, roles(name)")
    .order("created_at", { ascending: false });

  if (error) return { success: false, error: error.message };
  return { success: true, data: data.map((row) => mapDBUserToUI(row)) };
}

/**
 * Cambia el rol de un usuario (solo Admin).
 * @param {string} userId
 * @param {number} roleId - 1=Usuario, 2=Moderador, 3=Admin, 4=Repartidor
 */
const ROLE_NAME_BY_ID = { 1: 'usuario', 2: 'moderador', 3: 'admin', 4: 'repartidor' };

export async function changeUserRole(userId, roleId) {
  // No usamos .select() después del UPDATE porque la política RLS
  // bloquea que el admin lea filas de otros usuarios, devolviendo 0 filas
  // aunque el UPDATE haya tenido éxito.
  const { error } = await supabase
    .from("users")
    .update({ role_id: roleId })
    .eq("id", userId);

  if (error) return { success: false, error: error.message };
  recordRoleAssignment(ROLE_NAME_BY_ID[roleId] ?? String(roleId));
  return { success: true };
}

/**
 * Activa o desactiva un usuario (ban/unban). Solo Admin.
 * @param {string} userId
 * @param {boolean} isActive - true = activo, false = baneado
 */
export async function updateUserStatus(userId, isActive) {
  const { error } = await supabase
    .from("users")
    .update({ is_active: isActive })
    .eq("id", userId);

  if (error) return { success: false, error: error.message };
  return { success: true };
}

/**
 * Obtiene métricas principales para el resumen del dashboard Admin.
 *
 * Incluye:
 * - Cantidad total de usuarios
 * - Cantidad de publicaciones creadas hoy
 * - Cantidad de reportes pendientes
 * - Cantidad de validaciones (upvotes) hechas hoy
 */
export async function getAdminOverviewStats() {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const startIso = startOfToday.toISOString();

  const [
    usersCountResult,
    publicationsTodayResult,
    reportsPendingResult,
    validationsTodayResult,
  ] = await Promise.all([
    supabase
      .from("users")
      .select("id", { count: "exact", head: true }),
    supabase
      .from("price_publications")
      .select("id", { count: "exact", head: true })
      .gte("created_at", startIso),
    supabase
      .from("reports")
      .select("id", { count: "exact", head: true })
      .in("status", ["PENDING", "pending"]),
    supabase
      .from("publication_votes")
      .select("id", { count: "exact", head: true })
      .eq("vote_type", 1)
      .gte("created_at", startIso),
  ]);

  const firstError = [
    usersCountResult.error,
    publicationsTodayResult.error,
    reportsPendingResult.error,
    validationsTodayResult.error,
  ].find(Boolean);

  if (firstError) {
    return { success: false, error: firstError.message };
  }

  return {
    success: true,
    data: {
      totalUsers: usersCountResult.count ?? 0,
      publicationsToday: publicationsTodayResult.count ?? 0,
      pendingReports: reportsPendingResult.count ?? 0,
      validationsToday: validationsTodayResult.count ?? 0,
    },
  };
}

/**
 * Obtiene todos los reportes para moderación/admin.
 * Incluye detalles de la entidad reportada (publicación, tienda, producto, marca o usuario).
 */
export async function getAdminReports() {
  const { data, error } = await supabase
    .from("reports")
    .select(`
      id,
      reported_type,
      reported_id,
      reported_user_id,
      reporter_user_id,
      reason,
      status,
      reviewed_by,
      created_at,
      resolved_at,
      description,
      evidence_url,
      mod_notes,
      action_taken,
      reporter:reporter_user_id(full_name),
      reported:reported_user_id(full_name),
      reviewer:reviewed_by(full_name)
    `)
    .order("created_at", { ascending: false });

  if (error) return { success: false, error: error.message };

  const reports = data ?? [];
  if (reports.length === 0) return { success: true, data: [] };

  const publicationIds = [...new Set(
    reports
      .filter((r) => String(r.reported_type || "").toLowerCase() === "publication")
      .map((r) => Number(r.reported_id))
      .filter((id) => Number.isFinite(id)),
  )];

  const userIds = [...new Set(
    reports
      .filter((r) => String(r.reported_type || "").toLowerCase() === "user")
      .map((r) => r.reported_id)
      .filter(Boolean),
  )];

  const storeIds = [...new Set(
    reports
      .filter((r) => String(r.reported_type || "").toLowerCase() === "store")
      .map((r) => r.reported_id)
      .filter(Boolean),
  )];

  const productIds = [...new Set(
    reports
      .filter((r) => String(r.reported_type || "").toLowerCase() === "product")
      .map((r) => Number(r.reported_id))
      .filter((id) => Number.isFinite(id)),
  )];

  const brandIds = [...new Set(
    reports
      .filter((r) => String(r.reported_type || "").toLowerCase() === "brand")
      .map((r) => Number(r.reported_id))
      .filter((id) => Number.isFinite(id)),
  )];

  const commentIds = [...new Set(
    reports
      .filter((r) => String(r.reported_type || "").toLowerCase() === "comment")
      .map((r) => r.reported_id)
      .filter(Boolean),
  )];

  const [
    publicationsResult,
    usersResult,
    storesResult,
    productsResult,
    brandsResult,
    commentsResult,
  ] = await Promise.all([
    publicationIds.length === 0
      ? Promise.resolve({ data: [], error: null })
      : supabase
          .from("price_publications")
          .select(`
            id,
            price,
            is_active,
            product:products(
              id,
              name,
              base_quantity,
              brand:brands(id, name),
              unit_type:unit_types(id, name, abbreviation)
            ),
            store:stores(id, name)
          `)
          .in("id", publicationIds),
    userIds.length === 0
      ? Promise.resolve({ data: [], error: null })
      : supabase.from("users").select("id, full_name, role_id, is_active").in("id", userIds),
    storeIds.length === 0
      ? Promise.resolve({ data: [], error: null })
      : supabase.from("stores").select("id, name, address, is_active, is_admin_hidden").in("id", storeIds),
    productIds.length === 0
      ? Promise.resolve({ data: [], error: null })
      : supabase.from("products").select("id, name, barcode, is_active, is_admin_hidden").in("id", productIds),
    brandIds.length === 0
      ? Promise.resolve({ data: [], error: null })
      : supabase.from("brands").select("id, name, is_active, is_admin_hidden").in("id", brandIds),
    commentIds.length === 0
      ? Promise.resolve({ data: [], error: null })
      : supabase.from("comments").select("id, content, is_deleted, publication_id, user_id").in("id", commentIds),
  ]);

  const firstHydrationError = [
    publicationsResult.error,
    usersResult.error,
    storesResult.error,
    productsResult.error,
    brandsResult.error,
    commentsResult.error,
  ].find(Boolean);

  if (firstHydrationError) {
    return { success: false, error: firstHydrationError.message };
  }

  const publicationsById = new Map((publicationsResult.data || []).map((item) => [String(item.id), item]));
  const usersById = new Map((usersResult.data || []).map((item) => [String(item.id), item]));
  const storesById = new Map((storesResult.data || []).map((item) => [String(item.id), item]));
  const productsById = new Map((productsResult.data || []).map((item) => [String(item.id), item]));
  const brandsById = new Map((brandsResult.data || []).map((item) => [String(item.id), item]));
  const commentsById = new Map((commentsResult.data || []).map((item) => [String(item.id), item]));

  const hydrated = reports.map((report) => {
    const reportType = String(report.reported_type || "").toLowerCase();
    const reportId = String(report.reported_id || "");

    let target = null;
    if (reportType === "publication") target = publicationsById.get(reportId) || null;
    if (reportType === "user") target = usersById.get(reportId) || null;
    if (reportType === "store") target = storesById.get(reportId) || null;
    if (reportType === "product") target = productsById.get(reportId) || null;
    if (reportType === "brand") target = brandsById.get(reportId) || null;
    if (reportType === "comment") target = commentsById.get(reportId) || null;

    return { ...report, target };
  });

  return { success: true, data: hydrated };
}

/**
 * Actualiza datos de revisión de un reporte.
 * @param {string} reportId
 * @param {Object} payload
 */

/**
 * Resumen de actividad propia del usuario para el perfil.
 */
export async function getUserProfileActivity(userId) {
  try {
    const [publicationsResult, storesResult, reportsResult] = await Promise.all([
      supabase
        .from("price_publications")
        .select(`
          id,
          price,
          description,
          photo_url,
          is_active,
          created_at,
          product:products(id, name),
          store:stores(id, name)
        `)
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(100),
      supabase
        .from("stores")
        .select("id, name, address, website_url, store_type_id, created_at")
        .eq("created_by", userId)
        .order("created_at", { ascending: false })
        .limit(100),
      supabase
        .from("reports")
        .select("id, reported_type, reported_id, reason, description, status, created_at, resolved_at, mod_notes, action_taken")
        .eq("reporter_user_id", userId)
        .order("created_at", { ascending: false })
        .limit(100),
    ]);

    const firstError = [
      publicationsResult.error,
      storesResult.error,
      reportsResult.error,
    ].find(Boolean);

    if (firstError) return { success: false, error: firstError.message };

    return {
      success: true,
      data: {
        publications: publicationsResult.data || [],
        stores: storesResult.data || [],
        reports: reportsResult.data || [],
        products: [],
      },
    };
  } catch (err) {
    return { success: false, error: err.message || "No se pudo cargar la actividad" };
  }
}

/**
 * Editar un reporte propio.
 */
export async function updateOwnReport(reportId, userId, updates = {}) {
  if (!reportId) return { success: false, error: "ID de reporte requerido" };

  const { data: report, error: reportError } = await supabase
    .from("reports")
    .select("id, reporter_user_id")
    .eq("id", reportId)
    .single();

  if (reportError) return { success: false, error: reportError.message };
  if (report?.reporter_user_id !== userId) {
    return { success: false, error: "Solo puedes editar tus propios reportes" };
  }

  const safeUpdates = {};
  if (typeof updates.reason === "string") safeUpdates.reason = updates.reason;
  if (typeof updates.description === "string") safeUpdates.description = updates.description;

  if (Object.keys(safeUpdates).length === 0) {
    return { success: false, error: "No hay cambios para guardar" };
  }

  const { data, error } = await supabase
    .from("reports")
    .update(safeUpdates)
    .eq("id", reportId)
    .select("id, publication_id, reason, description, status, created_at")
    .single();

  if (error) return { success: false, error: error.message };
  return { success: true, data };
}

export async function deleteOwnReport(reportId) {
  if (!reportId) return { success: false, error: "ID de reporte requerido" };

  const { error } = await supabase.rpc("delete_own_report", { p_report_id: reportId });

  if (error) return { success: false, error: error.message };
  return { success: true };
}

export async function updateReportReview(reportId, payload) {
  const normalizedStatus = String(payload?.status || "").toUpperCase();

  // Si el reporte se resuelve, deducir reputación al usuario reportado
  if (normalizedStatus === "RESOLVED") {
    const { data: report } = await supabase
      .from("reports")
      .select("reported_user_id")
      .eq("id", reportId)
      .single();

    if (report?.reported_user_id) {
      void (async () => {
        await supabase.rpc("increment_user_reputation", {
          target_user_id: report.reported_user_id,
          reputation_delta: -7,
        });
      })();
    }
  }

  const { error } = await supabase
    .from("reports")
    .update({
      ...payload,
      status: normalizedStatus || payload?.status,
    })
    .eq("id", reportId);

  if (error) return { success: false, error: error.message };
  return { success: true };
}

/**
 * Obtiene los usuarios con más puntos de reputación.
 * @param {number} limit - Máximo de usuarios a retornar (default 20)
 */
export async function getTopUsersByReputation(limit = 20) {
  const safeLimit = Math.max(1, Math.min(Number(limit) || 20, 100));

  const publicRanking = await supabase.rpc("get_public_user_ranking", {
    p_limit: safeLimit,
  });

  if (!publicRanking.error && Array.isArray(publicRanking.data) && publicRanking.data.length > 0) {
    const normalized = publicRanking.data.map((row) => ({
      id: row.id,
      full_name: row.full_name,
      avatar_url: row.avatar_url,
      reputation_points: Number(row.reputation_points || 0),
      roles: row.role_name ? { name: row.role_name } : null,
    }));
    return { success: true, data: normalized };
  }

  const { data, error } = await supabase
    .from("users")
    .select("id, full_name, avatar_url, reputation_points, roles(name)")
    .order("reputation_points", { ascending: false })
    .limit(safeLimit);

  if (error || !Array.isArray(data) || data.length === 0) {
    const fallback = await supabase
      .from("price_publications")
      .select("user_id, user:users!price_publications_user_id_fkey(id, full_name, avatar_url, reputation_points, roles(name))")
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(1000);

    if (fallback.error) {
      const firstError = publicRanking.error?.message || error?.message || fallback.error.message;
      return { success: false, error: firstError };
    }

    const byUser = new Map();
    for (const row of fallback.data || []) {
      const user = row.user;
      const id = user?.id || row.user_id;
      if (!id || byUser.has(id)) continue;
      byUser.set(id, {
        id,
        full_name: user?.full_name || "Usuario",
        avatar_url: user?.avatar_url || null,
        reputation_points: Number(user?.reputation_points || 0),
        roles: user?.roles || null,
      });
    }

    const ranked = Array.from(byUser.values())
      .sort((a, b) => b.reputation_points - a.reputation_points)
      .slice(0, safeLimit);

    return { success: true, data: ranked };
  }
  return { success: true, data: data ?? [] };
}
