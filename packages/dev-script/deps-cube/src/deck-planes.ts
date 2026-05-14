/**
 * Coordinate-plane and threshold-guide layer factories.
 *
 * Holds the green coordinate planes that intersect at the data box's
 * min corner and the thin threshold-guide line layer that replaces
 * the previous opaque threshold planes. Split out from
 * `deck-layers.ts` so each layer file stays under the 300-line cap.
 *
 * Uses {@link SolidPolygonLayer} with `_full3d: true` rather than the
 * higher-level `PolygonLayer`. `SolidPolygonLayer` is the only deck.gl
 * layer that exposes `_full3d`, and without it the floor and side wall
 * tessellate to zero triangles: their XY projection is a degenerate
 * line, and earcut produces nothing. With `_full3d`, deck.gl picks the
 * largest-area plane (xy / xz / yz) for tessellation, then permutes
 * back; verified by reading the upstream
 * `solid-polygon-layer/polygon.ts` getSurfaceIndices implementation.
 *
 * @example
 * ```ts
 * import { buildCoordinatePlaneLayers } from './deck-planes.ts';
 * const layers = buildCoordinatePlaneLayers({ bounds });
 * ```
 */

import type { Layer, } from '@deck.gl/core';
import {
  PathLayer,
  SolidPolygonLayer,
} from '@deck.gl/layers';

import type { SceneBounds, } from './deck-config.ts';
import type { DimMapping, } from './scripts/filter.ts';

//region Types

/** Data shape for the PolygonLayer (coordinate planes); mutable arrays per deck.gl typings. */
type PolygonDatum = {
  polygon: [number, number, number,][];
};

/** Data shape for the PathLayer (threshold guides); mutable arrays per deck.gl typings. */
type PathDatum = {
  path: [number, number, number,][];
};

//endregion Types

//region Constants

/** Source-bytes threshold (~ "300 SLOC" boundary), on log10. */
const SOURCE_BYTES_THRESHOLD = Math.log10(10_000,);
/** Days-since-commit threshold (1 year), on log10. */
const DAYS_STALE_THRESHOLD = Math.log10(365,);
/** Install-size threshold (~100KB soft boundary), on log10. */
const INSTALL_SIZE_THRESHOLD = Math.log10(100_000,);

/**
 * Coordinate-plane fill colour: pale green, ~24% opacity.
 *
 * Iteration-1 used alpha 30 (12%) which was effectively invisible against
 * the busy scene. The reference image's planes read more clearly; alpha
 * 60 gets visibly translucent without fully obscuring the data.
 */
const COORDINATE_PLANE_COLOR: readonly [number, number, number, number,] = [
  140,
  200,
  140,
  60,
];

/** Threshold-line colour: muted brown so the line reads as a heuristic guide, not part of the axes. */
const THRESHOLD_LINE_COLOR: readonly [number, number, number, number,] = [
  150,
  100,
  60,
  200,
];

/** Plane margin past the data box on the +axis side, as a fraction of the axis extent. */
const PLANE_MARGIN_FRACTION = 0.05;
/** Threshold-guide line width in pixels. */
const THRESHOLD_LINE_WIDTH = 1.5;

//endregion Constants

//region Coordinate planes

/**
 * Builds the three semi-transparent green coordinate planes that
 * intersect at the data box's min corner. Visually matches the
 * reference image's role: three quadrant walls forming a 3D
 * coordinate system.
 *
 * @param bounds - Scene bounds.
 *
 * @returns Three PolygonLayers (floor / back / side).
 */
export function buildCoordinatePlaneLayers(
  { bounds, }: { bounds: SceneBounds; },
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
  const dx = xMax - xMin;
  const dy = yMax - yMin;
  const dz = zMax - zMin;
  const mx = dx * PLANE_MARGIN_FRACTION;
  const my = dy * PLANE_MARGIN_FRACTION;
  const mz = dz * PLANE_MARGIN_FRACTION;
  const floor: PolygonDatum = {
    polygon: [
      [xMin - mx, yMin, zMin - mz,],
      [xMax + mx, yMin, zMin - mz,],
      [xMax + mx, yMin, zMax + mz,],
      [xMin - mx, yMin, zMax + mz,],
    ],
  };
  const back: PolygonDatum = {
    polygon: [
      [xMin - mx, yMin - my, zMin,],
      [xMax + mx, yMin - my, zMin,],
      [xMax + mx, yMax + my, zMin,],
      [xMin - mx, yMax + my, zMin,],
    ],
  };
  const side: PolygonDatum = {
    polygon: [
      [xMin, yMin - my, zMin - mz,],
      [xMin, yMin - my, zMax + mz,],
      [xMin, yMax + my, zMax + mz,],
      [xMin, yMax + my, zMin - mz,],
    ],
  };
  return [
    new SolidPolygonLayer<PolygonDatum>({
      id: 'plane-floor',
      data: [
        floor,
      ],
      getPolygon: function getPolygon(d,) {
        return d.polygon;
      },
      getFillColor: COORDINATE_PLANE_COLOR,
      _full3d: true,
    },),
    new SolidPolygonLayer<PolygonDatum>({
      id: 'plane-back',
      data: [
        back,
      ],
      getPolygon: function getPolygon(d,) {
        return d.polygon;
      },
      getFillColor: COORDINATE_PLANE_COLOR,
      _full3d: true,
    },),
    new SolidPolygonLayer<PolygonDatum>({
      id: 'plane-side',
      data: [
        side,
      ],
      getPolygon: function getPolygon(d,) {
        return d.polygon;
      },
      getFillColor: COORDINATE_PLANE_COLOR,
      _full3d: true,
    },),
  ];
}

//endregion Coordinate planes

//region Threshold guide lines

/**
 * Builds a thin {@link PathLayer} drawing the three threshold guide
 * lines (300 SLOC, 365 days, 100KB) on the coordinate planes when
 * the relevant channel's dim mapping matches.
 *
 * @param bounds - Scene bounds.
 * @param dimMapping - Current dim mapping.
 *
 * @returns PathLayer with zero to three guide segments, or `null` if none qualify.
 */
export function buildThresholdLineLayer(
  {
    bounds,
    dimMapping,
  }: {
    bounds: SceneBounds;
    dimMapping: DimMapping;
  },
): Layer | null {
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
  ] = bounds.z;
  const segments: PathDatum[] = [];
  if (
    dimMapping.x === 'logSourceBytes'
    && SOURCE_BYTES_THRESHOLD > xMin
    && SOURCE_BYTES_THRESHOLD < xMax
  )
    segments.push({
      path: [
        [SOURCE_BYTES_THRESHOLD, yMin, zMin,],
        [SOURCE_BYTES_THRESHOLD, yMax, zMin,],
      ],
    },);
  if (
    dimMapping.y === 'logDaysStale'
    && DAYS_STALE_THRESHOLD > yMin
    && DAYS_STALE_THRESHOLD < yMax
  )
    segments.push({
      path: [
        [xMin, DAYS_STALE_THRESHOLD, zMin,],
        [xMax, DAYS_STALE_THRESHOLD, zMin,],
      ],
    },);
  if (
    dimMapping.z === 'logInstallSize'
    && INSTALL_SIZE_THRESHOLD > bounds.z[0]
    && INSTALL_SIZE_THRESHOLD < bounds.z[1]
  )
    segments.push({
      path: [
        [xMin, yMin, INSTALL_SIZE_THRESHOLD,],
        [xMax, yMin, INSTALL_SIZE_THRESHOLD,],
      ],
    },);
  if (segments.length === 0) return null;
  return new PathLayer<PathDatum>({
    id: 'threshold-guides',
    data: segments,
    getPath: function getPath(d,) {
      return d.path;
    },
    getColor: THRESHOLD_LINE_COLOR,
    getWidth: THRESHOLD_LINE_WIDTH,
    widthUnits: 'pixels',
    widthMinPixels: THRESHOLD_LINE_WIDTH,
  },);
}

//endregion Threshold guide lines
