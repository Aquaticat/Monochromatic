/**
 * Text-layer factories — axis labels and per-glyph name labels.
 *
 * Split out from `deck-layers.ts` to stay under the 300-line cap.
 *
 * @example
 * ```ts
 * import { buildAxisLabelsLayer } from './deck-labels.ts';
 * const layer = buildAxisLabelsLayer({ bounds, dimMapping: state.dimMapping });
 * ```
 */

import type { Layer, } from '@deck.gl/core';
import { TextLayer, } from '@deck.gl/layers';

import type { PackageProbe, } from './probe.ts';
import { probePosition, } from './deck-accessors.ts';
import type { SceneBounds, } from './deck-config.ts';
import { DIM_DISPLAY_NAMES, } from './dim-meta.ts';
import type { DimMapping, } from './scripts/filter.ts';
import type { AppState, } from './scripts/state.ts';

//region Types

/** Data shape for the TextLayer. */
type TextDatum = {
  position: [number, number, number,];
  text: string;
};

//endregion Types

//region Constants

/** Axis-label font size in pixels. */
const AXIS_LABEL_SIZE_PX = 14;
/** Name-label font size in pixels. */
const NAME_LABEL_SIZE_PX = 11;
/** Maximum names to show when `nameLabels === 'topN'`. */
const TOP_N_NAMES = 10;
/** Axis-label offset from the bounding box edge, in scene units. */
const AXIS_LABEL_OFFSET = 0.5;
/** Name-label vertical offset above each glyph, in scene units. */
const NAME_LABEL_OFFSET = 0.1;
/** Half-coefficient used for axis-label centring (just `(min + max) / 2`). */
const HALF = 1 / 2;

/** Axis-label colour, slightly muted white. */
const AXIS_LABEL_COLOR: readonly [number, number, number, number,] = [
  220,
  220,
  220,
  255,
];

/** Name-label colour, brighter than axis labels. */
const NAME_LABEL_COLOR: readonly [number, number, number, number,] = [
  240,
  240,
  240,
  255,
];

//endregion Constants

//region Axis labels

/**
 * Builds the axis-label TextLayer at the centre of each spatial axis.
 *
 * @param bounds - Scene bounds.
 * @param dimMapping - Current dim mapping (drives the label text).
 *
 * @returns TextLayer with three labels.
 */
export function buildAxisLabelsLayer(
  {
    bounds,
    dimMapping,
  }: {
    bounds: SceneBounds;
    dimMapping: DimMapping;
  },
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
  const data: TextDatum[] = [
    {
      position: [(xMin + xMax) * HALF, yMin - AXIS_LABEL_OFFSET, zMin,],
      text: `x: ${DIM_DISPLAY_NAMES[dimMapping.x]}`,
    },
    {
      position: [xMin - AXIS_LABEL_OFFSET, (yMin + yMax) * HALF, zMin,],
      text: `y: ${DIM_DISPLAY_NAMES[dimMapping.y]}`,
    },
    {
      position: [xMin, yMin - AXIS_LABEL_OFFSET, (zMin + zMax) * HALF,],
      text: `z: ${DIM_DISPLAY_NAMES[dimMapping.z]}`,
    },
  ];
  return new TextLayer<TextDatum>({
    id: 'axis-labels',
    data,
    getPosition: function getPosition(d,) {
      return d.position;
    },
    getText: function getText(d,) {
      return d.text;
    },
    getSize: AXIS_LABEL_SIZE_PX,
    getColor: AXIS_LABEL_COLOR,
    sizeUnits: 'pixels',
    fontFamily: 'monospace',
  },);
}

//endregion Axis labels

//region Name labels

/**
 * Builds the package-name labels TextLayer for either every visible
 * probe (`'all'`) or just the top-N by staleness (`'topN'`).
 *
 * Top-N ranking heuristic: descending by `daysSinceLastCommitOrNull`
 * (oldest first). Subject to refinement once the audit-target scoring
 * is formalised.
 *
 * @param probes - Full probe array.
 * @param state - Current state.
 * @param visibleIndices - Set of original indices that pass every filter.
 *
 * @returns TextLayer, or `null` if no probes qualify.
 */
export function buildNameLabelsLayer(
  {
    probes,
    state,
    visibleIndices,
  }: {
    probes: readonly PackageProbe[];
    state: AppState;
    bounds: SceneBounds;
    visibleIndices: ReadonlySet<number>;
  },
): Layer | null {
  const eligible = probes
    .map(function withIndex(
      probe,
      originalIndex,
    ) {
      return {
        probe,
        originalIndex,
      };
    },)
    .filter(function isShown({
      probe,
      originalIndex,
    },) {
      if (!visibleIndices.has(originalIndex,)) return false;
      if (probe.unknownReason !== null) return false;
      return probePosition({
        probe,
        state,
      },) !== null;
    },);
  const ranked = state.displayToggles.nameLabels === 'all'
    ? eligible
    : [...eligible,].sort(function byStale(
      a,
      b,
    ) {
      return (b.probe.daysSinceLastCommitOrNull ?? 0) - (a.probe.daysSinceLastCommitOrNull ?? 0);
    },).slice(0, TOP_N_NAMES,);
  if (ranked.length === 0) return null;
  const data: TextDatum[] = ranked.map(function asDatum({ probe, },) {
    const pos = probePosition({
      probe,
      state,
    },) ?? [0, 0, 0,];
    return {
      position: [
        pos[0],
        pos[1] + NAME_LABEL_OFFSET,
        pos[2],
      ],
      text: probe.npmName,
    };
  },);
  return new TextLayer<TextDatum>({
    id: 'name-labels',
    data,
    getPosition: function getPosition(d,) {
      return d.position;
    },
    getText: function getText(d,) {
      return d.text;
    },
    getSize: NAME_LABEL_SIZE_PX,
    getColor: NAME_LABEL_COLOR,
    sizeUnits: 'pixels',
    fontFamily: 'monospace',
  },);
}

//endregion Name labels
