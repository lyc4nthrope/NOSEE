import { renderHook, act } from '@testing-library/react';
import useAdminDealers from '../useAdminDealers';
import { getApplications } from '@/services/api/dealerApplications.api';

vi.mock('@/services/api/dealerApplications.api', () => ({
  getApplications: vi.fn(),
}));

describe('useAdminDealers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('devuelve estado inicial correcto', () => {
    const { result } = renderHook(() => useAdminDealers());

    expect(result.current.applications).toEqual([]);
    expect(result.current.applicationsLoading).toBe(false);
    expect(result.current.applicationsLoaded).toBe(false);
  });

  it('loadApplications carga datos exitosamente', async () => {
    const fakeData = [
      { id: 1, name: 'Juan', status: 'pending' },
      { id: 2, name: 'María', status: 'approved' },
    ];
    getApplications.mockResolvedValue({ success: true, data: fakeData });

    const { result } = renderHook(() => useAdminDealers());

    await act(async () => {
      await result.current.loadApplications();
    });

    expect(result.current.applications).toEqual(fakeData);
    expect(result.current.applicationsLoading).toBe(false);
    expect(result.current.applicationsLoaded).toBe(true);
    expect(getApplications).toHaveBeenCalledTimes(1);
  });

  it('loadApplications maneja error sin romper', async () => {
    getApplications.mockResolvedValue({ success: false });

    const { result } = renderHook(() => useAdminDealers());

    await act(async () => {
      await result.current.loadApplications();
    });

    expect(result.current.applications).toEqual([]);
    expect(result.current.applicationsLoading).toBe(false);
    expect(result.current.applicationsLoaded).toBe(true);
  });

  it('setApplications actualiza el estado', () => {
    const { result } = renderHook(() => useAdminDealers());
    const newApps = [{ id: 3, name: 'Test', status: 'pending' }];

    act(() => {
      result.current.setApplications(newApps);
    });

    expect(result.current.applications).toEqual(newApps);
  });

  it('setApplicationsLoaded actualiza el flag', () => {
    const { result } = renderHook(() => useAdminDealers());

    act(() => {
      result.current.setApplicationsLoaded(true);
    });

    expect(result.current.applicationsLoaded).toBe(true);
  });
});
