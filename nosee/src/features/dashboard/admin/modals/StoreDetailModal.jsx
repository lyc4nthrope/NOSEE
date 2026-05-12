import { useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { s, CLOSE_BTN_STYLE, TEXT, BORDER } from '../adminStyles';
import { DetailRow } from '../components/AdminPrimitives';
import { useClientDateFormat } from '../adminUtils';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { sanitizeHTML } from '@/services/utils/sanitize';

export function StoreDetailModal({ store, onClose, onDelete, isDeleting, onSave }) {
  const { t } = useLanguage();
  const td = t.adminDashboard;
  const modalRef = useFocusTrap(true);
  const [form, setForm] = useState({
    name: store.name || '',
    storeTypeId: String(store.store_type_id || '1'),
    address: store.address || '',
    websiteUrl: store.website_url || '',
  });
  const [ui, setUi] = useState({ saving: false, saved: false, errorMsg: '' });
  const createdAt = useClientDateFormat(store.created_at);

  const isPhysical = form.storeTypeId === '1';
  const setField = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  const save = async () => {
    if (!form.name.trim()) { setUi(prev => ({ ...prev, errorMsg: td.storeDetailModal.nameRequired })); return; }
    setUi({ saving: true, saved: false, errorMsg: '' });
    const updates = { name: form.name.trim(), store_type_id: Number(form.storeTypeId) };
    if (isPhysical) updates.address = form.address.trim() || null;
    else updates.website_url = form.websiteUrl.trim() || null;
    const ok = await onSave(store.id, updates);
    setUi({ saving: false, saved: ok !== false, errorMsg: '' });
  };

  return (
    <div role="presentation" className="admin-modal-overlay" style={s.modalOverlay} onClick={onClose} onKeyDown={(e) => { if (e.key === 'Escape') onClose(); }}>
      <div ref={modalRef} role="dialog" aria-modal="true" aria-labelledby="store-detail-title" style={{ ...s.modalCard, maxWidth: 560 }} onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
          <div>
            <h2 id="store-detail-title" style={{ margin: 0, fontSize: 'var(--admin-fs-xl)', color: TEXT }}>{td.storeDetailTitle}</h2>
            <p style={{ ...s.headerSub, margin: '4px 0 0' }}>ID: {store.id}</p>
          </div>
          <button onClick={onClose} aria-label={td.storeDetailModal.closeAria} title={td.storeDetailModal.closeAria} style={CLOSE_BTN_STYLE}>✕</button>
        </div>

        <div style={s.detailGrid}>
          <DetailRow label={td.labelName} value={sanitizeHTML(store.name) || '—'} />
          <DetailRow label={td.labelType} value={sanitizeHTML(store.typeLabel) || '—'} />
          <DetailRow label={td.labelAddress} value={sanitizeHTML(store.address) || '—'} />
          <DetailRow label={td.labelWeb} value={sanitizeHTML(store.website_url) || '—'} />
          <DetailRow label={td.labelCreatedAt} value={createdAt} />
          <DetailRow label={td.labelRelatedPubs} value={store.relatedCount ?? 0} />
        </div>

        <hr style={{ border: 'none', borderTop: `1px solid ${BORDER}`, margin: '12px 0' }} />

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <label style={s.filterLabelWrap}>
            <span style={s.filterLabel}>{td.storeDetailModal.nameLabel}</span>
            <input value={form.name} onChange={(e) => setField('name', e.target.value)} style={{ ...s.filterSelect, fontFamily: 'inherit' }} placeholder={td.storeDetailModal.namePlaceholder} />
          </label>

          <label style={s.filterLabelWrap}>
            <span style={s.filterLabel}>{td.storeDetailModal.typeLabel}</span>
            <select value={form.storeTypeId} onChange={(e) => setField('storeTypeId', e.target.value)} style={s.filterSelect}>
              <option value="1">{td.storeDetailModal.physicalOption}</option>
              <option value="2">{td.storeDetailModal.virtualOption}</option>
            </select>
          </label>

          {isPhysical ? (
            <label style={s.filterLabelWrap}>
              <span style={s.filterLabel}>{td.storeDetailModal.addressLabel}</span>
              <input value={form.address} onChange={(e) => setField('address', e.target.value)} style={{ ...s.filterSelect, fontFamily: 'inherit' }} placeholder={td.storeDetailModal.addressPlaceholder} />
            </label>
          ) : (
            <label style={s.filterLabelWrap}>
              <span style={s.filterLabel}>{td.storeDetailModal.websiteLabel}</span>
              <input value={form.websiteUrl} onChange={(e) => setField('websiteUrl', e.target.value)} style={{ ...s.filterSelect, fontFamily: 'inherit' }} placeholder={td.storeDetailModal.websitePlaceholder} />
            </label>
          )}
        </div>

        {ui.errorMsg && <p style={{ margin: '10px 0 0', fontSize: 'var(--admin-fs-base)', color: 'var(--error)', textAlign: 'right' }}>{ui.errorMsg}</p>}
        {ui.saved && <p style={{ margin: '10px 0 0', fontSize: 'var(--admin-fs-base)', color: 'var(--success)', textAlign: 'right' }}>{td.storeDetailModal.savedOk}</p>}

        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 16, gap: 10 }}>
          <button onClick={onDelete} style={s.btnDelete} disabled={isDeleting}>
            {isDeleting ? td.hidingBtn : td.hideStoreBtn}
          </button>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={onClose} style={s.btnDismiss}>{td.storeDetailModal.closeBtn}</button>
            <button onClick={save} style={{ ...s.filterBtn, ...s.filterBtnActive }} disabled={ui.saving}>
              {ui.saving ? '...' : td.storeDetailModal.saveChangesBtn}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default StoreDetailModal;
