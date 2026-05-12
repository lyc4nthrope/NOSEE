# Spec: stores-filters

**Change**: stores-filters
**Project**: NOSEE
**Stack**: React 19, Zustand 5, Supabase JS 2, React Router 7, Tailwind 4
**RFC keywords**: MUST (obligatorio), SHALL (contrato), SHOULD (recomendado), MAY (opcional)

---

## Módulo A: Filtros en StoresDrawer

### A.1 Filtro por tipo de tienda

**Scenario: El usuario selecciona el chip "Físicas"**

Given que el StoresDrawer está abierto
  And los chips `Todas | Físicas | Virtuales` están visibles debajo del input de búsqueda
  And el chip activo es `Todas` (estado inicial por defecto)
When el usuario pulsa el chip `Físicas`
Then el chip `Físicas` MUST quedar visualmente activo (highlighted)
  And `useStoresList` MUST emitir una nueva llamada a `listStores` con `storeType: 'physical'`
  And la lista de tiendas MUST mostrar únicamente tiendas de tipo físico
  And el cursor de paginación (página) MUST reiniciarse a `1` antes de la nueva petición
  And `hasMore` MUST recalcularse desde cero con la respuesta del servidor

**Scenario: El usuario selecciona el chip "Virtuales"**

Given que el chip activo es cualquiera distinto de `Virtuales`
When el usuario pulsa el chip `Virtuales`
Then el chip `Virtuales` MUST quedar visualmente activo
  And `listStores` MUST llamarse con `storeType: 'virtual'`
  And el resultado MUST contener únicamente tiendas de tipo virtual

**Scenario: El usuario selecciona el chip "Todas"**

Given que el chip activo es `Físicas` o `Virtuales`
When el usuario pulsa el chip `Todas`
Then `listStores` MUST llamarse con `storeType: 'all'` (o sin el parámetro — retrocompatible)
  And la lista MUST mostrar tiendas de ambos tipos

**Scenario: Lista vacía por filtro de tipo**

Given que el chip `Físicas` está activo
  And no existen tiendas físicas registradas
When se completa la llamada a `listStores`
Then la lista MUST mostrarse vacía
  And SHOULD mostrarse un mensaje de estado vacío (ej. "No hay tiendas físicas disponibles")
  And `hasMore` SHALL ser `false`

---

### A.2 Toggle "Solo con ubicación en mapa"

**Scenario: El usuario activa el toggle**

Given que el toggle "Solo con ubicación en mapa" está desactivado
When el usuario lo activa
Then `listStores` MUST llamarse con `onlyWithLocation: true`
  And la lista MUST contener únicamente tiendas que tengan coordenadas geográficas registradas en la base de datos
  And el cursor de paginación MUST reiniciarse a `1`

**Scenario: El usuario desactiva el toggle**

Given que el toggle está activado
When el usuario lo desactiva
Then `listStores` MUST llamarse con `onlyWithLocation: false` (o sin el parámetro)
  And la lista MUST volver a incluir tiendas sin coordenadas

**Scenario: Lista vacía por filtro de ubicación**

Given que el toggle `onlyWithLocation` está activo
  And ninguna tienda tiene coordenadas registradas
When se completa la petición
Then la lista MUST mostrarse vacía
  And SHOULD mostrarse un mensaje de estado vacío específico
  And `hasMore` SHALL ser `false`

---

### A.3 Combinación de filtros (tipo + búsqueda de texto + ubicación)

**Scenario: Filtro combinado tipo físico + búsqueda de texto**

Given que el chip `Físicas` está activo
  And el input de búsqueda contiene el texto "super"
When se dispara el debounce del input
Then `listStores` MUST llamarse con `name: 'super'` Y `storeType: 'physical'` simultáneamente
  And el servidor MUST aplicar ambas condiciones en la misma query (AND lógico)
  And el resultado NO DEBE incluir tiendas virtuales aunque su nombre coincida con "super"

**Scenario: Filtro combinado tipo físico + ubicación**

Given que el chip `Físicas` está activo
  And el toggle `onlyWithLocation` está activo
When se dispara la petición
Then `listStores` MUST llamarse con `storeType: 'physical'` Y `onlyWithLocation: true`
  And el resultado MUST contener únicamente tiendas físicas con coordenadas

**Scenario: Triple combinación (tipo + texto + ubicación)**

Given que el chip `Virtuales` está activo
  And el input contiene texto
  And el toggle `onlyWithLocation` está activo
When se dispara la petición
Then los tres parámetros MUST enviarse juntos a `listStores`
  And el servidor MUST aplicar las tres condiciones en la misma query

**Scenario: Cambio rápido de filtros (race condition)**

Given que el usuario cambia el tipo de chip rápidamente varias veces en menos de 500ms
When llegan múltiples respuestas del servidor fuera de orden
Then MUST mostrarse únicamente el resultado correspondiente al último filtro activo
  And las respuestas obsoletas SHOULD cancelarse o descartarse (abort controller o guard de stale)

---

### A.4 Reset de paginación al cambiar cualquier filtro

**Scenario: Cambio de chip reinicia página**

Given que el usuario está en la página 3 del scroll infinito con el chip `Todas`
When el usuario pulsa el chip `Físicas`
Then `page` MUST reiniciarse a `1` ANTES de emitir la nueva petición a `listStores`
  And la lista MUST reemplazarse completamente (no acumularse sobre la anterior)
  And `hasMore` MUST recalcularse desde la respuesta del servidor

**Scenario: Cambio de texto en búsqueda reinicia página**

Given que el usuario tiene cargadas varias páginas via infinite scroll
When el usuario modifica el texto del input de búsqueda
Then `page` MUST reiniciarse a `1`
  And los resultados anteriores MUST descartarse antes de renderizar los nuevos

**Scenario: Toggle de ubicación reinicia página**

Given que existen páginas acumuladas en la lista
When el usuario activa o desactiva el toggle `onlyWithLocation`
Then `page` MUST reiniciarse a `1` con el mismo comportamiento de los casos anteriores

---

### A.5 Retrocompatibilidad de `listStores`

**Scenario: Llamada sin nuevos parámetros (callers existentes)**

Given que `StoreCombobox` u otro componente llama a `listStores(name, { limit, page })`
  And NO pasa `storeType` ni `onlyWithLocation`
When se ejecuta `listStores`
Then la función SHALL comportarse exactamente igual que antes del cambio
  And `storeType` ausente SHALL equivaler a `'all'` internamente
  And `onlyWithLocation` ausente SHALL equivaler a `false` internamente
  And el resultado NO DEBE variar respecto al comportamiento previo

**Scenario: Firma de `listStores` con nuevos parámetros opcionales**

Given la firma nueva: `listStores(name, { limit, page, storeType?, onlyWithLocation? })`
When se llama con `storeType` y/o `onlyWithLocation`
Then la función MUST construir la query Supabase incluyendo los filtros correspondientes
  And el filtrado MUST realizarse en el servidor (query-level), NOT en el cliente
  And la propiedad `hasMore` del resultado SHALL reflejar la paginación del conjunto filtrado

---

## Módulo B: Banner contextual en HomePage

### B.1 Aparición del banner al filtrar por tienda

**Scenario: Usuario navega a HomePage con filtro de tienda activo**

Given que el usuario pulsó "Ver todas las publicaciones" en `StoreDetailModal`
  And la URL contiene `?storeId=X&storeName=NombreTienda`
  And `HomePage` procesa los query params y los aplica a `filters` (estado de `usePublications`)
When el componente se renderiza
Then MUST mostrarse un banner contextual en la parte superior del feed de publicaciones
  And el banner MUST contener el texto "Filtrando por tienda: {storeName}"
  And el banner MUST contener un botón o acción "Quitar filtro"
  And el banner MUST ser visible sin necesidad de que el usuario abra ningún panel

**Scenario: El banner permanece visible mientras el filtro esté activo**

Given que el banner está visible con `filters.storeId` activo
When el usuario hace scroll hacia abajo o interactúa con otras partes de la página
Then el banner MUST permanecer visible (persistente, no efímero)
  And el banner NO DEBE desaparecer automáticamente por tiempo o scroll

**Scenario: i18n del banner**

Given que el idioma activo es `en-US`
When el banner se renderiza
Then MUST mostrarse "Filtering by store: {storeName}" (u equivalente en inglés)
  And las claves de traducción MUST existir en todos los idiomas soportados (es-MX, en-US)

---

### B.2 Acción "Quitar filtro" en el banner

**Scenario: El usuario pulsa "Quitar filtro"**

Given que el banner está visible con `filters.storeId = X` y `filters.storeName = "Tienda A"`
When el usuario pulsa "Quitar filtro"
Then `filters.storeId` MUST eliminarse o setearse a `null`/`undefined`
  And `filters.storeName` MUST eliminarse o setearse a `null`/`undefined`
  And el feed de publicaciones MUST recargarse sin el filtro de tienda
  And el banner MUST desaparecer inmediatamente
  And la URL MUST actualizarse eliminando los query params `storeId` y `storeName` (si aplica)

**Scenario: El filtro de tienda se limpia pero otros filtros persisten**

Given que el usuario tiene activos: filtro de tienda + filtro de precio
When el usuario pulsa "Quitar filtro" del banner
Then ONLY `storeId` y `storeName` MUST eliminarse de `filters`
  And el filtro de precio MUST permanecer intacto
  And el feed MUST recargarse con el filtro de precio aplicado pero sin filtro de tienda

---

### B.3 Banner no aparece sin filtro de tienda activo

**Scenario: HomePage sin parámetros de tienda**

Given que el usuario accede a HomePage sin query params de tienda
  And `filters.storeId` es `null` o `undefined`
  And `filters.storeName` es `null` o `undefined`
When el componente se renderiza
Then el banner contextual NO MUST renderizarse en el DOM
  And no MUST haber placeholder o espacio reservado para el banner

**Scenario: El filtro de tienda se eliminó previamente**

Given que el banner estaba visible
  And el usuario pulsó "Quitar filtro"
When `filters.storeId` y `filters.storeName` quedan vacíos
Then el banner MUST desaparecer sin requerir recarga de página
  And el estado SHALL ser reactivo: el banner desaparece en el mismo render cycle

---

### B.4 Coexistencia con filtros existentes (precio, categoría, distancia)

**Scenario: Banner coexiste con filtro de precio activo**

Given que `filters.storeId` está activo (banner visible)
  And el usuario tiene además un filtro de precio activo (ej. `priceMax: 500`)
When el feed renderiza
Then el banner de tienda MUST mostrarse
  And el chip o indicador de filtro de precio MUST mostrarse independientemente
  And ambos filtros MUST aplicarse simultáneamente al fetch de publicaciones (AND lógico)

**Scenario: Banner coexiste con filtro de categoría activo**

Given que `filters.storeId` está activo
  And hay una categoría seleccionada en `filters.category`
When el feed renderiza
Then el banner MUST mostrarse junto con el indicador de categoría
  And ambos filtros MUST aplicarse al servidor en la misma petición

**Scenario: Banner coexiste con filtro de distancia activo**

Given que `filters.storeId` está activo
  And `filters.maxDistance` tiene un valor definido
When el feed renderiza
Then el banner de tienda MUST mostrarse
  And el filtro de distancia MUST seguir operativo e independiente del banner
  And la acción "Quitar filtro" del banner MUST afectar ONLY al filtro de tienda

**Scenario: Quitar filtro de tienda NO afecta filtros de precio/categoría/distancia**

Given que múltiples filtros están activos (tienda + precio + categoría)
When el usuario pulsa "Quitar filtro" en el banner
Then ONLY `storeId` y `storeName` MUST eliminarse
  And `priceMax`, `category`, `maxDistance` y demás filtros MUST permanecer sin cambio
  And el feed MUST recargarse con los filtros restantes aplicados

---

## Restricciones transversales

1. **Server-side filtering ONLY** — `listStores` MUST NOT filtrar por tipo o ubicación en memoria del cliente. Filtrar client-side rompe la propiedad `hasMore` del infinite scroll y queda prohibido.

2. **i18n completa** — Todos los strings nuevos (chips, toggle, banner, mensajes de lista vacía) MUST registrarse en los archivos de traducción de `es-MX` y `en-US` antes de que el cambio se considere completo.

3. **YAGNI — StoreCombobox sin cambios** — `StoreCombobox` NO MUST modificarse para reconstruir `selectedStore` desde `storeId`. El caso de uso no está en el scope de este cambio.

4. **Accesibilidad** — Los chips de tipo SHOULD tener atributos `aria-pressed` que reflejen el estado activo. El toggle SHOULD tener `aria-checked`. El banner SHOULD tener `role="status"` o `aria-live="polite"`.

5. **Estado inicial de filtros** — Al montar `StoresDrawer`, el chip activo MUST ser `Todas` y el toggle MUST estar desactivado, salvo que se haya persistido estado explícitamente (no requerido en este scope).
