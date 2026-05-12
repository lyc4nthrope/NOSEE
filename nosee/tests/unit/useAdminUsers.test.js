import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import useAdminUsers from '@/features/dashboard/admin/hooks/useAdminUsers';
import { useAdminStore } from '@/features/dashboard/admin/store/adminStore';
import { getAllUsers, changeUserRole, updateUserStatus } from '@/services/api/users.api';
import { insertActionLog } from '@/services/api/audit.api';
import { hideUserPublications } from '@/services/api/adminCatalog.api';
import { checkRateLimit } from '@/services/utils/rateLimit';

const mockTd = {
  errorLoadUsers: 'Error al cargar usuarios',
  errorConnect: 'Error de conexión',
};

const mockUsers = [
  {
    id: 'user-1',
    fullName: 'Test User',
    email: 'test@example.com',
    role: 'Usuario',
    isActive: true,
    reputationPoints: 100,
    createdAt: '2026-01-15T10:00:00Z',
  },
  {
    id: 'user-2',
    fullName: 'Banned User',
    email: 'banned@example.com',
    role: 'Moderador',
    isActive: false,
    reputationPoints: 50,
    createdAt: '2026-02-20T10:00:00Z',
  },
];

vi.mock('@/services/api/users.api', () => ({
  getAllUsers: vi.fn(),
  changeUserRole: vi.fn(),
  updateUserStatus: vi.fn(),
}));

vi.mock('@/services/api/audit.api', () => ({
  insertActionLog: vi.fn(),
}));

vi.mock('@/services/api/adminCatalog.api', () => ({
  hideUserPublications: vi.fn(),
}));

vi.mock('@/services/utils/rateLimit', () => ({
  checkRateLimit: vi.fn(() => ({ allowed: true })),
}));

vi.mock('@/features/auth/store/authStore', () => ({
  useAuthStore: vi.fn((selector) => {
    const state = { user: { id: 'admin-uuid', role: 'Admin' } };
    return selector ? selector(state) : state;
  }),
}));

vi.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => ({
    t: { adminDashboard: mockTd },
  }),
}));

vi.mock('@/types', () => ({
  UserRoleEnum: {
    USUARIO: 'Usuario',
    MODERADOR: 'Moderador',
    ADMIN: 'Admin',
    REPARTIDOR: 'Repartidor',
  },
}));

const resetAdminStore = () => {
  useAdminStore.setState({
    confirmModal: { isOpen: false, title: '', message: '', onConfirm: null, actions: null },
    banModal: null,
  });
};

describe('useAdminUsers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetAdminStore();
  });

  describe('initial state', () => {
    it('comienza con valores por defecto', () => {
      const { result } = renderHook(() => useAdminUsers());

      expect(result.current.users).toEqual([]);
      expect(result.current.usersLoading).toBe(true);
      expect(result.current.usersError).toBeNull();
      expect(result.current.changingRole).toBeNull();
    });
  });

  describe('loadUsers', () => {
    it('carga usuarios y mapea datos correctamente', async () => {
      const { result } = renderHook(() => useAdminUsers());

      getAllUsers.mockResolvedValue({ success: true, data: mockUsers });

      await act(() => result.current.loadUsers());

      expect(result.current.usersLoading).toBe(false);
      expect(result.current.usersError).toBeNull();
      expect(result.current.users).toHaveLength(2);
      expect(result.current.users[0].name).toBe('Test User');
      expect(result.current.users[0].email).toBe('test@example.com');
      expect(result.current.users[0].role).toBe('Usuario');
      expect(result.current.users[0].status).toBe('activo');
      expect(result.current.users[0].rep).toBe(100);
      expect(result.current.users[1].status).toBe('baneado');
    });

    it('setea error si result.success es false', async () => {
      const { result } = renderHook(() => useAdminUsers());

      getAllUsers.mockResolvedValue({ success: false, error: 'Database timeout' });

      await act(() => result.current.loadUsers());

      expect(result.current.usersLoading).toBe(false);
      expect(result.current.usersError).toBe('Database timeout');
      expect(result.current.users).toEqual([]);
    });

    it('setea error de conexión si getAllUsers lanza excepción', async () => {
      const { result } = renderHook(() => useAdminUsers());

      getAllUsers.mockRejectedValue(new Error('Network error'));

      await act(() => result.current.loadUsers());

      expect(result.current.usersLoading).toBe(false);
      expect(result.current.usersError).toBe('Error de conexión');
    });
  });

  describe('handleRoleChange', () => {
    it('abre modal de confirmación en el store', async () => {
      getAllUsers.mockResolvedValue({ success: true, data: mockUsers });

      const { result } = renderHook(() => useAdminUsers());
      await act(() => result.current.loadUsers());

      await act(() => result.current.handleRoleChange('user-1', 'Moderador'));

      const { confirmModal } = useAdminStore.getState();
      expect(confirmModal.isOpen).toBe(true);
      expect(confirmModal.title).toBe('Cambiar rol');
      expect(changeUserRole).not.toHaveBeenCalled();
    });

    it('ejecuta cambio de rol al confirmar el modal', async () => {
      getAllUsers.mockResolvedValue({ success: true, data: mockUsers });

      const { result } = renderHook(() => useAdminUsers());
      await act(() => result.current.loadUsers());

      changeUserRole.mockResolvedValue({ success: true });

      await act(() => result.current.handleRoleChange('user-1', 'Moderador'));

      const { onConfirm } = useAdminStore.getState().confirmModal;
      await act(() => onConfirm());

      expect(changeUserRole).toHaveBeenCalledWith('user-1', 2);
      expect(result.current.users[0].role).toBe('Moderador');
      expect(insertActionLog).toHaveBeenCalledWith(
        'admin-uuid', 'user', 'user-1', 'change_role', null,
        { newRole: 'Moderador', prevRole: 'Usuario' },
      );
      expect(result.current.changingRole).toBeNull();
    });

    it('no modifica target si es admin y currentUser es admin', async () => {
      const adminUser = {
        id: 'admin-2',
        fullName: 'Other Admin',
        email: 'admin2@example.com',
        role: 'Admin',
        isActive: true,
        reputationPoints: 999,
        createdAt: '2026-01-01T00:00:00Z',
      };
      const { result } = renderHook(() => useAdminUsers());

      getAllUsers.mockResolvedValue({ success: true, data: [...mockUsers, adminUser] });
      await act(() => result.current.loadUsers());

      await act(() => result.current.handleRoleChange('admin-2', 'Moderador'));

      expect(changeUserRole).not.toHaveBeenCalled();
    });
  });

  describe('handleBanToggle / confirmBan', () => {
    it('setea banModal en el store al llamar handleBanToggle', async () => {
      const { result } = renderHook(() => useAdminUsers());

      getAllUsers.mockResolvedValue({ success: true, data: mockUsers });
      await act(() => result.current.loadUsers());

      act(() => {
        result.current.handleBanToggle('user-1');
      });

      expect(useAdminStore.getState().banModal).toEqual(expect.objectContaining({ id: 'user-1' }));
    });

    it('banea usuario (activo→baneado) y oculta publicaciones', async () => {
      const { result } = renderHook(() => useAdminUsers());

      getAllUsers.mockResolvedValue({ success: true, data: mockUsers });
      await act(() => result.current.loadUsers());
      act(() => { result.current.handleBanToggle('user-1'); });

      updateUserStatus.mockResolvedValue({ success: true });
      hideUserPublications.mockResolvedValue({ success: true });

      await act(() => result.current.confirmBan());

      expect(updateUserStatus).toHaveBeenCalledWith('user-1', false);
      expect(hideUserPublications).toHaveBeenCalledWith('user-1');
      expect(result.current.users[0].status).toBe('baneado');
      expect(useAdminStore.getState().banModal).toBeNull();
    });

    it('desbanea usuario (baneado→activo) sin ocultar publicaciones', async () => {
      const { result } = renderHook(() => useAdminUsers());

      getAllUsers.mockResolvedValue({ success: true, data: mockUsers });
      await act(() => result.current.loadUsers());
      act(() => { result.current.handleBanToggle('user-2'); });

      updateUserStatus.mockResolvedValue({ success: true });

      await act(() => result.current.confirmBan());

      expect(updateUserStatus).toHaveBeenCalledWith('user-2', true);
      expect(hideUserPublications).not.toHaveBeenCalled();
      expect(result.current.users[1].status).toBe('activo');
      expect(insertActionLog).toHaveBeenCalled();
      expect(useAdminStore.getState().banModal).toBeNull();
    });
  });

  describe('checkRateLimit', () => {
    it('respeta rate limit en handleRoleChange', async () => {
      checkRateLimit.mockReturnValue({ allowed: false, retryAfter: 5 });

      const { result } = renderHook(() => useAdminUsers());

      getAllUsers.mockResolvedValue({ success: true, data: mockUsers });
      await act(() => result.current.loadUsers());

      await act(() => result.current.handleRoleChange('user-1', 'Moderador'));

      expect(changeUserRole).not.toHaveBeenCalled();
    });
  });
});
