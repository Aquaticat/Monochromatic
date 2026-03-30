// oxlint-disable typescript/no-unsafe-member-access, typescript/no-unsafe-call, typescript/no-unsafe-assignment, typescript/no-unsafe-argument, typescript/no-unsafe-type-assertion, typescript/no-unsafe-return -- opentype.js is a JS library with no TypeScript declarations; all API calls are inherently untyped
/**
 * Path construction utilities for converting SVG glyph data into OpenType path commands.
 *
 * @example
 * ```ts
 * import { computeLocalXBounds, addFilledPath } from "./build-font-paths.ts";
 * ```
 */

// oxlint-disable-next-line import/no-namespace -- opentype.js requires namespace import for its Path type
import type * as opentype from 'opentype.js';

import { fontY, } from './build-font-metrics.ts';
import { resolveAbsolutePoints, } from './build-font-resolve-points.ts';
import {
  type CellPath,
  parseSvgPathD,
  type SVGPathCommand,
} from './parse-svg.ts';

//region Path construction

/**
 * Computes the X bounding box of all paths in a cell, in local cell coordinates.
 * For stroked paths, the bounds are expanded by half the stroke width.
 *
 * @param paths - cell paths with their stroke widths
 *
 * @param cellX - X offset of the cell in SVG coordinates
 *
 * @returns min and max X in local cell coordinates
 *
 * @example
 * ```ts
 * const { minX, maxX } = computeLocalXBounds(cell.paths, cell.xOffset);
 * ```
 */
export function computeLocalXBounds(
  paths: readonly CellPath[],
  cellX: number,
): {
  minX: number;
  maxX: number;
} {
  // Mutable accumulators narrowed across all path points
  // -- let needed because we reduce across multiple paths and their points
  let minX = Infinity;
  let maxX = -Infinity;

  paths.forEach(function measurePath(pathData,) {
    const commands = parseSvgPathD(pathData.d,);
    const points = resolveAbsolutePoints(commands,);
    const halfStroke = pathData.strokeWidth / 2;

    points.forEach(function updateBounds([px,],) {
      const localX = px - cellX;
      minX = Math.min(
        minX,
        localX - halfStroke,
      );
      maxX = Math.max(
        maxX,
        localX + halfStroke,
      );
    },);
  },);

  return {
    minX,
    maxX,
  };
}

/**
 * Adds a filled SVG path to an opentype Path, applying coordinate transforms.
 *
 * @param otPath - opentype path to append to
 *
 * @param commands - parsed SVG path commands
 *
 * @param cellX - X offset of the cell in SVG coordinates
 *
 * @param xShift - horizontal shift to apply for proportional spacing
 */
export function addFilledPath(
  otPath: opentype.Path,
  commands: readonly SVGPathCommand[],
  cellX: number,
  xShift: number,
): void {
  // Mutable cursor tracking pen position for expanding H/V into absolute coordinates
  let cx = 0;
  let cy = 0;

  commands.forEach(function traceFilledCommand(cmd,) {
    if (cmd.type === 'M') {
      cx = cmd.x;
      cy = cmd.y;
      otPath.moveTo(
        cx - cellX + xShift,
        fontY(cy,),
      );
    }
    else if (cmd.type === 'L') {
      cx = cmd.x;
      cy = cmd.y;
      otPath.lineTo(
        cx - cellX + xShift,
        fontY(cy,),
      );
    }
    else if (cmd.type === 'H') {
      cx = cmd.x;
      otPath.lineTo(
        cx - cellX + xShift,
        fontY(cy,),
      );
    }
    else if (cmd.type === 'V') {
      cy = cmd.y;
      otPath.lineTo(
        cx - cellX + xShift,
        fontY(cy,),
      );
    }
    // oxlint-disable-next-line typescript/no-unnecessary-condition -- SVG command type discriminant is checked exhaustively
    else if (cmd.type === 'Z') {
      otPath.close();
    }
  },);
}

//endregion Path construction
