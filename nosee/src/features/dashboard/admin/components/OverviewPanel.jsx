/**
 * OverviewPanel.jsx
 *
 * Panel de resumen del sistema (12 KPIs) para el admin dashboard.
 * Consume getAdminOverviewMetrics() desde adminMetrics.api.js.
 *
 * UBICACIÓN: src/features/dashboard/admin/components/OverviewPanel.jsx
 */
import { useState, useEffect } from 'react';
import { getAdminOverviewMetrics } from '@/services/api/adminMetrics.api';
import { useLanguage } from '@/contexts/LanguageContext';
import { s, ACCENT, MUTED, TEXT } from '../adminStyles';
import { KpiCard } from './KpiCard';

const KPI_ORDER = [
  { key: 'totalUsers',            icon: '◉', labelKey: 'kpiTotalUsers' },
  { key: 'totalActiveUsers',     icon: '◉', labelKey: 'kpiActiveUsers' },
  { key: 'publicationsToday',    icon: '◈', labelKey: 'kpiPubsToday' },
  { key: 'totalPublications',    icon: '◈', labelKey: 'kpiTotalPubs' },
  { key: 'activePublications',   icon: '◈', labelKey: 'kpiActivePubs' },
  { key: 'validationsToday',     icon: '✓', labelKey: 'kpiValidationsToday' },
  { key: 'pendingReports',       icon: '⚠', labelKey: 'kpiPendingReports' },
  { key: 'totalOrders',          icon: '📦', labelKey: 'kpiTotalOrders' },
  { key: 'activeOrders',         icon: '📦', labelKey: 'kpiActiveOrders' },
  { key: 'activeStores',         icon: '🏪', labelKey: 'kpiActiveStores' },
  { key: 'activeProducts',       icon: '📋', labelKey: 'kpiActiveProducts' },
  { key: 'activeDealers',        icon: '🛵', labelKey: 'kpiActiveDealers' },
  { key: 'pendingDealerApplications', icon: '🛵', labelKey: 'kpiPendingDealerApps' },
  { key: 'loginsLast24h',        icon: '◎', labelKey: 'kpiLogins24h' },
];

function LoadingSkeleton() {
  return (
    <div style={s.statsGrid}>
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} style={{
          ...s.statCard,
          background: 'var(--bg-elevated)',
          animation: 'pulse 1.5s ease-in-out infinite',
        }}>
          <div style={{ height: 16, width: '40%', background: 'var(--border)', borderRadius: 4, marginBottom: 12 }} />
          <div style={{ height: 28, width: '60%', background: 'var(--border)', borderRadius: 6, marginBottom: 4 }} />
          <div style={{ height: 12, width: '30%', background: 'var(--border)', borderRadius: 4 }} />
        </div>
      ))}
    </div>
  );
}

export default function OverviewPanel({ onNavigate }) {
  const { t } = useLanguage();
  const td = t.adminDashboard;

  const [metrics, setMetrics] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isMounted = true;

    async function load() {
      setIsLoading(true);
      setError(null);

      const result = await getAdminOverviewMetrics();

      if (!isMounted) return;

      if (result.success) {
        setMetrics(result.data);
      } else {
        setError(result.error || 'Error al cargar métricas');
      }
      setIsLoading(false);
    }

    load();
    return () => { isMounted = false; };
  }, []);

  if (isLoading) return <LoadingSkeleton />;

  if (error) {
    return (
      <div style={{ ...s.statCard, textAlign: 'center', padding: 32 }}>
        <div style={{ fontSize: 14, color: 'var(--error)', marginBottom: 12 }}>{error}</div>
        <button
          onClick={() => window.location.reload()}
          style={{ background: 'none', border: `1px solid ${ACCENT}`, color: ACCENT, borderRadius: 7, padding: '6px 14px', fontSize: 13, cursor: 'pointer' }}
        >
          Reintentar
        </button>
      </div>
    );
  }

  return (
    <section aria-label="Resumen de métricas" role="region">
      <div style={s.statsGrid}>
        {KPI_ORDER.map((kpi) => (
          <KpiCard
            key={kpi.key}
            icon={kpi.icon}
            label={td?.[kpi.labelKey] || kpi.key}
            value={metrics?.[kpi.key]}
          />
        ))}
      </div>

      {/* Resumen contextual */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 24 }}>
        <div style={{ ...s.statCard, flex: '1 1 200px', padding: '14px 18px' }}>
          <div style={{ fontSize: 12, color: MUTED, marginBottom: 4 }}>{td.kpiTotalUsers}</div>
          <div style={{ ...s.statValue, fontSize: 20 }}>
            {metrics?.totalUsers ?? '—'}
          </div>
          <div style={{ fontSize: 11, color: MUTED, marginTop: 2 }}>
            {metrics?.totalActiveUsers != null
              ? `${metrics.totalActiveUsers} activos`
              : ''}
          </div>
        </div>
        <div style={{ ...s.statCard, flex: '1 1 200px', padding: '14px 18px' }}>
          <div style={{ fontSize: 12, color: MUTED, marginBottom: 4 }}>{td.kpiTotalOrders}</div>
          <div style={{ ...s.statValue, fontSize: 20 }}>
            {metrics?.totalOrders ?? '—'}
          </div>
          <div style={{ fontSize: 11, color: MUTED, marginTop: 2 }}>
            {metrics?.activeOrders != null
              ? `${metrics.activeOrders} activos`
              : ''}
          </div>
        </div>
        <div style={{ ...s.statCard, flex: '1 1 200px', padding: '14px 18px' }}>
          <div style={{ fontSize: 12, color: MUTED, marginBottom: 4 }}>{td.kpiActiveStores}</div>
          <div style={{ ...s.statValue, fontSize: 20 }}>
            {metrics?.activeStores ?? '—'}
          </div>
          <div style={{ fontSize: 11, color: MUTED, marginTop: 2 }}>
            {metrics?.activeProducts != null
              ? `${metrics.activeProducts} productos`
              : ''}
          </div>
        </div>
      </div>
    </section>
  );
}
