/**
 * Type definitions for width profile measurement data.
 *
 * Shared types used by profile scanning, querying, landmark measurement,
 * and chart generation modules.
 *
 * @module
 */

/**
 * Per-row width data from a silhouette scan.
 *
 * @example
 * ```ts
 * const profile = measureWidthProfile('/tmp/silhouette.png', '/tmp');
 * console.log(profile.rows[0]?.width);
 * ```
 */
export type WidthProfile = {
  /** Image width in pixels. */
  imageWidth: number;
  /** Image height in pixels. */
  imageHeight: number;
  /** Per-row width measurements, only for rows with content. */
  rows: {
    y: number;
    left: number;
    right: number;
    width: number;
  }[];
};

/** Single row in the proportion comparison table. */
export type MeasurementRow = {
  /** Anatomical landmark name (e.g. `shoulders`, `waist`). */
  landmark: string;
  /** Relative vertical position within body content (0 = top, 1 = bottom). */
  relY: number;
  /** Pixel width of the reference silhouette at this landmark. */
  refWidth: number;
  /** Pixel width of the composite silhouette at this landmark. */
  cmpWidth: number;
  /** Composite-to-reference width ratio as a formatted string. */
  ratio: string;
  /** Percentage difference from reference as a formatted string. */
  diff: string;
};

/** Content bounds of a silhouette profile. */
export type ContentBoundsResult = {
  /** Relative y position of topmost content row (0-1). */
  top: number;
  /** Relative y position of bottommost content row (0-1). */
  bottom: number;
  /** Absolute pixel height of content region. */
  totalHeight: number;
};
