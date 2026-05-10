/**
 * tests/unit/auth.oauth.test.js
 *
 * Verifica que el log de auditoría se registre correctamente
 * para logins OAuth (Google) desde onAuthStateChange en authStore.
 *
 * Casos cubiertos:
 *  1. SIGNED_IN con provider='google'     → registra 'login_google'
 *  2. SIGNED_IN con provider='github'     → registra 'login_github'
 *  3. SIGNED_IN con provider='email'      → NO registra (ya lo hace login())
 *  4. PASSWORD_RECOVERY                   → NO registra (no es un login)
 *  5. TOKEN_REFRESHED                     → NO registra
 *  6. SIGNED_OUT                          → NO registra
 *  7. SIGNED_IN OAuth sin app_metadata    → NO registra (datos incompletos)
 *  8. Fallo silencioso: insert falla      → no lanza excepción
 *
 * Ejecutar: npm test -- auth.oauth.test.js
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ─── Capturar el listener registrado en onAuthStateChange ────────────────────
let capturedAuthListener = null;

const { fromMock, mockInsert: _mockInsert } = vi.hoisted(() => {
  const mockInsert = vi.fn().mockResolvedValue({ data: null, error: null });
  const fromMock   = vi.fn().mockReturnValue({ insert: mockInsert });
  return { fromMock, mockInsert };
});

vi.mock('@/services/supabase.client', () => ({
  supabase: {
    from: fromMock,
    auth: {
      onAuthStateChange: vi.fn((cb) => {
        capturedAuthListener = cb;
        return { data: { subscription: { unsubscribe: vi.fn() } } };
      }),
      getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
    },
  },
}));

vi.mock('@/services/api/auth.api', () => ({}));

vi.mock('@/services/api/users.api', () => ({
  getUserProfile: vi.fn().mockResolvedValue({ success: false }),
}));

vi.mock('@/types', () => ({
  AsyncStateEnum: { IDLE: 'idle', LOADING: 'loading', SUCCESS: 'success' },
  UserRoleEnum:   {},
  DomainErrors:   {},
}));

// Importar después de los mocks
import { useAuthStore } from '../../src/features/auth/store/authStore.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────
function buildSession(provider) {
  return {
    user: {
      id: 'user-uuid-abc',
      app_metadata: { provider },
    },
  };
}

function resetMocks() {
  fromMock.mockClear();
  _mockInsert.mockClear();
  _mockInsert.mockResolvedValue({ data: null, error: null });
}

// Mock de @/services/metrics para evitar llamadas fetch en tests
vi.mock('@/services/metrics', () => ({
  recordTokenRefresh: vi.fn(),
  recordLoginAttempt: vi.fn(),
  recordLoginPageView: vi.fn(),
  recordLoginAbandon: vi.fn(),
  recordRegisterDuration: vi.fn(),
  recordRoleError: vi.fn(),
  recordPasswordRecovery: vi.fn(),
}));

// ─── Tests ────────────────────────────────────────────────────────────────────
describe('authStore — log de auditoría en onAuthStateChange', () => {
  beforeEach(async () => {
    vi.useFakeTimers();
    resetMocks();
    // Inicializar el store para registrar el listener
    await useAuthStore.getState().initialize();
    expect(capturedAuthListener).not.toBeNull();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('SIGNED_IN con Google registra login_google en login_audit_logs', async () => {
    capturedAuthListener('SIGNED_IN', buildSession('google'));
    await vi.runAllTimersAsync();

    expect(fromMock).toHaveBeenCalledWith('login_audit_logs');
    expect(_mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id:    'user-uuid-abc',
        event_type: 'login_google',
      })
    );
  });

  it('SIGNED_IN con GitHub registra login_github en login_audit_logs', async () => {
    capturedAuthListener('SIGNED_IN', buildSession('github'));
    await vi.runAllTimersAsync();

    expect(fromMock).toHaveBeenCalledWith('login_audit_logs');
    expect(_mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id:    'user-uuid-abc',
        event_type: 'login_github',
      })
    );
  });

  it('SIGNED_IN con email NO registra (evita duplicado con login())', async () => {
    capturedAuthListener('SIGNED_IN', buildSession('email'));
    await vi.runAllTimersAsync();

    // from() puede llamarse por getUserProfile — verificamos que NO sea login_audit_logs
    const loginLogCall = fromMock.mock.calls.find(([table]) => table === 'login_audit_logs');
    expect(loginLogCall).toBeUndefined();
  });

  it('PASSWORD_RECOVERY no registra log de acceso', async () => {
    capturedAuthListener('PASSWORD_RECOVERY', buildSession('email'));
    await vi.runAllTimersAsync();

    const loginLogCall = fromMock.mock.calls.find(([table]) => table === 'login_audit_logs');
    expect(loginLogCall).toBeUndefined();
  });

  it('TOKEN_REFRESHED no registra log de acceso', async () => {
    capturedAuthListener('TOKEN_REFRESHED', buildSession('google'));
    await vi.runAllTimersAsync();

    const loginLogCall = fromMock.mock.calls.find(([table]) => table === 'login_audit_logs');
    expect(loginLogCall).toBeUndefined();
  });

  it('SIGNED_OUT no registra log de acceso', async () => {
    capturedAuthListener('SIGNED_OUT', null);
    await vi.runAllTimersAsync();

    const loginLogCall = fromMock.mock.calls.find(([table]) => table === 'login_audit_logs');
    expect(loginLogCall).toBeUndefined();
  });

  it('SIGNED_IN OAuth sin app_metadata no registra (datos incompletos)', async () => {
    const sessionSinMeta = { user: { id: 'user-uuid-abc', app_metadata: {} } };
    capturedAuthListener('SIGNED_IN', sessionSinMeta);
    await vi.runAllTimersAsync();

    const loginLogCall = fromMock.mock.calls.find(([table]) => table === 'login_audit_logs');
    expect(loginLogCall).toBeUndefined();
  });

  it('fallo en insert no lanza excepción (log es no-bloqueante)', async () => {
    _mockInsert.mockRejectedValueOnce(new Error('network error'));

    expect(() => capturedAuthListener('SIGNED_IN', buildSession('google'))).not.toThrow();
    await vi.runAllTimersAsync();
    // Si llegamos aquí sin excepción no capturada, el test pasa
  });
});
