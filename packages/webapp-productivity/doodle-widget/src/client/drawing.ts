/**
 * Canvas drawing state and rendering for the doodle widget.
 *
 * Manages stroke data as normalized [0..1] coordinate pairs so strokes
 * persist through canvas resizes. Each stroke captures its color and
 * width at creation time. Provides functions for pointer event
 * handling and full canvas redraws.
 *
 * Exceeds 100 lines: cohesive drawing state, type definitions, and
 * rendering logic that share private module state and cannot be
 * meaningfully split further.
 */

import {
  getStrokeColor,
  getStrokeWidth,
} from './drawing-config.ts';
import { renderStrokes, } from './stroke-renderer.ts';

//region Types

/** Normalized coordinate pair [x, y] in [0..1] range */
export type NormalizedPoint = readonly [number, number,];

/**
 * Stroke data with normalized coordinates, color, and width.
 *
 * @example
 * ```ts
 * const stroke: StrokeData = {
 *   points: [[0.1, 0.2], [0.3, 0.4]],
 *   color: '#c24e2e',
 *   width: 10,
 * };
 * ```
 */
export type StrokeData = {
  /** Sequence of normalized points forming one continuous stroke */
  readonly points: NormalizedPoint[];
  /** CSS color string captured at stroke creation */
  readonly color: string;
  /** Stroke width in CSS pixels captured at stroke creation */
  readonly width: number;
};

/**
 * Line segment between two normalized points for incremental rendering.
 *
 * @example
 * ```ts
 * const segment = continueStroke(point);
 * if (segment !== null) {
 *   ctx.moveTo(segment.from[0] * width, segment.from[1] * height);
 *   ctx.lineTo(segment.to[0] * width, segment.to[1] * height);
 * }
 * ```
 */
export type StrokeSegment = {
  /** Starting point of the segment */
  readonly from: NormalizedPoint;
  /** Ending point of the segment */
  readonly to: NormalizedPoint;
};

//endregion Types

//region State

/** All completed and in-progress strokes */
let strokes: StrokeData[] = [];

/** Stroke currently being drawn, or null when idle */
let current: StrokeData | null = null;

/** Whether a pointer-driven drawing gesture is active */
let drawing = false;

//endregion State

/**
 * Redraws all stored strokes onto the canvas.
 *
 * Clears the canvas and renders each stroke using its captured color
 * and width, with denormalized coordinates based on current canvas
 * dimensions.
 *
 * @param ctx - canvas rendering context
 *
 * @param cw - current canvas width in CSS pixels
 *
 * @param ch - current canvas height in CSS pixels
 */
export function redraw(
  { ctx, cw, ch, }: { ctx: CanvasRenderingContext2D; cw: number; ch: number; },
): void {
  ctx.clearRect(0, 0, cw, ch,);
  renderStrokes({ ctx, cw, ch, strokes, },);
}

/**
 * Converts pointer event coordinates to normalized [0..1] canvas coordinates.
 *
 * @param event - pointer event with client coordinates
 *
 * @param canvas - canvas element for bounding rect calculation
 *
 * @param cw - current canvas width in CSS pixels
 *
 * @param ch - current canvas height in CSS pixels
 *
 * @returns normalized [x, y] coordinate pair
 */
export function normalizePointer({ event, canvas, cw, ch, }: {
  event: PointerEvent;
  canvas: HTMLCanvasElement;
  cw: number;
  ch: number;
},): NormalizedPoint {
  const rect = canvas.getBoundingClientRect();
  return [(event.clientX - rect.left) / cw, (event.clientY - rect.top) / ch,];
}

/**
 * Begins a new stroke at the given normalized point.
 *
 * Captures the active color and width at stroke creation time so
 * each stroke retains its original settings.
 *
 * @param point - starting coordinate in normalized [0..1] space
 */
export function startStroke(point: NormalizedPoint,): void {
  drawing = true;
  current = { points: [point,], color: getStrokeColor(), width: getStrokeWidth(), };
  strokes.push(current,);
}

/**
 * Appends a point to the current stroke.
 *
 * @param point - coordinate to append in normalized [0..1] space
 *
 * @returns segment from previous to current point for incremental
 *   rendering, or null if no drawing gesture is active
 */
export function continueStroke(point: NormalizedPoint,): StrokeSegment | null {
  if (!drawing || current === null)
    return null;
  const previous = current.points.at(-1,);
  if (previous === undefined)
    return null;
  current.points.push(point,);
  return { from: previous, to: point, };
}

/**
 * Ends the current drawing gesture.
 */
export function endStroke(): void {
  drawing = false;
  current = null;
}

/**
 * Clears all stored strokes.
 */
export function clearStrokes(): void {
  strokes = [];
  current = null;
}

/**
 * Replaces all stored strokes with the given array.
 *
 * Used by page switching to restore a previously saved page's strokes.
 *
 * @param newStrokes - stroke data to set as current
 */
export function setStrokes(newStrokes: StrokeData[],): void {
  strokes = newStrokes;
  current = null;
  drawing = false;
}

/**
 * Returns a readonly snapshot of all stored strokes.
 *
 * Each stroke includes its captured color and width alongside
 * the normalized point data.
 *
 * @returns array of stroke data for export
 *
 * @example
 * ```ts
 * const allStrokes = getStrokes();
 * for (const stroke of allStrokes) {
 *   console.log(stroke.color, stroke.width, stroke.points.length);
 * }
 * ```
 */
export function getStrokes(): readonly StrokeData[] {
  return strokes;
}
