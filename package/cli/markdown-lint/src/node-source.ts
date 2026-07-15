import type { ReadonlyDeep, } from 'type-fest';
import { nonNullishOrThrow, } from '@monochromatic-dev/module-or-throw/ts';
import type { Nodes, } from 'mdast';
import type { Position, } from 'unist';

import type {
  Diagnostic,
  Fix,
} from './types.ts';

/**
 * The position of a node, asserting it exists. Every node produced by
 * `mdast-util-from-markdown` over real source carries a position; the field is
 * optional only in the abstract type, so a missing one is a programmer error.
 *
 * @param node - mdast node parsed from source
 *
 * @returns node position with start and end points
 *
 * @example
 * ```ts
 * positionOf(node).start.offset; // 0-based start offset
 * ```
 */
export function positionOf(node: ReadonlyDeep<Nodes>,): Position {
  return nonNullishOrThrow(node.position,);
}

/**
 * Half-open source offsets `[start, end)` spanned by a node.
 *
 * @param node - mdast node parsed from source
 *
 * @returns start and end source offsets
 *
 * @example
 * ```ts
 * offsetsOf(node); // { start: 30, end: 91 }
 * ```
 */
export function offsetsOf(node: ReadonlyDeep<Nodes>,): {
  readonly start: number;
  readonly end: number;
} {
  /**
   * Resolved node position.
   */
  const position = positionOf(node,);
  return {
    start: nonNullishOrThrow(position.start
      .offset,),
    end: nonNullishOrThrow(position.end
      .offset,),
  };
}

/**
 * Parameters for {@link sliceOf}.
 */
export type SliceOfParams = {
  /**
   * Node whose exact written form is recovered.
   */
  readonly node: Nodes;
  /**
   * Original source the node was parsed from.
   */
  readonly source: string;
};

/**
 * The original source text a node spans. This recovers the exact written form
 * (bare URL versus `<url>`, shortcut versus inline link) that mdast normalizes
 * away; it is source inspection at known offsets, not a second parser.
 *
 * @param node - node whose written form is recovered
 *
 * @param source - original source the node was parsed from
 *
 * @returns source slice spanned by the node
 *
 * @example
 * ```ts
 * sliceOf({ node: linkNode, source }); // '<https://example.com>'
 * ```
 */
export function sliceOf({
  node,
  source,
}: ReadonlyDeep<SliceOfParams>,): string {
  /**
   * Node's half-open source offsets.
   */
  const {
    start,
    end,
  } = offsetsOf(node,);
  return source.slice(
    start,
    end,
  );
}

/**
 * Parameters for {@link diagnose}.
 */
export type DiagnoseParams = {
  /**
   * Rule reporting the violation.
   */
  readonly ruleId: string;
  /**
   * Human-readable description.
   */
  readonly message: string;
  /**
   * Node the diagnostic points at; its start point sets line and column.
   */
  readonly node: Nodes;
  /**
   * Optional localized fix.
   */
  readonly fix?: Fix;
};

/**
 * Build a {@link Diagnostic} anchored at a node's start point.
 *
 * @param ruleId - rule reporting the violation
 *
 * @param message - human-readable description
 *
 * @param node - node whose start point sets line and column
 *
 * @param fix - optional localized fix
 *
 * @returns diagnostic anchored at the node
 *
 * @example
 * ```ts
 * diagnose({ ruleId: 'MD025', message: 'Multiple top-level headings', node });
 * ```
 */
export function diagnose({
  ruleId,
  message,
  node,
  fix,
}: ReadonlyDeep<DiagnoseParams>,): Diagnostic {
  /**
   * Resolved node position, for the start point.
   */
  const position = positionOf(node,);
  return {
    ruleId,
    message,
    line: position.start
      .line,
    column: position.start
      .column,
    ...fix === undefined ? {} : { fix, },
  };
}
