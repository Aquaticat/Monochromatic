/**
 * Middle-out text truncation.
 *
 * Shortens a string by removing characters around the middle so that
 * a searched keyword remains visible. Uses `…` (U+2026) as the ellipsis marker.
 *
 * Three cases:
 * - Match near the start: truncate the end
 * - Match near the end: truncate the start
 * - Match in the middle: truncate both sides around the match
 */

/**
 * Unicode horizontal ellipsis character.
 */
const ELLIPSIS = '\u2026';

/**
 * Truncates `text` to fit within `budget` characters while keeping the
 * substring matching `query` visible. When truncation is needed, `…` is
 * inserted at the cut points.
 *
 * @param text - full text to truncate
 *
 * @param query - search keyword to keep visible (case-insensitive match)
 *
 * @param budget - maximum character count for the returned string
 *
 * @returns truncated string with `…` markers, or the original text if it fits
 *
 * @example
 * ```ts
 * middleOut({ text: 'src/deeply/nested/path/hello-world.ts', query: 'hello', budget: 30 });
 * // '…nested/path/hello-world.ts'
 * ```
 */
export function middleOut({
  text,
  query,
  budget,
}: {
  readonly text: string;
  readonly query: string;
  readonly budget: number;
},): string {
  if (text.length
    <= budget)
    return text;

  /**
   * Case-folded indexOf so queries find matches regardless of case.
   */
  const matchStart = text.toLowerCase()
    .indexOf(query.toLowerCase(),);

  if (matchStart === (-1)) {
    return text.slice(
      0,
      budget - 1,
    )
      + ELLIPSIS;
  }

  /**
   * End offset of the matched substring; bounds the truncation decisions below.
   */
  const matchEnd = matchStart + query
    .length;

  // Match near the start: keep start, truncate end
  if (matchEnd <= (budget - 1)) {
    return text.slice(
      0,
      budget - 1,
    )
      + ELLIPSIS;
  }

  // Match near the end: truncate start, keep end
  if ((text.length
    - matchStart) <= (budget - 1))
    return ELLIPSIS + text
      .slice((text.length
        - budget) + 1,);

  // Match in the middle: truncate both sides, center on the match
  /**
   * Remaining budget after reserving space for the query and two ellipses.
   */
  const contextBudget = budget - query
    .length
    - 2;
  /**
   * Half the context budget rounded down, allocated to the prefix.
   */
  const before = Math.floor(contextBudget / 2,);
  /**
   * Remaining context budget allocated to the suffix; absorbs the rounding.
   */
  const after = contextBudget - before;

  return ELLIPSIS + text
    .slice(
    matchStart - before,
    matchEnd + after,
  )
    + ELLIPSIS;
}
