import { useState, useEffect } from 'react';
import { getPublicationById } from '@/services/api/adminCatalog.api';
import { useLanguage } from '@/contexts/LanguageContext';
import { sanitizeHTML } from '@/services/utils/sanitize';
import { s, CLOSE_BTN_STYLE, TEXT, BORDER, MUTED } from '../adminStyles';
import { DetailRow, SectionHeader, StatusBadge } from '../components/AdminPrimitives';
import { useFocusTrap } from '../hooks/useFocusTrap';
import {
  REPORT_STATUS_OPTIONS,
  SEVERITY_COLORS,
  REPORT_SEVERITY,
  normalizeReportStatus,
} from '../adminConstants';
import { useClientDateFormat } from '../adminUtils';

export function ReportDetailsModal({ report, onClose, onSave }) {
  const { t, lang } = useLanguage();
  const td = t.adminDashboard;
  const modalRef = useFocusTrap(true);
  const [form, setForm] = useState({
    status: normalizeReportStatus(report.status),
    actionTaken: report.actionTaken || '',
    modNotes: report.modNotes || '',
  });
  const [ui, setUi] = useState({ saving: false, saved: false });
  const [pubData, setPubData] = useState({ pub: report.publicationSummary || null, pubDeleted: false });

  const { pub, pubDeleted } = pubData;

  const reportDate = useClientDateFormat(report.createdAt, lang);
  const resolvedDate = useClientDateFormat(report.resolvedAt, lang);

  useEffect(() => {
    if (pub || !report.publicationId) return;
    let cancelled = false;
    (async () => {
      const result = await getPublicationById(report.publicationId);
      if (cancelled) return;
      if (result.success && result.data) {
        const d = result.data;
        const quantity = d.products?.base_quantity;
        const unitAbbr = d.products?.unit_type?.abbreviation || d.products?.unit_type?.name;
        setPubData({
          pub: {
            productName: d.products?.name || '—',
            brand: d.products?.brand?.name || '—',
            unit: quantity && unitAbbr ? `${quantity} ${unitAbbr}` : '—',
            store: d.store?.name || '—',
            price: typeof d.price === 'number'
              ? d.price.toLocaleString(lang, { style: 'currency', currency: 'COP' })
              : '—',
            isActive: d.is_active,
          },
          pubDeleted: d.is_active === false,
        });
      } else {
        setPubData({ pub: null, pubDeleted: true });
      }
    })();
    return () => { cancelled = true; };
  }, [pub, report.publicationId, lang]);

  const setField = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  const save = async () => {
    setUi({ saving: true, saved: false });
    await onSave({ ...form });
    setUi({ saving: false, saved: true });
  };

  const sev = SEVERITY_COLORS[report.severity] || SEVERITY_COLORS.baja;
  const typeLabel = td.reportTypes?.[report.rawType] || report.rawType || '—';
  const severityLabel = td.severityLabels?.[report.severity] || report.severity?.toUpperCase() || '—';

  return (
    <div role="presentation" style={s.modalOverlay} onClick={onClose} onKeyDown={(e) => { if (e.key === 'Escape') onClose(); }}>
      <div ref={modalRef} role="dialog" aria-modal="true" aria-labelledby="report-detail-title" style={{ ...s.modalCard, maxHeight: '90vh', overflowY: 'auto' }} onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
        {/* Cabecera */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
          <div>
            <h2 id="report-detail-title" style={{ margin: 0, fontSize: 18, color: TEXT }}>{td.reportDetailTitle}</h2>
            <p style={{ ...s.headerSub, margin: '4px 0 0' }}>{typeof td.reportDetailSubtitle === 'function' ? td.reportDetailSubtitle(report.id) : `ID: ${report.id}`}</p>
          </div>
          <button onClick={onClose} title={td.cancel} aria-label={td.cancel} style={CLOSE_BTN_STYLE}>✕</button>
        </div>

        {/* Badges de tipo, severidad y estado */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
          <span style={{ ...s.severityBadge, background: sev.bg, color: sev.text }}>{severityLabel}</span>
          <span style={{ ...s.badge, background: 'var(--info-soft)', color: 'var(--text-secondary)' }}>{typeLabel}</span>
          <span style={s.statusPill}>{td.statusLabels?.[normalizeReportStatus(report.status)] || report.status}</span>
        </div>

        {/* Info del reporte */}
        <div style={{ ...s.section, marginBottom: 16 }}>
          <div style={{ ...s.sectionHead, marginBottom: 10 }}>
            <span style={s.sectionTitle}>{td.reportInfoTitle}</span>
          </div>
          <div style={s.detailGrid}>
            <DetailRow label={td.labelReason} value={typeLabel} />
            <DetailRow label={td.labelReportedBy} value={report.reporter || td.anonymous} />
            <DetailRow label={td.labelReportedUser} value={report.reported || td.unknown} />
            <DetailRow label={td.labelReportDate} value={reportDate} />
            {report.resolvedAt && <DetailRow label={td.labelResolvedDate} value={resolvedDate} />}
            {report.reviewer && <DetailRow label={td.labelReviewedBy} value={report.reviewer} />}
          </div>
        </div>

        {/* Descripción del reporte */}
        {report.description && (
          <div style={{ ...s.section, marginBottom: 16 }}>
            <div style={{ ...s.sectionHead, marginBottom: 8 }}>
              <span style={s.sectionTitle}>{td.labelDescription}</span>
            </div>
            <p style={s.descriptionBox}>
              {sanitizeHTML(report.description)}
            </p>
          </div>
        )}

        {/* Publicación relacionada */}
        {(pub || (report.publicationId && pubDeleted)) && (
          <div style={{ ...s.section, marginBottom: 16 }}>
            <div style={{ ...s.sectionHead, marginBottom: 10 }}>
              <span style={s.sectionTitle}>{td.labelReportedPub}</span>
              {pubDeleted && (
                <span style={{ fontSize: 12, fontWeight: 700, background: 'var(--error-soft)', color: 'var(--error)', borderRadius: 4, padding: '2px 8px' }}>
                  {pub ? td.pubDeactivated : td.pubDeletedLabel}
                </span>
              )}
            </div>
            {pub ? (
              <div style={s.detailGrid}>
                <DetailRow label={td.colProduct} value={pub.productName} />
                <DetailRow label={td.colBrand} value={pub.brand} />
                <DetailRow label={td.colUnit} value={pub.unit} />
                <DetailRow label={td.colStore} value={pub.store} />
                <DetailRow label={td.colPrice} value={pub.price} />
              </div>
            ) : (
              <p style={{ margin: 0, fontSize: 13, color: MUTED }}>
                {td.pubHiddenCompletely(report.publicationId)}
              </p>
            )}
          </div>
        )}

        {/* Imagen de evidencia */}
        {report.evidenceUrl && (
          <div style={{ ...s.section, marginBottom: 16 }}>
            <div style={{ ...s.sectionHead, marginBottom: 10 }}>
              <span style={s.sectionTitle}>{td.labelEvidence}</span>
            </div>
            <img
              src={sanitizeHTML(report.evidenceUrl)}
              alt={td.evidenceAlt}
              style={{ width: '100%', maxHeight: 260, objectFit: 'cover', borderRadius: 8, border: `1px solid ${BORDER}` }}
              onError={(e) => { e.currentTarget.style.display = 'none'; }}
            />
            <a href={sanitizeHTML(report.evidenceUrl)} target="_blank" rel="noreferrer" style={{ ...s.linkBtn, display: 'block', marginTop: 6, fontSize: 12 }}>
              {td.viewOriginalImage}
            </a>
          </div>
        )}

        <hr style={{ border: 'none', borderTop: `1px solid ${BORDER}`, margin: '16px 0' }} />

        {/* Campos editables */}
        <label style={s.filterLabelWrap}>
          <span style={s.filterLabel}>{td.filterStatusLabel}</span>
          <select value={form.status} onChange={(e) => setField('status', e.target.value)} style={s.filterSelect}>
            {REPORT_STATUS_OPTIONS.map((item) => (
              <option key={item} value={item}>{td.statusLabels?.[item] || item}</option>
            ))}
          </select>
        </label>

        <label style={s.filterLabelWrap}>
          <span style={s.filterLabel}>{td.labelActionTaken}</span>
          <textarea
            value={form.actionTaken}
            onChange={(e) => setField('actionTaken', e.target.value)}
            placeholder={td.actionTakenPlaceholder}
            style={s.modalTextarea}
            rows={3}
          />
        </label>

        <label style={s.filterLabelWrap}>
          <span style={s.filterLabel}>{td.labelModNotes}</span>
          <textarea
            value={form.modNotes}
            onChange={(e) => setField('modNotes', e.target.value)}
            placeholder={td.modNotesPlaceholder}
            style={s.modalTextarea}
            rows={3}
          />
        </label>

        {ui.saved && (
          <p style={{ margin: '8px 0 0', fontSize: 13, color: 'var(--success)', textAlign: 'right' }}>
            ✓ {td.reportSavedOk}
          </p>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
          <button onClick={onClose} style={s.btnDismiss}>{td.cancel}</button>
          <button onClick={save} style={{ ...s.filterBtn, ...s.filterBtnActive }} disabled={ui.saving}>
            {ui.saving ? '...' : td.saveReportBtn}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ReportDetailsModal;
