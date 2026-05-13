/**
 * Glyph mesh-layer factories.
 *
 * Probes are partitioned into three buckets — leaf, non-leaf, unknown
 * — based on the shape-channel accessor and unknown-reason flag. Each
 * bucket gets its own {@link SimpleMeshLayer} with a different mesh:
 * spheres for leaf and unknown, octahedra for non-leaf. The shape
 * distinction is geometric (sphere vs octahedron from every angle),
 * not a 2D fill/stroke difference; 2D `ScatterplotLayer` was the
 * previous implementation but its flat circles foreshortened into
 * ellipses at oblique camera angles.
 *
 * Geometries themselves live in {@link ./deck-geometries.ts} so each
 * layer file stays under the 300-line cap.
 *
 * @example
 * ```ts
 * import { buildLeafScatterLayer } from './deck-scatter.ts';
 * const layer = buildLeafScatterLayer({ probes, state, bounds, visibleIndices });
 * ```
 */

import type { Layer, } from '@deck.gl/core';
import { SimpleMeshLayer, } from '@deck.gl/mesh-layers';
import type { Geometry, } from '@luma.gl/engine';

import type { PackageProbe, } from './probe.ts';
import {
  probeFillColor,
  probeIsFilled,
  probePosition,
  probeRadiusWorld,
  unknownClusterPosition,
} from './deck-accessors.ts';
import type { SceneBounds, } from './deck-config.ts';
import {
  octahedronGeometry,
  sphereGeometry,
} from './deck-geometries.ts';
import type { AppState, } from './scripts/state.ts';

//region Types

/** Data shape passed to the mesh-layer `data` prop: probe + original-array index. */
type ScatterDatum = {
  probe: PackageProbe;
  originalIndex: number;
};

//endregion Types

//region Probe partitioning

/**
 * Splits the probe array into leaf / non-leaf / unknown buckets,
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
  leaf: readonly ScatterDatum[];
  nonLeaf: readonly ScatterDatum[];
  unknown: readonly ScatterDatum[];
} {
  const leaf: ScatterDatum[] = [];
  const nonLeaf: ScatterDatum[] = [];
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
      leaf.push({
        probe,
        originalIndex,
      },);
    else nonLeaf.push({
      probe,
      originalIndex,
    },);
  },);
  return {
    leaf,
    nonLeaf,
    unknown,
  };
}

//endregion Probe partitioning

//region Layer factories

/**
 * Builds the sphere mesh-layer for probes the shape channel marks as
 * leaf (filled-equivalent in the binary shape mapping) and whose
 * spatial dims are all known.
 *
 * @param probes - Full probe array.
 * @param state - Current state.
 * @param bounds - Scene bounds.
 * @param visibleIndices - Set of original indices that pass every filter.
 *
 * @returns SimpleMeshLayer with sphere mesh.
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
  const { leaf, } = partitionProbes({
    probes,
    state,
  },);
  return buildMeshScatter({
    id: 'scatter-leaf',
    data: leaf,
    state,
    bounds,
    visibleIndices,
    mesh: sphereGeometry,
  },);
}

/**
 * Builds the octahedron mesh-layer for probes the shape channel marks
 * as non-leaf.
 *
 * @param probes - Full probe array.
 * @param state - Current state.
 * @param bounds - Scene bounds.
 * @param visibleIndices - Set of original indices that pass every filter.
 *
 * @returns SimpleMeshLayer with octahedron mesh.
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
  const { nonLeaf, } = partitionProbes({
    probes,
    state,
  },);
  return buildMeshScatter({
    id: 'scatter-nonleaf',
    data: nonLeaf,
    state,
    bounds,
    visibleIndices,
    mesh: octahedronGeometry,
  },);
}

/**
 * Builds the Unknown-cluster sphere layer — probes with
 * `unknownReason !== null` or unknown spatial position. Placed at an
 * offset corner of the scene with stable per-index jitter.
 *
 * @param probes - Full probe array.
 * @param state - Current state.
 * @param bounds - Scene bounds.
 * @param visibleIndices - Set of original indices that pass every filter.
 *
 * @returns SimpleMeshLayer, or `null` when the bucket is empty.
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
  return new SimpleMeshLayer<ScatterDatum>({
    id: 'scatter-unknown',
    data: unknown,
    mesh: sphereGeometry,
    getPosition: function getPosition(d,) {
      return unknownClusterPosition({
        index: d.originalIndex,
        bounds,
      },);
    },
    getColor: function getColor(d,) {
      return probeFillColor({
        probe: d.probe,
        state,
        bounds,
        isVisible: visibleIndices.has(d.originalIndex,),
      },);
    },
    getScale: function getScale(d,) {
      const r = probeRadiusWorld({
        probe: d.probe,
        state,
        bounds,
      },);
      return [
        r,
        r,
        r,
      ] as const;
    },
    pickable: true,
  },);
}

/**
 * Internal: shared `SimpleMeshLayer` constructor for the leaf / non-leaf
 * scatter layers. Both share every prop except `id`, `data`, and `mesh`.
 *
 * @param id - Layer id.
 * @param data - Scatter data (probe + original index pairs).
 * @param state - Current state.
 * @param bounds - Scene bounds.
 * @param visibleIndices - Set of original indices that pass every filter.
 * @param mesh - The glyph mesh ({@link sphereGeometry} or {@link octahedronGeometry}).
 *
 * @returns SimpleMeshLayer instance.
 */
function buildMeshScatter(
  {
    id,
    data,
    state,
    bounds,
    visibleIndices,
    mesh,
  }: {
    id: string;
    data: readonly ScatterDatum[];
    state: AppState;
    bounds: SceneBounds;
    visibleIndices: ReadonlySet<number>;
    mesh: Geometry;
  },
): Layer {
  return new SimpleMeshLayer<ScatterDatum>({
    id,
    data,
    mesh,
    getPosition: function getPosition(d,) {
      const pos = probePosition({
        probe: d.probe,
        state,
      },);
      return pos ?? [0, 0, 0,];
    },
    getColor: function getColor(d,) {
      return probeFillColor({
        probe: d.probe,
        state,
        bounds,
        isVisible: visibleIndices.has(d.originalIndex,),
      },);
    },
    getScale: function getScale(d,) {
      const r = probeRadiusWorld({
        probe: d.probe,
        state,
        bounds,
      },);
      return [
        r,
        r,
        r,
      ] as const;
    },
    pickable: true,
  },);
}

//endregion Layer factories
