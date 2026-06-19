/**
 * Editor changeset type and helpers.
 *
 * A `Changeset` represents one edit to the buffer: replace the
 * substring at `[from, to)` with `insert`. This is the minimum
 * primitive the editor exchanges between the input layer (which
 * translates browser-level edits into changesets) and the buffer
 * worker (which holds the piece-table source of truth).
 *
 * Helpers in this module are intentionally pure; no DOM, no
 * postMessage, no state. They run identically in the worker and on
 * the main thread.
 */

/**
 * One edit to the buffer.
 *
 * `from` and `to` are character (UTF-16 code unit) offsets into the
 * pre-edit buffer; `from <= to`. `insert` is the replacement text
 * (the empty string for a pure delete).
 */
export type Changeset = {
  /**
   * Inclusive start offset in the pre-edit buffer.
   */
  readonly from: number;
  /**
   * Exclusive end offset in the pre-edit buffer.
   */
  readonly to: number;
  /**
   * Replacement text.
   */
  readonly insert: string;
};

/**
 * Computes the inverse of a changeset given the buffer state it was
 * applied against. The inverse, when applied to the post-edit buffer,
 * restores the pre-edit buffer; the undo stack stores inverses for
 * exactly this reason.
 *
 * @param input - the changeset and the pre-edit buffer text it
 *                will be applied to
 *
 * @returns the inverse changeset
 *
 * @example
 * ```ts
 * const cs: Changeset = { from: 5, to: 10, insert: 'x' };
 * const inv = invertChangeset({ changeset: cs, before: 'helloworld' });
 * // inv === { from: 5, to: 6, insert: 'world' }
 * ```
 */
export function invertChangeset(
  input: {
    readonly changeset: Changeset;
    readonly before: string;
  },
): Changeset {
  /**
   * Pre-edit substring captured so the inverse can re-insert it on undo.
   */
  const removed = input.before
    .slice(
    input.changeset
      .from,
    input.changeset
      .to,
  );
  return {
    from: input.changeset
      .from,
    to: input.changeset
      .from
      + input
      .changeset
      .insert
      .length,
    insert: removed,
  };
}

/**
 * Applies a changeset to a string. Pure; does not mutate the input.
 *
 * @param input - the changeset and the pre-edit text
 *
 * @returns the post-edit text
 *
 * @example
 * ```ts
 * applyChangeset({ changeset: { from: 0, to: 0, insert: 'x' }, before: 'ab' });
 * // 'xab'
 * ```
 */
export function applyChangeset(
  input: {
    readonly changeset: Changeset;
    readonly before: string;
  },
): string {
  return input.before
    .slice(
    0,
    input.changeset
      .from,
  )
    + input
    .changeset
    .insert
    + input
    .before
    .slice(input.changeset
      .to,);
}

/**
 * Translates an offset from the pre-edit buffer into the equivalent
 * offset in the post-edit buffer, given the changeset that was
 * applied. Used to keep cursor and selection anchors stable across
 * edits.
 *
 * Mapping rules:
 *
 * - Offsets before the edit window are unchanged.
 * - Offsets inside the edit window collapse to the end of the
 *   inserted text (cursor lands at `changeset.from + insert.length`).
 * - Offsets after the edit window shift by the net length delta
 *   (`insert.length - (to - from)`).
 *
 * @param input - the changeset that was applied and the offset to map
 *
 * @returns the post-edit offset
 *
 * @example
 * ```ts
 * mapOffsetThroughChangeset({
 *   changeset: { from: 2, to: 4, insert: 'XYZ' },
 *   offset: 6,
 * });
 * // 7  (offset after the window shifts by +1)
 * ```
 */
export function mapOffsetThroughChangeset(
  input: {
    readonly changeset: Changeset;
    readonly offset: number;
  },
): number {
  if (input.offset
    <= input
    .changeset
    .from)
    return input.offset;
  if (input.offset
    <= input
    .changeset
    .to)
    return input.changeset
      .from
      + input
      .changeset
      .insert
      .length;
  /**
   * Net length change so offsets past the edit window shift by exactly this much.
   */
  const delta = input.changeset
    .insert
    .length
    - (input.changeset
      .to
      - input
      .changeset
      .from);
  return input.offset
    + delta;
}

/**
 * Sentinel returned by `composeChangesets` when two changesets cannot
 * be composed cleanly. A unique `Symbol` rather than `null`: a composed
 * result is always a `Changeset`, so callers gate with `=== NOT_COMPOSABLE`.
 */
export const NOT_COMPOSABLE: unique symbol = Symbol('messages-demo:not-composable',);

/**
 * Composes two changesets into one when both apply at the same
 * position (the typical "type two characters in a row" case). Returns
 * `NOT_COMPOSABLE` if the two cannot be composed cleanly; the caller should keep
 * them as separate undo entries in that case.
 *
 * Composition rule: if `b.from === a.from + a.insert.length` AND
 * `b.to === b.from` (i.e. `b` is a pure insert immediately after `a`'s
 * insert), the two collapse into a single insert. This covers the
 * "successive single-character types coalesce into one undo entry"
 * pattern; anything more complex stays separate to keep the undo
 * boundary predictable.
 *
 * @param input - two changesets in apply order
 *
 * @returns combined changeset, or `NOT_COMPOSABLE` if not composable
 *
 * @example
 * ```ts
 * composeChangesets({
 *   a: { from: 5, to: 5, insert: 'h' },
 *   b: { from: 6, to: 6, insert: 'i' },
 * });
 * // { from: 5, to: 5, insert: 'hi' }
 * ```
 */
export function composeChangesets(
  input: {
    readonly a: Changeset;
    readonly b: Changeset;
  },
): Changeset | typeof NOT_COMPOSABLE {
  /**
   * Offset where `a` ends after its insert; composition is only legal when `b` lands here.
   */
  const insertEnd = input.a
    .from
    + input
    .a
    .insert
    .length;
  if ((input.b
    .from
    !== insertEnd) || (input.b
      .to
      !== insertEnd))
    return NOT_COMPOSABLE;
  return {
    from: input.a
      .from,
    to: input.a
      .to,
    insert: input.a
      .insert
      + input
      .b
      .insert,
  };
}
