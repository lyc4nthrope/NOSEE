/**
 * NØSEE Metrics Server
 *
 * Colector de métricas para Prometheus.
 * Recibe eventos del frontend via POST /api/metrics y los expone
 * en formato Prometheus en GET /metrics para ser scrapeados.
 *
 * Métricas implementadas según Plan de Gestión de Calidad (ISO/IEC 25010).
 * Nombres de contadores alineados con las queries PromQL definidas en §4 RNF.
 *
 * Proceso 1 — Gestión de Usuario y Autenticación
 *   nosee_auth_login_success_total              (RNF 4.1.1 — meta: >99.5%)
 *   nosee_auth_login_attempts_total{result}     (RNF 4.1.1 — denominador)
 *   nosee_auth_login_failed_total{reason}       (RNF 4.1.2 — meta: reason="invalid_credentials" → alerta)
 *   nosee_auth_login_duration_ms                (RNF 4.4.1 — meta P95: <800ms)
 *   nosee_login_page_views_total                (RNF 4.3.3 — denominador abandono login)
 *   nosee_login_abandoned_total                 (RNF 4.3.3 — meta: <5% de vistas)
 *   nosee_auth_register_duration_seconds        (§3.4.1 — meta: <45s)
 *   nosee_role_assignment_total{role}           (RNF 4.1.5 — total asignaciones por rol)
 *   nosee_role_assignment_error_total           (RNF 4.1.5 — meta: 0)
 *   nosee_token_refresh_attempted_total         (RNF 4.2.2 — denominador refresh)
 *   nosee_token_refresh_success_total           (RNF 4.2.2 — meta: >=99%)
 *   nosee_password_reset_initiated_total        (RNF 4.2.5 — denominador)
 *   nosee_password_reset_completed_total        (RNF 4.2.5 — meta: >=95%)
 *   nosee_registration_started_total            (RNF 4.3.1 — denominador conversión)
 *   nosee_registration_completed_total          (RNF 4.3.1 — meta: >=80%)
 *
 * Proceso 2 — Gestión de Publicaciones de Precios
 *   nosee_publications_attempted_total          (RNF 4.1.3 — denominador)
 *   nosee_publications_created_total            (RNF 4.1.3 — meta: >=95% de attempted)
 *   nosee_publications_with_photo_total         (RNF 4.3.4 — meta: >60% del total)
 *   nosee_publications_evidence_ratio           (gauge, meta: >0.60)
 *   nosee_publications_votes_total{type}        (meta upvote ratio: >85%)
 *   nosee_publications_upvote_ratio             (gauge, meta: >0.85)
 *   nosee_publications_reports_total            (meta: <5% de activas)
 *   nosee_votes_duplicate_attempted_total       (RNF 4.1.4 — denominador)
 *   nosee_votes_duplicate_rejected_total        (RNF 4.1.4 — meta: = attempted → ratio 1.0)
 *   nosee_votes_duplicate_passed_total          (RNF 4.1.4 — meta: 0)
 *   nosee_publication_form_started_total        (RNF 4.3.2 — denominador abandono formulario)
 *   nosee_publication_form_abandoned_total      (RNF 4.3.2 — meta: <30% de started)
 *   nosee_cloudinary_upload_total               (RNF 4.2.3 — denominador)
 *   nosee_cloudinary_upload_success_total       (RNF 4.2.3 — numerador ratio éxito)
 *   nosee_cloudinary_upload_error_total         (RNF 4.2.3 — meta: <1% del total)
 *   nosee_geocoding_requests_total{result,type} (RNF 4.5.4 — todas las peticiones)
 *   nosee_geocoding_failed_total                (RNF 4.5.4 — fallos Nominatim)
 *   nosee_geocoding_fallback_activated_total    (RNF 4.5.4 — activaciones de mapa fallback)
 *
 * Rendimiento / Transversal
 *   nosee_vote_processing_duration_seconds      (RNF 4.4.3 — meta P95: <1s)
 *
 * Proceso 3 — Gestión de Pedido, Optimización de Compra y Ubicación
 *   nosee_shopping_list_order_started_total     (RNF 4.3.6 — denominador)
 *   nosee_shopping_list_order_abandoned_total   (RNF 4.3.6 — meta: <20% de iniciados)
 *   nosee_orders_created_total{strategy,delivery_mode} (RNF 4.1.6)
 *   nosee_orders_optimization_total{strategy}   (RNF 4.1.7)
 *   nosee_orders_optimization_duration_ms       (RNF 4.4.6 — meta P95: <5000ms)
 *   nosee_orders_no_results_items_total         (RNF 4.1.8 — meta: 0)
 *   nosee_orders_savings_percent                (RNF 4.1.9 — meta mediana P50: >5%)
 *
 * Rendimiento / Transversal
 *   nosee_api_request_duration_ms{endpoint}     (RNF 4.4.2 — meta P95: <3000ms)
 *   nosee_db_query_duration_seconds{endpoint}   (RNF 4.2.4 — meta P95: <=500ms)
 */

import express from 'express';
import cors from 'cors';
import {
  Registry,
  collectDefaultMetrics,
  Counter,
  Histogram,
  Gauge,
} from 'prom-client';

const register = new Registry();
register.setDefaultLabels({ app: 'nosee', env: process.env.NODE_ENV ?? 'development' });

collectDefaultMetrics({ register });

// ─────────────────────────────────────────────────────────────────────────────
// PROCESO 1 — Autenticación
// ─────────────────────────────────────────────────────────────────────────────

// RNF 4.1.1: nosee_auth_login_success_total / nosee_auth_login_attempts_total{result="valid_credentials"} >= 0.995
const loginSuccessTotal = new Counter({
  name: 'nosee_auth_login_success_total',
  help: 'Logins técnicamente exitosos (credenciales válidas + sin error de servidor).',
  registers: [register],
});

const loginAttemptsTotal = new Counter({
  name: 'nosee_auth_login_attempts_total',
  help: 'Total de intentos de login clasificados por resultado de credencial.',
  labelNames: ['result'], // "valid_credentials" | "invalid_credentials"
  registers: [register],
});

// RNF 4.1.2: nosee_auth_login_failed_total{reason="invalid_credentials"} — alerta si >5 en 5min desde misma IP
const loginFailedTotal = new Counter({
  name: 'nosee_auth_login_failed_total',
  help: 'Logins fallidos clasificados por razón. Meta: detectar patrones de fuerza bruta.',
  labelNames: ['reason'], // "invalid_credentials" | "server_error"
  registers: [register],
});

// RNF 4.4.1: histogram_quantile(0.95, rate(nosee_auth_login_duration_ms_bucket[5m])) <= 800
const loginDurationMs = new Histogram({
  name: 'nosee_auth_login_duration_ms',
  help: 'Tiempo de respuesta del servicio de autenticación en ms (meta P95: <800ms)',
  buckets: [100, 200, 400, 600, 800, 1000, 1500, 2000, 3000],
  registers: [register],
});

// RNF 4.3.3: nosee_login_abandoned_total / nosee_login_page_views_total < 0.05
const loginPageViewsTotal = new Counter({
  name: 'nosee_login_page_views_total',
  help: 'Vistas de la pantalla de login (denominador para tasa de abandono).',
  registers: [register],
});

const loginAbandonedTotal = new Counter({
  name: 'nosee_login_abandoned_total',
  help: 'Usuarios que abren login pero no completan el proceso (meta: <5% de vistas).',
  registers: [register],
});

const registerDurationSeconds = new Histogram({
  name: 'nosee_auth_register_duration_seconds',
  help: 'Duración del flujo de registro desde apertura del formulario (meta: <45s)',
  buckets: [10, 20, 30, 45, 60, 90, 120, 180, 300],
  registers: [register],
});

// RNF 4.1.5: nosee_role_assignment_total{role} — denominador; nosee_role_assignment_error_total = 0
const roleAssignmentTotal = new Counter({
  name: 'nosee_role_assignment_total',
  help: 'Asignaciones de rol completadas por tipo de rol.',
  labelNames: ['role'], // "moderador" | "repartidor" | "admin" | "usuario"
  registers: [register],
});

const roleAssignmentErrorTotal = new Counter({
  name: 'nosee_role_assignment_error_total',
  help: 'Errores en asignación de roles (acceso a ruta no permitida). Meta: 0.',
  registers: [register],
});

// RNF 4.2.2: nosee_token_refresh_success_total / nosee_token_refresh_attempted_total >= 0.99
const tokenRefreshAttemptedTotal = new Counter({
  name: 'nosee_token_refresh_attempted_total',
  help: 'Total de intentos de renovación de token JWT (denominador).',
  registers: [register],
});

const tokenRefreshSuccessTotal = new Counter({
  name: 'nosee_token_refresh_success_total',
  help: 'Renovaciones de token JWT exitosas (meta: >=99% de attempted).',
  registers: [register],
});

// RNF 4.2.5: nosee_password_reset_completed_total / nosee_password_reset_initiated_total >= 0.95
const passwordResetInitiatedTotal = new Counter({
  name: 'nosee_password_reset_initiated_total',
  help: 'Solicitudes de recuperación de contraseña iniciadas (denominador).',
  registers: [register],
});

const passwordResetCompletedTotal = new Counter({
  name: 'nosee_password_reset_completed_total',
  help: 'Flujos de recuperación de contraseña completados exitosamente (meta: >=95%).',
  registers: [register],
});

// RNF 4.3.1: nosee_registration_completed_total / nosee_registration_started_total >= 0.80
const registrationStartedTotal = new Counter({
  name: 'nosee_registration_started_total',
  help: 'Usuarios que abren el formulario de registro (denominador para conversión).',
  registers: [register],
});

const registrationCompletedTotal = new Counter({
  name: 'nosee_registration_completed_total',
  help: 'Usuarios que completan el registro y confirman la cuenta (meta: >=80% de started).',
  registers: [register],
});

// ─────────────────────────────────────────────────────────────────────────────
// PROCESO 2 — Publicaciones
// ─────────────────────────────────────────────────────────────────────────────

// RNF 4.1.3: nosee_publications_created_total / nosee_publications_attempted_total >= 0.95
const publicationsAttemptedTotal = new Counter({
  name: 'nosee_publications_attempted_total',
  help: 'Intentos de publicación de precio (denominador para tasa de éxito).',
  registers: [register],
});

const publicationsCreatedTotal = new Counter({
  name: 'nosee_publications_created_total',
  help: 'Publicaciones de precio creadas exitosamente (meta: >=95% de attempted).',
  registers: [register],
});

// RNF 4.3.4: nosee_publications_with_photo_total / nosee_publications_created_total >= 0.60
const publicationsWithPhotoTotal = new Counter({
  name: 'nosee_publications_with_photo_total',
  help: 'Publicaciones creadas con foto de evidencia (meta: >60% del total).',
  registers: [register],
});

const evidenceRatioGauge = new Gauge({
  name: 'nosee_publications_evidence_ratio',
  help: 'Proporción de publicaciones con imagen de evidencia (meta: >0.60).',
  registers: [register],
});

const votesTotal = new Counter({
  name: 'nosee_publications_votes_total',
  help: 'Total de votos en publicaciones.',
  labelNames: ['type'], // "upvote" | "downvote"
  registers: [register],
});

const upvoteRatioGauge = new Gauge({
  name: 'nosee_publications_upvote_ratio',
  help: 'Proporción de upvotes sobre total de votos — Índice de Veracidad (meta: >0.85).',
  registers: [register],
});

const publicationReportsTotal = new Counter({
  name: 'nosee_publications_reports_total',
  help: 'Publicaciones reportadas por usuarios (meta: <5% de activas).',
  registers: [register],
});

// RNF 4.3.2: nosee_publication_form_abandoned_total / nosee_publication_form_started_total < 0.30
const publicationFormStartedTotal = new Counter({
  name: 'nosee_publication_form_started_total',
  help: 'Usuarios que abren el formulario de publicación en modo creación (denominador).',
  registers: [register],
});

const publicationFormAbandonedTotal = new Counter({
  name: 'nosee_publication_form_abandoned_total',
  help: 'Usuarios que cierran el formulario sin completar la publicación (meta: <30% de started).',
  registers: [register],
});

// RNF 4.1.4: nosee_votes_duplicate_rejected_total / nosee_votes_duplicate_attempted_total = 1.0
//            nosee_votes_duplicate_passed_total > 0 → alerta inmediata
const votesDuplicateAttemptedTotal = new Counter({
  name: 'nosee_votes_duplicate_attempted_total',
  help: 'Intentos de voto donde el usuario ya había votado antes (denominador).',
  registers: [register],
});

const votesDuplicateRejectedTotal = new Counter({
  name: 'nosee_votes_duplicate_rejected_total',
  help: 'Votos duplicados detectados y bloqueados (meta: = attempted → ratio 1.0).',
  registers: [register],
});

const votesDuplicatePassedTotal = new Counter({
  name: 'nosee_votes_duplicate_passed_total',
  help: 'Votos duplicados que pasaron el filtro — NO debe ser mayor a 0.',
  registers: [register],
});

// RNF 4.2.3: nosee_cloudinary_upload_error_total / nosee_cloudinary_upload_total < 0.01
const cloudinaryUploadTotal = new Counter({
  name: 'nosee_cloudinary_upload_total',
  help: 'Total de subidas de imagen a Cloudinary (denominador para tasa de error).',
  registers: [register],
});

const cloudinaryUploadSuccessTotal = new Counter({
  name: 'nosee_cloudinary_upload_success_total',
  help: 'Subidas de imagen exitosas (numerador para ratio de éxito).',
  registers: [register],
});

const cloudinaryUploadErrorTotal = new Counter({
  name: 'nosee_cloudinary_upload_error_total',
  help: 'Subidas de imagen fallidas (meta: <1% del total).',
  registers: [register],
});

const imageUploadSizeBytes = new Histogram({
  name: 'nosee_image_upload_size_bytes',
  help: 'Tamaño de imágenes subidas en bytes (meta: ≤5MB).',
  buckets: [50000, 200000, 500000, 1000000, 2000000, 5000000, 10000000],
  registers: [register],
});

const geocodingRequestsTotal = new Counter({
  name: 'nosee_geocoding_requests_total',
  help: 'Peticiones totales a Nominatim (reverse + forward geocoding).',
  labelNames: ['result', 'type'],
  registers: [register],
});

// RNF 4.5.4: nosee_geocoding_failed_total alerta si tasa > 0.5% — mapa siempre disponible como fallback
const geocodingFailedTotal = new Counter({
  name: 'nosee_geocoding_failed_total',
  help: 'Peticiones de geocodificación que fallaron (Nominatim no respondió o devolvió error).',
  registers: [register],
});

const geocodingFallbackActivatedTotal = new Counter({
  name: 'nosee_geocoding_fallback_activated_total',
  help: 'Activaciones del mapa interactivo como fallback ante fallo de geocodificación.',
  registers: [register],
});

// ─────────────────────────────────────────────────────────────────────────────
// PROCESO 3 — Gestión de Pedido, Optimización de Compra y Ubicación
// ─────────────────────────────────────────────────────────────────────────────

// RNF 4.3.6: nosee_shopping_list_order_abandoned_total / nosee_shopping_list_order_started_total < 0.20
const shoppingListOrderStartedTotal = new Counter({
  name: 'nosee_shopping_list_order_started_total',
  help: 'Usuarios que inician el flujo de creación de pedido (denominador).',
  registers: [register],
});

const shoppingListOrderAbandonedTotal = new Counter({
  name: 'nosee_shopping_list_order_abandoned_total',
  help: 'Usuarios que abandonan CreateOrderPage sin confirmar (meta: <20% de iniciados).',
  registers: [register],
});

// RNF 4.1.6: sum(nosee_orders_created_total) incrementa 1 por cada confirmación
const ordersCreatedTotal = new Counter({
  name: 'nosee_orders_created_total',
  help: 'Pedidos confirmados por el usuario.',
  labelNames: ['strategy', 'delivery_mode'],
  registers: [register],
});

// RNF 4.1.7: nosee_orders_optimization_total{strategy="balanced"} / sum(nosee_orders_optimization_total) >= 0.40
const ordersOptimizationTotal = new Counter({
  name: 'nosee_orders_optimization_total',
  help: 'Ejecuciones del motor de optimización por estrategia.',
  labelNames: ['strategy'], // "price" | "fewest_stores" | "balanced"
  registers: [register],
});

// RNF 4.4.6: histogram_quantile(0.95, rate(nosee_orders_optimization_duration_ms_bucket[5m])) <= 5000
const ordersOptimizationDurationMs = new Histogram({
  name: 'nosee_orders_optimization_duration_ms',
  help: 'Duración del cálculo de optimización en ms (meta P95: <5000ms).',
  buckets: [200, 500, 1000, 2000, 3000, 5000, 8000, 15000],
  registers: [register],
});

// RNF 4.1.8: increase(nosee_orders_no_results_items_total[24h]) <= 10
const ordersNoResultItemsTotal = new Counter({
  name: 'nosee_orders_no_results_items_total',
  help: 'Ítems sin publicaciones encontradas en el área (meta: tendencia a 0).',
  registers: [register],
});

// RNF 4.1.9: histogram_quantile(0.50, rate(nosee_orders_savings_percent_bucket[7d])) >= 5
const ordersSavingsPct = new Histogram({
  name: 'nosee_orders_savings_percent',
  help: 'Porcentaje de ahorro por pedido respecto al precio máximo (meta mediana P50: >5%).',
  buckets: [0, 5, 10, 15, 20, 30, 40, 50, 60, 75, 100],
  registers: [register],
});

// ─────────────────────────────────────────────────────────────────────────────
// RENDIMIENTO / TRANSVERSAL
// ─────────────────────────────────────────────────────────────────────────────

// RNF 4.4.2: histogram_quantile(0.95, rate(nosee_api_request_duration_ms_bucket[5m])) <= 3000
const apiLatencyMs = new Histogram({
  name: 'nosee_api_request_duration_ms',
  help: 'Latencia de peticiones a la API en ms (meta P95: <3000ms).',
  labelNames: ['endpoint'],
  buckets: [100, 300, 500, 1000, 2000, 3000, 5000, 10000],
  registers: [register],
});

// RNF 4.2.4: histogram_quantile(0.95, rate(nosee_db_query_duration_seconds_bucket[5m])) <= 0.5
const dbQueryDurationSeconds = new Histogram({
  name: 'nosee_db_query_duration_seconds',
  help: 'Latencia de queries a Supabase en segundos (meta P95: <=500ms = 0.5s).',
  labelNames: ['endpoint'],
  buckets: [0.05, 0.1, 0.2, 0.3, 0.5, 0.75, 1.0, 2.0, 5.0],
  registers: [register],
});

// RNF 4.4.3: histogram_quantile(0.95, rate(nosee_vote_processing_duration_seconds_bucket[5m])) <= 1
const voteProcessingDurationSeconds = new Histogram({
  name: 'nosee_vote_processing_duration_seconds',
  help: 'Tiempo total de procesamiento de un voto incluyendo validación y escritura en BD (meta P95: <1s).',
  buckets: [0.1, 0.2, 0.3, 0.5, 0.75, 1.0, 1.5, 2.0, 3.0],
  registers: [register],
});

// ─────────────────────────────────────────────────────────────────────────────
// Estado en memoria para calcular ratios dinámicos (gauges)
// ─────────────────────────────────────────────────────────────────────────────

const state = {
  totalPublications: 0,
  publicationsWithPhoto: 0,
  totalVotes: 0,
  upvotes: 0,
};

function updateEvidenceRatio() {
  if (state.totalPublications > 0) {
    evidenceRatioGauge.set(state.publicationsWithPhoto / state.totalPublications);
  }
}

function updateUpvoteRatio() {
  if (state.totalVotes > 0) {
    upvoteRatioGauge.set(state.upvotes / state.totalVotes);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Servidor Express
// ─────────────────────────────────────────────────────────────────────────────

const app = express();
app.use(cors());
app.use(express.json());

/**
 * POST /api/metrics
 * Body: { event: string, data: object }
 */
app.post('/api/metrics', (req, res) => {
  const { event, data = {} } = req.body ?? {};

  if (!event) {
    return res.status(400).json({ error: 'Campo "event" requerido' });
  }

  switch (event) {

    // ── Auth — Login ──────────────────────────────────────────────────────────
    case 'login_attempt': {
      const success = data.result === 'success';
      if (success) {
        // RNF 4.1.1 — login válido y técnicamente exitoso
        loginSuccessTotal.inc();
        loginAttemptsTotal.inc({ result: 'valid_credentials' });
      } else {
        // RNF 4.1.2 — login fallido
        const reason = data.failure_reason ?? 'invalid_credentials';
        loginFailedTotal.inc({ reason });
        loginAttemptsTotal.inc({ result: 'invalid_credentials' });
      }
      if (typeof data.duration_ms === 'number') {
        loginDurationMs.observe(data.duration_ms);
      }
      break;
    }

    case 'login_page_view':
      loginPageViewsTotal.inc();
      break;

    case 'login_abandon':
      loginAbandonedTotal.inc();
      break;

    // ── Auth — Registro ───────────────────────────────────────────────────────
    case 'register_duration':
      if (typeof data.duration_seconds === 'number') {
        registerDurationSeconds.observe(data.duration_seconds);
      }
      break;

    case 'registration_started':
      registrationStartedTotal.inc();
      break;

    case 'registration_completed':
      registrationCompletedTotal.inc();
      break;

    // ── Auth — Roles ──────────────────────────────────────────────────────────
    case 'role_assignment':
      roleAssignmentTotal.inc({ role: data.role ?? 'unknown' });
      break;

    case 'role_error':
      roleAssignmentErrorTotal.inc();
      break;

    // ── Auth — Token & Password ───────────────────────────────────────────────
    case 'token_refresh': {
      tokenRefreshAttemptedTotal.inc();
      if (data.result === 'success') {
        tokenRefreshSuccessTotal.inc();
      }
      break;
    }

    case 'password_reset_initiated':
      passwordResetInitiatedTotal.inc();
      break;

    case 'password_reset_completed':
      if (data.result === 'success') {
        passwordResetCompletedTotal.inc();
      }
      break;

    // ── Publicaciones ─────────────────────────────────────────────────────────
    case 'publication_attempted':
      publicationsAttemptedTotal.inc();
      break;

    case 'publication_created':
      publicationsCreatedTotal.inc();
      state.totalPublications++;
      if (data.has_photo === true) {
        publicationsWithPhotoTotal.inc();
        state.publicationsWithPhoto++;
      }
      updateEvidenceRatio();
      break;

    case 'vote': {
      const voteType = data.vote_type === 'upvote' ? 'upvote' : 'downvote';
      votesTotal.inc({ type: voteType });
      state.totalVotes++;
      if (voteType === 'upvote') state.upvotes++;
      updateUpvoteRatio();
      break;
    }

    case 'vote_duplicate_attempted':
      votesDuplicateAttemptedTotal.inc();
      break;

    case 'vote_duplicate_rejected':
      votesDuplicateRejectedTotal.inc();
      break;

    case 'vote_duplicate_passed':
      // No debe ocurrir — si llega aquí es un bug de integridad
      votesDuplicatePassedTotal.inc();
      break;

    case 'publication_report':
      publicationReportsTotal.inc();
      break;

    case 'publication_form_started':
      publicationFormStartedTotal.inc();
      break;

    case 'publication_form_abandoned':
      publicationFormAbandonedTotal.inc();
      break;

    // ── Cloudinary ────────────────────────────────────────────────────────────
    case 'cloudinary_upload': {
      cloudinaryUploadTotal.inc();
      if (data.result === 'success') {
        cloudinaryUploadSuccessTotal.inc();
      } else {
        cloudinaryUploadErrorTotal.inc();
      }
      if (typeof data.size_bytes === 'number' && data.size_bytes > 0) {
        imageUploadSizeBytes.observe(data.size_bytes);
      }
      break;
    }

    // ── Geocodificación ───────────────────────────────────────────────────────
    case 'geocoding_request': {
      const geoResult = data.result === 'success' ? 'success' : 'failure';
      geocodingRequestsTotal.inc({
        result: geoResult,
        type: data.type === 'forward' ? 'forward' : 'reverse',
      });
      if (geoResult === 'failure') {
        geocodingFailedTotal.inc();
        geocodingFallbackActivatedTotal.inc();
      }
      break;
    }

    // ── Proceso 3 ─────────────────────────────────────────────────────────────
    case 'shopping_list_order_started':
      shoppingListOrderStartedTotal.inc();
      break;

    case 'shopping_list_order_abandoned':
      shoppingListOrderAbandonedTotal.inc();
      break;

    case 'optimization_run': {
      const strat = ['price', 'fewest_stores', 'balanced'].includes(data.strategy)
        ? data.strategy : 'unknown';
      ordersOptimizationTotal.inc({ strategy: strat });
      if (typeof data.duration_ms === 'number') {
        ordersOptimizationDurationMs.observe(data.duration_ms);
      }
      if (typeof data.no_result_count === 'number' && data.no_result_count > 0) {
        ordersNoResultItemsTotal.inc(data.no_result_count);
      }
      break;
    }

    case 'order_confirmed': {
      const strat = ['price', 'fewest_stores', 'balanced'].includes(data.strategy)
        ? data.strategy : 'unknown';
      const mode = data.delivery_mode === 'delivery' ? 'delivery' : 'pickup';
      ordersCreatedTotal.inc({ strategy: strat, delivery_mode: mode });
      if (typeof data.savings_pct === 'number') {
        ordersSavingsPct.observe(data.savings_pct);
      }
      break;
    }

    // ── Rendimiento ───────────────────────────────────────────────────────────
    case 'api_latency':
      if (typeof data.duration_ms === 'number') {
        apiLatencyMs.observe({ endpoint: data.endpoint ?? 'unknown' }, data.duration_ms);
      }
      break;

    case 'db_query_duration':
      if (typeof data.duration_seconds === 'number') {
        dbQueryDurationSeconds.observe({ endpoint: data.endpoint ?? 'unknown' }, data.duration_seconds);
      }
      break;

    case 'vote_processing_duration':
      if (typeof data.duration_ms === 'number') {
        voteProcessingDurationSeconds.observe(data.duration_ms / 1000);
      }
      break;

    default:
      break;
  }

  res.json({ ok: true });
});

/**
 * GET /metrics — Prometheus scrapea este endpoint cada 15s
 */
app.get('/metrics', async (_req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

/** GET /health — healthcheck de Docker */
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'nosee-metrics-server', uptime: process.uptime() });
});

const PORT = process.env.PORT ?? 3001;
app.listen(PORT, () => {
  console.log(`\n NØSEE Metrics Server corriendo en :${PORT}`);
  console.log(`   Prometheus → GET  http://localhost:${PORT}/metrics`);
  console.log(`   Eventos    → POST http://localhost:${PORT}/api/metrics`);
  console.log(`   Health     → GET  http://localhost:${PORT}/health\n`);
});
