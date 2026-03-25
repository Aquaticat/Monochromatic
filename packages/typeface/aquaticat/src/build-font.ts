// oxlint-disable typescript/no-unsafe-member-access, typescript/no-unsafe-call, typescript/no-unsafe-assignment, typescript/no-unsafe-argument, typescript/no-unsafe-type-assertion, typescript/no-unsafe-return -- opentype.js is a JS library with no TypeScript declarations; all API calls are inherently untyped
/**
 * Build script that reads the master glyph strip SVG, extracts individual
 * letter shapes, and assembles them into an OpenType font file using opentype.js.
 *
 * Run: `bun src/build-font.ts`
 */

import {
  mkdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import {
  dirname,
  resolve,
} from 'node:path';

// oxlint-disable-next-line import/no-namespace -- opentype.js requires namespace import for its constructor API
import * as opentype from 'opentype.js';

import {
  ASCENDER,
  CELL_UNICODE,
  DESCENDER,
  SIDE_BEARING,
  SPACE_ADVANCE,
  UNITS_PER_EM,
} from './build-font-metrics.ts';
import { addStrokedPath, } from './build-font-paths-stroked.ts';
import {
  addFilledPath,
  computeLocalXBounds,
} from './build-font-paths.ts';
import { convertToWoff2, } from './build-font-woff2.ts';
import {
  parseSvg,
  parseSvgPathD,
} from './parse-svg.ts';

//region Main build

/** Directory containing this build script. */
const scriptDir = dirname(new URL(import.meta.url,).pathname,);

/** Absolute path to the master glyph strip SVG. */
const svgPath = resolve(
  scriptDir,
  'glyphs.svg',
);

/** Output directory for generated font files. */
const distDir = resolve(
  scriptDir,
  '..',
  'dist',
);

console.log(
  'Reading glyph SVG:',
  svgPath,
);
/** Raw SVG file content. */
const svgContent = readFileSync(
  svgPath,
  'utf8',
);
/** Parsed glyph cells from the SVG strip. */
const cells = parseSvg(svgContent,);
console.log(`Parsed ${cells.length} glyph cells`,);

/** Required .notdef glyph (empty placeholder for missing characters). */
const notdefGlyph = new opentype.Glyph({
  name: '.notdef',
  unicode: 0,
  advanceWidth: SPACE_ADVANCE,
  path: new opentype.Path(),
},);

/** Space character glyph (no visible path, just advance width). */
const spaceGlyph = new opentype.Glyph({
  name: 'space',
  unicode: 32,
  advanceWidth: SPACE_ADVANCE,
  path: new opentype.Path(),
},);

/** Assembled letter glyphs from the parsed SVG cells. */
const letterGlyphs = cells.flatMap(
  function buildGlyph(
    cell,
    cellIndex,
  ): opentype.Glyph[] {
    const unicode = CELL_UNICODE[cellIndex];
    if (unicode === undefined)
      return [];

    const letterName = String.fromCodePoint(unicode,);
    const {
      minX,
      maxX,
    } = computeLocalXBounds(
      cell.paths,
      cell.xOffset,
    );
    const xShift = SIDE_BEARING - minX;
    const advanceWidth = maxX - minX + 2 * SIDE_BEARING;

    const path = new opentype.Path();
    cell.paths.forEach(function addCellPath(cellPath,) {
      const commands = parseSvgPathD(cellPath.d,);
      if (cellPath.isStroked)
        addStrokedPath(
          path,
          commands,
          cellPath.strokeWidth,
          cell.xOffset,
          xShift,
        );
      else
        addFilledPath(
          path,
          commands,
          cell.xOffset,
          xShift,
        );
    },);

    console.log(
      `  ${letterName}: advance=${Math.round(advanceWidth,)}, paths=${cell.paths.length}`,
    );

    return [new opentype.Glyph({
      name: letterName,
      unicode,
      advanceWidth,
      path,
    },),];
  },
);

/** Assembled OpenType font with all glyphs. */
const font = new opentype.Font({
  familyName: 'Aquaticat',
  styleName: 'Regular',
  unitsPerEm: UNITS_PER_EM,
  ascender: ASCENDER,
  descender: DESCENDER,
  glyphs: [
    notdefGlyph,
    spaceGlyph,
    ...letterGlyphs,
  ],
},);

mkdirSync(
  distDir,
  { recursive: true, },
);

/** Output path for the OTF font file. */
const otfPath = resolve(
  distDir,
  'Aquaticat-Regular.otf',
);
/** Raw OTF binary data. */
const buffer = font.toArrayBuffer();
writeFileSync(
  otfPath,
  Buffer.from(buffer,),
);
console.log(`Wrote ${otfPath} (${buffer.byteLength} bytes)`,);

await convertToWoff2(
  otfPath,
  distDir,
);

//endregion Main build
