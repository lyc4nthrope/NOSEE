import { memo, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import StoreCard from './StoreCard';
import { DRAWER_PEEK_PX } from '../hooks/useDrawer';

const SearchIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
);

const PlusIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

// Default orientation: chevron pointing UP (∧). Rotates 180° → ∨ when full.
const ChevronIcon = ({ up }) => (
  <svg
    width="18" height="18" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
    style={{ transform: up ? 'rotate(180deg)' : 'none', transition: 'transform 0.3s ease' }}
    aria-hidden="true"
  >
    <polyline points="18 15 12 9 6 15" />
  </svg>
);

const StoresDrawer = memo(function StoresDrawer({
  drawerRef,
  snap,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  cycleSnap,
  search,
  stores,
  loading,
  loadingMore,
  hasMore,
  error,
  onSearchChange,
  onLoadMore,
  onViewDetail,
  storeType,
  onStoreTypeChange,
  onlyWithLocation,
  onOnlyWithLocationChange,
  productName,
  onProductNameChange,
  categoryId,
  onCategoryChange,
  categories,
  t,
}) {
  const listRef = useRef(null);

  const handleListScroll = useCallback(() => {
    const el = listRef.current;
    if (!el || !onLoadMore) return;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 120) {
      onLoadMore();
    }
  }, [onLoadMore]);

  const expandLabel = snap === 'full' ? 'Contraer lista de tiendas' : 'Expandir lista de tiendas';

  return (
    <div
      ref={drawerRef}
      style={styles.drawer}
      role="complementary"
      aria-label="Lista de tiendas"
    >
      <div
        style={styles.dragZone}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      >
        {/* Handle pill — keyboard-accessible expand/collapse trigger */}
        <button
          type="button"
          data-drag-handle
          style={styles.handlePillBtn}
          onClick={cycleSnap}
          aria-label={expandLabel}
          aria-expanded={snap !== 'peek'}
        >
          <span style={styles.handleBar} />
        </button>

        <div style={styles.headerRow}>
          <div>
            <h1 style={styles.title}>{t.title}</h1>
            {!loading && (
              <p style={styles.subtitle} aria-live="polite">
                {stores.length} tienda{stores.length !== 1 ? 's' : ''}
              </p>
            )}
          </div>

          <div style={styles.headerActions}>
            <Link
              to="/tiendas/nueva"
              style={styles.createBtn}
              aria-label={t.createBtnLabel}
              onClick={e => e.stopPropagation()}
            >
              <PlusIcon />
              {t.createBtn}
            </Link>

            <button
              type="button"
              style={styles.chevronBtn}
              onClick={cycleSnap}
              aria-label={expandLabel}
              aria-expanded={snap !== 'peek'}
            >
              <ChevronIcon up={snap === 'full'} />
            </button>
          </div>
        </div>
      </div>

      {/* ── Search ── */}
      <div style={styles.searchWrapper}>
        <span style={styles.searchIconWrap}>
          <SearchIcon />
        </span>
        <input
          type="search"
          value={search}
          onChange={e => onSearchChange(e.target.value)}
          placeholder={t.searchPlaceholder}
          aria-label={t.searchPlaceholder}
          style={styles.searchInput}
        />
      </div>

      {/* ── Filtros de tipo ── */}
      <div style={styles.filterRow}>
        {[
          { key: 'all', label: t.filterChips?.all ?? 'Todas' },
          { key: 'physical', label: t.filterChips?.physical ?? 'Física' },
          { key: 'virtual', label: t.filterChips?.virtual ?? 'Virtual' },
        ].map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => onStoreTypeChange(key)}
            aria-pressed={storeType === key}
            style={storeType === key ? { ...styles.chip, ...styles.chipActive } : styles.chip}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── Toggle: Solo con ubicación ── */}
      <div style={styles.toggleRow}>
        <span style={styles.toggleLabel}>
          {t.onlyWithLocation ?? 'Solo con ubicación'}
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={onlyWithLocation}
          onClick={() => onOnlyWithLocationChange(!onlyWithLocation)}
          style={onlyWithLocation ? { ...styles.toggle, ...styles.toggleOn } : styles.toggle}
        >
          <span style={onlyWithLocation ? { ...styles.toggleThumb, ...styles.toggleThumbOn } : styles.toggleThumb} />
        </button>
      </div>

      {/* ── Filtros de producto ── */}
      <div style={styles.productFilters}>
        <div style={styles.searchWrapper}>
          <span style={styles.searchIconWrap}>
            <SearchIcon />
          </span>
          <input
            type="search"
            value={productName}
            onChange={e => onProductNameChange(e.target.value)}
            placeholder={t.productSearchPlaceholder ?? 'Buscar por producto...'}
            aria-label={t.productSearchPlaceholder ?? 'Buscar por producto'}
            style={styles.searchInput}
          />
        </div>
        {categories.length > 0 && (
          <select
            value={categoryId ?? ''}
            onChange={e => onCategoryChange(e.target.value || null)}
            aria-label={t.categoryAll ?? 'Categoría de producto'}
            style={styles.categorySelect}
          >
            <option value="">{t.categoryAll ?? 'Todas las categorías'}</option>
            {categories.map(cat => (
              <option key={cat.id} value={cat.id}>{cat.name}</option>
            ))}
          </select>
        )}
      </div>

      {/* ── List ── */}
      <div
        ref={listRef}
        style={styles.listScroll}
        onScroll={handleListScroll}
        role="region"
        aria-label="Resultados de tiendas"
      >
        {loading && (
          <p role="status" aria-live="polite" style={styles.stateText}>{t.loading}</p>
        )}

        {!loading && error && (
          <p role="alert" style={{ ...styles.stateText, color: 'var(--error)' }}>
            {t.errorLoading}: {error}
          </p>
        )}

        {!loading && !error && stores.length === 0 && (
          <p role="status" aria-live="polite" style={styles.stateText}>{t.empty}</p>
        )}

        {!loading && !error && stores.length > 0 && (
          <ul style={styles.list} aria-label={t.title}>
            {stores.map(store => (
              <li key={store.id} style={styles.listItem}>
                <StoreCard store={store} onViewDetail={onViewDetail} />
              </li>
            ))}
          </ul>
        )}

        {loadingMore && (
          <p aria-live="polite" style={styles.footerText}>{t.loading}</p>
        )}
        {!hasMore && !loadingMore && stores.length > 0 && (
          <p aria-hidden="true" style={styles.footerText}>•</p>
        )}
      </div>
    </div>
  );
});

export default StoresDrawer;

const styles = {
  drawer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 400,
    height: `${DRAWER_PEEK_PX}px`,
    background: 'var(--bg-surface)',
    borderRadius: '16px 16px 0 0',
    boxShadow: '0 -4px 24px rgba(0,0,0,0.22)',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    willChange: 'height',
  },
  dragZone: {
    flexShrink: 0,
    cursor: 'grab',
    userSelect: 'none',
    WebkitUserSelect: 'none',
    touchAction: 'none',
  },
  // Full-width transparent button wrapping the handle bar — gives a large touch target
  handlePillBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    padding: '10px 0 6px',
    background: 'transparent',
    border: 'none',
    cursor: 'inherit',
    borderRadius: 0,
  },
  handleBar: {
    display: 'block',
    width: '40px',
    height: '4px',
    borderRadius: '2px',
    background: 'var(--border)',
    pointerEvents: 'none',
  },
  headerRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 16px 10px',
    gap: '12px',
  },
  title: {
    margin: 0,
    fontSize: '18px',
    fontWeight: 700,
    color: 'var(--text-primary)',
    lineHeight: 1.2,
  },
  subtitle: {
    margin: '2px 0 0',
    fontSize: '12px',
    color: 'var(--text-muted)',
  },
  headerActions: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    flexShrink: 0,
  },
  createBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '5px',
    padding: '7px 14px',
    minHeight: '44px',
    background: 'var(--accent)',
    color: 'var(--text-primary)',
    borderRadius: 'var(--radius-md)',
    fontSize: '13px',
    fontWeight: 600,
    textDecoration: 'none',
    whiteSpace: 'nowrap',
  },
  // Proper button with 44×44 touch target (Fitts's Law)
  chevronBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '44px',
    height: '44px',
    background: 'transparent',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-md)',
    cursor: 'pointer',
    color: 'var(--text-secondary)',
    flexShrink: 0,
    transition: 'background 0.15s, color 0.15s',
  },
  searchWrapper: {
    position: 'relative',
    flexShrink: 0,
    padding: '0 16px 10px',
  },
  searchIconWrap: {
    position: 'absolute',
    left: '28px',
    top: '50%',
    transform: 'translateY(-50%)',
    display: 'flex',
    alignItems: 'center',
    color: 'var(--text-muted)',
    pointerEvents: 'none',
  },
  searchInput: {
    width: '100%',
    padding: '10px 12px 10px 36px',
    minHeight: '44px',
    fontSize: '14px',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-md)',
    background: 'var(--bg-elevated)',
    color: 'var(--text-primary)',
    outline: 'none',
    boxSizing: 'border-box',
  },
  listScroll: {
    flex: 1,
    overflowY: 'auto',
    padding: '0 16px 24px',
    minHeight: 0,
    overscrollBehavior: 'contain',
    touchAction: 'pan-y',
  },
  list: {
    listStyle: 'none',
    margin: 0,
    padding: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  listItem: {
    margin: 0,
    padding: 0,
  },
  stateText: {
    margin: '24px 0',
    color: 'var(--text-muted)',
    fontSize: '15px',
    textAlign: 'center',
  },
  footerText: {
    margin: 0,
    padding: '12px 0',
    color: 'var(--text-muted)',
    fontSize: '14px',
    textAlign: 'center',
  },
  filterRow: {
    display: 'flex',
    gap: '8px',
    padding: '0 16px 10px',
    flexShrink: 0,
    flexWrap: 'wrap',
  },
  chip: {
    padding: '6px 14px',
    minHeight: '36px',
    borderRadius: '999px',
    border: '1px solid var(--border)',
    background: 'var(--bg-elevated)',
    color: 'var(--text-secondary)',
    fontSize: '13px',
    fontWeight: 500,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  chipActive: {
    background: 'var(--accent)',
    color: 'var(--on-accent, #002b3d)',
    border: '1px solid var(--accent)',
    fontWeight: 600,
  },
  toggleRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 16px 10px',
    flexShrink: 0,
  },
  toggleLabel: {
    fontSize: '13px',
    color: 'var(--text-secondary)',
    userSelect: 'none',
  },
  toggle: {
    position: 'relative',
    width: '40px',
    height: '22px',
    borderRadius: '999px',
    border: '1px solid var(--border)',
    background: 'var(--bg-elevated)',
    cursor: 'pointer',
    flexShrink: 0,
  },
  toggleOn: {
    background: 'var(--accent)',
    border: '1px solid var(--accent)',
  },
  toggleThumb: {
    position: 'absolute',
    top: '2px',
    left: '2px',
    width: '16px',
    height: '16px',
    borderRadius: '50%',
    background: 'var(--text-muted, #888)',
    transition: 'left 0.15s',
  },
  toggleThumbOn: {
    left: '20px',
    background: '#002b3d',
  },
  productFilters: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    padding: '0 16px 10px',
    flexShrink: 0,
  },
  categorySelect: {
    width: '100%',
    padding: '10px 12px',
    minHeight: '44px',
    fontSize: '14px',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-md)',
    background: 'var(--bg-elevated)',
    color: 'var(--text-primary)',
    outline: 'none',
    appearance: 'none',
    WebkitAppearance: 'none',
    cursor: 'pointer',
  },
};
