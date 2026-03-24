// oxlint-disable typescript/no-unsafe-assignment, typescript/no-unsafe-member-access, typescript/no-unsafe-argument, typescript/no-unsafe-return -- oxlint plugin API is untyped; all member access is inherently unsafe
import type {
  Context,
  Fixer,
  Span,
} from '@oxlint/plugins';

import { findDelimiter, } from './delimiter.ts';
import {
  at,
  rangeOf,
} from './range.ts';

/**
 * Configuration for generating a per-line autofix.
 */
export type PerLineFixConfig = {
  /** Fixer instance from the lint report callback. */
  fixer: Fixer;
  /** Lint context for source text access. */
  context: Context;
  /** Container AST node to replace. */
  container: Span;
  /** Child items to place one per line. */
  items: Span[];
  /** Full file source text. */
  sourceText: string;
  /** Byte offset of container start, for indentation detection. */
  containerStart: number;
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
 * Detects the container's base indentation, then rebuilds the content
 * with each item on its own line at base + 2 spaces.
 *
 * @param fixer - fixer instance from the lint report callback
 *
 * @param context - lint context for source text access
 *
 * @param container - container AST node to replace
 *
 * @param items - child items to place one per line
 *
 * @param sourceText - full file source text
 *
 * @param containerStart - byte offset of container start
 *
 * @param delimiter - character to separate items (`','` or `';'`, defaults to `','`)
 *
 * @returns fixer replacement result
 */
export function buildPerLineFix({
  fixer,
  context,
  container,
  items,
  sourceText,
  containerStart,
  delimiter = ',',
}: PerLineFixConfig,): ReturnType<Fixer['replaceText']> {
  const lineStartOffset = sourceText.lastIndexOf(
    '\n',
    containerStart - 1,
  ) + 1;
  const lineText = sourceText.slice(
    lineStartOffset,
    containerStart,
  );
  const baseIndent = lineText.match(/^(\s*)/,)?.[1] ?? '';
  const childIndent = `${baseIndent}  `;

  const containerText = context.sourceCode.getText(container,);
  const openIdx = findDelimiter(
    containerText,
    'open',
  );
  const closeIdx = findDelimiter(
    containerText,
    'close',
  );

  if (openIdx === -1 || closeIdx === -1)
    return fixer.replaceText(
      container,
      containerText,
    );

  /** Text before and including the opening delimiter. */
  const before = containerText.slice(
    0,
    openIdx + 1,
  );
  /** Text from and including the closing delimiter. */
  const after = containerText.slice(closeIdx,);

  /** Extract each item's source text, stripping any existing trailing delimiter. */
  const itemTexts = items.map(
    function getItemText(item,): string {
      const raw = context.sourceCode.getText(item,).trim();
      if (raw.endsWith(';',) || raw.endsWith(',',))
        return raw.slice(0, -1,);
      return raw;
    },
  );

  /** Check whether the original source has a trailing delimiter after the last item. */
  const lastItem = at(
    items,
    items.length - 1,
  );
  const lastRange = rangeOf(lastItem,);
  const trailingRegion = sourceText.slice(
    lastRange[1],
    containerStart + closeIdx,
  );
  const hasTrailingDelimiter = trailingRegion.includes(',',)
    || trailingRegion.includes(';',);

  const formattedItems = itemTexts.map(function formatItem(
    text,
    idx,
  ): string {
    const isLast = idx === itemTexts.length - 1;
    const suffix = isLast && !hasTrailingDelimiter ? '' : delimiter;
    return `${childIndent}${text}${suffix}`;
  },).join('\n',);

  const replacement = `${before}\n${formattedItems}\n${baseIndent}${after}`;
  return fixer.replaceText(
    container,
    replacement,
  );
}
