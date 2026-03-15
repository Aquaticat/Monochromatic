/**
 * Body part definitions for reference image segmentation.
 * Each part specifies a spatial bounding box (as fraction of crop dimensions),
 * target colors with tolerances, and morphological cleanup parameters.
 *
 * Colors sampled from the actual reference JPEG (which has muted tones due
 * to JPEG compression). Parts whose color matches the background use an
 * empty colors array, falling back to foreground-mask-only extraction.
 *
 * @example
 * ```ts
 * import { PARTS } from './parts.ts'
 * for (const part of PARTS) console.log(part.name, part.fill)
 * ```
 */
import { PALETTE } from './config.ts'
import { ARM_PARTS } from './parts-arms.ts'
import { HAIR_PARTS } from './parts-hair.ts'
import { LOWER_PARTS } from './parts-lower.ts'
import { c, REF_GRAY_DARK, REF_GRAY_WARM, REF_RED } from './parts-types.ts'

import type { PartDef } from './parts-types.ts'

export type { ColorSpec, PartDef } from './parts-types.ts'

//region Head group
/** Face, eyes, and mouth. */
const HEAD_PARTS: readonly PartDef[] = [
  {
    name: 'head_face',
    bbox: [0.3, 0.06, 0.4, 0.12],
    colors: [c(PALETTE.skin, 45), c([246, 231, 210], 35)],
    fill: '#f0ddd0',
    morphClose: 7,
    morphOpen: 3,
  },
  {
    name: 'eyes',
    bbox: [0.32, 0.07, 0.36, 0.04],
    colors: [c(PALETTE.dark, 40), c(PALETTE.red, 50), c(REF_RED, 45)],
    excludeColors: [c(PALETTE.skin, 25)],
    fill: '#2a2a2a',
    morphClose: 3,
    morphOpen: 1,
  },
  {
    name: 'mouth',
    bbox: [0.38, 0.11, 0.24, 0.025],
    colors: [c(PALETTE.red, 40), c(PALETTE.dark, 35), c(REF_RED, 40)],
    excludeColors: [c(PALETTE.skin, 25)],
    fill: '#cc2244',
    morphClose: 2,
    morphOpen: 1,
  },
]
//endregion

//region Torso group
/** Jacket body and shoulder epaulettes. */
const TORSO_PARTS: readonly PartDef[] = [
  {
    name: 'torso_front',
    bbox: [0.2, 0.16, 0.6, 0.2],
    colors: [
      c(PALETTE.midGray, 50), c(PALETTE.lightGray, 45), c(PALETTE.dark, 40),
      c(REF_GRAY_WARM, 40), c(REF_GRAY_DARK, 35),
    ],
    excludeColors: [c(PALETTE.skin, 25)],
    fill: '#9a9a9a',
    morphClose: 7,
    morphOpen: 3,
  },
  {
    // Epaulettes are near-background color, use foreground mask only
    name: 'epaulette_L',
    bbox: [0.14, 0.16, 0.16, 0.05],
    colors: [],
    fill: '#c8c4be',
    morphClose: 3,
    morphOpen: 2,
  },
  {
    name: 'epaulette_R',
    bbox: [0.7, 0.16, 0.16, 0.05],
    colors: [],
    fill: '#c8c4be',
    morphClose: 3,
    morphOpen: 2,
  },
]
//endregion

/** All 26 body part definitions in declaration order. */
export const PARTS: readonly PartDef[] = [
  ...HAIR_PARTS,
  ...HEAD_PARTS,
  ...TORSO_PARTS,
  ...ARM_PARTS,
  ...LOWER_PARTS,
]
