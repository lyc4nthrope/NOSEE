/**
 * tests/unit/adminConfig.api.test.js
 *
 * Tests unitarios para adminConfig.api.js
 *
 * Patrón: vi.doMock + resetModules (mismo que stores.test.js)
 * Mockea @/services/supabase.client y usa fixtures compartidos.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createMockSupabase } from '../helpers/admin.mocks';
import {
  createMockReputationConfig,
  createMockError,
} from '../helpers/admin.fixtures';

// ─────────────────────────────────────────────────────────────────────────────
// getReputationConfig
// ─────────────────────────────────────────────────────────────────────────────

describe('adminConfig.api — getReputationConfig', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.doUnmock('@/services/supabase.client');
  });

  it('success: devuelve array de parámetros', async () => {
    const configData = createMockReputationConfig();
    const supabase = createMockSupabase({
      order: { data: configData, error: null },
    });

    vi.doMock('@/services/supabase.client', () => ({ supabase }));

    const { getReputationConfig } = await import('@/services/api/adminConfig.api');
    const result = await getReputationConfig();

    expect(result.success).toBe(true);
    expect(Array.isArray(result.data)).toBe(true);
    expect(result.data).toHaveLength(6);
    expect(result.data[0]).toHaveProperty('param');
    expect(result.data[0]).toHaveProperty('value');
    expect(result.data[0]).toHaveProperty('note');
    expect(supabase._mock.from).toHaveBeenCalledWith('reputation_config');
    expect(supabase._mock.order).toHaveBeenCalled();
  });

  it('data es null → devuelve array vacío', async () => {
    const supabase = createMockSupabase({
      order: { data: null, error: null },
    });

    vi.doMock('@/services/supabase.client', () => ({ supabase }));

    const { getReputationConfig } = await import('@/services/api/adminConfig.api');
    const result = await getReputationConfig();

    expect(result.success).toBe(true);
    expect(result.data).toEqual([]);
  });

  it('error handling', async () => {
    const supabase = createMockSupabase({
      order: { data: null, error: createMockError('Config fetch error') },
    });

    vi.doMock('@/services/supabase.client', () => ({ supabase }));

    const { getReputationConfig } = await import('@/services/api/adminConfig.api');
    const result = await getReputationConfig();

    expect(result.success).toBe(false);
    expect(result.error).toBe('Error al cargar configuración');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// updateReputationParam
// ─────────────────────────────────────────────────────────────────────────────

describe('adminConfig.api — updateReputationParam', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.doUnmock('@/services/supabase.client');
  });

  it('success: devuelve { success: true }', async () => {
    const supabase = createMockSupabase({
      getUser: { data: { user: { id: 'admin-uuid' } }, error: null },
      updateResult: { data: null, error: null },
    });

    vi.doMock('@/services/supabase.client', () => ({ supabase }));

    const { updateReputationParam } = await import('@/services/api/adminConfig.api');
    const result = await updateReputationParam(1, '+10');

    expect(result.success).toBe(true);
    expect(supabase._mock.getUser).toHaveBeenCalledOnce();
    expect(supabase._mock.from).toHaveBeenCalledWith('reputation_config');
  });

  it('error: usuario no autenticado', async () => {
    const supabase = createMockSupabase({
      getUser: { data: { user: null }, error: null },
    });

    vi.doMock('@/services/supabase.client', () => ({ supabase }));

    const { updateReputationParam } = await import('@/services/api/adminConfig.api');
    const result = await updateReputationParam(1, '+10');

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/autenticado/i);
    expect(supabase._mock.from).not.toHaveBeenCalled();
  });

  it('error: update falla en Supabase', async () => {
    const supabase = createMockSupabase({
      getUser: { data: { user: { id: 'admin-uuid' } }, error: null },
      updateResult: { data: null, error: createMockError('Update failed') },
    });

    vi.doMock('@/services/supabase.client', () => ({ supabase }));

    const { updateReputationParam } = await import('@/services/api/adminConfig.api');
    const result = await updateReputationParam(5, '100');

    expect(result.success).toBe(false);
    expect(result.error).toBe('Error al procesar la solicitud');
  });
});
