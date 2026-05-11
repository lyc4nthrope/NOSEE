/**
 * LogsPanel.jsx
 *
 * Panel resumen de logs para el admin dashboard.
 * Consume getAdminLogsMetrics() desde adminMetrics.api.js.
 * No reemplaza la vista detallada de logs, solo muestra resúmenes.
 *
 * UBICACIÓN: src/features/dashboard/admin/components/LogsPanel.jsx
 */
import { useState, useEffect } from 'react';
import { getAdminLogsMetrics } from '@/services/api/adminMetrics.api';
import { useLanguage } from '@/contexts/LanguageContext';
import { s, ACCENT, MUTED, TEXT } from '../adminStyles';

function LogStatCard({ label, count24h, count7d, color, td, bg }) {
  return (
    <div style={{
      ...s.statCard,
      flex: '1 1 180px',
      padding: 0,
      overflow: 'hidden',
    }}>
      <div style={{
        padding: '14px 18px',
        background: bg || 'transparent',
      }}>
        <div style={{ fontSize: 12, color: MUTED, marginBottom: 6 }}>{label}</div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <span style={{ ...s.statValue, fontSize: 22, color: color || TEXT }}>
            {count24h ?? '—'}
          </span>
          <span style={{ fontSize: 11, color: MUTED }}>{td.logsPanel.in24h}</span>
        </div>
      </div>
      <div style={{ fontSize: 11, color: MUTED, padding: '0 18px 14px', marginTop: 2 }}>
        {count7d != null ? `${count7d} ${td.logsPanel.in7d}` : ''}
      </div>
    </div>
  );
}

export default function LogsPanel() {
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

      const result = await getAdminLogsMetrics();

      if (!isMounted) return;

      if (result.success) {
        setMetrics(result.data);
      } else {
        setError(result.error || td.logsPanel.errorLoad);
      }
      setIsLoading(false);
    }

    load();
    return () => { isMounted = false; };
  }, []);

  if (isLoading) {
    return (
      <div style={{ textAlign: 'center', padding: 32, color: MUTED }}>
        {td.logsPanel.loading}
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

  return (
    <>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
        <LogStatCard
          label={td.logsPanel.loginEvents}
          count24h={metrics.loginEvents24h}
          count7d={metrics.loginEvents7d}
          color="var(--text-secondary)"
          bg="var(--info-soft)"
          td={td}
        />
        <LogStatCard
          label={td.logsPanel.userActivity}
          count24h={metrics.activityEvents24h}
          count7d={metrics.activityEvents7d}
          color={ACCENT}
          bg="var(--accent-soft)"
          td={td}
        />
        <LogStatCard
          label={td.logsPanel.adminActions}
          count24h={metrics.adminEvents24h}
          count7d={metrics.adminEvents7d}
          color="var(--warning)"
          bg="var(--warning-soft)"
          td={td}
        />
      </div>

      {/* Últimos eventos */}
      {metrics.latestEvents?.length > 0 && (
        <div style={s.section}>
          <div style={s.sectionHead}>
            <span style={s.sectionTitle}>
              {td.logsPanel.recentEvents}
            </span>
          </div>
          <div style={{ ...s.configCard, overflowX: 'auto' }}>
            {(metrics.latestEvents || []).slice(0, 10).map((event, idx) => (
              <div
                key={`${event.source}-${event.event_id}`}
                style={{
                  ...s.configRow,
                  background: idx % 2 === 0 ? 'transparent' : 'var(--bg-elevated)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{
                    width: 6, height: 6, borderRadius: '50%',
                    background: event.source === 'login' ? 'var(--text-secondary)'
                      : event.source === 'activity' ? ACCENT : 'var(--warning)',
                    flexShrink: 0,
                  }} />
                  <span style={{ fontSize: 11, fontWeight: 600, color: MUTED }}>
                    {event.source}
                  </span>
                </div>
                <span style={{ fontSize: 12, color: TEXT }}>{event.action}</span>
                <span style={{ fontSize: 11, color: MUTED }}>
                  {event.created_at
                    ? new Date(event.created_at).toLocaleDateString('es-CO', {
                        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                      })
                    : ''}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
