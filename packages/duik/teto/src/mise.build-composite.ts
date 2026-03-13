// oxlint-disable tsdoc/require-tsdoc -- build script with many inline temporary variables
/**
 * Generates an inline composite SVG from individual body part SVGs.
 *
 * Reads all part SVGs from `../parts/`, extracts their inner content,
 * consolidates `<defs>` blocks, and stacks layers in the correct
 * back-to-front order for Duik rigging preview.
 *
 * @example
 * ```sh
 * bun run src/mise.build-composite.ts
 * ```
 */

import { readFileSync, writeFileSync, readdirSync } from 'node:fs'
import { join, basename } from 'node:path'
import { execSync } from 'node:child_process'

/** Back-to-front layer order for Duik composite. */
const LAYER_ORDER = [
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

const PARTS_DIR = join(import.meta.dirname, '..', 'parts')
const OUTPUT_SVG = join(PARTS_DIR, '_composite_inline.svg')
const OUTPUT_PNG = '/tmp/claude-1000/teto_composite.png'

/**
 * Extracts inner content from an SVG file, separating defs from body content.
 *
 * @param filePath - absolute path to the SVG file
 *
 * @returns object with defs content and body content strings
 */
function extractSvgContent(filePath: string): { defs: string; body: string } {
  const raw = readFileSync(filePath, 'utf8')

  /** Strip the outer `<svg ...>` and `</svg>` wrapper. */
  const innerMatch = raw.match(/<svg[^>]*>([\s\S]*)<\/svg>/i)
  if (innerMatch === null || innerMatch[1] === undefined) {
    return { defs: '', body: '' }
  }

  const [, inner] = innerMatch

  /** Extract all `<defs>...</defs>` blocks. */
  let defs = ''
  let body = inner

  const defsRegex = /<defs>([\s\S]*?)<\/defs>/gi
  let defsMatch = defsRegex.exec(inner)
  while (defsMatch !== null) {
    defs += `${defsMatch[1]}\n`
    defsMatch = defsRegex.exec(inner)
  }

  /** Remove defs blocks from the body. */
  body = body.replace(defsRegex, '')

  return { defs: defs.trim(), body: body.trim() }
}

/** Discover all part SVG files in the parts directory. */
const partFiles = readdirSync(PARTS_DIR)
  .filter(function filterPartSvgs(f) {
    return f.endsWith('.svg') && !f.startsWith('_')
  })

/** Verify all expected parts exist. */
const availableNames = new Set(partFiles.map(function toName(f) {
  return basename(f, '.svg')
}))

const missingParts = LAYER_ORDER.filter(function findMissing(name) {
  return !availableNames.has(name)
})

if (missingParts.length > 0) {
  throw new Error(`Missing part SVG files: ${missingParts.join(', ')}`)
}

/** Extract content from each part. */
const allDefs: string[] = []
const layerGroups: string[] = []

for (const layerName of LAYER_ORDER) {
  const filePath = join(PARTS_DIR, `${layerName}.svg`)
  const { defs, body } = extractSvgContent(filePath)

  if (defs.length > 0) {
    allDefs.push(`    <!-- from ${layerName} -->\n    ${defs}`)
  }

  layerGroups.push(`  <g id="${layerName}">\n    ${body}\n  </g>`)
}

/** Assemble the composite SVG. */
const compositeSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 1200">
  <rect width="800" height="1200" fill="#f0f0f0"/>
  <defs>
${allDefs.join('\n')}
  </defs>
${layerGroups.join('\n')}
</svg>
`

writeFileSync(OUTPUT_SVG, compositeSvg)
console.error(`Wrote composite SVG: ${OUTPUT_SVG}`)

/** Render to PNG via ImageMagick if available. */
try {
  execSync(`magick "${OUTPUT_SVG}" -resize 800x1200 "${OUTPUT_PNG}"`, { stdio: 'pipe' })
  console.error(`Rendered PNG: ${OUTPUT_PNG}`)
} catch {
  console.error('ImageMagick render skipped (magick not available or failed)')
}
