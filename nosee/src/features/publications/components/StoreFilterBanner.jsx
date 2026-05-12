import { memo } from 'react';

const StoreFilterBanner = memo(function StoreFilterBanner({ filters, onClearStore, t }) {
  if (!filters?.storeId && !filters?.storeName) return null;

  const storeName = filters.storeName || `Tienda #${filters.storeId}`;

  return (
    <div style={styles.banner} role="status" aria-live="polite">
      <span style={styles.label}>
        {t?.storeFilterActive ?? 'Filtrando por tienda:'}{' '}
        <strong>{storeName}</strong>
      </span>
      <button
        type="button"
        onClick={onClearStore}
        style={styles.clearBtn}
        aria-label={t?.storeFilterClear ?? 'Quitar filtro de tienda'}
      >
        {t?.storeFilterClear ?? 'Quitar filtro'}
      </button>
    </div>
  );
});

export default StoreFilterBanner;

const styles = {
  banner: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '8px',
    padding: '8px 14px',
    marginBottom: '8px',
    background: 'rgba(56,189,248,0.08)',
    border: '1px solid rgba(56,189,248,0.25)',
    borderRadius: 'var(--radius-md, 8px)',
    flexWrap: 'wrap',
  },
  label: {
    fontSize: '13px',
    color: 'var(--text-secondary)',
  },
  clearBtn: {
    padding: '4px 12px',
    minHeight: '32px',
    border: '1px solid rgba(56,189,248,0.4)',
    borderRadius: '999px',
    background: 'transparent',
    color: 'var(--accent)',
    fontSize: '12px',
    fontWeight: 600,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
};
