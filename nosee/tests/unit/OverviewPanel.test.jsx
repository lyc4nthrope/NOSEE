import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import OverviewPanel from '@/features/dashboard/admin/components/OverviewPanel';
import { getAdminOverviewMetrics } from '@/services/api/adminMetrics.api';
import { createMockOverviewData } from '../helpers/admin.fixtures';

const mockTd = {
  kpiTotalUsers: 'Usuarios totales',
  kpiActiveUsers: 'Usuarios activos',
  kpiPubsToday: 'Publicaciones hoy',
  kpiTotalPubs: 'Total publicaciones',
  kpiActivePubs: 'Publicaciones activas',
  kpiValidationsToday: 'Validaciones hoy',
  kpiPendingReports: 'Reportes pendientes',
  kpiTotalOrders: 'Pedidos totales',
  kpiActiveOrders: 'Pedidos activos',
  kpiActiveStores: 'Tiendas activas',
  kpiActiveProducts: 'Productos activos',
  kpiActiveDealers: 'Repartidores activos',
  kpiPendingDealerApps: 'Solicitudes pendientes',
  kpiLogins24h: 'Inicios (24h)',
};

vi.mock('@/services/api/adminMetrics.api', () => ({
  getAdminOverviewMetrics: vi.fn(),
}));

vi.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => ({
    t: { adminDashboard: mockTd },
  }),
  LanguageProvider: ({ children }) => children,
}));

describe('OverviewPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renderiza loading state inicialmente', () => {
    getAdminOverviewMetrics.mockReturnValue(new Promise(() => {}));

    render(<OverviewPanel />);

    expect(getAdminOverviewMetrics).toHaveBeenCalledOnce();
  });

  it('renderiza KPIs cuando llegan los datos', async () => {
    const mockData = createMockOverviewData();
    getAdminOverviewMetrics.mockResolvedValue({ success: true, data: mockData });

    render(<OverviewPanel />);

    await waitFor(() => {
      expect(screen.getAllByText('15420')).toHaveLength(2);
    });

    expect(screen.getByText('1250')).toBeDefined();
    expect(screen.getByText('342')).toBeDefined();
    expect(screen.getByText('45200')).toBeDefined();
  });

  it('renderiza mensaje de error si falla la carga', async () => {
    getAdminOverviewMetrics.mockResolvedValue({ success: false, error: 'Error de conexión' });

    render(<OverviewPanel />);

    await waitFor(() => {
      expect(screen.getByText('Error de conexión')).toBeDefined();
    });

    expect(screen.getByText('Reintentar')).toBeDefined();
  });

  it('muestra 14 KPIs con labels correctos', async () => {
    const mockData = createMockOverviewData();
    getAdminOverviewMetrics.mockResolvedValue({ success: true, data: mockData });

    render(<OverviewPanel />);

    await waitFor(() => {
      expect(screen.getAllByText('Usuarios totales')).toHaveLength(2);
    });

    expect(screen.getByText('Usuarios activos')).toBeDefined();
    expect(screen.getByText('Publicaciones hoy')).toBeDefined();
    expect(screen.getByText('Total publicaciones')).toBeDefined();
    expect(screen.getByText('Publicaciones activas')).toBeDefined();
    expect(screen.getByText('Validaciones hoy')).toBeDefined();
    expect(screen.getByText('Reportes pendientes')).toBeDefined();
    expect(screen.getAllByText('Pedidos totales')).toHaveLength(2);
    expect(screen.getByText('Pedidos activos')).toBeDefined();
    expect(screen.getAllByText('Tiendas activas')).toHaveLength(2);
    expect(screen.getByText('Productos activos')).toBeDefined();
    expect(screen.getByText('Repartidores activos')).toBeDefined();
    expect(screen.getByText('Solicitudes pendientes')).toBeDefined();
    expect(screen.getByText('Inicios (24h)')).toBeDefined();
  });

  it('las cards de resumen contextual se renderizan', async () => {
    const mockData = createMockOverviewData();
    getAdminOverviewMetrics.mockResolvedValue({ success: true, data: mockData });

    render(<OverviewPanel />);

    await waitFor(() => {
      expect(screen.getAllByText('15420')).toHaveLength(2);
    });

    expect(screen.getByText(/1250 activos/)).toBeDefined();
  });
});
