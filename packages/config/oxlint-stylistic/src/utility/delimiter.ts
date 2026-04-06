/** Characters that open a delimited list. */
const OPEN_DELIMITERS: ReadonlySet<string> = new Set([
  '(',
  '[',
  '{',
  '<',
],);

/** Characters that close a delimited list. */
const CLOSE_DELIMITERS: ReadonlySet<string> = new Set([
  ')',
  ']',
  '}',
  '>',
],);

/**
 * Finds the index of an opening or closing delimiter in container text.
 *
 * @param text - source text of the container node
 *
 * @param direction - `'open'` scans forward, `'close'` scans backward
 *
 * @returns index of the delimiter, or -1
 *
 * @example
 * ```ts
 * findDelimiter('function foo(a, b)', 'open') // → 12
 * ```
 */
export function findDelimiter(
  text: string,
  direction: 'close' | 'open',
): number {
  if (direction === 'open') {
    for (let i = 0; i < text.length; i++) {
      if (OPEN_DELIMITERS.has(text.charAt(i,),))
        return i;
    }
  }
  else {
    for (let i = text.length - 1; i >= 0; i--) {
      if (CLOSE_DELIMITERS.has(text.charAt(i,),))
        return i;
    }
  }
  return -1;
}
