/**
 * Per-part mask processing for body part segmentation.
 *
 * Creates color masks, applies bounding boxes, morphological cleanup,
 * and connected-component filtering for a single body part.
 *
 * @module
 */
import { TMP_DIR, } from './config.ts';
import {
  combineMasks,
  createColorMask,
  subtractColors,
} from './segment-color.ts';
import {
  applyBBox,
  applyMorphology,
} from './segment-ops.ts';
import { run, } from './segment-utils.ts';

import type { PartDef, } from './parts-types.ts';

/**
 * Process a single body part: color mask, bbox crop, morphology, save.
 *
 * @param part - Part definition
 *
 * @param inputImage - Cropped front view path
 *
 * @param imgWidth - Image width
 *
 * @param imgHeight - Image height
 *
 * @param fgMask - Path to foreground mask
 */
export async function processPart({
  part,
  inputImage,
  imgWidth,
  imgHeight,
  fgMask,
}: {
  readonly part: PartDef;
  readonly inputImage: string;
  readonly imgWidth: number;
  readonly imgHeight: number;
  readonly fgMask: string;
},): Promise<void> {
  const masksDir = `${TMP_DIR}/masks`;
  const workDir = `${TMP_DIR}/work`;
  const base = `${workDir}/${part.name}`;

  // When colors array is empty, use all foreground pixels (for parts
  // whose color matches the background, like epaulettes and accessories).
  const fgIntersected = `${base}_fg.pgm`;

  if (part.colors.length === 0) {
    // Skip color matching; use raw foreground mask
    await run(['magick', fgMask, fgIntersected,],);
  }
  else {
    // Step 1: Create per-color masks
    const colorPaths: string[] = [];
    for (let i = 0; i < part.colors.length; i++) {
      const colorPath = `${base}_c${i}.pgm`;
      const color = part.colors[i];
      if (color === undefined)
        continue;
      // eslint-disable-next-line no-await-in-loop -- sequential ImageMagick invocations; each must finish before the next
      await createColorMask({ input: inputImage, output: colorPath, color, },);
      colorPaths.push(colorPath,);
    }

    // Step 2: Combine color masks (OR)
    const combined = `${base}_combined.pgm`;
    await combineMasks({ masks: colorPaths, output: combined, },);

    // Step 3: Subtract excluded colors
    const excluded = `${base}_excluded.pgm`;
    await subtractColors({
      mask: combined,
      input: inputImage,
      output: excluded,
      excludes: part.excludeColors ?? [],
    },);

    // Step 4: Intersect with foreground mask
    await run([
      'magick',
      excluded,
      fgMask,
      '-compose',
      'Darken',
      '-composite',
      fgIntersected,
    ],);
  }

  // Step 5: Apply spatial bounding box
  const bboxed = `${base}_bbox.pgm`;
  await applyBBox({ mask: fgIntersected, output: bboxed, bbox: part.bbox, imgWidth,
    imgHeight, },);

  // Step 6: Morphological cleanup
  const DEFAULT_CLOSE_K = 5;
  const DEFAULT_OPEN_K = 3;
  const cleaned = `${base}_clean.pgm`;
  await applyMorphology({
    mask: bboxed,
    output: cleaned,
    closeK: part.morphClose ?? DEFAULT_CLOSE_K,
    openK: part.morphOpen ?? DEFAULT_OPEN_K,
  },);

  // Step 7: Filter out small noise blobs via area threshold.
  // Cannot use keep-top=1 because the black background is the largest component.
  // Instead, remove components smaller than 1% of the bbox area.
  const BBOX_W_IDX = 2;
  const BBOX_H_IDX = 3;
  const MIN_BLOB_AREA = 20;
  const AREA_FRACTION = 0.01;
  const bboxArea = Math.round(
    part.bbox[BBOX_W_IDX] * imgWidth * part.bbox[BBOX_H_IDX] * imgHeight,
  );
  const areaThreshold = Math.max(MIN_BLOB_AREA, Math.round(bboxArea * AREA_FRACTION,),);
  const final = `${masksDir}/${part.name}.pgm`;
  await run([
    'magick',
    cleaned,
    '-define',
    `connected-components:area-threshold=${areaThreshold}`,
    '-define',
    'connected-components:mean-color=true',
    '-connected-components',
    '4',
    final,
  ],);

  console.log(`  ${part.name}: done`,);
}
