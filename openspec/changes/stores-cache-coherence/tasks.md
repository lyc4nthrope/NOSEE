# Tasks: Stores Cache Coherence

## Phase 1: Implementation

- [x] 1.1 **Replace module cache with cache service in `useStoresMap.js`**
      Import `getOrSetCache`/`clearCache` from `services/cache.js`; remove `_storesCache`, `_storesCacheAt`, `_storesFetching` module vars; rewrite `fetchPhysicalStores()` to use `getOrSetCache('stores:physical:map', fetchFn, 300000)`; rewrite `invalidateStoresCache()` as `clearCache('stores:physical:map')` wrapper.

- [x] 1.2 **Add `storesError`, `refetchStores`, and event listener in `useStoresMap.js`**
      Add `storesError` state (null | string); propagate fetch errors from `getOrSetCache` catch; add `refetchStores()` callback that calls `clearCache` + re-fetches; add `useEffect` listening to `nosee:store-updated` CustomEvent that calls `refetchStores`; add unmount guard via `cancelled` flag; export new members in return object.

- [x] 1.3 **Wire `storesError` banner in `StoresPage.jsx`**
      Destructure `storesError` from `useStoresMap` return; add error banner JSX (same style as `mapError` overlay) shown when `storesError` is non-null.

## Phase 2: Verification

- [x] 2.1 **Run existing test suite**
      `cd nosee && npm run test:ci` — 31/32 pass, 776/779 pass. 3 failures in `OverviewPanel.test.jsx` (unrelated i18n issue, pre-existing). **0 regressions from cache changes.**

- [ ] 2.2 **Manual smoke test**
      Verify: (a) updating a store in `StoreDetailModal` triggers map refetch via event, (b) API failure shows `storesError` banner, (c) `invalidateStoresCache()` is importable and clears cache.
