/**
 Links every non-private entry of the real common Git directory into a shadow repository.

 Shared entries such as `info`,
 `hooks`,
 `rr-cache`,
 `lfs`,
 and `modules` become symbolic links
 (directory junctions and file copies on Windows,
 where symbolic links need a privilege),
 so hooks and native Git see the real ones.
 Transaction-private entries stay the shadow's own.
 A linked worktree's per-worktree `info/sparse-checkout` is copied into a private `info` directory
 whose shared entries are linked individually.

 @module
 */
import {
  copyFile,
  cp,
  lstat,
  mkdir,
  readdir,
  rm,
  symlink,
} from 'node:fs/promises';
import { join, } from 'node:path';
import { tagged, } from '@monochromatic-dev/module-logger/ts';
import { isMissingPath, } from '../trust/registry-io.ts';
import { CONCLUSION_STATE_NAMES, } from './shadow-conclusion-names.ts';

/**
 Module logger.
 */
const l = tagged({ tag: 'cli-git', },);

/**
 Private directory mode for a shadow `info` directory holding per-worktree entries.
 */
const PRIVATE_DIRECTORY_MODE = 0o700;

/**
 Real common-directory entries the shadow never links:
 its ref store,
 index,
 config,
 object store,
 message file,
 copied conclusion state,
 and cli-git's own state,
 which contains the shadow itself.
 */
export const PRIVATE_SHADOW_ENTRIES: ReadonlySet<string> = new Set([
  'HEAD',
  'refs',
  'packed-refs',
  'reftable',
  'logs',
  'index',
  'config',
  'config.worktree',
  'objects',
  'COMMIT_EDITMSG',
  ...CONCLUSION_STATE_NAMES,
  'cli-git',
  'cli-git-transactions',
  'cli-git-transaction',
],);

/**
 Reports whether an entry must stay private to the shadow.
 Lock files are never linked,
 because a shadow Git that locks the same name would collide with the real owner.

 @param name - real common-directory entry name

 @returns whether the entry is private

 @example
 ```ts
 isPrivateShadowEntry('index.lock'); // true
 ```
 */
export function isPrivateShadowEntry(name: string,): boolean {
  return PRIVATE_SHADOW_ENTRIES.has(name,) || name.endsWith('.lock',);
}

/**
 Links or, on Windows, junctions or copies one shared entry.

 @param source - real entry

 @param destination - shadow entry, which must not exist

 @param directory - whether the real entry is a directory
 */
async function shareEntry({
  source,
  destination,
  directory,
}: Readonly<{
  source: string;
  destination: string;
  directory: boolean;
}>,): Promise<void> {
  if (process.platform !== 'win32') {
    await symlink(
      source,
      destination,
    );
    return;
  }
  if (directory) {
    await symlink(
      source,
      destination,
      'junction',
    );
    return;
  }
  await copyFile(
    source,
    destination,
  );
}

/**
 Links every shared entry of one real directory into one shadow directory.

 @param sourceDirectory - real directory

 @param shadowDirectory - shadow directory

 @param skip - entry names handled elsewhere
 */
async function linkDirectoryEntries({
  sourceDirectory,
  shadowDirectory,
  skip,
}: Readonly<{
  sourceDirectory: string;
  shadowDirectory: string;
  skip: (name: string) => boolean;
}>,): Promise<void> {
  /**
   Entries typed without following links.
   */
  const entries = await readdir(
    sourceDirectory,
    { withFileTypes: true, },
  );
  await Promise.all(entries
    .filter(function shared(entry,): boolean {
      return !skip(entry.name,);
    },)
    .map(async function linkEntry(entry,): Promise<void> {
      /**
       Shadow entry path.
       */
      const destination = join(
        shadowDirectory,
        entry.name,
      );
      // `git init` may have created a template entry of the same name; the real one replaces it.
      await rm(
        destination,
        {
          recursive: true,
          force: true,
        },
      );
      await shareEntry({
        source: join(
          sourceDirectory,
          entry.name,
        ),
        destination,
        directory: entry.isDirectory(),
      },);
    },),);
}

/**
 Reports whether a regular per-worktree file exists.

 @param path - candidate path

 @returns whether it exists as a regular file
 */
async function regularFileExists(path: string,): Promise<boolean> {
  try {
    return (await lstat(path,)).isFile();
  }
  catch (error: unknown) {
    if (isMissingPath(error,))
      return false;
    throw error;
  }
}

/**
 Links the real common directory into the shadow and copies per-worktree entries.

 @param shadowPath - shadow repository

 @param commonDir - real common Git directory

 @param gitDir - owning worktree's Git directory

 @example
 ```ts
 await linkShadowEntries({ shadowPath, commonDir: '/repo/.git', gitDir: '/repo/.git/worktrees/w' });
 ```
 */
export async function linkShadowEntries({
  shadowPath,
  commonDir,
  gitDir,
}: Readonly<{
  shadowPath: string;
  commonDir: string;
  gitDir: string;
}>,): Promise<void> {
  /**
   Tagged link logger.
   */
  const rl = tagged({
    tag: linkShadowEntries.name,
    l,
  },);
  /**
   Linked worktree's own sparse-checkout file, which Git resolves outside the common directory.
   */
  const perWorktreeSparse = join(
    gitDir,
    'info',
    'sparse-checkout',
  );
  /**
   Whether `info` mixes shared entries with a per-worktree one.
   */
  const mixedInfo = (gitDir !== commonDir) && (await regularFileExists(perWorktreeSparse,));
  await linkDirectoryEntries({
    sourceDirectory: commonDir,
    shadowDirectory: shadowPath,
    skip: function skipTopLevel(name,): boolean {
      return isPrivateShadowEntry(name,) || (mixedInfo && (name === 'info'));
    },
  },);
  /**
   Owning worktree's config, read only when `extensions.worktreeConfig` is enabled.
   */
  const worktreeConfig = join(
    gitDir,
    'config.worktree',
  );
  if (await regularFileExists(worktreeConfig,))
    await copyFile(
      worktreeConfig,
      join(
        shadowPath,
        'config.worktree',
      ),
    );
  if (!mixedInfo)
    return;
  /**
   Private shadow `info` directory.
   */
  const shadowInfo = join(
    shadowPath,
    'info',
  );
  await rm(
    shadowInfo,
    {
      recursive: true,
      force: true,
    },
  );
  await mkdir(
    shadowInfo,
    { mode: PRIVATE_DIRECTORY_MODE, },
  );
  /**
   Shared `info` directory, which may be absent.
   */
  const sharedInfo = join(
    commonDir,
    'info',
  );
  try {
    await linkDirectoryEntries({
      sourceDirectory: sharedInfo,
      shadowDirectory: shadowInfo,
      skip: function skipSparse(name,): boolean {
        return name === 'sparse-checkout';
      },
    },);
  }
  catch (error: unknown) {
    if (!isMissingPath(error,))
      throw error;
    rl.debug(`no shared info directory: ${sharedInfo}`,);
  }
  await cp(
    perWorktreeSparse,
    join(
      shadowInfo,
      'sparse-checkout',
    ),
  );
}
