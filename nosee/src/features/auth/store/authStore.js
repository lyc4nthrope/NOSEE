/**
 * Auth Store - Estado Global de Autenticación
 *
 * PROPÓSITO:
 * Este archivo es el "cerebro" de la autenticación en la UI.
 * Cualquier componente de la app puede suscribirse a este store
 * para saber: ¿hay un usuario logueado? ¿quién es? ¿está cargando?
 *
 * FLUJO COMPLETO:
 * 1. App arranca → initialize() consulta si hay sesión activa
 * 2. Usuario hace login → login() llama a authApi, guarda user en state
 * 3. Componente Navbar → lee `user` del store y muestra el nombre
 * 4. Usuario hace logout → logout() limpia el state
 * 5. Supabase detecta token expirado → onAuthStateChange lo notifica → store se actualiza
 *
 * CORRECCIONES APLICADAS:
 * - Fix 1: initialize() guarda el unsubscribe y evita crear un segundo listener
 *          si se llama dos veces (React StrictMode lo hace en desarrollo).
 * - Fix 2: onAuthStateChange ahora maneja TOKEN_REFRESHED → actualiza `session`
 *          para que el token en el store nunca quede stale.
 * - Fix 3: DomainErrors ya existe en @/types (se exporta desde allí).
 *
 * UBICACIÓN CORRECTA EN EL PROYECTO:
 * nosee/src/features/auth/store/authStore.js
 */

import { create } from 'zustand';

import * as authApi from '@/services/api/auth.api';
import * as usersApi from '@/services/api/users.api';
import { supabase }          from '@/services/supabase.client';
import { AsyncStateEnum }    from '@/types';
import { insertUserActivityLog } from '@/services/api/audit.api';
import { recordTokenRefresh } from '@/services/metrics';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const insertAuditLog = async (userId, eventType, metadata = {}) => {
  try {
    await supabase.from('login_audit_logs').insert({
      user_id:    userId || null,
      event_type: eventType,
      user_agent: navigator.userAgent,
      metadata,
    });
  } catch (_) {
    // No bloquear el flujo por un log fallido
  }
};

// ─────────────────────────────────────────────────────────────────
// ESTADO INICIAL
// ─────────────────────────────────────────────────────────────────
const initialState = {
  user:          null,
  session:       null,
  status:        AsyncStateEnum.IDLE,
  error:         null,
  isInitialized: false,

  // Cuando Supabase dispara PASSWORD_RECOVERY, el usuario tiene una sesión
  // temporal de recuperación. Lo marcamos aquí para que NINGÚN componente
  // lo trate como autenticado y lo redirija antes de que cambie su contraseña.
  isRecoveryMode: false,

  // FIX StrictMode: guardamos la función de unsubscribe del listener de Supabase.
  // Si initialize() se llama de nuevo antes de que el listener anterior se limpie,
  // lo cancelamos primero para no acumular suscripciones duplicadas.
  _unsubscribeAuthListener: null,
  _roleChangeNotification:  null,
};

// ─────────────────────────────────────────────────────────────────
// STORE
// ─────────────────────────────────────────────────────────────────
export const useAuthStore = create((set, get) => ({

  ...initialState,


  // ════════════════════════════════════════════════════════════════
  // ACCIÓN: initialize
  // ════════════════════════════════════════════════════════════════
  initialize: async () => {
    // FIX StrictMode ─────────────────────────────────────────────
    // React StrictMode (dev) desmonta y vuelve a montar los componentes.
    // Si el componente que llama initialize() lo hace dos veces, aquí
    // cancelamos el listener anterior antes de crear uno nuevo.
    const existingUnsub = get()._unsubscribeAuthListener;
    if (existingUnsub) {
      existingUnsub();
      set({ _unsubscribeAuthListener: null });
    }
    // ────────────────────────────────────────────────────────────

    set({ status: AsyncStateEnum.LOADING });

    try {
      const sessionResult = await authApi.getSession();
      if (!sessionResult?.success) {
        throw new Error(sessionResult?.error || 'No se pudo obtener la sesión actual\nCould not retrieve the current session');
      }
      const sessionData = sessionResult.data;

      if (sessionData) {
        const profileResult = await usersApi.getUserProfile(sessionData.user.id);

        const mappedUser = profileResult.success
          ? profileResult.data
          : { id: sessionData.user.id, email: sessionData.user.email };

        set({
          user:          mappedUser,
          session:       sessionData,
          status:        AsyncStateEnum.SUCCESS,
          isInitialized: true,
        });
      } else {
        set({
          user:          null,
          session:       null,
          status:        AsyncStateEnum.IDLE,
          isInitialized: true,
        });
      }
    } catch (error) {
      set({
        user:          null,
        session:       null,
        status:        AsyncStateEnum.ERROR,
        error:         error?.message || 'Error al inicializar la sesión\nError initializing session',
        isInitialized: true,
      });
    }

    // ── Listener de cambios de sesión ────────────────────────────
    // FIX TOKEN_REFRESHED: añadimos el evento para mantener `session`
    // actualizada cuando Supabase renueva el access_token automáticamente.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        // IMPORTANTE: este callback es llamado por _notifyAllSubscribers() mientras
        // Supabase retiene el auth lock. Cualquier llamada a supabase.from().select()
        // dentro de este callback invocaría _getAccessToken() → auth.getSession()
        // → intento de adquirir el mismo lock → DEADLOCK (timeout 10 s).
        //
        // Regla: NO hacer await de operaciones que usen supabase.from() aquí.
        // Usar setTimeout(0) para diferirlas fuera del lock.

        if (event === 'SIGNED_IN' && session) {

          // Recovery flow (PKCE): el store ya tiene isRecoveryMode=true porque
          // CallbackPage lo setea ANTES de llamar exchangeCodeForSession.
          // No autenticamos al usuario — el cliente Supabase tiene la sesión
          // internamente para que updateUser() funcione en NewPasswordPage.
          if (get().isRecoveryMode) return;

          const currentUser = get().user;

          // Si ya tenemos este usuario con rol válido, solo actualizamos la sesión.
          if (currentUser?.id === session.user.id && (currentUser?.role || get().status === AsyncStateEnum.SUCCESS)) {
            set({ session });
            return;
          }

          // Guardar sesión y usuario mínimo inmediatamente para que
          // isAuthenticated sea true y CallbackPage pueda navegar.
          set({
            user:    currentUser?.id === session.user.id
              ? currentUser
              : { id: session.user.id, email: session.user.email },
            session,
            status:  AsyncStateEnum.SUCCESS,
            error:   null,
          });

          // Diferir todo lo que usa supabase.from() (rompe el deadlock del lock).
          setTimeout(async () => {
            // Registrar acceso OAuth (no 'email' para evitar duplicado con login())
            const provider = session.user.app_metadata?.provider;
            if (provider && provider !== 'email') {
              insertAuditLog(session.user.id, `login_${provider}`);
            }

            const profileResult = await usersApi.getUserProfile(session.user.id);

            if (!profileResult.success) {
              // Conservar datos actuales si el fetch falla
              return;
            }

            // Detectar cambio de rol para notificar al usuario
            const previousRole = get().user?.role;
            const newRole = profileResult.data?.role;
            if (previousRole && newRole && previousRole !== newRole) {
              set({ _roleChangeNotification: newRole });
            }

            set({
              user:    profileResult.data,
              session,
              status:  AsyncStateEnum.SUCCESS,
              error:   null,
            });
          }, 0);

        } else if (event === 'PASSWORD_RECOVERY' && session) {
          // Sesión temporal de recuperación: marcamos el modo recovery pero
          // NO autenticamos al usuario en el store. Así ningún componente lo
          // redirige a su dashboard antes de que cambie la contraseña.
          // El cliente Supabase ya tiene la sesión internamente → updateUser() funciona.
          set({ isRecoveryMode: true });
          setTimeout(() => {
            insertUserActivityLog(session.user.id, 'restablecimiento_contrasena', {});
          }, 0);

        } else if (event === 'TOKEN_REFRESHED' && session) {
          set({ session });
          recordTokenRefresh('success');

        } else if (event === 'SIGNED_OUT') {
          set({
            user:           null,
            session:        null,
            status:         AsyncStateEnum.IDLE,
            error:          null,
            isRecoveryMode: false,
          });
        }
      }
    );

    // FIX StrictMode: guardamos el unsubscribe para poder cancelarlo
    // si initialize() se vuelve a ejecutar (doble mount en StrictMode).
    set({ _unsubscribeAuthListener: () => subscription.unsubscribe() });
  },


  // ════════════════════════════════════════════════════════════════
  // ACCIÓN: login
  // ════════════════════════════════════════════════════════════════
  login: async (email, password) => {
    set({ status: AsyncStateEnum.LOADING, error: null });

    const result = await authApi.signIn(email, password);

    if (!result.success) {
      set({ status: AsyncStateEnum.ERROR, error: result.error });
      insertAuditLog(null, 'login_fallido', { attemptedEmail: email });
      return { success: false, error: result.error };
    }

    const profileResult = await usersApi.getUserProfile(result.data.user.id);

    const mappedUser = profileResult.success
      ? profileResult.data
      : { id: result.data.user.id, email: result.data.user.email };

      if (mappedUser?.isActive === false) {
      await authApi.signOut();
      set({
        user: null,
        session: null,
        status: AsyncStateEnum.ERROR,
        error: 'Tu cuenta está desactivada. Contacta a soporte.\nYour account is deactivated. Contact support.',
      });
      return {
        success: false,
        error: 'Tu cuenta está desactivada. Contacta a soporte.\nYour account is deactivated. Contact support.',
      };
    }

    set({
      user:             mappedUser,
      session:          result.data.session,
      status:           AsyncStateEnum.SUCCESS,
      error:            null,
      isRecoveryMode:   false,
    });

    await insertAuditLog(result.data.user.id, 'login');

    return { success: true, error: null };
  },

// ════════════════════════════════════════════════════════════════
  // ACCIÓN: loginWithGoogle
  // ════════════════════════════════════════════════════════════════
  loginWithGoogle: async () => {
    set({ status: AsyncStateEnum.LOADING, error: null });

    const result = await authApi.signInWithGoogle();

    if (!result.success) {
      set({ status: AsyncStateEnum.ERROR, error: result.error });
      return { success: false, error: result.error };
    }

    // OAuth redirige fuera de la app; mantenemos estado consistente.
    set({ status: AsyncStateEnum.IDLE, error: null });
    return { success: true, error: null };
  },


  // ════════════════════════════════════════════════════════════════
  // ACCIÓN: register
  // ════════════════════════════════════════════════════════════════
register: async (email, password, metadata = {}) => {
  set({ status: AsyncStateEnum.LOADING, error: null });

  const signUpResult = await authApi.signUp(email, password, metadata.fullName);

  if (!signUpResult.success) {
    set({ status: AsyncStateEnum.ERROR, error: signUpResult.error });
    return { success: false, error: signUpResult.error, needsVerification: false };
  }

  const needsVerification = !signUpResult.data.session;
  set({ status: AsyncStateEnum.SUCCESS });
  return { success: true, error: null, needsVerification };
},


  // ════════════════════════════════════════════════════════════════
  // ACCIÓN: logout
  // ════════════════════════════════════════════════════════════════
  logout: async () => {
    // Conservamos el listener activo para que los siguientes inicios de sesión
    // en la misma ejecución sigan recibiendo eventos de auth.
    const activeListener = get()._unsubscribeAuthListener;

    set({ status: AsyncStateEnum.LOADING });

    const currentUser = get().user;
    if (currentUser?.id) await insertAuditLog(currentUser.id, 'logout');

    await authApi.signOut();

    set({
      ...initialState,
      isInitialized:            true,
      _unsubscribeAuthListener: activeListener,
    });
  },


  // ════════════════════════════════════════════════════════════════
  // ACCIÓN: updateProfile
  // ════════════════════════════════════════════════════════════════
  updateProfile: async (updates) => {
    const { user } = get();

    if (!user) {
      return { success: false, error: 'No hay usuario logueado' };
    }

    set({ status: AsyncStateEnum.LOADING, error: null });

    const dbUpdates = {};
    if (updates.fullName  !== undefined) dbUpdates.full_name  = updates.fullName;
    if (updates.avatarUrl !== undefined) dbUpdates.avatar_url = updates.avatarUrl;

    const result = await usersApi.updateUserProfile(user.id, dbUpdates);

    if (!result.success) {
      set({ status: AsyncStateEnum.ERROR, error: result.error });
      return { success: false, error: result.error };
    }

    set({
      user:   result.data,
      status: AsyncStateEnum.SUCCESS,
      error:  null,
    });

    insertUserActivityLog(user.id, 'actualizar_perfil', {});

    return { success: true, error: null };
  },


  // ════════════════════════════════════════════════════════════════
  // ACCIÓN: requestPasswordReset
  // ════════════════════════════════════════════════════════════════
  requestPasswordReset: async (email) => {
    set({ status: AsyncStateEnum.LOADING, error: null });

    const result = await authApi.resetPassword(email);

    if (!result.success) {
      set({ status: AsyncStateEnum.ERROR, error: result.error });
      return { success: false, error: result.error };
    }

    set({ status: AsyncStateEnum.SUCCESS });
    return { success: true, error: null };
  },


  // ════════════════════════════════════════════════════════════════
  // ACCIÓN: deleteAccount
  // ════════════════════════════════════════════════════════════════
  /**
   * Desactiva o elimina permanentemente la cuenta del usuario.
   * @param {boolean} permanent - true = borrado total, false = solo desactivar
   */
  deleteAccount: async (permanent = false) => {
    const activeListener = get()._unsubscribeAuthListener;
    set({ status: AsyncStateEnum.LOADING, error: null });

    const action = permanent
      ? authApi.deleteAccountPermanent
      : authApi.deactivateAccount;

    const result = await action();

    if (!result.success) {
      set({ status: AsyncStateEnum.ERROR, error: result.error });
      return { success: false, error: result.error };
    }

    const delUserId = get().user?.id;
    if (delUserId) {
      await insertUserActivityLog(delUserId, permanent ? 'eliminar_cuenta' : 'desactivar_cuenta', {});
    }

    await authApi.signOut();

    set({
      ...initialState,
      isInitialized:            true,
      _unsubscribeAuthListener: activeListener,
    });

    return { success: true };
  },

  // ════════════════════════════════════════════════════════════════
  // ACCIÓN: setRecoveryMode
  // Llamada por CallbackPage ANTES de exchangeCodeForSession para que
  // el evento SIGNED_IN resultante no autentique al usuario todavía.
  // ════════════════════════════════════════════════════════════════
  setRecoveryMode: () => set({ isRecoveryMode: true }),

  // ════════════════════════════════════════════════════════════════
  // ACCIÓN: clearError
  // ════════════════════════════════════════════════════════════════
  clearError: () => set({ error: null, status: AsyncStateEnum.IDLE }),

  // ════════════════════════════════════════════════════════════════
  // ACCIÓN: clearRoleNotification
  // ════════════════════════════════════════════════════════════════
  clearRoleNotification: () => set({ _roleChangeNotification: null }),


  // ════════════════════════════════════════════════════════════════
  // SELECTORES
  // ════════════════════════════════════════════════════════════════
  isAuthenticated: () => {
    const { user, session } = get();
    return !!user && !!session;
  },

  isLoading: () => get().status === AsyncStateEnum.LOADING,

}));

// ─────────────────────────────────────────────────────────────────
// SELECTORES PRECONSTRUIDOS
// ─────────────────────────────────────────────────────────────────
export const selectAuthUser        = (state) => state.user;
export const selectAuthStatus      = (state) => state.status;
export const selectAuthError       = (state) => state.error;
export const selectIsInitialized   = (state) => state.isInitialized;
export const selectSession         = (state) => state.session;
export const selectIsAuthenticated = (state) => !!state.user && !!state.session;
export const selectIsRecoveryMode  = (state) => state.isRecoveryMode;

export default useAuthStore;
