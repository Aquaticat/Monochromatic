/**
 * Build script that reads the master glyph strip SVG, extracts individual
 * letter shapes, and assembles them into an OpenType font file using opentype.js.
 *
 * Run: `bun src/build-font.ts`
 */

import { mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

import spawn from 'nano-spawn';

// eslint-disable-next-line import/no-namespace -- opentype.js requires namespace import for its constructor API
import * as opentype from "opentype.js";

import { offsetPolygon } from "./expand-stroke.ts";
import { parseSvg, parseSvgPathD } from "./parse-svg.ts";

import type { CellPath, SVGPathCommand } from "./parse-svg.ts";

//region Font metrics and glyph mapping

/** SVG Y coordinate that corresponds to the font baseline (y = 0 in font coords). */
const BASELINE_Y = 750;

const UNITS_PER_EM = 1000;
const ASCENDER = 750;
const DESCENDER = -250;

/** Horizontal padding added on each side of a glyph for proportional spacing. */
const SIDE_BEARING = 40;

/** Advance width for the space character (roughly half a typical glyph width). */
const SPACE_ADVANCE = 300;

/** Maps cell index in the strip to Unicode code point. Cells 0-16 = A-Q, 17-19 = X-Z. */
const CELL_UNICODE: Record<number, number> = {
  0: 65, 1: 66, 2: 67, 3: 68, 4: 69, 5: 70, 6: 71, 7: 72, 8: 73, 9: 74,
  10: 75, 11: 76, 12: 77, 13: 78, 14: 79, 15: 80, 16: 81,
  17: 88, 18: 89, 19: 90,
};

//endregion Font metrics and glyph mapping

//region Coordinate helpers

/** Convert SVG Y to font Y (flip around baseline). */
function fontY(svgY: number): number {
  return BASELINE_Y - svgY;
}

/** Resolve absolute X positions from SVG path commands (expanding H/V to full coords). */
function resolveAbsolutePoints(commands: readonly SVGPathCommand[]): Array<[number, number]> {
  const points: Array<[number, number]> = [];
  // Mutable cursor tracking the current pen position while replaying path commands
  // -- let needed because M/L/H/V each update different axes of the cursor
  let cx = 0;
  let cy = 0;
  commands.forEach((cmd) => {
    if (cmd.type === "M" || cmd.type === "L") { cx = cmd.x; cy = cmd.y; points.push([cx, cy]); }
    else if (cmd.type === "H") { cx = cmd.x; points.push([cx, cy]); }
    else if (cmd.type === "V") { cy = cmd.y; points.push([cx, cy]); }
  });
  return points;
}

//endregion Coordinate helpers

//region Path construction

/**
 * Compute the X bounding box of all paths in a cell, in local cell coordinates.
 * For stroked paths, the bounds are expanded by half the stroke width.
 */
function computeLocalXBounds(
  paths: readonly CellPath[],
  cellX: number,
): { minX: number; maxX: number } {
  // Mutable accumulators narrowed across all path points
  // -- let needed because we reduce across multiple paths and their points
  let minX = Infinity;
  let maxX = -Infinity;

  paths.forEach((pathData) => {
    const commands = parseSvgPathD(pathData.d);
    const points = resolveAbsolutePoints(commands);
    const halfStroke = pathData.strokeWidth / 2;

    points.forEach(([px]) => {
      const localX = px - cellX;
      minX = Math.min(minX, localX - halfStroke);
      maxX = Math.max(maxX, localX + halfStroke);
    });
  });

  return { minX, maxX };
}

/** Add a filled SVG path to an opentype Path, applying coordinate transforms. */
function addFilledPath(
  otPath: opentype.Path,
  commands: readonly SVGPathCommand[],
  cellX: number,
  xShift: number,
): void {
  // Mutable cursor tracking pen position for expanding H/V into absolute coordinates
  let cx = 0;
  let cy = 0;

  commands.forEach((cmd) => {
    if (cmd.type === "M") { cx = cmd.x; cy = cmd.y; otPath.moveTo(cx - cellX + xShift, fontY(cy)); }
    else if (cmd.type === "L") { cx = cmd.x; cy = cmd.y; otPath.lineTo(cx - cellX + xShift, fontY(cy)); }
    else if (cmd.type === "H") { cx = cmd.x; otPath.lineTo(cx - cellX + xShift, fontY(cy)); }
    else if (cmd.type === "V") { cy = cmd.y; otPath.lineTo(cx - cellX + xShift, fontY(cy)); }
    else if (cmd.type === "Z") { otPath.close(); }
  });
}

/** Add a stroked polygon to an opentype Path as an expanded filled outline. */
function addStrokedPath(
  otPath: opentype.Path,
  commands: readonly SVGPathCommand[],
  strokeWidth: number,
  cellX: number,
  xShift: number,
): void {
  const halfWidth = strokeWidth / 2;
  const points = resolveAbsolutePoints(commands);
  // Drop the closing duplicate vertex if present (the Z command closes implicitly)
  const vertices = (
    points.length > 1 &&
    points[0][0] === points[points.length - 1][0] &&
    points[0][1] === points[points.length - 1][1]
  )
    ? points.slice(0, -1)
    : points;

  const outerVerts = offsetPolygon(vertices, halfWidth);
  const innerVerts = offsetPolygon(vertices, -halfWidth);

  // Trace function adds a polygon contour to the opentype path
  const traceContour = (verts: ReadonlyArray<[number, number]>): void => {
    verts.forEach((vert, vertIndex) => {
      const fx = vert[0] - cellX + xShift;
      const fy = fontY(vert[1]);
      if (vertIndex === 0) otPath.moveTo(fx, fy);
      else otPath.lineTo(fx, fy);
    });
    otPath.close();
  };

  // Outer contour (forward order)
  traceContour(outerVerts);
  // Inner contour (reversed to create the hole via opposite winding)
  traceContour([...innerVerts].reverse());
}

//endregion Path construction

//region Main build

const scriptDir = dirname(new URL(import.meta.url).pathname);
const svgPath = resolve(scriptDir, "glyphs.svg");
const distDir = resolve(scriptDir, "..", "dist");

console.log("Reading glyph SVG:", svgPath);
const svgContent = readFileSync(svgPath, "utf-8");
const cells = parseSvg(svgContent);
console.log(`Parsed ${cells.length} glyph cells`);

// Required .notdef glyph (empty placeholder for missing characters)
const notdefGlyph = new opentype.Glyph({
  name: ".notdef",
  unicode: 0,
  advanceWidth: SPACE_ADVANCE,
  path: new opentype.Path(),
});

// Space glyph
const spaceGlyph = new opentype.Glyph({
  name: "space",
  unicode: 32,
  advanceWidth: SPACE_ADVANCE,
  path: new opentype.Path(),
});

const letterGlyphs = cells
  .map((cell, cellIndex) => {
    const unicode = CELL_UNICODE[cellIndex];
    if (unicode === undefined) return undefined;

    const letterName = String.fromCharCode(unicode);
    const { minX, maxX } = computeLocalXBounds(cell.paths, cell.xOffset);
    const xShift = SIDE_BEARING - minX;
    const advanceWidth = maxX - minX + 2 * SIDE_BEARING;

    const path = new opentype.Path();
    cell.paths.forEach((cellPath) => {
      const commands = parseSvgPathD(cellPath.d);
      if (cellPath.isStroked) {
        addStrokedPath(path, commands, cellPath.strokeWidth, cell.xOffset, xShift);
      } else {
        addFilledPath(path, commands, cell.xOffset, xShift);
      }
    });

    console.log(`  ${letterName}: advance=${Math.round(advanceWidth)}, paths=${cell.paths.length}`);

    return new opentype.Glyph({
      name: letterName,
      unicode,
      advanceWidth,
      path,
    });
  })
  .filter((glyph): glyph is opentype.Glyph => glyph !== undefined);

const font = new opentype.Font({
  familyName: "Aquaticat",
  styleName: "Regular",
  unitsPerEm: UNITS_PER_EM,
  ascender: ASCENDER,
  descender: DESCENDER,
  glyphs: [notdefGlyph, spaceGlyph, ...letterGlyphs],
});

mkdirSync(distDir, { recursive: true });

const otfPath = resolve(distDir, "Aquaticat-Regular.otf");
const buffer = font.toArrayBuffer();
writeFileSync(otfPath, Buffer.from(buffer));
console.log(`Wrote ${otfPath} (${buffer.byteLength} bytes)`);

// Convert OTF to WOFF2 via fonttools (Python, available through uv)
console.log("Converting to WOFF2 via fonttools...");
const woff2Path = resolve(distDir, "Aquaticat-Regular.woff2");
const woff2Script = `from fontTools.ttLib import TTFont; f = TTFont("${otfPath}"); f.flavor = "woff2"; f.save("${woff2Path}")`;
try {
  await spawn("uv", ["run", "--with", "fonttools", "--with", "brotli", "python3", "-c", woff2Script]);
  const { size } = statSync(woff2Path);
  console.log(`Wrote ${woff2Path} (${size} bytes)`);
} catch (error: unknown) {
  console.error("WOFF2 conversion failed:", (error as { stderr: string }).stderr);
}

//endregion Main build
