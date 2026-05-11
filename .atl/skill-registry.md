# Skill Registry — Ingenieria_Software_III

Generated: 2026-05-10

## User Skills

| Skill | Trigger |
|-------|---------|
| `accessibility-ui` | Accessibility-sensitive UI work |
| `api-service-pattern` | API/service layer changes |
| `architecture-guardrails` | Architecture decisions or refactors |
| `branch-pr` | Creating a pull request, opening a PR, preparing changes for review |
| `commit-hygiene` | Commit preparation and repo hygiene |
| `css-design-system` | CSS/system visual consistency |
| `frontend-ui-pattern` | React UI implementation work |
| `github-pr` | GitHub PR workflows |
| `go-testing` | Writing Go tests, using teatest, adding test coverage |
| `impeccable` | Design critique, audit, polish, UI/UX refinement, visual design review |
| `issue-creation` | Creating a GitHub issue, reporting a bug, requesting a feature |
| `judgment-day` | "judgment day", "judgment-day", "review adversarial", "dual review", "doble review", "juzgar", "que lo juzguen" |
| `playwright-testing` | E2E or Playwright changes |
| `project-structure` | File/folder organization decisions |
| `ui-ux-pro-max` | UI/UX design, design systems, CSS/styling, layouts, frontend design |
| `react-19` | React 19-specific implementation |
| `react-doctor` | Post-change React validation |
| `responsive-layout` | Responsive/mobile layout work |
| `sdd-init` | "sdd init", "iniciar sdd", "openspec init" |
| `sdd-explore` | Explore a feature/problem before a change |
| `sdd-propose` | Create/update a change proposal |
| `sdd-spec` | Write/update delta specs |
| `sdd-design` | Write/update technical design |
| `sdd-tasks` | Create/update implementation task breakdown |
| `sdd-apply` | Implement tasks from a change |
| `sdd-verify` | Verify a completed or partial change |
| `sdd-archive` | Archive a completed change |
| `skill-creator` | Creating new AI skills or agent instructions |
| `supabase-rpc-pattern` | Supabase RPC/database integration patterns |
| `zod-validation` | Validation/schema work |
| `zustand-patterns` | Zustand store design or fixes |

## SDD Status

- Persistence mode: hybrid (`openspec/` + Engram)
- Config file: `openspec/config.yaml`
- Main specs root: `openspec/specs/`
- Active changes root: `openspec/changes/`
- Archive root: `openspec/changes/archive/`

## Compact Rules

### React / JSX (`nosee/src/**/*.jsx`, `nosee/src/**/*.js`)
- Feature-based architecture: `src/features/{feature}/pages|components|hooks|store|schemas|mappers`
- API calls go through `src/services/api/*.api.js` — never fetch directly from components
- State uses Zustand stores in feature folders
- Styles use inline JS objects in co-located `*Styles.js` files
- No TypeScript in app code
- Localization lives in `src/locales/es-MX.js` and `src/locales/en-US.js`
- Auth uses Supabase Auth with `RoleRouter` and `ProtectedRoute`
- Realtime uses Supabase `postgres_changes`; filtered subscriptions require `REPLICA IDENTITY FULL`
- Maps use Leaflet/React-Leaflet and lazy loading helpers
- Tests use Vitest + Testing Library; E2E uses Playwright

### Workflow Conventions
- Conventional commits in Español Latino
- No AI attribution in commits
- Active work branch: `cristhian`; stable branch: `main`
- Do not run `npm run build` after normal code changes unless explicitly requested
- New user-facing strings must be added to both locales
- Prefer SDD flow for non-trivial changes: explore → propose → spec → design → tasks → apply → verify → archive

### Infrastructure
- Deployment workflow: `.github/workflows/azure-static-web-apps-ashy-desert-05bc43c10.yml`
- Frontend app root: `nosee/`
- Project SDD config: `openspec/config.yaml`
