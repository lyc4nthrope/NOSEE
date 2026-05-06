import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useVirtualizer } from "@tanstack/react-virtual";

import {
  useAuthStore,
  selectIsAuthenticated,
} from "@/features/auth/store/authStore";

import { useGeoLocation, usePublications } from "@/features/publications/hooks";
import * as publicationsApi from "@/services/api/publications.api";
import { getBrands } from "@/services/api/products.api";
import PublicationCard from "@/features/publications/components/PublicationCard";
import PriceSearchFilter from "@/features/publications/components/PriceSearchFilter";
import { useLanguage } from "@/contexts/LanguageContext";
import { isAdmin } from "@/types";
import { INFINITE_SCROLL_CONFIG } from "@/config/infiniteScroll";
import { useInfiniteScrollTrigger } from "@/hooks/useInfiniteScrollTrigger";

// ─── Iconos SVG inline ────────────────────────────────────────────────────────
const SearchIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
);

const FilterIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
  </svg>
);

const EmptyIcon = () => (
  <svg
    width="48"
    height="48"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1"
    opacity="0.6"
  >
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm3.5-9c.83 0 1.5-.67 1.5-1.5S16.33 8 15.5 8 14 8.67 14 9.5s.67 1.5 1.5 1.5zm-7 0c.83 0 1.5-.67 1.5-1.5S9.33 8 8.5 8 7 8.67 7 9.5 7.67 11 8.5 11zm3.5 6.5c2.33 0 4.31-1.46 5.11-3.5H6.89c.8 2.04 2.78 3.5 5.11 3.5z" />
  </svg>
);

// ─── useColumnCount — sincroniza con los breakpoints del grid CSS ─────────────
function useColumnCount() {
  const [cols, setCols] = useState(() => {
    if (window.innerWidth <= 560) return 1;
    if (window.innerWidth <= 1023) return 2;
    return 3;
  });
  useEffect(() => {
    const handler = () => {
      if (window.innerWidth <= 560) setCols(1);
      else if (window.innerWidth <= 1023) setCols(2);
      else setCols(3);
    };
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);
  return cols;
}

// ─── HomePage ─────────────────────────────────────────────────────────────────
export default function HomePage() {
  const { t } = useLanguage();
  const th = t.home;

  const isAuthenticated = useAuthStore(selectIsAuthenticated);
  const user = useAuthStore((s) => s.user);

  // ── 4.2: Filter state — full shape (matches PublicationsPage pattern) ──────
  const [filters, setFilters] = useState({
    productId: null,
    productName: "",
    storeName: "",
    storeId: null,
    categoryId: null,
    brandId: null,
    brandName: "",
    minPrice: null,
    maxPrice: null,
    maxDistance: null,
    sortBy: "recent",
    limit: INFINITE_SCROLL_CONFIG.homePageSize,
  });

  const {
    publications,
    loading,
    hasMore,
    loadMore,
    setFilters: setPublicationFilters,
    clearFilters,
    validatePublication,
    downvotePublication,
    unvotePublication,
    reportPublication,
    removePublication,
  } = usePublications(filters);

  const { latitude, longitude } = useGeoLocation({ autoFetch: true });

  const navigate = useNavigate();

  // ── 4.5: useSearchParams for ?pub=<id> legacy redirect ───────────────────
  const [searchParams] = useSearchParams();

  // ── 4.4: Search state ─────────────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState("");
  const [searchSuggestions, setSearchSuggestions] = useState([]);
  const [searchFocused, setSearchFocused] = useState(false);
  const searchBoxRef = useRef(null);

  // ── Misc state ────────────────────────────────────────────────────────────
  const [showFilters, setShowFilters] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [error, setError] = useState(null);
  const [geolocationLoading, setGeolocationLoading] = useState(false);
  const [categories, setCategories] = useState([]);
  const [brands, setBrands] = useState([]);

  // ── 4.3: cachedLocationRef for on-demand geolocation ─────────────────────
  const cachedLocationRef = useRef(null);

  const hasInitializedRef = useRef(false);
  const lastLocationCoordsRef = useRef(null);
  const hasStoreNameInitRef = useRef(false);

  // ── Virtualización ────────────────────────────────────────────────────────
  const columnCount = useColumnCount();
  const seenIdsRef = useRef(new Set());

  // ── Load categories ───────────────────────────────────────────────────────
  useEffect(() => {
    let active = true;

    const loadCategories = async () => {
      const firstAttempt = await publicationsApi.getProductCategories();

      if (firstAttempt.success) {
        if (active) setCategories(firstAttempt.data || []);
        return;
      }

      // Reintento corto para fallos transitorios en móvil (token/red al volver al tab).
      const secondAttempt = await publicationsApi.getProductCategories();
      if (secondAttempt.success) {
        if (active) setCategories(secondAttempt.data || []);
        return;
      }

      console.error("No se pudieron cargar categorías:", secondAttempt.error || firstAttempt.error);
    };

    loadCategories();
    return () => {
      active = false;
    };
  }, []);

  // ── Load brands ───────────────────────────────────────────────────────────
  useEffect(() => {
    let active = true;
    const loadBrands = async () => {
      const result = await getBrands();
      if (result.success && active) {
        setBrands(result.data || []);
      }
    };
    loadBrands();
    return () => {
      active = false;
    };
  }, []);

  // ── Initialize filters with geolocation on first render ──────────────────
  useEffect(() => {
    if (hasInitializedRef.current) return;
    hasInitializedRef.current = true;
    setPublicationFilters((prev) => ({
      ...prev,
      latitude: latitude || null,
      longitude: longitude || null,
      sortBy: "recent",
    }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [latitude, longitude]);

  // ── Update filters when geolocation changes ───────────────────────────────
  useEffect(() => {
    if (!hasInitializedRef.current) return;
    const coordsKey =
      latitude && longitude ? `${latitude},${longitude}` : "no-location";
    if (lastLocationCoordsRef.current === coordsKey) return;
    lastLocationCoordsRef.current = coordsKey;
    if (latitude && longitude) {
      setPublicationFilters((prev) => ({ ...prev, latitude, longitude, sortBy: "recent" }));
    }
  }, [latitude, longitude, setPublicationFilters]);

  // ── 4.5: ?pub=<id> legacy redirect ───────────────────────────────────────
  useEffect(() => {
    const pubId = searchParams.get("pub");
    if (!pubId) return;
    navigate(`/publicaciones/${pubId}`, { replace: true });
  }, [searchParams, navigate]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── ?storeId=<id>&storeName=<name> — aplicar filtro de tienda desde URL ──
  useEffect(() => {
    const storeId = searchParams.get("storeId");
    const storeName = searchParams.get("storeName");
    if (!storeId && !storeName) return;

    if (storeId) {
      const numericStoreId = Number(storeId);
      const validStoreId = Number.isFinite(numericStoreId) && numericStoreId > 0 ? numericStoreId : null;
      const decodedName = storeName ? decodeURIComponent(storeName).trim() : "";
      setFilters((prev) => ({ ...prev, storeId: validStoreId, storeName: decodedName }));
      setPublicationFilters((prev) => ({ ...prev, storeId: validStoreId, storeName: decodedName }));
    } else {
      const decoded = decodeURIComponent(storeName).trim();
      if (!decoded) return;
      setFilters((prev) => ({ ...prev, storeName: decoded, storeId: null }));
      setPublicationFilters((prev) => ({ ...prev, storeName: decoded, storeId: null }));
    }
    // Limpiar URL para evitar re-aplicar si el usuario navega dentro de la página
    navigate("/", { replace: true });
  }, [searchParams]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── 4.4: Debounced search suggestions (200ms) ─────────────────────────────
  useEffect(() => {
    if (searchQuery.trim().length < 2) {
      setSearchSuggestions([]);
      return;
    }

    const timeoutId = setTimeout(async () => {
      const result = await publicationsApi.searchProductsAndBrands(searchQuery, 8);
      if (result.success) {
        setSearchSuggestions(result.data || []);
      }
    }, 200);

    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  // ── Close suggestions on outside click ───────────────────────────────────
  useEffect(() => {
    const closeOnOutsideClick = (event) => {
      if (!searchBoxRef.current?.contains(event.target)) {
        setSearchFocused(false);
      }
    };

    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, []);

  const normalizedPublications = useMemo(
    () =>
      publications.map((publication) => ({
        ...publication,
        validated_count: Array.isArray(publication.validated_count)
          ? publication.validated_count.length
          : publication.validated_count || 0,
        product: publication.product || publication.products,
        store: publication.store || publication.stores,
      })),
    [publications],
  );

  // ── 4.3: handleFilterChange (copied from PublicationsPage) ───────────────
  const handleFilterChange = (newFilters) => {
    seenIdsRef.current = new Set();
    setFilters(newFilters);

    const shouldUseBestMatch = String(newFilters.sortBy || '') === 'best_match';

    const requestGeolocationAndApply = () => {
      // Si el hook ya tiene ubicación (stored o reciente), usarla directamente
      if (latitude && longitude) {
        cachedLocationRef.current = { latitude, longitude };
        setPublicationFilters({ ...newFilters, latitude, longitude });
        return;
      }

      if (!navigator.geolocation) {
        setError("Tu navegador no soporta geolocalización. No se puede aplicar el filtro de distancia.\nYour browser does not support geolocation. Distance filter cannot be applied.");
        setPublicationFilters({ ...newFilters, latitude: null, longitude: null });
        return;
      }

      setGeolocationLoading(true);
      navigator.geolocation.getCurrentPosition(
        ({ coords }) => {
          cachedLocationRef.current = { latitude: coords.latitude, longitude: coords.longitude };
          setGeolocationLoading(false);
          setPublicationFilters({
            ...newFilters,
            latitude: coords.latitude,
            longitude: coords.longitude,
          });
        },
        () => {
          setGeolocationLoading(false);
          // Fallback: usar la ubicación que ya tiene el hook (stored o IP)
          if (latitude && longitude) {
            cachedLocationRef.current = { latitude, longitude };
            setPublicationFilters({ ...newFilters, latitude, longitude });
          } else {
            setError("No se pudo obtener tu ubicación. El filtro de distancia requiere permiso de ubicación en el navegador.\nCould not get your location. The distance filter requires location permission in the browser.");
            setPublicationFilters({ ...newFilters, latitude: null, longitude: null });
          }
        },
        { timeout: 10000 },
      );
    };

    if (newFilters.maxDistance) {
      if (cachedLocationRef.current) {
        setPublicationFilters({
          ...newFilters,
          latitude: cachedLocationRef.current.latitude,
          longitude: cachedLocationRef.current.longitude,
        });
      } else if (!geolocationLoading) {
        requestGeolocationAndApply();
      } else {
        setPublicationFilters({ ...newFilters });
      }
    } else if (!newFilters.maxDistance && filters.maxDistance) {
      cachedLocationRef.current = null;
      setPublicationFilters({ ...newFilters, latitude: null, longitude: null });
    } else {
      if (shouldUseBestMatch) {
        if (cachedLocationRef.current) {
          setPublicationFilters({
            ...newFilters,
            latitude: cachedLocationRef.current.latitude,
            longitude: cachedLocationRef.current.longitude,
          });
        } else if (!geolocationLoading) {
          requestGeolocationAndApply();
        } else {
          setPublicationFilters(newFilters);
        }
      } else {
        setPublicationFilters(newFilters);
      }
    }
  };

  // ── Search handler ────────────────────────────────────────────────────────
  const handleSearch = (query) => {
    setSearchQuery(query);
    setFilters((prev) => {
      const merged = { ...prev, productId: null, productName: query };
      setPublicationFilters({
        ...merged,
        sortBy: query?.trim() ? "best_match" : (merged.sortBy || "recent"),
      });
      return merged;
    });
  };

  const handleOpenDetail = useCallback((publicationId) => {
    navigate(`/publicaciones/${publicationId}`);
  }, [navigate]);

  const handleValidate = useCallback(async (publicationId, userVote) => {
    if (userVote === 1) {
      await unvotePublication(publicationId);
    } else {
      if (userVote === -1) await unvotePublication(publicationId);
      await validatePublication(publicationId);
    }
  }, [unvotePublication, validatePublication]);

  const handleDownvote = useCallback(async (publicationId, userVote) => {
    if (userVote === -1) {
      await unvotePublication(publicationId);
    } else {
      if (userVote === 1) await unvotePublication(publicationId);
      await downvotePublication(publicationId);
    }
  }, [downvotePublication, unvotePublication]);

  const handleReport = useCallback(async (publicationId, reportPayload) => {
    const result = await reportPublication(publicationId, reportPayload);

    if (result.success) {
      setFeedback({
        type: 'success',
        message: result.message || th.reportSuccess,
      });
    } else {
      setFeedback({
        type: 'error',
        message: result.message || result.error || th.reportError,
      });
    }

    setTimeout(() => setFeedback(null), 5000);
    return result;
  }, [reportPublication, th.reportSuccess, th.reportError]);

  // ── 4.9: handleRequireAuth — navigate to /login instead of alert ──────────
  const handleRequireAuth = useCallback(() => {
    navigate('/login', { state: { from: '/' } });
  }, [navigate]);

  const handleDelete = useCallback(async (publicationId) => {
    const result = await publicationsApi.deletePublication(publicationId);
    if (result.success) {
      removePublication(publicationId);
    }
  }, [removePublication]);

  // ── 4.8: handlePublish — FAB click handler ────────────────────────────────
  const handlePublish = () => {
    if (!isAuthenticated) { navigate('/login'); return; }
    if (!user?.isVerified) return; // disabled state handles this visually
    navigate('/publicaciones/nueva');
  };

  useInfiniteScrollTrigger({
    hasMore,
    loading,
    onLoadMore: loadMore,
    triggerDistancePx: INFINITE_SCROLL_CONFIG.triggerDistancePx,
    cooldownMs: INFINITE_SCROLL_CONFIG.cooldownMs,
  });

  const rows = useMemo(() => {
    const result = [];
    for (let i = 0; i < normalizedPublications.length; i += columnCount) {
      result.push(normalizedPublications.slice(i, i + columnCount));
    }
    return result;
  }, [normalizedPublications, columnCount]);

  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => document.getElementById('main-content'),
    estimateSize: () => 504, // ~480px card + 24px gap
    overscan: 3,
  });

  return (
    <div className="home-wrapper">
      {/* ── 4.7: Grid CSS with media queries ── */}
      <style>{`
        .home-pub-grid{grid-template-columns:repeat(3,1fr)}
        @media(max-width:1023px){ .home-pub-grid{grid-template-columns:repeat(2,1fr)} }
        @media(max-width:560px){  .home-pub-grid{grid-template-columns:1fr} }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pubFadeIn {
          from { opacity: 0; transform: translateY(14px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @media(hover:none){.pub-card-menu-trigger{opacity:1!important}}
      `}</style>

      <section className="banner">
        <h1>{th.title}</h1>
        <p>{th.subtitle}</p>
      </section>

      {/* ── 4.6: Search bar + PriceSearchFilter (replaces category carousel) ── */}
      <section style={{ width: "100%" }}>
        {/* Error message */}
        {error && (
          <div
            role="alert"
            aria-live="assertive"
            style={{
              padding: "12px 16px",
              background: "var(--error-soft)",
              border: "1px solid rgba(239,68,68,0.3)",
              borderRadius: "var(--radius-md)",
              color: "var(--error)",
              fontSize: "13px",
              marginBottom: "16px",
              whiteSpace: "pre-line",
            }}
          >
            {error}
          </div>
        )}

        {/* Barra de búsqueda + botón Filtrar */}
        <div style={{ display: "flex", gap: "8px", alignItems: "center", marginBottom: "8px" }}>
          <div
            ref={searchBoxRef}
            style={{
              position: "relative",
              zIndex: 1,
              flex: 1,
              background: "rgba(255,255,255,0.04)",
              border: searchFocused ? "1px solid var(--accent)" : "1px solid rgba(255,255,255,0.09)",
              backdropFilter: "blur(10px)",
              borderRadius: "var(--radius-lg)",
              padding: "12px 16px",
              display: "flex",
              gap: "12px",
              alignItems: "center",
            }}
          >
            <SearchIcon aria-hidden="true" />
            <input
              type="search"
              aria-label={th.searchPlaceholder}
              placeholder={th.searchPlaceholder}
              value={searchQuery}
              onFocus={() => setSearchFocused(true)}
              onChange={(e) => handleSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleSearch(searchQuery);
                }
              }}
              style={{
                flex: 1,
                background: "transparent",
                border: "none",
                color: "var(--text-primary)",
                fontSize: "14px",
                outline: "none",
                fontFamily: "inherit",
              }}
            />
            {searchFocused && searchSuggestions.length > 0 && (
              <div
                style={{
                  position: "absolute",
                  top: "calc(100% + 6px)",
                  left: 0,
                  right: 0,
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius-md)",
                  background: "var(--bg-surface)",
                  zIndex: 20,
                  boxShadow: "0 10px 25px rgba(0,0,0,0.12)",
                  overflow: "hidden",
                }}
              >
                {searchSuggestions.map((item) => (
                  <button
                    key={`${item.type}-${item.id}`}
                    type="button"
                    onClick={() => {
                      const nextQuery = item.value;
                      setSearchQuery(nextQuery);
                      setFilters((prev) => {
                        const nextFilters = {
                          ...prev,
                          productId: item.type === "product" ? item.id : null,
                          productName: nextQuery,
                          sortBy: "best_match",
                        };
                        setPublicationFilters(nextFilters);
                        return nextFilters;
                      });
                      setSearchSuggestions([]);
                      setSearchFocused(false);
                    }}
                    style={{
                      width: "100%",
                      textAlign: "left",
                      padding: "10px 12px",
                      border: "none",
                      background: "transparent",
                      color: "var(--text-primary)",
                      cursor: "pointer",
                      borderBottom: "1px solid var(--border)",
                    }}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Botón Filtrar */}
          <button
            onClick={() => setShowFilters((prev) => !prev)}
            style={{
              background: showFilters ? 'var(--accent)' : 'var(--surface-container-high, #141f38)',
              color: showFilters ? '#002b3d' : 'var(--text-primary)',
              border: '1px solid rgba(64,72,93,0.3)',
              borderRadius: '12px',
              padding: '12px 24px',
              fontWeight: 600,
              fontSize: '14px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              transition: 'background 0.15s, color 0.15s',
              minHeight: '44px',
              flexShrink: 0,
            }}
            onMouseEnter={(e) => { if (!showFilters) e.currentTarget.style.background = 'var(--bg-hover, #1f2b49)'; }}
            onMouseLeave={(e) => { if (!showFilters) e.currentTarget.style.background = 'var(--surface-container-high, #141f38)'; }}
          >
            <FilterIcon aria-hidden="true" />
            Filtrar
          </button>
        </div>

        {/* Filtros activos como tags + panel expandible */}
        <PriceSearchFilter
          filters={filters}
          onFiltersChange={handleFilterChange}
          open={showFilters}
          distanceLoading={geolocationLoading}
          categories={categories}
          brands={brands}
          userLat={latitude}
          userLng={longitude}
          onClearFilters={() => {
            cachedLocationRef.current = null;
            setGeolocationLoading(false);
            setFilters((prev) => ({
              ...prev,
              productId: null,
              productName: "",
              storeName: "",
              storeId: null,
              categoryId: null,
              brandId: null,
              brandName: "",
              minPrice: null,
              maxPrice: null,
              maxDistance: null,
              sortBy: "recent",
            }));
            setSearchQuery("");
            seenIdsRef.current = new Set();
            clearFilters();
          }}
        />
      </section>

      <div style={{ width: "100%" }}>
        <div>
          {loading && normalizedPublications.length === 0 ? (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                padding: "60px 20px",
                color: "var(--text-muted)",
              }}
            >
              <div
                style={{
                  width: "40px",
                  height: "40px",
                  border: "3px solid rgba(56,189,248,0.15)",
                  borderTop: "3px solid var(--accent, #38BDF8)",
                  borderRadius: "50%",
                  animation: "spin 0.8s linear infinite",
                  marginBottom: "16px",
                }}
              />
              <p role="status" aria-live="polite" style={{ fontSize: "14px" }}>
                {th.loading}
              </p>
            </div>
          ) : !loading && normalizedPublications.length === 0 ? (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                padding: "80px 20px",
                color: "var(--text-muted)",
                textAlign: "center",
              }}
            >
              <EmptyIcon />
              <h2
                style={{
                  fontSize: "18px",
                  fontWeight: "600",
                  color: "var(--text-secondary)",
                  marginTop: "16px",
                  marginBottom: "8px",
                }}
              >
                {th.noPublicationsTitle || th.noPublications}
              </h2>
              <p style={{ fontSize: "14px", maxWidth: "320px", lineHeight: "1.6" }}>
                {th.noPublicationsDesc}{" "}
                <button
                  onClick={handlePublish}
                  style={{
                    background: "none",
                    border: "none",
                    color: "var(--accent)",
                    cursor: "pointer",
                    fontWeight: "600",
                    textDecoration: "underline",
                  }}
                >
                  {th.beFirst}
                </button>
                .
              </p>
            </div>
          ) : (
            // ── 4.7: Grid virtualizado por filas ──
            <div style={{ height: `${rowVirtualizer.getTotalSize()}px`, position: 'relative' }}>
              {rowVirtualizer.getVirtualItems().map((virtualRow) => (
                <div
                  key={virtualRow.key}
                  data-index={virtualRow.index}
                  ref={rowVirtualizer.measureElement}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    transform: `translateY(${virtualRow.start}px)`,
                    paddingBottom: '24px',
                  }}
                >
                  <div className="home-pub-grid" style={{ display: 'grid', gap: '24px' }}>
                    {rows[virtualRow.index].map((pub) => {
                      const isNew = !seenIdsRef.current.has(pub.id);
                      if (isNew) seenIdsRef.current.add(pub.id);
                      return (
                        <div
                          key={pub.id}
                          style={isNew ? { animation: 'pubFadeIn 0.32s ease both' } : undefined}
                        >
                          <PublicationCard
                            publication={pub}
                            isAuthenticated={isAuthenticated}
                            isAuthor={user?.id === pub.user_id || user?.id === pub.user?.id}
                            isAdmin={isAdmin(user?.role)}
                            onRequireAuth={handleRequireAuth}
                            onValidate={handleValidate}
                            onDownvote={handleDownvote}
                            onReport={handleReport}
                            onDelete={handleDelete}
                            onViewMore={handleOpenDetail}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {normalizedPublications.length > 0 && (
          <div
            aria-hidden="true"
            style={{
              display: "flex",
              justifyContent: "center",
              marginTop: "28px",
              paddingTop: "24px",
              borderTop: "1px solid var(--border)",
              minHeight: "48px",
            }}
          >
            {loading && (
              <span style={{ color: "var(--text-muted)", fontSize: "14px" }}>
                {th.loading}
              </span>
            )}
            {!hasMore && !loading && (
              <span style={{ color: "var(--text-secondary)", fontSize: "14px", fontWeight: 500 }}>
                — Sin más resultados —
              </span>
            )}
          </div>
        )}
      </div>

      {/* ── 4.8: Contribuir FAB ── */}
      <button
        type="button"
        className="pub-create-fab"
        onClick={handlePublish}
        disabled={isAuthenticated && !user?.isVerified}
        aria-label={th.contribuir || "Contribuir"}
        title={isAuthenticated && !user?.isVerified ? th.verifyEmailTitle : (th.contribuir || "Contribuir")}
        style={{
          position: 'fixed',
          bottom: '32px',
          right: '32px',
          zIndex: 50,
          background: 'linear-gradient(135deg, var(--accent, #3bbffa), var(--primary-container, #22b1ec))',
          color: '#002b3d',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          paddingLeft: '20px',
          paddingRight: '24px',
          paddingTop: '16px',
          paddingBottom: '16px',
          borderRadius: '16px',
          border: 'none',
          cursor: (isAuthenticated && !user?.isVerified) ? 'not-allowed' : 'pointer',
          boxShadow: '0 8px 32px rgba(59,191,250,0.30)',
          fontWeight: 700,
          fontSize: '15px',
          letterSpacing: '-0.01em',
          opacity: (isAuthenticated && !user?.isVerified) ? 0.5 : 1,
          transition: 'transform 0.2s ease, box-shadow 0.2s ease',
        }}
        onMouseEnter={(e) => {
          if (isAuthenticated && !user?.isVerified) return;
          e.currentTarget.style.transform = 'scale(1.05)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'scale(1)';
        }}
        onMouseDown={(e) => {
          if (isAuthenticated && !user?.isVerified) return;
          e.currentTarget.style.transform = 'scale(0.95)';
        }}
        onMouseUp={(e) => {
          if (isAuthenticated && !user?.isVerified) return;
          e.currentTarget.style.transform = 'scale(1.05)';
        }}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
        <span>{th.contribuir || "Contribuir"}</span>
      </button>

      {/* Feedback Toast */}
      {feedback && (
        <div
          style={{
            position: 'fixed',
            bottom: '96px',
            right: '32px',
            padding: '16px 20px',
            borderRadius: '8px',
            background: feedback.type === 'success' ? 'var(--success)' : 'var(--error)',
            color: 'var(--text-primary)',
            fontSize: '14px',
            fontWeight: 600,
            zIndex: 2000,
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            maxWidth: '300px',
            animation: 'slideInUp 0.3s ease-out',
          }}
        >
          {feedback.message}
        </div>
      )}
    </div>
  );
}
