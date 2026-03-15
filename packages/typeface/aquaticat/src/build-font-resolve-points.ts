/**
 * Resolves absolute X/Y coordinates from SVG path commands.
 * Used by bounds computation and stroke expansion during font building.
 *
 * @module
 */

import type { SVGPathCommand, } from './parse-svg.ts';

/**
 * Resolves absolute X/Y positions from SVG path commands (expanding H/V to full coords).
 *
 * @param commands - parsed SVG path commands
 *
 * @returns array of [x, y] coordinate pairs
 *
 * @example
 * ```ts
 * const points = resolveAbsolutePoints(parseSvgPathD("M10 20 H30 V40"));
 * // [[10, 20], [30, 20], [30, 40]]
 * ```
 */
export function resolveAbsolutePoints(
  commands: readonly SVGPathCommand[],
): [number, number,][] {
  const points: [number, number,][] = [];
  // Mutable cursor tracking the current pen position while replaying path commands
  // -- let needed because M/L/H/V each update different axes of the cursor
  let cx = 0;
  let cy = 0;
  commands.forEach(function resolveCommand(cmd,) {
    if (cmd.type === 'M' || cmd.type === 'L') {
      cx = cmd.x;
      cy = cmd.y;
      points.push([cx, cy,],);
    }
    else if (cmd.type === 'H') {
      cx = cmd.x;
      points.push([cx, cy,],);
    }
    else if (cmd.type === 'V') {
      cy = cmd.y;
      points.push([cx, cy,],);
    }
  },);
  return points;
}
