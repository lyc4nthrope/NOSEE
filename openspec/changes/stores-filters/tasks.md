# Tasks: stores-filters

> Desglose de implementación para el cambio `stores-filters`.
> Cada tarea es atómica y completable en una sesión de `sdd-apply`.
> Las dependencias están expresadas por número de tarea.

---

## Fase 1 — API Layer

### 1.1 Extender firma de `listStores` con parámetros de filtro

- **Archivo**: `nosee/src/services/api/stores.api.js`
- **Qué hacer**:
  Modificar la firma de `listStores` para que `optionsOrLimit` acepte los campos opcionales `storeType` y `onlyWithLocation` además de `limit` y `page`. La nueva firma es:
  ```js
  export async function listStores(name = "", optionsOrLimit = 20)
  ```
  donde `optionsOrLimit` puede ser `number` (legacy) o `{ limit, page, storeType?, onlyWithLocation? }`.
  Actualizar el bloque de resolución de opciones para extraer `storeType` y `onlyWithLocation`:
  ```js
  const { limit: rawLimit, page: rawPage, storeType, onlyWithLocation } = resolvedOptions;
  ```
  Mantener retrocompatibilidad: si `optionsOrLimit` es un número, `storeType` y `onlyWithLocation` quedan `undefined` (comportamiento actual sin cambios).
- **Criterio de done**: La función acepta `{ limit: 20, page: 1, storeType: 'physical', onlyWithLocation: true }` sin errores de JS. Los callers legacy que pasan solo un número siguen funcionando.
- **Dependencias**: ninguna

---

### 1.2 Aplicar filtros server-side en la query de Supabase

- **Archivo**: `nosee/src/services/api/stores.api.js`
- **Qué hacer**:
  Dentro de `listStores`, después de construir `query` y antes de aplicar `.range(...)`, añadir:
  ```js
  // Filtro por tipo de tienda (server-side)
  if (storeType && storeType !== 'all') {
    const typeId = STORE_TYPE_ID[storeType];
    if (typeId) query = query.eq('store_type_id', typeId);
  }

  // Filtro por tiendas con ubicación registrada (server-side)
  if (onlyWithLocation) {
    query = query.not('location', 'is', null);
  }
  ```
  `STORE_TYPE_ID` ya existe en línea 32 del mismo archivo; reutilizarlo directamente.
- **Criterio de done**:
  - Con `storeType: 'physical'` la query incluye `.eq('store_type_id', 1)`.
  - Con `onlyWithLocation: true` la query incluye `.not('location', 'is', null)`.
  - Con `storeType: 'all'` o `undefined`, ningún filtro de tipo se aplica.
  - La paginación (`.range(...)`) sigue ocurriendo DESPUÉS de los filtros.
- **Dependencias**: 1.1

---

## Fase 2 — Hook Layer

### 2.1 Agregar estado `storeType` en `useStoresList`

- **Archivo**: `nosee/src/features/stores/hooks/useStoresList.js`
- **Qué hacer**:
  Agregar estado y ref espejo para `storeType`:
  ```js
  const [storeType, setStoreType] = useState('all'); // 'all' | 'physical' | 'virtual'
  const storeTypeRef = useRef('all');
  ```
  Crear `handleStoreTypeChange`:
  ```js
  const handleStoreTypeChange = useCallback((type) => {
    storeTypeRef.current = type;
    setStoreType(type);
    pageRef.current = 1;
    fetchStores({ query: searchRef.current, pageToLoad: 1, append: false });
  }, [fetchStores]);
  ```
  Exponer `storeType` y `handleStoreTypeChange` en el objeto de retorno.
- **Criterio de done**: El hook exporta `storeType` (string) y `handleStoreTypeChange` (function). Al llamar `handleStoreTypeChange('physical')`, `storeType` cambia a `'physical'` y se dispara un nuevo fetch desde página 1.
- **Dependencias**: 1.2

---

### 2.2 Agregar estado `onlyWithLocation` en `useStoresList`

- **Archivo**: `nosee/src/features/stores/hooks/useStoresList.js`
- **Qué hacer**:
  Agregar estado y ref espejo para `onlyWithLocation`:
  ```js
  const [onlyWithLocation, setOnlyWithLocation] = useState(false);
  const onlyWithLocationRef = useRef(false);
  ```
  Crear `handleOnlyWithLocationChange`:
  ```js
  const handleOnlyWithLocationChange = useCallback((value) => {
    onlyWithLocationRef.current = value;
    setOnlyWithLocation(value);
    pageRef.current = 1;
    fetchStores({ query: searchRef.current, pageToLoad: 1, append: false });
  }, [fetchStores]);
  ```
  Exponer `onlyWithLocation` y `handleOnlyWithLocationChange` en el objeto de retorno.
- **Criterio de done**: El hook exporta `onlyWithLocation` (boolean) y `handleOnlyWithLocationChange` (function). Al togglear a `true` se dispara un fetch desde página 1.
- **Dependencias**: 2.1

---

### 2.3 Pasar filtros activos a `fetchStores` y `loadMore`

- **Archivo**: `nosee/src/features/stores/hooks/useStoresList.js`
- **Qué hacer**:
  Actualizar la llamada a `listStores` dentro de `fetchStores` para incluir los filtros activos:
  ```js
  const result = await listStores(query, {
    limit: INFINITE_SCROLL_CONFIG.storesPageSize,
    page: pageToLoad,
    storeType: storeTypeRef.current,
    onlyWithLocation: onlyWithLocationRef.current,
  });
  ```
  Actualizar `loadMore` para que use los refs activos al paginar:
  ```js
  const loadMore = useCallback(() => {
    if (!hasMore || loading || loadingMoreRef.current) return;
    fetchStores({
      query: searchRef.current,
      pageToLoad: pageRef.current + 1,
      append: true,
    });
  }, [hasMore, loading, fetchStores]);
  ```
  (El `loadMore` actual ya lee `searchRef.current`; solo verificar que usa los refs correctamente — `storeTypeRef` y `onlyWithLocationRef` ya están en la llamada a `listStores` dentro de `fetchStores`.)
- **Criterio de done**: Al paginar con `loadMore`, los filtros activos de tipo y ubicación se mantienen. Un cambio de página no reinicia los filtros.
- **Dependencias**: 2.2

---

## Fase 3 — UI: StoresDrawer

### 3.1 Agregar chips de tipo de tienda en `StoresDrawer`

- **Archivo**: `nosee/src/features/stores/components/StoresDrawer.jsx`
- **Qué hacer**:
  Agregar props `storeType` y `onStoreTypeChange` al componente `StoresDrawer`.
  Después del bloque de búsqueda (`{/* ── Search ── */}`), antes de `{/* ── List ── */}`, insertar una fila de chips de filtro:
  ```jsx
  {/* ── Filtros de tipo ── */}
  <div style={styles.filterRow}>
    {['all', 'physical', 'virtual'].map((type) => (
      <button
        key={type}
        type="button"
        onClick={() => onStoreTypeChange(type)}
        aria-pressed={storeType === type}
        style={{
          ...styles.chip,
          ...(storeType === type ? styles.chipActive : {}),
        }}
      >
        {t.filterChips?.[type] ?? type}
      </button>
    ))}
  </div>
  ```
  Agregar los estilos correspondientes en el objeto `styles` al final del archivo:
  ```js
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
  ```
- **Criterio de done**: Se renderizan tres chips ("Todas"/"Física"/"Virtual" según i18n). El chip activo muestra estilo `chipActive`. Al hacer clic en un chip, se llama `onStoreTypeChange(type)`. `aria-pressed` refleja el estado activo.
- **Dependencias**: 2.1 (hook), 6.1 (i18n claves `filterChips`)

---

### 3.2 Agregar toggle `onlyWithLocation` en `StoresDrawer`

- **Archivo**: `nosee/src/features/stores/components/StoresDrawer.jsx`
- **Qué hacer**:
  Agregar props `onlyWithLocation` y `onOnlyWithLocationChange`.
  Después de la fila de chips (tarea 3.1), añadir un toggle:
  ```jsx
  {/* ── Toggle con ubicación ── */}
  <div style={styles.toggleRow}>
    <label style={styles.toggleLabel} htmlFor="stores-location-toggle">
      {t.onlyWithLocation ?? 'Con ubicación'}
    </label>
    <button
      id="stores-location-toggle"
      type="button"
      role="switch"
      aria-checked={onlyWithLocation}
      onClick={() => onOnlyWithLocationChange(!onlyWithLocation)}
      style={{
        ...styles.toggle,
        ...(onlyWithLocation ? styles.toggleOn : {}),
      }}
    >
      <span style={{
        ...styles.toggleThumb,
        ...(onlyWithLocation ? styles.toggleThumbOn : {}),
      }} />
    </button>
  </div>
  ```
  Estilos adicionales en `styles`:
  ```js
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
    transition: 'background 0.2s',
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
    background: 'var(--text-muted)',
    transition: 'left 0.2s, background 0.2s',
  },
  toggleThumbOn: {
    left: '20px',
    background: '#002b3d',
  },
  ```
- **Criterio de done**: El toggle se renderiza. `aria-checked` refleja el estado de `onlyWithLocation`. Al hacer clic cambia visualmente y llama `onOnlyWithLocationChange`. El toggle es accesible por teclado (role="switch").
- **Dependencias**: 2.2 (hook), 6.1 (i18n clave `onlyWithLocation`)

---

## Fase 4 — UI: StoreFilterBanner (nuevo componente)

### 4.1 Crear componente `StoreFilterBanner`

- **Archivo**: `nosee/src/features/publications/components/StoreFilterBanner.jsx` ← NUEVO
- **Qué hacer**:
  Crear el archivo desde cero. El componente recibe `{ filters, onClearStore, t }` donde:
  - `filters` es el objeto de filtros de publicaciones de `HomePage` (`{ storeId, storeName, ... }`)
  - `onClearStore` es un callback que limpia `storeId` y `storeName`
  - `t` es el namespace `t.home` de i18n

  El componente solo se renderiza si `filters.storeId || filters.storeName`. Cuando activo, muestra una pill/badge con el nombre de la tienda activa y un botón "Quitar filtro":
  ```jsx
  import { memo } from 'react';

  const StoreFilterBanner = memo(function StoreFilterBanner({ filters, onClearStore, t }) {
    const isActive = Boolean(filters.storeId || filters.storeName);
    if (!isActive) return null;

    const storeName = filters.storeName || `Tienda #${filters.storeId}`;

    return (
      <div style={styles.banner} role="status" aria-live="polite">
        <span style={styles.label}>
          {t.storeFilterActive ?? 'Filtrando por tienda:'}{' '}
          <strong>{storeName}</strong>
        </span>
        <button
          type="button"
          onClick={onClearStore}
          style={styles.clearBtn}
          aria-label={t.storeFilterClear ?? 'Quitar filtro de tienda'}
        >
          {t.storeFilterClear ?? 'Quitar filtro'}
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
      borderRadius: 'var(--radius-md)',
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
  ```
- **Criterio de done**:
  - Componente exportado correctamente.
  - Con `filters = { storeId: 5, storeName: 'D1' }` → renderiza con "D1".
  - Con `filters = { storeId: null, storeName: '' }` → retorna `null` (no renderiza nada).
  - El botón llama `onClearStore` al hacer clic.
  - Escenario B.4 implícito: el componente no toca ni afecta otros filtros (precio, categoría, distancia).
- **Dependencias**: 6.2 (i18n claves del banner)

---

## Fase 5 — Integración y cableado

### 5.1 Cablear props de filtros en `StoresPage`

- **Archivo**: `nosee/src/features/stores/pages/StoresPage.jsx`
- **Qué hacer**:
  Extraer del hook los nuevos valores:
  ```js
  const {
    search, stores, loading, loadingMore, hasMore, error,
    handleSearchChange, loadMore, updateStore,
    storeType, handleStoreTypeChange,          // ← nuevo
    onlyWithLocation, handleOnlyWithLocationChange, // ← nuevo
  } = useStoresList();
  ```
  Pasar las nuevas props a `<StoresDrawer>`:
  ```jsx
  <StoresDrawer
    ...
    storeType={storeType}
    onStoreTypeChange={handleStoreTypeChange}
    onlyWithLocation={onlyWithLocation}
    onOnlyWithLocationChange={handleOnlyWithLocationChange}
    ...
  />
  ```
- **Criterio de done**: `StoresPage` compila sin errores de prop. Los cambios de chip/toggle en `StoresDrawer` disparan re-fetches server-side. El caller legacy `StoreCombobox` (que usa `searchNearbyStores`, no `listStores`) no se afecta (escenario A.5).
- **Dependencias**: 2.3, 3.1, 3.2

---

### 5.2 Montar `StoreFilterBanner` en `HomePage`

- **Archivo**: `nosee/src/pages/HomePage.jsx`
- **Qué hacer**:
  Importar el componente:
  ```js
  import StoreFilterBanner from '@/features/publications/components/StoreFilterBanner';
  ```
  Crear el handler de limpieza de filtro de tienda:
  ```js
  const handleClearStoreFilter = useCallback(() => {
    setFilters((prev) => ({ ...prev, storeId: null, storeName: '' }));
    setPublicationFilters((prev) => ({ ...prev, storeId: null, storeName: '' }));
  }, [setPublicationFilters]);
  ```
  Montar el banner INMEDIATAMENTE DESPUÉS del bloque de búsqueda y ANTES de `<PriceSearchFilter>`, dentro de la sección de filtros:
  ```jsx
  <StoreFilterBanner
    filters={filters}
    onClearStore={handleClearStoreFilter}
    t={th}
  />
  ```
  El banner se inserta entre la barra de búsqueda/botón Filtrar y el `<PriceSearchFilter>`.
- **Criterio de done**:
  - Con `filters.storeId` activo → el banner aparece sobre el panel de filtros.
  - Con ningún filtro de tienda → el banner no se renderiza (B.3).
  - Al hacer clic en "Quitar filtro" → `filters.storeId` y `filters.storeName` vuelven a `null`/`''` (B.2).
  - Otros filtros (precio, categoría, distancia) no se limpian al quitar filtro de tienda (B.4).
  - El banner coexiste correctamente con `PriceSearchFilter` expandido.
- **Dependencias**: 4.1, 6.2

---

## Fase 6 — i18n

### 6.1 Claves i18n para `StoresDrawer` (chips y toggle)

- **Archivos**:
  - `nosee/src/locales/es-MX.js`
  - `nosee/src/locales/en-US.js`
- **Qué hacer**:
  En el namespace `storesPage` de **ambos** archivos, agregar las claves necesarias para los chips y el toggle. Agregar al objeto `storesPage` existente:

  **es-MX.js**:
  ```js
  storesPage: {
    // ... claves existentes ...
    filterChips: {
      all: 'Todas',
      physical: 'Física',
      virtual: 'Virtual',
    },
    onlyWithLocation: 'Solo con ubicación',
  },
  ```

  **en-US.js**:
  ```js
  storesPage: {
    // ... claves existentes ...
    filterChips: {
      all: 'All',
      physical: 'Physical',
      virtual: 'Virtual',
    },
    onlyWithLocation: 'With location only',
  },
  ```
- **Criterio de done**: `t.storesPage.filterChips.all`, `t.storesPage.filterChips.physical`, `t.storesPage.filterChips.virtual`, y `t.storesPage.onlyWithLocation` existen en ambos idiomas. Los chips y el toggle en `StoresDrawer` renderizan las etiquetas correctas según el idioma activo.
- **Dependencias**: ninguna (puede hacerse en paralelo con otras fases)

---

### 6.2 Claves i18n para `StoreFilterBanner` (namespace `home`)

- **Archivos**:
  - `nosee/src/locales/es-MX.js`
  - `nosee/src/locales/en-US.js`
- **Qué hacer**:
  En el namespace `home` de **ambos** archivos, agregar las claves del banner:

  **es-MX.js** (dentro de `home: { ... }`):
  ```js
  storeFilterActive: 'Filtrando por tienda:',
  storeFilterClear: 'Quitar filtro',
  ```

  **en-US.js** (dentro de `home: { ... }`):
  ```js
  storeFilterActive: 'Filtering by store:',
  storeFilterClear: 'Clear filter',
  ```
- **Criterio de done**: `t.home.storeFilterActive` y `t.home.storeFilterClear` existen en ambos archivos. El banner en `HomePage` muestra el texto correcto según el idioma.
- **Dependencias**: ninguna (puede hacerse en paralelo)

---

## Fase 7 — Verificación

### 7.1 Verificar escenarios del spec — Grupo A (filtros en StoresDrawer)

- **Archivos afectados** (solo lectura/ejecución, no edición):
  - `nosee/src/features/stores/hooks/useStoresList.js`
  - `nosee/src/services/api/stores.api.js`
  - `nosee/src/features/stores/components/StoresDrawer.jsx`
  - `nosee/src/features/stores/pages/StoresPage.jsx`
- **Qué hacer**:
  Verificar manualmente (o con tests de integración si existen) los siguientes escenarios del spec:
  - **A.1**: Seleccionar chip "Física" → la query enviada a Supabase incluye `eq('store_type_id', 1)` y la lista se actualiza.
  - **A.2**: Activar toggle "Solo con ubicación" → la query incluye `not('location', 'is', null)` y la lista se actualiza.
  - **A.3**: Buscar por nombre + chip "Virtual" + toggle → los tres filtros se aplican en la misma request.
  - **A.4**: Cambiar chip mientras hay resultados en página 2 → `pageRef.current` vuelve a 1 y la lista se reinicia.
  - **A.5**: Abrir `StoreCombobox` (en formulario de publicación) → funciona igual que antes porque usa `searchNearbyStores`, no `listStores`.
- **Criterio de done**: Los 5 escenarios de Grupo A pasan sin errores. No hay regresión en `StoreCombobox`.
- **Dependencias**: 5.1 (todo el stack integrado)

---

### 7.2 Verificar escenarios del spec — Grupo B (StoreFilterBanner en HomePage)

- **Archivos afectados** (solo lectura/ejecución):
  - `nosee/src/pages/HomePage.jsx`
  - `nosee/src/features/publications/components/StoreFilterBanner.jsx`
- **Qué hacer**:
  Verificar los siguientes escenarios del spec:
  - **B.1**: Navegar a `/?storeId=5&storeName=D1` → el banner aparece con "D1".
  - **B.1 alt**: `filters.storeName = 'Ara'` con `storeId = null` → el banner aparece con "Ara".
  - **B.2**: Click en "Quitar filtro" → `filters.storeId` y `filters.storeName` vuelven a `null`/`''`; el banner desaparece; las publicaciones se recargan sin filtro de tienda.
  - **B.3**: Sin filtro de tienda activo → el banner no renderiza ningún elemento en el DOM.
  - **B.4**: Con `storeId` activo + `maxDistance = 5` + `categoryId = 3` → click "Quitar filtro" → solo `storeId` y `storeName` se limpian; `maxDistance` y `categoryId` permanecen intactos.
- **Criterio de done**: Los 5 escenarios de Grupo B pasan. El handler `onClearStore` solo limpia `storeId` y `storeName`.
- **Dependencias**: 5.2

---

## Orden de ejecución recomendado (por el agente `sdd-apply`)

Las tareas sin dependencias cruzadas pueden ejecutarse en el mismo batch:

| Batch | Tareas | Razón |
|-------|--------|-------|
| 1 | 1.1, 6.1, 6.2 | Sin dependencias; API y i18n son independientes |
| 2 | 1.2 | Requiere 1.1 |
| 3 | 2.1, 2.2 | Requieren 1.2; pueden ir juntas |
| 4 | 2.3 | Requiere 2.2 |
| 5 | 3.1, 3.2, 4.1 | Requieren hooks y i18n; pueden ir juntas |
| 6 | 5.1, 5.2 | Integración final; requieren UI completa |
| 7 | 7.1, 7.2 | Verificación post-integración |
