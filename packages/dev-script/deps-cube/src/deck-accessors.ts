/**
 * Per-probe accessor functions used by deck.gl layer factories.
 *
 * Pure, side-effect-free: given a probe + the current `AppState` +
 * the scene bounds + a visibility flag, return the displayed value
 * for one visual property (position, color, radius, shape).
 *
 * Layer factories wrap these into closures suitable for deck.gl's
 * `Accessor<T, V>` API. Separating accessors from layer factories
 * keeps the layer file under the 300-line cap and lets the accessors
 * be unit-tested in isolation against fixture probes.
 *
 * @example
 * ```ts
 * const color = probeFillColor({
 *   probe, state, bounds, isVisible: true,
 * });
 * ```
 */

import type { PackageProbe, } from './probe.ts';
import type { SceneBounds, } from './deck-config.ts';
import { extractDim, } from './scripts/filter.ts';
import type { AppState, } from './scripts/state.ts';

//region Constants

/** Alpha channel value when a probe passes every filter. */
const ALPHA_VISIBLE = 255;
/** Alpha channel value when a probe is filtered out (≈ 5% opacity). */
const ALPHA_FILTERED = 13;
/** Constant blue tint added to the red↔green colormap so glyphs aren't pure 0,255,0 / 255,0,0. */
const COLOR_BLUE_TINT = 80;
/** Mid-grey used for unknown color values. */
const COLOR_UNKNOWN: readonly [number, number, number,] = [
  136,
  136,
  136,
];
/** Minimum glyph radius in pixels. */
const RADIUS_MIN_PX = 3;
/** Maximum glyph radius in pixels. */
const RADIUS_MAX_PX = 30;
/** Offset applied to the unknown cluster, in scene-units, from the data box's max corner. */
const UNKNOWN_CLUSTER_OFFSET = 2;
/** Half-extent of the unknown-cluster jitter cube so glyphs don't pile on one point. */
const UNKNOWN_CLUSTER_JITTER = 0.5;
/** Binary "is filled" threshold: shape dim values < this render filled, otherwise stroked. */
const SHAPE_FILLED_THRESHOLD = 0.5;
/** RGB channel max value, used for the linear colormap. */
const RGB_MAX = 255;

//endregion Constants

//region Helpers

/**
 * Maps a value into the unit interval `[0, 1]` given inclusive bounds.
 * Degenerate bounds (`lo === hi`) return `0.5` to centre the result.
 *
 * @param value - Source value.
 * @param lo - Lower bound, inclusive.
 * @param hi - Upper bound, inclusive.
 *
 * @returns `t` in `[0, 1]`.
 */
function normalise(
  {
    value,
    lo,
    hi,
  }: {
    value: number;
    lo: number;
    hi: number;
  },
): number {
  if (hi === lo) return 0.5;
  return Math.min(1, Math.max(0, (value - lo) / (hi - lo),),);
}

//endregion Helpers

//region Position

/**
 * Returns the 3D scene-space position of a probe, or `null` when any
 * spatial dim is unknown. Probes returning `null` belong in the
 * Unknown-cluster layer instead.
 *
 * @param probe - Source probe.
 * @param state - Current state (uses `dimMapping.x/y/z`).
 *
 * @returns `[x, y, z]` in scene coords, or `null` when undefined.
 */
export function probePosition(
  {
    probe,
    state,
  }: {
    probe: PackageProbe;
    state: AppState;
  },
): [number, number, number,] | null {
  const x = extractDim({
    probe,
    dim: state.dimMapping.x,
  },);
  const y = extractDim({
    probe,
    dim: state.dimMapping.y,
  },);
  const z = extractDim({
    probe,
    dim: state.dimMapping.z,
  },);
  if (x === null || y === null || z === null) return null;
  return [x, y, z,];
}

/**
 * Returns a deterministic position inside the unknown-cluster region.
 *
 * Unknown probes are pushed off to one corner of the scene with a
 * stable per-index offset so they don't all collapse to one point.
 *
 * @param index - Probe index (deterministic input).
 * @param bounds - Scene bounds.
 *
 * @returns `[x, y, z]` in scene coords.
 */
export function unknownClusterPosition(
  {
    index,
    bounds,
  }: {
    index: number;
    bounds: SceneBounds;
  },
): [number, number, number,] {
  const [
    ,
    xMax,
  ] = bounds.x;
  const [
    ,
    yMax,
  ] = bounds.y;
  const [
    ,
    zMax,
  ] = bounds.z;
  // Cheap stable hash → 3 small offsets in [-J, J].
  const hash = (index * 2654435761) >>> 0;
  const jx = (((hash & 0xff) / 0xff) - 0.5) * 2 * UNKNOWN_CLUSTER_JITTER;
  const jy = ((((hash >> 8) & 0xff) / 0xff) - 0.5) * 2 * UNKNOWN_CLUSTER_JITTER;
  const jz = ((((hash >> 16) & 0xff) / 0xff) - 0.5) * 2 * UNKNOWN_CLUSTER_JITTER;
  return [
    xMax + UNKNOWN_CLUSTER_OFFSET + jx,
    yMax + UNKNOWN_CLUSTER_OFFSET + jy,
    zMax + UNKNOWN_CLUSTER_OFFSET + jz,
  ];
}

//endregion Position

//region Color

/**
 * Returns the RGBA fill colour for one probe.
 *
 * - Visible probes use a red↔green linear ramp over the colour
 *   channel's bounds plus a constant blue tint.
 * - Probes with unknown colour-dim value get {@link COLOR_UNKNOWN} grey.
 * - Filtered-out probes get alpha={@link ALPHA_FILTERED} (≈ 5%);
 *   visible probes get alpha={@link ALPHA_VISIBLE}.
 *
 * @param probe - Source probe.
 * @param state - Current state (uses `dimMapping.color`).
 * @param bounds - Scene bounds.
 * @param isVisible - `true` when the probe passes every filter.
 *
 * @returns RGBA tuple, each component in `[0, 255]`.
 */
export function probeFillColor(
  {
    probe,
    state,
    bounds,
    isVisible,
  }: {
    probe: PackageProbe;
    state: AppState;
    bounds: SceneBounds;
    isVisible: boolean;
  },
): [number, number, number, number,] {
  const alpha = isVisible ? ALPHA_VISIBLE : ALPHA_FILTERED;
  const value = extractDim({
    probe,
    dim: state.dimMapping.color,
  },);
  if (value === null)
    return [
      COLOR_UNKNOWN[0],
      COLOR_UNKNOWN[1],
      COLOR_UNKNOWN[2],
      alpha,
    ];
  const [
    lo,
    hi,
  ] = bounds.color;
  const t = normalise({
    value,
    lo,
    hi,
  },);
  const r = Math.round(RGB_MAX * (1 - t),);
  const g = Math.round(RGB_MAX * t,);
  return [
    r,
    g,
    COLOR_BLUE_TINT,
    alpha,
  ];
}

//endregion Color

//region Radius

/**
 * Returns the glyph radius in pixels, linearly interpolated between
 * {@link RADIUS_MIN_PX} and {@link RADIUS_MAX_PX} over the size
 * channel's bounds. Unknown size-dim values get the minimum radius.
 *
 * @param probe - Source probe.
 * @param state - Current state (uses `dimMapping.size`).
 * @param bounds - Scene bounds.
 *
 * @returns Radius in pixels.
 */
export function probeRadius(
  {
    probe,
    state,
    bounds,
  }: {
    probe: PackageProbe;
    state: AppState;
    bounds: SceneBounds;
  },
): number {
  const value = extractDim({
    probe,
    dim: state.dimMapping.size,
  },);
  if (value === null) return RADIUS_MIN_PX;
  const [
    lo,
    hi,
  ] = bounds.size;
  const t = normalise({
    value,
    lo,
    hi,
  },);
  return RADIUS_MIN_PX + t * (RADIUS_MAX_PX - RADIUS_MIN_PX);
}

//endregion Radius

//region Shape

/**
 * Returns `true` if the probe should be rendered as a filled glyph
 * (vs stroked / hollow). Filled = shape-dim value below
 * {@link SHAPE_FILLED_THRESHOLD}; hollow otherwise. Unknown shape
 * value defaults to hollow so partially-unknown glyphs are visually
 * distinguishable from the all-known set.
 *
 * @param probe - Source probe.
 * @param state - Current state (uses `dimMapping.shape`).
 *
 * @returns `true` if filled, `false` if stroked.
 */
export function probeIsFilled(
  {
    probe,
    state,
  }: {
    probe: PackageProbe;
    state: AppState;
  },
): boolean {
  const value = extractDim({
    probe,
    dim: state.dimMapping.shape,
  },);
  if (value === null) return false;
  return value < SHAPE_FILLED_THRESHOLD;
}

//endregion Shape
