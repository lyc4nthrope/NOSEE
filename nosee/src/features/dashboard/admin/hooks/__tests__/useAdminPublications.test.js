import { renderHook, act } from '@testing-library/react';
import useAdminPublications from '../useAdminPublications';
import { useAdminStore } from '../../store/adminStore';
import {
  deactivatePublication, getAdminPublications, getBrandDetail, getPublishedRefs, getAllStores, getAllProducts,
  getStoreDetail, hideBrand, hideProduct, hidePublication, hideStore,
  updateAdminBrand, updateAdminProduct, updateAdminStore,
  updatePublication as updateAdminPublication,
} from '@/services/api/adminCatalog.api';
import { insertActionLog } from '@/services/api/audit.api';
import { checkRateLimit } from '@/services/utils/rateLimit';

vi.mock('@/services/api/adminCatalog.api', () => ({
  deactivatePublication: vi.fn(),
  getAdminPublications: vi.fn(),
  getBrandDetail: vi.fn(),
  getPublishedRefs: vi.fn(),
  getAllStores: vi.fn(),
  getAllProducts: vi.fn(),
  getStoreDetail: vi.fn(),
  hideBrand: vi.fn(),
  hideProduct: vi.fn(),
  hidePublication: vi.fn(),
  hideStore: vi.fn(),
  updateAdminBrand: vi.fn(),
  updateAdminProduct: vi.fn(),
  updateAdminStore: vi.fn(),
  updatePublication: vi.fn(),
}));

vi.mock('@/services/api/audit.api', () => ({
  insertActionLog: vi.fn(),
}));

vi.mock('@/services/utils/rateLimit', () => ({
  checkRateLimit: vi.fn(() => ({ allowed: true })),
}));

vi.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => ({
    t: {
      adminDashboard: {
        storeTypePhysical: 'Física',
        storeTypeVirtual: 'Virtual',
      },
    },
  }),
}));

vi.mock('@/features/auth/store/authStore', () => ({
  useAuthStore: vi.fn((sel) =>
    sel({ user: { id: 'admin-1' } })
  ),
}));

vi.mock('@/features/dashboard/admin/adminConstants', () => ({
  normalizePublicationForAdmin: vi.fn((p) => p),
}));

const createPub = (id, overrides = {}) => ({
  id, is_active: true, status: 'active',
  storeId: `store-${id}`, storeName: `Store ${id}`,
  brandId: `brand-${id}`, brandName: `Brand ${id}`,
  productId: `prod-${id}`, productName: `Product ${id}`,
  ...overrides,
});

describe('useAdminPublications', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAdminStore.setState(useAdminStore.getInitialState());
  });

  it('devuelve estado inicial correcto', () => {
    const { result } = renderHook(() => useAdminPublications());

    expect(result.current.publications).toEqual([]);
    expect(result.current.pubsLoading).toBe(false);
    expect(result.current.pubsLoaded).toBe(false);
    expect(result.current.pubFilter).toBe('all');
    expect(result.current.deletingPub).toBeNull();
    expect(result.current.unpublishedResources).toEqual({ stores: [], products: [] });
  });

  it('loadPublications carga publicaciones', async () => {
    const pubs = [createPub('pub-1'), createPub('pub-2')];
    getAdminPublications.mockResolvedValue({ success: true, data: pubs });

    const { result } = renderHook(() => useAdminPublications());

    await act(async () => {
      await result.current.loadPublications();
    });

    expect(result.current.publications).toHaveLength(2);
    expect(result.current.pubsLoading).toBe(false);
    expect(result.current.pubsLoaded).toBe(true);
  });

  it('loadPublications maneja fallo silenciosamente', async () => {
    getAdminPublications.mockResolvedValue({ success: false });

    const { result } = renderHook(() => useAdminPublications());

    await act(async () => {
      await result.current.loadPublications();
    });

    expect(result.current.publications).toEqual([]);
  });

  it('executeDeletePublication — hide action hace optimistic update', async () => {
    const pubs = [createPub('pub-1')];
    getAdminPublications.mockResolvedValue({ success: true, data: pubs });
    deactivatePublication.mockResolvedValue({ success: true });

    const { result } = renderHook(() => useAdminPublications());

    await act(async () => {
      await result.current.loadPublications();
    });

    await act(async () => {
      await result.current.executeDeletePublication('pub-1', 'hide');
    });

    // Optimistic update: cambia is_active y status
    expect(result.current.publications[0].is_active).toBe(false);
    expect(result.current.publications[0].status).toBe('hidden');
    expect(result.current.deletingPub).toBeNull();
    expect(deactivatePublication).toHaveBeenCalledWith('pub-1');
  });

  it('executeDeletePublication — hide_full action remueve publicación', async () => {
    const pubs = [createPub('pub-1')];
    getAdminPublications.mockResolvedValue({ success: true, data: pubs });
    hidePublication.mockResolvedValue({ success: true });

    const { result } = renderHook(() => useAdminPublications());

    await act(async () => {
      await result.current.loadPublications();
    });

    await act(async () => {
      await result.current.executeDeletePublication('pub-1', 'hide_full');
    });

    expect(result.current.publications).toHaveLength(0);
    expect(result.current.deletingPub).toBeNull();
    expect(hidePublication).toHaveBeenCalled();
  });

  it('handleEditPublication actualiza publicación en estado', async () => {
    const pubs = [createPub('pub-1')];
    getAdminPublications.mockResolvedValue({ success: true, data: pubs });
    updateAdminPublication.mockResolvedValue({ success: true });

    const { result } = renderHook(() => useAdminPublications());

    await act(async () => {
      await result.current.loadPublications();
    });

    await act(async () => {
      await result.current.handleEditPublication('pub-1', { name: 'Nuevo nombre' });
    });

    expect(result.current.publications[0].name).toBe('Nuevo nombre');
    expect(updateAdminPublication).toHaveBeenCalledWith('pub-1', { name: 'Nuevo nombre' });
  });

  it('handleViewStore carga detalle y actualiza store en store', async () => {
    const pubs = [createPub('pub-1')];
    getAdminPublications.mockResolvedValue({ success: true, data: pubs });
    getStoreDetail.mockResolvedValue({ success: true, data: { id: 'store-1', name: 'Tienda 1', store_type_id: 1 } });

    const { result } = renderHook(() => useAdminPublications());

    await act(async () => {
      await result.current.loadPublications();
    });

    await act(async () => {
      await result.current.handleViewStore(pubs[0]);
    });

    const selectedStore = useAdminStore.getState().selectedStore;
    expect(selectedStore).not.toBeNull();
    expect(selectedStore.id).toBe('store-1');
    expect(selectedStore.typeLabel).toBe('Física');
  });

  it('handleExecuteDeleteStore oculta tienda y limpia estado', async () => {
    const pubs = [createPub('pub-1')];
    getAdminPublications.mockResolvedValue({ success: true, data: pubs });
    hideStore.mockResolvedValue({ success: true });

    // Pre-populate unpublished stores via loadUnpublishedResources
    getPublishedRefs.mockResolvedValue({ success: true, data: [] });
    getAllStores.mockResolvedValue({ success: true, data: [{ id: 'store-1', name: 'Store 1', store_type_id: 1 }] });
    getAllProducts.mockResolvedValue({ success: true, data: [] });

    const { result } = renderHook(() => useAdminPublications());

    await act(async () => {
      await result.current.loadPublications();
    });

    await act(async () => {
      await result.current.loadUnpublishedResources();
    });

    expect(result.current.unpublishedResources.stores).toHaveLength(1);

    await act(async () => {
      await result.current.handleExecuteDeleteStore('store-1', 'Store 1');
    });

    expect(result.current.unpublishedResources.stores).toHaveLength(0);
    expect(result.current.deletingStoreId).toBeNull();
    expect(hideStore).toHaveBeenCalledWith('store-1', 'admin-1');
  });

  it('handleViewBrand carga detalle y actualiza brand en store', async () => {
    getBrandDetail.mockResolvedValue({ success: true, data: { id: 1, name: 'Nike' } });

    const { result } = renderHook(() => useAdminPublications());
    const publication = { brandId: 1, productName: 'Zapatos', productBarcode: 'ABC123' };

    await act(async () => {
      await result.current.handleViewBrand(publication);
    });

    const selectedBrand = useAdminStore.getState().selectedBrand;
    expect(selectedBrand).not.toBeNull();
    expect(selectedBrand.id).toBe(1);
    expect(selectedBrand.productName).toBe('Zapatos');
  });

  it('handleExecuteDeleteBrand oculta marca y optimiza publicaciones', async () => {
    const pubs = [createPub('pub-1', { brandId: 1 })];
    getAdminPublications.mockResolvedValue({ success: true, data: pubs });
    hideBrand.mockResolvedValue({ success: true });

    const { result } = renderHook(() => useAdminPublications());

    await act(async () => {
      await result.current.loadPublications();
    });

    await act(async () => {
      await result.current.handleExecuteDeleteBrand(1, 'Brand 1');
    });

    expect(result.current.publications[0].brandId).toBeNull();
    expect(result.current.deletingBrandId).toBeNull();
  });

  it('handleViewProduct actualiza product en store', async () => {
    const { result } = renderHook(() => useAdminPublications());
    const product = { id: 'prod-1', name: 'Zapatos' };

    act(() => {
      result.current.handleViewProduct(product);
    });

    expect(useAdminStore.getState().selectedProduct).toEqual(product);
  });

  it('handleExecuteDeleteProduct oculta producto y limpia estado', async () => {
    hideProduct.mockResolvedValue({ success: true });

    // Pre-populate unpublished products via loadUnpublishedResources
    getPublishedRefs.mockResolvedValue({ success: true, data: [] });
    getAllStores.mockResolvedValue({ success: true, data: [] });
    getAllProducts.mockResolvedValue({ success: true, data: [{ id: 'prod-1', name: 'Zapatos' }] });

    const { result } = renderHook(() => useAdminPublications());

    await act(async () => {
      await result.current.loadUnpublishedResources();
    });

    expect(result.current.unpublishedResources.products).toHaveLength(1);

    await act(async () => {
      await result.current.handleExecuteDeleteProduct('prod-1', 'Zapatos');
    });

    expect(result.current.unpublishedResources.products).toHaveLength(0);
    expect(result.current.deletingProductId).toBeNull();
  });

  it('handleEditStore actualiza publicaciones y unpublished', async () => {
    updateAdminStore.mockResolvedValue({ success: true });
    const pubs = [createPub('pub-1')];
    getAdminPublications.mockResolvedValue({ success: true, data: pubs });

    // Pre-populate stores via loadUnpublishedResources
    getPublishedRefs.mockResolvedValue({ success: true, data: [{ store_id: 'store-2' }] }); // store-1 is orphan
    getAllStores.mockResolvedValue({ success: true, data: [
      { id: 'store-1', name: 'Old Name', store_type_id: 1 },
      { id: 'store-2', name: 'Used', store_type_id: 1 },
    ]});
    getAllProducts.mockResolvedValue({ success: true, data: [] });

    const { result } = renderHook(() => useAdminPublications());

    await act(async () => {
      await result.current.loadPublications();
    });

    await act(async () => {
      await result.current.loadUnpublishedResources();
    });

    expect(result.current.unpublishedResources.stores).toHaveLength(1);
    expect(result.current.unpublishedResources.stores[0].name).toBe('Old Name');

    await act(async () => {
      await result.current.handleEditStore('store-1', { name: 'New Name', store_type_id: 2 });
    });

    expect(result.current.unpublishedResources.stores[0].name).toBe('New Name');
    expect(updateAdminStore).toHaveBeenCalledWith('store-1', { name: 'New Name', store_type_id: 2 });
  });

  it('handleEditBrand actualiza publicaciones y store', async () => {
    updateAdminBrand.mockResolvedValue({ success: true });
    const pubs = [createPub('pub-1')];
    getAdminPublications.mockResolvedValue({ success: true, data: pubs });

    const { result } = renderHook(() => useAdminPublications());

    await act(async () => {
      await result.current.loadPublications();
    });

    await act(async () => {
      await result.current.handleEditBrand('brand-1', { name: 'New Brand' });
    });

    expect(updateAdminBrand).toHaveBeenCalledWith('brand-1', { name: 'New Brand' });
  });

  it('handleEditProduct actualiza productos en unpublished', async () => {
    updateAdminProduct.mockResolvedValue({ success: true });

    // Pre-populate products via loadUnpublishedResources
    getPublishedRefs.mockResolvedValue({ success: true, data: [{ product_id: 'prod-2' }] }); // prod-1 is orphan
    getAllStores.mockResolvedValue({ success: true, data: [] });
    getAllProducts.mockResolvedValue({ success: true, data: [
      { id: 'prod-1', name: 'Old Product' },
      { id: 'prod-2', name: 'Used' },
    ]});

    const { result } = renderHook(() => useAdminPublications());

    await act(async () => {
      await result.current.loadUnpublishedResources();
    });

    expect(result.current.unpublishedResources.products).toHaveLength(1);
    expect(result.current.unpublishedResources.products[0].name).toBe('Old Product');

    await act(async () => {
      await result.current.handleEditProduct('prod-1', { name: 'New Product' });
    });

    expect(result.current.unpublishedResources.products[0].name).toBe('New Product');
    expect(updateAdminProduct).toHaveBeenCalledWith('prod-1', { name: 'New Product' });
  });

  it('loadUnpublishedResources carga recursos huérfanos', async () => {
    getPublishedRefs.mockResolvedValue({ success: true, data: [{ store_id: 'store-1', product_id: 'prod-1' }] });
    getAllStores.mockResolvedValue({ success: true, data: [
      { id: 'store-1', name: 'Usada', store_type_id: 1 },
      { id: 'store-2', name: 'Huérfana', store_type_id: 2 },
    ]});
    getAllProducts.mockResolvedValue({ success: true, data: [
      { id: 'prod-1', name: 'Usado' },
      { id: 'prod-2', name: 'Huérfano' },
    ]});

    const { result } = renderHook(() => useAdminPublications());

    await act(async () => {
      await result.current.loadUnpublishedResources();
    });

    expect(result.current.unpublishedResources.stores).toHaveLength(1);
    expect(result.current.unpublishedResources.stores[0].id).toBe('store-2');
    expect(result.current.unpublishedResources.products).toHaveLength(1);
    expect(result.current.unpublishedResources.products[0].id).toBe('prod-2');
    expect(result.current.unpublishedLoading).toBe(false);
    expect(result.current.unpublishedLoaded).toBe(true);
  });
});
