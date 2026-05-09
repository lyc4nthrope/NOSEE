/**
 * Metrics Service para NØSEE — Integración con Prometheus
 *
 * Envía eventos al metrics-server (Node.js/Express) que los expone en
 * formato Prometheus para ser visualizados en Grafana.
 *
 * Métricas alineadas al Plan de Gestión de Calidad (ISO/IEC 25010).
 * Nombres de contadores alineados con las queries definidas en §4 RNF.
 *
 * Configuración requerida en .env:
 *   VITE_METRICS_SERVER_URL=http://localhost:3001
 *
 * Iniciar el servidor: cd monitoring && docker compose up
 */

const METRICS_URL = import.meta.env.VITE_METRICS_SERVER_URL;
const IS_ENABLED = !!METRICS_URL;
const IS_DEV = import.meta.env.DEV;

async function push(event, data = {}) {
  if (!IS_ENABLED) {
    if (IS_DEV) {
      console.info('%c[Metrics]', 'color: #10b981; font-weight: bold', event, data);
    }
    return;
  }
  try {
    await fetch(`${METRICS_URL}/api/metrics`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event, data }),
      keepalive: true,
    });
  } catch {
    // Las métricas son best-effort: no bloquear la UX por fallos de red
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PROCESO 1 — Gestión de Usuario y Autenticación
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Métricas: Tasa de éxito de login + logins fallidos + latencia JWT
 * RNF 4.1.1 — nosee_auth_login_success_total
 *             nosee_auth_login_attempts_total{result="valid_credentials"|"invalid_credentials"}
 * RNF 4.1.2 — nosee_auth_login_failed_total{reason="invalid_credentials"}
 * RNF 4.4.1 — nosee_auth_login_duration_ms (meta: <800ms)
 *
 * @param {'success'|'failure'} result
 * @param {number} durationMs - Tiempo de respuesta del servidor Auth
 * @param {string} [failureReason] - Razón del fallo (ej: 'invalid_credentials')
 */
export function recordLoginAttempt(result, durationMs, failureReason = 'invalid_credentials') {
  push('login_attempt', { result, duration_ms: durationMs, failure_reason: failureReason });
}

/**
 * Vista de pantalla de login.
 * RNF 4.3.3 — nosee_login_page_views_total (denominador para tasa de abandono)
 * Llamar cuando se monta LoginPage.
 */
export function recordLoginPageView() {
  push('login_page_view', {});
}

/**
 * Abandono de la pantalla de login.
 * RNF 4.3.3 — nosee_login_abandoned_total (meta: <5% de vistas)
 * Llamar cuando el usuario abandona LoginPage sin completar login.
 */
export function recordLoginAbandon() {
  push('login_abandon', {});
}

/**
 * Tiempo promedio de registro.
 * RNF 3.4.1 — nosee_auth_register_duration_seconds (meta: <45s)
 *
 * @param {number} durationSeconds
 */
export function recordRegisterDuration(durationSeconds) {
  push('register_duration', { duration_seconds: durationSeconds });
}

/**
 * Inicio del flujo de registro.
 * RNF 4.3.1 — nosee_registration_started_total (denominador para conversión)
 * Llamar cuando se monta RegisterPage.
 */
export function recordRegistrationStarted() {
  push('registration_started', {});
}

/**
 * Registro completado exitosamente.
 * RNF 4.3.1 — nosee_registration_completed_total
 * Meta: nosee_registration_completed_total / nosee_registration_started_total >= 0.80
 * Llamar cuando el usuario confirma la cuenta en Supabase Auth.
 */
export function recordRegistrationCompleted() {
  push('registration_completed', {});
}

/**
 * Error en la asignación de rol (acceso a ruta no permitida).
 * RNF 4.1.5 — nosee_role_assignment_error_total (meta: 0)
 * Llamar cuando ProtectedRoute detecta rol incorrecto.
 *
 * @param {string} expectedRole
 * @param {string} assignedRole
 */
export function recordRoleError(expectedRole, assignedRole) {
  push('role_error', { expected_role: expectedRole, assigned_role: assignedRole });
}

/**
 * Asignación de rol exitosa a un usuario.
 * RNF 4.1.5 — nosee_role_assignment_total{role}
 * Llamar cuando el sistema asigna o cambia el rol de un usuario.
 *
 * @param {string} role - Rol asignado ('moderador', 'repartidor', 'admin', 'usuario')
 */
export function recordRoleAssignment(role) {
  push('role_assignment', { role });
}

/**
 * Inicio del flujo de recuperación de contraseña.
 * RNF 4.2.5 — nosee_password_reset_initiated_total (denominador)
 * Llamar cuando el usuario solicita el email de recuperación.
 */
export function recordPasswordResetInitiated() {
  push('password_reset_initiated', {});
}

/**
 * Resultado del flujo de recuperación de contraseña.
 * RNF 4.2.5 — nosee_password_reset_completed_total
 * Meta: nosee_password_reset_completed_total / nosee_password_reset_initiated_total >= 0.95
 * Llamar al completar (o fallar) el cambio de contraseña.
 *
 * @param {'success'|'failure'} result
 */
export function recordPasswordResetCompleted(result) {
  push('password_reset_completed', { result });
}

// ─────────────────────────────────────────────────────────────────────────────
// PROCESO 2 — Gestión de Publicaciones de Precios
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Intento de crear publicación (antes del resultado).
 * RNF 4.1.3 — nosee_publications_attempted_total (denominador)
 * Meta: nosee_publications_created_total / nosee_publications_attempted_total >= 0.95
 * Llamar justo antes de enviar el formulario a Supabase.
 */
export function recordPublicationAttempted() {
  push('publication_attempted', {});
}

/**
 * Publicación de precio creada exitosamente.
 * RNF 4.1.3 — nosee_publications_created_total
 * RNF 4.3.4 — nosee_publications_with_photo_total (meta: >60% del total)
 *
 * @param {boolean} hasPhoto
 */
export function recordPublicationCreated(hasPhoto) {
  push('publication_created', { has_photo: hasPhoto });
}

/**
 * Voto registrado en una publicación.
 * RNF 4.3.2 — nosee_publications_votes_total (meta upvote ratio: >85%)
 *
 * @param {'upvote'|'downvote'} voteType
 */
export function recordVote(voteType) {
  push('vote', { vote_type: voteType });
}

/**
 * Intento de voto (antes de verificar duplicado).
 * RNF 4.1.4 — nosee_votes_duplicate_attempted_total (denominador)
 * Meta: nosee_votes_duplicate_rejected_total / nosee_votes_duplicate_attempted_total = 1.0
 * Llamar al inicio de la función de voto, antes de la verificación.
 */
export function recordVoteDuplicateAttempted() {
  push('vote_duplicate_attempted', {});
}

/**
 * Intento de voto duplicado bloqueado.
 * RNF 4.1.4 — nosee_votes_duplicate_rejected_total
 * Llamar cuando se detecta y bloquea un voto duplicado.
 */
export function recordVoteDuplicateRejected() {
  push('vote_duplicate_rejected', {});
}

/**
 * Publicación reportada por un usuario.
 * RNF 3.4.2 — nosee_publications_reports_total (meta: <5% de activas)
 */
export function recordPublicationReport() {
  push('publication_report', {});
}

/**
 * Latencia de carga de publicaciones.
 * RNF 4.4.2 — nosee_api_request_duration_ms (meta: <3 000 ms)
 *
 * @param {string} endpoint - Identificador del endpoint (ej: 'publications_list')
 * @param {number} durationMs
 */
export function recordApiLatency(endpoint, durationMs) {
  push('api_latency', { endpoint, duration_ms: durationMs });
}

/**
 * Latencia de una query a Supabase.
 * RNF 4.2.4 — nosee_db_query_duration_seconds (meta P95: <=500ms)
 * Llamar alrededor de cada llamada a supabase desde src/services/api/.
 *
 * @param {string} endpoint - Identificador de la query (ej: 'publications_list', 'auth_login')
 * @param {number} durationSeconds - Duración en segundos
 */
export function recordDbQueryDuration(endpoint, durationSeconds) {
  push('db_query_duration', { endpoint, duration_seconds: durationSeconds });
}

// ─────────────────────────────────────────────────────────────────────────────
// CLOUDINARY — Subida de imágenes de evidencia
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Resultado de subida de imagen a Cloudinary.
 * RNF 4.2.3 — nosee_cloudinary_upload_total + nosee_cloudinary_upload_error_total
 * Meta: nosee_cloudinary_upload_error_total / nosee_cloudinary_upload_total < 0.01
 *
 * @param {'success'|'failure'} result
 * @param {number} [sizeBytes]
 */
export function recordCloudinaryUpload(result, sizeBytes) {
  push('cloudinary_upload', { result, size_bytes: sizeBytes ?? 0 });
}

// ─────────────────────────────────────────────────────────────────────────────
// TOKEN REFRESH — Renovación de sesión JWT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Resultado de renovación de token JWT.
 * RNF 4.2.2 — nosee_token_refresh_success_total + nosee_token_refresh_attempted_total
 * Meta: nosee_token_refresh_success_total / nosee_token_refresh_attempted_total >= 0.99
 *
 * @param {'success'|'failure'} result
 */
export function recordTokenRefresh(result) {
  push('token_refresh', { result });
}

// ─────────────────────────────────────────────────────────────────────────────
// FORMULARIOS — Inicio y abandono
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Inicio del flujo de publicación.
 * RNF 4.3.2 — nosee_publication_form_started_total (denominador para tasa de abandono)
 * Llamar cuando se monta PublicationForm en modo 'create'.
 */
export function recordPublicationFormStarted() {
  push('publication_form_started', {});
}

/**
 * Abandono del formulario de publicación.
 * RNF 4.3.2 — nosee_publication_form_abandoned_total (meta: <30% de iniciados)
 * Llamar cuando el usuario desmonta el formulario sin completar la publicación.
 */
export function recordPublicationFormAbandoned() {
  push('publication_form_abandoned', {});
}

// ─────────────────────────────────────────────────────────────────────────────
// GEOCODIFICACIÓN — Nominatim
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Petición de geocodificación y su resultado.
 * RNF 4.5.4 — nosee_geocoding_requests_total (disponibilidad geocoder > 99.5%)
 *
 * @param {'success'|'failure'} result
 * @param {'reverse'|'forward'} [type]
 */
export function recordGeocodingRequest(result, type = 'reverse') {
  push('geocoding_request', { result, type });
}

// ─────────────────────────────────────────────────────────────────────────────
// VOTOS — Latencia de procesamiento
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Duración completa del procesamiento de un voto.
 * RNF 4.4.3 — nosee_vote_processing_duration_seconds (meta P95: <1s)
 * Llamar al finalizar validatePublication() con éxito o fallo de BD.
 *
 * @param {number} durationMs
 */
export function recordVoteProcessingDuration(durationMs) {
  push('vote_processing_duration', { duration_ms: durationMs });
}

// ─────────────────────────────────────────────────────────────────────────────
// PROCESO 3 — Gestión de Pedido, Optimización de Compra y Ubicación
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Inicio del flujo de pedido.
 * RNF 4.1.6 / 4.3.6 — nosee_shopping_list_order_started_total (denominador)
 * Llamar cuando el usuario navega a CreateOrderPage con ítems seleccionados.
 *
 * @param {number} itemCount - Cantidad de ítems seleccionados
 */
export function recordShoppingListOrderStarted(itemCount) {
  push('shopping_list_order_started', { item_count: itemCount });
}

/**
 * Abandono del flujo de pedido.
 * RNF 4.3.6 — nosee_shopping_list_order_abandoned_total (meta: <20% de iniciados)
 * Llamar cuando el usuario abandona CreateOrderPage sin confirmar.
 */
export function recordShoppingListOrderAbandoned() {
  push('shopping_list_order_abandoned', {});
}

/**
 * Ejecución del motor de optimización.
 * RNF 4.1.7 — nosee_orders_optimization_total{strategy}
 * RNF 4.4.6 — nosee_orders_optimization_duration_ms (meta: <5000ms)
 * RNF 4.1.8 — nosee_orders_no_results_items_total (meta: 0)
 *
 * @param {'price'|'fewest_stores'|'balanced'} strategy
 * @param {number} durationMs
 * @param {number} noResultCount
 */
export function recordOptimizationRun(strategy, durationMs, noResultCount) {
  push('optimization_run', {
    strategy,
    duration_ms: durationMs,
    no_result_count: noResultCount,
  });
}

/**
 * Pedido confirmado por el usuario.
 * RNF 4.1.6 — nosee_orders_created_total{strategy, delivery_mode}
 * RNF 4.1.9 — nosee_orders_savings_percent (meta mediana: >5%)
 *
 * @param {'price'|'fewest_stores'|'balanced'} strategy
 * @param {boolean} deliveryMode - true = domicilio, false = recogida propia
 * @param {number} totalCost
 * @param {number} savingsPct
 */
export function recordOrderConfirmed(strategy, deliveryMode, totalCost, savingsPct) {
  push('order_confirmed', {
    strategy,
    delivery_mode: deliveryMode ? 'delivery' : 'pickup',
    total_cost: totalCost,
    savings_pct: savingsPct,
  });
}
