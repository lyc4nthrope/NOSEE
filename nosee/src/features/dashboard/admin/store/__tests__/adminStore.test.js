import { describe, it, expect, beforeEach } from 'vitest';
import { useAdminStore, selectActiveSection, selectSidebarCollapsed, selectConfirmModal, selectBanModal, selectSelectedPublication, selectSelectedStore, selectSelectedBrand, selectSelectedProduct, selectSelectedReport } from '../adminStore';

function createMockState(overrides = {}) {
  return {
    activeSection: 'overview',
    sidebarCollapsed: false,
    confirmModal: { isOpen: false, title: '', message: '', onConfirm: null, actions: null },
    banModal: null,
    selectedPub: null,
    selectedStore: null,
    selectedBrand: null,
    selectedProduct: null,
    selectedReport: null,
    ...overrides,
  };
}

describe('adminStore — actions', () => {
  beforeEach(() => {
    useAdminStore.setState(useAdminStore.getInitialState());
  });

  it('setActiveSection updates section and resets all modals and selected entities', () => {
    useAdminStore.setState({
      activeSection: 'users',
      confirmModal: { isOpen: true, title: 'Delete?', message: 'Sure?', onConfirm: () => {}, actions: null },
      banModal: { id: 1, name: 'Test User' },
      selectedPub: { id: 'pub-1' },
      selectedStore: { id: 'store-1' },
      selectedBrand: { id: 'brand-1' },
      selectedProduct: { id: 'prod-1' },
      selectedReport: { id: 'rep-1' },
    });

    useAdminStore.getState().setActiveSection('publications');

    const state = useAdminStore.getState();
    expect(state.activeSection).toBe('publications');
    expect(state.confirmModal).toEqual({ isOpen: false, title: '', message: '', onConfirm: null, actions: null });
    expect(state.banModal).toBeNull();
    expect(state.selectedPub).toBeNull();
    expect(state.selectedStore).toBeNull();
    expect(state.selectedBrand).toBeNull();
    expect(state.selectedProduct).toBeNull();
    expect(state.selectedReport).toBeNull();
  });

  it('toggleSidebar flips sidebarCollapsed from false to true', () => {
    useAdminStore.setState({ sidebarCollapsed: false });
    useAdminStore.getState().toggleSidebar();
    expect(useAdminStore.getState().sidebarCollapsed).toBe(true);
  });

  it('toggleSidebar flips sidebarCollapsed from true to false', () => {
    useAdminStore.setState({ sidebarCollapsed: true });
    useAdminStore.getState().toggleSidebar();
    expect(useAdminStore.getState().sidebarCollapsed).toBe(false);
  });

  it('setSidebarCollapsed sets the value directly', () => {
    useAdminStore.getState().setSidebarCollapsed(true);
    expect(useAdminStore.getState().sidebarCollapsed).toBe(true);

    useAdminStore.getState().setSidebarCollapsed(false);
    expect(useAdminStore.getState().sidebarCollapsed).toBe(false);
  });

  it('openConfirmModal merges config onto defaults and sets isOpen true', () => {
    const onConfirm = () => {};
    useAdminStore.getState().openConfirmModal({
      title: 'Confirmar',
      message: '¿Estás seguro?',
      onConfirm,
    });

    const modal = useAdminStore.getState().confirmModal;
    expect(modal.isOpen).toBe(true);
    expect(modal.title).toBe('Confirmar');
    expect(modal.message).toBe('¿Estás seguro?');
    expect(modal.onConfirm).toBe(onConfirm);
    expect(modal.actions).toBeNull();
  });

  it('openConfirmModal preserves defaults for missing fields', () => {
    useAdminStore.getState().openConfirmModal({ title: 'Solo título' });

    const modal = useAdminStore.getState().confirmModal;
    expect(modal.isOpen).toBe(true);
    expect(modal.title).toBe('Solo título');
    expect(modal.message).toBe('');
    expect(modal.onConfirm).toBeNull();
    expect(modal.actions).toBeNull();
  });

  it('closeConfirmModal resets confirmModal to defaults', () => {
    useAdminStore.setState({
      confirmModal: { isOpen: true, title: 'Delete', message: 'Sure', onConfirm: () => {}, actions: null },
    });

    useAdminStore.getState().closeConfirmModal();

    expect(useAdminStore.getState().confirmModal).toEqual({
      isOpen: false, title: '', message: '', onConfirm: null, actions: null,
    });
  });

  it('setBanModal sets a user object', () => {
    const user = { id: 1, name: 'Usuario Problemático' };
    useAdminStore.getState().setBanModal(user);
    expect(useAdminStore.getState().banModal).toEqual(user);
  });

  it('setBanModal(null) clears banModal', () => {
    useAdminStore.setState({ banModal: { id: 1, name: 'Test' } });
    useAdminStore.getState().setBanModal(null);
    expect(useAdminStore.getState().banModal).toBeNull();
  });

  it('selectPublication sets and clears selectedPub', () => {
    const pub = { id: 'pub-1', name: 'Test Publication' };
    useAdminStore.getState().selectPublication(pub);
    expect(useAdminStore.getState().selectedPub).toEqual(pub);

    useAdminStore.getState().selectPublication(null);
    expect(useAdminStore.getState().selectedPub).toBeNull();
  });

  it('selectStore sets and clears selectedStore', () => {
    const store = { id: 'store-1' };
    useAdminStore.getState().selectStore(store);
    expect(useAdminStore.getState().selectedStore).toEqual(store);

    useAdminStore.getState().selectStore(null);
    expect(useAdminStore.getState().selectedStore).toBeNull();
  });

  it('selectBrand sets and clears selectedBrand', () => {
    const brand = { id: 'brand-1' };
    useAdminStore.getState().selectBrand(brand);
    expect(useAdminStore.getState().selectedBrand).toEqual(brand);

    useAdminStore.getState().selectBrand(null);
    expect(useAdminStore.getState().selectedBrand).toBeNull();
  });

  it('selectProduct sets and clears selectedProduct', () => {
    const product = { id: 'prod-1' };
    useAdminStore.getState().selectProduct(product);
    expect(useAdminStore.getState().selectedProduct).toEqual(product);

    useAdminStore.getState().selectProduct(null);
    expect(useAdminStore.getState().selectedProduct).toBeNull();
  });

  it('selectReport sets and clears selectedReport', () => {
    const report = { id: 'rep-1' };
    useAdminStore.getState().selectReport(report);
    expect(useAdminStore.getState().selectedReport).toEqual(report);

    useAdminStore.getState().selectReport(null);
    expect(useAdminStore.getState().selectedReport).toBeNull();
  });
});

describe('adminStore — selectors', () => {
  it('selectActiveSection returns activeSection', () => {
    expect(selectActiveSection(createMockState({ activeSection: 'users' }))).toBe('users');
  });

  it('selectActiveSection returns undefined for missing key', () => {
    expect(selectActiveSection({})).toBeUndefined();
  });

  it('selectSidebarCollapsed returns sidebarCollapsed', () => {
    expect(selectSidebarCollapsed(createMockState({ sidebarCollapsed: true }))).toBe(true);
  });

  it('selectSidebarCollapsed returns undefined for missing key', () => {
    expect(selectSidebarCollapsed({})).toBeUndefined();
  });

  it('selectConfirmModal returns confirmModal', () => {
    const modal = { isOpen: true, title: 'Test', message: '', onConfirm: null, actions: null };
    expect(selectConfirmModal(createMockState({ confirmModal: modal }))).toEqual(modal);
  });

  it('selectConfirmModal returns undefined for missing key', () => {
    expect(selectConfirmModal({})).toBeUndefined();
  });

  it('selectBanModal returns banModal', () => {
    const user = { id: 1 };
    expect(selectBanModal(createMockState({ banModal: user }))).toEqual(user);
  });

  it('selectBanModal returns undefined for missing key', () => {
    expect(selectBanModal({})).toBeUndefined();
  });

  it('selectSelectedPublication returns selectedPub', () => {
    expect(selectSelectedPublication(createMockState({ selectedPub: 'pub-1' }))).toBe('pub-1');
  });

  it('selectSelectedPublication returns undefined for missing key', () => {
    expect(selectSelectedPublication({})).toBeUndefined();
  });

  it('selectSelectedStore returns selectedStore', () => {
    expect(selectSelectedStore(createMockState({ selectedStore: 'store-1' }))).toBe('store-1');
  });

  it('selectSelectedStore returns undefined for missing key', () => {
    expect(selectSelectedStore({})).toBeUndefined();
  });

  it('selectSelectedBrand returns selectedBrand', () => {
    expect(selectSelectedBrand(createMockState({ selectedBrand: 'brand-1' }))).toBe('brand-1');
  });

  it('selectSelectedBrand returns undefined for missing key', () => {
    expect(selectSelectedBrand({})).toBeUndefined();
  });

  it('selectSelectedProduct returns selectedProduct', () => {
    expect(selectSelectedProduct(createMockState({ selectedProduct: 'prod-1' }))).toBe('prod-1');
  });

  it('selectSelectedProduct returns undefined for missing key', () => {
    expect(selectSelectedProduct({})).toBeUndefined();
  });

  it('selectSelectedReport returns selectedReport', () => {
    expect(selectSelectedReport(createMockState({ selectedReport: 'rep-1' }))).toBe('rep-1');
  });

  it('selectSelectedReport returns undefined for missing key', () => {
    expect(selectSelectedReport({})).toBeUndefined();
  });
});
