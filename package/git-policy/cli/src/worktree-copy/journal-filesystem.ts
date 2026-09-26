/**
 Live filesystem checks a pending worktree-copy journal must pass before recovery touches anything.

 @module
 */
import type { Stats, } from 'node:fs';
import {
  lstat,
  readFile,
  realpath,
} from 'node:fs/promises';
import {
  dirname,
  join,
  resolve,
} from 'node:path';

import { WorktreeCopyError, } from './errors.ts';
import type { WorktreeCopyJournal, } from './model.ts';
import { assertPrivateWorktreeCopyPath, } from './private-path.ts';

/**
 Git-file prefix introducing linked-worktree administrative path.
 */
const GITDIR_PREFIX = 'gitdir: ';

/**
 Filesystem path is absent.
 */
const PATH_ABSENT: unique symbol = Symbol('journal path is absent',);

/**
 Error codes meaning a path on the way to the destination registration no longer exists.
 */
const MISSING_PATH_CODES: ReadonlySet<string> = new Set([
  'ENOENT',
  'ENOTDIR',
],);

/**
 Whether the journal destination is still a linked worktree of the journal's common directory.

 @example
 ```ts
 const registration: DestinationRegistration = 'unregistered';
 ```
 */
export type DestinationRegistration = 'registered' | 'unregistered';

/**
 Whether the transaction's private stage and payload still exist.

 @example
 ```ts
 const stage: StagePresence = 'stage-missing';
 ```
 */
export type StagePresence = 'stage-intact' | 'stage-missing';

/**
 Reads no-follow metadata or absence for journal path validation.

 @param path - exact filesystem path

 @returns no-follow metadata or absence sentinel

 @example
 ```ts
 await lstatOrAbsent('/private/stage');
 ```
 */
async function lstatOrAbsent(path: string,): Promise<Readonly<Stats> | typeof PATH_ABSENT> {
  try {
    return await lstat(path,);
  }
  catch (error: unknown) {
    if (Error.isError(error,) && ('code' in error)
      && (error.code === 'ENOENT'))
      return PATH_ABSENT;
    throw error;
  }
}

/**
 Reports whether a failure means a path on the way to the registration is gone.

 @param error - caught filesystem failure

 @returns whether the failure is a missing-path failure

 @example
 ```ts
 isMissingPath(Object.assign(new Error('x'), { code: 'ENOENT' }));
 // => true
 ```
 */
function isMissingPath(error: unknown,): boolean {
  return Error.isError(error,) && ('code' in error) && ((typeof error.code) === 'string')
    && MISSING_PATH_CODES.has(String(error.code,),);
}

/**
 Reads whether the destination root, its Git file, and its administrative directory
 still name a linked worktree of the common directory.

 @param commonDir - canonical common Git directory

 @param destinationRoot - canonical linked-worktree root

 @returns whether the destination is still registered

 @example
 ```ts
 await readRegistration({ commonDir: '/repo/.git', destinationRoot: '/worktrees/topic' });
 ```
 */
async function readRegistration({
  commonDir,
  destinationRoot,
}: Readonly<{
  commonDir: string;
  destinationRoot: string;
}>,): Promise<DestinationRegistration> {
  if ((await realpath(destinationRoot,)) !== destinationRoot)
    return 'unregistered';
  /**
   Linked-worktree Git-file pointer.
   */
  const pointer = (await readFile(
    join(
      destinationRoot,
      '.git',
    ),
    'utf8',
  ))
    .trimEnd();
  if (!pointer.startsWith(GITDIR_PREFIX,))
    return 'unregistered';
  /**
   Canonical linked administrative directory.
   */
  const adminPath = await realpath(resolve(
    destinationRoot,
    pointer.slice(GITDIR_PREFIX.length,),
  ),);
  /**
   Canonical expected linked administrative parent.
   */
  const expectedAdminRoot = await realpath(join(
    commonDir,
    'worktrees',
  ),);
  return dirname(adminPath,) === expectedAdminRoot
    ? 'registered'
    : 'unregistered';
}

/**
 Classifies whether a journal destination is still registered under the expected common directory.
 A removed, moved, pruned, or replaced destination is unregistered:
 its transaction can no longer install anything,
 and recovery discards the private stage without touching the destination path.

 @param commonDir - canonical common Git directory

 @param destinationRoot - canonical linked-worktree root

 @returns registration state

 @throws {@link WorktreeCopyError} when registration cannot be read for another reason

 @example
 ```ts
 await destinationRegistration({ commonDir: '/repo/.git', destinationRoot: '/worktrees/topic' });
 ```
 */
export async function destinationRegistration({
  commonDir,
  destinationRoot,
}: Readonly<{
  commonDir: string;
  destinationRoot: string;
}>,): Promise<DestinationRegistration> {
  try {
    return await readRegistration({
      commonDir,
      destinationRoot,
    },);
  }
  catch (error: unknown) {
    if (isMissingPath(error,))
      return 'unregistered';
    throw new WorktreeCopyError(
      `cli-git: could not read worktree registration of ${JSON.stringify(destinationRoot,)}.`,
      error,
    );
  }
}

/**
 Validates the private stage before recovery reads, installs, or removes it.

 @param record - schema-validated journal record

 @returns whether the stage container and payload still exist

 @throws {@link WorktreeCopyError} when an existing stage path is not private

 @example
 ```ts
 await validateJournalStage(record);
 ```
 */
export async function validateJournalStage(
  record: WorktreeCopyJournal,
): Promise<StagePresence> {
  try {
    /**
     Private stage-container metadata or absence.
     */
    const containerStats = await lstatOrAbsent(record.stageContainer,);
    if ((typeof containerStats) === 'symbol')
      return 'stage-missing';
    await assertPrivateWorktreeCopyPath({
      path: record.stageContainer,
      role: 'private stage',
    },);
    /**
     Private payload metadata or absence.
     */
    const stageStats = await lstatOrAbsent(record.stageRoot,);
    if ((typeof stageStats) === 'symbol')
      return 'stage-missing';
    await assertPrivateWorktreeCopyPath({
      path: record.stageRoot,
      role: 'private stage',
    },);
    return 'stage-intact';
  }
  catch (error: unknown) {
    if (error instanceof WorktreeCopyError)
      throw error;
    throw new WorktreeCopyError(
      `cli-git: could not validate worktree-copy recovery state for ${JSON.stringify(record.destinationRoot,)}.`,
      error,
    );
  }
}
