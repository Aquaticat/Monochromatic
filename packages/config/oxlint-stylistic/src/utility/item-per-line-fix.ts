// oxlint-disable typescript/no-unsafe-assignment, typescript/no-unsafe-member-access, typescript/no-unsafe-argument, typescript/no-unsafe-return -- oxlint plugin API is untyped; all member access is inherently unsafe
import type {
  Context,
  Fixer,
  Span,
} from '@oxlint/plugins';

import {
  at,
  rangeOf,
} from './range.ts';

/**
 * Bracket pair that delimits the list being reformatted.
 *
 * @example
 * ```ts
 * // Function arguments / parameters
 * { open: '(', close: ')' }
 *
 * // Array / tuple
 * { open: '[', close: ']' }
 *
 * // Object / destructure / type literal
 * { open: '{', close: '}' }
 * ```
 */
export type BracketPair = {
  /** Opening bracket character. */
  open: '(' | '[' | '{';
  /** Closing bracket character. */
  close: ')' | ']' | '}';
};

/**
 * Configuration for generating a per-line autofix.
 */
export type PerLineFixConfig = {
  /** Fixer instance from the lint report callback. */
  fixer: Fixer;
  /** Lint context for source text access. */
  context: Context;
  /** Child items to place one per line. */
  items: Span[];
  /** Full file source text. */
  sourceText: string;
  /**
   * Bracket pair that wraps the items.
   *
   * Used to locate the opening and closing brackets by scanning
   * from item positions rather than from the (potentially larger)
   * container node span.
   */
  bracketPair: BracketPair;
  /**
   * Delimiter to place after each item.
   *
   * Defaults to `','` for comma-separated constructs.
   * Pass `';'` for TypeScript type/interface members.
   */
  delimiter?: ',' | ';';
};

/**
 * Builds a fixer result that reformats items one per line.
 *
 * Finds the enclosing brackets by scanning backward from the first item
 * and forward from the last item, then replaces the bracket range with
 * properly formatted content. This avoids the container-text approach
 * which breaks when the container span includes extraneous content
 * (type annotations, callee chains with nested brackets, generics).
 *
 * @param fixer - fixer instance from the lint report callback
 *
 * @param context - lint context for source text access
 *
 * @param items - child items to place one per line
 *
 * @param sourceText - full file source text
 *
 * @param bracketPair - opening and closing bracket characters to locate
 *
 * @param delimiter - character to separate items (`','` or `';'`, defaults to `','`)
 *
 * @returns fixer replacement result
 *
 * @example
 * ```ts
 * return buildPerLineFix({
 *   fixer, context, items, sourceText,
 *   bracketPair: { open: '(', close: ')' },
 * });
 * ```
 */
export function buildPerLineFix({
  fixer,
  context,
  items,
  sourceText,
  bracketPair,
  delimiter = ',',
}: PerLineFixConfig,): ReturnType<Fixer['replaceText']> {
  const firstRange = rangeOf(at({
    arr: items,
    index: 0,
  },),);
  const lastRange = rangeOf(at({
    arr: items,
    index: items.length - 1,
  },),);

  /** Scan backward from first item to find the opening bracket. */
  const openPos = sourceText.lastIndexOf(
    bracketPair.open,
    firstRange[0] - 1,
  );

  /** Scan forward from last item to find the closing bracket. */
  const [, lastRangeEnd,] = lastRange;
  const closePos = sourceText.indexOf(
    bracketPair.close,
    lastRangeEnd,
  );

  if (openPos === -1 || closePos === -1) {
    return fixer.replaceTextRange(
      [
        firstRange[0],
        firstRange[0],
      ],
      '',
    );
  }

  /** Compute base indentation from the line containing the opening bracket. */
  const lineStart = sourceText.lastIndexOf(
    '\n',
    openPos - 1,
  ) + 1;
  const linePrefix = sourceText.slice(
    lineStart,
    openPos,
  );
  const baseIndent = /^(\s*)/.exec(linePrefix,)?.[1] ?? '';
  const childIndent = `${baseIndent}  `;

  /** Extract each item's source text, stripping any existing trailing delimiter. */
  const itemTexts = items.map(
    function getItemText(item,): string {
      const raw = context.sourceCode.getText(item,).trim();
      if (raw.endsWith(';',) || raw.endsWith(',',)) {
        return raw.slice(
          0,
          -1,
        );
      }
      return raw;
    },
  );

  /** Check whether the original source has a trailing delimiter between last item and close bracket. */
  const trailingRegion = new Set(sourceText.slice(
    lastRange[1],
    closePos,
  ),);
  const hasTrailingDelimiter = trailingRegion.has(',',)
    || trailingRegion.has(';',);

  const formattedItems = itemTexts
    .map(function formatItem(
      text,
      idx,
    ): string {
      const isLast = idx === itemTexts.length - 1;
      const suffix = isLast && !hasTrailingDelimiter ? '' : delimiter;
      return `${childIndent}${text}${suffix}`;
    },)
    .join('\n',);

  /** Replace from opening bracket to closing bracket inclusive. */
  const replacement =
    `${bracketPair.open}\n${formattedItems}\n${baseIndent}${bracketPair.close}`;
  return fixer.replaceTextRange(
    [
      openPos,
      closePos + 1,
    ],
    replacement,
  );
}
