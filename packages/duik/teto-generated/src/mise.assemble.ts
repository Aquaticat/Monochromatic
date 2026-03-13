/**
 * Transform raw potrace SVG output into positioned, colored part files.
 *
 * Reads traced SVGs from tmp/traced/, extracts path data, wraps each in a
 * uniform coordinate transform (mapping crop-pixel-space to the 800x1200 viewBox),
 * applies the part's fill color, and saves to parts/.
 *
 * Input: tmp/traced/*.svg (from trace step)
 * Output: parts/*.svg (final positioned SVG files)
 *
 * @example
 * ```sh
 * mise run //packages/duik/teto-generated:assemble
 * ```
 */
import { existsSync, mkdirSync, readdirSync } from 'node:fs'

import { PARTS_DIR, SCALE, TMP_DIR, VIEWBOX, X_OFFSET } from './config.ts'
import { PARTS } from './parts.ts'

/**
 * Extract all `<path>` elements from a potrace SVG string.
 *
 * Potrace outputs SVG with a transform on the root `<g>` element
 * that flips the y-axis. This function preserves that transform
 * by extracting the full `<g>` content.
 *
 * @param svg - Raw potrace SVG string
 * @returns Object with extracted group transform and path data strings
 */
function extractPotraceContent(svg: string): {
  readonly groupTransform: string
  readonly paths: readonly string[]
} {
  // Potrace wraps paths in: <g transform="..." fill="..." stroke="...">
  // The transform attribute may be followed by other attributes before the closing >
  const groupMatch = svg.match(/<g\s+transform="([^"]+)"/)
  const groupTransform = groupMatch !== null && groupMatch[1] !== undefined ? groupMatch[1] : ''

  // Extract all path d attributes
  const pathRegex = /<path\s+d="([^"]+)"/g
  const paths: string[] = []
  let match = pathRegex.exec(svg)
  while (match !== null) {
    if (match[1] !== undefined) {
      paths.push(match[1])
    }
    match = pathRegex.exec(svg)
  }

  return { groupTransform, paths }
}

/**
 * Build a final part SVG with the viewBox transform applied.
 *
 * @param groupTransform - Potrace's y-flip transform
 * @param paths - SVG path d-attribute strings
 * @param fill - Fill color hex string
 * @param name - Part name for the comment
 * @returns Complete SVG document string
 */
function buildPartSvg({
  groupTransform,
  paths,
  fill,
  name,
}: {
  readonly groupTransform: string
  readonly paths: readonly string[]
  readonly fill: string
  readonly name: string
}): string {
  const pathElements = paths
    .map(function wrapPath(d) {
      return `      <path d="${d}" fill="${fill}"/>`
    })
    .join('\n')

  // The outer transform maps from crop-pixel-space to the 800x1200 viewBox:
  //   1. Apply potrace's y-flip (from its groupTransform)
  //   2. Scale uniformly by SCALE factor
  //   3. Translate to center horizontally
  //
  // Combined: translate(X_OFFSET, 0) scale(SCALE) [potrace transform]
  const outerTransform = `translate(${X_OFFSET.toFixed(2)}, 0) scale(${SCALE.toFixed(4)})`

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VIEWBOX.width} ${VIEWBOX.height}">`,
    `  <!-- ${name} - auto-generated from reference image -->`,
    `  <g transform="${outerTransform}">`,
    `    <g transform="${groupTransform}">`,
    pathElements,
    '    </g>',
    '  </g>',
    '</svg>',
    '',
  ].join('\n')
}

async function main(): Promise<void> {
  console.log('Assembling traced SVGs into final part files')

  const tracedDir = `${TMP_DIR}/traced`
  if (!existsSync(tracedDir)) {
    throw new Error(`Traced SVG directory not found: ${tracedDir} — run the trace task first`)
  }

  if (!existsSync(PARTS_DIR)) {
    mkdirSync(PARTS_DIR, { recursive: true })
  }

  const tracedFiles = readdirSync(tracedDir).filter(function isSvg(f) {
    return f.endsWith('.svg')
  })

  console.log(`  Found ${tracedFiles.length} traced SVGs`)
  console.log(`  Transform: translate(${X_OFFSET.toFixed(2)}, 0) scale(${SCALE.toFixed(4)})`)

  // Build a lookup from part name to its definition
  const partMap = new Map(PARTS.map(function toEntry(p) {
    return [p.name, p] as const
  }))

  let assembled = 0
  for (const file of tracedFiles) {
    const name = file.replace('.svg', '')
    const part = partMap.get(name)

    if (part === undefined) {
      console.error(`  WARN: no part definition for ${name}, skipping`)
      continue
    }

    const svgText = await Bun.file(`${tracedDir}/${file}`).text()
    const { groupTransform, paths } = extractPotraceContent(svgText)

    if (paths.length === 0) {
      console.error(`  WARN: no paths found in ${file}, skipping`)
      continue
    }

    const finalSvg = buildPartSvg({
      groupTransform,
      paths,
      fill: part.fill,
      name,
    })

    const outPath = `${PARTS_DIR}/${name}.svg`
    await Bun.write(outPath, finalSvg)
    console.log(`  ${name}: ${paths.length} path(s)`)
    assembled++
  }

  console.log(`Assembled ${assembled} parts into ${PARTS_DIR}/`)
}

await main()

export {}
