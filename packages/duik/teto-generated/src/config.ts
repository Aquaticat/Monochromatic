/**
 * Shared pipeline configuration: reference image, viewBox, palette, and coordinate transforms.
 *
 * @example
 * ```ts
 * import { REFERENCE_PATH, VIEWBOX, PALETTE, cropToViewBox } from './config.ts'
 * ```
 */

/** Absolute path to the 3-view reference sheet (1920x1080 JPEG). */
export const REFERENCE_PATH =
  '/home/user/Nextcloud/Text/Docs/Algonquin/MTM6403/teto_sv_3views.jpg'

/** Pixel region of the front view within the reference sheet. */
export const FRONT_VIEW_CROP = {
  x: 1_440,
  y: 60,
  width: 290,
  height: 880,
} as const

/** Target SVG viewBox for all part files. */
export const VIEWBOX = { width: 800, height: 1_200 } as const

/**
 * Approximate background color of the reference sheet.
 * Used by the segmenter to separate foreground from background.
 */
export const BACKGROUND = {
  color: [232, 229, 224] as const,
  tolerance: 30,
} as const

/** RGB color palette sampled from the official character design. */
export const PALETTE = {
  red: [204, 34, 68] as const,
  darkRed: [160, 26, 53] as const,
  skin: [240, 221, 208] as const,
  midGray: [154, 154, 154] as const,
  lightGray: [200, 196, 190] as const,
  dark: [42, 42, 42] as const,
  white: [240, 237, 232] as const,
} as const

/**
 * Uniform scale factor mapping the cropped front view to the 800x1200 viewBox.
 * Based on height: 1200 / 880 = 1.3636...
 */
export const SCALE = VIEWBOX.height / FRONT_VIEW_CROP.height

/**
 * Horizontal offset to center the scaled crop within the 800px-wide viewBox.
 * (800 - 290 * scale) / 2
 */
export const X_OFFSET =
  (VIEWBOX.width - FRONT_VIEW_CROP.width * SCALE) / 2

/** Working directory for intermediate pipeline artifacts. */
export const TMP_DIR = 'tmp'

/** Directory for final SVG part output. */
export const PARTS_DIR = 'parts'

/** Layer order from back to front, matching the hand-crafted teto package. */
export const LAYER_ORDER = [
  'hair_back',
  'torso_front',
  'skirt_back',
  'upper_arm_L',
  'forearm_L',
  'hand_L',
  'upper_arm_R',
  'forearm_R',
  'hand_R',
  'upper_leg_L',
  'lower_leg_L',
  'boot_L',
  'upper_leg_R',
  'lower_leg_R',
  'boot_R',
  'skirt_front',
  'epaulette_L',
  'epaulette_R',
  'head_face',
  'hair_bangs',
  'hair_drill_L',
  'hair_drill_R',
  'hair_accessory_L',
  'hair_accessory_R',
  'eyes',
  'mouth',
] as const

/** Joint positions within the 800x1200 viewBox for Duik pin placement. */
export const JOINTS: Record<string, readonly [number, number]> = {
  neck: [400, 225],
  shoulder_L: [310, 245],
  shoulder_R: [490, 245],
  elbow_L: [275, 350],
  elbow_R: [525, 350],
  wrist_L: [250, 445],
  wrist_R: [550, 445],
  hip: [400, 440],
  knee_L: [348, 700],
  knee_R: [436, 700],
  ankle_L: [340, 900],
  ankle_R: [444, 900],
}


