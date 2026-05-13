/**
 * Per-probe canvas-texture factory for the mesh scatter layers.
 *
 * Bakes the probe's fill colour AND its npm name into a 2D canvas that
 * deck.gl's `SimpleMeshLayer` consumes as `texture`. Texture sampling
 * happens in the fragment shader, so the painted name is part of the
 * mesh surface — front objects naturally occlude back objects, and
 * faces rotating away from the camera hide their text the same way a
 * real ball would.
 *
 * Why textures (and not a separate `TextLayer`): a billboard text
 * layer at the glyph center is either occluded by the front face of
 * its own mesh (`depthCompare: 'less-equal'`) or floats above every
 * scene object regardless of position (`depthCompare: 'always'`). Both
 * read as wrong; the user explicitly asked for "part of the mesh"
 * semantics. Texture mapping is the standard way to get that.
 *
 * Sphere UV layout (equirectangular): the name is repeated 2× along
 * the equator (`v = 0.5`) at `u = 0.25 / 0.75` so it is visible from
 * any longitude. The text is rasterised flipped vertically because
 * luma.gl's sphere uses `texCoord_v = 1 − latitude` (north pole → top
 * of texture, south pole → bottom), but WebGL by default uploads
 * canvases with canvas-top mapped to texture-bottom — without the
 * flip the names render upside-down on the visible hemisphere.
 *
 * Sphere font size auto-shrinks via `ctx.measureText` so even long
 * names like `happy-rusty` fit inside their `TEXTURE_SIZE_PX /
 * SPHERE_REPETITIONS` slot.
 *
 * Octahedron UV layout: every face is mapped to the same UV triangle
 * `(0, 0) — (1, 0) — (0.5, 1)`. The name is drawn inside that triangle
 * so each of the 8 faces shows the same label.
 *
 * The shape parameter selects which texture layout to use; spheres and
 * octahedra have very different unwrappings.
 *
 * Textures are cached by `(probe.catalogKey, rgba, shape, withName)`
 * so subsequent renders reuse the same canvas (and the same GPU
 * texture upload) when nothing colour-relevant or name-bake-relevant
 * has changed.
 *
 * @example
 * ```ts
 * import { makeProbeTexture } from './deck-textures.ts';
 * const tex = makeProbeTexture({ probe, fillColor: [200, 60, 60, 255], shape: 'sphere', withName: true });
 * new SimpleMeshLayer({ texture: tex, ... });
 * ```
 */

import type { PackageProbe, } from './probe.ts';

//region Types

/**
 * Mesh shape determines which UV layout the texture targets.
 *
 * Sphere: equirectangular projection (luma.gl `SphereGeometry`); name
 * repeated horizontally so any longitude shows it.
 *
 * Octahedron: per-face `(0,0)–(1,0)–(0.5,1)` triangle; name drawn
 * inside that triangle once.
 */
export type MeshShape = 'sphere' | 'octahedron';

/** RGBA tuple in `[0, 255]`. */
export type Rgba = readonly [
  number,
  number,
  number,
  number,
];

//endregion Types

//region Constants

/** Texture side length in pixels. Power-of-two for cleanest mipmaps. */
const TEXTURE_SIZE_PX = 512;
/** Maximum font size in pixels for the baked name; auto-shrunk on the sphere if the text overruns its slot. */
const FONT_SIZE_PX = 56;
/** Minimum font size in pixels — below this the text stops shrinking and just overflows; readability matters more than fit. */
const MIN_FONT_SIZE_PX = 22;
/** Black outline width in pixels around the white text fill. */
const OUTLINE_WIDTH_PX = 6;
/** Horizontal repetitions of the name around the sphere equator. Two copies (at u=0.25 and u=0.75) give visibility from any rotation while keeping each slot wide enough for readable text. */
const SPHERE_REPETITIONS = 2;
/** Vertical position of the equator in texture-space (sphere UV: equator is `v = 0.5`). */
const SPHERE_EQUATOR_V = 0.5;
/** Fraction of the slot width the text may occupy before auto-shrink kicks in. Leaves a small margin for the outline. */
const SPHERE_SLOT_FILL_FRACTION = 0.85;
/** Half-coefficient used for centring. */
const HALF = 1 / 2;
/** Module-level cache: `(catalogKey, rgba, shape, withName)` → built canvas. Avoids re-rendering on every state recompute. */
const TEXTURE_CACHE = new Map<string, HTMLCanvasElement>();
/** Octahedron face triangle centroid is at `v = 1/3` (UV layout `(0,0)–(1,0)–(0.5,1)`); pre-compute to keep the value out of inline literals. */
const OCTAHEDRON_CENTROID_V = 1 / 3;

//endregion Constants

//region Helpers

/**
 * Builds the stable cache key for a (probe, colour, shape, withName)
 * tuple.
 *
 * @param probe - Source probe.
 * @param fillColor - RGBA fill colour.
 * @param shape - Mesh shape.
 * @param withName - Whether the name is baked into the texture.
 *
 * @returns Cache key string.
 */
function cacheKey(
  {
    probe,
    fillColor,
    shape,
    withName,
  }: {
    probe: PackageProbe;
    fillColor: Rgba;
    shape: MeshShape;
    withName: boolean;
  },
): string {
  return `${probe.catalogKey}|${fillColor.join(',',)}|${shape}|${withName ? '1' : '0'}`;
}

/**
 * Fills the canvas with the base colour. Sets `fillStyle` to a CSS
 * rgba string derived from the byte-RGBA tuple.
 *
 * @param ctx - Target context.
 * @param fillColor - RGBA tuple, 0–255.
 */
function paintBackground(
  {
    ctx,
    fillColor,
  }: {
    ctx: CanvasRenderingContext2D;
    fillColor: Rgba;
  },
): void {
  const [
    r,
    g,
    b,
    a,
  ] = fillColor;
  ctx.fillStyle = `rgba(${r.toString()}, ${g.toString()}, ${b.toString()}, ${(a / 255).toString()})`;
  ctx.fillRect(0, 0, TEXTURE_SIZE_PX, TEXTURE_SIZE_PX,);
}

/**
 * Draws the name with a black outline and white fill at a given centre,
 * vertically flipped so it renders right-side-up on a sphere whose
 * texture is uploaded without Y-flip (canvas top → texture v=0 →
 * sphere south pole per luma.gl's `1 - latitude` mapping).
 *
 * For the octahedron the flip also applies; the UV triangle is
 * orientation-symmetric so the text either reads as drawn or as a
 * 180° rotation depending on which face the viewer is looking at —
 * acceptable, since each octahedron has 8 faces and at least one is
 * orientation-friendly from any camera angle.
 *
 * @param ctx - Target context.
 * @param text - Name string.
 * @param x - Horizontal centre in texture pixels.
 * @param y - Vertical centre in texture pixels.
 */
function paintFlippedName(
  {
    ctx,
    text,
    x,
    y,
  }: {
    ctx: CanvasRenderingContext2D;
    text: string;
    x: number;
    y: number;
  },
): void {
  ctx.save();
  ctx.translate(x, y,);
  ctx.scale(1, -1,);
  ctx.strokeText(text, 0, 0,);
  ctx.fillText(text, 0, 0,);
  ctx.restore();
}

/**
 * Returns the largest font size in `[MIN_FONT_SIZE_PX, FONT_SIZE_PX]`
 * that fits `text` inside `slotWidthPx * SPHERE_SLOT_FILL_FRACTION`.
 *
 * Uses `ctx.measureText` at `FONT_SIZE_PX` and rescales proportionally
 * — text width is linear in font size for a given typeface, so one
 * measurement is enough.
 *
 * @param ctx - Target context (must already have `font` set so subsequent measureText returns the correct width).
 * @param text - The string that will be drawn.
 * @param slotWidthPx - Width of the slot the text must fit inside.
 *
 * @returns Font size in pixels.
 */
function pickFontSize(
  {
    ctx,
    text,
    slotWidthPx,
  }: {
    ctx: CanvasRenderingContext2D;
    text: string;
    slotWidthPx: number;
  },
): number {
  const measuredAtMax = ctx.measureText(text,).width;
  const targetWidth = slotWidthPx * SPHERE_SLOT_FILL_FRACTION;
  if (measuredAtMax <= targetWidth) return FONT_SIZE_PX;
  const scaled = FONT_SIZE_PX * (targetWidth / measuredAtMax);
  return Math.max(MIN_FONT_SIZE_PX, scaled,);
}

//endregion Helpers

//region Public API

/**
 * Builds (or retrieves from cache) the canvas texture for one probe.
 *
 * Sphere variant: repeats the name `SPHERE_REPETITIONS` times along
 * the equator so the label is visible from any longitude.
 *
 * Octahedron variant: paints the name once inside the face triangle
 * `(0,0)–(1,0)–(0.5,1)` (in normalised UV); every face of the
 * octahedron maps to that triangle so the label shows on each face.
 *
 * @param probe - Source probe.
 * @param fillColor - RGBA tuple matching the probe's data-derived colour at full alpha.
 * @param shape - Mesh shape selecting the UV layout.
 * @param withName - When `false`, the texture is colour-only (no name baked).
 *
 * @returns Canvas element ready to pass to `SimpleMeshLayer.texture`.
 *
 * @throws When `document.createElement('canvas').getContext('2d')` returns null (no Canvas2D support).
 *
 * @example
 * ```ts
 * const tex = makeProbeTexture({
 *   probe,
 *   fillColor: [200, 60, 60, 255],
 *   shape: 'sphere',
 *   withName: true,
 * });
 * ```
 */
export function makeProbeTexture(
  {
    probe,
    fillColor,
    shape,
    withName,
  }: {
    probe: PackageProbe;
    fillColor: Rgba;
    shape: MeshShape;
    withName: boolean;
  },
): HTMLCanvasElement {
  const key = cacheKey({
    probe,
    fillColor,
    shape,
    withName,
  },);
  const cached = TEXTURE_CACHE.get(key,);
  if (cached !== undefined) return cached;
  const canvas = document.createElement('canvas',);
  canvas.width = TEXTURE_SIZE_PX;
  canvas.height = TEXTURE_SIZE_PX;
  const ctx = canvas.getContext('2d',);
  if (ctx === null) throw new Error('Canvas2D context unavailable',);
  paintBackground({
    ctx,
    fillColor,
  },);
  if (!withName) {
    TEXTURE_CACHE.set(key, canvas,);
    return canvas;
  }
  ctx.font = `700 ${FONT_SIZE_PX.toString()}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = 'rgba(0, 0, 0, 1)';
  ctx.fillStyle = 'rgba(255, 255, 255, 1)';
  if (shape === 'sphere') {
    const stepPx = TEXTURE_SIZE_PX / SPHERE_REPETITIONS;
    const fontSize = pickFontSize({
      ctx,
      text: probe.npmName,
      slotWidthPx: stepPx,
    },);
    ctx.font = `700 ${fontSize.toString()}px sans-serif`;
    ctx.lineWidth = OUTLINE_WIDTH_PX * (fontSize / FONT_SIZE_PX);
    const yPx = SPHERE_EQUATOR_V * TEXTURE_SIZE_PX;
    const offsets = Array.from(
      {
        length: SPHERE_REPETITIONS,
      },
      function asOffset(_, i,) {
        return (i + HALF) * stepPx;
      },
    );
    for (const xPx of offsets) {
      paintFlippedName({
        ctx,
        text: probe.npmName,
        x: xPx,
        y: yPx,
      },);
    }
  } else {
    ctx.lineWidth = OUTLINE_WIDTH_PX;
    const centreX = TEXTURE_SIZE_PX * HALF;
    /**
     * Octahedron faces map to UV triangle `(0,0) – (1,0) – (0.5,1)`,
     * so the visual centroid in texture space is at `(0.5, 1/3)`.
     * Drawing the text there centres it inside every face.
     */
    const yPx = OCTAHEDRON_CENTROID_V * TEXTURE_SIZE_PX;
    paintFlippedName({
      ctx,
      text: probe.npmName,
      x: centreX,
      y: yPx,
    },);
  }
  TEXTURE_CACHE.set(key, canvas,);
  return canvas;
}

//endregion Public API
