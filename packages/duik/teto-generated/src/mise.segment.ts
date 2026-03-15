/**
 * Generate per-part binary masks using ImageMagick color matching.
 *
 * For each body part, creates a PGM mask by OR-combining color-distance
 * selections, applying spatial bounding-box crops, morphological cleanup,
 * and connected-component filtering.
 *
 * Input: tmp/front.png (from crop step)
 * Output: tmp/masks/*.pgm (one per body part, full crop dimensions)
 *
 * @example
 * ```sh
 * mise run //packages/duik/teto-generated:segment
 * ```
 */
import {
  existsSync,
  mkdirSync,
} from 'node:fs';

import {
  BACKGROUND,
  TMP_DIR,
} from './config.ts';
import { PARTS, } from './parts.ts';
import { processPart, } from './segment-process.ts';
import {
  getImageSize,
  rgbString,
  run,
  toleranceToFuzz,
} from './segment-utils.ts';

/**
 * Main segmentation entry point.
 * Creates foreground mask, then processes each body part sequentially.
 */
async function main(): Promise<void> {
  console.log('Segmenting body parts from front view',);

  const inputImage = `${TMP_DIR}/front.png`;
  if (!existsSync(inputImage,)) {
    throw new Error(
      `Cropped front view not found at ${inputImage} — run the crop task first`,
    );
  }

  for (const dir of [`${TMP_DIR}/masks`, `${TMP_DIR}/work`,]) {
    if (!existsSync(dir,))
      mkdirSync(dir, { recursive: true, },);
  }

  const { width: imgWidth, height: imgHeight, } = await getImageSize(inputImage,);
  console.log(`  Front view: ${imgWidth}x${imgHeight}`,);

  // Create global foreground mask (remove background)
  const fgMask = `${TMP_DIR}/work/foreground.pgm`;
  const bgRgb = rgbString(BACKGROUND.color,);
  const bgFuzz = toleranceToFuzz(BACKGROUND.tolerance,);

  // Background pixels → black, everything else → white
  await run([
    'magick',
    inputImage,
    '-fuzz',
    bgFuzz,
    '-fill',
    'black',
    '-opaque',
    bgRgb,
    '-fill',
    'white',
    '+opaque',
    'black',
    '-colorspace',
    'Gray',
    fgMask,
  ],);
  console.log('  Created foreground mask',);

  // Process each part sequentially (ImageMagick is already fast per-call)
  for (const part of PARTS)
    await processPart({ part, inputImage, imgWidth, imgHeight, fgMask, },);

  console.log(`Segmentation complete: ${PARTS.length} masks in ${TMP_DIR}/masks/`,);
}

await main();

export {};
