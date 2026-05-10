# i18n — Guía para desarrolladores

## Sistema
Solución custom sin librerías externas. `LanguageContext` expone `t` (traducciones) y `tbi` (bilingüe).

## Archivos
- `src/locales/es-MX.js` — Español (Colombia/México)
- `src/locales/en-US.js` — Inglés (US)
- `src/locales/index.js` — barrel que combina ambos en `TRANSLATIONS`
- Ambos archivos son espejo exacto (misma estructura, mismas keys, 1658 líneas c/u)

## Estructura
Las traducciones son objetos JS anidados por feature (namespace):

```js
adminDashboard: {
  navOverview: "Resumen",
  confirmHide: (name) => `¿Seguro que deseas ocultar "${name}"?`,
  catalogPanel: {
    title: "Catálogo",
    searchPlaceholder: "Buscar...",
  }
}
```

## Namespaces del Admin (7 principales)

| Namespace | Descripción |
|-----------|-------------|
| `adminDashboard` | Navegación, tablas, modales, botones, títulos (~245 keys + 10 sub-namespaces) |
| `catalogPanel` | Catálogo de tiendas/productos/marcas (34 keys) |
| `ordersPanel` | Pedidos, pagos, status labels (34 keys) |
| `dealerApplicationsTable` | Solicitudes de repartidor (23 keys) |
| `logsPanel` | Resumen de logs (10 keys) |
| `adminLogTable` | Tabla de logs con filtros (25 keys) |
| `settingsPanel` | Configuración del sistema (8 keys) |

## Uso en componentes

```jsx
import { useLanguage } from '@/contexts/LanguageContext';

function MiComponente() {
  const { t } = useLanguage();
  const td = t.adminDashboard;

  return <h1>{td.overviewTitle}</h1>;
}
```

Para valores dinámicos:
```jsx
<span>{td.usersCount(users.length)}</span>
```

Para texto bilingüe (soporte multi-locale en un mismo render):
```jsx
const { tbi } = useLanguage();
const text = tbi(tr => tr.adminDashboard.pubHiddenOk);
// Devuelve: "Publicación ocultada correctamente.\nPublication hidden successfully."
```

## Agregar un nuevo idioma
1. Copiar `src/locales/en-US.js` → `src/locales/fr-FR.js`
2. Traducir todos los valores (no las keys)
3. En `src/locales/index.js`, importar y agregar al objeto `TRANSLATIONS`
4. En `LanguageContext.jsx`, agregar el código a `SUPPORTED_LANGS` y a `LANG_OPTIONS`
5. Si el idioma es RTL, agregar lógica de `dir` en el contexto

## Buenas prácticas
- Nombres de key en camelCase y en inglés
- Usar funciones flecha para valores dinámicos: `(name) => \`Hola ${name}\``
- NO hardcodear strings en español en los componentes
- En componentes: `const { t } = useLanguage(); const td = t.adminDashboard;`
- `console.error` NO se traduce (errores técnicos en inglés)
- Los strings de error con interpolación usan funciones: `errorDeletePub: (e) => \`Error: ${e}\``
