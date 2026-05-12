import { useState, useEffect, useRef } from 'react';
import { getAllPhysicalStoresWithLocation, getPhysicalStoresFiltered } from '@/services/api/stores.api';
import { useAuthStore, selectAuthUser } from '@/features/auth/store/authStore';

const LEAFLET_CSS   = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
const LEAFLET_JS    = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
const CLUSTER_CSS   = 'https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.css';
const CLUSTER_CSS_D = 'https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.Default.css';
const CLUSTER_JS    = 'https://unpkg.com/leaflet.markercluster@1.5.3/dist/leaflet.markercluster.js';

const DEFAULT_CENTER    = { lat: 4.711, lng: -74.0721 };
const DEFAULT_ZOOM      = 14;
const GEO_TIMEOUT_MS    = 10000;
const VIEWPORT_PAD      = 0.4;  // 40% buffer beyond visible bounds
const PAN_DEBOUNCE_MS   = 250;  // wait for pan/zoom to settle before re-filtering
const CACHE_TTL_MS      = 5 * 60 * 1000;

const TILE_LAYERS = {
  dark:         { url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',  attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> © <a href="https://carto.com/attributions">CARTO</a>' },
  light:        { url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> © <a href="https://carto.com/attributions">CARTO</a>' },
  highContrast: { url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',  attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> © <a href="https://carto.com/attributions">CARTO</a>' },
};

// ─── Module-level cache ───────────────────────────────────────────────────────
// One fetch per 5 min across ALL component instances — zero server load on pan/zoom
let _storesCache    = null;
let _storesCacheAt  = 0;
let _storesFetching = null; // deduplicates concurrent requests during the same tick

async function fetchPhysicalStores() {
  if (_storesCache && Date.now() - _storesCacheAt < CACHE_TTL_MS) {
    return _storesCache;
  }
  if (_storesFetching) return _storesFetching;

  _storesFetching = getAllPhysicalStoresWithLocation()
    .then(res => {
      _storesFetching = null;
      if (res.success) {
        _storesCache   = (res.data ?? []).filter(s => s.latitude && s.longitude);
        _storesCacheAt = Date.now();
        return _storesCache;
      }
      return _storesCache ?? [];
    })
    .catch(() => {
      _storesFetching = null;
      return _storesCache ?? [];
    });

  return _storesFetching;
}

// ─── Viewport filter — pure client-side, no server requests ──────────────────
function getStoresInViewport(stores, map) {
  if (!stores.length || !map) return [];
  // pad() expands bounds by fraction — prevents markers popping in/out at edges
  const bounds = map.getBounds().pad(VIEWPORT_PAD);
  return stores.filter(s => bounds.contains([s.latitude, s.longitude]));
}

// ─── Marker diff — only add/remove what changed, never clearLayers ───────────
// activeMarkers: Map<storeId, L.Marker>
function syncMarkers(cluster, L, activeMarkers, nextStores, icon, onClickRef) {
  const nextIds = new Set(nextStores.map(s => s.id));

  // Remove markers no longer in viewport
  for (const [id, marker] of activeMarkers) {
    if (!nextIds.has(id)) {
      cluster.removeLayer(marker);
      activeMarkers.delete(id);
    }
  }

  // Add markers that entered the viewport
  const toAdd = [];
  for (const store of nextStores) {
    if (activeMarkers.has(store.id)) continue;
    const marker = L.marker([store.latitude, store.longitude], { icon });
    marker.bindTooltip(store.name, { permanent: false, direction: 'top', offset: [0, -38] });
    marker.on('click', () => onClickRef.current?.(store));
    activeMarkers.set(store.id, marker);
    toAdd.push(marker);
  }

  if (toAdd.length) cluster.addLayers(toAdd); // single cluster refresh for the batch
}

// ─── Leaflet loaders ──────────────────────────────────────────────────────────
// Module-level cache for CDN Leaflet.
// leaflet-src.js (npm) sets window.L = exports at evaluation time, which would
// fool the old `if (window.L) return early` guard. By caching the CDN instance
// here we're immune to npm Leaflet overwriting window.L later.
let _cdnL = null;
let _cdnClusterReady = false;

function loadStylesheet(href, attr) {
  if (document.querySelector(`link[${attr}]`)) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = href;
  link.setAttribute(attr, '');
  document.head.appendChild(link);
}

function loadScript(src, attr) {
  const existing = document.querySelector(`script[${attr}]`);
  if (existing) {
    return existing._loaded
      ? Promise.resolve()
      : new Promise((res, rej) => {
          existing.addEventListener('load', res);
          existing.addEventListener('error', () => rej(new Error(`Failed: ${src}`)));
        });
  }
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src   = src;
    script.async = true;
    script.setAttribute(attr, '');
    script.onload  = () => { script._loaded = true; resolve(); };
    script.onerror = () => reject(new Error(`Failed to load: ${src}`));
    document.body.appendChild(script);
  });
}

function ensureLeaflet() {
  if (_cdnL) return Promise.resolve(_cdnL);
  if (window.__leafletLoader) return window.__leafletLoader;
  loadStylesheet(LEAFLET_CSS, 'data-lf-css');
  window.__leafletLoader = loadScript(LEAFLET_JS, 'data-lf-js')
    .then(() => { _cdnL = window.L; return _cdnL; })
    .catch(err => { window.__leafletLoader = null; throw err; });
  return window.__leafletLoader;
}

function ensureCluster() {
  if (_cdnClusterReady) return Promise.resolve();
  if (window.__clusterLoader) return window.__clusterLoader;
  loadStylesheet(CLUSTER_CSS,   'data-mc-css');
  loadStylesheet(CLUSTER_CSS_D, 'data-mc-css-d');
  window.__clusterLoader = loadScript(CLUSTER_JS, 'data-mc-js')
    .then(() => { _cdnClusterReady = true; })
    .catch(err => { window.__clusterLoader = null; throw err; });
  return window.__clusterLoader;
}

// ─── Marker icon factories ────────────────────────────────────────────────────
function makeUserIcon(L, user) {
  const initials = user?.fullName
    ? user.fullName.trim().split(/\s+/).map(p => p[0]).slice(0, 2).join('').toUpperCase()
    : '?';
  const inner = user?.avatarUrl
    ? `<img src="${user.avatarUrl}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`
    : `<span style="font-size:16px;font-weight:700;color:var(--accent);">${initials}</span>`;
  return L.divIcon({
    className: '',
    html: `<div style="width:44px;height:44px;border-radius:50%;border:3px solid var(--accent);background:var(--bg-elevated);display:flex;align-items:center;justify-content:center;box-shadow:0 2px 12px rgba(56,189,248,.45);overflow:hidden;position:relative;">${inner}<div style="position:absolute;bottom:-2px;right:-2px;width:14px;height:14px;border-radius:50%;background:#4ade80;border:2px solid var(--bg-elevated);"></div></div>`,
    iconSize: [44, 44], iconAnchor: [22, 22], popupAnchor: [0, -24],
  });
}

function makeStoreIcon(L) {
  return L.divIcon({
    className: '',
    html: `<div style="width:36px;height:36px;border-radius:8px;border:2px solid var(--accent);background:var(--bg-surface);display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,.4);font-size:18px;cursor:pointer;transition:transform .15s;">🏬</div>`,
    iconSize: [36, 36], iconAnchor: [18, 36], popupAnchor: [0, -38],
  });
}

function makeClusterIcon(L, cluster) {
  const count = cluster.getChildCount();
  return L.divIcon({
    className: '',
    html: `<div style="width:48px;height:48px;border-radius:50%;border:2px solid var(--accent);background:var(--bg-elevated);display:flex;align-items:center;justify-content:center;flex-direction:column;box-shadow:0 2px 12px rgba(56,189,248,.3);cursor:pointer;"><span style="font-size:11px;color:var(--text-muted);">🏬</span><span style="font-size:14px;font-weight:700;color:var(--accent);">${count}</span></div>`,
    iconSize: [48, 48], iconAnchor: [24, 24],
  });
}

function getA11yTheme() {
  const cls = document.documentElement.classList;
  if (cls.contains('a11y-light-mode')) return 'light';
  if (cls.contains('a11y-high-contrast') || cls.contains('a11y-smart-contrast')) return 'highContrast';
  return 'dark';
}

// ─── Hook ─────────────────────────────────────────────────────────────────────
export function useStoresMap({ containerRef, onStoreClick, productName, categoryId }) {
  const user = useAuthStore(selectAuthUser);

  const mapRef          = useRef(null);
  const clusterRef      = useRef(null);
  const userMarkerRef   = useRef(null);
  const tileLayerRef    = useRef(null);
  const activeMarkersRef = useRef(new Map()); // Map<storeId, L.Marker>
  const storeIconRef    = useRef(null);
  const onStoreClickRef = useRef(onStoreClick);
  const panDebounceRef  = useRef(null);
  const allStoresRef    = useRef([]);          // all cached stores, kept in sync

  useEffect(() => { onStoreClickRef.current = onStoreClick; }, [onStoreClick]);

  const [userLocation,    setUserLocation]    = useState(null);
  const [locationError,   setLocationError]   = useState(null);
  const [locationLoading, setLocationLoading] = useState(true);
  const [mapReady,        setMapReady]        = useState(false);
  const [clusterReady,    setClusterReady]    = useState(false);
  const [physicalStores,  setPhysicalStores]  = useState([]);
  const [mapError,        setMapError]        = useState(null);

  // Keep allStoresRef in sync so the moveend handler always has fresh data
  useEffect(() => { allStoresRef.current = physicalStores; }, [physicalStores]);

  // Fetch stores — ONE request per 5 min, shared across all instances
  useEffect(() => {
    let cancelled = false;
    fetchPhysicalStores().then(stores => {
      if (!cancelled) setPhysicalStores(stores);
    });
    return () => { cancelled = true; };
  }, []);

  // Geolocation
  useEffect(() => {
    if (!navigator.geolocation) {
      setLocationError('Geolocalización no disponible en este dispositivo.');
      setLocationLoading(false);
      return;
    }
    let cancelled = false;
    navigator.geolocation.getCurrentPosition(
      pos => {
        if (cancelled) return;
        setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocationLoading(false);
      },
      () => {
        if (cancelled) return;
        setLocationError('No se pudo obtener tu ubicación. El mapa se centrará en Bogotá.');
        setLocationLoading(false);
      },
      { enableHighAccuracy: true, timeout: GEO_TIMEOUT_MS, maximumAge: 30000 }
    );
    return () => { cancelled = true; };
  }, []);

  // Load Leaflet + MarkerCluster
  useEffect(() => {
    let cancelled = false;
    ensureLeaflet()
      .then(() => ensureCluster())
      .then(() => { if (!cancelled) setMapReady(true); })
      .catch(() => { if (!cancelled) setMapError('No se pudo cargar el mapa. Verificá tu conexión.'); });
    return () => { cancelled = true; };
  }, []);

  // Init map + viewport listener
  useEffect(() => {
    if (!mapReady || locationLoading || !containerRef.current || mapRef.current) return;
    const L      = _cdnL;
    const center = userLocation ?? DEFAULT_CENTER;

    const map = L.map(containerRef.current, {
      center: [center.lat, center.lng],
      zoom: DEFAULT_ZOOM,
      zoomControl: true,
    });

    const tileCfg = TILE_LAYERS[getA11yTheme()];
    tileLayerRef.current = L.tileLayer(tileCfg.url, {
      attribution: tileCfg.attribution,
      subdomains: 'abcd',
      maxZoom: 19,
    }).addTo(map);
    mapRef.current = map;

    const cluster = L.markerClusterGroup({
      iconCreateFunction: c => makeClusterIcon(L, c),
      maxClusterRadius: 80,
      disableClusteringAtZoom: 18,
      spiderfyOnMaxZoom: true,
      showCoverageOnHover: false,
      zoomToBoundsOnClick: true,
      chunkedLoading: true,
      chunkSize: 200,
      chunkInterval: 100,
      chunkDelay: 50,
    });
    clusterRef.current   = cluster;
    storeIconRef.current = makeStoreIcon(L);
    map.addLayer(cluster);
    setClusterReady(true);

    // Re-sync markers on pan/zoom — debounced to avoid thrashing
    function handleViewChange() {
      clearTimeout(panDebounceRef.current);
      panDebounceRef.current = setTimeout(() => {
        const cl      = clusterRef.current;
        const icon    = storeIconRef.current;
        const markers = activeMarkersRef.current;
        if (!cl || !icon) return;
        const next = getStoresInViewport(allStoresRef.current, map);
        syncMarkers(cl, L, markers, next, icon, onStoreClickRef);
      }, PAN_DEBOUNCE_MS);
    }

    map.on('moveend', handleViewChange);
    map.on('zoomend', handleViewChange);

    return () => {
      clearTimeout(panDebounceRef.current);
      map.off('moveend', handleViewChange);
      map.off('zoomend', handleViewChange);
      map.remove();
      mapRef.current         = null;
      clusterRef.current     = null;
      userMarkerRef.current  = null;
      tileLayerRef.current   = null;
      storeIconRef.current   = null;
      activeMarkersRef.current.clear();
      setClusterReady(false);
    };
  }, [mapReady, locationLoading, userLocation, containerRef]);

  // Swap tile layer on a11y theme change
  useEffect(() => {
    const observer = new MutationObserver(() => {
      const map = mapRef.current;
      const L   = _cdnL;
      if (!map || !L || !tileLayerRef.current) return;
      const tileCfg = TILE_LAYERS[getA11yTheme()];
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

  // User location marker
  useEffect(() => {
    const map = mapRef.current;
    const L   = _cdnL;
    if (!map || !L || !userLocation) return;
    if (userMarkerRef.current) {
      userMarkerRef.current.setLatLng([userLocation.lat, userLocation.lng]);
      return;
    }
    const marker = L.marker([userLocation.lat, userLocation.lng], {
      icon: makeUserIcon(L, user),
      zIndexOffset: 1000,
    });
    marker.bindTooltip('Tu ubicación', { permanent: false, direction: 'top', offset: [0, -26] });
    marker.addTo(map);
    userMarkerRef.current = marker;
    map.setView([userLocation.lat, userLocation.lng], DEFAULT_ZOOM);
  }, [mapReady, userLocation, user]);

  // Initial marker sync once cluster + stores are both ready
  useEffect(() => {
    const cluster = clusterRef.current;
    const map     = mapRef.current;
    const L       = _cdnL;
    const icon    = storeIconRef.current;
    if (!clusterReady || !cluster || !map || !L || !icon || !physicalStores.length) return;

    const next = getStoresInViewport(allStoresRef.current, map);
    syncMarkers(cluster, L, activeMarkersRef.current, next, icon, onStoreClickRef);
  }, [clusterReady, physicalStores]);

  // Re-sync markers when product/category filter changes
  useEffect(() => {
    const hasFilter = productName?.trim() || categoryId;

    if (!hasFilter) {
      // Filter cleared: allStoresRef already in sync via the dedicated effect
      const cluster = clusterRef.current;
      const map     = mapRef.current;
      const L       = _cdnL;
      const icon    = storeIconRef.current;
      if (cluster && map && L && icon) {
        const next = getStoresInViewport(allStoresRef.current, map);
        syncMarkers(cluster, L, activeMarkersRef.current, next, icon, onStoreClickRef);
      }
      return;
    }

    let cancelled = false;
    getPhysicalStoresFiltered({ productName, categoryId }).then(res => {
      if (cancelled) return;
      const filtered = res.success ? res.data : [];
      allStoresRef.current = filtered;
      const cluster = clusterRef.current;
      const map     = mapRef.current;
      const L       = _cdnL;
      const icon    = storeIconRef.current;
      if (cluster && map && L && icon) {
        const next = getStoresInViewport(filtered, map);
        syncMarkers(cluster, L, activeMarkersRef.current, next, icon, onStoreClickRef);
      }
    });
    return () => { cancelled = true; };
  }, [productName, categoryId]);

  return { isLoading: locationLoading || !mapReady, locationError, mapError };
}
