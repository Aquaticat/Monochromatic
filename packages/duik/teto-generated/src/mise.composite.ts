/**
 * Stack all part SVGs into a single composite preview.
 *
 * Reads each part SVG from parts/, extracts the inner content (everything
 * between the root `<svg>` tags), and stacks them in the canonical layer
 * order from back to front.
 *
 * Output: parts/_composite_inline.svg
 *
 * @example
 * ```sh
 * mise run //packages/duik/teto-generated:composite
 * ```
 */
import { existsSync, } from 'node:fs';

import {
  JOINTS,
  LAYER_ORDER,
  PARTS_DIR,
  VIEWBOX,
} from './config.ts';

/**
 * Extract the inner content of an SVG file (everything between root `<svg>` tags).
 *
 * @param svgText - Full SVG document string
 * @returns Inner content string, or null if parsing fails
 */
function extractInnerSvg(svgText: string,): string | null {
  const openEnd = svgText.indexOf('>',);
  const closeStart = svgText.lastIndexOf('</svg>',);
  if (openEnd === -1 || closeStart === -1)
    return null;
  return svgText.slice(openEnd + 1, closeStart,).trim();
}

/** Builds a composite SVG by inlining all individual part SVGs. */
async function main(): Promise<void> {
  console.log('Building composite SVG',);

  const layers: string[] = [];
  let included = 0;

  for (const name of LAYER_ORDER) {
    const path = `${PARTS_DIR}/${name}.svg`;
    if (!existsSync(path,)) {
      console.error(`  WARN: missing part ${name}, skipping`,);
      continue;
    }

    const svgText = await Bun.file(path,).text();
    const inner = extractInnerSvg(svgText,);
    if (inner === null) {
      console.error(`  WARN: could not parse ${name}.svg, skipping`,);
      continue;
    }

    layers.push(`  <!-- layer: ${name} -->`,);
    layers.push(`  ${inner}`,);
    included++;
  }

  // Add joint markers for preview
  const jointMarkers = Object.entries(JOINTS,).map(function buildMarker([name, pos,],) {
    return `  <circle cx="${pos[0]}" cy="${
      pos[1]
    }" r="6" fill="lime" opacity="0.7"><title>${name}</title></circle>`;
  },);

  const composite = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VIEWBOX.width} ${VIEWBOX.height}">`,
    '  <!-- Auto-generated composite: all layers back-to-front -->',
    ...layers,
    '',
    '  <!-- Joint markers -->',
    ...jointMarkers,
    '</svg>',
    '',
  ]
    .join('\n',);

  const outPath = `${PARTS_DIR}/_composite_inline.svg`;
  await Bun.write(outPath, composite,);
  console.log(`Composite: ${included}/${LAYER_ORDER.length} layers → ${outPath}`,);

  // Also render to PNG for quick comparison
  const pngPath = `${PARTS_DIR}/_composite.png`;
  const proc = Bun.spawn([
    'magick',
    '-background',
    'white',
    '-density',
    '144',
    outPath,
    '-flatten',
    pngPath,
  ], { stdout: 'inherit', stderr: 'inherit', },);
  const code = await proc.exited;
  if (code === 0)
    console.log(`  PNG preview: ${pngPath}`,);
  else
    console.error('  WARN: PNG render failed (non-critical)',);
}

await main();

export {};
