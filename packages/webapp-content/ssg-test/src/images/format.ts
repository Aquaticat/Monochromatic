/**
 * Image format conversion script.
 *
 * Converts non-AVIF raster images (PNG, JPEG, TIFF, WebP) to AVIF
 * counterparts using sharp. Only converts files that do not already
 * have a sibling `.avif` file on disk.
 *
 * Run via `mise run format:images`.
 */
import { access, } from 'node:fs/promises';
import { basename, dirname, extname, join, } from 'node:path';

import sharp from 'sharp';
import readdir from 'tiny-readdir-glob';

import {
  $,
  initPromise,
} from '@monochromatic-dev/module-es/logger';
import { $ as tagged, } from '@monochromatic-dev/module-es/tagged';

export {}; // eslint module boundary marker

await initPromise;

/**
 * Tagged logger for the image format conversion subsystem.
 * All log output carries the `format:images` prefix automatically.
 */
const l = tagged({ tag: 'format:images', l: $, },);

/**
 * Glob pattern matching raster image extensions eligible for AVIF conversion.
 *
 * Covers all raster formats sharp (libvips) can decode, derived from the
 * `ImageType` enum in sharp's `src/common.h`. Excludes vector (SVG),
 * document (PDF), and specialty formats (FITS, DCRAW, VIPS, MAGICK, OpenSlide).
 */
const RASTER_GLOB = '**/*.{png,jpg,jpeg,tif,tiff,webp,gif,heic,heif,jxl,jp2,j2k,jpx,ppm,pgm,pbm,pfm,exr,hdr}';

/** AVIF encoding quality (0-100). Lossless-equivalent maximum. */
const AVIF_QUALITY = 100;

/** AVIF encoding effort (0-9, higher = slower + better compression). Maximum effort. */
const AVIF_EFFORT = 9;

/** Directories to scan for raster images. */
const SCAN_DIRS = ['src/content', 'public',];

/**
 * Narrows an unknown caught value to a Node.js filesystem error with a `code` property.
 *
 * @param error - caught value to check
 *
 * @returns `true` if the error is an `Error` instance carrying a string `code`
 */
function isNodeError(error: unknown,): error is Error & { code: string; } {
  return error instanceof Error && 'code' in error && typeof error.code === 'string';
}

/**
 * Checks whether a file is accessible at the given path.
 *
 * Returns `false` on **any** access error, not only missing files --
 * permission errors, broken symlinks, and I/O failures all yield `false`.
 *
 * @param filePath - path to check
 *
 * @returns `true` if accessible, `false` on any access error
 */
async function fileExists(filePath: string,): Promise<boolean> {
  try {
    await access(filePath,);
    return true;
  }
  catch (error) {
    // Expected for missing files; log unexpected access errors for diagnostics
    if (!isNodeError(error,) || error.code !== 'ENOENT') {
      console.error(`Unexpected error checking file existence for ${filePath}:`, error,);
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
 */
async function convertToAvif(
  { inputPath, outputPath, }: { inputPath: string; outputPath: string; },
): Promise<void> {
  await sharp(inputPath,)
    .avif({ quality: AVIF_QUALITY, effort: AVIF_EFFORT, },)
    .toFile(outputPath,);
}

/**
 * Checks if an AVIF counterpart exists for a raster image and converts
 * it when missing.
 *
 * @param filePath - source raster image path
 *
 * @param avifPath - expected AVIF output path
 *
 * @returns `true` if a conversion was performed, `false` if skipped
 */
async function maybeConvert(
  { filePath, avifPath, }: { filePath: string; avifPath: string; },
): Promise<boolean> {
  if (await fileExists(avifPath,)) {
    return false;
  }

  l.info(`converting ${filePath} -> ${avifPath}`,);
  await convertToAvif({ inputPath: filePath, outputPath: avifPath, },);
  return true;
}

//region Top-level conversion pipeline -- scans directories and converts raster images to AVIF

l.info('scanning for raster images',);

/** Scan results from all directories, fetched concurrently. */
const scanResults = await Promise.all(
  SCAN_DIRS.map(function scanDir(dir,) { return readdir(`${dir}/${RASTER_GLOB}`,); },),
);

/** Conversion tasks for all discovered raster images across all scanned directories. */
const tasks = scanResults.flatMap(function buildTasks(result,) {
  return result.files.map(function createTask(filePath,) {
    /** Base filename without extension, used to derive the AVIF output path. */
    const nameWithoutExt = basename(filePath, extname(filePath,),);
    /** Target AVIF path sitting alongside the source raster image. */
    const avifPath = join(dirname(filePath,), `${nameWithoutExt}.avif`,);
    return maybeConvert({ filePath, avifPath, },);
  },);
},);

/** Settled conversion outcomes used to tally converted vs skipped counts. */
const results = await Promise.all(tasks,);
/** Number of images that were newly converted to AVIF. */
const converted = results.filter(Boolean,).length;
/** Number of images skipped because an AVIF counterpart already existed. */
const skipped = results.length - converted;

l.info(`done: ${converted} converted, ${skipped} skipped`,);

//endregion Top-level conversion pipeline
