/**
 * Wireframe and threshold-plane layer factories.
 *
 * Scatter and text-layer factories live in sibling files
 * (`./deck-scatter.ts`, `./deck-labels.ts`) to keep each module
 * under the 300-line cap.
 *
 * @example
 * ```ts
 * import { buildWireframeLayer } from './deck-layers.ts';
 * const layer = buildWireframeLayer({ bounds });
 * ```
 */

import type { Layer, } from '@deck.gl/core';
import {
  PathLayer,
  PolygonLayer,
} from '@deck.gl/layers';

import type { SceneBounds, } from './deck-config.ts';
import type { DimMapping, } from './scripts/filter.ts';

//region Types

/** Data shape for the wireframe PathLayer; deck.gl expects mutable nested arrays. */
type PathDatum = {
  path: [number, number, number,][];
};

/** Data shape for the PolygonLayer (threshold planes); mutable arrays per deck.gl typings. */
type PolygonDatum = {
  polygon: [number, number, number,][];
};

//endregion Types

//region Constants

/** Source-bytes threshold (≈ "300 SLOC" boundary), on log10. */
const SOURCE_BYTES_PLANE = Math.log10(10_000,);
/** Days-since-commit threshold (1 year), on log10. */
const DAYS_STALE_PLANE = Math.log10(365,);
/** Install-size threshold (~100KB soft boundary), on log10. */
const INSTALL_SIZE_PLANE = Math.log10(100_000,);

/** Wireframe edge colour: light grey, ~60% opacity. */
const WIREFRAME_COLOR: readonly [number, number, number, number,] = [
  180,
  180,
  180,
  160,
];

/** Threshold-plane fill colour: muted blue, ~12% opacity. */
const THRESHOLD_PLANE_COLOR: readonly [number, number, number, number,] = [
  80,
  120,
  200,
  30,
];

//endregion Constants

//region Helpers

/**
 * Constructs a two-point path datum for the wireframe.
 *
 * @param a - Start point.
 * @param b - End point.
 *
 * @returns A `PathDatum` wrapping `[a, b]`.
 */
function edge(
  {
    a,
    b,
  }: {
    a: [number, number, number,];
    b: [number, number, number,];
  },
): PathDatum {
  return {
    path: [a, b,],
  };
}

/**
 * Constructs a single threshold-plane PolygonLayer.
 *
 * @param id - Layer id (used by deck.gl for reconciliation).
 * @param polygon - Four 3D vertices of the rectangle.
 *
 * @returns PolygonLayer with one polygon.
 */
function makePlane(
  {
    id,
    polygon,
  }: {
    id: string;
    polygon: [number, number, number,][];
  },
): Layer {
  return new PolygonLayer<PolygonDatum>({
    id,
    data: [
      { polygon, },
    ],
    getPolygon: function getPolygon(d,) {
      return d.polygon;
    },
    getFillColor: THRESHOLD_PLANE_COLOR,
    filled: true,
    stroked: false,
  },);
}

//endregion Helpers

//region Wireframe

/**
 * Builds the 12-edge bounding-box wireframe matching the spatial bounds.
 *
 * @param bounds - Scene bounds.
 *
 * @returns PathLayer containing 12 line segments.
 */
export function buildWireframeLayer(
  { bounds, }: { bounds: SceneBounds; },
): Layer {
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
  const data: PathDatum[] = [
    // bottom rectangle (z = zMin)
    edge({
      a: [xMin, yMin, zMin,],
      b: [xMax, yMin, zMin,],
    },),
    edge({
      a: [xMax, yMin, zMin,],
      b: [xMax, yMax, zMin,],
    },),
    edge({
      a: [xMax, yMax, zMin,],
      b: [xMin, yMax, zMin,],
    },),
    edge({
      a: [xMin, yMax, zMin,],
      b: [xMin, yMin, zMin,],
    },),
    // top rectangle (z = zMax)
    edge({
      a: [xMin, yMin, zMax,],
      b: [xMax, yMin, zMax,],
    },),
    edge({
      a: [xMax, yMin, zMax,],
      b: [xMax, yMax, zMax,],
    },),
    edge({
      a: [xMax, yMax, zMax,],
      b: [xMin, yMax, zMax,],
    },),
    edge({
      a: [xMin, yMax, zMax,],
      b: [xMin, yMin, zMax,],
    },),
    // vertical edges connecting bottom to top
    edge({
      a: [xMin, yMin, zMin,],
      b: [xMin, yMin, zMax,],
    },),
    edge({
      a: [xMax, yMin, zMin,],
      b: [xMax, yMin, zMax,],
    },),
    edge({
      a: [xMax, yMax, zMin,],
      b: [xMax, yMax, zMax,],
    },),
    edge({
      a: [xMin, yMax, zMin,],
      b: [xMin, yMax, zMax,],
    },),
  ];
  return new PathLayer<PathDatum>({
    id: 'wireframe',
    data,
    getPath: function getPath(d,) {
      return d.path;
    },
    getColor: WIREFRAME_COLOR,
    getWidth: 1,
    widthUnits: 'pixels',
  },);
}

//endregion Wireframe

//region Threshold planes

/**
 * Builds zero to three threshold-plane PolygonLayers.
 *
 * Each plane is drawn only when its spatial channel is mapped to its
 * expected default dim — the threshold values are heuristics tied to
 * specific data dims (e.g. log10(10000) bytes ≈ 300 SLOC), so they
 * lose meaning under a different mapping.
 *
 * @param bounds - Scene bounds.
 * @param dimMapping - Current dim mapping.
 *
 * @returns Array of zero to three PolygonLayers.
 */
export function buildThresholdPlaneLayers(
  {
    bounds,
    dimMapping,
  }: {
    bounds: SceneBounds;
    dimMapping: DimMapping;
  },
): readonly Layer[] {
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
  const layers: Layer[] = [];
  if (dimMapping.x === 'logSourceBytes' && SOURCE_BYTES_PLANE > xMin && SOURCE_BYTES_PLANE < xMax) {
    layers.push(makePlane({
      id: 'plane-x',
      polygon: [
        [SOURCE_BYTES_PLANE, yMin, zMin,],
        [SOURCE_BYTES_PLANE, yMax, zMin,],
        [SOURCE_BYTES_PLANE, yMax, zMax,],
        [SOURCE_BYTES_PLANE, yMin, zMax,],
      ],
    },),);
  }
  if (dimMapping.y === 'logDaysStale' && DAYS_STALE_PLANE > yMin && DAYS_STALE_PLANE < yMax) {
    layers.push(makePlane({
      id: 'plane-y',
      polygon: [
        [xMin, DAYS_STALE_PLANE, zMin,],
        [xMax, DAYS_STALE_PLANE, zMin,],
        [xMax, DAYS_STALE_PLANE, zMax,],
        [xMin, DAYS_STALE_PLANE, zMax,],
      ],
    },),);
  }
  if (dimMapping.z === 'logInstallSize' && INSTALL_SIZE_PLANE > zMin && INSTALL_SIZE_PLANE < zMax) {
    layers.push(makePlane({
      id: 'plane-z',
      polygon: [
        [xMin, yMin, INSTALL_SIZE_PLANE,],
        [xMax, yMin, INSTALL_SIZE_PLANE,],
        [xMax, yMax, INSTALL_SIZE_PLANE,],
        [xMin, yMax, INSTALL_SIZE_PLANE,],
      ],
    },),);
  }
  return layers;
}

//endregion Threshold planes
