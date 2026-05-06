/**
 * tests/unit/moderation.test.js
 *
 * Verifica el sistema de moderación de contenido:
 *   1. detectRestrictedContentText   — nombres de archivo / texto
 *   2. detectInappropriateText       — lenguaje ofensivo en descripciones
 *   3. detectIndecentImageByModeration — metadatos de Cloudinary
 *   4. analyzeImageFileForRestrictedContent — análisis píxel-a-píxel
 *
 * Escenarios clave del negocio (NØSEE = precios de productos en tiendas):
 *   ✅ Foto normal de producto (arroz, leche, cereal) → permitida
 *   ✅ Foto de tienda (exterior, estantes)             → permitida
 *   ✅ Carne roja / tomates / packaging rojo           → permitida (falso positivo corregido)
 *   ✅ Packaging naranja/amarillo (cereales, jugos)    → permitida (falso positivo corregido)
 *   ❌ Contenido adulto / pornografía                 → bloqueado
 *   ❌ Gore / violencia gráfica                       → bloqueado
 *   ❌ Hentai / anime adulto                          → bloqueado
 */

import { describe, it, expect, vi, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import {
  detectRestrictedContentText,
  detectInappropriateText,
  detectIndecentImageByModeration,
  analyzeImageFileForRestrictedContent,
} from '../../src/services/moderation.js';

// ─── Píxeles sintéticos validados contra los modelos de detección ──────────────
//
// SKIN_PIXEL: tono de piel humana
//   • RGB Chai-Jones: R=200>95, G=140>40, B=110>20, max-min=90>15, |R-G|=60>15, R>G, R>B ✓
//   • YCbCr:  Cb≈102.9 ∈ [77,127] ✓  Cr≈160.4 ∈ [133,173] ✓
const SKIN_PIXEL    = [200, 140, 110, 255];

// BLOOD_PIXEL: rojo oscuro similar a sangre
//   • HSV: H=0° (isRedHue), s≈0.89≥0.35, v≈0.71∈[0.18,0.80] ✓
//   • redDominance≈0.81>0.52, R-G=160>35, R-B=160>35 ✓
const BLOOD_PIXEL   = [180,  20,  20, 255];

// ANIME_PIXEL: tono naranja cálido — activa anime-skin Y vivid simultáneamente
//   • H≈20° ∈ [5,45], s≈0.60 ∈ [0.18,0.72], v≈0.98≥0.55 → animeSkin ✓
//   • s=0.60≥0.55, v=0.98≥0.38 → vivid ✓
//   • También activa skin RGB (R>G>B con diferencias suficientes)
const ANIME_PIXEL   = [250, 150, 100, 255];

// NEUTRAL_PIXEL: gris verdoso — no activa ningún detector
//   • max-min=10<15 → no skin-RGB, Cb≈127.2>127 → no YCbCr, H≈149° → no anime, s≈0.08<0.55 → no vivid
const NEUTRAL_PIXEL = [120, 130, 125, 255];

// ─── Constructor de datos de imagen sintéticos ─────────────────────────────────
// Tamaño 200×200 = 40 000 píxeles > IMAGE_MIN_ANALYSIS_PIXELS (20 000)
const IMG_W = 200;
const IMG_H = 200;

/**
 * Construye un ImageData-like con los píxeles mezclados aleatoriamente
 * (distribución uniforme) según los ratios indicados.
 *
 * @param {number} w
 * @param {number} h
 * @param {Array<[[r,g,b,a], number]>} pixelMap  - pares [pixel, ratio]
 */
function buildPixelData(w, h, pixelMap) {
  const total = w * h;
  const pixels = [];

  for (const [pixel, ratio] of pixelMap) {
    const count = Math.round(total * ratio);
    for (let i = 0; i < count; i++) pixels.push(pixel);
  }
  while (pixels.length < total) pixels.push(NEUTRAL_PIXEL);
  pixels.length = total;

  // Fisher-Yates determinista (semilla fija) para distribución uniforme entre celdas del grid
  let seed = 42;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) & 0xFFFFFFFF;
    return (seed >>> 0) / 0xFFFFFFFF;
  };
  for (let i = pixels.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [pixels[i], pixels[j]] = [pixels[j], pixels[i]];
  }

  const data = new Uint8ClampedArray(total * 4);
  for (let i = 0; i < total; i++) {
    data[i * 4]     = pixels[i][0];
    data[i * 4 + 1] = pixels[i][1];
    data[i * 4 + 2] = pixels[i][2];
    data[i * 4 + 3] = pixels[i][3] ?? 255;
  }
  return { data, width: w, height: h };
}

// ─── Mocks de APIs de browser (jsdom no implementa canvas ni URL.createObjectURL) ──

let currentImageData = null;
let origCreateElement;
let origCreateObjectURL;
let origRevokeObjectURL;
let OriginalImage;

beforeAll(() => {
  // URL APIs
  origCreateObjectURL  = URL.createObjectURL;
  origRevokeObjectURL  = URL.revokeObjectURL;
  URL.createObjectURL  = vi.fn(() => 'blob:mock');
  URL.revokeObjectURL  = vi.fn();

  // Image: dispara onload cuando se asigna src
  OriginalImage        = globalThis.Image;
  globalThis.Image     = class MockImage {
    constructor() {
      this.naturalWidth  = IMG_W;
      this.naturalHeight = IMG_H;
    }
    set src(_) { queueMicrotask(() => this.onload?.()); }
  };

  // document.createElement: intercepta 'canvas' y devuelve datos controlados
  origCreateElement    = document.createElement.bind(document);
  document.createElement = (tag) => {
    if (tag === 'canvas') {
      return {
        width: 0,
        height: 0,
        getContext: () => ({
          drawImage: () => {},
          getImageData: () => currentImageData,
        }),
      };
    }
    return origCreateElement(tag);
  };
});

afterAll(() => {
  URL.createObjectURL  = origCreateObjectURL;
  URL.revokeObjectURL  = origRevokeObjectURL;
  globalThis.Image     = OriginalImage;
  document.createElement = origCreateElement;
});

afterEach(() => {
  currentImageData = null;
});

// ─── Helper: File dummy ────────────────────────────────────────────────────────
const makeFile = (name = 'producto.jpg') =>
  new File([new Uint8Array(512)], name, { type: 'image/jpeg' });


// ══════════════════════════════════════════════════════════════════════════════
// 1. MODERACIÓN DE TEXTO — nombres de archivo y descripciones
// ══════════════════════════════════════════════════════════════════════════════

describe('detectRestrictedContentText — nombres de archivo', () => {
  it('acepta nombre de producto normal (arroz_diana_500g.jpg)', () => {
    const result = detectRestrictedContentText('arroz_diana_500g.jpg');
    expect(result.flagged).toBe(false);
  });

  it('acepta nombre de tienda normal (tienda_exito_centro.jpg)', () => {
    const result = detectRestrictedContentText('tienda_exito_centro.jpg');
    expect(result.flagged).toBe(false);
  });

  it('acepta nombre de evidencia de tienda (fachada_supermercado.jpg)', () => {
    const result = detectRestrictedContentText('fachada_supermercado.jpg');
    expect(result.flagged).toBe(false);
  });

  it('bloquea nombre con keyword adulto explícito (porn_video.jpg)', () => {
    const result = detectRestrictedContentText('porn_video.jpg');
    expect(result.flagged).toBe(true);
    expect(result.matches).toContain('porn');
  });

  it('bloquea "xxx" en filename (corregido: se revisa texto pre-colapso)', () => {
    // collapseRepeatedChars("xxx") → "xx", pero ahora se revisa también el texto
    // sin colapsar, así el keyword "xxx" hace match correctamente.
    const result = detectRestrictedContentText('xxx_foto.jpg');
    expect(result.flagged).toBe(true);
    expect(result.matches).toContain('xxx');
  });

  it('bloquea nombre con keyword gore (gore_scene.jpg)', () => {
    const result = detectRestrictedContentText('gore_scene.jpg');
    expect(result.flagged).toBe(true);
    expect(result.matches).toContain('gore');
  });

  it('bloquea nombre con keyword porno en español (pornografia_video.mp4)', () => {
    const result = detectRestrictedContentText('pornografia_video.mp4');
    expect(result.flagged).toBe(true);
  });

  it('no confunde "violeta" (color) con "violento" (gore)', () => {
    const result = detectRestrictedContentText('crema_violeta.jpg');
    expect(result.flagged).toBe(false);
  });
});


describe('detectInappropriateText — texto de descripción', () => {
  it('acepta descripción normal de producto', () => {
    const result = detectInappropriateText('Arroz blanco de 500g, excelente calidad, oferta del día');
    expect(result.flagged).toBe(false);
  });

  it('bloquea insulto fuerte (hijueputa, peso 5 ≥ umbral 3)', () => {
    const result = detectInappropriateText('este producto es una hijueputa estafa');
    expect(result.flagged).toBe(true);
    expect(result.score).toBeGreaterThanOrEqual(3);
  });

  it('bloquea término sexual ofensivo (puta, peso 3 = umbral 3)', () => {
    const result = detectInappropriateText('puta oferta');
    expect(result.flagged).toBe(true);
  });

  it('no bloquea insulto leve sin targeting (idiota, peso 2 < umbral 3)', () => {
    const result = detectInappropriateText('producto idiota');
    expect(result.flagged).toBe(false);
    expect(result.score).toBeLessThan(3);
  });
});


// ══════════════════════════════════════════════════════════════════════════════
// 2. MODERACIÓN POR METADATOS DE CLOUDINARY
// ══════════════════════════════════════════════════════════════════════════════

describe('detectIndecentImageByModeration — respuesta de Cloudinary', () => {
  it('no bloquea cuando no hay metadatos de moderación', () => {
    const result = detectIndecentImageByModeration([]);
    expect(result.flagged).toBe(false);
    expect(result.strategy).toBe('no-metadata');
  });

  it('bloquea cuando status es "rejected" (hard block)', () => {
    const result = detectIndecentImageByModeration([{ status: 'rejected' }]);
    expect(result.flagged).toBe(true);
    expect(result.strategy).toBe('status-hard-block');
  });

  it('bloquea cuando status "flagged" + confianza alta + keyword de alto riesgo', () => {
    const result = detectIndecentImageByModeration([
      { status: 'flagged', labels: ['nudity'], score: 0.92 },
    ]);
    expect(result.flagged).toBe(true);
    expect(result.confidence).toBeGreaterThanOrEqual(0.75);
  });

  it('no bloquea cuando status "flagged" pero sin señal de alto riesgo', () => {
    const result = detectIndecentImageByModeration([
      { status: 'flagged', labels: ['text_overlay'], score: 0.30 },
    ]);
    expect(result.flagged).toBe(false);
  });
});


// ══════════════════════════════════════════════════════════════════════════════
// 3. ANÁLISIS DE PÍXELES — el corazón del sistema
//    Umbrales vigentes (corregidos en branch cristhian):
//      SKIN  ≥ 0.58  (sin cambio)
//      BLOOD ≥ 0.35  (antes 0.20 — producía falsos positivos en carne/tomates)
//      ANIME ≥ 0.55  (antes 0.32 — producía falsos positivos en packaging naranja)
//      VIVID ≥ 0.55  (antes 0.38 — producía falsos positivos bajo luz fluorescente)
// ══════════════════════════════════════════════════════════════════════════════

describe('analyzeImageFileForRestrictedContent — fotos PERMITIDAS (no deben bloquearse)', () => {
  it('foto normal de producto (25% tonos cálidos, 75% neutros)', async () => {
    // Representa packaging de cereal, leche, etc. con algo de color cálido
    currentImageData = buildPixelData(IMG_W, IMG_H, [
      [SKIN_PIXEL, 0.25],
      [NEUTRAL_PIXEL, 0.75],
    ]);

    const result = await analyzeImageFileForRestrictedContent(makeFile('arroz.jpg'));

    expect(result.flagged).toBe(false);
    expect(result.metrics.skinRatio).toBeLessThan(0.58);
  });

  it('foto de tienda o local (colores neutros, grises, blancos)', async () => {
    currentImageData = buildPixelData(IMG_W, IMG_H, [
      [NEUTRAL_PIXEL, 1.0],
    ]);

    const result = await analyzeImageFileForRestrictedContent(makeFile('fachada_tienda.jpg'));

    expect(result.flagged).toBe(false);
    expect(result.metrics.skinRatio).toBeLessThan(0.10);
    expect(result.metrics.bloodRatio).toBeLessThan(0.10);
  });

  it('foto de carne roja / tomates (30% píxeles rojizos — CORREGIDO con umbral 0.35)', async () => {
    // bloodRatio = 0.30 < BLOOD_RATIO_BLOCK_THRESHOLD (0.35) → seguro
    // Con el umbral anterior de 0.20 este caso era bloqueado (falso positivo)
    currentImageData = buildPixelData(IMG_W, IMG_H, [
      [BLOOD_PIXEL,   0.30],
      [NEUTRAL_PIXEL, 0.70],
    ]);

    const result = await analyzeImageFileForRestrictedContent(makeFile('carne_res.jpg'));

    expect(result.flagged).toBe(false);
    expect(result.metrics.bloodRatio).toBeLessThan(0.35);
  });

  it('frasco de salsa / packaging rojo (10% rojizo global — CORREGIDO: hotspot solitario eliminado)', async () => {
    // Caso real: bote de salsa con label rojo y salsa oscura.
    // bloodRatio global ≈ 0.10 (el frasco ocupa solo parte de la foto).
    // Antes: maxBloodHotspotRatio en las celdas del label era ≥ 0.405 → GORE (falso positivo).
    // Ahora: requiere bloodRatio global ≥ 0.35 TAMBIÉN → no bloqueado.
    currentImageData = buildPixelData(IMG_W, IMG_H, [
      [BLOOD_PIXEL,   0.10],
      [NEUTRAL_PIXEL, 0.90],
    ]);

    const result = await analyzeImageFileForRestrictedContent(makeFile('salsa_negra.jpg'));

    expect(result.flagged).toBe(false);
    expect(result.metrics.bloodRatio).toBeLessThan(0.35);
  });

  it('packaging naranja/amarillo (40% anime-skin+vivid — CORREGIDO con umbral 0.55)', async () => {
    // animeSkinRatio = 0.40 < ANIME_SKIN_RATIO_BLOCK_THRESHOLD (0.55) → seguro
    // Con el umbral anterior de 0.32 este caso era bloqueado (falso positivo)
    currentImageData = buildPixelData(IMG_W, IMG_H, [
      [ANIME_PIXEL,   0.40],
      [NEUTRAL_PIXEL, 0.60],
    ]);

    const result = await analyzeImageFileForRestrictedContent(makeFile('cereal_packaging.jpg'));

    expect(result.flagged).toBe(false);
    expect(result.metrics.animeSkinRatio).toBeLessThan(0.55);
  });
});


describe('analyzeImageFileForRestrictedContent — fotos BLOQUEADAS (contenido indebido)', () => {
  it('bloquea contenido adulto/pornográfico (90% píxeles de piel)', async () => {
    // skinRatio = 0.90 ≥ SKIN_RATIO_BLOCK_THRESHOLD (0.58) y centerSkinRatio alto → adulto
    currentImageData = buildPixelData(IMG_W, IMG_H, [
      [SKIN_PIXEL,    0.90],
      [NEUTRAL_PIXEL, 0.10],
    ]);

    const result = await analyzeImageFileForRestrictedContent(makeFile('foto.jpg'));

    expect(result.flagged).toBe(true);
    expect(result.labels).toContain('adult');
    expect(result.metrics.skinRatio).toBeGreaterThanOrEqual(0.58);
  });

  it('bloquea gore / violencia gráfica (60% píxeles de sangre)', async () => {
    // bloodRatio = 0.60 ≥ BLOOD_RATIO_BLOCK_THRESHOLD (0.35) y hotspot ≥ 0.30 → gore
    currentImageData = buildPixelData(IMG_W, IMG_H, [
      [BLOOD_PIXEL,   0.60],
      [NEUTRAL_PIXEL, 0.40],
    ]);

    const result = await analyzeImageFileForRestrictedContent(makeFile('foto.jpg'));

    expect(result.flagged).toBe(true);
    expect(result.labels).toContain('gore');
    expect(result.metrics.bloodRatio).toBeGreaterThanOrEqual(0.35);
  });

  it('bloquea hentai / anime adulto (80% anime-skin con vivid alto)', async () => {
    // animeSkinRatio = 0.80 ≥ 0.55, vividRatio = 0.80 ≥ 0.55, hotspot ≥ 0.24 → anime adulto
    currentImageData = buildPixelData(IMG_W, IMG_H, [
      [ANIME_PIXEL,   0.80],
      [NEUTRAL_PIXEL, 0.20],
    ]);

    const result = await analyzeImageFileForRestrictedContent(makeFile('foto.jpg'));

    expect(result.flagged).toBe(true);
    // Puede activar 'adult' o 'adult_anime' dependiendo de qué umbral se supera primero
    expect(result.labels.some(l => l === 'adult' || l === 'adult_anime')).toBe(true);
    expect(result.metrics.animeSkinRatio).toBeGreaterThanOrEqual(0.55);
  });

  it('retorna confidence > 0 en imagen bloqueada', async () => {
    currentImageData = buildPixelData(IMG_W, IMG_H, [
      [SKIN_PIXEL, 0.95],
    ]);

    const result = await analyzeImageFileForRestrictedContent(makeFile('foto.jpg'));

    expect(result.flagged).toBe(true);
    expect(result.confidence).toBeGreaterThan(0);
    expect(result.reason).toBeTruthy();
  });
});


describe('analyzeImageFileForRestrictedContent — casos borde', () => {
  it('retorna seguro (no lanza) si el contexto canvas no está disponible (fallback)', async () => {
    // Forzar getContext a retornar null para simular entorno sin canvas
    const savedData = currentImageData;
    currentImageData = null;

    const origDoc = document.createElement;
    document.createElement = (tag) => {
      if (tag === 'canvas') {
        return { width: 0, height: 0, getContext: () => null };
      }
      return origCreateElement(tag);
    };

    const result = await analyzeImageFileForRestrictedContent(makeFile('foto.jpg'));

    document.createElement = origDoc;
    currentImageData = savedData;

    // El fallback de error debe retornar flagged: false (no bloquear por error técnico)
    expect(result.flagged).toBe(false);
    expect(result.strategy).toContain('error');
  });
});
