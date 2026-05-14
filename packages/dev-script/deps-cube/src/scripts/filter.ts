/**
 * Pure visibility-mask computation for the deck.gl scene.
 *
 * Runs in the browser as part of the bundled controller script. Given the
 * full probe array, the seven 3-state boolean toggles, the per-channel
 * range sliders, the name search, and the current dim mapping, returns
 * the set of probe indices that should be drawn at full opacity (vs faded
 * to 5%).
 *
 * No imports from `node:*`: this module is bundled into the output HTML
 * and must run in the browser. Only the `PackageProbe` type is imported,
 * and types are erased by the bundler.
 *
 * @example
 * ```ts
 * const visible = computeVisibleIndices({
 *   probes,
 *   toggles: { isLeaf: 'any', tsMajority: 'no', ...rest },
 *   ranges: { x: [0, 6], y: [0, 4], z: [0, 8], color: [0, 1], shape: [0, 1], size: [0, 7] },
 *   search: '',
 *   dimMapping: { x: 'logSourceBytes', y: 'logDaysStale', z: 'logInstallSize', color: 'tsRatio', shape: 'isLeafNumeric', size: 'logDownloads' },
 * });
 * ```
 */

import type { PackageProbe, } from '../probe.ts';

//region Types

/**
 * Identifier for one of the seven 3-state boolean filter toggles.
 *
 * - `isLeaf`: package has no runtime deps
 * - `tsMajority`: TS ratio >= {@link TS_MAJORITY_THRESHOLD}
 * - `large`: source bytes >= {@link LARGE_SOURCE_BYTES_THRESHOLD}
 * - `recent`: days since last commit < {@link RECENT_DAYS_THRESHOLD}
 * - `permissive`: license class is `permissive`
 * - `copyleft`: license class is `copyleft`
 * - `hasKnownRepo`: every GH-derived attribute is known (`unknownReason === null`)
 */
export type ToggleKey =
  | 'isLeaf'
  | 'tsMajority'
  | 'large'
  | 'recent'
  | 'permissive'
  | 'copyleft'
  | 'hasKnownRepo';

/**
 * Three-state filter value: "don't care", "must be true", or "must be false".
 */
export type ToggleValue = 'any' | 'yes' | 'no';

/**
 * Aggregated state for every 3-state toggle.
 */
export type ToggleState = Record<ToggleKey, ToggleValue>;

/**
 * Identifier for one of the ten candidate data dimensions a channel can map
 * to. Channel-type compatibility is enforced by the dim-picker UI, not here.
 *
 * Continuous (log10 scale, with a floor at {@link LOG_FLOOR} to avoid
 * `-Infinity` for zero values):
 * - `logSourceBytes`, `logDaysStale`, `logInstallSize`, `logDownloads`, `logPackageAge`
 *
 * Continuous (linear): `tsRatio`, `runtimeDepCount`, `transitiveDepCount`
 *
 * Binary numeric: `isLeafNumeric` (0 = non-leaf, 1 = leaf)
 *
 * Categorical numeric: `licenseClassNumeric` (permissive=0, copyleft=1, non-oss=2, unknown=3)
 */
export type DataDimKey =
  | 'logSourceBytes'
  | 'logDaysStale'
  | 'logInstallSize'
  | 'logDownloads'
  | 'tsRatio'
  | 'runtimeDepCount'
  | 'transitiveDepCount'
  | 'logPackageAge'
  | 'isLeafNumeric'
  | 'licenseClassNumeric';

/**
 * Identifier for one of the six visual channels deck.gl draws on.
 */
export type ChannelKey = 'x' | 'y' | 'z' | 'color' | 'shape' | 'size';

/**
 * Current mapping of every channel to its data dimension.
 */
export type DimMapping = Record<ChannelKey, DataDimKey>;

/**
 * Per-channel range slider state, expressed in displayed-value units
 * (i.e. after log scaling for continuous dims).
 */
export type RangeState = Record<ChannelKey, readonly [number, number,]>;

//endregion Types

//region Constants

/** TS-majority cutoff used by the toggle: TS ratio >= this counts as TS-majority. */
const TS_MAJORITY_THRESHOLD = 0.95;
/** "Large" cutoff used by the toggle: source bytes >= this counts as large. */
const LARGE_SOURCE_BYTES_THRESHOLD = 10_000;
/** "Recent" cutoff used by the toggle: days since last commit < this counts as recent. */
const RECENT_DAYS_THRESHOLD = 365;
/** Floor used in log scaling; values <= floor map to `log10(floor)` to avoid `-Infinity`. */
const LOG_FLOOR = 1;
/** Numeric code for license classes; matches the `licenseClassNumeric` dim. */
const LICENSE_CODES: Record<PackageProbe['licenseClass'], number> = {
  permissive: 0,
  copyleft: 1,
  'non-oss': 2,
  unknown: 3,
};

//endregion Constants

//region Pure extractors

/**
 * Returns the displayed value of one probe along one data dimension.
 *
 * Continuous dims that span orders of magnitude are log10-scaled with a
 * floor of {@link LOG_FLOOR}. Unknown values (`*OrNull` fields that are
 * `null`) return `null` so callers can either filter the package out or
 * render it at a sentinel offset position.
 *
 * @param probe - Source probe.
 * @param dim - Data dimension to extract.
 *
 * @returns Numeric value, or `null` when the source field is unknown.
 *
 * @example
 * ```ts
 * const x = extractDim({ probe, dim: 'logSourceBytes' });
 * if (x === null) {
 *   // monorepo-housed or repo unavailable; render in Unknown cluster
 * }
 * ```
 */
export function extractDim(
  {
    probe,
    dim,
  }: {
    probe: PackageProbe;
    dim: DataDimKey;
  },
): number | null {
  if (dim === 'logSourceBytes') {
    if (probe.sourceBytesOrNull === null) return null;
    return Math.log10(Math.max(probe.sourceBytesOrNull, LOG_FLOOR,),);
  }
  if (dim === 'logDaysStale') {
    if (probe.daysSinceLastCommitOrNull === null) return null;
    return Math.log10(Math.max(probe.daysSinceLastCommitOrNull, LOG_FLOOR,),);
  }
  if (dim === 'logInstallSize') return Math.log10(Math.max(probe.installSizeBytes, LOG_FLOOR,),);
  if (dim === 'logDownloads') return Math.log10(Math.max(probe.weeklyDownloads, LOG_FLOOR,),);
  if (dim === 'tsRatio') return probe.tsRatioOrNull;
  if (dim === 'runtimeDepCount') return probe.runtimeDepCount;
  if (dim === 'transitiveDepCount') return probe.transitiveDepCount;
  if (dim === 'logPackageAge') return Math.log10(Math.max(probe.packageAgeDays, LOG_FLOOR,),);
  if (dim === 'isLeafNumeric') return probe.isLeaf ? 1 : 0;
  if (dim === 'licenseClassNumeric') return LICENSE_CODES[probe.licenseClass];
  throw new Error(`Unknown dim: ${dim as string}`,);
}

/**
 * Computes the value of one derived boolean attribute for a probe.
 *
 * Returns `null` for booleans that depend on unknown inputs (e.g.
 * `tsMajority` when `tsRatioOrNull` is `null`). The `hasKnownRepo`
 * derivation is always defined; it's the "no unknowns" predicate itself.
 *
 * @param probe - Source probe.
 * @param key - Toggle key.
 *
 * @returns Boolean value, or `null` when undetermined.
 *
 * @example
 * ```ts
 * const ts = derivedBool({ probe, key: 'tsMajority' });
 * // ts === null means TS ratio is unknown for this package
 * ```
 */
export function derivedBool(
  {
    probe,
    key,
  }: {
    probe: PackageProbe;
    key: ToggleKey;
  },
): boolean | null {
  if (key === 'isLeaf') return probe.isLeaf;
  if (key === 'tsMajority') {
    if (probe.tsRatioOrNull === null) return null;
    return probe.tsRatioOrNull >= TS_MAJORITY_THRESHOLD;
  }
  if (key === 'large') {
    if (probe.sourceBytesOrNull === null) return null;
    return probe.sourceBytesOrNull >= LARGE_SOURCE_BYTES_THRESHOLD;
  }
  if (key === 'recent') {
    if (probe.daysSinceLastCommitOrNull === null) return null;
    return probe.daysSinceLastCommitOrNull < RECENT_DAYS_THRESHOLD;
  }
  if (key === 'permissive') return probe.licenseClass === 'permissive';
  if (key === 'copyleft') return probe.licenseClass === 'copyleft';
  if (key === 'hasKnownRepo') return probe.unknownReason === null;
  throw new Error(`Unknown toggle key: ${key as string}`,);
}

//endregion Pure extractors

//region Predicates

/**
 * Tests whether a probe satisfies all 3-state toggle constraints.
 *
 * `'any'` matches everything; `'yes'` requires the derived bool to be `true`;
 * `'no'` requires `false`. Probes whose derived bool is `null` (unknown)
 * fail both `'yes'` and `'no'`: they're explicitly hidden until the user
 * sets the toggle back to `'any'`.
 *
 * @param probe - Probe being tested.
 * @param toggles - Current toggle state.
 *
 * @returns `true` if every toggle constraint is satisfied.
 *
 * @example
 * ```ts
 * passesToggles({
 *   probe,
 *   toggles: { isLeaf: 'yes', tsMajority: 'no', ...rest },
 * }); // true only when probe.isLeaf && !tsMajority(probe)
 * ```
 */
function passesToggles(
  {
    probe,
    toggles,
  }: {
    probe: PackageProbe;
    toggles: ToggleState;
  },
): boolean {
  /* oxlint-disable typescript-eslint/no-unsafe-type-assertion -- Object.entries() loses key type; cast narrows it back. */
  /** Key/value pairs from the toggle record, retyped so `passOne` sees the discriminated key. */
  const entries = Object.entries(toggles,) as readonly (readonly [ToggleKey, ToggleValue,])[];
  /* oxlint-enable typescript-eslint/no-unsafe-type-assertion */
  return entries.every(function passOne(
    [
      key,
      value,
    ],
  ) {
    if (value === 'any') return true;
    /** Concrete derived-boolean reading for the toggle; `null` means undetermined and fails both `'yes'` and `'no'`. */
    const actual = derivedBool({
      probe,
      key,
    },);
    if (actual === null) return false;
    return value === 'yes' ? actual : !actual;
  },);
}

/**
 * Tests whether a probe's value on each active channel is within bounds.
 *
 * Probes whose value is `null` on an active channel (unknown along that
 * dim) pass the range test: the range slider only constrains the known
 * extent, and a `null` value isn't on that scale. Use the `hasKnownRepo`
 * toggle (set to `'yes'`) to exclude partial-unknowns explicitly.
 *
 * Rationale: the default range state is `[data-min, data-max]` covering
 * every known value, so a strict-null-fails policy would hide every
 * partial-unknown on the initial "reset" view. The plan requires the
 * counter to read `N of N visible` after a reset; the Unknown cluster
 * is for *all-unknown* probes (rendered offset from the main box), not
 * for partial-unknowns (which still appear at their known coords with
 * a contrasting outline).
 *
 * @param probe - Probe being tested.
 * @param ranges - Per-channel `[min, max]` bounds.
 * @param dimMapping - Channel → data-dim mapping.
 *
 * @returns `true` if every channel's value is within bounds or unknown.
 */
function passesRanges(
  {
    probe,
    ranges,
    dimMapping,
  }: {
    probe: PackageProbe;
    ranges: RangeState;
    dimMapping: DimMapping;
  },
): boolean {
  /* oxlint-disable typescript-eslint/no-unsafe-type-assertion -- Object.keys() returns `string[]`; ChannelKey is the known set of keys. */
  /** Channel ids from the dim mapping, retyped so `passOne` sees `ChannelKey`. */
  const channels = Object.keys(dimMapping,) as readonly ChannelKey[];
  /* oxlint-enable typescript-eslint/no-unsafe-type-assertion */
  return channels.every(function passOne(channel,) {
    /** Data dim currently bound to this channel; used to read the probe's value. */
    const dim = dimMapping[channel];
    /** Lower and upper bounds of the channel's range slider, in displayed-value units. */
    const [
      min,
      max,
    ] = ranges[channel];
    /** Extracted dim reading for the probe; `null` skips the range constraint. */
    const value = extractDim({
      probe,
      dim,
    },);
    if (value === null) return true;
    return value >= min && value <= max;
  },);
}

/**
 * Tests whether a probe's npm name matches the search term.
 *
 * Empty string matches everything. A pattern starting with `/` and ending
 * in `/` is treated as a case-insensitive regex; otherwise plain
 * substring match (case-insensitive). Invalid regex falls back to
 * "no match" so an in-progress pattern doesn't crash the page.
 *
 * @param probe - Probe being tested.
 * @param search - Search term.
 *
 * @returns `true` if the name matches the term.
 *
 * @example
 * ```ts
 * searchMatches({ probe, search: 'etag' });             // true for "etag", "etag-fresh"
 * searchMatches({ probe, search: '/^\@anthropic-ai\\//' });  // true for "\@anthropic-ai/sdk"
 * ```
 */
export function searchMatches(
  {
    probe,
    search,
  }: {
    probe: PackageProbe;
    search: string;
  },
): boolean {
  if (search === '') return true;
  /** Lowercased npm name so the substring/regex test is case-insensitive. */
  const name = probe.npmName.toLowerCase();
  if (search.length >= 2 && search.startsWith('/',) && search.endsWith('/',)) {
    try {
      /** Regex parsed from the `/.../` delimiters; an invalid pattern is caught and falls back to "no match". */
      const pattern = new RegExp(search.slice(1, -1,), 'i',);
      return pattern.test(name,);
    } catch {
      return false;
    }
  }
  return name.includes(search.toLowerCase(),);
}

//endregion Predicates

//region Public API

/**
 * Returns the set of probe indices to render at full opacity.
 *
 * All filters compose conjunctively: a probe must pass every toggle, fall
 * within every active channel's range, and match the search term.
 * Filtered-out probes are not removed; the renderer fades them to 5%
 * opacity so the user retains spatial context.
 *
 * @param probes - Full probe array.
 * @param toggles - Current 3-state toggle settings.
 * @param ranges - Per-channel range-slider bounds.
 * @param search - Name-search term.
 * @param dimMapping - Channel → data-dim mapping.
 *
 * @returns Set of indices (into `probes`) for fully-visible probes.
 *
 * @example
 * ```ts
 * const visible = computeVisibleIndices({
 *   probes, toggles, ranges, search, dimMapping,
 * });
 * // In deck.gl accessor:
 * getFillColor: (_, { index }) =>
 *   visible.has(index) ? [r, g, b, 255] : [r, g, b, 13];
 * ```
 */
export function computeVisibleIndices(
  {
    probes,
    toggles,
    ranges,
    search,
    dimMapping,
  }: {
    probes: readonly PackageProbe[];
    toggles: ToggleState;
    ranges: RangeState;
    search: string;
    dimMapping: DimMapping;
  },
): Set<number> {
  return new Set(
    probes.flatMap(function toIndex(
      probe,
      index,
    ) {
      /** Conjunction of every filter check; only fully-passing probes contribute their index. */
      const ok = passesToggles({
        probe,
        toggles,
      },)
        && passesRanges({
          probe,
          ranges,
          dimMapping,
        },)
        && searchMatches({
          probe,
          search,
        },);
      return ok ? [index,] : [];
    },),
  );
}

//endregion Public API
