/**
 * Image conversion utilities for the AVIF format pipeline.
 *
 * Provides file existence checking and sharp-based AVIF conversion
 * used by the top-level format script.
 */
import { access, } from 'node:fs/promises';

import sharp from 'sharp';

/**
 * AVIF encoding quality (0-100). Lossless-equivalent maximum.
 */
export const AVIF_QUALITY = 100;

/**
 * AVIF encoding effort (0-9, higher = slower + better compression). Maximum effort.
 */
export const AVIF_EFFORT = 9;

/**
 * Narrows an unknown caught value to a Node.js filesystem error with a `code` property.
 *
 * @param error - caught value to check
 *
 * @returns `true` if the error is an `Error` instance carrying a string `code`
 */
function isNodeError(error: unknown,): error is Error & { code: string; } {
  return (Error.isError(error,))
    && ('code' in error)
    && ((typeof error.code) === 'string');
}

/**
 * Checks whether a file is accessible at the given path.
 *
 * Returns `false` on **any** access error, not only missing files:
 * permission errors, broken symlinks, and I/O failures all yield `false`.
 *
 * @param filePath - path to check
 *
 * @param l - optional logger for unexpected access errors
 *
 * @returns `true` if accessible, `false` on any access error
 *
 * @example
 * ```ts
 * if (await fileExists({ filePath: 'image.png' })) {
 *   // file is accessible
 * }
 * ```
 */
export async function fileExists(
  {
    filePath,
    l,
  }: {
    readonly filePath: string;
    readonly l?: { readonly error: (message: string,) => void; };
  },
): Promise<boolean> {
  try {
    await access(filePath,);
    return true;
  }
  catch (error) {
    // Expected for missing files; log unexpected access errors for diagnostics
    if ((!isNodeError(error,)) || (error.code
      !== 'ENOENT')) {
      /**
       * Fallback to console so diagnostic still surfaces when no logger is supplied.
       */
      const target = l ?? console;
      target.error(
        `Unexpected error checking file existence for ${filePath}: ${String(error,)}`,
      );
    }
    return false;
  }
}

/**
 * Converts a single raster image to AVIF format.
 *
 * @param inputPath - path to the source raster image
 *
 * @param outputPath - path for the AVIF output
 *
 * @example
 * ```ts
 * await convertToAvif({ inputPath: 'photo.png', outputPath: 'photo.avif' });
 * ```
 */
export async function convertToAvif(
  {
    inputPath,
    outputPath,
  }: {
    readonly inputPath: string;
    readonly outputPath: string;
  },
): Promise<void> {
  await sharp(inputPath,)
    .avif({
      quality: AVIF_QUALITY,
      effort: AVIF_EFFORT,
    },)
    .toFile(outputPath,);
}

/**
 * Checks via {@link fileExists} if an AVIF counterpart exists for a raster
 * image, and converts it with {@link convertToAvif} when missing.
 *
 * @param filePath - source raster image path
 *
 * @param avifPath - expected AVIF output path
 *
 * @param l - logger for conversion progress messages
 *
 * @returns `true` if a conversion was performed, `false` if skipped
 *
 * @example
 * ```ts
 * const converted = await maybeConvert({ filePath: 'photo.png', avifPath: 'photo.avif', l: logger });
 * ```
 */
export async function maybeConvert(
  {
    filePath,
    avifPath,
    l,
  }: {
    readonly filePath: string;
    readonly avifPath: string;
    readonly l: { readonly info: (message: string,) => void; };
  },
): Promise<boolean> {
  if (await fileExists({ filePath: avifPath, },))
    return false;

  l.info(`converting ${filePath} -> ${avifPath}`,);
  await convertToAvif({
    inputPath: filePath,
    outputPath: avifPath,
  },);
  return true;
}
