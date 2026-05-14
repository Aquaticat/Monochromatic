/**
 * Browser-side runtime entry point.
 *
 * Bundled into the output HTML by `../render-html.ts` via `Bun.build`
 * (`format: 'iife'`, `minify: true`) and executed once the DOM has
 * loaded. Reads the embedded `window.__PROBES__` global injected by the
 * HTML composer, instantiates a deck.gl `Deck` with the
 * {@link ../deck-config.ts#orbitView OrbitView}, delegates control
 * wiring to {@link ./controller-events.ts}, and keeps the URL hash
 * synced so the user can copy and share an exact view.
 *
 * No `let` at module root or function-body root: the controller's
 * mutable view of the world lives on a single `const session` object
 * that's mutated in place (the binding is `const`; its fields are not).
 *
 * @example
 * ```ts
 * // Bundled by Bun, no manual invocation.
 * ```
 */

import {
  Deck,
  type OrbitView,
  type PickingInfo,
} from '@deck.gl/core';

import type { PackageProbe, } from '../probe.ts';
import {
  buildLayers,
  computeSceneBounds,
  orbitView,
  type SceneBounds,
} from '../deck-config.ts';
import { syncDomFromState, } from './controller-dom.ts';
import {
  wireDimDropdowns,
  wireDisplay,
  wireRanges,
  wireReset,
  wireSearch,
  wireToggles,
} from './controller-events.ts';
import {
  formatTooltipHtml,
  pinTooltip,
  unpinTooltip,
} from './controller-tooltip.ts';
import { computeVisibleIndices, } from './filter.ts';
import {
  type ChromeColors,
  detectScheme,
} from './scheme.ts';
import {
  type AppState,
  defaultState,
  readStateFromHash,
  writeStateToHash,
} from './state.ts';

//region Globals

declare global {
  /* oxlint-disable typescript-eslint/consistent-type-definitions -- global declaration merging requires `interface`, not `type`. */
  /**
   * Augmentation of the `Window` global so TypeScript sees the data
   * literal injected by `../render-html.ts` at HTML-composition time.
   */
  interface Window {
    /** Probe array embedded by `render-html.ts` as a JS literal. */
    __PROBES__?: readonly PackageProbe[];
  }
  /* oxlint-enable typescript-eslint/consistent-type-definitions */
}

//endregion Globals

//region Types

/** Mutable working state of the controller. The binding is `const`. */
type Session = {
  state: AppState;
  bounds: SceneBounds;
  visibleIndices: ReadonlySet<number>;
  chrome: ChromeColors;
  deck: Deck<OrbitView>;
};

//endregion Types

//region Helpers

/**
 * Reads the embedded probe array from the global injected by
 * `render-html.ts`. Throws if absent so a broken bundling step
 * surfaces loudly instead of silently rendering an empty scene.
 *
 * @returns Probe array from `window.__PROBES__`.
 *
 * @throws When `window.__PROBES__` was not injected.
 */
function getProbes(): readonly PackageProbe[] {
  /** Probe array injected onto `window` by `render-html.ts`; `undefined` signals a broken bundle. */
  const probes = window.__PROBES__;
  if (probes === undefined) throw new Error('window.__PROBES__ not injected; check render-html.ts',);
  return probes;
}

/**
 * Extracts the probe payload from a deck.gl picking-info object, or
 * returns `null` when nothing was picked or the picked datum lacks the
 * `.probe` field. `info.object` is typed `any` by deck.gl; the cast
 * is justified because we own the layer-data contract.
 *
 * @param info - deck.gl picking info.
 *
 * @returns The picked probe, or `null` when no probe is under the cursor.
 */
function pickedProbe(info: PickingInfo,): PackageProbe | null {
  if (info.object === undefined || info.object === null) return null;
  if (typeof info.object !== 'object') return null;
  if (!('probe' in info.object)) return null;
  // oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion -- ScatterplotLayer is fed ScatterDatum from layer factories; .probe is always a PackageProbe.
  return info.object.probe as PackageProbe;
}

//endregion Helpers

//region Render path

/**
 * Recomputes `visibleIndices` from the current state, updates the
 * visibility counter, and writes the result back into the session.
 *
 * @param session - Mutable session.
 * @param probes - Source probes.
 */
function recomputeVisibility(
  {
    session,
    probes,
  }: {
    session: Session;
    probes: readonly PackageProbe[];
  },
): void {
  session.visibleIndices = computeVisibleIndices({
    probes,
    toggles: session.state.toggles,
    ranges: session.state.ranges,
    search: session.state.search,
    dimMapping: session.state.dimMapping,
  },);
  /** Counter element under the canvas; missing in tests / partial pages, so we no-op when absent. */
  const counter = document.getElementById('visibility-counter',);
  if (counter !== null) counter.textContent = `${session.visibleIndices.size.toString()} of ${probes.length.toString()} visible`;
}

/**
 * Pushes the freshly-built layer list into the live `Deck` via
 * `setProps`.
 *
 * @param session - Mutable session.
 * @param probes - Source probes.
 */
function rerenderLayers(
  {
    session,
    probes,
  }: {
    session: Session;
    probes: readonly PackageProbe[];
  },
): void {
  /** Layer list rebuilt from current session inputs; pushed to `Deck` via `setProps`. */
  const layers = buildLayers({
    probes,
    state: session.state,
    visibleIndices: session.visibleIndices,
    bounds: session.bounds,
    chrome: session.chrome,
  },);
  session.deck.setProps({
    layers: [...layers,],
  },);
}

/**
 * Serialises the current state into the URL hash via
 * `history.replaceState` so the back stack stays clean.
 *
 * @param session - Source session.
 */
function syncHash(
  { session, }: { session: Session; },
): void {
  history.replaceState(null, '', writeStateToHash({
    state: session.state,
  },),);
}

//endregion Render path

//region Picking

/**
 * Builds the `getTooltip` payload for the deck.gl tooltip widget.
 *
 * @param info - deck.gl picking info.
 *
 * @returns `{ html }` for hovered probes, `null` otherwise.
 */
function getTooltipForInfo(info: PickingInfo,): { html: string; } | null {
  /** Probe under the cursor, or `null` for hover-over-empty-space. */
  const probe = pickedProbe(info,);
  if (probe === null) return null;
  return {
    html: formatTooltipHtml({
      probe,
    },),
  };
}

/**
 * `onClick` handler; pins a tooltip beside the canvas, or unpins it
 * when the click misses every glyph.
 *
 * @param info - deck.gl picking info.
 */
function onCanvasClick(info: PickingInfo,): void {
  /** Probe under the click, or `null` for miss-clicks that should unpin instead of pin. */
  const probe = pickedProbe(info,);
  if (probe === null) {
    unpinTooltip();
    return;
  }
  pinTooltip({
    probe,
  },);
}

//endregion Picking

//region Bootstrap

/**
 * Builds the initial `Session` from the embedded probes + URL hash.
 *
 * `onViewStateChange` is wired via `deck.setProps` after the session
 * is created so the closure can capture the post-declaration binding
 * without a forward reference.
 *
 * @param probes - Probe array from `window.__PROBES__`.
 *
 * @returns Hydrated session ready for event wiring.
 */
function createSession(
  { probes, }: { probes: readonly PackageProbe[]; },
): Session {
  /** Initial `AppState`; uses any bookmarked URL hash, otherwise falls back to the data-driven defaults. */
  const initial = readStateFromHash({
    hash: window.location.hash,
    fallback: defaultState({
      probes,
    },),
  },);
  /** Per-channel data extents used by every layer factory; recomputed only when the dim mapping changes. */
  const bounds = computeSceneBounds({
    probes,
    dimMapping: initial.dimMapping,
  },);
  /** Set of probe indices that pass the initial filter combination; drives full-vs-faded opacity. */
  const visibleIndices = computeVisibleIndices({
    probes,
    toggles: initial.toggles,
    ranges: initial.ranges,
    search: initial.search,
    dimMapping: initial.dimMapping,
  },);
  /** Current light/dark scheme snapshot; passed through to layer factories for colour selection. */
  const chrome = detectScheme();
  /** deck.gl `Deck` instance bound to the `#deck-canvas` element; layers, view state, and tooltips wire through this. */
  const deck = new Deck<OrbitView>({
    canvas: 'deck-canvas',
    views: orbitView,
    initialViewState: initial.viewState,
    controller: true,
    layers: [
      ...buildLayers({
        probes,
        state: initial,
        visibleIndices,
        bounds,
        chrome,
      },),
    ],
    getTooltip: getTooltipForInfo,
    onClick: onCanvasClick,
  },);
  /** Mutable session bundle; every wire handler reads and writes through this single object. */
  const session: Session = {
    state: initial,
    bounds,
    visibleIndices,
    chrome,
    deck,
  };
  deck.setProps({
    onViewStateChange: function onViewStateChange(params,) {
      /** Latest view-state delta from deck.gl; copied into the session so hash sync can serialise it. */
      const v = params.viewState;
      session.state.viewState = {
        target: v.target,
        zoom: v.zoom,
        rotationOrbit: v.rotationOrbit ?? 0,
        rotationX: v.rotationX ?? 0,
      };
      syncHash({
        session,
      },);
    },
  },);
  return session;
}

/**
 * Entry point; called once at module-load time. Reads probes, builds
 * the session, wires every control, paints the initial scene, syncs
 * the URL hash, and updates the visibility counter.
 */
function start(): void {
  /** Embedded probe payload; throws via {@link getProbes} when the global is missing. */
  const probes = getProbes();
  /** Hydrated session for this page load. */
  const session = createSession({
    probes,
  },);
  syncDomFromState({
    state: session.state,
  },);
  /**
   * Closure passed to every wire function; recomputes visibility,
   * redraws layers, and syncs the URL hash after a state mutation.
   * No args because session + probes are captured from `start`'s
   * scope.
   */
  function commit(): void {
    recomputeVisibility({
      session,
      probes,
    },);
    rerenderLayers({
      session,
      probes,
    },);
    syncHash({
      session,
    },);
  }
  wireDimDropdowns({
    session,
    probes,
    commit,
  },);
  wireToggles({
    session,
    commit,
  },);
  wireRanges({
    session,
    commit,
  },);
  wireSearch({
    session,
    commit,
  },);
  wireDisplay({
    session,
    commit,
  },);
  wireReset({
    session,
    probes,
    commit,
  },);
  recomputeVisibility({
    session,
    probes,
  },);
  syncHash({
    session,
  },);
}

start();

//endregion Bootstrap
