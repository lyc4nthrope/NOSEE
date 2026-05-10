// DEPRECATED — route removed, kept for reference
/**
 * PublicationsPage - Listado de publicaciones de precios
 *
 * Ruta: /publicaciones (protegida)
 * Ubicación: src/features/publications/pages/PublicationsPage.jsx
 *
 * Muestra el listado de publicaciones de precios con búsqueda y filtros.
 * Los usuarios pueden ver publicaciones de otros, validarlas y reportar abusos.
 *
 * Features:
 * - Búsqueda y filtrado avanzado
 * - Grid responsivo de publicaciones
 * - Estados de carga y vacío
 * - Botón para crear nuevas publicaciones
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

// State Management
import { useAuthStore, selectAuthUser } from "@/features/auth/store/authStore";
import { isAdmin } from "@/types";
import { useLanguage } from "@/contexts/LanguageContext";

// Componentes de publicaciones
import PriceSearchFilter from "@/features/publications/components/PriceSearchFilter";
import PublicationCard from "@/features/publications/components/PublicationCard";

import { usePublications } from "@/features/publications/hooks";
import * as publicationsApi from "@/services/api/publications.api";
import { usePublicationsStore } from "@/features/publications/store/publicationsStore";
import { INFINITE_SCROLL_CONFIG } from "@/config/infiniteScroll";
import { useInfiniteScrollTrigger } from "@/hooks/useInfiniteScrollTrigger";

// Iconos SVG inline
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

const SortIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="3" y1="6" x2="21" y2="6" />
    <line x1="3" y1="12" x2="15" y2="12" />
    <line x1="3" y1="18" x2="9" y2="18" />
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

/**
 * Componente principal: PublicationsPage
 * Maneja el listado, búsqueda y filtrado de publicaciones
 */
export default function PublicationsPage() {
  // ─────────────────────────────────────────────────────────────
  // PASO 1: Estado del usuario desde store
  // ─────────────────────────────────────────────────────────────
  const user = useAuthStore(selectAuthUser);
  const { t, tbi } = useLanguage();
  const tp = t.publications;

  // ─────────────────────────────────────────────────────────────
  // PASO 2: Hooks de navegación
  // ─────────────────────────────────────────────────────────────
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // ─────────────────────────────────────────────────────────────
  // PASO 3: Estado local de la página
  // ─────────────────────────────────────────────────────────────
  const [showFilters, setShowFilters] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filters, setFilters] = useState({
    productId: null,
    productName: "",
    storeName: "",
    categoryId: null,
    minPrice: null,
    maxPrice: null,
    maxDistance: null,
    sortBy: "recent",
    limit: INFINITE_SCROLL_CONFIG.publicationsPageSize,
  });
  const [error, setError] = useState(null);
  const [geolocationLoading, setGeolocationLoading] = useState(false);
  const cachedLocationRef = useRef(null);
  const [feedback, setFeedback] = useState(null);
  const categories = usePublicationsStore((s) => s.categories);
  const loadCategories = usePublicationsStore((s) => s.loadCategories);
  const [searchSuggestions, setSearchSuggestions] = useState([]);
  const [searchFocused, setSearchFocused] = useState(false);
  const searchBoxRef = useRef(null);

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

  const normalizedPublications = useMemo(
    () => publications.map((publication) => ({
      ...publication,
      user: publication.user || publication.users || null,
      product: publication.product || publication.products || null,
      store: publication.store || publication.stores || null,
    })),
    [publications]
  );

  useInfiniteScrollTrigger({
    hasMore,
    loading,
    onLoadMore: loadMore,
    triggerDistancePx: INFINITE_SCROLL_CONFIG.triggerDistancePx,
    cooldownMs: INFINITE_SCROLL_CONFIG.cooldownMs,
  });

  // ─────────────────────────────────────────────────────────────
  // PASO 4: Funciones de manejo de eventos
  // ─────────────────────────────────────────────────────────────

  /**
   * Maneja clic en botón "Crear publicacion"
   * Redirige al formulario de crear publicación
   */
  const handlePublish = () => {
    if (!user?.isVerified) {
      setError(tbi(tr => tr.publications.verifyEmailError));
      return;
    }
    navigate("/publicaciones/nueva");
  };

  /**
   * Maneja cambios en la búsqueda
   */
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

  /**
   * Maneja cambios en filtros.
   * Cuando cambia maxDistance, solicita geolocalización al navegador
   * para pasar lat/lng al hook y activar el filtro de distancia en la API.
   * Cachea la ubicación para no re-solicitarla en cada cambio de filtro.
   */
  const handleFilterChange = (newFilters) => {
    setFilters(newFilters);

    const shouldUseBestMatch = String(newFilters.sortBy || '') === 'best_match';

    const requestGeolocationAndApply = () => {
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
          setError("No se pudo obtener tu ubicación. El filtro de distancia requiere permiso de ubicación en el navegador.\nCould not get your location. The distance filter requires location permission in the browser.");
          setPublicationFilters({ ...newFilters, latitude: null, longitude: null });
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
        // Reintenta cada vez que haya filtro de distancia sin coordenadas cacheadas.
        requestGeolocationAndApply();
      } else {
        // Mientras se obtiene ubicación, mantener el resto de filtros.
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

  /**
   * Maneja voto positivo (toggle; si ya tenía voto negativo, lo cambia)
   */
  const handleValidatePublication = async (publicationId) => {
    const pub = publications.find((p) => p.id === publicationId);
    if (pub?.user_vote === 1) {
      const result = await unvotePublication(publicationId);
      if (!result.success) setError(result.error || tbi(tr => tr.publications.errorValidate));
    } else {
      if (pub?.user_vote === -1) await unvotePublication(publicationId);
      const result = await validatePublication(publicationId);
      if (!result.success) setError(result.error || tbi(tr => tr.publications.errorValidate));
    }
  };

  /**
   * Maneja voto negativo (toggle; si ya tenía voto positivo, lo cambia)
   */
  const handleDownvotePublication = async (publicationId) => {
    const pub = publications.find((p) => p.id === publicationId);
    if (pub?.user_vote === -1) {
      const result = await unvotePublication(publicationId);
      if (!result.success) setError(result.error || tbi(tr => tr.publications.errorValidate));
    } else {
      if (pub?.user_vote === 1) await unvotePublication(publicationId);
      const result = await downvotePublication(publicationId);
      if (!result.success) setError(result.error || tbi(tr => tr.publications.errorValidate));
    }
  };

  /**
   * Maneja reporte de publicación
   */
  const handleReportPublication = async (publicationId, reportPayload) => {
    const result = await reportPublication(publicationId, reportPayload);

    if (result.success) {
      setError(null);
      setFeedback({
        type: 'success',
        message: result.message || 'Reporte enviado correctamente.',
      });
    } else {
      const errorMessage = result.error || tbi(tr => tr.publications.errorReport);
      setError(errorMessage);
      setFeedback({
        type: 'error',
        message: errorMessage,
      });
    }
    
    // Auto-cerrar el feedback después de 5 segundos
    setTimeout(() => setFeedback(null), 5000);
    return result;
  };

  /**
   * Maneja eliminación de publicación (solo si es autor)
   */
  const handleDeletePublication = async (publicationId) => {
    const result = await publicationsApi.deletePublication(publicationId);

    if (result.success) {
      removePublication(publicationId);
      return;
    }

    setError(result.error || tbi(tr => tr.publications.errorDelete));
  };

  const handleViewMore = useCallback((publicationId) => {
    navigate(`/publicaciones/${publicationId}`);
  }, [navigate]);

  // Abre el modal de detalle si la URL tiene ?pub=<id>
  useEffect(() => { loadCategories(); }, [loadCategories]);

  useEffect(() => {
    const pubId = searchParams.get("pub");
    if (!pubId) return;
    navigate(`/publicaciones/${pubId}`, { replace: true });
  }, [searchParams, navigate]); // eslint-disable-line react-hooks/exhaustive-deps

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

  useEffect(() => {
    const closeOnOutsideClick = (event) => {
      if (!searchBoxRef.current?.contains(event.target)) {
        setSearchFocused(false);
      }
    };

    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, []);



  // ─────────────────────────────────────────────────────────────
  // PASO 5: Render - Estructura de la página
  // ─────────────────────────────────────────────────────────────

  return (
    <main
      className="pub-page-main publications-page"
      style={{
        flex: 1,
        padding: "96px 24px 80px",
        maxWidth: "1280px",
        margin: "0 auto",
        width: "100%",
      }}
    >
      <style>{`
        @media(max-width:900px){.pub-page-main{padding:80px 20px 28px!important}}
        @media(min-width:1280px){.pub-grid{grid-template-columns:repeat(4,1fr)!important}}
        @media(max-width:1280px){.pub-grid{grid-template-columns:repeat(3,1fr)!important}}
        @media(max-width:900px){.pub-grid{grid-template-columns:repeat(2,1fr)!important}}
        @media(max-width:560px){.pub-grid{grid-template-columns:1fr!important}}
        @media(hover:none){.pub-card-menu-trigger{opacity:1!important}}
      `}</style>
      {/* ─────────── SECCIÓN: Encabezado ─────────── */}
      <section
        style={{
          marginBottom: "48px",
        }}
      >
        {/* Título + botones hero */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "24px",
            marginBottom: "4px",
          }}
        >
          <div>
            <p style={{
              fontSize: '11px',
              fontWeight: 700,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: 'var(--accent)',
              marginBottom: '8px',
              opacity: 0.85,
            }}>
              Precios en tiempo real
            </p>
            <h1
              style={{
                fontSize: 'clamp(26px, 4vw, 40px)',
                fontWeight: '800',
                letterSpacing: '-0.02em',
                margin: 0,
                lineHeight: 1.1,
                background: 'linear-gradient(to right, var(--accent), var(--primary-container, #22b1ec))',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              {tp.title}
            </h1>
          </div>

          {/* Filtrar + Sort buttons */}
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
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
              }}
              onMouseEnter={(e) => { if (!showFilters) e.currentTarget.style.background = 'var(--bg-hover, #1f2b49)'; }}
              onMouseLeave={(e) => { if (!showFilters) e.currentTarget.style.background = 'var(--surface-container-high, #141f38)'; }}
            >
              <FilterIcon aria-hidden="true" />
              Filtrar
            </button>

            <button
              onClick={() => handleFilterChange({ ...filters, sortBy: filters.sortBy === 'recent' ? 'best_match' : 'recent' })}
              style={{
                background: 'var(--surface-container-high, #141f38)',
                color: 'var(--text-primary)',
                border: '1px solid rgba(64,72,93,0.3)',
                borderRadius: '12px',
                padding: '12px 24px',
                fontWeight: 600,
                fontSize: '14px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                transition: 'background 0.15s',
                minHeight: '44px',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-hover, #1f2b49)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--surface-container-high, #141f38)'; }}
            >
              <SortIcon aria-hidden="true" />
              {filters.sortBy === 'recent' ? 'Más reciente' : 'Más relevante'}
            </button>
          </div>
        </div>

        <p
          style={{
            fontSize: "15px",
            color: "var(--text-secondary)",
            lineHeight: "1.6",
            margin: "0 0 16px",
          }}
        >
          {tp.subtitle}
        </p>

        {/* Aviso de email no verificado */}
        {!user?.isVerified && (
          <div
            style={{
              padding: "12px 16px",
              background: "var(--warning-soft)",
              border: "1px solid rgba(251,191,36,0.3)",
              borderRadius: "var(--radius-md)",
              color: "var(--warning)",
              fontSize: "13px",
              marginBottom: "16px",
            }}
          >
            {tp.verifyEmailWarning}
          </div>
        )}

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
      </section>

      {/* ─────────── SECCIÓN: Búsqueda + Filtros ─────────── */}
      <section style={{ marginBottom: "32px" }}>
        {/* Barra de búsqueda con botón de filtros */}
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <div
            ref={searchBoxRef}
            style={{
              position: "relative",
              flex: 1,
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.09)",
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
              aria-label={tp.searchPlaceholder}
              placeholder={tp.searchPlaceholder}
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

        </div>

        {/* Filtros activos como tags + panel expandible */}
        <PriceSearchFilter
          filters={filters}
          onFiltersChange={handleFilterChange}
          open={showFilters}
          distanceLoading={geolocationLoading}
          categories={categories}
          onClearFilters={() => {
            cachedLocationRef.current = null;
            setGeolocationLoading(false);
            setFilters({
              productId: null,
              productName: "",
              storeName: "",
              categoryId: null,
              minPrice: null,
              maxPrice: null,
              maxDistance: null,
              sortBy: "recent",
            });
            setSearchQuery("");
            clearFilters();
          }}
        />
      </section>

      {/* ─────────── SECCIÓN: Listado de publicaciones ─────────── */}
      <section>
        {loading && normalizedPublications.length === 0 ? (
          // Estado: Cargando (solo cuando no hay datos previos)
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
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            <p style={{ fontSize: "14px" }}>{tp.loading}</p>
          </div>
        ) : !loading && normalizedPublications.length === 0 ? (
          // Estado: Vacío
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
              {tp.noPublicationsTitle}
            </h2>
            <p
              style={{ fontSize: "14px", maxWidth: "320px", lineHeight: "1.6" }}
            >
              {tp.noPublicationsDesc}{" "}
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
                {tp.beFirst}
              </button>
              .
            </p>
          </div>
        ) : (
          // Estado: Con publicaciones
          <div
            className="pub-grid"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, 1fr)",
              gap: "24px",
            }}
          >
            {normalizedPublications.map((publication) => (
              <PublicationCard
                key={publication.id}
                publication={publication}
                onValidate={handleValidatePublication}
                onDownvote={handleDownvotePublication}
                onReport={handleReportPublication}
                onDelete={handleDeletePublication}
                onViewMore={handleViewMore}
                isAuthor={user?.id === publication.user_id}
                isAdmin={isAdmin(user?.role)}
              />
            ))}
          </div>
        )}

        {/* Scroll infinito */}
        {normalizedPublications.length > 0 && (
          <div
            aria-hidden="true"
            style={{
              display: "flex",
              justifyContent: "center",
              marginTop: "32px",
              paddingTop: "32px",
              borderTop: "1px solid var(--border)",
              minHeight: "48px",
            }}
          >
            {loading && (
              <span style={{ color: "var(--text-muted)", fontSize: "14px" }}>
                {tp.loading}
              </span>
            )}
            {!hasMore && !loading && (
              <span style={{ color: "var(--text-secondary)", fontSize: "14px", fontWeight: 500 }}>
                — Sin más resultados —
              </span>
            )}
          </div>
        )}
      </section>

      {/* ── FAB: Crear publicación ── */}
      <button
        type="button"
        className="pub-create-fab"
        onClick={handlePublish}
        disabled={!user?.isVerified}
        aria-label="Crear publicación"
        title={!user?.isVerified ? tp.verifyEmailTitle : 'Crear publicación'}
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
          cursor: !user?.isVerified ? 'not-allowed' : 'pointer',
          boxShadow: '0 8px 32px rgba(59,191,250,0.30)',
          fontWeight: 700,
          fontSize: '15px',
          letterSpacing: '-0.01em',
          opacity: !user?.isVerified ? 0.5 : 1,
          transition: 'transform 0.2s ease, box-shadow 0.2s ease',
        }}
        onMouseEnter={(e) => {
          if (!user?.isVerified) return;
          e.currentTarget.style.transform = 'scale(1.05)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'scale(1)';
        }}
        onMouseDown={(e) => {
          if (!user?.isVerified) return;
          e.currentTarget.style.transform = 'scale(0.95)';
        }}
        onMouseUp={(e) => {
          if (!user?.isVerified) return;
          e.currentTarget.style.transform = 'scale(1.05)';
        }}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <line x1="12" y1="5" x2="12" y2="19"/>
          <line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
        <span>Contribuir</span>
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
    </main>
  );
}
