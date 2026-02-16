/**
 * POSIX path utilities that work in both Node/Bun and browser environments.
 *
 * When `node:path` is available (Node/Bun), delegates to `node:path/posix`
 * for correctness. Falls back to a pure-JS reimplementation in browser
 * environments where `node:path` does not exist.
 *
 * Exports: {@link dirname}, {@link join}, {@link resolve}, {@link isAbsolute},
 * and {@link sep}.
 */

//region Node delegation -- use real node:path/posix when the runtime has it

/**
 * Whether the runtime provides Node-compatible path APIs.
 * Bun and Node both set `process.versions.node`.
 */
const hasNodePath = typeof process !== 'undefined' && process.versions?.node !== undefined;

/**
 * Lazily loaded `node:path/posix` module, or undefined in browser.
 * Uses top-level await with a computed specifier (`'node' + ':path'`)
 * so browser bundlers cannot statically resolve the import.
 * Top-level await is valid in ESM and supported by Bun and Node 14.8+.
 */
const nodePath: typeof import('node:path/posix') | undefined = hasNodePath
  ? (await import('node' + ':path') as typeof import('node:path')).posix
  : undefined;

//endregion Node delegation

/** POSIX path separator */
export const sep = '/';

/**
 * Returns the directory portion of a POSIX path.
 * Delegates to `node:path/posix` when available.
 * @param filePath - Absolute or relative POSIX path
 * @returns Parent directory path
 * @example
 * ```ts
 * dirname('/foo/bar/baz.css'); // '/foo/bar'
 * dirname('/foo');              // '/'
 * dirname('foo');               // '.'
 * ```
 */
export function dirname(filePath: string): string {
  if (nodePath !== undefined) {
    return nodePath.dirname(filePath);
  }
  return dirnameFallback(filePath);
}

/**
 * Whether a POSIX path is absolute (starts with `/`).
 * Delegates to `node:path/posix` when available.
 * @param filePath - Path to check
 * @returns True when the path starts with `/`
 */
export function isAbsolute(filePath: string): boolean {
  if (nodePath !== undefined) {
    return nodePath.isAbsolute(filePath);
  }
  return filePath.length > 0 && filePath.charCodeAt(0) === 47;
}

/**
 * Joins path segments with `/` and normalizes the result.
 * Delegates to `node:path/posix` when available.
 * @param segments - Path segments to join
 * @returns Joined and normalized path
 * @example
 * ```ts
 * join('/foo', 'bar', 'baz'); // '/foo/bar/baz'
 * join('foo', '../bar');       // 'bar'
 * ```
 */
export function join(...segments: string[]): string {
  if (nodePath !== undefined) {
    return nodePath.join(...segments);
  }
  return joinFallback(...segments);
}

/**
 * Resolves a sequence of paths to an absolute path.
 * Delegates to `node:path/posix` when available.
 *
 * Processes segments right-to-left: each absolute segment resets the base,
 * relative segments prepend to the current result. When no segment is
 * absolute, prepends cwd (Node/Bun) or `/` (browser).
 * @param segments - Path segments to resolve
 * @returns Absolute, normalized path
 * @example
 * ```ts
 * resolve('/foo', 'bar', 'baz'); // '/foo/bar/baz'
 * resolve('foo', '/bar', 'baz'); // '/bar/baz'
 * ```
 */
export function resolve(...segments: string[]): string {
  if (nodePath !== undefined) {
    return nodePath.resolve(...segments);
  }
  return resolveFallback(...segments);
}

//region Fallback implementations -- pure JS, used only in browser

/**
 * Normalizes a path by resolving `.` and `..` segments and collapsing
 * consecutive slashes. Does not resolve against cwd — just cleans the string.
 * @param filePath - Raw path to normalize
 * @returns Normalized path
 */
function normalize(filePath: string): string {
  if (filePath === '') {
    return '.';
  }

  /** Whether the input is rooted */
  const isRoot = filePath.charCodeAt(0) === 47;
  /** Whether the input ends with a trailing slash */
  const trailingSlash = filePath.charCodeAt(filePath.length - 1) === 47;

  /** Path segments split on `/` */
  const parts = filePath.split('/');
  /** Stack of resolved segments built by walking the input */
  const resolved: string[] = [];

  for (const part of parts) {
    if (part === '' || part === '.') {
      continue;
    }
    if (part === '..') {
      // Don't pop past root
      if (resolved.length > 0 && resolved[resolved.length - 1] !== '..') {
        resolved.pop();
      } else if (!isRoot) {
        resolved.push('..');
      }
    } else {
      resolved.push(part);
    }
  }

  /** Joined result without root prefix */
  let result = resolved.join('/');

  if (isRoot) {
    result = '/' + result;
  }
  if (result === '' || result === '/') {
    return isRoot ? '/' : '.';
  }
  if (trailingSlash) {
    result += '/';
  }
  return result;
}

/** Browser fallback for {@link dirname}. */
function dirnameFallback(filePath: string): string {
  if (filePath === '') {
    return '.';
  }

  /** Whether the input path is rooted */
  const isRoot = filePath.charCodeAt(0) === 47;
  /** Index of the last slash, ignoring a trailing slash */
  let lastSlash = -1;

  // Walk backwards to find the last separator, skipping a trailing slash
  for (let charIndex = filePath.length - 1; charIndex >= 1; charIndex--) {
    if (filePath.charCodeAt(charIndex) === 47) {
      if (charIndex === filePath.length - 1) {
        continue;
      }
      lastSlash = charIndex;
      break;
    }
  }

  if (lastSlash === -1) {
    return isRoot ? '/' : '.';
  }
  if (isRoot && lastSlash === 0) {
    return '/';
  }
  return filePath.slice(0, lastSlash);
}

/** Browser fallback for {@link join}. */
function joinFallback(...segments: string[]): string {
  if (segments.length === 0) {
    return '.';
  }
  /** Raw concatenation of all non-empty segments */
  const joined = segments.filter((segment) => segment !== '').join('/');
  if (joined === '') {
    return '.';
  }
  return normalize(joined);
}

/** Browser fallback for {@link resolve}. */
function resolveFallback(...segments: string[]): string {
  /** Accumulated path built right-to-left */
  let resolved = '';
  /** Whether the accumulated path is already absolute */
  let resolvedAbsolute = false;

  // Walk segments right-to-left; stop once we have an absolute path
  for (let segmentIndex = segments.length - 1; segmentIndex >= 0 && !resolvedAbsolute; segmentIndex--) {
    /** Current segment being processed */
    const segment = segments[segmentIndex];
    if (segment === undefined || segment === '') {
      continue;
    }
    resolved = resolved === '' ? segment : segment + '/' + resolved;
    resolvedAbsolute = segment.charCodeAt(0) === 47;
  }

  // If still not absolute, prepend cwd (unavailable in browser, default to '/')
  if (!resolvedAbsolute) {
    /** Current working directory — falls back to `/` in browser */
    const cwd = typeof process !== 'undefined' && typeof process.cwd === 'function'
      ? process.cwd()
      : '/';
    resolved = cwd + '/' + resolved;
  }

  /** Normalized absolute path */
  const normalized = normalize(resolved);
  // resolve() never returns trailing slashes except for root '/'
  if (normalized.length > 1 && normalized.charCodeAt(normalized.length - 1) === 47) {
    return normalized.slice(0, -1);
  }
  return normalized;
}

//endregion Fallback implementations
