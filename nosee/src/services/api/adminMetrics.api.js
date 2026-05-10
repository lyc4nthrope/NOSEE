/**
 * adminMetrics.api.js
 *
 * API de métricas admin-only.
 * Consume las views creadas en Supabase para evitar queries inline en React.
 */
import { supabase } from '@/services/supabase.client';
import { getOrSetCache } from '@/services/cache';

const CACHE_TTL_MS = 120000;

function coalesce(...values) {
  for (const value of values) {
    if (value !== undefined && value !== null) return value;
  }
  return values[values.length - 1];
}

function normalizeOverviewMetrics(row = {}) {
  return {
    totalActiveUsers: coalesce(row.totalActiveUsers, row.total_active_users, null),
    totalUsers: coalesce(row.totalUsers, row.total_users, null),
    publicationsToday: coalesce(row.publicationsToday, row.publications_today, null),
    totalPublications: coalesce(row.totalPublications, row.total_publications, null),
    activePublications: coalesce(row.activePublications, row.active_publications, null),
    validationsToday: coalesce(row.validationsToday, row.validations_today, null),
    pendingReports: coalesce(row.pendingReports, row.pending_reports, null),
    totalOrders: coalesce(row.totalOrders, row.total_orders, null),
    activeOrders: coalesce(row.activeOrders, row.active_orders, null),
    activeStores: coalesce(row.activeStores, row.active_stores, null),
    activeProducts: coalesce(row.activeProducts, row.active_products, null),
    activeDealers: coalesce(row.activeDealers, row.active_dealers, null),
    pendingDealerApplications: coalesce(row.pendingDealerApplications, row.pending_dealer_applications, null),
    loginsLast24h: coalesce(row.loginsLast24h, row.logins_last_24h, null),
  };
}

function normalizeReportsMetrics(row = {}) {
  return {
    totalReports: coalesce(row.totalReports, row.total_reports, 0),
    pendingBacklog: coalesce(row.pendingBacklog, row.pending_backlog, 0),
    resolvedCount: coalesce(row.resolvedCount, row.resolved_count, 0),
    breakdownByReason: coalesce(row.breakdownByReason, row.breakdown_by_reason, {}),
    latestPendingReports: coalesce(row.latestPendingReports, row.latest_pending_reports, []),
  };
}

function normalizeLogsMetrics(row = {}) {
  return {
    loginEvents24h: coalesce(row.loginEvents24h, row.login_events_24h, 0),
    loginEvents7d: coalesce(row.loginEvents7d, row.login_events_7d, 0),
    activityEvents24h: coalesce(row.activityEvents24h, row.activity_events_24h, 0),
    activityEvents7d: coalesce(row.activityEvents7d, row.activity_events_7d, 0),
    adminEvents24h: coalesce(row.adminEvents24h, row.admin_events_24h, 0),
    adminEvents7d: coalesce(row.adminEvents7d, row.admin_events_7d, 0),
    latestEvents: coalesce(row.latestEvents, row.latest_events, []),
  };
}

// ─── Overview ───────────────────────────────────────────────────────────────

export async function getAdminOverviewMetrics() {
  try {
    const data = await getOrSetCache('admin:overview', async () => {
      const { data: viewData, error } = await supabase
        .from('admin_overview_summary')
        .select('*')
        .single();

      if (error) {
        const isMissingView = error.code === 'PGRST116'
          || error.message?.includes('does not exist')
          || error.message?.toLowerCase().includes('no rows');

        if (isMissingView) {
          const { getAdminOverviewStats } = await import('@/services/api/users.api');
          const fallback = await getAdminOverviewStats();
          if (!fallback.success) throw new Error(fallback.error || 'Fallback error');
          return normalizeOverviewMetrics(fallback.data);
        }

        const msg = error.code === 'PGRST301' ? 'Sesión expirada' : error.message;
        throw new Error(msg);
      }

      return normalizeOverviewMetrics(viewData);
    }, CACHE_TTL_MS);

    return { success: true, data };
  } catch {
    return { success: false, error: 'Error al cargar métricas del panel' };
  }
}

// ─── Reports ────────────────────────────────────────────────────────────────

export async function getAdminReportsMetrics() {
  try {
    const data = await getOrSetCache('admin:reports', async () => {
      const { data: viewData, error } = await supabase
        .from('admin_reports_summary')
        .select('*')
        .single();

      if (error) throw new Error(error.message);
      return normalizeReportsMetrics(viewData);
    }, CACHE_TTL_MS);

    return { success: true, data };
  } catch {
    return { success: false, error: 'Error al cargar resumen de reportes' };
  }
}

// ─── Logs ───────────────────────────────────────────────────────────────────

export async function getAdminLogsMetrics() {
  try {
    const data = await getOrSetCache('admin:logs', async () => {
      const { data: viewData, error } = await supabase
        .from('admin_logs_summary')
        .select('*')
        .single();

      if (error) throw new Error(error.message);
      return normalizeLogsMetrics(viewData);
    }, CACHE_TTL_MS);

    return { success: true, data };
  } catch {
    return { success: false, error: 'Error al cargar resumen de logs' };
  }
}
