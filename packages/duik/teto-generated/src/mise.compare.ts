/**
 * Compare the generated composite against the reference image.
 *
 * Crops and normalizes the reference front view, then runs pixel-level
 * comparison metrics (SSIM, RMSE, PHASH) between the composite render
 * and the reference.
 *
 * Input: parts/_composite.png (from composite step)
 * Output: tmp/comparison.png (side-by-side), metrics printed to stdout
 *
 * @example
 * ```sh
 * mise run //packages/duik/teto-generated:compare
 * ```
 */
import { existsSync, } from 'node:fs';

import {
  generateComparisonImages,
  runComparisonMetrics,
} from './compare-output.ts';
import {
  FRONT_VIEW_CROP,
  PARTS_DIR,
  REFERENCE_PATH,
  TMP_DIR,
} from './config.ts';
import {
  capture,
  run,
} from './segment-utils.ts';

/** Compares the composite SVG rendering against the reference image. */
async function main(): Promise<void> {
  console.log('Comparing composite against reference',);

  const compositePng = `${PARTS_DIR}/_composite.png`;
  if (!existsSync(compositePng,)) {
    throw new Error(
      `Composite PNG not found: ${compositePng} — run the composite task first`,
    );
  }

  if (!existsSync(REFERENCE_PATH,))
    throw new Error(`Reference image not found: ${REFERENCE_PATH}`,);

  // Crop and normalize reference front view to match composite dimensions
  const refCropped = `${TMP_DIR}/ref_front_cropped.png`;
  const { x, y, width, height, } = FRONT_VIEW_CROP;

  await run([
    'magick',
    REFERENCE_PATH,
    '-crop',
    `${width}x${height}+${x}+${y}`,
    '+repage',
    '-fuzz',
    '3%',
    '-trim',
    '+repage',
    refCropped,
  ],);

  // Get composite dimensions and resize reference to match
  const compositeSize = await capture(['magick', 'identify', '-format', '%wx%h',
    compositePng,],);
  const refNormalized = `${TMP_DIR}/ref_normalized.png`;

  await run([
    'magick',
    refCropped,
    '-resize',
    compositeSize,
    '-background',
    'white',
    '-flatten',
    refNormalized,
  ],);

  // Normalize composite background too
  const compositeNorm = `${TMP_DIR}/composite_normalized.png`;
  await run([
    'magick',
    compositePng,
    '-background',
    'white',
    '-flatten',
    compositeNorm,
  ],);

  console.log(`  Reference: ${refCropped} → ${compositeSize}`,);

  // Run comparison metrics and generate visual output
  await runComparisonMetrics(compositeNorm, refNormalized,);
  await generateComparisonImages(compositeNorm, refNormalized, TMP_DIR,);
}

await main();

export {};
