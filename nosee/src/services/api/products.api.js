import { supabase } from "@/services/supabase.client";
import { detectRestrictedContentText } from "@/services/moderation";
import { normalizeSearchText, normalizeBarcodeValue } from "@/services/utils/normalization";
import { runWithSessionRetry, getAdaptiveRequestTimeout } from "@/services/utils/requestUtils";
import { hasCoordinates, parseStoreLocation, calculateDistance } from "@/services/utils/geoUtils";

// ─── Utilidades de código de barras ───────────────────────────────────────────

const isMissingBarcodeColumnError = (error) =>
  error?.code === "42703" && String(error?.message || "").toLowerCase().includes("barcode");

let hasProductsBarcodeColumnCache = null;

const supportsProductsBarcodeColumn = async () => {
  if (hasProductsBarcodeColumnCache !== null) return hasProductsBarcodeColumnCache;

  const { error } = await supabase.from("products").select("barcode").limit(1);

  if (!error) {
    hasProductsBarcodeColumnCache = true;
    return true;
  }

  if (isMissingBarcodeColumnError(error)) {
    hasProductsBarcodeColumnCache = false;
    return false;
  }

  // Falla segura: no bloquear creación/edición si hay un error temporal.
  return false;
};

// ─── Búsqueda de productos y marcas (autocomplete) ────────────────────────────

export const searchProductsAndBrands = async (query, limit = 8) => {
  try {
    if (!query || query.trim().length < 2) {
      return { success: true, data: [] };
    }

    const safeLimit = Math.max(3, Math.min(Number(limit) || 8, 20));
    const term = query.trim();
    const normalizedTerm = normalizeSearchText(term);
    const seedTerm = term.length >= 3 ? term.slice(0, 3) : term;

    const [{ data: productsData, error: productsError }, { data: brandsData, error: brandsError }] = await Promise.all([
      supabase
        .from("products")
        .select("id, name, brand:brands(id, name)")
        .ilike("name", `%${seedTerm}%`)
        .limit(safeLimit * 5),
      supabase
        .from("brands")
        .select("id, name")
        .ilike("name", `%${seedTerm}%`)
        .limit(safeLimit * 3),
    ]);

    if (productsError) return { success: false, error: productsError.message };
    if (brandsError) return { success: false, error: brandsError.message };

    const seen = new Set();
    const suggestions = [];

    let normalizedProducts = (productsData || []).filter((product) => {
      const productName = normalizeSearchText(product.name);
      const brandName = normalizeSearchText(product?.brand?.name || "");
      return productName.includes(normalizedTerm) || brandName.includes(normalizedTerm);
    });

    for (const product of normalizedProducts) {
      const key = `product-${product.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      suggestions.push({
        id: product.id,
        label: product.brand?.name ? `${product.name} · ${product.brand.name}` : product.name,
        type: "product",
        value: product.name,
      });
    }

    let normalizedBrands = (brandsData || []).filter((brand) =>
      normalizeSearchText(brand.name).includes(normalizedTerm),
    );

    // Fallback acento-insensible/mayúsculas cuando ILIKE no devuelve candidatos.
    if (normalizedProducts.length === 0 && normalizedBrands.length === 0) {
      const [{ data: broadProducts }, { data: broadBrands }] = await Promise.all([
        supabase
          .from("products")
          .select("id, name, brand:brands(id, name)")
          .limit(safeLimit * 40),
        supabase
          .from("brands")
          .select("id, name")
          .limit(safeLimit * 20),
      ]);

      normalizedProducts = (broadProducts || []).filter((product) => {
        const productName = normalizeSearchText(product.name);
        const brandName = normalizeSearchText(product?.brand?.name || "");
        return productName.includes(normalizedTerm) || brandName.includes(normalizedTerm);
      });

      normalizedBrands = (broadBrands || []).filter((brand) =>
        normalizeSearchText(brand.name).includes(normalizedTerm),
      );
    }

    for (const brand of normalizedBrands) {
      const key = `brand-${brand.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      suggestions.push({
        id: brand.id,
        label: `${brand.name} (marca)`,
        type: "brand",
        value: brand.name,
      });
    }

    return { success: true, data: suggestions.slice(0, safeLimit) };
  } catch (err) {
    return { success: false, error: err.message };
  }
};

export const searchProducts = async (query, limit = 10, brandQuery = "") => {
  try {
    if (!query || query.length < 2) {
      return { success: true, data: [] };
    }

    let brandIds = null;
    if (brandQuery && brandQuery.trim().length >= 1) {
      const { data: brands } = await supabase
        .from("brands")
        .select("id")
        .ilike("name", `%${brandQuery.trim()}%`)
        .limit(50);
      if (brands && brands.length > 0) {
        brandIds = brands.map((b) => b.id);
      } else {
        return { success: true, data: [] };
      }
    }

    const executeSearch = () => {
      let q = supabase
        .from("products")
        .select("id, name, category_id, base_quantity, brand:brands(id, name), unit:unit_types(name)")
        .ilike("name", `%${query}%`);
      if (brandIds) q = q.in("brand_id", brandIds);
      return q.limit(limit);
    };

    const { data, error } = await runWithSessionRetry(executeSearch, getAdaptiveRequestTimeout());

    if (error) {
      console.error("Error buscando productos:", error);
      return { success: false, error: error.message };
    }

    return { success: true, data };
  } catch (err) {
    if (err?.code === "QUERY_TIMEOUT") {
      console.error("Timeout en searchProducts", {
        operation: err.operation,
        timeoutMs: err.timeoutMs,
        supabaseHost: err.supabaseHost,
        online: err.online,
      });
      return {
        success: false,
        error: `Timeout en ${err.operation}. Revisa conectividad y configuración de Supabase (${err.supabaseHost}).`,
      };
    }
    console.error("Error en searchProducts:", err);
    return { success: false, error: err.message };
  }
};

export const findProductByBarcode = async (barcode) => {
  const normalizedBarcode = normalizeBarcodeValue(barcode);
  if (!normalizedBarcode || normalizedBarcode.length < 4) {
    return { success: true, data: null };
  }

  try {
    const supportsBarcode = await supportsProductsBarcodeColumn();
    if (!supportsBarcode) return { success: true, data: null };

    const { data, error } = await supabase
      .from("products")
      .select("id, name, category_id, base_quantity, barcode, brand:brands(name), unit:unit_types(name)")
      .eq("barcode", normalizedBarcode)
      .limit(1)
      .maybeSingle();

    if (error) {
      if (isMissingBarcodeColumnError(error)) {
        hasProductsBarcodeColumnCache = false;
        return { success: true, data: null };
      }
      return { success: false, error: error.message };
    }

    return { success: true, data: data || null };
  } catch (err) {
    return { success: false, error: err.message };
  }
};

export const getProducts = async (limit = 100) => {
  try {
    const { data, error } = await supabase
      .from("products")
      .select("id, name, category_id, brand_id, unit_type_id, base_quantity")
      .order("name", { ascending: true })
      .limit(limit);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data: data || [] };
  } catch (err) {
    return { success: false, error: err.message };
  }
};

export const getStores = async (limit = 100) => {
  try {
    const { data, error } = await supabase
      .from("stores")
      .select("id, name")
      .order("name", { ascending: true })
      .limit(limit);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data: data || [] };
  } catch (err) {
    return { success: false, error: err.message };
  }
};

export const searchStores = async (
  query,
  maxDistance = null,
  latitude = null,
  longitude = null,
  limit = 10,
) => {
  try {
    if (!query || query.length < 2) {
      return { success: true, data: [] };
    }

    const executeSearch = () =>
      supabase
        .from("stores")
        .select("id, name, address, location")
        .ilike("name", `%${query}%`)
        .limit(limit);

    const { data, error } = await runWithSessionRetry(executeSearch, getAdaptiveRequestTimeout());

    if (error) {
      console.error("Error buscando tiendas:", error);
      return { success: false, error: error.message };
    }

    const storesWithCoordinates = (data || []).map((store) => ({
      ...store,
      ...parseStoreLocation(store.location),
    }));

    let filtered = storesWithCoordinates;
    if (maxDistance && hasCoordinates(latitude, longitude)) {
      filtered = storesWithCoordinates.filter((store) => {
        const distance = calculateDistance(
          Number(latitude),
          Number(longitude),
          store.latitude,
          store.longitude,
        );
        return distance <= maxDistance;
      });
    }

    return { success: true, data: filtered };
  } catch (err) {
    if (err?.code === "QUERY_TIMEOUT") {
      console.error("Timeout en searchStores", {
        operation: err.operation,
        timeoutMs: err.timeoutMs,
        supabaseHost: err.supabaseHost,
        online: err.online,
      });
      return {
        success: false,
        error: `Timeout en ${err.operation}. Revisa conectividad y configuración de Supabase (${err.supabaseHost}).`,
      };
    }

    console.error("Error en searchStores:", err);
    return { success: false, error: err.message };
  }
};

export async function createProduct(name) {
  const isLegacyNameOnlyMode = typeof name === "string";
  const normalizedName = String(name?.name || name || "").trim();
  const categoryId = Number(name?.categoryId);
  const unitTypeId = Number(name?.unitTypeId);
  const brandId = Number(name?.brandId);
  const brandName = String(name?.brandName || "").trim();
  const baseQuantity = Number(name?.baseQuantity);
  const normalizedBarcode = normalizeBarcodeValue(name?.barcode);
  let supportsBarcode = false;
  if (!normalizedName || normalizedName.length < 2) {
    return {
      success: false,
      error: "El nombre del producto debe tener al menos 2 caracteres",
    };
  }

  const restrictedProductName = detectRestrictedContentText(normalizedName);
  if (restrictedProductName.flagged) {
    return {
      success: false,
      error:
        "El nombre del producto contiene términos restringidos (adulto/gore). Solo se permiten productos aptos para todo público.",
    };
  }

  // Compatibilidad legacy: cuando llega solo el nombre, intenta reutilizar un producto existente.
  if (isLegacyNameOnlyMode) {
    const { data: existingByName, error: existingByNameError } = await supabase
      .from("products")
      .select("id, name, category_id")
      .ilike("name", normalizedName)
      .limit(1)
      .maybeSingle();

    if (existingByNameError) {
      return { success: false, error: existingByNameError.message };
    }

    if (existingByName) {
      return { success: true, data: existingByName };
    }

    return {
      success: false,
      error: "Debes indicar categoría, unidad de medida y cantidad base válida",
    };
  }

  if (!categoryId || !unitTypeId || !baseQuantity || baseQuantity <= 0) {
    return {
      success: false,
      error:
        "Debes indicar categoría, unidad de medida y cantidad base válida",
    };
  }

  if (normalizedBarcode && normalizedBarcode.length < 4) {
    return {
      success: false,
      error: "El código de barras debe tener al menos 4 caracteres",
    };
  }

  if (normalizedBarcode) {
    supportsBarcode = await supportsProductsBarcodeColumn();
  }

  if (supportsBarcode && normalizedBarcode) {
    const { data: existingByBarcode, error: barcodeLookupError } = await supabase
      .from("products")
      .select("id, name, category_id, brand_id, unit_type_id, base_quantity, barcode")
      .eq("barcode", normalizedBarcode)
      .limit(1)
      .maybeSingle();

    if (barcodeLookupError) {
      if (isMissingBarcodeColumnError(barcodeLookupError)) {
        hasProductsBarcodeColumnCache = false;
      } else {
        return { success: false, error: barcodeLookupError.message };
      }
    } else if (existingByBarcode) {
      return { success: true, data: existingByBarcode };
    }
  }

  const existingProductsSelect = supportsBarcode
    ? "id, name, category_id, brand_id, unit_type_id, base_quantity, barcode"
    : "id, name, category_id, brand_id, unit_type_id, base_quantity";

  const { data: existingProducts, error: existingError } = await supabase
    .from("products")
    .select(existingProductsSelect)
    .ilike("name", normalizedName);

  if (existingError) {
    return { success: false, error: existingError.message };
  }

  if (existingProducts && existingProducts.length > 0) {
    const exactDuplicate = existingProducts.find((p) =>
      Number(p.brand_id) === brandId &&
      Number(p.unit_type_id) === unitTypeId &&
      Number(p.base_quantity) === baseQuantity
    );
    if (exactDuplicate) {
      return { success: false, error: "Este producto ya está registrado con la misma marca, unidad y cantidad.", alreadyExists: true, data: exactDuplicate };
    }
  }

  let resolvedBrandId = brandId;
  if (!resolvedBrandId && brandName) {
    const { data: existingBrand, error: existingBrandError } = await supabase
      .from("brands")
      .select("id")
      .ilike("name", brandName)
      .limit(1)
      .maybeSingle();

    if (existingBrandError) {
      return { success: false, error: existingBrandError.message };
    }

    if (existingBrand) {
      resolvedBrandId = existingBrand.id;
    }
  }

  if (!resolvedBrandId) {
    return {
      success: false,
      error: "Selecciona o registra una marca antes de crear el producto",
    };
  }

  const insertPayload = {
      name: normalizedName,
      category_id: categoryId,
      unit_type_id: unitTypeId,
      brand_id: resolvedBrandId,
      base_quantity: baseQuantity,
    };

  if (supportsBarcode && normalizedBarcode) {
    insertPayload.barcode = normalizedBarcode;
  }

  const productSelect = supportsBarcode
    ? "id, name, category_id, brand_id, unit_type_id, base_quantity, barcode"
    : "id, name, category_id, brand_id, unit_type_id, base_quantity";

  const { data, error } = await supabase
    .from("products")
    .insert(insertPayload)
    .select(productSelect)
    .single();

  if (error) {
    if (error.code === "23505") {
      let duplicateProduct = null;

      if (supportsBarcode && normalizedBarcode) {
        const { data: duplicateByBarcode } = await supabase
          .from("products")
          .select(productSelect)
          .eq("barcode", normalizedBarcode)
          .limit(1)
          .maybeSingle();
        duplicateProduct = duplicateByBarcode || null;
      }

      if (!duplicateProduct) {
        const { data: duplicateByName } = await supabase
          .from("products")
          .select(productSelect)
          .ilike("name", normalizedName)
          .limit(1)
          .maybeSingle();
        duplicateProduct = duplicateByName || null;
      }

      if (duplicateProduct) {
        return { success: true, data: duplicateProduct };
      }
    }

    return { success: false, error: error.message };
  }

  // Sumar reputación al creador del producto (best-effort)
  const { data: { user: authUser } } = await supabase.auth.getUser().catch(() => ({ data: { user: null } }));
  if (authUser?.id) {
    void (async () => {
      await supabase.rpc("increment_user_reputation", {
        target_user_id: authUser.id,
        reputation_delta: 2,
      });
    })();
  }

  return { success: true, data };
}

export async function updateProduct(productId, updates = {}) {
  if (!productId) return { success: false, error: "ID de producto requerido" };

  const safeUpdates = {};
  if (typeof updates.name === "string") safeUpdates.name = updates.name.trim();
  if (updates.categoryId !== undefined) safeUpdates.category_id = Number(updates.categoryId);
  if (updates.unitTypeId !== undefined) safeUpdates.unit_type_id = Number(updates.unitTypeId);
  if (updates.brandId !== undefined) safeUpdates.brand_id = Number(updates.brandId);
  if (updates.baseQuantity !== undefined) safeUpdates.base_quantity = Number(updates.baseQuantity);

  if (Object.keys(safeUpdates).length === 0) {
    return { success: false, error: "No hay campos para actualizar" };
  }

  const { data, error } = await supabase
    .from("products")
    .update(safeUpdates)
    .eq("id", productId)
    .select("id, name, category_id, brand_id, unit_type_id, base_quantity")
    .single();

  if (error) return { success: false, error: error.message };
  return { success: true, data };
}

export const createBrand = async (name) => {
  const normalizedName = String(name || "").trim();
  if (!normalizedName || normalizedName.length < 2) {
    return {
      success: false,
      error: "El nombre de la marca debe tener al menos 2 caracteres",
    };
  }

  const restrictedBrandName = detectRestrictedContentText(normalizedName);
  if (restrictedBrandName.flagged) {
    return {
      success: false,
      error:
        "El nombre de la marca contiene términos restringidos (adulto/gore).",
    };
  }

  const { data: existing, error: existingError } = await supabase
    .from("brands")
    .select("id, name")
    .ilike("name", normalizedName)
    .limit(1)
    .maybeSingle();

  if (existingError) {
    return { success: false, error: existingError.message };
  }

  if (existing) {
    return { success: false, error: "Esta marca ya está registrada.", alreadyExists: true, data: existing };
  }

  const { data, error } = await supabase
    .from("brands")
    .insert({ name: normalizedName })
    .select("id, name")
    .single();

  if (error) {
    if (error.code === "42501") {
      return {
        success: false,
        error:
          "No tienes permiso para registrar marcas. Solicita habilitar la política RLS de inserción en brands.",
      };
    }
    return { success: false, error: error.message };
  }

  // Sumar reputación al creador de la marca (best-effort)
  const { data: { user: authUserBrand } } = await supabase.auth.getUser().catch(() => ({ data: { user: null } }));
  if (authUserBrand?.id) {
    void (async () => {
      await supabase.rpc("increment_user_reputation", {
        target_user_id: authUserBrand.id,
        reputation_delta: 1,
      });
    })();
  }

  return { success: true, data };
};

export const getProductCategories = async () => {
  try {
    const executeQuery = () =>
      supabase
        .from("product_categories")
        .select("id, name")
        .order("name", { ascending: true });

    const { data, error } = await runWithSessionRetry(
      executeQuery,
      getAdaptiveRequestTimeout(),
    );

    if (error) return { success: false, error: error.message };
    return { success: true, data: data || [] };
  } catch (err) {
    return { success: false, error: err?.message || "Error cargando categorías" };
  }
};

export const getUnitTypes = async () => {
  const { data, error } = await supabase
    .from("unit_types")
    .select("id, name, abbreviation, category")
    .order("category", { ascending: true })
    .order("name", { ascending: true });

  if (error) return { success: false, error: error.message };
  return { success: true, data: data || [] };
};

export const searchBrands = async (query, limit = 10) => {
  if (!query || query.length < 1) return { success: true, data: [] };

  const { data, error } = await supabase
    .from("brands")
    .select("id, name")
    .ilike("name", `%${query}%`)
    .order("name", { ascending: true })
    .limit(limit);

  if (error) return { success: false, error: error.message };
  return { success: true, data: data || [] };
};

export const getBrands = async () => {
  try {
    const { data, error } = await supabase
      .from("brands")
      .select("id, name")
      .order("name", { ascending: true });

    if (error) return { success: false, error: error.message };
    return { success: true, data: data || [] };
  } catch (err) {
    return { success: false, error: err?.message || "Error cargando marcas" };
  }
};
