/**
 * Characters that open a delimited list.
 */
const OPEN_DELIMITERS: ReadonlySet<string> = new Set([
  '(',
  '[',
  '{',
  '<',
],);

/**
 * Characters that close a delimited list.
 */
const CLOSE_DELIMITERS: ReadonlySet<string> = new Set([
  ')',
  ']',
  '}',
  '>',
],);

/**
 * Parameters for {@link findDelimiter}.
 */
export type FindDelimiterParams = {
  /**
   * Source text of the container node.
   */
  readonly text: string;
  /**
   * `'open'` scans forward, `'close'` scans backward.
   */
  readonly direction: 'close' | 'open';
};

/**
 * Finds the index of an opening or closing delimiter in container text.
 *
 * @returns index of the delimiter, or -1
 *
 * @example
 * ```ts
 * findDelimiter({ text: 'function foo(a, b)', direction: 'open' }) // → 12
 * ```
 */
export function findDelimiter({
  text,
  direction,
}: FindDelimiterParams,): number {
  if (direction === 'open') {
    for (let loopIndex = 0; loopIndex < text
      .length; loopIndex++) {
      if (OPEN_DELIMITERS.has(text.charAt(loopIndex,),))
        return loopIndex;
    }
  }
  else {
    for (let loopIndex = text.length
      - 1; loopIndex >= 0; loopIndex--) {
      if (CLOSE_DELIMITERS.has(text.charAt(loopIndex,),))
        return loopIndex;
    }
  }
  return -1;
}
