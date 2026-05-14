import type { Span, } from '@oxlint/plugins';

import { lineAt, } from './line-at.ts';
import {
  at,
  rangeOf,
} from './range.ts';

/**
 * Parameters for {@link needsPerLineFix}.
 */
export type NeedsPerLineFixParams = {
  /** Full file source text. */
  sourceText: string;
  /** Container AST node. */
  container: Span;
  /** Child items to check (must be non-empty). */
  items: Span[];
};

/**
 * Checks whether any items share a source line with each other
 * or with the container delimiters.
 *
 * @returns whether a fix is needed
 *
 * @example
 * ```ts
 * if (needsPerLineFix({ sourceText, container, items })) { /* report *\/ }
 * ```
 */
export function needsPerLineFix({
  sourceText,
  container,
  items,
}: NeedsPerLineFixParams,): boolean {
  const containerRange = rangeOf(container,);
  const firstRange = rangeOf(at({
    arr: items,
    index: 0,
  },),);

  if (lineAt({
    sourceText,
    offset: containerRange[0],
  },) === lineAt({
    sourceText,
    offset: firstRange[0],
  },)) {
    return true;
  }

  const lastRange = rangeOf(at({
    arr: items,
    index: items.length - 1,
  },),);
  if (lineAt({
    sourceText,
    offset: lastRange[1],
  },) === lineAt({
    sourceText,
    offset: containerRange[1],
  },)) {
    return true;
  }

  for (let i = 1; i < items.length; i++) {
    const prevRange = rangeOf(at({
      arr: items,
      index: i - 1,
    },),);
    const currRange = rangeOf(at({
      arr: items,
      index: i,
    },),);
    if (lineAt({
      sourceText,
      offset: prevRange[1],
    },) === lineAt({
      sourceText,
      offset: currRange[0],
    },)) {
      return true;
    }
  }

  return false;
}
