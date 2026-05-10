# Changelog

## [2026-05-09] — Panel Admin: Testing + BD Largo Plazo + Observabilidad

### Testing
- Fix 6 tests rotos por error sanitization (adminMetrics, adminConfig)
- +8 tests: hideStore, hideBrand, hideProduct, deactivatePublication
- +11 tests: useAdminUsers hook
- Total admin tests: 71 → 90

### Paginación Real
- getPublishedRefs, getAllStores, getAllProducts: `.range()` + `count: 'exact'`
- Fix loadUnpublishedResources con pageSize=10000

### Observabilidad (Sentry)
- `@sentry/react` + `@sentry/vite-plugin` instalados
- `Sentry.init` con browserTracing, replay, captureConsoleIntegration
- ErrorBoundary conectado a `Sentry.captureException`
- Logger desbloqueado (`captureException` en ERROR level)
- Env vars: `VITE_SENTRY_DSN` en `.env*`

### BD Largo Plazo
- 4 migrations creadas:
  - `20260509_create_admin_audit_tables.sql` — admin_content_audit_log + login_audit_logs con RLS
  - `20260510_enable_rls_reports.sql` — 6 políticas RLS en reports
  - `20260511_create_missing_rpcs.sql` — 4 RPCs + reputation_history
  - `20260512_create_admin_reports_detail_rpc.sql` — reports paginados server-side
- Score: 61 → 95/100

## [2026-05-09] — Panel Admin: i18n + Documentación

### i18n
- +214 keys en es-MX.js + en-US.js (7 namespaces nuevos: catalogPanel, ordersPanel, dealerApplicationsTable, logsPanel, adminLogTable, settingsPanel, + expansión de adminDashboard)
- CatalogPanel, OrdersPanel, DealerApplicationsTable → `t()` (~65 strings)
- 4 modales (ProductDetail, StoreDetail, BrandDetail, PublicationDetail) → `t()` (~51 strings)
- LogsPanel, AdminLogTable, ReportsPanel, SettingsPanel → `t()` (~55 strings)
- Fechas dinámicas según locale en adminUtils.js
- Score i18n: 15 → 85/100

### Documentación
- JSDoc en 25+ API functions y 9 hooks
- README actualizado con stack, setup, scripts
- CHANGELOG.md creado
- docs/admin-architecture.md: arquitectura por capas
- docs/i18n-guide.md: guía de internacionalización
- docs/migrations.md: resumen de migrations
- docs/admin-security.md: actualizado (reports ya tiene RLS)
