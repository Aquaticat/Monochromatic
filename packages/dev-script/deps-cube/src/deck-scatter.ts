/**
 * Scatter layer factories.
 *
 * Probes are partitioned into three buckets — filled, stroked,
 * unknown — based on the shape-channel accessor and unknown-reason
 * flag. Each bucket gets its own ScatterplotLayer with appropriate
 * fill/stroke and (for unknowns) a synthetic position computed by
 * {@link unknownClusterPosition} in `./deck-accessors.ts`.
 *
 * Split out from `deck-layers.ts` to stay under the 300-line cap.
 *
 * @example
 * ```ts
 * import { buildLeafScatterLayer } from './deck-scatter.ts';
 * const layer = buildLeafScatterLayer({ probes, state, bounds, visibleIndices });
 * ```
 */

import type { Layer, } from '@deck.gl/core';
import { ScatterplotLayer, } from '@deck.gl/layers';

import type { PackageProbe, } from './probe.ts';
import {
  probeFillColor,
  probeIsFilled,
  probePosition,
  probeRadius,
  unknownClusterPosition,
} from './deck-accessors.ts';
import type { SceneBounds, } from './deck-config.ts';
import type { AppState, } from './scripts/state.ts';

//region Types

/** Data shape passed to ScatterplotLayer's `data` prop: probe + original-array index. */
type ScatterDatum = {
  probe: PackageProbe;
  originalIndex: number;
};

//endregion Types

//region Constants

/** Line width for stroked glyphs, in pixels. */
const STROKE_LINE_WIDTH = 2;

/** Line colour for the unknown-cluster stroke; matches axis label tone. */
const UNKNOWN_STROKE_COLOR: readonly [number, number, number, number,] = [
  200,
  200,
  200,
  200,
];

//endregion Constants

//region Probe partitioning

/**
 * Splits the probe array into filled / stroked / unknown buckets,
 * preserving the original index of every probe so visibility lookups
 * stay accurate.
 *
 * @param probes - Full probe array.
 * @param state - Current state.
 *
 * @returns Three disjoint arrays.
 */
function partitionProbes(
  {
    probes,
    state,
  }: {
    probes: readonly PackageProbe[];
    state: AppState;
  },
): {
  filled: readonly ScatterDatum[];
  stroked: readonly ScatterDatum[];
  unknown: readonly ScatterDatum[];
} {
  const filled: ScatterDatum[] = [];
  const stroked: ScatterDatum[] = [];
  const unknown: ScatterDatum[] = [];
  probes.forEach(function bucket(
    probe,
    originalIndex,
  ) {
    if (probe.unknownReason !== null) {
      unknown.push({
        probe,
        originalIndex,
      },);
      return;
    }
    if (probePosition({
      probe,
      state,
    },) === null) {
      unknown.push({
        probe,
        originalIndex,
      },);
      return;
    }
    if (probeIsFilled({
      probe,
      state,
    },))
      filled.push({
        probe,
        originalIndex,
      },);
    else stroked.push({
      probe,
      originalIndex,
    },);
  },);
  return {
    filled,
    stroked,
    unknown,
  };
}

//endregion Probe partitioning

//region Layer factories

/**
 * Builds the filled-glyph scatter for probes the shape channel marks
 * as filled and whose spatial dims are all known.
 *
 * @param probes - Full probe array.
 * @param state - Current state.
 * @param bounds - Scene bounds.
 * @param visibleIndices - Set of original indices that pass every filter.
 *
 * @returns ScatterplotLayer.
 */
export function buildLeafScatterLayer(
  {
    probes,
    state,
    bounds,
    visibleIndices,
  }: {
    probes: readonly PackageProbe[];
    state: AppState;
    bounds: SceneBounds;
    visibleIndices: ReadonlySet<number>;
  },
): Layer {
  const { filled, } = partitionProbes({
    probes,
    state,
  },);
  return buildScatter({
    id: 'scatter-filled',
    data: filled,
    state,
    bounds,
    visibleIndices,
    filled: true,
  },);
}

/**
 * Builds the stroked-glyph scatter for probes the shape channel marks
 * as not-filled.
 *
 * @param probes - Full probe array.
 * @param state - Current state.
 * @param bounds - Scene bounds.
 * @param visibleIndices - Set of original indices that pass every filter.
 *
 * @returns ScatterplotLayer.
 */
export function buildNonLeafScatterLayer(
  {
    probes,
    state,
    bounds,
    visibleIndices,
  }: {
    probes: readonly PackageProbe[];
    state: AppState;
    bounds: SceneBounds;
    visibleIndices: ReadonlySet<number>;
  },
): Layer {
  const { stroked, } = partitionProbes({
    probes,
    state,
  },);
  return buildScatter({
    id: 'scatter-stroked',
    data: stroked,
    state,
    bounds,
    visibleIndices,
    filled: false,
  },);
}

/**
 * Builds the Unknown-cluster scatter — probes with
 * `unknownReason !== null` or unknown spatial position. Placed at an
 * offset corner of the scene with stable per-index jitter.
 *
 * @param probes - Full probe array.
 * @param state - Current state.
 * @param bounds - Scene bounds.
 * @param visibleIndices - Set of original indices that pass every filter.
 *
 * @returns ScatterplotLayer, or `null` when the bucket is empty.
 */
export function buildUnknownClusterLayer(
  {
    probes,
    state,
    bounds,
    visibleIndices,
  }: {
    probes: readonly PackageProbe[];
    state: AppState;
    bounds: SceneBounds;
    visibleIndices: ReadonlySet<number>;
  },
): Layer | null {
  const { unknown, } = partitionProbes({
    probes,
    state,
  },);
  if (unknown.length === 0) return null;
  return new ScatterplotLayer<ScatterDatum>({
    id: 'scatter-unknown',
    data: unknown,
    getPosition: function getPosition(d,) {
      return unknownClusterPosition({
        index: d.originalIndex,
        bounds,
      },);
    },
    getFillColor: function getFillColor(d,) {
      return probeFillColor({
        probe: d.probe,
        state,
        bounds,
        isVisible: visibleIndices.has(d.originalIndex,),
      },);
    },
    getRadius: function getRadius(d,) {
      return probeRadius({
        probe: d.probe,
        state,
        bounds,
      },);
    },
    radiusUnits: 'pixels',
    filled: true,
    stroked: true,
    lineWidthMinPixels: 1,
    getLineColor: UNKNOWN_STROKE_COLOR,
    pickable: true,
  },);
}

/**
 * Internal: shared ScatterplotLayer constructor for filled/stroked.
 *
 * @param id - Layer id.
 * @param data - Scatter data (probe + original index pairs).
 * @param state - Current state.
 * @param bounds - Scene bounds.
 * @param visibleIndices - Set of original indices that pass every filter.
 * @param filled - `true` for filled glyphs, `false` for hollow.
 *
 * @returns ScatterplotLayer.
 */
function buildScatter(
  {
    id,
    data,
    state,
    bounds,
    visibleIndices,
    filled,
  }: {
    id: string;
    data: readonly ScatterDatum[];
    state: AppState;
    bounds: SceneBounds;
    visibleIndices: ReadonlySet<number>;
    filled: boolean;
  },
): Layer {
  return new ScatterplotLayer<ScatterDatum>({
    id,
    data,
    getPosition: function getPosition(d,) {
      const pos = probePosition({
        probe: d.probe,
        state,
      },);
      return pos ?? [0, 0, 0,];
    },
    getFillColor: function getFillColor(d,) {
      return probeFillColor({
        probe: d.probe,
        state,
        bounds,
        isVisible: visibleIndices.has(d.originalIndex,),
      },);
    },
    getLineColor: function getLineColor(d,) {
      return probeFillColor({
        probe: d.probe,
        state,
        bounds,
        isVisible: visibleIndices.has(d.originalIndex,),
      },);
    },
    getRadius: function getRadius(d,) {
      return probeRadius({
        probe: d.probe,
        state,
        bounds,
      },);
    },
    radiusUnits: 'pixels',
    filled,
    stroked: !filled,
    lineWidthMinPixels: STROKE_LINE_WIDTH,
    pickable: true,
  },);
}

//endregion Layer factories
