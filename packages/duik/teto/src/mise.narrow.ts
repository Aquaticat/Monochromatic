// oxlint-disable no-magic-numbers -- SVG transform script with many dimensional constants
/**
 * Narrows SVG body parts by scaling x-coordinates toward center (x=400).
 *
 * Reads individual body part SVG files, applies per-part horizontal
 * narrowing factors, and writes them back. Different factors target
 * different body regions based on measurement data.
 *
 * @example
 * ```sh
 * bun run src/mise.narrow.ts
 * ```
 */

import {
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { join, } from 'node:path';

import { transformSvg, } from './narrow-svg.ts';

/** Directory containing individual body part SVG files. */
const PARTS_DIR = join(import.meta.dirname, '..', 'parts',);

/**
 * Single-pass narrowing factors from original coordinates.
 * Only targets parts that make the character look too wide.
 * Skirt and legs are left untouched.
 *
 * Based on measurements: torso 68% too wide at chest, arms thick,
 * boots 17% too wide, head 20% too wide.
 */
const PART_FACTORS: Record<string, number> = {
  /** Head 20% too wide -- gentle narrowing. */
  head_face: 0.88,
  eyes: 0.88,
  mouth: 0.88,
  /** Bangs frame the face, match head factor. */
  hair_bangs: 0.88,
  hair_back: 0.85,
  /** Drills are the single widest offender at shoulder level (116% too wide). */
  hair_drill_L: 0.65,
  hair_drill_R: 0.65,
  /** Accessories on top of drills. */
  hair_accessory_L: 0.8,
  hair_accessory_R: 0.8,
  /** Torso jacket is boxy and wide (68% too wide at chest). */
  torso_front: 0.75,
  /** Epaulettes extend beyond shoulders. */
  epaulette_L: 0.72,
  epaulette_R: 0.72,
  /** Arms are thick cylinders, need slimming. */
  upper_arm_L: 0.78,
  upper_arm_R: 0.78,
  forearm_L: 0.8,
  forearm_R: 0.8,
  hand_L: 0.82,
  hand_R: 0.82,
  /** Boots are 17% too wide. */
  boot_L: 0.88,
  boot_R: 0.88,
};

console.error('--- Narrowing SVG parts ---',);
console.error('',);

for (const [partName, factor,] of Object.entries(PART_FACTORS,)) {
  const filePath = join(PARTS_DIR, `${partName}.svg`,);
  const original = readFileSync(filePath, 'utf8',);
  const transformed = transformSvg(original, factor,);

  /** Count how many coordinates changed. */
  const origNums = original.match(/[-\d.]+/g,)?.length ?? 0;
  const transNums = transformed.match(/[-\d.]+/g,)?.length ?? 0;

  writeFileSync(filePath, transformed,);
  console.error(
    `  ${partName}: factor=${factor}  (${origNums} nums -> ${transNums} nums)`,
  );
}

console.error('',);
console.error('Done. Run `bun run src/mise.measure.ts` to verify.',);
