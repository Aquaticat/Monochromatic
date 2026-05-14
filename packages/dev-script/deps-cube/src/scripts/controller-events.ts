/**
 * Event-wiring functions for the deck.gl scene controller.
 *
 * One `wire*` function per control surface (dim dropdowns, 3-state
 * toggles, range sliders, name search, display toggles, reset button).
 * Each one attaches DOM event listeners that mutate the shared
 * {@link Session}'s state in place and call `commit` to recompute the
 * visibility mask, re-render layers, and sync the URL hash.
 *
 * Pure event wiring: no Deck construction, no bootstrap.
 *
 * @example
 * ```ts
 * import { wireDimDropdowns, wireToggles } from './controller-events.ts';
 * wireDimDropdowns({ session, probes, commit });
 * wireToggles({ session, probes, commit });
 * ```
 */

import type { PackageProbe, } from '../probe.ts';
import {
  computeSceneBounds,
  type SceneBounds,
} from '../deck-config.ts';
import {
  el,
  elInput,
  elSelect,
  syncDomFromState,
} from './controller-dom.ts';
import { unpinTooltip, } from './controller-tooltip.ts';
import {
  type ChannelKey,
  type DataDimKey,
  extractDim,
  type ToggleKey,
  type ToggleValue,
} from './filter.ts';
import {
  type AppState,
  defaultState,
  TOGGLE_KEYS,
} from './state.ts';

//region Types

/**
 * Mutable session view used by the wire functions. The full
 * controller-side session in `./controller.ts` carries an additional
 * `deck` field that the events module doesn't need to touch; leaving
 * it out here means a Session value from `./controller.ts` is
 * structurally assignable to this type with no cast.
 */
export type Session = {
  state: AppState;
  bounds: SceneBounds;
  visibleIndices: ReadonlySet<number>;
};

/**
 * Callback invoked by every wire function after a state mutation; the
 * concrete implementation lives in `./controller.ts` and closes over
 * the full session + probe array.
 */
export type Commit = () => void;

//endregion Types

//region Constants

/** Channel keys, fixed order. */
const CHANNEL_KEYS: readonly ChannelKey[] = [
  'x',
  'y',
  'z',
  'color',
  'shape',
  'size',
];

/** Valid data-dim keys for dropdown-value validation. */
const DIM_KEYS: readonly DataDimKey[] = [
  'logSourceBytes',
  'logDaysStale',
  'logInstallSize',
  'logDownloads',
  'tsRatio',
  'runtimeDepCount',
  'transitiveDepCount',
  'logPackageAge',
  'isLeafNumeric',
  'licenseClassNumeric',
];

/** Valid toggle values for radio-input validation. */
const TOGGLE_VALUES: readonly ToggleValue[] = [
  'any',
  'yes',
  'no',
];

//endregion Constants

//region Helpers

/**
 * Computes the inclusive `[min, max]` extent across the probe array for
 * one data dim, skipping unknowns.
 *
 * @param probes - Source probes.
 * @param dim - Dim whose extent to compute.
 *
 * @returns Inclusive `[min, max]` bounds, or `[0, 0]` if no probe has a known value.
 */
function computeRangeExtent(
  {
    probes,
    dim,
  }: {
    probes: readonly PackageProbe[];
    dim: DataDimKey;
  },
): readonly [number, number,] {
  const values = probes
    .map(function pluck(probe,) {
      return extractDim({
        probe,
        dim,
      },);
    },)
    .filter(function nonNull(value,): value is number {
      return value !== null;
    },);
  if (values.length === 0) return [0, 0,];
  return [
    Math.min(...values,),
    Math.max(...values,),
  ];
}

//endregion Helpers

//region Wire functions

/**
 * Wires the six dim dropdowns. Changing a dim resets that channel's
 * range slider to the new dim's extent (the old bounds are in the old
 * dim's units and become meaningless) and recomputes scene bounds.
 *
 * @param session - Mutable session.
 * @param probes - Source probes.
 * @param commit - Callback that re-renders + syncs hash.
 */
export function wireDimDropdowns(
  {
    session,
    probes,
    commit,
  }: {
    session: Session;
    probes: readonly PackageProbe[];
    commit: Commit;
  },
): void {
  CHANNEL_KEYS.forEach(function bind(channel,) {
    const select = elSelect(`dim-${channel}`,);
    select.addEventListener('change', function onChange() {
      const raw = select.value;
      const nextDim = DIM_KEYS.find(function match(candidate,) {
        return candidate === raw;
      },);
      if (nextDim === undefined) return;
      session.state.dimMapping[channel] = nextDim;
      const extent = computeRangeExtent({
        probes,
        dim: nextDim,
      },);
      session.state.ranges[channel] = extent;
      const minSlider = elInput(`range-${channel}-min`,);
      const maxSlider = elInput(`range-${channel}-max`,);
      minSlider.min = extent[0].toString();
      minSlider.max = extent[1].toString();
      minSlider.value = extent[0].toString();
      maxSlider.min = extent[0].toString();
      maxSlider.max = extent[1].toString();
      maxSlider.value = extent[1].toString();
      session.bounds = computeSceneBounds({
        probes,
        dimMapping: session.state.dimMapping,
      },);
      commit();
    },);
  },);
}

/**
 * Wires the seven 3-state toggle radio groups. Radios share a
 * `name="toggle-<key>"` so the browser handles mutual exclusion; we
 * listen on a `change` event at the fieldset level.
 *
 * @param session - Mutable session.
 * @param commit - Callback that re-renders + syncs hash.
 */
export function wireToggles(
  {
    session,
    commit,
  }: {
    session: Session;
    commit: Commit;
  },
): void {
  TOGGLE_KEYS.forEach(function bind(key: ToggleKey,) {
    const fieldset = document.querySelector<HTMLFieldSetElement>(`[data-toggle="${key}"]`,);
    if (fieldset === null) return;
    fieldset.addEventListener('change', function onChange(event,) {
      const input = event.target;
      if (!(input instanceof HTMLInputElement)) return;
      const next = TOGGLE_VALUES.find(function match(candidate,) {
        return candidate === input.value;
      },);
      if (next === undefined) return;
      session.state.toggles[key] = next;
      commit();
    },);
  },);
}

/**
 * Wires the six min/max slider pairs. Live `input` events update the
 * mask immediately for snappy filtering; we don't debounce because the
 * mask is O(probes).
 *
 * @param session - Mutable session.
 * @param commit - Callback that re-renders + syncs hash.
 */
export function wireRanges(
  {
    session,
    commit,
  }: {
    session: Session;
    commit: Commit;
  },
): void {
  CHANNEL_KEYS.forEach(function bind(channel,) {
    const minSlider = elInput(`range-${channel}-min`,);
    const maxSlider = elInput(`range-${channel}-max`,);
    /**
     * Common handler bound to both sliders' `input` event. Normalises
     * the order so swapping past each other yields a valid range
     * rather than an inverted (and silently empty) one.
     */
    function onInput(): void {
      const minVal = Number.parseFloat(minSlider.value,);
      const maxVal = Number.parseFloat(maxSlider.value,);
      session.state.ranges[channel] = minVal <= maxVal ? [minVal, maxVal,] : [maxVal, minVal,];
      commit();
    }
    minSlider.addEventListener('input', onInput,);
    maxSlider.addEventListener('input', onInput,);
  },);
}

/**
 * Wires the name-search input. Live `input` events update the mask on
 * every keystroke; invalid regexes are absorbed by `searchMatches` and
 * yield zero matches rather than crashing the page.
 *
 * @param session - Mutable session.
 * @param commit - Callback that re-renders + syncs hash.
 */
export function wireSearch(
  {
    session,
    commit,
  }: {
    session: Session;
    commit: Commit;
  },
): void {
  const input = elInput('search',);
  input.addEventListener('input', function onInput() {
    session.state.search = input.value;
    commit();
  },);
}

/**
 * Wires the four display checkboxes plus the `name-labels` select.
 * Each change triggers a full layer rebuild via `commit`.
 *
 * @param session - Mutable session.
 * @param commit - Callback that re-renders + syncs hash.
 */
export function wireDisplay(
  {
    session,
    commit,
  }: {
    session: Session;
    commit: Commit;
  },
): void {
  /**
   * Binds one checkbox to its display-toggles key. Closes over
   * `session` + `commit` from the enclosing wire function.
   *
   * @param id - Element id of the checkbox.
   * @param key - Which display-toggles boolean the checkbox controls.
   */
  function bindCheckbox(
    {
      id,
      key,
    }: {
      id: string;
      key: 'showWireframe' | 'showThresholdPlanes' | 'showAxisLabels' | 'showUnknownCluster';
    },
  ): void {
    const input = elInput(id,);
    input.addEventListener('change', function onChange() {
      session.state.displayToggles[key] = input.checked;
      commit();
    },);
  }
  bindCheckbox({
    id: 'display-wireframe',
    key: 'showWireframe',
  },);
  bindCheckbox({
    id: 'display-planes',
    key: 'showThresholdPlanes',
  },);
  bindCheckbox({
    id: 'display-axis-labels',
    key: 'showAxisLabels',
  },);
  bindCheckbox({
    id: 'display-unknown',
    key: 'showUnknownCluster',
  },);
  const nameLabels = elSelect('name-labels',);
  nameLabels.addEventListener('change', function onChange() {
    const raw = nameLabels.value;
    if (raw !== 'none' && raw !== 'topN' && raw !== 'all') return;
    session.state.displayToggles.nameLabels = raw;
    commit();
  },);
}

/**
 * Wires the reset button to restore `defaultState({ probes })`. After
 * the state swap, every control's DOM value is re-synced.
 *
 * @param session - Mutable session.
 * @param probes - Source probes.
 * @param commit - Callback that re-renders + syncs hash.
 */
export function wireReset(
  {
    session,
    probes,
    commit,
  }: {
    session: Session;
    probes: readonly PackageProbe[];
    commit: Commit;
  },
): void {
  const button = el('reset',);
  button.addEventListener('click', function onClick() {
    const next = defaultState({
      probes,
    },);
    session.state = next;
    session.bounds = computeSceneBounds({
      probes,
      dimMapping: next.dimMapping,
    },);
    syncDomFromState({
      state: next,
    },);
    unpinTooltip();
    commit();
  },);
}

//endregion Wire functions
