/**
 * Piece-table primitives for the editor buffer worker.
 *
 * Extracted from `buffer.worker.ts` so the worker file stays under the
 * monorepo's per-file line cap. The functions are pure with respect to
 * the `Table` they receive: no module-level state, no DOM access, no
 * messaging. The worker module owns one `Table` and routes every
 * inbound message through these helpers.
 */

import type { Changeset, } from './changeset.ts';

/** One piece in the table: a slice of either the original or add buffer. */
export type Piece = {
  /** Which backing buffer this slice points into. */
  readonly source: 'original' | 'add';
  /** Inclusive start offset within the backing buffer. */
  readonly start: number;
  /** Length of the slice in characters. */
  readonly length: number;
};

/**
 * Minimal piece-table state. The table is the ordered list of pieces;
 * `original` and `add` are immutable backing strings; `length` caches
 * the sum of piece lengths so we never walk the table to answer "how
 * long is the document".
 */
export type Table = {
  /** Immutable original document text. */
  original: string;
  /** Append-only buffer for inserts. */
  add: string;
  /** Ordered slices that compose the current document. */
  pieces: Piece[];
  /** Cached sum of `pieces[i].length`. */
  length: number;
};

/**
 * Resets `table` to a single original piece for `text`. Caller is
 * responsible for clearing any associated undo / redo stacks.
 *
 * @param input - the table to reset and the new full document text
 *
 * @example
 * ```ts
 * resetTable({ table, text: 'hello' });
 * ```
 */
export function resetTable(
  input: {
    table: Table;
    text: string;
  },
): void {
  input.table.original = input.text;
  input.table.add = '';
  input.table.pieces = input.text.length === 0
    ? []
    : [
      {
        source: 'original',
        start: 0,
        length: input.text.length,
      },
    ];
  input.table.length = input.text.length;
}

/**
 * Materialises the full document text by walking the pieces. Used for
 * the `snapshot` message and as the source for table collapse.
 * O(total_chars).
 *
 * @param input - the table to materialise
 *
 * @returns full document text
 *
 * @example
 * ```ts
 * const text = materialise({ table });
 * ```
 */
export function materialise(input: { table: Table; },): string {
  let out = '';
  for (const piece of input.table.pieces) {
    const source = piece.source === 'original'
      ? input.table.original
      : input.table.add;
    out += source.slice(
      piece.start,
      piece.start + piece.length,
    );
  }
  return out;
}

/**
 * Returns the substring `[from, to)` from the current document. Walks
 * pieces until accumulating the requested window. O(nodes before
 * window + window-bytes).
 *
 * @param input - half-open offset range; clamped to `[0, length]`
 *
 * @returns substring text
 *
 * @example
 * ```ts
 * substring({ table, from: 0, to: 5 });
 * ```
 */
export function substring(
  input: {
    table: Table;
    from: number;
    to: number;
  },
): string {
  const lo = Math.max(
    0,
    Math.min(
      input.from,
      input.table.length,
    ),
  );
  const hi = Math.max(
    lo,
    Math.min(
      input.to,
      input.table.length,
    ),
  );
  if (lo === hi)
    return '';
  let out = '';
  let cursor = 0;
  for (const piece of input.table.pieces) {
    const pieceEnd = cursor + piece.length;
    if (pieceEnd <= lo) {
      cursor = pieceEnd;
      continue;
    }
    if (cursor >= hi)
      break;
    const sliceFrom = Math.max(
      0,
      lo - cursor,
    );
    const sliceTo = Math.min(
      piece.length,
      hi - cursor,
    );
    const source = piece.source === 'original'
      ? input.table.original
      : input.table.add;
    out += source.slice(
      piece.start + sliceFrom,
      piece.start + sliceTo,
    );
    cursor = pieceEnd;
  }
  return out;
}

/**
 * Splits a piece at offset `at` (relative to the document), producing
 * up to two pieces. Mutates `table.pieces` in place. Used by `applyToTable`
 * to make room for the inserted piece and to drop the removed range.
 *
 * @param input - the table to mutate and the document offset to split at
 *
 * @returns index in `table.pieces` of the split point (i.e. the first
 *          piece whose start \>= `at` after the split)
 *
 * @example
 * ```ts
 * const idx = splitAt({ table, at: 7 });
 * ```
 */
export function splitAt(
  input: {
    table: Table;
    at: number;
  },
): number {
  if (input.at <= 0)
    return 0;
  if (input.at >= input.table.length)
    return input.table.pieces.length;
  let cursor = 0;
  for (let index = 0; index < input.table.pieces.length; index += 1) {
    const piece = input.table.pieces[index];
    if (piece === undefined)
      break;
    const pieceEnd = cursor + piece.length;
    if (input.at === cursor)
      return index;
    if (input.at < pieceEnd) {
      const left: Piece = {
        source: piece.source,
        start: piece.start,
        length: input.at - cursor,
      };
      const right: Piece = {
        source: piece.source,
        start: piece.start + (input.at - cursor),
        length: pieceEnd - input.at,
      };
      input.table.pieces.splice(
        index,
        1,
        left,
        right,
      );
      return index + 1;
    }
    cursor = pieceEnd;
  }
  return input.table.pieces.length;
}

/**
 * Applies a changeset to the piece table. The flow:
 *
 * 1. Capture the removed text BEFORE mutating; the inverse needs it.
 * 2. Split the table at `from` and at `to` so the removed range
 *    occupies whole pieces.
 * 3. Splice those pieces out.
 * 4. If `insert` is non-empty, append it to the add buffer and splice
 *    in a piece pointing at the new tail.
 *
 * Returns the inverse changeset suitable for the undo stack. Throws
 * if the offsets are invalid for the current document length.
 *
 * @param input - the table to mutate and the changeset to apply
 *
 * @returns inverse changeset
 *
 * @example
 * ```ts
 * const inv = applyToTable({ table, changeset: { from: 0, to: 0, insert: 'x' } });
 * ```
 */
export function applyToTable(
  input: {
    table: Table;
    changeset: Changeset;
  },
): Changeset {
  const {
    table,
    changeset,
  } = input;
  if (
    changeset.from < 0
    || changeset.to < changeset.from
    || changeset.to > table.length
  ) {
    throw new Error(
      `invalid changeset: from=${String(changeset.from,)} to=${
        String(changeset.to,)
      } length=${String(table.length,)}`,
    );
  }

  const removed = substring({
    table,
    from: changeset.from,
    to: changeset.to,
  },);

  const startIndex = splitAt({
    table,
    at: changeset.from,
  },);
  const endIndex = splitAt({
    table,
    at: changeset.to,
  },);
  table.pieces.splice(
    startIndex,
    endIndex - startIndex,
  );

  if (changeset.insert.length > 0) {
    const addStart = table.add.length;
    table.add += changeset.insert;
    table.pieces.splice(
      startIndex,
      0,
      {
        source: 'add',
        start: addStart,
        length: changeset.insert.length,
      },
    );
  }

  table.length += changeset.insert.length - (changeset.to - changeset.from);

  return {
    from: changeset.from,
    to: changeset.from + changeset.insert.length,
    insert: removed,
  };
}
