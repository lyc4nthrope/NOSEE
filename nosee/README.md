# NØSEE

Aplicación web de crowd-sourcing de precios. Los usuarios publican precios de productos en tiendas, y repartidores realizan pedidos de compra.

## Stack técnico

- **React 19** + **Vite 7** — Frontend framework y bundler
- **Supabase** — Backend como servicio (PostgreSQL, Auth, Realtime)
- **Zustand** — State management global
- **React Router v7** — Routing SPA
- **Tailwind CSS 4** — Estilos utilitarios
- **Stitch** — Refinamiento visual post-Tailwind
- **Leaflet** — Mapas interactivos
- **Mercado Pago** — Procesamiento de pagos
- **Sentry** — Monitoreo de errores
- **PWA (vite-plugin-pwa)** — Instalable como app

## Testing

- **Vitest** + **Testing Library** — Tests unitarios y de componentes
- **Playwright** — Tests E2E

## Setup local

1. Clonar el repositorio
2. `npm install`
3. Copiar `.env.example` a `.env` y completar las variables de entorno de Supabase (URL + anon key)
4. `npm run dev`

## Scripts disponibles

| Comando | Descripción |
|---------|-------------|
| `npm run dev` | Inicia servidor de desarrollo Vite |
| `npm run build` | Compila para producción |
| `npm run preview` | Previsualiza el build compilado |
| `npm run lint` | Ejecuta ESLint |
| `npm run test` | Tests unitarios (modo watch) |
| `npm run test:ci` | Tests unitarios (single run) |
| `npm run test:coverage` | Tests unitarios con reporte de cobertura |
| `npm run test:e2e` | Tests E2E con Playwright |
| `npm run test:e2e:ui` | Tests E2E con Playwright UI mode |
| `npm run build:staging` | Build para entorno staging |
| `npm run build:production` | Build para entorno producción |

---

## UI stack oficial

- **Tailwind CSS** es la base para implementar interfaces nuevas o refactors visuales.
- **Stitch** se usa después para refinamiento visual/post-diseño.
- El proyecto mantiene su **design system** mediante variables CSS en `src/index.css`.
- Esas variables ya están expuestas a Tailwind con `@theme inline`.

## Instrucciones para agentes (Codex / Claude)

Si trabajás en UI dentro de este repo:

1. Usá **Tailwind CSS** como primera opción.
2. **No hardcodees** colores, radios, sombras o tipografía.
3. Reutilizá los tokens existentes desde Tailwind, por ejemplo:
   - `bg-app-bg`
   - `bg-app-surface`
   - `bg-app-elevated`
   - `text-app-text`
   - `text-app-text-secondary`
   - `border-app-border`
   - `rounded-app-md`
   - `shadow-app-md`
4. Preferí `className` con utilidades Tailwind sobre `style={{}}`.
5. Evitá crear CSS nuevo salvo que sea realmente necesario.
6. Después de implementar la base con Tailwind, se puede usar **Stitch** para pulir la UI.

## Documento de referencia

- Ver `docs/ui-guidelines.md`
