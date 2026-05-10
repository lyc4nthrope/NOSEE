import { useLanguage } from '@/contexts/LanguageContext';
import { s, MUTED } from '../adminStyles';
import { EmptyMsg } from '../components/AdminPrimitives';

export function UnpublishedResourcesTable({
  stores,
  products,
  onViewStore,
  onDeleteStore,
  onViewProduct,
  onDeleteProduct,
  deletingStoreId,
  deletingProductId,
}) {
  const { t } = useLanguage();
  const td = t.adminDashboard;

  if ((!stores || stores.length === 0) && (!products || products.length === 0)) {
    return <EmptyMsg text={td.noUnpublishedResources} />;
  }

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div style={s.table} role="grid" aria-label="Tiendas no publicadas">
        <div style={{ ...s.tableHead, gridTemplateColumns: '2fr 1fr 1fr' }} role="row">
          {[td.colUnpublishedStores, td.labelType, td.colActions].map((h) => (
            <div key={h} style={s.th} role="columnheader">{h}</div>
          ))}
        </div>
        {(stores || []).length === 0 ? (
          <div style={{ padding: '14px 20px', color: MUTED, fontSize: 13 }}>{td.noUnpublishedStores}</div>
        ) : (
          (stores || []).map((store) => (
            <div key={store.id} style={{ ...s.tableRow, gridTemplateColumns: '2fr 1fr 1fr' }} role="row">
              <div style={s.td}>
                <div>
                  <div style={s.rowName}>{store.name || '—'}</div>
                  <div style={{ fontSize: 12, color: MUTED }}>{store.address || td.noAddress}</div>
                </div>
              </div>
              <div style={{ ...s.td, fontSize: 13, color: MUTED }}>{store.typeLabel || '—'}</div>
              <div style={{ ...s.td, gap: 6 }}>
                <button style={{ ...s.filterBtn, padding: '5px 10px', fontSize: 12 }} onClick={() => onViewStore(store)}>
                  {td.viewDetailBtn}
                </button>
                <button
                  style={s.btnDelete}
                  onClick={() => onDeleteStore(store)}
                  disabled={deletingStoreId === store.id}
                >
                  {deletingStoreId === store.id ? '...' : td.hideBtn}
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      <div style={s.table} role="grid" aria-label="Productos no publicados">
        <div style={{ ...s.tableHead, gridTemplateColumns: '2fr 1fr 1fr' }} role="row">
          {[td.colUnpublishedProducts, td.colBrand, td.colActions].map((h) => (
            <div key={h} style={s.th} role="columnheader">{h}</div>
          ))}
        </div>
        {(products || []).length === 0 ? (
          <div style={{ padding: '14px 20px', color: MUTED, fontSize: 13 }}>{td.noUnpublishedProducts}</div>
        ) : (
          (products || []).map((product) => (
            <div key={product.id} style={{ ...s.tableRow, gridTemplateColumns: '2fr 1fr 1fr' }} role="row">
              <div style={s.td}>
                <div>
                  <div style={s.rowName}>{product.name || '—'}</div>
                  <div style={{ fontSize: 12, color: MUTED }}>{td.colBarcode}: {product.barcode || td.noCode}</div>
                </div>
              </div>
              <div style={{ ...s.td, fontSize: 13, color: MUTED }}>{product.brand?.name || td.noBrand}</div>
              <div style={{ ...s.td, gap: 6 }}>
                <button style={{ ...s.filterBtn, padding: '5px 10px', fontSize: 12 }} onClick={() => onViewProduct(product)}>
                  {td.viewDetailBtn}
                </button>
                <button
                  style={s.btnDelete}
                  onClick={() => onDeleteProduct(product)}
                  disabled={deletingProductId === product.id}
                >
                  {deletingProductId === product.id ? '...' : td.hideBtn}
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default UnpublishedResourcesTable;
