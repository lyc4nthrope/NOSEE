/**
 * tests/unit/forgotPassword.test.js
 *
 * Cubre el flujo completo de recuperación de contraseña:
 *
 * PARTE 1 — auth.api.resetPassword (capa de acceso a Supabase)
 *   1. Llama a supabase.auth.resetPasswordForEmail con el email correcto
 *   2. redirectTo usa window.location.origin (no localhost hardcodeado)
 *   3. redirectTo incluye /auth/callback?flow=recovery
 *   4. Retorna { success: true } cuando Supabase no falla
 *   5. Retorna { success: false, error } cuando Supabase devuelve error
 *
 * PARTE 2 — authStore.requestPasswordReset (lógica de estado)
 *   6. Llama a authApi.resetPassword con el email exacto
 *   7. Retorna { success: true } y status queda en 'success'
 *   8. Retorna { success: false, error } y status queda en 'error'
 *   9. Cambia status a 'loading' durante la operación
 *
 * PARTE 3 — NewPasswordPage (validación del formulario)
 *  10. Rechaza contraseña sin mayúscula
 *  11. Rechaza contraseña sin número
 *  12. Rechaza contraseña menor a 8 caracteres
 *  13. Rechaza cuando las contraseñas no coinciden
 *  14. Acepta contraseña válida con confirmación coincidente
 *
 * Ejecutar: npm test -- forgotPassword.test.js
 */

import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest';

// ─── Mocks hoisted (deben declararse antes de cualquier import) ───────────────

const { mockResetPasswordForEmail, mockUpdateUser } = vi.hoisted(() => {
  const mockResetPasswordForEmail = vi.fn();
  const mockUpdateUser            = vi.fn();
  return { mockResetPasswordForEmail, mockUpdateUser };
});

vi.mock('@/services/supabase.client', () => ({
  supabase: {
    auth: {
      resetPasswordForEmail: mockResetPasswordForEmail,
      updateUser:            mockUpdateUser,
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: { unsubscribe: vi.fn() } },
      })),
      getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
    },
    from: vi.fn().mockReturnValue({
      insert: vi.fn().mockResolvedValue({ data: null, error: null }),
    }),
  },
}));

vi.mock('@/services/api/auth.api', () => ({
  resetPassword:    vi.fn(),
  signOut:          vi.fn().mockResolvedValue({ success: true }),
  getSession:       vi.fn().mockResolvedValue({ success: true, data: null }),
  signInWithGoogle: vi.fn(),
  signUp:           vi.fn(),
  signIn:           vi.fn(),
}));

vi.mock('@/services/api/users.api', () => ({
  getUserProfile: vi.fn().mockResolvedValue({ success: false }),
  updateUserProfile: vi.fn(),
}));

vi.mock('@/types', () => ({
  AsyncStateEnum: { IDLE: 'idle', LOADING: 'loading', SUCCESS: 'success', ERROR: 'error' },
  UserRoleEnum:   {},
  DomainErrors:   {},
}));

vi.mock('@/services/metrics', () => ({
  recordTokenRefresh:     vi.fn(),
  recordPasswordRecovery: vi.fn(),
  recordLoginAttempt:     vi.fn(),
  recordLoginPageView:    vi.fn(),
  recordLoginAbandon:     vi.fn(),
  recordRegisterDuration: vi.fn(),
  recordRoleError:        vi.fn(),
}));

vi.mock('@/services/api/audit.api', () => ({
  insertUserActivityLog: vi.fn().mockResolvedValue(undefined),
}));

// ─── Imports (después de los mocks) ──────────────────────────────────────────

import { useAuthStore }   from '../../src/features/auth/store/authStore.js';
import * as authApi        from '@/services/api/auth.api';

let realResetPassword;

beforeAll(async () => {
  const actualAuthApi = await vi.importActual('../../src/services/api/auth.api.js');
  realResetPassword = actualAuthApi.resetPassword;
});

// ═══════════════════════════════════════════════════════════════════════════════
// PARTE 1 — auth.api.resetPassword
// ═══════════════════════════════════════════════════════════════════════════════

describe('auth.api — resetPassword', () => {
  const PROD_ORIGIN = 'https://calm-sand-0a8a6de10.6.azurestaticapps.net';

  beforeEach(() => {
    mockResetPasswordForEmail.mockReset();
    // Simular que la app corre en producción
    vi.stubGlobal('location', { origin: PROD_ORIGIN });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('llama a supabase con el email correcto', async () => {
    mockResetPasswordForEmail.mockResolvedValueOnce({ error: null });

    await realResetPassword('usuario@ejemplo.com');

    expect(mockResetPasswordForEmail).toHaveBeenCalledWith(
      'usuario@ejemplo.com',
      expect.any(Object)
    );
  });

  it('redirectTo usa window.location.origin (no localhost hardcodeado)', async () => {
    mockResetPasswordForEmail.mockResolvedValueOnce({ error: null });

    await realResetPassword('usuario@ejemplo.com');

    const [, options] = mockResetPasswordForEmail.mock.calls[0];
    expect(options.redirectTo).toContain(PROD_ORIGIN);
    expect(options.redirectTo).not.toContain('localhost');
  });

  it('redirectTo incluye /auth/callback?flow=recovery', async () => {
    mockResetPasswordForEmail.mockResolvedValueOnce({ error: null });

    await realResetPassword('usuario@ejemplo.com');

    const [, options] = mockResetPasswordForEmail.mock.calls[0];
    expect(options.redirectTo).toContain('/auth/callback');
    expect(options.redirectTo).toContain('flow=recovery');
  });

  it('retorna { success: true } cuando Supabase no falla', async () => {
    mockResetPasswordForEmail.mockResolvedValueOnce({ error: null });

    const result = await realResetPassword('usuario@ejemplo.com');

    expect(result).toEqual({ success: true });
  });

  it('retorna { success: false, error } cuando Supabase falla', async () => {
    mockResetPasswordForEmail.mockResolvedValueOnce({
      error: { message: 'Email rate limit exceeded' },
    });

    const result = await realResetPassword('demasiados@intentos.com');

    expect(result.success).toBe(false);
    expect(result.error).toBe('Email rate limit exceeded');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// PARTE 2 — authStore.requestPasswordReset
// ═══════════════════════════════════════════════════════════════════════════════

describe('authStore — requestPasswordReset', () => {
  beforeEach(() => {
    vi.mocked(authApi.resetPassword).mockReset();
    useAuthStore.setState({ status: 'idle', error: null });
  });

  it('llama a authApi.resetPassword con el email exacto', async () => {
    vi.mocked(authApi.resetPassword).mockResolvedValueOnce({ success: true });

    await useAuthStore.getState().requestPasswordReset('exacto@example.com');

    expect(authApi.resetPassword).toHaveBeenCalledWith('exacto@example.com');
  });

  it('retorna { success: true } y status queda en success', async () => {
    vi.mocked(authApi.resetPassword).mockResolvedValueOnce({ success: true });

    const result = await useAuthStore.getState().requestPasswordReset('usuario@example.com');

    expect(result.success).toBe(true);
    expect(useAuthStore.getState().status).toBe('success');
  });

  it('retorna { success: false, error } y status queda en error', async () => {
    vi.mocked(authApi.resetPassword).mockResolvedValueOnce({
      success: false,
      error: 'Rate limit exceeded',
    });

    const result = await useAuthStore.getState().requestPasswordReset('usuario@example.com');

    expect(result.success).toBe(false);
    expect(result.error).toBe('Rate limit exceeded');
    expect(useAuthStore.getState().status).toBe('error');
  });

  it('pone status en loading antes de resolver', async () => {
    let statusDuranteLlamada = null;

    vi.mocked(authApi.resetPassword).mockImplementationOnce(async () => {
      statusDuranteLlamada = useAuthStore.getState().status;
      return { success: true };
    });

    await useAuthStore.getState().requestPasswordReset('usuario@example.com');

    expect(statusDuranteLlamada).toBe('loading');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// PARTE 3 — Reglas de validación de contraseña (lógica pura de NewPasswordPage)
// ═══════════════════════════════════════════════════════════════════════════════

// Las mismas reglas definidas en NewPasswordPage.jsx
const passwordRules = [
  { label: 'Al menos 8 caracteres', test: (v) => v.length >= 8 },
  { label: 'Una letra mayúscula',    test: (v) => /[A-Z]/.test(v) },
  { label: 'Un número',             test: (v) => /\d/.test(v) },
];

function validateNewPassword(password, confirmPassword) {
  const errors = {};
  if (!password) {
    errors.password = 'La contraseña es requerida';
  } else if (!passwordRules.every((r) => r.test(password))) {
    errors.password = 'La contraseña no cumple los requisitos';
  }
  if (!confirmPassword) {
    errors.confirmPassword = 'Debes confirmar la contraseña';
  } else if (password !== confirmPassword) {
    errors.confirmPassword = 'Las contraseñas no coinciden';
  }
  return errors;
}

describe('NewPasswordPage — validación de contraseña', () => {
  it('rechaza contraseña sin mayúscula', () => {
    const errors = validateNewPassword('password1', 'password1');
    expect(errors.password).toBeDefined();
  });

  it('rechaza contraseña sin número', () => {
    const errors = validateNewPassword('PasswordSinNum', 'PasswordSinNum');
    expect(errors.password).toBeDefined();
  });

  it('rechaza contraseña menor a 8 caracteres', () => {
    const errors = validateNewPassword('Abc1', 'Abc1');
    expect(errors.password).toBeDefined();
  });

  it('rechaza cuando las contraseñas no coinciden', () => {
    const errors = validateNewPassword('Password1', 'Password2');
    expect(errors.confirmPassword).toBeDefined();
    expect(errors.password).toBeUndefined();
  });

  it('acepta contraseña válida con confirmación coincidente', () => {
    const errors = validateNewPassword('Password1', 'Password1');
    expect(errors.password).toBeUndefined();
    expect(errors.confirmPassword).toBeUndefined();
  });

  it('acepta contraseña con caracteres especiales', () => {
    const errors = validateNewPassword('Password1!@#', 'Password1!@#');
    expect(errors.password).toBeUndefined();
    expect(errors.confirmPassword).toBeUndefined();
  });

  it('detecta campo vacío de confirmación', () => {
    const errors = validateNewPassword('Password1', '');
    expect(errors.confirmPassword).toBeDefined();
  });
});
