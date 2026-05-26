/**
 * Path resolution for local asset references.
 *
 * Turns URL strings as they appear in HTML/CSS into absolute filesystem paths
 * under the dist root. Rejects anything that cannot be served by the static
 * file server (external origins, escaping paths, data URIs).
 */
import {
  dirname,
  isAbsolute,
  relative,
  resolve as pathResolve,
} from 'node:path';

import { nonNullishOrThrow, } from '@monochromatic-dev/module-or-throw';

import {
  ABSENT,
  type Maybe,
} from './maybe.ts';
import { startsWithUriScheme, } from './url-detect.ts';

/**
 * Resolves a reference string to an absolute path under the dist root.
 *
 * @param root - absolute path of the dist root; references starting with `/`
 *   are resolved against this
 *
 * @param fromFile - absolute path of the file containing the reference;
 *   relative references are resolved against this file's directory
 *
 * @param ref - raw reference string (URL or path) from HTML or CSS
 *
 * @returns absolute filesystem path under `root`, or {@link ABSENT} when the
 *   reference is external, escapes the root, or is malformed
 *
 * @example
 * ```ts
 * resolveReference({
 *   root: '/srv/dist',
 *   fromFile: '/srv/dist/en/post.html',
 *   ref: '../styles.css',
 * });
 * // '/srv/dist/styles.css'
 * ```
 */
export function resolveReference(
  {
    root,
    fromFile,
    ref,
  }: {
    readonly root: string;
    readonly fromFile: string;
    readonly ref: string;
  },
): Maybe<string> {
  /** Reference with any `#fragment` removed; fragments do not affect the served file. */
  const withoutFragment = nonNullishOrThrow(ref.trim()
    .split('#',)[0],);
  /** Reference with the query string also stripped; query parameters do not change the path on disk. */
  const trimmed = nonNullishOrThrow(withoutFragment.split('?',)[0],);
  if (trimmed === '')
    return ABSENT;
  if (trimmed.startsWith('//',)
    || startsWithUriScheme(trimmed,))
    return ABSENT;

  /** Canonical absolute form of the dist root used as the containment boundary. */
  const absoluteRoot = pathResolve(root,);
  /**
   * Absolute filesystem path for the reference.
   *
   * Root-absolute refs (`/foo.css`) join against `absoluteRoot`; relative refs join
   * against the directory of the file that contains the reference.
   */
  const resolved = isAbsolute(trimmed,)
    ? pathResolve(
      absoluteRoot,
      `.${trimmed}`,
    )
    : pathResolve(
      dirname(fromFile,),
      trimmed,
    );

  /** Path of `resolved` relative to `absoluteRoot`; used to detect escapes via `..` or absolute output. */
  const relativeToRoot = relative(
    absoluteRoot,
    resolved,
  );
  if (relativeToRoot.startsWith('..',)
    || isAbsolute(relativeToRoot,))
    return ABSENT;
  return resolved;
}
