# Admin Panel Zustand Store — Specification

## Purpose
Define the Zustand store for shared UI state in `/dashboard/admin`, eliminating prop drilling through AdminDashboard.jsx. Manages navigation, modals, and selected-entity references only. Data arrays, filters, loading states, and CRUD handlers stay in their respective hooks.

## Requirements

### Requirement: REQ-01 — Navigation state (activeSection)
The store MUST hold `activeSection` with default `'content'`. The store MUST export `setActiveSection(section)` to update it.

#### Scenario: Navigate between sections
- GIVEN the admin panel displays the `'content'` section
- WHEN `setActiveSection('users')` is called
- THEN `activeSection` updates to `'users'`
- AND the content area switches to render AdminUsersSection

### Requirement: REQ-02 — Navigation state (sidebarCollapsed)
The store MUST hold `sidebarCollapsed` with default `false`. The store MUST export `toggleSidebar()` to flip the value. The store MAY also export `setSidebarCollapsed(bool)` for direct control. The trigger for toggling SHALL be a collapse/expand button in the sidebar, or an alternative trigger determined during design.

#### Scenario: Toggle sidebar
- GIVEN `sidebarCollapsed` is `false`
- WHEN the user clicks the collapse trigger
- THEN `toggleSidebar()` sets `sidebarCollapsed` to `true`
- AND the sidebar renders in collapsed layout

#### Scenario: Direct set
- GIVEN `sidebarCollapsed` is `true`
- WHEN `setSidebarCollapsed(false)` is called
- THEN `sidebarCollapsed` becomes `false`

### Requirement: REQ-03 — Confirm modal state
The store MUST hold `confirmModal` with shape `{ open: false, title: '', message: '', onConfirm: null }`. The store MUST export `openConfirmModal(config)` to set `{ open: true, ...config }` and `closeConfirmModal()` to reset to defaults. The `onConfirm` field MAY store a function reference (Zustand handles this in JS; no serialization required).

#### Scenario: Open confirm modal
- GIVEN no confirm modal is active
- WHEN `openConfirmModal({ title: 'Delete?', message: 'Are you sure?', onConfirm: handleDelete })` is called
- THEN `confirmModal.open` is `true`
- AND the title, message, and onConfirm are stored

#### Scenario: Confirm action
- GIVEN `confirmModal.open` is `true` with an `onConfirm` callback
- WHEN the user clicks "Confirm"
- THEN `closeConfirmModal()` resets `confirmModal` to defaults
- AND the `onConfirm` callback executes

#### Scenario: Cancel action
- GIVEN `confirmModal.open` is `true` with an `onConfirm` callback
- WHEN the user clicks "Cancel"
- THEN `closeConfirmModal()` resets `confirmModal` to defaults
- AND `onConfirm` is NOT called

### Requirement: REQ-04 — Ban modal state
The store MUST hold `banModal` with shape `{ user: null }`. The store MUST export `setBanModal(user | null)` to open (pass user object) or close (pass null).

#### Scenario: Open ban modal
- GIVEN no ban modal is active
- WHEN `setBanModal(userObj)` is called
- THEN `banModal.user` equals `userObj`
- AND the ban modal renders

#### Scenario: Close ban modal
- GIVEN `banModal.user` is set
- WHEN `setBanModal(null)` is called
- THEN `banModal.user` is `null`
- AND the ban modal unmounts

### Requirement: REQ-05 — Selected entity references
The store MUST hold `selectedPub`, `selectedStore`, `selectedBrand`, `selectedProduct`, `selectedReport`, each defaulting to `null`. The store MUST export `selectPublication(val)`, `selectStore(val)`, `selectBrand(val)`, `selectProduct(val)`, `selectReport(val)` — each accepting an entity reference or `null` to close.

#### Scenario: Open detail modal
- GIVEN the user browses publications
- WHEN `selectPublication(pubObj)` is called
- THEN `selectedPub` stores the publication reference
- AND the detail modal renders

#### Scenario: Close detail modal
- GIVEN `selectedPub` is set
- WHEN `selectPublication(null)` is called
- THEN `selectedPub` is `null`
- AND the detail modal unmounts

## Non-Functional Requirements

### Requirement: NFR-01 — Named exported selectors
The store MUST export named selector functions for every state property: `selectActiveSection`, `selectSidebarCollapsed`, `selectConfirmModal`, `selectBanModal`, `selectSelectedPublication`, `selectSelectedStore`, `selectSelectedBrand`, `selectSelectedProduct`, `selectSelectedReport`.

#### Scenario: Single-selector consumption
- GIVEN a component needs only `activeSection`
- WHEN it imports `selectActiveSection` and calls `useAdminStore(selectActiveSection)`
- THEN the component re-renders ONLY when `activeSection` changes

### Requirement: NFR-02 — Compound selectors with useShallow
Any component selecting TWO or more store properties MUST use `useShallow` from Zustand to prevent unnecessary re-renders on unrelated state changes.

#### Scenario: Multi-field subscription
- GIVEN a component needs `activeSection` and `sidebarCollapsed`
- WHEN it calls `useAdminStore(useShallow(s => ({ a: s.activeSection, c: s.sidebarCollapsed })))`
- THEN the component re-renders only when `activeSection` OR `sidebarCollapsed` changes

### Requirement: NFR-MEM-01 — No full entity objects
The store MUST NOT store full entity objects (publications, users, reports, logs). Selected entity fields MUST hold only IDs or minimal display references (e.g. `{ id, title }`). Arrays of entities MUST NOT be stored.

### Requirement: NFR-MEM-02 — Bounded store size
Store size MUST be bounded. All fields are scalars, booleans, nullables, or single objects. No arrays of unknown length. Maximum slot count is fixed at ~12 properties.

## Scenarios

### SCEN-01: User navigates between sections
- GIVEN admin panel is on `'content'` section
- WHEN user clicks "Usuarios" in sidebar
- THEN `setActiveSection('users')` updates the store
- AND the content area renders AdminUsersSection
- AND useAdminLogs realtime subscription switches to user-related events

### SCEN-02: User toggles sidebar
- GIVEN `sidebarCollapsed` is `false`
- WHEN user clicks the collapse button
- THEN `toggleSidebar()` sets it to `true`
- AND sidebar renders in narrow/collapsed layout
- WHEN user clicks expand button
- THEN `toggleSidebar()` sets it to `false`
- AND sidebar returns to full layout

### SCEN-03: User opens a detail modal
- GIVEN user is browsing publications
- WHEN user clicks a publication row
- THEN `selectPublication(pubObj)` stores the reference
- AND PublicationDetailModal renders with that data

### SCEN-04: User opens confirm modal and confirms
- GIVEN user clicks "Delete" on a publication
- WHEN `openConfirmModal({ title, message, onConfirm })` is called
- THEN `confirmModal.open` is `true` and the modal renders
- WHEN user clicks "Confirm"
- THEN `closeConfirmModal()` resets to defaults
- AND `onConfirm` executes

### SCEN-05: User opens ban modal
- GIVEN user selects a user to ban
- WHEN `setBanModal(userObj)` is called
- THEN `banModal.user` is set and the ban modal renders
- WHEN modal is dismissed
- THEN `setBanModal(null)` clears `banModal.user`

### SCEN-06: User switches section while modal is open
- GIVEN a detail modal is open (`selectedPub !== null`)
- WHEN user clicks a different sidebar section
- THEN `setActiveSection(newSection)` fires
- AND the selected entity MUST either reset to `null` (modal closes)
- OR the modal MUST remain open and handle the stale section gracefully

## Out of Scope
- Data arrays (publications, users, reports, logs) — stay in hooks
- Filters (pubFilter, reportStatusFilter, logFilter, etc.) — stay in hooks
- Loading / loaded / error states — stay in hooks
- CRUD handlers — stay in hooks
- `navSections` computed array — stays in AdminDashboard
- Persistence middleware — no localStorage
