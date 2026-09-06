/**
 Pure classification of image destinations for the `lfs-image-url` rule,
 shared by the rule (which decides fixes) and the context builder (which
 resolves every candidate path ahead of the synchronous rule run).

 @module
 */

import type { ReadonlyDeep, } from 'type-fest';
import type { Root, } from 'mdast';
import {
  dirname,
  resolve,
} from 'node:path';

import { isLfsOid, } from './lfs-oid.ts';
import { repoRelative, } from './repo-relative.ts';
import { walk, } from './walk.ts';

/**
 Whether a URL carries a scheme (`https:`, `mailto:`, `data:`), decided by an
 index scan over the characters before the first `:`.

 @param url - destination as written

 @returns `true` when the destination is scheme-qualified
 */
function hasScheme(url: string,): boolean {
  /**
   Position of the first colon.
   */
  const colon = url.indexOf(':',);
  if (colon <= 0) {
    return false;
  }
  for (let index = 0; index < colon; index += 1) {
    /**
     Character under inspection.
     */
    const character = url.charAt(index,);
    /**
     Whether the character may appear in a URL scheme.
     */
    const allowed = ((character >= 'a') && (character <= 'z'))
      || ((character >= 'A') && (character <= 'Z'))
      || ((character >= '0') && (character <= '9'))
      || (character === '+')
      || (character === '-')
      || (character === '.');
    if (!allowed) {
      return false;
    }
  }
  return true;
}

/**
 Whether a destination is a path inside the working tree rather than a
 fragment, a site-absolute path, or a scheme-qualified URL.

 @param url - destination as written

 @returns `true` for relative file paths

 @example
 ```ts
 isRelativePath('asset/shot.png'); // true
 isRelativePath('https://x.example/shot.png'); // false
 isRelativePath('#top'); // false
 ```
 */
export function isRelativePath(url: string,): boolean {
  return (url !== '') && (!url.startsWith('#',))
    && (!url.startsWith('/',))
    && (!hasScheme(url,));
}

/**
 Destination without its query and fragment, which never name a file.

 @param url - destination as written

 @returns path part of the destination
 */
function pathPart(url: string,): string {
  /**
   Position of the first query or fragment delimiter, or the full length.
   */
  const cut = [
    url.indexOf('?',),
    url.indexOf('#',),
  ]
    .filter(function found(index: number,): boolean {
      return index !== (-1);
    },)
    .reduce(
      function min(
      left: number,
      right: number,
    ): number {
      return Math.min(
        left,
        right,
      );
    },
      url.length,
    );
  return url.slice(
    0,
    cut,
  );
}

/**
 Parameters for {@link relativeTargetPath}.
 */
export type RelativeTargetPathParams = {
  /**
   Destination as written.
   */
  readonly url: string;
  /**
   Absolute path of the Markdown file the destination is relative to.
   */
  readonly filePath: string;
  /**
   Absolute repository root.
   */
  readonly repoRoot: string;
};

/**
 Repo-relative path a relative destination names, as a one-element list, or
 empty when the destination is not a relative path or escapes the root.

 @param url - destination as written

 @param filePath - absolute path of the Markdown file the destination is relative to

 @param repoRoot - absolute repository root

 @returns one forward-slash repo-relative path, or none

 @example
 ```ts
 relativeTargetPath({ url: '../asset/a.png?x#y', filePath: '/r/pkg/doc/README.md', repoRoot: '/r' });
 // ['pkg/asset/a.png']
 ```
 */
export function relativeTargetPath({
  url,
  filePath,
  repoRoot,
}: RelativeTargetPathParams,): readonly string[] {
  if (!isRelativePath(url,)) {
    return [];
  }
  /**
   Absolute path the destination names.
   */
  const absolute = resolve(
    dirname(filePath,),
    ...pathPart(url,)
      .split('/',),
  );
  /**
   Repo-relative path, or a path escaping the root.
   */
  const repoRelativePath = repoRelative({
    repoRoot,
    path: absolute,
  },);
  if (repoRelativePath.startsWith('../',) || (repoRelativePath === '..')
    || (repoRelativePath === '')) {
    return [];
  }
  return [repoRelativePath,];
}

/**
 Parts of an object URL under the repository's object base.
 */
export type ObjectUrlParts = {
  /**
   Embedded object id.
   */
  readonly oid: string;
  /**
   Embedded forward-slash repo-relative path.
   */
  readonly repoRelativePath: string;
};

/**
 Parameters for {@link objectUrlParts}.
 */
export type ObjectUrlPartsParams = {
  /**
   Destination as written.
   */
  readonly url: string;
  /**
   Credential-free object base URL.
   */
  readonly objectBase: string;
};

/**
 Parse `<objectBase>/<oid>/<path>` into its parts, as a one-element list, or
 empty when the destination is not under the base or lacks an oid and path.

 @param url - destination as written

 @param objectBase - credential-free object base URL

 @returns one parts record, or none

 @example
 ```ts
 objectUrlParts({ url: `https://lfs.example/${'a'.repeat(64)}/pkg/a.png`, objectBase: 'https://lfs.example' });
 // [{ oid: 'aaaa…', repoRelativePath: 'pkg/a.png' }]
 ```
 */
export function objectUrlParts({
  url,
  objectBase,
}: ObjectUrlPartsParams,): readonly ObjectUrlParts[] {
  if (!url.startsWith(`${objectBase}/`,)) {
    return [];
  }
  /**
   `<oid>/<path>` after the base, without query or fragment.
   */
  const rest = pathPart(url,)
    .slice(objectBase.length + 1,);
  /**
   Boundary between oid and path.
   */
  const slash = rest.indexOf('/',);
  if (slash === (-1)) {
    return [];
  }
  /**
   Embedded oid.
   */
  const oid = rest.slice(
    0,
    slash,
  );
  /**
   Embedded repo-relative path.
   */
  const repoRelativePath = rest.slice(slash + 1,);
  if ((!isLfsOid(oid,)) || (repoRelativePath === '')) {
    return [];
  }
  return [{
    oid,
    repoRelativePath,
  },];
}

/**
 Parameters for {@link candidateTargetPaths}.
 */
export type CandidateTargetPathsParams = {
  /**
   mdast tree of the file.
   */
  readonly tree: ReadonlyDeep<Root>;
  /**
   Absolute path of the file.
   */
  readonly filePath: string;
  /**
   Absolute repository root.
   */
  readonly repoRoot: string;
  /**
   Credential-free object base URL.
   */
  readonly objectBase: string;
};

/**
 Every repo-relative path an image or definition in the tree may resolve to,
 so the context builder can resolve them all before the synchronous rule run.

 @param tree - mdast tree of the file

 @param filePath - absolute path of the file

 @param repoRoot - absolute repository root

 @param objectBase - credential-free object base URL

 @returns distinct repo-relative paths

 @example
 ```ts
 candidateTargetPaths({ tree, filePath, repoRoot, objectBase }); // Set { 'pkg/asset/a.png' }
 ```
 */
export function candidateTargetPaths({
  tree,
  filePath,
  repoRoot,
  objectBase,
}: CandidateTargetPathsParams,): ReadonlySet<string> {
  /**
   Paths collected across the walk.
   */
  const paths = new Set<string>();
  for (const { node, } of walk(tree,)) {
    if ((node.type !== 'image') && (node.type !== 'definition')) {
      continue;
    }
    for (const parts of objectUrlParts({
      url: node.url,
      objectBase,
    },)) {
      paths.add(parts.repoRelativePath,);
    }
    for (const path of relativeTargetPath({
      url: node.url,
      filePath,
      repoRoot,
    },)) {
      paths.add(path,);
    }
  }
  return paths;
}
