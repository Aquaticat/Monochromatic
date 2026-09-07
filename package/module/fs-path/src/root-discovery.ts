/**
 Shared upward-walk root discovery.

 Root finders in this package use these helpers to keep filesystem probing
 local and cross-runtime. The filesystem backend comes from the
 `#root-filesystem` import map entry (`node:fs/promises` under the `node`
 condition, the origin private file system otherwise), so this module
 names no platform API itself.

 @module
 */

import { tagged, } from '@monochromatic-dev/module-logger/ts';

import { dirname, } from '#posix-path';
import {
  defaultRootSearchCwd,
  resolveRootFilesystem,
} from '#root-filesystem';
import type { RootFilesystem, } from './root-filesystem-contract.ts';

export {
  ABSENT,
  type RootFilesystem,
} from './root-filesystem-contract.ts';

//region Types

/**
 Arguments supplied to a candidate-root matcher.
 */
export type RootMatcherArgs = {
  /**
   Directory currently being tested as root candidate.
   */
  readonly dir: string;

  /**
   Filesystem backend resolved for current runtime.
   */
  readonly fs: RootFilesystem;
};

/**
 Predicate that decides whether a directory is a root.
 */
export type RootMatcher = (args: RootMatcherArgs,) => Promise<boolean>;

/**
 Options for {@link findRootByWalkingUp}.
 */
export type FindRootByWalkingUpOptions = {
  /**
   Starting directory. Defaults to current process working directory.
   */
  readonly cwd?: string;

  /**
   Candidate-root predicate applied at each ancestor.
   */
  readonly matches: RootMatcher;

  /**
   Error message used when no ancestor matches.
   */
  readonly missingMessage: string;
};

/**
 Options for the internal upward walk.
 */
type WalkUpRootOptions = {
  /**
   Directory currently being tested.
   */
  readonly dir: string;

  /**
   Filesystem backend shared by every level.
   */
  readonly fs: RootFilesystem;

  /**
   Candidate-root predicate applied at each ancestor.
   */
  readonly matches: RootMatcher;

  /**
   Error message thrown when the filesystem root is reached without a match.
   */
  readonly missingMessage: string;
};

//endregion Types

//region Constants

/**
 Tagged logger for root discovery diagnostics.
 */
const rootDiscoveryLogger = tagged({ tag: 'rootDiscovery', },);

//endregion Constants

//region Upward walk

/**
 Walks upward from a candidate directory until matcher succeeds.

 @param dir - candidate directory tested first

 @param fs - filesystem backend used for all probes

 @param matches - predicate that identifies root directory

 @param missingMessage - error text thrown when no ancestor matches

 @returns matching root directory

 @throws when the filesystem root is reached without a match

 @example
 ```ts
 const root = await walkUpRoot({ dir: '/repo/src', fs, matches, missingMessage });
 ```
 */
async function walkUpRoot({
  dir,
  fs,
  matches,
  missingMessage,
}: WalkUpRootOptions,): Promise<string> {
  if (await matches({
    dir,
    fs,
  },))
    return dir;

  /**
   Parent directory inspected after current candidate misses.
   */
  const parent = dirname(dir,);
  if (parent === dir)
    throw new Error(missingMessage,);

  // Bounded structural walk: one level per call, ending at the filesystem
  // root, so the recursion depth is the path depth.
  return walkUpRoot({
    dir: parent,
    fs,
    matches,
    missingMessage,
  },);
}

/**
 Finds a root by walking upward from `cwd` and applying `matches`.

 @param cwd - starting directory, defaults to current process working directory

 @param matches - candidate-root predicate

 @param missingMessage - error text when no ancestor matches

 @returns matching root directory

 @throws when no ancestor satisfies `matches`

 @example
 ```ts
 const root = await findRootByWalkingUp({
   matches: async ({ dir, fs }) => await fs.exists(`${dir}/.git`),
   missingMessage: 'missing git root',
 });
 ```
 */
export async function findRootByWalkingUp({
  cwd,
  matches,
  missingMessage,
}: FindRootByWalkingUpOptions,): Promise<string> {
  /**
   Directory where upward search starts.
   */
  const startDir = cwd ?? defaultRootSearchCwd();
  rootDiscoveryLogger.debug(`starting root discovery from ${startDir}`,);

  /**
   Filesystem backend resolved once per walk.
   */
  const fs = await resolveRootFilesystem();
  /**
   Matching root using caller's runtime-native path identity.
   */
  const root = await walkUpRoot({
    dir: startDir,
    fs,
    matches,
    missingMessage,
  },);
  rootDiscoveryLogger.debug(`resolved root discovery result ${root}`,);
  return root;
}

//endregion Upward walk
