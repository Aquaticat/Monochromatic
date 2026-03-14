/**
 * Width profile measurement utilities for body proportion analysis.
 *
 * Functions for scanning silhouette images to build per-row width profiles,
 * querying widths at specific vertical positions, and finding extrema
 * within anatomical regions.
 *
 * @module
 */

// oxlint-disable no-magic-numbers -- measurement utilities use dimensional constants

import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

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
  imageWidth: number
  /** Image height in pixels. */
  imageHeight: number
  /** Per-row width measurements, only for rows with content. */
  rows: { y: number; left: number; right: number; width: number }[]
}

/** Single row in the proportion comparison table. */
export type MeasurementRow = {
  /** Anatomical landmark name (e.g. `shoulders`, `waist`). */
  landmark: string
  /** Relative vertical position within body content (0 = top, 1 = bottom). */
  relY: number
  /** Pixel width of the reference silhouette at this landmark. */
  refWidth: number
  /** Pixel width of the composite silhouette at this landmark. */
  cmpWidth: number
  /** Composite-to-reference width ratio as a formatted string. */
  ratio: string
  /** Percentage difference from reference as a formatted string. */
  diff: string
}

/** Content bounds of a silhouette profile. */
export type ContentBoundsResult = {
  /** Relative y position of topmost content row (0-1). */
  top: number
  /** Relative y position of bottommost content row (0-1). */
  bottom: number
  /** Absolute pixel height of content region. */
  totalHeight: number
}

/**
 * Runs a shell command and returns stdout trimmed.
 *
 * @param cmd - shell command string
 *
 * @returns trimmed stdout
 */
function run(cmd: string): string {
  return execSync(cmd, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim()
}

/**
 * Scans a grayscale/binary image row by row to build a width profile.
 *
 * Uses ImageMagick to dump pixel values as PGM text, then parses each row
 * to find the leftmost and rightmost non-zero pixel.
 *
 * @param imagePath - path to the silhouette PNG
 *
 * @param tmpDir - temporary directory for intermediate PGM dump
 *
 * @returns object with dimensions and per-row width data
 */
export function measureWidthProfile(imagePath: string, tmpDir: string): WidthProfile {
  /** Get image dimensions. */
  const dims = run(`magick identify -format "%w %h" "${imagePath}"`)
  const [imgW, imgH] = dims.split(' ').map(Number)

  /**
   * Dump as single-channel gray values.
   * Output format: PGM text with pixel values.
   */
  run(
    `magick "${imagePath}" -colorspace Gray -depth 8 -compress none PGM:- 2>/dev/null > "${tmpDir}/measure_dump.pgm" && echo done`,
  )

  /** Read the PGM file directly -- it's a simple text format. */
  const pgmData = readFileSync(`${tmpDir}/measure_dump.pgm`, 'utf8')
  const pgmLines = pgmData.split('\n')

  /**
   * PGM format: P2, then width height, then max value, then pixel values.
   * Skip comment lines starting with #.
   */
  const dataLines = pgmLines.filter(function skipComments(line) {
    return line.trim().length > 0 && !line.startsWith('#') && line.trim() !== 'P2'
  })

  /** First data line is "width height", second is max value. */
  const firstLine = dataLines[0];
  if (firstLine === undefined) throw new Error('PGM file has no data lines');
  const [width, height] = firstLine.trim().split(/\s+/).map(Number)
  if (width === undefined || height === undefined) throw new Error('PGM header missing dimensions')

  /** Collect all pixel values into a flat array. */
  const pixelValues: number[] = []
  for (let i = 2; i < dataLines.length; i++) {
    const line = dataLines[i];
    if (line === undefined) continue;
    const vals = line.trim().split(/\s+/).map(Number)
    for (const v of vals) {
      pixelValues.push(v)
    }
  }

  const rows: WidthProfile['rows'] = []

  for (let y = 0; y < height; y++) {
    const rowStart = y * width
    let left = -1
    let right = -1

    for (let x = 0; x < width; x++) {
      const val = pixelValues[rowStart + x]
      if (val !== undefined && val > 128) {
        if (left === -1) left = x
        right = x
      }
    }

    if (left !== -1) {
      rows.push({ y, left, right, width: right - left + 1 })
    }
  }

  return { imageWidth: width, imageHeight: height, rows }
}

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
  const targetY = Math.round(relY * profile.imageHeight)
  const row = profile.rows.find(function matchRow(r) {
    return r.y === targetY
  })
  return row?.width ?? 0
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
): { width: number; relY: number } {
  const yStart = Math.round(relYStart * profile.imageHeight)
  const yEnd = Math.round(relYEnd * profile.imageHeight)
  let maxW = 0
  let maxY = yStart

  for (const row of profile.rows) {
    if (row.y >= yStart && row.y <= yEnd && row.width > maxW) {
      maxW = row.width
      maxY = row.y
    }
  }

  return { width: maxW, relY: maxY / profile.imageHeight }
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
): { width: number; relY: number } {
  const yStart = Math.round(relYStart * profile.imageHeight)
  const yEnd = Math.round(relYEnd * profile.imageHeight)
  let minW = Infinity
  let minY = yStart

  for (const row of profile.rows) {
    if (row.y >= yStart && row.y <= yEnd && row.width < minW) {
      minW = row.width
      minY = row.y
    }
  }

  return { width: minW === Infinity ? 0 : minW, relY: minY / profile.imageHeight }
}

/**
 * Finds the topmost and bottommost rows with content.
 *
 * @param profile - width profile data
 *
 * @returns top and bottom y positions (relative 0-1)
 */
export function contentBounds(profile: WidthProfile): ContentBoundsResult {
  if (profile.rows.length === 0) return { top: 0, bottom: 0, totalHeight: 0 }
  const firstRow = profile.rows[0];
  if (firstRow === undefined) return { top: 0, bottom: 0, totalHeight: 0 };
  const top = firstRow.y
  const lastRow = profile.rows.at(-1);
  if (lastRow === undefined) return { top: 0, bottom: 0, totalHeight: 0 };
  const bottom = lastRow.y
  return {
    top: top / profile.imageHeight,
    bottom: bottom / profile.imageHeight,
    totalHeight: bottom - top,
  }
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
  return bounds.top + relContent * (bounds.bottom - bounds.top)
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
export function fmtRatio(cmpVal: number, refVal: number): string {
  if (refVal === 0) return 'N/A'
  return (cmpVal / refVal).toFixed(2)
}
