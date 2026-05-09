import { create } from 'zustand';
import * as publicationsApi from '@/services/api/publications.api';

export const usePublicationsStore = create((set, get) => ({
  categories: [],
  categoriesStatus: 'idle', // 'idle' | 'loading' | 'ready' | 'error'

  loadCategories: async () => {
    const { categoriesStatus } = get();
    if (categoriesStatus === 'ready' || categoriesStatus === 'loading') return;

    set({ categoriesStatus: 'loading' });

    const first = await publicationsApi.getProductCategories();
    if (first.success) {
      set({ categories: first.data || [], categoriesStatus: 'ready' });
      return;
    }

    // Reintento único para fallos transitorios de red/token en mobile
    const second = await publicationsApi.getProductCategories();
    if (second.success) {
      set({ categories: second.data || [], categoriesStatus: 'ready' });
      return;
    }

    console.error('No se pudieron cargar categorías:', second.error || first.error);
    set({ categoriesStatus: 'error' });
  },
}));
