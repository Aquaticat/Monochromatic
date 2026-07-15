/**
 * Pure-JS POSIX path fallbacks for browser environments
 * where `node:path` is unavailable.
 */

//region normalize: resolve `.` and `..`, collapse slashes

/**
 * Normalizes a path by resolving `.` and `..` segments and collapsing
 * consecutive slashes. Does not resolve against cwd; just cleans the string.
 *
 * @param filePath - Raw path to normalize
 *
 * @returns Normalized path
 *
 * @example
 * ```ts
 * normalize('/foo/bar//baz/./qux/../quux'); // '/foo/bar/baz/quux'
 * normalize('');                             // '.'
 * ```
 */
export function normalize(filePath: string,): string {
  if (filePath === '')
    return '.';

  /**
   * Unicode code point for `/`
   */
  const SLASH_CODE_POINT = 47;
  /**
   * Whether the input is rooted
   */
  const isRoot = filePath.codePointAt(0,)
    === SLASH_CODE_POINT;
  /**
   * Whether the input ends with a trailing slash
   */
  const trailingSlash = filePath.codePointAt(filePath.length
    - 1,)
    === SLASH_CODE_POINT;

  /**
   * Path segments split on `/`
   */
  const parts = filePath.split('/',);
  /**
   * Stack of resolved segments built by walking the input
   */
  const resolved: string[] = [];

  for (const part of parts) {
    if ((part === '') || (part === '.'))
      continue;
    if (part === '..') {
      // Don't pop past root
      if ((resolved.length
        > 0) && (resolved.at(-1,)
          !== '..'))
        resolved.pop();
      else if (!isRoot)
        resolved.push('..',);
    }
    else {
      resolved.push(part,);
    }
  }

  /**
   * Joined result without root prefix
   */
  let result = resolved.join('/',);

  if (isRoot)
    result = `/${result}`;
  if ((result === '') || (result === '/'))
    return isRoot ? '/' : '.';
  if (trailingSlash)
    result += '/';
  return result;
}

//endregion normalize

//region dirnameFallback: browser fallback for dirname

/**
 * Browser fallback for {@link dirname}.
 *
 * @param filePath - POSIX path
 *
 * @returns Parent directory path
 *
 * @example
 * ```ts
 * dirnameFallback('/foo/bar/baz.ts'); // '/foo/bar'
 * dirnameFallback('/foo/bar/');       // '/foo'
 * dirnameFallback('');                // '.'
 * ```
 */
export function dirnameFallback(filePath: string,): string {
  if (filePath === '')
    return '.';

  /**
   * Unicode code point for `/`
   */
  const SLASH_CODE_POINT = 47;
  /**
   * Whether the input path is rooted
   */
  const isRoot = filePath.codePointAt(0,)
    === SLASH_CODE_POINT;
  /**
   * Highest index to consider when searching backward for the separator:
   * one before a trailing slash, otherwise the last character. Skipping
   * any trailing slash keeps it from being picked as the directory boundary.
   */
  const searchEnd = ((filePath.length
    > 1)
      && (filePath.codePointAt(filePath.length
        - 1,)
        === SLASH_CODE_POINT))
    ? filePath.length
      - 2
    : filePath.length
      - 1;
  /**
   * Index of the last meaningful slash, or -1 when none exists.
   */
  const lastSlash = filePath.lastIndexOf(
    '/',
    searchEnd,
  );

  if (lastSlash === (-1))
    return isRoot ? '/' : '.';
  if (isRoot && (lastSlash === 0))
    return '/';
  return filePath.slice(
    0,
    lastSlash,
  );
}

//endregion dirnameFallback

//region joinFallback: browser fallback for join

/**
 * Browser fallback for {@link join}.
 *
 * @param segments - Path segments to join
 *
 * @returns Joined and normalized path
 *
 * @example
 * ```ts
 * joinFallback(['foo', 'bar', 'baz']);   // 'foo/bar/baz'
 * joinFallback(['/root', '../sibling']); // '/sibling'
 * joinFallback([]);                      // '.'
 * ```
 */
export function joinFallback(segments: readonly string[],): string {
  if (segments.length
    === 0)
    return '.';
  /**
   * Raw concatenation of all non-empty segments
   */
  const joined = segments
    .filter(function isNonEmpty(segment,) {
      return segment !== '';
    },)
    .join('/',);
  if (joined === '')
    return '.';
  return normalize(joined,);
}

//endregion joinFallback

//region resolveFallback: browser fallback for resolve

/**
 * Browser fallback for {@link resolve}.
 *
 * @param segments - Path segments to resolve
 *
 * @returns Absolute, normalized path
 *
 * @example
 * ```ts
 * resolveFallback(['/foo', 'bar', './baz']); // '/foo/bar/baz'
 * resolveFallback(['foo', 'bar']);           // `${cwd}/foo/bar`
 * ```
 */
export function resolveFallback(segments: readonly string[],): string {
  /**
   * Unicode code point for `/`
   */
  const SLASH_CODE_POINT = 47;

  /**
   * Index of the rightmost segment starting with `/`. Matches the
   * right-to-left walk semantics of `node:path.resolve`: only segments
   * from that point onward contribute, since each absolute segment
   * discards everything to its left.
   */
  const absoluteIndex = segments.findLastIndex(function isAbsoluteSegment(segment,) {
    return (segment !== '') && (segment.codePointAt(0,)
      === SLASH_CODE_POINT);
  },);

  /**
   * Segments from the rightmost absolute (or start when none) to end.
   */
  const relevantSegments = segments.slice(absoluteIndex === (-1) ? 0 : absoluteIndex,);
  /**
   * Joined path built from the relevant segments, dropping empty entries.
   */
  const partial = relevantSegments
    .filter(function isNonEmpty(segment,) {
      return segment !== '';
    },)
    .join('/',);

  /**
   * Current working directory (falls back to `/` in browser)
   */
  const cwd =
    (((typeof process) !== 'undefined') && ((typeof process.cwd) === 'function'))
      ? process.cwd()
      : '/';
  /**
   * Absolute composition: prepend cwd when no segment supplied a root.
   */
  const composed = absoluteIndex === (-1) ? `${cwd}/${partial}` : partial;
  /**
   * Normalized absolute path
   */
  const normalized = normalize(composed,);

  if (
    (normalized.length
      > 1)
    && (normalized.codePointAt(normalized.length
      - 1,)
      === SLASH_CODE_POINT)
  ) {
    return normalized.slice(
      0,
      -1,
    );
  }
  return normalized;
}

//endregion resolveFallback
