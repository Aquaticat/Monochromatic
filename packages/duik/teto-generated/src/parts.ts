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

/** RGB color with matching tolerance for segmentation. */
export type ColorSpec = {
  /** RGB values 0-255. */
  readonly rgb: readonly [number, number, number]
  /** Euclidean distance threshold in RGB space. */
  readonly tolerance: number
}

/** Definition of a single body part for extraction. */
export type PartDef = {
  /** Identifier matching the hand-crafted teto naming convention. */
  readonly name: string
  /** Bounding box as fraction of crop dimensions: [x, y, width, height]. */
  readonly bbox: readonly [number, number, number, number]
  /**
   * Colors to include in the mask (OR-combined).
   * Empty array means "use all foreground pixels in bbox" (for parts
   * whose color is indistinguishable from the background).
   */
  readonly colors: readonly ColorSpec[]
  /** Colors to reject even if they match an include color. */
  readonly excludeColors?: readonly ColorSpec[]
  /** SVG fill color for the generated path. */
  readonly fill: string
  /** Morphological close kernel size; fills small holes. Default 5. */
  readonly morphClose?: number
  /** Morphological open kernel size; removes small noise. Default 3. */
  readonly morphOpen?: number
}

/** @internal Shorthand to avoid repeating palette lookups. */
function c(rgb: readonly [number, number, number], tolerance: number): ColorSpec {
  return { rgb, tolerance }
}

/**
 * Actual grays sampled from the reference JPEG.
 * The reference has a warm-purple tint absent from the design palette.
 */
const REF_GRAY_WARM = [188, 182, 186] as const
const REF_GRAY_DARK = [144, 135, 140] as const
const REF_RED = [190, 72, 88] as const

//region Hair group
/** All six hair parts: back, bangs, drills, accessories. */
const HAIR_PARTS: readonly PartDef[] = [
  {
    name: 'hair_back',
    bbox: [0.08, 0, 0.84, 0.23],
    colors: [c(PALETTE.red, 55), c(PALETTE.darkRed, 50), c(REF_RED, 45)],
    fill: '#cc2244',
    morphClose: 7,
    morphOpen: 3,
  },
  {
    name: 'hair_bangs',
    bbox: [0.22, 0, 0.56, 0.12],
    colors: [c(PALETTE.red, 55), c(PALETTE.darkRed, 50), c(REF_RED, 45)],
    fill: '#cc2244',
    morphClose: 5,
    morphOpen: 2,
  },
  {
    name: 'hair_drill_L',
    bbox: [0, 0.04, 0.35, 0.26],
    colors: [c(PALETTE.red, 55), c(PALETTE.darkRed, 50), c(REF_RED, 45)],
    fill: '#cc2244',
    morphClose: 5,
    morphOpen: 3,
  },
  {
    name: 'hair_drill_R',
    bbox: [0.65, 0.04, 0.35, 0.26],
    colors: [c(PALETTE.red, 55), c(PALETTE.darkRed, 50), c(REF_RED, 45)],
    fill: '#cc2244',
    morphClose: 5,
    morphOpen: 3,
  },
  {
    // White horn/ribbon accents - same color as background, use foreground only
    name: 'hair_accessory_L',
    bbox: [0.18, 0, 0.2, 0.1],
    colors: [],
    fill: '#f0ede8',
    morphClose: 3,
    morphOpen: 2,
  },
  {
    name: 'hair_accessory_R',
    bbox: [0.62, 0, 0.2, 0.1],
    colors: [],
    fill: '#f0ede8',
    morphClose: 3,
    morphOpen: 2,
  },
]
//endregion

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

//region Arm group
/** Upper arms, forearms, and hands. */
const ARM_PARTS: readonly PartDef[] = [
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
const LOWER_PARTS: readonly PartDef[] = [
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

/** All 26 body part definitions in declaration order. */
export const PARTS: readonly PartDef[] = [
  ...HAIR_PARTS,
  ...HEAD_PARTS,
  ...TORSO_PARTS,
  ...ARM_PARTS,
  ...LOWER_PARTS,
]


