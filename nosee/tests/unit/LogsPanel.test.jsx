import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import LogsPanel from '@/features/dashboard/admin/components/LogsPanel';
import { getAdminLogsMetrics } from '@/services/api/adminMetrics.api';
import { createMockLogsData } from '../helpers/admin.fixtures';

vi.mock('@/services/api/adminMetrics.api', () => ({
  getAdminLogsMetrics: vi.fn(),
}));

vi.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => ({
    t: {
      adminDashboard: {
        logsPanel: {
          loading: 'Cargando resumen de logs...',
          errorLoad: 'Error al cargar logs',
          loginEvents: 'Inicios de sesión',
          userActivity: 'Actividad de usuarios',
          adminActions: 'Acciones de admin',
          in24h: 'en 24h',
          in7d: 'en 7 días',
          recentEvents: 'Últimos eventos',
        },
      },
    },
  }),
  LanguageProvider: ({ children }) => children,
}));

describe('LogsPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renderiza loading state inicialmente', () => {
    getAdminLogsMetrics.mockReturnValue(new Promise(() => {}));

    render(<LogsPanel />);

    expect(screen.getByText('Cargando resumen de logs...')).toBeDefined();
  });

  it('renderiza 3 tarjetas de resumen (24h/7d)', async () => {
    const mockData = createMockLogsData({
      loginEvents24h: 890,
      loginEvents7d: 5200,
      activityEvents24h: 2340,
      activityEvents7d: 15000,
      adminEvents24h: 45,
      adminEvents7d: 310,
    });
    getAdminLogsMetrics.mockResolvedValue({ success: true, data: mockData });

    render(<LogsPanel />);

    await waitFor(() => {
      expect(screen.getByText('890')).toBeDefined();
    });

    expect(screen.getByText('5200 en 7 días')).toBeDefined();
    expect(screen.getByText('2340')).toBeDefined();
    expect(screen.getByText('15000 en 7 días')).toBeDefined();
    expect(screen.getByText('45')).toBeDefined();
    expect(screen.getByText('310 en 7 días')).toBeDefined();
  });

  it('renderiza tarjetas con labels correctos', async () => {
    const mockData = createMockLogsData();
    getAdminLogsMetrics.mockResolvedValue({ success: true, data: mockData });

    render(<LogsPanel />);

    await waitFor(() => {
      expect(screen.getByText('Inicios de sesión')).toBeDefined();
    });

    expect(screen.getByText('Actividad de usuarios')).toBeDefined();
    expect(screen.getByText('Acciones de admin')).toBeDefined();
    expect(screen.getAllByText('en 24h')).toHaveLength(3);
  });

  it('renderiza últimos eventos', async () => {
    const mockData = createMockLogsData();
    getAdminLogsMetrics.mockResolvedValue({ success: true, data: mockData });

    render(<LogsPanel />);

    await waitFor(() => {
      expect(screen.getAllByText('Inicio de sesión')).toHaveLength(2);
    });

    expect(screen.getByText('Creó publicación')).toBeDefined();
    expect(screen.getByText('Baneó usuario')).toBeDefined();
    expect(screen.getByText('Últimos eventos')).toBeDefined();
  });

  it('renderiza error state', async () => {
    getAdminLogsMetrics.mockResolvedValue({ success: false, error: 'Error al cargar logs' });

    render(<LogsPanel />);

    await waitFor(() => {
      expect(screen.getByText('Error al cargar logs')).toBeDefined();
    });
  });

  it('no renderiza nada si metrics es null sin error', async () => {
    getAdminLogsMetrics.mockResolvedValue({ success: true, data: null });

    render(<LogsPanel />);

    await waitFor(() => {
      expect(screen.queryByText('890')).toBeNull();
      expect(screen.queryByText('Últimos eventos')).toBeNull();
    });
  });
});
