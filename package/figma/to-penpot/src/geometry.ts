/**
 * Geometry conversion: selrect/points, transform matrix, and parent index.
 *
 * @module figma-to-penpot-geometry
 */

import { IDENTITY_TRANSFORM, } from './constants.ts';
import {
  isRecord,
  numberOr,
  SKIP,
  stringOr,
} from './read.ts';
import type {
  PenpotPoints,
  PenpotSelRect,
  PenpotTransform,
} from './types.ts';

/**
 * Parsed Figma parent reference: the parent GUID plus its sibling position.
 */
export type ParentRef = {
  parentGuid: {
    sessionId: number;
    localId: number;
  };
  position: string;
};

/**
 * Compute a Penpot selrect and its 4 corner points from a bounding rect.
 *
 * @param x - left edge
 *
 * @param y - top edge
 *
 * @param width - rect width
 *
 * @param height - rect height
 *
 * @returns {@link PenpotSelRect} and clockwise corner {@link PenpotPoints}
 *
 * @example
 * ```ts
 * const { selrect, points, } = computeSelRect({ x: 0, y: 0, width: 10, height: 5, });
 * ```
 */
export function computeSelRect(
  {
    x,
    y,
    width,
    height,
  }: Readonly<{
    x: number;
    y: number;
    width: number;
    height: number;
  }>,
): {
  selrect: PenpotSelRect;
  points: PenpotPoints;
} {
  /**
   * Right edge of the bounding rect, reused for selrect and corner points.
   */
  const x2 = x + width;
  /**
   * Bottom edge of the bounding rect, reused for selrect and corner points.
   */
  const y2 = y + height;
  return {
    selrect: {
      x,
      y,
      width,
      height,
      x1: x,
      y1: y,
      x2,
      y2,
    },
    points: [
      {
        x,
        y,
      },
      {
        x: x2,
        y,
      },
      {
        x: x2,
        y: y2,
      },
      {
        x,
        y: y2,
      },
    ],
  };
}

/**
 * Convert a Figma matrix struct to a Penpot transform.
 *
 * Figma `{ m00, m01, m02, m10, m11, m12 }` maps to the Penpot/SVG
 * `{ a, c, e / b, d, f }` layout; missing matrices become the identity.
 *
 * @param transform - Figma matrix record, or any non-record (identity)
 *
 * @returns {@link PenpotTransform} matrix
 *
 * @example
 * ```ts
 * const t = figmaTransformToPenpot(nc.transform);
 * ```
 */
export function figmaTransformToPenpot(transform: unknown,): PenpotTransform {
  if (!isRecord(transform,))
    return { ...IDENTITY_TRANSFORM, };
  return {
    a: numberOr({
      value: transform.m00,
      fallback: 1,
    },),
    b: numberOr({
      value: transform.m10,
      fallback: 0,
    },),
    c: numberOr({
      value: transform.m01,
      fallback: 0,
    },),
    d: numberOr({
      value: transform.m11,
      fallback: 1,
    },),
    e: numberOr({
      value: transform.m02,
      fallback: 0,
    },),
    f: numberOr({
      value: transform.m12,
      fallback: 0,
    },),
  };
}

/**
 * Parse a Figma ParentIndex struct into a parent reference.
 *
 * Figma encodes sibling order with position strings (`"!"`, `"#"`, ...); Penpot
 * orders children via a `shapes` array on the parent instead.
 *
 * @param parentIndex - Figma parentIndex record, or any non-record
 *
 * @returns parsed parent reference, or {@link SKIP} when absent or malformed
 *
 * @example
 * ```ts
 * const parent = parseParentIndex(nc.parentIndex);
 * if (parent !== SKIP) { ... }
 * ```
 */
export function parseParentIndex(parentIndex: unknown,): ParentRef | typeof SKIP {
  if (!isRecord(parentIndex,))
    return SKIP;
  /**
   * Parent GUID struct; malformed entries skip the parent link.
   */
  const {guid} = parentIndex;
  if (!isRecord(guid,))
    return SKIP;
  return {
    parentGuid: {
      sessionId: numberOr({
        value: guid.sessionID,
        fallback: 0,
      },),
      localId: numberOr({
        value: guid.localID,
        fallback: 0,
      },),
    },
    position: stringOr({
      value: parentIndex.position,
      fallback: '',
    },),
  };
}
