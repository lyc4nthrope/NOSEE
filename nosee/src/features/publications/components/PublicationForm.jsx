/**
 * PublicationForm.jsx
 *
 * Flujo:
 *   Producto → autocomplete con búsqueda en tiempo real.
 *              Si el nombre no existe → opción inline "Crear [nombre]".
 *   Tienda   → autocomplete con búsqueda en tiempo real.
 *              Si el nombre no existe → opción "Crear tienda [nombre]"
 *              que abre StoreCreateModal encima del formulario.
 *
 * Props:
 *   - mode: 'create' | 'edit' (default: 'create')
 *   - publicationId: string (required if mode='edit')
 *   - onSuccess: function
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { usePublicationCreation } from "@/features/publications/hooks";
import { Spinner } from "@/components/ui";
import { recordPublicationFormStarted, recordPublicationFormAbandoned } from "@/services/metrics";
import PhotoUploader from "./PhotoUploader";
import StoreCreateModal from "@/features/stores/components/StoreCreateModal";
import ProductQuickCreateModal from "./ProductQuickCreateModal";
import BarcodeScannerModal from "./BarcodeScannerModal";
import * as publicationsApi from "@/services/api/publications.api";
import * as storesApi from "@/services/api/stores.api";
import { useLanguage } from "@/contexts/LanguageContext";
import CelebrationOverlay from "@/components/ui/CelebrationOverlay";
import { ReportModal } from "@/components/ReportModal";
import {
  ENABLE_AUTO_STORE,
  ENABLE_BARCODE_SCAN,
  getDistanceMeters,
  formatDistance,
  fetchProductPrefillFromBarcode,
} from "./form/publicationFormUtils";
import { styles } from "./form/publicationFormStyles";

export function PublicationForm({ mode = "create", publicationId = null, onSuccess }) {
  const { t } = useLanguage();
  const tf = t.publicationForm;

  const {
    formData,
    errors,
    isSubmitting,
    submitError,
    submitSuccess,
    isLoading,
    latitude,
    longitude,
    requestLocation,
    updateField,
    submit,
    showCelebration,
    setShowCelebration,
  } = usePublicationCreation({ mode, publicationId });
  const locationRequestedRef = useRef(false);

  // Estado para autocompletes y modales
  const [hasLoadedInitialData, setHasLoadedInitialData] = useState(mode === 'create');

  // ─── Product autocomplete ──────────────────────────────────────────────────
  const [productQuery, setProductQuery] = useState("");
  const [brandQuery, setBrandQuery] = useState("");
  const [productResults, setProductResults] = useState([]);
  const [productSearching, setProductSearching] = useState(false);
  const [showProductDropdown, setShowProductDropdown] = useState(false);
  const [showProductModal, setShowProductModal] = useState(false);
  const [showBarcodeModal, setShowBarcodeModal] = useState(false);
  const [scannedBarcode, setScannedBarcode] = useState("");
  const [barcodePrefill, setBarcodePrefill] = useState({
    brandName: "",
    categoryHint: "",
    baseQuantity: "",
    unitAbbreviation: "",
  });
  const productTimerRef = useRef(null);
  const productRequestIdRef = useRef(0);
  const productWrapperRef = useRef(null);
  const [barcodeStatus, setBarcodeStatus] = useState("");

  // ─── Brand autocomplete ────────────────────────────────────────────────────
  const [brandResults, setBrandResults] = useState([]);
  const [brandSearching, setBrandSearching] = useState(false);
  const [showBrandDropdown, setShowBrandDropdown] = useState(false);
  const brandTimerRef = useRef(null);
  const brandRequestIdRef = useRef(0);

  // ─── Store autocomplete ────────────────────────────────────────────────────
  const [storeQuery, setStoreQuery] = useState("");
  const [storeResults, setStoreResults] = useState([]);
  const [storeSearching, setStoreSearching] = useState(false);
  const [showStoreDropdown, setShowStoreDropdown] = useState(false);
  const [showStoreModal, setShowStoreModal] = useState(false);
  const storeTimerRef = useRef(null);
  const storeRequestIdRef = useRef(0);
  const storeWrapperRef = useRef(null);
  const [autoStoreMessage, setAutoStoreMessage] = useState("");
  const [autoStoreDetecting, setAutoStoreDetecting] = useState(false);
  const [reportTarget, setReportTarget] = useState(null);
  const [autoStoreFound, setAutoStoreFound] = useState(false);
  const autoStoreAttemptedRef = useRef(false);
  const userEditedStoreRef = useRef(false);
  const updateFieldRef = useRef(updateField);
  updateFieldRef.current = updateField;

  // ─── Índice activo para navegación por teclado ─────────────────────────────
  const [activeProductIndex, setActiveProductIndex] = useState(-1);
  const [activeStoreIndex, setActiveStoreIndex] = useState(-1);

  // Cargar nombres iniciales cuando se cargan datos en modo edición
  useEffect(() => {
    if (!isLoading && !hasLoadedInitialData && formData.productId && formData.storeId) {
      setHasLoadedInitialData(true);
    }
  }, [isLoading, hasLoadedInitialData, formData.productId, formData.storeId]);

  // Métricas: inicio y abandono de formulario de publicación (RNF 4.3.5)
  const formSubmittedRef = useRef(false);
  useEffect(() => {
    if (mode !== 'create') return;
    recordPublicationFormStarted();
    return () => {
      if (!formSubmittedRef.current) {
        recordPublicationFormAbandoned();
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Cerrar dropdowns al clickar fuera ────────────────────────────────────
  useEffect(() => {
    const handler = (e) => {
      if (
        productWrapperRef.current &&
        !productWrapperRef.current.contains(e.target)
      ) {
        setShowProductDropdown(false);
      }
      if (
        storeWrapperRef.current &&
        !storeWrapperRef.current.contains(e.target)
      ) {
        setShowStoreDropdown(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);


  useEffect(() => {
    return () => {
      clearTimeout(productTimerRef.current);
      clearTimeout(storeTimerRef.current);
    };
  }, []);

  const performProductSearch = useCallback(async (rawQuery, rawBrandQuery = "") => {
    const query = String(rawQuery || "").trim();

    if (!query || query.length < 2) {
      setProductResults([]);
      setProductSearching(false);
      return;
    }

    const requestId = productRequestIdRef.current + 1;
    productRequestIdRef.current = requestId;
    setProductSearching(true);

    try {
      const result = await publicationsApi.searchProducts(query, 10, rawBrandQuery);
      if (requestId !== productRequestIdRef.current) return;
      setProductResults(result.success ? result.data : []);
    } catch {
      if (requestId !== productRequestIdRef.current) return;
      setProductResults([]);
    } finally {
      if (requestId === productRequestIdRef.current) {
        setProductSearching(false);
      }
    }
  }, []);

  const performBrandSearch = useCallback(async (rawQuery) => {
    const query = String(rawQuery || "").trim();
    if (!query || query.length < 2) {
      setBrandResults([]);
      setBrandSearching(false);
      return;
    }
    const requestId = brandRequestIdRef.current + 1;
    brandRequestIdRef.current = requestId;
    setBrandSearching(true);
    try {
      const result = await publicationsApi.searchBrands(query, 8);
      if (requestId !== brandRequestIdRef.current) return;
      setBrandResults(result.success ? result.data : []);
    } catch {
      if (requestId !== brandRequestIdRef.current) return;
      setBrandResults([]);
    } finally {
      if (requestId === brandRequestIdRef.current) setBrandSearching(false);
    }
  }, []);

  const performStoreSearch = useCallback(async (rawQuery) => {
    const query = String(rawQuery || "").trim();

    if (!query || query.length < 2) {
      setStoreResults([]);
      setStoreSearching(false);
      return;
    }

    const requestId = storeRequestIdRef.current + 1;
    storeRequestIdRef.current = requestId;
    setStoreSearching(true);

    try {
      const result = await storesApi.searchNearbyStores(
        query,
        latitude,
        longitude,
        null,
      );
      if (requestId !== storeRequestIdRef.current) return;
      const sorted = result.success
        ? [...result.data].sort(
            (a, b) => (a.distanceMeters ?? Infinity) - (b.distanceMeters ?? Infinity),
          )
        : [];
      setStoreResults(sorted);
    } catch {
      if (requestId !== storeRequestIdRef.current) return;
      setStoreResults([]);
    } finally {
      if (requestId === storeRequestIdRef.current) {
        setStoreSearching(false);
      }
    }
  }, [latitude, longitude]);

  useEffect(() => {
    const handleTabActive = () => {
      if (document.visibilityState !== "visible") return;
      if (productQuery.trim().length >= 2) performProductSearch(productQuery, brandQuery);
      if (storeQuery.trim().length >= 2) performStoreSearch(storeQuery);
    };

    window.addEventListener("focus", handleTabActive);
    document.addEventListener("visibilitychange", handleTabActive);

    return () => {
      window.removeEventListener("focus", handleTabActive);
      document.removeEventListener("visibilitychange", handleTabActive);
    };
  }, [productQuery, brandQuery, storeQuery, performProductSearch, performStoreSearch]);

  useEffect(() => {
    if (!ENABLE_AUTO_STORE || mode !== "create") return;
    if (autoStoreAttemptedRef.current) return;
    if (userEditedStoreRef.current) return;
    if (formData.storeId || storeQuery.trim().length > 0) return;

    const userLat = Number(latitude);
    const userLon = Number(longitude);
    if (!Number.isFinite(userLat) || !Number.isFinite(userLon)) return;

    autoStoreAttemptedRef.current = true;
    setAutoStoreDetecting(true);
    setAutoStoreFound(false);
    setAutoStoreMessage(tf.findingStore);
    let isCancelled = false;

    (async () => {
      // Una sola consulta: todas las tiendas físicas con coordenadas
      const result = await storesApi.getAllPhysicalStoresWithLocation();
      if (isCancelled) return;

      if (!result.success) {
        setAutoStoreDetecting(false);
        setAutoStoreFound(false);
        setAutoStoreMessage(tf.storeQueryError);
        return;
      }

      // Calcular distancia a cada tienda y tomar la más cercana
      let nearest = null;
      for (const store of result.data || []) {
        const distanceMeters = getDistanceMeters(
          userLat, userLon,
          Number(store.latitude), Number(store.longitude),
        );

        if (!nearest || distanceMeters < nearest.distanceMeters) {
          nearest = { ...store, distanceMeters };
        }
      }

      if (isCancelled) return;

      if (!nearest) {
        setAutoStoreDetecting(false);
        setAutoStoreFound(false);
        setAutoStoreMessage(tf.noPhysicalStores);
        return;
      }

      updateFieldRef.current("storeId", nearest.id);
      setStoreQuery(nearest.name);
      setAutoStoreDetecting(false);
      setAutoStoreFound(true);
      setAutoStoreMessage(
        `Tienda más cercana: ${nearest.name}${nearest.distanceMeters != null ? ` · ${formatDistance(nearest.distanceMeters)}` : ""}`,
      );
    })();

    return () => {
      isCancelled = true;
      setAutoStoreDetecting(false);
      autoStoreAttemptedRef.current = false; // Permite reintento si el effect se canceló (ej. StrictMode)
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.storeId, latitude, longitude, mode, storeQuery]);

  // ─── Producto: búsqueda debounced ─────────────────────────────────────────
  const handleProductQueryChange = (e) => {
    const val = e.target.value;
    setProductQuery(val);
    updateField("productId", "");
    clearTimeout(productTimerRef.current);

    if (!val.trim() || val.length < 2) {
      setProductResults([]);
      setShowProductDropdown(false);
      return;
    }

    setShowProductDropdown(true);
    productTimerRef.current = setTimeout(() => {
      performProductSearch(val, brandQuery);
    }, 300);
  };

  const handleBrandQueryChange = (e) => {
    const val = e.target.value;
    setBrandQuery(val);
    updateField("productId", "");
    clearTimeout(productTimerRef.current);
    clearTimeout(brandTimerRef.current);

    if (productQuery.trim().length >= 2) {
      setShowProductDropdown(true);
      productTimerRef.current = setTimeout(() => {
        performProductSearch(productQuery, val);
      }, 300);
    }

    if (val.trim().length >= 2) {
      setShowBrandDropdown(true);
      brandTimerRef.current = setTimeout(() => {
        performBrandSearch(val);
      }, 300);
    } else {
      setShowBrandDropdown(false);
      setBrandResults([]);
    }
  };

  const handleProductSelect = (product) => {
    updateField("productId", String(product.id));
    setProductQuery(product.name);
    if (product.brand?.name) setBrandQuery(product.brand.name);
    setScannedBarcode("");
    setBarcodePrefill({
      brandName: "",
      categoryHint: "",
      baseQuantity: "",
      unitAbbreviation: "",
    });
    setShowProductDropdown(false);
  };

  const handleCreateProduct = async () => {
    if (!productQuery.trim()) return;
    setShowProductDropdown(false);
    setShowProductModal(true);
  };

  const handleProductCreated = (product) => {
    handleProductSelect(product);
    setShowProductModal(false);
  };

  // Siempre se muestra opción de crear (mismo nombre puede tener diferente marca o cantidad)
  const productDropdownItems = [
    ...(productQuery.trim().length >= 2 ? [{ __isCreate: true }] : []),
    ...productResults,
  ];

  const handleProductKeyDown = (e) => {
    if (!showProductDropdown) return;
    const total = productDropdownItems.length;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveProductIndex((prev) => (prev + 1) % total);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveProductIndex((prev) => (prev - 1 + total) % total);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const item = productDropdownItems[activeProductIndex];
      if (item) {
        if (item.__isCreate) handleCreateProduct();
        else handleProductSelect(item);
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      setShowProductDropdown(false);
      setActiveProductIndex(-1);
    }
  };

  // ─── Tienda: búsqueda debounced ────────────────────────────────────────────
  const handleStoreQueryChange = (e) => {
    const val = e.target.value;
    userEditedStoreRef.current = true;
    setStoreQuery(val);
    updateField("storeId", "");
    setAutoStoreMessage("");
    setAutoStoreFound(false);
    clearTimeout(storeTimerRef.current);

    if (!val.trim() || val.length < 2) {
      setStoreResults([]);
      setShowStoreDropdown(false);
      return;
    }

    setShowStoreDropdown(true);
    storeTimerRef.current = setTimeout(() => {
      performStoreSearch(val);
    }, 300);
  };

  const handleStoreSelect = (store) => {
    updateField("storeId", store.id);
    setStoreQuery(store.name);
    setAutoStoreMessage("");
    setAutoStoreFound(false);
    setShowStoreDropdown(false);
  };

  const handleStoreCreated = (store) => {
    handleStoreSelect(store);
    setShowStoreModal(false);
  };

  const handleBarcodeDetected = async (barcode) => {
    const normalizedBarcode = String(barcode || "").trim();
    if (!normalizedBarcode) return;

    setScannedBarcode(normalizedBarcode);
    setBarcodeStatus(`Código detectado: ${normalizedBarcode}. Buscando producto...`);

    const localProductResult = await publicationsApi.findProductByBarcode(normalizedBarcode);
    if (localProductResult.success && localProductResult.data) {
      handleProductSelect(localProductResult.data);
      setBarcodeStatus(
        `Código ${normalizedBarcode} detectado. Producto local encontrado: ${localProductResult.data.name}`,
      );
      return;
    }

    const prefillData = await fetchProductPrefillFromBarcode(normalizedBarcode);
    setBarcodePrefill({
      brandName: prefillData.brandName || "",
      categoryHint: prefillData.categoryHint || "",
      baseQuantity: prefillData.baseQuantity || "",
      unitAbbreviation: prefillData.unitAbbreviation || "",
    });

    if (prefillData.productName) {
      setProductQuery(prefillData.productName);
      updateField("productId", "");
      setShowProductDropdown(true);
      await performProductSearch(prefillData.productName);
      setBarcodeStatus(`Código ${normalizedBarcode} detectado. Sugerencia: ${prefillData.productName}`);
      return;
    }

    setBarcodeStatus(
      `Código ${normalizedBarcode} detectado, pero no hubo coincidencia automática. Puedes seleccionar o crear el producto manualmente.`,
    );
  };

  const storeDropdownItemsFinal = [
    ...(storeQuery.trim().length >= 2 ? [{ __isCreate: true }] : []),
    ...storeResults,
  ];

  const handleStoreKeyDown = (e) => {
    if (!showStoreDropdown) return;
    const total = storeDropdownItemsFinal.length;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveStoreIndex((prev) => (prev + 1) % total);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveStoreIndex((prev) => (prev - 1 + total) % total);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const item = storeDropdownItemsFinal[activeStoreIndex];
      if (item) {
        if (item.__isCreate) { setShowStoreDropdown(false); setShowStoreModal(true); }
        else handleStoreSelect(item);
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      setShowStoreDropdown(false);
      setActiveStoreIndex(-1);
    }
  };

  // ─── Símbolo de moneda ─────────────────────────────────────────────────────
  const CURRENCY_SYMBOLS = { COP: '$', USD: 'US$', EUR: '€' };
  const currencySymbol = CURRENCY_SYMBOLS[formData.currency] ?? '$';

  // ─── Form helpers ──────────────────────────────────────────────────────────
  const handleInputChange = (field, value) => {
    updateField(field, value);
  };

  const handleSubmit = async (ev) => {
    ev.preventDefault();
    const result = await submit();

    if (result.success) {
      formSubmittedRef.current = true;
      onSuccess?.(result.data);
      if (mode === "create") {
        setProductQuery("");
        setStoreQuery("");
      }
    }
  };

  // Mostrar spinner mientras carga datos en modo edición
  if (isLoading) {
    return (
      <div style={styles.container} className="flex items-center justify-center min-h-96">
        <Spinner />
      </div>
    );
  }

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={styles.container}>
      {submitSuccess && (
        <div role="status" aria-live="polite" style={styles.successAlert}>{tf.success}</div>
      )}
      {submitError && (
        <div role="alert" style={styles.errorAlert}>
          <span aria-hidden="true">⚠ </span>{submitError}
        </div>
      )}

      <form onSubmit={handleSubmit} style={styles.form}>
        {/* ── Producto ─────────────────────────────────────────────────────── */}
        <div style={styles.formGroup}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
            <label htmlFor="pub-product" style={{ ...styles.label, marginBottom: 0 }}>
              {tf.productLabel} <span style={styles.required}>*</span>
            </label>
            {ENABLE_BARCODE_SCAN && (
              <button
                type="button"
                style={styles.scanBtn}
                onClick={() => setShowBarcodeModal(true)}
                disabled={isSubmitting}
              >
                <span aria-hidden="true">▥ </span>Escanear código
              </button>
            )}
          </div>
          <div ref={productWrapperRef} style={styles.autocompleteContainer}>
            <input
              id="pub-product"
              type="text"
              role="combobox"
              aria-expanded={showProductDropdown}
              aria-autocomplete="list"
              aria-controls="pub-product-listbox"
              aria-activedescendant={
                activeProductIndex >= 0
                  ? `pub-product-option-${activeProductIndex}`
                  : undefined
              }
              aria-invalid={!!errors.productId}
              aria-describedby={errors.productId ? "pub-product-error" : undefined}
              placeholder={tf.productPlaceholder}
              value={productQuery}
              onChange={handleProductQueryChange}
              onFocus={() =>
                productQuery.length >= 2 && setShowProductDropdown(true)
              }
              onKeyDown={handleProductKeyDown}
              style={{
                ...styles.input,
                ...(errors.productId ? styles.inputError : {}),
              }}
            />
            <input
              id="pub-brand-filter"
              type="text"
              placeholder={tf.brandFilterPlaceholder}
              value={brandQuery}
              onChange={handleBrandQueryChange}
              onFocus={() => brandQuery.trim().length >= 2 && setShowBrandDropdown(true)}
              onBlur={() => setTimeout(() => setShowBrandDropdown(false), 200)}
              style={{
                ...styles.input,
                marginTop: 6,
                fontSize: "0.85em",
              }}
            />

            {showBrandDropdown && (
              <div
                id="pub-brand-listbox"
                role="listbox"
                aria-label="Marcas"
                style={{ ...styles.dropdown, marginTop: 2 }}
              >
                {brandSearching && (
                  <div style={styles.dropdownState}>{tf.searching}</div>
                )}
                {!brandSearching && brandResults.length === 0 && brandQuery.trim().length >= 2 && (
                  <div style={styles.dropdownState}>{tf.noResults}</div>
                )}
                {!brandSearching && brandResults.map((brand) => (
                  <div
                    key={brand.id}
                    role="option"
                    aria-selected={false}
                    style={{
                      ...styles.dropdownItem,
                      flexDirection: 'row',
                      alignItems: 'center',
                    }}
                    onMouseDown={() => {
                      setBrandQuery(brand.name);
                      setShowBrandDropdown(false);
                      if (productQuery.trim().length >= 2) {
                        performProductSearch(productQuery, brand.name);
                        setShowProductDropdown(true);
                      }
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <span>{brand.name}</span>
                    </div>
                    <button
                      type="button"
                      aria-label={`Reportar ${brand.name}`}
                      title="Reportar marca"
                      style={styles.dropdownReportBtn}
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        setReportTarget({ type: 'brand', id: brand.id, name: brand.name });
                        setShowBrandDropdown(false);
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

            {showProductDropdown && (
              <div
                id="pub-product-listbox"
                role="listbox"
                aria-label={tf.productLabel}
                style={styles.dropdown}
              >
                {productSearching && (
                  <div style={styles.dropdownState}>{tf.searching}</div>
                )}

                {/* Crear producto — siempre disponible (puede ser diferente marca o cantidad) */}
                {!productSearching &&
                  productQuery.trim().length >= 2 && (
                    <div
                      id="pub-product-option-0"
                      role="option"
                      aria-selected={0 === activeProductIndex}
                      style={{
                        ...styles.dropdownItem,
                        ...styles.dropdownCreate,
                        ...(0 === activeProductIndex ? styles.dropdownItemActive : {}),
                      }}
                      onMouseDown={handleCreateProduct}
                    >
                     {tf.createProduct(productQuery.trim())}
                    </div>
                  )}

                {!productSearching &&
                  productResults.map((p, i) => {
                    const meta = [
                      p.brand?.name,
                      p.base_quantity != null && p.unit?.name
                        ? `${p.base_quantity} ${p.unit.name}`
                        : p.base_quantity != null
                        ? p.base_quantity
                        : p.unit?.name,
                    ]
                      .filter(Boolean)
                      .join(" · ");
                    const idx = i + 1;
                    return (
                      <div
                        key={p.id}
                        id={`pub-product-option-${idx}`}
                        role="option"
                        aria-selected={idx === activeProductIndex}
                        style={{
                          ...styles.dropdownItem,
                          ...(idx === activeProductIndex ? styles.dropdownItemActive : {}),
                          flexDirection: 'row',
                          alignItems: 'center',
                        }}
                        onMouseDown={() => handleProductSelect(p)}
                      >
                        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          <span>{p.name}</span>
                          {meta && <span style={styles.dropdownSub}>{meta}</span>}
                        </div>
                        <button
                          type="button"
                          aria-label={`Reportar ${p.name}`}
                          title="Reportar producto"
                          style={styles.dropdownReportBtn}
                          onMouseDown={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            setReportTarget({ type: 'product', id: p.id, name: p.name });
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = 'rgba(180, 40, 40, 0.75)';
                            e.currentTarget.style.borderColor = 'rgba(180, 40, 40, 0.75)';
                            e.currentTarget.style.color = 'var(--bg-elevated, #fff)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'none';
                            e.currentTarget.style.borderColor = 'rgba(180, 40, 40, 0.25)';
                            e.currentTarget.style.color = 'rgba(180, 40, 40, 0.55)';
                          }}
                        >
                          !
                        </button>
                      </div>
                    );
                  })}

                {!productSearching &&
                  productResults.length === 0 &&
                  productQuery.trim().length >= 2 && (
                    <div style={styles.dropdownState}>{tf.noResults}</div>
                  )}
              </div>
            )}
          </div>

          {formData.productId && (
            <div style={styles.selectedBadge}>{tf.productSelected}</div>
          )}
          {barcodeStatus && <div style={styles.infoText}>{barcodeStatus}</div>}
          {errors.productId && (
            <div id="pub-product-error" role="alert" style={styles.errorText}>{errors.productId}</div>
          )}
        </div>

        {/* ── Tienda ───────────────────────────────────────────────────────── */}
        <div style={styles.formGroup}>
          <label htmlFor="pub-store" style={styles.label}>
            {tf.storeLabel} <span style={styles.required}>*</span>
          </label>
          <div ref={storeWrapperRef} style={styles.autocompleteContainer}>
            <input
              id="pub-store"
              type="text"
              role="combobox"
              aria-expanded={showStoreDropdown}
              aria-autocomplete="list"
              aria-controls="pub-store-listbox"
              aria-activedescendant={
                activeStoreIndex >= 0
                  ? `pub-store-option-${activeStoreIndex}`
                  : undefined
              }
              aria-invalid={!!errors.storeId}
              aria-describedby={errors.storeId ? "pub-store-error" : undefined}
              placeholder={autoStoreDetecting ? tf.findingStore : tf.storePlaceholder}
              value={storeQuery}
              onChange={handleStoreQueryChange}
              onFocus={() => {
                if (!locationRequestedRef.current) {
                  locationRequestedRef.current = true;
                  requestLocation();
                }
                if (storeQuery.length >= 2) setShowStoreDropdown(true);
              }}
              onKeyDown={handleStoreKeyDown}
              style={{
                ...styles.input,
                ...(errors.storeId ? styles.inputError : {}),
                ...(autoStoreDetecting ? styles.inputDetecting : {}),
              }}
            />
            {autoStoreDetecting && (
              <span className="nosee-detecting-spinner" style={styles.storeDetectingSpinner} aria-hidden="true">⟳</span>
            )}

            {showStoreDropdown && (
              <div
                id="pub-store-listbox"
                role="listbox"
                aria-label={tf.storeLabel}
                style={styles.dropdown}
              >
                {storeSearching && (
                  <div style={styles.dropdownState}>{tf.searching}</div>
                )}

                {/* Crear tienda — abre modal (siempre primero) */}
                {!storeSearching &&
                  storeQuery.trim().length >= 2 && (
                    <div
                      id="pub-store-option-0"
                      role="option"
                      aria-selected={0 === activeStoreIndex}
                      style={{
                        ...styles.dropdownItem,
                        ...styles.dropdownCreate,
                        ...(0 === activeStoreIndex ? styles.dropdownItemActive : {}),
                      }}
                      onTouchEnd={(e) => {
                        e.preventDefault();
                        setShowStoreDropdown(false);
                        setShowStoreModal(true);
                      }}
                      onMouseDown={() => {
                        setShowStoreDropdown(false);
                        setShowStoreModal(true);
                      }}
                    >
                      {tf.createStore(storeQuery.trim())}
                    </div>
                  )}

                {!storeSearching &&
                  storeResults.map((s, i) => {
                    const optionIndex = storeQuery.trim().length >= 2 ? i + 1 : i;
                    return (
                      <div
                        key={s.id}
                        id={`pub-store-option-${optionIndex}`}
                        role="option"
                        aria-selected={optionIndex === activeStoreIndex}
                        style={{
                          ...styles.dropdownItem,
                          ...(optionIndex === activeStoreIndex ? styles.dropdownItemActive : {}),
                          flexDirection: 'row',
                          alignItems: 'center',
                        }}
                        onMouseDown={() => handleStoreSelect(s)}
                      >
                        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          <span>{s.name}</span>
                          {s.address && (
                            <span style={styles.dropdownSub}>{s.address}</span>
                          )}
                          {s.distanceMeters != null && (
                            <span style={styles.dropdownDistance}>
                              {s.distanceMeters < 1000
                                ? `${Math.round(s.distanceMeters)} m`
                                : `${(s.distanceMeters / 1000).toFixed(1)} km`}
                            </span>
                          )}
                        </div>
                        <button
                          type="button"
                          aria-label={`Reportar ${s.name}`}
                          title="Reportar tienda"
                          style={styles.dropdownReportBtn}
                          onMouseDown={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            setReportTarget({ type: 'store', id: s.id, name: s.name });
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = 'rgba(180, 40, 40, 0.75)';
                            e.currentTarget.style.borderColor = 'rgba(180, 40, 40, 0.75)';
                            e.currentTarget.style.color = 'var(--bg-elevated, #fff)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'none';
                            e.currentTarget.style.borderColor = 'rgba(180, 40, 40, 0.25)';
                            e.currentTarget.style.color = 'rgba(180, 40, 40, 0.55)';
                          }}
                        >
                          !
                        </button>
                      </div>
                    );
                  })}

                {!storeSearching &&
                  storeResults.length === 0 &&
                  storeQuery.trim().length >= 2 && (
                    <div style={styles.dropdownState}>{tf.noResults}</div>
                  )}
              </div>
            )}
          </div>

          {autoStoreFound && autoStoreMessage ? (
            <div style={styles.autoStoreFoundBanner}>
              <span style={styles.autoStoreFoundIcon} aria-hidden="true">📍</span>
              <span style={styles.autoStoreFoundText}>{autoStoreMessage}</span>
              <span style={styles.autoStoreChangeHint}>· Escribe para cambiarla</span>
            </div>
          ) : autoStoreDetecting ? (
            <div style={styles.autoStoreDetectingBanner} role="status" aria-live="polite">
              {autoStoreMessage}
            </div>
          ) : autoStoreMessage ? (
            <div style={styles.infoText}>{autoStoreMessage}</div>
          ) : formData.storeId ? (
            <div style={styles.selectedBadge}>{tf.storeSelected}</div>
          ) : null}
          {errors.storeId && (
            <div id="pub-store-error" role="alert" style={styles.errorText}>{errors.storeId}</div>
          )}
        </div>

        {/* ── Precio + Moneda ───────────────────────────────────────────────── */}
        <div style={styles.row}>
          <div style={styles.formGroup}>
            <label htmlFor="pub-price" style={styles.label}>
              {tf.priceLabel} <span style={styles.required}>*</span>
            </label>
            <div style={styles.inputGroup}>
              <span style={styles.currencyPrefix}>{currencySymbol}</span>
              <input
                id="pub-price"
                type="number"
                placeholder="0"
                value={formData.price}
                aria-invalid={!!errors.price}
                aria-describedby={errors.price ? "pub-price-error" : undefined}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === "" || Number(val) >= 0) handleInputChange("price", val);
                }}
                style={styles.inputWithPrefix}
                min="0"
              />
            </div>
            {errors.price && <div id="pub-price-error" role="alert" style={styles.errorText}>{errors.price}</div>}
          </div>

          <div style={styles.formGroup}>
            <label htmlFor="pub-currency" style={styles.label}>{tf.currencyLabel}</label>
            <select
              id="pub-currency"
              value={formData.currency}
              onChange={(e) => handleInputChange("currency", e.target.value)}
              style={styles.select}
            >
              <option value="COP">COP (Pesos)</option>
              <option value="USD">USD (Dólares)</option>
              <option value="EUR">EUR (Euros)</option>
            </select>
          </div>
        </div>

        {/* ── Descripción ───────────────────────────────────────────────────── */}
        <div style={styles.formGroup}>
          <label htmlFor="pub-description" style={styles.label}>{tf.descriptionLabel}</label>
          <textarea
            id="pub-description"
            placeholder={tf.descriptionPlaceholder}
            value={formData.description}
            aria-invalid={!!errors.description}
            aria-describedby={errors.description ? "pub-description-error" : undefined}
            onChange={(e) => handleInputChange("description", e.target.value)}
            maxLength={500}
            style={styles.textarea}
          />
          <div style={styles.charCount}>{formData.description.length}/500</div>
          {errors.description && (
            <div id="pub-description-error" role="alert" style={styles.errorText}>{errors.description}</div>
          )}
        </div>

        {/* ── Foto ──────────────────────────────────────────────────────────── */}
        <div style={styles.formGroup}>
          <label style={styles.label}>
            {tf.photoLabel} <span style={styles.required}>*</span>
          </label>
          <PhotoUploader
            onUpload={(url, uploadMeta) => {
              handleInputChange("photoUrl", url);
              handleInputChange("photoModeration", uploadMeta?.moderation || null);
            }}
            disabled={isSubmitting}
          />
          {errors.photoUrl && (
            <div id="pub-photo-error" role="alert" style={styles.errorText}>{errors.photoUrl}</div>
          )}
        </div>

        {/* ── Submit ────────────────────────────────────────────────────────── */}
        <button
          type="submit"
          style={{ ...styles.submitBtn, opacity: isSubmitting ? 0.7 : 1 }}
          disabled={isSubmitting}
        >
          {isSubmitting ? tf.submitting : tf.submitBtn}
        </button>
      </form>

      {/* ── Modal de tienda ─────────────────────────────────────────────────── */}
      {showStoreModal && (
        <StoreCreateModal
          initialName={storeQuery.trim()}
          onSuccess={handleStoreCreated}
          onClose={() => setShowStoreModal(false)}
        />
      )}
      {showProductModal && (
        <ProductQuickCreateModal
          initialName={productQuery.trim()}
          initialBarcode={scannedBarcode}
          initialBrandName={barcodePrefill.brandName || brandQuery.trim()}
          initialCategoryHint={barcodePrefill.categoryHint}
          initialBaseQuantity={barcodePrefill.baseQuantity}
          initialUnitAbbreviation={barcodePrefill.unitAbbreviation}
          onSuccess={handleProductCreated}
          onClose={() => setShowProductModal(false)}
        />
      )}
      {ENABLE_BARCODE_SCAN && (
        <BarcodeScannerModal
          open={showBarcodeModal}
          onClose={() => setShowBarcodeModal(false)}
          onDetected={handleBarcodeDetected}
        />
      )}
      <CelebrationOverlay
        visible={showCelebration}
        message={t.celebration?.publication}
        onDone={() => setShowCelebration(false)}
      />
      {reportTarget && (
        <ReportModal
          targetType={reportTarget.type}
          targetId={reportTarget.id}
          targetName={reportTarget.name}
          onClose={() => setReportTarget(null)}
        />
      )}
    </div>
  );
}

export default PublicationForm;
