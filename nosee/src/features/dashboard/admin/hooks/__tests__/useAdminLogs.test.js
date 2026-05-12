import { renderHook, act } from '@testing-library/react';
import useAdminLogs from '../useAdminLogs';
import { getActionLogs, getLoginLogs, getUserActivityLogs } from '@/services/api/audit.api';
import { getAllUsers } from '@/services/api/users.api';
import { useAdminStore } from '../../store/adminStore';

vi.mock('@/services/api/audit.api', () => ({
  getActionLogs: vi.fn(),
  getLoginLogs: vi.fn(),
  getUserActivityLogs: vi.fn(),
}));

vi.mock('@/services/api/users.api', () => ({
  getAllUsers: vi.fn(),
  getUserBasicInfo: vi.fn(),
}));

vi.mock('@/services/supabase.client', () => ({
  supabase: {
    channel: vi.fn(() => ({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn(),
    })),
    removeChannel: vi.fn(),
  },
}));

describe('useAdminLogs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAdminStore.setState(useAdminStore.getInitialState());
  });

  it('devuelve estado inicial correcto', () => {
    const { result } = renderHook(() => useAdminLogs());

    expect(result.current.actionLogs).toEqual([]);
    expect(result.current.loginLogs).toEqual([]);
    expect(result.current.activityLogs).toEqual([]);
    expect(result.current.logsLoading).toBe(false);
    expect(result.current.logsLoaded).toBe(false);
    expect(result.current.logFilter).toBe('');
    expect(result.current.logCatFilter).toBe('all');
    expect(result.current.logSourceFilter).toBe('all');
    expect(result.current.logDateFrom).toBe('');
    expect(result.current.logDateTo).toBe('');
  });

  it('loadLogs carga datos de los 3 orígenes', async () => {
    getActionLogs.mockResolvedValue({ data: [{ id: 'a1', action: 'hide' }] });
    getLoginLogs.mockResolvedValue({ data: [{ id: 'l1', user_id: 'u1' }] });
    getUserActivityLogs.mockResolvedValue({ data: [{ id: 'u1', action: 'login' }] });
    getAllUsers.mockResolvedValue({ data: [{ id: 'u1', fullName: 'Usuario Test' }] });

    const { result } = renderHook(() => useAdminLogs());

    await act(async () => {
      await result.current.loadLogs();
    });

    expect(result.current.actionLogs).toHaveLength(1);
    expect(result.current.loginLogs).toHaveLength(1);
    expect(result.current.activityLogs).toHaveLength(1);
    expect(result.current.logsLoading).toBe(false);
    expect(result.current.logsLoaded).toBe(true);
    expect(result.current.usersMap['u1']).toBe('Usuario Test');
  });

  it('loadLogs maneja datos vacíos', async () => {
    getActionLogs.mockResolvedValue({ data: null });
    getLoginLogs.mockResolvedValue({ data: null });
    getUserActivityLogs.mockResolvedValue({ data: null });
    getAllUsers.mockResolvedValue({ data: null });

    const { result } = renderHook(() => useAdminLogs());

    await act(async () => {
      await result.current.loadLogs();
    });

    expect(result.current.actionLogs).toEqual([]);
    expect(result.current.loginLogs).toEqual([]);
    expect(result.current.activityLogs).toEqual([]);
    expect(result.current.logsLoaded).toBe(true);
  });

  it('setters actualizan estado correctamente', () => {
    const { result } = renderHook(() => useAdminLogs());

    act(() => { result.current.setLogFilter('test'); });
    expect(result.current.logFilter).toBe('test');

    act(() => { result.current.setLogCatFilter('admin'); });
    expect(result.current.logCatFilter).toBe('admin');

    act(() => { result.current.setLogSourceFilter('web'); });
    expect(result.current.logSourceFilter).toBe('web');

    act(() => { result.current.setLogDateFrom('2026-01-01'); });
    expect(result.current.logDateFrom).toBe('2026-01-01');

    act(() => { result.current.setLogDateTo('2026-12-31'); });
    expect(result.current.logDateTo).toBe('2026-12-31');
  });

  it('reacciona a activeSection del store', () => {
    const { result } = renderHook(() => useAdminLogs());

    // Inicia en 'overview' — no debería tener subscripción activa al principio
    expect(result.current.logsLoading).toBe(false);

    // Cambiar a 'logs' activa — el efecto realtime se dispara
    act(() => {
      useAdminStore.getState().setActiveSection('logs');
    });
  });
});
