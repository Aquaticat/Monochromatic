/**
 * Color-based mask operations for body part segmentation.
 *
 * Creating single-color masks, OR-combining multiple masks,
 * and subtracting exclusion colors.
 *
 * @module
 */
import {
  rgbString,
  run,
  toleranceToFuzz,
} from './segment-utils.ts';

import type { ColorSpec, } from './parts-types.ts';

/**
 * Create a single-color binary mask using ImageMagick fuzz matching.
 *
 * Pixels within tolerance of the target color become white (255);
 * all others become black (0).
 *
 * @param input - Source image path
 *
 * @param output - Output PGM path
 *
 * @param color - Target color specification
 */
export async function createColorMask({
  input,
  output,
  color,
}: {
  readonly input: string;
  readonly output: string;
  readonly color: ColorSpec;
},): Promise<void> {
  const fuzz = toleranceToFuzz(color.tolerance,);
  const rgb = rgbString(color.rgb,);

  // Fill everything NOT matching the target color with black,
  // then fill the remaining (matching) pixels with white.
  await run([
    'magick',
    input,
    '-fuzz',
    fuzz,
    '-fill',
    'black',
    '+opaque',
    rgb,
    '-fill',
    'white',
    '-opaque',
    rgb,
    '-colorspace',
    'Gray',
    output,
  ],);
}

/**
 * OR-combine multiple mask images into one.
 * Uses ImageMagick Lighten compositing (max of each pixel).
 *
 * @param masks - Paths to mask images to combine
 *
 * @param output - Output combined mask path
 */
export async function combineMasks({
  masks,
  output,
}: {
  readonly masks: readonly string[];
  readonly output: string;
},): Promise<void> {
  if (masks.length === 0)
    return;
  const [firstMask,] = masks;
  if (firstMask === undefined)
    return;
  if (masks.length === 1) {
    await run(['magick', firstMask, output,],);
    return;
  }

  // Stack all masks and flatten with Lighten (OR)
  const args: string[] = ['magick', firstMask,];
  for (let i = 1; i < masks.length; i++) {
    const mask = masks[i];
    if (mask === undefined)
      continue;
    args.push(mask, '-compose', 'Lighten', '-composite',);
  }
  args.push(output,);
  await run(args,);
}

/**
 * Subtract exclusion colors from a mask.
 * Pixels matching any exclude color are set to black.
 *
 * @param mask - Input mask path (modified in place via output)
 *
 * @param input - Original color image for color matching
 *
 * @param output - Output mask path
 *
 * @param excludes - Colors to subtract
 */
export async function subtractColors({
  mask,
  input,
  output,
  excludes,
}: {
  readonly mask: string;
  readonly input: string;
  readonly output: string;
  readonly excludes: readonly ColorSpec[];
},): Promise<void> {
  if (excludes.length === 0) {
    await run(['magick', mask, output,],);
    return;
  }

  // Create an exclusion mask (white = pixels to REMOVE)
  const excPaths: string[] = [];
  for (let i = 0; i < excludes.length; i++) {
    const excPath = output.replace('.pgm', `_exc${i}.pgm`,);
    const excludeColor = excludes[i];
    if (excludeColor === undefined)
      continue;
    // eslint-disable-next-line no-await-in-loop -- sequential ImageMagick invocations; each must finish before the next
    await createColorMask({ input, output: excPath, color: excludeColor, },);
    excPaths.push(excPath,);
  }

  // Combine exclusion masks
  const combinedExc = output.replace('.pgm', '_exc_combined.pgm',);
  await combineMasks({ masks: excPaths, output: combinedExc, },);

  // Subtract: mask AND (NOT exclusion)
  await run([
    'magick',
    mask,
    combinedExc,
    '-compose',
    'MinusSrc',
    '-composite',
    output,
  ],);
}
