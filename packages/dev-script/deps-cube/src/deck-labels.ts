/**
 * Text-layer factories — axis tip labels, axis dim subtitles, origin
 * marker, and per-glyph name labels.
 *
 * The axis-label rendering is split across **two** TextLayer
 * instances: one for the bold capital `X`/`Y`/`Z` letters that sit at
 * the arrow tips, another for the smaller dim-name subtitles. The
 * origin gets a single TextLayer with the character `O`. Per-glyph
 * name labels live in their own TextLayer too. Splitting by purpose
 * keeps font sizes, anchor strategies, and per-instance positions
 * independent — a single combined layer would have to compromise.
 *
 * Split out from `deck-layers.ts` to stay under the 300-line cap.
 *
 * @example
 * ```ts
 * import { buildAxisCapitalsLayer } from './deck-labels.ts';
 * const layer = buildAxisCapitalsLayer({ bounds });
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

/** Axis-tip capital-letter font size in pixels. Larger than subtitles for hierarchy. */
const TIP_LABEL_SIZE_PX = 24;
/** Axis dim-name subtitle font size in pixels. */
const SUBTITLE_LABEL_SIZE_PX = 12;
/** Origin marker font size in pixels. */
const ORIGIN_LABEL_SIZE_PX = 18;
/** Name-label font size in pixels. */
const NAME_LABEL_SIZE_PX = 11;
/** Maximum names to show when `nameLabels === 'topN'`. */
const TOP_N_NAMES = 10;
/** Half-coefficient used for centring helpers. */
const HALF = 1 / 2;

/** Axis label colour: near-black, high contrast against the light backdrop. */
const AXIS_LABEL_COLOR: readonly [number, number, number, number,] = [
  30,
  30,
  30,
  255,
];

/** Origin marker colour, slightly muted vs the axis labels. */
const ORIGIN_LABEL_COLOR: readonly [number, number, number, number,] = [
  80,
  80,
  80,
  255,
];

/** Name-label colour, dark enough to read on the light backdrop. */
const NAME_LABEL_COLOR: readonly [number, number, number, number,] = [
  50,
  50,
  50,
  255,
];

/** Label background tint — translucent white so labels stay readable against the green planes. */
const LABEL_BACKGROUND_COLOR: readonly [number, number, number, number,] = [
  250,
  250,
  250,
  220,
];

/** Fraction of the axis extent that the capital sits past the arrow tip. */
const TIP_LABEL_OFFSET_FRACTION = 0.18;
/** Fraction of the axis extent the dim-name subtitle sits inside the tip. */
const SUBTITLE_OFFSET_FRACTION = 0.08;
/** Fraction of the axis extent the origin label sits behind the min corner. */
const ORIGIN_OFFSET_FRACTION = 0.04;
/** Name-label vertical offset above each glyph, as a fraction of the y extent. */
const NAME_LABEL_OFFSET_FRACTION = 0.02;

//endregion Constants

//region Helpers

/**
 * Computes the per-axis extents shared by the layer factories.
 *
 * @param bounds - Scene bounds.
 *
 * @returns Object with min/max and delta for each axis.
 */
function axisExtents(
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
  return {
    xMin,
    yMin,
    zMin,
    xMax,
    yMax,
    zMax,
    dx: xMax - xMin,
    dy: yMax - yMin,
    dz: zMax - zMin,
  };
}

//endregion Helpers

//region Axis tip capitals

/**
 * Builds the bold `X` / `Y` / `Z` capital letters at the arrow tips.
 *
 * Centred on the position via `getTextAnchor: 'middle'` + the
 * `getAlignmentBaseline: 'center'` defaults so the capital sits
 * cleanly past the cone arrowhead.
 *
 * @param bounds - Scene bounds.
 *
 * @returns TextLayer with three capital-letter labels.
 */
export function buildAxisCapitalsLayer(
  { bounds, }: { bounds: SceneBounds; },
): Layer {
  const g = axisExtents({
    bounds,
  },);
  const offX = g.dx * TIP_LABEL_OFFSET_FRACTION;
  const offY = g.dy * TIP_LABEL_OFFSET_FRACTION;
  const offZ = g.dz * TIP_LABEL_OFFSET_FRACTION;
  const data: TextDatum[] = [
    {
      position: [g.xMax + offX, g.yMin, g.zMin,],
      text: 'X',
    },
    {
      position: [g.xMin, g.yMax + offY, g.zMin,],
      text: 'Y',
    },
    {
      position: [g.xMin, g.yMin, g.zMax + offZ,],
      text: 'Z',
    },
  ];
  return new TextLayer<TextDatum>({
    id: 'axis-capitals',
    data,
    getPosition: function getPosition(d,) {
      return d.position;
    },
    getText: function getText(d,) {
      return d.text;
    },
    getSize: TIP_LABEL_SIZE_PX,
    getColor: AXIS_LABEL_COLOR,
    sizeUnits: 'pixels',
    fontFamily: 'serif',
    getTextAnchor: 'middle',
    getAlignmentBaseline: 'center',
    background: true,
    getBackgroundColor: LABEL_BACKGROUND_COLOR,
  },);
}

//endregion Axis tip capitals

//region Axis dim-name subtitles

/**
 * Builds the smaller dim-name subtitle labels (`log10(source bytes)`,
 * etc.), drawn just inside each arrow tip along the axis line.
 *
 * @param bounds - Scene bounds.
 * @param dimMapping - Current dim mapping.
 *
 * @returns TextLayer with three subtitle labels.
 */
export function buildAxisSubtitlesLayer(
  {
    bounds,
    dimMapping,
  }: {
    bounds: SceneBounds;
    dimMapping: DimMapping;
  },
): Layer {
  const g = axisExtents({
    bounds,
  },);
  const offX = g.dx * SUBTITLE_OFFSET_FRACTION;
  const offY = g.dy * SUBTITLE_OFFSET_FRACTION;
  const offZ = g.dz * SUBTITLE_OFFSET_FRACTION;
  const data: TextDatum[] = [
    {
      position: [g.xMax - offX, g.yMin - offY * HALF, g.zMin,],
      text: DIM_DISPLAY_NAMES[dimMapping.x],
    },
    {
      position: [g.xMin - offX * HALF, g.yMax - offY, g.zMin,],
      text: DIM_DISPLAY_NAMES[dimMapping.y],
    },
    {
      position: [g.xMin, g.yMin - offY * HALF, g.zMax - offZ,],
      text: DIM_DISPLAY_NAMES[dimMapping.z],
    },
  ];
  return new TextLayer<TextDatum>({
    id: 'axis-subtitles',
    data,
    getPosition: function getPosition(d,) {
      return d.position;
    },
    getText: function getText(d,) {
      return d.text;
    },
    getSize: SUBTITLE_LABEL_SIZE_PX,
    getColor: AXIS_LABEL_COLOR,
    sizeUnits: 'pixels',
    fontFamily: 'monospace',
    getTextAnchor: 'middle',
    getAlignmentBaseline: 'center',
    background: true,
    getBackgroundColor: LABEL_BACKGROUND_COLOR,
  },);
}

//endregion Axis dim-name subtitles

//region Origin marker

/**
 * Builds the origin marker — a single `O` character at the min corner
 * of the data box, offset slightly into the back wall so it doesn't
 * collide with the axis shafts.
 *
 * @param bounds - Scene bounds.
 *
 * @returns TextLayer with one origin label.
 */
export function buildOriginLabelLayer(
  { bounds, }: { bounds: SceneBounds; },
): Layer {
  const g = axisExtents({
    bounds,
  },);
  const offX = g.dx * ORIGIN_OFFSET_FRACTION;
  const offY = g.dy * ORIGIN_OFFSET_FRACTION;
  const offZ = g.dz * ORIGIN_OFFSET_FRACTION;
  const data: TextDatum[] = [
    {
      position: [g.xMin - offX, g.yMin - offY, g.zMin - offZ,],
      text: 'O',
    },
  ];
  return new TextLayer<TextDatum>({
    id: 'origin-label',
    data,
    getPosition: function getPosition(d,) {
      return d.position;
    },
    getText: function getText(d,) {
      return d.text;
    },
    getSize: ORIGIN_LABEL_SIZE_PX,
    getColor: ORIGIN_LABEL_COLOR,
    sizeUnits: 'pixels',
    fontFamily: 'serif',
    getTextAnchor: 'middle',
    getAlignmentBaseline: 'center',
  },);
}

//endregion Origin marker

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
    bounds,
    visibleIndices,
  }: {
    probes: readonly PackageProbe[];
    state: AppState;
    bounds: SceneBounds;
    visibleIndices: ReadonlySet<number>;
  },
): Layer | null {
  const g = axisExtents({
    bounds,
  },);
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
  const nameOffset = g.dy * NAME_LABEL_OFFSET_FRACTION;
  const data: TextDatum[] = ranked.map(function asDatum({ probe, },) {
    const pos = probePosition({
      probe,
      state,
    },) ?? [0, 0, 0,];
    return {
      position: [
        pos[0],
        pos[1] + nameOffset,
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
    getTextAnchor: 'middle',
    getAlignmentBaseline: 'center',
  },);
}

//endregion Name labels
