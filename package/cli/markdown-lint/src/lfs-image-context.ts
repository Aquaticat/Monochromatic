/**
 Repository facts the `lfs-image-url` rule needs, discovered once per run and
 resolved per file before the synchronous rule runs: where the repository
 root is, which object base URL `.lfsconfig` declares, which paths git-lfs
 tracks, and what every referenced path resolves to.

 @module
 */

import {
  fileNamed,
  findRoot,
  type RootFilesystem,
  RootNotFoundError,
} from '@monochromatic-dev/module-fs-path/ts';
import { stat, } from 'node:fs/promises';
import {
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
 Marker for the nearest ancestor holding a regular `.lfsconfig` file.
 */
const LFS_CONFIG_MARKER = fileNamed(LFS_CONFIG_FILENAME,);

/**
 Parameters for {@link findLfsRepoRoot}.
 */
export type FindLfsRepoRootParams = {
  /**
   Directory to start from; a relative path resolves against the process
   working directory.
   */
  readonly cwd: string;
  /**
   Filesystem the walk probes. Omitted, the runtime's real filesystem;
   tests pass an in-memory adapter.
   */
  readonly fs?: RootFilesystem;
};

/**
 Nearest ancestor directory of `cwd` (inclusive) holding a `.lfsconfig`
 file, as a one-element list, or empty when no ancestor has one.

 @param cwd - directory to start from

 @param fs - filesystem seam, an in-memory adapter in tests

 @returns one repository root, or none

 @example
 ```ts
 const [root] = await findLfsRepoRoot({ cwd: process.cwd() });
 ```
 */
export async function findLfsRepoRoot({
  cwd,
  fs,
}: FindLfsRepoRootParams,): Promise<readonly string[]> {
  /**
   Absolute start directory.
   */
  const start = resolve(cwd,);
  try {
    return [
      await findRoot(
        fs === undefined
          ? {
            cwd: start,
            marker: LFS_CONFIG_MARKER,
          }
          : {
            cwd: start,
            fs,
            marker: LFS_CONFIG_MARKER,
          },
      ),
    ];
  }
  catch (error: unknown) {
    if (!(error instanceof RootNotFoundError))
      throw error;
    return [];
  }
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
  const [repoRoot,] = await findLfsRepoRoot({ cwd, },);
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
