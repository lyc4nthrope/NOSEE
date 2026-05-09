import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useOptimPrefs } from '../hooks/useOptimPrefs';
import { useOptimizeSingleItem } from '../hooks/useOptimizeSingleItem';
import { useGeoLocation } from '@/features/publications/hooks/useGeoLocation';
import * as publicationsApi from '@/services/api/publications.api';
import { OptimSettingsPanel } from './OptimSettingsPanel';
import { InfiniteHorizontalCarousel } from './InfiniteHorizontalCarousel';
import { TrashIcon, PlusIcon, GearIcon, ChevronDownIcon, calculateDeliveryFee, buildResultFromSelections } from '../utils/shoppingListUtils';
import { lista, modeSelection, delivForm } from '../styles/shoppingListStyles';
import { useAuthStore, selectIsAuthenticated } from '@/features/auth/store/authStore';
import { useShoppingListStore } from '@/features/shopping-list/store/shoppingListStore';
import { createOrder } from '@/services/api/orders.api';
import { DeliveryMapPicker } from './DeliveryMapPicker';
import {
  recordShoppingListOrderStarted,
  recordShoppingListOrderAbandoned,
  recordOptimizationRun,
  recordOrderConfirmed,
} from '@/services/metrics';

const SORT_MODE_TO_STRATEGY = { cheapest: 'price', nearest: 'fewest_stores', balanced: 'balanced' };
const toMetricsStrategy = (sortMode) => SORT_MODE_TO_STRATEGY[sortMode] ?? 'balanced';

// ─── Pestaña Mi Lista ─────────────────────────────────────────────────────────
export function ListaTab({ items, addItem, removeItem, clearList, saveList, addOrder, onSaved, onConfirmedDelivery, onConfirmedPickup }) {
  const [inputValue, setInputValue] = useState('');
  const [saveInput, setSaveInput] = useState('');
  const [showSaveInput, setShowSaveInput] = useState(false);
  const [showOptimSettings, setShowOptimSettings] = useState(false);
  const [checkedItems, setCheckedItems] = useState(new Set());
  const toggleCheck = (id) => setCheckedItems((prev) => {
    const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next;
  });

  // Notificación al guardar
  const [saveStatus, setSaveStatus] = useState(null); // null | 'success' | 'error'
  const saveTimerRef = useRef(null);

  // Preferencias de optimización persistidas
  const [prefs, savePrefs] = useOptimPrefs();

  // Geolocalización — reutiliza el hook compartido con error handling y persistencia
  const {
    latitude, longitude, hasLocation,
    error: coordsError, refetch: requestCoords,
  } = useGeoLocation({ timeout: 8000 });

  // Resultados del cálculo: { [itemId]: publications[] }
  const [calcResults, setCalcResults] = useState(null);
  const [calculating, setCalculating] = useState(false);
  const [calcError, setCalcError] = useState(null);

  // Ítems siendo optimizados individualmente (post-cálculo inicial): { [itemId]: true }
  const [optimizingItems, setOptimizingItems] = useState({});

  // Refs para leer valores actuales dentro de efectos sin agregarlos a deps
  const calcResultsRef    = useRef(calcResults);
  const optimizingItemsRef = useRef(optimizingItems);
  useEffect(() => { calcResultsRef.current    = calcResults;    }, [calcResults]);
  useEffect(() => { optimizingItemsRef.current = optimizingItems; }, [optimizingItems]);

  // Publicación seleccionada por ítem: { [itemId]: publication }
  const [selectedPubs, setSelectedPubs] = useState({});

  // Modo de entrega elegido
  const [deliveryMode, setDeliveryMode] = useState(null); // null | 'delivery' | 'pickup'

  // Fase: 'list' | 'result' | 'mode-selection' | 'delivery-form'
  const [phase, setPhase] = useState('list');

  // Modo seleccionado en la pantalla de mode-selection (antes de confirmar)
  const [selectedMode, setSelectedMode] = useState(null);

  // Dirección de domicilio (solo para deliveryMode === 'delivery')
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [deliveryName, setDeliveryName] = useState('');
  const [deliveryPhone, setDeliveryPhone] = useState('');
  const [deliveryApartment, setDeliveryApartment] = useState('');
  const [deliveryInstructions, setDeliveryInstructions] = useState('');
  const [deliveryPaymentMethod, setDeliveryPaymentMethod] = useState('cash'); // 'cash' | 'transfer'
  // Coords seleccionadas en el mapa de entrega — tienen prioridad sobre el GPS del hook
  const [deliveryMapCoords, setDeliveryMapCoords] = useState(null); // { lat, lng }
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);

  const currentUserId = useAuthStore((s) => s.user?.id);
  const isAuthenticated = useAuthStore(selectIsAuthenticated);
  const navigate = useNavigate();
  const updateItem = useShoppingListStore((s) => s.updateItem);

  // Ítem expandido (muestra carrusel)
  const [expandedId, setExpandedId] = useState(null);

  const inputRef = useRef(null);
  const deliveryMapRef = useRef(null);

  // Limpieza del timer al desmontar
  useEffect(() => () => clearTimeout(saveTimerRef.current), []);

  // ── Draft de resultado: persiste solo al navegar al detalle ───────────────
  const DRAFT_KEY = 'nosee_lista_draft';

  // Restaurar al montar si hay un draft válido para estos ítems
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      const draft = JSON.parse(raw);
      const itemsKey = items.map((i) => i.id).join(',');
      if (draft.itemsKey !== itemsKey) { sessionStorage.removeItem(DRAFT_KEY); return; }
      setPhase(draft.phase);
      setCalcResults(draft.calcResults);
      setSelectedPubs(draft.selectedPubs ?? {});
      setExpandedId(draft.expandedId ?? null);
      sessionStorage.removeItem(DRAFT_KEY);
    } catch {
      sessionStorage.removeItem(DRAFT_KEY);
    }
  // Solo al montar — items viene de Zustand y es estable
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleViewDetail = useCallback((pub) => {
    try {
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify({
        itemsKey:     items.map((i) => i.id).join(','),
        phase,
        calcResults,
        selectedPubs,
        expandedId,
      }));
    } catch { /* storage lleno — navegar igual */ }
    navigate(`/publicaciones/${pub.id}`);
  }, [items, phase, calcResults, selectedPubs, expandedId, navigate]);

  const handleAdd = () => {
    const trimmed = inputValue.trim();
    if (!trimmed) return;
    addItem(trimmed, 1);
    setInputValue('');
    // Si ya está calculado, NO reseteamos — el efecto detecta el ítem nuevo y lo optimiza solo
    if (!isCalculatedRef.current) setCalcResults(null);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleAdd();
  };

  const handleRemove = (id) => {
    removeItem(id);
    setCalcResults((prev) => { if (!prev) return prev; const n = { ...prev }; delete n[id]; return n; });
    setSelectedPubs((prev) => { const n = { ...prev }; delete n[id]; return n; });
    if (expandedId === id) setExpandedId(null);
  };

  const handleSaveList = (name) => {
    clearTimeout(saveTimerRef.current);
    try {
      saveList(name);
      setSaveStatus('success');
      onSaved?.();
    } catch {
      setSaveStatus('error');
    }
    saveTimerRef.current = setTimeout(() => setSaveStatus(null), 3000);
  };

  // ── Optimización individual (para ítems añadidos post-cálculo) ───────────────
  const { optimizeSingleItem: _optimizeSingleItem } = useOptimizeSingleItem({ prefs, hasLocation, latitude, longitude });

  const optimizeSingleItem = useCallback(async (item) => {
    setOptimizingItems((prev) => ({ ...prev, [item.id]: true }));
    try {
      const { pubs: sorted, bestPub } = await _optimizeSingleItem(item);
      setCalcResults((prev) => prev ? { ...prev, [item.id]: sorted } : { [item.id]: sorted });
      if (bestPub) setSelectedPubs((prev) => ({ ...prev, [item.id]: bestPub }));
    } catch {
      setCalcResults((prev) => prev ? { ...prev, [item.id]: [] } : { [item.id]: [] });
    } finally {
      setOptimizingItems((prev) => { const n = { ...prev }; delete n[item.id]; return n; });
    }
  }, [_optimizeSingleItem]);

  // Cuando la lista ya está calculada y se agrega un ítem nuevo, optimizarlo solo
  const isCalculatedRef = useRef(false);
  useEffect(() => { isCalculatedRef.current = calcResults !== null; }, [calcResults]);

  useEffect(() => {
    if (!isCalculatedRef.current) return;
    const missing = items.filter(
      (item) => !(item.id in calcResultsRef.current) && !optimizingItemsRef.current[item.id]
    );
    missing.forEach((item) => optimizeSingleItem(item));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  const calcRequestRef = useRef(0);

  const handleCalculate = useCallback(() => {
    if (items.length === 0) return;

    recordShoppingListOrderStarted(items.length);

    const requestId = ++calcRequestRef.current;
    const calcStart = Date.now();
    let noResultCount = 0;

    setCalculating(true);
    setCalcError(null);
    setDeliveryMode(null);  // limpiar modo anterior al re-optimizar
    // Primera vez: inicializar para activar la vista optimizada.
    // Re-optimización: mantener resultados y selecciones actuales visibles mientras se actualizan.
    setCalcResults((prev) => prev ?? {});
    setExpandedId(null);

    // Marcar todos los ítems como "optimizando" — el precio/tienda anterior sigue visible
    setOptimizingItems(Object.fromEntries(items.map((item) => [item.id, true])));

    const needsCoords = prefs.sortMode === 'nearest' || prefs.sortMode === 'balanced';
    const apiSortBy   = prefs.validatedOnly ? 'validated' : 'cheapest';
    const distanceParams = needsCoords && hasLocation
      ? { maxDistance: prefs.maxDistance, latitude, longitude }
      : {};

    // Cada ítem se resuelve de forma independiente — el UI se actualiza a medida que llegan
    let remaining = items.length;

    items.forEach((item) => {
      publicationsApi
        .getPublications({ productName: item.productName, sortBy: apiSortBy, limit: 30, ...distanceParams })
        .then((res) => {
          if (requestId !== calcRequestRef.current) return;

          let pubs = res.success ? (res.data ?? []) : [];
          if (prefs.storeType === 'physical') pubs = pubs.filter((p) => Number(p.store?.store_type_id) !== 2);
          else if (prefs.storeType === 'online')  pubs = pubs.filter((p) => Number(p.store?.store_type_id) === 2);
          const sorted = [...pubs].sort((a, b) => (a.price ?? 0) - (b.price ?? 0));

          if (sorted.length === 0) noResultCount++;
          setCalcResults((prev) => (prev ? { ...prev, [item.id]: sorted } : { [item.id]: sorted }));
          if (sorted.length > 0) setSelectedPubs((prev) => ({ ...prev, [item.id]: sorted[0] }));
        })
        .catch(() => {
          if (requestId !== calcRequestRef.current) return;
          noResultCount++;
          setCalcResults((prev) => (prev ? { ...prev, [item.id]: [] } : { [item.id]: [] }));
        })
        .finally(() => {
          setOptimizingItems((prev) => { const n = { ...prev }; delete n[item.id]; return n; });
          remaining -= 1;
          if (remaining === 0 && requestId === calcRequestRef.current) {
            setCalculating(false);
            recordOptimizationRun(toMetricsStrategy(prefs.sortMode), Date.now() - calcStart, noResultCount);
          }
        });
    });
  }, [items, prefs, hasLocation, latitude, longitude]);

  const toggleExpand = (id) => {
    if (!calcResults) return;
    setExpandedId((prev) => (prev === id ? null : id));
  };

  const handleSelectPub = (itemId, pub) => {
    setSelectedPubs((prev) => ({ ...prev, [itemId]: pub }));
  };

  const isCalculated = calcResults !== null;
  const hasSelections = Object.keys(selectedPubs).length > 0;

  const total = isCalculated
    ? items.reduce((sum, item) => {
        const pub = selectedPubs[item.id];
        return sum + (pub?.price ?? 0) * (item.quantity || 1);
      }, 0)
    : 0;

  const handleConfirmOrder = async (modeOverride) => {
    const isDelivery = (modeOverride ?? deliveryMode) === 'delivery';
    const result = buildResultFromSelections(items, selectedPubs);
    const localId = `NSE-${Date.now().toString(36).toUpperCase()}`;
    const userCoords = deliveryMapCoords ?? (hasLocation ? { lat: latitude, lng: longitude } : null);
    const fee = isDelivery ? calculateDeliveryFee(result.stores, userCoords) : 0;

    setSaving(true);
    setSaveError(null);

    // Guardar en Supabase si es domicilio (el repartidor necesita verlo)
    let supabaseId = null;
    if (isDelivery) {
      const { data: saved, error } = await createOrder({
        userId:               currentUserId,
        localId,
        deliveryMode:         true,
        deliveryAddress:      deliveryAddress.trim() || '',
        deliveryCoords:       userCoords,
        deliveryName:         deliveryName.trim()         || null,
        deliveryPhone:        deliveryPhone.trim()        || null,
        deliveryApartment:    deliveryApartment.trim()    || null,
        deliveryInstructions: deliveryInstructions.trim() || null,
        stores:               result.stores,
        items:                items,
        totalCost:            result.totalCost,
        savings:              result.savings     ?? 0,
        savingsPct:           result.savingsPct  ?? 0,
        deliveryFee:          fee,
        strategy:             'balanced',
      });

      if (error) {
        console.error('[ListaTab] createOrder error:', error.message, error);
        setSaveError(`No se pudo guardar el pedido: ${error.message}. Revisá tu conexión e intentá de nuevo.`);
        setSaving(false);
        return;
      }
      supabaseId = saved?.id ?? null;
    }

    addOrder({
      id:                   localId,
      supabaseId,
      result,
      userCoords,
      deliveryFee:          fee,
      createdAt:            new Date().toISOString(),
      deliveryMode:         isDelivery,
      deliveryStatus:       isDelivery ? 'searching' : null,
      driverLocation:       null,
      cancellationCharged:  false,
    });

    recordOrderConfirmed(toMetricsStrategy(prefs.sortMode), isDelivery, result.totalCost ?? 0, result.savingsPct ?? 0);

    setSaving(false);

    sessionStorage.removeItem(DRAFT_KEY);
    if (isDelivery) {
      setPhase('list');
      setCalcResults(null);
      setSelectedPubs({});
      setDeliveryMode(null);
      setDeliveryAddress('');
      setDeliveryName('');
      setDeliveryPhone('');
      setDeliveryApartment('');
      setDeliveryInstructions('');
      setDeliveryPaymentMethod('cash');
      setDeliveryMapCoords(null);
      onConfirmedDelivery?.();
    } else {
      setCalcResults(null);
      setSelectedPubs({});
      setDeliveryMode(null);
      onConfirmedPickup?.();
    }
  };

  // ── Fase "delivery-form" — formulario completo de domicilio ──────────────
  if (phase === 'delivery-form') {
    const previewUserCoords = deliveryMapCoords ?? (hasLocation ? { lat: latitude, lng: longitude } : null);
    const previewResult = buildResultFromSelections(items, selectedPubs);
    const previewDeliveryFee = calculateDeliveryFee(previewResult.stores, previewUserCoords);
    const deliveryTotal = total + previewDeliveryFee;
    const canSubmit = (deliveryAddress.trim().length > 0 || deliveryMapCoords !== null) && !saving;
    const mapInitialCoords = hasLocation ? { lat: latitude, lng: longitude } : null;

    return (
      <div style={delivForm.root}>
        {/* Header with back button */}
        <div style={delivForm.header}>
          <button type="button" onClick={() => setPhase('mode-selection')} style={delivForm.backBtn}>
            ← Volver
          </button>
          <div style={delivForm.headerRight}>
            <h2 style={delivForm.title}>Información de entrega</h2>
            <span style={delivForm.step}>Paso 2 de 3</span>
          </div>
        </div>

        {/* Form fields */}
        <div style={delivForm.section}>
          <label style={delivForm.label}>Nombre completo *</label>
          <input
            type="text"
            value={deliveryName}
            onChange={(e) => setDeliveryName(e.target.value)}
            placeholder="Ej: María García"
            style={delivForm.input}
          />
        </div>

        <div style={delivForm.section}>
          <label style={delivForm.label}>Teléfono</label>
          <input
            type="tel"
            value={deliveryPhone}
            onChange={(e) => setDeliveryPhone(e.target.value)}
            placeholder="Ej: 300 123 4567"
            style={delivForm.input}
          />
        </div>

        <div style={delivForm.section}>
          <label style={delivForm.label}>
            Dirección de entrega
            {deliveryMapCoords
              ? <span style={{ fontSize: '11px', color: 'var(--success, #16a34a)', fontWeight: 400, marginLeft: '6px' }}>✓ opcional — ubicación marcada en el mapa</span>
              : <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 400, marginLeft: '6px' }}>(opcional si marcás en el mapa)</span>
            }
          </label>
          <div style={{ display: 'flex', gap: '6px' }}>
            <input
              type="text"
              value={deliveryAddress}
              onChange={(e) => setDeliveryAddress(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  deliveryMapRef.current?.geocodeAndMove(deliveryAddress);
                }
              }}
              placeholder="Ej: Calle 10 # 5-30, Quibdó — presioná Enter para ver en mapa"
              style={{
                ...delivForm.input,
                flex: 1,
                ...(saveError && !deliveryAddress.trim() && !deliveryMapCoords ? delivForm.inputError : {}),
              }}
            />
            <button
              type="button"
              onClick={() => deliveryMapRef.current?.geocodeAndMove(deliveryAddress)}
              style={{
                padding: '0 12px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--accent)',
                background: 'var(--accent-soft)',
                color: 'var(--accent)',
                fontSize: '13px',
                fontWeight: 700,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                fontFamily: 'inherit',
              }}
            >
              📍 Ver
            </button>
          </div>
          {/* Mapa: marcá tu ubicación de entrega */}
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '8px 0 4px', fontWeight: 500 }}>
            📍 Marcá tu ubicación de entrega en el mapa
          </p>
          <DeliveryMapPicker
            ref={deliveryMapRef}
            initialCoords={mapInitialCoords}
            stores={previewResult.stores}
            deliveryFee={previewDeliveryFee}
            onChange={setDeliveryMapCoords}
          />
          {deliveryMapCoords && (
            <p style={{ fontSize: '11px', color: 'var(--success, #16a34a)', margin: '2px 0 0', fontWeight: 600 }}>
              📍 Entrega: {deliveryMapCoords.lat.toFixed(5)}, {deliveryMapCoords.lng.toFixed(5)}
            </p>
          )}
        </div>

        <div style={delivForm.section}>
          <label style={delivForm.label}>Apartamento / Torre / Edificio</label>
          <input
            type="text"
            value={deliveryApartment}
            onChange={(e) => setDeliveryApartment(e.target.value)}
            placeholder="Ej: Torre B, Piso 4, Apto 401"
            style={delivForm.input}
          />
        </div>

        <div style={delivForm.section}>
          <label style={delivForm.label}>Instrucciones para el repartidor</label>
          <textarea
            value={deliveryInstructions}
            onChange={(e) => setDeliveryInstructions(e.target.value)}
            placeholder="Ej: Dejar en la portería, timbre no funciona..."
            rows={3}
            style={delivForm.textarea}
          />
        </div>

        {/* Payment method */}
        <div style={delivForm.section}>
          <label style={delivForm.label}>Método de pago</label>
          <div style={delivForm.paymentOptions}>
            <button
              type="button"
              onClick={() => setDeliveryPaymentMethod('cash')}
              style={{
                ...delivForm.paymentOption,
                ...(deliveryPaymentMethod === 'cash' ? delivForm.paymentOptionActive : {}),
              }}
            >
              <span style={delivForm.paymentIcon}>💵</span>
              <span style={delivForm.paymentLabel}>Efectivo al repartidor</span>
              {deliveryPaymentMethod === 'cash' && <span style={delivForm.paymentCheck}>✓</span>}
            </button>
            <button
              type="button"
              onClick={() => setDeliveryPaymentMethod('transfer')}
              style={{
                ...delivForm.paymentOption,
                ...(deliveryPaymentMethod === 'transfer' ? delivForm.paymentOptionActive : {}),
              }}
            >
              <span style={delivForm.paymentIcon}>📱</span>
              <span style={delivForm.paymentLabel}>Transferencia bancaria</span>
              {deliveryPaymentMethod === 'transfer' && <span style={delivForm.paymentCheck}>✓</span>}
            </button>
          </div>
        </div>

        {/* Order summary */}
        <div style={delivForm.summary}>
          <div style={delivForm.summaryRow}>
            <span style={delivForm.summaryLabel}>Subtotal productos</span>
            <span style={delivForm.summaryValue}>${total.toLocaleString('es-CO')} COP</span>
          </div>
          <div style={delivForm.summaryRow}>
            <span style={delivForm.summaryLabel}>Tarifa de domicilio</span>
            <span style={delivForm.summaryValue}>+${previewDeliveryFee.toLocaleString('es-CO')} COP</span>
          </div>
          <div style={{ ...delivForm.summaryRow, ...delivForm.summaryTotal }}>
            <span>Total</span>
            <span style={delivForm.summaryTotalValue}>${deliveryTotal.toLocaleString('es-CO')} COP</span>
          </div>
        </div>

        {/* Error */}
        {saveError && (
          <p style={delivForm.error}>{saveError}</p>
        )}
        {!deliveryAddress.trim() && !deliveryMapCoords && saveError && (
          <p style={delivForm.error}>Escribí una dirección o marcá tu ubicación en el mapa</p>
        )}

        {/* Submit button */}
        <button
          type="button"
          onClick={() => {
            if (!deliveryAddress.trim() && !deliveryMapCoords) {
              setSaveError('Escribí una dirección o marcá tu ubicación en el mapa');
              return;
            }
            handleConfirmOrder('delivery');
          }}
          disabled={!canSubmit}
          style={{
            ...delivForm.submitBtn,
            opacity: canSubmit ? 1 : 0.6,
            cursor: canSubmit ? 'pointer' : 'not-allowed',
          }}
        >
          {saving ? 'Guardando pedido...' : `Confirmar pedido · $${deliveryTotal.toLocaleString('es-CO')} COP`}
        </button>
      </div>
    );
  }

  // ── Fase "mode-selection" — pantalla de selección de modo ────────────────
  if (phase === 'mode-selection') {
    const modeUserCoords = deliveryMapCoords ?? (hasLocation ? { lat: latitude, lng: longitude } : null);
    const modeResult = buildResultFromSelections(items, selectedPubs);
    const modeDeliveryFee = calculateDeliveryFee(modeResult.stores, modeUserCoords);
    return (
      <div style={modeSelection.root}>
        {/* header */}
        <div style={modeSelection.header}>
          <h2 style={modeSelection.title}>¿Cómo querés recibir tu pedido?</h2>
          <p style={modeSelection.subtitle}>Visitá una tienda o pedí envío a domicilio</p>
        </div>

        {/* option cards */}
        <div style={modeSelection.optionsWrap}>
          {/* Delivery card */}
          <button
            type="button"
            onClick={() => setSelectedMode('delivery')}
            style={{
              ...modeSelection.optionCard,
              ...(selectedMode === 'delivery' ? modeSelection.optionCardActive : {}),
            }}
          >
            <div style={modeSelection.optionLeft}>
              <span style={modeSelection.optionIcon}>🛵</span>
              <div style={modeSelection.optionBody}>
                <span style={modeSelection.optionTitle}>Domicilio</span>
                <span style={modeSelection.optionDesc}>Recibí tus productos en la puerta de tu casa</span>
                <span style={modeSelection.optionBadge}>Estimado 1-2 horas · +${modeDeliveryFee.toLocaleString('es-CO')}</span>
              </div>
            </div>
            {selectedMode === 'delivery' && <span style={modeSelection.checkmark}>✓</span>}
          </button>

          {/* Voy yo card */}
          <button
            type="button"
            onClick={() => setSelectedMode('pickup')}
            style={{
              ...modeSelection.optionCard,
              ...(selectedMode === 'pickup' ? modeSelection.optionCardActive : {}),
            }}
          >
            <div style={modeSelection.optionLeft}>
              <span style={modeSelection.optionIcon}>🚶</span>
              <div style={modeSelection.optionBody}>
                <span style={modeSelection.optionTitle}>Voy yo</span>
                <span style={modeSelection.optionDesc}>Planeá tu ruta con el mapa de tiendas y ahorros optimizados</span>
                <span style={modeSelection.optionBadge}>Sin costo extra · mapa incluido</span>
              </div>
            </div>
            {selectedMode === 'pickup' && <span style={modeSelection.checkmark}>✓</span>}
          </button>
        </div>

        {/* total summary */}
        {hasSelections && (
          <div style={modeSelection.totalRow}>
            <span style={modeSelection.totalLabel}>Total estimado</span>
            <span style={modeSelection.totalValue}>
              ${(total + (selectedMode === 'delivery' ? modeDeliveryFee : 0)).toLocaleString('es-CO')}
              <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-muted)' }}> COP</span>
            </span>
          </div>
        )}

        {/* actions */}
        <div style={modeSelection.actions}>
          <button
            type="button"
            onClick={() => { recordShoppingListOrderAbandoned(); setSelectedMode(null); setPhase('list'); }}
            style={modeSelection.cancelBtn}
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={!selectedMode}
            onClick={() => {
              if (selectedMode === 'delivery') {
                setDeliveryMode('delivery');
                setPhase('delivery-form');
              } else {
                setDeliveryMode('pickup');
                handleConfirmOrder('pickup');
              }
            }}
            style={{
              ...modeSelection.continueBtn,
              opacity: selectedMode ? 1 : 0.45,
              cursor: selectedMode ? 'pointer' : 'not-allowed',
            }}
          >
            {selectedMode === 'delivery' ? 'Continuar con domicilio' : selectedMode === 'pickup' ? 'Ver ruta de compra' : 'Continuar'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={lista.root}>

      {/* ── Input para agregar ─────────────────────────────────── */}
      <div style={lista.inputRow}>
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Escribe un producto (ej: leche, arroz, jabón...)"
          style={lista.input}
        />
        <button
          type="button"
          onClick={handleAdd}
          disabled={!inputValue.trim()}
          aria-label="Agregar producto"
          style={{
            ...lista.addBtn,
            opacity: inputValue.trim() ? 1 : 0.45,
            cursor: inputValue.trim() ? 'pointer' : 'not-allowed',
          }}
        >
          <PlusIcon />
        </button>
      </div>

      {items.length === 0 ? (
        <div style={lista.empty}>
          <p style={lista.emptyText}>Tu lista está vacía</p>
          <p style={lista.emptyHint}>Escribe un producto arriba para comenzar</p>
        </div>
      ) : (
        <>
          {/* ── Barra de herramientas ───────────────────────────── */}
          <div style={lista.toolbar}>
            <span style={lista.itemCount}>
              {items.length} {items.length === 1 ? 'producto' : 'productos'}
            </span>
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
              <button
                type="button"
                onClick={() => setShowSaveInput((v) => !v)}
                style={lista.saveBtn}
                title="Guardar lista con un nombre"
              >
                💾 Guardar
              </button>
              <button type="button" onClick={clearList} style={lista.clearBtn}>Limpiar</button>
            </div>
          </div>

          {/* ── Notificación de guardado ────────────────────────── */}
          {saveStatus && (
            <div style={{
              ...lista.saveNotice,
              ...(saveStatus === 'success' ? lista.saveNoticeSuccess : lista.saveNoticeError),
            }}>
              {saveStatus === 'success' ? '✓ Lista guardada correctamente' : '✗ No se pudo guardar la lista'}
            </div>
          )}

          {/* ── Input para guardar lista ─────────────────────────── */}
          {showSaveInput && (
            <div style={lista.saveRow}>
              <input
                type="text"
                value={saveInput}
                onChange={(e) => setSaveInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && saveInput.trim()) {
                    handleSaveList(saveInput.trim());
                    setSaveInput('');
                    setShowSaveInput(false);
                  }
                  if (e.key === 'Escape') setShowSaveInput(false);
                }}
                placeholder="Nombre de la lista (ej: Mercado semanal)"
                style={lista.saveInput}
                autoFocus
              />
              <button
                type="button"
                disabled={!saveInput.trim()}
                onClick={() => {
                  if (!saveInput.trim()) return;
                  handleSaveList(saveInput.trim());
                  setSaveInput('');
                  setShowSaveInput(false);
                }}
                style={{
                  ...lista.saveConfirmBtn,
                  opacity: saveInput.trim() ? 1 : 0.45,
                  cursor: saveInput.trim() ? 'pointer' : 'not-allowed',
                }}
              >
                Guardar
              </button>
            </div>
          )}

          {/* ── Summary bar (solo post-optimización) ───────────── */}
          {isCalculated && hasSelections && (
            <div style={lista.summaryBar}>
              <div style={lista.summaryLeft}>
                <span style={lista.summaryTitle}>Resumen</span>
                <span style={lista.summaryCount}>
                  {Object.keys(selectedPubs).length} {Object.keys(selectedPubs).length === 1 ? 'producto' : 'productos'}
                </span>
              </div>
              <div>
                <span style={lista.summaryTotal}>
                  ${total.toLocaleString('es-CO')}
                </span>
                <span style={lista.summaryTotalCurrency}> COP</span>
              </div>
            </div>
          )}

          {/* ── Info banner (solo post-optimización) ────────────── */}
          {isCalculated && (
            <div style={lista.infoBanner}>
              Seleccionamos las mejores opciones. Tocá un producto para ver alternativas y elegir la que más te convenga.
            </div>
          )}

          {/* ── Lista de ítems ──────────────────────────────────── */}
          <ul style={lista.list}>
            {items.map((item) => {
              const isExpanded          = expandedId === item.id;
              const isOptimizingThis    = !!optimizingItems[item.id];
              const pubs                = calcResults?.[item.id];
              const hasPubs             = pubs && pubs.length > 0;
              const chosenPub           = selectedPubs[item.id];
              const chosenPrice         = chosenPub?.price ?? null;
              const avgPrice            = (() => {
                if (!pubs || !chosenPub?.product_id) return null;
                const others = pubs.filter((p) => p.product_id === chosenPub.product_id && p.id !== chosenPub.id);
                if (others.length === 0) return null;
                return others.reduce((sum, p) => sum + (p.price ?? 0), 0) / others.length;
              })();

              if (isCalculated) {
                return (
                  <li key={item.id} style={lista.optimItemWrap}>
                    {/* Fila principal — card de producto optimizado (toda la fila es clickeable) */}
                    <div
                      role={hasPubs ? 'button' : undefined}
                      tabIndex={hasPubs ? 0 : undefined}
                      aria-expanded={hasPubs ? isExpanded : undefined}
                      aria-label={hasPubs ? `${isExpanded ? 'Ocultar' : 'Ver'} opciones de ${item.productName}` : undefined}
                      onClick={hasPubs ? () => toggleExpand(item.id) : undefined}
                      onKeyDown={hasPubs ? (e) => { if (e.key === 'Enter' || e.key === ' ') toggleExpand(item.id); } : undefined}
                      style={{
                        ...lista.optimItemRow,
                        ...(isExpanded ? lista.optimItemRowExpanded : {}),
                        cursor: hasPubs ? 'pointer' : 'default',
                      }}
                    >
                      {/* Avatar circular — letra de fallback siempre visible, imagen fadea encima al cargar */}
                      <div style={{ ...lista.optimItemAvatar, position: 'relative' }}>
                        <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          {item.productName.charAt(0)}
                        </span>
                        {chosenPub?.photo_url && (
                          <img
                            src={chosenPub.photo_url}
                            alt={item.productName}
                            loading="lazy"
                            decoding="async"
                            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%', opacity: 0, transition: 'opacity 0.25s' }}
                            onLoad={(e) => { e.currentTarget.style.opacity = '1'; }}
                            onError={(e) => { e.currentTarget.style.display = 'none'; }}
                          />
                        )}
                      </div>

                      {/* Cuerpo */}
                      <div style={lista.optimItemBody}>
                        <span style={lista.optimItemName}>{item.productName}</span>
                        <div style={lista.optimItemMeta}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }} onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              onClick={() => updateItem(item.id, { quantity: Math.max(1, item.quantity - 1) })}
                              style={lista.qtyBtn}
                              aria-label="Reducir cantidad"
                            >
                              −
                            </button>
                            <span style={lista.qtyValue}>{item.quantity}</span>
                            <button
                              type="button"
                              onClick={() => updateItem(item.id, { quantity: item.quantity + 1 })}
                              style={lista.qtyBtn}
                              aria-label="Aumentar cantidad"
                            >
                              +
                            </button>
                          </div>
                          {isOptimizingThis && (
                            <span style={{ color: 'var(--accent)', fontStyle: 'italic' }}>⏳ Optimizando...</span>
                          )}
                          {!isOptimizingThis && hasPubs && chosenPub?.store?.name && (
                            <span>{chosenPub.store.name}</span>
                          )}
                          {!isOptimizingThis && !hasPubs && pubs !== undefined && (
                            <span style={{ fontStyle: 'italic' }}>Sin coincidencias</span>
                          )}
                        </div>
                      </div>

                      {/* Precio + acciones */}
                      <div style={lista.optimItemRight}>
                        {!isOptimizingThis && hasPubs && chosenPrice !== null && (
                          <div style={{ textAlign: 'right' }}>
                            <div style={lista.optimItemPrice}>
                              ${(chosenPrice * item.quantity).toLocaleString('es-CO')}
                            </div>
                            <div style={lista.optimItemPriceSub}>{item.quantity > 1 ? `${item.quantity} × $${chosenPrice.toLocaleString('es-CO')}` : 'COP'}</div>
                            {avgPrice && chosenPrice !== null && avgPrice > chosenPrice && (
                              <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--success, #16a34a)', whiteSpace: 'nowrap', marginTop: '2px' }}>
                                Ahorrás ${Math.round((avgPrice - chosenPrice) * item.quantity).toLocaleString('es-CO')}
                              </div>
                            )}
                          </div>
                        )}
                        <div style={lista.optimItemActions}>
                          {/* Chevron — solo indicador visual, el click lo maneja la fila entera */}
                          {hasPubs && !isOptimizingThis && (
                            <div
                              aria-hidden="true"
                              style={{
                                ...lista.optimChevronBtn,
                                ...(isExpanded ? lista.optimChevronBtnActive : {}),
                                pointerEvents: 'none',
                              }}
                            >
                              <ChevronDownIcon open={isExpanded} />
                            </div>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); handleRemove(item.id); }}
                          style={lista.removeBtnLarge}
                          aria-label={`Eliminar ${item.productName}`}
                        >
                          <TrashIcon />
                        </button>
                      </div>
                    </div>

                    {/* Carrusel de publicaciones */}
                    {isExpanded && hasPubs && (
                      <div style={lista.carouselWrap}>
                        <InfiniteHorizontalCarousel
                          publications={pubs}
                          selectedId={chosenPub?.id ?? (pubs[0]?.id ?? 0)}
                          onSelect={(pub) => handleSelectPub(item.id, pub)}
                          onDetail={handleViewDetail}
                        />
                      </div>
                    )}
                  </li>
                );
              }

              // Estado pre-optimización: fila simple con checkbox
              const isChecked = checkedItems.has(item.id);
              return (
                <li key={item.id} style={lista.itemWrap}>
                  <div
                    style={{ ...lista.item, cursor: 'pointer', ...(isChecked ? { borderColor: 'var(--accent)', background: 'var(--accent-soft)' } : {}) }}
                    onClick={() => toggleCheck(item.id)}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => toggleCheck(item.id)}
                      onClick={(e) => e.stopPropagation()}
                      style={{ flexShrink: 0, accentColor: 'var(--accent)', width: '15px', height: '15px', cursor: 'pointer' }}
                      aria-label={`Marcar ${item.productName}`}
                    />
                    <div style={{ ...lista.itemText }}>
                      <span style={{ ...lista.itemName, ...(isChecked ? { textDecoration: 'line-through', opacity: 0.55 } : {}) }}>
                        {item.productName}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); handleRemove(item.id); }}
                      style={lista.removeBtn}
                      aria-label={`Eliminar ${item.productName}`}
                    >
                      <TrashIcon />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>

          {/* ── Error al guardar ─────────────────────────────────── */}
          {saveError && (
            <p style={{ ...lista.errorMsg, background: 'var(--error-soft)', color: 'var(--error)', padding: '10px 14px', borderRadius: 'var(--radius-sm)', margin: 0, fontSize: 13 }}>
              {saveError}
            </p>
          )}

          {/* ── CTA: elegir modo (si aún no hay modo) ───────────── */}
          {isCalculated && hasSelections && deliveryMode === null && (
            <button
              type="button"
              onClick={() => setPhase('mode-selection')}
              style={lista.proceedBtn}
            >
              ✦ Elegir cómo recibir mi pedido
            </button>
          )}

          {/* ── Error de cálculo ────────────────────────────────── */}
          {calcError && <p style={lista.errorMsg}>{calcError}</p>}
          {coordsError && <p style={lista.errorMsg}>{coordsError}</p>}

          {/* ── Panel de configuración ───────────────────────────── */}
          {showOptimSettings && (
            <OptimSettingsPanel
              prefs={prefs}
              savePrefs={savePrefs}
              coordsAvailable={hasLocation}
              onRequestCoords={requestCoords}
            />
          )}

          {/* ── Fila: Botón optimizar + tuerca ──────────────────── */}
          <div style={lista.calcRow}>
            <button
              type="button"
              onClick={() => {
                if (!isAuthenticated) {
                  navigate('/login', { state: { from: '/lista' } });
                  return;
                }
                handleCalculate();
              }}
              disabled={calculating || items.length === 0}
              style={{
                ...lista.calcBtn,
                opacity: (calculating || items.length === 0) ? 0.45 : 1,
                cursor: (calculating || items.length === 0) ? 'not-allowed' : 'pointer',
              }}
            >
              {calculating ? '⏳ Optimizando...' : '✦ Optimizar lista'}
            </button>
            <button
              type="button"
              onClick={() => setShowOptimSettings((v) => !v)}
              style={{ ...lista.gearBtn, ...(showOptimSettings ? lista.gearBtnActive : {}) }}
              title="Configuración de optimización"
              aria-label="Configuración de optimización"
            >
              <GearIcon />
            </button>
          </div>
        </>
      )}
    </div>
  );
}
