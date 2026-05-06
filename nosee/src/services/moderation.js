const MODERATION_SCORE_THRESHOLD = Number(
  import.meta.env.VITE_TEXT_MODERATION_SCORE_THRESHOLD || 3,
);
const IMAGE_CONFIDENCE_THRESHOLD = Number(
  import.meta.env.VITE_IMAGE_MODERATION_CONFIDENCE_THRESHOLD || 0.75,
);
const IMAGE_MAX_ANALYSIS_SIDE = Number(
  import.meta.env.VITE_IMAGE_ANALYSIS_MAX_SIDE || 480,
);
const IMAGE_MIN_ANALYSIS_PIXELS = Number(
  import.meta.env.VITE_IMAGE_MIN_ANALYSIS_PIXELS || 20000,
);
const SKIN_RATIO_BLOCK_THRESHOLD = Number(
  import.meta.env.VITE_IMAGE_SKIN_RATIO_BLOCK || 0.58,
);
// 0.35 en vez de 0.20: fotos de carne, tomates, empaques rojos ya no se bloquean
const BLOOD_RATIO_BLOCK_THRESHOLD = Number(
  import.meta.env.VITE_IMAGE_BLOOD_RATIO_BLOCK || 0.35,
);
// 0.55 en vez de 0.32: el rango H=5-45° (naranja/amarillo) es común en alimentos
// y packaging de supermercado; 0.32 producía falsos positivos en fotos de producto
const ANIME_SKIN_RATIO_BLOCK_THRESHOLD = Number(
  import.meta.env.VITE_IMAGE_ANIME_SKIN_RATIO_BLOCK || 0.55,
);
// 0.55 en vez de 0.38: fotos bajo luz fluorescente de supermercado superan 0.38
const VIVID_RATIO_BLOCK_THRESHOLD = Number(
  import.meta.env.VITE_IMAGE_VIVID_RATIO_BLOCK || 0.55,
);
const IMAGE_HOTSPOT_GRID_SIZE = Number(
  import.meta.env.VITE_IMAGE_HOTSPOT_GRID_SIZE || 12,
);
const SKIN_HOTSPOT_RATIO_BLOCK_THRESHOLD = Number(
  import.meta.env.VITE_IMAGE_SKIN_HOTSPOT_RATIO_BLOCK || 0.52,
);
const BLOOD_HOTSPOT_RATIO_BLOCK_THRESHOLD = Number(
  import.meta.env.VITE_IMAGE_BLOOD_HOTSPOT_RATIO_BLOCK || 0.30,
);
const CENTER_REGION_RATIO = Number(
  import.meta.env.VITE_IMAGE_CENTER_REGION_RATIO || 0.36,
);

const OFFENSIVE_TERMS = [
  { term: "hijueputa", weight: 5, category: "insulto_fuerte" },
  { term: "gonorrea", weight: 4, category: "insulto_fuerte" },
  { term: "malparido", weight: 4, category: "insulto_fuerte" },
  { term: "hpta", weight: 4, category: "insulto_fuerte" },
  { term: "hp", weight: 3, category: "insulto_medio" },
  { term: "puta", weight: 3, category: "lenguaje_sexual_ofensivo" },
  { term: "puto", weight: 3, category: "lenguaje_sexual_ofensivo" },
  { term: "mierda", weight: 2, category: "groseria" },
  { term: "imbecil", weight: 2, category: "insulto" },
  { term: "idiota", weight: 2, category: "insulto" },
  { term: "estupido", weight: 2, category: "insulto" },
  { term: "perra", weight: 2, category: "insulto" },
  { term: "pirobo", weight: 3, category: "insulto" },
  { term: "culo", weight: 1, category: "sexual" },
  { term: "marica", weight: 1, category: "slur_contextual" },
  { term: "mk", weight: 1, category: "slur_contextual" },
];

const TARGETING_WORDS = ["usted", "tu", "vos", "eres", "sos", "callate", "idiota"];
const HIGH_RISK_IMAGE_KEYWORDS = [
  "nudity",
  "nude",
  "explicit",
  "sexual",
  "porn",
  "genitals",
  "breast",
  "gore",
  "violence",
  "blood",
];
const ADULT_GORE_KEYWORDS = [
  "adult",
  "adults",
  "xxx",
  "porn",
  "porno",
  "pornografia",
  "nsfw",
  "nude",
  "nudity",
  "desnudo",
  "desnuda",
  "sex",
  "sexual",
  "onlyfans",
  "escort",
  "fetish",
  "hentai",
  "ecchi",
  "rule34",
  "rule 34",
  "anime porn",
  "gore",
  "blood",
  "sangre",
  "cadaver",
  "decapitado",
  "violence",
  "violento",
  "violencia",
  "mutilacion",
];

const normalizeText = (value = "") =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const normalizeLeetspeak = (value = "") =>
  String(value || "")
    .toLowerCase()
    .replace(/[@4]/g, "a")
    .replace(/[3]/g, "e")
    .replace(/[1!|]/g, "i")
    .replace(/[0]/g, "o")
    .replace(/[5$]/g, "s")
    .replace(/[7]/g, "t")
    .replace(/\*/g, "")
    .replace(/[^a-z0-9\s]/g, " ");

const collapseRepeatedChars = (value = "") => value.replace(/(.)\1{2,}/g, "$1$1");
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const rgbToHsv = (r, g, b) => {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const delta = max - min;

  let h = 0;
  if (delta !== 0) {
    if (max === rn) h = ((gn - bn) / delta) % 6;
    else if (max === gn) h = (bn - rn) / delta + 2;
    else h = (rn - gn) / delta + 4;
  }
  h = Math.round(h * 60);
  if (h < 0) h += 360;

  const s = max === 0 ? 0 : delta / max;
  const v = max;
  return { h, s, v };
};

const rgbToYCbCr = (r, g, b) => {
  const y = 0.299 * r + 0.587 * g + 0.114 * b;
  const cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b;
  const cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;
  return { y, cb, cr };
};

const createGridBuckets = (size) =>
  Array.from({ length: size * size }, () => ({
    total: 0,
    skin: 0,
    blood: 0,
    animeSkin: 0,
  }));

const extractNumbersDeep = (value, acc = []) => {
  if (value === null || value === undefined) return acc;
  if (typeof value === "number" && Number.isFinite(value)) {
    acc.push(value);
    return acc;
  }
  if (Array.isArray(value)) {
    value.forEach((item) => extractNumbersDeep(item, acc));
    return acc;
  }
  if (typeof value === "object") {
    Object.values(value).forEach((item) => extractNumbersDeep(item, acc));
    return acc;
  }
  return acc;
};

const extractStringsDeep = (value, acc = []) => {
  if (value === null || value === undefined) return acc;
  if (typeof value === "string") {
    acc.push(value.toLowerCase());
    return acc;
  }
  if (Array.isArray(value)) {
    value.forEach((item) => extractStringsDeep(item, acc));
    return acc;
  }
  if (typeof value === "object") {
    Object.values(value).forEach((item) => extractStringsDeep(item, acc));
    return acc;
  }
  return acc;
};

const findTextMatches = (normalized) => {
  let score = 0;
  const matches = [];
  const tokenSet = new Set(normalized.split(" ").filter(Boolean));
  const containsTargeting = TARGETING_WORDS.some((token) => tokenSet.has(token));

  for (const entry of OFFENSIVE_TERMS) {
    const pattern = new RegExp(`(^|\\s)${entry.term}(\\s|$)`, "i");
    if (!pattern.test(normalized)) continue;

    let effectiveWeight = entry.weight;
    if (entry.category === "slur_contextual" && !containsTargeting) {
      // Penalización menor para términos ambiguos sin ataque explícito
      effectiveWeight = Math.max(0.5, entry.weight * 0.5);
    }
    if (containsTargeting) effectiveWeight += 0.8;

    score += effectiveWeight;
    matches.push({
      term: entry.term,
      category: entry.category,
      weight: Number(effectiveWeight.toFixed(2)),
    });
  }

  return { score: Number(score.toFixed(2)), matches, containsTargeting };
};

export const detectInappropriateText = (text = "") => {
  const base = normalizeText(text);
  if (!base) {
    return {
      flagged: false,
      score: 0,
      matches: [],
      strategy: "empty",
    };
  }

  const leet = collapseRepeatedChars(normalizeText(normalizeLeetspeak(text)));
  const direct = findTextMatches(base);
  const obfuscated = base === leet ? { score: 0, matches: [] } : findTextMatches(leet);

  const mergedMatches = [...direct.matches];
  for (const item of obfuscated.matches) {
    if (!mergedMatches.find((m) => m.term === item.term)) mergedMatches.push(item);
  }

  const score = Number(Math.max(direct.score, obfuscated.score).toFixed(2));
  const flagged = score >= MODERATION_SCORE_THRESHOLD;

  return {
    flagged,
    score,
    threshold: MODERATION_SCORE_THRESHOLD,
    matches: mergedMatches,
    strategy: flagged ? "weighted-terms+context+obfuscation" : "safe",
  };
};

export const detectRestrictedContentText = (text = "") => {
  const preCollapse = normalizeText(normalizeLeetspeak(text));
  const normalized  = collapseRepeatedChars(preCollapse);
  if (!normalized) {
    return { flagged: false, score: 0, matches: [], strategy: "empty" };
  }

  // Se revisan ambas versiones: la colapsada (detecta obfuscación como "puuuuta")
  // y la sin colapsar (detecta keywords exactos como "xxx" que el colapso destruiría).
  const findMatches = (str) =>
    ADULT_GORE_KEYWORDS.filter((term) =>
      new RegExp(`(^|\\s)${term}(\\s|$)`, "i").test(str),
    );

  const matches = [...new Set([...findMatches(normalized), ...findMatches(preCollapse)])];

  const score = matches.reduce((acc, term) => {
    if (["porn", "porno", "xxx", "nsfw", "gore", "decapitado", "mutilacion"].includes(term)) return acc + 2;
    return acc + 1;
  }, 0);

  return {
    flagged: score >= 2 || matches.length >= 1,
    score,
    matches,
    strategy: "adult-gore-keywords",
  };
};

export const detectIndecentImageByModeration = (moderation) => {
  const entries = Array.isArray(moderation) ? moderation : [];
  if (!entries.length) {
    return { flagged: false, reason: null, confidence: 0, strategy: "no-metadata" };
  }

  let topConfidence = 0;
  let topKeyword = null;
  let strictStatus = null;

  for (const entry of entries) {
    const status = String(entry?.status || "").toLowerCase();
    if (status === "rejected") strictStatus = "rejected";
    if (status === "flagged" && !strictStatus) strictStatus = "flagged";

    const strings = extractStringsDeep(entry);
    const numbers = extractNumbersDeep(entry);
    const maxRaw = numbers.length ? Math.max(...numbers) : 0;
    const normalizedScore = maxRaw > 1 ? maxRaw / 100 : maxRaw;
    if (normalizedScore > topConfidence) topConfidence = normalizedScore;

    const foundKeyword = strings.find((snippet) =>
      HIGH_RISK_IMAGE_KEYWORDS.some((k) => snippet.includes(k)),
    );
    if (foundKeyword) {
      const key = HIGH_RISK_IMAGE_KEYWORDS.find((k) => foundKeyword.includes(k));
      topKeyword = key || topKeyword;
    }
  }

  // Reglas de mayor precisión:
  // - rejected siempre bloquea
  // - flagged bloquea si además hay confianza alta o keyword de alto riesgo
  if (strictStatus === "rejected") {
    return {
      flagged: true,
      reason: "Cloudinary moderation status: rejected",
      confidence: Number(topConfidence.toFixed(3)),
      strategy: "status-hard-block",
    };
  }

  const hasHighRiskSignal = !!topKeyword || topConfidence >= IMAGE_CONFIDENCE_THRESHOLD;
  if (strictStatus === "flagged" && hasHighRiskSignal) {
    return {
      flagged: true,
      reason: `Cloudinary flagged${topKeyword ? ` (${topKeyword})` : ""}`,
      confidence: Number(topConfidence.toFixed(3)),
      threshold: IMAGE_CONFIDENCE_THRESHOLD,
      strategy: "status+confidence+keyword",
    };
  }

  return {
    flagged: false,
    reason: null,
    confidence: Number(topConfidence.toFixed(3)),
    threshold: IMAGE_CONFIDENCE_THRESHOLD,
    strategy: "safe",
  };
};

const loadImageDataFromFile = (file, maxSide = IMAGE_MAX_ANALYSIS_SIDE) =>
  new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      try {
        const width = image.naturalWidth || image.width;
        const height = image.naturalHeight || image.height;
        if (!width || !height) throw new Error("No fue posible leer la imagen");

        const scale = Math.min(1, maxSide / Math.max(width, height));
        const targetWidth = Math.max(1, Math.round(width * scale));
        const targetHeight = Math.max(1, Math.round(height * scale));

        const canvas = document.createElement("canvas");
        canvas.width = targetWidth;
        canvas.height = targetHeight;
        const context = canvas.getContext("2d", { willReadFrequently: true });

        if (!context) throw new Error("No se pudo analizar la imagen");
        context.drawImage(image, 0, 0, targetWidth, targetHeight);
        const imageData = context.getImageData(0, 0, targetWidth, targetHeight);
        resolve({
          width: targetWidth,
          height: targetHeight,
          data: imageData.data,
        });
      } catch (error) {
        reject(error);
      } finally {
        URL.revokeObjectURL(objectUrl);
      }
    };

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("No se pudo decodificar la imagen"));
    };

    image.src = objectUrl;
  });

export const analyzeImageFileForRestrictedContent = async (file) => {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return {
      flagged: false,
      reason: null,
      confidence: 0,
      strategy: "image-analysis-not-available",
      metrics: null,
      evidence: null,
    };
  }

  try {
    const image = await loadImageDataFromFile(file);
    const pixelCount = image.width * image.height;
    if (pixelCount < IMAGE_MIN_ANALYSIS_PIXELS) {
      return {
        flagged: false,
        reason: null,
        confidence: 0,
        strategy: "pixel-analysis-skipped-small-image",
        metrics: { pixelCount },
        evidence: {
          provider: "local_pixel_guard",
          status: "approved",
          confidence: 0,
          metrics: { pixelCount },
          strategy: "pixel-analysis-skipped-small-image",
        },
      };
    }

    let skinPixels = 0;
    let bloodPixels = 0;
    let animeSkinPixels = 0;
    let vividPixels = 0;
    let validPixels = 0;
    let centerPixels = 0;
    let centerSkinPixels = 0;
    let centerBloodPixels = 0;

    const gridSize = Math.max(4, IMAGE_HOTSPOT_GRID_SIZE);
    const gridBuckets = createGridBuckets(gridSize);
    const centerMarginX = image.width * (1 - CENTER_REGION_RATIO) * 0.5;
    const centerMarginY = image.height * (1 - CENTER_REGION_RATIO) * 0.5;
    const centerMinX = centerMarginX;
    const centerMaxX = image.width - centerMarginX;
    const centerMinY = centerMarginY;
    const centerMaxY = image.height - centerMarginY;

    for (let i = 0; i < image.data.length; i += 4) {
      const r = image.data[i];
      const g = image.data[i + 1];
      const b = image.data[i + 2];
      const a = image.data[i + 3];
      if (a < 20) continue;

      validPixels += 1;
      const pixelIndex = i / 4;
      const x = pixelIndex % image.width;
      const y = Math.floor(pixelIndex / image.width);
      const col = Math.min(gridSize - 1, Math.floor((x / image.width) * gridSize));
      const row = Math.min(gridSize - 1, Math.floor((y / image.height) * gridSize));
      const bucket = gridBuckets[row * gridSize + col];
      bucket.total += 1;

      const inCenterRegion =
        x >= centerMinX && x <= centerMaxX && y >= centerMinY && y <= centerMaxY;
      if (inCenterRegion) centerPixels += 1;

      // Detección de piel combinando RGB + YCbCr (más robusta).
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const { cb, cr } = rgbToYCbCr(r, g, b);
      const isRgbSkinTone =
        r > 95 &&
        g > 40 &&
        b > 20 &&
        max - min > 15 &&
        Math.abs(r - g) > 15 &&
        r > g &&
        r > b;
      const isYCbCrSkinTone = cb >= 77 && cb <= 127 && cr >= 133 && cr <= 173;
      const isSkinTone = isRgbSkinTone || isYCbCrSkinTone;
      if (isSkinTone) {
        skinPixels += 1;
        bucket.skin += 1;
        if (inCenterRegion) centerSkinPixels += 1;
      }

      // Detección de rojo intenso / sangre con HSV + dominancia.
      const { h, s, v } = rgbToHsv(r, g, b);
      const redDominance = r / (r + g + b + 1);
      const isRedHue = h <= 13 || h >= 348;
      const isBloodLike =
        ((r > 110 && g < 115 && b < 115) || (r > 75 && g < 75 && b < 75)) &&
        redDominance > 0.52 &&
        r - g > 35 &&
        r - b > 35 &&
        isRedHue &&
        s >= 0.35 &&
        v >= 0.18 &&
        v < 0.80;
      if (isBloodLike) {
        bloodPixels += 1;
        bucket.blood += 1;
        if (inCenterRegion) centerBloodPixels += 1;
      }

      const isVivid = s >= 0.55 && v >= 0.38;
      if (isVivid) vividPixels += 1;

      // Cobertura extra para estilo anime/hentai (piel muy clara o rosada saturada).
      const isAnimeSkinLike =
        ((h >= 5 && h <= 45) || h >= 340) &&
        s >= 0.18 &&
        s <= 0.72 &&
        v >= 0.55 &&
        r >= g &&
        r > b * 0.9 &&
        (r - b >= 8 || r - g >= 5);
      if (isAnimeSkinLike) {
        animeSkinPixels += 1;
        bucket.animeSkin += 1;
      }
    }

    if (!validPixels) {
      return {
        flagged: false,
        reason: null,
        confidence: 0,
        strategy: "pixel-analysis-empty",
        metrics: { validPixels: 0, pixelCount },
        evidence: {
          provider: "local_pixel_guard",
          status: "approved",
          confidence: 0,
          metrics: { validPixels: 0, pixelCount },
          strategy: "pixel-analysis-empty",
        },
      };
    }

    const skinRatio = skinPixels / validPixels;
    const bloodRatio = bloodPixels / validPixels;
    const animeSkinRatio = animeSkinPixels / validPixels;
    const vividRatio = vividPixels / validPixels;
    const centerSkinRatio = centerPixels ? centerSkinPixels / centerPixels : 0;
    const centerBloodRatio = centerPixels ? centerBloodPixels / centerPixels : 0;

    let maxSkinHotspotRatio = 0;
    let maxBloodHotspotRatio = 0;
    let maxAnimeHotspotRatio = 0;
    for (const bucket of gridBuckets) {
      if (!bucket.total) continue;
      maxSkinHotspotRatio = Math.max(maxSkinHotspotRatio, bucket.skin / bucket.total);
      maxBloodHotspotRatio = Math.max(maxBloodHotspotRatio, bucket.blood / bucket.total);
      maxAnimeHotspotRatio = Math.max(maxAnimeHotspotRatio, bucket.animeSkin / bucket.total);
    }

    const adultScore = clamp(
      (skinRatio - SKIN_RATIO_BLOCK_THRESHOLD * 0.7) /
        (SKIN_RATIO_BLOCK_THRESHOLD * 0.3 || 1),
      0,
      1,
    );
    const animeAdultScore = clamp(
      (animeSkinRatio - ANIME_SKIN_RATIO_BLOCK_THRESHOLD * 0.7) /
        (ANIME_SKIN_RATIO_BLOCK_THRESHOLD * 0.3 || 1),
      0,
      1,
    );
    const hotspotAdultScore = clamp(
      (maxSkinHotspotRatio - SKIN_HOTSPOT_RATIO_BLOCK_THRESHOLD * 0.7) /
        (SKIN_HOTSPOT_RATIO_BLOCK_THRESHOLD * 0.3 || 1),
      0,
      1,
    );
    const goreScore = clamp(
      (bloodRatio - BLOOD_RATIO_BLOCK_THRESHOLD * 0.65) /
        (BLOOD_RATIO_BLOCK_THRESHOLD * 0.35 || 1),
      0,
      1,
    );
    const hotspotGoreScore = clamp(
      (maxBloodHotspotRatio - BLOOD_HOTSPOT_RATIO_BLOCK_THRESHOLD * 0.65) /
        (BLOOD_HOTSPOT_RATIO_BLOCK_THRESHOLD * 0.35 || 1),
      0,
      1,
    );

    const flaggedAdult =
      (skinRatio >= SKIN_RATIO_BLOCK_THRESHOLD &&
        centerSkinRatio >= SKIN_RATIO_BLOCK_THRESHOLD * 0.72) ||
      (skinRatio >= SKIN_RATIO_BLOCK_THRESHOLD * 0.75 &&
        maxSkinHotspotRatio >= SKIN_HOTSPOT_RATIO_BLOCK_THRESHOLD);
    const flaggedAnimeAdult =
      animeSkinRatio >= ANIME_SKIN_RATIO_BLOCK_THRESHOLD &&
      vividRatio >= VIVID_RATIO_BLOCK_THRESHOLD &&
      maxAnimeHotspotRatio >= 0.24;
    // Requiere ratio GLOBAL alto además del hotspot: packaging rojo concentrado
    // (salsa, ketchup, etiqueta roja) no debe bloquearse solo por tener alta
    // concentración local si el global está por debajo del umbral.
    const flaggedGore =
      bloodRatio >= BLOOD_RATIO_BLOCK_THRESHOLD &&
      maxBloodHotspotRatio >= BLOOD_HOTSPOT_RATIO_BLOCK_THRESHOLD;
    const flagged = flaggedAdult || flaggedAnimeAdult || flaggedGore;

    const labels = [];
    if (flaggedAdult) labels.push("adult");
    if (flaggedAnimeAdult) labels.push("adult_anime");
    if (flaggedGore) labels.push("gore");

    const confidence = Number(
      Math.max(
        adultScore,
        animeAdultScore,
        goreScore,
        hotspotAdultScore,
        hotspotGoreScore,
      ).toFixed(3),
    );
    const reason = flagged
      ? flaggedAdult && flaggedGore
        ? "La imagen parece contener desnudez explícita y señales de gore."
        : flaggedAnimeAdult
          ? "La imagen parece contener contenido sexual explícito estilo anime/hentai."
          : flaggedAdult
          ? "La imagen parece contener desnudez o exposición corporal explícita."
          : "La imagen parece contener señales visuales de gore/sangre explícita."
      : null;

    const metrics = {
      skinRatio: Number(skinRatio.toFixed(4)),
      bloodRatio: Number(bloodRatio.toFixed(4)),
      animeSkinRatio: Number(animeSkinRatio.toFixed(4)),
      vividRatio: Number(vividRatio.toFixed(4)),
      centerSkinRatio: Number(centerSkinRatio.toFixed(4)),
      centerBloodRatio: Number(centerBloodRatio.toFixed(4)),
      maxSkinHotspotRatio: Number(maxSkinHotspotRatio.toFixed(4)),
      maxBloodHotspotRatio: Number(maxBloodHotspotRatio.toFixed(4)),
      maxAnimeHotspotRatio: Number(maxAnimeHotspotRatio.toFixed(4)),
      validPixels,
      pixelCount,
      gridSize,
      thresholds: {
        skinRatioBlock: SKIN_RATIO_BLOCK_THRESHOLD,
        bloodRatioBlock: BLOOD_RATIO_BLOCK_THRESHOLD,
        animeSkinRatioBlock: ANIME_SKIN_RATIO_BLOCK_THRESHOLD,
        vividRatioBlock: VIVID_RATIO_BLOCK_THRESHOLD,
        skinHotspotRatioBlock: SKIN_HOTSPOT_RATIO_BLOCK_THRESHOLD,
        bloodHotspotRatioBlock: BLOOD_HOTSPOT_RATIO_BLOCK_THRESHOLD,
      },
    };

    return {
      flagged,
      reason,
      confidence,
      strategy: "local-pixel-safety-guard",
      labels,
      metrics,
      evidence: {
        provider: "local_pixel_guard",
        status: flagged ? "rejected" : "approved",
        confidence,
        labels,
        metrics,
        strategy: "local-pixel-safety-guard",
      },
    };
  } catch {
    return {
      flagged: false,
      reason: null,
      confidence: 0,
      strategy: "pixel-analysis-error-safe-fallback",
      metrics: null,
      evidence: {
        provider: "local_pixel_guard",
        status: "unknown",
        confidence: 0,
        strategy: "pixel-analysis-error-safe-fallback",
      },
    };
  }
};
