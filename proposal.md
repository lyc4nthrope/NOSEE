# Proposal: Admin Panel Redesign

## Intent
Fix critical layout bugs, eliminate AI-slop tells (emoji-as-icons, hardcoded colors), and give the admin panel a professional visual baseline that respects dark mode and existing CSS variable theming.

## Scope

### In Scope (Phase 1 — P0/P1)
- Fix DealersSection rendered outside `<main>` (AdminDashboard.jsx:251) → double scrollbar
- Fix ConfirmModal hardcoded `#fff`, `#dc3545`, `#ccc` → dark mode breakage
- Remove `borderLeft: 3px solid` side-stripe from LogsPanel (Impeccable ban violation)
- Replace all emoji icons (~25 across AdminDashboard, OverviewPanel, DealerApplicationsTable) with inline SVG icons
- Migrate all hardcoded hex colors (~31 occurrences across 6 files) to CSS variables (`var(--accent)`, `var(--error)`, `var(--success)`, `var(--warning)`, `var(--bg-surface)`, etc.)
- Add hover states to table rows and focus-visible indicators
- Refactor DealerApplicationsTable to use adminStyles instead of local inline styles
- Remove dead code: useAdminCategories.js

### Out of Scope (Phase 2 — P2/P3)
- Font size modular scale normalization (10+ unique sizes in adminStyles)
- Loading pattern unification (skeleton vs text "Cargando...")
- Animation timing normalization
- `text-wrap: balance` on headings, `font-variant-numeric: tabular-nums` on tables
- Modal → slide-over panel migration
- Prop drilling reduction via Zustand
- Container queries, React.memo/useCallback optimization

## Approach
**Phase 1** (this change): Fix 3 P0 bugs first, then batch replace emojis with SVG icons across all files, batch migrate hardcoded colors to CSS vars, add hover/focus states, kill dead code. Each bucket is a separate commit for clean review.

## Affected Areas
| Area | Impact | Description |
|------|--------|-------------|
| AdminDashboard.jsx | Modified | Move DealersSection inside `<main>`, replace nav emoji with SVG |
| ConfirmModal.jsx | Modified | Replace all hardcoded colors with CSS variables |
| LogsPanel.jsx | Modified | Remove border-left side-stripe, replace hardcoded colors |
| OverviewPanel.jsx | Modified | Replace emoji with SVG, accent hex → CSS vars |
| DealerApplicationsTable.jsx | Refactored | Replace emoji, migrate all local styles to adminStyles |
| AdminLogTable.jsx | Modified | Replace hardcoded hex colors with CSS vars |
| adminStyles.js | Modified | Add table row hover, focus-visible styles, maybe new SVG icon styles |
| KpiCard.jsx | Modified | If it receives emoji prop, update to SVG |
| useAdminCategories.js | Deleted | Dead code, no imports anywhere |

## Risks
| Risk | Likelihood | Mitigation |
|------|------------|-------------|
| SVG icons shift layout | Medium | Use `currentColor`, fixed 20x20 viewBox, test all panels |
| CSS var swap misses nuance | Low | grep for all hex patterns after migration; verify dark mode per component |
| ESLint regression from changes | Low | Run `npm run lint` before committing each bucket |

## Rollback Plan
`git revert` the Phase 1 merge commit. No external dependencies (SVG icons are inline, no new packages).

## Success Criteria
- [ ] All P0 bugs fixed (DealersSection layout, ConfirmModal dark mode, side-stripe ban)
- [ ] Zero hardcoded colors remaining in admin panel files
- [ ] All emoji replaced with SVG icons in admin panel
- [ ] ESLint 0 errors
- [ ] Dark mode verified on every admin component
- [ ] DealerApplicationsTable uses adminStyles exclusively
- [ ] useAdminCategories.js deleted
