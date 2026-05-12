import { useLanguage } from '@/contexts/LanguageContext';
import { s, MUTED, TEXT, BORDER } from '../adminStyles';
import { SEVERITY_COLORS, REPORT_SEVERITY, getReportTargetTypeLabel, normalizeReportStatus } from '../adminConstants';

export function ReportCard({ report, showActions, onResolve, onOpenDetails }) {
  const { t } = useLanguage();
  const td = t.adminDashboard;
  const sev = SEVERITY_COLORS[report.severity] || SEVERITY_COLORS.baja;
  const typeLabel = td.reportTypes?.[report.rawType] || report.rawType;
  const severityLabel = td.severityLabels?.[report.severity] || report.severity?.toUpperCase();
  const statusLabel = td.statusLabels?.[normalizeReportStatus(report.status)] || report.status;
  const canHideTarget = ['publication', 'store', 'product', 'brand', 'comment'].includes(String(report.reportedType || '').toLowerCase());
  return (
    <article style={s.reportCard}>
      <div style={s.reportTop} className="admin-report-top">
        <span style={{ ...s.severityBadge, background: sev.bg, color: sev.text }}>
          {severityLabel}
        </span>
        <span style={{ fontSize: 'var(--admin-fs-md)', fontWeight: 600 }}>{typeLabel}</span>
        <span style={s.statusPill}>{statusLabel}</span>
        <span style={{ marginLeft: 'auto', fontSize: 'var(--admin-fs-sm)', color: MUTED }}>{report.time}</span>
      </div>
      <div className="admin-report-info-rows" style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
        {[
          [td.labelReportedType, report.targetLabel || getReportTargetTypeLabel(report.reportedType, td)],
          [td.labelReportedItem, `"${report.post ?? td.deletedPub}"`],
          [td.labelReportedBy,    report.reporter ?? td.anonymous],
          [td.labelReportedUser,  report.reported ?? td.unknown],
          [td.labelElementId, report.reportedId || '—'],
        ].map(([label, value]) => (
          <div key={label} style={{ display: 'flex', gap: 12, fontSize: 'var(--admin-fs-md)' }}>
            <span style={{ color: MUTED, width: 150, flexShrink: 0 }}>{label}</span>
            <span style={{ color: TEXT }}>{value}</span>
          </div>
        ))}

        {report.publicationSummary && (
          <div style={{ marginTop: 8, padding: '10px 14px', borderRadius: 8, background: 'var(--bg-surface)', border: `1px solid ${BORDER}` }}>
            <p style={{ margin: '0 0 8px', fontSize: 'var(--admin-fs-xs)', fontWeight: 600, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              {td.labelReportedPub}
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 16px' }}>
              {[
                [td.colBrand,  report.publicationSummary.brand],
                [td.colStore,  report.publicationSummary.store],
                [td.colUnit,   report.publicationSummary.unit],
                [td.colPrice,  report.publicationSummary.price],
              ].map(([label, value]) => (
                <div key={label} style={{ display: 'flex', gap: 6, fontSize: 'var(--admin-fs-base)' }}>
                  <span style={{ color: MUTED, flexShrink: 0 }}>{label}:</span>
                  <span style={{ color: TEXT, fontWeight: 500 }}>{value}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <button style={s.filterBtn} onClick={onOpenDetails} title={td.viewReportDetailBtn}>{td.viewReportDetailBtn}</button>
        {showActions && (
          <>
            {canHideTarget && (
              <button style={s.btnDelete} onClick={() => onResolve(report, 'hide')} title={td.hideContentTitle}>
                {td.hideContentBtn}
              </button>
            )}
            {report.reportedUserId && (
              <button style={s.btnBan} onClick={() => onResolve(report, 'ban')} title={td.banUserBtn}>
                {td.banUserBtn}
              </button>
            )}
            <button style={s.btnDismiss} onClick={() => onResolve(report, 'reject')} title={td.dismissBtn}>
              {td.dismissBtn}
            </button>
          </>
        )}
      </div>
    </article>
  );
}

export default ReportCard;
