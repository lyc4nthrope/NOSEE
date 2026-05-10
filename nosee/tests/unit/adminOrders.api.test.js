/**
 * tests/unit/adminOrders.api.test.js
 *
 * Tests unitarios para adminOrders.api.js
 *
 * Patrón: vi.doMock + resetModules (mismo que tests existentes)
 * Mockea @/services/supabase.client usando chainable mocks.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createMockError } from '../helpers/admin.fixtures';

// ─── Mock chainable ──────────────────────────────────────────────────────────

function createChainableMock(result) {
  const r = result || { data: [], error: null };
  const builder = {
    select: vi.fn(() => builder),
    order: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    range: vi.fn(() => builder),
    ilike: vi.fn(() => builder),
    insert: vi.fn(() => builder),
    update: vi.fn(() => builder),
    maybeSingle: vi.fn(() => Promise.resolve(r)),
    single: vi.fn(() => Promise.resolve(r)),
    then: (resolve) => Promise.resolve(r).then(resolve),
  };
  return builder;
}

// ─── Datos de prueba ─────────────────────────────────────────────────────────

const mockOrders = [
  {
    id: 'order-1', local_id: 'LOC-001', status: 'delivered',
    total_estimated: 2500, total_real: 2450, delivery_fee: 500,
    service_fee: 200, savings_percentage: 2, strategy: 'cheapest',
    delivery_mode: 'delivery', created_at: '2026-05-01T00:00:00Z',
    user_id: 'user-1', dealer_id: 'dealer-1',
  },
  {
    id: 'order-2', local_id: 'LOC-002', status: 'pending',
    total_estimated: 1800, total_real: null, delivery_fee: 400,
    service_fee: 150, savings_percentage: null, strategy: 'fastest',
    delivery_mode: 'pickup', created_at: '2026-05-02T00:00:00Z',
    user_id: 'user-2', dealer_id: null,
  },
  {
    id: 'order-3', local_id: 'LOC-003', status: 'cancelled',
    total_estimated: 3200, total_real: 0, delivery_fee: 600,
    service_fee: 300, savings_percentage: 5, strategy: 'cheapest',
    delivery_mode: 'delivery', created_at: '2026-05-03T00:00:00Z',
    user_id: 'user-1', dealer_id: 'dealer-2',
  },
];

const mockPayments = [
  {
    id: 'pay-1', order_id: 'order-1', amount: 2450,
    payment_method: 'card', status: 'completed', created_at: '2026-05-01T01:00:00Z',
  },
  {
    id: 'pay-2', order_id: 'order-2', amount: 1800,
    payment_method: 'cash', status: 'pending', created_at: '2026-05-02T01:00:00Z',
  },
];

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('adminOrders.api', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.doUnmock('@/services/supabase.client');
  });

  // ── getAdminOrders ─────────────────────────────────────────────────────────

  describe('getAdminOrders', () => {
    it('success con datos (página por defecto)', async () => {
      const mock = createChainableMock({ data: mockOrders, error: null });
      const supabase = { from: vi.fn(() => mock) };
      vi.doMock('@/services/supabase.client', () => ({ supabase }));

      const { getAdminOrders } = await import('@/services/api/adminOrders.api');
      const result = await getAdminOrders();

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockOrders);
      expect(result.data).toHaveLength(3);
      expect(supabase.from).toHaveBeenCalledWith('orders');
      expect(mock.range).toHaveBeenCalledWith(0, 19);
    });

    it('success con página 2 (page=1, pageSize=20)', async () => {
      const mock = createChainableMock({ data: [], error: null });
      const supabase = { from: vi.fn(() => mock) };
      vi.doMock('@/services/supabase.client', () => ({ supabase }));

      const { getAdminOrders } = await import('@/services/api/adminOrders.api');
      const result = await getAdminOrders({ page: 1, pageSize: 20 });

      expect(result.success).toBe(true);
      expect(mock.range).toHaveBeenCalledWith(20, 39);
    });

    it('success con pageSize custom', async () => {
      const mock = createChainableMock({ data: [mockOrders[0]], error: null });
      const supabase = { from: vi.fn(() => mock) };
      vi.doMock('@/services/supabase.client', () => ({ supabase }));

      const { getAdminOrders } = await import('@/services/api/adminOrders.api');
      const result = await getAdminOrders({ page: 0, pageSize: 1 });

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(mock.range).toHaveBeenCalledWith(0, 0);
    });

    it('error: devuelve { success: false, error }', async () => {
      const mock = createChainableMock({ data: null, error: createMockError('DB error') });
      const supabase = { from: vi.fn(() => mock) };
      vi.doMock('@/services/supabase.client', () => ({ supabase }));

      const { getAdminOrders } = await import('@/services/api/adminOrders.api');
      const result = await getAdminOrders();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Error al procesar la solicitud');
    });
  });

  // ── getAdminPayments ───────────────────────────────────────────────────────

  describe('getAdminPayments', () => {
    it('success: devuelve pagos', async () => {
      const mock = createChainableMock({ data: mockPayments, error: null });
      const supabase = { from: vi.fn(() => mock) };
      vi.doMock('@/services/supabase.client', () => ({ supabase }));

      const { getAdminPayments } = await import('@/services/api/adminOrders.api');
      const result = await getAdminPayments();

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockPayments);
      expect(supabase.from).toHaveBeenCalledWith('payments');
      expect(mock.limit).toHaveBeenCalledWith(100);
    });

    it('error: devuelve { success: false, error }', async () => {
      const mock = createChainableMock({ data: null, error: createMockError('DB error') });
      const supabase = { from: vi.fn(() => mock) };
      vi.doMock('@/services/supabase.client', () => ({ supabase }));

      const { getAdminPayments } = await import('@/services/api/adminOrders.api');
      const result = await getAdminPayments();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Error al procesar la solicitud');
    });
  });
});
