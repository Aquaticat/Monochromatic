/**
 * Polygon offset utilities for expanding stroked SVG paths into filled outlines.
 * Used by the font build to convert stroke-based glyphs (O, Q hexagons) into
 * closed contours suitable for OpenType glyph paths.
 */

/** Cartesian coordinate pair. */
type Point = [number, number];

/**
 * Intersect two infinite lines, each defined by a point and direction vector.
 * @param p1 - point on line 1
 * @param d1 - direction of line 1
 * @param p2 - point on line 2
 * @param d2 - direction of line 2
 * @returns intersection point
 */
function lineIntersection(p1: Point, d1: Point, p2: Point, d2: Point): Point {
  const cross = d1[0] * d2[1] - d1[1] * d2[0];
  const dx = p2[0] - p1[0];
  const dy = p2[1] - p1[1];
  const t = (dx * d2[1] - dy * d2[0]) / cross;
  return [p1[0] + t * d1[0], p1[1] + t * d1[1]];
}

/**
 * Offset every edge of a closed polygon by a signed distance along its outward normal,
 * then intersect consecutive offset edges to produce the new vertex ring.
 * Positive offset expands a clockwise (SVG Y-down) polygon outward;
 * negative offset shrinks it inward.
 * @param vertices - ordered polygon vertices (clockwise in SVG coordinate space)
 * @param offset - signed offset distance (positive = outward, negative = inward)
 * @returns new polygon vertices at the requested offset
 */
export function offsetPolygon(vertices: readonly Point[], offset: number): Point[] {
  const vertexCount = vertices.length;

  // Compute parallel-shifted edges
  const offsetEdges = vertices.map((vertex, vertexIndex) => {
    const next = vertices[(vertexIndex + 1) % vertexCount];
    const dx = next[0] - vertex[0];
    const dy = next[1] - vertex[1];
    const len = Math.sqrt(dx * dx + dy * dy);
    // Outward normal for CW polygon in SVG coords (Y-down): (dy/len, -dx/len)
    const nx = (dy / len) * offset;
    const ny = (-dx / len) * offset;
    return {
      point: [vertex[0] + nx, vertex[1] + ny] satisfies Point,
      direction: [dx, dy] satisfies Point,
    };
  });

  // Intersect consecutive offset edges to find new vertices
  return offsetEdges.map((edge, edgeIndex) => {
    const nextEdge = offsetEdges[(edgeIndex + 1) % vertexCount];
    return lineIntersection(edge.point, edge.direction, nextEdge.point, nextEdge.direction);
  });
}
