/**
 * POSIX path utilities that work in both Node/Bun and browser environments.
 *
 * When `node:path` is available (Node/Bun), delegates to `node:path/posix`
 * for correctness. Falls back to a pure-JS reimplementation in browser
 * environments where `node:path` does not exist.
 *
 * Exports: {@link dirname}, {@link join}, {@link resolve}, {@link isAbsolute},
 * {@link sep}, and fs-ensuring utilities from `./ensure.ts`, `./empty.ts`,
 * and `./trim.ts`.
 */

export {
  emptyDir,
  emptyFile,
  emptyPath,
  removeEmptyFilesInDir,
} from './empty.ts';
export {
  ensureDir,
  ensureFile,
  ensurePath,
} from './ensure.ts';
export {
  trimLeadingSlash,
  trimTrailingSlash,
} from './trim.ts';

//region Node delegation -- use real node:path/posix when the runtime has it

import {
  dirnameFallback,
  joinFallback,
  resolveFallback,
} from './fallbacks.ts';

/**
 * Whether the runtime provides Node-compatible path APIs.
 * Bun and Node both set `process.versions.node`.
 */
/* oxlint-disable-next-line typescript/no-unnecessary-condition -- runtime guard for browser environments where process is undefined or process.versions may be absent */
const hasNodePath = typeof process !== 'undefined'
  // oxlint-disable-next-line typescript/no-unnecessary-condition -- process.versions may be absent in non-Node browser polyfills
  && process.versions?.node !== undefined;

/** Computed import specifier to prevent static bundler resolution */
// oxlint-disable-next-line typescript/no-unnecessary-template-expression -- template expression prevents static bundler resolution
const nodePathSpecifier = `node${':path'}`;

/**
 * Lazily loaded `node:path/posix` module, or undefined in browser.
 * Uses top-level await with a computed specifier (`'node' + ':path'`)
 * so browser bundlers cannot statically resolve the import.
 * Top-level await is valid in ESM and supported by Bun and Node 14.8+.
 */
// oxlint-disable-next-line typescript/consistent-type-imports -- dynamic import cannot use `import type` syntax
const nodePath: typeof import('node:path/posix') | undefined = hasNodePath
  // oxlint-disable-next-line typescript/consistent-type-imports -- dynamic import type cast
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion, typescript/consistent-type-imports -- cast dynamic import to known node:path type
  ? (await import(nodePathSpecifier) as typeof import('node:path')).posix
  : undefined;

//endregion Node delegation

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
export function dirname(filePath: string,): string {
  if (nodePath !== undefined)
    return nodePath.dirname(filePath,);
  return dirnameFallback(filePath,);
}

/**
 * Whether a POSIX path is absolute (starts with `/`).
 * Delegates to `node:path/posix` when available.
 *
 * @param filePath - Path to check
 *
 * @returns True when the path starts with `/`
 */
export function isAbsolute(filePath: string,): boolean {
  if (nodePath !== undefined)
    return nodePath.isAbsolute(filePath,);
  /** Unicode code point for `/` */
  const SLASH_CODE_POINT = 47;
  return filePath.length > 0 && filePath.codePointAt(0,) === SLASH_CODE_POINT;
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
  if (nodePath !== undefined)
    return nodePath.join(...segments,);
  return joinFallback(...segments,);
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
  if (nodePath !== undefined)
    return nodePath.resolve(...segments,);
  return resolveFallback(...segments,);
}
