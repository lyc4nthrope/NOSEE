import { renderHook } from '@testing-library/react';
import useAdminConfirmHandlers from '../useAdminConfirmHandlers';
import { useAdminStore } from '../../store/adminStore';

describe('useAdminConfirmHandlers', () => {
  const td = {
    promptHideTitle: 'Moderar',
    promptHidePub: '¿Ocultar publicación?',
    promptHideOption1: 'Solo ocultar',
    promptHideOption2: 'Ocultar completamente',
    confirmHideTitle: 'Ocultar',
    confirmHideFull: '¿Eliminar completamente?',
    confirmHide: (name) => `¿Ocultar ${name}?`,
    confirmHideBrand: (name) => `¿Ocultar marca ${name}?`,
    errorNoBrand: 'Sin marca',
  };

  const mockExecuteDelete = vi.fn();
  const mockExecuteDeleteStore = vi.fn();
  const mockExecuteDeleteBrand = vi.fn();
  const mockExecuteDeleteProduct = vi.fn();

  const defaultProps = {
    publications: [
      { id: 'pub-1', is_active: true },
      { id: 'pub-2', is_active: false },
    ],
    td,
    executeDeletePublication: mockExecuteDelete,
    handleExecuteDeleteStore: mockExecuteDeleteStore,
    handleExecuteDeleteBrand: mockExecuteDeleteBrand,
    handleExecuteDeleteProduct: mockExecuteDeleteProduct,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    useAdminStore.setState(useAdminStore.getInitialState());
  });

  it('handleDeletePublication abre modal con acciones para publicación activa', () => {
    const { result } = renderHook(() => useAdminConfirmHandlers(defaultProps));

    result.current.handleDeletePublication({ id: 'pub-1', is_active: true });

    const modal = useAdminStore.getState().confirmModal;
    expect(modal.isOpen).toBe(true);
    expect(modal.title).toBe('Moderar');
    expect(modal.actions).toHaveLength(2);
    expect(modal.actions[0].label).toBe('Solo ocultar');
    expect(modal.actions[1].label).toBe('Ocultar completamente');
  });

  it('handleDeletePublication abre modal con onConfirm para publicación inactiva', () => {
    const { result } = renderHook(() => useAdminConfirmHandlers(defaultProps));

    result.current.handleDeletePublication({ id: 'pub-2', is_active: false });

    const modal = useAdminStore.getState().confirmModal;
    expect(modal.isOpen).toBe(true);
    expect(modal.onConfirm).toBeDefined();
    expect(modal.actions).toBeNull();
  });

  it('handleDeletePublication busca publicación por ID si recibe string', () => {
    const { result } = renderHook(() => useAdminConfirmHandlers(defaultProps));

    result.current.handleDeletePublication('pub-1');

    const modal = useAdminStore.getState().confirmModal;
    expect(modal.isOpen).toBe(true);
  });

  it('handleDeletePublication no hace nada si no hay ID', () => {
    const { result } = renderHook(() => useAdminConfirmHandlers(defaultProps));

    result.current.handleDeletePublication(null);

    expect(useAdminStore.getState().confirmModal.isOpen).toBe(false);
  });

  it('handleDeleteStore abre modal con onConfirm', () => {
    const { result } = renderHook(() => useAdminConfirmHandlers(defaultProps));
    const pub = { storeId: 'store-1', storeName: 'Tienda Test' };

    result.current.handleDeleteStore(pub);

    const modal = useAdminStore.getState().confirmModal;
    expect(modal.isOpen).toBe(true);
    expect(modal.title).toBe('Ocultar');
  });

  it('handleDeleteStore no hace si no hay storeId', () => {
    const { result } = renderHook(() => useAdminConfirmHandlers(defaultProps));

    result.current.handleDeleteStore({});

    expect(useAdminStore.getState().confirmModal.isOpen).toBe(false);
  });

  it('handleDeleteBrand abre modal con onConfirm', () => {
    const { result } = renderHook(() => useAdminConfirmHandlers(defaultProps));
    const pub = { brandId: 1, brandName: 'Nike' };

    result.current.handleDeleteBrand(pub);

    const modal = useAdminStore.getState().confirmModal;
    expect(modal.isOpen).toBe(true);
    expect(modal.title).toBe('Ocultar');
  });

  it('handleDeleteBrand no hace si no hay brandId', () => {
    const { result } = renderHook(() => useAdminConfirmHandlers(defaultProps));

    result.current.handleDeleteBrand({});

    expect(useAdminStore.getState().confirmModal.isOpen).toBe(false);
  });

  it('handleDeleteProduct abre modal con onConfirm', () => {
    const { result } = renderHook(() => useAdminConfirmHandlers(defaultProps));
    const product = { productId: 'prod-1', productName: 'Zapatos' };

    result.current.handleDeleteProduct(product);

    const modal = useAdminStore.getState().confirmModal;
    expect(modal.isOpen).toBe(true);
    expect(modal.title).toBe('Ocultar');
  });

  it('handleDeleteProduct no hace si no hay productId', () => {
    const { result } = renderHook(() => useAdminConfirmHandlers(defaultProps));

    result.current.handleDeleteProduct({});

    expect(useAdminStore.getState().confirmModal.isOpen).toBe(false);
  });
});
