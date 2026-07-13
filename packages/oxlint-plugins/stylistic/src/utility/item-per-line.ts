import type { ForeignBorrowed, } from '@monochromatic-dev/config-oxlint-shared/ts/foreign-borrowed.ts';
import type {
  Context,
  Fixer,
  Span,
} from '@oxlint/plugins';

import {
  type BracketPair,
  buildPerLineFix,
} from './item-per-line-fix.ts';
import { needsPerLineFix, } from './needs-fix.ts';
import type { PerLineBoundaryOffsets, } from './per-line-boundary.ts';

/**
 * Configuration for the shared per-line enforcement logic.
 *
 * @example
 * ```ts
 * checkItemsPerLine({
 *   context,
 *   container: arrayNode,
 *   items: arrayNode.elements,
 *   messageId: 'itemPerLine',
 *   bracketPair: { open: '[', close: ']' },
 * });
 * ```
 */
export type ItemPerLineConfig = {
  /**
   * Lint context for reporting and source access.
   */
  readonly context: Context;
  /**
   * Container AST node (array literal, object expression, params list, etc.).
   */
  readonly container: Span;
  /**
   * Ordered list of child items that should each appear on their own line.
   */
  readonly items: readonly Span[];
  /**
   * Message ID to use when reporting.
   */
  readonly messageId: string;
  /**
   * Bracket pair that wraps the items.
   *
   * Used by the fixer to locate the correct opening and closing brackets
   * by scanning from item positions.
   */
  readonly bracketPair: BracketPair;
  /**
   * Explicit delimiter offsets when the container span is wider than the list.
   */
  readonly boundary?: PerLineBoundaryOffsets;
  /**
   * Minimum number of items required to trigger the rule.
   *
   * Defaults to 2; single-item lists are never flagged.
   */
  readonly minItems?: number;
  /**
   * Delimiter to place after each item in the autofix output.
   *
   * Defaults to `','` for comma-separated constructs.
   * Pass `';'` for TypeScript type/interface members.
   */
  readonly delimiter?: ',' | ';';
};

/**
 * Reports and auto-fixes when multiple items share a line.
 *
 * Designed as the single implementation behind every per-line rule
 * in this plugin. Each rule's visitor extracts the relevant container
 * and items, then delegates here, which checks via {@link needsPerLineFix}
 * and builds the autofix via {@link buildPerLineFix}.
 *
 * @param context - lint context for reporting and source access
 *
 * @param container - container AST node
 *
 * @param items - ordered list of child items
 *
 * @param messageId - message ID to use when reporting
 *
 * @param bracketPair - opening and closing bracket characters for the construct
 *
 * @param minItems - minimum item count to trigger (default 2)
 *
 * @param delimiter - separator character for items (`','` or `';'`, defaults to `','`)
 *
 * @example
 * ```ts
 * checkItemsPerLine({
 *   context, container: arrayNode, items: arrayNode.elements,
 *   messageId: 'itemPerLine', bracketPair: { open: '[', close: ']' },
 * });
 * ```
 *
 * @mutates context - Emits Oxlint diagnostics through foreign rule context.
 */
export function checkItemsPerLine({
  context,
  container,
  items,
  messageId,
  bracketPair,
  boundary,
  minItems = 2,
  delimiter = ',',
}: ForeignBorrowed<ItemPerLineConfig>,): void {
  if (items.length
    < minItems)
    return;

  /**
   * Source text of the entire file.
   */
  const sourceText = context.sourceCode
    .getText();

  /**
   * Whether any adjacent items or delimiters share a line.
   */
  const needsFix = boundary === undefined
    ? needsPerLineFix({
      sourceText,
      container,
      items,
    },)
    : needsPerLineFix({
      sourceText,
      container,
      boundary,
      items,
    },);

  if (!needsFix)
    return;

  context.report({
    node: container,
    messageId,
    fix(fixer: ForeignBorrowed<Fixer>,) {
      if (boundary === undefined) {
        return buildPerLineFix({
          fixer,
          context,
          items,
          sourceText,
          bracketPair,
          delimiter,
        },);
      }
      return buildPerLineFix({
        fixer,
        context,
        items,
        sourceText,
        bracketPair,
        boundary,
        delimiter,
      },);
    },
  },);
}
