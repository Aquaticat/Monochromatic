/**
 Disposable and recoverable per-transaction workspace.

 The workspace never holds the real `index.lock`:
 preparation runs without it,
 and the landing critical section acquires it.
 Disposal removes the shadow repository before the transaction directory,
 so no shadow repository outlives the journal that names it,
 unless a landing record handed both to recovery.

 @module
 */
import { randomUUID, } from 'node:crypto';
import { join, } from 'node:path';
import { tagged, } from '@monochromatic-dev/module-logger/ts';
import { removeShadowRepository, } from '../shadow-repository/shadow-repository.ts';
import {
  type InvocationCapture,
  shadowRepositoryPath,
} from './commit-transaction-capture.ts';
import {
  createTransactionOwnerRecord,
  encodeTransactionOwner,
} from './commit-transaction-owner.ts';
import {
  ensureTransactionRoot,
  publishTransactionDirectory,
  removeTransactionDirectory,
} from './commit-transaction-registry.ts';

/**
 Module logger.
 */
const l = tagged({ tag: 'cli-git', },);

/**
 Owned private transaction state.
 */
export type CommitTransactionWorkspace = {
  /**
   Unique transaction ID naming the durable directory; also the reflog nonce.
   */
  readonly transactionId: string;
  /**
   Durable transaction directory outside worktree content.
   */
  readonly directory: string;
  /**
   Private commit index.
   */
  readonly commitIndexPath: string;
  /**
   Exact real index snapshot captured at invocation.
   */
  readonly capturedIndexPath: string;
  /**
   Real index path.
   */
  readonly realIndexPath: string;
  /**
   Shadow repository path derived from the transaction ID.
   */
  readonly shadowPath: string;
  /**
   Shadow object store receiving every object the transaction writes before landing migrates them;
   its alternates name the real object store.
   */
  readonly objectDirectory: string;
  /**
   Hook dispatcher directory.
   */
  readonly hooksDirectory: string;
  /**
   Marks a landing record durable so disposal leaves recovery artifacts in place.
   */
  readonly preserveForRecovery: () => void;
  /**
   Marks durable completion so disposal removes recovery artifacts.
   */
  readonly finishTransaction: () => void;
  /**
   Removes the shadow repository and then the transaction directory unless recovery owns them; later calls do nothing.
   */
  readonly [Symbol.asyncDispose]: () => Promise<void>;
};

/**
 Publishes a fresh transaction directory owned by the current process.

 @param capture - invocation capture naming the registry and common directory

 @returns owned disposable workspace

 @example
 ```ts
 await using workspace = await createCommitTransactionWorkspace({ capture });
 ```
 */
export async function createCommitTransactionWorkspace({ capture, }: Readonly<{
  capture: Pick<InvocationCapture, 'registryRoot' | 'commonDir' | 'realIndexPath' | 'invokedAt'>;
}>,): Promise<CommitTransactionWorkspace> {
  await ensureTransactionRoot(capture.registryRoot,);
  /**
   Fresh transaction ID naming the directory, the shadow, and the reflog nonce.
   */
  const transactionId = randomUUID();
  /**
   Owner record published with the directory so recovery can skip this live transaction.
   */
  const owner = await createTransactionOwnerRecord({
    transactionId,
    createdAt: capture.invokedAt,
  },);
  /**
   Published durable transaction directory.
   */
  const directory = await publishTransactionDirectory({
    root: capture.registryRoot,
    transactionId,
    ownerBytes: encodeTransactionOwner(owner,),
  },);
  /**
   Lifecycle markers: a landing record hands the directory to recovery; disposal runs once.
   */
  const preserved = new Set<'preserved' | 'disposed'>();
  /**
   Derived shadow repository path.
   */
  const shadowPath = shadowRepositoryPath({
    commonDir: capture.commonDir,
    transactionId,
  },);
  l.debug(`published transaction ${transactionId}`,);
  return {
    transactionId,
    directory,
    commitIndexPath: join(
      directory,
      'commit.index',
    ),
    capturedIndexPath: join(
      directory,
      'captured.index',
    ),
    realIndexPath: capture.realIndexPath,
    shadowPath,
    objectDirectory: join(
      shadowPath,
      'objects',
    ),
    hooksDirectory: join(
      directory,
      'hooks',
    ),
    preserveForRecovery: function preserveForRecovery(): void {
      preserved.add('preserved',);
    },
    finishTransaction: function finishTransaction(): void {
      preserved.delete('preserved',);
    },
    [Symbol.asyncDispose]: async function disposeWorkspace(): Promise<void> {
      if (preserved.has('disposed',))
        return;
      preserved.add('disposed',);
      if (preserved.has('preserved',)) {
        l.debug(`leaving transaction ${transactionId} for recovery`,);
        return;
      }
      await removeShadowRepository(shadowPath,);
      await removeTransactionDirectory(directory,);
    },
  };
}
