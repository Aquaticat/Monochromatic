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
  readonly sourceText: string;
  /** Container AST node. */
  readonly container: Span;
  /** Child items to check (must be non-empty). */
  readonly items: readonly Span[];
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
  /** Container span boundaries; compared against item lines to detect inline first/last items. */
  const containerRange = rangeOf(container,);
  /** First item's range; used to test whether it shares a line with the opening delimiter. */
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

  /** Last item's range; used to test whether it shares a line with the closing delimiter. */
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
    /** Previous item's range; paired with `currRange` to detect items sharing a line. */
    const prevRange = rangeOf(at({
      arr: items,
      index: i - 1,
    },),);
    /** Current item's range; paired with `prevRange` to detect items sharing a line. */
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
