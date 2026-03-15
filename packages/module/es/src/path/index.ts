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
// oxlint-disable-next-line typescript/no-unnecessary-condition -- runtime guard for browser environments where process is undefined
const hasNodePath = typeof process !== 'undefined' && process.versions?.node !== undefined;

/**
 * Lazily loaded `node:path/posix` module, or undefined in browser.
 * Uses top-level await with a computed specifier (`'node' + ':path'`)
 * so browser bundlers cannot statically resolve the import.
 * Top-level await is valid in ESM and supported by Bun and Node 14.8+.
 */
// oxlint-disable-next-line typescript/consistent-type-imports -- dynamic import cannot use `import type` syntax
const nodePath: typeof import('node:path/posix') | undefined = hasNodePath
  // oxlint-disable-next-line typescript/consistent-type-imports -- dynamic import type cast
  ? (await import('node' + ':path') as typeof import('node:path')).posix
  : undefined;

//endregion Node delegation

import { dirnameFallback, joinFallback, resolveFallback, } from './fallbacks.ts';

/** POSIX path separator */
export const sep = '/';

/**
 * Returns the directory portion of a POSIX path.
 * Delegates to `node:path/posix` when available.
 *
 * @param filePath - Absolute or relative POSIX path
 *
 * @returns Parent directory path
 *
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
 *
 * @param filePath - Path to check
 *
 * @returns True when the path starts with `/`
 */
export function isAbsolute(filePath: string): boolean {
  if (nodePath !== undefined) {
    return nodePath.isAbsolute(filePath);
  }
  return filePath.length > 0 && filePath.codePointAt(0) === 47;
}

/**
 * Joins path segments with `/` and normalizes the result.
 * Delegates to `node:path/posix` when available.
 *
 * @param segments - Path segments to join
 *
 * @returns Joined and normalized path
 *
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
 *
 * @param segments - Path segments to resolve
 *
 * @returns Absolute, normalized path
 *
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
