// oxlint-disable typescript/no-unsafe-assignment, typescript/no-unsafe-member-access, typescript/no-unsafe-argument, typescript/no-unsafe-return -- oxlint plugin API is untyped; all member access is inherently unsafe
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
  /** Lint context for reporting and source access. */
  context: Context;
  /** Container AST node (array literal, object expression, params list, etc.). */
  container: Span;
  /** Ordered list of child items that should each appear on their own line. */
  items: Span[];
  /** Message ID to use when reporting. */
  messageId: string;
  /**
   * Bracket pair that wraps the items.
   *
   * Used by the fixer to locate the correct opening and closing brackets
   * by scanning from item positions.
   */
  bracketPair: BracketPair;
  /**
   * Minimum number of items required to trigger the rule.
   *
   * Defaults to 2 -- single-item lists are never flagged.
   */
  minItems?: number;
  /**
   * Delimiter to place after each item in the autofix output.
   *
   * Defaults to `','` for comma-separated constructs.
   * Pass `';'` for TypeScript type/interface members.
   */
  delimiter?: ',' | ';';
};

/**
 * Reports and auto-fixes when multiple items share a line.
 *
 * Designed as the single implementation behind every per-line rule
 * in this plugin. Each rule's visitor extracts the relevant container
 * and items, then delegates here.
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
 */
export function checkItemsPerLine({
  context,
  container,
  items,
  messageId,
  bracketPair,
  minItems = 2,
  delimiter = ',',
}: ItemPerLineConfig,): void {
  if (items.length < minItems)
    return;

  /** Source text of the entire file. */
  const sourceText = context.sourceCode.getText();

  if (!needsPerLineFix({
    sourceText,
    container,
    items,
  },)) {
    return;
  }

  context.report({
    node: container,
    messageId,
    fix(fixer: Fixer,) {
      return buildPerLineFix({
        fixer,
        context,
        items,
        sourceText,
        bracketPair,
        delimiter,
      },);
    },
  },);
}
