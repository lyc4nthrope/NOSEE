# Tasks: Admin Panel Typography

## Phase 1: CSS Variable Definitions

- [x] 1.1 Add 7 `--admin-fs-*` vars (`xs: 11px`, `sm: 12px`, `base: 13px`, `md: 14px`, `lg: 16px`, `xl: 18px`, `2xl: 26px`) to `nosee/src/index.css:root` after existing tokens (~line 50)

## Phase 2: adminStyles.js Migration

- [x] 2.1 Replace all 54 `fontSize` pixel refs in `nosee/src/features/dashboard/admin/adminStyles.js` with `var(--admin-fs-*)`, skipping `fontSize: 20` on `kpiAlertIcon` (line 33)

## Phase 3: Inline Styles Migration

- [x] 3.1 Replace 113 inline `fontSize` across ~20 `.jsx` files under `admin/`, batched by pixel value: `10→xs` (2), `11→xs` (27), `12→sm` (47), `13→base` (55), `14→md` (17), `15→md` (2), `16→lg` (4), `18→xl` (8), `22→2xl` (1), `24→2xl` (1), `26→2xl` (2)

## Phase 4: Verification

- [x] 4.1 Run `grep -r "fontSize:" nosee/src/features/dashboard/admin/` — zero raw pixel values expected (only `var(--admin-fs-*)` + single `20px` exception)
- [x] 4.2 Run `npm run lint` and `npm test` to confirm no regressions
