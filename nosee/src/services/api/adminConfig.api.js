/**
 * adminConfig.api.js
 *
 * API para configuración del sistema desde el panel admin.
 * Reemplaza el almacenamiento en localStorage con persistencia server-side.
 *
 * Patrón de retorno: { success, data?, error? } — consistente con el proyecto.
 */
import { supabase } from '@/services/supabase.client';
import { getOrSetCache, clearCache } from '@/services/cache';
import { checkRateLimit } from '@/services/utils/rateLimit';

/**
 * Obtiene todos los parámetros de configuración de reputación.
 * Accesible para Admin y Moderador.
 */
export async function getReputationConfig() {
  try {
    const data = await getOrSetCache('admin:config', async () => {
      const { data, error } = await supabase
        .from('reputation_config')
        .select('id, param, value, note, updated_at')
        .order('id', { ascending: true });

      if (error) {
        const msg = error.code === 'PGRST301' ? 'Sesión expirada' : error.message;
        throw new Error(msg);
      }
      return data ?? [];
    }, 300000);

    return { success: true, data };
  } catch (_) {
    return { success: false, error: 'Error al cargar configuración' };
  }
}

/**
 * Actualiza un parámetro de reputación.
 * Solo Admin. Actualiza automáticamente updated_at vía trigger.
 *
 * @param {number} id - ID del parámetro
 * @param {string} value - Nuevo valor
 */
export async function updateReputationParam(id, value) {
  const { allowed, retryAfter } = checkRateLimit('admin:updateReputation');
  if (!allowed) {
    return { success: false, error: `Espera ${retryAfter}s antes de otra acción` };
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'No autenticado' };

  const { error } = await supabase
    .from('reputation_config')
    .update({ value, updated_by: user.id })
    .eq('id', id);

  if (error) {
    const message = error.code === 'PGRST301' ? 'Sesión expirada'
      : error.code === '42501' ? 'Acceso denegado'
      : 'Error al procesar la solicitud';
    return { success: false, error: message };
  }
  clearCache('admin:config');
  return { success: true };
}

/**
 * Obtiene todas las categorías de producto con su conteo de productos.
 * @returns {Promise<{success: boolean, data?: Array, error?: string}>}
 */
export async function getCategories() {
  try {
    const { data, error } = await supabase
      .from('product_categories')
      .select('id, name, products(count)')
      .order('name');
    if (error) {
      const msg = error.code === 'PGRST301' ? 'Sesión expirada' : 'Error al cargar categorías';
      return { success: false, error: msg };
    }
    return { success: true, data: data || [] };
  } catch (_) {
    return { success: false, error: 'Error al cargar categorías' };
  }
}

/**
 * Crea una nueva categoría de producto.
 * @param {string} name - Nombre de la categoría
 * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
 */
export async function insertCategory(name) {
  try {
    const { data, error } = await supabase
      .from('product_categories')
      .insert({ name })
      .select()
      .single();
    if (error) {
      const msg = error.code === '23505' ? 'La categoría ya existe' : 'Error al crear categoría';
      return { success: false, error: msg };
    }
    return { success: true, data };
  } catch (_) {
    return { success: false, error: 'Error al crear categoría' };
  }
}
