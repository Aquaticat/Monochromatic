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
import {
  existsSync,
  mkdirSync,
  readdirSync,
} from 'node:fs';

import {
  buildPartSvg,
  extractPotraceContent,
} from './assemble-svg.ts';
import {
  PARTS_DIR,
  SCALE,
  TMP_DIR,
  X_OFFSET,
} from './config.ts';
import { PARTS, } from './parts.ts';

/** Assembles traced SVGs into final part files with viewBox transforms. */
async function main(): Promise<void> {
  console.log('Assembling traced SVGs into final part files',);

  const tracedDir = `${TMP_DIR}/traced`;
  if (!existsSync(tracedDir,)) {
    throw new Error(
      `Traced SVG directory not found: ${tracedDir} — run the trace task first`,
    );
  }

  if (!existsSync(PARTS_DIR,))
    mkdirSync(PARTS_DIR, { recursive: true, },);

  const tracedFiles = readdirSync(tracedDir,).filter(function isSvg(f,) {
    return f.endsWith('.svg',);
  },);

  console.log(`  Found ${tracedFiles.length} traced SVGs`,);
  const TRANSLATE_PRECISION = 2;
  const SCALE_PRECISION = 4;
  console.log(
    `  Transform: translate(${X_OFFSET.toFixed(TRANSLATE_PRECISION,)}, 0) scale(${
      SCALE.toFixed(SCALE_PRECISION,)
    })`,
  );

  // Build a lookup from part name to its definition
  const partMap = new Map(PARTS.map(function toEntry(p,) {
    return [p.name, p,] as const;
  },),);

  let assembled = 0;
  for (const file of tracedFiles) {
    const name = file.replace('.svg', '',);
    const part = partMap.get(name,);

    if (part === undefined) {
      console.error(`  WARN: no part definition for ${name}, skipping`,);
      continue;
    }

    // eslint-disable-next-line no-await-in-loop -- sequential file processing; each file must be read and written before the next
    const svgText = await Bun.file(`${tracedDir}/${file}`,).text();
    const { groupTransform, paths, } = extractPotraceContent(svgText,);

    if (paths.length === 0) {
      console.error(`  WARN: no paths found in ${file}, skipping`,);
      continue;
    }

    const finalSvg = buildPartSvg({
      groupTransform,
      paths,
      fill: part.fill,
      name,
    },);

    const outPath = `${PARTS_DIR}/${name}.svg`;
    // eslint-disable-next-line no-await-in-loop -- sequential file writes to avoid interleaved output
    await Bun.write(outPath, finalSvg,);
    console.log(`  ${name}: ${paths.length} path(s)`,);
    assembled++;
  }

  console.log(`Assembled ${assembled} parts into ${PARTS_DIR}/`,);
}

await main();

export {};
