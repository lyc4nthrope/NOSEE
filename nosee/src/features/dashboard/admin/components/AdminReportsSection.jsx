import { lazy, Suspense } from 'react';
import { s } from '../adminStyles';
import { REPORT_STATUS_OPTIONS, normalizeReportStatus } from '../adminConstants';
import { ReportCard } from './ReportCard';
import { ReportDetailsModal } from '../modals/ReportDetailsModal';

const ReportsPanel = lazy(() => import('./ReportsPanel'));

export default function AdminReportsSection({
  reports,
  reportStatusFilter, setReportStatusFilter,
  reportTypeFilter, setReportTypeFilter,
  reportSort, setReportSort,
  selectedReport, setSelectedReport,
  filteredReports,
  handleQuickAction, updateReportData,
  reportTypeOptions,
  td,
}) {
  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <h1 style={s.headerTitle}>{td.reportsTitle}</h1>
          <p style={s.headerSub}>{td.reportsSub}</p>
        </div>
      </div>

      <Suspense fallback={<div style={{ padding: 40, textAlign: 'center' }}>Cargando…</div>}>
        <ReportsPanel />
      </Suspense>

      {reports.length > 0 && (
        <>
          <div style={s.reportFiltersGrid} className="admin-report-filters">
            <label style={s.filterLabelWrap}>
              <span style={s.filterLabel}>{td.filterStatusLabel}</span>
              <select value={reportStatusFilter} onChange={(e) => setReportStatusFilter(e.target.value)} style={s.filterSelect}>
                <option value="all">{td.filterAllReports}</option>
                {REPORT_STATUS_OPTIONS.map((status) => (
                  <option key={status} value={status}>{td.statusLabels?.[status] || status}</option>
                ))}
              </select>
            </label>
            <label style={s.filterLabelWrap}>
              <span style={s.filterLabel}>{td.filterTypeLabel}</span>
              <select value={reportTypeFilter} onChange={(e) => setReportTypeFilter(e.target.value)} style={s.filterSelect}>
                <option value="all">{td.filterAll}</option>
                {reportTypeOptions.map((type) => (
                  <option key={type} value={type}>{td.reportTypes?.[type] || type}</option>
                ))}
              </select>
            </label>
            <label style={s.filterLabelWrap}>
              <span style={s.filterLabel}>{td.filterSortLabel}</span>
              <select value={reportSort} onChange={(e) => setReportSort(e.target.value)} style={s.filterSelect}>
                <option value="recent">{td.sortRecent}</option>
                <option value="oldest">{td.sortOldest}</option>
              </select>
            </label>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {filteredReports.map(r => (
              <ReportCard
                key={r.id}
                report={r}
                showActions={r.status === 'PENDING' || r.status === 'IN_REVIEW'}
                onResolve={handleQuickAction}
                onOpenDetails={() => setSelectedReport(r)}
              />
            ))}
          </div>
        </>
      )}

      {selectedReport && (
        <ReportDetailsModal
          report={selectedReport}
          onClose={() => setSelectedReport(null)}
          onSave={async (updates) => {
            const ok = await updateReportData(selectedReport, updates);
            if (ok) {
              setSelectedReport((prev) => prev ? { ...prev, ...updates, status: normalizeReportStatus(updates.status || prev.status) } : null);
            }
          }}
        />
      )}
    </>
  );
}
