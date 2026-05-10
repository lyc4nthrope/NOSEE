/**
 * CatalogPanel.jsx
 *
 * Panel de administración del catálogo: tiendas, productos, marcas.
 * Reutiliza los modales existentes (StoreDetailModal, BrandDetailModal, ProductDetailModal).
 *
 * UBICACIÓN: src/features/dashboard/admin/components/CatalogPanel.jsx
 */
import { useState, useEffect } from 'react';
import { getCatalogStores, getCatalogProducts, getCatalogBrands } from '@/services/api/adminCatalog.api';
import { useLanguage } from '@/contexts/LanguageContext';
import { s, ACCENT, MUTED, TEXT, BORDER } from '../adminStyles';

function StoreRow({ store, onView, onHide, isDeleting, td }) {
  return (
    <div style={{ ...s.tableRow, gridTemplateColumns: '2fr 1fr 0.5fr 1fr', padding: '10px 16px', fontSize: 13 }}>
      <div style={s.td}>
        <div>
          <div style={{ fontWeight: 600 }}>{store.name}</div>
          {store.address && <div style={{ fontSize: 11, color: MUTED }}>{store.address}</div>}
        </div>
      </div>
      <div style={{ ...s.td, fontSize: 11 }}>
        <span style={{
          padding: '2px 8px', borderRadius: 999, fontWeight: 600,
          background: store.is_active ? 'var(--success-soft)' : 'var(--error-soft)',
          color: store.is_active ? 'var(--success)' : 'var(--error)',
        }}>
          {store.is_active ? td.catalogPanel.statusActivePhysical : td.catalogPanel.statusInactivePhysical}
        </span>
      </div>
      <div style={{ ...s.td, fontSize: 11, color: MUTED }}>{store.typeLabel || td.catalogPanel.storeTypeNA}</div>
      <div style={{ ...s.td, gap: 6, justifyContent: 'flex-end' }}>
        <button onClick={() => onView(store)} style={{ ...s.actionBtn, fontSize: 11 }}>{td.catalogPanel.viewBtn}</button>
        {!store.is_admin_hidden && (
          <button
            onClick={() => onHide(store)}
            disabled={isDeleting}
            style={{ ...s.actionBtn, ...s.actionBtnDanger, fontSize: 11, opacity: isDeleting ? 0.5 : 1 }}
          >
            {td.catalogPanel.hideBtn}
          </button>
        )}
      </div>
    </div>
  );
}

function ProductRow({ product, onView, onHide, isDeleting, td }) {
  return (
    <div style={{ ...s.tableRow, gridTemplateColumns: '2fr 1fr 0.5fr 1fr', padding: '10px 16px', fontSize: 13 }}>
      <div style={s.td}>
        <div>
          <div style={{ fontWeight: 600 }}>{product.name}</div>
          {product.brand?.name && <div style={{ fontSize: 11, color: MUTED }}>{product.brand.name}</div>}
        </div>
      </div>
      <div style={{ ...s.td, fontSize: 11 }}>
        <span style={{
          padding: '2px 8px', borderRadius: 999, fontWeight: 600,
          background: product.is_active ? 'var(--success-soft)' : 'var(--error-soft)',
          color: product.is_active ? 'var(--success)' : 'var(--error)',
        }}>
          {product.is_active ? td.catalogPanel.statusActiveProduct : td.catalogPanel.statusInactiveProduct}
        </span>
      </div>
      <div style={{ ...s.td, fontSize: 11, color: MUTED }}>{product.barcode || '—'}</div>
      <div style={{ ...s.td, gap: 6, justifyContent: 'flex-end' }}>
        <button onClick={() => onView(product)} style={{ ...s.actionBtn, fontSize: 11 }}>{td.catalogPanel.viewBtn}</button>
        {!product.is_admin_hidden && (
          <button
            onClick={() => onHide(product)}
            disabled={isDeleting}
            style={{ ...s.actionBtn, ...s.actionBtnDanger, fontSize: 11, opacity: isDeleting ? 0.5 : 1 }}
          >
            {td.catalogPanel.hideBtn}
          </button>
        )}
      </div>
    </div>
  );
}

function BrandRow({ brand, onView, onHide, isDeleting, td }) {
  return (
    <div style={{ ...s.tableRow, gridTemplateColumns: '2fr 1fr 1fr', padding: '10px 16px', fontSize: 13 }}>
      <div style={{ ...s.td, fontWeight: 600 }}>{brand.name}</div>
      <div style={{ ...s.td, fontSize: 11 }}>
        <span style={{
          padding: '2px 8px', borderRadius: 999, fontWeight: 600,
          background: brand.is_active ? 'var(--success-soft)' : 'var(--error-soft)',
          color: brand.is_active ? 'var(--success)' : 'var(--error)',
        }}>
          {brand.is_active ? td.catalogPanel.statusActiveBrand : td.catalogPanel.statusInactiveBrand}
        </span>
      </div>
      <div style={{ ...s.td, gap: 6, justifyContent: 'flex-end' }}>
        <button onClick={() => onView(brand)} style={{ ...s.actionBtn, fontSize: 11 }}>{td.catalogPanel.viewBtn}</button>
        {!brand.is_admin_hidden && (
          <button
            onClick={() => onHide(brand)}
            disabled={isDeleting}
            style={{ ...s.actionBtn, ...s.actionBtnDanger, fontSize: 11, opacity: isDeleting ? 0.5 : 1 }}
          >
            {td.catalogPanel.hideBtn}
          </button>
        )}
      </div>
    </div>
  );
}

export default function CatalogPanel({ onViewStore, onViewBrand, onViewProduct, onHideStore, onHideBrand, onHideProduct, deletingStoreId, deletingBrandId, deletingProductId }) {
  const { t } = useLanguage();
  const td = t.adminDashboard;

  const TABS = [
    { key: 'stores',   label: td.catalogPanel.tabStores },
    { key: 'products', label: td.catalogPanel.tabProducts },
    { key: 'brands',   label: td.catalogPanel.tabBrands },
  ];

  const [activeTab, setActiveTab] = useState('stores');
  const [stores, setStores] = useState([]);
  const [products, setProducts] = useState([]);
  const [brands, setBrands] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    let isMounted = true;

    async function load() {
      setIsLoading(true);
      setError(null);

      const [storesRes, productsRes, brandsRes] = await Promise.all([
        getCatalogStores(),
        getCatalogProducts(),
        getCatalogBrands(),
      ]);

      if (!isMounted) return;

      const firstError = [storesRes, productsRes, brandsRes].find(r => !r.success);
      if (firstError) {
        setError(firstError.error);
      } else {
        setStores((storesRes.data || []).map(s => ({
          ...s,
          typeLabel: Number(s.store_type_id) === 1 ? td.catalogPanel.storeTypePhysical : Number(s.store_type_id) === 2 ? td.catalogPanel.storeTypeVirtual : td.catalogPanel.storeTypeNA,
        })));
        setProducts(productsRes.data || []);
        setBrands(brandsRes.data || []);
      }
      setIsLoading(false);
    }

    load();
    return () => { isMounted = false; };
  }, []);

  // Filtro de búsqueda
  const searchLower = search.toLowerCase().trim();
  const filterList = (list, fields) => {
    if (!searchLower) return list;
    return list.filter(item =>
      fields.some(f => String(item[f] || '').toLowerCase().includes(searchLower))
    );
  };

  const filteredStores = filterList(stores, ['name', 'address']);
  const filteredProducts = filterList(products, ['name', 'barcode']);
  const filteredBrands = filterList(brands, ['name']);

  if (isLoading) {
    return <div style={{ textAlign: 'center', padding: 32, color: MUTED }}>{td.catalogPanel.loading}</div>;
  }

  if (error) {
    return <div style={{ textAlign: 'center', padding: 32, color: 'var(--error)' }}>{error}</div>;
  }

  return (
    <>
      {/* Tabs */}
      <div style={s.filterRow}>
        {TABS.map(tab => (
          <button
            key={tab.key}
            style={{ ...s.filterBtn, ...(activeTab === tab.key ? s.filterBtnActive : {}) }}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
        <div style={{ marginLeft: 'auto' }}>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={td.catalogPanel.searchPlaceholder}
            style={{ ...s.filterSelect, width: 200, fontFamily: 'inherit' }}
          />
        </div>
      </div>

      {/* Stores Tab */}
      {activeTab === 'stores' && (
        <div>
          <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
            <div style={{ ...s.statCard, flex: '1 1 120px', padding: '12px 16px' }}>
              <div style={s.statValue}>{stores.length}</div>
              <div style={s.statLabel}>{td.catalogPanel.totalStores}</div>
            </div>
            <div style={{ ...s.statCard, flex: '1 1 120px', padding: '12px 16px' }}>
              <div style={{ ...s.statValue, color: 'var(--success)' }}>{stores.filter(s => s.is_active).length}</div>
              <div style={s.statLabel}>{td.catalogPanel.activeStores}</div>
            </div>
          </div>

          {filteredStores.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 24, color: MUTED }}>
              {search ? td.catalogPanel.noResults : td.catalogPanel.emptyStores}
            </div>
          ) : (
            <div style={{ ...s.configCard, overflowX: 'auto', padding: 0 }}>
              <div style={{ minWidth: 580 }}>
                <div style={{ ...s.tableHead, gridTemplateColumns: '2fr 1fr 0.5fr 1fr', padding: '10px 16px' }}>
                  <div style={s.th}>{td.catalogPanel.colStore}</div>
                  <div style={s.th}>{td.catalogPanel.colStatus}</div>
                  <div style={s.th}>{td.catalogPanel.colType}</div>
                  <div style={s.th}></div>
                </div>
                {filteredStores.map(store => (
                  <StoreRow
                    key={store.id}
                    store={store}
                    onView={onViewStore}
                    onHide={onHideStore}
                    isDeleting={deletingStoreId === store.id}
                    td={td}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Products Tab */}
      {activeTab === 'products' && (
        <div>
          <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
            <div style={{ ...s.statCard, flex: '1 1 120px', padding: '12px 16px' }}>
              <div style={s.statValue}>{products.length}</div>
              <div style={s.statLabel}>{td.catalogPanel.totalProducts}</div>
            </div>
            <div style={{ ...s.statCard, flex: '1 1 120px', padding: '12px 16px' }}>
              <div style={{ ...s.statValue, color: 'var(--success)' }}>{products.filter(p => p.is_active).length}</div>
              <div style={s.statLabel}>{td.catalogPanel.activeProducts}</div>
            </div>
            <div style={{ ...s.statCard, flex: '1 1 120px', padding: '12px 16px' }}>
              <div style={s.statValue}>{products.filter(p => p.barcode).length}</div>
              <div style={s.statLabel}>{td.catalogPanel.withBarcode}</div>
            </div>
          </div>

          {filteredProducts.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 24, color: MUTED }}>
              {search ? td.catalogPanel.noResults : td.catalogPanel.emptyProducts}
            </div>
          ) : (
            <div style={{ ...s.configCard, overflowX: 'auto', padding: 0 }}>
              <div style={{ minWidth: 580 }}>
                <div style={{ ...s.tableHead, gridTemplateColumns: '2fr 1fr 0.5fr 1fr', padding: '10px 16px' }}>
                  <div style={s.th}>Producto</div>
                  <div style={s.th}>{td.catalogPanel.colStatus}</div>
                  <div style={s.th}>Barcode</div>
                  <div style={s.th}></div>
                </div>
                {filteredProducts.map(product => (
                  <ProductRow
                    key={product.id}
                    product={product}
                    onView={onViewProduct}
                    onHide={onHideProduct}
                    isDeleting={deletingProductId === product.id}
                    td={td}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Brands Tab */}
      {activeTab === 'brands' && (
        <div>
          <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
            <div style={{ ...s.statCard, flex: '1 1 120px', padding: '12px 16px' }}>
              <div style={s.statValue}>{brands.length}</div>
              <div style={s.statLabel}>{td.catalogPanel.totalBrands}</div>
            </div>
            <div style={{ ...s.statCard, flex: '1 1 120px', padding: '12px 16px' }}>
              <div style={{ ...s.statValue, color: 'var(--success)' }}>{brands.filter(b => b.is_active).length}</div>
              <div style={s.statLabel}>{td.catalogPanel.activeBrands}</div>
            </div>
          </div>

          {filteredBrands.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 24, color: MUTED }}>
              {search ? td.catalogPanel.noResults : td.catalogPanel.emptyBrands}
            </div>
          ) : (
            <div style={{ ...s.configCard, overflowX: 'auto', padding: 0 }}>
              <div style={{ minWidth: 480 }}>
                <div style={{ ...s.tableHead, gridTemplateColumns: '2fr 1fr 1fr', padding: '10px 16px' }}>
                  <div style={s.th}>Marca</div>
                  <div style={s.th}>{td.catalogPanel.colStatus}</div>
                  <div style={s.th}></div>
                </div>
                {filteredBrands.map(brand => (
                  <BrandRow
                    key={brand.id}
                    brand={brand}
                    onView={onViewBrand}
                    onHide={onHideBrand}
                    isDeleting={deletingBrandId === brand.id}
                    td={td}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}
