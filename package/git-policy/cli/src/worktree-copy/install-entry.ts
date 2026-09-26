/**
 Exclusive creation of one destination path from the private stage.

 A regular file is installed as a hard link to its staged copy,
 which appears atomically with its final bytes and mode and needs no second data copy.
 Filesystems that refuse the link fall back to an exclusive copy-on-write request with full-copy fallback.

 @module
 */
import { constants, } from 'node:fs';
import {
  chmod,
  copyFile,
  link,
  lstat,
  mkdir,
  readlink,
  symlink,
  unlink,
} from 'node:fs/promises';

import { tagged, } from '@monochromatic-dev/module-logger/ts';

import { lstatOrAbsent, } from './entry-compare.ts';
import { WorktreeCopyError, } from './errors.ts';
import { filesystemPath, } from './ignored-paths.ts';
import type {
  InstalledWorktreePath,
  StagedWorktreeSnapshot,
  WorktreeCopyEntry,
} from './model.ts';

/**
 Module logger.
 */
const l = tagged({ tag: 'cli-git', },);

/**
 Exclusive copy-on-write request with full-copy fallback.
 */
const EXCLUSIVE_COPY_MODE = constants.COPYFILE_EXCL | constants.COPYFILE_FICLONE;

/**
 Temporary writable mode for newly installed selected directories.
 */
const PRIVATE_DIRECTORY_MODE = 0o700;

/**
 Error codes meaning the filesystem cannot hard-link the staged file into the destination.
 */
const LINK_UNSUPPORTED_CODES: ReadonlySet<string> = new Set([
  'EMLINK',
  'ENOSYS',
  'ENOTSUP',
  'EOPNOTSUPP',
  'EPERM',
  'EXDEV',
],);

/**
 Captures exact no-follow identity after successful exclusive creation.

 @param destinationPath - newly created native filesystem path

 @param relativePath - repository path for durable ownership

 @param selected - whether path came from selected source manifest

 @returns exact created-path identity

 @example
 ```ts
 await captureInstalledPath({ destinationPath: '/wt/cache', relativePath: 'cache', selected: true });
 ```
 */
export async function captureInstalledPath({
  destinationPath,
  relativePath,
  selected,
}: Readonly<{
  destinationPath: string;
  relativePath: string;
  selected: boolean;
}>,): Promise<InstalledWorktreePath> {
  /**
   Exact no-follow post-creation filesystem identity.
   */
  const stats = await lstat(
    destinationPath,
    { bigint: true, },
  );
  return {
    device: stats.dev
      .toString(),
    inode: stats.ino
      .toString(),
    relativePath,
    selected,
  };
}

/**
 Creates missing unselected parent directories for one selected entry.

 @param destinationRoot - newly registered worktree root

 @param entry - selected staged entry

 @param created - transaction-owned creation list, in creation order

 @mutates created - appends proven scaffold identities

 @example
 ```ts
 await ensureParents({ destinationRoot: '/wt', entry, created: [] });
 ```
 */
export async function ensureParents({
  destinationRoot,
  entry,
  created,
}: Readonly<{
  destinationRoot: string;
  entry: WorktreeCopyEntry;
  created: InstalledWorktreePath[];
}>,): Promise<void> {
  /**
   Selected path components excluding selected entry itself.
   */
  const parentComponents = entry.relativePath
    .split('/')
    .slice(
      0,
      -1,
    );
  /**
   Ordered parent repository paths from shallow to deep.
   */
  const parentPaths = parentComponents.map(function parentPath(
    _component,
    index,
  ): string {
    return parentComponents
      .slice(
        0,
        index + 1,
      )
      .join('/');
  },);
  for (const current of parentPaths) {
    /**
     Current native destination parent.
     */
    const destinationPath = filesystemPath({
      root: destinationRoot,
      repositoryPath: current,
    },);
    /* oxlint-disable no-await-in-loop -- parent chain is ordered and each child depends on prior directory */
    /**
     Current parent no-follow metadata or absence.
     */
    const stats = await lstatOrAbsent(destinationPath,);
    /* oxlint-enable no-await-in-loop */
    if ((typeof stats) !== 'symbol') {
      if (!stats.isDirectory()) {
        throw new WorktreeCopyError(
          `cli-git: ignored-state parent is not a directory: ${JSON.stringify(current,)} in ${JSON.stringify(destinationRoot,)}.`,
        );
      }
      continue;
    }
    // oxlint-disable-next-line no-await-in-loop -- parent chain creation is necessarily sequential
    await mkdir(destinationPath,);
    // oxlint-disable-next-line no-await-in-loop -- ownership identity must follow successful scaffold creation
    created.push(await captureInstalledPath({
      destinationPath,
      relativePath: current,
      selected: false,
    },),);
  }
}

/**
 Reports whether a hard-link failure means the filesystem cannot link the staged file.

 @param error - caught link failure

 @returns whether a copy should be attempted instead

 @example
 ```ts
 isLinkUnsupported(Object.assign(new Error('x'), { code: 'EXDEV' }));
 // => true
 ```
 */
function isLinkUnsupported(error: unknown,): boolean {
  return Error.isError(error,) && ('code' in error) && ((typeof error.code) === 'string')
    && LINK_UNSUPPORTED_CODES.has(String(error.code,),);
}

/**
 Installs one staged regular file, as a hard link when the filesystem allows it.

 @param stagePath - staged file carrying final bytes and mode

 @param destinationPath - absent destination path

 @param mode - source permission bits

 @example
 ```ts
 await installFile({ stagePath: '/stage/payload/a', destinationPath: '/wt/a', mode: 0o644 });
 ```
 */
async function installFile({
  stagePath,
  destinationPath,
  mode,
}: Readonly<{
  stagePath: string;
  destinationPath: string;
  mode: number;
}>,): Promise<void> {
  /**
   Tagged file-installation logger.
   */
  const fl = tagged({ tag: installFile.name, l, },);
  try {
    await link(stagePath, destinationPath,);
    return;
  }
  catch (error: unknown) {
    if (!isLinkUnsupported(error,))
      throw error;
    fl.debug(`hard link refused for ${JSON.stringify(destinationPath,)}, copying instead: ${String(error,)}`,);
  }
  await copyFile(
    stagePath,
    destinationPath,
    EXCLUSIVE_COPY_MODE,
  );
  try {
    await chmod(
      destinationPath,
      mode,
    );
  }
  catch (error: unknown) {
    await unlink(destinationPath,);
    throw error;
  }
}

/**
 Creates one absent selected entry from private stage.

 @param snapshot - validated staged source state

 @param destinationRoot - newly registered worktree root

 @param entry - absent selected entry

 @example
 ```ts
 await createSelectedEntry({ snapshot, destinationRoot: '/wt', entry });
 ```
 */
export async function createSelectedEntry({
  snapshot,
  destinationRoot,
  entry,
}: Readonly<{
  snapshot: StagedWorktreeSnapshot;
  destinationRoot: string;
  entry: WorktreeCopyEntry;
}>,): Promise<void> {
  /**
   Staged expected filesystem path.
   */
  const stagePath = filesystemPath({
    root: snapshot.stageRoot,
    repositoryPath: entry.relativePath,
  },);
  /**
   Destination filesystem path.
   */
  const destinationPath = filesystemPath({
    root: destinationRoot,
    repositoryPath: entry.relativePath,
  },);
  if (entry.kind === 'directory') {
    await mkdir(
      destinationPath,
      { mode: PRIVATE_DIRECTORY_MODE, },
    );
    return;
  }
  if (entry.kind === 'file') {
    await installFile({
      stagePath,
      destinationPath,
      mode: entry.mode,
    },);
    return;
  }
  /**
   Exact staged symbolic-link target text.
   */
  const target = await readlink(stagePath,);
  await symlink(
    target,
    destinationPath,
  );
}
