import { useState, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { getBrands, getProductCategories, getUnitTypes } from '@/services/api/products.api';
import { s, CLOSE_BTN_STYLE, TEXT, BORDER, MUTED } from '../adminStyles';
import { DetailRow } from '../components/AdminPrimitives';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { sanitizeHTML } from '@/services/utils/sanitize';

const SPINNER_STYLE = {
  textAlign: 'center', padding: '20px 0', color: MUTED, fontSize: 'var(--admin-fs-base)',
};

export function ProductDetailModal({ product, onClose, onDelete, isDeleting, onSave }) {
  const { t } = useLanguage();
  const td = t.adminDashboard;
  const modalRef = useFocusTrap(true);
  const [form, setForm] = useState({
    name: product?.name || '',
    barcode: product?.barcode || '',
    baseQuantity: product?.base_quantity ?? '',
    brandId: product?.brand?.id ?? '',
    unitTypeId: product?.unit?.id ?? '',
    categoryId: product?.category_id ?? '',
  });

  const [meta, setMeta] = useState({ categories: [], unitTypes: [], brands: [], loading: true });
  const [saveState, setSaveState] = useState({ saving: false, saved: false });
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    Promise.all([
      getProductCategories(),
      getUnitTypes(),
      getBrands(),
    ]).then(([cats, units, brnds]) => {
      setMeta({ categories: cats.data || [], unitTypes: units.data || [], brands: brnds.data || [], loading: false });
    });
  }, []);

  const save = async () => {
    if (!form.name.trim()) { setErrorMsg(td.productDetailModal.nameRequired); return; }
    setErrorMsg('');
    setSaveState({ saving: true, saved: false });
    const updates = { name: form.name.trim(), barcode: form.barcode.trim() || null };
    if (form.baseQuantity !== '') updates.base_quantity = Number(form.baseQuantity);
    if (form.brandId !== '') updates.brand_id = Number(form.brandId);
    if (form.unitTypeId !== '') updates.unit_type_id = Number(form.unitTypeId);
    if (form.categoryId !== '') updates.category_id = Number(form.categoryId);
    const ok = await onSave(product.id, updates);
    setSaveState({ saving: false, saved: ok !== false });
  };

  const quantity = product?.base_quantity != null && product?.unit?.abbreviation
    ? `${product.base_quantity} ${product.unit.abbreviation}`
    : product?.base_quantity != null && product?.unit?.name
      ? `${product.base_quantity} ${product.unit.name}`
      : product?.base_quantity ?? '\u2014';

  return (
    <div role="presentation" className="admin-modal-overlay" style={s.modalOverlay} onClick={onClose} onKeyDown={(e) => { if (e.key === 'Escape') onClose(); }}>
      <div ref={modalRef} role="dialog" aria-modal="true" aria-labelledby="product-detail-title" style={{ ...s.modalCard, maxWidth: 560, maxHeight: '90vh', overflowY: 'auto' }} onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
          <div>
            <h2 id="product-detail-title" style={{ margin: 0, fontSize: 'var(--admin-fs-xl)', color: TEXT }}>{td.productDetailTitle}</h2>
            <p style={{ ...s.headerSub, margin: '4px 0 0' }}>ID: {product.id}</p>
          </div>
          <button onClick={onClose} aria-label={td.productDetailModal.closeAria} title={td.productDetailModal.closeAria} style={CLOSE_BTN_STYLE}>✕</button>
        </div>

        <div style={s.detailGrid}>
          <DetailRow label={td.colProduct} value={sanitizeHTML(product?.name) || '\u2014'} />
          <DetailRow label={td.colBrand} value={sanitizeHTML(product?.brand?.name) || td.noBrand} />
          <DetailRow label={td.colBarcode} value={product?.barcode || td.noCode} />
          <DetailRow label={td.labelBaseQuantity} value={quantity} />
          <DetailRow label={td.labelCreatedAtProduct} value={product?.created_at || '\u2014'} />
        </div>

        <hr style={{ border: 'none', borderTop: `1px solid ${BORDER}`, margin: '12px 0' }} />

        {meta.loading ? (
          <div style={SPINNER_STYLE}>{td.productDetailModal.loadingOptions}</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <label style={s.filterLabelWrap}>
              <span style={s.filterLabel}>{td.productDetailModal.nameLabel}</span>
              <input value={form.name} onChange={(e) => setForm(prev => ({ ...prev, name: e.target.value }))} style={{ ...s.filterSelect, fontFamily: 'inherit' }} placeholder={td.productDetailModal.namePlaceholder} />
            </label>

            <label style={s.filterLabelWrap}>
              <span style={s.filterLabel}>{td.productDetailModal.barcodeLabel}</span>
              <input value={form.barcode} onChange={(e) => setForm(prev => ({ ...prev, barcode: e.target.value }))} style={{ ...s.filterSelect, fontFamily: 'inherit' }} placeholder={td.productDetailModal.barcodePlaceholder} />
            </label>

            <label style={s.filterLabelWrap}>
              <span style={s.filterLabel}>{td.productDetailModal.brandLabel}</span>
              <select value={form.brandId} onChange={(e) => setForm(prev => ({ ...prev, brandId: e.target.value }))} style={s.filterSelect}>
                <option value="">{td.productDetailModal.noBrandOption}</option>
                {meta.brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </label>

            <label style={s.filterLabelWrap}>
              <span style={s.filterLabel}>{td.productDetailModal.categoryLabel}</span>
              <select value={form.categoryId} onChange={(e) => setForm(prev => ({ ...prev, categoryId: e.target.value }))} style={s.filterSelect}>
                <option value="">{td.productDetailModal.noCategoryOption}</option>
                {meta.categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>

            <div style={{ display: 'flex', gap: 10 }}>
              <label style={{ ...s.filterLabelWrap, flex: 1 }}>
                <span style={s.filterLabel}>{td.productDetailModal.baseQuantityLabel}</span>
                <input type="number" value={form.baseQuantity} onChange={(e) => setForm(prev => ({ ...prev, baseQuantity: e.target.value }))} style={{ ...s.filterSelect, fontFamily: 'inherit' }} min={0} placeholder={td.productDetailModal.baseQuantityPlaceholder} />
              </label>
              <label style={{ ...s.filterLabelWrap, flex: 1 }}>
                <span style={s.filterLabel}>{td.productDetailModal.unitLabel}</span>
                <select value={form.unitTypeId} onChange={(e) => setForm(prev => ({ ...prev, unitTypeId: e.target.value }))} style={s.filterSelect}>
                  <option value="">{td.productDetailModal.noUnitOption}</option>
                  {meta.unitTypes.map(u => <option key={u.id} value={u.id}>{u.name} ({u.abbreviation})</option>)}
                </select>
              </label>
            </div>
          </div>
        )}

        {errorMsg && <p style={{ margin: '10px 0 0', fontSize: 'var(--admin-fs-base)', color: 'var(--error)', textAlign: 'right' }}>{errorMsg}</p>}
        {saveState.saved && <p style={{ margin: '10px 0 0', fontSize: 'var(--admin-fs-base)', color: 'var(--success)', textAlign: 'right' }}>{td.productDetailModal.savedOk}</p>}

        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 16, gap: 10 }}>
          <button onClick={onDelete} style={s.btnDelete} disabled={isDeleting}>
            {isDeleting ? td.hidingBtn : td.hideProductBtn}
          </button>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={onClose} style={s.btnDismiss}>{td.productDetailModal.closeBtn}</button>
            <button onClick={save} style={{ ...s.filterBtn, ...s.filterBtnActive }} disabled={saveState.saving || meta.loading}>
              {saveState.saving ? '…' : td.productDetailModal.saveChangesBtn}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ProductDetailModal;
