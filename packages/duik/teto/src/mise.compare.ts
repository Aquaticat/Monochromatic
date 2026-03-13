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

import { execSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

const PARTS_DIR = join(import.meta.dirname, '..', 'parts')
const COMPOSITE_SVG = join(PARTS_DIR, '_composite_inline.svg')
const REF_IMAGE = '/home/user/Nextcloud/Text/Docs/Algonquin/MTM6403/teto_sv_3views.jpg'
const TMP = '/tmp/claude-1000'

/** Always rebuild composite first. */
console.error('--- Rebuilding composite ---')
execSync(`bun run ${join(import.meta.dirname, 'mise.build-composite.ts')}`, { stdio: 'inherit' })

/**
 * Crop region for front-view character from the reference sheet.
 * Tighter crop to exclude text annotations.
 */
const REF_CROP = { width: 290, height: 880, x: 1440, y: 60 }

/**
 * Common comparison size.
 * Both images are trimmed to content bounds, then resized to fit
 * within this box while preserving aspect ratio, then padded to exact size.
 */
const CMP = { width: 400, height: 700 }

/**
 * Runs a shell command and returns stdout trimmed.
 *
 * @param cmd - shell command string
 * @returns trimmed stdout
 */
function run(cmd: string): string {
  return execSync(cmd, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }).trim()
}

if (!existsSync(COMPOSITE_SVG)) {
  throw new Error(`Composite SVG not found. Run mise.build-composite.ts first.`)
}

if (!existsSync(REF_IMAGE)) {
  throw new Error(`Reference image not found at ${REF_IMAGE}.`)
}

console.error('--- Preparing images ---')

/**
 * Reference: crop front view, trim away the background,
 * resize to fit comparison box, pad with neutral bg.
 */
run(
  `magick "${REF_IMAGE}" ` +
  `-crop ${REF_CROP.width}x${REF_CROP.height}+${REF_CROP.x}+${REF_CROP.y} +repage ` +
  `-fuzz 15% -trim +repage ` +
  `-resize ${CMP.width}x${CMP.height} ` +
  `-background "#f0f0f0" -gravity center -extent ${CMP.width}x${CMP.height} ` +
  `"${TMP}/cmp_reference.png"`,
)

/**
 * Composite: render SVG, trim away the background,
 * resize to fit comparison box, pad with neutral bg.
 */
run(
  `magick "${COMPOSITE_SVG}" ` +
  `-fuzz 5% -trim +repage ` +
  `-resize ${CMP.width}x${CMP.height} ` +
  `-background "#f0f0f0" -gravity center -extent ${CMP.width}x${CMP.height} ` +
  `"${TMP}/cmp_composite.png"`,
)

console.error('--- Running metrics ---')

/**
 * Extracts the numeric value in parentheses from ImageMagick compare output.
 * Output format is like "54939.1 (0.838317)".
 *
 * @param raw - raw output string from magick compare
 * @returns parsed normalized value or the raw string if parsing fails
 */
function parseMetric(raw: string): string {
  const parenMatch = raw.match(/\(([\d.e+-]+)\)/)
  if (parenMatch !== null && parenMatch[1] !== undefined) {
    return parenMatch[1]
  }
  return raw
}

/** DSSIM (perceptual; 0 = identical, higher = worse). */
const dssimRaw = run(
  `magick compare -metric DSSIM "${TMP}/cmp_reference.png" "${TMP}/cmp_composite.png" "${TMP}/diff_dssim.png" 2>&1 || true`,
)

/** SSIM (structural similarity; 1 = identical, lower = worse). */
const ssimRaw = run(
  `magick compare -metric SSIM "${TMP}/cmp_reference.png" "${TMP}/cmp_composite.png" "${TMP}/diff_ssim.png" 2>&1 || true`,
)

/** PHASH (perceptual hash distance; 0 = identical). */
const phashRaw = run(
  `magick compare -metric PHASH "${TMP}/cmp_reference.png" "${TMP}/cmp_composite.png" null: 2>&1 || true`,
)

/** RMSE (root mean square error; 0 = identical). */
const rmseRaw = run(
  `magick compare -metric RMSE "${TMP}/cmp_reference.png" "${TMP}/cmp_composite.png" null: 2>&1 || true`,
)

/** Side-by-side: reference | composite | DSSIM diff. */
run(
  `magick "${TMP}/cmp_reference.png" "${TMP}/cmp_composite.png" "${TMP}/diff_dssim.png" +append "${TMP}/compare_sidebyside.png"`,
)

console.error('--- Pixel-level metrics ---')
console.error(`DSSIM:  ${parseMetric(dssimRaw)}  (0 = identical, lower is better)`)
console.error(`SSIM:   ${parseMetric(ssimRaw)}  (1 = identical, higher is better)`)
console.error(`PHASH:  ${parseMetric(phashRaw)}  (0 = identical, lower is better)`)
console.error(`RMSE:   ${parseMetric(rmseRaw)}  (0 = identical, lower is better)`)

/** AI embedding-based perceptual comparison via multimodal models. */
console.error('')
console.error('--- AI perceptual metrics ---')

try {
  const { compare: aiCompare } = await import('@monochromatic-dev/module-image-diff')

  const refInput = { path: `${TMP}/cmp_reference.png` }
  const cmpInput = { path: `${TMP}/cmp_composite.png` }

  /**
   * Providers to try, with their env var keys.
   * Only attempt providers whose API key is present.
   */
  const providers = [
    { name: 'voyage', envKey: 'IMAGE_DIFF_VOYAGE_API_KEY' },
    { name: 'gemini', envKey: 'IMAGE_DIFF_GEMINI_API_KEY' },
  ] as const

  let anyRan = false

  for (const { name, envKey } of providers) {
    if (process.env[envKey] === undefined && process.env[envKey] !== '') {
      console.error(`${name}:  skipped (${envKey} not set)`)
      continue
    }

    try {
      const result = await aiCompare(refInput, cmpInput, { provider: name })
      console.error(`${name}:  similarity=${result.similarity.toFixed(4)}  distance=${result.distance.toFixed(4)}  (1.0 = identical)`)
      anyRan = true
    } catch (providerError) {
      console.error(`${name}:  failed - ${providerError instanceof Error ? providerError.message : String(providerError)}`)
    }
  }

  if (!anyRan) {
    console.error('Set IMAGE_DIFF_VOYAGE_API_KEY or IMAGE_DIFF_GEMINI_API_KEY to enable AI comparison.')
  }
} catch (importError) {
  console.error(`AI comparison unavailable: ${importError instanceof Error ? importError.message : String(importError)}`)
}

console.error('')
console.error(`Outputs:`)
console.error(`  Side-by-side:  ${TMP}/compare_sidebyside.png`)
console.error(`  DSSIM diff:    ${TMP}/diff_dssim.png`)
console.error(`  SSIM diff:     ${TMP}/diff_ssim.png`)
