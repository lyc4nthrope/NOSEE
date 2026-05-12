# Proposal: Stores Cache Coherence

## Intent

Fix stale data between stores map/list views and eliminate module-level cache anti-pattern. The map uses a module-level `_storesCache` with 5min TTL that never refetches after invalidation, while the list uses a separate API with no cache at all — creating persistent incoherence when a store is updated.

## Scope

### In Scope
- Replace `_storesCache` module-level cache with `getOrSetCache`/`clearCache` from `src/services/cache.js`
- Add `storesError` state to `useStoresMap` (currently silenced via `.catch(() => _storesCache ?? [])`)
- Add refetch mechanism in `useStoresMap` so cache invalidation while mounted triggers re-fetch
- Wire invalidation signal so store updates on StoresPage trigger map refresh
- Add `storesMapInvalidated` to Zustand store or context-based flag (TBD in design)

### Out of Scope
- Adding cache to `useStoresList` (different API, no coherence issue)
- Full realtime subscriptions for store updates (future concern)
- Performance optimizations beyond cache coherence

## Approach

1. **Migrate `useStoresMap`** to use `getOrSetCache(key, fetcher, ttl)` from `src/services/cache.js` with 5min TTL, replacing `_storesCache` module variable
2. **Expose `storesError`** by removing the silent catch and propagating errors through `useState`
3. **Add `refetchStores`** callback to `useStoresMap` that clears the cache entry and re-fetches
4. **Wire invalidation** in `StoresPage` so `updateStore` success → clears map cache via a shared flag or callback
5. **Extend `cache.js`** if needed (e.g., granular key-wise `clearCache(keyPrefix)`)

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/features/stores/hooks/useStoresMap.js` | Modified | Replace module cache with service; add `storesError`, `refetchStores` |
| `src/features/stores/hooks/useStoresList.js` | Modified | Accept invalidation signal or return trigger |
| `src/features/stores/pages/StoresPage.jsx` | Modified | Orchestrate invalidation after update/delete |
| `src/services/cache.js` | Minor | Possibly add key-prefix clear |
| `src/features/stores/api/stores.api.js` | None | No changes needed |

**Routes:** `/stores` (map + list), `/dashboard/admin` (admin store updates affect map)
**Services:** `getAllPhysicalStoresWithLocation`, `listStores`, `updateStore` — no changes; orchestration only
**Supabase tables:** `physicalStores`, `stores` — no schema changes

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Cache service `getOrSetCache` doesn't support TTL-based expiry | Medium | Add TTL support to cache.js or verify it already works with the existing pattern |
| Race condition: refetch while another operation is in-flight | Low | Guard with loading state in `useStoresMap` |
| StoresPage re-render cascade from added error state | Low | Keep `storesError` as localized `useState`, not global store |

## Rollback Plan

Revert `useStoresMap.js`, `useStoresList.js`, `StoresPage.jsx` to previous git revision. If `cache.js` was extended, revert those additions too. No DB migrations or schema changes involved — pure JS rollback.

## Dependencies

None.

## Success Criteria

- [ ] `invalidateStoresCache()` is imported and called in at least one consumer
- [ ] `useStoresMap` refetches data when invalidation fires while mounted
- [ ] `storesError` is non-null when `getAllPhysicalStoresWithLocation` fails
- [ ] Updating a store in admin panel → map reflects changes within TTL
- [ ] All existing tests pass
