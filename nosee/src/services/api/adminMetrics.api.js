/**
 * adminMetrics.api.js
 *
 * API de métricas admin-only.
 * Consume las views creadas en Supabase para evitar queries inline en React.
 *
 * Patrón de retorno: { success, data?, error? } — consistente con el proyecto.
 */
import { supabase } from '@/services/supabase.client';
import { getOrSetCache } from '@/services/cache';

// ─── Helpers de permisos ──────────────────────────────────────────────────────

async function isAdminOrMod() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  const { data } = await supabase
    .from('users')
    .select('role_id')
    .eq('id', user.id)
    .maybeSingle();
  return data && (data.role_id === 2 || data.role_id === 3);
}

// ─── Overview ─────────────────────────────────────────────────────────────────

/**
 * Obtiene los 12 KPIs del overview desde la view admin_overview_summary.
 * Si la view no existe (migración pendiente), fallback a getAdminOverviewStats().
 *
 * @returns {{ success: boolean, data?: AdminOverviewMetrics, error?: string }}
 */
export async function getAdminOverviewMetrics() {
  try {
    const data = await getOrSetCache('admin:overview', async () => {
      const { data, error } = await supabase
        .from('admin_overview_summary')
        .select('*')
        .single();

      if (error) {
        if (error.message?.includes('does not exist') || error.message?.toLowerCase().includes('no rows')) {
          const { getAdminOverviewStats } = await import('@/services/api/users.api');
          const fallback = await getAdminOverviewStats();
          if (fallback.success) {
            return {
              totalActiveUsers: null,
              totalUsers: fallback.data.totalUsers,
              publicationsToday: fallback.data.publicationsToday,
              totalPublications: null,
              activePublications: null,
              validationsToday: fallback.data.validationsToday,
              pendingReports: fallback.data.pendingReports,
              totalOrders: null,
              activeOrders: null,
              activeStores: null,
              activeProducts: null,
              activeDealers: null,
              pendingDealerApplications: null,
              loginsLast24h: null,
            };
          }
          throw new Error(fallback.error || 'Fallback error');
        }
        const msg = error.code === 'PGRST301' ? 'Sesión expirada' : error.message;
        throw new Error(msg);
      }

      return data;
    }, 120000);

    return { success: true, data };
  } catch (_) {
    return { success: false, error: 'Error al cargar métricas del panel' };
  }
}

/**
 * @typedef {Object} AdminOverviewMetrics
 * @property {number} totalActiveUsers
 * @property {number} totalUsers
 * @property {number} publicationsToday
 * @property {number} totalPublications
 * @property {number} activePublications
 * @property {number} validationsToday
 * @property {number} pendingReports
 * @property {number} totalOrders
 * @property {number} activeOrders
 * @property {number} activeStores
 * @property {number} activeProducts
 * @property {number} activeDealers
 * @property {number} pendingDealerApplications
 * @property {number} loginsLast24h
 */

// ─── Reports ──────────────────────────────────────────────────────────────────

/**
 * Obtiene resumen de reportes desde admin_reports_summary.
 */
export async function getAdminReportsMetrics() {
  try {
    const data = await getOrSetCache('admin:reports', async () => {
      const { data, error } = await supabase
        .from('admin_reports_summary')
        .select('*')
        .single();

      if (error) throw new Error(error.message);
      return data;
    }, 120000);

    return { success: true, data };
  } catch (_) {
    return { success: false, error: 'Error al cargar resumen de reportes' };
  }
}

/**
 * @typedef {Object} AdminReportsMetrics
 * @property {number} totalReports
 * @property {number} pendingBacklog
 * @property {number} resolvedCount
 * @property {Object} breakdownByReason
 * @property {Array} latestPendingReports
 */

// ─── Logs ─────────────────────────────────────────────────────────────────────

/**
 * Obtiene resumen de logs desde admin_logs_summary.
 */
export async function getAdminLogsMetrics() {
  try {
    const data = await getOrSetCache('admin:logs', async () => {
      const { data, error } = await supabase
        .from('admin_logs_summary')
        .select('*')
        .single();

      if (error) throw new Error(error.message);
      return data;
    }, 120000);

    return { success: true, data };
  } catch (_) {
    return { success: false, error: 'Error al cargar resumen de logs' };
  }
}

/**
 * @typedef {Object} AdminLogsMetrics
 * @property {number} loginEvents24h
 * @property {number} loginEvents7d
 * @property {number} activityEvents24h
 * @property {number} activityEvents7d
 * @property {number} adminEvents24h
 * @property {number} adminEvents7d
 * @property {Array} latestEvents
 */
