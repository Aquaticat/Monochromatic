/**
 * Browser renderer for the sticky-flow file-manager prototype.
 *
 * Runs as a plain browser ES module inside Electron's sandboxed renderer.
 * All layout behavior during scrolling (panes pinning inside their rails,
 * non-overlap, clamping) is delegated to CSS normal flow plus
 * `position: sticky`; this module only mutates the pane model, reconciles the
 * DOM, and mirrors observable state across the preload bridge.
 *
 * @example
 * ```ts
 * // index.html loads this file as <script type="module">.
 * ```
 */

import type {
  BridgedWindow,
  BridgeFileEntry,
  FileManagerBridge,
  ObservedStripState,
} from './bridge-types.js';
import {
  createRendererStores,
  renderStrip,
  type RendererStores,
} from './render-dom.js';
import {
  closePane,
  columnCount,
  createStrip,
  directoryLocation,
  firstPaneInColumn,
  focusPane,
  openRoot,
  paneById,
  previewLocation,
  spawnChild,
  type PaneId,
  type Strip,
} from './strip.js';

/**
 * Tolerance in pixels when checking whether the root pane is pinned to the
 * scroller's top edge.
 */
const PIN_EPSILON_PX = 1;

/**
 * Mutable renderer session: the model, the DOM stores, and the strip element.
 *
 * @example
 * ```ts
 * // Created once by bootFileManager.
 * ```
 */
type RendererSession = {
  readonly bridge: FileManagerBridge;
  readonly stores: RendererStores;
  strip: Strip;
  readonly stripElement: HTMLElement;
};

/**
 * Error thrown when expected static markup is missing or has an unexpected tag.
 *
 * @example
 * ```ts
 * new MissingShellElementError({ id: 'strip' });
 * ```
 */
class MissingShellElementError extends Error {
  /**
   * Builds a descriptive DOM lookup error.
   *
   * @param id - Missing element id.
   *
   * @example
   * ```ts
   * new MissingShellElementError({ id: 'strip' });
   * ```
   */
  public constructor({ id, }: { readonly id: string; },) {
    super(`Missing file-manager shell element: ${id}`,);
    this.name = 'MissingShellElementError';
  }
}

/**
 * Returns a shell element by id after checking its runtime type.
 *
 * @param id - Static element id expected in `index.html`.
 *
 * @returns Element narrowed to `HTMLElement`.
 *
 * @throws MissingShellElementError when the element is absent.
 *
 * @example
 * ```ts
 * getShellElement({ id: 'strip' });
 * ```
 */
function getShellElement({ id, }: { readonly id: string; },): HTMLElement {
  /**
   * Element found in the static markup.
   */
  const element = document.querySelector(`#${id}`,);

  if (!(element instanceof HTMLElement))
    throw new MissingShellElementError({ id, },);

  return element;
}

/**
 * Shows a user-visible status line (errors included) in the shell footer.
 *
 * @param text - Status text to show.
 *
 * @example
 * ```ts
 * showStatus({ text: 'listing failed' });
 * ```
 */
function showStatus({ text, }: { readonly text: string; },): void {
  getShellElement({ id: 'status', },)
    .textContent = text;
}

/**
 * Counts pane pairs whose rendered boxes intersect; sticky flow must keep
 * this zero, and the boundary test asserts exactly that.
 *
 * @param session - Renderer session holding the pane elements.
 *
 * @returns Number of intersecting pane pairs.
 *
 * @example
 * ```ts
 * countOverlaps({ session });
 * ```
 */
function countOverlaps({ session, }: { readonly session: RendererSession; },): number {
  /**
   * Rendered pane boxes in document coordinates.
   */
  const rects = [...session.stores
    .paneElements
    .values(),]
    .map(function boxOf(element,): DOMRect {
      return element.getBoundingClientRect();
    },);

  return rects.reduce(function countAgainstLater(count, rect, index,): number {
    return count + rects
      .slice(index + 1,)
      .filter(function intersects(other,): boolean {
        return (rect.left < other.right)
          && (other.left < rect.right)
          && (rect.top < other.bottom)
          && (other.top < rect.bottom);
      },)
      .length;
  }, 0,);
}

/**
 * Computes the shallow observable state snapshot for boundary tests.
 *
 * @param session - Renderer session to observe.
 *
 * @returns Shallow scalar snapshot.
 *
 * @example
 * ```ts
 * observeState({ session });
 * ```
 */
function observeState({ session, }: { readonly session: RendererSession; },): ObservedStripState {
  /**
   * Vertical scroll offset of the strip scroller.
   */
  const scrollTop = session.stripElement.scrollTop;

  /**
   * First root pane's element, whose pinning proves sticky behavior.
   */
  const rootPane = firstPaneInColumn({
    column: 0,
    strip: session.strip,
  },);

  /**
   * Root pane box in viewport coordinates, when a root exists.
   */
  const rootRect = (rootPane === undefined)
    ? undefined
    : session.stores
      .paneElements
      .get(rootPane.id,)
      ?.getBoundingClientRect();

  /**
   * Scroller box in viewport coordinates.
   */
  const stripRect = session.stripElement
    .getBoundingClientRect();

  /**
   * Focused pane's location path, when focus exists.
   */
  const activePath = (session.strip.active === null)
    ? ''
    : paneById({
      id: session.strip.active,
      strip: session.strip,
    },)?.location
      .path ?? '';

  return {
    activePath,
    columnCount: columnCount({ strip: session.strip, },),
    overlapCount: countOverlaps({ session, },),
    paneCount: session.strip
      .panes
      .length,
    ready: true,
    rootPinned: (scrollTop > 0)
      && (rootRect !== undefined)
      && (Math.abs(rootRect.top - stripRect.top,) <= PIN_EPSILON_PX),
    scrolledDown: scrollTop > 0,
    scrollTopPx: Math.round(scrollTop,),
  };
}

/**
 * Mirrors the current observable state across the bridge.
 *
 * @param session - Renderer session to observe.
 *
 * @example
 * ```ts
 * reportState({ session });
 * ```
 */
function reportState({ session, }: { readonly session: RendererSession; },): void {
  session.bridge
    .reportState(observeState({ session, },),);
}

/**
 * Re-renders the strip, reveals the focused pane, and reports state.
 *
 * @param session - Renderer session to render.
 *
 * @example
 * ```ts
 * renderAndReport({ session });
 * ```
 */
function renderAndReport({ session, }: { readonly session: RendererSession; },): void {
  renderStrip({
    handlers: sessionHandlers({ session, },),
    stores: session.stores,
    strip: session.strip,
    stripElement: session.stripElement,
  },);

  if (session.strip.active !== null)
    session.stores
      .paneElements
      .get(session.strip.active,)
      ?.scrollIntoView({
        block: 'nearest',
        inline: 'nearest',
      },);

  reportState({ session, },);
}

/**
 * Opens one listing entry: descend into a directory (fetching its listing
 * first so the new pane renders full) or spawn a preview pane for a file.
 *
 * @param entry - Entry to open.
 *
 * @param forceDuplicate - Whether to skip dedup and mint a duplicate pane.
 *
 * @param paneId - Pane the entry was opened from.
 *
 * @param session - Renderer session to mutate.
 *
 * @example
 * ```ts
 * await openEntry({ session, paneId, entry, forceDuplicate: false });
 * ```
 */
async function openEntry(
  {
    entry,
    forceDuplicate,
    paneId,
    session,
  }: {
    readonly entry: BridgeFileEntry;
    readonly forceDuplicate: boolean;
    readonly paneId: PaneId;
    readonly session: RendererSession;
  },
): Promise<void> {
  /**
   * Location the new pane shows: a listing for directories, a preview
   * otherwise (symlinks stay unresolved, matching the GTK original).
   */
  const location = (entry.kind === 'directory')
    ? directoryLocation({ path: entry.path, },)
    : previewLocation({ path: entry.path, },);

  /**
   * Listing fetched before the spawn so a new directory pane renders full;
   * previews need no fetch.
   */
  const listing = (entry.kind === 'directory')
    ? await session.bridge
      .listDirectory(entry.path,)
    : undefined;

  /**
   * Model after the spawn, plus the (existing or new) pane id.
   */
  const spawned = spawnChild({
    forceDuplicate,
    location,
    parent: paneId,
    strip: session.strip,
  },);

  session.strip = spawned.strip;

  if ((listing !== undefined) && !session.stores
    .listings
    .has(spawned.id,))
    session.stores
      .listings
      .set(
      spawned.id,
      listing,
    );

  renderAndReport({ session, },);
}

/**
 * Runs an async entry-open and surfaces any failure in the status line,
 * because DOM event handlers do not await async listeners.
 *
 * @param entry - Entry to open.
 *
 * @param forceDuplicate - Whether to skip dedup and mint a duplicate pane.
 *
 * @param paneId - Pane the entry was opened from.
 *
 * @param session - Renderer session to mutate.
 *
 * @example
 * ```ts
 * openEntryFromEvent({ session, paneId, entry, forceDuplicate: false });
 * ```
 */
function openEntryFromEvent(
  {
    entry,
    forceDuplicate,
    paneId,
    session,
  }: {
    readonly entry: BridgeFileEntry;
    readonly forceDuplicate: boolean;
    readonly paneId: PaneId;
    readonly session: RendererSession;
  },
): void {
  void (async function openEntryTask(): Promise<void> {
    try {
      await openEntry({
        entry,
        forceDuplicate,
        paneId,
        session,
      },);
    }
    catch (error: unknown) {
      showStatus({ text: `Failed to open ${entry.path}: ${String(error,)}`, },);
    }
  })();
}

/**
 * Builds the pane event handlers bound to one session.
 *
 * @param session - Renderer session the handlers mutate.
 *
 * @returns Handlers for the DOM reconciler.
 *
 * @example
 * ```ts
 * sessionHandlers({ session });
 * ```
 */
function sessionHandlers({ session, }: { readonly session: RendererSession; },): {
  readonly onEntryOpen: (options: {
    readonly entry: BridgeFileEntry;
    readonly forceDuplicate: boolean;
    readonly paneId: PaneId;
  },) => void;
  readonly onPaneClose: (options: { readonly paneId: PaneId; },) => void;
  readonly onPaneFocus: (options: { readonly paneId: PaneId; },) => void;
} {
  return {
    onEntryOpen: function onEntryOpen(options,): void {
      openEntryFromEvent({
        ...options,
        session,
      },);
    },
    onPaneClose: function onPaneClose({ paneId, },): void {
      session.strip = closePane({
        id: paneId,
        strip: session.strip,
      },);
      renderAndReport({ session, },);
    },
    onPaneFocus: function onPaneFocus({ paneId, },): void {
      session.strip = focusPane({
        id: paneId,
        strip: session.strip,
      },);
      renderAndReport({ session, },);
    },
  };
}

/**
 * Moves the in-pane selection of the focused pane and reveals it.
 *
 * @param delta - Selection movement: -1 up, +1 down.
 *
 * @param session - Renderer session to mutate.
 *
 * @example
 * ```ts
 * moveSelection({ session, delta: 1 });
 * ```
 */
function moveSelection(
  {
    delta,
    session,
  }: {
    readonly delta: number;
    readonly session: RendererSession;
  },
): void {
  if (session.strip.active === null)
    return;

  /**
   * Listing of the focused pane, absent for previews.
   */
  const listing = session.stores
    .listings
    .get(session.strip.active,);

  if ((listing === undefined) || (listing.length === 0))
    return;

  /**
   * Current selection index of the focused pane.
   */
  const current = session.stores
    .selections
    .get(session.strip.active,) ?? 0;

  /**
   * New selection clamped to the listing bounds.
   */
  const next = Math.min(
    listing.length - 1,
    Math.max(
      0,
      current + delta,
    ),
  );

  session.stores
    .selections
    .set(
    session.strip.active,
    next,
  );
  renderAndReport({ session, },);
  session.stores
    .paneElements
    .get(session.strip.active,)
    ?.querySelectorAll('.entry',)[next]
    ?.scrollIntoView({ block: 'nearest', },);
}

/**
 * Moves focus to the top pane of an adjacent column, matching the GTK
 * original's Left/Right column navigation.
 *
 * @param delta - Column movement: -1 left, +1 right.
 *
 * @param session - Renderer session to mutate.
 *
 * @example
 * ```ts
 * moveColumnFocus({ session, delta: 1 });
 * ```
 */
function moveColumnFocus(
  {
    delta,
    session,
  }: {
    readonly delta: number;
    readonly session: RendererSession;
  },
): void {
  /**
   * Column of the focused pane, defaulting to the leftmost.
   */
  const currentColumn = (session.strip.active === null)
    ? 0
    : paneById({
      id: session.strip.active,
      strip: session.strip,
    },)?.column ?? 0;

  /**
   * Target column clamped to the existing columns.
   */
  const targetColumn = Math.min(
    columnCount({ strip: session.strip, },) - 1,
    Math.max(
      0,
      currentColumn + delta,
    ),
  );

  /**
   * Top pane of the target column.
   */
  const target = firstPaneInColumn({
    column: targetColumn,
    strip: session.strip,
  },);

  if (target === undefined)
    return;

  session.strip = focusPane({
    id: target.id,
    strip: session.strip,
  },);
  renderAndReport({ session, },);
}

/**
 * Opens the focused pane's selected entry.
 *
 * @param session - Renderer session to mutate.
 *
 * @example
 * ```ts
 * openSelectedEntry({ session });
 * ```
 */
function openSelectedEntry({ session, }: { readonly session: RendererSession; },): void {
  if (session.strip.active === null)
    return;

  /**
   * Listing of the focused pane, absent for previews.
   */
  const listing = session.stores
    .listings
    .get(session.strip.active,);

  /**
   * Selected entry of the focused pane.
   */
  const entry = listing?.[session.stores
    .selections
    .get(session.strip.active,) ?? 0];

  if (entry === undefined)
    return;

  openEntryFromEvent({
    entry,
    forceDuplicate: false,
    paneId: session.strip.active,
    session,
  },);
}

/**
 * Closes the focused pane.
 *
 * @param session - Renderer session to mutate.
 *
 * @example
 * ```ts
 * closeActivePane({ session });
 * ```
 */
function closeActivePane({ session, }: { readonly session: RendererSession; },): void {
  if (session.strip.active === null)
    return;

  session.strip = closePane({
    id: session.strip.active,
    strip: session.strip,
  },);
  renderAndReport({ session, },);
}

/**
 * Installs the strip-wide keyboard model: Up/Down move the selection, Enter
 * opens it, Left/Right move column focus, Backspace closes the focused pane.
 *
 * @param session - Renderer session the keys mutate.
 *
 * @example
 * ```ts
 * installKeyboard({ session });
 * ```
 */
function installKeyboard({ session, }: { readonly session: RendererSession; },): void {
  /**
   * Key-name to action lookup for the strip.
   */
  const actions: Readonly<Record<string, () => void>> = {
    ArrowDown: function selectionDown(): void {
      moveSelection({
        delta: 1,
        session,
      },);
    },
    ArrowLeft: function columnLeft(): void {
      moveColumnFocus({
        delta: -1,
        session,
      },);
    },
    ArrowRight: function columnRight(): void {
      moveColumnFocus({
        delta: 1,
        session,
      },);
    },
    ArrowUp: function selectionUp(): void {
      moveSelection({
        delta: -1,
        session,
      },);
    },
    Backspace: function closeFocused(): void {
      closeActivePane({ session, },);
    },
    Enter: function openSelected(): void {
      openSelectedEntry({ session, },);
    },
  };

  window.addEventListener(
    'keydown',
    function handleStripKey(event,): void {
      /**
       * Action bound to the pressed key, when one exists.
       */
      const action = actions[event.key];

      if (action === undefined)
        return;

      event.preventDefault();
      action();
    },
  );
}

/**
 * Applies the debug tint when the main process requested it via query string.
 *
 * @example
 * ```ts
 * applyDebugTintFromQuery();
 * ```
 */
function applyDebugTintFromQuery(): void {
  /**
   * Query parameters of the loaded renderer document.
   */
  const query = new URLSearchParams(window.location.search,);

  if (query.get('debugTint',) === '1')
    document.body
      .classList
      .add('debug-tint',);
}

/**
 * Boots the renderer: opens the root pane over the bridge, installs keyboard
 * and scroll wiring, and reports the first observable state.
 *
 * @example
 * ```ts
 * await bootFileManager();
 * ```
 */
async function bootFileManager(): Promise<void> {
  applyDebugTintFromQuery();

  /**
   * Typed bridge installed by the preload script.
   */
  const bridge = (window as unknown as BridgedWindow).fileManagerBridge;

  /**
   * Directory the first root pane lists.
   */
  const rootPath = await bridge.initialRoot();

  /**
   * Root directory listing fetched before the first render.
   */
  const rootListing = await bridge.listDirectory(rootPath,);

  /**
   * Model after opening the root pane.
   */
  const opened = openRoot({
    location: directoryLocation({ path: rootPath, },),
    strip: createStrip(),
  },);

  /**
   * Mutable renderer session shared by every handler.
   */
  const session: RendererSession = {
    bridge,
    stores: createRendererStores(),
    strip: opened.strip,
    stripElement: getShellElement({ id: 'strip', },),
  };

  session.stores
    .listings
    .set(
    opened.id,
    rootListing,
  );
  installKeyboard({ session, },);
  session.stripElement
    .addEventListener(
    'scroll',
    function reportOnScroll(): void {
      reportState({ session, },);
    },
    { passive: true, },
  );
  renderAndReport({ session, },);
}

void (async function bootTask(): Promise<void> {
  try {
    await bootFileManager();
  }
  catch (error: unknown) {
    showStatus({ text: `Failed to start: ${String(error,)}`, },);
  }
})();
