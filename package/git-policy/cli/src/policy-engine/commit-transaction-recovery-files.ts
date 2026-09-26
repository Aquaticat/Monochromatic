/**
 No-follow transaction recovery file operations.
 
 @module
 */
import { constants, } from 'node:fs';
import {
  access,
  open,
  rename,
  rm,
} from 'node:fs/promises';
import {
  dirname,
  join,
} from 'node:path';
import {
  isMissingPath,
  syncDirectory,
} from '../trust/registry-io.ts';
import { createOwnedFileLink, } from './commit-transaction-install-link.ts';
import type { PreparedTransactionJournal, } from './commit-transaction-journal.ts';
import { removeTransactionDirectory, } from './commit-transaction-registry.ts';
import {
  assertOwnedLock,
  CommitTransactionRecoveryError,
} from './commit-transaction-recovery-validation.ts';
import { applyIndexTimestamps, } from './index-file-timestamps.ts';

/**
 Reports whether path currently exists without suppressing other failures.

 @param path - exact path to probe

 @returns whether path is present

 @example
 ```ts
 await recoveryPathExists('/repo/.git/index.lock');
 ```
 */
export async function recoveryPathExists(path: string,): Promise<boolean> {
  try {
    await access(path,);
    return true;
  }
  catch (error: unknown) {
    if (isMissingPath(error,))
      return false;
    throw error;
  }
}

/**
 Reads exact regular artifact bytes through no-follow descriptor.
 
 @param path - required private recovery file
 
 @returns exact artifact bytes
 
 @example
 ```ts
 await readRegularRecoveryFile('/repo/.git/cli-git-transactions/0b6c2c1e-6f5b-4d0e-9a55-3f5d8e2f6a10/journal.json');
 ```
 */
export async function readRegularRecoveryFile(path: string,): Promise<Uint8Array> {
  /**
   No-follow recovery artifact handle.
   */
  await using handle = await open(
    path,
    constants.O_RDONLY | constants.O_NOFOLLOW,
  );
  /**
   Descriptor metadata for exact consumed artifact.
   */
  const metadata = await handle.stat();
  if (!metadata.isFile())
    throw new CommitTransactionRecoveryError(`Unsafe transaction recovery file: ${path}`,);
  return new Uint8Array(await handle.readFile(),);
}

/**
 Installs prepared post-index through exact owned lock.
 
 @param lockPath - verified lock path
 
 @param realIndexPath - journal real index path
 
 @param postIndexPath - prepared exact post index
 
 @param journal - prepared lock identity
 
 @example
 ```ts
 await installRecoveredIndex({ lockPath, realIndexPath, postIndexPath, journal });
 ```
 */
export async function installRecoveredIndex({
  lockPath,
  realIndexPath,
  postIndexPath,
  journal,
}: Readonly<{
  lockPath: string;
  realIndexPath: string;
  postIndexPath: string;
  journal: PreparedTransactionJournal;
}>,): Promise<void> {
  /**
   Exact intended post-index bytes from no-follow descriptor.
   */
  const bytes = await readRegularRecoveryFile(postIndexPath,);
  /**
   Existing no-follow owned lock handle.
   */
  await using lock = await open(
    lockPath,
    constants.O_RDWR | constants.O_NOFOLLOW,
  );
  /**
   Exact consumed lock descriptor metadata.
   */
  const lockMetadata = await lock.stat({ bigint: true, },);
  if ((String(lockMetadata.dev,) !== journal.lockDevice)
    || (String(lockMetadata.ino,) !== journal.lockInode))
    throw new CommitTransactionRecoveryError(`Index lock identity changed: ${lockPath}`,);
  await lock.truncate(0,);
  await lock.writeFile(bytes,);
  await applyIndexTimestamps({
    sourcePath: postIndexPath,
    handle: lock,
  },);
  await lock.sync();
  await assertOwnedLock({
    journal,
    lockPath,
  },);
  /**
   Private owner-preserving installation name.
   */
  const installPath = join(
    dirname(postIndexPath,),
    'install.index',
  );
  await createOwnedFileLink({
    sourcePath: lockPath,
    linkedPath: installPath,
    expectedDevice: journal.lockDevice,
    expectedInode: journal.lockInode,
  },);
  await lock.close();
  await rename(
    installPath,
    realIndexPath,
  );
  await assertOwnedLock({
    journal,
    lockPath,
  },);
  await rm(lockPath,);
  await syncDirectory(dirname(realIndexPath,),);
}

/**
 Removes completed recovery artifacts durably.
 
 @param directory - exact transaction directory
 
 @param lockPath - optional owned lock path
 
 @example
 ```ts
 await removeRecoveryArtifacts({ directory, lockPath });
 ```
 */
export async function removeRecoveryArtifacts({
  directory,
  lockPath,
}: Readonly<{
  directory: string;
  lockPath?: string;
}>,): Promise<void> {
  if (lockPath !== undefined)
    await rm(
      lockPath,
      { force: true, },
    );
  await removeTransactionDirectory(directory,);
}
