import { useState, useCallback, useMemo } from 'react';
import { getAdminReports, updateReportReview, updateUserStatus } from '@/services/api/users.api';
import { insertActionLog } from '@/services/api/audit.api';
import { hidePublication, hideStore, hideProduct, hideBrand } from '@/services/api/adminCatalog.api';
import { deleteComment } from '@/services/api/comments.api';
import { useAuthStore } from '@/features/auth/store/authStore';
import { useLanguage } from '@/contexts/LanguageContext';
import { checkRateLimit } from '@/services/utils/rateLimit';
import {
  REPORT_SEVERITY, normalizeReportStatus,
  formatPublicationSummary, getReportTargetTypeLabel, getReportTargetDisplay,
} from '@/features/dashboard/admin/adminConstants';

/**
 * Hook de administración de reportes de usuarios.
 * Expone estado y acciones para listar, filtrar, resolver y tomar acciones sobre reportes.
 *
 * @returns {{
 *   reports: Array,
 *   setReports: Function,
 *   reportsLoading: boolean,
 *   reportsLoaded: boolean,
 *   reportStatusFilter: string,
 *   setReportStatusFilter: Function,
 *   reportTypeFilter: string,
 *   setReportTypeFilter: Function,
 *   reportSort: string,
 *   setReportSort: Function,
 *   selectedReport: Object|null,
 *   setSelectedReport: Function,
 *   resolvedCount: number,
 *   reportTypeOptions: Array,
 *   reportStatusCounts: Object,
 *   reportTypeCounts: Object,
 *   filteredReports: Array,
 *   loadReports: Function,
 *   updateReportData: Function,
 *   handleQuickAction: Function,
 * }}
 */
export default function useAdminReports() {
  const { t, lang } = useLanguage();
  const td = t.adminDashboard;
  const currentUserId = useAuthStore(s => s.user?.id);

  const [reports, setReports] = useState([]);
  const [reportsLoading, setReportsLoading] = useState(false);
  const [reportsLoaded, setReportsLoaded] = useState(false);
  const [reportStatusFilter, setReportStatusFilter] = useState('all');
  const [reportTypeFilter, setReportTypeFilter] = useState('all');
  const [reportSort, setReportSort] = useState('recent');
  const [selectedReport, setSelectedReport] = useState(null);
  const [resolvedCount, setResolvedCount] = useState(0);

  const loadReports = useCallback(async () => {
    setReportsLoading(true);
    try {
      const result = await getAdminReports(1, 50);
      if (!result.success) {
        setReports([]);
        return;
      }

      setReports((result.data || []).map((report) => {
        const publicationSummary = String(report.reported_type || '').toLowerCase() === 'publication'
          ? formatPublicationSummary(report.target)
          : null;
        const reportedType = String(report.reported_type || '').toLowerCase();
        const parsedPublicationId = reportedType === 'publication' ? Number(report.reported_id) : null;
        return {
          id: report.id,
          status: normalizeReportStatus(report.status),
          rawType: report.reason,
          severity: REPORT_SEVERITY[report.reason] || 'baja',
          createdAt: report.created_at,
          resolvedAt: report.resolved_at,
          time: report.created_at ? new Date(report.created_at).toLocaleDateString(lang) : '—',
          description: report.description,
          evidenceUrl: report.evidence_url,
          modNotes: report.mod_notes,
          actionTaken: report.action_taken,
          reviewer: report.reviewer_name || null,
          post: getReportTargetDisplay(report),
          reporter: report.reporter_name || null,
          reported: report.reported_name || null,
          publicationId: Number.isFinite(parsedPublicationId) ? parsedPublicationId : null,
          reportedUserId: report.reported_user_id,
          reportedType,
          reportedId: report.reported_id,
          targetLabel: getReportTargetTypeLabel(report.reported_type, td),
          target: report.target || null,
          publicationSummary,
        };
      }));
      setReportsLoaded(true);
    } finally {
      setReportsLoading(false);
    }
  }, [td, lang]);

  const updateReportData = useCallback(async (report, updates = {}) => {
    const nextStatus = normalizeReportStatus(updates.status || report.status);
    const payload = {
      status: nextStatus,
      mod_notes: updates.modNotes ?? report.modNotes ?? null,
      action_taken: updates.actionTaken ?? report.actionTaken ?? null,
      reviewed_by: currentUserId,
      resolved_at: ['RESOLVED', 'REJECTED'].includes(nextStatus) ? new Date().toISOString() : null,
    };

    const result = await updateReportReview(report.id, payload);
    if (!result.success) {
      console.error('[useAdminReports] updateReportReview:', result.error);
      return false;
    }

    setReports((prev) => prev.map((item) => item.id === report.id
      ? {
        ...item,
        status: nextStatus,
        modNotes: payload.mod_notes,
        actionTaken: payload.action_taken,
        resolvedAt: payload.resolved_at,
      }
      : item));

    if (report.status !== 'RESOLVED' && nextStatus === 'RESOLVED') {
      setResolvedCount((n) => n + 1);
    }

    return true;
  }, [currentUserId, td]);

  const handleQuickAction = useCallback(async (report, action) => {
    const { allowed, retryAfter } = checkRateLimit('admin:quickAction');
    if (!allowed) {
      console.error(`[RateLimit] Espera ${retryAfter}s antes de otra acción`);
      return;
    }
    if (action === 'hide') {
      const type = String(report.reportedType || '').toLowerCase();
      const entityIdRaw = report.reportedId;

      let hideSuccess = true;
      if (type === 'publication' && Number.isFinite(Number(entityIdRaw))) {
        const res = await hidePublication(Number(entityIdRaw), currentUserId, `Ocultado desde Reportes (reporte ${report.id})`);
        hideSuccess = res.success;
      } else if (type === 'store') {
        const res = await hideStore(entityIdRaw, currentUserId, `Ocultado desde Reportes (reporte ${report.id})`);
        hideSuccess = res.success;
      } else if (type === 'product' && Number.isFinite(Number(entityIdRaw))) {
        const res = await hideProduct(Number(entityIdRaw), currentUserId, `Ocultado desde Reportes (reporte ${report.id})`);
        hideSuccess = res.success;
      } else if (type === 'brand' && Number.isFinite(Number(entityIdRaw))) {
        const res = await hideBrand(Number(entityIdRaw), currentUserId, `Ocultado desde Reportes (reporte ${report.id})`);
        hideSuccess = res.success;
      } else if (type === 'comment') {
        const res = await deleteComment(entityIdRaw);
        hideSuccess = res.success;
      } else {
        console.error(`[useAdminReports] No hay acción de ocultado para el tipo "${type || 'desconocido'}".`);
        return;
      }

      if (!hideSuccess) {
        console.error('[useAdminReports] No se pudo ocultar el contenido reportado');
        return;
      }
      insertActionLog(currentUserId, type, entityIdRaw, 'hide_from_report', null, { reportId: report.id });
    }
    if (action === 'ban' && report.reportedUserId) {
      await updateUserStatus(report.reportedUserId, false);
      insertActionLog(currentUserId, 'user', report.reportedUserId, 'ban_user', null, { reportId: report.id });
    }

    const nextStatus = action === 'reject' ? 'REJECTED' : 'RESOLVED';
    await updateReportData(report, { status: nextStatus });
  }, [currentUserId, updateReportData]);

  const reportTypeOptions = useMemo(
    () => [...new Set(reports.map((r) => r.rawType).filter(Boolean))],
    [reports],
  );

  const reportStatusCounts = useMemo(
    () => reports.reduce((acc, report) => {
      const key = normalizeReportStatus(report.status);
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {}),
    [reports],
  );

  const reportTypeCounts = useMemo(
    () => reports.reduce((acc, report) => {
      const key = report.rawType || 'other';
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {}),
    [reports],
  );

  const filteredReports = useMemo(
    () => reports
      .filter((report) => (reportStatusFilter === 'all' ? true : normalizeReportStatus(report.status) === reportStatusFilter))
      .filter((report) => (reportTypeFilter === 'all' ? true : report.rawType === reportTypeFilter))
      .sort((a, b) => {
        const timeA = new Date(a.createdAt || 0).getTime();
        const timeB = new Date(b.createdAt || 0).getTime();
        return reportSort === 'oldest' ? timeA - timeB : timeB - timeA;
      }),
    [reports, reportStatusFilter, reportTypeFilter, reportSort],
  );

  return {
    reports, setReports, reportsLoading, reportsLoaded,
    reportStatusFilter, setReportStatusFilter,
    reportTypeFilter, setReportTypeFilter,
    reportSort, setReportSort,
    selectedReport, setSelectedReport,
    resolvedCount, reportTypeOptions, reportStatusCounts, reportTypeCounts,
    filteredReports,
    loadReports, updateReportData, handleQuickAction,
  };
}
