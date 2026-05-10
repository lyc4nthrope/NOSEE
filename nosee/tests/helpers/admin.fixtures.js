/**
 * tests/helpers/admin.fixtures.js
 *
 * Data factories para tests del panel admin NØSEE.
 * Cada factory genera datos con valores por defecto válidos,
 * sobreescribibles vía parámetro `overrides`.
 */

export function createMockOverviewData(overrides = {}) {
  return {
    totalActiveUsers: 1250,
    totalUsers: 15420,
    publicationsToday: 342,
    totalPublications: 45200,
    activePublications: 38100,
    validationsToday: 567,
    pendingReports: 23,
    totalOrders: 8900,
    activeOrders: 320,
    activeStores: 450,
    activeProducts: 28000,
    activeDealers: 180,
    pendingDealerApplications: 12,
    loginsLast24h: 890,
    ...overrides,
  };
}

export function createMockReportsData(overrides = {}) {
  return {
    totalReports: 150,
    pendingBacklog: 23,
    resolvedCount: 120,
    breakdownByReason: {
      spam: 45,
      offensive: 30,
      fake_price: 55,
      wrong_photo: 20,
    },
    latestPendingReports: [
      {
        id: 'report-1',
        severity: 'alta',
        reported_type: 'publication',
        reason: 'spam',
        reported_id: 'pub-123',
        created_at: '2026-05-08T10:00:00Z',
      },
      {
        id: 'report-2',
        severity: 'media',
        reported_type: 'user',
        reason: 'offensive',
        reported_id: 'user-456',
        created_at: '2026-05-08T08:30:00Z',
      },
      {
        id: 'report-3',
        severity: 'baja',
        reported_type: 'store',
        reason: 'wrong_photo',
        reported_id: 'store-789',
        created_at: '2026-05-07T22:15:00Z',
      },
      {
        id: 'report-4',
        severity: 'alta',
        reported_type: 'publication',
        reason: 'fake_price',
        reported_id: 'pub-456',
        created_at: '2026-05-07T16:45:00Z',
      },
      {
        id: 'report-5',
        severity: 'media',
        reported_type: 'comment',
        reason: 'spam',
        reported_id: 'comment-111',
        created_at: '2026-05-07T14:00:00Z',
      },
    ],
    ...overrides,
  };
}

export function createMockLogsData(overrides = {}) {
  return {
    loginEvents24h: 890,
    loginEvents7d: 5200,
    activityEvents24h: 2340,
    activityEvents7d: 15000,
    adminEvents24h: 45,
    adminEvents7d: 310,
    latestEvents: [
      { source: 'login', event_id: 'evt-1', action: 'Inicio de sesión', created_at: '2026-05-09T08:30:00Z' },
      { source: 'activity', event_id: 'evt-2', action: 'Creó publicación', created_at: '2026-05-09T08:00:00Z' },
      { source: 'admin', event_id: 'evt-3', action: 'Baneó usuario', created_at: '2026-05-09T07:45:00Z' },
      { source: 'login', event_id: 'evt-4', action: 'Inicio de sesión', created_at: '2026-05-09T07:30:00Z' },
      { source: 'activity', event_id: 'evt-5', action: 'Editó tienda', created_at: '2026-05-09T07:00:00Z' },
    ],
    ...overrides,
  };
}

export function createMockReputationConfig(overrides = []) {
  if (overrides.length > 0) return overrides;
  return [
    { id: 1, param: 'Puntos por upvote recibido', value: '+5', note: 'Cuando otro usuario valida tu publicación', updated_at: '2026-01-01T00:00:00Z' },
    { id: 2, param: 'Puntos por downvote recibido', value: '-3', note: 'Cuando otro usuario rechaza tu publicación', updated_at: '2026-01-01T00:00:00Z' },
    { id: 3, param: 'Puntos por publicar precio', value: '+2', note: 'Al crear una nueva publicación de precio', updated_at: '2026-01-01T00:00:00Z' },
    { id: 4, param: 'Umbral Usuario Verificado', value: '10', note: 'Mínimo de puntos para publicar sin restricciones', updated_at: '2026-01-01T00:00:00Z' },
    { id: 5, param: 'Umbral para rol Moderador', value: '500', note: 'Puntos mínimos para asignación automática', updated_at: '2026-01-01T00:00:00Z' },
    { id: 6, param: 'Penalización por reporte aceptado', value: '-10', note: 'Cuando un reporte contra el usuario es validado', updated_at: '2026-01-01T00:00:00Z' },
  ];
}

export function createMockError(message = 'Database error') {
  return { message };
}

export function createMockFallbackStats(overrides = {}) {
  return {
    totalUsers: 100,
    publicationsToday: 50,
    validationsToday: 30,
    pendingReports: 10,
    ...overrides,
  };
}
