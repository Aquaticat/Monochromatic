/**
 * URI conversion helpers for LSP communication.
 *
 * Centralizes the repeated `pathToFileURL(path).href` and
 * `uri.startsWith('file://') ? fileURLToPath(uri) : uri` patterns
 * that previously appeared across a dozen LSP feature files.
 */

import {
  fileURLToPath,
  pathToFileURL,
} from 'node:url';

/**
 * Converts an absolute file-system path to a `file://` URI string.
 *
 * @param path - absolute file-system path
 *
 * @returns RFC 8089 `file://` URI
 *
 * @example
 * ```ts
 * pathToUri({ path: '/home/user/project/src/main.ts' })
 * // => 'file:///home/user/project/src/main.ts'
 * ```
 */
export function pathToUri({ path, }: { readonly path: string; },): string {
  return pathToFileURL(path,)
    .href;
}

/**
 * Converts a URI to a file-system path, tolerating non-`file://` URIs.
 *
 * When the URI uses the `file://` scheme, delegates to `fileURLToPath`.
 * Otherwise returns the URI unchanged (e.g. for `untitled:` or `git:` schemes).
 *
 * @param uri - URI string, typically from an LSP Location or diagnostic
 *
 * @returns absolute file-system path (for `file://` URIs) or the original string
 *
 * @example
 * ```ts
 * const result = uriToPath({ uri: 'file:///home/user/project/src/main.ts', });
 * ```
 */
export function uriToPath({ uri, }: { readonly uri: string; },): string {
  return uri.startsWith('file://',) ? fileURLToPath(uri,) : uri;
}
