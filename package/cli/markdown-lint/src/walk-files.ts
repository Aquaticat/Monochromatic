import {
  readdir,
  readFile,
} from 'node:fs/promises';
import {
  extname,
  join,
  relative,
  resolve,
  sep,
} from 'node:path';

import ignore, { type Ignore, } from 'ignore';

/**
 * Lintable extensions mapped to whether the file is parsed as MDX. The walk
 * only ever reads these, so a binary or non-text file is never opened (the
 * misuse that OOMed `markdownlint-cli2` cannot recur).
 */
const LINTABLE_EXTENSIONS: ReadonlyMap<string, boolean> = new Map([
  [
    '.md',
    false,
  ],
  [
    '.mdx',
    true,
  ],
],);

/**
 * Directories ignored in addition to whatever `.gitignore` files declare.
 * `.git` and `node_modules` are skipped for speed; the paused, deprecated, and
 * out-of-scope trees carry Markdown that is intentionally not linted (the
 * explicit `ignores` the old `.markdownlint-cli2.jsonc` carried).
 */
const DEFAULT_IGNORES: readonly string[] = [
  '.git',
  'node_modules',
  'package-paused',
  'package-deprecated',
  '.out-of-scope',
];

/**
 * Node filesystem error code for absent paths.
 */
const FILE_NOT_FOUND_ERROR_CODE = 'ENOENT';

/**
 * One `.gitignore` scope: a base directory and the matcher built from the
 * patterns declared there. A path is tested relative to the base.
 */
type IgnoreLayer = {
  /**
   * Absolute directory the patterns are anchored to.
   */
  readonly base: string;
  /**
   * Compiled ignore matcher for this scope.
   */
  readonly ig: Ignore;
};

/**
 * A file discovered by the walk, with its parse mode resolved from extension.
 */
export type DiscoveredFile = {
  /**
   * Absolute path to the file.
   */
  readonly path: string;
  /**
   * Whether to parse the file as MDX.
   */
  readonly mdx: boolean;
};

/**
 * Read a directory's `.gitignore`, returning its contents or an empty string
 * when absent. Absence is the common case, but other read failures surface
 * instead of being silently swallowed.
 *
 * @param dir - directory to read `.gitignore` from
 *
 * @returns `.gitignore` contents, or empty string when there is none
 */
async function readGitignore(dir: string,): Promise<string> {
  try {
    return await readFile(
      join(
        dir,
        '.gitignore',
      ),
      'utf8',
    );
  } catch (error) {
    if (!(Error.isError(error,))) {
      throw error;
    }
    if (!('code' in error)) {
      throw error;
    }
    /**
     * Node filesystem error code attached to the failed `.gitignore` read.
     */
    const { code, } = error as { readonly code: unknown; };
    if (code !== FILE_NOT_FOUND_ERROR_CODE) {
      throw error;
    }
    return '';
  }
}

/**
 * Parameters for {@link isIgnored}.
 */
type IsIgnoredParams = {
  /**
   * Active ignore layers, ancestors first.
   */
  readonly layers: readonly IgnoreLayer[];
  /**
   * Absolute path being tested.
   */
  readonly absPath: string;
  /**
   * Whether the path is a directory (matched against directory patterns).
   */
  readonly isDir: boolean;
};

/**
 * Whether any active layer ignores a path. Each layer tests the path relative
 * to its own base, skipping layers the path is not under, which is git's
 * nested-`.gitignore` model.
 *
 * @param layers - active ignore layers, ancestors first
 *
 * @param absPath - absolute path being tested
 *
 * @param isDir - whether the path is a directory
 *
 * @returns whether the path is ignored
 */
function isIgnored({
  layers,
  absPath,
  isDir,
}: IsIgnoredParams,): boolean {
  return layers.some(function layerIgnores(layer: IgnoreLayer,): boolean {
    /**
     * Path relative to this layer's base, in POSIX form for the matcher.
     */
    const rel = relative(
      layer.base,
      absPath,
    )
      .split(sep,)
      .join('/',);
    if ((rel === '') || rel.startsWith('../',)) {
      return false;
    }
    return layer.ig
      .ignores(isDir ? `${rel}/` : rel,);
  },);
}

/**
 * Discover every lintable file under one root, honouring `.gitignore` files at
 * each level plus the default ignores. Traversal is an explicit work-stack, not
 * recursion, so a deep tree cannot overflow the call stack.
 *
 * @param root - directory to walk
 *
 * @returns lintable files found under the root, with parse mode resolved
 */
async function discoverUnder(root: string,): Promise<readonly DiscoveredFile[]> {
  /**
   * Absolute root the walk starts from.
   */
  const absRoot = resolve(root,);
  /**
   * Files accumulated across the walk.
   */
  const results: DiscoveredFile[] = [];
  /**
   * Directories still to visit, each carrying the ignore layers inherited from
   * its ancestors. The seed layer holds the default ignores, anchored at the
   * root so they apply everywhere.
   */
  const stack: {
    readonly dir: string;
    readonly layers: readonly IgnoreLayer[];
  }[] = [{
    dir: absRoot,
    layers: [{
      base: absRoot,
      ig: ignore()
        .add(DEFAULT_IGNORES,),
    },],
  },];
  while (stack.length > 0) {
    /**
     * Directory frame popped from the work-stack.
     */
    const frame = stack.pop();
    if (frame === undefined) {
      continue;
    }
    /**
     * This directory's `.gitignore` contents and its entries, read together.
     */
    // oxlint-disable-next-line eslint/no-await-in-loop -- the work-stack walk cannot know a directory's children until it is read, so each frame is an inherently sequential await; the per-directory Promise.all is the bounded unit of concurrency.
    const [gitignore, entries,] = await Promise.all([
      readGitignore(frame.dir,),
      readdir(
        frame.dir,
        { withFileTypes: true, },
      ),
    ],);
    /**
     * Ignore layers in effect for this directory's entries.
     */
    const layers: readonly IgnoreLayer[] = gitignore === ''
      ? frame.layers
      : [
        ...frame.layers,
        {
          base: frame.dir,
          ig: ignore()
            .add(gitignore,),
        },
      ];
    for (const entry of entries) {
      /**
       * Absolute path of this entry.
       */
      const absPath = join(
        frame.dir,
        entry.name,
      );
      if (entry.isDirectory()) {
        if (!isIgnored({
          layers,
          absPath,
          isDir: true,
        },)) {
          stack.push({
            dir: absPath,
            layers,
          },);
        }
        continue;
      }
      if (!entry.isFile()) {
        continue;
      }
      /**
       * Parse mode for this extension, or undefined when not lintable.
       */
      const mdx = LINTABLE_EXTENSIONS.get(extname(entry.name,),);
      if (mdx === undefined) {
        continue;
      }
      if (isIgnored({
        layers,
        absPath,
        isDir: false,
      },)) {
        continue;
      }
      results.push({
        path: absPath,
        mdx,
      },);
    }
  }
  return results;
}

/**
 * Resolve a single explicit file argument: a one-element list when its
 * extension is lintable, empty otherwise. Returning a list (rather than a
 * nullable) lets callers `flat()` the result and keeps the type free of a
 * banned nullish union. Explicit files bypass the gitignore walk: naming a file
 * is an explicit request to lint it.
 *
 * @param path - file path the user named explicitly
 *
 * @returns one discovered file, or empty for a non-lintable extension
 *
 * @example
 * ```ts
 * explicitFile('readme.md'); // [{ path: '/abs/readme.md', mdx: false }]
 * explicitFile('logo.png');  // []
 * ```
 */
export function explicitFile(path: string,): readonly DiscoveredFile[] {
  /**
   * Parse mode for the file's extension, or undefined when not lintable.
   */
  const mdx = LINTABLE_EXTENSIONS.get(extname(path,),);
  return mdx === undefined
    ? []
    : [{
      path: resolve(path,),
      mdx,
    },];
}

/**
 * Discover lintable files under one or more directory roots, deduplicated by
 * absolute path.
 *
 * @param roots - directories to walk
 *
 * @returns unique lintable files across all roots
 *
 * @example
 * ```ts
 * await discoverFiles(['.']); // every .md/.mdx not gitignored
 * ```
 */
export async function discoverFiles(roots: readonly string[],): Promise<readonly DiscoveredFile[]> {
  /**
   * Discovered files per root, before deduplication.
   */
  const perRoot = await Promise.all(roots.map(function under(root: string,): Promise<readonly DiscoveredFile[]> {
    return discoverUnder(root,);
  },),);
  /**
   * Files keyed by absolute path, collapsing roots that overlap.
   */
  const byPath = new Map<string, DiscoveredFile>();
  for (const file of perRoot.flat()) {
    byPath.set(
      file.path,
      file,
    );
  }
  return [...byPath.values(),];
}
