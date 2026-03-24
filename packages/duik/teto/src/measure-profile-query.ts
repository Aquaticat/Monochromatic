/**
 * Width profile query and analysis utilities.
 *
 * Functions for querying widths at specific vertical positions,
 * finding extrema within anatomical regions, computing content bounds,
 * and formatting measurement ratios.
 *
 * @module
 */

import type {
  ContentBoundsResult,
  WidthProfile,
} from './measure-profile-types.ts';

/**
 * Finds the width at a given relative vertical position (0 = top, 1 = bottom).
 *
 * @param profile - width profile data
 *
 * @param relY - relative y position (0-1)
 *
 * @returns width in pixels at that position, or 0 if no data
 */
export function widthAtRelY(
  profile: WidthProfile,
  relY: number,
): number {
  const targetY = Math.round(relY * profile.imageHeight,);
  const row = profile.rows.find(function matchRow(r,) {
    return r.y === targetY;
  },);
  return row?.width ?? 0;
}

/**
 * Finds the maximum width within a relative y range.
 *
 * @param profile - width profile data
 *
 * @param relYStart - start of range (0-1)
 *
 * @param relYEnd - end of range (0-1)
 *
 * @returns maximum width and relative y position
 */
export function maxWidthInRange(
  profile: WidthProfile,
  relYStart: number,
  relYEnd: number,
): { width: number; relY: number; } {
  const yStart = Math.round(relYStart * profile.imageHeight,);
  const yEnd = Math.round(relYEnd * profile.imageHeight,);
  let maxW = 0;
  let maxY = yStart;

  for (const row of profile.rows) {
    if (row.y >= yStart && row.y <= yEnd && row.width > maxW) {
      maxW = row.width;
      maxY = row.y;
    }
  }

  return { width: maxW, relY: maxY / profile.imageHeight, };
}

/**
 * Finds the minimum width within a relative y range.
 *
 * @param profile - width profile data
 *
 * @param relYStart - start of range (0-1)
 *
 * @param relYEnd - end of range (0-1)
 *
 * @returns minimum width and relative y position
 */
export function minWidthInRange(
  profile: WidthProfile,
  relYStart: number,
  relYEnd: number,
): { width: number; relY: number; } {
  const yStart = Math.round(relYStart * profile.imageHeight,);
  const yEnd = Math.round(relYEnd * profile.imageHeight,);
  let minW = Infinity;
  let minY = yStart;

  for (const row of profile.rows) {
    if (row.y >= yStart && row.y <= yEnd && row.width < minW) {
      minW = row.width;
      minY = row.y;
    }
  }

  return { width: minW === Infinity ? 0 : minW, relY: minY / profile.imageHeight, };
}

/**
 * Finds the topmost and bottommost rows with content.
 *
 * @param profile - width profile data
 *
 * @returns top and bottom y positions (relative 0-1)
 */
export function contentBounds(profile: WidthProfile,): ContentBoundsResult {
  if (profile.rows.length === 0)
    return { top: 0, bottom: 0, totalHeight: 0, };
  const [firstRow,] = profile.rows;
  if (firstRow === undefined)
    return { top: 0, bottom: 0, totalHeight: 0, };
  const top = firstRow.y;
  const lastRow = profile.rows.at(-1,);
  if (lastRow === undefined)
    return { top: 0, bottom: 0, totalHeight: 0, };
  const bottom = lastRow.y;
  return {
    top: top / profile.imageHeight,
    bottom: bottom / profile.imageHeight,
    totalHeight: bottom - top,
  };
}

/**
 * Converts a relative content position to an absolute image y fraction.
 *
 * @param bounds - content bounds from contentBounds()
 *
 * @param relContent - relative position within content (0-1)
 *
 * @returns absolute y fraction (0-1) in image coordinates
 */
export function contentToAbsY(
  bounds: ContentBoundsResult,
  relContent: number,
): number {
  return bounds.top + relContent * (bounds.bottom - bounds.top);
}

/**
 * Formats a ratio safely, handling zero denominators.
 *
 * @param cmpVal - composite normalized value
 *
 * @param refVal - reference normalized value
 *
 * @returns formatted ratio string
 */
export function fmtRatio(cmpVal: number, refVal: number,): string {
  if (refVal === 0)
    return 'N/A';
  return (cmpVal / refVal).toFixed(2,);
}
