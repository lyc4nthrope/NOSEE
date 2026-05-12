import { s } from '../adminStyles';
import { isPublicationVisible, isPublicationHidden } from '../adminConstants';
import { SectionHeader, LoadingState, EmptyMsg } from './AdminPrimitives';
import { PublicationsTable } from '../tables/PublicationsTable';
import { UnpublishedResourcesTable } from '../tables/UnpublishedResourcesTable';
import { PublicationDetailModal } from '../modals/PublicationDetailModal';
import { StoreDetailModal } from '../modals/StoreDetailModal';
import { BrandDetailModal } from '../modals/BrandDetailModal';
import { ProductDetailModal } from '../modals/ProductDetailModal';
import { useAdminStore, selectSelectedPublication, selectSelectedStore, selectSelectedBrand, selectSelectedProduct } from '../store/adminStore';

export default function AdminContentSection({
  publications, pubsLoading, pubsLoaded,
  pubFilter, setPubFilter,
  unpublishedLoading, unpublishedResources,
  deletingPub, deletingStoreId, deletingBrandId, deletingProductId,
  handleDeletePublication, handleEditPublication,
  handleViewStore, handleDeleteStore, handleEditStore,
  handleViewBrand, handleDeleteBrand, handleEditBrand,
  handleViewProduct, handleDeleteProduct, handleEditProduct,
  td,
}) {
  const selectedPub = useAdminStore(selectSelectedPublication);
  const selectedStore = useAdminStore(selectSelectedStore);
  const selectedBrand = useAdminStore(selectSelectedBrand);
  const selectedProduct = useAdminStore(selectSelectedProduct);

  return (
    <>
      <SectionHeader title={td.contentTitle} sub={td.contentSub} />

      {!pubsLoading && pubsLoaded && (
        <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
          <div style={{ ...s.statCard, flex: '1 1 140px', padding: '14px 18px' }}>
            <div style={s.statValue}>{publications.length}</div>
            <div style={s.statLabel}>{td.filterAll}</div>
          </div>
          <div style={{ ...s.statCard, flex: '1 1 140px', padding: '14px 18px' }}>
            <div style={{ ...s.statValue, color: 'var(--success)' }}>
              {publications.filter(isPublicationVisible).length}
            </div>
            <div style={s.statLabel}>{td.filterVisible}</div>
          </div>
          <div style={{ ...s.statCard, flex: '1 1 140px', padding: '14px 18px' }}>
            <div style={{ ...s.statValue, color: 'var(--error)' }}>
              {publications.filter(isPublicationHidden).length}
            </div>
            <div style={s.statLabel}>{td.filterHidden}</div>
          </div>
        </div>
      )}

      <div style={s.filterRow}>
        {[
          { key: 'all',     label: td.filterAll },
          { key: 'visible', label: td.filterVisible },
          { key: 'hidden',  label: td.filterHidden },
          { key: 'unpublished', label: td.filterUnpublished },
        ].map(f => (
          <button
            key={f.key}
            style={{ ...s.filterBtn, ...(pubFilter === f.key ? s.filterBtnActive : {}) }}
            onClick={() => setPubFilter(f.key)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {pubFilter === 'unpublished' ? (
        unpublishedLoading ? (
          <LoadingState label={td.loadingUnpublished} />
        ) : (
          <UnpublishedResourcesTable
            stores={unpublishedResources.stores}
            products={unpublishedResources.products}
            onViewStore={handleViewStore}
            onDeleteStore={handleDeleteStore}
            onViewProduct={handleViewProduct}
            onDeleteProduct={handleDeleteProduct}
            deletingStoreId={deletingStoreId}
            deletingProductId={deletingProductId}
          />
        )
      ) : pubsLoading ? (
        <LoadingState label={td.loadingPubs} />
      ) : (
        <PublicationsTable
          publications={publications.filter(p => {
            if (pubFilter === 'visible') return isPublicationVisible(p);
            if (pubFilter === 'hidden')  return isPublicationHidden(p);
            return true;
          })}
          onDelete={handleDeletePublication}
          onView={(p) => useAdminStore.getState().selectPublication(p)}
          onViewStore={handleViewStore}
          onDeleteStore={handleDeleteStore}
          onViewBrand={handleViewBrand}
          onDeleteBrand={handleDeleteBrand}
          deletingId={deletingPub}
          deletingStoreId={deletingStoreId}
          deletingBrandId={deletingBrandId}
        />
      )}

      {selectedPub && (
        <PublicationDetailModal
          pub={selectedPub}
          onClose={() => useAdminStore.getState().selectPublication(null)}
          onSave={async (updates) => {
            const ok = await handleEditPublication(selectedPub.id, updates.db, updates.ui);
            if (ok) {
              const st = useAdminStore.getState();
              if (st.selectedPub) st.selectPublication({ ...st.selectedPub, ...updates.db, ...(updates.ui || {}) });
            }
          }}
          onDelete={() => {
            handleDeletePublication(selectedPub);
            useAdminStore.getState().selectPublication(null);
          }}
        />
      )}

      {selectedStore && (
        <StoreDetailModal
          store={selectedStore}
          onClose={() => useAdminStore.getState().selectStore(null)}
          onSave={handleEditStore}
          onDelete={() => { handleDeleteStore(selectedStore); }}
          isDeleting={deletingStoreId === selectedStore.id}
        />
      )}

      {selectedBrand && (
        <BrandDetailModal
          brand={selectedBrand}
          onClose={() => useAdminStore.getState().selectBrand(null)}
          onSave={handleEditBrand}
          onDelete={() => { handleDeleteBrand(selectedBrand); }}
          isDeleting={deletingBrandId === selectedBrand.id}
        />
      )}

      {selectedProduct && (
        <ProductDetailModal
          product={selectedProduct}
          onClose={() => useAdminStore.getState().selectProduct(null)}
          onSave={handleEditProduct}
          onDelete={() => handleDeleteProduct(selectedProduct)}
          isDeleting={deletingProductId === selectedProduct.id}
        />
      )}
    </>
  );
}
