/**
 * adminCatalog.api.js
 *
 * API de catálogo admin-only.
 * Extrae las queries inline de AdminDashboard.jsx para reutilización.
 *
 * Patrón de retorno: { success, data?, error? } — consistente con el proyecto.
 */
import { supabase } from '@/services/supabase.client';

function sanitizeError(error, fallback = 'Error al procesar la solicitud') {
  if (!error) return fallback;
  if (error.code === 'PGRST301') return 'Sesión expirada';
  if (error.code === '42501') return 'Acceso denegado';
  return fallback;
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
    if (error) return { success: false, error: sanitizeError(error) };
    return { success: true, data };
} catch (err) {
    return { success: false, error: sanitizeError(err) };
  }
}

/**
 * Obtiene referencias de publicaciones activas con paginación.
 * @param {number} [page=1] - Número de página (1-based)
 * @param {number} [pageSize=20] - Cantidad de elementos por página
 * @returns {Promise<{success: boolean, data: Array|null, count: number|null, error: string|null}>}
 */
export async function getPublishedRefs(page = 1, pageSize = 20) {
  try {
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    const { data, count, error } = await supabase
      .from('price_publications')
      .select('store_id, product_id', { count: 'exact' })
      .range(from, to);
    if (error) return { success: false, error: sanitizeError(error) };
    return { success: true, data: data || [], count };
  } catch (err) {
    return { success: false, error: sanitizeError(err) };
  }
}

/**
 * Obtiene todas las tiendas activas con paginación.
 * @param {number} [page=1] - Número de página (1-based)
 * @param {number} [pageSize=20] - Cantidad de elementos por página
 * @returns {Promise<{success: boolean, data: Array|null, count: number|null, error: string|null}>}
 */
export async function getAllStores(page = 1, pageSize = 20) {
  try {
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    const { data, count, error } = await supabase
      .from('stores')
      .select('id, name, address, website_url, store_type_id, created_by, created_at', { count: 'exact' })
      .eq('is_admin_hidden', false)
      .order('name', { ascending: true })
      .range(from, to);
    if (error) return { success: false, error: sanitizeError(error) };
    return { success: true, data, count };
  } catch (err) {
    return { success: false, error: sanitizeError(err) };
  }
}

/**
 * Obtiene todos los productos activos con paginación.
 * @param {number} [page=1] - Número de página (1-based)
 * @param {number} [pageSize=20] - Cantidad de elementos por página
 * @returns {Promise<{success: boolean, data: Array|null, count: number|null, error: string|null}>}
 */
export async function getAllProducts(page = 1, pageSize = 20) {
  try {
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    const { data, count, error } = await supabase
      .from('products')
      .select('id, name, barcode, base_quantity, created_at, brand:brands(id, name), unit:unit_types(id, name, abbreviation)', { count: 'exact' })
      .eq('is_admin_hidden', false)
      .order('name', { ascending: true })
      .range(from, to);
    if (error) return { success: false, error: sanitizeError(error) };
    return { success: true, data, count };
  } catch (err) {
    return { success: false, error: sanitizeError(err) };
  }
}

/**
 * Obtiene todas las publicaciones activas del sistema con datos de usuario, producto y tienda.
 * @returns {Promise<{success: boolean, data?: Array, error?: string}>}
 */
export async function getAdminPublications() {
  try {
    const { data, error } = await supabase
      .from('price_publications')
      .select(`
        id, price, photo_url, description, confidence_score, is_active, created_at,
        user_id, store_id, product_id,
        user:users!price_publications_user_id_fkey (id, full_name, reputation_points),
        product:products (id, name, barcode, base_quantity, brand:brands(id, name), unit_type:unit_types (id, name, abbreviation)),
        store:stores!price_publications_store_id_fkey (id, name, address)
      `)
      .eq('is_admin_hidden', false)
      .order('created_at', { ascending: false })
      .limit(300);
    if (error) return { success: false, error: sanitizeError(error) };
    return { success: true, data: data || [] };
  } catch (err) {
    return { success: false, error: sanitizeError(err) };
  }
}

/**
 * Desactiva una publicación (soft delete, no la oculta del admin).
 * @param {number} pubId - ID de la publicación
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function deactivatePublication(pubId) {
  try {
    const { error } = await supabase
      .from('price_publications')
      .update({ is_active: false })
      .eq('id', pubId)
      .eq('is_active', true);
    if (error) return { success: false, error: sanitizeError(error) };
    return { success: true };
  } catch (err) {
    return { success: false, error: sanitizeError(err) };
  }
}

/**
 * Oculta una publicación del catálogo (soft delete admin). La publicación se marca como inactiva y oculta.
 * @param {number} pubId - ID de la publicación
 * @param {string} actorId - UUID del admin que ejecuta la acción
 * @param {string} [reason] - Motivo opcional del ocultamiento
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function hidePublication(pubId, actorId, reason) {
  try {
    const { error } = await supabase
      .from('price_publications')
      .update({
        is_active: false,
        is_admin_hidden: true,
        hidden_admin_at: new Date().toISOString(),
        hidden_admin_by: actorId,
        hidden_admin_reason: reason || 'Ocultada desde panel admin',
      })
      .eq('id', pubId);
    if (error) return { success: false, error: sanitizeError(error) };
    return { success: true };
  } catch (err) {
    return { success: false, error: sanitizeError(err) };
  }
}

/**
 * Actualiza los campos de una publicación.
 * @param {number} pubId - ID de la publicación
 * @param {Object} updates - Campos a actualizar
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function updatePublication(pubId, updates) {
  try {
    const { error } = await supabase.from('price_publications').update(updates).eq('id', pubId);
    if (error) return { success: false, error: sanitizeError(error) };
    return { success: true };
  } catch (err) {
    return { success: false, error: sanitizeError(err) };
  }
}

/**
 * Desactiva todas las publicaciones activas de un usuario (útil al banear).
 * @param {string} userId - UUID del usuario
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function hideUserPublications(userId) {
  try {
    const { error } = await supabase
      .from('price_publications')
      .update({ is_active: false })
      .eq('user_id', userId)
      .eq('is_active', true);
    if (error) return { success: false, error: sanitizeError(error) };
    return { success: true };
  } catch (err) {
    return { success: false, error: sanitizeError(err) };
  }
}

/**
 * Obtiene el detalle de una tienda por ID.
 * @param {string} storeId - UUID de la tienda
 * @returns {Promise<{success: boolean, data?: Object|null, error?: string}>}
 */
export async function getStoreDetail(storeId) {
  try {
    const { data, error } = await supabase
      .from('stores')
      .select('id, name, address, website_url, store_type_id, created_by, created_at')
      .eq('id', storeId)
      .maybeSingle();
    if (error) return { success: false, error: sanitizeError(error) };
    return { success: true, data };
  } catch (err) {
    return { success: false, error: sanitizeError(err) };
  }
}

/**
 * Oculta una tienda del catálogo (soft delete admin).
 * @param {string} storeId - UUID de la tienda
 * @param {string} actorUserId - UUID del admin que ejecuta la acción
 * @param {string} [reason] - Motivo opcional del ocultamiento
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function hideStore(storeId, actorId, reason) {
  try {
    const { error } = await supabase
      .from('stores')
      .update({
        is_admin_hidden: true,
        hidden_admin_at: new Date().toISOString(),
        hidden_admin_by: actorId,
        hidden_admin_reason: reason || 'Ocultado desde panel admin',
        is_active: false,
      })
      .eq('id', storeId);
    if (error) return { success: false, error: sanitizeError(error) };
    return { success: true };
  } catch (err) {
    return { success: false, error: sanitizeError(err) };
  }
}

/**
 * Actualiza los campos de una tienda desde el panel admin.
 * @param {string} storeId - UUID de la tienda
 * @param {Object} updates - Campos a actualizar
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function updateAdminStore(storeId, updates) {
  try {
    const { error } = await supabase.from('stores').update(updates).eq('id', storeId);
    if (error) return { success: false, error: sanitizeError(error) };
    return { success: true };
  } catch (err) {
    return { success: false, error: sanitizeError(err) };
  }
}

/**
 * Obtiene el detalle de una marca con su conteo de productos asociados.
 * @param {number} brandId - ID de la marca
 * @returns {Promise<{success: boolean, data?: Object|null, error?: string}>}
 */
export async function getBrandDetail(brandId) {
  try {
    const { data, error } = await supabase
      .from('brands')
      .select('id, name, created_at')
      .eq('id', brandId)
      .maybeSingle();
    if (error) return { success: false, error: sanitizeError(error) };

    const { count, error: countError } = await supabase
      .from('products')
      .select('id', { count: 'exact', head: true })
      .eq('brand_id', brandId);

    if (countError) return { success: false, error: countError.message };
    return { success: true, data: { ...data, productsCount: count ?? 0 } };
  } catch (err) {
    return { success: false, error: sanitizeError(err) };
  }
}

/**
 * Oculta una marca del catálogo (soft delete admin).
 * @param {number} brandId - ID de la marca
 * @param {string} actorUserId - UUID del admin que ejecuta la acción
 * @param {string} [reason] - Motivo opcional del ocultamiento
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function hideBrand(brandId, actorId, reason) {
  try {
    const { error } = await supabase
      .from('brands')
      .update({
        is_admin_hidden: true,
        hidden_admin_at: new Date().toISOString(),
        hidden_admin_by: actorId,
        hidden_admin_reason: reason || 'Ocultado desde panel admin',
        is_active: false,
      })
      .eq('id', brandId);
    if (error) return { success: false, error: sanitizeError(error) };
    return { success: true };
  } catch (err) {
    return { success: false, error: sanitizeError(err) };
  }
}

/**
 * Actualiza los campos de una marca desde el panel admin.
 * @param {number} brandId - ID de la marca
 * @param {Object} updates - Campos a actualizar
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function updateAdminBrand(brandId, updates) {
  try {
    const { error } = await supabase.from('brands').update(updates).eq('id', brandId);
    if (error) return { success: false, error: sanitizeError(error) };
    return { success: true };
  } catch (err) {
    return { success: false, error: sanitizeError(err) };
  }
}

/**
 * Oculta un producto del catálogo (soft delete admin).
 * @param {number} productId - ID del producto
 * @param {string} actorUserId - UUID del admin que ejecuta la acción
 * @param {string} [reason] - Motivo opcional del ocultamiento
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function hideProduct(productId, actorId, reason) {
  try {
    const { error } = await supabase
      .from('products')
      .update({
        is_admin_hidden: true,
        hidden_admin_at: new Date().toISOString(),
        hidden_admin_by: actorId,
        hidden_admin_reason: reason || 'Ocultado desde panel admin',
        is_active: false,
      })
      .eq('id', productId);
    if (error) return { success: false, error: sanitizeError(error) };
    return { success: true };
  } catch (err) {
    return { success: false, error: sanitizeError(err) };
  }
}

/**
 * Actualiza los campos de un producto desde el panel admin.
 * @param {number} productId - ID del producto
 * @param {Object} updates - Campos a actualizar
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function updateAdminProduct(productId, updates) {
  try {
    const { error } = await supabase.from('products').update(updates).eq('id', productId);
    if (error) return { success: false, error: sanitizeError(error) };
    return { success: true };
  } catch (err) {
    return { success: false, error: sanitizeError(err) };
  }
}

/**
 * Crea una nueva categoría de producto.
 * @param {string} name - Nombre de la categoría
 * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
 */
export async function createCategory(name) {
  try {
    const { data, error } = await supabase
      .from('product_categories')
      .insert({ name })
      .select()
      .single();
    if (error) return { success: false, error: sanitizeError(error) };
    return { success: true, data };
  } catch (err) {
    return { success: false, error: sanitizeError(err) };
  }
}

/**
 * Busca productos por nombre (búsqueda ligera para autocomplete).
 * @param {string} query - Término de búsqueda
 * @param {number} [limit=8] - Máximo de resultados
 * @returns {Promise<{success: boolean, data?: Array, error?: string}>}
 */
export async function searchProductsLight(query, limit = 8) {
  try {
    const { data } = await supabase
      .from('products')
      .select('id, name, barcode, brand:brands(name)')
      .ilike('name', `%${query}%`)
      .limit(limit);
    return { success: true, data: data || [] };
  } catch (err) {
    return { success: false, error: sanitizeError(err) };
  }
}

/**
 * Busca tiendas por nombre (búsqueda ligera para autocomplete).
 * @param {string} query - Término de búsqueda
 * @param {number} [limit=8] - Máximo de resultados
 * @returns {Promise<{success: boolean, data?: Array, error?: string}>}
 */
export async function searchStoresLight(query, limit = 8) {
  try {
    const { data } = await supabase
      .from('stores')
      .select('id, name, address, store_type_id')
      .ilike('name', `%${query}%`)
      .limit(limit);
    return { success: true, data: data || [] };
  } catch (err) {
    return { success: false, error: sanitizeError(err) };
  }
}

/**
 * Obtiene todas las tiendas activas del catálogo (sin paginación, hasta 500).
 * @returns {Promise<{success: boolean, data?: Array, error?: string}>}
 */
export async function getCatalogStores() {
  try {
    const { data, error } = await supabase
      .from('stores')
      .select('id, name, address, website_url, store_type_id, is_active, is_admin_hidden, created_at')
      .eq('is_admin_hidden', false)
      .order('name', { ascending: true })
      .limit(500);
    if (error) return { success: false, error: sanitizeError(error) };
    return { success: true, data: data || [] };
  } catch (err) {
    return { success: false, error: sanitizeError(err) };
  }
}

/**
 * Obtiene todos los productos activos del catálogo (sin paginación, hasta 500).
 * @returns {Promise<{success: boolean, data?: Array, error?: string}>}
 */
export async function getCatalogProducts() {
  try {
    const { data, error } = await supabase
      .from('products')
      .select('id, name, barcode, base_quantity, is_active, is_admin_hidden, created_at, brand:brands(id, name), unit_type:unit_types(id, name, abbreviation)')
      .eq('is_admin_hidden', false)
      .order('name', { ascending: true })
      .limit(500);
    if (error) return { success: false, error: sanitizeError(error) };
    return { success: true, data: data || [] };
  } catch (err) {
    return { success: false, error: sanitizeError(err) };
  }
}

/**
 * Obtiene todas las marcas activas del catálogo (sin paginación, hasta 500).
 * @returns {Promise<{success: boolean, data?: Array, error?: string}>}
 */
export async function getCatalogBrands() {
  try {
    const { data, error } = await supabase
      .from('brands')
      .select('id, name, is_active, is_admin_hidden, created_at')
      .eq('is_admin_hidden', false)
      .order('name', { ascending: true })
      .limit(500);
    if (error) return { success: false, error: sanitizeError(error) };
    return { success: true, data: data || [] };
  } catch (err) {
    return { success: false, error: sanitizeError(err) };
  }
}

/**
 * Obtiene una publicación por su ID con datos de producto y tienda.
 * @param {number} pubId - ID de la publicación
 * @returns {Promise<{success: boolean, data?: Object|null, error?: string}>}
 */
export async function getPublicationById(pubId) {
  try {
    const { data, error } = await supabase
      .from('price_publications')
      .select('id, price, is_active, products(name, base_quantity, brand:brands(name), unit_type:unit_types(name, abbreviation)), store:stores(name)')
      .eq('id', pubId)
      .maybeSingle();
    if (error) return { success: false, error: sanitizeError(error) };
    return { success: true, data: data || null };
  } catch (err) {
    return { success: false, error: sanitizeError(err) };
  }
}
