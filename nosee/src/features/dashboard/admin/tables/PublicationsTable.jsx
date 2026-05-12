import { useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { s, MUTED } from '../adminStyles';
import { Icon } from '@/components/ui/Icon';
import { EmptyMsg, StatusBadge } from '../components/AdminPrimitives';

export function PublicationsTable({
  publications,
  onDelete,
  onView,
  onViewStore,
  onDeleteStore,
  onViewBrand,
  onDeleteBrand,
  deletingId,
  deletingStoreId,
  deletingBrandId,
}) {
  const { t } = useLanguage();
  const td = t.adminDashboard;
  const [hoveredRow, setHoveredRow] = useState(null);
  if (publications.length === 0) {
    return <EmptyMsg text={td.noPubsView} />;
  }
  return (
    <div style={s.table} className="admin-table admin-table-pubs" role="grid" aria-label="Lista de publicaciones">
      <div style={{ ...s.tableHead, gridTemplateColumns: '2fr 1fr 1fr 0.8fr 0.8fr 1.2fr' }} role="row">
        {[td.colProduct, td.colStore, td.colPrice, td.colAuthor, td.colDate, td.colAction].map(h => (
          <div key={h} style={s.th} role="columnheader">{h}</div>
        ))}
      </div>
      {publications.map(p => (
        <div key={p.id} style={{ ...s.tableRow, gridTemplateColumns: '2fr 1fr 1fr 0.8fr 0.8fr 1.2fr', ...(hoveredRow === p.id && s.tableRowHover) }} role="row"
          onMouseEnter={() => setHoveredRow(p.id)}
          onMouseLeave={() => setHoveredRow(null)}>
          <div style={s.td} role="gridcell">
            <div>
              <div style={s.rowName}>{p.productName || p.product?.name || '—'}</div>
              <div style={{ fontSize: 'var(--admin-fs-sm)', color: MUTED, marginTop: 2 }}>
                {td.colBrand}: {p.brandName || p.product?.brand?.name || td.noBrand}
              </div>
              <div style={{ fontSize: 'var(--admin-fs-sm)', color: MUTED, marginTop: 2 }}>
                {td.colBarcode}: {p.productBarcode || p.product?.barcode || td.noCode}
              </div>
              <StatusBadge status={p.is_active ? 'active' : 'hidden'} />
              <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                <button
                  style={{ ...s.filterBtn, padding: '4px 8px', fontSize: 'var(--admin-fs-xs)' }}
                  onClick={() => onViewBrand(p)}
                >
                  {td.viewDetailBtn}
                </button>
                <button
                  style={{ ...s.btnDelete, padding: '4px 8px', fontSize: 'var(--admin-fs-xs)' }}
                  onClick={() => onDeleteBrand(p)}
                  disabled={deletingBrandId === (p.brandId || p.product?.brand?.id)}
                >
                  {deletingBrandId === (p.brandId || p.product?.brand?.id) ? '...' : td.hideBtn}
                </button>
              </div>
            </div>
          </div>
          <div style={s.td} role="gridcell">
            <div>
              <div style={s.rowName}>{p.storeName || p.store?.name || '—'}</div>
              <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                <button
                  style={{ ...s.filterBtn, padding: '4px 8px', fontSize: 'var(--admin-fs-xs)' }}
                  onClick={() => onViewStore(p)}
                >
                  {td.viewDetailBtn}
                </button>
                <button
                  style={{ ...s.btnDelete, padding: '4px 8px', fontSize: 'var(--admin-fs-xs)' }}
                  onClick={() => onDeleteStore(p)}
                  disabled={deletingStoreId === (p.storeId || p.store?.id || p.store_id)}
                >
                  {deletingStoreId === (p.storeId || p.store?.id || p.store_id) ? '...' : td.hideBtn}
                </button>
              </div>
            </div>
          </div>
          <div style={{ ...s.td, ...s.tdNum }} role="gridcell">
            ${typeof p.price === 'number' ? p.price.toLocaleString('es-CO') : p.price || '—'}
          </div>
          <div style={{ ...s.td, fontSize: 'var(--admin-fs-base)', color: MUTED }} role="gridcell">{p.authorName || p.userName || p.user?.full_name || '—'}</div>
          <div style={{ ...s.td, fontSize: 'var(--admin-fs-sm)', color: MUTED }} role="gridcell">
            {p.createdAt ? new Date(p.createdAt).toLocaleDateString('es-CO') : '—'}
          </div>
          <div style={{ ...s.td, gap: 6 }} role="gridcell">
            <button
              style={{ ...s.filterBtn, padding: '5px 10px', fontSize: 'var(--admin-fs-sm)' }}
              onClick={() => onView(p)}
              title={td.viewPubBtn}
            >
              {td.viewPubBtn}
            </button>
            <button
              style={s.btnDelete}
              onClick={() => onDelete(p)}
              disabled={deletingId === p.id}
              title={td.colAction}
              aria-label={td.colAction}
            >
              {deletingId === p.id ? '...' : <Icon name="Trash2" size={16} />}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

export default PublicationsTable;
