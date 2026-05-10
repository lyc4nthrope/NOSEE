import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import * as Sentry from "@sentry/react"
import './index.css'
import App from './App.jsx'
import { initAnalytics } from './services/analytics.js'
import { initMercadoPago } from '@mercadopago/sdk-react'

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN || '',
  environment: import.meta.env.MODE,
  release: `nosee@${import.meta.env.VITE_APP_VERSION || '1.0.0'}`,
  integrations: [
    Sentry.browserTracingIntegration(),
    Sentry.replayIntegration(),
    Sentry.captureConsoleIntegration({ levels: ['error', 'warn'] }),
  ],
  tracesSampleRate: import.meta.env.MODE === 'production' ? 0.1 : 1.0,
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
})

// Inicializar Google Analytics 4 al arrancar la app
initAnalytics()

// Inicializar MercadoPago una sola vez al arrancar la app
initMercadoPago(import.meta.env.VITE_MP_PUBLIC_KEY, { locale: 'es-CO' })

window.addEventListener('vite:preloadError', () => {
  window.location.reload()
})

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    if (import.meta.env.PROD) {
      // Producción: registrar SW para cache-first en assets y offline fallback
      navigator.serviceWorker.register('/sw.js').catch(() => {
        // SW no disponible (navegador restringido) — funciona sin caché offline
      });
    } else {
      // Desarrollo: limpiar SWs y caché para evitar problemas de caché obsoleta
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        registrations.forEach((r) => r.unregister());
      });
      if ('caches' in window) {
        caches.keys().then((names) => names.forEach((name) => caches.delete(name)));
      }
    }
  });
}
