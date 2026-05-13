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
 * Sphere UV layout (equirectangular): the name is repeated 4× along
 * the equator (`v = 0.5`) at `u = 0.125 / 0.375 / 0.625 / 0.875` so it
 * is visible from any longitude.
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
/** Font size in pixels for the baked name. */
const FONT_SIZE_PX = 56;
/** Black outline width in pixels around the white text fill. */
const OUTLINE_WIDTH_PX = 6;
/** Horizontal repetitions of the name around the sphere equator. */
const SPHERE_REPETITIONS = 4;
/** Vertical position of the equator in texture-space (sphere UV: equator is `v = 0.5`). */
const SPHERE_EQUATOR_V = 0.5;
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
 * Draws the name with a black outline and white fill at a given centre.
 *
 * @param ctx - Target context.
 * @param text - Name string.
 * @param x - Horizontal centre in texture pixels.
 * @param y - Vertical centre in texture pixels.
 */
function paintName(
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
  ctx.strokeText(text, x, y,);
  ctx.fillText(text, x, y,);
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
  ctx.lineWidth = OUTLINE_WIDTH_PX;
  ctx.lineJoin = 'round';
  ctx.strokeStyle = 'rgba(0, 0, 0, 1)';
  ctx.fillStyle = 'rgba(255, 255, 255, 1)';
  if (shape === 'sphere') {
    const yPx = SPHERE_EQUATOR_V * TEXTURE_SIZE_PX;
    const stepPx = TEXTURE_SIZE_PX / SPHERE_REPETITIONS;
    const offsets = Array.from(
      {
        length: SPHERE_REPETITIONS,
      },
      function asOffset(_, i,) {
        return (i + HALF) * stepPx;
      },
    );
    for (const xPx of offsets) {
      paintName({
        ctx,
        text: probe.npmName,
        x: xPx,
        y: yPx,
      },);
    }
  } else {
    const centreX = TEXTURE_SIZE_PX * HALF;
    /**
     * Octahedron faces map to UV triangle `(0,0) – (1,0) – (0.5,1)`,
     * so the visual centroid in texture space is at `(0.5, 1/3)`.
     * Drawing the text there centres it inside every face.
     */
    const yPx = OCTAHEDRON_CENTROID_V * TEXTURE_SIZE_PX;
    paintName({
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
