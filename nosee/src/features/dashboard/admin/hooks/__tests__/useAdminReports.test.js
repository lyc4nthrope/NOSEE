import { renderHook, act } from '@testing-library/react';
import useAdminReports from '../useAdminReports';
import { getAdminReports, updateReportReview, updateUserStatus } from '@/services/api/users.api';
import { hidePublication, hideStore, hideProduct, hideBrand } from '@/services/api/adminCatalog.api';
import { deleteComment } from '@/services/api/comments.api';
import { useAuthStore } from '@/features/auth/store/authStore';

vi.mock('@/services/api/users.api', () => ({
  getAdminReports: vi.fn(),
  updateReportReview: vi.fn(),
  updateUserStatus: vi.fn(),
}));

vi.mock('@/services/api/adminCatalog.api', () => ({
  hidePublication: vi.fn(),
  hideStore: vi.fn(),
  hideProduct: vi.fn(),
  hideBrand: vi.fn(),
}));

vi.mock('@/services/api/comments.api', () => ({
  deleteComment: vi.fn(),
}));

vi.mock('@/services/api/audit.api', () => ({
  insertActionLog: vi.fn(),
}));

vi.mock('@/services/utils/rateLimit', () => ({
  checkRateLimit: vi.fn(() => ({ allowed: true })),
}));

vi.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => ({ t: { adminDashboard: {} }, lang: 'es-CO' }),
}));

vi.mock('@/features/auth/store/authStore', () => ({
  useAuthStore: vi.fn((sel) =>
    sel({ user: { id: 'admin-1' } })
  ),
}));

vi.mock('@/features/dashboard/admin/adminConstants', () => ({
  REPORT_SEVERITY: { spam: 'baja', abuso: 'media', ilegal: 'alta' },
  normalizeReportStatus: vi.fn((s) => s === 'resolved' ? 'RESOLVED' : s === 'pending' ? 'PENDING' : s === 'rejected' ? 'REJECTED' : s === 'in_review' ? 'IN_REVIEW' : s?.toUpperCase?.() || 'PENDING'),
  formatPublicationSummary: vi.fn(() => 'Resumen pub'),
  getReportTargetTypeLabel: vi.fn(() => 'Publicación'),
  getReportTargetDisplay: vi.fn(() => 'Display'),
}));

describe('useAdminReports', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('devuelve estado inicial correcto', () => {
    const { result } = renderHook(() => useAdminReports());

    expect(result.current.reports).toEqual([]);
    expect(result.current.reportsLoading).toBe(false);
    expect(result.current.reportsLoaded).toBe(false);
    expect(result.current.reportStatusFilter).toBe('all');
    expect(result.current.reportTypeFilter).toBe('all');
    expect(result.current.reportSort).toBe('recent');
    expect(result.current.resolvedCount).toBe(0);
  });

  it('loadReports carga datos exitosamente', async () => {
    const fakeReports = [
      { id: 1, status: 'pending', reason: 'spam', created_at: '2026-01-01', reported_type: 'publication', reported_id: '10' },
      { id: 2, status: 'resolved', reason: 'abuso', created_at: '2026-01-02', reported_type: 'store', reported_id: '20' },
    ];
    getAdminReports.mockResolvedValue({ success: true, data: fakeReports });

    const { result } = renderHook(() => useAdminReports());

    await act(async () => {
      await result.current.loadReports();
    });

    expect(result.current.reports).toHaveLength(2);
    expect(result.current.reportsLoaded).toBe(true);
    expect(result.current.reportsLoading).toBe(false);
    expect(getAdminReports).toHaveBeenCalledWith(1, 50);
  });

  it('loadReports maneja error sin romper', async () => {
    getAdminReports.mockResolvedValue({ success: false });

    const { result } = renderHook(() => useAdminReports());

    await act(async () => {
      await result.current.loadReports();
    });

    expect(result.current.reports).toEqual([]);
    expect(result.current.reportsLoaded).toBe(false);
    expect(result.current.reportsLoading).toBe(false);
  });

  it('updateReportData actualiza estado de reporte', async () => {
    const fakeReports = [
      { id: 1, status: 'PENDING', reason: 'spam', created_at: '2026-01-01', reported_type: 'publication', reported_id: '10' },
    ];
    getAdminReports.mockResolvedValue({ success: true, data: fakeReports });
    updateReportReview.mockResolvedValue({ success: true });

    const { result } = renderHook(() => useAdminReports());

    await act(async () => {
      await result.current.loadReports();
    });

    const report = result.current.reports[0];

    await act(async () => {
      await result.current.updateReportData(report, { status: 'RESOLVED' });
    });

    expect(result.current.reports[0].status).toBe('RESOLVED');
    expect(result.current.resolvedCount).toBe(1);
  });

  it('loadReports extrae publicationId para tipo publication', async () => {
    const fakeReports = [
      { id: 1, status: 'pending', reason: 'spam', created_at: null, reported_type: 'publication', reported_id: '42' },
    ];
    getAdminReports.mockResolvedValue({ success: true, data: fakeReports });

    const { result } = renderHook(() => useAdminReports());

    await act(async () => {
      await result.current.loadReports();
    });

    expect(result.current.reports[0].publicationId).toBe(42);
  });

  it('filteredReports filtra por status', async () => {
    getAdminReports.mockResolvedValue({ success: true, data: [
      { id: 1, status: 'pending', reason: 'spam', created_at: '2026-01-01', reported_type: 'publication', reported_id: '1' },
      { id: 2, status: 'resolved', reason: 'abuso', created_at: '2026-01-02', reported_type: 'store', reported_id: '2' },
    ]});

    const { result } = renderHook(() => useAdminReports());

    await act(async () => {
      await result.current.loadReports();
    });

    act(() => {
      result.current.setReportStatusFilter('RESOLVED');
    });

    expect(result.current.filteredReports).toHaveLength(1);
    expect(result.current.filteredReports[0].id).toBe(2);
  });

  it('reportTypeOptions se computa de reports', async () => {
    getAdminReports.mockResolvedValue({ success: true, data: [
      { id: 1, status: 'pending', reason: 'spam', created_at: '2026-01-01', reported_type: 'publication', reported_id: '1' },
      { id: 2, status: 'pending', reason: 'abuso', created_at: '2026-01-02', reported_type: 'store', reported_id: '2' },
    ]});

    const { result } = renderHook(() => useAdminReports());

    await act(async () => {
      await result.current.loadReports();
    });

    expect(result.current.reportTypeOptions).toEqual(['spam', 'abuso']);
  });
});
