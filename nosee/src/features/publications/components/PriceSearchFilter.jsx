import { useState, useEffect, useRef } from 'react';
import { useLanguage, translateDbValue } from '@/contexts/LanguageContext';
import { listStores } from '@/services/api/stores.api';
import { ReportModal } from '@/components/ReportModal';

import { ensureLeafletLoaded } from '@/services/utils/leafletLoader';

const EMPTY_FILTERS = {};

// ── Keyframe injection ───────────────────────────────────────────────────────
const PSF_STYLE_ID = 'psf-keyframes';
if (typeof document !== 'undefined' && !document.getElementById(PSF_STYLE_ID)) {
  const styleEl = document.createElement('style');
  styleEl.id = PSF_STYLE_ID;
  styleEl.textContent = `
    @keyframes psf-slide-in {
      from { opacity: 0; transform: translateY(-8px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    @media (max-width: 639px) {
      .psf-row-responsive {
        grid-template-columns: 1fr !important;
      }
    }
  `;
  document.head.appendChild(styleEl);
}

// ── Inline SVG icons ─────────────────────────────────────────────────────────
const IconStore = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M3 9l1-6h16l1 6"/><path d="M3 9a2 2 0 0 0 4 0 2 2 0 0 0 4 0 2 2 0 0 0 4 0 2 2 0 0 0 4 0"/>
    <path d="M5 9v11h14V9"/>
  </svg>
);

const IconTag = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/>
    <line x1="7" y1="7" x2="7.01" y2="7"/>
  </svg>
);

const IconPackage = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <line x1="16.5" y1="9.4" x2="7.5" y2="4.21"/><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
    <polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/>
  </svg>
);

const IconDollar = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
  </svg>
);

const IconMapPin = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
  </svg>
);

const IconSort = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/>
    <line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>
  </svg>
);

// ── StoreMapModal ────────────────────────────────────────────────────────────
function StoreMapModal({ store, onClose }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const [mapError, setMapError] = useState(null);

  useEffect(() => {
    let mounted = true;

    async function init() {
      try {
        const L = await ensureLeafletLoaded();
        if (!mounted || !containerRef.current) return;
        if (mapRef.current) return;

        delete L.Icon.Default.prototype._getIconUrl;
        L.Icon.Default.mergeOptions({
          iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
          iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
          shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
        });

        const map = L.map(containerRef.current).setView([store.latitude, store.longitude], 16);
        mapRef.current = map;

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '© OpenStreetMap contributors',
        }).addTo(map);

        L.marker([store.latitude, store.longitude])
          .addTo(map)
          .bindPopup(store.name)
          .openPopup();
      } catch (err) {
        if (mounted) setMapError(err.message);
      }
    }

    init();

    return () => {
      mounted = false;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const handleKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Ubicación de ${store.name}`}
      style={mapModalStyles.overlay}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      onKeyDown={(e) => { if (e.key === 'Escape') onClose(); }}
    >
      <div style={mapModalStyles.modal}>
        <div style={mapModalStyles.header}>
          <div>
            <span style={mapModalStyles.title}>📍 {store.name}</span>
            {store.address && (
              <p style={mapModalStyles.address}>{store.address}</p>
            )}
          </div>
          <button
            type="button"
            aria-label="Cerrar mapa"
            onClick={onClose}
            style={mapModalStyles.closeBtn}
          >
            ✕
          </button>
        </div>
        {mapError ? (
          <div style={mapModalStyles.error}>No se pudo cargar el mapa</div>
        ) : (
          <div ref={containerRef} style={mapModalStyles.mapContainer} />
        )}
      </div>
    </div>
  );
}

const mapModalStyles = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.6)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  modal: {
    background: 'var(--bg-surface)',
    borderRadius: 'var(--radius-lg)',
    width: '90%',
    maxWidth: '480px',
    overflow: 'hidden',
    boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
  },
  header: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    padding: '16px 20px',
    borderBottom: '1px solid var(--border)',
    gap: '12px',
  },
  title: {
    fontWeight: 700,
    fontSize: '15px',
    color: 'var(--text-primary)',
    display: 'block',
  },
  address: {
    margin: '4px 0 0',
    fontSize: '12px',
    color: 'var(--text-muted)',
  },
  closeBtn: {
    flexShrink: 0,
    background: 'var(--bg-elevated)',
    border: '2px solid var(--border)',
    borderRadius: '50%',
    width: 34,
    height: 34,
    fontSize: 18,
    fontWeight: 800,
    cursor: 'pointer',
    color: 'var(--text-primary)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    lineHeight: 1,
  },
  mapContainer: {
    width: '100%',
    height: '300px',
  },
  error: {
    padding: '40px',
    textAlign: 'center',
    color: 'var(--text-muted)',
    fontSize: '14px',
    height: '120px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
};

// ── Helpers ──────────────────────────────────────────────────────────────────
function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) * Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

function buildStoreLabel(store, userLat, userLng) {
  const hasCoords = Number.isFinite(store.latitude) && Number.isFinite(store.longitude);
  const hasUserCoords = Number.isFinite(userLat) && Number.isFinite(userLng);
  const hasAddress = store.address && store.address.trim().length > 0;

  const shortAddress = hasAddress
    ? (store.address.length > 28 ? store.address.slice(0, 28) + '...' : store.address)
    : null;

  if (hasCoords && hasUserCoords && shortAddress) {
    const km = haversineKm(userLat, userLng, store.latitude, store.longitude).toFixed(1);
    return `${store.name} · ${km} km · ${shortAddress}`;
  }
  if (hasCoords && hasUserCoords) {
    const km = haversineKm(userLat, userLng, store.latitude, store.longitude).toFixed(1);
    return `${store.name} · ${km} km`;
  }
  if (shortAddress) {
    return `${store.name} · ${shortAddress}`;
  }
  return store.name;
}

// ── StoreCombobox ────────────────────────────────────────────────────────────
function StoreCombobox({ value, onStoreChange, placeholder, inputStyle, userLat, userLng }) {
  const [query, setQuery] = useState(value || '');
  const [options, setOptions] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [selectedStore, setSelectedStore] = useState(null);
  const [mapOpen, setMapOpen] = useState(false);
  const [reportTarget, setReportTarget] = useState(null);
  const [isFocused, setIsFocused] = useState(false);
  const debounceRef = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    if (value !== query) {
      setQuery(value || '');
      if (!value) setSelectedStore(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  useEffect(() => {
    const handler = (e) => {
      if (!containerRef.current?.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const searchStores = (text) => {
    clearTimeout(debounceRef.current);
    if (!text || text.trim().length < 1) {
      setOptions([]);
      setIsOpen(false);
      return;
    }
    setLoadingOptions(true);
    debounceRef.current = setTimeout(async () => {
      const result = await listStores(text.trim(), 20);
      if (result.success) {
        setOptions(result.data);
        setIsOpen(result.data.length > 0);
      }
      setLoadingOptions(false);
    }, 300);
  };

  const handleInput = (e) => {
    const val = e.target.value;
    setQuery(val);
    setSelectedStore(null);
    onStoreChange(val, null);
    searchStores(val);
  };

  const handleSelect = (store) => {
    setQuery(store.name);
    setSelectedStore(store);
    setIsOpen(false);
    onStoreChange(store.name, store);
  };

  const handleClear = () => {
    setQuery('');
    setSelectedStore(null);
    setIsOpen(false);
    setOptions([]);
    onStoreChange('', null);
  };

  const hasLocation = selectedStore &&
    Number.isFinite(selectedStore.latitude) &&
    Number.isFinite(selectedStore.longitude) &&
    selectedStore.type === 'physical';

  const focusedInputStyle = isFocused
    ? { ...inputStyle, border: '1px solid var(--accent)', outline: 'none' }
    : inputStyle;

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
        <input
          type="text"
          value={query}
          onChange={handleInput}
          placeholder={placeholder}
          aria-label={placeholder || 'Buscar tienda'}
          aria-autocomplete="list"
          aria-expanded={isOpen}
          aria-controls="store-search-listbox"
          onFocus={() => {
            setIsFocused(true);
            if (options.length > 0) setIsOpen(true);
          }}
          onBlur={() => setIsFocused(false)}
          autoComplete="off"
          style={{
            ...focusedInputStyle,
            paddingRight: (hasLocation || query) ? '60px' : '12px',
          }}
        />
        <div style={comboStyles.inputActions}>
          {loadingOptions && (
            <span style={comboStyles.loadingDot}>⋯</span>
          )}
          {hasLocation && (
            <button
              type="button"
              title="Ver ubicación en mapa"
              aria-label="Ver ubicación de la tienda en el mapa"
              onClick={() => setMapOpen(true)}
              style={comboStyles.mapBtn}
            >
              📍
            </button>
          )}
          {query && (
            <button
              type="button"
              aria-label="Limpiar tienda"
              onClick={handleClear}
              style={comboStyles.clearBtn}
              onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text-primary)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; }}
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {isOpen && options.length > 0 && (
        <div id="store-search-listbox" style={comboStyles.dropdown} role="listbox">
          {options.map((store) => (
            <div key={store.id} style={comboStyles.optionRow}>
              <button
                type="button"
                role="option"
                style={comboStyles.option}
                onClick={() => handleSelect(store)}
              >
                <span aria-hidden="true">
                  {store.type === 'physical' ? '🏬' : '🌐'}
                </span>
                <span style={comboStyles.optionName}>{buildStoreLabel(store, userLat, userLng)}</span>
              </button>
              <button
                type="button"
                aria-label={`Reportar ${store.name}`}
                title="Reportar tienda"
                style={comboStyles.reportBtn}
                onClick={(e) => {
                  e.stopPropagation();
                  setReportTarget(store);
                  setIsOpen(false);
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(220, 38, 38, 0.65)';
                  e.currentTarget.style.borderColor = 'rgba(220, 38, 38, 0.7)';
                  e.currentTarget.style.color = 'var(--bg-base)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(220, 38, 38, 0.15)';
                  e.currentTarget.style.borderColor = 'rgba(220, 38, 38, 0.35)';
                  e.currentTarget.style.color = 'rgba(220, 38, 38, 0.9)';
                }}
              >
                !
              </button>
            </div>
          ))}
        </div>
      )}

      {mapOpen && hasLocation && (
        <StoreMapModal store={selectedStore} onClose={() => setMapOpen(false)} />
      )}

      {reportTarget && (
        <ReportModal
          targetType="store"
          targetId={reportTarget.id}
          targetName={reportTarget.name}
          onClose={() => setReportTarget(null)}
        />
      )}
    </div>
  );
}

// ── SearchableCombobox ───────────────────────────────────────────────────────
function SearchableCombobox({ options, value, onChange, placeholder, inputStyle }) {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const containerRef = useRef(null);

  const selectedOption = options.find((o) => o.id === value) ?? null;

  // Keep query in sync with external value changes
  useEffect(() => {
    if (value == null) {
      setQuery('');
    } else if (selectedOption) {
      setQuery(selectedOption.label ?? selectedOption.name);
    }
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (!containerRef.current?.contains(e.target)) {
        setIsOpen(false);
        // Restore displayed text on blur if something is selected
        if (selectedOption) {
          setQuery(selectedOption.label ?? selectedOption.name);
        } else {
          setQuery('');
        }
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [selectedOption]);

  const filtered = query.trim() === ''
    ? options.slice(0, 8)
    : options.filter((o) =>
        (o.label ?? o.name).toLowerCase().includes(query.toLowerCase())
      ).slice(0, 8);

  const handleInputChange = (e) => {
    setQuery(e.target.value);
    setIsOpen(true);
  };

  const handleSelect = (option) => {
    setQuery(option.label ?? option.name);
    setIsOpen(false);
    onChange(option.id, option);
  };

  const handleClear = () => {
    setQuery('');
    setIsOpen(false);
    onChange(null, null);
  };

  const handleFocus = () => {
    setIsFocused(true);
    setIsOpen(true);
  };

  const handleBlur = () => {
    setIsFocused(false);
  };

  const focusedInputStyle = isFocused
    ? { ...inputStyle, border: '1px solid var(--accent)', outline: 'none' }
    : inputStyle;

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
        <input
          type="text"
          value={query}
          onChange={handleInputChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholder={placeholder}
          aria-label={placeholder}
          aria-autocomplete="list"
          aria-expanded={isOpen}
          autoComplete="off"
          style={{
            ...focusedInputStyle,
            paddingRight: value != null ? '32px' : '12px',
          }}
        />
        {value != null && (
          <button
            type="button"
            aria-label="Limpiar selección"
            onClick={handleClear}
            style={comboStyles.clearBtn}
            onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text-primary)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; }}
          >
            ✕
          </button>
        )}
      </div>

      {isOpen && filtered.length > 0 && (
        <div style={comboStyles.dropdown} role="listbox">
          {filtered.map((option) => (
            <button
              key={option.id}
              type="button"
              role="option"
              aria-selected={option.id === value}
              style={{
                ...comboStyles.option,
                background: option.id === value ? 'var(--accent-soft)' : 'transparent',
              }}
              onMouseEnter={(e) => {
                if (option.id !== value) e.currentTarget.style.background = 'var(--bg-elevated)';
              }}
              onMouseLeave={(e) => {
                if (option.id !== value) e.currentTarget.style.background = 'transparent';
              }}
              onClick={() => handleSelect(option)}
            >
              <span style={comboStyles.optionName}>{option.label ?? option.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const comboStyles = {
  inputActions: {
    position: 'absolute',
    right: '8px',
    display: 'flex',
    alignItems: 'center',
    gap: '2px',
  },
  loadingDot: {
    fontSize: '14px',
    color: 'var(--text-muted)',
    letterSpacing: '1px',
  },
  dropdown: {
    position: 'absolute',
    top: 'calc(100% + 4px)',
    left: 0,
    right: 0,
    background: 'var(--bg-surface)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-md)',
    zIndex: 50,
    maxHeight: '220px',
    overflowY: 'auto',
    boxShadow: '0 8px 24px rgba(0,0,0,0.14)',
  },
  optionRow: {
    display: 'flex',
    alignItems: 'center',
    borderBottom: '1px solid var(--border)',
  },
  option: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '9px 12px',
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    textAlign: 'left',
    fontSize: '13px',
    color: 'var(--text-primary)',
    minWidth: 0,
    width: '100%',
    transition: 'background 0.15s ease',
  },
  reportBtn: {
    flexShrink: 0,
    background: 'rgba(220, 38, 38, 0.15)',
    border: '1.5px solid rgba(220, 38, 38, 0.35)',
    borderRadius: '50%',
    width: '22px',
    height: '22px',
    cursor: 'pointer',
    fontSize: '11px',
    fontWeight: 800,
    color: 'rgba(220, 38, 38, 0.9)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: '0 8px',
  },
  optionName: {
    flex: 1,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  optionBadge: {
    fontSize: '10px',
    padding: '2px 6px',
    background: 'var(--accent-soft)',
    color: 'var(--accent)',
    borderRadius: '99px',
    flexShrink: 0,
    fontWeight: 600,
  },
  mapBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontSize: '15px',
    padding: '2px 3px',
    lineHeight: 1,
  },
  clearBtn: {
    position: 'absolute',
    right: '8px',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontSize: '11px',
    color: 'var(--text-muted)',
    padding: '2px 3px',
    lineHeight: 1,
    transition: 'color 0.15s ease',
  },
};

// ── PriceSearchFilter ────────────────────────────────────────────────────────
/**
 * @param {Object}   filters          - Filtros actuales
 * @param {Function} onFiltersChange  - (newFilters) => void
 * @param {Function} onClearFilters   - () => void
 * @param {boolean}  open             - Controla si el panel de filtros está visible
 * @param {boolean}  distanceLoading  - true mientras se obtiene la geolocalización
 */
export function PriceSearchFilter({
  filters = EMPTY_FILTERS,
  onFiltersChange,
  onClearFilters,
  open = false,
  distanceLoading = false,
  categories = [],
  brands = [],
  userLat,
  userLng,
}) {
  const { t } = useLanguage();
  const tf = t.priceFilter;

  const [localFilters, setLocalFilters] = useState(filters);

  useEffect(() => {
    setLocalFilters((prev) => {
      const keys = ['productId', 'productName', 'storeName', 'storeId', 'categoryId', 'brandId', 'minPrice', 'maxPrice', 'maxDistance', 'sortBy'];
      return keys.some((k) => prev[k] !== filters[k]) ? { ...filters } : prev;
    });
  }, [filters]);

  const activeFiltersCount = Object.entries(localFilters).filter(([k, v]) => {
    if (k === 'sortBy') return v && v !== 'recent';
    return v !== null && v !== '';
  }).length;

  const handleInputChange = (field, value) => {
    const updated = { ...localFilters, [field]: value };
    setLocalFilters(updated);
    onFiltersChange?.(updated);
  };

  const handleStoreChange = (name, storeObj) => {
    const updated = { ...localFilters, storeName: name, storeId: storeObj?.id ?? null };
    setLocalFilters(updated);
    onFiltersChange?.(updated);
  };

  const handleRangeChange = (minOrMax, value) => {
    if (value === '') {
      const updated = { ...localFilters, [minOrMax]: null };
      setLocalFilters(updated);
      onFiltersChange?.(updated);
      return;
    }

    const parsedValue = Number(value);
    if (!Number.isFinite(parsedValue)) return;

    const numValue = Math.max(0, parsedValue);
    const updated = { ...localFilters, [minOrMax]: numValue };
    setLocalFilters(updated);
    onFiltersChange?.(updated);
  };

  const blockNegativeKeys = (e) => {
    if (e.key === '-' || e.key === 'Minus') {
      e.preventDefault();
    }
  };

  const handleClear = () => {
    const cleared = {
      productId: null,
      productName: '',
      storeName: '',
      storeId: null,
      categoryId: null,
      brandId: null,
      minPrice: null,
      maxPrice: null,
      maxDistance: null,
      sortBy: 'recent',
    };
    setLocalFilters(cleared);
    onClearFilters?.();
  };

  const applyFiltersNow = () => {
    onFiltersChange?.(localFilters);
  };

  // Build category options with translated labels
  const categoryOptions = categories.map((c) => ({
    id: c.id,
    name: c.name,
    label: translateDbValue(t, 'categories', c.name),
  }));

  // Build brand options
  const brandOptions = brands.map((b) => ({ id: b.id, name: b.name }));

  return (
    <div>
      {activeFiltersCount > 0 && (
        <div style={styles.tags}>
          {localFilters.productName && (
            <span style={styles.tag}>
              {localFilters.productName}
              <button
                style={styles.tagClose}
                onClick={() => handleInputChange('productName', '')}
                onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text-primary)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; }}
              >✕</button>
            </span>
          )}
          {localFilters.storeName && (
            <span style={{ ...styles.tag, ...(localFilters.storeId ? styles.tagExact : {}) }}>
              <IconStore />
              {localFilters.storeName}
              <button
                style={styles.tagClose}
                onClick={() => handleStoreChange('', null)}
                onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text-primary)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; }}
              >✕</button>
            </span>
          )}
          {localFilters.categoryId && (
            <span style={styles.tag}>
              <IconTag />
              {translateDbValue(t, 'categories', categories.find((c) => c.id === localFilters.categoryId)?.name) || "Categoría"}
              <button
                style={styles.tagClose}
                onClick={() => handleInputChange('categoryId', null)}
                onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text-primary)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; }}
              >✕</button>
            </span>
          )}
          {localFilters.brandId && (
            <span style={{ ...styles.tag, ...styles.tagExact }}>
              <IconPackage />
              {localFilters.brandName || brands.find((b) => b.id === localFilters.brandId)?.name || "Marca"}
              <button
                style={styles.tagClose}
                onClick={() => {
                  const updated = { ...localFilters, brandId: null, brandName: null };
                  setLocalFilters(updated);
                  onFiltersChange?.(updated);
                }}
                onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text-primary)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; }}
              >✕</button>
            </span>
          )}
          {localFilters.minPrice && (
            <span style={styles.tag}>
              <IconDollar />
              ${localFilters.minPrice}+
              <button
                style={styles.tagClose}
                onClick={() => handleRangeChange('minPrice', '')}
                onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text-primary)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; }}
              >✕</button>
            </span>
          )}
          {localFilters.maxPrice && (
            <span style={styles.tag}>
              <IconDollar />
              {tf.maxLabel(localFilters.maxPrice)}
              <button
                style={styles.tagClose}
                onClick={() => handleRangeChange('maxPrice', '')}
                onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text-primary)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; }}
              >✕</button>
            </span>
          )}
          {localFilters.maxDistance && (
            <span style={styles.tag}>
              <IconMapPin />
              {localFilters.maxDistance}km
              <button
                style={styles.tagClose}
                onClick={() => handleRangeChange('maxDistance', '')}
                onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text-primary)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; }}
              >✕</button>
            </span>
          )}
          {localFilters.sortBy && localFilters.sortBy !== 'recent' && (
            <span style={styles.tag}>
              <IconSort />
              {localFilters.sortBy === 'cheapest' ? tf.cheapest : localFilters.sortBy === 'validated' ? tf.validated : 'Mejor opción'}
              <button
                style={styles.tagClose}
                onClick={() => handleInputChange('sortBy', 'recent')}
                onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text-primary)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; }}
              >✕</button>
            </span>
          )}
        </div>
      )}

      {open && (
        <div style={styles.panel}>
          {/* Tienda */}
          <div style={{ ...styles.row, gridTemplateColumns: '1fr' }}>
            <div style={styles.formGroup}>
              <label style={styles.label}>
                <IconStore />
                {tf.store}
              </label>
              <StoreCombobox
                value={localFilters.storeName || ''}
                onStoreChange={handleStoreChange}
                placeholder={tf.storePlaceholder}
                inputStyle={styles.input}
                userLat={userLat}
                userLng={userLng}
              />
            </div>
          </div>

          {/* Categoría */}
          <div style={{ ...styles.row, gridTemplateColumns: '1fr' }}>
            <div style={styles.formGroup}>
              <label style={styles.label}>
                <IconTag />
                Categoría
              </label>
              <SearchableCombobox
                options={categoryOptions}
                value={localFilters.categoryId}
                onChange={(id) => handleInputChange('categoryId', id)}
                placeholder="Buscar categoría..."
                inputStyle={styles.input}
              />
            </div>
          </div>

          {/* Marca */}
          {brands && brands.length > 0 && (
            <div style={{ ...styles.row, gridTemplateColumns: '1fr' }}>
              <div style={styles.formGroup}>
                <label style={styles.label}>
                  <IconPackage />
                  Marca
                </label>
                <SearchableCombobox
                  options={brandOptions}
                  value={localFilters.brandId}
                  onChange={(id, brand) => {
                    const updated = {
                      ...localFilters,
                      brandId: id,
                      brandName: brand ? brand.name : null,
                    };
                    setLocalFilters(updated);
                    onFiltersChange?.(updated);
                  }}
                  placeholder="Buscar marca..."
                  inputStyle={styles.input}
                />
              </div>
            </div>
          )}

          {/* Precio mín / máx */}
          <div style={styles.row} className="psf-row-responsive">
            <div style={styles.formGroup}>
              <label style={styles.label}>
                <IconDollar />
                {tf.minPrice}
              </label>
              <div style={styles.inputGroup}>
                <span style={styles.currency}>$</span>
                <PriceInput
                  placeholder="0"
                  value={localFilters.minPrice ?? ''}
                  onChange={(e) => handleRangeChange('minPrice', e.target.value)}
                  onKeyDown={(e) => {
                    blockNegativeKeys(e);
                    if (e.key === 'Enter') { e.preventDefault(); applyFiltersNow(); }
                  }}
                  inputStyle={styles.inputWithPrefix}
                />
              </div>
            </div>
            <div style={styles.formGroup}>
              <label style={styles.label}>
                <IconDollar />
                {tf.maxPrice}
              </label>
              <div style={styles.inputGroup}>
                <span style={styles.currency}>$</span>
                <PriceInput
                  placeholder="999999"
                  value={localFilters.maxPrice ?? ''}
                  onChange={(e) => handleRangeChange('maxPrice', e.target.value)}
                  onKeyDown={(e) => {
                    blockNegativeKeys(e);
                    if (e.key === 'Enter') { e.preventDefault(); applyFiltersNow(); }
                  }}
                  inputStyle={styles.inputWithPrefix}
                />
              </div>
            </div>
          </div>

          {/* Distancia + Ordenar */}
          <div style={{ ...styles.row, marginBottom: '8px' }} className="psf-row-responsive">
            <div style={styles.formGroup}>
              <label style={styles.label}>
                <IconMapPin />
                {tf.distance}
              </label>
              <div style={{ position: 'relative' }}>
                <PriceInput
                  placeholder={tf.distancePlaceholder}
                  value={localFilters.maxDistance || ''}
                  onChange={(e) => handleRangeChange('maxDistance', e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); applyFiltersNow(); } }}
                  inputStyle={{
                    ...styles.input,
                    paddingRight: distanceLoading ? '80px' : '12px',
                  }}
                />
                {distanceLoading && (
                  <span style={styles.distanceLoadingBadge}>
                    📡 Buscando...
                  </span>
                )}
              </div>
              {distanceLoading && (
                <p style={styles.distanceHint}>Obteniendo tu ubicación...</p>
              )}
            </div>
            <div style={styles.formGroup}>
              <label style={styles.label}>
                <IconSort />
                {tf.sortBy}
              </label>
              <SelectInput
                value={localFilters.sortBy || 'recent'}
                onChange={(e) => handleInputChange('sortBy', e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); applyFiltersNow(); } }}
                selectStyle={styles.select}
              >
                <option value="recent">{tf.recent}</option>
                <option value="validated">{tf.validated}</option>
                <option value="cheapest">{tf.cheapest}</option>
                <option value="best_match">Mejor opción</option>
              </SelectInput>
            </div>
          </div>

          <div style={styles.actions}>
            <button
              style={styles.clearBtn}
              onClick={handleClear}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(220, 38, 38, 0.08)';
                e.currentTarget.style.borderColor = 'var(--error, #dc2626)';
                e.currentTarget.style.color = 'var(--error, #dc2626)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.borderColor = 'var(--error, #dc2626)';
                e.currentTarget.style.color = 'var(--error, #dc2626)';
              }}
            >
              {tf.clearFilters}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Small focus-aware sub-components ────────────────────────────────────────
function PriceInput({ value, onChange, onKeyDown, placeholder, inputStyle }) {
  const [isFocused, setIsFocused] = useState(false);
  return (
    <input
      type="number"
      placeholder={placeholder}
      value={value}
      onChange={onChange}
      onKeyDown={onKeyDown}
      min="0"
      onFocus={() => setIsFocused(true)}
      onBlur={() => setIsFocused(false)}
      style={isFocused
        ? { ...inputStyle, border: '1px solid var(--accent)', outline: 'none' }
        : inputStyle
      }
    />
  );
}

function SelectInput({ value, onChange, onKeyDown, selectStyle, children }) {
  const [isFocused, setIsFocused] = useState(false);
  return (
    <select
      value={value}
      onChange={onChange}
      onKeyDown={onKeyDown}
      onFocus={() => setIsFocused(true)}
      onBlur={() => setIsFocused(false)}
      style={isFocused
        ? { ...selectStyle, border: '1px solid var(--accent)', outline: 'none' }
        : selectStyle
      }
    >
      {children}
    </select>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────
const styles = {
  tags: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '6px',
    marginTop: '10px',
  },
  tag: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '5px',
    background: 'var(--accent-soft)',
    color: 'var(--text-primary)',
    border: '1px solid var(--border)',
    padding: '3px 10px',
    borderRadius: '20px',
    fontSize: '12px',
    fontWeight: 500,
  },
  tagExact: {
    background: 'var(--accent-soft)',
    border: '1px solid var(--accent)',
  },
  tagClose: {
    background: 'none',
    border: 'none',
    color: 'var(--text-muted)',
    cursor: 'pointer',
    fontSize: '11px',
    padding: '0',
    lineHeight: 1,
    transition: 'color 0.15s ease',
  },
  panel: {
    marginTop: '8px',
    background: 'var(--bg-surface)',
    border: '1px solid var(--border-soft, var(--border))',
    borderRadius: 'var(--radius-md)',
    padding: '12px',
    backdropFilter: 'blur(8px)',
    WebkitBackdropFilter: 'blur(8px)',
    boxShadow: '0 4px 24px rgba(0,0,0,0.12)',
    animation: 'psf-slide-in 0.2s ease both',
  },
  row: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '10px',
    marginBottom: '10px',
  },
  formGroup: {
    display: 'flex',
    flexDirection: 'column',
  },
  label: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    fontSize: '11px',
    fontWeight: 600,
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    marginBottom: '4px',
  },
  input: {
    padding: '6px 10px',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-md)',
    fontSize: '13px',
    fontFamily: 'inherit',
    background: 'var(--bg-surface)',
    color: 'var(--text-primary)',
    width: '100%',
    boxSizing: 'border-box',
    transition: 'border-color 0.15s ease',
  },
  inputGroup: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
  },
  currency: {
    position: 'absolute',
    left: '10px',
    fontSize: '13px',
    color: 'var(--text-muted)',
    pointerEvents: 'none',
    zIndex: 1,
  },
  inputWithPrefix: {
    padding: '6px 10px 6px 24px',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-md)',
    fontSize: '13px',
    fontFamily: 'inherit',
    width: '100%',
    background: 'var(--bg-surface)',
    color: 'var(--text-primary)',
    boxSizing: 'border-box',
    transition: 'border-color 0.15s ease',
  },
  select: {
    padding: '6px 10px',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-md)',
    fontSize: '13px',
    fontFamily: 'inherit',
    background: 'var(--bg-surface)',
    color: 'var(--text-primary)',
    transition: 'border-color 0.15s ease',
    width: '100%',
  },
  distanceLoadingBadge: {
    position: 'absolute',
    right: '8px',
    top: '50%',
    transform: 'translateY(-50%)',
    fontSize: '11px',
    color: 'var(--accent)',
    fontWeight: 600,
    pointerEvents: 'none',
    whiteSpace: 'nowrap',
  },
  distanceHint: {
    margin: '4px 0 0',
    fontSize: '11px',
    color: 'var(--accent)',
  },
  actions: {
    display: 'flex',
    justifyContent: 'flex-start',
  },
  clearBtn: {
    padding: '5px 12px',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--error, #dc2626)',
    background: 'transparent',
    color: 'var(--error, #dc2626)',
    fontSize: '12px',
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'background 0.15s ease, color 0.15s ease',
  },
};

export default PriceSearchFilter;
