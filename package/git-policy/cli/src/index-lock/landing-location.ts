/**
 Where a forwarded command's landing lock and real index live,
 and the landing-lock acquisition shared by index writers and `git cli-git fix`.

 @module
 */
import { join, } from 'node:path';
import { caughtValueText, } from '@monochromatic-dev/module-caught-value/ts';
import { tagged, } from '@monochromatic-dev/module-logger/ts';
import nanoSpawn, { SubprocessError, } from 'nano-spawn';
import type { OwnerLock, } from '../owner-lock/owner-lock.ts';
import { parseGlobalOptions, } from '../parse-global-options.ts';
import { acquireLandingLock, } from '../policy-engine/commit-landing-lock.ts';
import { ensureTransactionRoot, } from '../policy-engine/commit-transaction-registry.ts';

/**
 Module logger.
 */
const l = tagged({ tag: 'cli-git', },);

/**
 The command runs outside any repository.
 */
export const LANDING_LOCATION_ABSENT: unique symbol = Symbol('Git rev-parse found no repository to coordinate an index writer with landings',);

/**
 Landing lock and index paths of one repository selection.
 */
export type LandingLocation = Readonly<{
  /**
   Directory Git commands of the selection run in.
   */
  cwd: string;
  /**
   Per-worktree Git directory.
   */
  gitDir: string;
  /**
   Index Git would use, honouring `GIT_INDEX_FILE`.
   */
  indexPath: string;
  /**
   The worktree's real index, `<git-dir>/index`.
   */
  realIndexPath: string;
  /**
   Transaction registry holding the landing lock.
   */
  registryRoot: string;
}>;

/**
 Resolves the landing lock and index paths for Git global options.

 @param gitPath - real Git executable

 @param globalArgs - global options before the subcommand, including `-C`, `-c`, and `--git-dir`

 @returns location, or absence outside a repository

 @example
 ```ts
 await resolveLandingLocation({ gitPath: '/usr/bin/git', globalArgs: [] });
 ```
 */
export async function resolveLandingLocation({
  gitPath,
  globalArgs,
}: Readonly<{
  gitPath: string;
  globalArgs: readonly string[];
}>,): Promise<LandingLocation | typeof LANDING_LOCATION_ABSENT> {
  /**
   Directory after `-C` options.
   */
  const { effectiveCwd, } = parseGlobalOptions([
    ...globalArgs,
    'rev-parse',
  ],);
  try {
    /**
     Absolute layout lines.
     */
    const { stdout, } = await nanoSpawn(
      gitPath,
      [
        ...globalArgs,
        'rev-parse',
        '--path-format=absolute',
        '--absolute-git-dir',
        '--git-path',
        'index',
        '--git-path',
        'cli-git-transactions',
      ],
    );
    /**
     Fixed-order lines.
     */
    const [gitDir, indexPath, registryRoot,] = stdout.split('\n',);
    if ((gitDir === undefined) || (indexPath === undefined)
      || (registryRoot === undefined))
      throw new TypeError(`Unexpected rev-parse layout: ${JSON.stringify(stdout,)}`,);
    return {
      cwd: effectiveCwd,
      gitDir,
      indexPath,
      realIndexPath: join(
        gitDir,
        'index',
      ),
      registryRoot,
    };
  }
  catch (error: unknown) {
    if (error instanceof SubprocessError) {
      l.debug(`no repository for landing coordination: ${caughtValueText(error,)}`,);
      return LANDING_LOCATION_ABSENT;
    }
    throw error;
  }
}

/**
 Acquires the landing lock of a location, creating the registry when absent.

 @param gitPath - real Git executable

 @param location - landing location

 @returns held landing lock, or the ancestor's under an inherited lease

 @example
 ```ts
 await using lock = await acquireLocationLandingLock({ gitPath, location });
 ```
 */
export async function acquireLocationLandingLock({
  gitPath,
  location,
}: Readonly<{
  gitPath: string;
  location: LandingLocation;
}>,): Promise<OwnerLock> {
  await ensureTransactionRoot(location.registryRoot,);
  return await acquireLandingLock({
    gitPath,
    cwd: location.cwd,
    registryRoot: location.registryRoot,
  },);
}

/**
 Acquires the landing lock of the repository that global options select.

 @param gitPath - real Git executable

 @param globalArgs - global options before the subcommand

 @returns held landing lock, or the ancestor's under an inherited lease

 @throws {@link TypeError} outside a repository

 @example
 ```ts
 await using lock = await acquireSelectedLandingLock({ gitPath: '/usr/bin/git', globalArgs: [] });
 ```
 */
export async function acquireSelectedLandingLock({
  gitPath,
  globalArgs,
}: Readonly<{
  gitPath: string;
  globalArgs: readonly string[];
}>,): Promise<OwnerLock> {
  /**
   Landing location.
   */
  const location = await resolveLandingLocation({
    gitPath,
    globalArgs,
  },);
  if (location === LANDING_LOCATION_ABSENT)
    throw new TypeError('The landing lock requires a Git repository.',);
  return await acquireLocationLandingLock({
    gitPath,
    location,
  },);
}
