# Design: stores-filters

> Diseño técnico del cambio. Se asume la propuesta aprobada (Parte A: filtros en `StoresDrawer`; Parte B: banner contextual en `HomePage`). NO se proponen migraciones ni cambios de esquema en Supabase: el campo `store_type_id` y la columna `location` ya existen.

---

## Arquitectura del cambio

### Diagrama de flujo — Parte A (filtros en StoresDrawer)

```
┌──────────────────────────────────────────────────────────────────────┐
│  StoresPage.jsx                                                      │
│   const { search, stores, storeType, onlyWithLocation,               │
│           handleSearchChange, handleStoreTypeChange,                 │
│           handleOnlyWithLocationChange, loadMore, ... }              │
│        = useStoresList();                                            │
└──────────────────────────────────────────────────────────────────────┘
                  │ props
                  ▼
┌──────────────────────────────────────────────────────────────────────┐
│  StoresDrawer.jsx                                                    │
│   ┌──────────────────────────────────────────┐                       │
│   │ <input search>  ── onSearchChange ──┐    │                       │
│   └──────────────────────────────────────┘   │                       │
│   ┌──────────────────────────────────────┐   │                       │
│   │  [Todas] [Físicas] [Virtuales]       │   │  (chips)              │
│   │   ↑ aria-pressed, role="tablist"     │   │                       │
│   └──── onStoreTypeChange('physical') ───┘   │                       │
│   ┌──────────────────────────────────────┐   │                       │
│   │ [☐] Solo con ubicación en mapa       │   │  (toggle)             │
│   └──── onOnlyWithLocationChange(bool) ──┘   │                       │
│                                              │                       │
│   <ul> StoreCard… </ul>  (scroll → onLoadMore)                       │
└──────────────────────────────────────────────────────────────────────┘
                  │  handlers
                  ▼
┌──────────────────────────────────────────────────────────────────────┐
│  useStoresList.js                                                    │
│                                                                      │
│   handleSearchChange(value)         ─┐                               │
│      └─ debounce 350ms ──────────────┤                               │
│   handleStoreTypeChange(type)       ─┤  → fetchStores({              │
│   handleOnlyWithLocationChange(b)   ─┘      query, storeType,        │
│                                             onlyWithLocation,        │
│                                             pageToLoad: 1,           │
│                                             append: false })         │
│                                                                      │
│   loadMore() → fetchStores({                                         │
│       query: searchRef.current,                                      │
│       storeType: storeTypeRef.current,                               │
│       onlyWithLocation: onlyWithLocationRef.current,                 │
│       pageToLoad: pageRef.current + 1,                               │
│       append: true })                                                │
└──────────────────────────────────────────────────────────────────────┘
                  │  llamada
                  ▼
┌──────────────────────────────────────────────────────────────────────┐
│  stores.api.js → listStores(name, {                                  │
│       limit, page, storeType, onlyWithLocation })                    │
│                                                                      │
│   query = supabase.from('stores').select(...).order('name')          │
│   if (name)             query.ilike('name', `%${name}%`)             │
│   if (storeType==='physical') query.eq('store_type_id', 1)           │
│   if (storeType==='virtual')  query.eq('store_type_id', 2)           │
│   if (onlyWithLocation)       query.not('location','is', null)       │
│   query.range(offset, offset + safeLimit - 1)                        │
└──────────────────────────────────────────────────────────────────────┘
                  │
                  ▼
              Supabase  →  data → mapped (parsePoint, getUiTypeBy…) →
              { success, data, hasMore: mapped.length === safeLimit, page }
```

Punto crítico: `hasMore` sigue calculándose como `mapped.length === safeLimit`. Esto SOLO funciona si Supabase ya devolvió la página filtrada al tamaño de página real. Por eso el filtrado va server-side.

### Diagrama de flujo — Parte B (banner contextual)

```
┌──────────────────────────────────┐
│  StoreDetailModal                │
│   "Ver todas las publicaciones"  │
│   onClick → navigate(            │
│      `/?storeId=${id}            │
│       &storeName=${encoded}`)    │
└──────────────────────────────────┘
                │
                ▼
┌──────────────────────────────────────────────────────────────┐
│  HomePage.jsx                                                │
│                                                              │
│  useEffect(() => {  // existente, sin cambios funcionales    │
│    const sId = searchParams.get('storeId');                  │
│    const sName = searchParams.get('storeName');              │
│    if (!sId && !sName) return;                               │
│    setFilters((p) => ({ ...p, storeId, storeName }));        │
│    setPublicationFilters((p) => ({ ...p, storeId,            │
│                                     storeName }));           │
│    navigate('/', { replace: true });                         │
│  }, [searchParams]);                                         │
│                                                              │
│  // NUEVO: derivar visibilidad de banner                     │
│  const isStoreFilterActive = Boolean(                        │
│     filters.storeId || filters.storeName);                   │
│                                                              │
│  // NUEVO: render condicional, ARRIBA del PriceSearchFilter  │
│  {isStoreFilterActive && (                                   │
│     <StoreFilterBanner                                       │
│        storeName={filters.storeName}                         │
│        onClear={handleClearStoreFilter}                      │
│        t={t.home}                                            │
│     />                                                       │
│  )}                                                          │
└──────────────────────────────────────────────────────────────┘
                │ click "Quitar filtro"
                ▼
   handleClearStoreFilter:
     setFilters((p) => ({ ...p, storeId: null, storeName: '' }))
     setPublicationFilters((p) => ({ ...p, storeId: null, storeName: '' }))
     seenIdsRef.current = new Set()
```

---

## Decisiones de arquitectura

### DA-1: Filtrado server-side vs client-side

**Decisión**: 100% server-side mediante cláusulas Supabase en `listStores`.

**Razón**: El infinite scroll calcula `hasMore = mapped.length === safeLimit`. Si filtramos en cliente DESPUÉS de recibir la página, una página de 20 puede colapsar a 7 elementos y romper el guard de `hasMore` (mostraría falsamente "fin de lista" o cargaría duplicados al pedir la página siguiente). Filtrar en BD garantiza que cada página devuelta YA viene con `safeLimit` resultados que cumplen los criterios.

**Tradeoff aceptado**: Cada cambio de filtro dispara fetch y resetea `pageRef = 1`. No hay caché de páginas previas. Es aceptable: el dataset es pequeño y la red local es rápida; no estamos optimizando un caso de uso de 10k tiendas.

**Alternativa descartada**: Hybrid (filtrar en cliente + pedir más al backend si hueco). Complejidad muy alta, requiere reescribir el contrato de `hasMore`. NO.

### DA-2: Gestión de estado en useStoresList con refs vs useState

**Decisión**: Espejo `state + ref` para `storeType` y `onlyWithLocation`, igual que `search`/`searchRef`.

**Razón**: `loadMore` es estable (`useCallback` sin dependencia de `storeType`/`onlyWithLocation`); lee los valores vigentes vía refs. Si dependiera del state, el callback se recrearía en cada cambio de filtro, invalidaría memoizaciones de `StoresDrawer` (envuelto en `memo`) y haría re-attach del scroll listener. El patrón ya existente con `searchRef` es la convención del feature: la respetamos.

**Tradeoff aceptado**: Duplicación leve (escribir 2 lugares). A cambio: `loadMore` permanece estable y el componente memoizado no se invalida en cada teclazo.

### DA-3: Banner como componente inline vs componente extraído

**Decisión**: Componente extraído `StoreFilterBanner` en `nosee/src/features/publications/components/StoreFilterBanner.jsx`.

**Razón**:
- HomePage.jsx ya pasa de 600 líneas. Inline crece el JSX; extraído lo mantiene legible.
- El banner pertenece SEMÁNTICAMENTE al feature `publications` (es parte del filtro de publicaciones por tienda), aunque visualmente viva en HomePage. Eso lo agrupa con `PriceSearchFilter`.
- Es un componente puro con 2 props (`storeName`, `onClear`) + `t`. Reutilizable si mañana aparece la misma necesidad en `PublicationsPage` u otra vista.

**Alternativa descartada**: Inline JSX dentro de HomePage. Más rápido de escribir, pero acumula deuda de legibilidad.

### DA-4: Retrocompatibilidad de listStores

**Decisión**: Mantener firma `listStores(name, optionsOrLimit)` SIN romper. El segundo parámetro sigue aceptando `number` (legacy) u `object`.

**Razón**: `StoreCombobox` en `PriceSearchFilter.jsx:303` llama `listStores(text.trim(), 20)`. Tocar esa firma obligaría a auditar todos los call sites. El objeto extendido es additivo: `{ limit, page, storeType?, onlyWithLocation? }`. Los nuevos campos son opcionales y, si no llegan, la query NO incluye `.eq('store_type_id', ...)` ni `.not('location', 'is', null)` — comportamiento actual preservado.

**Tradeoff aceptado**: Polimorfismo de parámetro. Pequeña carga cognitiva al leer la firma; ya estaba presente y normalizada (líneas 601-604).

---

## Diseño detallado por capa

### 1. `stores.api.js` — `listStores` extendida

#### Firma exacta

```js
/**
 * Lista tiendas con búsqueda, paginación y filtros opcionales.
 *
 * @param {string=}        name           - Filtro por nombre (ilike)
 * @param {number|object=} optionsOrLimit - límite legacy o:
 *   {
 *     limit?: number,                              // default 20, [5..60]
 *     page?: number,                               // default 1
 *     storeType?: 'all' | 'physical' | 'virtual',  // default 'all' (no filter)
 *     onlyWithLocation?: boolean                   // default false (no filter)
 *   }
 */
export async function listStores(name = "", optionsOrLimit = 20) { ... }
```

#### Comportamiento por parámetro

| Param              | Cláusula Supabase agregada                              | Default      |
|--------------------|---------------------------------------------------------|--------------|
| `name`             | `query.ilike('name', \`%${name.trim()}%\`)`             | sin filtro   |
| `storeType`        | `query.eq('store_type_id', STORE_TYPE_ID[storeType])`   | `'all'`      |
| `onlyWithLocation` | `query.not('location', 'is', null)`                     | `false`      |

`STORE_TYPE_ID` ya existe (líneas 32-35). El mapeo `'physical' → 1`, `'virtual' → 2` ya está implementado en `getUiTypeByStoreTypeId` y `resolveStoreTypeId` — REUTILIZAR, no duplicar.

#### Pseudocódigo del bloque modificado

```js
const safeStoreType = ['physical','virtual'].includes(resolvedOptions.storeType)
  ? resolvedOptions.storeType
  : 'all';
const safeOnlyWithLocation = Boolean(resolvedOptions.onlyWithLocation);

let query = supabase
  .from("stores")
  .select("id, name, store_type_id, address, website_url, location, created_by")
  .order("name", { ascending: true })
  .range(offset, offset + safeLimit - 1);

if (name && name.trim().length >= 1) {
  query = query.ilike("name", `%${name.trim()}%`);
}
if (safeStoreType !== 'all') {
  query = query.eq("store_type_id", STORE_TYPE_ID[safeStoreType]);
}
if (safeOnlyWithLocation) {
  query = query.not("location", "is", null);
}
```

`hasMore`, mapeo (`parsePointText`, `getUiTypeByStoreTypeId`) y manejo de error: SIN CAMBIOS.

#### Validaciones

- `storeType` fuera de `'physical' | 'virtual'` → tratar como `'all'` (defensivo, no lanzar).
- `onlyWithLocation` no booleano → coerción `Boolean(...)`.
- Mantener `withTimeout(query, REQUEST_TIMEOUT_MS, ...)`.

### 2. `useStoresList.js` — nuevos estados y handlers

#### Nuevos estados / refs

```js
const [storeType, setStoreType] = useState('all');           // 'all' | 'physical' | 'virtual'
const [onlyWithLocation, setOnlyWithLocation] = useState(false);

const storeTypeRef        = useRef('all');
const onlyWithLocationRef = useRef(false);
```

#### `fetchStores` — firma extendida

```js
const fetchStores = useCallback(async ({
  query, pageToLoad, append, storeType, onlyWithLocation,
}) => {
  if (pageToLoad === 1) setLoading(true);
  else { loadingMoreRef.current = true; setLoadingMore(true); }
  setError(null);

  const result = await listStores(query, {
    limit: INFINITE_SCROLL_CONFIG.storesPageSize,
    page: pageToLoad,
    storeType,
    onlyWithLocation,
  });
  // ...mismo merge dedup, hasMore, error handling
}, []);
```

#### Handlers nuevos (sin debounce — selección discreta)

```js
const handleStoreTypeChange = useCallback((type) => {
  const safe = ['all','physical','virtual'].includes(type) ? type : 'all';
  setStoreType(safe);
  storeTypeRef.current = safe;
  // No debounce — chips son selección discreta
  fetchStores({
    query: searchRef.current,
    pageToLoad: 1,
    append: false,
    storeType: safe,
    onlyWithLocation: onlyWithLocationRef.current,
  });
}, [fetchStores]);

const handleOnlyWithLocationChange = useCallback((value) => {
  const safe = Boolean(value);
  setOnlyWithLocation(safe);
  onlyWithLocationRef.current = safe;
  fetchStores({
    query: searchRef.current,
    pageToLoad: 1,
    append: false,
    storeType: storeTypeRef.current,
    onlyWithLocation: safe,
  });
}, [fetchStores]);
```

#### `handleSearchChange` — adaptado

```js
debounceRef.current = setTimeout(() => {
  fetchStores({
    query: value,
    pageToLoad: 1,
    append: false,
    storeType: storeTypeRef.current,
    onlyWithLocation: onlyWithLocationRef.current,
  });
}, DEBOUNCE_MS);
```

#### `loadMore` — adaptado

```js
const loadMore = useCallback(() => {
  if (!hasMore || loading || loadingMoreRef.current) return;
  fetchStores({
    query: searchRef.current,
    pageToLoad: pageRef.current + 1,
    append: true,
    storeType: storeTypeRef.current,
    onlyWithLocation: onlyWithLocationRef.current,
  });
}, [hasMore, loading, fetchStores]);
```

#### Initial fetch

```js
useEffect(() => {
  fetchStores({
    query: '',
    pageToLoad: 1,
    append: false,
    storeType: 'all',
    onlyWithLocation: false,
  });
}, [fetchStores]);
```

#### Return shape

```js
return {
  search, stores, loading, loadingMore, hasMore, error,
  storeType, onlyWithLocation,                         // NUEVOS
  handleSearchChange,
  handleStoreTypeChange, handleOnlyWithLocationChange, // NUEVOS
  loadMore, updateStore,
};
```

### 3. `StoresDrawer.jsx` — nueva UI

#### Nuevas props (puras)

```js
StoresDrawer({
  // ... props actuales
  storeType,                        // 'all' | 'physical' | 'virtual'
  onlyWithLocation,                 // boolean
  onStoreTypeChange,                // (type) => void
  onOnlyWithLocationChange,         // (boolean) => void
  // ...
})
```

#### Estructura del bloque de chips (entre `<input search>` y `<ul listScroll>`)

```jsx
<div style={styles.filtersWrapper} role="region" aria-label={t.filtersLabel}>
  {/* Chips horizontales — radio group accesible */}
  <div style={styles.chipsRow} role="radiogroup" aria-label={t.filterByTypeLabel}>
    {[
      { key: 'all',      label: t.typeAll },
      { key: 'physical', label: t.typePhysical },
      { key: 'virtual',  label: t.typeVirtual },
    ].map(({ key, label }) => (
      <button
        key={key}
        type="button"
        role="radio"
        aria-checked={storeType === key}
        onClick={() => onStoreTypeChange(key)}
        style={storeType === key ? styles.chipActive : styles.chip}
      >
        {label}
      </button>
    ))}
  </div>

  {/* Toggle ubicación */}
  <label style={styles.toggleRow}>
    <input
      type="checkbox"
      checked={Boolean(onlyWithLocation)}
      onChange={(e) => onOnlyWithLocationChange(e.target.checked)}
      style={styles.toggleInput}
    />
    <span style={styles.toggleLabel}>{t.onlyWithLocation}</span>
  </label>
</div>
```

#### Estilos (siguiendo convención existente — objetos `styles.*`)

- `chipsRow`: `display:flex; gap:6px; overflow-x:auto; padding:0 16px 8px; scrollbar-width:none`. Permite scroll horizontal en pantallas estrechas (más chips a futuro).
- `chip`: `padding:6px 12px; min-height:36px; border:1px solid var(--border); border-radius:999px; background:var(--bg-elevated); color:var(--text-secondary); font-size:13px; white-space:nowrap; cursor:pointer`.
- `chipActive`: spread de `chip` + `background:var(--accent)`, `color:var(--text-primary)`, `border-color:var(--accent)`, `font-weight:600`.
- `toggleRow`: `display:flex; align-items:center; gap:8px; padding:0 16px 10px; min-height:44px; cursor:pointer`. (44px = Fitts).
- `toggleInput`: tamaño nativo `16x16` con focus visible (no estilizamos custom toggle por simplicidad y por accesibilidad).
- `toggleLabel`: `font-size:13px; color:var(--text-secondary); user-select:none`.

#### Accesibilidad mínima requerida

- Chips: `role="radiogroup"` + `role="radio"` + `aria-checked`. Tabulables (botones nativos). Texto traducido.
- Toggle: `<label>` envolvente para que el click en texto active el checkbox. `<input type="checkbox">` nativo (no custom div) → keyboard / screen reader gratis.
- Container: `role="region"` + `aria-label`.
- Estados activos visualmente distintos de los inactivos: contrastes de fondo y peso de fuente.

### 4. `StoresPage.jsx` — cableado

Cambios mínimos. Solo destructuring del hook + paso de props.

```jsx
const {
  search, stores, loading, loadingMore, hasMore, error,
  storeType, onlyWithLocation,                       // NUEVO
  handleSearchChange,
  handleStoreTypeChange, handleOnlyWithLocationChange, // NUEVO
  loadMore, updateStore,
} = useStoresList();

// ... y en el JSX:
<StoresDrawer
  // ... props actuales ...
  storeType={storeType}
  onlyWithLocation={onlyWithLocation}
  onStoreTypeChange={handleStoreTypeChange}
  onOnlyWithLocationChange={handleOnlyWithLocationChange}
  t={t.storesPage}
/>
```

### 5. `HomePage.jsx` — banner contextual (Parte B)

#### Componente nuevo: `StoreFilterBanner`

Path: `nosee/src/features/publications/components/StoreFilterBanner.jsx`

```jsx
import { memo } from 'react';

const StoreFilterBanner = memo(function StoreFilterBanner({ storeName, onClear, t }) {
  const displayName = storeName?.trim() || t.unknownStore || '—';
  return (
    <div role="status" aria-live="polite" style={styles.banner}>
      <span style={styles.text}>
        {t.filteringByStore}: <strong>{displayName}</strong>
      </span>
      <button
        type="button"
        onClick={onClear}
        style={styles.clearBtn}
        aria-label={t.clearStoreFilterLabel}
      >
        {t.clearStoreFilter}
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
    gap: '12px',
    padding: '10px 14px',
    margin: '12px 0',
    background: 'rgba(56,189,248,0.08)',
    border: '1px solid rgba(56,189,248,0.3)',
    borderRadius: 'var(--radius-md)',
    color: 'var(--text-primary)',
    fontSize: '13px',
  },
  text: { flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  clearBtn: {
    flexShrink: 0,
    minHeight: '36px',
    padding: '6px 12px',
    background: 'transparent',
    border: '1px solid var(--accent)',
    borderRadius: 'var(--radius-md)',
    color: 'var(--accent)',
    fontSize: '12px',
    fontWeight: 600,
    cursor: 'pointer',
  },
};
```

#### Integración en HomePage.jsx

Posición en el árbol: ANTES del `<PriceSearchFilter>` (línea 595), DENTRO de la `<section>` que contiene el search bar y el panel de filtros. Razón: el banner debe leerse arriba del listado de publicaciones, en línea con el control de filtros.

```jsx
import StoreFilterBanner from '@/features/publications/components/StoreFilterBanner';

const isStoreFilterActive = Boolean(filters.storeId || filters.storeName);

const handleClearStoreFilter = useCallback(() => {
  seenIdsRef.current = new Set();
  setFilters((prev) => ({ ...prev, storeId: null, storeName: '' }));
  setPublicationFilters((prev) => ({ ...prev, storeId: null, storeName: '' }));
}, [setPublicationFilters]);

// JSX (justo antes de <PriceSearchFilter>):
{isStoreFilterActive && (
  <StoreFilterBanner
    storeName={filters.storeName}
    onClear={handleClearStoreFilter}
    t={t.home}
  />
)}
```

NOTA: El `useEffect` que procesa `searchParams` (líneas 190-209) NO se modifica. Sigue siendo el responsable de leer URL → seedear `filters.storeId/storeName` → limpiar URL.

NOTA 2: `onClearFilters` del `PriceSearchFilter` (líneas 604-624) ya limpia `storeId/storeName` como parte del clear total — NO duplicar lógica.

---

## Edge cases y comportamiento esperado

### EC-1: Cambio rápido de filtros durante carga

Escenario: usuario tipea "abc" (debounce 350ms) y a los 100ms toca chip "Físicas".

Comportamiento:
- `handleSearchChange("abc")` programa timeout T1.
- `handleStoreTypeChange("physical")` dispara fetch INMEDIATO (no debounce) → reset a página 1. `loadingMoreRef` no se activa porque `pageToLoad === 1`.
- T1 dispara a los 350ms y lanza un segundo fetch página 1 con `query="abc"` + `storeTypeRef.current==="physical"`.
- Resultado: el último fetch gana (estado final coherente con UI). No hay leak porque `setStores(prev => ...)` se reemplaza completo cuando `append=false`.

Mitigación opcional (NO requerida en MVP): cancelar timeout en `handleStoreTypeChange/handleOnlyWithLocationChange` con `clearTimeout(debounceRef.current)` para evitar el segundo fetch redundante. Recomendado incluirlo — costo cero.

### EC-2: `storeType==='all'` + `onlyWithLocation===true`

Comportamiento:
- `listStores` NO agrega `.eq('store_type_id', ...)` (porque `storeType==='all'`).
- SÍ agrega `.not('location','is', null)`.
- Resultado: tiendas físicas con coords + (en teoría) tiendas virtuales con coords si las hubiera. En la práctica solo físicas tienen `location !== null`, así que el efecto es equivalente a "Solo físicas con ubicación".

Decisión consciente: NO acoplar lógica de "virtuales nunca tienen location" en cliente. Si mañana cambia el modelo, el filtro sigue siendo correcto.

### EC-3: Resultado vacío con filtros activos

Comportamiento actual de `StoresDrawer` (líneas 152-154): `t.empty` cuando `stores.length === 0` sin error. NO requiere mensaje distinto: el usuario sabe qué filtró. Si UX lo pide, futuro: `t.emptyFiltered` con CTA "Quitar filtros". OUT OF SCOPE.

`hasMore` viene `false` desde la API (porque `mapped.length === 0 !== safeLimit`). El infinite scroll queda inerte. Correcto.

### EC-4: StoreCombobox legacy — no afectado

`PriceSearchFilter.jsx:303` llama `listStores(text.trim(), 20)`.
- En `listStores`, `optionsOrLimit = 20` cae por la rama `typeof === 'number'` → `{ limit: 20, page: 1 }`.
- `storeType` y `onlyWithLocation` NO existen en `resolvedOptions` → defaults `'all'` y `false` → ninguna cláusula extra → comportamiento idéntico al actual.

Verificación de regresión: humo manual sobre el combobox de tienda al filtrar publicaciones por tienda en `/`.

### EC-5: Filtro por tienda en HomePage sin storeName (solo storeId)

Si llega `?storeId=42` sin `storeName`, `filters.storeName === ""`. El banner muestra `displayName = t.home.unknownStore || "—"`. UX no quirúrgica pero funcional. El botón "Quitar filtro" sigue limpiando ambos campos. ACEPTABLE.

### EC-6: Banner persistente al cambiar otros filtros

Si el usuario cambia categoría/marca/precio mientras el filtro de tienda está activo, el banner DEBE seguir visible. La condición es `Boolean(filters.storeId || filters.storeName)` — desacoplada del resto. CUMPLIDO por diseño.

---

## i18n — Nuevas claves requeridas

Agregar en `nosee/src/locales/es-MX.js` y `nosee/src/locales/en-US.js` (mismo objeto, mismo path).

### `storesPage.*` (Parte A — drawer)

| Key                              | es-MX                             | en-US                            |
|----------------------------------|-----------------------------------|----------------------------------|
| `filtersLabel`                   | `Filtros de tiendas`              | `Store filters`                  |
| `filterByTypeLabel`              | `Filtrar por tipo de tienda`      | `Filter by store type`           |
| `typeAll`                        | `Todas`                           | `All`                            |
| `typePhysical`                   | `Físicas`                         | `Physical`                       |
| `typeVirtual`                    | `Virtuales`                       | `Virtual`                        |
| `onlyWithLocation`               | `Solo con ubicación en mapa`      | `Only with map location`         |

### `home.*` (Parte B — banner)

| Key                              | es-MX                                       | en-US                                  |
|----------------------------------|---------------------------------------------|----------------------------------------|
| `filteringByStore`               | `Filtrando por tienda`                      | `Filtering by store`                   |
| `clearStoreFilter`               | `Quitar filtro`                             | `Clear filter`                         |
| `clearStoreFilterLabel`          | `Quitar filtro de tienda`                   | `Clear store filter`                   |
| `unknownStore`                   | `tienda seleccionada`                       | `selected store`                       |

NOTA: NO renombrar claves existentes. NO mover `home.*` a otro namespace. Adición pura.

---

## Resumen del impacto por archivo

| Archivo                                                               | Tipo de cambio                |
|------------------------------------------------------------------------|-------------------------------|
| `nosee/src/services/api/stores.api.js`                                | Extiende `listStores`         |
| `nosee/src/features/stores/hooks/useStoresList.js`                    | Estados + 2 handlers nuevos   |
| `nosee/src/features/stores/components/StoresDrawer.jsx`               | Props + UI chips + toggle     |
| `nosee/src/features/stores/pages/StoresPage.jsx`                      | Cableado de props nuevas      |
| `nosee/src/features/publications/components/StoreFilterBanner.jsx`    | NUEVO componente              |
| `nosee/src/pages/HomePage.jsx`                                        | Render condicional + handler  |
| `nosee/src/locales/es-MX.js`                                          | 10 claves nuevas              |
| `nosee/src/locales/en-US.js`                                          | 10 claves nuevas              |

NO se tocan: `PriceSearchFilter.jsx`, `StoreCombobox`, `StoreDetailModal.jsx`, esquema Supabase, RLS, edge functions.
