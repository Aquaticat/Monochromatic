//region Prepared worktree replacement
/**
 Rechecked ordinary-file replacement for landed commit completion.

 @module
 */
import { randomUUID, } from 'node:crypto';
import {
  chmod,
  rename,
  rm,
  writeFile,
} from 'node:fs/promises';
import {
  dirname,
  join,
} from 'node:path';
import { tagged, } from '@monochromatic-dev/module-logger/ts';
import type { AddedPathRecord, } from './commit-transaction-added-paths.ts';
import {
  inspectWorktreeFile,
  type WorktreeFileIdentity,
  worktreeIdentityMatches,
} from './commit-transaction-worktree-check.ts';

/**
 Module logger.
 */
const l = tagged({ tag: 'cli-git', },);

/**
 Replaces one unchanged worktree file through a same-directory temporary file.

 @param destination - absolute worktree path

 @param bytes - intended content

 @param mode - original worktree permission bits

 @param gitMode - expected ordinary Git file mode

 @param original - original file bytes to revalidate

 @param identity - original descriptor identity to revalidate

 @returns whether replacement was installed without an observed conflict

 @example
 ```ts
 await replaceWorktreeFile({ destination: '/repo/a', bytes, mode: 0o644, gitMode: '100644', original, identity });
 ```
 */
export async function replaceWorktreeFile({
  destination,
  bytes,
  mode,
  gitMode,
  original,
  identity,
}: Readonly<{
  destination: string;
  bytes: Uint8Array;
  mode: number;
  gitMode: AddedPathRecord['gitMode'];
  original: Uint8Array;
  identity: WorktreeFileIdentity;
}>,): Promise<boolean> {
  /**
   Same-directory temporary path, so rename stays on one filesystem.
   */
  const prepared = join(
    dirname(destination,),
    `.cli-git-added-${randomUUID()}`,
  );
  try {
    await writeFile(
      prepared,
      bytes,
      {
        mode,
        flag: 'wx',
      },
    );
    await chmod(
      prepared,
      mode,
    );
    /**
     Destination checked again after preparing replacement bytes and mode.
     */
    const current = await inspectWorktreeFile({
      destination,
      gitMode,
      original,
      intended: bytes,
    },);
    if ((current.kind !== 'original') || (!worktreeIdentityMatches({
      first: identity,
      second: current.identity,
    },))) {
      await rm(
        prepared,
        { force: true, },
      );
      return false;
    }
    await rename(
      prepared,
      destination,
    );
    return true;
  }
  catch (error: unknown) {
    l.error(`worktree completion failed for ${destination}: ${String(error,)}`,);
    await rm(
      prepared,
      { force: true, },
    );
    throw error;
  }
}
//endregion Prepared worktree replacement
