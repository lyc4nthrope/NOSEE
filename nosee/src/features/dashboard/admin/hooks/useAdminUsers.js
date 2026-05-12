import { useState, useCallback } from 'react';
import { useAdminStore } from '../store/adminStore';
import { changeUserRole, getAllUsers, updateUserStatus } from '@/services/api/users.api';
import { insertActionLog } from '@/services/api/audit.api';
import { hideUserPublications } from '@/services/api/adminCatalog.api';
import { UserRoleEnum } from '@/types';
import { useAuthStore } from '@/features/auth/store/authStore';
import { useLanguage } from '@/contexts/LanguageContext';
import { checkRateLimit } from '@/services/utils/rateLimit';

const ROLE_MAP = {
  [UserRoleEnum.USUARIO]: 1,
  [UserRoleEnum.MODERADOR]: 2,
  [UserRoleEnum.ADMIN]: 3,
  [UserRoleEnum.REPARTIDOR]: 4,
};

/**
 * Hook de administración de usuarios del sistema.
 * Expone estado y acciones para listar, cambiar roles, banear/desbanear usuarios.
 *
 * @param {Object} [params]
 * @param {boolean} [params.pubsLoaded] - Indica si las publicaciones ya cargaron
 * @param {Function} [params.setPublications] - Setter de publicaciones (para ocultar al banear)
 * @returns {{
 *   users: Array,
 *   setUsers: Function,
 *   usersLoading: boolean,
 *   usersError: string|null,
 *   changingRole: string|null,
 *   loadUsers: Function,
 *   handleRoleChange: Function,
 *   handleBanToggle: Function,
 *   confirmBan: Function,
 * }}
 */
export default function useAdminUsers({ pubsLoaded, setPublications } = {}) {
  const { t, lang } = useLanguage();
  const td = t.adminDashboard;
  const currentUser = useAuthStore(s => s.user);
  const currentUserId = currentUser?.id;

  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [usersError, setUsersError] = useState(null);
  const [changingRole, setChangingRole] = useState(null);

  const loadUsers = useCallback(async () => {
    setUsersLoading(true);
    setUsersError(null);
    try {
      const result = await getAllUsers();
      if (result.success && Array.isArray(result.data) && result.data.length > 1000) {
        console.warn(`[useAdminUsers] ${result.data.length} usuarios cargados — considerar paginación`);
      }
      if (result.success && result.data) {
        setUsers(result.data.map((u) => ({
          id: u.id,
          name: u.fullName || '',
          email: u.email || 'No disponible',
          role: u.role,
          status: u.isActive ? 'activo' : 'baneado',
          rep: u.reputationPoints || 0,
          joined: new Date(u.createdAt).toLocaleDateString(lang, {
            year: 'numeric', month: 'short', day: 'numeric',
          }),
        })));
      } else {
        setUsersError(result.error || td.errorLoadUsers);
      }
    } catch {
      setUsersError(td.errorConnect);
    } finally {
      setUsersLoading(false);
    }
  }, [td]);

  const handleRoleChange = useCallback(async (userId, newRole) => {
    const targetUser = users.find(u => u.id === userId);
    if (!targetUser) return;

    if (targetUser.role === UserRoleEnum.ADMIN && currentUser?.role === UserRoleEnum.ADMIN) {
      console.error('[useAdminUsers] No puedes modificar a otro administrador');
      return;
    }

    const { allowed, retryAfter } = checkRateLimit('admin:roleChange');
    if (!allowed) {
      console.error(`[RateLimit] Espera ${retryAfter}s antes de otra acción`);
      return;
    }

    useAdminStore.getState().openConfirmModal({
      title: 'Cambiar rol',
      message: `¿Cambiar rol de ${targetUser.name} a ${newRole}?`,
      onConfirm: async () => {
        setChangingRole(userId);
        try {
          const result = await changeUserRole(userId, ROLE_MAP[newRole]);
          if (result.success) {
            setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u));
            insertActionLog(currentUserId, 'user', userId, 'change_role', null, { newRole, prevRole: targetUser?.role || null });
          } else {
            console.error('[useAdminUsers] changeUserRole:', result.error);
          }
        } catch (err) {
          console.error('[useAdminUsers] changeUserRole:', err);
        } finally {
          setChangingRole(null);
        }
      },
    });
    return;
  }, [users, td, currentUserId, currentUser]);

  const handleBanToggle = useCallback((userId) => {
    const target = users.find(u => u.id === userId);
    if (!target) return;
    if (target.role === UserRoleEnum.ADMIN && currentUser?.role === UserRoleEnum.ADMIN) {
      console.error('[useAdminUsers] No puedes modificar a otro administrador');
      return;
    }

    const { allowed, retryAfter } = checkRateLimit('admin:banToggle');
    if (!allowed) {
      console.error(`[RateLimit] Espera ${retryAfter}s antes de otra acción`);
      return;
    }

    useAdminStore.getState().setBanModal(target);
  }, [users, td, currentUser]);

  const confirmBan = useCallback(async () => {
    const target = useAdminStore.getState().banModal;
    useAdminStore.getState().setBanModal(null);
    const isBanning  = target.status === 'activo';
    const newIsActive = !isBanning;

    try {
      const result = await updateUserStatus(target.id, newIsActive);
      if (!result.success) { console.error('[useAdminUsers] updateUserStatus:', result.error); return; }

      if (isBanning) {
        await hideUserPublications(target.id);
        if (pubsLoaded && setPublications) {
          setPublications(prev =>
            prev.map(p => p.user_id === target.id && p.is_active
              ? { ...p, is_active: false, status: 'hidden' }
              : p
            )
          );
        }
      }

      setUsers(prev =>
        prev.map(u => u.id === target.id ? { ...u, status: isBanning ? 'baneado' : 'activo' } : u)
      );
      insertActionLog(currentUserId, 'user', target.id, isBanning ? 'ban_user' : 'unban_user', null, { userName: target.name });
    } catch (err) {
      console.error('[useAdminUsers] confirmBan:', err);
    }
  }, [td, currentUserId, pubsLoaded, setPublications]);

  return {
    users, setUsers, usersLoading, usersError,
    changingRole,
    loadUsers, handleRoleChange, handleBanToggle, confirmBan,
  };
}
