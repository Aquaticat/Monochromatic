/**
 * Arm and lower body part definitions for reference image segmentation.
 *
 * Separated from the main parts module for file size management.
 * Colors sampled from the actual reference JPEG.
 *
 * @module
 */

import { PALETTE } from './config.ts'

import type { ColorSpec, PartDef } from './parts.ts'

/**
 * Shorthand to avoid repeating palette lookups.
 *
 * @internal
 *
 * @param rgb - RGB values 0-255
 *
 * @param tolerance - Euclidean distance threshold
 *
 * @returns color spec
 */
function c(rgb: readonly [number, number, number], tolerance: number): ColorSpec {
  return { rgb, tolerance }
}

/**
 * Warm gray sampled from the reference JPEG.
 * The reference has a warm-purple tint absent from the design palette.
 */
const REF_GRAY_WARM = [188, 182, 186] as const

/** Dark gray sampled from the reference JPEG. */
const REF_GRAY_DARK = [144, 135, 140] as const

/** Red sampled from the reference JPEG. */
const REF_RED = [190, 72, 88] as const

//region Arm group
/** Upper arms, forearms, and hands. */
export const ARM_PARTS: readonly PartDef[] = [
  {
    name: 'upper_arm_L',
    bbox: [0.05, 0.18, 0.2, 0.15],
    colors: [c(PALETTE.midGray, 50), c(REF_GRAY_WARM, 40), c(REF_GRAY_DARK, 35)],
    fill: '#9a9a9a',
    morphClose: 5,
    morphOpen: 3,
  },
  {
    name: 'upper_arm_R',
    bbox: [0.75, 0.18, 0.2, 0.15],
    colors: [c(PALETTE.midGray, 50), c(REF_GRAY_WARM, 40), c(REF_GRAY_DARK, 35)],
    fill: '#9a9a9a',
    morphClose: 5,
    morphOpen: 3,
  },
  {
    name: 'forearm_L',
    bbox: [0.02, 0.3, 0.2, 0.14],
    colors: [c(PALETTE.midGray, 50), c(PALETTE.dark, 40), c(REF_GRAY_WARM, 40)],
    fill: '#9a9a9a',
    morphClose: 5,
    morphOpen: 3,
  },
  {
    name: 'forearm_R',
    bbox: [0.78, 0.3, 0.2, 0.14],
    colors: [c(PALETTE.midGray, 50), c(PALETTE.dark, 40), c(REF_GRAY_WARM, 40)],
    fill: '#9a9a9a',
    morphClose: 5,
    morphOpen: 3,
  },
  {
    name: 'hand_L',
    bbox: [0, 0.42, 0.18, 0.08],
    colors: [c(PALETTE.skin, 45), c([246, 231, 210], 35)],
    fill: '#f0ddd0',
    morphClose: 3,
    morphOpen: 2,
  },
  {
    name: 'hand_R',
    bbox: [0.82, 0.42, 0.18, 0.08],
    colors: [c(PALETTE.skin, 45), c([246, 231, 210], 35)],
    fill: '#f0ddd0',
    morphClose: 3,
    morphOpen: 2,
  },
]
//endregion

//region Lower body group
/** Skirts, legs, and boots. */
export const LOWER_PARTS: readonly PartDef[] = [
  {
    // The visible underskirt is mostly dark petticoat with red trim.
    // The red is barely visible at the hem in front view.
    name: 'skirt_back',
    bbox: [0.14, 0.38, 0.72, 0.14],
    colors: [c(PALETTE.dark, 40), c(PALETTE.red, 55), c(REF_RED, 45)],
    fill: '#cc2244',
    morphClose: 5,
    morphOpen: 3,
  },
  {
    name: 'skirt_front',
    bbox: [0.1, 0.32, 0.8, 0.2],
    colors: [
      c(PALETTE.midGray, 50), c(PALETTE.lightGray, 45), c(PALETTE.dark, 40),
      c(REF_GRAY_WARM, 40), c(REF_GRAY_DARK, 35),
    ],
    fill: '#9a9a9a',
    morphClose: 7,
    morphOpen: 3,
  },
  {
    // Skin visible between skirt hem (y≈0.66) and boot top (y≈0.89).
    // Actual colors: (244,229,208) highlight, (232,196,174) mid, (178,136,120) shadow.
    name: 'upper_leg_L',
    bbox: [0.34, 0.66, 0.16, 0.12],
    colors: [
      c(PALETTE.skin, 50), c([244, 229, 208], 35),
      c([210, 170, 150], 45), c([180, 140, 120], 35),
    ],
    fill: '#f0ddd0',
    morphClose: 5,
    morphOpen: 3,
  },
  {
    name: 'upper_leg_R',
    bbox: [0.44, 0.66, 0.16, 0.12],
    colors: [
      c(PALETTE.skin, 50), c([244, 229, 208], 35),
      c([210, 170, 150], 45), c([180, 140, 120], 35),
    ],
    fill: '#f0ddd0',
    morphClose: 5,
    morphOpen: 3,
  },
  {
    name: 'lower_leg_L',
    bbox: [0.34, 0.76, 0.16, 0.14],
    colors: [
      c(PALETTE.skin, 50), c([244, 229, 208], 35),
      c([210, 170, 150], 45), c([180, 140, 120], 35),
    ],
    fill: '#f0ddd0',
    morphClose: 5,
    morphOpen: 3,
  },
  {
    name: 'lower_leg_R',
    bbox: [0.44, 0.76, 0.16, 0.14],
    colors: [
      c(PALETTE.skin, 50), c([244, 229, 208], 35),
      c([210, 170, 150], 45), c([180, 140, 120], 35),
    ],
    fill: '#f0ddd0',
    morphClose: 5,
    morphOpen: 3,
  },
  {
    // Boots start at y≈0.89, below the visible skin
    name: 'boot_L',
    bbox: [0.3, 0.87, 0.2, 0.12],
    colors: [c(PALETTE.dark, 45), c(PALETTE.red, 50), c(REF_RED, 45)],
    fill: '#2a2a2a',
    morphClose: 5,
    morphOpen: 3,
  },
  {
    name: 'boot_R',
    bbox: [0.42, 0.87, 0.2, 0.12],
    colors: [c(PALETTE.dark, 45), c(PALETTE.red, 50), c(REF_RED, 45)],
    fill: '#2a2a2a',
    morphClose: 5,
    morphOpen: 3,
  },
]
//endregion
