/**
 * The pane-strip state machine: a tree of panes laid out on a `(column, row)` grid.
 *
 * This is a pure TypeScript port of the plain-Rust model in
 * `packages/desktop-app/file-manager/src/model.rs`, so the Niri-style
 * spawn/dedup/close rules stay byte-comparable between the GTK original and
 * this Electron prototype. Each pane knows its parent; `column` is lineage
 * depth and `row` is assigned by a tidy tree layout so a child aligns to its
 * parent's row and a sibling starts below the previous sibling's whole subtree.
 *
 * @example
 * ```ts
 * const opened = openRoot({ strip: createStrip(), location: directoryLocation({ path: '/home' }) });
 * ```
 *
 * @packageDocumentation
 */

/**
 * Brand key that keeps pane identifiers from mixing with plain numbers.
 */
declare const paneIdBrand: unique symbol;

/**
 * Stable identity for one pane instance, a branded monotonic counter value.
 *
 * @example
 * ```ts
 * const opened = openRoot({ strip: createStrip(), location: directoryLocation({ path: '/home' }) });
 * console.log(opened.id);
 * ```
 */
export type PaneId = number & { readonly [paneIdBrand]: never; };

/**
 * Classification of what a pane shows; `directory` panes list entries and
 * `preview` panes show a single file.
 *
 * @example
 * ```ts
 * const kind: PaneLocationKind = 'directory';
 * ```
 */
export type PaneLocationKind = 'directory' | 'preview';

/**
 * What a pane shows; also the dedup lookup key.
 *
 * @example
 * ```ts
 * const location: PaneLocation = { kind: 'directory', path: '/home' };
 * ```
 */
export type PaneLocation = {
  readonly kind: PaneLocationKind;
  readonly path: string;
};

/**
 * One pane in the strip: identity, location, grid position, and parent link.
 *
 * @example
 * ```ts
 * const opened = openRoot({ strip: createStrip(), location: directoryLocation({ path: '/home' }) });
 * console.log(paneById({ strip: opened.strip, id: opened.id },)?.column);
 * ```
 */
export type Pane = {
  readonly id: PaneId;
  readonly location: PaneLocation;

  /**
   * Zero-based column index (lineage depth); a child sits one column right of
   * its parent.
   */
  readonly column: number;

  /**
   * Zero-based row index (vertical slot), assigned by the tidy tree layout.
   */
  readonly row: number;

  /**
   * Parent pane, or `null` for a root (or an orphan whose parent was closed).
   */
  readonly parent: PaneId | null;

  /**
   * Whether this pane is the canonical dedup holder for its location; forced
   * duplicates are never registered, so a revisit focuses the canonical pane.
   */
  readonly registeredForDedup: boolean;
};

/**
 * The whole strip: every live pane, the focused pane, and the id counter.
 *
 * @example
 * ```ts
 * const strip = createStrip();
 * console.log(strip.panes.length);
 * ```
 */
export type Strip = {
  /**
   * Next id to mint; increments so ids are never reused and encode spawn order.
   */
  readonly nextId: number;
  readonly panes: readonly Pane[];

  /**
   * The focused pane, if any; cleared when that pane is closed.
   */
  readonly active: PaneId | null;
};

/**
 * Builds a directory pane location.
 *
 * @param path - Absolute directory path the pane lists.
 *
 * @returns Directory location value.
 *
 * @example
 * ```ts
 * directoryLocation({ path: '/home' });
 * ```
 */
export function directoryLocation({ path, }: { readonly path: string; },): PaneLocation {
  return {
    kind: 'directory',
    path,
  };
}

/**
 * Builds a file-preview pane location.
 *
 * @param path - Absolute file path the pane previews.
 *
 * @returns Preview location value.
 *
 * @example
 * ```ts
 * previewLocation({ path: '/home/photo.png' });
 * ```
 */
export function previewLocation({ path, }: { readonly path: string; },): PaneLocation {
  return {
    kind: 'preview',
    path,
  };
}

/**
 * Builds an empty strip; a fresh session starts with no panes.
 *
 * @returns Strip with no panes and no focus.
 *
 * @example
 * ```ts
 * const strip = createStrip();
 * ```
 */
export function createStrip(): Strip {
  return {
    active: null,
    nextId: 0,
    panes: [],
  };
}

/**
 * Checks whether two locations are the same dedup key.
 *
 * @param left - First location.
 *
 * @param right - Second location.
 *
 * @returns Whether kind and path both match.
 *
 * @example
 * ```ts
 * sameLocation({ left: { kind: 'directory', path: '/a' }, right: { kind: 'preview', path: '/a' } });
 * ```
 */
function sameLocation(
  {
    left,
    right,
  }: {
    readonly left: PaneLocation;
    readonly right: PaneLocation;
  },
): boolean {
  return (left.kind === right.kind) && (left.path === right.path);
}

/**
 * Finds the canonical dedup pane for a location, if one is registered.
 *
 * @param location - Location to look up.
 *
 * @param strip - Strip to search.
 *
 * @returns Canonical pane id, or `null` when no registered pane shows this location.
 *
 * @example
 * ```ts
 * canonicalPaneFor({ strip: createStrip(), location: directoryLocation({ path: '/home' }) });
 * ```
 */
function canonicalPaneFor(
  {
    location,
    strip,
  }: {
    readonly location: PaneLocation;
    readonly strip: Strip;
  },
): PaneId | null {
  /**
   * Registered pane whose location equals the lookup key, when present.
   */
  const canonical = strip.panes
    .find(function isCanonicalHolder(pane,): boolean {
      return pane.registeredForDedup && sameLocation({
        left: pane.location,
        right: location,
      },);
    },);

  return canonical?.id ?? null;
}

/**
 * Looks up a pane by id.
 *
 * @param id - Pane identity to find.
 *
 * @param strip - Strip to search.
 *
 * @returns Matching pane, or `undefined` when the id is not live.
 *
 * @example
 * ```ts
 * paneById({ strip: createStrip(), id: 0 as never });
 * ```
 */
export function paneById(
  {
    id,
    strip,
  }: {
    readonly id: PaneId;
    readonly strip: Strip;
  },
): Pane | undefined {
  return strip.panes
    .find(function matchesId(pane,): boolean {
      return pane.id === id;
    },);
}

/**
 * Number of columns spanned (one past the highest column index), or zero when empty.
 *
 * @param strip - Strip to measure.
 *
 * @returns Column count.
 *
 * @example
 * ```ts
 * columnCount({ strip: createStrip() });
 * ```
 */
export function columnCount({ strip, }: { readonly strip: Strip; },): number {
  return strip.panes
    .reduce(function widest(count, pane,): number {
      return Math.max(
        count,
        pane.column + 1,
      );
    }, 0,);
}

/**
 * The top-most (lowest-row) pane in a column, if any; keyboard Left/Right
 * navigation lands on it.
 *
 * @param column - Column index to search.
 *
 * @param strip - Strip to search.
 *
 * @returns Top pane of the column, or `undefined` for an empty column.
 *
 * @example
 * ```ts
 * firstPaneInColumn({ strip: createStrip(), column: 0 });
 * ```
 */
export function firstPaneInColumn(
  {
    column,
    strip,
  }: {
    readonly column: number;
    readonly strip: Strip;
  },
): Pane | undefined {
  return strip.panes
    .filter(function inColumn(pane,): boolean {
      return pane.column === column;
    },)
    .reduce(function topMost(top: Pane | undefined, pane,): Pane {
      return ((top === undefined) || (pane.row < top.row))
        ? pane
        : top;
    }, undefined,);
}

/**
 * A pane's parent when that parent is still live, else `null` so the pane
 * lays out as a root; closing a parent orphans its children instead of
 * deleting them.
 *
 * @param pane - Pane whose effective parent is needed.
 *
 * @param panes - Live panes to check parenthood against.
 *
 * @returns Live parent id or `null`.
 *
 * @example
 * ```ts
 * effectiveParent({ pane: { parent: null } as never, panes: [] });
 * ```
 */
function effectiveParent(
  {
    pane,
    panes,
  }: {
    readonly pane: Pane;
    readonly panes: readonly Pane[];
  },
): PaneId | null {
  if (pane.parent === null)
    return null;

  /**
   * Whether the recorded parent id still names a live pane.
   */
  const parentAlive = panes.some(function isParent(candidate,): boolean {
    return candidate.id === pane.parent;
  },);

  return parentAlive
    ? pane.parent
    : null;
}

/**
 * Sibling panes under one parent (or the roots for `null`), in spawn order.
 *
 * @param panes - Live panes to group.
 *
 * @param parent - Parent id, or `null` for roots.
 *
 * @returns Ordered children of the parent.
 *
 * @example
 * ```ts
 * orderedChildren({ panes: [], parent: null });
 * ```
 */
function orderedChildren(
  {
    panes,
    parent,
  }: {
    readonly panes: readonly Pane[];
    readonly parent: PaneId | null;
  },
): readonly Pane[] {
  return panes
    .filter(function underParent(pane,): boolean {
      return effectiveParent({
        pane,
        panes,
      },) === parent;
    },)
    .toSorted(function bySpawnOrder(left, right,): number {
      return left.id - right.id;
    },);
}

/**
 * Recomputes every pane's `row` with a tidy tree layout (iterative pre-order
 * walk): a node's row is the next free leaf-row when the walk enters it, so it
 * aligns with its first child, leaves consume rows in order, and a subtree
 * occupies a contiguous row block below the previous sibling. Iterative with a
 * work-stack so a deep lineage never recurses over a spine.
 *
 * @param panes - Live panes before row assignment.
 *
 * @returns Panes with recomputed rows.
 *
 * @example
 * ```ts
 * relayout({ panes: [] });
 * ```
 */
function relayout({ panes, }: { readonly panes: readonly Pane[]; },): readonly Pane[] {
  /**
   * Rows assigned so far, keyed by pane id.
   */
  const rows = new Map<PaneId, number>();

  /**
   * Mutable cursor naming the next free leaf row.
   */
  const cursor = { nextRow: 0, };

  /**
   * Explicit pre-order work stack seeded with the roots, top of stack last.
   */
  const stack: Pane[] = [
    ...orderedChildren({
      panes,
      parent: null,
    },),
  ]
    .reverse();

  while (stack.length > 0) {
    /**
     * Pane entered by this pre-order step.
     */
    const pane = stack.pop();

    if (pane === undefined)
      break;

    rows.set(
      pane.id,
      cursor.nextRow,
    );

    /**
     * Direct children of the entered pane, visited before later siblings.
     */
    const children = orderedChildren({
      panes,
      parent: pane.id,
    },);

    if (children.length === 0)
      cursor.nextRow += 1;

    stack.push(...[...children,].reverse(),);
  }

  return panes.map(function withAssignedRow(pane,): Pane {
    return {
      ...pane,
      parent: effectiveParent({
        pane,
        panes,
      },),
      row: rows.get(pane.id,) ?? 0,
    };
  },);
}

/**
 * Inserts a freshly minted pane, focuses it, and re-lays-out.
 *
 * @param column - Lineage depth of the new pane.
 *
 * @param location - What the pane shows.
 *
 * @param parent - Parent id, or `null` for a root.
 *
 * @param registerDedup - Whether the pane becomes the canonical dedup holder.
 *
 * @param strip - Strip before insertion.
 *
 * @returns Strip after insertion plus the new pane id.
 *
 * @example
 * ```ts
 * insertPane({ strip: createStrip(), location: directoryLocation({ path: '/home' }), column: 0, parent: null, registerDedup: true });
 * ```
 */
function insertPane(
  {
    column,
    location,
    parent,
    registerDedup,
    strip,
  }: {
    readonly column: number;
    readonly location: PaneLocation;
    readonly parent: PaneId | null;
    readonly registerDedup: boolean;
    readonly strip: Strip;
  },
): {
  readonly id: PaneId;
  readonly strip: Strip;
} {
  /**
   * Fresh never-reused identity encoding spawn order.
   */
  const id = strip.nextId as PaneId;

  /**
   * New pane before the tidy layout assigns its row.
   */
  const pane: Pane = {
    column,
    id,
    location,
    parent,
    registeredForDedup: registerDedup,
    row: 0,
  };

  return {
    id,
    strip: {
      active: id,
      nextId: strip.nextId + 1,
      panes: relayout({
        panes: [
          ...strip.panes,
          pane,
        ],
      },),
    },
  };
}

/**
 * Opens a root pane for a location in column 0, deduplicating first: when a
 * registered pane already shows this location, it is focused instead.
 *
 * @param location - What the root pane shows.
 *
 * @param strip - Strip before the open.
 *
 * @returns Strip after the open plus the (existing or new) pane id.
 *
 * @example
 * ```ts
 * openRoot({ strip: createStrip(), location: directoryLocation({ path: '/home' }) });
 * ```
 */
export function openRoot(
  {
    location,
    strip,
  }: {
    readonly location: PaneLocation;
    readonly strip: Strip;
  },
): {
  readonly id: PaneId;
  readonly strip: Strip;
} {
  /**
   * Canonical pane already showing this location, when registered.
   */
  const existing = canonicalPaneFor({
    location,
    strip,
  },);

  if (existing !== null)
    return {
      id: existing,
      strip: {
        ...strip,
        active: existing,
      },
    };

  return insertPane({
    column: 0,
    location,
    parent: null,
    registerDedup: true,
    strip,
  },);
}

/**
 * Spawns a child of a parent pane one column right, focuses it, and
 * re-lays-out; `forceDuplicate` skips dedup to mint an unregistered duplicate.
 *
 * @param forceDuplicate - Whether to skip dedup and mint a duplicate.
 *
 * @param location - What the child shows.
 *
 * @param parent - Pane the child descends from.
 *
 * @param strip - Strip before the spawn.
 *
 * @returns Strip after the spawn plus the (existing or new) pane id.
 *
 * @example
 * ```ts
 * const opened = openRoot({ strip: createStrip(), location: directoryLocation({ path: '/home' }) });
 * spawnChild({ strip: opened.strip, parent: opened.id, location: directoryLocation({ path: '/home/docs' }), forceDuplicate: false });
 * ```
 */
export function spawnChild(
  {
    forceDuplicate,
    location,
    parent,
    strip,
  }: {
    readonly forceDuplicate: boolean;
    readonly location: PaneLocation;
    readonly parent: PaneId;
    readonly strip: Strip;
  },
): {
  readonly id: PaneId;
  readonly strip: Strip;
} {
  if (!forceDuplicate) {
    /**
     * Canonical pane already showing this location, when registered.
     */
    const existing = canonicalPaneFor({
      location,
      strip,
    },);

    if (existing !== null)
      return {
        id: existing,
        strip: {
          ...strip,
          active: existing,
        },
      };
  }

  /**
   * Column of the spawning parent, defaulting to a root when the id is stale.
   */
  const parentColumn = paneById({
    id: parent,
    strip,
  },)?.column ?? -1;

  return insertPane({
    column: parentColumn + 1,
    location,
    parent,
    registerDedup: !forceDuplicate,
    strip,
  },);
}

/**
 * Focuses a live pane; a stale id is ignored.
 *
 * @param id - Pane to focus.
 *
 * @param strip - Strip before the focus change.
 *
 * @returns Strip after the focus change.
 *
 * @example
 * ```ts
 * const opened = openRoot({ strip: createStrip(), location: directoryLocation({ path: '/home' }) });
 * focusPane({ strip: opened.strip, id: opened.id });
 * ```
 */
export function focusPane(
  {
    id,
    strip,
  }: {
    readonly id: PaneId;
    readonly strip: Strip;
  },
): Strip {
  if (paneById({
    id,
    strip,
  },) === undefined)
    return strip;

  return {
    ...strip,
    active: id,
  };
}

/**
 * Closes one pane and re-lays-out: the layout closes the gap and any children
 * of the closed pane become roots (no automatic pruning).
 *
 * @param id - Pane to close.
 *
 * @param strip - Strip before the close.
 *
 * @returns Strip after the close.
 *
 * @example
 * ```ts
 * const opened = openRoot({ strip: createStrip(), location: directoryLocation({ path: '/home' }) });
 * closePane({ strip: opened.strip, id: opened.id });
 * ```
 */
export function closePane(
  {
    id,
    strip,
  }: {
    readonly id: PaneId;
    readonly strip: Strip;
  },
): Strip {
  /**
   * Live panes surviving the close.
   */
  const survivors = strip.panes
    .filter(function stillLive(pane,): boolean {
      return pane.id !== id;
    },);

  return {
    active: (strip.active === id)
      ? null
      : strip.active,
    nextId: strip.nextId,
    panes: relayout({ panes: survivors, },),
  };
}
