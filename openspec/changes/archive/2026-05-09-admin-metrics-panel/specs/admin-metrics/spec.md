# Admin Metrics Specification

## Purpose
Definir el comportamiento del MVP del panel admin/métricas para `/dashboard/admin`, limitado a overview, moderación/reportes y logs clave, con agregación server-side y frontera explícita respecto de `nosee/monitoring/*`.

## Requirements

### Requirement: ADM-01 — Admin-only aggregated metrics layer
The system MUST expose the MVP metrics through admin-only views or RPCs consumed from `src/services/api/*.api.js`.
The system MUST NOT calculate dashboard aggregates directly inside React components with raw Supabase table queries.

#### Scenario: Overview loads through aggregated endpoint
- GIVEN an authenticated admin opens `/dashboard/admin`
- WHEN the overview metrics are requested
- THEN the UI calls a dedicated admin metrics API module
- AND the API resolves pre-aggregated overview data from Supabase

#### Scenario: Non-admin cannot read admin metrics
- GIVEN an authenticated non-admin user
- WHEN that user attempts to invoke an admin metrics endpoint
- THEN access MUST be denied by backend authorization or RLS-compatible grants

### Requirement: ADM-02 — MVP overview content
The system MUST render an overview section with exactly these MVP summaries: total users, publications created today, validations today, pending reports, pending dealer applications, and logins in the last 24 hours.
The system SHOULD include a compact trend or breakdown only for reports and logins if the data is already available from the same aggregated source.

#### Scenario: Admin sees fixed KPI set
- GIVEN overview data is available
- WHEN the admin enters the overview section
- THEN the six MVP summaries are displayed with stable labels and values

#### Scenario: Partial data failure
- GIVEN one KPI source fails but the request returns a recoverable error payload
- WHEN the overview renders
- THEN the affected KPI shows fallback state
- AND the rest of the overview remains usable

### Requirement: ADM-03 — Moderation and reports drilldown
The system MUST provide a moderation/reportes section focused on pending vs resolved counts, report reasons, and the latest actionable reports.
The system MUST use normalized report status handling compatible with existing `reports` data.

#### Scenario: Reports section prioritizes backlog
- GIVEN the admin opens the reports section
- WHEN moderation data is loaded
- THEN pending backlog, resolved count, and recent actionable reports are displayed first

### Requirement: ADM-04 — Key logs section
The system MUST provide a logs section that summarizes `login_audit_logs`, `user_activity_logs`, and `admin_content_audit_log`.
The system MUST scope MVP logs to key audit visibility and SHALL NOT attempt full observability replacement.

#### Scenario: Logs section merges key channels
- GIVEN the admin opens logs
- WHEN log summaries are requested
- THEN the panel shows recent login events, recent admin actions, and recent user activity counts

### Requirement: ADM-05 — Observability boundary
The system MUST keep `nosee/monitoring/*` as a separate operational observability stack.
The admin metrics MVP MAY link to external monitoring documentation, but it MUST NOT duplicate Prometheus/Grafana dashboards inside the admin panel.

#### Scenario: Functional vs operational metrics stay separated
- GIVEN the project already has Prometheus/Grafana assets
- WHEN the admin metrics MVP is implemented
- THEN product/admin KPIs stay in `/dashboard/admin`
- AND operational telemetry remains in `monitoring/*`
