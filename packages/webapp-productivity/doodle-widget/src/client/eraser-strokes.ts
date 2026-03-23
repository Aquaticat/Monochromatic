/**
 * Stroke erasure for the doodle widget.
 *
 * Tests stroke points against the eraser's travel segment between
 * frames using point-to-segment distance, so fast drags do not skip
 * over strokes.
 */

import { getStrokeWidth, } from './drawing-config.ts';
import {
  type NormalizedPoint,
  type StrokeData,
  denormalizePoint,
  getStrokes,
  setStrokes,
} from './drawing.ts';

/** Minimum number of points required for a valid sub-stroke after splitting */
const MIN_SEGMENT_POINTS = 2;

/**
 * Computes the squared distance from point P to the closest point
 * on line segment AB, in pixel space.
 *
 * Uses projection clamped to [0, 1] to find the nearest point on the
 * segment rather than the infinite line.
 *
 * @param px - point x in pixels
 *
 * @param py - point y in pixels
 *
 * @param ax - segment start x in pixels
 *
 * @param ay - segment start y in pixels
 *
 * @param bx - segment end x in pixels
 *
 * @param by - segment end y in pixels
 *
 * @returns squared pixel distance from P to nearest point on AB
 */
function distToSegmentSq(
  { px, py, ax, ay, bx, by, }: {
    px: number; py: number;
    ax: number; ay: number;
    bx: number; by: number;
  },
): number {
  const dx = bx - ax;
  const dy = by - ay;
  /** Squared length of segment AB; zero means degenerate (A == B) */
  const lenSq = dx * dx + dy * dy;

  if (lenSq === 0)
    return (px - ax) ** 2 + (py - ay) ** 2;

  /** Projection parameter clamped to [0, 1] so closest point stays on segment */
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq,),);
  /** Closest point on segment */
  const cx = ax + t * dx;
  const cy = ay + t * dy;

  return (px - cx) ** 2 + (py - cy) ** 2;
}

/**
 * Erases stroke segments near the eraser path.
 *
 * Tests each stroke point against the line segment from
 * `previousPoint` to `point` (the eraser's travel path between
 * frames). When `previousPoint` is null (first event of a gesture),
 * tests against the single point only.
 *
 * @param point - current eraser position in normalized [0..1] space
 *
 * @param previousPoint - previous eraser position, or null for first event
 *
 * @param cw - current canvas width in CSS pixels
 *
 * @param ch - current canvas height in CSS pixels
 *
 * @returns `true` if any stroke was modified
 *
 * @example
 * ```ts
 * const erased = eraseStrokesAt({
 *   point: [0.5, 0.5], previousPoint: [0.4, 0.4], cw: 800, ch: 600,
 * });
 * if (erased) redraw({ ctx, cw, ch });
 * ```
 */
export function eraseStrokesAt({ point, previousPoint, cw, ch, }: {
  point: NormalizedPoint;
  previousPoint: NormalizedPoint | null;
  cw: number;
  ch: number;
}): boolean {
  /** Eraser radius in CSS pixels, matching the active stroke width */
  const radiusPx = getStrokeWidth();
  /** Eraser segment endpoint in pixel space */
  const { px: bx, py: by, } = denormalizePoint({ point, cw, ch, },);
  /** Eraser segment start in pixel space (same as end when no previous point) */
  const { px: ax, py: ay, } = previousPoint !== null
    ? denormalizePoint({ point: previousPoint, cw, ch, },)
    : { px: bx, py: by, };
  /** Squared radius for distance comparison without sqrt */
  const radiusSq = radiusPx * radiusPx;

  const oldStrokes = getStrokes();
  let erased = false;
  const newStrokes: StrokeData[] = [];

  for (const stroke of oldStrokes) {
    let strokeModified = false;
    /** Sub-stroke segments surviving after erasure */
    const segments: NormalizedPoint[][] = [];
    /** Points accumulating for the current sub-stroke */
    let currentSegment: NormalizedPoint[] = [];

    for (const p of stroke.points) {
      /** Stroke point in pixel space */
      const { px, py, } = denormalizePoint({ point: p, cw, ch, },);
      /** Squared distance from stroke point to eraser travel segment */
      const distSq = distToSegmentSq({
        px, py, ax, ay, bx, by,
      },);

      if (distSq <= radiusSq) {
        strokeModified = true;
        if (currentSegment.length >= MIN_SEGMENT_POINTS)
          segments.push(currentSegment,);
        currentSegment = [];
      }
      else {
        currentSegment.push(p,);
      }
    }

    if (currentSegment.length >= MIN_SEGMENT_POINTS)
      segments.push(currentSegment,);

    if (strokeModified) {
      erased = true;
      for (const seg of segments)
        newStrokes.push({ points: [...seg,], color: stroke.color, width: stroke.width, },);
    }
    else {
      newStrokes.push(stroke,);
    }
  }

  if (erased)
    setStrokes(newStrokes,);

  return erased;
}
