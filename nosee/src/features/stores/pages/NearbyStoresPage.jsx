import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore, selectAuthUser } from '@/features/auth/store/authStore';
import { getAllPhysicalStoresWithLocation } from '@/services/api/stores.api';
import StoreDetailModal from '@/features/stores/components/StoreDetailModal';

const LEAFLET_CSS_URL = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
const LEAFLET_JS_URL = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
const CLUSTER_CSS_URL = 'https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.css';
const CLUSTER_JS_URL = 'https://unpkg.com/leaflet.markercluster@1.5.3/dist/leaflet.markercluster.js';

const DEFAULT_CENTER = { lat: 4.711, lng: -74.0721 };
const DEFAULT_ZOOM = 14;
const GEO_TIMEOUT_MS = 10000;

const TILE_LAYERS = {
  dark: {
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> © <a href="https://carto.com/attributions">CARTO</a>',
  },
  light: {
    url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> © <a href="https://carto.com/attributions">CARTO</a>',
  },
  highContrast: {
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> © <a href="https://carto.com/attributions">CARTO</a>',
  },
};

function getA11yTileTheme() {
  const classes = document.documentElement.classList;
  if (classes.contains('a11y-light-mode')) return 'light';
  if (classes.contains('a11y-high-contrast') || classes.contains('a11y-smart-contrast')) return 'highContrast';
  return 'dark';
}

// Cache CDN Leaflet — immune to npm Leaflet overwriting window.L (leaflet-src.js UMD sets window.L = exports)
let _cdnL = null;
let _cdnClusterReady = false;

function ensureLeafletLoaded() {
  if (_cdnL) return Promise.resolve(_cdnL);
  if (window.__leafletLoaderPromise) return window.__leafletLoaderPromise;

  window.__leafletLoaderPromise = new Promise((resolve, reject) => {
    if (!document.querySelector(`link[data-leaflet-css="${LEAFLET_CSS_URL}"]`)) {
      const cssLink = document.createElement('link');
      cssLink.rel = 'stylesheet';
      cssLink.href = LEAFLET_CSS_URL;
      cssLink.dataset.leafletCss = LEAFLET_CSS_URL;
      document.head.appendChild(cssLink);
    }

    const existing = document.querySelector(`script[data-leaflet-js="${LEAFLET_JS_URL}"]`);
    if (existing) {
      existing.addEventListener('load', () => { _cdnL = window.L; resolve(_cdnL); });
      existing.addEventListener('error', () => reject(new Error('No se pudo cargar Leaflet.')));
      return;
    }

    const script = document.createElement('script');
    script.src = LEAFLET_JS_URL;
    script.async = true;
    script.dataset.leafletJs = LEAFLET_JS_URL;
    script.onload = () => {
      if (!window.L) { reject(new Error('Leaflet no disponible.')); return; }
      _cdnL = window.L;
      resolve(_cdnL);
    };
    script.onerror = () => reject(new Error('No se pudo cargar Leaflet.'));
    document.body.appendChild(script);
  }).catch((err) => {
    window.__leafletLoaderPromise = null;
    throw err;
  });

  return window.__leafletLoaderPromise;
}

function ensureMarkerClusterLoaded() {
  if (_cdnClusterReady) return Promise.resolve();
  if (window.__clusterLoaderPromise) return window.__clusterLoaderPromise;

  window.__clusterLoaderPromise = new Promise((resolve, reject) => {
    if (!document.querySelector(`link[data-cluster-css="${CLUSTER_CSS_URL}"]`)) {
      const cssLink = document.createElement('link');
      cssLink.rel = 'stylesheet';
      cssLink.href = CLUSTER_CSS_URL;
      cssLink.dataset.clusterCss = CLUSTER_CSS_URL;
      document.head.appendChild(cssLink);
    }

    const existing = document.querySelector(`script[data-cluster-js="${CLUSTER_JS_URL}"]`);
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error('No se pudo cargar MarkerCluster.')));
      return;
    }

    const script = document.createElement('script');
    script.src = CLUSTER_JS_URL;
    script.async = true;
    script.dataset.clusterJs = CLUSTER_JS_URL;
    script.onload = () => { _cdnClusterReady = true; resolve(); };
    script.onerror = () => reject(new Error('No se pudo cargar MarkerCluster.'));
    document.body.appendChild(script);
  }).catch((err) => {
    window.__clusterLoaderPromise = null;
    throw err;
  });

  return window.__clusterLoaderPromise;
}

function getUserInitials(fullName) {
  if (!fullName) return '?';
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function createUserMarkerIcon(L, user) {
  const hasAvatar = Boolean(user?.avatarUrl);
  const initials = getUserInitials(user?.fullName);
  const inner = hasAvatar
    ? `<img src="${user.avatarUrl}" alt="Tu ubicación" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" />`
    : `<span style="font-size:16px;font-weight:700;color:var(--accent);line-height:1;">${initials}</span>`;

  return L.divIcon({
    className: '',
    html: `
      <div class="nosee-user-marker" style="
        width:44px;height:44px;
        border-radius:50%;
        border:3px solid var(--accent);
        background:var(--bg-elevated);
        display:flex;align-items:center;justify-content:center;
        box-shadow:0 2px 12px rgba(56,189,248,0.45);
        overflow:hidden;
        position:relative;
      ">
        ${inner}
        <div style="
          position:absolute;bottom:-2px;right:-2px;
          width:14px;height:14px;border-radius:50%;
          background:#4ade80;border:2px solid var(--bg-elevated);
        "></div>
      </div>`,
    iconSize: [44, 44],
    iconAnchor: [22, 22],
    popupAnchor: [0, -24],
  });
}

function createStoreMarkerIcon(L) {
  return L.divIcon({
    className: '',
    html: `
      <div class="nosee-store-marker" style="
        width:36px;height:36px;
        border-radius:8px;
        border:2px solid var(--accent);
        background:var(--bg-surface);
        display:flex;align-items:center;justify-content:center;
        box-shadow:0 2px 8px rgba(0,0,0,0.4);
        font-size:18px;
        cursor:pointer;
        transition:transform 0.15s;
      ">🏬</div>`,
    iconSize: [36, 36],
    iconAnchor: [18, 36],
    popupAnchor: [0, -38],
  });
}

function createClusterIcon(L, cluster) {
  const count = cluster.getChildCount();
  return L.divIcon({
    className: '',
    html: `
      <div class="nosee-cluster-marker" style="
        width:48px;height:48px;
        border-radius:50%;
        border:2px solid var(--accent);
        background:var(--bg-elevated);
        display:flex;align-items:center;justify-content:center;
        box-shadow:0 2px 12px rgba(56,189,248,0.3);
        flex-direction:column;gap:0;
        cursor:pointer;
      ">
        <span style="font-size:11px;line-height:1;color:var(--text-muted);">🏬</span>
        <span style="font-size:14px;font-weight:700;color:var(--accent);line-height:1.2;">${count}</span>
      </div>`,
    iconSize: [48, 48],
    iconAnchor: [24, 24],
  });
}

const BackIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="15 18 9 12 15 6" />
  </svg>
);

const MapPinIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
    <circle cx="12" cy="10" r="3" />
  </svg>
);

export default function NearbyStoresPage() {
  const user = useAuthStore(selectAuthUser);
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const clusterGroupRef = useRef(null);
  const userMarkerRef = useRef(null);
  const tileLayerRef = useRef(null);

  const [userLocation, setUserLocation] = useState(null);
  const [locationError, setLocationError] = useState(null);
  const [locationLoading, setLocationLoading] = useState(true);
  const [mapReady, setMapReady] = useState(false);
  const [clusterReady, setClusterReady] = useState(false);
  const [stores, setStores] = useState([]);
  const [loadingStores, setLoadingStores] = useState(true);
  const [selectedStore, setSelectedStore] = useState(null);
  const [loadError, setLoadError] = useState(null);

  // Fetch stores
  useEffect(() => {
    let cancelled = false;
    getAllPhysicalStoresWithLocation().then((result) => {
      if (cancelled) return;
      if (result.success) setStores(result.data || []);
      else setLoadError(result.error);
      setLoadingStores(false);
    });
    return () => { cancelled = true; };
  }, []);

  // Get user location
  useEffect(() => {
    if (!navigator.geolocation) {
      setLocationError('La geolocalización no está disponible en este dispositivo.');
      setLocationLoading(false);
      return;
    }
    let cancelled = false;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (!cancelled) {
          setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
          setLocationLoading(false);
        }
      },
      () => {
        if (!cancelled) {
          setLocationError('No se pudo obtener tu ubicación. El mapa se centrará en Bogotá.');
          setLocationLoading(false);
        }
      },
      { enableHighAccuracy: true, timeout: GEO_TIMEOUT_MS, maximumAge: 30000 }
    );
    return () => { cancelled = true; };
  }, []);

  // Load Leaflet + MarkerCluster
  useEffect(() => {
    let cancelled = false;
    ensureLeafletLoaded()
      .then(() => ensureMarkerClusterLoaded())
      .then(() => { if (!cancelled) setMapReady(true); })
      .catch(() => { if (!cancelled) setLoadError('No se pudo cargar el mapa. Verifica tu conexión.'); });
    return () => { cancelled = true; };
  }, []);

  // Init map once libraries ready and location resolved
  useEffect(() => {
    if (!mapReady || locationLoading) return;
    if (!mapContainerRef.current) return;
    if (mapInstanceRef.current) return; // already initialized

    const L = _cdnL;
    const center = userLocation || DEFAULT_CENTER;

    const map = L.map(mapContainerRef.current, {
      center: [center.lat, center.lng],
      zoom: DEFAULT_ZOOM,
      zoomControl: true,
    });

    const initialTheme = getA11yTileTheme();
    const tileCfg = TILE_LAYERS[initialTheme];
    tileLayerRef.current = L.tileLayer(tileCfg.url, {
      attribution: tileCfg.attribution,
      subdomains: 'abcd',
      maxZoom: 19,
    }).addTo(map);

    mapInstanceRef.current = map;

    // Cluster group with custom icon
    const clusterGroup = L.markerClusterGroup({
      iconCreateFunction: (cluster) => createClusterIcon(L, cluster),
      maxClusterRadius: 80,
      disableClusteringAtZoom: 17,
      spiderfyOnMaxZoom: true,
      showCoverageOnHover: false,
      zoomToBoundsOnClick: true,
    });
    clusterGroupRef.current = clusterGroup;
    map.addLayer(clusterGroup);
    setClusterReady(true);

    return () => {
      map.remove();
      mapInstanceRef.current = null;
      clusterGroupRef.current = null;
      userMarkerRef.current = null;
      tileLayerRef.current = null;
      setClusterReady(false);
    };
  }, [mapReady, locationLoading, userLocation]);

  // Watch accessibility theme changes and swap tile layer
  useEffect(() => {
    const observer = new MutationObserver(() => {
      const map = mapInstanceRef.current;
      const L = _cdnL;
      if (!map || !L || !tileLayerRef.current) return;

      const theme = getA11yTileTheme();
      const tileCfg = TILE_LAYERS[theme];
      tileLayerRef.current.remove();
      tileLayerRef.current = L.tileLayer(tileCfg.url, {
        attribution: tileCfg.attribution,
        subdomains: 'abcd',
        maxZoom: 19,
      }).addTo(map);
    });

    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  // Add user marker when map + location ready
  useEffect(() => {
    const map = mapInstanceRef.current;
    const L = _cdnL;
    if (!map || !L || !userLocation) return;

    if (userMarkerRef.current) {
      userMarkerRef.current.setLatLng([userLocation.lat, userLocation.lng]);
      return;
    }

    const userIcon = createUserMarkerIcon(L, user);
    const marker = L.marker([userLocation.lat, userLocation.lng], {
      icon: userIcon,
      zIndexOffset: 1000,
    });
    marker.bindTooltip('Tu ubicación', { permanent: false, direction: 'top', offset: [0, -26] });
    marker.addTo(map);
    userMarkerRef.current = marker;

    map.setView([userLocation.lat, userLocation.lng], DEFAULT_ZOOM);
  }, [mapReady, userLocation, user]);

  // Add store markers once cluster group is ready and stores are loaded
  useEffect(() => {
    const clusterGroup = clusterGroupRef.current;
    const L = _cdnL;
    if (!clusterReady || !clusterGroup || !L || loadingStores) return;
    if (stores.length === 0) return;

    clusterGroup.clearLayers();
    const storeIcon = createStoreMarkerIcon(L);

    stores.forEach((store) => {
      if (!store.latitude || !store.longitude) return;
      const marker = L.marker([store.latitude, store.longitude], { icon: storeIcon });
      marker.bindTooltip(store.name, { permanent: false, direction: 'top', offset: [0, -38] });
      marker.on('click', () => setSelectedStore(store));
      clusterGroup.addLayer(marker);
    });
  }, [clusterReady, loadingStores, stores]);

  const handleStoreUpdated = useCallback((updatedStore) => {
    if (!updatedStore?.id) return;
    setStores((prev) => prev.map((s) => (s.id === updatedStore.id ? { ...s, ...updatedStore } : s)));
    setSelectedStore((prev) => (prev?.id === updatedStore.id ? { ...prev, ...updatedStore } : prev));
  }, []);

  const isLoading = locationLoading || !mapReady;

  return (
    <div style={styles.page}>
      {/* Header */}
      <header style={styles.header}>
        <Link to="/tiendas" style={styles.backBtn} aria-label="Volver a tiendas">
          <BackIcon />
          <span>Tiendas</span>
        </Link>
        <div>
          <h1 style={styles.title}>Tiendas Cercanas</h1>
          <p style={styles.subtitle}>
            {loadingStores ? 'Cargando tiendas...' : `${stores.length} tienda${stores.length !== 1 ? 's' : ''} física${stores.length !== 1 ? 's' : ''} registrada${stores.length !== 1 ? 's' : ''}`}
          </p>
        </div>
      </header>

      {/* Location status */}
      {locationError && (
        <div role="alert" style={styles.locationBanner}>
          <MapPinIcon />
          <span style={{ marginLeft: '8px' }}>{locationError}</span>
        </div>
      )}

      {/* Load error */}
      {loadError && (
        <div role="alert" style={styles.errorBanner}>
          {loadError}
        </div>
      )}

      {/* Map container */}
      <div style={{ position: 'relative', flex: 1, minHeight: 0 }}>
        <div
          ref={mapContainerRef}
          id="nosee-nearby-map"
          style={{
            ...styles.mapContainer,
            opacity: isLoading ? 0 : 1,
            transition: 'opacity 0.3s',
          }}
          aria-label="Mapa de tiendas cercanas"
        />

        {/* Loading overlay */}
        {isLoading && (
          <div style={styles.loadingOverlay} role="status" aria-live="polite">
            <div style={styles.loadingSpinner} />
            <p style={styles.loadingText}>
              {!mapReady ? 'Cargando mapa...' : 'Obteniendo tu ubicación...'}
            </p>
          </div>
        )}

        {/* Legend */}
        {!isLoading && (
          <div style={styles.legend} aria-label="Leyenda del mapa">
            <div style={styles.legendItem}>
              <div style={styles.legendUser} />
              <span style={styles.legendLabel}>Tu ubicación</span>
            </div>
            <div style={styles.legendItem}>
              <div style={styles.legendStore} />
              <span style={styles.legendLabel}>Tienda</span>
            </div>
            <div style={styles.legendItem}>
              <div style={styles.legendCluster}>N</div>
              <span style={styles.legendLabel}>Grupo</span>
            </div>
          </div>
        )}
      </div>

      {/* Store detail modal */}
      {selectedStore && (
        <StoreDetailModal
          store={selectedStore}
          onClose={() => setSelectedStore(null)}
          onStoreUpdated={handleStoreUpdated}
        />
      )}
    </div>
  );
}

const styles = {
  page: {
    display: 'flex',
    flexDirection: 'column',
    height: 'calc(100vh - 60px)',
    overflow: 'hidden',
    background: 'var(--bg-base)',
  },
  header: {
    padding: '10px 16px 8px',
    borderBottom: '1px solid var(--border)',
    background: 'var(--bg-surface)',
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: '8px 12px',
  },
  backBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    color: 'var(--accent)',
    textDecoration: 'none',
    fontSize: '13px',
    fontWeight: 500,
    padding: '4px 8px',
    borderRadius: 'var(--radius-sm)',
    flexShrink: 0,
    whiteSpace: 'nowrap',
  },
  title: {
    margin: 0,
    fontSize: 'clamp(15px, 4vw, 18px)',
    fontWeight: 700,
    color: 'var(--text-primary)',
  },
  subtitle: {
    margin: 0,
    fontSize: '12px',
    color: 'var(--text-muted)',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  locationBanner: {
    display: 'flex',
    alignItems: 'center',
    padding: '8px 16px',
    background: 'rgba(251,191,36,0.1)',
    borderBottom: '1px solid rgba(251,191,36,0.25)',
    color: 'var(--warning)',
    fontSize: '13px',
    flexShrink: 0,
  },
  errorBanner: {
    padding: '8px 16px',
    background: 'rgba(248,113,113,0.1)',
    borderBottom: '1px solid rgba(248,113,113,0.25)',
    color: 'var(--error)',
    fontSize: '13px',
    flexShrink: 0,
  },
  loadingOverlay: {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '12px',
    zIndex: 10,
    background: 'var(--bg-base)',
    pointerEvents: 'none',
  },
  loadingSpinner: {
    width: '36px',
    height: '36px',
    border: '3px solid var(--bg-elevated)',
    borderTop: '3px solid var(--accent)',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
  loadingText: {
    margin: 0,
    color: 'var(--text-secondary)',
    fontSize: '14px',
  },
  mapContainer: {
    width: '100%',
    height: '100%',
    minHeight: '400px',
  },
  legend: {
    position: 'absolute',
    bottom: '12px',
    left: '8px',
    zIndex: 1000,
    background: 'var(--bg-surface)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-md)',
    padding: '6px 10px',
    display: 'flex',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: '4px 10px',
    boxShadow: 'var(--shadow-md)',
    maxWidth: 'calc(100vw - 70px)',
  },
  legendItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  legendLabel: {
    fontSize: '12px',
    color: 'var(--text-secondary)',
  },
  legendUser: {
    width: '18px',
    height: '18px',
    borderRadius: '50%',
    border: '2px solid var(--accent)',
    background: 'var(--bg-elevated)',
    flexShrink: 0,
  },
  legendStore: {
    width: '18px',
    height: '18px',
    borderRadius: '4px',
    border: '2px solid var(--accent)',
    background: 'var(--bg-surface)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '10px',
    flexShrink: 0,
  },
  legendCluster: {
    width: '18px',
    height: '18px',
    borderRadius: '50%',
    border: '2px solid var(--accent)',
    background: 'var(--bg-elevated)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '10px',
    fontWeight: 700,
    color: 'var(--accent)',
    flexShrink: 0,
  },
};
