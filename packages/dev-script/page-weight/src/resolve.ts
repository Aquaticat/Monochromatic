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

import {
  $ as notNullishOrThrow,
} from '@monochromatic-dev/module-es/not-nullish-or-throw';

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
 * @returns absolute filesystem path under `root`, or `null` when the reference
 *   is external, escapes the root, or is malformed
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
    root: string;
    fromFile: string;
    ref: string;
  },
): string | null {
  const withoutFragment = notNullishOrThrow(ref.trim().split('#',)[0],);
  const trimmed = notNullishOrThrow(withoutFragment.split('?',)[0],);
  if (trimmed === '')
    return null;
  if (trimmed.startsWith('//',) || /^[a-z][a-z0-9+.-]*:/i.test(trimmed,))
    return null;

  const absoluteRoot = pathResolve(root,);
  const resolved = isAbsolute(trimmed,)
    ? pathResolve(absoluteRoot, `.${trimmed}`,)
    : pathResolve(dirname(fromFile,), trimmed,);

  const relativeToRoot = relative(absoluteRoot, resolved,);
  if (relativeToRoot.startsWith('..',) || isAbsolute(relativeToRoot,))
    return null;
  return resolved;
}
