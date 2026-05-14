/**
 * Axis-shaft, arrowhead, and tick-mark layer factories.
 *
 * Three structural elements of the coordinate-system backdrop:
 *
 * - {@link buildAxisShaftLayer}: three thick black line segments
 *   running from the min corner outward along +x, +y, +z.
 * - {@link buildAxisArrowheadLayers}: three small dark cones at the
 *   tips of the axis shafts, pointing along the respective axis.
 *   Pre-rotated cone geometries live in {@link ./deck-geometries.ts}
 *   so no runtime orientation math is needed.
 * - {@link buildAxisTickLayer}: short perpendicular marks at evenly
 *   spaced intervals along each axis.
 *
 * Coordinate planes and threshold guide lines moved to
 * `./deck-planes.ts`; scatter and text-layer factories live in
 * `./deck-scatter.ts` and `./deck-labels.ts`.
 *
 * @example
 * ```ts
 * import { buildAxisShaftLayer } from './deck-layers.ts';
 * const shaft = buildAxisShaftLayer({ bounds });
 * ```
 */

import type { Layer, } from '@deck.gl/core';
import { PathLayer, } from '@deck.gl/layers';
import { SimpleMeshLayer, } from '@deck.gl/mesh-layers';

import type { SceneBounds, } from './deck-config.ts';
import {
  coneGeometryX,
  coneGeometryY,
  coneGeometryZ,
} from './deck-geometries.ts';
import type { ChromeColors, } from './scripts/scheme.ts';

//region Types

/** Data shape for the axis-shaft PathLayer; deck.gl expects mutable nested arrays. */
type PathDatum = {
  path: [number, number, number,][];
};

/** Data shape for arrowhead mesh-layer instances. */
type ArrowheadDatum = {
  position: [number, number, number,];
};

//endregion Types

//region Constants

/** Axis shaft width in pixels (with `widthMinPixels` floor). */
const AXIS_SHAFT_WIDTH = 3;
/** Axis tick line width in pixels. */
const AXIS_TICK_WIDTH = 1.5;

/** Fraction of the axis extent the arrow tip extends past `max`. */
const AXIS_EXTENSION_FRACTION = 0.12;
/** Cone arrowhead length, as a fraction of the axis extent. */
const ARROWHEAD_LENGTH_FRACTION = 0.06;
/** Cone arrowhead radius, as a fraction of the axis extent. */
const ARROWHEAD_RADIUS_FRACTION = 0.018;
/** Number of tick marks per axis (evenly spaced including endpoints). */
const TICK_COUNT = 5;
/** Tick mark length, as a fraction of the axis extent. */
const TICK_LENGTH_FRACTION = 0.02;

//endregion Constants

//region Helpers

/**
 * Computes the per-axis extents and the arrow-tip positions, the most
 * common derived quantities across this module.
 *
 * @param bounds - Scene bounds.
 *
 * @returns Object with `dx`/`dy`/`dz` extents, `tipX`/`tipY`/`tipZ` tip positions, and the min corner.
 */
function computeAxisGeometry(
  { bounds, }: { bounds: SceneBounds; },
): {
  xMin: number;
  yMin: number;
  zMin: number;
  xMax: number;
  yMax: number;
  zMax: number;
  dx: number;
  dy: number;
  dz: number;
  tipX: number;
  tipY: number;
  tipZ: number;
} {
  const [
    xMin,
    xMax,
  ] = bounds.x;
  const [
    yMin,
    yMax,
  ] = bounds.y;
  const [
    zMin,
    zMax,
  ] = bounds.z;
  const dx = xMax - xMin;
  const dy = yMax - yMin;
  const dz = zMax - zMin;
  return {
    xMin,
    yMin,
    zMin,
    xMax,
    yMax,
    zMax,
    dx,
    dy,
    dz,
    tipX: xMax + dx * AXIS_EXTENSION_FRACTION,
    tipY: yMax + dy * AXIS_EXTENSION_FRACTION,
    tipZ: zMax + dz * AXIS_EXTENSION_FRACTION,
  };
}

//endregion Helpers

//region Axis shafts + arrowheads

/**
 * Builds a single {@link PathLayer} with three line segments; one per
 * axis; running from the min corner to the arrow tip position.
 *
 * @param bounds - Scene bounds.
 *
 * @returns PathLayer.
 */
export function buildAxisShaftLayer(
  {
    bounds,
    chrome,
  }: {
    bounds: SceneBounds;
    chrome: ChromeColors;
  },
): Layer {
  const g = computeAxisGeometry({
    bounds,
  },);
  const data: PathDatum[] = [
    {
      path: [
        [g.xMin, g.yMin, g.zMin,],
        [g.tipX, g.yMin, g.zMin,],
      ],
    },
    {
      path: [
        [g.xMin, g.yMin, g.zMin,],
        [g.xMin, g.tipY, g.zMin,],
      ],
    },
    {
      path: [
        [g.xMin, g.yMin, g.zMin,],
        [g.xMin, g.yMin, g.tipZ,],
      ],
    },
  ];
  return new PathLayer<PathDatum>({
    id: 'axis-shafts',
    data,
    getPath: function getPath(d,) {
      return d.path;
    },
    getColor: chrome.axis,
    getWidth: AXIS_SHAFT_WIDTH,
    widthUnits: 'pixels',
    widthMinPixels: AXIS_SHAFT_WIDTH,
  },);
}

/**
 * Builds three {@link SimpleMeshLayer} instances; one per axis;
 * each rendering a single cone at the tip of its axis.
 *
 * @param bounds - Scene bounds.
 *
 * @returns Three SimpleMeshLayers (one per axis).
 */
export function buildAxisArrowheadLayers(
  {
    bounds,
    chrome,
  }: {
    bounds: SceneBounds;
    chrome: ChromeColors;
  },
): readonly Layer[] {
  const g = computeAxisGeometry({
    bounds,
  },);
  const coneLengthX = g.dx * ARROWHEAD_LENGTH_FRACTION;
  const coneLengthY = g.dy * ARROWHEAD_LENGTH_FRACTION;
  const coneLengthZ = g.dz * ARROWHEAD_LENGTH_FRACTION;
  const coneRadiusX = g.dx * ARROWHEAD_RADIUS_FRACTION;
  const coneRadiusY = g.dy * ARROWHEAD_RADIUS_FRACTION;
  const coneRadiusZ = g.dz * ARROWHEAD_RADIUS_FRACTION;
  return [
    new SimpleMeshLayer<ArrowheadDatum>({
      id: 'arrowhead-x',
      data: [
        {
          position: [g.tipX - coneLengthX, g.yMin, g.zMin,],
        },
      ],
      mesh: coneGeometryX,
      getPosition: function getPosition(d,) {
        return d.position;
      },
      getColor: chrome.axis,
      getScale: [
        coneLengthX,
        coneRadiusX,
        coneRadiusX,
      ] as const,
      pickable: false,
    },),
    new SimpleMeshLayer<ArrowheadDatum>({
      id: 'arrowhead-y',
      data: [
        {
          position: [g.xMin, g.tipY - coneLengthY, g.zMin,],
        },
      ],
      mesh: coneGeometryY,
      getPosition: function getPosition(d,) {
        return d.position;
      },
      getColor: chrome.axis,
      getScale: [
        coneRadiusY,
        coneLengthY,
        coneRadiusY,
      ] as const,
      pickable: false,
    },),
    new SimpleMeshLayer<ArrowheadDatum>({
      id: 'arrowhead-z',
      data: [
        {
          position: [g.xMin, g.yMin, g.tipZ - coneLengthZ,],
        },
      ],
      mesh: coneGeometryZ,
      getPosition: function getPosition(d,) {
        return d.position;
      },
      getColor: chrome.axis,
      getScale: [
        coneRadiusZ,
        coneRadiusZ,
        coneLengthZ,
      ] as const,
      pickable: false,
    },),
  ];
}

//endregion Axis shafts + arrowheads

//region Tick marks

/**
 * Builds the tick-marks PathLayer: short perpendicular segments at
 * evenly spaced intervals along each axis.
 *
 * @param bounds - Scene bounds.
 *
 * @returns PathLayer with `3 * (TICK_COUNT + 1)` tick segments.
 */
export function buildAxisTickLayer(
  {
    bounds,
    chrome,
  }: {
    bounds: SceneBounds;
    chrome: ChromeColors;
  },
): Layer {
  const g = computeAxisGeometry({
    bounds,
  },);
  const tx = g.dx * TICK_LENGTH_FRACTION;
  const ty = g.dy * TICK_LENGTH_FRACTION;
  const ts: readonly number[] = Array.from(
    {
      length: TICK_COUNT + 1,
    },
    function tForIndex(_, i,) {
      return i / TICK_COUNT;
    },
  );
  const ticks: PathDatum[] = ts.flatMap(function tickTriple(t,) {
    const xAt = g.xMin + g.dx * t;
    const yAt = g.yMin + g.dy * t;
    const zAt = g.zMin + g.dz * t;
    return [
      {
        path: [
          [xAt, g.yMin - ty, g.zMin,],
          [xAt, g.yMin + ty, g.zMin,],
        ],
      },
      {
        path: [
          [g.xMin - tx, yAt, g.zMin,],
          [g.xMin + tx, yAt, g.zMin,],
        ],
      },
      {
        path: [
          [g.xMin, g.yMin - ty, zAt,],
          [g.xMin, g.yMin + ty, zAt,],
        ],
      },
    ];
  },);
  return new PathLayer<PathDatum>({
    id: 'axis-ticks',
    data: ticks,
    getPath: function getPath(d,) {
      return d.path;
    },
    getColor: chrome.axisTick,
    getWidth: AXIS_TICK_WIDTH,
    widthUnits: 'pixels',
    widthMinPixels: AXIS_TICK_WIDTH,
  },);
}

//endregion Tick marks
