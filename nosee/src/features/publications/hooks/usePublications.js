 /*usePublications.js
 *
 * Hook personalizado para gestionar publicaciones de precios
 * 
 * UBICACIÓN: src/features/publications/hooks/usePublications.js
 * FECHA: 26-02-2026
 * STATUS: Paso 2a de Proceso 2
 * 
 * FUNCIÓN:
 * - Carga publicaciones desde BD
 * - Aplica filtros
 * - Paginación (infinite scroll)
 * - Refetch automático
 * - Estados: loading, error, data
 * 
 * DEPENDENCIAS:
 * - publications.api.js
 * - react (useState, useEffect, useCallback)
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import * as publicationsApi from '@/services/api/publications.api';
import { debugPublications } from '@/utils/debugLogger';
import { recordApiLatency } from '@/services/metrics';

const REQUEST_GUARD_TIMEOUT_MS = 32000;
const TAB_REFETCH_DEBOUNCE_MS = 1500;

const shouldDeferFetchUntilVisible = () =>
  typeof document !== 'undefined' && document.visibilityState === 'hidden';

const getRuntimeState = () => {
  if (typeof document === 'undefined') {
    return { visibilityState: 'server', online: null };
  }

  return {
    visibilityState: document.visibilityState,
    online: typeof navigator !== 'undefined' ? navigator.onLine : null,
  };
};


const areFiltersEqual = (a = {}, b = {}) => {
  const keys = [
    'productId',
    'productName',
    'storeName',
    'storeId',
    'minPrice',
    'maxPrice',
    'maxDistance',
    'latitude',
    'longitude',
    'sortBy',
    'limit',
    'categoryId',
    'brandId',
  ];

  return keys.every((key) => {
    const left = a[key] ?? null;
    const right = b[key] ?? null;
    return left === right;
  });
};



/**
 * Custom hook para gestionar publicaciones de precios
 * 
 * @param {Object} initialFilters - Filtros iniciales
 * @param {string} initialFilters.productName - Nombre de producto
 * @param {string} initialFilters.storeName - Nombre de tienda
 * @param {number} initialFilters.minPrice - Precio mínimo
 * @param {number} initialFilters.maxPrice - Precio máximo
 * @param {number} initialFilters.maxDistance - Distancia máxima (km)
 * @param {number} initialFilters.latitude - Latitud usuario
 * @param {number} initialFilters.longitude - Longitud usuario
 * @param {string} initialFilters.sortBy - 'recent', 'validated', 'cheapest'
 * @param {number} initialFilters.limit - Resultados por página (default 20)
 * 
 * @returns {Object} { publications, loading, error, filters, setFilters, refetch, hasMore, loadMore }
 * 
 * @example
 * const { 
 *   publications, 
 *   loading, 
 *   error, 
 *   filters, 
 *   setFilters, 
 *   refetch,
 *   hasMore,
 *   loadMore 
 * } = usePublications({ 
 *   productName: 'aceite',
 *   maxPrice: 30000,
 *   sortBy: 'cheapest'
 * });
 */
export const usePublications = (initialFilters = {}, options = {}) => {
  // ─── Estados ───────────────────────────────────────────────────────────────

  const [publications, setPublications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const isMountedRef = useRef(true);
  const activeRequestIdRef = useRef(0);
  const { refetchOnTabActive = false } = options;
  const inFlightRef = useRef(false);
  const pendingPageRef = useRef(null);
  const latestFetchRef = useRef(null);
  const deferredFetchRef = useRef(null);
  const lastFetchAtRef = useRef(0);
  const publicationsCountRef = useRef(0);

  // Filtros
  const [filters, setFilters] = useState({
    productId: null,
    productName: '',
    storeName: '',
    storeId: null,
    categoryId: null,
    brandId: null,
    minPrice: null,
    maxPrice: null,
    maxDistance: null,
    latitude: null,
    longitude: null,
    sortBy: 'recent',
    limit: 20,
    ...initialFilters,
  });

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    publicationsCountRef.current = publications.length;
  }, [publications.length]);

  // ─── Cargar publicaciones ──────────────────────────────────────────────────

  /**
   * Fetch publicaciones desde API
   * @private
   */
  const fetchPublications = useCallback(
    async (currentPage = 1) => {
      if (shouldDeferFetchUntilVisible()) {
        deferredFetchRef.current = currentPage;
        debugPublications('fetch:deferred-hidden-tab', {
          currentPage,
          runtime: getRuntimeState(),
        });
        return;
      }

      deferredFetchRef.current = null;

      if (inFlightRef.current) {
        pendingPageRef.current = currentPage;
        debugPublications('fetch:queued-inflight', { currentPage });
        return;
      }

       const requestId = activeRequestIdRef.current + 1;
      activeRequestIdRef.current = requestId;
      const startedAt = Date.now();
      let guardTimeoutId = null;
      try {
        inFlightRef.current = true;
        if (isMountedRef.current) {
          const shouldShowLoading = currentPage !== 1 || publicationsCountRef.current === 0;
          if (shouldShowLoading) {
            setLoading(true);
          }
          setError(null);
        }

        // Agregar página a los filtros
        const queryFilters = {
          ...filters,
          page: currentPage,
        };

        debugPublications('fetch:start', {
          requestId,
          currentPage,
          filters: queryFilters,
          runtime: getRuntimeState(),
        });

        guardTimeoutId = setTimeout(() => {
          if (!isMountedRef.current || requestId !== activeRequestIdRef.current) return;
          debugPublications('fetch:guard-timeout', {
            requestId,
            elapsedMs: Date.now() - startedAt,
          });
          setError('La carga de publicaciones está tardando demasiado. Intenta nuevamente.');
          setLoading(false);
          inFlightRef.current = false;
        }, REQUEST_GUARD_TIMEOUT_MS);

        // Llamar a API
        const result = await publicationsApi.getPublications(queryFilters);
        recordApiLatency('publications_list', Date.now() - startedAt);

        if (!isMountedRef.current || requestId !== activeRequestIdRef.current) {
          return;
        }

        if (result.success) {
          setError(null);
          debugPublications('fetch:success', {
            requestId,
            currentPage,
            elapsedMs: Date.now() - startedAt,
            results: result.data?.length || 0,
            totalCount: result.count,
          });
          // Si es primera página, reemplazar todo; sino, agregar
          if (currentPage === 1) {
            setPublications(result.data);
          } else {
            setPublications((prev) => {
              const seen = new Set(prev.map((pub) => pub.id));
              const incoming = (result.data || []).filter((pub) => !seen.has(pub.id));
              return [...prev, ...incoming];
            });
          }

          setTotalCount(result.count || 0);
          setHasMore(result.hasMore || false);
          setPage(currentPage);
        } else {
          debugPublications('fetch:api-error', {
            requestId,
            currentPage,
            elapsedMs: Date.now() - startedAt,
            error: result.error,
            runtime: getRuntimeState(),
          });
          setError(result.error || 'Error cargando publicaciones');
          if (currentPage === 1 && publicationsCountRef.current === 0) {
            setPublications([]);
            setHasMore(false);
            setTotalCount(0);
          }
        }
      } catch (err) {
        console.error('Error en fetchPublications:', err);
        debugPublications('fetch:exception', {
          requestId,
          currentPage,
          elapsedMs: Date.now() - startedAt,
          error: err?.message || String(err),
          runtime: getRuntimeState(),
        });

        if (!isMountedRef.current || requestId !== activeRequestIdRef.current) {
          return;
        }

        setError('Error inesperado al cargar publicaciones');
      } finally {
        if (guardTimeoutId) clearTimeout(guardTimeoutId);
        if (isMountedRef.current && requestId === activeRequestIdRef.current) {
          setLoading(false);
        }
        inFlightRef.current = false;
        lastFetchAtRef.current = Date.now();

        // Si durante la petición llegó una búsqueda/filtro más reciente,
        // ejecutamos la última pendiente para no perder los últimos caracteres tecleados.
        if (isMountedRef.current && pendingPageRef.current !== null) {
          const nextPage = pendingPageRef.current;
          pendingPageRef.current = null;
          setTimeout(() => {
            if (isMountedRef.current) {
              latestFetchRef.current?.(nextPage);
            }
          }, 0);
        }
      }
    },
    [filters]
  );

  useEffect(() => {
    latestFetchRef.current = fetchPublications;
  }, [fetchPublications]);

  // ─── Efectos ───────────────────────────────────────────────────────────────

  /**
   * Cargar publicaciones cuando filtros cambien
   */
  useEffect(() => {
    fetchPublications(1);
  }, [filters, fetchPublications]);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;

    const syncLastVisibleAt = () => {
      if (document.visibilityState === 'visible') {
        window.__NOSEE_LAST_TAB_VISIBLE_AT__ = Date.now();
      }
    };

    syncLastVisibleAt();
    document.addEventListener('visibilitychange', syncLastVisibleAt);

    return () => {
      document.removeEventListener('visibilitychange', syncLastVisibleAt);
    };
  }, []);

  useEffect(() => {
    if (typeof document === 'undefined') return;

    const runDeferredFetchWhenVisible = () => {
      if (document.visibilityState !== 'visible') return;
      if (deferredFetchRef.current === null) return;

      const deferredPage = deferredFetchRef.current;
      deferredFetchRef.current = null;

      debugPublications('fetch:run-deferred-visible-tab', {
        deferredPage,
        runtime: getRuntimeState(),
      });

      // Pequeño delay para que Supabase complete el refresh del token
      // antes de hacer queries a la BD (evita carga lenta al volver al tab)
      setTimeout(() => {
        if (isMountedRef.current) {
          fetchPublications(deferredPage);
        }
      }, 300);
    };

    document.addEventListener('visibilitychange', runDeferredFetchWhenVisible);
    runDeferredFetchWhenVisible();

    return () => {
      document.removeEventListener('visibilitychange', runDeferredFetchWhenVisible);
    };
  }, [fetchPublications]);
  
  useEffect(() => {
    if (!refetchOnTabActive) return;
    

    const handleTabActive = () => {
      if (document.visibilityState === 'visible') {
        const elapsedSinceLastFetch = Date.now() - lastFetchAtRef.current;
        if (elapsedSinceLastFetch < TAB_REFETCH_DEBOUNCE_MS) {
          debugPublications('fetch:skipped-tab-active-debounced', {
            elapsedSinceLastFetch,
          });
          return;
        }
        fetchPublications(1);
      }
    };

    window.addEventListener('focus', handleTabActive);
    document.addEventListener('visibilitychange', handleTabActive);

    return () => {
      window.removeEventListener('focus', handleTabActive);
      document.removeEventListener('visibilitychange', handleTabActive);
    };
  }, [fetchPublications, refetchOnTabActive]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleStoreUpdated = () => {
      if (document.visibilityState === "visible") {
        fetchPublications(1);
      } else {
        deferredFetchRef.current = 1;
      }
    };

    const handleStorage = (event) => {
      if (event.key !== "NOSEE_STORE_UPDATED_AT") return;
      handleStoreUpdated();
    };

    window.addEventListener("nosee:store-updated", handleStoreUpdated);
    window.addEventListener("storage", handleStorage);

    return () => {
      window.removeEventListener("nosee:store-updated", handleStoreUpdated);
      window.removeEventListener("storage", handleStorage);
    };
  }, [fetchPublications]);

  // ─── Funciones públicas ────────────────────────────────────────────────────

  /**
   * Cambiar filtros (inicia búsqueda desde página 1)
   */
  const updateFilters = useCallback((newFilters) => {
    let didChange = false;

    setFilters((prev) => {
      const nextFilters = {
        ...prev,
        ...newFilters,
      };

      didChange = !areFiltersEqual(prev, nextFilters);
      return didChange ? nextFilters : prev;
    });

    // Reset a página 1 solo cuando realmente cambian filtros
    if (didChange) {
      setPage(1);
    }
  }, []);

  /**
   * Limpiar todos los filtros
   */
  const clearFilters = useCallback(() => {
     const resetFilters = {
      productId: null,
      productName: '',
      storeName: '',
      storeId: null,
      categoryId: null,
      brandId: null,
      minPrice: null,
      maxPrice: null,
      maxDistance: null,
      latitude: null,
      longitude: null,
      sortBy: 'recent',
      limit: 20,
       };

    let didChange = false;
    setFilters((prev) => {
      didChange = !areFiltersEqual(prev, resetFilters);
      return didChange ? resetFilters : prev;
    });
    
    if (didChange) {
      setPage(1);
    }
  }, []);

  /**
   * Recargar publicaciones (refetch)
   */
  const refetch = useCallback(() => {
    fetchPublications(1);
  }, [fetchPublications]);

  /**
   * Cargar más resultados (infinite scroll)
   */
  const loadMore = useCallback(() => {
    if (hasMore && !loading && !inFlightRef.current) {
      fetchPublications(page + 1);
    }
  }, [hasMore, loading, page, fetchPublications]);

  /**
   * Agregar una publicación a la lista (después de crear)
   */
  const addPublication = useCallback((publication) => {
    setPublications((prev) => [publication, ...prev]);
  }, []);

  /**
   * Eliminar una publicación de la lista
   */
  const removePublication = useCallback((publicationId) => {
    setPublications((prev) =>
      prev.filter((pub) => pub.id !== publicationId)
    );
  }, []);

  /**
   * Validar (upvote) una publicación
   */
  const validatePublication = useCallback(async (publicationId) => {
    let prevState = null;
    setPublications((prev) => {
      const pub = prev.find((p) => p.id === publicationId);
      if (pub) prevState = { validated_count: pub.validated_count, user_vote: pub.user_vote };
      return prev.map((p) =>
        p.id === publicationId
          ? { ...p, validated_count: (p.validated_count || 0) + 1, user_vote: 1 }
          : p
      );
    });

    try {
      const result = await publicationsApi.validatePublication(publicationId);
      if (!result.success && prevState !== null) {
        setPublications((prev) =>
          prev.map((p) => (p.id === publicationId ? { ...p, ...prevState } : p))
        );
      }
      return result;
    } catch (err) {
      if (prevState !== null) {
        setPublications((prev) =>
          prev.map((p) => (p.id === publicationId ? { ...p, ...prevState } : p))
        );
      }
      console.error('Error validando publicación:', err);
      return { success: false, error: err.message };
    }
  }, []);

  /**
   * Quitar validación (unvote) de una publicación
   */
  const unvotePublication = useCallback(async (publicationId) => {
    let prevState = null;
    setPublications((prev) => {
      const pub = prev.find((p) => p.id === publicationId);
      if (pub) prevState = { validated_count: pub.validated_count, downvoted_count: pub.downvoted_count, user_vote: pub.user_vote };
      return prev.map((p) => {
        if (p.id !== publicationId) return p;
        return {
          ...p,
          validated_count: p.user_vote === 1 ? Math.max((p.validated_count || 1) - 1, 0) : p.validated_count,
          downvoted_count: p.user_vote === -1 ? Math.max((p.downvoted_count || 1) - 1, 0) : p.downvoted_count,
          user_vote: null,
        };
      });
    });

    try {
      const result = await publicationsApi.unvotePublication(publicationId);
      if (!result.success && prevState !== null) {
        setPublications((prev) =>
          prev.map((p) => (p.id === publicationId ? { ...p, ...prevState } : p))
        );
      }
      return result;
    } catch (err) {
      if (prevState !== null) {
        setPublications((prev) =>
          prev.map((p) => (p.id === publicationId ? { ...p, ...prevState } : p))
        );
      }
      console.error('Error quitando voto de publicación:', err);
      return { success: false, error: err.message };
    }
  }, []);

  /**
   * Downvote una publicación
   */
  const downvotePublication = useCallback(async (publicationId) => {
    let prevState = null;
    setPublications((prev) => {
      const pub = prev.find((p) => p.id === publicationId);
      if (pub) prevState = { downvoted_count: pub.downvoted_count, user_vote: pub.user_vote };
      return prev.map((p) =>
        p.id === publicationId
          ? { ...p, downvoted_count: (p.downvoted_count || 0) + 1, user_vote: -1 }
          : p
      );
    });

    try {
      const result = await publicationsApi.downvotePublication(publicationId);
      if (!result.success && prevState !== null) {
        setPublications((prev) =>
          prev.map((p) => (p.id === publicationId ? { ...p, ...prevState } : p))
        );
      }
      return result;
    } catch (err) {
      if (prevState !== null) {
        setPublications((prev) =>
          prev.map((p) => (p.id === publicationId ? { ...p, ...prevState } : p))
        );
      }
      console.error('Error downvoteando publicación:', err);
      return { success: false, error: err.message };
    }
  }, []);

  /**
   * Reportar una publicación
   * 
   * @param {number} publicationId - ID de la publicación
   * @param {object} reportPayload - Objeto con detalles del reporte
   *   - reason: Razón del reporte
   *   - description: Descripción opcional
   *   - evidenceFile: Archivo de evidencia opcional
   */
  const reportPublication = useCallback(
    async (publicationId, reportPayload) => {
      try {
        const result = await publicationsApi.reportPublication(
          publicationId,
          reportPayload
        );

        if (result.success) {
          // Actualizar contador en la lista
          setPublications((prev) =>
            prev.map((pub) =>
              pub.id === publicationId
                ? { ...pub, reported_count: (pub.reported_count || 0) + 1 }
                : pub
            )
          );
          return result;
        } else {
          return result;
        }
      } catch (err) {
        console.error('Error reportando publicación:', err);
        return { 
          success: false, 
          error: err.message,
          message: "Error al reportar la publicación"
        };
      }
    },
    []
  );

  // ─── Return ────────────────────────────────────────────────────────────────

  return {
    // Data
    publications,
    loading,
    error,
    totalCount,

    // Filters
    filters,
    setFilters: updateFilters,
    clearFilters,

    // Pagination
    page,
    hasMore,
    loadMore,

    // Actions
    refetch,
    addPublication,
    removePublication,
    validatePublication,
    downvotePublication,
    unvotePublication,
    reportPublication,
  };
};

export default usePublications;
