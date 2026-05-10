/**
 * tests/unit/adminMetrics.api.test.js
 *
 * Tests unitarios para adminMetrics.api.js
 *
 * Patrón: vi.doMock + resetModules (mismo que stores.test.js)
 * Mockea @/services/supabase.client y usa fixtures compartidos.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createMockSupabase } from '../helpers/admin.mocks';
import {
  createMockOverviewData,
  createMockReportsData,
  createMockLogsData,
  createMockFallbackStats,
  createMockError,
} from '../helpers/admin.fixtures';

// ─────────────────────────────────────────────────────────────────────────────
// getAdminOverviewMetrics
// ─────────────────────────────────────────────────────────────────────────────

describe('adminMetrics.api — getAdminOverviewMetrics', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.doMock('@/services/supabase.client', () => ({ supabase: null }));
  });

  afterEach(() => {
    vi.doUnmock('@/services/supabase.client');
    vi.doUnmock('@/services/api/users.api');
  });

  it('success: devuelve data formateada correctamente', async () => {
    const mockData = createMockOverviewData();
    const supabase = createMockSupabase({
      single: { data: mockData, error: null },
    });

    vi.doMock('@/services/supabase.client', () => ({ supabase }));

    const { getAdminOverviewMetrics } = await import('@/services/api/adminMetrics.api');
    const result = await getAdminOverviewMetrics();

    expect(result.success).toBe(true);
    expect(result.data).toEqual(mockData);
    expect(supabase._mock.from).toHaveBeenCalledWith('admin_overview_summary');
    expect(supabase._mock.single).toHaveBeenCalledOnce();
  });

  it('error de Supabase: devuelve { success: false, error }', async () => {
    const supabase = createMockSupabase({
      single: { data: null, error: createMockError('Database error') },
    });

    vi.doMock('@/services/supabase.client', () => ({ supabase }));

    const { getAdminOverviewMetrics } = await import('@/services/api/adminMetrics.api');
    const result = await getAdminOverviewMetrics();

    expect(result.success).toBe(false);
    expect(result.error).toBe('Error al cargar métricas del panel');
  });

  it('fallback: view sin datos llama a getAdminOverviewStats()', async () => {
    const supabase = createMockSupabase({
      single: {
        data: null,
        error: { code: 'PGRST116', message: 'no rows in result' },
      },
    });

    vi.doMock('@/services/supabase.client', () => ({ supabase }));

    const fallbackData = createMockFallbackStats({ totalUsers: 200 });
    vi.doMock('@/services/api/users.api', () => ({
      getAdminOverviewStats: vi.fn().mockResolvedValue({
        success: true,
        data: fallbackData,
      }),
    }));

    const { getAdminOverviewMetrics } = await import('@/services/api/adminMetrics.api');
    const result = await getAdminOverviewMetrics();

    expect(result.success).toBe(true);
    expect(result.data.totalUsers).toBe(200);
    expect(result.data.publicationsToday).toBe(fallbackData.publicationsToday);
    expect(result.data.validationsToday).toBe(fallbackData.validationsToday);
    expect(result.data.pendingReports).toBe(fallbackData.pendingReports);
    // Fallback-only fields: view fields are null
    expect(result.data.totalActiveUsers).toBeNull();
    expect(result.data.totalPublications).toBeNull();
    expect(result.data.activePublications).toBeNull();
    expect(result.data.totalOrders).toBeNull();
    expect(result.data.activeOrders).toBeNull();
    expect(result.data.activeStores).toBeNull();
    expect(result.data.activeProducts).toBeNull();
    expect(result.data.activeDealers).toBeNull();
    expect(result.data.pendingDealerApplications).toBeNull();
    expect(result.data.loginsLast24h).toBeNull();
  });

  it('fallback: cuando fallback también falla, propaga el error', async () => {
    const supabase = createMockSupabase({
      single: {
        data: null,
        error: { code: 'PGRST116', message: 'no rows in result' },
      },
    });

    vi.doMock('@/services/supabase.client', () => ({ supabase }));

    vi.doMock('@/services/api/users.api', () => ({
      getAdminOverviewStats: vi.fn().mockResolvedValue({
        success: false,
        error: 'Fallback API error',
      }),
    }));

    const { getAdminOverviewMetrics } = await import('@/services/api/adminMetrics.api');
    const result = await getAdminOverviewMetrics();

    expect(result.success).toBe(false);
    expect(result.error).toBe('Error al cargar métricas del panel');
  });

  it('estructura del return: { success, data: { overview, reports, logs } }', async () => {
    const mockData = createMockOverviewData();
    const supabase = createMockSupabase({
      single: { data: mockData, error: null },
    });

    vi.doMock('@/services/supabase.client', () => ({ supabase }));

    const { getAdminOverviewMetrics } = await import('@/services/api/adminMetrics.api');
    const result = await getAdminOverviewMetrics();

    expect(result).toHaveProperty('success', true);
    expect(result).toHaveProperty('data');
    expect(result.data).toHaveProperty('totalUsers');
    expect(result.data).toHaveProperty('publicationsToday');
    expect(result.data).toHaveProperty('pendingReports');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// getAdminReportsMetrics
// ─────────────────────────────────────────────────────────────────────────────

describe('adminMetrics.api — getAdminReportsMetrics', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.doUnmock('@/services/supabase.client');
  });

  it('success con datos', async () => {
    const mockData = createMockReportsData();
    const supabase = createMockSupabase({
      single: { data: mockData, error: null },
    });

    vi.doMock('@/services/supabase.client', () => ({ supabase }));

    const { getAdminReportsMetrics } = await import('@/services/api/adminMetrics.api');
    const result = await getAdminReportsMetrics();

    expect(result.success).toBe(true);
    expect(result.data).toEqual(mockData);
    expect(result.data).toHaveProperty('pendingBacklog');
    expect(result.data).toHaveProperty('breakdownByReason');
    expect(result.data).toHaveProperty('latestPendingReports');
    expect(supabase._mock.from).toHaveBeenCalledWith('admin_reports_summary');
  });

  it('error handling', async () => {
    const supabase = createMockSupabase({
      single: { data: null, error: createMockError('Reports fetch failed') },
    });

    vi.doMock('@/services/supabase.client', () => ({ supabase }));

    const { getAdminReportsMetrics } = await import('@/services/api/adminMetrics.api');
    const result = await getAdminReportsMetrics();

    expect(result.success).toBe(false);
    expect(result.error).toBe('Error al cargar resumen de reportes');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// getAdminLogsMetrics
// ─────────────────────────────────────────────────────────────────────────────

describe('adminMetrics.api — getAdminLogsMetrics', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.doUnmock('@/services/supabase.client');
  });

  it('success con datos', async () => {
    const mockData = createMockLogsData();
    const supabase = createMockSupabase({
      single: { data: mockData, error: null },
    });

    vi.doMock('@/services/supabase.client', () => ({ supabase }));

    const { getAdminLogsMetrics } = await import('@/services/api/adminMetrics.api');
    const result = await getAdminLogsMetrics();

    expect(result.success).toBe(true);
    expect(result.data).toEqual(mockData);
    expect(result.data).toHaveProperty('loginEvents24h');
    expect(result.data).toHaveProperty('latestEvents');
    expect(supabase._mock.from).toHaveBeenCalledWith('admin_logs_summary');
  });

  it('error handling', async () => {
    const supabase = createMockSupabase({
      single: { data: null, error: createMockError('Logs fetch failed') },
    });

    vi.doMock('@/services/supabase.client', () => ({ supabase }));

    const { getAdminLogsMetrics } = await import('@/services/api/adminMetrics.api');
    const result = await getAdminLogsMetrics();

    expect(result.success).toBe(false);
    expect(result.error).toBe('Error al cargar resumen de logs');
  });
});
