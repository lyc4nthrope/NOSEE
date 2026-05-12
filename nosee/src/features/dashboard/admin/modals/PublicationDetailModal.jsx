import { useState, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { searchProductsLight, searchStoresLight } from '@/services/api/adminCatalog.api';
import { s, CLOSE_BTN_STYLE, TEXT, BORDER, SURFACE, MUTED } from '../adminStyles';
import { DetailRow, SectionHeader, StatusBadge } from '../components/AdminPrimitives';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { sanitizeHTML } from '@/services/utils/sanitize';

const SEARCH_DROPDOWN_STYLE = {
  position: 'absolute', zIndex: 10, top: '100%', left: 0, right: 0,
  background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 8,
  overflow: 'hidden', boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
};
const SEARCH_RESULT_BTN_STYLE = {
  display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px',
  background: 'none', border: 'none', color: TEXT, cursor: 'pointer',
  fontSize: 'var(--admin-fs-base)', borderBottom: `1px solid ${BORDER}`,
};
const SPINNER_STYLE = {
  position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
  fontSize: 'var(--admin-fs-sm)', color: MUTED,
};

export function PublicationDetailModal({ pub, onClose, onSave, onDelete }) {
  const { t } = useLanguage();
  const td = t.adminDashboard;
  const modalRef = useFocusTrap(true);
  const [form, setForm] = useState({
    isActive: pub.is_active !== false,
    price: pub.price ?? '',
    description: pub.description || '',
    photoUrl: pub.photoUrl || pub.photo_url || '',
  });

  const [productSearch, setProductSearch] = useState({
    query: pub.productName || pub.product?.name || '',
    id: pub.productId || pub.product_id || null,
    results: [], searching: false,
  });

  const [storeSearch, setStoreSearch] = useState({
    query: pub.storeName || pub.store?.name || '',
    id: pub.storeId || pub.store_id || null,
    results: [], searching: false,
  });

  const { query: productQuery, id: productId } = productSearch;
  const { query: storeQuery, id: storeId } = storeSearch;

  const [saveState, setSaveState] = useState({ saving: false, saved: false });

  const authorName = pub.authorName || pub.userName || pub.user?.full_name || '\u2014';
  const createdAt = pub.createdAt ? new Date(pub.createdAt).toLocaleString('es-CO') : '\u2014';
  const confidence = typeof pub.confidenceScore === 'number' ? pub.confidenceScore.toFixed(2) : '\u2014';
  const productBarcode = pub.productBarcode || pub.product?.barcode || 'Sin c\u00f3digo';
  const brandName = pub.brandName || pub.product?.brand?.name || 'Sin marca';

  useEffect(() => {
    let cancelled = false;
    setProductSearch((prev) => ({ ...prev, results: [], searching: productQuery.length >= 2 }));
    if (productQuery.length >= 2 && !productId) {
      searchProductsLight(productQuery).then(result => {
        if (!cancelled) setProductSearch((prev) => ({ ...prev, searching: false, results: result.data || [] }));
      });
    }
    return () => { cancelled = true; };
  }, [productQuery, productId]);

  useEffect(() => {
    let cancelled = false;
    setStoreSearch((prev) => ({ ...prev, results: [], searching: storeQuery.length >= 2 }));
    if (storeQuery.length >= 2 && !storeId) {
      searchStoresLight(storeQuery).then(result => {
        if (!cancelled) setStoreSearch((prev) => ({ ...prev, searching: false, results: result.data || [] }));
      });
    }
    return () => { cancelled = true; };
  }, [storeQuery, storeId]);

  const save = async () => {
    setSaveState({ saving: true, saved: false });
    const db = { is_active: form.isActive, description: form.description?.trim() || null };
    const parsedPrice = Number(form.price);
    if (!isNaN(parsedPrice) && parsedPrice > 0) db.price = parsedPrice;
    if (productId && productId !== (pub.productId || pub.product_id)) db.product_id = productId;
    if (storeId && storeId !== (pub.storeId || pub.store_id)) db.store_id = storeId;
    if (form.photoUrl.trim() !== (pub.photoUrl || pub.photo_url || '')) db.photo_url = form.photoUrl.trim() || null;
    const ui = {};
    if (db.product_id) { ui.productId = productId; ui.productName = productQuery; }
    if (db.store_id) { ui.storeId = storeId; ui.storeName = storeQuery; }
    if (db.photo_url !== undefined) ui.photoUrl = form.photoUrl;
    const ok = await onSave({ db, ui });
    setSaveState({ saving: false, saved: ok !== false });
  };

  return (
    <div role="presentation" className="admin-modal-overlay" style={s.modalOverlay} onClick={onClose} onKeyDown={(e) => { if (e.key === 'Escape') onClose(); }}>
      <div ref={modalRef} role="dialog" aria-modal="true" aria-labelledby="pub-detail-title" style={{ ...s.modalCard, maxHeight: '90vh', overflowY: 'auto' }} onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
          <div>
            <h2 id="pub-detail-title" style={{ margin: 0, fontSize: 'var(--admin-fs-xl)', color: TEXT }}>{td.pubDetailTitle}</h2>
            <p style={{ ...s.headerSub, margin: '4px 0 0' }}>ID: {pub.id}</p>
          </div>
          <button onClick={onClose} aria-label={td.publicationDetailModal.closeAria} title={td.publicationDetailModal.closeAria} style={CLOSE_BTN_STYLE}>✕</button>
        </div>

        <div style={{ ...s.section, marginBottom: 16, marginTop: 0 }}>
          <div style={{ ...s.sectionHead, marginBottom: 10 }}>
            <span style={s.sectionTitle}>{td.pubDetailTitle}</span>
            <StatusBadge status={pub.is_active ? 'active' : 'hidden'} />
          </div>
          <div style={s.detailGrid}>
            <DetailRow label={td.pubProductLabel} value={productQuery || '\u2014'} />
            <DetailRow label={td.pubBarcodeLabel} value={productBarcode} />
            <DetailRow label={td.pubBrandLabel} value={brandName} />
            <DetailRow label={td.pubStoreLabel} value={storeQuery || '\u2014'} />
            <DetailRow label={td.pubPriceLabel} value={`$${typeof pub.price === 'number' ? pub.price.toLocaleString('es-CO') : pub.price || '\u2014'}`} />
            <DetailRow label={td.pubAuthorLabel} value={authorName} />
            <DetailRow label={td.pubDateLabel} value={createdAt} />
            <DetailRow label={td.pubConfidenceLabel} value={confidence} />
            <DetailRow label={td.pubDescriptionLabel} value={pub.description || '\u2014'} />
          </div>
        </div>

        {pub.photoUrl && (
          <div style={{ marginBottom: 16 }}>
            <img
              src={sanitizeHTML(pub.photoUrl)}
              alt={td.pubPhotoAlt}
              style={{ width: '100%', maxHeight: 220, objectFit: 'cover', borderRadius: 8, border: `1px solid ${BORDER}` }}
              onError={(e) => { e.currentTarget.style.display = 'none'; }}
            />
          </div>
        )}

        <hr style={{ border: 'none', borderTop: `1px solid ${BORDER}`, margin: '0 0 16px' }} />

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <label style={s.filterLabelWrap}>
            <span style={s.filterLabel}>{td.pubVisibilityLabel}</span>
            <select
              value={form.isActive ? 'visible' : 'hidden'}
              onChange={(e) => setForm(prev => ({ ...prev, isActive: e.target.value === 'visible' }))}
              style={s.filterSelect}
            >
              <option value="visible">{td.pubIsActiveLabel}</option>
              <option value="hidden">{td.pubIsHiddenLabel}</option>
            </select>
          </label>

          <label style={s.filterLabelWrap}>
            <span style={s.filterLabel}>{td.pubPriceLabel}</span>
            <input
              type="number"
              value={form.price}
              onChange={(e) => setForm(prev => ({ ...prev, price: e.target.value }))}
              style={{ ...s.filterSelect, fontFamily: 'inherit' }}
              min={0}
              placeholder={td.pricePlaceholder}
            />
          </label>

          <div style={s.filterLabelWrap}>
            <span style={s.filterLabel}>{td.publicationDetailModal.productLabel}</span>
            <div style={{ position: 'relative' }}>
              <input
                value={productQuery}
                onChange={(e) => { setProductSearch(prev => ({ ...prev, query: e.target.value, id: null })); }}
                style={{ ...s.filterSelect, fontFamily: 'inherit' }}
                placeholder={td.publicationDetailModal.productPlaceholder}
              />
              {productSearch.searching && <span style={SPINNER_STYLE}>…</span>}
              {productSearch.results.length > 0 && (
                <div style={SEARCH_DROPDOWN_STYLE}>
                  {productSearch.results.map(pr => (
                    <button key={pr.id} style={SEARCH_RESULT_BTN_STYLE}
                      onClick={() => { setProductSearch((prev) => ({ ...prev, id: pr.id, query: pr.name, results: [], searching: false })); }}>
                      <strong>{sanitizeHTML(pr.name)}</strong>
                      {pr.brand?.name && <span style={{ color: MUTED, marginLeft: 6, fontSize: 'var(--admin-fs-sm)' }}>{sanitizeHTML(pr.brand.name)}</span>}
                      {pr.barcode && <span style={{ color: MUTED, marginLeft: 6, fontSize: 'var(--admin-fs-sm)' }}>{sanitizeHTML(pr.barcode)}</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {productId && <span style={{ fontSize: 'var(--admin-fs-sm)', color: 'var(--success)', marginTop: 4 }}>{td.publicationDetailModal.idSelected(productId)}</span>}
          </div>

          <div style={s.filterLabelWrap}>
            <span style={s.filterLabel}>{td.publicationDetailModal.storeLabel}</span>
            <div style={{ position: 'relative' }}>
              <input
                value={storeQuery}
                onChange={(e) => { setStoreSearch((prev) => ({ ...prev, query: e.target.value, id: null })); }}
                style={{ ...s.filterSelect, fontFamily: 'inherit' }}
                placeholder={td.publicationDetailModal.storePlaceholder}
              />
              {storeSearch.searching && <span style={SPINNER_STYLE}>…</span>}
              {storeSearch.results.length > 0 && (
                <div style={SEARCH_DROPDOWN_STYLE}>
                  {storeSearch.results.map(sr => (
                    <button key={sr.id} style={SEARCH_RESULT_BTN_STYLE}
                      onClick={() => { setStoreSearch((prev) => ({ ...prev, id: sr.id, query: sr.name, results: [], searching: false })); }}>
                      <strong>{sanitizeHTML(sr.name)}</strong>
                      {sr.address && <span style={{ color: MUTED, marginLeft: 6, fontSize: 'var(--admin-fs-sm)' }}>{sanitizeHTML(sr.address)}</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {storeId && <span style={{ fontSize: 'var(--admin-fs-sm)', color: 'var(--success)', marginTop: 4 }}>{td.publicationDetailModal.idSelected(storeId)}</span>}
          </div>

          <label style={s.filterLabelWrap}>
            <span style={s.filterLabel}>{td.publicationDetailModal.photoUrlLabel}</span>
            <input
              value={form.photoUrl}
              onChange={(e) => setForm(prev => ({ ...prev, photoUrl: e.target.value }))}
              style={{ ...s.filterSelect, fontFamily: 'inherit' }}
              placeholder={td.publicationDetailModal.photoUrlPlaceholder}
            />
          </label>

          <label style={s.filterLabelWrap}>
            <span style={s.filterLabel}>{td.pubDescriptionLabel}</span>
            <textarea
              value={form.description}
              onChange={(e) => setForm(prev => ({ ...prev, description: e.target.value }))}
              rows={4}
              style={{ ...s.filterSelect, fontFamily: 'inherit', resize: 'vertical' }}
              placeholder={td.descriptionPlaceholder}
            />
          </label>
        </div>

        {saveState.saved && (
          <p style={{ margin: '10px 0 0', fontSize: 'var(--admin-fs-base)', color: 'var(--success)', textAlign: 'right' }}>
            ✓ {td.pubSavedOk}
          </p>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, gap: 10 }}>
          <button onClick={onDelete} style={s.btnDelete}>{td.deletePublicationBtn}</button>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={onClose} style={s.btnDismiss}>{td.cancel}</button>
            <button onClick={save} style={{ ...s.filterBtn, ...s.filterBtnActive }} disabled={saveState.saving}>
              {saveState.saving ? '…' : td.savePubBtn}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default PublicationDetailModal;
