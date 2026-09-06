/**
 Repository facts the `lfs-image-url` rule needs, discovered once per run and
 resolved per file before the synchronous rule runs: where the repository
 root is, which object base URL `.lfsconfig` declares, which paths git-lfs
 tracks, and what every referenced path resolves to.

 @module
 */

import { stat, } from 'node:fs/promises';
import {
  dirname,
  join,
  resolve,
} from 'node:path';

import ignore, { type Ignore, } from 'ignore';

import { isAbsentPathError, } from './absent-path.ts';
import {
  LFS_CONFIG_FILENAME,
  readLfsObjectBase,
} from './lfs-config.ts';
import { candidateTargetPaths, } from './lfs-image-target.ts';
import { lfsOidOfFile, } from './lfs-oid.ts';
import {
  type LfsTrackedPredicate,
  readLfsTrackedMatcher,
} from './lfs-tracked.ts';
import { parse, } from './parse.ts';
import { repoRelative, } from './repo-relative.ts';

/**
 What a repo-relative path resolves to for image rewriting.
 */
export type LfsImageTarget = {
  /**
   Path exists and git-lfs tracks it.
   */
  readonly kind: 'lfs';
  /**
   Current object id of the file.
   */
  readonly oid: string;
} | {
  /**
   Path exists as an ordinary git blob.
   */
  readonly kind: 'plain';
} | {
  /**
   Path does not exist in the working tree, or was never referenced.
   */
  readonly kind: 'missing';
};

/**
 Per-file context handed to the rule through `RuleContext.lfs`.
 */
export type LfsImageContext = {
  /**
   Absolute path of the file under lint; relative image targets resolve
   against its directory.
   */
  readonly filePath: string;
  /**
   Absolute repository root, the directory holding `.lfsconfig`.
   */
  readonly repoRoot: string;
  /**
   Credential-free object base URL; objects are served at
   `<objectBase>/<oid>/<repo-relative-path>`.
   */
  readonly objectBase: string;
  /**
   Resolve a repo-relative path (forward slashes) to its target kind.
   Synchronous because every candidate was resolved while the context was
   prepared; a path the preparation never saw reads as missing.
   */
  readonly resolveTarget: (repoRelativePath: string,) => LfsImageTarget;
};

/**
 Repository-wide facts discovered once per run.
 */
export type LfsImageRepo = {
  /**
   Absolute repository root.
   */
  readonly repoRoot: string;
  /**
   Credential-free object base URL from `.lfsconfig`.
   */
  readonly objectBase: string;
  /**
   Whether a file under lint is excluded from the rule by the run's exclude
   patterns.
   */
  readonly isExcluded: (filePath: string,) => boolean;
  /**
   Whether git-lfs tracks a repo-relative path.
   */
  readonly isLfsTracked: LfsTrackedPredicate;
};

/**
 Whether `dir` holds a `.lfsconfig`.

 @param dir - directory to probe

 @returns `true` when the file exists
 */
async function hasLfsConfig(dir: string,): Promise<boolean> {
  try {
    await stat(join(
      dir,
      LFS_CONFIG_FILENAME,
    ),);
    return true;
  }
  catch (error) {
    if (isAbsentPathError(error,)) {
      return false;
    }
    throw error;
  }
}

/**
 Every ancestor directory of `cwd` (inclusive), nearest first, ending at the
 filesystem root. Built with a cursor rather than recursion.

 @param cwd - directory to start from

 @returns ancestors from `cwd` up to the root
 */
function ancestorsOf(cwd: string,): readonly string[] {
  /**
   Ancestors collected so far.
   */
  const chain: string[] = [];
  for (
    let dir = resolve(cwd,);
    ;
    dir = dirname(dir,)
  ) {
    chain.push(dir,);
    if (dirname(dir,) === dir) {
      return chain;
    }
  }
}

/**
 Nearest ancestor directory of `cwd` (inclusive) holding `.lfsconfig`, as a
 one-element list, or empty when no ancestor has one. Every ancestor is
 probed concurrently and the nearest hit wins.

 @param cwd - directory to start from

 @returns one repository root, or none
 */
async function findLfsRepoRoot(cwd: string,): Promise<readonly string[]> {
  /**
   Ancestors, nearest first.
   */
  const ancestors = ancestorsOf(cwd,);
  /**
   Whether each ancestor holds a `.lfsconfig`, in the same order.
   */
  const present = await Promise.all(ancestors.map(function probe(dir: string,): Promise<boolean> {
    return hasLfsConfig(dir,);
  },),);
  return ancestors
    .filter(function holdsConfig(
      _dir: string,
      index: number,
    ): boolean {
      return present[index] === true;
    },)
    .slice(
      0,
      1,
    );
}

/**
 Parameters for {@link discoverLfsImageRepo}.
 */
export type DiscoverLfsImageRepoParams = {
  /**
   Directory the search for `.lfsconfig` starts from.
   */
  readonly cwd: string;
  /**
   gitignore-syntax patterns, relative to the repository root, naming files
   the rule must leave alone.
   */
  readonly exclude: readonly string[];
};

/**
 Discover the repository facts once per run. Returns a one-element list, or
 empty when no ancestor of `cwd` has a `.lfsconfig` declaring an endpoint,
 which makes the rule inert for the run.

 @param cwd - directory the search for `.lfsconfig` starts from

 @param exclude - gitignore-syntax patterns for files the rule must leave alone

 @returns one repository description, or none

 @example
 ```ts
 const [repo] = await discoverLfsImageRepo({ cwd: process.cwd(), exclude: [] });
 ```
 */
export async function discoverLfsImageRepo({
  cwd,
  exclude,
}: DiscoverLfsImageRepoParams,): Promise<readonly LfsImageRepo[]> {
  /**
   Repository root, when one declares `.lfsconfig`.
   */
  const [repoRoot,] = await findLfsRepoRoot(cwd,);
  if (repoRoot === undefined) {
    return [];
  }
  /**
   Object base URL, when `.lfsconfig` declares an endpoint.
   */
  const [objectBase,] = await readLfsObjectBase(repoRoot,);
  if (objectBase === undefined) {
    return [];
  }
  /**
   Matcher over the exclude patterns.
   */
  const excluded: Ignore = ignore()
    .add([...exclude,],);
  /**
   Predicate over `.gitattributes`.
   */
  const isLfsTracked = await readLfsTrackedMatcher(repoRoot,);
  return [{
    repoRoot,
    objectBase,
    isExcluded: function isExcluded(filePath: string,): boolean {
      /**
       File path relative to the root, or outside it.
       */
      const rel = repoRelative({
        repoRoot,
        path: filePath,
      },);
      return (!rel.startsWith('../',)) && (rel !== '..')
        && excluded.ignores(rel,);
    },
    isLfsTracked,
  },];
}

/**
 Parameters for {@link resolveLfsImageTarget}.
 */
type ResolveLfsImageTargetParams = {
  /**
   Repository facts.
   */
  readonly repo: LfsImageRepo;
  /**
   Forward-slash repo-relative path to resolve.
   */
  readonly repoRelativePath: string;
};

/**
 Resolve one repo-relative path against the working tree.

 @param repo - repository facts

 @param repoRelativePath - forward-slash repo-relative path to resolve

 @returns target kind, with the current oid for an LFS-tracked file
 */
async function resolveLfsImageTarget({
  repo,
  repoRelativePath,
}: ResolveLfsImageTargetParams,): Promise<LfsImageTarget> {
  /**
   Absolute path of the referenced file.
   */
  const absolute = join(
    repo.repoRoot,
    ...repoRelativePath.split('/',),
  );
  try {
    if (!(await stat(absolute,)).isFile()) {
      return { kind: 'missing', };
    }
  }
  catch (error) {
    if (isAbsentPathError(error,)) {
      return { kind: 'missing', };
    }
    throw error;
  }
  if (!repo.isLfsTracked(repoRelativePath,)) {
    return { kind: 'plain', };
  }
  return {
    kind: 'lfs',
    oid: await lfsOidOfFile(absolute,),
  };
}

/**
 Parameters for {@link prepareLfsImageContext}.
 */
export type PrepareLfsImageContextParams = {
  /**
   Repository facts from {@link discoverLfsImageRepo}.
   */
  readonly repo: LfsImageRepo;
  /**
   Absolute path of the file under lint.
   */
  readonly filePath: string;
  /**
   Source of the file under lint.
   */
  readonly source: string;
  /**
   Whether the source is MDX.
   */
  readonly mdx: boolean;
};

/**
 Prepare one file's rule context: parse the source, collect every path an
 image or definition may name, resolve them all concurrently, and expose the
 answers through a synchronous lookup. Fix passes re-parse the source, but a
 fix only ever swaps a destination between the relative and object forms of
 the same path, so the candidate set is stable across passes.

 @param repo - repository facts from {@link discoverLfsImageRepo}

 @param filePath - absolute path of the file under lint

 @param source - source of the file under lint

 @param mdx - whether the source is MDX

 @returns context for `RuleContext.lfs`

 @example
 ```ts
 const lfs = await prepareLfsImageContext({ repo, filePath, source, mdx: false });
 ```
 */
export async function prepareLfsImageContext({
  repo,
  filePath,
  source,
  mdx,
}: PrepareLfsImageContextParams,): Promise<LfsImageContext> {
  /**
   Distinct paths the file may reference.
   */
  const candidates = candidateTargetPaths({
    tree: parse({
      source,
      mdx,
    },),
    filePath,
    repoRoot: repo.repoRoot,
    objectBase: repo.objectBase,
  },);
  /**
   Resolved targets keyed by repo-relative path.
   */
  const targets = new Map<string, LfsImageTarget>(await Promise.all(
    [...candidates,].map(async function resolveEntry(repoRelativePath: string,): Promise<readonly [
      string,
      LfsImageTarget,
    ]> {
      return [
        repoRelativePath,
        await resolveLfsImageTarget({
          repo,
          repoRelativePath,
        },),
      ];
    },),
  ),);
  return {
    filePath,
    repoRoot: repo.repoRoot,
    objectBase: repo.objectBase,
    resolveTarget: function resolveTarget(repoRelativePath: string,): LfsImageTarget {
      return targets.get(repoRelativePath,) ?? { kind: 'missing', };
    },
  };
}
