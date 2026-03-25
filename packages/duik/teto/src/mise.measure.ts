// oxlint-disable no-magic-numbers -- measurement script with many dimensional constants
/**
 * Measures body proportions from the composite SVG and reference image.
 *
 * Renders both to normalized PNGs, converts to binary silhouettes,
 * then scans each row to build a width profile. Extracts key anatomical
 * measurements (head width, shoulder width, waist, hips, etc.) and
 * compares ratios between reference and composite.
 *
 * @example
 * ```sh
 * bun run src/mise.measure.ts
 * ```
 */

import { execSync, } from 'node:child_process';
import { existsSync, } from 'node:fs';
import { join, } from 'node:path';

import { generateWidthProfileOutput, } from './measure-chart.ts';
import {
  printKeyProportions,
  printMeasurementTable,
} from './measure-landmarks-print.ts';
import { computeLandmarkMeasurements, } from './measure-landmarks.ts';
import { prepareSilhouettes, } from './measure-prepare.ts';
import { contentBounds, } from './measure-profile-query.ts';
import { measureWidthProfile, } from './measure-profile.ts';

/** Directory containing individual body part SVG files. */
const PARTS_DIR = join(
  import.meta.dirname,
  '..',
  'parts',
);
/** Path to the assembled composite SVG from the build step. */
const COMPOSITE_SVG = join(
  PARTS_DIR,
  '_composite_inline.svg',
);
/** Path to the reference character sheet image for comparison. */
const REF_IMAGE = '/home/user/Nextcloud/Text/Docs/Algonquin/MTM6403/teto_sv_3views.jpg';
/** Temporary directory for intermediate measurement images. */
const TMP = '/tmp/claude-1000';

/** Crop region for front-view character from the reference sheet. */
const REF_CROP = {
  width: 290,
  height: 880,
  x: 1_440,
  y: 60,
};

/** Height to normalize both images to for consistent measurement. */
const NORM_HEIGHT = 1_000;

/** Always rebuild composite first. */
console.error('--- Rebuilding composite ---',);
execSync(
  `bun run ${join(import.meta.dirname, 'mise.build-composite.ts',)}`,
  {
  stdio: 'inherit',
},
);

if (!existsSync(REF_IMAGE,))
  throw new Error(`Reference image not found at ${REF_IMAGE}`,);

console.error('--- Preparing normalized silhouettes ---',);

/** Paths to generated binary silhouette images for width measurement. */
const {
  refSilhouette,
  cmpSilhouette,
} = prepareSilhouettes({
  refImage: REF_IMAGE,
  compositeSvg: COMPOSITE_SVG,
  refCrop: REF_CROP,
  normHeight: NORM_HEIGHT,
  tmpDir: TMP,
},);

console.error('--- Measuring reference ---',);
/** Per-row width profile of the reference silhouette. */
const refProfile = measureWidthProfile(
  refSilhouette,
  TMP,
);

console.error('--- Measuring composite ---',);
/** Per-row width profile of the composite silhouette. */
const cmpProfile = measureWidthProfile(
  cmpSilhouette,
  TMP,
);

console.error('--- Proportion Analysis ---',);
console.error('',);

/** Content bounds (top/bottom y, total height) of the reference silhouette. */
const refBounds = contentBounds(refProfile,);
/** Content bounds (top/bottom y, total height) of the composite silhouette. */
const cmpBounds = contentBounds(cmpProfile,);

console.error(
  `Image dimensions:  ref=${refProfile.imageWidth}x${refProfile.imageHeight}  cmp=${cmpProfile.imageWidth}x${cmpProfile.imageHeight}`,
);
console.error(
  `Content height:    ref=${refBounds.totalHeight}px  cmp=${cmpBounds.totalHeight}px`,
);
console.error('',);

/** Paired profiles for landmark and proportion analysis. */
const pair = {
  refProfile,
  cmpProfile,
  refBounds,
  cmpBounds,
};

/** Collected measurement rows for the proportion comparison table. */
const measurements = computeLandmarkMeasurements(pair,);
printMeasurementTable(measurements,);
printKeyProportions(pair,);

generateWidthProfileOutput({
  refProfile,
  cmpProfile,
  refBounds,
  cmpBounds,
  tmpDir: TMP,
},);

console.error('',);
console.error('Silhouettes saved to:',);
console.error(`  ${TMP}/measure_ref_silhouette.png`,);
console.error(`  ${TMP}/measure_cmp_silhouette.png`,);
