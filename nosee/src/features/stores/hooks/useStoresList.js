import { useState, useCallback, useRef, useEffect } from 'react';
import { listStores } from '@/services/api/stores.api';
import { INFINITE_SCROLL_CONFIG } from '@/config/infiniteScroll';

const DEBOUNCE_MS = 350;

export function useStoresList() {
  const [search, setSearch] = useState('');
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState(null);
  const [storeType, setStoreType] = useState('all');
  const [onlyWithLocation, setOnlyWithLocation] = useState(false);
  const storeTypeRef = useRef('all');
  const onlyWithLocationRef = useRef(false);

  const debounceRef    = useRef(null);
  const pageRef        = useRef(1);
  const searchRef      = useRef('');
  const loadingMoreRef = useRef(false); // sync guard — state update is async and can be bypassed by rapid scroll

  const fetchStores = useCallback(async ({ query, pageToLoad, append }) => {
    if (pageToLoad === 1) setLoading(true);
    else { loadingMoreRef.current = true; setLoadingMore(true); }
    setError(null);

    const result = await listStores(query, {
      limit: INFINITE_SCROLL_CONFIG.storesPageSize,
      page: pageToLoad,
      storeType: storeTypeRef.current,
      onlyWithLocation: onlyWithLocationRef.current,
    });

    if (result.success) {
      const incoming = result.data ?? [];
      setStores(prev => {
        if (!append) return incoming;
        const seen = new Set(prev.map(s => s.id));
        return [...prev, ...incoming.filter(s => !seen.has(s.id))];
      });
      pageRef.current = pageToLoad;
      setHasMore(Boolean(result.hasMore));
    } else {
      setError(result.error);
    }

    if (pageToLoad === 1) {
      setLoading(false);
    } else {
      loadingMoreRef.current = false;
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    fetchStores({ query: '', pageToLoad: 1, append: false });
  }, [fetchStores]);

  const handleSearchChange = useCallback((value) => {
    setSearch(value);
    searchRef.current = value;
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchStores({ query: value, pageToLoad: 1, append: false });
    }, DEBOUNCE_MS);
  }, [fetchStores]);

  const handleStoreTypeChange = useCallback((type) => {
    storeTypeRef.current = type;
    setStoreType(type);
    pageRef.current = 1;
    fetchStores({ query: searchRef.current, pageToLoad: 1, append: false });
  }, [fetchStores]);

  const handleOnlyWithLocationChange = useCallback((value) => {
    onlyWithLocationRef.current = value;
    setOnlyWithLocation(value);
    pageRef.current = 1;
    fetchStores({ query: searchRef.current, pageToLoad: 1, append: false });
  }, [fetchStores]);

  const loadMore = useCallback(() => {
    if (!hasMore || loading || loadingMoreRef.current) return;
    fetchStores({ query: searchRef.current, pageToLoad: pageRef.current + 1, append: true });
  }, [hasMore, loading, fetchStores]);

  const updateStore = useCallback((updatedStore) => {
    if (!updatedStore?.id) return;
    setStores(prev => prev.map(s => s.id === updatedStore.id ? { ...s, ...updatedStore } : s));
  }, []);

  return {
    search,
    stores,
    loading,
    loadingMore,
    hasMore,
    error,
    storeType,
    onlyWithLocation,
    handleSearchChange,
    handleStoreTypeChange,
    handleOnlyWithLocationChange,
    loadMore,
    updateStore,
  };
}
