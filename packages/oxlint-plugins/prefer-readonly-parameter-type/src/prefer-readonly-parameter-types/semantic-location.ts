/**
 * Oxlint report-location mapping from TypeScript source spans.
 *
 * @module
 */

import type { ForeignBorrowed, } from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';
import type {
  Context,
  LineColumn,
} from '@oxlint/plugins';

/**
 * Copied mutable Oxlint report location.
 */
export type SemanticReportLocation = {
  start: LineColumn;
  end: LineColumn;
};

/**
 * Converts TypeScript source offset to Oxlint source offset.
 *
 * @param offset - TypeScript UTF-16 source offset.
 *
 * @param hasBOM - Whether Oxlint removed leading byte-order mark.
 *
 * @returns Oxlint source offset.
 *
 * @example
 * ```ts
 * oxlintOffset({ offset: 12, hasBOM: false });
 * ```
 */
export function oxlintOffset({
  offset,
  hasBOM,
}: {
  readonly offset: number;
  readonly hasBOM: boolean;
},): number {
  return hasBOM ? Math.max(
    0,
    offset - 1,
  ) : offset;
}

/**
 * Builds Oxlint report location from TypeScript source span.
 *
 * @param context - Rule context providing source location mapping.
 *
 * @param start - TypeScript span start.
 *
 * @param end - TypeScript span end.
 *
 * @returns copied mutable report location.
 *
 * @example
 * ```ts
 * semanticLocation({ context, start: 0, end: 4 });
 * ```
 */
export function semanticLocation({
  context,
  start,
  end,
}: ForeignBorrowed<{
  readonly context: Context;
  readonly start: number;
  readonly end: number;
}>,): SemanticReportLocation {
  /**
   * Oxlint source start after optional BOM normalization.
   */
  const oxlintStart = oxlintOffset({
    offset: start,
    hasBOM: context.sourceCode
      .hasBOM,
  },);
  /**
   * Oxlint source end after optional BOM normalization.
   */
  const oxlintEnd = oxlintOffset({
    offset: end,
    hasBOM: context.sourceCode
      .hasBOM,
  },);
  return {
    start: { ...context.sourceCode
      .getLocFromIndex(oxlintStart,), },
    end: { ...context.sourceCode
      .getLocFromIndex(oxlintEnd,), },
  };
}
