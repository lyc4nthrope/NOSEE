import { create } from 'zustand';

const initialState = {
  activeSection: 'overview',
  sidebarCollapsed: false,
  confirmModal: { isOpen: false, title: '', message: '', onConfirm: null, actions: null },
  banModal: null,
  selectedPub: null,
  selectedStore: null,
  selectedBrand: null,
  selectedProduct: null,
  selectedReport: null,
};

const confirmModalDefaults = { isOpen: false, title: '', message: '', onConfirm: null, actions: null };

const resetModalsAndSelected = () => ({
  confirmModal: { ...confirmModalDefaults },
  banModal: null,
  selectedPub: null,
  selectedStore: null,
  selectedBrand: null,
  selectedProduct: null,
  selectedReport: null,
});

export const useAdminStore = create((set) => ({
  ...initialState,

  setActiveSection: (section) => set({
    activeSection: section,
    ...resetModalsAndSelected(),
  }),

  toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),

  setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),

  openConfirmModal: (config) => set({
    confirmModal: { ...confirmModalDefaults, ...config, isOpen: true },
  }),

  closeConfirmModal: () => set({ confirmModal: { ...confirmModalDefaults } }),

  setBanModal: (user) => set({ banModal: user }),

  selectPublication: (val) => set({ selectedPub: val }),
  selectStore: (val) => set({ selectedStore: val }),
  selectBrand: (val) => set({ selectedBrand: val }),
  selectProduct: (val) => set({ selectedProduct: val }),
  selectReport: (val) => set({ selectedReport: val }),
}));

export const selectActiveSection = (s) => s.activeSection;
export const selectSidebarCollapsed = (s) => s.sidebarCollapsed;
export const selectConfirmModal = (s) => s.confirmModal;
export const selectBanModal = (s) => s.banModal;
export const selectSelectedPublication = (s) => s.selectedPub;
export const selectSelectedStore = (s) => s.selectedStore;
export const selectSelectedBrand = (s) => s.selectedBrand;
export const selectSelectedProduct = (s) => s.selectedProduct;
export const selectSelectedReport = (s) => s.selectedReport;

export default useAdminStore;
