/**
 * `spliceEmit`: produce output by combining the original source with pending
 * deltas via a sorted-events linear scan.
 *
 * Cornerstone invariant: with zero edits, insertions, or deletions the
 * scan returns `state.source.slice(0, state.source.length)` byte-for-byte.
 *
 * AST-mutation invariant: this module never modifies `program.body`,
 * `TOMLTable.body`, `TOMLArray.elements`, `TOMLKey.keys`,
 * `Program.comments`, or any other AST internal. All structural changes
 * are recorded as entries in the deltas and resolved positionally here.
 *
 * @module
 */

import { nonNullishOrThrow, } from '@monochromatic-dev/module-or-throw/ts';
import type { AST, } from 'toml-eslint-parser';

import type {
  AnchorKind,
  Edit,
  Insertion,
  TomlEditState,
} from './types.ts';

/**
 * Emit the splice-mode result for the given state.
 *
 * @param edit - The state to emit. Reads `source`, `program`, `edits`,
 *               `insertions`, and `deletions`.
 *
 * @returns Output TOML text.
 *
 * @example
 * ```ts
 * spliceEmit({ edit, },);
 * ```
 */
export function spliceEmit({ edit, }: { readonly edit: TomlEditState; },): string {
  if (
    (edit.edits
      .size
      === 0)
    && (edit.insertions
      .length
      === 0)
      && (edit.deletions
        .size
        === 0)
  ) {
    return edit.source;
  }

  /**
   * Local event shape for the sorted-emit stream.
   */
  type SortedEvent =
    | {
      kind: 'replace';
      start: number;
      end: number;
      text: string;
    }
    | {
      kind: 'delete';
      start: number;
      end: number;
    }
    | {
      kind: 'insert';
      at: number;
      text: string;
    };

  /**
   * Accumulator for all deltas so a single sort orders the emission.
   */
  const events: SortedEvent[] = [];

  for (const [node, edit_,] of edit.edits) {
    events.push(computeReplaceEvent({
      node,
      edit: edit_,
    },),);
  }

  for (const node of edit.deletions) {
    events.push(computeDeleteEvent({
      node,
      state: edit,
    },),);
  }

  for (const ins of edit.insertions) {
    /**
     * Resolved byte offset so insertions can join the sorted-by-offset stream.
     */
    const at = resolveAnchor({
      anchor: ins.anchor,
      state: edit,
    },);
    events.push({
      kind: 'insert',
      at,
      text: ins.text,
    },);
  }

  events.sort(function byOffset(
    a,
    b,
  ) {
    /**
     * Inserts use `at`, range events use `start`; normalise so the comparator is uniform.
     */
    const aAt = a.kind
      === 'insert' ? a.at : a.start;
    /**
     * Counterpart to `aAt` for the second comparand.
     */
    const bAt = b.kind
      === 'insert' ? b.at : b.start;
    return aAt - bAt;
  },);

  /**
   * Buffer for emitted slices so the result is one final `join`.
   */
  const out: string[] = [];
  /**
   * Running offset; tracks how much of `edit.source` has been copied.
   */
  const cursor = events.reduce(
    function step(
      c,
      ev,
    ) {
      if (ev.kind
        === 'insert') {
        if (ev.at
          > c) {
          out.push(edit.source
            .slice(
            c,
            ev.at,
          ),);
        }
        out.push(ev.text,);
        return Math.max(
          c,
          ev.at,
        );
      }
      if (ev.start
        > c) {
        out.push(edit.source
          .slice(
          c,
          ev.start,
        ),);
      }
      if (ev.kind
        === 'replace')
        out.push(ev.text,);
      return ev.end;
    },
    0,
  );

  if (cursor
    < edit
    .source
    .length)
    out.push(edit.source
      .slice(cursor,),);

  return out.join('',);
}

/**
 * Build the `replace` event for a single pending `Edit`.
 *
 * @returns Computed result.
 */
function computeReplaceEvent(
  {
    node,
    edit,
  }: {
    readonly node: AST.TOMLNode;
    readonly edit: Edit;
  },
): {
  kind: 'replace';
  start: number;
  end: number;
  text: string;
} {
  if (edit.kind
    === 'replace-value') {
    /**
     * Narrow to the value's bytes so the key and `=` stay in place.
     */
    const valueRange = valueRangeOf({ node, },);
    return {
      kind: 'replace',
      start: valueRange[0],
      end: valueRange[1],
      text: edit.newText,
    };
  }
  return {
    kind: 'replace',
    start: node.range[0],
    end: node.range[1],
    text: edit.newText,
  };
}

/**
 * Value bytes range for a keyvalue, else the node's own range.
 *
 * @returns Computed result (`readonly [number, number]`).
 */
function valueRangeOf({ node, }: { readonly node: AST.TOMLNode; },): readonly [
  number,
  number,
] {
  if (node.type
    === 'TOMLKeyValue')
    return node.value
      .range;
  return node.range;
}

/**
 * Build the `delete` event by delegating to `computeDeletionRange`.
 *
 * @returns Computed result.
 */
function computeDeleteEvent(
  {
    node,
    state,
  }: {
    readonly node: AST.TOMLNode;
    readonly state: TomlEditState;
  },
): {
  kind: 'delete';
  start: number;
  end: number;
} {
  return computeDeletionRange({
    node,
    state,
  },);
}

/**
 * Range a deletion should consume.
 *
 * Extends `node.range` forward to absorb a same-line trailing inline comment
 * (a `Program.comments` entry whose start is on the same line as `node.range[1]`
 * and before the next newline), then the trailing `\n`.
 *
 * Documented as a load-bearing helper: trailing inline comments live on
 * `Program.comments`, not on `TOMLKeyValue`. A naive delete orphans them.
 *
 * @returns Computed result.
 */
function computeDeletionRange(
  {
    node,
    state,
  }: {
    readonly node: AST.TOMLNode;
    readonly state: TomlEditState;
  },
): {
  kind: 'delete';
  start: number;
  end: number;
} {
  /**
   * Start offset of the deletion; the end is computed below to absorb the trailing line.
   */
  const [start,] = node.range;
  /**
   * Index of the first newline after the node; `-1` means EOF.
   */
  const newlineAfter = state.source
    .indexOf(
    '\n',
    node.range[1],
  );
  /**
   * Same-line comment so it disappears with the node it annotates.
   */
  const trailingInlineComment = state.program
    .comments
    .find(function inSameLine(c,) {
    return (
      (c.range[0]
        > node
        .range[1])
      && ((newlineAfter === (-1)) || (c.range[0]
        < newlineAfter))
    );
  },);
  /**
   * Offset just past the line terminator so the deletion absorbs the trailing `\n`.
   */
  const lineEndExclusive = newlineAfter === (-1)
    ? state.source
      .length
    : newlineAfter + 1;
  /**
   * Extends the range past a trailing inline comment when one was found.
   */
  const endIncludingComment = trailingInlineComment === undefined
    ? lineEndExclusive
    : Math.max(
      lineEndExclusive,
      trailingInlineComment.range[1]
        + 1,
    );
  return {
    kind: 'delete',
    start,
    end: endIncludingComment,
  };
}

/**
 * Resolve an `AnchorKind` to a byte offset in the source.
 *
 * @returns Computed number.
 */
function resolveAnchor(
  {
    anchor,
    state,
  }: {
    readonly anchor: AnchorKind;
    readonly state: TomlEditState;
  },
): number {
  if (anchor === 'eof')
    return state.source
      .length;
  if (anchor.position
    === 'after-node') {
    return endOfLineAt({
      source: state.source,
      at: anchor.node
        .range[1],
    },);
  }
  if (anchor.position
    === 'before-node')
    return anchor.node
      .range[0];
  if (anchor.position
    === 'same-line-after')
    return anchor.node
      .range[1];
  return resolveInsideTable({
    table: anchor.table,
    source: state.source,
  },);
}

/**
 * Offset of the character after the next newline at or after `at`.
 *
 * @returns Computed number.
 */
function endOfLineAt({
  source,
  at,
}: {
  readonly source: string;
  readonly at: number;
},): number {
  /**
   * Newline index; `-1` means EOF, so callers fall back to `source.length`.
   */
  const nl = source.indexOf(
    '\n',
    at,
  );
  return nl === (-1) ? source.length : nl + 1;
}

/**
 * Offset for inserting at the end of a table body.
 *
 * @returns Computed number.
 */
function resolveInsideTable(
  {
    table,
    source,
  }: {
    readonly table: AST.TOMLTable | AST.TOMLTopLevelTable;
    readonly source: string;
  },
): number {
  if (table.body
    .length
    === 0) {
    if (table.type
      === 'TOMLTable') {
      return endOfLineAt({
        source,
        at: table.key
          .range[1],
      },);
    }
    return 0;
  }
  /**
   * Last existing body entry so the insertion lands on the next line after it.
   */
  const last = nonNullishOrThrow(table.body
    .at(-1,),);
  return endOfLineAt({
    source,
    at: last.range[1],
  },);
}

/**
 * Reserved for future delta plumbing; currently unused but kept for the type
 * signature shape that `tomlSet` and friends will populate.
 */
export type ResolvedInsertion = Insertion;
