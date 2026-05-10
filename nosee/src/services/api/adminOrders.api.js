import { supabase } from '@/services/supabase.client';

function sanitizeError(error, fallback = 'Error al procesar la solicitud') {
  if (!error) return fallback;
  if (error.code === 'PGRST301') return 'Sesión expirada';
  if (error.code === '42501') return 'Acceso denegado';
  return fallback;
}

/**
 * Obtiene todas las órdenes del sistema con paginación.
 * @param {Object} [options]
 * @param {number} [options.page=0] - Número de página (0-based)
 * @param {number} [options.pageSize=20] - Cantidad de elementos por página
 * @returns {Promise<{success: boolean, data?: Array, error?: string}>}
 */
export async function getAdminOrders({ page = 0, pageSize = 20 } = {}) {
  try {
    const from = page * pageSize;
    const to = from + pageSize - 1;
    const { data, error } = await supabase
      .from('orders')
      .select('id, local_id, status, total_estimated, total_real, delivery_fee, service_fee, savings_percentage, strategy, delivery_mode, created_at, user_id, dealer_id')
      .order('created_at', { ascending: false })
      .range(from, to);
    if (error) return { success: false, error: sanitizeError(error) };
    return { success: true, data: data || [] };
  } catch (err) {
    return { success: false, error: sanitizeError(err) };
  }
}

/**
 * Obtiene los últimos 100 pagos registrados en el sistema.
 * @returns {Promise<{success: boolean, data?: Array, error?: string}>}
 */
export async function getAdminPayments() {
  try {
    const { data, error } = await supabase
      .from('payments')
      .select('id, order_id, amount, payment_method, status, created_at')
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) return { success: false, error: sanitizeError(error) };
    return { success: true, data: data || [] };
  } catch (err) {
    return { success: false, error: sanitizeError(err) };
  }
}
