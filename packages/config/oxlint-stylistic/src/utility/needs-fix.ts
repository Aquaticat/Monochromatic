import type { Span, } from '@oxlint/plugins';

import { lineAt, } from './line-at.ts';
import {
  at,
  rangeOf,
} from './range.ts';

/**
 * Checks whether any items share a source line with each other
 * or with the container delimiters.
 *
 * @param sourceText - full file source text
 *
 * @param container - container AST node
 *
 * @param items - child items to check (must be non-empty)
 *
 * @returns whether a fix is needed
 *
 * @example
 * ```ts
 * if (needsPerLineFix(sourceText, container, items)) { /* report *\/ }
 * ```
 */
export function needsPerLineFix(
  sourceText: string,
  container: Span,
  items: Span[],
): boolean {
  const containerRange = rangeOf(container,);
  const firstRange = rangeOf(at(
    items,
    0,
  ),);

  if (lineAt(
    sourceText,
    containerRange[0],
  ) === lineAt(
    sourceText,
    firstRange[0],
  )) {
    return true;
  }

  const lastRange = rangeOf(at(
    items,
    items.length - 1,
  ),);
  if (lineAt(
    sourceText,
    lastRange[1],
  ) === lineAt(
    sourceText,
    containerRange[1],
  )) {
    return true;
  }

  for (let i = 1; i < items.length; i++) {
    const prevRange = rangeOf(at(
      items,
      i - 1,
    ),);
    const currRange = rangeOf(at(
      items,
      i,
    ),);
    if (lineAt(
      sourceText,
      prevRange[1],
    ) === lineAt(
      sourceText,
      currRange[0],
    )) {
      return true;
    }
  }

  return false;
}
