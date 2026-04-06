// oxlint-disable typescript/no-unsafe-member-access, typescript/no-unsafe-call, typescript/no-unsafe-assignment, typescript/no-unsafe-argument, typescript/no-unsafe-type-assertion, typescript/no-unsafe-return -- opentype.js is a JS library with no TypeScript declarations; all API calls are inherently untyped
/**
 * Stroked path expansion for converting SVG stroke-based glyphs into filled outlines.
 * Separated from {@link ./build-font-paths.ts} to stay within the max-lines budget.
 *
 * @module
 */

// oxlint-disable-next-line import/no-namespace -- opentype.js requires namespace import for its Path type
import type * as opentype from 'opentype.js';

import { fontY, } from './build-font-metrics.ts';
import { resolveAbsolutePoints, } from './build-font-resolve-points.ts';
import { offsetPolygon, } from './expand-stroke.ts';
import type { SVGPathCommand, } from './parse-svg.ts';

/**
 * Adds a stroked polygon to an opentype Path as an expanded filled outline.
 *
 * @param otPath - opentype path to append to
 *
 * @param commands - parsed SVG path commands
 *
 * @param strokeWidth - stroke width in SVG units
 *
 * @param cellX - X offset of the cell in SVG coordinates
 *
 * @param xShift - horizontal shift to apply for proportional spacing
 *
 * @example
 * ```ts
 * addStrokedPath(otPath, commands, 2, cellX, xShift);
 * ```
 */
export function addStrokedPath(
  otPath: opentype.Path,
  commands: readonly SVGPathCommand[],
  strokeWidth: number,
  cellX: number,
  xShift: number,
): void {
  const halfWidth = strokeWidth / 2;
  const points = resolveAbsolutePoints(commands,);
  // Drop the closing duplicate vertex if present (the Z command closes implicitly)
  const [first,] = points;
  const last = points.at(-1,);
  const vertices = (
      first !== undefined
      && last !== undefined
      && points.length > 1
      && first[0] === last[0]
      && first[1] === last[1]
    )
    ? points.slice(
      0,
      -1,
    )
    : points;

  const outerVerts = offsetPolygon(
    vertices,
    halfWidth,
  );
  const innerVerts = offsetPolygon(
    vertices,
    -halfWidth,
  );

  /**
   * Traces a polygon contour onto the opentype path.
   *
   * @param verts - ordered vertices of the contour polygon
   */
  function traceContour(verts: readonly [
    number,
    number,
  ][],): void {
    verts.forEach(function traceVertex(
      vert,
      vertIndex,
    ) {
      const fx = vert[0] - cellX + xShift;
      const fy = fontY(vert[1],);
      if (vertIndex === 0) {
        otPath.moveTo(
          fx,
          fy,
        );
      }
      else {
        otPath.lineTo(
          fx,
          fy,
        );
      }
    },);
    otPath.close();
  }

  // Outer contour (forward order)
  traceContour(outerVerts,);
  // Inner contour (reversed to create the hole via opposite winding)
  traceContour([...innerVerts,].toReversed(),);
}
