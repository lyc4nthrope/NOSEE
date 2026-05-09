/**
 * stores.api.js
 * Capa de acceso a datos para tiendas.
 *
 * Contrato uniforme de respuesta:
 *   { success: true, data: <payload> }
 *   { success: false, error: <string> }
 */

import { supabase } from "@/services/supabase.client";
import { detectRestrictedContentText } from "@/services/moderation";

const DEFAULT_RADIUS_METERS = 150;
const REQUEST_TIMEOUT_MS = 12000;
const NOMINATIM_TIMEOUT_MS = 6000;

async function withTimeout(promise, timeoutMs = REQUEST_TIMEOUT_MS, timeoutMessage = "Tiempo de espera agotado") {
  let timeoutId;

  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(timeoutMessage));
    }, timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    clearTimeout(timeoutId);
  }
}
const STORE_TYPE_ID = {
  physical: 1,
  virtual: 2,
};

/**
 * Decodifica WKB (Well-Known Binary / EWKB) hex de PostGIS.
 * Formato EWKB: 01 01000020 E6100000 [lon:8B] [lat:8B]
 */
function parseWKB(hexString) {
  try {
    const bytes = new Uint8Array(hexString.length / 2);
    for (let i = 0; i < hexString.length; i += 2) {
      bytes[i / 2] = parseInt(hexString.substr(i, 2), 16);
    }
    const view = new DataView(bytes.buffer);
    const littleEndian = bytes[0] === 1;
    const longitude = view.getFloat64(9, littleEndian);
    const latitude = view.getFloat64(17, littleEndian);
    if (Number.isFinite(longitude) && Number.isFinite(latitude)) {
      return { latitude: Number(latitude.toFixed(7)), longitude: Number(longitude.toFixed(7)) };
    }
  } catch {
    // ignorar
  }
  return null;
}

/**
 * Convierte POINT(lon lat) o WKB hex -> { latitude, longitude }.
 * Soporta WKT, EWKB hex y GeoJSON.
 */
function parsePointText(pointText) {
  if (!pointText) return null;

  // GeoJSON object
  if (typeof pointText === "object" && Array.isArray(pointText.coordinates)) {
    const [lon, lat] = pointText.coordinates;
    if (Number.isFinite(lon) && Number.isFinite(lat)) return { latitude: lat, longitude: lon };
    return null;
  }

  if (typeof pointText !== "string") return null;

  // WKT: POINT(lon lat)
  const match = pointText.match(
    /POINT\s*\(\s*([-+]?\d*\.?\d+)\s+([-+]?\d*\.?\d+)\s*\)/i,
  );
  if (match) {
    const longitude = Number(match[1]);
    const latitude = Number(match[2]);
    if (Number.isNaN(latitude) || Number.isNaN(longitude)) return null;
    return { latitude, longitude };
  }

  // WKB hex
  if (/^[0-9a-fA-F]+$/.test(pointText) && pointText.length >= 42) {
    return parseWKB(pointText);
  }

  return null;
}

function getUiTypeByStoreTypeId(storeTypeId) {
  if (Number(storeTypeId) === STORE_TYPE_ID.physical) return "physical";
  if (Number(storeTypeId) === STORE_TYPE_ID.virtual) return "virtual";
  return null;
}

function resolveStoreTypeId(type) {
  if (
    Number(type) === STORE_TYPE_ID.physical ||
    String(type).toLowerCase() === "physical"
  ) {
    return { success: true, data: STORE_TYPE_ID.physical };
  }

  if (
    Number(type) === STORE_TYPE_ID.virtual ||
    String(type).toLowerCase() === "virtual"
  ) {
    return { success: true, data: STORE_TYPE_ID.virtual };
  }

  return {
    success: false,
    error: "Tipo de tienda inválido. Usa Tienda física o Tienda virtual",
  };
}

function validateStoreContentPolicy({ name, address, websiteUrl }) {
  const fields = [
    { label: "nombre", value: name },
    { label: "dirección", value: address },
    { label: "sitio web", value: websiteUrl },
  ];

  for (const field of fields) {
    if (!field.value) continue;
    const moderation = detectRestrictedContentText(String(field.value));
    if (moderation.flagged) {
      return {
        success: false,
        error: `La ${field.label} contiene referencias restringidas (adulto/gore).`,
      };
    }
  }

  return { success: true };
}

function degreesToRadians(degrees) {
  return (degrees * Math.PI) / 180;
}

async function getCurrentUserId() {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) return { success: false, error: userError.message };

  const userId = userData?.user?.id;
  if (!userId) return { success: false, error: "Usuario no autenticado" };

  return { success: true, data: userId };
}

/**
 * Distancia Haversine en metros.
 */
function getDistanceMeters(lat1, lon1, lat2, lon2) {
  const earthRadius = 6371000;

  const dLat = degreesToRadians(lat2 - lat1);
  const dLon = degreesToRadians(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(degreesToRadians(lat1)) *
      Math.cos(degreesToRadians(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadius * c;
}

/**
 * Crea una tienda.
 *
 * Se usa `store_type_id` directamente:
 * - Tienda física  -> 1
 * - Tienda virtual -> 2
 *
 * @param {Object} payload
 * @param {string} payload.name
 * @param {'physical'|'virtual'|1|2} payload.type
 * @param {string=} payload.address
 * @param {number=} payload.latitude
 * @param {number=} payload.longitude
 * @param {string=} payload.websiteUrl
 * @param {number=} payload.distanceThresholdMeters
 */
export async function createStore(payload = {}) {
  try {
    const {
      name,
      type,
      address = null,
      latitude = null,
      longitude = null,
      websiteUrl = null,
      distanceThresholdMeters = DEFAULT_RADIUS_METERS,
    } = payload;

    const userResult = await getCurrentUserId();
    if (!userResult.success) return userResult;

    const storeTypeResult = resolveStoreTypeId(type);
    if (!storeTypeResult.success) return storeTypeResult;
    const policyResult = validateStoreContentPolicy({ name, address, websiteUrl });
    if (!policyResult.success) return policyResult;

    const insertPayload = {
      name: name?.trim(),
      created_by: userResult.data,
      store_type_id: storeTypeResult.data,
      address: address?.trim() || null,
      website_url: websiteUrl?.trim() || null,
    };

    if (
      latitude !== null && latitude !== undefined &&
      longitude !== null && longitude !== undefined &&
      Number.isFinite(Number(latitude)) &&
      Number.isFinite(Number(longitude))
    ) {
      const lat = Number(latitude);
      const lon = Number(longitude);
      insertPayload.location = `POINT(${lon} ${lat})`;
    }

    const { data: createdStore, error: insertError } = await supabase
      .from("stores")
      .insert(insertPayload)
      .select("id, name, address, website_url, store_type_id, location")
      .single();

    if (insertError) return { success: false, error: insertError.message };

    // Sumar reputación al creador de la tienda (best-effort)
    void (async () => {
      await supabase.rpc("increment_user_reputation", {
        target_user_id: userResult.data,
        reputation_delta: 3,
      });
    })();

    return {
      success: true,
      data: {
        success: true,
        store: {
          ...createdStore,
          type: getUiTypeByStoreTypeId(createdStore.store_type_id),
        },
        distance_threshold_m: distanceThresholdMeters,
      },
    };
  } catch (err) {
    return {
      success: false,
      error: err.message || "Error inesperado creando tienda",
    };
  }
}

/**
 * Adjunta una evidencia de tienda (máx 3 por tienda).
 * Reglas críticas deben mantenerse también en RLS/BD.
 *
 * @param {string|number} storeId
 * @param {string} imageUrl
 */
export async function uploadStoreEvidence(storeId, imageUrl) {
  try {
    if (!storeId) return { success: false, error: "storeId es obligatorio" };
    if (!imageUrl) return { success: false, error: "imageUrl es obligatorio" };

    const userResult = await getCurrentUserId();
    if (!userResult.success) return userResult;

    // Verificar tipo de tienda (solo física = 1)
    const { data: store, error: storeError } = await supabase
      .from("stores")
      .select("id, store_type_id, created_by")
      .eq("id", storeId)
      .single();

    if (storeError) return { success: false, error: storeError.message };

    if (Number(store?.store_type_id) !== STORE_TYPE_ID.physical) {
      return {
        success: false,
        error: "Solo las tiendas físicas permiten evidencias",
      };
    }


    if (store?.created_by !== userResult.data) {
      return {
        success: false,
        error: "Solo el creador de la tienda puede subir evidencias",
      };
    }

    // Verificar límite de 3 evidencias
    const { count, error: countError } = await supabase
      .from("store_evidences")
      .select("id", { count: "exact", head: true })
      .eq("store_id", storeId);

    if (countError) return { success: false, error: countError.message };

    if ((count || 0) >= 3) {
      return {
        success: false,
        error: "Máximo 3 imágenes de evidencia por tienda",
      };
    }

    const insertPayload = {
      store_id: storeId,
      image_url: imageUrl,
      uploaded_by: userResult.data,
    };

    const { data: insertedData, error: insertError } = await supabase
      .from("store_evidences")
      .insert(insertPayload)
      .select()
      .single();

    if (insertError || !insertedData) {
      const rawMessage = String(insertError?.message || "");
      const isTypeColumnSchemaMismatch =
        insertError?.code === "42703" &&
        rawMessage.toLowerCase().includes('column "type" does not exist');

      return {
        success: false,
        error: isTypeColumnSchemaMismatch
          ? "No se pudo guardar la evidencia: la función/trigger de base de datos está desactualizada y usa la columna type en stores."
          : insertError?.message || "No se pudo guardar la evidencia",
      };
    }

    return { success: true, data: insertedData };
  } catch (err) {
    return {
      success: false,
      error: err.message || "Error inesperado subiendo evidencia",
    };
  }
}

/**
 * Busca tiendas por nombre y opcionalmente filtra por radio en metros.
 *
 * Nota: si PostgREST devuelve geography como texto POINT(lon lat),
 * el filtrado por distancia se realiza en cliente con Haversine.
 *
 * @param {string} name
 * @param {number=} latitude
 * @param {number=} longitude
 * @param {number=} radiusMeters
 */
export async function searchNearbyStores(
  name,
  latitude = null,
  longitude = null,
  radiusMeters = DEFAULT_RADIUS_METERS,
) {
  try {
    if (!name || name.trim().length < 2) {
      return { success: true, data: [] };
    }

    const { data, error } = await withTimeout(
      supabase
        .from("stores")
        .select("id, name, store_type_id, address, website_url, location")
        .ilike("name", `%${name.trim()}%`)
        .limit(20),
      REQUEST_TIMEOUT_MS,
      "La búsqueda de tiendas tardó demasiado",
    );

    if (error) return { success: false, error: error.message };

    const canCalculateDistance =
      latitude !== null &&
      longitude !== null &&
      !Number.isNaN(Number(latitude)) &&
      !Number.isNaN(Number(longitude));

    const shouldFilterByDistance =
      canCalculateDistance && radiusMeters !== null && Number(radiusMeters) > 0;

    const mapped = (data || []).map((store) => {
      const point = parsePointText(store.location);
      const distanceMeters =
        canCalculateDistance && point
          ? getDistanceMeters(
              Number(latitude),
              Number(longitude),
              point.latitude,
              point.longitude,
            )
          : null;

      return {
        ...store,
        type: getUiTypeByStoreTypeId(store.store_type_id),
        latitude: point?.latitude ?? null,
        longitude: point?.longitude ?? null,
        distanceMeters,
      };
    });

    const filtered = shouldFilterByDistance
      ? mapped.filter(
          (store) =>
            store.distanceMeters === null ||
            store.distanceMeters <= Number(radiusMeters),
        )
      : mapped;

    return { success: true, data: filtered };
  } catch (err) {
    return {
      success: false,
      error: err.message || "Error inesperado buscando tiendas",
    };
  }
}

/**
 * Crea una tienda de forma simple (sin mapa ni evidencias).
 * Usado desde el modal rápido dentro del formulario de publicaciones.
 *
 * @param {string} name
 * @param {'physical'|'virtual'|1|2} type
 * @param {string|null} address
 * @param {string|null} websiteUrl
 * @param {number|null} latitude
 * @param {number|null} longitude
 */
export async function createStoreSimple(
  name,
  type = "physical",
  address = null,
  websiteUrl = null,
  latitude = null,
  longitude = null,
) {
  try {
    const userResult = await getCurrentUserId();
    if (!userResult.success) return userResult;

    const storeTypeResult = resolveStoreTypeId(type);
    if (!storeTypeResult.success) return storeTypeResult;
    const policyResult = validateStoreContentPolicy({
      name,
      address,
      websiteUrl,
    });
    if (!policyResult.success) return policyResult;

    const uiType = getUiTypeByStoreTypeId(storeTypeResult.data);
    const insert = {
      name: name.trim(),
      created_by: userResult.data,
      store_type_id: storeTypeResult.data,
    };

    if (uiType === "physical" && address?.trim())
      insert.address = address.trim();
    if (uiType === "virtual" && websiteUrl?.trim())
      insert.website_url = websiteUrl.trim();

    if (Number.isFinite(Number(latitude)) && Number.isFinite(Number(longitude)))
      insert.location = `POINT(${Number(longitude)} ${Number(latitude)})`;

    const { data, error } = await supabase
      .from("stores")
      .insert(insert)
      .select("id, name, address, website_url, store_type_id")
      .single();

    if (error) return { success: false, error: error.message };

    // Sumar reputación al creador de la tienda (best-effort)
    void (async () => {
      await supabase.rpc("increment_user_reputation", {
        target_user_id: userResult.data,
        reputation_delta: 3,
      });
    })();

    return {
      success: true,
      data: {
        ...data,
        type: getUiTypeByStoreTypeId(data.store_type_id),
      },
    };
  } catch (err) {
    return {
      success: false,
      error: err.message || "Error inesperado creando tienda",
    };
  }
}

export async function getStore(storeId) {
  if (!storeId) return { success: false, error: "storeId es obligatorio" };

  try {
    const { data: store, error } = await supabase
      .from("stores")
      .select("id, name, address, location, website_url, store_type_id, created_by")
      .eq("id", storeId)
      .single();

    if (error) return { success: false, error: error.message };

    const uiType = getUiTypeByStoreTypeId(store.store_type_id);
    const point = parsePointText(store.location);

    return {
      success: true,
      data: {
        id: store.id,
        name: store.name,
        type: uiType,
        address: store.address,
        latitude: point?.latitude ?? null,
        longitude: point?.longitude ?? null,
        websiteUrl: store.website_url,
      },
    };
  } catch (err) {
    return {
      success: false,
      error: err.message || "Error obteniendo tienda",
    };
  }
}

export async function updateStore(storeId, updates = {}) {
  if (!storeId) return { success: false, error: "storeId es obligatorio" };

  const safeUpdates = {};
  if (typeof updates.name === "string") safeUpdates.name = updates.name.trim();
  if (typeof updates.address === "string") safeUpdates.address = updates.address.trim() || null;
  if (typeof updates.websiteUrl === "string") safeUpdates.website_url = updates.websiteUrl.trim() || null;
  const policyResult = validateStoreContentPolicy({
    name: safeUpdates.name,
    address: safeUpdates.address,
    websiteUrl: safeUpdates.website_url,
  });
  if (!policyResult.success) return policyResult;
  if (Number.isFinite(Number(updates.latitude)) && Number.isFinite(Number(updates.longitude))) {
    const lat = Number(updates.latitude);
    const lon = Number(updates.longitude);
    safeUpdates.location = `POINT(${lon} ${lat})`;
  }

  if (Object.keys(safeUpdates).length === 0) {
    return { success: false, error: "No hay campos para actualizar" };
  }

  const { data, error } = await supabase
    .from("stores")
    .update(safeUpdates)
    .eq("id", storeId)
    .select("id, name, address, website_url, store_type_id, location")
    .single();

  if (error) return { success: false, error: error.message };
  const point = parsePointText(data.location);
  return {
    success: true,
    data: {
      ...data,
      type: getUiTypeByStoreTypeId(data.store_type_id),
      latitude: point?.latitude ?? null,
      longitude: point?.longitude ?? null,
    },
  };
}

/**
 * Lista tiendas con soporte de búsqueda y paginación.
 *
 * @param {string=} name - Filtro opcional por nombre
 * @param {number|object=} optionsOrLimit - límite legacy o { limit, page }
 */
export async function listStores(name = "", optionsOrLimit = 20) {
  try {
    const resolvedOptions =
      typeof optionsOrLimit === "number"
        ? { limit: optionsOrLimit, page: 1 }
        : (optionsOrLimit || {});

    const safeLimit = Math.max(5, Math.min(Number(resolvedOptions.limit) || 20, 60));
    const safePage = Math.max(1, Number(resolvedOptions.page) || 1);
    const offset = (safePage - 1) * safeLimit;

    let query = supabase
      .from("stores")
      .select("id, name, store_type_id, address, website_url, location, created_by")
      .order("name", { ascending: true })
      .range(offset, offset + safeLimit - 1);

    if (name && name.trim().length >= 1) {
      query = query.ilike("name", `%${name.trim()}%`);
    }

    const { data, error } = await withTimeout(query, REQUEST_TIMEOUT_MS, "La carga de tiendas tardó demasiado");

    if (error) return { success: false, error: error.message };

    const mapped = (data || []).map((store) => {
      const point = parsePointText(store.location);
      return {
        ...store,
        type: getUiTypeByStoreTypeId(store.store_type_id),
        latitude: point?.latitude ?? null,
        longitude: point?.longitude ?? null,
      };
    });

    return {
      success: true,
      data: mapped,
      hasMore: mapped.length === safeLimit,
      page: safePage,
    };
  } catch (err) {
    return { success: false, error: err.message || "Error cargando tiendas" };
  }
}

const normalizeText = (value = "") =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

const inferChainName = (payload = {}) => {
  const parts = [
    payload?.name,
    payload?.display_name,
    payload?.namedetails?.name,
    payload?.namedetails?.official_name,
    payload?.extratags?.brand,
    payload?.extratags?.name,
    payload?.address?.shop,
    payload?.address?.supermarket,
    payload?.address?.retail,
  ]
    .filter(Boolean)
    .map((v) => String(v));

  const haystack = normalizeText(parts.join(" "));
  if (!haystack) return "";

  if (/\bd1\b/.test(haystack)) return "D1";
  if (/\bara\b/.test(haystack)) return "Ara";
  if (haystack.includes("olimpica")) return "Olímpica";
  if (haystack.includes("exito")) return "Éxito";
  if (haystack.includes("jumbo")) return "Jumbo";
  if (haystack.includes("carulla")) return "Carulla";

  const rawName =
    payload?.name ||
    payload?.namedetails?.name ||
    payload?.extratags?.brand ||
    payload?.extratags?.name ||
    String(payload?.display_name || "").split(",")[0] ||
    "";

  return String(rawName).trim();
};

/**
 * Detecta comercio en el punto del mapa (POI) usando Nominatim.
 * Prioriza cadenas conocidas (D1/Ara) para autocompletado.
 */
export async function detectMapPlaceAtLocation(latitude, longitude) {
  const lat = Number(latitude);
  const lon = Number(longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return { success: false, error: "Coordenadas inválidas para detección en mapa" };
  }

  const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
  const timeoutId = setTimeout(() => controller?.abort(), NOMINATIM_TIMEOUT_MS);

  try {
    const url = new URL("https://nominatim.openstreetmap.org/reverse");
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("lat", String(lat));
    url.searchParams.set("lon", String(lon));
    url.searchParams.set("zoom", "18");
    url.searchParams.set("addressdetails", "1");
    url.searchParams.set("namedetails", "1");
    url.searchParams.set("extratags", "1");

    const response = await fetch(url.toString(), {
      headers: { Accept: "application/json" },
      signal: controller?.signal,
    });

    if (!response.ok) {
      return { success: true, data: null };
    }

    const payload = await response.json();
    const placeName = inferChainName(payload);
    const address = String(payload?.display_name || "").trim();

    if (!placeName) return { success: true, data: null };

    return {
      success: true,
      data: {
        placeName,
        address,
      },
    };
  } catch {
    return { success: true, data: null };
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Busca la tienda física más cercana al usuario recorriendo tiendas por lotes.
 * Evita el sesgo por orden alfabético + límite bajo en autodetección.
 *
 * @param {number} latitude
 * @param {number} longitude
 * @param {Object=} options
 * @param {number=} options.maxCandidates
 * @param {number=} options.batchSize
 */
export async function findNearestPhysicalStore(
  latitude,
  longitude,
  { maxCandidates = 1500, batchSize = 250 } = {},
) {
  const userLat = Number(latitude);
  const userLon = Number(longitude);
  if (!Number.isFinite(userLat) || !Number.isFinite(userLon)) {
    return { success: false, error: "Coordenadas inválidas para detectar tienda cercana" };
  }

  const safeMaxCandidates = Math.max(100, Math.min(Number(maxCandidates) || 1500, 5000));
  const safeBatchSize = Math.max(50, Math.min(Number(batchSize) || 250, 500));

  let nearest = null;
  let scanned = 0;
  let offset = 0;

  try {
    while (scanned < safeMaxCandidates) {
      const remaining = safeMaxCandidates - scanned;
      const currentBatch = Math.min(safeBatchSize, remaining);
      const from = offset;
      const to = offset + currentBatch - 1;

      const { data, error } = await withTimeout(
        supabase
          .from("stores")
          .select("id, name, store_type_id, address, website_url, location")
          .eq("store_type_id", STORE_TYPE_ID.physical)
          .not("location", "is", null)
          .order("id", { ascending: true })
          .range(from, to),
        REQUEST_TIMEOUT_MS,
        "La detección automática de tienda tardó demasiado",
      );

      if (error) return { success: false, error: error.message };

      const batch = data || [];
      if (batch.length === 0) break;

      for (const store of batch) {
        const point = parsePointText(store.location);
        if (!point) continue;

        const distanceMeters = getDistanceMeters(
          userLat,
          userLon,
          point.latitude,
          point.longitude,
        );

        if (!nearest || distanceMeters < nearest.distanceMeters) {
          nearest = {
            ...store,
            type: getUiTypeByStoreTypeId(store.store_type_id),
            latitude: point.latitude,
            longitude: point.longitude,
            distanceMeters,
          };
        }
      }

      scanned += batch.length;
      offset += batch.length;
      if (batch.length < currentBatch) break;
    }

    return { success: true, data: nearest, meta: { scanned } };
  } catch (err) {
    return {
      success: false,
      error: err.message || "Error detectando tienda cercana",
    };
  }
}

/**
 * Obtiene publicaciones recientes de una tienda específica.
 *
 * @param {string|number} storeId
 * @param {number=} limit
 */
export async function getStorePublications(storeId, limit = 6) {
  if (!storeId) return { success: false, error: "storeId es obligatorio" };

  try {
    const { data, error } = await supabase
      .from("price_publications")
      .select("id, price, description, photo_url, created_at, product:products (id, name)")
      .eq("store_id", storeId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) return { success: false, error: error.message };

    return { success: true, data: data || [] };
  } catch (err) {
    return { success: false, error: err.message || "Error obteniendo publicaciones de la tienda" };
  }
}

/**
 * Obtiene las imágenes de evidencia de una tienda.
 * @param {string|number} storeId
 */
export async function getStoreEvidences(storeId) {
  if (!storeId) return { success: false, error: "storeId es obligatorio" };

  try {
    const { data, error } = await supabase
      .from("store_evidences")
      .select("id, image_url, created_at")
      .eq("store_id", storeId)
      .order("created_at", { ascending: true });

    if (error) return { success: false, error: error.message };
    return { success: true, data: data || [] };
  } catch (err) {
    return { success: false, error: err.message || "Error obteniendo evidencias" };
  }
}

/**
 * Obtiene todas las tiendas físicas con coordenadas registradas.
 * Usado para detección automática de tienda más cercana.
 */
export async function getAllPhysicalStoresWithLocation() {
  try {
    const { data, error } = await withTimeout(
      supabase
        .from("stores")
        .select("id, name, store_type_id, address, location")
        .eq("store_type_id", STORE_TYPE_ID.physical)
        .not("location", "is", null),
      REQUEST_TIMEOUT_MS,
      "La carga de tiendas tardó demasiado",
    );

    if (error) return { success: false, error: error.message };

    const mapped = (data || []).map((store) => {
      const point = parsePointText(store.location);
      return {
        ...store,
        type: "physical",
        latitude: point?.latitude ?? null,
        longitude: point?.longitude ?? null,
      };
    }).filter((s) => s.latitude !== null && s.longitude !== null);

    return { success: true, data: mapped };
  } catch (err) {
    return { success: false, error: err.message || "Error cargando tiendas físicas" };
  }
}

export default {
  createStore,
  createStoreSimple,
  uploadStoreEvidence,
  searchNearbyStores,
  listStores,
  detectMapPlaceAtLocation,
  findNearestPhysicalStore,
  getAllPhysicalStoresWithLocation,
  getStore,
  updateStore,
  getStorePublications,
  getStoreEvidences,
};
