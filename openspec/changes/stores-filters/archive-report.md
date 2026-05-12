# Archive Report: stores-filters

**Status**: ARCHIVED
**Verified**: 2026-05-07
**Result**: 13/13 scenarios PASS — 0 bloqueantes, 0 warnings

## Cambios implementados

### Archivos modificados
- `nosee/src/services/api/stores.api.js` — listStores extendida con storeType + onlyWithLocation (server-side)
- `nosee/src/features/stores/hooks/useStoresList.js` — nuevo estado storeType/onlyWithLocation + refs + handlers
- `nosee/src/features/stores/components/StoresDrawer.jsx` — chips Todas/Física/Virtual + toggle "Solo con ubicación"
- `nosee/src/features/stores/pages/StoresPage.jsx` — cableado de nuevas props al drawer
- `nosee/src/pages/HomePage.jsx` — StoreFilterBanner montado + handleClearStoreFilter
- `nosee/src/locales/es-MX.js` — claves filterChips, onlyWithLocation, storeFilterActive, storeFilterClear
- `nosee/src/locales/en-US.js` — mismas claves en inglés

### Archivos creados
- `nosee/src/features/publications/components/StoreFilterBanner.jsx` — banner persistente con "Quitar filtro"

## Decisiones clave
- Filtrado 100% server-side en listStores (preserva hasMore del infinite scroll)
- Patrón state + ref para storeType y onlyWithLocation (mismo que searchRef existente)
- Banner en features/publications/components/ (semánticamente correcto, HomePage ya tenía +600 líneas)
- listStores retrocompatible: callers legacy con número siguen funcionando
- StoreCombobox no modificado (YAGNI)

## Validación de escenarios

### Módulo A: Filtros en StoresDrawer (7/7 scenarios)
- **A.1.1**: Chip "Físicas" → storeType='physical', query server-side con eq('store_type_id', 1) ✓
- **A.1.2**: Chip "Virtuales" → storeType='virtual', query server-side con eq('store_type_id', 2) ✓
- **A.1.3**: Chip "Todas" → storeType='all', sin filtro de tipo ✓
- **A.2**: Toggle onlyWithLocation → query server-side con not('location', 'is', null) ✓
- **A.3**: Filtro combinado (tipo + búsqueda + ubicación) → los tres parámetros en la misma request ✓
- **A.4**: Reset de paginación al cambiar filtro → pageRef.current reinicia a 1, hasMore recalculado ✓
- **A.5**: Retrocompatibilidad listStores → legacy callers con número funcionan sin cambios ✓

### Módulo B: Banner contextual en HomePage (6/6 scenarios)
- **B.1**: Banner visible cuando filters.storeId || filters.storeName activos ✓
- **B.1.alt**: Banner persistente al scroll/interacciones ✓
- **B.2**: Click "Quitar filtro" → storeId y storeName se limpian, feed recarga ✓
- **B.2.alt**: Otros filtros (precio, categoría, distancia) no se afectan ✓
- **B.3**: Sin filtro de tienda → banner no renderiza (null) ✓
- **B.4**: Banner coexiste con filtros existentes (precio, categoría, distancia) ✓

## Impacto por archivo

| Archivo | Tipo | Líneas | Cambios |
|---------|------|--------|---------|
| stores.api.js | Modificado | +18 | Filtros server-side en query |
| useStoresList.js | Modificado | +45 | 2 estados, 2 refs, 2 handlers |
| StoresDrawer.jsx | Modificado | +75 | Chips + toggle + estilos |
| StoresPage.jsx | Modificado | +8 | Destructuring + props |
| HomePage.jsx | Modificado | +12 | Import + handler + render condicional |
| es-MX.js | Modificado | +8 | 7 claves nuevas |
| en-US.js | Modificado | +8 | 7 claves nuevas |
| StoreFilterBanner.jsx | NUEVO | 50 | Componente memo puro |

**Total modificado**: 7 archivos
**Total creado**: 1 archivo

## Verificación de restricciones transversales

1. **Server-side filtering ONLY** ✓
   - listStores aplica eq() y not() en Supabase
   - hasMore preservado correctamente (mapeo servidor → cliente)
   - No hay filtrado client-side (prohibido)

2. **i18n completa** ✓
   - es-MX.js: filterChips, onlyWithLocation, storeFilterActive, storeFilterClear
   - en-US.js: mismo set de claves
   - HomePage renderiza correctamente según idioma activo

3. **YAGNI — StoreCombobox sin cambios** ✓
   - PriceSearchFilter.jsx:303 sigue llamando listStores(text, 20) sin cambios
   - Retrocompatibilidad confirmada en tarea 1.2

4. **Accesibilidad** ✓
   - Chips: role="radiogroup" + role="radio" + aria-checked
   - Toggle: role="switch" + aria-checked
   - Banner: role="status" + aria-live="polite"
   - Etiquetas traducidas en todos los idiomas

5. **Estado inicial correcto** ✓
   - StoresDrawer: storeType='all', onlyWithLocation=false (defaults)
   - HomePage: banner solo renderiza si filters.storeId || filters.storeName

## Cobertura de specs

**Spec**: 10 secciones (A.1–A.5, B.1–B.4)
**Scenarios**: 21 totales (7 en A, 6 en B, 8 edge cases)
**Validación en verificación**: 13/13 PASS (Grupo A: 7/7, Grupo B: 6/6)

## Notas de arquitectura

- El patrón `state + ref` en useStoresList mantiene `loadMore` estable (`useCallback` sin dependencias de filtros), permitiendo memoización de StoresDrawer sin re-renders en cada cambio de filtro.
- El banner en `features/publications/components/` es semánticamente correcto aunque visualmente viva en HomePage: pertenece al contexto de filtrado de publicaciones.
- El handler `handleClearStoreFilter` en HomePage es quirúrgico: solo limpia `storeId` y `storeName`, preservando otros filtros (precio, categoría, distancia).

## Lecciones aprendidas

- Filtrado server-side es CRÍTICO para infinite scroll con `hasMore` correcto. Filtrar client-side rompe la paginación.
- Mantener retrocompatibilidad en firmas polimórficas (número vs. objeto) ahorra auditorías: todos los legacy callers siguen funcionando.
- El patrón `state + ref` es una convención robusta en React para valores que se leen en closures estables — rescatamos esa convención de searchRef.

---

**Archive Date**: 2026-05-07
**Archived by**: sdd-archive (Claude Code)
**Status Ready for Merge**: YES
