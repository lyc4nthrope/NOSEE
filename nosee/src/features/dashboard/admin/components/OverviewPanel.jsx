import { useState, useEffect } from 'react';
import { getAdminOverviewMetrics } from '@/services/api/adminMetrics.api';
import { useLanguage } from '@/contexts/LanguageContext';
import { s } from '../adminStyles';
import { KpiCard } from './KpiCard';

const KPI_SECTIONS = [
  {
    key: 'users',
    labelKey: 'titleUsers',
    accent: 'var(--accent)',
    items: [
      { key: 'totalUsers', icon: '👥', labelKey: 'totalUsers' },
      { key: 'totalActiveUsers', icon: '✓', labelKey: 'activeUsers' },
      { key: 'loginsLast24h', icon: '🔑', labelKey: 'logins24h' },
    ],
  },
  {
    key: 'content',
    labelKey: 'titleContent',
    accent: '#0891b2',
    items: [
      { key: 'totalPublications', icon: '📄', labelKey: 'totalPublications' },
      { key: 'activePublications', icon: '📋', labelKey: 'activePublications' },
      { key: 'publicationsToday', icon: '📝', labelKey: 'publicationsToday' },
      { key: 'validationsToday', icon: '✓', labelKey: 'validationsToday' },
    ],
  },
  {
    key: 'commerce',
    labelKey: 'titleCommerce',
    accent: '#7c3aed',
    items: [
      { key: 'totalOrders', icon: '📦', labelKey: 'totalOrders' },
      { key: 'activeOrders', icon: '🛒', labelKey: 'activeOrders' },
    ],
  },
  {
    key: 'platform',
    labelKey: 'titlePlatform',
    accent: '#059669',
    items: [
      { key: 'activeStores', icon: '🏪', labelKey: 'activeStores' },
      { key: 'activeProducts', icon: '🏷️', labelKey: 'activeProducts' },
      { key: 'activeDealers', icon: '🛵', labelKey: 'activeDealers' },
      { key: 'pendingDealerApplications', icon: '📋', labelKey: 'pendingDealerApps' },
    ],
  },
];

function LoadingSkeleton() {
  return (
    <>
      {[1, 2, 3, 4].map((sectionIdx) => (
        <div key={sectionIdx} style={s.kpiSection}>
          <div style={{ height: 14, width: 100, background: 'var(--border)', borderRadius: 4, marginBottom: 12 }} />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} style={{ ...s.kpiLoadingSkeleton, padding: '18px 20px' }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--border)', marginBottom: 12 }} />
                <div style={{ height: 26, width: '60%', background: 'var(--border)', borderRadius: 6, marginBottom: 4 }} />
                <div style={{ height: 12, width: '40%', background: 'var(--border)', borderRadius: 4 }} />
              </div>
            ))}
          </div>
        </div>
      ))}
    </>
  );
}

export default function OverviewPanel() {
  const { t } = useLanguage();
  const td = t.adminDashboard;
  const kpiT = td?.overviewKpi || {};

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
      <div style={{ textAlign: 'center', padding: 40, background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12 }}>
        <div style={{ fontSize: 14, color: 'var(--error)', marginBottom: 12 }}>{error}</div>
        <button
          onClick={() => window.location.reload()}
          style={{ background: 'none', border: '1px solid var(--accent)', color: 'var(--accent)', borderRadius: 7, padding: '8px 16px', fontSize: 13, cursor: 'pointer', fontWeight: 600, minHeight: 44, minWidth: 44 }}
        >
          {td.retry || 'Reintentar'}
        </button>
      </div>
    );
  }

  const pendingReports = metrics?.pendingReports ?? 0;

  return (
    <section aria-label="System metrics overview" role="region">
      {KPI_SECTIONS.map((section) => (
        <div key={section.key} style={s.kpiSection}>
          <div style={s.kpiSectionLabel}>
            {kpiT[section.labelKey] || section.labelKey}
          </div>
          <div style={s.statsGrid}>
            {section.items.map((kpi) => (
              <KpiCard
                key={kpi.key}
                icon={kpi.icon}
                label={kpiT[kpi.labelKey] || kpi.key}
                value={metrics?.[kpi.key]}
                accentColor={section.accent}
                accentBg={`${section.accent}18`}
              />
            ))}
          </div>
        </div>
      ))}

      {/* Alerts section — always visible, highlights when > 0 */}
      <div style={s.kpiSection}>
        <div style={s.kpiSectionLabel}>
          {kpiT.titleAlerts || 'Alertas'}
        </div>
        <div
          style={s.kpiAlertCard}
          role="alert"
          aria-label={`${kpiT.pendingReports || 'Pending reports'}: ${pendingReports}`}
        >
          <div style={s.kpiAlertIcon}>⚠</div>
          <div>
            <div style={s.kpiAlertValue}>{pendingReports}</div>
            <div style={s.kpiAlertLabel}>
              {pendingReports === 0
                ? (kpiT.noPendingReports || 'Sin reportes pendientes')
                : (kpiT.pendingReports || 'Pending reports')}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
