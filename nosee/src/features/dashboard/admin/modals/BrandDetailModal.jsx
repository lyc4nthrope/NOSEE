import { useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { s, CLOSE_BTN_STYLE, TEXT, BORDER } from '../adminStyles';
import { DetailRow } from '../components/AdminPrimitives';
import { useClientDateFormat } from '../adminUtils';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { sanitizeHTML } from '@/services/utils/sanitize';

export function BrandDetailModal({ brand, onClose, onDelete, isDeleting, onSave }) {
  const { t } = useLanguage();
  const td = t.adminDashboard;
  const modalRef = useFocusTrap(true);
  const [name, setName] = useState(brand.name || '');
  const [ui, setUi] = useState({ saving: false, saved: false, errorMsg: '' });
  const createdAt = useClientDateFormat(brand.created_at);

  const save = async () => {
    if (!name.trim()) { setUi(prev => ({ ...prev, errorMsg: td.brandDetailModal.nameRequired })); return; }
    setUi({ saving: true, saved: false, errorMsg: '' });
    const ok = await onSave(brand.id, { name: name.trim() });
    setUi({ saving: false, saved: ok !== false, errorMsg: '' });
  };

  return (
    <div role="presentation" className="admin-modal-overlay" style={s.modalOverlay} onClick={onClose} onKeyDown={(e) => { if (e.key === 'Escape') onClose(); }}>
      <div ref={modalRef} role="dialog" aria-modal="true" aria-labelledby="brand-detail-title" style={{ ...s.modalCard, maxWidth: 560 }} onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
          <div>
            <h2 id="brand-detail-title" style={{ margin: 0, fontSize: 'var(--admin-fs-xl)', color: TEXT }}>{td.brandDetailTitle}</h2>
            <p style={{ ...s.headerSub, margin: '4px 0 0' }}>ID: {brand.id}</p>
          </div>
          <button onClick={onClose} aria-label={td.brandDetailModal.closeAria} title={td.brandDetailModal.closeAria} style={CLOSE_BTN_STYLE}>✕</button>
        </div>
        <div style={s.detailGrid}>
          <DetailRow label={td.colProduct} value={sanitizeHTML(brand.productName) || '—'} />
          <DetailRow label={td.colBarcode} value={sanitizeHTML(brand.productBarcode) || td.noCode} />
          <DetailRow label={td.colBrand} value={sanitizeHTML(brand.name) || '—'} />
          <DetailRow label={td.labelAssociatedProducts} value={brand.productsCount ?? 0} />
          <DetailRow label={td.labelCreatedAt} value={createdAt} />
        </div>

        <hr style={{ border: 'none', borderTop: `1px solid ${BORDER}`, margin: '12px 0' }} />

        <label style={s.filterLabelWrap}>
          <span style={s.filterLabel}>{td.brandDetailModal.nameLabel}</span>
          <input value={name} onChange={(e) => setName(e.target.value)} style={{ ...s.filterSelect, fontFamily: 'inherit' }} placeholder={td.brandDetailModal.namePlaceholder} />
        </label>

        {ui.errorMsg && <p style={{ margin: '10px 0 0', fontSize: 'var(--admin-fs-base)', color: 'var(--error)', textAlign: 'right' }}>{ui.errorMsg}</p>}
        {ui.saved && <p style={{ margin: '10px 0 0', fontSize: 'var(--admin-fs-base)', color: 'var(--success)', textAlign: 'right' }}>{td.brandDetailModal.savedOk}</p>}

        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 16, gap: 10 }}>
          <button onClick={onDelete} style={s.btnDelete} disabled={isDeleting}>
            {isDeleting ? td.hidingBtn : td.hideBrandBtn}
          </button>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={onClose} style={s.btnDismiss}>{td.brandDetailModal.closeBtn}</button>
            <button onClick={save} style={{ ...s.filterBtn, ...s.filterBtnActive }} disabled={ui.saving}>
              {ui.saving ? '...' : td.brandDetailModal.saveChangesBtn}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default BrandDetailModal;
