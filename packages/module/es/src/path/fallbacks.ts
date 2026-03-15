/**
 * Pure-JS POSIX path fallbacks for browser environments
 * where `node:path` is unavailable.
 */

//region normalize -- resolve `.` and `..`, collapse slashes

/**
 * Normalizes a path by resolving `.` and `..` segments and collapsing
 * consecutive slashes. Does not resolve against cwd — just cleans the string.
 *
 * @param filePath - Raw path to normalize
 *
 * @returns Normalized path
 */
export function normalize(filePath: string,): string {
  if (filePath === '')
    return '.';

  /** Unicode code point for `/` */
  const SLASH_CODE_POINT = 47;
  /** Whether the input is rooted */
  const isRoot = filePath.codePointAt(0,) === SLASH_CODE_POINT;
  /** Whether the input ends with a trailing slash */
  const trailingSlash = filePath.codePointAt(filePath.length - 1,) === SLASH_CODE_POINT;

  /** Path segments split on `/` */
  const parts = filePath.split('/',);
  /** Stack of resolved segments built by walking the input */
  const resolved: string[] = [];

  for (const part of parts) {
    if (part === '' || part === '.')
      continue;
    if (part === '..') {
      // Don't pop past root
      if (resolved.length > 0 && resolved.at(-1,) !== '..')
        resolved.pop();
      else if (!isRoot)
        resolved.push('..',);
    }
    else {
      resolved.push(part,);
    }
  }

  /** Joined result without root prefix */
  let result = resolved.join('/',);

  if (isRoot)
    result = `/${result}`;
  if (result === '' || result === '/')
    return isRoot ? '/' : '.';
  if (trailingSlash)
    result += '/';
  return result;
}

//endregion normalize

//region dirnameFallback -- browser fallback for dirname

/**
 * Browser fallback for {@link dirname}.
 *
 * @param filePath - POSIX path
 *
 * @returns Parent directory path
 */
export function dirnameFallback(filePath: string,): string {
  if (filePath === '')
    return '.';

  /** Unicode code point for `/` */
  const SLASH_CODE_POINT = 47;
  /** Whether the input path is rooted */
  const isRoot = filePath.codePointAt(0,) === SLASH_CODE_POINT;
  /** Index of the last slash, ignoring a trailing slash */
  let lastSlash = -1;

  // Walk backwards to find the last separator, skipping a trailing slash
  for (let charIndex = filePath.length - 1; charIndex >= 1; charIndex--) {
    if (filePath.codePointAt(charIndex,) === SLASH_CODE_POINT) {
      if (charIndex === filePath.length - 1)
        continue;
      lastSlash = charIndex;
      break;
    }
  }

  if (lastSlash === -1)
    return isRoot ? '/' : '.';
  if (isRoot && lastSlash === 0)
    return '/';
  return filePath.slice(0, lastSlash,);
}

//endregion dirnameFallback

//region joinFallback -- browser fallback for join

/**
 * Browser fallback for {@link join}.
 *
 * @param segments - Path segments to join
 *
 * @returns Joined and normalized path
 */
export function joinFallback(...segments: string[]): string {
  if (segments.length === 0)
    return '.';
  /** Raw concatenation of all non-empty segments */
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

//region resolveFallback -- browser fallback for resolve

/**
 * Browser fallback for {@link resolve}.
 *
 * @param segments - Path segments to resolve
 *
 * @returns Absolute, normalized path
 */
export function resolveFallback(...segments: string[]): string {
  /** Accumulated path built right-to-left */
  let resolved = '';
  /** Whether the accumulated path is already absolute */
  let resolvedAbsolute = false;

  // Walk segments right-to-left; stop once we have an absolute path
  for (let segmentIndex = segments.length - 1; segmentIndex >= 0 && !resolvedAbsolute;
    segmentIndex--)
  {
    /** Current segment being processed */
    const segment = segments[segmentIndex];
    if (segment === undefined || segment === '')
      continue;
    /** Unicode code point for `/` */
    const SLASH_CODE_POINT = 47;
    resolved = resolved === '' ? segment : `${segment}/${resolved}`;
    resolvedAbsolute = segment.codePointAt(0,) === SLASH_CODE_POINT;
  }

  // If still not absolute, prepend cwd (unavailable in browser, default to '/')
  if (!resolvedAbsolute) {
    /** Current working directory — falls back to `/` in browser */
    const cwd = typeof process !== 'undefined' && typeof process.cwd === 'function'
      ? process.cwd()
      : '/';
    resolved = `${cwd}/${resolved}`;
  }

  /** Normalized absolute path */
  const normalized = normalize(resolved,);
  // resolve() never returns trailing slashes except for root '/'
  /** Unicode code point for `/` */
  const SLASH_CODE_POINT = 47;
  if (normalized.length > 1 && normalized.codePointAt(normalized.length - 1,) === SLASH_CODE_POINT)
    return normalized.slice(0, -1,);
  return normalized;
}

//endregion resolveFallback
