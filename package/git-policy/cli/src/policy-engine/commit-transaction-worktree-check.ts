//region Worktree completion checks
/**
 Descriptor-bound worktree checks for post-commit file completion.

 @module
 */
import { Buffer, } from 'node:buffer';
import { constants, } from 'node:fs';
import {
  lstat,
  open,
  realpath,
} from 'node:fs/promises';
import { dirname, } from 'node:path';
import type { AddedPathRecord, } from './commit-transaction-added-paths.ts';

/**
 Owner-executable bit in POSIX file mode.
 */
const EXECUTE_BIT = 0o100n;
/**
 POSIX permissions without inode type flags.
 */
const FILE_PERMISSION_BITS = 0o777n;
/**
 Filesystem changes that leave user worktree state outside safe completion.
 */
const WORKTREE_CONFLICT_CODES: ReadonlySet<string> = new Set([
  'ENOENT',
  'ENOTDIR',
  'ELOOP',
  'EACCES',
],);

/**
 Identity of an unchanged original worktree file.
 */
export type WorktreeFileIdentity = Readonly<{
  device: bigint;
  inode: bigint;
  modified: bigint;
  changed: bigint;
  size: bigint;
  mode: number;
}>;
/**
 Exact post-commit worktree state.
 */
export type WorktreeFileState =
  | Readonly<{
    kind: 'original';
    identity: WorktreeFileIdentity;
  }>
  | Readonly<{
    kind: 'intended';
  }>
  | Readonly<{
    kind: 'conflict';
  }>;

/**
 Tests whether an expected worktree copy remains an ordinary original or intended file.
 Missing, symlinked, and concurrently replaced paths are conflicts, not recovery failures.

 @param destination - absolute selected worktree path

 @param gitMode - recorded ordinary Git mode

 @param original - original Git blob bytes

 @param intended - landed Git blob bytes

 @returns exact file state and identity when original

 @example
 ```ts
 await inspectWorktreeFile({ destination: '/repo/a', gitMode: '100644', original, intended });
 ```
 */
export async function inspectWorktreeFile({
  destination,
  gitMode,
  original,
  intended,
}: Readonly<{
  destination: string;
  gitMode: AddedPathRecord['gitMode'];
  original: Uint8Array;
  intended: Uint8Array;
}>,): Promise<WorktreeFileState> {
  try {
    if ((await realpath(dirname(destination,))) !== dirname(destination,))
      return { kind: 'conflict', };
    /**
     No-follow entry check rejects FIFOs and devices before any open.
     */
    const entry = await lstat(
      destination,
      { bigint: true, },
    );
    if ((!entry.isFile()) || (entry.nlink !== 1n))
      return { kind: 'conflict', };
    /**
     Nonblocking no-follow descriptor also rejects FIFO replacement between check and open.
     */
    await using handle = await open(
      destination,
      constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK,
    );
    /**
     Open descriptor metadata before content read.
     */
    const metadata = await handle.stat({ bigint: true, },);
    if ((!metadata.isFile()) || (metadata.nlink !== 1n)
      || (entry.dev !== metadata.dev) || (entry.ino !== metadata.ino)
      || (((metadata.mode & EXECUTE_BIT) !== 0n) !== (gitMode === '100755')))
      return { kind: 'conflict', };
    /**
     Bytes from same no-follow descriptor.
     */
    const bytes = Buffer.from(await handle.readFile(),);
    /**
     Path metadata after read, rejecting a concurrently exchanged file.
     */
    const current = await lstat(
      destination,
      { bigint: true, },
    );
    if ((current.dev !== metadata.dev) || (current.ino !== metadata.ino)
      || (current.mtimeNs !== metadata.mtimeNs)
      || (current.ctimeNs !== metadata.ctimeNs)
      || (current.size !== metadata.size)
      || ((await realpath(dirname(destination,))) !== dirname(destination,)))
      return { kind: 'conflict', };
    if (bytes.equals(intended,))
      return { kind: 'intended', };
    if (!bytes.equals(original,))
      return { kind: 'conflict', };
    return {
      kind: 'original',
      identity: {
        device: metadata.dev,
        inode: metadata.ino,
        modified: metadata.mtimeNs,
        changed: metadata.ctimeNs,
        size: metadata.size,
        mode: Number(metadata.mode & FILE_PERMISSION_BITS,),
      },
    };
  }
  catch (error: unknown) {
    if (Error.isError(error,) && ('code' in error)
      && ((typeof error.code) === 'string')
      && WORKTREE_CONFLICT_CODES.has(error.code,))
      return { kind: 'conflict', };
    throw error;
  }
}

/**
 Confirms both snapshots observed the same ordinary file, without altering it.

 @param first - original snapshot

 @param second - snapshot just before replacement

 @returns whether original inode, permissions, and content state remain identical

 @example
 ```ts
 worktreeIdentityMatches({ first, second });
 ```
 */
export function worktreeIdentityMatches({
  first,
  second,
}: Readonly<{
  first: WorktreeFileIdentity;
  second: WorktreeFileIdentity;
}>,): boolean {
  return (first.device === second.device)
    && (first.inode === second.inode)
    && (first.modified === second.modified)
    && (first.changed === second.changed)
    && (first.size === second.size)
    && (first.mode === second.mode);
}
//endregion Worktree completion checks
