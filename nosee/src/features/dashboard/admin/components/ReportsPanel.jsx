/**
 * ReportsPanel.jsx
 *
 * Panel de moderación/reportes para el admin dashboard.
 * Consume getAdminReportsMetrics() desde adminMetrics.api.js.
 *
 * UBICACIÓN: src/features/dashboard/admin/components/ReportsPanel.jsx
 */
import { useState, useEffect } from 'react';
import { getAdminReportsMetrics } from '@/services/api/adminMetrics.api';
import { useLanguage } from '@/contexts/LanguageContext';
import { s, MUTED } from '../adminStyles';
import { SummaryCard } from './SummaryCard';

export default function ReportsPanel() {
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

      const result = await getAdminReportsMetrics();

      if (!isMounted) return;

      if (result.success) {
        setMetrics(result.data);
      } else {
        setError(result.error || td.reportsPanel.errorLoad);
      }
      setIsLoading(false);
    }

    load();
    return () => { isMounted = false; };
  }, []);

  if (isLoading) {
    return (
      <div style={{ textAlign: 'center', padding: 32, color: MUTED }}>
        {td.reportsPanel.loading}
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ textAlign: 'center', padding: 32, color: 'var(--error)' }}>
        {error}
      </div>
    );
  }

  if (!metrics) return null;

  const breakdown = metrics.breakdownByReason || {};
  const reasonEntries = Object.entries(breakdown);
  const latestReports = metrics.latestPendingReports || [];

  return (
    <>
      <div style={s.summaryGrid}>
        <SummaryCard
          title={td.summaryByStatus || 'Resumen'}
          counts={{ pending: metrics.pendingBacklog, resolved: metrics.resolvedCount, total: metrics.totalReports }}
          labels={{ pending: td.reportsPanel.labelPending, resolved: td.reportsPanel.labelResolved, total: td.reportsPanel.labelTotal }}
        />

        <SummaryCard
          title={td.summaryByType || 'Por razón'}
          counts={Object.fromEntries(reasonEntries)}
          labels={Object.fromEntries(reasonEntries.map(([r]) => [r, td.reportTypes?.[r] || r]))}
        />
      </div>

      {/* Últimos reportes pendientes */}
      {latestReports.length > 0 && (
        <div style={s.section}>
          <div style={s.sectionHead}>
            <span style={s.sectionTitle}>
              {td.reportsPanel.recentPending}
            </span>
          </div>
          {latestReports.slice(0, 5).map((report) => (
            <div key={report.id} style={s.reportCard}>
              <div style={s.reportTop}>
                <span style={{
                  ...s.severityBadge,
                  background: report.severity === 'alta'
                    ? 'var(--error-soft)' : report.severity === 'media'
                    ? 'var(--warning-soft)' : 'var(--info-soft)',
                  color: report.severity === 'alta'
                    ? 'var(--error)' : report.severity === 'media'
                    ? 'var(--warning)' : 'var(--info)',
                }}>
                  {report.severity}
                </span>
                <span style={s.statusPill}>{report.reported_type}</span>
                <span style={{ fontSize: 12, color: MUTED, marginLeft: 'auto' }}>
                  {new Date(report.created_at).toLocaleDateString('es-CO')}
                </span>
              </div>
              <div style={{ fontSize: 13, color: MUTED }}>
                {td.reportTypes?.[report.reason] || report.reason} — ID: {report.reported_id}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
