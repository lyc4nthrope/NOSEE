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
    .order("created_at", { ascending: false })
    .limit(5000);

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
      .in("status", ["PENDING", "pending", "IN_REVIEW", "in_review"]),
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
 * Obtiene reportes paginados para moderación/admin con datos del target resueltos server-side.
 * @param {number} page - Número de página (default: 1)
 * @param {number} pageSize - Tamaño de página (default: 20, max: 100)
 * @returns {Promise<{success: boolean, data: Array, count: number, error?: string}>}
 */
export async function getAdminReports(page = 1, pageSize = 20) {
  const safePageSize = Math.min(pageSize, 100);

  // Primary: RPC server-side con datos del target hidratados
  try {
    const { data, error } = await supabase
      .rpc('get_admin_reports_detail', { 
        p_page: page, 
        p_page_size: safePageSize,
      });

    if (error) throw error;

    const reports = data || [];
    return {
      success: true,
      data: reports,
      count: reports[0]?.total_count || 0,
    };
  } catch (rpcError) {
    console.warn('[getAdminReports] RPC falló, usando fallback query directa:', rpcError.message);
  }

  // Fallback: query directa a reports si la RPC no existe
  try {
    const offset = (page - 1) * safePageSize;
    const { data: reportsData, error: reportsError, count } = await supabase
      .from('reports')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + safePageSize - 1);

    if (reportsError) throw reportsError;

    const reports = (reportsData || []).map(r => ({
      id: r.id,
      reported_type: r.reported_type,
      reported_id: r.reported_id,
      reported_user_id: r.reported_user_id,
      reporter_user_id: r.reporter_user_id,
      reason: r.reason,
      status: r.status,
      reviewed_by: r.reviewed_by,
      created_at: r.created_at,
      resolved_at: r.resolved_at,
      description: r.description,
      evidence_url: r.evidence_url,
      mod_notes: r.mod_notes,
      action_taken: r.action_taken,
      reporter_name: null,
      reported_name: null,
      reviewer_name: null,
      target: null,
      total_count: count || 0,
    }));

    return { success: true, data: reports, count: count || 0 };
  } catch (fallbackError) {
    console.error('[getAdminReports] Fallback también falló:', fallbackError);
    return { success: false, data: [], count: 0, error: fallbackError.message };
  }
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
 * Obtiene información básica de un usuario por ID (nombre, email).
 * Usado por el panel admin para mapear userIds a nombres en logs.
 */
export async function getUserBasicInfo(userId) {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('id, full_name')
      .eq('id', userId)
      .single();
    if (error) return { success: false, error: error.message };
    return { success: true, data: { ...data, email: null } };
  } catch (err) {
    return { success: false, error: err.message };
  }
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
