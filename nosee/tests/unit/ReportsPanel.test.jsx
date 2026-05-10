import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import ReportsPanel from '@/features/dashboard/admin/components/ReportsPanel';
import { getAdminReportsMetrics } from '@/services/api/adminMetrics.api';
import { createMockReportsData } from '../helpers/admin.fixtures';

vi.mock('@/services/api/adminMetrics.api', () => ({
  getAdminReportsMetrics: vi.fn(),
}));

vi.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => ({
    t: {
      adminDashboard: {
        summaryByStatus: 'Resumen',
        summaryByType: 'Por razón',
        reportTypes: {
          spam: 'Spam',
          offensive: 'Ofensivo',
          fake_price: 'Precio falso',
          wrong_photo: 'Foto incorrecta',
        },
        reportsPanel: {
          loading: 'Cargando reportes...',
          errorLoad: 'Error al cargar reportes',
          labelPending: 'Pendientes',
          labelResolved: 'Resueltos',
          labelTotal: 'Total',
          recentPending: 'Últimos reportes pendientes',
        },
      },
    },
  }),
  LanguageProvider: ({ children }) => children,
}));

describe('ReportsPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renderiza loading state inicialmente', () => {
    getAdminReportsMetrics.mockReturnValue(new Promise(() => {}));

    render(<ReportsPanel />);

    expect(screen.getByText('Cargando reportes...')).toBeDefined();
  });

  it('renderiza backlog y breakdown cuando llegan los datos', async () => {
    const mockData = createMockReportsData({ pendingBacklog: 23, resolvedCount: 120, totalReports: 150 });
    getAdminReportsMetrics.mockResolvedValue({ success: true, data: mockData });

    render(<ReportsPanel />);

    await waitFor(() => {
      expect(screen.getByText('23')).toBeDefined();
    });

    expect(screen.getByText('120')).toBeDefined();
    expect(screen.getByText('150')).toBeDefined();
  });

  it('renderiza breakdown por razón', async () => {
    const mockData = createMockReportsData();
    getAdminReportsMetrics.mockResolvedValue({ success: true, data: mockData });

    render(<ReportsPanel />);

    await waitFor(() => {
      expect(screen.getByText('Spam')).toBeDefined();
    });

    expect(screen.getByText('Ofensivo')).toBeDefined();
  });

  it('renderiza últimos reportes pendientes', async () => {
    const mockData = createMockReportsData();
    getAdminReportsMetrics.mockResolvedValue({ success: true, data: mockData });

    render(<ReportsPanel />);

    await waitFor(() => {
      expect(screen.getAllByText('alta')).toHaveLength(2);
    });

    expect(screen.getAllByText('media')).toHaveLength(2);
    expect(screen.getByText('baja')).toBeDefined();
  });

  it('renderiza error state', async () => {
    getAdminReportsMetrics.mockResolvedValue({ success: false, error: 'Error al cargar reportes' });

    render(<ReportsPanel />);

    await waitFor(() => {
      expect(screen.getByText('Error al cargar reportes')).toBeDefined();
    });
  });

  it('no renderiza nada si metrics es null sin error', async () => {
    getAdminReportsMetrics.mockResolvedValue({ success: true, data: null });

    render(<ReportsPanel />);

    await waitFor(() => {
      expect(screen.queryByText('23')).toBeNull();
    });
  });
});
