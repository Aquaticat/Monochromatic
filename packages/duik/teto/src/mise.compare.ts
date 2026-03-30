// oxlint-disable no-magic-numbers -- comparison script with many dimensional constants
/**
 * Compares the composite render against the reference character sheet.
 *
 * Crops the front-view character from the reference, trims background,
 * aligns both images by content bounds, and runs perceptual metrics.
 *
 * @example
 * ```sh
 * bun run src/mise.compare.ts
 * ```
 */

import { execSync, } from 'node:child_process';
import { existsSync, } from 'node:fs';
import { join, } from 'node:path';

import { runAiMetrics, } from './compare-ai-metrics.ts';

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
/** Temporary directory for intermediate comparison images. */
const TMP = '/tmp/claude-1000';

/** Always rebuild composite first. */
console.error('--- Rebuilding composite ---',);
execSync(
  `bun run ${join(import.meta.dirname, 'mise.build-composite.ts',)}`,
  {
    stdio: 'inherit',
  },
);

/**
 * Crop region for front-view character from the reference sheet.
 * Tighter crop to exclude text annotations.
 */
const REF_CROP = {
  width: 290,
  height: 880,
  x: 1_440,
  y: 60,
};

/**
 * Common comparison size.
 * Both images are trimmed to content bounds, then resized to fit
 * within this box while preserving aspect ratio, then padded to exact size.
 */
const CMP = {
  width: 400,
  height: 700,
};

/**
 * Runs a shell command and returns stdout trimmed.
 *
 * @param cmd - shell command string
 *
 * @returns trimmed stdout
 */
function run(cmd: string,): string {
  return execSync(
    cmd,
    { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe',], },
  )
    .trim();
}

if (!existsSync(COMPOSITE_SVG,))
  throw new Error(`Composite SVG not found. Run mise.build-composite.ts first.`,);

if (!existsSync(REF_IMAGE,))
  throw new Error(`Reference image not found at ${REF_IMAGE}.`,);

console.error('--- Preparing images ---',);

/**
 * Reference: crop front view, trim away the background,
 * resize to fit comparison box, pad with neutral bg.
 */
run(
  `magick "${REF_IMAGE}" `
    + `-crop ${REF_CROP.width}x${REF_CROP.height}+${REF_CROP.x}+${REF_CROP.y} +repage `
    + `-fuzz 15% -trim +repage `
    + `-resize ${CMP.width}x${CMP.height} `
    + `-background "#f0f0f0" -gravity center -extent ${CMP.width}x${CMP.height} `
    + `"${TMP}/cmp_reference.png"`,
);

/**
 * Composite: render SVG, trim away the background,
 * resize to fit comparison box, pad with neutral bg.
 */
run(
  `magick "${COMPOSITE_SVG}" `
    + `-fuzz 5% -trim +repage `
    + `-resize ${CMP.width}x${CMP.height} `
    + `-background "#f0f0f0" -gravity center -extent ${CMP.width}x${CMP.height} `
    + `"${TMP}/cmp_composite.png"`,
);

console.error('--- Running metrics ---',);

/**
 * Extracts the numeric value in parentheses from ImageMagick compare output.
 * Output format is like "54939.1 (0.838317)".
 *
 * @param raw - raw output string from magick compare
 *
 * @returns parsed normalized value or the raw string if parsing fails
 */
function parseMetric(raw: string,): string {
  const parenMatch = raw.match(/\(([\d.e+-]+)\)/,);
  if (parenMatch !== null && parenMatch[1] !== undefined)
    return parenMatch[1];
  return raw;
}

/** Raw DSSIM output (perceptual; 0 = identical, higher = worse). */
const dssimRaw = run(
  `magick compare -metric DSSIM "${TMP}/cmp_reference.png" "${TMP}/cmp_composite.png" "${TMP}/diff_dssim.png" 2>&1 || true`,
);

/** Raw SSIM output (structural similarity; 1 = identical, lower = worse). */
const ssimRaw = run(
  `magick compare -metric SSIM "${TMP}/cmp_reference.png" "${TMP}/cmp_composite.png" "${TMP}/diff_ssim.png" 2>&1 || true`,
);

/** Raw PHASH output (perceptual hash distance; 0 = identical). */
const phashRaw = run(
  `magick compare -metric PHASH "${TMP}/cmp_reference.png" "${TMP}/cmp_composite.png" null: 2>&1 || true`,
);

/** Raw RMSE output (root mean square error; 0 = identical). */
const rmseRaw = run(
  `magick compare -metric RMSE "${TMP}/cmp_reference.png" "${TMP}/cmp_composite.png" null: 2>&1 || true`,
);

/** Side-by-side: reference | composite | DSSIM diff. */
run(
  `magick "${TMP}/cmp_reference.png" "${TMP}/cmp_composite.png" "${TMP}/diff_dssim.png" +append "${TMP}/compare_sidebyside.png"`,
);

console.error('--- Pixel-level metrics ---',);
console.error(`DSSIM:  ${parseMetric(dssimRaw,)}  (0 = identical, lower is better)`,);
console.error(`SSIM:   ${parseMetric(ssimRaw,)}  (1 = identical, higher is better)`,);
console.error(`PHASH:  ${parseMetric(phashRaw,)}  (0 = identical, lower is better)`,);
console.error(`RMSE:   ${parseMetric(rmseRaw,)}  (0 = identical, lower is better)`,);

await runAiMetrics({
  refPath: `${TMP}/cmp_reference.png`,
  cmpPath: `${TMP}/cmp_composite.png`,
},);

console.error('',);
console.error(`Outputs:`,);
console.error(`  Side-by-side:  ${TMP}/compare_sidebyside.png`,);
console.error(`  DSSIM diff:    ${TMP}/diff_dssim.png`,);
console.error(`  SSIM diff:     ${TMP}/diff_ssim.png`,);
