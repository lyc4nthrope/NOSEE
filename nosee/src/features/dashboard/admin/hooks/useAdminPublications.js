import { useState, useCallback } from 'react';
import {
  deactivatePublication, getAdminPublications, getBrandDetail, getCategories, getPublishedRefs, getAllStores, getAllProducts,
  getStoreDetail, hideBrand, hideProduct, hidePublication, hideStore,
  updateAdminBrand, updateAdminProduct, updateAdminStore,
  updatePublication as updateAdminPublication,
} from '@/services/api/adminCatalog.api';
import { insertActionLog } from '@/services/api/audit.api';
import { useAuthStore } from '@/features/auth/store/authStore';
import { useLanguage } from '@/contexts/LanguageContext';
import { normalizePublicationForAdmin } from '@/features/dashboard/admin/adminConstants';
import { checkRateLimit } from '@/services/utils/rateLimit';

/**
 * Hook de administración de publicaciones, tiendas, marcas y productos.
 * Expone estado y acciones CRUD para gestionar el catálogo desde el panel admin.
 *
 * @returns {{
 *   publications: Array,
 *   setPublications: Function,
 *   pubsLoading: boolean,
 *   pubsLoaded: boolean,
 *   pubFilter: string,
 *   setPubFilter: Function,
 *   deletingPub: string|null,
 *   selectedPub: Object|null,
 *   setSelectedPub: Function,
 *   deletingStoreId: string|null,
 *   setDeletingStoreId: Function,
 *   deletingBrandId: number|null,
 *   setDeletingBrandId: Function,
 *   deletingProductId: number|null,
 *   setDeletingProductId: Function,
 *   selectedStore: Object|null,
 *   setSelectedStore: Function,
 *   selectedBrand: Object|null,
 *   setSelectedBrand: Function,
 *   selectedProduct: Object|null,
 *   setSelectedProduct: Function,
 *   unpublishedLoading: boolean,
 *   unpublishedLoaded: boolean,
 *   unpublishedResources: {stores: Array, products: Array},
 *   loadPublications: Function,
 *   executeDeletePublication: Function,
 *   handleEditPublication: Function,
 *   handleViewStore: Function,
 *   handleExecuteDeleteStore: Function,
 *   handleEditStore: Function,
 *   handleViewBrand: Function,
 *   handleExecuteDeleteBrand: Function,
 *   handleEditBrand: Function,
 *   handleViewProduct: Function,
 *   handleExecuteDeleteProduct: Function,
 *   handleEditProduct: Function,
 *   loadUnpublishedResources: Function,
 * }}
 */
export default function useAdminPublications() {
  const { t } = useLanguage();
  const td = t.adminDashboard;
  const currentUserId = useAuthStore(s => s.user?.id);

  const [publications, setPublications] = useState([]);
  const [pubsLoading, setPubsLoading] = useState(false);
  const [pubsLoaded, setPubsLoaded] = useState(false);
  const [pubFilter, setPubFilter] = useState('all');
  const [deletingPub, setDeletingPub] = useState(null);
  const [selectedPub, setSelectedPub] = useState(null);
  const [deletingStoreId, setDeletingStoreId] = useState(null);
  const [deletingBrandId, setDeletingBrandId] = useState(null);
  const [deletingProductId, setDeletingProductId] = useState(null);
  const [selectedStore, setSelectedStore] = useState(null);
  const [selectedBrand, setSelectedBrand] = useState(null);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [unpublishedLoading, setUnpublishedLoading] = useState(false);
  const [unpublishedLoaded, setUnpublishedLoaded] = useState(false);
  const [unpublishedResources, setUnpublishedResources] = useState({ stores: [], products: [] });

  const loadPublications = useCallback(async () => {
    setPubsLoading(true);
    try {
      const result = await getAdminPublications();
      if (result.success) setPublications((result.data || []).map(normalizePublicationForAdmin));
    } catch (err) {
      console.error('[AdminDashboard] loadPublications:', err);
    } finally {
      setPubsLoading(false);
      setPubsLoaded(true);
    }
  }, []);

  const executeDeletePublication = useCallback(async (pubId, action) => {
    const { allowed, retryAfter } = checkRateLimit('admin:deletePublication');
    if (!allowed) {
      console.error(`[RateLimit] Espera ${retryAfter}s antes de otra acción`);
      return;
    }
    setDeletingPub(pubId);
    try {
      if (action === 'hide') {
        const result = await deactivatePublication(pubId);
        if (!result.success) {
          console.error('[useAdminPublications] deactivatePublication:', result.error);
          return;
        }
        setPublications((prev) =>
          prev.map((p) => (p.id === pubId ? { ...p, is_active: false, status: 'hidden' } : p)),
        );
        setSelectedPub((prev) => (prev?.id === pubId ? { ...prev, is_active: false, status: 'hidden' } : prev));
        insertActionLog(currentUserId, 'publication', pubId, 'hide');
        return;
      }

      const result = await hidePublication(pubId, currentUserId, 'Ocultada completamente desde panel admin');
      if (!result.success) {
        console.error('[useAdminPublications] hidePublication:', result.error);
        return;
      }

      setPublications((prev) => prev.filter((p) => p.id !== pubId));
      setSelectedPub((prev) => (prev?.id === pubId ? null : prev));
      insertActionLog(currentUserId, 'publication', pubId, 'hide_full');
    } catch (err) {
      console.error('[useAdminPublications] hidePublication:', err);
    } finally {
      setDeletingPub(null);
    }
  }, [publications, td, currentUserId]);

  const handleDeletePublication = useCallback((publicationInput) => {
    const publication = typeof publicationInput === 'object'
      ? publicationInput
      : publications.find((p) => p.id === publicationInput);
    const pubId = publication?.id || publicationInput;
    const isActive = publication?.is_active === true;
    if (!pubId) return;

    return { publication, pubId, isActive };
  }, [publications]);

  const handleEditPublication = useCallback(async (pubId, dbUpdates, uiUpdates = {}) => {
    try {
      const result = await updateAdminPublication(pubId, dbUpdates);
      if (!result.success) {
        console.error('[useAdminPublications] updatePublication:', result.error);
        return false;
      }
      setPublications(prev => prev.map(p => p.id === pubId ? { ...p, ...dbUpdates, ...uiUpdates } : p));
      return true;
    } catch (err) {
      console.error('[useAdminPublications] updatePublication:', err);
      return false;
    }
  }, [td]);

  const loadUnpublishedResources = useCallback(async () => {
    setUnpublishedLoading(true);
    try {
      const [refsResult, storesResult, productsResult] = await Promise.all([
        getPublishedRefs(1, 10000),
        getAllStores(1, 10000),
        getAllProducts(1, 10000),
      ]);

      if (!refsResult.success || !storesResult.success || !productsResult.success) {
        console.error('[useAdminPublications] loadUnpublishedResources:', refsResult.error || storesResult.error || productsResult.error);
        return;
      }

      const usedStoreIds = new Set((refsResult.data || []).map((r) => r.store_id).filter(Boolean));
      const usedProductIds = new Set((refsResult.data || []).map((r) => r.product_id).filter(Boolean));

      const orphanStores = (storesResult.data || [])
        .filter((store) => !usedStoreIds.has(store.id))
        .map((store) => ({
          ...store,
          typeLabel: Number(store.store_type_id) === 1
            ? td.storeTypePhysical
            : Number(store.store_type_id) === 2
              ? td.storeTypeVirtual
              : 'N/A',
        }));
      const orphanProducts = (productsResult.data || [])
        .filter((product) => !usedProductIds.has(product.id));

      setUnpublishedResources({ stores: orphanStores, products: orphanProducts });
    } finally {
      setUnpublishedLoading(false);
      setUnpublishedLoaded(true);
    }
  }, [td]);

  const handleViewStore = useCallback(async (publication) => {
    const storeId = publication?.storeId || publication?.store?.id || publication?.store_id;
    if (!storeId) return;

    const result = await getStoreDetail(storeId);
    if (!result.success || !result.data) {
      console.error('[useAdminPublications] getStoreDetail:', result.error || 'Store not found');
      return;
    }

    const relatedCount = publications.filter((p) => (p.storeId || p.store?.id || p.store_id) === storeId).length;
    setSelectedStore({
      ...result.data,
      typeLabel: Number(result.data.store_type_id) === 1
        ? td.storeTypePhysical
        : Number(result.data.store_type_id) === 2
          ? td.storeTypeVirtual
          : 'N/A',
      relatedCount,
    });
  }, [publications, td]);

  const handleExecuteDeleteStore = useCallback(async (storeId, storeName) => {
    setDeletingStoreId(storeId);
    try {
      const result = await hideStore(storeId, currentUserId);
      if (!result.success) {
        console.error('[useAdminPublications] hideStore:', result.error);
        return;
      }
      setUnpublishedResources((prev) => ({
        ...prev,
        stores: prev.stores.filter((s) => s.id !== storeId),
      }));
      setSelectedStore((prev) => (prev?.id === storeId ? null : prev));
      insertActionLog(currentUserId, 'store', storeId, 'hide', null, { storeName });
    } finally {
      setDeletingStoreId(null);
    }
  }, [currentUserId, td]);

  const handleEditStore = useCallback(async (storeId, updates) => {
    try {
      const result = await updateAdminStore(storeId, updates);
      if (!result.success) { console.error('[useAdminPublications] updateAdminStore:', result.error); return false; }
      const typeLabel = Number(updates.store_type_id) === 1 ? 'Física' : Number(updates.store_type_id) === 2 ? 'Virtual' : undefined;
      const merged = typeLabel ? { ...updates, typeLabel } : { ...updates };
      setPublications(prev => prev.map(p => {
        const pStoreId = p.storeId || p.store?.id || p.store_id;
        if (pStoreId !== storeId) return p;
        return { ...p, storeName: updates.name || p.storeName, store: { ...(p.store || {}), ...updates } };
      }));
      setUnpublishedResources(prev => ({
        ...prev,
        stores: prev.stores.map(s => s.id === storeId ? { ...s, ...merged } : s),
      }));
      setSelectedStore(prev => prev?.id === storeId ? { ...prev, ...merged } : prev);
      return true;
    } catch (err) {
      console.error('[useAdminPublications] handleEditStore:', err);
      return false;
    }
  }, []);

  const handleViewBrand = useCallback(async (publication) => {
    const brandId = publication?.brandId || publication?.product?.brand?.id;
    if (!brandId) {
      console.error('[useAdminPublications] handleViewBrand: no brandId');
      return;
    }
    const result = await getBrandDetail(brandId);
    if (!result.success || !result.data) {
      console.error('[useAdminPublications] getBrandDetail:', result.error || 'Brand not found');
      return;
    }
    setSelectedBrand({
      ...result.data,
      productName: publication?.productName || publication?.product?.name || null,
      productBarcode: publication?.productBarcode || publication?.product?.barcode || null,
    });
  }, [td]);

  const handleExecuteDeleteBrand = useCallback(async (brandId, brandName) => {
    setDeletingBrandId(brandId);
    try {
      const result = await hideBrand(brandId, currentUserId);
      if (!result.success) {
        console.error('[useAdminPublications] hideBrand:', result.error);
        return;
      }
      setPublications((prev) => prev.map((p) => (
        (p.brandId || p.product?.brand?.id) === brandId
          ? { ...p, brandId: null, brandName: null, product: { ...p.product, brand: null } }
          : p
      )));
      setSelectedBrand((prev) => (prev?.id === brandId ? null : prev));
      insertActionLog(currentUserId, 'brand', brandId, 'hide', null, { brandName });
    } finally {
      setDeletingBrandId(null);
    }
  }, [currentUserId]);

  const handleEditBrand = useCallback(async (brandId, updates) => {
    try {
      const result = await updateAdminBrand(brandId, updates);
      if (!result.success) { console.error('[useAdminPublications] updateAdminBrand:', result.error); return false; }
      setPublications(prev => prev.map(p => {
        const pBrandId = p.brandId || p.product?.brand?.id;
        if (pBrandId !== brandId) return p;
        return { ...p, brandName: updates.name || p.brandName, product: { ...(p.product || {}), brand: { ...(p.product?.brand || {}), ...updates } } };
      }));
      setSelectedBrand(prev => prev?.id === brandId ? { ...prev, ...updates } : prev);
      return true;
    } catch (err) {
      console.error('[useAdminPublications] handleEditBrand:', err);
      return false;
    }
  }, []);

  const handleViewProduct = useCallback((product) => {
    setSelectedProduct(product || null);
  }, []);

  const handleExecuteDeleteProduct = useCallback(async (productId, productName) => {
    setDeletingProductId(productId);
    try {
      const result = await hideProduct(productId, currentUserId);
      if (!result.success) {
        console.error('[useAdminPublications] hideProduct:', result.error);
        return;
      }
      setUnpublishedResources((prev) => ({
        ...prev,
        products: prev.products.filter((p) => p.id !== productId),
      }));
      setSelectedProduct((prev) => (prev?.id === productId ? null : prev));
      insertActionLog(currentUserId, 'product', productId, 'hide', null, { productName });
    } finally {
      setDeletingProductId(null);
    }
  }, [currentUserId, td]);

  const handleEditProduct = useCallback(async (productId, updates) => {
    try {
      const result = await updateAdminProduct(productId, updates);
      if (!result.success) { console.error('[useAdminPublications] updateAdminProduct:', result.error); return false; }
      setUnpublishedResources(prev => ({
        ...prev,
        products: prev.products.map(p => p.id === productId ? { ...p, ...updates } : p),
      }));
      setSelectedProduct(prev => prev?.id === productId ? { ...prev, ...updates } : prev);
      return true;
    } catch (err) {
      console.error('[useAdminPublications] handleEditProduct:', err);
      return false;
    }
  }, []);

  return {
    publications, setPublications, pubsLoading, pubsLoaded,
    pubFilter, setPubFilter,
    deletingPub, selectedPub, setSelectedPub,
    deletingStoreId, setDeletingStoreId,
    deletingBrandId, setDeletingBrandId,
    deletingProductId, setDeletingProductId,
    selectedStore, setSelectedStore,
    selectedBrand, setSelectedBrand,
    selectedProduct, setSelectedProduct,
    unpublishedLoading, unpublishedLoaded, unpublishedResources,
    loadPublications, executeDeletePublication,
    handleEditPublication,
    handleViewStore, handleExecuteDeleteStore, handleEditStore,
    handleViewBrand, handleExecuteDeleteBrand, handleEditBrand,
    handleViewProduct, handleExecuteDeleteProduct, handleEditProduct,
    loadUnpublishedResources,
  };
}
