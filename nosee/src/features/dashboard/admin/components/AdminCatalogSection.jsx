import { lazy, Suspense } from 'react';
import { SectionHeader } from './AdminPrimitives';
import { StoreDetailModal } from '../modals/StoreDetailModal';
import { BrandDetailModal } from '../modals/BrandDetailModal';
import { ProductDetailModal } from '../modals/ProductDetailModal';
import { useAdminStore, selectSelectedStore, selectSelectedBrand, selectSelectedProduct } from '../store/adminStore';

const CatalogPanel = lazy(() => import('./CatalogPanel'));

export default function AdminCatalogSection({
  deletingStoreId, deletingBrandId, deletingProductId,
  handleViewStore, handleDeleteStore, handleEditStore,
  handleViewBrand, handleDeleteBrand, handleEditBrand,
  handleViewProduct, handleDeleteProduct, handleEditProduct,
}) {
  const selectedStore = useAdminStore(selectSelectedStore);
  const selectedBrand = useAdminStore(selectSelectedBrand);
  const selectedProduct = useAdminStore(selectSelectedProduct);

  return (
    <>
      <SectionHeader title="Catálogo" sub="Gestión de tiendas, productos y marcas" />
      <Suspense fallback={<div style={{ padding: 40, textAlign: 'center' }}>Cargando…</div>}>
        <CatalogPanel
          onViewStore={handleViewStore}
          onViewBrand={handleViewBrand}
          onViewProduct={handleViewProduct}
          onHideStore={handleDeleteStore}
          onHideBrand={handleDeleteBrand}
          onHideProduct={handleDeleteProduct}
          deletingStoreId={deletingStoreId}
          deletingBrandId={deletingBrandId}
          deletingProductId={deletingProductId}
        />
      </Suspense>

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
