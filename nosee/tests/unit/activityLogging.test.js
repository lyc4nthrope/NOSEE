/**
 * tests/unit/activityLogging.test.js
 *
 * Tests unitarios que verifican que `insertUserActivityLog` se llama
 * correctamente en cada punto de la aplicación donde se registra actividad
 * de usuario.
 *
 * Secciones:
 *  1. usePublicationCreation — crear_publicacion / editar_publicacion
 *  2. useStoreCreation       — crear_tienda / editar_tienda
 *  3. shoppingListStore      — agregar_item_lista / eliminar_item_lista
 *  4. alerts.api             — crear_alerta / eliminar_alerta
 *  5. Normalización de filas de log (lógica pura del AdminDashboard)
 *
 * Ejecutar: npm test -- activityLogging.test.js
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// ═══════════════════════════════════════════════════════════════════════════════
// SECCIÓN 1 — usePublicationCreation
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Mocks de módulos para usePublicationCreation ────────────────────────────

vi.mock('@/services/api/audit.api', () => ({
  insertUserActivityLog: vi.fn(),
}));

vi.mock('@/services/api/publications.api', () => ({
  createPublication:     vi.fn(),
  updatePublication:     vi.fn(),
  getPublicationDetail:  vi.fn(),
}));

vi.mock('@/features/auth/store/authStore', () => ({
  useAuthStore: vi.fn((selector) => selector({ user: { id: 'user-test-123' } })),
}));

vi.mock('@/features/publications/hooks/useGeoLocation', () => ({
  useGeoLocation: vi.fn(() => ({ latitude: 4.711, longitude: -74.072 })),
}));

vi.mock('@/services/cloudinary', () => ({
  uploadImageToCloudinary: vi.fn(),
}));

vi.mock('@/utils/celebrationSound', () => ({
  playSuccessSound: vi.fn(),
}));

// ─── Mocks de módulos para useStoreCreation ──────────────────────────────────

vi.mock('@/services/api/stores.api', () => ({
  createStore:              vi.fn(),
  updateStore:              vi.fn(),
  getStore:                 vi.fn(),
  searchNearbyStores:       vi.fn(),
  detectMapPlaceAtLocation: vi.fn(),
  findNearestPhysicalStore: vi.fn(),
  uploadStoreEvidence:      vi.fn(),
}));

vi.mock('@/features/stores/schemas', async (importOriginal) => {
  const real = await importOriginal();
  return {
    ...real,
    validateStoreForm: vi.fn(() => ({ isValid: true, errors: {} })),
  };
});

// ─── Importaciones DESPUÉS de los mocks ──────────────────────────────────────

import { insertUserActivityLog } from '@/services/api/audit.api';
import * as publicationsApi from '@/services/api/publications.api';
import * as storesApi from '@/services/api/stores.api';
import { validateStoreForm } from '@/features/stores/schemas';
import { usePublicationCreation } from '../../src/features/publications/hooks/usePublicationCreation.js';
import { useStoreCreation }        from '../../src/features/stores/hooks/useStoreCreation.js';

// ─── Helper: formData válido para publicación ─────────────────────────────────
function validPublicationForm() {
  return {
    productId:       '42',
    storeId:         'store-uuid-abc',
    price:           '5000',
    currency:        'COP',
    description:     'Test',
    photoUrl:        'https://example.com/photo.jpg',
    photoModeration: null,
  };
}

// ─── Helper: setear formData sin disparar validación interna ─────────────────
// Usa el método updateField del hook para setear todos los campos válidos.
async function fillPublicationForm(result) {
  const fields = validPublicationForm();
  for (const [key, value] of Object.entries(fields)) {
    act(() => result.current.updateField(key, value));
  }
}

// ─── Helper: formData válido para tienda virtual ──────────────────────────────
// Usamos tipo VIRTUAL para evitar validaciones de coordenadas y evidencias.
function validStoreFormVirtual() {
  return {
    name:           'Mi Tienda Test',
    type:           '2',           // StoreTypeEnum.VIRTUAL
    address:        '',
    latitude:       null,
    longitude:      null,
    websiteUrl:     'https://tienda.com',
    evidenceFiles:  [],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
describe('usePublicationCreation — insertUserActivityLog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Por defecto, createPublication y updatePublication retornan éxito
    publicationsApi.createPublication.mockResolvedValue({
      success: true,
      data: { id: 'pub-id-999', price: 5000 },
    });
    publicationsApi.updatePublication.mockResolvedValue({
      success: true,
      data: { id: 'pub-id-999', price: 5000 },
    });
    publicationsApi.getPublicationDetail.mockResolvedValue({
      success: true,
      data: {
        productId: '42',
        storeId:   'store-uuid-abc',
        price:     5000,
        currency:  'COP',
        description: '',
        photoUrl:  'https://example.com/old.jpg',
      },
    });
  });

  // ── 1.1 Modo create: llama con 'crear_publicacion' cuando hay éxito ─────────
  it('llama insertUserActivityLog con crear_publicacion al crear exitosamente', async () => {
    const { result } = renderHook(() => usePublicationCreation({ mode: 'create' }));
    await fillPublicationForm(result);

    await act(async () => {
      await result.current.submit();
    });

    expect(insertUserActivityLog).toHaveBeenCalledTimes(1);
    expect(insertUserActivityLog).toHaveBeenCalledWith(
      'user-test-123',
      'crear_publicacion',
      expect.objectContaining({
        publicationId: 'pub-id-999',
        productId:     42,
        storeId:       'store-uuid-abc',
      })
    );
  });

  // ── 1.2 Modo edit: llama con 'editar_publicacion' cuando hay éxito ──────────
  it('llama insertUserActivityLog con editar_publicacion al editar exitosamente', async () => {
    const { result } = renderHook(() =>
      usePublicationCreation({ mode: 'edit', publicationId: 'pub-id-999' })
    );

    // Esperar a que se cargue la publicación (useEffect inicial)
    await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
    await fillPublicationForm(result);

    await act(async () => {
      await result.current.submit();
    });

    expect(insertUserActivityLog).toHaveBeenCalledTimes(1);
    expect(insertUserActivityLog).toHaveBeenCalledWith(
      'user-test-123',
      'editar_publicacion',
      expect.objectContaining({
        productId: 42,
        storeId:   'store-uuid-abc',
      })
    );
  });

  // ── 1.3 No llama si createPublication falla ──────────────────────────────────
  it('NO llama insertUserActivityLog si la creación falla', async () => {
    publicationsApi.createPublication.mockResolvedValueOnce({
      success: false,
      error:   'Error de servidor',
    });

    const { result } = renderHook(() => usePublicationCreation({ mode: 'create' }));
    await fillPublicationForm(result);

    await act(async () => {
      await result.current.submit();
    });

    expect(insertUserActivityLog).not.toHaveBeenCalled();
  });

  // ── 1.4 No llama si updatePublication falla ──────────────────────────────────
  it('NO llama insertUserActivityLog si la edición falla', async () => {
    publicationsApi.updatePublication.mockResolvedValueOnce({
      success: false,
      error:   'Error al actualizar',
    });

    const { result } = renderHook(() =>
      usePublicationCreation({ mode: 'edit', publicationId: 'pub-id-999' })
    );
    await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
    await fillPublicationForm(result);

    await act(async () => {
      await result.current.submit();
    });

    expect(insertUserActivityLog).not.toHaveBeenCalled();
  });

  // ── 1.5 No llama si la validación del formulario falla ───────────────────────
  it('NO llama insertUserActivityLog si el formulario es inválido', async () => {
    const { result } = renderHook(() => usePublicationCreation({ mode: 'create' }));
    // formData vacío — la validación fallará (productId, storeId, price, photoUrl)

    await act(async () => {
      await result.current.submit();
    });

    expect(insertUserActivityLog).not.toHaveBeenCalled();
    expect(publicationsApi.createPublication).not.toHaveBeenCalled();
  });

  // ── 1.6 El userId viene del authStore ────────────────────────────────────────
  it('pasa el userId del authStore como primer argumento', async () => {
    const { result } = renderHook(() => usePublicationCreation({ mode: 'create' }));
    await fillPublicationForm(result);

    await act(async () => {
      await result.current.submit();
    });

    expect(insertUserActivityLog.mock.calls[0][0]).toBe('user-test-123');
  });

  // ── 1.7 Details incluye productId numérico ───────────────────────────────────
  it('details de crear_publicacion incluye productId como número', async () => {
    const { result } = renderHook(() => usePublicationCreation({ mode: 'create' }));
    await fillPublicationForm(result);

    await act(async () => {
      await result.current.submit();
    });

    const [, , details] = insertUserActivityLog.mock.calls[0];
    expect(typeof details.productId).toBe('number');
    expect(details.productId).toBe(42);
  });

  // ── 1.8 Details de create contiene publicationId del resultado ───────────────
  it('details de crear_publicacion contiene el id de la publicación creada', async () => {
    publicationsApi.createPublication.mockResolvedValueOnce({
      success: true,
      data: { id: 'pub-nuevo-456' },
    });

    const { result } = renderHook(() => usePublicationCreation({ mode: 'create' }));
    await fillPublicationForm(result);

    await act(async () => {
      await result.current.submit();
    });

    const [, , details] = insertUserActivityLog.mock.calls[0];
    expect(details.publicationId).toBe('pub-nuevo-456');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SECCIÓN 2 — useStoreCreation
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Helper: llenar el formData de tienda vía updateField ────────────────────
async function fillStoreForm(result, overrides = {}) {
  const fields = { ...validStoreFormVirtual(), ...overrides };
  for (const [key, value] of Object.entries(fields)) {
    act(() => result.current.updateField(key, value));
  }
}

// ─────────────────────────────────────────────────────────────────────────────
describe('useStoreCreation — insertUserActivityLog', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // validateStoreForm retorna válido por defecto (mock global)
    validateStoreForm.mockReturnValue({ isValid: true, errors: {} });

    storesApi.createStore.mockResolvedValue({
      success: true,
      data: { store: { id: 'store-created-abc' }, id: 'store-created-abc' },
    });
    storesApi.updateStore.mockResolvedValue({
      success: true,
      data: { store: { id: 'store-existing-xyz' }, id: 'store-existing-xyz' },
    });
    storesApi.getStore.mockResolvedValue({
      success: true,
      data: {
        name:       'Tienda Existente',
        type:       2,
        address:    '',
        latitude:   null,
        longitude:  null,
        websiteUrl: 'https://existing.com',
      },
    });
    storesApi.searchNearbyStores.mockResolvedValue({ success: true, data: [] });
    storesApi.detectMapPlaceAtLocation.mockResolvedValue({ success: false });
    storesApi.findNearestPhysicalStore.mockResolvedValue({ success: false });
  });

  // ── 2.1 Modo create: llama con 'crear_tienda' cuando hay éxito ──────────────
  it('llama insertUserActivityLog con crear_tienda al crear exitosamente', async () => {
    const { result } = renderHook(() => useStoreCreation({ mode: 'create' }));
    await fillStoreForm(result);

    await act(async () => {
      await result.current.submit();
    });

    expect(insertUserActivityLog).toHaveBeenCalledTimes(1);
    expect(insertUserActivityLog).toHaveBeenCalledWith(
      'user-test-123',
      'crear_tienda',
      expect.objectContaining({
        storeId:   'store-created-abc',
        storeName: 'Mi Tienda Test',
      })
    );
  });

  // ── 2.2 Modo edit: llama con 'editar_tienda' cuando hay éxito ───────────────
  it('llama insertUserActivityLog con editar_tienda al editar exitosamente', async () => {
    const { result } = renderHook(() =>
      useStoreCreation({ mode: 'edit', storeId: 'store-existing-xyz' })
    );
    await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
    await fillStoreForm(result);

    await act(async () => {
      await result.current.submit();
    });

    expect(insertUserActivityLog).toHaveBeenCalledTimes(1);
    expect(insertUserActivityLog).toHaveBeenCalledWith(
      'user-test-123',
      'editar_tienda',
      expect.objectContaining({ storeName: 'Mi Tienda Test' })
    );
  });

  // ── 2.3 No llama si createStore falla ────────────────────────────────────────
  it('NO llama insertUserActivityLog si createStore falla', async () => {
    storesApi.createStore.mockResolvedValueOnce({
      success: false,
      error:   'No se pudo crear la tienda',
    });

    const { result } = renderHook(() => useStoreCreation({ mode: 'create' }));
    await fillStoreForm(result);

    await act(async () => {
      await result.current.submit();
    });

    expect(insertUserActivityLog).not.toHaveBeenCalled();
  });

  // ── 2.4 No llama si updateStore falla ────────────────────────────────────────
  it('NO llama insertUserActivityLog si updateStore falla', async () => {
    storesApi.updateStore.mockResolvedValueOnce({
      success: false,
      error:   'Error al actualizar',
    });

    const { result } = renderHook(() =>
      useStoreCreation({ mode: 'edit', storeId: 'store-existing-xyz' })
    );
    await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
    await fillStoreForm(result);

    await act(async () => {
      await result.current.submit();
    });

    expect(insertUserActivityLog).not.toHaveBeenCalled();
  });

  // ── 2.5 No llama si validateStoreForm retorna isValid: false ─────────────────
  it('NO llama insertUserActivityLog si la validación del formulario falla', async () => {
    validateStoreForm.mockReturnValueOnce({
      isValid: false,
      errors:  { name: 'El nombre es obligatorio' },
    });

    const { result } = renderHook(() => useStoreCreation({ mode: 'create' }));

    await act(async () => {
      await result.current.submit();
    });

    expect(insertUserActivityLog).not.toHaveBeenCalled();
    expect(storesApi.createStore).not.toHaveBeenCalled();
  });

  // ── 2.6 El storeName en details es el del formulario ────────────────────────
  it('details de crear_tienda incluye el storeName correcto del formulario', async () => {
    const { result } = renderHook(() => useStoreCreation({ mode: 'create' }));
    await fillStoreForm(result, { name: 'Librería del Bosque' });

    await act(async () => {
      await result.current.submit();
    });

    const [, , details] = insertUserActivityLog.mock.calls[0];
    expect(details.storeName).toBe('Librería del Bosque');
  });

  // ── 2.7 El userId del authStore se pasa correctamente ───────────────────────
  it('pasa el userId del authStore como primer argumento', async () => {
    const { result } = renderHook(() => useStoreCreation({ mode: 'create' }));
    await fillStoreForm(result);

    await act(async () => {
      await result.current.submit();
    });

    expect(insertUserActivityLog.mock.calls[0][0]).toBe('user-test-123');
  });

  // ── 2.8 No llama si checkNearbyDuplicates falla en modo create físico ────────
  it('NO llama insertUserActivityLog si hay duplicado cercano detectado', async () => {
    storesApi.searchNearbyStores.mockResolvedValueOnce({
      success: true,
      data:    [{ name: 'Mi Tienda Test', distanceMeters: 50 }],
    });

    // Tienda física con coordenadas para activar la verificación de duplicados
    const { result } = renderHook(() => useStoreCreation({ mode: 'create' }));
    await fillStoreForm(result, {
      type:      '1',  // StoreTypeEnum.PHYSICAL
      latitude:  4.711,
      longitude: -74.072,
      address:   'Calle 123',
    });

    await act(async () => {
      await result.current.submit();
    });

    expect(insertUserActivityLog).not.toHaveBeenCalled();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SECCIÓN 3 — shoppingListStore
// ═══════════════════════════════════════════════════════════════════════════════

// El store Zustand funciona sin React en tests. No necesita renderHook.
// Solo necesitamos mockear insertUserActivityLog (ya mockeado arriba en la
// sección de publicaciones y compartido en el mismo módulo).

import { useShoppingListStore } from '../../src/features/shopping-list/store/shoppingListStore.js';

// ─────────────────────────────────────────────────────────────────────────────
describe('shoppingListStore — insertUserActivityLog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    useShoppingListStore.setState({ _userId: null, items: [], orders: [] });
  });

  afterEach(() => {
    localStorage.clear();
    useShoppingListStore.setState({ _userId: null, items: [], orders: [] });
  });

  // ── 3.1 addItem con sesión activa llama con 'agregar_item_lista' ─────────────
  it('llama insertUserActivityLog con agregar_item_lista cuando _userId está seteado', () => {
    useShoppingListStore.getState().loadForUser('user-abc');
    useShoppingListStore.getState().addItem('Leche', 2);

    expect(insertUserActivityLog).toHaveBeenCalledTimes(1);
    expect(insertUserActivityLog).toHaveBeenCalledWith(
      'user-abc',
      'agregar_item_lista',
      { productName: 'Leche', quantity: 2 }
    );
  });

  // ── 3.2 addItem sin sesión NO llama ─────────────────────────────────────────
  it('NO llama insertUserActivityLog en addItem si _userId es null', () => {
    // _userId = null (sin loadForUser)
    useShoppingListStore.getState().addItem('Pan', 1);

    expect(insertUserActivityLog).not.toHaveBeenCalled();
  });

  // ── 3.3 removeItem con sesión activa llama con 'eliminar_item_lista' ─────────
  it('llama insertUserActivityLog con eliminar_item_lista cuando _userId está seteado', () => {
    useShoppingListStore.getState().loadForUser('user-abc');
    useShoppingListStore.getState().addItem('Arroz', 3);
    vi.clearAllMocks(); // limpiar la llamada de addItem

    const { items } = useShoppingListStore.getState();
    useShoppingListStore.getState().removeItem(items[0].id);

    expect(insertUserActivityLog).toHaveBeenCalledTimes(1);
    expect(insertUserActivityLog).toHaveBeenCalledWith(
      'user-abc',
      'eliminar_item_lista',
      { productName: 'Arroz' }
    );
  });

  // ── 3.4 removeItem sin sesión NO llama ──────────────────────────────────────
  it('NO llama insertUserActivityLog en removeItem si _userId es null', () => {
    // Insertar un ítem forzando estado sin userId
    useShoppingListStore.setState({
      _userId: null,
      items: [{ id: 100, productName: 'Queso', quantity: 1 }],
      orders: [],
    });
    vi.clearAllMocks();

    useShoppingListStore.getState().removeItem(100);

    expect(insertUserActivityLog).not.toHaveBeenCalled();
  });

  // ── 3.5 addItem pasa el trimmed productName ──────────────────────────────────
  it('pasa el productName recortado de espacios a insertUserActivityLog', () => {
    useShoppingListStore.getState().loadForUser('user-abc');
    useShoppingListStore.getState().addItem('  Mantequilla  ', 1);

    const [, , details] = insertUserActivityLog.mock.calls[0];
    expect(details.productName).toBe('Mantequilla');
  });

  // ── 3.6 addItem pasa quantity como número ────────────────────────────────────
  it('pasa quantity como número en los details', () => {
    useShoppingListStore.getState().loadForUser('user-abc');
    useShoppingListStore.getState().addItem('Yogur', '4'); // string '4'

    const [, , details] = insertUserActivityLog.mock.calls[0];
    expect(typeof details.quantity).toBe('number');
    expect(details.quantity).toBe(4);
  });

  // ── 3.7 addItem de ítem existente también llama (acumula cantidad) ───────────
  it('llama insertUserActivityLog incluso al acumular cantidad en ítem existente', () => {
    useShoppingListStore.getState().loadForUser('user-abc');
    useShoppingListStore.getState().addItem('Leche', 1);
    vi.clearAllMocks();

    useShoppingListStore.getState().addItem('Leche', 2); // acumula

    expect(insertUserActivityLog).toHaveBeenCalledTimes(1);
    expect(insertUserActivityLog).toHaveBeenCalledWith(
      'user-abc',
      'agregar_item_lista',
      { productName: 'Leche', quantity: 2 }
    );
  });

  // ── 3.8 addItem con nombre vacío NO llama (item ignorado) ───────────────────
  it('NO llama insertUserActivityLog si productName está vacío', () => {
    useShoppingListStore.getState().loadForUser('user-abc');
    useShoppingListStore.getState().addItem('   ');

    expect(insertUserActivityLog).not.toHaveBeenCalled();
  });

  // ── 3.9 removeItem de id inexistente NO llama (item no encontrado) ────────────
  it('NO llama insertUserActivityLog en removeItem si el id no existe', () => {
    useShoppingListStore.getState().loadForUser('user-abc');
    // No hay ítems, intentar remover un id inexistente
    useShoppingListStore.getState().removeItem(99999);

    // insertUserActivityLog tiene condición: `if (uid && item)` — item es undefined
    expect(insertUserActivityLog).not.toHaveBeenCalled();
  });

  // ── 3.10 El userId pasa correctamente según el usuario cargado ───────────────
  it('usa el _userId del store en todos los calls', () => {
    useShoppingListStore.getState().loadForUser('usuario-xyz');
    useShoppingListStore.getState().addItem('Cereal', 1);

    expect(insertUserActivityLog.mock.calls[0][0]).toBe('usuario-xyz');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SECCIÓN 4 — alerts.api
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Mock de Supabase con vi.hoisted (patrón establecido en el proyecto) ──────

const {
  mockAuthGetUser,
  mockFrom,
  mockInsert,
  mockSelect,
  mockSingle,
  mockUpdate,
  mockEq,
} = vi.hoisted(() => {
  const mockSingle = vi.fn();
  const mockEq     = vi.fn();
  const mockSelect = vi.fn();
  const mockInsert = vi.fn();
  const mockUpdate = vi.fn();

  // Cadena de métodos del builder Supabase
  const chainMock = {
    insert: mockInsert,
    select: mockSelect,
    single: mockSingle,
    update: mockUpdate,
    eq:     mockEq,
  };

  mockInsert.mockReturnValue(chainMock);
  mockSelect.mockReturnValue(chainMock);
  mockSingle.mockReturnValue(chainMock);
  mockUpdate.mockReturnValue(chainMock);
  mockEq.mockReturnValue(chainMock);

  const mockFrom = vi.fn().mockReturnValue(chainMock);

  const mockAuthGetUser = vi.fn();

  return {
    mockAuthGetUser,
    mockFrom,
    mockInsert,
    mockSelect,
    mockSingle,
    mockUpdate,
    mockEq,
  };
});

vi.mock('@/services/supabase.client', () => ({
  supabase: {
    from: mockFrom,
    auth: {
      getUser: mockAuthGetUser,
    },
  },
}));

// ─── Importar DESPUÉS del mock de supabase ────────────────────────────────────

import { createAlert, deleteAlert } from '../../src/services/api/alerts.api.js';

// ─── Helper: resetear la cadena de mocks ─────────────────────────────────────
function resetAlertChain() {
  mockFrom.mockClear();
  mockInsert.mockClear();
  mockSelect.mockClear();
  mockSingle.mockClear();
  mockUpdate.mockClear();
  mockEq.mockClear();
  insertUserActivityLog.mockClear();

  const chainMock = {
    insert: mockInsert,
    select: mockSelect,
    single: mockSingle,
    update: mockUpdate,
    eq:     mockEq,
  };

  mockInsert.mockReturnValue(chainMock);
  mockSelect.mockReturnValue(chainMock);
  mockSingle.mockReturnValue(chainMock);
  mockUpdate.mockReturnValue(chainMock);
  mockEq.mockReturnValue(chainMock);

  mockFrom.mockReturnValue(chainMock);
}

// ─────────────────────────────────────────────────────────────────────────────
describe('alerts.api — createAlert', () => {
  beforeEach(() => {
    resetAlertChain();
    // Por defecto: usuario autenticado
    mockAuthGetUser.mockResolvedValue({
      data: { user: { id: 'user-alerts-123' } },
      error: null,
    });
    // Por defecto: inserción exitosa
    mockSingle.mockResolvedValue({
      data:  { id: 'alert-new-id', target_price: 10000, is_active: true },
      error: null,
    });
  });

  // ── 4.1 Llama con 'crear_alerta' al crear exitosamente ───────────────────────
  it('llama insertUserActivityLog con crear_alerta al crear exitosamente', async () => {
    await createAlert({ productId: 99, targetPrice: 10000 });

    expect(insertUserActivityLog).toHaveBeenCalledTimes(1);
    expect(insertUserActivityLog).toHaveBeenCalledWith(
      'user-alerts-123',
      'crear_alerta',
      { productId: 99, targetPrice: 10000 }
    );
  });

  // ── 4.2 Pasa productId y targetPrice en details ──────────────────────────────
  it('details de crear_alerta contiene productId y targetPrice correctos', async () => {
    await createAlert({ productId: 55, targetPrice: 25000 });

    const [, , details] = insertUserActivityLog.mock.calls[0];
    expect(details.productId).toBe(55);
    expect(details.targetPrice).toBe(25000);
  });

  // ── 4.3 No llama si getUser no devuelve usuario ──────────────────────────────
  it('NO llama insertUserActivityLog si el usuario no está autenticado', async () => {
    mockAuthGetUser.mockResolvedValueOnce({
      data: { user: null },
      error: null,
    });

    await createAlert({ productId: 1, targetPrice: 5000 });

    expect(insertUserActivityLog).not.toHaveBeenCalled();
  });

  // ── 4.4 No llama si la inserción en supabase falla ───────────────────────────
  it('NO llama insertUserActivityLog si supabase.insert devuelve error', async () => {
    mockSingle.mockResolvedValueOnce({
      data:  null,
      error: { message: 'insert failed' },
    });

    await createAlert({ productId: 1, targetPrice: 5000 });

    expect(insertUserActivityLog).not.toHaveBeenCalled();
  });

  // ── 4.5 Retorna success: true cuando todo va bien ────────────────────────────
  it('retorna success: true cuando la creación es exitosa', async () => {
    const result = await createAlert({ productId: 10, targetPrice: 8000 });

    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
  });

  // ── 4.6 Retorna success: false cuando el usuario no está autenticado ──────────
  it('retorna success: false y no llama al log si no hay usuario', async () => {
    mockAuthGetUser.mockResolvedValueOnce({
      data: { user: null },
      error: null,
    });

    const result = await createAlert({ productId: 1, targetPrice: 5000 });

    expect(result.success).toBe(false);
    expect(result.error).toBe('No autenticado');
    expect(insertUserActivityLog).not.toHaveBeenCalled();
  });

  // ── 4.7 Usa el user.id retornado por getUser como primer argumento ───────────
  it('usa el user.id de getUser como primer argumento del log', async () => {
    mockAuthGetUser.mockResolvedValueOnce({
      data: { user: { id: 'otro-user-xyz' } },
      error: null,
    });

    await createAlert({ productId: 7, targetPrice: 3000 });

    expect(insertUserActivityLog.mock.calls[0][0]).toBe('otro-user-xyz');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('alerts.api — deleteAlert', () => {
  beforeEach(() => {
    resetAlertChain();
    // Por defecto: usuario autenticado
    mockAuthGetUser.mockResolvedValue({
      data: { user: { id: 'user-alerts-123' } },
      error: null,
    });
    // Por defecto: update exitoso (is_active = false)
    mockEq.mockResolvedValue({ error: null });
  });

  // ── 4.8 Llama con 'eliminar_alerta' al desactivar exitosamente ───────────────
  it('llama insertUserActivityLog con eliminar_alerta al desactivar exitosamente', async () => {
    await deleteAlert('alert-id-abc');

    expect(insertUserActivityLog).toHaveBeenCalledTimes(1);
    expect(insertUserActivityLog).toHaveBeenCalledWith(
      'user-alerts-123',
      'eliminar_alerta',
      { alertId: 'alert-id-abc' }
    );
  });

  // ── 4.9 Details contiene el alertId correcto ─────────────────────────────────
  it('details de eliminar_alerta contiene el alertId correcto', async () => {
    await deleteAlert('alert-xyz-999');

    const [, , details] = insertUserActivityLog.mock.calls[0];
    expect(details.alertId).toBe('alert-xyz-999');
  });

  // ── 4.10 No llama si el update en supabase falla ────────────────────────────
  it('NO llama insertUserActivityLog si supabase.update devuelve error', async () => {
    mockEq.mockResolvedValueOnce({ error: { message: 'update failed' } });

    await deleteAlert('alert-id-fail');

    expect(insertUserActivityLog).not.toHaveBeenCalled();
  });

  // ── 4.11 No llama si getUser devuelve user: null ────────────────────────────
  it('NO llama insertUserActivityLog si getUser devuelve user: null', async () => {
    mockAuthGetUser.mockResolvedValueOnce({
      data: { user: null },
      error: null,
    });
    // El update devuelve sin error (deleteAlert no requiere user para el update)
    mockEq.mockResolvedValueOnce({ error: null });

    await deleteAlert('alert-id-nouser');

    // La condición es `if (user) insertUserActivityLog(...)` — sin user no llama
    expect(insertUserActivityLog).not.toHaveBeenCalled();
  });

  // ── 4.12 Retorna success: true cuando la eliminación es exitosa ─────────────
  it('retorna success: true cuando la desactivación es exitosa', async () => {
    const result = await deleteAlert('alert-id-ok');

    expect(result.success).toBe(true);
  });

  // ── 4.13 Retorna success: false cuando el update falla ──────────────────────
  it('retorna success: false cuando el update en supabase falla', async () => {
    mockEq.mockResolvedValueOnce({ error: { message: 'RLS denied' } });

    const result = await deleteAlert('alert-id-fail');

    expect(result.success).toBe(false);
    expect(result.error).toBe('RLS denied');
  });

  // ── 4.14 Usa el user.id de getUser como primer argumento ─────────────────────
  it('usa el user.id correcto como primer argumento del log en deleteAlert', async () => {
    mockAuthGetUser.mockResolvedValueOnce({
      data: { user: { id: 'delete-user-456' } },
      error: null,
    });

    await deleteAlert('alert-id-test');

    expect(insertUserActivityLog.mock.calls[0][0]).toBe('delete-user-456');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SECCIÓN 5 — Normalización de filas de log (lógica pura del AdminDashboard)
// ═══════════════════════════════════════════════════════════════════════════════
//
// La lógica de combinar los 3 sources de logs (loginLogs, activityLogs,
// actionLogs) vive inline en AdminDashboard. La extraemos como funciones puras
// aquí para testearla sin React ni mocks. Los tests verifican prefijos de id,
// asignación de source, composición de details y ordenamiento por fecha.
// ─────────────────────────────────────────────────────────────────────────────

/** Transforma un loginLog al formato unificado de fila. */
function normalizeLoginLog(l) {
  return {
    id:         `l-${l.id}`,
    created_at: l.created_at,
    userId:     l.user_id,
    type:       l.event_type,
    details:    {},
    ip:         l.ip_address,
    ua:         l.user_agent,
    source:     'session',
  };
}

/** Transforma un activityLog al formato unificado de fila. */
function normalizeActivityLog(a) {
  return {
    id:         `a-${a.id}`,
    created_at: a.created_at,
    userId:     a.user_id,
    type:       a.action,
    details:    a.details || {},
    ip:         null,
    ua:         null,
    source:     'activity',
  };
}

/** Transforma un adminActionLog al formato unificado de fila. */
function normalizeAdminLog(log) {
  return {
    id:         `ad-${log.id}`,
    created_at: log.created_at,
    userId:     log.actor_user_id,
    type:       log.action_type,
    details: {
      resource_id:   log.resource_id,
      resource_type: log.resource_type,
      ...(log.metadata || {}),
    },
    ip:     null,
    ua:     null,
    reason: log.reason,
  };
}

/**
 * Combina loginLogs y activityLogs en allRows, ordenados por fecha descendente.
 * (Equivalente a la construcción de `allRows` en AdminDashboard.)
 */
function buildAllRows(loginLogs, activityLogs) {
  return [
    ...loginLogs.map(normalizeLoginLog),
    ...activityLogs.map(normalizeActivityLog),
  ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}

// ─────────────────────────────────────────────────────────────────────────────
describe('normalizeLoginLog', () => {
  const loginLog = {
    id:         'login-id-1',
    user_id:    'user-uuid',
    event_type: 'login',
    ip_address: '192.168.1.1',
    user_agent: 'Mozilla/5.0 Chrome/120',
    created_at: '2026-03-10T10:00:00Z',
  };

  it('asigna prefix l- al id', () => {
    expect(normalizeLoginLog(loginLog).id).toBe('l-login-id-1');
  });

  it('asigna source = session', () => {
    expect(normalizeLoginLog(loginLog).source).toBe('session');
  });

  it('mapea user_id a userId', () => {
    expect(normalizeLoginLog(loginLog).userId).toBe('user-uuid');
  });

  it('mapea event_type a type', () => {
    expect(normalizeLoginLog(loginLog).type).toBe('login');
  });

  it('details es siempre objeto vacío', () => {
    expect(normalizeLoginLog(loginLog).details).toEqual({});
  });

  it('conserva ip y ua del log original', () => {
    const row = normalizeLoginLog(loginLog);
    expect(row.ip).toBe('192.168.1.1');
    expect(row.ua).toBe('Mozilla/5.0 Chrome/120');
  });

  it('preserva created_at sin modificación', () => {
    expect(normalizeLoginLog(loginLog).created_at).toBe('2026-03-10T10:00:00Z');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('normalizeActivityLog', () => {
  const activityLog = {
    id:         'act-id-42',
    user_id:    'user-act',
    action:     'crear_publicacion',
    details:    { publicationId: 'pub-001', productId: 10, storeId: 'store-abc' },
    created_at: '2026-03-11T12:00:00Z',
  };

  it('asigna prefix a- al id', () => {
    expect(normalizeActivityLog(activityLog).id).toBe('a-act-id-42');
  });

  it('asigna source = activity', () => {
    expect(normalizeActivityLog(activityLog).source).toBe('activity');
  });

  it('mapea user_id a userId', () => {
    expect(normalizeActivityLog(activityLog).userId).toBe('user-act');
  });

  it('mapea action a type', () => {
    expect(normalizeActivityLog(activityLog).type).toBe('crear_publicacion');
  });

  it('conserva details tal como vienen del log', () => {
    const row = normalizeActivityLog(activityLog);
    expect(row.details).toEqual({ publicationId: 'pub-001', productId: 10, storeId: 'store-abc' });
  });

  it('asigna details = {} cuando el log no tiene details', () => {
    const logSinDetails = { ...activityLog, details: null };
    expect(normalizeActivityLog(logSinDetails).details).toEqual({});
  });

  it('ip y ua son siempre null', () => {
    const row = normalizeActivityLog(activityLog);
    expect(row.ip).toBeNull();
    expect(row.ua).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('normalizeAdminLog', () => {
  const adminLog = {
    id:             'admin-log-7',
    actor_user_id:  'mod-user-id',
    action_type:    'hide',
    resource_id:    '123',
    resource_type:  'publication',
    metadata:       { storeName: 'Tienda Ejemplo', extra: true },
    reason:         'spam',
    created_at:     '2026-03-12T08:00:00Z',
  };

  it('asigna prefix ad- al id', () => {
    expect(normalizeAdminLog(adminLog).id).toBe('ad-admin-log-7');
  });

  it('mapea actor_user_id a userId', () => {
    expect(normalizeAdminLog(adminLog).userId).toBe('mod-user-id');
  });

  it('mapea action_type a type', () => {
    expect(normalizeAdminLog(adminLog).type).toBe('hide');
  });

  it('details incluye resource_id', () => {
    expect(normalizeAdminLog(adminLog).details.resource_id).toBe('123');
  });

  it('details incluye resource_type', () => {
    expect(normalizeAdminLog(adminLog).details.resource_type).toBe('publication');
  });

  it('details incluye campos de metadata (spread)', () => {
    const row = normalizeAdminLog(adminLog);
    expect(row.details.storeName).toBe('Tienda Ejemplo');
    expect(row.details.extra).toBe(true);
  });

  it('details sin metadata devuelve solo resource_id y resource_type', () => {
    const logSinMeta = { ...adminLog, metadata: null };
    const row = normalizeAdminLog(logSinMeta);
    expect(row.details).toEqual({
      resource_id:   '123',
      resource_type: 'publication',
    });
  });

  it('conserva reason del log original', () => {
    expect(normalizeAdminLog(adminLog).reason).toBe('spam');
  });

  it('ip y ua son siempre null', () => {
    const row = normalizeAdminLog(adminLog);
    expect(row.ip).toBeNull();
    expect(row.ua).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('buildAllRows — ordenamiento y combinación', () => {
  // Fixture: 3 loginLogs y 2 activityLogs con fechas entremezcladas
  const loginLogs = [
    { id: 'l1', user_id: 'u1', event_type: 'login',  ip_address: '1.1.1.1', user_agent: 'Chrome', created_at: '2026-03-15T10:00:00Z' },
    { id: 'l2', user_id: 'u2', event_type: 'logout', ip_address: '2.2.2.2', user_agent: 'Firefox', created_at: '2026-03-13T08:00:00Z' },
    { id: 'l3', user_id: 'u3', event_type: 'login',  ip_address: '3.3.3.3', user_agent: 'Edge', created_at: '2026-03-11T06:00:00Z' },
  ];

  const activityLogs = [
    { id: 'a1', user_id: 'u4', action: 'crear_publicacion', details: { publicationId: 'p1' }, created_at: '2026-03-14T09:00:00Z' },
    { id: 'a2', user_id: 'u5', action: 'crear_tienda',      details: { storeName: 'X' },      created_at: '2026-03-12T07:00:00Z' },
  ];

  it('combina todos los logs de ambos sources en una sola lista', () => {
    const rows = buildAllRows(loginLogs, activityLogs);
    expect(rows).toHaveLength(5);
  });

  it('ordena por created_at descendente (más reciente primero)', () => {
    const rows = buildAllRows(loginLogs, activityLogs);
    // Esperado: l1 > a1 > l2 > a2 > l3
    expect(rows[0].id).toBe('l-l1'); // 2026-03-15
    expect(rows[1].id).toBe('a-a1'); // 2026-03-14
    expect(rows[2].id).toBe('l-l2'); // 2026-03-13
    expect(rows[3].id).toBe('a-a2'); // 2026-03-12
    expect(rows[4].id).toBe('l-l3'); // 2026-03-11
  });

  it('los loginLogs tienen source = session', () => {
    const rows = buildAllRows(loginLogs, []);
    rows.forEach((row) => expect(row.source).toBe('session'));
  });

  it('los activityLogs tienen source = activity', () => {
    const rows = buildAllRows([], activityLogs);
    rows.forEach((row) => expect(row.source).toBe('activity'));
  });

  it('con listas vacías retorna array vacío', () => {
    expect(buildAllRows([], [])).toEqual([]);
  });

  it('un solo loginLog se devuelve correctamente sin ordenamiento extra', () => {
    const rows = buildAllRows([loginLogs[0]], []);
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe('l-l1');
    expect(rows[0].source).toBe('session');
  });

  it('los prefijos de id corresponden al tipo de log', () => {
    const rows = buildAllRows(loginLogs, activityLogs);
    const loginRows    = rows.filter((r) => r.source === 'session');
    const activityRows = rows.filter((r) => r.source === 'activity');

    loginRows.forEach((r) => expect(r.id).toMatch(/^l-/));
    activityRows.forEach((r) => expect(r.id).toMatch(/^a-/));
  });

  it('los adminRows tienen prefix ad- (normalizeAdminLog independiente)', () => {
    const actionLogs = [
      {
        id:            'admin-1',
        actor_user_id: 'mod-1',
        action_type:   'ban_user',
        resource_id:   'user-x',
        resource_type: 'user',
        metadata:      { userName: 'Pepito' },
        reason:        'violaciones repetidas',
        created_at:    '2026-03-15T12:00:00Z',
      },
    ];
    const adminRows = actionLogs.map(normalizeAdminLog);
    expect(adminRows[0].id).toBe('ad-admin-1');
    expect(adminRows[0].details.resource_id).toBe('user-x');
    expect(adminRows[0].details.resource_type).toBe('user');
    expect(adminRows[0].details.userName).toBe('Pepito');
  });

  it('no hay conflictos de id entre los tres tipos de log con el mismo id numérico', () => {
    const ll = [{ id: '1', user_id: 'u', event_type: 'login', ip_address: null, user_agent: null, created_at: '2026-01-03T00:00:00Z' }];
    const al = [{ id: '1', user_id: 'u', action: 'crear_tienda', details: {}, created_at: '2026-01-02T00:00:00Z' }];
    const adm = [{ id: '1', actor_user_id: 'u', action_type: 'hide', resource_id: 'r', resource_type: 'pub', metadata: {}, reason: null, created_at: '2026-01-01T00:00:00Z' }];

    const rows = [
      ...ll.map(normalizeLoginLog),
      ...al.map(normalizeActivityLog),
      ...adm.map(normalizeAdminLog),
    ];

    const ids = rows.map((r) => r.id);
    expect(ids).toEqual(['l-1', 'a-1', 'ad-1']);
    // Todos distintos
    expect(new Set(ids).size).toBe(3);
  });
});
