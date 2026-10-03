/**
 Per-worktree capture order: the capture lock, the worktree identity, and the capture sequence.

 Every commit transaction captures its content
 (selected worktree bytes, or the real index)
 while holding a short per-worktree capture lock,
 and allocates the next capture sequence number under it,
 so sequence numbers give a total order of the captured disk states of one worktree.
 Replay uses that order for a path both a prepared commit and an earlier-landed commit captured from this worktree
 (`commit-capture-order-decision.ts`).

 The store lives in the worktree's own Git directory:

 ```text
 <git-dir>/cli-git-captures/
   capture.lock/       owner lock held only while a transaction captures
   worktree-id         random identity of this store, written once
   sequence            last allocated capture sequence number
   landed/<oid>.json   capture metadata of a commit landed from this worktree
 ```

 The sequence file is replaced through a temporary file and a rename,
 so a reader sees either the old or the new number,
 and a crash after the rename only leaves a gap.
 A deleted store starts again with a new worktree identity,
 so sequence numbers of different store generations are never compared.

 @module
 */
import { randomUUID, } from 'node:crypto';
import { constants, } from 'node:fs';
import {
  open,
  readFile,
  rename,
  rm,
} from 'node:fs/promises';
import { join, } from 'node:path';
import { tagged, } from '@monochromatic-dev/module-logger/ts';
import { acquireOwnerLock, } from '../owner-lock/owner-lock.ts';
import {
  isMissingPath,
  syncDirectory,
  writePrivateFile,
} from '../trust/registry-io.ts';
import { ensureTransactionRoot, } from './commit-transaction-registry.ts';
import { reachTransactionPhase, } from './commit-transaction-test-phase.ts';

/**
 Module logger.
 */
const l = tagged({ tag: 'cli-git', },);

/**
 Capture store directory name inside the worktree's Git directory.
 */
export const CAPTURE_STORE_NAME = 'cli-git-captures';

/**
 Capture lock directory name inside the store.
 */
export const CAPTURE_LOCK_NAME = 'capture.lock';

/**
 Worktree identity filename inside the store.
 */
export const WORKTREE_ID_FILENAME = 'worktree-id';

/**
 Sequence filename inside the store.
 */
export const SEQUENCE_FILENAME = 'sequence';

/**
 Decimal radix of the sequence file.
 */
const DECIMAL = 10;

/**
 Position of one capture in its worktree's capture order.
 */
export type CaptureStamp = Readonly<{
  /**
   Identity of the store that allocated the sequence number.
   */
  worktreeId: string;
  /**
   Capture sequence number, starting at 1.
   */
  sequence: number;
}>;

/**
 Capture store directory of a worktree.

 @param gitDir - absolute Git directory of the owning worktree

 @returns absolute store directory

 @example
 ```ts
 captureStorePath('/repo/.git'); // '/repo/.git/cli-git-captures'
 ```
 */
export function captureStorePath(gitDir: string,): string {
  return join(
    gitDir,
    CAPTURE_STORE_NAME,
  );
}

/**
 Parses the sequence file.

 @param text - file text

 @param path - file path used in diagnostics

 @returns last allocated sequence number

 @throws {@link TypeError} when the file holds anything but a nonnegative decimal integer and a newline
 */
function parseSequence({
  text,
  path,
}: Readonly<{
  text: string;
  path: string;
}>,): number {
  /**
   Digits before the newline.
   */
  const digits = text.endsWith('\n',) ? text.slice(
    0,
    -1,
  ) : '';
  /**
   Parsed value.
   */
  const value = Number.parseInt(
    digits,
    DECIMAL,
  );
  if ((digits === '') || (String(value,) !== digits)
    || (!Number.isSafeInteger(value,))
    || (value < 0))
    throw new TypeError(`Capture sequence file is malformed: ${path}`,);
  return value;
}

/**
 Next capture sequence number the store would allocate, read without the lock.
 An absent store or sequence file reads as 1.

 @param gitDir - absolute Git directory of the owning worktree

 @returns next sequence number

 @throws {@link TypeError} when the sequence file is malformed

 @example
 ```ts
 await readNextCaptureSequence('/repo/.git'); // 1 before the first capture
 ```
 */
export async function readNextCaptureSequence(gitDir: string,): Promise<number> {
  /**
   Sequence file path.
   */
  const path = join(
    captureStorePath(gitDir,),
    SEQUENCE_FILENAME,
  );
  try {
    return parseSequence({
      text: await readFile(
        path,
        'utf8',
      ),
      path,
    },) + 1;
  }
  catch (error: unknown) {
    if (!isMissingPath(error,))
      throw error;
    l.debug(`no capture sequence yet at ${path}`,);
    return 1;
  }
}

/**
 Reads the store's worktree identity, creating it on first use.
 The caller holds the capture lock, so no other writer races the creation.

 @param store - store directory

 @returns worktree identity
 */
async function ensureWorktreeId(store: string,): Promise<string> {
  /**
   Identity file path.
   */
  const path = join(
    store,
    WORKTREE_ID_FILENAME,
  );
  try {
    /**
     Recorded identity.
     */
    const recorded = (await readFile(
      path,
      'utf8',
    )).trim();
    if (recorded === '')
      throw new TypeError(`Capture store worktree identity is empty: ${path}`,);
    return recorded;
  }
  catch (error: unknown) {
    if (!isMissingPath(error,))
      throw error;
    l.debug(`creating capture store identity at ${path}`,);
  }
  /**
   New identity.
   */
  const identity = randomUUID();
  await writePrivateFile({
    path,
    bytes: new TextEncoder().encode(`${identity}\n`,),
  },);
  await syncDirectory(store,);
  return identity;
}

/**
 Allocates the next sequence number durably.
 The caller holds the capture lock.

 @param gitDir - absolute Git directory of the owning worktree

 @param store - store directory

 @returns allocated sequence number
 */
async function allocateSequence({
  gitDir,
  store,
}: Readonly<{
  gitDir: string;
  store: string;
}>,): Promise<number> {
  /**
   Number this capture takes.
   */
  const sequence = await readNextCaptureSequence(gitDir,);
  /**
   Private temporary file renamed over the sequence file.
   */
  const temporary = join(
    store,
    `${SEQUENCE_FILENAME}.${randomUUID()}.tmp`,
  );
  try {
    await writePrivateFile({
      path: temporary,
      bytes: new TextEncoder().encode(`${String(sequence,)}\n`,),
    },);
    await rename(
      temporary,
      join(
        store,
        SEQUENCE_FILENAME,
      ),
    );
  }
  catch (error: unknown) {
    await rm(
      temporary,
      { force: true, },
    );
    throw error;
  }
  await syncDirectory(store,);
  return sequence;
}

/**
 Ensures the store directory exists as a private, non-linked directory.

 @param gitDir - absolute Git directory of the owning worktree

 @returns store directory

 @throws {@link TypeError} when the store path is unsafe

 @example
 ```ts
 await ensureCaptureStore('/repo/.git');
 ```
 */
export async function ensureCaptureStore(gitDir: string,): Promise<string> {
  /**
   Store directory.
   */
  const store = captureStorePath(gitDir,);
  await ensureTransactionRoot(store,);
  return store;
}

/**
 Runs one capture under the per-worktree capture lock and stamps it with the next sequence number.
 The lock is held only for the capture itself, never across hooks, the editor, or landing.

 @param gitDir - absolute Git directory of the owning worktree

 @param capture - reads the worktree bytes or the real index this transaction commits

 @returns capture stamp and the capture's value

 @throws {@link TypeError} when the store is unsafe or malformed

 @example
 ```ts
 const { stamp } = await captureInOrder({ gitDir: '/repo/.git', capture: async () => initializeCommitIndex(options) });
 ```
 */
export async function captureInOrder<const Value,>({
  gitDir,
  capture,
}: Readonly<{
  gitDir: string;
  capture: () => Promise<Value>;
}>,): Promise<Readonly<{
  stamp: CaptureStamp;
  value: Value;
}>> {
  /**
   Tagged capture logger.
   */
  const rl = tagged({
    tag: captureInOrder.name,
    l,
  },);
  /**
   Store directory.
   */
  const store = await ensureCaptureStore(gitDir,);
  /**
   Capture lock, released when this function returns.
   */
  await using _captureLock = await acquireOwnerLock({
    lockDirectory: join(
      store,
      CAPTURE_LOCK_NAME,
    ),
    onWait: function reportWait(): void {
      rl.debug(`waiting for another capture in ${store}`,);
    },
  },);
  await reachTransactionPhase({ phase: 'capture-locked', },);
  /**
   Store identity.
   */
  const worktreeId = await ensureWorktreeId(store,);
  /**
   Sequence number of this capture.
   */
  const sequence = await allocateSequence({
    gitDir,
    store,
  },);
  rl.debug(`capture ${String(sequence,)} of worktree ${worktreeId}`,);
  return {
    stamp: {
      worktreeId,
      sequence,
    },
    value: await capture(),
  };
}

/**
 Reads a small no-follow regular file of the store.

 @param path - file path

 @returns file text

 @throws {@link TypeError} when the path is not a regular file

 @example
 ```ts
 await readStoreFile('/repo/.git/cli-git-captures/landed/abc.json');
 ```
 */
export async function readStoreFile(path: string,): Promise<string> {
  /**
   No-follow handle.
   */
  await using handle = await open(
    path,
    constants.O_RDONLY | constants.O_NOFOLLOW,
  );
  if (!(await handle.stat()).isFile())
    throw new TypeError(`Capture store entry is not a regular file: ${path}`,);
  return await handle.readFile('utf8',);
}
