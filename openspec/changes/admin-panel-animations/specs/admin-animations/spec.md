# Admin Animations Specification

## Purpose

Normalize all transitions in the admin panel: CSS variable tokens, eliminate hardcoded magic numbers, add missing transitions to interactive elements, and add CSS-only fade-in to modals.

## Requirements

### REQ-01: CSS variable tokens

`index.css:root` MUST define `--transition-fast: 0.15s`, `--transition-base: 0.2s`, `--transition-slow: 0.3s`, `--transition-ease: ease`, `--transition-ease-out: ease-out`. These SHALL be the single source of truth for all admin transition durations and timing functions.

#### Scenario: Tokens available in CSS

- GIVEN the admin panel loads
- THEN `:root` contains all 5 `--transition-*` variables
- AND any style referencing `var(--transition-fast)` resolves to `0.15s`

### REQ-02: Tokenize existing transitions

All hardcoded duration strings in `adminStyles.js` transitions MUST be replaced with `var(--transition-*)` references. The 6 existing entries: `navItem`, `sidebarToggle`, `statCard`, `kpiAlertCard`, `tableRowHover`, `kpiLoadingSkeleton`.

#### Scenario: No magic numbers in adminStyles.js transitions

- GIVEN `adminStyles.js` is loaded
- THEN no transition or animation property contains a bare numeric duration (e.g. `0.15s`)
- AND each references `var(--transition-*)` tokens

### REQ-03: Missing interactive element transitions

The following style elements MUST gain transitions on `background, color` (or `color` alone for `linkBtn`) using `var(--transition-fast)` with `var(--transition-ease)`: `filterBtn`, `filterBtnActive`, `actionBtn`, `actionBtnDanger`, `btnDelete`, `btnBan`, `btnDismiss`, `linkBtn`, SettingsPanel buttons, Pagination buttons, `dealerActionBtn`.

#### Scenario: Hover on all interactive elements

- GIVEN the user hovers over any filter, action, delete, ban, dismiss, link, settings, pagination, or dealer button
- THEN a `var(--transition-fast)` transition plays on the relevant properties

### REQ-04: FunnelBar transition tokenization

In `OrdersPanel.jsx`, the inline `transition: 'width 0.3s ease'` MUST be replaced with `transition: 'width var(--transition-slow) var(--transition-ease)'`.

#### Scenario: FunnelBar width animates

- GIVEN the funnel data changes
- THEN the FunnelBar width animates over `var(--transition-slow)`

### REQ-05: Modal fade-in animation

`ConfirmModal`, `BanModal`, and all 5 detail modals MUST have a CSS fade-in animation when they mount. The `@keyframes fadeIn` block already exists in `index.css` (opacity 0→1, translateY 8px→0). The global `@media (prefers-reduced-motion: reduce)` rule already covers animation suppression.

#### Scenario: Modal opens with fade-in

- GIVEN the user triggers any admin modal
- THEN the modal fades in using the existing `fadeIn` keyframe animation

#### Scenario: Reduced motion

- GIVEN the user has `prefers-reduced-motion: reduce` enabled
- WHEN any modal opens
- THEN no animation plays (existing global media query applies)

### REQ-06: No transition:all

Zero new instances of `transition: 'all'` SHALL be introduced. The current count (0) MUST be preserved.

#### Scenario: Audit finds no transition all

- GIVEN the full admin codebase is searched
- THEN `transition: 'all'` appears zero times

## Non-Functional Requirements

### NFR-01: Zero runtime cost

All transitions and animations MUST be CSS-only. No Zustand store changes, no React state, no JS timers or `useEffect` for animation.

### NFR-02: Accessibility

All animations MUST respect `prefers-reduced-motion` via the existing global `@media (prefers-reduced-motion: reduce)` rule. Modal fade-in MUST NOT interfere with screen reader focus management (no `animation-fill-mode: forwards` that traps focus).

### NFR-03: Performance

Transitions MUST NOT animate layout-triggering properties (`width`, `height`, `margin`, `top`, `left`) except where explicitly acceptable (FunnelBar width animation for bar chart visualization). Prefer `transform` and `opacity`.

## Scenarios

### SCEN-01: Hover over any interactive element

- GIVEN the user hovers over any button or link in the admin panel
- THEN a transition of `var(--transition-fast)` plays on the relevant properties

### SCEN-02: Modal opens

- GIVEN the user triggers a confirm, ban, or detail modal
- THEN the modal fades in with a CSS animation over `var(--transition-slow)`

### SCEN-03: FunnelBar updates

- GIVEN the funnel data changes in OrdersPanel
- THEN the FunnelBar width animates over `var(--transition-slow)`

### SCEN-04: prefers-reduced-motion

- GIVEN the user has `prefers-reduced-motion: reduce` enabled
- WHEN hovering over any element or opening a modal
- THEN no animation plays
