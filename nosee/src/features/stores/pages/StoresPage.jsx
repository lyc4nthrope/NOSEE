import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuthStore, selectIsAuthenticated } from '@/features/auth/store/authStore';
import StoreDetailModal from '@/features/stores/components/StoreDetailModal';
import StoresDrawer from '@/features/stores/components/StoresDrawer';
import { useStoresList } from '@/features/stores/hooks/useStoresList';
import { useStoresMap } from '@/features/stores/hooks/useStoresMap';
import { useDrawer } from '@/features/stores/hooks/useDrawer';

const NAVBAR_HEIGHT = 60;

const MapPinIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
    <circle cx="12" cy="10" r="3" />
  </svg>
);

// Inject @keyframes spin once — used by the loading spinner
let spinInjected = false;
function injectSpinKeyframe() {
  if (spinInjected || document.getElementById('nosee-spin-kf')) return;
  const style = document.createElement('style');
  style.id = 'nosee-spin-kf';
  style.textContent = '@keyframes spin { to { transform: rotate(360deg); } }';
  document.head.appendChild(style);
  spinInjected = true;
}

export default function StoresPage() {
  const { t }          = useLanguage();
  const navigate       = useNavigate();
  const isAuthenticated = useAuthStore(selectIsAuthenticated);

  const mapContainerRef    = useRef(null);
  const drawerRef          = useRef(null);
  const productDebounceRef = useRef(null);
  const [selectedStore, setSelectedStore] = useState(null);

  // Product/category filter state lives here so both hooks receive same values
  const [productNameInput,  setProductNameInput]  = useState('');  // input display (immediate)
  const [productNameFilter, setProductNameFilter] = useState('');  // fetch trigger (debounced)
  const [categoryId,        setCategoryId]        = useState(null);

  useEffect(injectSpinKeyframe, []);

  // ── Hooks (original order preserved) ──────────────────────────────────────
  const { snap, snapTo, cycleSnap, onPointerDown, onPointerMove, onPointerUp } = useDrawer(drawerRef);

  // Opens the modal and nudges the drawer to half if it's peeking
  const handleMarkerClick = useCallback((store) => {
    setSelectedStore(store);
    if (snap === 'peek') snapTo('half');
  }, [snap, snapTo]);

  const { isLoading: mapLoading, locationError, mapError } = useStoresMap({
    containerRef: mapContainerRef,
    onStoreClick: handleMarkerClick,
    productName: productNameFilter,
    categoryId,
  });

  const {
    search, stores, loading, loadingMore, hasMore, error,
    storeType, onlyWithLocation, categories,
    activeFiltersCount, handleSearchChange, handleStoreTypeChange,
    handleOnlyWithLocationChange, resetFilters,
    loadMore, updateStore,
  } = useStoresList({ productName: productNameFilter, categoryId });

  // ── Product/category filter handlers ──────────────────────────────────────
  const handleProductNameChange = useCallback((value) => {
    setProductNameInput(value);
    clearTimeout(productDebounceRef.current);
    productDebounceRef.current = setTimeout(() => setProductNameFilter(value), 350);
  }, []);

  const handleCategoryChange = useCallback((id) => {
    setCategoryId(id ? Number(id) : null);
  }, []);

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleViewDetail = useCallback((store) => {
    if (!isAuthenticated) {
      navigate('/login', { state: { from: '/tiendas' } });
      return;
    }
    setSelectedStore(store);
  }, [isAuthenticated, navigate]);

  const totalActiveFilters = useMemo(() => {
    let count = activeFiltersCount;
    if (productNameInput !== '') count++;
    if (categoryId !== null) count++;
    return count;
  }, [activeFiltersCount, productNameInput, categoryId]);

  const handleClearFilters = useCallback(() => {
    clearTimeout(productDebounceRef.current);
    setProductNameInput('');
    setProductNameFilter('');
    setCategoryId(null);
    resetFilters();
  }, [resetFilters]);

  const handleStoreUpdated = useCallback((updated) => {
    updateStore(updated);
    setSelectedStore(prev => (prev?.id === updated?.id ? { ...prev, ...updated } : prev));
  }, [updateStore]);

  return (
    <main style={styles.page} aria-label="Tiendas cercanas">
      {/* ── Map ── */}
      <div style={styles.mapArea} aria-hidden={mapLoading || undefined}>
        <div
          ref={mapContainerRef}
          id="nosee-stores-map"
          style={{ ...styles.map, opacity: mapLoading ? 0 : 1 }}
          aria-label="Mapa de tiendas cercanas"
        />

        {mapLoading && !mapError && (
          <div style={styles.mapOverlay} role="status" aria-live="polite">
            <div style={styles.spinner} />
            <p style={styles.overlayText}>Cargando mapa...</p>
          </div>
        )}

        {mapError && (
          <div style={styles.mapOverlay} role="alert">
            <p style={styles.overlayError}>{mapError}</p>
          </div>
        )}

        {locationError && !mapLoading && (
          <div style={styles.locationBanner} role="status" aria-live="polite">
            <MapPinIcon />
            <span>{locationError}</span>
          </div>
        )}
      </div>

      {/* ── Bottom sheet ── */}
      <StoresDrawer
        drawerRef={drawerRef}
        snap={snap}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        cycleSnap={cycleSnap}
        search={search}
        stores={stores}
        loading={loading}
        loadingMore={loadingMore}
        hasMore={hasMore}
        error={error}
        storeType={storeType}
        onStoreTypeChange={handleStoreTypeChange}
        onlyWithLocation={onlyWithLocation}
        onOnlyWithLocationChange={handleOnlyWithLocationChange}
        productName={productNameInput}
        onProductNameChange={handleProductNameChange}
        categoryId={categoryId}
        onCategoryChange={handleCategoryChange}
        categories={categories}
        onSearchChange={handleSearchChange}
        onLoadMore={loadMore}
        onViewDetail={handleViewDetail}
        activeFiltersCount={totalActiveFilters}
        onClearFilters={handleClearFilters}
        t={t.storesPage}
      />

      {/* ── Detail modal ── */}
      {selectedStore && (
        <StoreDetailModal
          store={selectedStore}
          onClose={() => setSelectedStore(null)}
          onStoreUpdated={handleStoreUpdated}
        />
      )}
    </main>
  );
}

const styles = {
  page: {
    position: 'relative',
    width: '100%',
    height: `calc(100vh - ${NAVBAR_HEIGHT}px)`,
    overflow: 'hidden',
    background: 'var(--bg-base)',
  },
  mapArea: {
    position: 'absolute',
    inset: 0,
    zIndex: 0,
  },
  map: {
    width: '100%',
    height: '100%',
    transition: 'opacity 0.3s',
  },
  mapOverlay: {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '12px',
    background: 'var(--bg-base)',
    zIndex: 10,
    pointerEvents: 'none',
  },
  spinner: {
    width: '36px',
    height: '36px',
    border: '3px solid var(--bg-elevated)',
    borderTop: '3px solid var(--accent)',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
  overlayText: {
    margin: 0,
    color: 'var(--text-secondary)',
    fontSize: '14px',
  },
  overlayError: {
    margin: 0,
    color: 'var(--error)',
    fontSize: '14px',
  },
  locationBanner: {
    position: 'absolute',
    top: '12px',
    left: '50%',
    transform: 'translateX(-50%)',
    zIndex: 500,
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    background: 'rgba(251,191,36,0.12)',
    border: '1px solid rgba(251,191,36,0.3)',
    borderRadius: 'var(--radius-md)',
    color: 'var(--warning)',
    fontSize: '12px',
    padding: '6px 12px',
    whiteSpace: 'nowrap',
    maxWidth: 'calc(100% - 32px)',
    boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
  },
};
