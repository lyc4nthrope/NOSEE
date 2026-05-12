# Admin Panel Typography Specification

## Purpose

Define a 7-tier CSS custom property scale (`--admin-fs-*`) to replace all 167 hardcoded `fontSize` pixel values across 20 files in `nosee/src/features/dashboard/admin/`, eliminating visual inconsistency and maintenance overhead.

## Requirements

### REQ-01: CSS Variable Definitions

`index.css:root` MUST define exactly these 7 font-size CSS custom properties:

| Variable | Value |
|----------|-------|
| `--admin-fs-xs` | 11px |
| `--admin-fs-sm` | 12px |
| `--admin-fs-base` | 13px |
| `--admin-fs-md` | 14px |
| `--admin-fs-lg` | 16px |
| `--admin-fs-xl` | 18px |
| `--admin-fs-2xl` | 26px |

No other `--admin-fs-*` variables SHALL be added. These MUST be the ONLY font-size CSS variables used in the admin module.

### REQ-02: adminStyles.js Migration

All 54 `fontSize` references in `adminStyles.js` MUST use `var(--admin-fs-*)` instead of raw pixel values. After migration, zero raw pixel `fontSize` values SHALL remain in `adminStyles.js`.

### REQ-03: Inline Styles Migration

All inline `fontSize` in JSX components under `admin/` MUST use `var(--admin-fs-*)`. Exception: `fontSize: 20` on `kpiAlertIcon` in `adminStyles.js` (decorative icon container, not text) — this SHALL remain as-is.

### REQ-04: Font Size Mapping

Pixel values MUST map to CSS variables as follows:

| Pixel | CSS Variable | Notes |
|-------|-------------|-------|
| 10px | `--admin-fs-xs` (11px) | 2 usages, absorbed into xs |
| 11px | `--admin-fs-xs` | Primary usage (27x) |
| 12px | `--admin-fs-sm` | 47 usages |
| 13px | `--admin-fs-base` | 55 usages |
| 14px | `--admin-fs-md` | 17 usages |
| 15px | `--admin-fs-md` (14px) | 2 usages, rounds to 14px |
| 16px | `--admin-fs-lg` | 4 usages |
| 18px | `--admin-fs-xl` | 8 usages |
| 20px | EXCLUDED | Decorative kpiAlertIcon |
| 22px | `--admin-fs-2xl` (26px) | 1 usage |
| 24px | `--admin-fs-2xl` (26px) | 1 usage |
| 26px | `--admin-fs-2xl` | 2 usages |

## Non-Functional Requirements

### NFR-01: Zero Runtime Cost

CSS variables MUST NOT be read or manipulated via JavaScript. All font-size resolution SHALL happen at CSS paint time. No Zustand store, no React state, no JS runtime involvement.

### NFR-02: Scope Isolation

The `--admin-fs-*` prefix MUST be used for all admin typography variables to avoid collisions with other modules. Variables MUST be defined in `index.css:root` for global cascade within admin.

### NFR-03: Performance

Font-size changes via CSS variables MUST NOT trigger React re-renders. CSS custom properties are resolved by the rendering engine at paint time, producing zero component lifecycle impact.

## Scenarios

### SCEN-01: Admin Panel Renders with Consistent Font Sizes

GIVEN the font-size CSS vars are defined in `index.css:root`
WHEN any admin component renders
THEN its `fontSize` is resolved from `var(--admin-fs-*)`
AND all text of the same semantic category uses the same size across components

### SCEN-02: New Component Added

GIVEN a developer creates a new admin component
WHEN they need a font size
THEN they use `var(--admin-fs-*)` from `adminStyles.js` or inline
AND they do NOT use raw pixel values

### SCEN-03: Font Size Audit

GIVEN the migration is complete
WHEN `grep -r "fontSize:" nosee/src/features/dashboard/admin/` is run
THEN it returns NO raw pixel fontSize values
AND only `var(--admin-fs-*)` and the single `20px` exception remain

## Verification

Run after implementation:
```
grep -r "fontSize:" nosee/src/features/dashboard/admin/
```

Expected: zero raw pixel values, only `var(--admin-fs-*)` references and the `20px` kpiAlertIcon exception.
