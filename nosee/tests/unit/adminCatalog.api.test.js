/**
 * tests/unit/adminCatalog.api.test.js
 *
 * Tests unitarios para adminCatalog.api.js
 *
 * Patrón: vi.doMock + resetModules (mismo que tests existentes)
 * Mockea @/services/supabase.client usando chainable mocks.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createMockError } from '../helpers/admin.fixtures';

// ─── Mock chainable para queries de catálogo ─────────────────────────────────

function createChainableMock(result) {
  const r = result || { data: [], error: null };
  const builder = {
    select: vi.fn(() => builder),
    order: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    range: vi.fn(() => builder),
    ilike: vi.fn(() => builder),
    insert: vi.fn(() => builder),
    update: vi.fn(() => builder),
    maybeSingle: vi.fn(() => Promise.resolve(r)),
    single: vi.fn(() => Promise.resolve(r)),
    then: (resolve) => Promise.resolve(r).then(resolve),
  };
  return builder;
}

// ─── Datos de prueba ─────────────────────────────────────────────────────────

const mockCategories = [
  { id: 'cat-1', name: 'Lácteos', products: [{ count: 45 }] },
  { id: 'cat-2', name: 'Bebidas', products: [{ count: 120 }] },
];

const mockStores = [
  {
    id: 'store-1', name: 'Super Centro', address: 'Av. Central 123',
    website_url: null, store_type_id: 1, created_by: 'user-1', created_at: '2026-01-01T00:00:00Z',
  },
  {
    id: 'store-2', name: 'Almacén Norte', address: 'Calle Norte 456',
    website_url: 'https://ejemplo.com', store_type_id: 2, created_by: 'user-2', created_at: '2026-02-01T00:00:00Z',
  },
];

const mockProducts = [
  {
    id: 'prod-1', name: 'Leche Entera', barcode: '7790000000001', base_quantity: '1 L',
    created_at: '2026-01-10T00:00:00Z',
    brand: { id: 'brand-1', name: 'La Serenísima' },
    unit: { id: 1, name: 'Litro', abbreviation: 'L' },
  },
  {
    id: 'prod-2', name: 'Yogur Natural', barcode: '7790000000002', base_quantity: '200 g',
    created_at: '2026-01-15T00:00:00Z',
    brand: { id: 'brand-1', name: 'La Serenísima' },
    unit: { id: 2, name: 'Gramo', abbreviation: 'g' },
  },
];

const mockBrands = [
  { id: 'brand-1', name: 'La Serenísima', is_active: true, is_admin_hidden: false, created_at: '2026-01-01T00:00:00Z' },
  { id: 'brand-2', name: 'Coca-Cola', is_active: true, is_admin_hidden: false, created_at: '2026-01-01T00:00:00Z' },
];

const mockPublications = [
  {
    id: 'pub-1', price: 1500, photo_url: null, description: null, confidence_score: 0.95,
    is_active: true, created_at: '2026-05-01T00:00:00Z', user_id: 'user-1', store_id: 'store-1', product_id: 'prod-1',
    user: { id: 'user-1', full_name: 'Juan Pérez', reputation_points: 100 },
    product: { id: 'prod-1', name: 'Leche Entera', barcode: '7790000000001', base_quantity: '1 L', brand: { id: 'brand-1', name: 'La Serenísima' }, unit_type: { id: 1, name: 'Litro', abbreviation: 'L' } },
    store: { id: 'store-1', name: 'Super Centro', address: 'Av. Central 123' },
  },
];

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('adminCatalog.api', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.doUnmock('@/services/supabase.client');
  });

  // ── getCategories ──────────────────────────────────────────────────────────

  describe('getCategories', () => {
    it('success: devuelve array de categorías', async () => {
      const mock = createChainableMock({ data: mockCategories, error: null });
      const supabase = { from: vi.fn(() => mock) };
      vi.doMock('@/services/supabase.client', () => ({ supabase }));

      const { getCategories } = await import('@/services/api/adminCatalog.api');
      const result = await getCategories();

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockCategories);
      expect(supabase.from).toHaveBeenCalledWith('product_categories');
    });

    it('error: devuelve { success: false, error }', async () => {
      const mock = createChainableMock({ data: null, error: createMockError('DB error') });
      const supabase = { from: vi.fn(() => mock) };
      vi.doMock('@/services/supabase.client', () => ({ supabase }));

      const { getCategories } = await import('@/services/api/adminCatalog.api');
      const result = await getCategories();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Error al procesar la solicitud');
    });
  });

  // ── getAllStores ───────────────────────────────────────────────────────────

  describe('getAllStores', () => {
    it('success: devuelve array de tiendas con count', async () => {
      const mock = createChainableMock({ data: mockStores, error: null, count: 2 });
      const supabase = { from: vi.fn(() => mock) };
      vi.doMock('@/services/supabase.client', () => ({ supabase }));

      const { getAllStores } = await import('@/services/api/adminCatalog.api');
      const result = await getAllStores();

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockStores);
      expect(result.count).toBe(2);
      expect(supabase.from).toHaveBeenCalledWith('stores');
    });

    it('usa range(0, 19) por defecto (page=1, pageSize=20)', async () => {
      const mock = createChainableMock({ data: [], error: null });
      const supabase = { from: vi.fn(() => mock) };
      vi.doMock('@/services/supabase.client', () => ({ supabase }));

      const { getAllStores } = await import('@/services/api/adminCatalog.api');
      await getAllStores();

      expect(mock.range).toHaveBeenCalledWith(0, 19);
    });

    it('pagina correctamente con page=2, pageSize=20 → range(20, 39)', async () => {
      const mock = createChainableMock({ data: [mockStores[0]], error: null, count: 2 });
      const supabase = { from: vi.fn(() => mock) };
      vi.doMock('@/services/supabase.client', () => ({ supabase }));

      const { getAllStores } = await import('@/services/api/adminCatalog.api');
      const result = await getAllStores(2, 20);

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(result.count).toBe(2);
      expect(mock.range).toHaveBeenCalledWith(20, 39);
    });

    it('usa pageSize personalizado → range(0, 49) para page=1, pageSize=50', async () => {
      const mock = createChainableMock({ data: mockStores, error: null, count: 2 });
      const supabase = { from: vi.fn(() => mock) };
      vi.doMock('@/services/supabase.client', () => ({ supabase }));

      const { getAllStores } = await import('@/services/api/adminCatalog.api');
      await getAllStores(1, 50);

      expect(mock.range).toHaveBeenCalledWith(0, 49);
    });

    it('usa select con count exact', async () => {
      const mock = createChainableMock({ data: [], error: null });
      const supabase = { from: vi.fn(() => mock) };
      vi.doMock('@/services/supabase.client', () => ({ supabase }));

      const { getAllStores } = await import('@/services/api/adminCatalog.api');
      await getAllStores();

      expect(mock.select).toHaveBeenCalledWith(
        'id, name, address, website_url, store_type_id, created_by, created_at',
        { count: 'exact' }
      );
    });

    it('error: devuelve { success: false, error }', async () => {
      const mock = createChainableMock({ data: null, error: createMockError('Error') });
      const supabase = { from: vi.fn(() => mock) };
      vi.doMock('@/services/supabase.client', () => ({ supabase }));

      const { getAllStores } = await import('@/services/api/adminCatalog.api');
      const result = await getAllStores();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Error al procesar la solicitud');
    });
  });

  // ── getAllProducts ─────────────────────────────────────────────────────────

  describe('getAllProducts', () => {
    it('success: devuelve array de productos con count', async () => {
      const mock = createChainableMock({ data: mockProducts, error: null, count: 2 });
      const supabase = { from: vi.fn(() => mock) };
      vi.doMock('@/services/supabase.client', () => ({ supabase }));

      const { getAllProducts } = await import('@/services/api/adminCatalog.api');
      const result = await getAllProducts();

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockProducts);
      expect(result.count).toBe(2);
      expect(supabase.from).toHaveBeenCalledWith('products');
    });

    it('usa range(0, 19) por defecto (page=1, pageSize=20)', async () => {
      const mock = createChainableMock({ data: [], error: null });
      const supabase = { from: vi.fn(() => mock) };
      vi.doMock('@/services/supabase.client', () => ({ supabase }));

      const { getAllProducts } = await import('@/services/api/adminCatalog.api');
      await getAllProducts();

      expect(mock.range).toHaveBeenCalledWith(0, 19);
    });

    it('pagina correctamente con page=2, pageSize=20 → range(20, 39)', async () => {
      const mock = createChainableMock({ data: [mockProducts[0]], error: null, count: 2 });
      const supabase = { from: vi.fn(() => mock) };
      vi.doMock('@/services/supabase.client', () => ({ supabase }));

      const { getAllProducts } = await import('@/services/api/adminCatalog.api');
      const result = await getAllProducts(2, 20);

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(result.count).toBe(2);
      expect(mock.range).toHaveBeenCalledWith(20, 39);
    });

    it('usa pageSize personalizado → range(0, 49) para page=1, pageSize=50', async () => {
      const mock = createChainableMock({ data: mockProducts, error: null, count: 2 });
      const supabase = { from: vi.fn(() => mock) };
      vi.doMock('@/services/supabase.client', () => ({ supabase }));

      const { getAllProducts } = await import('@/services/api/adminCatalog.api');
      await getAllProducts(1, 50);

      expect(mock.range).toHaveBeenCalledWith(0, 49);
    });

    it('usa select con count exact', async () => {
      const mock = createChainableMock({ data: [], error: null });
      const supabase = { from: vi.fn(() => mock) };
      vi.doMock('@/services/supabase.client', () => ({ supabase }));

      const { getAllProducts } = await import('@/services/api/adminCatalog.api');
      await getAllProducts();

      expect(mock.select).toHaveBeenCalledWith(
        'id, name, barcode, base_quantity, created_at, brand:brands(id, name), unit:unit_types(id, name, abbreviation)',
        { count: 'exact' }
      );
    });

    it('error: devuelve { success: false, error }', async () => {
      const mock = createChainableMock({ data: null, error: createMockError('Error') });
      const supabase = { from: vi.fn(() => mock) };
      vi.doMock('@/services/supabase.client', () => ({ supabase }));

      const { getAllProducts } = await import('@/services/api/adminCatalog.api');
      const result = await getAllProducts();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Error al procesar la solicitud');
    });
  });

  // ── getPublishedRefs ───────────────────────────────────────────────────────

  describe('getPublishedRefs', () => {
    const mockRefs = [
      { store_id: 'store-1', product_id: 'prod-1' },
      { store_id: 'store-1', product_id: 'prod-2' },
    ];

    it('success: devuelve referencias de publicaciones con count', async () => {
      const mock = createChainableMock({ data: mockRefs, error: null, count: 2 });
      const supabase = { from: vi.fn(() => mock) };
      vi.doMock('@/services/supabase.client', () => ({ supabase }));

      const { getPublishedRefs } = await import('@/services/api/adminCatalog.api');
      const result = await getPublishedRefs();

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockRefs);
      expect(result.count).toBe(2);
      expect(supabase.from).toHaveBeenCalledWith('price_publications');
    });

    it('usa range(0, 19) por defecto (page=1, pageSize=20)', async () => {
      const mock = createChainableMock({ data: [], error: null });
      const supabase = { from: vi.fn(() => mock) };
      vi.doMock('@/services/supabase.client', () => ({ supabase }));

      const { getPublishedRefs } = await import('@/services/api/adminCatalog.api');
      await getPublishedRefs();

      expect(mock.range).toHaveBeenCalledWith(0, 19);
    });

    it('pagina correctamente con page=2 → range(20, 39)', async () => {
      const mock = createChainableMock({ data: [mockRefs[0]], error: null, count: 2 });
      const supabase = { from: vi.fn(() => mock) };
      vi.doMock('@/services/supabase.client', () => ({ supabase }));

      const { getPublishedRefs } = await import('@/services/api/adminCatalog.api');
      const result = await getPublishedRefs(2, 20);

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(result.count).toBe(2);
      expect(mock.range).toHaveBeenCalledWith(20, 39);
    });

    it('usa select con count exact', async () => {
      const mock = createChainableMock({ data: [], error: null });
      const supabase = { from: vi.fn(() => mock) };
      vi.doMock('@/services/supabase.client', () => ({ supabase }));

      const { getPublishedRefs } = await import('@/services/api/adminCatalog.api');
      await getPublishedRefs();

      expect(mock.select).toHaveBeenCalledWith(
        'store_id, product_id',
        { count: 'exact' }
      );
    });

    it('error: devuelve { success: false, error }', async () => {
      const mock = createChainableMock({ data: null, error: createMockError('Error') });
      const supabase = { from: vi.fn(() => mock) };
      vi.doMock('@/services/supabase.client', () => ({ supabase }));

      const { getPublishedRefs } = await import('@/services/api/adminCatalog.api');
      const result = await getPublishedRefs();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Error al procesar la solicitud');
    });
  });

  // ── searchStoresLight ──────────────────────────────────────────────────────

  describe('searchStoresLight', () => {
    it('success: devuelve tiendas que coinciden con el término', async () => {
      const mock = createChainableMock({ data: [mockStores[0]], error: null });
      const supabase = { from: vi.fn(() => mock) };
      vi.doMock('@/services/supabase.client', () => ({ supabase }));

      const { searchStoresLight } = await import('@/services/api/adminCatalog.api');
      const result = await searchStoresLight('centro');

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(supabase.from).toHaveBeenCalledWith('stores');
    });

    it('success con término vacío: devuelve array vacío', async () => {
      const mock = createChainableMock({ data: null, error: null });
      const supabase = { from: vi.fn(() => mock) };
      vi.doMock('@/services/supabase.client', () => ({ supabase }));

      const { searchStoresLight } = await import('@/services/api/adminCatalog.api');
      const result = await searchStoresLight('');

      expect(result.success).toBe(true);
      expect(result.data).toEqual([]);
    });

    it('error de red: catch path devuelve error sanitizado', async () => {
      const rejectMock = {
        select: vi.fn(() => rejectMock),
        ilike: vi.fn(() => rejectMock),
        limit: vi.fn(() => rejectMock),
        then: (_, rej) => rej(new Error('Network error')),
      };
      const supabase = { from: vi.fn(() => rejectMock) };
      vi.doMock('@/services/supabase.client', () => ({ supabase }));

      const { searchStoresLight } = await import('@/services/api/adminCatalog.api');
      const result = await searchStoresLight('test');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Error al procesar la solicitud');
    });
  });

  // ── searchProductsLight ────────────────────────────────────────────────────

  describe('searchProductsLight', () => {
    it('success: devuelve productos que coinciden con el término', async () => {
      const mock = createChainableMock({ data: [mockProducts[0]], error: null });
      const supabase = { from: vi.fn(() => mock) };
      vi.doMock('@/services/supabase.client', () => ({ supabase }));

      const { searchProductsLight } = await import('@/services/api/adminCatalog.api');
      const result = await searchProductsLight('leche');

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(supabase.from).toHaveBeenCalledWith('products');
    });

    it('success con datos vacíos (data null → [])', async () => {
      const mock = createChainableMock({ data: null, error: null });
      const supabase = { from: vi.fn(() => mock) };
      vi.doMock('@/services/supabase.client', () => ({ supabase }));

      const { searchProductsLight } = await import('@/services/api/adminCatalog.api');
      const result = await searchProductsLight('zzzz');

      expect(result.success).toBe(true);
      expect(result.data).toEqual([]);
    });

    it('error de red: catch path devuelve error sanitizado', async () => {
      const rejectMock = {
        select: vi.fn(() => rejectMock),
        ilike: vi.fn(() => rejectMock),
        limit: vi.fn(() => rejectMock),
        then: (_, rej) => rej(new Error('Network error')),
      };
      const supabase = { from: vi.fn(() => rejectMock) };
      vi.doMock('@/services/supabase.client', () => ({ supabase }));

      const { searchProductsLight } = await import('@/services/api/adminCatalog.api');
      const result = await searchProductsLight('test');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Error al procesar la solicitud');
    });
  });

  // ── getBrandDetail ─────────────────────────────────────────────────────────

  describe('getBrandDetail', () => {
    const brandData = { id: 'brand-1', name: 'La Serenísima', created_at: '2026-01-01T00:00:00Z' };

    it('success: devuelve detalle de marca con productsCount', async () => {
      const brandQuery = createChainableMock({ data: brandData, error: null });
      const countQuery = createChainableMock({ count: 10, error: null });
      const supabase = { from: vi.fn().mockReturnValueOnce(brandQuery).mockReturnValueOnce(countQuery) };
      vi.doMock('@/services/supabase.client', () => ({ supabase }));

      const { getBrandDetail } = await import('@/services/api/adminCatalog.api');
      const result = await getBrandDetail('brand-1');

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ ...brandData, productsCount: 10 });
      expect(supabase.from).toHaveBeenNthCalledWith(1, 'brands');
      expect(supabase.from).toHaveBeenNthCalledWith(2, 'products');
    });

    it('error: primer query (brand) falla', async () => {
      const brandQuery = createChainableMock({ data: null, error: createMockError('Not found') });
      const supabase = { from: vi.fn(() => brandQuery) };
      vi.doMock('@/services/supabase.client', () => ({ supabase }));

      const { getBrandDetail } = await import('@/services/api/adminCatalog.api');
      const result = await getBrandDetail('brand-999');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Error al procesar la solicitud');
    });

    it('error: segundo query (count) falla', async () => {
      const brandQuery = createChainableMock({ data: brandData, error: null });
      const countQuery = createChainableMock({ count: null, error: createMockError('Count failed') });
      const supabase = { from: vi.fn().mockReturnValueOnce(brandQuery).mockReturnValueOnce(countQuery) };
      vi.doMock('@/services/supabase.client', () => ({ supabase }));

      const { getBrandDetail } = await import('@/services/api/adminCatalog.api');
      const result = await getBrandDetail('brand-1');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Count failed');
    });
  });

  // ── getCatalogStores ───────────────────────────────────────────────────────

  describe('getCatalogStores', () => {
    it('success: devuelve tiendas del catálogo', async () => {
      const mock = createChainableMock({ data: mockStores, error: null });
      const supabase = { from: vi.fn(() => mock) };
      vi.doMock('@/services/supabase.client', () => ({ supabase }));

      const { getCatalogStores } = await import('@/services/api/adminCatalog.api');
      const result = await getCatalogStores();

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockStores);
      expect(supabase.from).toHaveBeenCalledWith('stores');
    });

    it('error: devuelve { success: false, error }', async () => {
      const mock = createChainableMock({ data: null, error: createMockError('Error') });
      const supabase = { from: vi.fn(() => mock) };
      vi.doMock('@/services/supabase.client', () => ({ supabase }));

      const { getCatalogStores } = await import('@/services/api/adminCatalog.api');
      const result = await getCatalogStores();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Error al procesar la solicitud');
    });
  });

  // ── getCatalogProducts ─────────────────────────────────────────────────────

  describe('getCatalogProducts', () => {
    it('success: devuelve productos del catálogo', async () => {
      const mock = createChainableMock({ data: mockProducts, error: null });
      const supabase = { from: vi.fn(() => mock) };
      vi.doMock('@/services/supabase.client', () => ({ supabase }));

      const { getCatalogProducts } = await import('@/services/api/adminCatalog.api');
      const result = await getCatalogProducts();

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockProducts);
      expect(supabase.from).toHaveBeenCalledWith('products');
    });

    it('error: devuelve { success: false, error }', async () => {
      const mock = createChainableMock({ data: null, error: createMockError('Error') });
      const supabase = { from: vi.fn(() => mock) };
      vi.doMock('@/services/supabase.client', () => ({ supabase }));

      const { getCatalogProducts } = await import('@/services/api/adminCatalog.api');
      const result = await getCatalogProducts();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Error al procesar la solicitud');
    });
  });

  // ── getCatalogBrands ───────────────────────────────────────────────────────

  describe('getCatalogBrands', () => {
    it('success: devuelve marcas del catálogo', async () => {
      const mock = createChainableMock({ data: mockBrands, error: null });
      const supabase = { from: vi.fn(() => mock) };
      vi.doMock('@/services/supabase.client', () => ({ supabase }));

      const { getCatalogBrands } = await import('@/services/api/adminCatalog.api');
      const result = await getCatalogBrands();

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockBrands);
      expect(supabase.from).toHaveBeenCalledWith('brands');
    });

    it('error: devuelve { success: false, error }', async () => {
      const mock = createChainableMock({ data: null, error: createMockError('Error') });
      const supabase = { from: vi.fn(() => mock) };
      vi.doMock('@/services/supabase.client', () => ({ supabase }));

      const { getCatalogBrands } = await import('@/services/api/adminCatalog.api');
      const result = await getCatalogBrands();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Error al procesar la solicitud');
    });
  });

  // ── getPublicationById ─────────────────────────────────────────────────────

  describe('getPublicationById', () => {
    const pubData = {
      id: 'pub-1', price: 1500, is_active: true,
      products: { name: 'Leche Entera', base_quantity: '1 L', brand: { name: 'La Serenísima' }, unit_type: { name: 'Litro', abbreviation: 'L' } },
      store: { name: 'Super Centro' },
    };

    it('success: devuelve publicación por ID', async () => {
      const mock = createChainableMock({ data: pubData, error: null });
      const supabase = { from: vi.fn(() => mock) };
      vi.doMock('@/services/supabase.client', () => ({ supabase }));

      const { getPublicationById } = await import('@/services/api/adminCatalog.api');
      const result = await getPublicationById('pub-1');

      expect(result.success).toBe(true);
      expect(result.data).toEqual(pubData);
      expect(supabase.from).toHaveBeenCalledWith('price_publications');
    });

    it('success con null (maybeSingle no encuentra)', async () => {
      const mock = createChainableMock({ data: null, error: null });
      const supabase = { from: vi.fn(() => mock) };
      vi.doMock('@/services/supabase.client', () => ({ supabase }));

      const { getPublicationById } = await import('@/services/api/adminCatalog.api');
      const result = await getPublicationById('nonexistent');

      expect(result.success).toBe(true);
      expect(result.data).toBeNull();
    });

    it('error: devuelve { success: false, error }', async () => {
      const mock = createChainableMock({ data: null, error: createMockError('Not found') });
      const supabase = { from: vi.fn(() => mock) };
      vi.doMock('@/services/supabase.client', () => ({ supabase }));

      const { getPublicationById } = await import('@/services/api/adminCatalog.api');
      const result = await getPublicationById('bad-id');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Error al procesar la solicitud');
    });
  });

  // ── hidePublication ────────────────────────────────────────────────────────

  describe('hidePublication', () => {
    it('success: oculta publicación', async () => {
      const mock = createChainableMock({ error: null });
      const supabase = { from: vi.fn(() => mock) };
      vi.doMock('@/services/supabase.client', () => ({ supabase }));

      const { hidePublication } = await import('@/services/api/adminCatalog.api');
      const result = await hidePublication('pub-1', 'admin-uuid', 'Razón del test');

      expect(result.success).toBe(true);
      expect(supabase.from).toHaveBeenCalledWith('price_publications');
    });

    it('error: devuelve { success: false, error }', async () => {
      const mock = createChainableMock({ error: createMockError('Update failed') });
      const supabase = { from: vi.fn(() => mock) };
      vi.doMock('@/services/supabase.client', () => ({ supabase }));

      const { hidePublication } = await import('@/services/api/adminCatalog.api');
      const result = await hidePublication('pub-1', 'admin-uuid');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Error al procesar la solicitud');
    });
  });

  // ── getAdminPublications ───────────────────────────────────────────────────

  describe('getAdminPublications', () => {
    it('success: devuelve publicaciones admin', async () => {
      const mock = createChainableMock({ data: mockPublications, error: null });
      const supabase = { from: vi.fn(() => mock) };
      vi.doMock('@/services/supabase.client', () => ({ supabase }));

      const { getAdminPublications } = await import('@/services/api/adminCatalog.api');
      const result = await getAdminPublications();

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockPublications);
      expect(supabase.from).toHaveBeenCalledWith('price_publications');
    });

    it('success con data null: devuelve []', async () => {
      const mock = createChainableMock({ data: null, error: null });
      const supabase = { from: vi.fn(() => mock) };
      vi.doMock('@/services/supabase.client', () => ({ supabase }));

      const { getAdminPublications } = await import('@/services/api/adminCatalog.api');
      const result = await getAdminPublications();

      expect(result.success).toBe(true);
      expect(result.data).toEqual([]);
    });

    it('error: devuelve { success: false, error }', async () => {
      const mock = createChainableMock({ data: null, error: createMockError('Error') });
      const supabase = { from: vi.fn(() => mock) };
      vi.doMock('@/services/supabase.client', () => ({ supabase }));

      const { getAdminPublications } = await import('@/services/api/adminCatalog.api');
      const result = await getAdminPublications();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Error al procesar la solicitud');
    });
  });

  // ── getStoreDetail ─────────────────────────────────────────────────────────

  describe('getStoreDetail', () => {
    const storeData = {
      id: 'store-1', name: 'Super Centro', address: 'Av. Central 123',
      website_url: null, store_type_id: 1, created_by: 'user-1', created_at: '2026-01-01T00:00:00Z',
    };

    it('success: devuelve detalle de tienda', async () => {
      const mock = createChainableMock({ data: storeData, error: null });
      const supabase = { from: vi.fn(() => mock) };
      vi.doMock('@/services/supabase.client', () => ({ supabase }));

      const { getStoreDetail } = await import('@/services/api/adminCatalog.api');
      const result = await getStoreDetail('store-1');

      expect(result.success).toBe(true);
      expect(result.data).toEqual(storeData);
      expect(supabase.from).toHaveBeenCalledWith('stores');
    });

    it('error: devuelve { success: false, error }', async () => {
      const mock = createChainableMock({ data: null, error: createMockError('Error') });
      const supabase = { from: vi.fn(() => mock) };
      vi.doMock('@/services/supabase.client', () => ({ supabase }));

      const { getStoreDetail } = await import('@/services/api/adminCatalog.api');
      const result = await getStoreDetail('store-999');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Error al procesar la solicitud');
    });
  });

  // ── deactivatePublication ───────────────────────────────────────────────

  describe('deactivatePublication', () => {
    it('success: desactiva publicación', async () => {
      const mock = createChainableMock({ error: null });
      const supabase = { from: vi.fn(() => mock) };
      vi.doMock('@/services/supabase.client', () => ({ supabase }));

      const { deactivatePublication } = await import('@/services/api/adminCatalog.api');
      const result = await deactivatePublication('pub-1');

      expect(result.success).toBe(true);
      expect(supabase.from).toHaveBeenCalledWith('price_publications');
    });

    it('error: devuelve { success: false, error }', async () => {
      const mock = createChainableMock({ error: createMockError('Update failed') });
      const supabase = { from: vi.fn(() => mock) };
      vi.doMock('@/services/supabase.client', () => ({ supabase }));

      const { deactivatePublication } = await import('@/services/api/adminCatalog.api');
      const result = await deactivatePublication('pub-1');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Error al procesar la solicitud');
    });
  });

  // ── hideStore ───────────────────────────────────────────────────────────

  describe('hideStore', () => {
    it('success: oculta tienda', async () => {
      const mock = createChainableMock({ error: null });
      const supabase = { from: vi.fn(() => mock) };
      vi.doMock('@/services/supabase.client', () => ({ supabase }));

      const { hideStore } = await import('@/services/api/adminCatalog.api');
      const result = await hideStore('store-1', 'admin-uuid', 'Razón del test');

      expect(result.success).toBe(true);
      expect(supabase.from).toHaveBeenCalledWith('stores');
    });

    it('error: devuelve { success: false, error }', async () => {
      const mock = createChainableMock({ error: createMockError('Update failed') });
      const supabase = { from: vi.fn(() => mock) };
      vi.doMock('@/services/supabase.client', () => ({ supabase }));

      const { hideStore } = await import('@/services/api/adminCatalog.api');
      const result = await hideStore('store-1', 'admin-uuid', 'Razón');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Error al procesar la solicitud');
    });
  });

  // ── hideBrand ───────────────────────────────────────────────────────────

  describe('hideBrand', () => {
    it('success: oculta marca', async () => {
      const mock = createChainableMock({ error: null });
      const supabase = { from: vi.fn(() => mock) };
      vi.doMock('@/services/supabase.client', () => ({ supabase }));

      const { hideBrand } = await import('@/services/api/adminCatalog.api');
      const result = await hideBrand('brand-1', 'admin-uuid', 'Razón del test');

      expect(result.success).toBe(true);
      expect(supabase.from).toHaveBeenCalledWith('brands');
    });

    it('error: devuelve { success: false, error }', async () => {
      const mock = createChainableMock({ error: createMockError('Update failed') });
      const supabase = { from: vi.fn(() => mock) };
      vi.doMock('@/services/supabase.client', () => ({ supabase }));

      const { hideBrand } = await import('@/services/api/adminCatalog.api');
      const result = await hideBrand('brand-1', 'admin-uuid', 'Razón');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Error al procesar la solicitud');
    });
  });

  // ── hideProduct ─────────────────────────────────────────────────────────

  describe('hideProduct', () => {
    it('success: oculta producto', async () => {
      const mock = createChainableMock({ error: null });
      const supabase = { from: vi.fn(() => mock) };
      vi.doMock('@/services/supabase.client', () => ({ supabase }));

      const { hideProduct } = await import('@/services/api/adminCatalog.api');
      const result = await hideProduct('prod-1', 'admin-uuid', 'Razón del test');

      expect(result.success).toBe(true);
      expect(supabase.from).toHaveBeenCalledWith('products');
    });

    it('error: devuelve { success: false, error }', async () => {
      const mock = createChainableMock({ error: createMockError('Update failed') });
      const supabase = { from: vi.fn(() => mock) };
      vi.doMock('@/services/supabase.client', () => ({ supabase }));

      const { hideProduct } = await import('@/services/api/adminCatalog.api');
      const result = await hideProduct('prod-1', 'admin-uuid', 'Razón');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Error al procesar la solicitud');
    });
  });
});
