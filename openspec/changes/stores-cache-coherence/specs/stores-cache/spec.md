# Stores Cache Specification

## Purpose

Cache coherence between the stores map view and store list/edit operations. Replaces ad-hoc module-level cache with the centralized service, ensures errors propagate, and wires cross-view invalidation.

## Requirements

### R1: Cache Service Integration

The system MUST replace module-level `_storesCache`/`_storesCacheAt`/`_storesFetching` with `getOrSetCache()` and `clearCache()` from `src/services/cache.js`.

#### Scenario: Cache hit

- GIVEN a cache entry exists for key `"physicalStores"` within TTL
- WHEN `fetchPhysicalStores()` is called
- THEN it returns cached data without calling the API

#### Scenario: Cache miss

- GIVEN no cache entry exists for key `"physicalStores"`
- WHEN `fetchPhysicalStores()` is called
- THEN it calls `getAllPhysicalStoresWithLocation()` and caches with 5min TTL

### R2: 5-Minute TTL

The cache TTL for physical stores MUST be 300000ms, preserving current behavior.

#### Scenario: TTL expiry

- GIVEN data was cached 5 minutes ago
- WHEN `fetchPhysicalStores()` is called
- THEN it fetches fresh data from the API

### R3: Cache Invalidation

`invalidateStoresCache()` MUST clear the `"physicalStores"` cache entry via `clearCache()`.

#### Scenario: Invalidation triggers refetch

- GIVEN cached data exists
- WHEN `invalidateStoresCache()` is called
- THEN the next `fetchPhysicalStores()` call triggers a network fetch

### R4: Error Propagation

`useStoresMap` MUST expose fetch errors via a `storesError` state.

#### Scenario: API failure exposes error

- GIVEN `getAllPhysicalStoresWithLocation` fails
- WHEN `useStoresMap` is mounted
- THEN `storesError` contains the error message

#### Scenario: Stale fallback on re-fetch failure

- GIVEN cached data exists AND a re-fetch fails
- WHEN the fetch resolves
- THEN stale cached data is returned AND `storesError` is set

### R5: Auto-Refetch While Mounted

When `invalidateStoresCache()` fires while `useStoresMap` is mounted, it MUST automatically refetch.

#### Scenario: Invalidation causes refetch

- GIVEN `useStoresMap` is mounted with cached data
- WHEN `invalidateStoresCache()` is called
- THEN it calls `fetchPhysicalStores()` again and updates `physicalStores` state

#### Scenario: Unmount guards

- GIVEN the component is unmounting during invalidation
- WHEN a fetch is in-flight
- THEN the result is discarded (no state update on unmounted component)

### R6: Cross-View Invalidation

A store update in StoresPage MUST invalidate the map cache.

#### Scenario: Successful update triggers invalidation

- GIVEN a store update via `StoreDetailModal` succeeds
- WHEN `handleStoreUpdated` fires
- THEN `invalidateStoresCache()` is called

#### Scenario: Failed update skips invalidation

- GIVEN a store update fails
- WHEN the error is returned
- THEN `invalidateStoresCache()` MUST NOT be called

### R7: Consumer Integration

`invalidateStoresCache()` MUST be imported and called by at least one consumer (currently dead code).

#### Scenario: Export validation

- GIVEN `invalidateStoresCache` is exported from `useStoresMap.js`
- WHEN imported by `StoresPage.jsx`
- THEN it resolves and can be invoked
