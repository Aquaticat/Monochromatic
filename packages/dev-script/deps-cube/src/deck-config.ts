/**
 * Top-level deck.gl scene configuration.
 *
 * Bundled into the output HTML's runtime via Bun's bundler. Holds the
 * `OrbitView` instance, the data-driven scene bounds computation, and
 * the main {@link buildLayers} entry point that delegates to
 * {@link ./deck-layers.ts} factory functions. Per-probe accessors live
 * in {@link ./deck-accessors.ts}.
 *
 * @example
 * ```ts
 * import { orbitView, computeSceneBounds, buildLayers } from './deck-config.ts';
 * const bounds = computeSceneBounds({ probes, dimMapping: state.dimMapping });
 * const layers = buildLayers({ probes, state, visibleIndices, bounds });
 * new Deck({ views: [orbitView], layers, ... });
 * ```
 */

import {
  type Layer,
  OrbitView,
} from '@deck.gl/core';

import type { PackageProbe, } from './probe.ts';
import {
  buildAxisLabelsLayer,
  buildNameLabelsLayer,
} from './deck-labels.ts';
import {
  buildThresholdPlaneLayers,
  buildWireframeLayer,
} from './deck-layers.ts';
import {
  buildLeafScatterLayer,
  buildNonLeafScatterLayer,
  buildUnknownClusterLayer,
} from './deck-scatter.ts';
import {
  type ChannelKey,
  type DimMapping,
  extractDim,
} from './scripts/filter.ts';
import type { AppState, } from './scripts/state.ts';

//region Types

/**
 * Inclusive min/max bounds along every channel, computed once per render
 * from the current dim mapping. Drives axis labels, color normalisation,
 * the wireframe extent, and the Unknown-cluster offset position.
 */
export type SceneBounds = Record<ChannelKey, readonly [number, number,]>;

//endregion Types

//region Constants

/** Channel keys, fixed order for iteration. */
const CHANNEL_KEYS: readonly ChannelKey[] = [
  'x',
  'y',
  'z',
  'color',
  'shape',
  'size',
];

/** Camera FOV in degrees; OrbitView default is 50. */
const CAMERA_FOVY = 50;

/** Fallback extent when a channel has no known values across the probe set. */
const FALLBACK_EXTENT: readonly [number, number,] = [0, 1,];

//endregion Constants

//region Camera

/**
 * Shared OrbitView instance. Drag rotates, shift-drag pans, scroll zooms.
 * The `orbitAxis: 'Y'` setting matches the convention where y is "up".
 */
export const orbitView: OrbitView = new OrbitView({
  orbitAxis: 'Y',
  fovy: CAMERA_FOVY,
},);

//endregion Camera

//region Bounds

/**
 * Computes inclusive `[min, max]` bounds for every channel given the
 * current dim mapping. Unknowns (`extractDim` returning `null`) are
 * skipped. Channels with zero known values fall back to {@link FALLBACK_EXTENT}.
 *
 * Run on every render so dim swaps reflow the camera + axis labels.
 *
 * @param probes - Full probe array.
 * @param dimMapping - Current channel → data-dim mapping.
 *
 * @returns Bounds per channel.
 *
 * @example
 * ```ts
 * const bounds = computeSceneBounds({ probes, dimMapping });
 * // bounds.x === [0, 5.13] for log10 source bytes
 * ```
 */
export function computeSceneBounds(
  {
    probes,
    dimMapping,
  }: {
    probes: readonly PackageProbe[];
    dimMapping: DimMapping;
  },
): SceneBounds {
  const entries = CHANNEL_KEYS.map(function extentFor(channel,) {
    const values = probes
      .map(function pluck(probe,) {
        return extractDim({
          probe,
          dim: dimMapping[channel],
        },);
      },)
      .filter(function nonNull(value,): value is number {
        return value !== null;
      },);
    if (values.length === 0)
      return [
        channel,
        FALLBACK_EXTENT,
      ] as const;
    return [
      channel,
      [
        Math.min(...values,),
        Math.max(...values,),
      ] as const,
    ] as const;
  },);
  const record = Object.fromEntries(entries,);
  // oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion -- entries exhaust ChannelKey; Object.fromEntries widens to Record<string, V>.
  return record as SceneBounds;
}

//endregion Bounds

//region Public API

/**
 * Assembles the deck.gl scene layers for the current state.
 *
 * Layer order (back-to-front): wireframe, threshold planes, unknown
 * cluster, leaf scatter, non-leaf scatter, axis labels, name labels.
 * Display-toggles skip individual layers; `null` returns from factories
 * (e.g. empty unknown cluster) are filtered out.
 *
 * @param probes - Full probe array.
 * @param state - Current `AppState`.
 * @param visibleIndices - Probes that pass every filter; others fade to 5% alpha.
 * @param bounds - Output of {@link computeSceneBounds}.
 *
 * @returns Array of deck.gl `Layer` instances ready for `new Deck({ layers })`.
 *
 * @example
 * ```ts
 * deck.setProps({ layers: buildLayers({ probes, state, visibleIndices, bounds }) });
 * ```
 */
export function buildLayers(
  {
    probes,
    state,
    visibleIndices,
    bounds,
  }: {
    probes: readonly PackageProbe[];
    state: AppState;
    visibleIndices: ReadonlySet<number>;
    bounds: SceneBounds;
  },
): readonly Layer[] {
  const unknownCluster = state.displayToggles.showUnknownCluster
    ? buildUnknownClusterLayer({
      probes,
      state,
      bounds,
      visibleIndices,
    },)
    : null;
  const nameLabels = state.displayToggles.nameLabels === 'none' ? null : buildNameLabelsLayer({
    probes,
    state,
    bounds,
    visibleIndices,
  },);
  const groups: readonly (readonly Layer[])[] = [
    state.displayToggles.showWireframe
      ? [
        buildWireframeLayer({
          bounds,
        },),
      ]
      : [],
    state.displayToggles.showThresholdPlanes
      ? buildThresholdPlaneLayers({
        bounds,
        dimMapping: state.dimMapping,
      },)
      : [],
    unknownCluster === null ? [] : [unknownCluster,],
    [
      buildLeafScatterLayer({
        probes,
        state,
        bounds,
        visibleIndices,
      },),
    ],
    [
      buildNonLeafScatterLayer({
        probes,
        state,
        bounds,
        visibleIndices,
      },),
    ],
    state.displayToggles.showAxisLabels
      ? [
        buildAxisLabelsLayer({
          bounds,
          dimMapping: state.dimMapping,
        },),
      ]
      : [],
    nameLabels === null ? [] : [nameLabels,],
  ];
  return groups.flat();
}

//endregion Public API
