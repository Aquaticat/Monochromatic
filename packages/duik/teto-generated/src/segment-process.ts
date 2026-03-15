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
 * @param inputImage - Cropped front view path
 * @param imgWidth - Image width
 * @param imgHeight - Image height
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
  const cleaned = `${base}_clean.pgm`;
  await applyMorphology({
    mask: bboxed,
    output: cleaned,
    closeK: part.morphClose ?? 5,
    openK: part.morphOpen ?? 3,
  },);

  // Step 7: Filter out small noise blobs via area threshold.
  // Cannot use keep-top=1 because the black background is the largest component.
  // Instead, remove components smaller than 1% of the bbox area.
  const bboxArea = Math.round(part.bbox[2] * imgWidth * part.bbox[3] * imgHeight,);
  const areaThreshold = Math.max(20, Math.round(bboxArea * 0.01,),);
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
