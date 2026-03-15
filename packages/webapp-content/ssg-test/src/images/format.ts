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

export {}; // eslint module boundary marker

/** Glob pattern matching raster image extensions eligible for AVIF conversion. Covers all formats sharp can decode. */
const RASTER_GLOB = '**/*.{png,jpg,jpeg,tif,tiff,webp,gif,heic,heif}';

/** AVIF encoding quality (0-100). Lossless-equivalent maximum. */
const AVIF_QUALITY = 100;

/** AVIF encoding effort (0-9, higher = slower + better compression). Maximum effort. */
const AVIF_EFFORT = 9;

/** Directories to scan for raster images. */
const SCAN_DIRS = ['src/content', 'public',];

/**
 * Checks whether a file exists at the given path.
 *
 * @param filePath - path to check
 *
 * @returns `true` if the file exists, `false` otherwise
 */
async function fileExists(filePath: string,): Promise<boolean> {
  try {
    await access(filePath,);
    return true;
  }
  catch {
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
 * Scans directories for raster images and converts those without
 * existing AVIF counterparts.
 */
async function formatImages(): Promise<void> {
  console.log('[format:images] scanning for raster images',);

  /** Conversion tasks to run in parallel. */
  const tasks: Array<Promise<boolean>> = [];

  for (const dir of SCAN_DIRS) {
    const result = await readdir(`${dir}/${RASTER_GLOB}`,);

    for (const filePath of result.files) {
      const nameWithoutExt = basename(filePath, extname(filePath,),);
      const avifPath = join(dirname(filePath,), `${nameWithoutExt}.avif`,);

      tasks.push(
        fileExists(avifPath,).then(async function maybeConvert(exists,) {
          if (exists)
            return false;

          console.log(`[format:images] converting ${filePath} -> ${avifPath}`,);
          await convertToAvif({ inputPath: filePath, outputPath: avifPath, },);
          return true;
        },),
      );
    }
  }

  const results = await Promise.all(tasks,);
  const converted = results.filter(Boolean,).length;
  const skipped = results.length - converted;

  console.log(`[format:images] done: ${converted} converted, ${skipped} skipped`,);
}

await formatImages();
