/**
 * Width profile measurement from silhouette images.
 *
 * Scans silhouette images row by row using ImageMagick to build
 * per-row width profiles for body proportion analysis.
 *
 * @module
 */

// oxlint-disable no-magic-numbers -- measurement utilities use dimensional constants

import { execSync, } from 'node:child_process';
import { readFileSync, } from 'node:fs';

import type { WidthProfile, } from './measure-profile-types.ts';

export type {
  ContentBoundsResult,
  MeasurementRow,
  WidthProfile,
} from './measure-profile-types.ts';

/**
 * Runs a shell command and returns stdout trimmed.
 *
 * @param cmd - shell command string
 *
 * @returns trimmed stdout
 */
function run(cmd: string,): string {
  return execSync(
    cmd,
    { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe',], },
  )
    .trim();
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
export function measureWidthProfile(
  imagePath: string,
  tmpDir: string,
): WidthProfile {
  /** Get image dimensions. */
  const dims = run(`magick identify -format "%w %h" "${imagePath}"`,);
  const [imgW, imgH,] = dims.split(' ',).map(Number,);

  /**
   * Dump as single-channel gray values.
   * Output format: PGM text with pixel values.
   */
  run(
    `magick "${imagePath}" -colorspace Gray -depth 8 -compress none PGM:- 2>/dev/null > "${tmpDir}/measure_dump.pgm" && echo done`,
  );

  /** Read the PGM file directly -- it's a simple text format. */
  const pgmData = readFileSync(
    `${tmpDir}/measure_dump.pgm`,
    'utf8',
  );
  const pgmLines = pgmData.split('\n',);

  /**
   * PGM format: P2, then width height, then max value, then pixel values.
   * Skip comment lines starting with #.
   */
  const dataLines = pgmLines.filter(function skipComments(line,) {
    return line.trim().length > 0 && !line.startsWith('#',) && line.trim() !== 'P2';
  },);

  /** First data line is "width height", second is max value. */
  const [firstLine,] = dataLines;
  if (firstLine === undefined)
    throw new Error('PGM file has no data lines',);
  const [width, height,] = firstLine.trim().split(/\s+/,).map(Number,);
  if (width === undefined || height === undefined)
    throw new Error('PGM header missing dimensions',);

  /** Collect all pixel values into a flat array. */
  const pixelValues: number[] = [];
  for (let i = 2; i < dataLines.length; i++) {
    const line = dataLines[i];
    if (line === undefined)
      continue;
    const vals = line.trim().split(/\s+/,).map(Number,);
    for (const v of vals)
      pixelValues.push(v,);
  }

  const rows: WidthProfile['rows'] = [];

  for (let y = 0; y < height; y++) {
    const rowStart = y * width;
    let left = -1;
    let right = -1;

    for (let x = 0; x < width; x++) {
      const val = pixelValues[rowStart + x];
      if (val !== undefined && val > 128) {
        if (left === -1)
          left = x;
        right = x;
      }
    }

    if (left !== -1) {
      rows.push({
        y,
        left,
        right,
        width: right - left + 1,
      },);
    }
  }

  return {
    imageWidth: width,
    imageHeight: height,
    rows,
  };
}
