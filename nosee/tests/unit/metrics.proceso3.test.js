/**
 * tests/unit/metrics.proceso3.test.js
 *
 * Verifica que las funciones de métricas del Proceso 3 envíen
 * los eventos correctos al metrics-server con los datos exactos,
 * y que los valores provenientes del motor de optimización
 * (savingsPct, noResultItems) se transmitan sin pérdida.
 *
 * Estrategia:
 *   - vi.stubEnv activa IS_ENABLED en metrics.js (simula VITE_METRICS_SERVER_URL)
 *   - vi.resetModules() garantiza carga fresca del módulo con el env correcto
 *   - globalThis.fetch espiada para capturar el payload enviado
 *   - buildResult importado directamente para generar valores reales
 *
 * Ejecutar: npm test -- metrics.proceso3
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  optimizeByPrice,
  optimizeBalanced,
} from '../../src/features/orders/utils/optimizationAlgorithms.js';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers de fixtures (mismos que proceso3.test.js para consistencia)
// ─────────────────────────────────────────────────────────────────────────────

const makeStore = (id) => ({
  id,
  name: `Tienda ${id}`,
  lat: 4.6,
  lng: -74.0,
  type: 1,
});

const makeItem = (id, productName, quantity) => ({
  id,
  productName,
  quantity,
});

const makePub = (storeId, price, store) => {
  const s = store ?? makeStore(storeId);
  return { store: s, price };
};

// ─────────────────────────────────────────────────────────────────────────────
// Utilidad: extrae el body de la última llamada a fetch
// ─────────────────────────────────────────────────────────────────────────────

function lastFetchBody(fetchSpy) {
  const calls = fetchSpy.mock.calls;
  return JSON.parse(calls[calls.length - 1][1].body);
}

function lastFetchUrl(fetchSpy) {
  const calls = fetchSpy.mock.calls;
  return calls[calls.length - 1][0];
}

// ─────────────────────────────────────────────────────────────────────────────
// Suite principal
// ─────────────────────────────────────────────────────────────────────────────

describe('metrics.js — Proceso 3', () => {
  let fetchSpy;

  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv('VITE_METRICS_SERVER_URL', 'http://test-metrics:3001');
    fetchSpy = vi.fn().mockResolvedValue({ ok: true });
    globalThis.fetch = fetchSpy;
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  // Carga fresca del módulo después de que el env esté configurado
  async function loadMetrics() {
    return await import('../../src/services/metrics.js');
  }

  // ── 1. recordShoppingListOrderStarted ──────────────────────────────────────

  describe('recordShoppingListOrderStarted', () => {
    it('envía evento shopping_list_order_started con item_count correcto', async () => {
      const { recordShoppingListOrderStarted } = await loadMetrics();

      await recordShoppingListOrderStarted(5);

      expect(fetchSpy).toHaveBeenCalledOnce();
      const body = lastFetchBody(fetchSpy);
      expect(body.event).toBe('shopping_list_order_started');
      expect(body.data.item_count).toBe(5);
    });

    it('envía al endpoint /api/metrics del servidor configurado', async () => {
      const { recordShoppingListOrderStarted } = await loadMetrics();

      await recordShoppingListOrderStarted(1);

      expect(lastFetchUrl(fetchSpy)).toBe('http://test-metrics:3001/api/metrics');
    });

    it('acepta item_count = 1 (lista de un solo producto)', async () => {
      const { recordShoppingListOrderStarted } = await loadMetrics();

      await recordShoppingListOrderStarted(1);

      const body = lastFetchBody(fetchSpy);
      expect(body.data.item_count).toBe(1);
    });
  });

  // ── 2. recordShoppingListOrderAbandoned ────────────────────────────────────

  describe('recordShoppingListOrderAbandoned', () => {
    it('envía evento shopping_list_order_abandoned sin datos adicionales', async () => {
      const { recordShoppingListOrderAbandoned } = await loadMetrics();

      await recordShoppingListOrderAbandoned();

      expect(fetchSpy).toHaveBeenCalledOnce();
      const body = lastFetchBody(fetchSpy);
      expect(body.event).toBe('shopping_list_order_abandoned');
      expect(body.data).toEqual({});
    });

    it('no envía item_count ni ningún campo extra', async () => {
      const { recordShoppingListOrderAbandoned } = await loadMetrics();

      await recordShoppingListOrderAbandoned();

      const body = lastFetchBody(fetchSpy);
      expect(Object.keys(body.data)).toHaveLength(0);
    });
  });

  // ── 3. recordOptimizationRun ───────────────────────────────────────────────

  describe('recordOptimizationRun', () => {
    it('envía evento optimization_run con strategy, duration_ms y no_result_count', async () => {
      const { recordOptimizationRun } = await loadMetrics();

      await recordOptimizationRun('balanced', 1200, 0);

      const body = lastFetchBody(fetchSpy);
      expect(body.event).toBe('optimization_run');
      expect(body.data.strategy).toBe('balanced');
      expect(body.data.duration_ms).toBe(1200);
      expect(body.data.no_result_count).toBe(0);
    });

    it('registra las tres estrategias válidas sin alterarlas', async () => {
      const { recordOptimizationRun } = await loadMetrics();

      for (const strategy of ['price', 'fewest_stores', 'balanced']) {
        await recordOptimizationRun(strategy, 500, 0);
        const body = lastFetchBody(fetchSpy);
        expect(body.data.strategy).toBe(strategy);
      }
    });

    it('transmite no_result_count > 0 cuando hay ítems sin cobertura', async () => {
      const { recordOptimizationRun } = await loadMetrics();

      await recordOptimizationRun('price', 800, 3);

      const body = lastFetchBody(fetchSpy);
      expect(body.data.no_result_count).toBe(3);
    });

    it('transmite el no_result_count real producido por buildResult.noResultItems', async () => {
      const { recordOptimizationRun } = await loadMetrics();

      // Simula lo que hace CreateOrderPage:
      // optimizeFn produce un resultado, luego se lee noResultItems.length
      const item1 = makeItem(1, 'Arroz', 1);
      const item2 = makeItem(2, 'ProductoSinCobertura', 1);
      const pub = makePub('store-A', 2000);

      const itemResults = [
        { item: item1, publications: [pub] },
        { item: item2, publications: [] }, // sin cobertura
      ];

      const optimized = optimizeByPrice(itemResults);
      const noResultCount = optimized.noResultItems?.length ?? 0;

      await recordOptimizationRun('price', 400, noResultCount);

      const body = lastFetchBody(fetchSpy);
      expect(body.data.no_result_count).toBe(1); // 1 ítem sin cobertura
    });
  });

  // ── 4. recordOrderConfirmed ────────────────────────────────────────────────

  describe('recordOrderConfirmed', () => {
    it('envía evento order_confirmed con todos los campos requeridos', async () => {
      const { recordOrderConfirmed } = await loadMetrics();

      await recordOrderConfirmed('balanced', true, 25000, 15);

      const body = lastFetchBody(fetchSpy);
      expect(body.event).toBe('order_confirmed');
      expect(body.data.strategy).toBe('balanced');
      expect(body.data.delivery_mode).toBe('delivery');
      expect(body.data.total_cost).toBe(25000);
      expect(body.data.savings_pct).toBe(15);
    });

    it('convierte deliveryMode=true a "delivery"', async () => {
      const { recordOrderConfirmed } = await loadMetrics();

      await recordOrderConfirmed('price', true, 10000, 0);

      const body = lastFetchBody(fetchSpy);
      expect(body.data.delivery_mode).toBe('delivery');
    });

    it('convierte deliveryMode=false a "pickup"', async () => {
      const { recordOrderConfirmed } = await loadMetrics();

      await recordOrderConfirmed('balanced', false, 18000, 5);

      const body = lastFetchBody(fetchSpy);
      expect(body.data.delivery_mode).toBe('pickup');
    });

    it('transmite el savingsPct real calculado por buildResult', async () => {
      const { recordOrderConfirmed } = await loadMetrics();

      // Reproduce exactamente lo que hace handleConfirm() en CreateOrderPage:
      // result.savingsPct viene de buildResult(), que usa: round((savings/worstCost)*100)
      const item = makeItem(1, 'Arroz', 2);
      const cheap = makePub('store-A', 1000);
      const expensive = makePub('store-B', 3000);

      const itemResults = [{ item, publications: [cheap, expensive] }];
      const optimized = optimizeByPrice(itemResults);
      // worstCost = 3000 (max price, sin multiplicar por quantity), totalCost = 1000*2 = 2000
      // savings = 3000 - 2000 = 1000, savingsPct = round(1000/3000*100) = 33

      await recordOrderConfirmed('price', false, optimized.totalCost, optimized.savingsPct);

      const body = lastFetchBody(fetchSpy);
      expect(body.data.total_cost).toBe(2000);
      expect(body.data.savings_pct).toBe(33);
    });

    it('transmite savings_pct = 0 cuando solo hay un precio disponible', async () => {
      const { recordOrderConfirmed } = await loadMetrics();

      const item = makeItem(1, 'Arroz', 1);
      const pub = makePub('store-A', 1500);
      const itemResults = [{ item, publications: [pub] }];
      const optimized = optimizeByPrice(itemResults);
      // Con un solo precio, worstCost = totalCost → savingsPct = 0

      await recordOrderConfirmed('price', false, optimized.totalCost, optimized.savingsPct);

      const body = lastFetchBody(fetchSpy);
      expect(body.data.savings_pct).toBe(0);
    });

    it('transmite el savingsPct con estrategia balanced correctamente', async () => {
      const { recordOrderConfirmed } = await loadMetrics();

      const item1 = makeItem(1, 'Arroz', 1);
      const item2 = makeItem(2, 'Leche', 1);
      const itemResults = [
        { item: item1, publications: [makePub('store-A', 1000), makePub('store-B', 3000)] },
        { item: item2, publications: [makePub('store-A', 2000), makePub('store-B', 1500)] },
      ];

      const optimized = optimizeBalanced(itemResults);

      // El savingsPct que llega a la métrica debe ser el mismo que produce buildResult
      await recordOrderConfirmed('balanced', false, optimized.totalCost, optimized.savingsPct);

      const body = lastFetchBody(fetchSpy);
      expect(typeof body.data.savings_pct).toBe('number');
      expect(body.data.savings_pct).toBeGreaterThanOrEqual(0);
      expect(body.data.savings_pct).toBeLessThanOrEqual(100);
    });
  });

  // ── 5. Comportamiento cuando VITE_METRICS_SERVER_URL no está configurado ───

  describe('modo deshabilitado (sin URL configurada)', () => {
    it('no llama a fetch cuando no hay METRICS_URL', async () => {
      // Stubea a cadena vacía (sobreescribe el .env real) y recarga el módulo
      vi.resetModules();
      vi.stubEnv('VITE_METRICS_SERVER_URL', '');
      // IS_ENABLED = false porque la URL es cadena vacía

      const { recordShoppingListOrderStarted } = await import('../../src/services/metrics.js');

      await recordShoppingListOrderStarted(3);

      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('no lanza error cuando fetch falla', async () => {
      const { recordOptimizationRun } = await loadMetrics();
      fetchSpy.mockRejectedValueOnce(new Error('Network error'));

      // No debe propagar el error (fire-and-forget: retorna void, el catch está en push())
      expect(() => recordOptimizationRun('balanced', 500, 0)).not.toThrow();
    });
  });

  // ── 6. Consistencia entre inicio y abandono ────────────────────────────────

  describe('consistencia started / abandoned', () => {
    it('started y abandoned envían al mismo endpoint', async () => {
      const { recordShoppingListOrderStarted, recordShoppingListOrderAbandoned } =
        await loadMetrics();

      await recordShoppingListOrderStarted(2);
      await recordShoppingListOrderAbandoned();

      const urls = fetchSpy.mock.calls.map((c) => c[0]);
      expect(urls[0]).toBe(urls[1]);
    });

    it('started usa event distinto a abandoned', async () => {
      const { recordShoppingListOrderStarted, recordShoppingListOrderAbandoned } =
        await loadMetrics();

      await recordShoppingListOrderStarted(2);
      await recordShoppingListOrderAbandoned();

      const events = fetchSpy.mock.calls.map((c) => JSON.parse(c[1].body).event);
      expect(events[0]).toBe('shopping_list_order_started');
      expect(events[1]).toBe('shopping_list_order_abandoned');
      expect(events[0]).not.toBe(events[1]);
    });
  });
});
