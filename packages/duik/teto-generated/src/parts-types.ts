/**
 * Shared types and helpers for body part definitions.
 *
 * Provides the foundational types, color constructor, and reference
 * JPEG color samples used by all part definition modules.
 *
 * @module
 */

/** RGB color with matching tolerance for segmentation. */
export type ColorSpec = {
  /** RGB values 0-255. */
  readonly rgb: readonly [number, number, number]
  /** Euclidean distance threshold in RGB space. */
  readonly tolerance: number
}

/** Definition of a single body part for extraction. */
export type PartDef = {
  /** Identifier matching the hand-crafted teto naming convention. */
  readonly name: string
  /** Bounding box as fraction of crop dimensions: [x, y, width, height]. */
  readonly bbox: readonly [number, number, number, number]
  /**
   * Colors to include in the mask (OR-combined).
   * Empty array means "use all foreground pixels in bbox" (for parts
   * whose color is indistinguishable from the background).
   */
  readonly colors: readonly ColorSpec[]
  /** Colors to reject even if they match an include color. */
  readonly excludeColors?: readonly ColorSpec[]
  /** SVG fill color for the generated path. */
  readonly fill: string
  /** Morphological close kernel size; fills small holes. Default 5. */
  readonly morphClose?: number
  /** Morphological open kernel size; removes small noise. Default 3. */
  readonly morphOpen?: number
}

/**
 * Shorthand to avoid repeating palette lookups.
 *
 * @internal
 *
 * @param rgb - RGB values 0-255
 *
 * @param tolerance - Euclidean distance threshold
 *
 * @returns color spec
 */
export function c(rgb: readonly [number, number, number], tolerance: number): ColorSpec {
  return { rgb, tolerance }
}

/**
 * Warm gray sampled from the reference JPEG.
 * The reference has a warm-purple tint absent from the design palette.
 *
 * @internal
 */
export const REF_GRAY_WARM = [188, 182, 186] as const

/**
 * Dark gray sampled from the reference JPEG.
 *
 * @internal
 */
export const REF_GRAY_DARK = [144, 135, 140] as const

/**
 * Red sampled from the reference JPEG.
 *
 * @internal
 */
export const REF_RED = [190, 72, 88] as const
