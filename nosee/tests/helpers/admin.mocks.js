/**
 * tests/helpers/admin.mocks.js
 *
 * Mocks reutilizables para tests del panel admin NØSEE.
 *
 * createMockSupabase() — crea un mock de supabase.config.js configurable
 * para las cadenas de llamadas usadas por adminMetrics.api y adminConfig.api.
 *
 * Los mocks expuestos en `_mock` permiten assertions adicionales:
 *   supabase._mock.from     — vi.fn() para from()
 *   supabase._mock.maybeSingle — vi.fn() que resuelve maybeSingle
 *   supabase._mock.order    — vi.fn() que resuelve order()
 *   supabase._mock.getUser  — vi.fn() para auth.getUser()
 *   supabase._mock.updateEq — vi.fn() que resuelve update().eq()
 */
import { vi } from 'vitest';

/**
 * @param {Object} options
 * @param {Object} [options.maybeSingle] - Resuelto por .maybeSingle() ej: { data, error }
 * @param {Object} [options.single]      - Resuelto por .single() ej: { data, error }
 * @param {Object} [options.order]       - Resuelto por .order() ej: { data, error }
 * @param {Object} [options.getUser]     - Resuelto por auth.getUser() ej: { data: { user }, error }
 * @param {Object|null} [options.updateResult] - Resuelto por update().eq() ej: { error } o null
 */
export function createMockSupabase(options = {}) {
  const {
    maybeSingle = { data: null, error: null },
    single = maybeSingle,
    order = { data: [], error: null },
    getUser = { data: { user: { id: 'admin-uuid' } }, error: null },
    updateResult = null,
  } = options;

  const mockMaybeSingle = vi.fn().mockResolvedValue(maybeSingle);
  const mockSingle = vi.fn().mockResolvedValue(single);
  const mockOrder = vi.fn().mockResolvedValue(order);
  const mockSelectEq = vi.fn(() => ({ maybeSingle: mockMaybeSingle, single: mockSingle }));
  const mockUpdateEq = vi.fn().mockResolvedValue(
    updateResult !== null ? updateResult : { data: null, error: null }
  );
  const mockSelect = vi.fn(() => ({
    maybeSingle: mockMaybeSingle,
    single: mockSingle,
    order: mockOrder,
    eq: mockSelectEq,
  }));
  const mockUpdate = vi.fn(() => ({ eq: mockUpdateEq }));
  const mockFrom = vi.fn(() => ({
    select: mockSelect,
    update: mockUpdate,
    eq: mockSelectEq,
  }));
  const mockGetUser = vi.fn().mockResolvedValue(getUser);
  const mockRpc = vi.fn().mockResolvedValue({ data: null, error: null });

  return {
    auth: { getUser: mockGetUser },
    from: mockFrom,
    rpc: mockRpc,
    _mock: {
      from: mockFrom,
      select: mockSelect,
      maybeSingle: mockMaybeSingle,
      single: mockSingle,
      order: mockOrder,
      selectEq: mockSelectEq,
      updateEq: mockUpdateEq,
      update: mockUpdate,
      getUser: mockGetUser,
      rpc: mockRpc,
    },
  };
}
