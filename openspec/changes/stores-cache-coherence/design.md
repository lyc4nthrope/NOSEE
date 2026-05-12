# Design: Stores Cache Coherence

## Technical Approach

Replace the module-level `_storesCache` in `useStoresMap` with `getOrSetCache()` from `services/cache.js`, expose error state and a `refetchStores` callback, then wire invalidation via the existing `nosee:store-updated` custom event — following the same pattern `usePublications.js` already uses.

## Architecture Decisions

### Decision: Invalidation mechanism

| Option | Tradeoff | Decision |
|--------|----------|----------|
| Zustand global flag | +explicit, -adds coupling to store infra | |
| `refetchStores` passed to StoresPage, called from `handleStoreUpdated` | +explicit, -only works within StoresPage tree | |
| Listen to existing `nosee:store-updated` CustomEvent inside `useStoresMap` | +zero coupling, works from any context (admin panel too), already proven in `usePublications.js` | **Chosen** |

**Rationale**: The event is already dispatched by `StoreDetailModal` and consumed by `usePublications.js`. Adding the same listener inside `useStoresMap` requires no wiring in StoresPage, works automatically when updates happen outside the `/stores` route, and follows an established pattern.

### Decision: Cache key strategy

**Choice**: Single key `stores:physical:map`
**Alternatives considered**: Per-user keys, per-filter keys (existing `getPhysicalStoresFiltered` is separate)
**Rationale**: The map fetch is always the same query (`getAllPhysicalStoresWithLocation`) regardless of user. Filtered queries already use a separate API function. One key = one `clearCache()` call.

### Decision: Error propagation

**Choice**: Add `storesError` state alongside existing `mapError`/`locationError`
**Alternatives considered**: Reuse `mapError` (semantically different — mapError is Leaflet load failures)
**Rationale**: Keeping them separated follows the existing pattern (line 219 has `mapError` already) and avoids confusion between CDN load errors and API errors.

### Decision: Keep `invalidateStoresCache` export

**Choice**: Re-export it as a thin wrapper around `clearCache('stores:physical:map')`
**Alternatives considered**: Remove it (nobody imports it yet)
**Rationale**: Backward compat and gives any future consumer a direct invalidation path without importing cache.js.

## Data Flow

```
StoreDetailModal
  └── onStoreUpdated(updatedStore) ──→ StoresPage (list update via updateStore)
  └── dispatch 'nosee:store-updated'  ──→ usePublications (existing listener)
                                        ──→ useStoresMap (new listener)
                                              ├── clearCache('stores:physical:map')
                                              ├── setPhysicalStores([])          ← clears stale markers
                                              └── getOrSetCache(key, fetchFn)    ← fresh fetch
                                                    └── getAllPhysicalStoresWithLocation()
```

When `useStoresMap` receives the event while unmounted, `clearCache` is called which affects the next mount. The effect guard (`cancelled` flag) prevents setState on unmounted component.

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `src/features/stores/hooks/useStoresMap.js` | Modify | Replace module cache with `getOrSetCache`; add `storesError`, `refetchStores`, event listener |
| `src/features/stores/pages/StoresPage.jsx` | Modify | Destructure `storesError` from `useStoresMap` return and display error banner |
| `src/services/cache.js` | None | API already satisfies all requirements |

`useStoresList.js` does NOT need changes — the list has its own fetch flow and no coherence issue.

## Interfaces / Contracts

### useStoresMap return (extended)

```js
return {
  isLoading: locationLoading || !mapReady,
  locationError,
  mapError,
  storesError,    // new — null | string
  refetchStores,  // new — () => void
};
```

### invalidation key constant

```js
const MAP_CACHE_KEY = 'stores:physical:map';
```

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | `getOrSetCache` dedup behavior | Already tested via cache service tests |
| Unit | `useStoresMap` storesError | Mount hook, make `getAllPhysicalStoresWithLocation` reject, assert `storesError` is truthy |
| Integration | Invalidation roundtrip | Dispatch `nosee:store-updated`, verify `getOrSetCache` is called (spy) and stores re-fetch |
| E2E | Visual coherence | Update a store in admin, navigate to `/stores`, verify map markers reflect change |

## Migration / Rollout

No migration required. Pure JS refactor — deploy with any release.

## Open Questions

None.
