/**
 * DOM-access helpers + initial-value sync for the controller.
 *
 * Three typed accessors ({@link el}, {@link elInput}, {@link elSelect})
 * narrow `document.getElementById` results via `instanceof` checks so
 * downstream call sites don't need `as` casts; {@link syncDomFromState}
 * pushes every value from an {@link AppState} into the corresponding
 * control element, used after wholesale state swaps (reset button,
 * URL-hash restore).
 *
 * Browser-only: relies on `document` / `window` / `HTMLInputElement`.
 *
 * @example
 * ```ts
 * import { elInput, syncDomFromState } from './controller-dom.ts';
 * elInput('search').value = 'etag';
 * syncDomFromState({ state: nextState });
 * ```
 */

import type {
  ChannelKey,
  ToggleKey,
} from './filter.ts';
import {
  type AppState,
  TOGGLE_KEYS,
} from './state.ts';

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

//endregion Constants

//region Typed accessors

/**
 * Resolves an element by id, throwing if absent. The control panel's
 * IDs are generated statically by `../render-controls.ts`, so a missing
 * element is a programming error and must surface loudly.
 *
 * @param id - Element id.
 *
 * @returns Element typed as `HTMLElement`.
 *
 * @throws When the element is absent from the DOM.
 */
export function el(id: string,): HTMLElement {
  const node = document.getElementById(id,);
  if (node === null) throw new Error(`Control element #${id} missing from DOM`,);
  return node;
}

/**
 * Resolves an `<input>` element by id, narrowing via `instanceof`.
 *
 * @param id - Element id.
 *
 * @returns Element typed as `HTMLInputElement`.
 *
 * @throws When the element is absent or not an `<input>`.
 */
export function elInput(id: string,): HTMLInputElement {
  const node = el(id,);
  if (!(node instanceof HTMLInputElement)) throw new Error(`Control element #${id} is not an <input>`,);
  return node;
}

/**
 * Resolves a `<select>` element by id, narrowing via `instanceof`.
 *
 * @param id - Element id.
 *
 * @returns Element typed as `HTMLSelectElement`.
 *
 * @throws When the element is absent or not a `<select>`.
 */
export function elSelect(id: string,): HTMLSelectElement {
  const node = el(id,);
  if (!(node instanceof HTMLSelectElement)) throw new Error(`Control element #${id} is not a <select>`,);
  return node;
}

//endregion Typed accessors

//region State → DOM sync

/**
 * Pushes every value from `state` into the corresponding control
 * element. Used after a wholesale state swap (reset button, URL-hash
 * overwrite) so the on-screen controls reflect the new state.
 *
 * Per-channel updates: dim dropdown + slider values. Per-toggle: radio
 * input checked. Search input, display checkboxes, name-labels select.
 *
 * @param state - State whose values to write into the DOM.
 */
export function syncDomFromState(
  { state, }: { state: AppState; },
): void {
  CHANNEL_KEYS.forEach(function syncDim(channel,) {
    elSelect(`dim-${channel}`,).value = state.dimMapping[channel];
    const [
      lo,
      hi,
    ] = state.ranges[channel];
    elInput(`range-${channel}-min`,).value = lo.toString();
    elInput(`range-${channel}-max`,).value = hi.toString();
  },);
  TOGGLE_KEYS.forEach(function syncToggle(key: ToggleKey,) {
    const value = state.toggles[key];
    const radio = document.querySelector<HTMLInputElement>(`input[name="toggle-${key}"][value="${value}"]`,);
    if (radio !== null) radio.checked = true;
  },);
  elInput('search',).value = state.search;
  elInput('display-wireframe',).checked = state.displayToggles.showWireframe;
  elInput('display-planes',).checked = state.displayToggles.showThresholdPlanes;
  elInput('display-axis-labels',).checked = state.displayToggles.showAxisLabels;
  elInput('display-unknown',).checked = state.displayToggles.showUnknownCluster;
  elSelect('name-labels',).value = state.displayToggles.nameLabels;
}

//endregion State → DOM sync
