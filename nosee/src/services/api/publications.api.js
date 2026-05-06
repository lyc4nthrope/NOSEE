/**
 * publications.api.js
 *
 * API para gestionar publicaciones de precios en NØSEE
 *
 * UBICACIÓN: src/services/api/publications.api.js
 * FECHA: 26-02-2026
 * STATUS: Paso 1 de Proceso 2
 *
 * FUNCIONES:
 * - createPublication()      : Crear nueva publicación de precio
 * - getPublications()        : Obtener publicaciones con filtros
 * - getPublicationDetail()   : Obtener detalles de una publicación
 * - validatePublication()    : Votar (upvote/downvote) una publicación
 * - reportPublication()      : Reportar una publicación
 * - updatePublication()      : Editar propia publicación
 * - deletePublication()      : Eliminar publicación (soft-delete por defecto, hard-delete admin opcional)
 */

import { supabase } from "@/services/supabase.client";
import { uploadImageToCloudinary } from "@/services/cloudinary";
import {
  detectInappropriateText,
  detectRestrictedContentText,
  detectIndecentImageByModeration,
} from "@/services/moderation";
import { recordVote, recordPublicationReport, recordVoteDuplicateRejected, recordVoteDuplicateAttempted, recordVoteProcessingDuration, recordDbQueryDuration } from "@/services/metrics";

import { clamp, normalizeSearchText } from "@/services/utils/normalization";
import { hasCoordinates, parseStoreLocation, calculateDistance } from "@/services/utils/geoUtils";
import {
  REQUEST_TIMEOUT_MS, EXTENDED_RETRY_TIMEOUT_MS,
  HYDRATION_TIMEOUT_MS, getRuntimeNetworkState,
  getAdaptiveRequestTimeout, withTimeout, isTimeoutMessage, runWithSessionRetry
} from "@/services/utils/requestUtils";
import { createAutoModerationReport } from "@/services/utils/moderationReports";
import {
  searchProductsAndBrands, searchProducts, findProductByBarcode, getProducts, getStores,
  searchStores, createProduct, updateProduct, createBrand, getProductCategories, getUnitTypes, searchBrands
} from "@/services/api/products.api";
import { getComments, addComment, deleteComment } from "@/services/api/comments.api";

// ─── TIPOS / INTERFACES ───────────────────────────────────────────────────────

/**
 * Tipo de publicación (para búsqueda)
 */
export const PUBLICATION_STATUS = {
  PENDING: "pending",
  VALIDATED: "validated",
  REJECTED: "rejected",
  EXPIRED: "expired",
};

/**
 * Orden de resultados
 */
export const SORT_OPTIONS = {
  RECENT: "recent",
  VALIDATED: "validated",
  CHEAPEST: "cheapest",
  BEST_MATCH: "best_match",
};

const SEARCH_SORT_FIELDS = new Set([
  SORT_OPTIONS.RECENT,
  SORT_OPTIONS.VALIDATED,
  SORT_OPTIONS.CHEAPEST,
  SORT_OPTIONS.BEST_MATCH,
]);

const REQUIRE_IMAGE_MODERATION =
  String(import.meta.env.VITE_REQUIRE_IMAGE_MODERATION || "false").toLowerCase() === "true";

const hasUserIdentity = (candidate) =>
  !!candidate && typeof candidate === "object" && !!(candidate.id || candidate.full_name);

const hasStoreIdentity = (candidate) =>
  !!candidate && typeof candidate === "object" && !!(candidate.id || candidate.name);

const hydrateRelatedPublicationData = async (publications = []) => {
  if (!Array.isArray(publications) || publications.length === 0) {
    return publications;
  }

  const missingUserIds = [...new Set(
    publications
      .filter((publication) => {
        const embeddedUser = publication?.user || publication?.users;
        return !hasUserIdentity(embeddedUser) && publication?.user_id;
      })
      .map((publication) => publication.user_id),
  )];

  const missingStoreIds = [...new Set(
    publications
      .filter((publication) => {
        const embeddedStore = publication?.store || publication?.stores;
        return !hasStoreIdentity(embeddedStore) && publication?.store_id;
      })
      .map((publication) => publication.store_id),
  )];

  const usersById = {};
  const storesById = {};

   const hydrationTasks = [];

  if (missingUserIds.length > 0) {
       hydrationTasks.push(
      withTimeout(
        supabase
          .from("users")
          .select("id, full_name, reputation_points")
          .in("id", missingUserIds),
        HYDRATION_TIMEOUT_MS,
        "Tiempo de espera agotado hidratando usuarios de publicaciones",
      )
        .then(({ data: usersData, error: usersError }) => {
          if (usersError) {
            console.error("Error hidratando usuarios de publicaciones:", usersError);
            return;
          }

          (usersData || []).forEach((userRow) => {
            usersById[userRow.id] = userRow;
          });
        })
        .catch((hydrateUserError) => {
          console.error("Timeout/exception hidratando usuarios de publicaciones:", hydrateUserError);
        }),
      );
  }

  if (missingStoreIds.length > 0) {
      hydrationTasks.push(
      withTimeout(
        supabase
          .from("stores")
          .select("id, name, address, location")
          .in("id", missingStoreIds),
        HYDRATION_TIMEOUT_MS,
        "Tiempo de espera agotado hidratando tiendas de publicaciones",
      )
        .then(({ data: storesData, error: storesError }) => {
          if (storesError) {
            console.error("Error hidratando tiendas de publicaciones:", storesError);
            return;
          }

          (storesData || []).forEach((storeRow) => {
            storesById[storeRow.id] = storeRow;
          });
        })
        .catch((hydrateStoreError) => {
          console.error("Timeout/exception hidratando tiendas de publicaciones:", hydrateStoreError);
        }),
      );
    }
    if (hydrationTasks.length > 0) {
      await Promise.allSettled(hydrationTasks);
    }

  return publications.map((publication) => {
    const embeddedUser = publication?.user || publication?.users || null;
    const embeddedStore = publication?.store || publication?.stores || null;

    return {
      ...publication,
      user: hasUserIdentity(embeddedUser)
        ? embeddedUser
        : usersById[publication.user_id] || null,
      store: hasStoreIdentity(embeddedStore)
        ? embeddedStore
        : storesById[publication.store_id] || null,
    };
  });
};

const enrichPublicationsWithVoteCounts = async (publications) => {
  if (!Array.isArray(publications) || publications.length === 0) {
    return publications;
  }

  const publicationIds = publications.map((p) => p.id);

  const { data: { user } } = await supabase.auth.getUser();
  const currentUserId = user?.id || null;

  const [votesResult, reportsResult, userVotesResult] = await Promise.all([
    supabase.from("publication_votes").select("publication_id, vote_type").in("publication_id", publicationIds),
    supabase
      .from("reports")
      .select("reported_id, status")
      .eq("reported_type", "publication")
      .in("reported_id", publicationIds.map(String)),
    currentUserId
      ? supabase.from("publication_votes").select("publication_id, vote_type").in("publication_id", publicationIds).eq("user_id", currentUserId)
      : Promise.resolve({ data: [] }),
  ]);

  const voteCountByPublication = {};
  (votesResult.data || []).forEach((row) => {
    const current = voteCountByPublication[row.publication_id] || { positive: 0, negative: 0 };
    if (row.vote_type === 1) current.positive += 1;
    if (row.vote_type === -1) current.negative += 1;
    voteCountByPublication[row.publication_id] = current;
  });

  const reportCountByPublication = {};
  (reportsResult.data || []).forEach((row) => {
    const publicationId = Number(row.reported_id);
    if (!Number.isFinite(publicationId)) return;
    if (String(row.status || "").toLowerCase() !== "rejected") {
      reportCountByPublication[publicationId] = (reportCountByPublication[publicationId] || 0) + 1;
    }
  });

  const userVoteByPublication = {};
  (userVotesResult.data || []).forEach((row) => {
    userVoteByPublication[row.publication_id] = row.vote_type;
  });

  return publications.map((pub) => ({
    ...pub,
    validated_count: (voteCountByPublication[pub.id]?.positive || 0),
    downvoted_count: (voteCountByPublication[pub.id]?.negative || 0),
    reported_count: (reportCountByPublication[pub.id] || 0),
    user_vote: userVoteByPublication[pub.id] ?? null,
  }));
};

const enrichSearchRankingSignals = async (publications, filters = {}) => {
  if (!Array.isArray(publications) || publications.length === 0) {
    return publications;
  }

  const publicationIds = publications.map((publication) => publication.id);
  const storeIds = [...new Set(publications.map((publication) => publication.store_id).filter(Boolean))];
  const productIds = [...new Set(publications.map((publication) => publication.product_id).filter(Boolean))];

  const [votesResult, reportsResult, evidenceResult, productStatsResult] = await Promise.all([
    supabase.from("publication_votes").select("publication_id, vote_type").in("publication_id", publicationIds),
    supabase
      .from("reports")
      .select("reported_id, status, evidence_url")
      .eq("reported_type", "publication")
      .in("reported_id", publicationIds.map(String)),
    supabase.from("store_evidences").select("store_id").in("store_id", storeIds),
    supabase.from("price_publications").select("product_id, price").in("product_id", productIds),
  ]);

  const votesByPublication = {};
  (votesResult.data || []).forEach((row) => {
    const current = votesByPublication[row.publication_id] || { positive: 0, negative: 0 };
    if (row.vote_type === 1) current.positive += 1;
    if (row.vote_type === -1) current.negative += 1;
    votesByPublication[row.publication_id] = current;
  });

  const reportsByPublication = {};
  (reportsResult.data || []).forEach((row) => {
    const publicationId = Number(row.reported_id);
    if (!Number.isFinite(publicationId)) return;
    const current = reportsByPublication[publicationId] || { active: 0, evidences: 0 };
    if (String(row.status || "").toLowerCase() !== "rejected") {
      current.active += 1;
      if (row.evidence_url) current.evidences += 1;
    }
    reportsByPublication[publicationId] = current;
  });

  const evidencesByStore = {};
  (evidenceResult.data || []).forEach((row) => {
    evidencesByStore[row.store_id] = (evidencesByStore[row.store_id] || 0) + 1;
  });

  const productPriceStats = {};
  (productStatsResult.data || []).forEach((row) => {
    if (!productPriceStats[row.product_id]) {
      productPriceStats[row.product_id] = { min: Number(row.price), total: 0, count: 0 };
    }
    const stat = productPriceStats[row.product_id];
    const price = Number(row.price);
    if (price < stat.min) stat.min = price;
    stat.total += price;
    stat.count += 1;
  });

  const hasSearchTerm = String(filters.productName || "").trim().length > 0 || String(filters.storeName || "").trim().length > 0;
  const normalizedSortBy = String(filters.sortBy || SORT_OPTIONS.RECENT);
  const normalizedProductQuery = normalizeSearchText(filters.productName || "");
  const normalizedStoreQuery = normalizeSearchText(filters.storeName || "");
  const shouldSortByScore =
    normalizedSortBy === SORT_OPTIONS.BEST_MATCH ||
    (normalizedSortBy === SORT_OPTIONS.RECENT && hasSearchTerm);

  return publications
    .map((publication) => {
      const voteSignals = votesByPublication[publication.id] || { positive: 0, negative: 0 };
      const reportSignals = reportsByPublication[publication.id] || { active: 0, evidences: 0 };
      const userReputation = Number(publication?.user?.reputation_points || 0);
      const storeEvidences = Number(evidencesByStore[publication.store_id] || 0);
      const stats = productPriceStats[publication.product_id] || null;
      const productName = publication?.product?.name || publication?.products?.name || "";
      const productBrand = publication?.product?.brand?.name || publication?.products?.brand?.name || "";
      const storeName = publication?.store?.name || publication?.stores?.name || "";
      const normalizedProductText = normalizeSearchText(`${productName} ${productBrand}`);
      const normalizedStoreText = normalizeSearchText(storeName);

      const distanceScore = Number.isFinite(publication.distance_km)
        ? clamp(1 - publication.distance_km / 50, 0, 1)
        : 0.45;
      const voteBalance = voteSignals.positive - voteSignals.negative;
      const voteScore = clamp((voteBalance + 5) / 10, 0, 1);
      const reportScore = clamp(1 - reportSignals.active / 5, 0, 1);
      const reputationScore = clamp(userReputation / 500, 0, 1);
      const evidenceScore = clamp((storeEvidences + reportSignals.evidences) / 8, 0, 1);
      const priceScore = stats
        ? clamp(((stats.total / Math.max(stats.count, 1)) - Number(publication.price)) / Math.max(stats.total / Math.max(stats.count, 1), 1) + 0.5, 0, 1)
        : 0.5;

      const productTextScore = normalizedProductQuery
        ? normalizedProductText === normalizedProductQuery
          ? 1
          : normalizedProductText.startsWith(normalizedProductQuery)
            ? 0.92
            : normalizedProductText.includes(normalizedProductQuery)
              ? 0.78
              : 0
        : 0.5;

      const storeTextScore = normalizedStoreQuery
        ? normalizedStoreText === normalizedStoreQuery
          ? 1
          : normalizedStoreText.startsWith(normalizedStoreQuery)
            ? 0.9
            : normalizedStoreText.includes(normalizedStoreQuery)
              ? 0.72
              : 0
        : 0.5;

      const textScore =
        normalizedProductQuery || normalizedStoreQuery
          ? clamp(
              (normalizedProductQuery ? productTextScore * 0.75 : 0) +
                (normalizedStoreQuery ? storeTextScore * 0.25 : 0),
              0,
              1,
            )
          : 0.5;

      const searchScore =
        0.45 * textScore +
        0.2 * priceScore +
        0.14 * distanceScore +
        0.1 * voteScore +
        0.06 * reportScore +
        0.03 * reputationScore +
        0.02 * evidenceScore;

      return {
        ...publication,
        search_signals: {
          ...voteSignals,
          reports_active: reportSignals.active,
          reports_with_evidence: reportSignals.evidences,
          store_evidences: storeEvidences,
          text_score: Number(textScore.toFixed(4)),
          user_reputation_points: userReputation,
          product_avg_price: stats ? stats.total / Math.max(stats.count, 1) : null,
          product_min_price: stats ? stats.min : null,
        },
        search_score: Number(searchScore.toFixed(4)),
      };
    })
    .sort((a, b) => {
      if (shouldSortByScore) {
        return (b.search_score || 0) - (a.search_score || 0);
      }
      return 0;
    });
};

// ─── 1️⃣ CREAR PUBLICACIÓN ────────────────────────────────────────────────────

/**
 * Crear una nueva publicación de precio
 *
 * @param {Object} data
 * @param {number} data.productId - ID del producto
 * @param {number} data.storeId - ID de la tienda
 * @param {number} data.price - Precio (debe ser > 0)
 * @param {string} data.currency - Moneda (COP, USD, etc.)
 * @param {string} data.photoUrl - URL de la foto (Cloudinary)
 * @param {string} data.description - Descripción corta (max 500 chars)
 * @param {number} data.latitude - Latitud (de geolocation)
 * @param {number} data.longitude - Longitud (de geolocation)
 *
 * @returns {Promise} { success, data, error }
 *
 * @example
 * const result = await createPublication({
 *   productId: 1,
 *   storeId: 5,
 *   price: 15999,
 *   currency: 'COP',
 *   photoUrl: 'https://res.cloudinary.com/...',
 *   description: 'Buen estado, precio justo',
 *   latitude: 4.7110,
 *   longitude: -74.0721,
 * });
 */
export const createPublication = async (data) => {
  try {
    // Validaciones básicas
    if (!data.productId || !data.storeId || !data.price) {
      return { success: false, error: "Faltan datos requeridos" };
    }

    if (data.price <= 0) {
      return { success: false, error: "El precio debe ser mayor a 0" };
    }

    if (data.description && data.description.length > 500) {
      return {
        success: false,
        error: "Descripción muy larga (máx 500 caracteres)",
      };
    }

    if (!data.photoUrl) {
      return { success: false, error: "La foto es obligatoria" };
    }

    // Obtener usuario actual
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, error: "Usuario no autenticado" };
    }

    if (REQUIRE_IMAGE_MODERATION && !data.photoModeration) {
      return {
        success: false,
        error:
          "No fue posible validar la seguridad de la imagen. Intenta con otra foto o contacta al administrador.",
      };
    }

    // Verificar estado del usuario (activo + verificado)
    const authEmailConfirmed = !!user.email_confirmed_at;
    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("is_verified, is_active")
      .eq("id", user.id)
      .single();

    const profileVerified = !!userData?.is_verified;
    const profileActive = userData?.is_active !== false;

    if (userError || !profileActive) {
      return {
        success: false,
        error: "Tu cuenta no está habilitada para publicar",
      };
    }

    if (!profileVerified && !authEmailConfirmed) {
      return {
        success: false,
        error: "Debes verificar tu email para publicar",
      };
    }

    // Evitar duplicados del mismo usuario/producto/tienda en las últimas 24h
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: duplicatePublication, error: duplicateError } = await supabase
      .from("price_publications")
      .select("id")
      .eq("user_id", user.id)
      .eq("product_id", data.productId)
      .eq("store_id", data.storeId)
      .gte("created_at", since24h)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (duplicateError) {
      return { success: false, error: duplicateError.message };
    }

    if (duplicatePublication) {
      return {
        success: false,
        error:
          "Ya publicaste este producto en esta tienda durante las últimas 24 horas",
      };
    }

    // Calcular puntuación inicial de confiabilidad basada en reputación del usuario
    const { data: userProfile } = await supabase
      .from("users")
      .select("reputation_points")
      .eq("id", user.id)
      .single();
    const reputationPoints = userProfile?.reputation_points ?? 0;
    const confidence_score = Math.min(1.0, 0.5 + reputationPoints / 1000);

    const textModeration = detectInappropriateText(data.description || "");
    const restrictedContentModeration = detectRestrictedContentText(
      data.description || "",
    );
    const imageModeration = detectIndecentImageByModeration(data.photoModeration);
    const shouldHardBlock =
      restrictedContentModeration.flagged || imageModeration.flagged;

    if (shouldHardBlock) {
      const reasons = [];
      if (restrictedContentModeration.flagged) {
        reasons.push(
          `Texto con contenido restringido: ${restrictedContentModeration.matches.join(", ")}`,
        );
      }
      if (imageModeration.flagged) {
        reasons.push(
          `${imageModeration.reason || "Imagen con contenido adulto/gore"} (confianza: ${imageModeration.confidence ?? "n/a"})`,
        );
      }

      await createAutoModerationReport({
        reportedType: "user",
        reportedId: user.id,
        reporterUserId: user.id,
        reportedUserId: user.id,
        reason: "offensive",
        description: `AUTO-MODERATION BLOCK (publication): ${reasons.join(" | ")}`,
      });

      return {
        success: false,
        error:
          "No se permitió publicar porque la imagen o el texto parecen contener contenido adulto/gore.",
      };
    }

    // Crear la publicación
    const payload = {
      product_id: data.productId,
      store_id: data.storeId,
      user_id: user.id,
      price: data.price,
      photo_url: data.photoUrl,
      description: data.description || "No hay descripción",
      confidence_score,
    };

    const _t0Pub = Date.now();
    const { data: publication, error } = await supabase
      .from("price_publications")
      .insert(payload)
      .select()
      .single();
    recordDbQueryDuration('publication_insert', (Date.now() - _t0Pub) / 1000);

    if (error) {
      console.error("Error creando publicación:", error);
      return { success: false, error: error.message };
    }

    // Moderación automática adicional por lenguaje inapropiado (insultos, etc.)
    const shouldAutoModerate = textModeration.flagged;

    if (shouldAutoModerate) {
      const moderationDescriptionParts = [];
      if (textModeration.flagged) {
        moderationDescriptionParts.push(
          `Texto inapropiado detectado (score ${textModeration.score}/${textModeration.threshold}): ${textModeration.matches.map((m) => m.term).join(", ")}`,
        );
      }
      if (restrictedContentModeration.flagged) {
        moderationDescriptionParts.push(
          `Contenido restringido (adulto/gore) detectado: ${restrictedContentModeration.matches.join(", ")}`,
        );
      }
      if (imageModeration.flagged) {
        moderationDescriptionParts.push(
          `${imageModeration.reason || "Imagen potencialmente indecente detectada"} (confianza: ${imageModeration.confidence ?? "n/a"})`,
        );
      }

      await supabase
        .from("price_publications")
        .update({
          is_active: false,
          is_admin_hidden: true,
          hidden_admin_at: new Date().toISOString(),
          hidden_admin_by: user.id,
          hidden_admin_reason: "Moderación automática por contenido sensible",
        })
        .eq("id", publication.id);

      await createAutoModerationReport({
        reportedType: "publication",
        reportedId: publication.id,
        reporterUserId: user.id,
        reportedUserId: user.id,
        reason: "offensive",
        description: `AUTO-MODERATION: ${moderationDescriptionParts.join(" | ")}`,
      });

      return {
        success: true,
        data: publication,
        autoModerated: true,
        message:
          "Tu publicación fue enviada automáticamente a revisión por posible contenido inapropiado.",
      };
    }

    // Sumar reputación al autor por crear publicación (best-effort)
    void (async () => {
      await supabase.rpc("increment_user_reputation", {
        target_user_id: user.id,
        reputation_delta: 5,
      });
    })();

    return { success: true, data: publication };
  } catch (err) {
    console.error("Error en createPublication:", err);
    return { success: false, error: err.message };
  }
};

// ─── 2️⃣ OBTENER PUBLICACIONES CON FILTROS ─────────────────────────────────────

/**
 * Obtener publicaciones de precios con filtros opcionales
 *
 * @param {Object} filters
 * @param {string} filters.productName - Nombre del producto (búsqueda)
 * @param {string} filters.storeName - Nombre de la tienda (búsqueda)
 * @param {number} filters.minPrice - Precio mínimo
 * @param {number} filters.maxPrice - Precio máximo
 * @param {number} filters.maxDistance - Distancia máxima en km
 * @param {number} filters.latitude - Latitud del usuario (para distancia)
 * @param {number} filters.longitude - Longitud del usuario (para distancia)
 * @param {string} filters.sortBy - 'recent', 'validated', 'cheapest'
 * @param {number} filters.page - Número de página (default 1)
 * @param {number} filters.limit - Resultados por página (default 20)
 *
 * @returns {Promise} { success, data, count, hasMore, error }
 *
 * @example
 * const result = await getPublications({
 *   productName: 'aceite',
 *   maxPrice: 30000,
 *   maxDistance: 5,
 *   latitude: 4.7110,
 *   longitude: -74.0721,
 *   sortBy: 'cheapest',
 *   page: 1,
 *   limit: 20,
 * });
 */
export const getPublications = async (filters = {}) => {
  const startedAt = Date.now();
  try {
    const runtimeStateAtStart = getRuntimeNetworkState();
    console.info("[NØSEE:publications.api] getPublications:start", {
      runtime: runtimeStateAtStart,
      hasDistanceFilter: filters?.maxDistance !== null && filters?.maxDistance !== undefined,
      hasCoords: hasCoordinates(filters?.latitude, filters?.longitude),
      page: filters?.page ?? 1,
      limit: filters?.limit ?? 20,
    });

    const {
      productId = null,
      productName = "",
      storeName = "",
      minPrice = null,
      maxPrice = null,
      maxDistance = null,
      latitude = null,
      longitude = null,
      sortBy = "recent",
      page = 1,
      limit = 20,
      categoryId = null,
    } = filters;
     const offset = (page - 1) * limit;

    const hasMinPrice = minPrice !== null && minPrice !== undefined && String(minPrice).trim() !== "";
    const hasMaxPrice = maxPrice !== null && maxPrice !== undefined && String(maxPrice).trim() !== "";

    let normalizedMinPrice = hasMinPrice ? Number(minPrice) : null;
    let normalizedMaxPrice = hasMaxPrice ? Number(maxPrice) : null;

    if (Number.isFinite(normalizedMinPrice) && normalizedMinPrice < 0) {
      normalizedMinPrice = null;
    }
    if (Number.isFinite(normalizedMaxPrice) && normalizedMaxPrice < 0) {
      normalizedMaxPrice = null;
    }
    if (
      Number.isFinite(normalizedMinPrice) &&
      Number.isFinite(normalizedMaxPrice) &&
      normalizedMinPrice > normalizedMaxPrice
    ) {
      [normalizedMinPrice, normalizedMaxPrice] = [normalizedMaxPrice, normalizedMinPrice];
    }

    const normalizedMaxDistance = Number(maxDistance);
    const shouldApplyDistanceFilter =
      Number.isFinite(normalizedMaxDistance) &&
      normalizedMaxDistance > 0 &&
      hasCoordinates(latitude, longitude);
    const shouldComputeDistanceSignals = hasCoordinates(latitude, longitude);

    // Pre-filtro: IDs de productos cuyo nombre O cuya marca coincide con productName
    let productIdFilter = null;
    const normalizedProductId = Number(productId);

    if (Number.isFinite(normalizedProductId) && normalizedProductId > 0) {
      productIdFilter = [normalizedProductId];
    } else if (productName) {
      const productSearchTerm = String(productName).trim();
      const normalizedProductSearchTerm = normalizeSearchText(productSearchTerm);
      const seedTerm = productSearchTerm.length >= 3 ? productSearchTerm.slice(0, 3) : productSearchTerm;

      const [{ data: rawProducts, error: productSearchError }, { data: rawBrands }] = await Promise.all([
        supabase
          .from("products")
          .select("id, name, brand:brands(id, name)")
          .ilike("name", `%${seedTerm}%`)
          .limit(400),
        supabase
          .from("brands")
          .select("id, name")
          .ilike("name", `%${seedTerm}%`)
          .limit(120),
      ]);

      if (productSearchError) {
        return { success: false, error: productSearchError.message };
      }

      const matchingProducts = (rawProducts || []).filter((product) => {
        const normalizedName = normalizeSearchText(product.name);
        const normalizedBrandName = normalizeSearchText(product?.brand?.name || "");
        return (
          normalizedName.includes(normalizedProductSearchTerm) ||
          normalizedBrandName.includes(normalizedProductSearchTerm)
        );
      });

      const matchingBrands = (rawBrands || []).filter((brand) =>
        normalizeSearchText(brand.name).includes(normalizedProductSearchTerm),
      );

      const productIdsByName = matchingProducts.map((p) => p.id);

      let productIdsByBrand = [];
      if (matchingBrands.length > 0) {
        const brandIds = matchingBrands.map((b) => b.id);
        const { data: brandProducts } = await supabase
          .from("products")
          .select("id")
          .in("brand_id", brandIds);
        productIdsByBrand = (brandProducts || []).map((p) => p.id);
      }

      productIdFilter = [...new Set([...productIdsByName, ...productIdsByBrand])];

      if (productIdFilter.length === 0) {
        const [{ data: broadProducts }, { data: broadBrands }] = await Promise.all([
          supabase
            .from("products")
            .select("id, name, brand:brands(id, name)")
            .limit(2000),
          supabase
            .from("brands")
            .select("id, name")
            .limit(800),
        ]);

        const fallbackMatchingProducts = (broadProducts || []).filter((product) => {
          const normalizedName = normalizeSearchText(product.name);
          const normalizedBrandName = normalizeSearchText(product?.brand?.name || "");
          return (
            normalizedName.includes(normalizedProductSearchTerm) ||
            normalizedBrandName.includes(normalizedProductSearchTerm)
          );
        });

        const fallbackMatchingBrands = (broadBrands || []).filter((brand) =>
          normalizeSearchText(brand.name).includes(normalizedProductSearchTerm),
        );

        const fallbackProductIdsByName = fallbackMatchingProducts.map((p) => p.id);
        let fallbackProductIdsByBrand = [];
        if (fallbackMatchingBrands.length > 0) {
          const fallbackBrandIds = fallbackMatchingBrands.map((b) => b.id);
          const { data: fallbackBrandProducts } = await supabase
            .from("products")
            .select("id")
            .in("brand_id", fallbackBrandIds);
          fallbackProductIdsByBrand = (fallbackBrandProducts || []).map((p) => p.id);
        }

        productIdFilter = [...new Set([...fallbackProductIdsByName, ...fallbackProductIdsByBrand])];
      }

      if (productIdFilter.length === 0) {
        return { success: true, data: [], count: 0, hasMore: false };
      }
    }

    // Pre-filtro: IDs de productos de la categoría seleccionada
    if (categoryId) {
      const { data: categoryProducts } = await supabase
        .from("products")
        .select("id")
        .eq("category_id", categoryId);

      const categoryProductIds = (categoryProducts || []).map((p) => p.id);

      if (categoryProductIds.length === 0) {
        return { success: true, data: [], count: 0, hasMore: false };
      }

      if (productIdFilter !== null) {
        productIdFilter = productIdFilter.filter((id) => categoryProductIds.includes(id));
        if (productIdFilter.length === 0) {
          return { success: true, data: [], count: 0, hasMore: false };
        }
      } else {
        productIdFilter = categoryProductIds;
      }
    }

    // Pre-filtro: IDs de tiendas cuyo nombre coincide con storeName
    // (solo sin filtro de distancia, que ya maneja storeName client-side)
    let storeNameFilter = null;
    if (storeName && !shouldApplyDistanceFilter) {
      const normalizedStoreSearchTerm = normalizeSearchText(storeName);
      const { data: matchingStores, error: storeSearchError } = await supabase
        .from("stores")
        .select("id, name")
        .ilike("name", `%${storeName}%`);

      if (storeSearchError) {
        return { success: false, error: storeSearchError.message };
      }

      storeNameFilter = (matchingStores || [])
        .filter((store) =>
          normalizeSearchText(store.name || "").includes(normalizedStoreSearchTerm),
        )
        .map((s) => s.id);

      if (storeNameFilter.length === 0) {
        const { data: broadStores } = await supabase
          .from("stores")
          .select("id, name")
          .limit(1500);

        storeNameFilter = (broadStores || [])
          .filter((store) =>
            normalizeSearchText(store.name || "").includes(normalizedStoreSearchTerm),
          )
          .map((s) => s.id);
      }

      if (storeNameFilter.length === 0) {
        return { success: true, data: [], count: 0, hasMore: false };
      }
    }

     const publicationListSelect = [
      "id",
      "price",
      "photo_url",
      "description",
      "confidence_score",
      "is_active",
      "created_at",
      "user_id",
      "user:users!price_publications_user_id_fkey (id, full_name, reputation_points)",
      "product_id",
      "product:products (id, name, category_id, base_quantity, brand:brands (id, name), unit_type:unit_types (id, name, abbreviation))",
      "store_id",
      "store:stores!price_publications_store_id_fkey (id, name, address, location, store_type_id, website_url)",
    ].join(",");

    const requiresClientSort =
      sortBy === SORT_OPTIONS.VALIDATED || sortBy === SORT_OPTIONS.BEST_MATCH;

    const prefetchedRows =
      sortBy === SORT_OPTIONS.VALIDATED
        ? Math.min(Math.max(offset + limit * 20, 500), 2500)
        : requiresClientSort
          ? Math.min(offset + limit * 5, 500)
          : limit;

    const queryRangeStart = requiresClientSort ? 0 : offset;
    const queryRangeEnd = queryRangeStart + prefetchedRows - 1;

    const buildPublicationsQuery = (nearbyStoreIds, { withCount = true } = {}) => {
      let query = supabase
        .from("price_publications")
        .select(
          publicationListSelect,
          withCount ? { count: "exact" } : undefined,
        )
        .eq("is_active", true);

      // Filtro por producto (IDs pre-filtrados por nombre)
      if (productIdFilter !== null) {
        query = query.in("product_id", productIdFilter);
      }

      // Filtro por rango de precio
      if (Number.isFinite(normalizedMinPrice)) {
        query = query.gte("price", normalizedMinPrice);
      }
      if (Number.isFinite(normalizedMaxPrice)) {
        query = query.lte("price", normalizedMaxPrice);
      }

      // Filtro por tienda (IDs pre-filtrados por nombre, sin filtro de distancia)
      if (storeNameFilter !== null) {
        query = query.in("store_id", storeNameFilter);
      }

      // Filtro por tiendas cercanas (filtro de distancia)
      if (Array.isArray(nearbyStoreIds) && nearbyStoreIds.length > 0) {
        query = query.in("store_id", nearbyStoreIds);
      }

      // Ordenamiento
      switch (sortBy) {
        case "cheapest":
          query = query.order("price", { ascending: true });
          break;
        case "validated":
          query = query.order("created_at", { ascending: false });
          break;
        case "best_match":
          query = query.order("created_at", { ascending: false });
          break;
        case "recent":
        default:
          query = query.order("created_at", { ascending: false });
          break;
      }

      return query.range(queryRangeStart, queryRangeEnd);
    };

    let nearbyStoreIds = [];

    if (shouldApplyDistanceFilter) {
      const { data: storesData, error: storesError } = await withTimeout(
        supabase
          .from("stores")
          .select("id, name, location"),
        REQUEST_TIMEOUT_MS,
        "Tiempo de espera agotado obteniendo tiendas cercanas",
      );

      if (storesError) {
        console.error("Error obteniendo tiendas para filtrar distancia:", storesError);
        return { success: false, error: storesError.message };
      }

      const searchDistancesKm = [normalizedMaxDistance].filter(
        (distance, index, distances) =>
          Number.isFinite(distance) && distance > 0 && distances.indexOf(distance) === index,
      );

      for (const distanceLimit of searchDistancesKm) {
        nearbyStoreIds = (storesData || [])
          .filter((store) => {
            if (
              storeName &&
              !normalizeSearchText(store.name || "").includes(normalizeSearchText(storeName))
            ) {
              return false;
            }

            const { latitude: storeLat, longitude: storeLng } = parseStoreLocation(
              store.location || store,
            );

            if (!hasCoordinates(storeLat, storeLng)) return false;

            const distanceKm = calculateDistance(
              Number(latitude),
              Number(longitude),
              Number(storeLat),
              Number(storeLng),
            );

            return distanceKm <= distanceLimit;
          })
          .map((store) => store.id);

        if (nearbyStoreIds.length > 0) {
          break;
        }
      }
    }

    if (shouldApplyDistanceFilter && nearbyStoreIds.length === 0) {
      return {
        success: true,
        data: [],
        count: 0,
        hasMore: false,
      };
    }

     const nearbyStoreIdsForQuery = shouldApplyDistanceFilter ? nearbyStoreIds : null;

    const adaptiveTimeoutMs = getAdaptiveRequestTimeout();
    console.info("[NØSEE:publications.api] publications-query:attempt", {
      attempt: 1,
      timeoutMs: adaptiveTimeoutMs,
      withCount: true,
      runtime: getRuntimeNetworkState(),
    });

    const _t0List = Date.now();
    let publicationsResult = await runWithSessionRetry(
      () => buildPublicationsQuery(nearbyStoreIdsForQuery, { withCount: true }),
      adaptiveTimeoutMs,
    );

    if (publicationsResult?.error && isTimeoutMessage(publicationsResult.error.message)) {
      const runtimeState = getRuntimeNetworkState();
      console.warn("Timeout en getPublications (primer intento)", {
        runtimeState,
        timeoutMs: adaptiveTimeoutMs,
      });

      console.info("[NØSEE:publications.api] publications-query:attempt", {
        attempt: 2,
        timeoutMs: EXTENDED_RETRY_TIMEOUT_MS,
        withCount: false,
        runtime: getRuntimeNetworkState(),
      });

      publicationsResult = await runWithSessionRetry(
        () => buildPublicationsQuery(nearbyStoreIdsForQuery, { withCount: false }),
        EXTENDED_RETRY_TIMEOUT_MS,
      );
    }
    recordDbQueryDuration('publications_list', (Date.now() - _t0List) / 1000);

    const { data, error, count } = publicationsResult;

    if (error) {
      console.error("Error obteniendo publicaciones:", error);
      return { success: false, error: error.message };
    }

    const hydrationStartedAt = Date.now();
    const publicationsWithRelations = await hydrateRelatedPublicationData(data || []);
    console.info("[NØSEE:publications.api] publications-hydration:done", {
      elapsedMs: Date.now() - hydrationStartedAt,
      rows: publicationsWithRelations.length,
    });

    const publicationsWithCoordinates = publicationsWithRelations.map((pub) => {
      const storeCoordinates = parseStoreLocation(
        pub?.store?.location ||
          pub?.stores?.location ||
          pub?.store ||
          pub?.stores,
      );

      const publicationWithCoords = {
        ...pub,
        user: pub?.user || pub?.users || null,
        store: (pub?.store || pub?.stores)
          ? {
              ...(pub.store || pub.stores),
              ...storeCoordinates,
            }
          : null,
      };

      if (!shouldComputeDistanceSignals) return publicationWithCoords;

      if (!hasCoordinates(storeCoordinates.latitude, storeCoordinates.longitude)) {
        return { ...publicationWithCoords, distance_km: null };
      }

      return {
        ...publicationWithCoords,
        distance_km: calculateDistance(
          Number(latitude),
          Number(longitude),
          Number(storeCoordinates.latitude),
          Number(storeCoordinates.longitude),
        ),
      };
    });
    const hasSearchTerm =
      String(productName || "").trim().length > 0 ||
      String(storeName || "").trim().length > 0;
    const shouldUseBestMatch =
      SEARCH_SORT_FIELDS.has(sortBy) &&
      (sortBy === SORT_OPTIONS.BEST_MATCH || (sortBy === SORT_OPTIONS.RECENT && hasSearchTerm));

    const rankedPublications = shouldUseBestMatch
      ? await enrichSearchRankingSignals(publicationsWithCoordinates, {
          productName,
          storeName,
          sortBy,
        })
      : publicationsWithCoordinates;

    const enrichedPublications = await enrichPublicationsWithVoteCounts(rankedPublications);

    const fullySortedPublications = (() => {
      const cloned = [...enrichedPublications];
      if (sortBy === SORT_OPTIONS.VALIDATED) {
        return cloned.sort((a, b) => {
          const byVotes = (Number(b.validated_count || 0) - Number(a.validated_count || 0));
          if (byVotes !== 0) return byVotes;
          return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
        });
      }
      if (sortBy === SORT_OPTIONS.BEST_MATCH) {
        return cloned.sort((a, b) => {
          // Mejor opción prioriza score compuesto: texto + precio + distancia + votos + reputación.
          const byScore = Number(b.search_score || 0) - Number(a.search_score || 0);
          if (byScore !== 0) return byScore;

          const byValidated = Number(b.validated_count || 0) - Number(a.validated_count || 0);
          if (byValidated !== 0) return byValidated;

          const byDistance = Number(a.distance_km || 1e12) - Number(b.distance_km || 1e12);
          if (byDistance !== 0) return byDistance;

          const byPrice = Number(a.price || 0) - Number(b.price || 0);
          if (byPrice !== 0) return byPrice;

          return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
        });
      }
      return cloned;
    })();

    // Filtro de seguridad en cliente para evitar inconsistencias por tipos/queries.
    // Garantiza que min/max price siempre se respeten antes de paginar.
    const priceGuardedPublications = fullySortedPublications.filter((publication) => {
      const numericPrice = Number(publication?.price);
      if (!Number.isFinite(numericPrice)) return false;
      if (Number.isFinite(normalizedMinPrice) && numericPrice < normalizedMinPrice) return false;
      if (Number.isFinite(normalizedMaxPrice) && numericPrice > normalizedMaxPrice) return false;
      return true;
    });

    const paginatedData = requiresClientSort
      ? priceGuardedPublications.slice(offset, offset + limit)
      : priceGuardedPublications;

    const hasServerCount = Number.isFinite(count);
    const effectiveCount = hasServerCount
      ? count
      : (requiresClientSort ? priceGuardedPublications.length : offset + paginatedData.length);
    const effectiveHasMore = requiresClientSort
      ? offset + limit < priceGuardedPublications.length
      : hasServerCount
        ? paginatedData.length === limit && offset + paginatedData.length < Number(count)
        : paginatedData.length === limit;

    return {
      success: true,
      data: paginatedData,
      count: effectiveCount,
      hasMore: effectiveHasMore,
    };
  } catch (err) {
    const runtimeState = getRuntimeNetworkState();
    console.error("Contexto runtime en getPublications:", runtimeState);
    if (err?.code === "QUERY_TIMEOUT") {
      console.error("Timeout en getPublications", {
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
    console.error("[NØSEE:publications.api] getPublications:failed", {
      elapsedMs: Date.now() - startedAt,
      runtime: runtimeState,
      message: err?.message,
    });
    console.error("Error en getPublications:", err);
    return { success: false, error: err.message };
  }
};

// ─── 3️⃣ OBTENER DETALLES DE UNA PUBLICACIÓN ──────────────────────────────────

/**
 * Obtener todos los detalles de una publicación específica
 *
 * @param {number} publicationId - ID de la publicación
 *
 * @returns {Promise} { success, data, error }
 *
 * @example
 * const result = await getPublicationDetail(123);
 */
export const getPublicationDetail = async (publicationId) => {
  try {
    if (!publicationId) {
      return { success: false, error: "ID de publicación requerido" };
    }

    const { data, error } = await supabase
      .from("price_publications")
      .select(
        `
        *,
        user:users!price_publications_user_id_fkey (id, full_name, reputation_points),
        product:products (
          id,
          name,
          barcode,
          category:product_categories(name),
          brand:brands(name),
          base_quantity,
          unit_type:unit_types (id, name, abbreviation)
        ),
        store:stores!price_publications_store_id_fkey (id, name, address, location, store_type_id, website_url),
        votes:publication_votes (id, vote_type, user_id)
        `,
      )
      .eq("id", publicationId)
      .single();

    if (error) {
      console.error("Error obteniendo detalles:", error);
      return { success: false, error: error.message };
    }

    let comments = [];
    const commentsResult = await getComments(publicationId);

    if (commentsResult.success && commentsResult.data?.length) {
      comments = commentsResult.data;
    }

    return { success: true, data: { ...data, comments } };

  } catch (err) {
    console.error("Error en getPublicationDetail:", err);
    return { success: false, error: err.message };
  }
};

// ─── 4️⃣ VOTAR PUBLICACIÓN (UPVOTE / DOWNVOTE) ───────────────────────────────

/**
 * Registrar voto sobre una publicación (upvote/downvote)
 *
 * Usar la tabla publication_votes:
 * - Cada usuario solo puede votar 1 vez por publicación
 * - Soporta vote_type = 1 (upvote) y vote_type = -1 (downvote)
 * - Actualiza reputación del autor de forma explícita como respaldo
 *
 * @param {number} publicationId - ID de la publicación
 *
 * @returns {Promise} { success, data, error }
 *
 * @example
 * const result = await validatePublication(123);
 */
export const validatePublication = async (publicationId, voteType = 1) => {
  const voteStart = Date.now();
  try {
    if (!publicationId) {
      return { success: false, error: "ID de publicación requerido" };
    }

    if (![1, -1].includes(voteType)) {
      return { success: false, error: "Tipo de voto inválido" };
    }

    // Obtener usuario actual
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, error: "Usuario no autenticado" };
    }

    // Verificar si ya votó
    recordVoteDuplicateAttempted();
    const { data: existingVote } = await supabase
      .from("publication_votes")
      .select("id")
      .eq("publication_id", publicationId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (existingVote) {
      recordVoteDuplicateRejected();
      return { success: false, error: "Ya votaste esta publicación" };
    }

    // Crear el voto
    const _t0Vote = Date.now();
    const { data: vote, error } = await supabase
      .from("publication_votes")
      .insert({
        publication_id: publicationId,
        user_id: user.id,
        vote_type: voteType,
      })
      .select()
      .single();
    recordDbQueryDuration('vote_insert', (Date.now() - _t0Vote) / 1000);

    if (error) {
      console.error("Error validando publicación:", error);
      return { success: false, error: error.message };
    }

    // Actualizar reputación explícitamente como respaldo (si no existe trigger)
    const { data: publicationData, error: publicationError } = await supabase
      .from("price_publications")
      .select("user_id")
      .eq("id", publicationId)
      .single();

    if (publicationError) {
      return { success: false, error: publicationError.message };
    }

    if (publicationData?.user_id) {
      const reputationDelta = voteType === 1 ? 1 : -1;
      const { error: reputationError } = await supabase.rpc(
        "increment_user_reputation",
        {
          target_user_id: publicationData.user_id,
          reputation_delta: reputationDelta,
        },
      );

      if (reputationError) {
        const { data: authorData, error: authorError } = await supabase
          .from("users")
          .select("reputation_points")
          .eq("id", publicationData.user_id)
          .single();

        if (!authorError) {
          await supabase
            .from("users")
            .update({
              reputation_points:
                (authorData?.reputation_points || 0) + reputationDelta,
            })
            .eq("id", publicationData.user_id);
        }
      }
    }

    recordVote(voteType === 1 ? 'upvote' : 'downvote');
    recordVoteProcessingDuration(Date.now() - voteStart);
    return { success: true, data: vote };
  } catch (err) {
    recordVoteProcessingDuration(Date.now() - voteStart);
    console.error("Error en validatePublication:", err);
    return { success: false, error: err.message };
  }
};

export const downvotePublication = async (publicationId) =>
  validatePublication(publicationId, -1);

/**
 * Quitar voto de una publicación (unvote)
 *
 * @param {number} publicationId - ID de la publicación
 * @returns {Promise} { success, data, error }
 */
export const unvotePublication = async (publicationId) => {
  try {
    if (!publicationId) {
      return { success: false, error: "ID de publicación requerido" };
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: "Usuario no autenticado" };
    }

    const { data: deletedVote, error } = await supabase
      .from("publication_votes")
      .delete()
      .eq("publication_id", publicationId)
      .eq("user_id", user.id)
      .select("id")
      .maybeSingle();

    if (error) {
      return { success: false, error: error.message };
    }

    if (!deletedVote) {
      return { success: false, error: "No habías votado esta publicación" };
    }

    return { success: true, data: deletedVote };
  } catch (err) {
    console.error("Error en unvotePublication:", err);
    return { success: false, error: err.message };
  }
};

// ─── 5️⃣ REPORTAR PUBLICACIÓN ───────────────────────────────────────────────────

/**
 * Reportar una publicación (abuso, precio falso, etc.)
 *
 * @param {number} publicationId - ID de la publicación
 * @param {object} payload - Objeto con detalles del reporte
 *   - reason: Razón del reporte (fake_price, wrong_photo, spam, offensive, other)
 *   - description: Descripción opcional del reporte
 *   - evidenceFile: Archivo de evidencia opcional
 *
 * @returns {Promise} { success, data, error, message }
 *
 * @example
 * const result = await reportPublication(123, {
 *   reason: 'fake_price',
 *   description: 'El precio es imposible',
 *   evidenceFile: fileObject
 * });
 */

/**
 * Verificar si el usuario ya reportó una publicación
 *
 * @param {number} publicationId - ID de la publicación
 * @returns {Promise} { success, hasReported: boolean, existingReport: object|null }
 *
 * @example
 * const result = await checkUserReportStatus(123);
 * // { success: true, hasReported: true, existingReport: { id: '...', createdAt: '...' } }
 */
export const checkUserReportStatus = async (publicationId) => {
  const logPrefix = '[📋 CHECK-REPORT]';

  try {
    console.log(`${logPrefix} Verificando si usuario ya reportó publicación #${publicationId}`);

    // Obtener usuario actual
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      console.log(`${logPrefix} Usuario no autenticado`);
      return {
        success: true,
        hasReported: false,
        existingReport: null
      };
    }

    // Buscar reporte existente
    const { data: existingReport, error } = await supabase
      .from("reports")
      .select("id, created_at, reason, description")
      .eq("reported_type", "publication")
      .eq("reported_id", String(publicationId))
      .eq("reporter_user_id", user.id)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows found
      console.error(`${logPrefix} Error buscando reporte:`, error.message);
      return {
        success: false,
        error: error.message
      };
    }

    const hasReported = !!existingReport;
    console.log(`${logPrefix} Resultado:`, {
      hasReported,
      reportId: existingReport?.id
    });

    return {
      success: true,
      hasReported,
      existingReport: existingReport || null
    };

  } catch (err) {
    console.error(`${logPrefix} Error crítico:`, err.message);
    return {
      success: false,
      error: err.message
    };
  }
};

export const reportPublication = async (
  publicationId,
  payload,
  _deprecatedDescription,
) => {
  const logPrefix = '[📋 REPORTE]';

  try {
    console.log(`${logPrefix} Iniciando reporte de publicación #${publicationId}`);
    console.log(`${logPrefix} Payload recibido:`, payload);

    // ─── VALIDACIONES ───────────────────────────────────────────────────

    // Manejar tanto payload object como parámetros antiguos
    const isLegacyCall = typeof payload === 'string';
    const reportData = isLegacyCall
      ? { reason: payload, description: _deprecatedDescription }
      : payload;

    console.log(`${logPrefix} Datos del reporte:`, {
      reason: reportData.reason,
      hasDescription: !!reportData.description,
      hasEvidence: !!reportData.evidenceFile,
    });

    if (!publicationId || !reportData.reason) {
      const errorMsg = "Datos incompletos: falta publicationId o reason";
      console.error(`${logPrefix} ❌ ${errorMsg}`);
      return {
        success: false,
        error: errorMsg,
        message: "Por favor completa la razón del reporte"
      };
    }

    const validReasons = ["fake_price", "wrong_photo", "spam", "offensive", "other"];
    if (!validReasons.includes(reportData.reason)) {
      const errorMsg = `Razón de reporte inválida: ${reportData.reason}`;
      console.error(`${logPrefix} ❌ ${errorMsg}`);
      return {
        success: false,
        error: errorMsg,
        message: "Razón de reporte no válida"
      };
    }

    // ─── AUTENTICACIÓN ──────────────────────────────────────────────────

    console.log(`${logPrefix} Verificando autenticación...`);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      const errorMsg = "Usuario no autenticado";
      console.error(`${logPrefix} ❌ ${errorMsg}`);
      return {
        success: false,
        error: errorMsg,
        message: "Debes iniciar sesión para reportar"
      };
    }

    console.log(`${logPrefix} ✓ Usuario autenticado: ${user.id}`);

    // ─── VERIFICAR REPORTE DUPLICADO ────────────────────────────────────

    console.log(`${logPrefix} Verificando si ya reportó esta publicación...`);
    const { data: existingReport, error: checkError } = await supabase
      .from("reports")
      .select("id, created_at")
      .eq("reported_type", "publication")
      .eq("reported_id", String(publicationId))
      .eq("reporter_user_id", user.id)
      .maybeSingle();

    if (checkError && checkError.code !== 'PGRST116') {
      console.error(`${logPrefix} ❌ Error verificando reporte:`, checkError.message);
      return {
        success: false,
        error: checkError.message,
        message: "Error verificando reportes anteriores"
      };
    }

    if (existingReport) {
      const errorMsg = `Ya reportaste esta publicación el ${new Date(existingReport.created_at).toLocaleString()}`;
      console.warn(`${logPrefix} ⚠️ ${errorMsg}`);
      return {
        success: false,
        error: "Duplicate report",
        message: errorMsg,
        existingReport
      };
    }

    console.log(`${logPrefix} ✓ Sin reportes previos de este usuario`);

    // ─── SUBIR EVIDENCIA (si existe) ────────────────────────────────────

    let evidenceUrl = null;
    if (reportData.evidenceFile) {
      try {
        console.log(`${logPrefix} Subiendo archivo de evidencia a Cloudinary...`);

        const cloudinaryResult = await uploadImageToCloudinary(reportData.evidenceFile, {
          folder: 'nosee/reports-evidence'
        });

        if (cloudinaryResult.success) {
          evidenceUrl = cloudinaryResult.optimizedUrl || cloudinaryResult.url;
          console.log(`${logPrefix} ✓ Evidencia subida: ${evidenceUrl}`);
        } else {
          console.warn(`${logPrefix} ⚠️ Error subiendo evidencia (continuando sin ella):`, cloudinaryResult.error);
        }
      } catch (fileErr) {
        console.warn(`${logPrefix} ⚠️ Error procesando archivo (continuando):`, fileErr.message);
      }
    }

    // ─── CREAR REPORTE EN BD ────────────────────────────────────────────

    const { data: publicationOwner } = await supabase
      .from("price_publications")
      .select("user_id")
      .eq("id", publicationId)
      .maybeSingle();

    console.log(`${logPrefix} Creando reporte en base de datos...`);
    const { data: report, error } = await supabase
      .from("reports")
      .insert({
        reported_type: "publication",
        reported_id: String(publicationId),
        reported_user_id: publicationOwner?.user_id || null,
        reporter_user_id: user.id,
        reason: reportData.reason,
        description: reportData.description || null,
        evidence_url: evidenceUrl,
        status: "PENDING",
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error(`${logPrefix} ❌ Error en BD:`, error);
      return {
        success: false,
        error: error.message,
        message: "Hubo un error al guardar el reporte"
      };
    }

    console.log(`${logPrefix} ✅ Reporte creado exitosamente:`, {
      id: report.id,
      publicationId: report.reported_id,
      reason: report.reason,
      status: report.status,
    });

    recordPublicationReport();
    return {
      success: true,
      data: report,
      message: "Reporte enviado correctamente. Gracias por ayudarnos a mejorar NØSEE."
    };

  } catch (err) {
    console.error(`${logPrefix} ❌ Error crítico:`, {
      message: err.message,
      stack: err.stack,
      publicationId,
    });
    return {
      success: false,
      error: err.message,
      message: "Error al procesar el reporte. Intenta de nuevo."
    };
  }
};

// ─── 8️⃣ ACTUALIZAR PUBLICACIÓN ─────────────────────────────────────────────────

/**
 * Actualizar una publicación (solo el autor puede hacerlo)
 *
 * @param {number} publicationId - ID de la publicación
 * @param {Object} updates - Campos a actualizar { price, description, photoUrl }
 *
 * @returns {Promise} { success, data, error }
 *
 * @example
 * const result = await updatePublication(123, { price: 16000, description: 'Actualizado' });
 */
export const updatePublication = async (publicationId, updates) => {
  try {
    if (!publicationId) {
      return { success: false, error: "ID de publicación requerido" };
    }

    // Obtener usuario actual
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, error: "Usuario no autenticado" };
    }

    // Verificar que es el autor
    const { data: publication } = await supabase
      .from("price_publications")
      .select("user_id")
      .eq("id", publicationId)
      .single();

    if (publication?.user_id !== user.id) {
      return { success: false, error: "No puedes editar esta publicación" };
    }

    // Actualizar
    const { data, error } = await supabase
      .from("price_publications")
      .update(updates)
      .eq("id", publicationId)
      .select()
      .single();

    if (error) {
      console.error("Error actualizando publicación:", error);
      return { success: false, error: error.message };
    }

    return { success: true, data };
  } catch (err) {
    console.error("Error en updatePublication:", err);
    return { success: false, error: err.message };
  }
};

// ─── 9️⃣ ELIMINAR PUBLICACIÓN ──────────────────────────────────────────────────

/**
 * Eliminar una publicación (solo el autor o admin)
 *
 * @param {number} publicationId - ID de la publicación
 * @param {Object} [options]
 * @param {boolean} [options.permanent=false] - Si true, elimina físicamente (solo admin)
 *
 * @returns {Promise} { success, error }
 *
 * @example
 * const result = await deletePublication(123);
 */
export const deletePublication = async (publicationId, options = {}) => {
  try {
    const { permanent = false } = options;

    if (!publicationId) {
      return { success: false, error: "ID de publicación requerido" };
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, error: "Usuario no autenticado" };
    }

    const { data: publication } = await supabase
      .from("price_publications")
      .select("user_id, is_active")
      .eq("id", publicationId)
      .maybeSingle();

    const { data: userData } = await supabase
      .from("users")
      .select("role_id")
      .eq("id", user.id)
      .maybeSingle();

    const isAuthor = publication?.user_id === user.id;
    const isAdmin  = userData?.role_id === 3;

    if (!publication) {
      return { success: false, error: "La publicación no existe" };
    }

    if (!isAuthor && !isAdmin) {
      return { success: false, error: "No puedes eliminar esta publicación" };
    }

    if (permanent) {
      if (!isAdmin) {
        return {
          success: false,
          error: "Solo un administrador puede eliminar permanentemente una publicación",
        };
      }

      const { error: votesDeleteError } = await supabase
        .from("publication_votes")
        .delete()
        .eq("publication_id", publicationId);

      if (votesDeleteError) {
        console.error("Error eliminando votos de publicación:", votesDeleteError);
        return { success: false, error: votesDeleteError.message };
      }

      const { error: reportsDeleteError } = await supabase
        .from("reports")
        .delete()
        .eq("reported_type", "publication")
        .eq("reported_id", String(publicationId));

      if (reportsDeleteError) {
        console.error("Error eliminando reportes de publicación:", reportsDeleteError);
        return { success: false, error: reportsDeleteError.message };
      }

      const { error: commentsDeleteError } = await supabase
        .from("comments")
        .delete()
        .eq("publication_id", publicationId);

      if (commentsDeleteError) {
        console.error("Error eliminando comentarios de publicación:", commentsDeleteError);
        return { success: false, error: commentsDeleteError.message };
      }

      const { data: deletedRows, error: publicationDeleteError } = await supabase
        .from("price_publications")
        .delete()
        .eq("id", publicationId)
        .select("id");

      if (publicationDeleteError) {
        console.error("Error eliminando publicación permanentemente:", publicationDeleteError);
        return { success: false, error: publicationDeleteError.message };
      }

      if (!Array.isArray(deletedRows) || deletedRows.length === 0) {
        return {
          success: false,
          error:
            "No se pudo eliminar permanentemente la publicación en base de datos (posible restricción de permisos/RLS).",
        };
      }

      return { success: true };
    }

    const { error } = await supabase.rpc("soft_delete_publication", {
      p_publication_id: publicationId,
    });

    if (error) {
      console.error("Error eliminando publicación:", error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err) {
    console.error("Error en deletePublication:", err);
    return { success: false, error: err.message };
  }
};

// ─── RE-EXPORTAR APIs auxiliares (backward compatibility) ────────────────────
export {
  searchProductsAndBrands, searchProducts, findProductByBarcode, getProducts, getStores,
  searchStores, createProduct, updateProduct, createBrand, getProductCategories, getUnitTypes, searchBrands,
  getComments, addComment, deleteComment,
};

// ─── EXPORTAR TODO ────────────────────────────────────────────────────────────

export default {
  createPublication,
  getPublications,
  getPublicationDetail,
  validatePublication,
  downvotePublication,
  unvotePublication,
  reportPublication,
  checkUserReportStatus,
  searchProducts,
  findProductByBarcode,
  createProduct,
  searchProductsAndBrands,
  getProducts,
  searchStores,
  getStores,
  getProductCategories,
  getUnitTypes,
  searchBrands,
  createBrand,
  updateProduct,
  updatePublication,
  deletePublication,
  getComments,
  addComment,
  deleteComment,
  PUBLICATION_STATUS,
  SORT_OPTIONS,
};
