/**
 Provenance transaction settlement for registry readers that hold no lock.

 Readers such as ordinary config loading run in every wrapped Git command,
 so they never take the registry-wide recursive-operation lock while no journal is published.
 A published journal belongs either to a live transaction,
 whose owner holds the lock until the journal is settled,
 or to a holder that died mid-transaction.
 Taking the lock tells them apart by owner liveness with process-birth identity:
 it waits without a time limit while the owner lives,
 and once acquired,
 every journal left belongs to a dead holder and is recovered.
 A reader therefore never fails because another process is mid-transaction,
 and never reads records a live transaction has only partly settled.

 @module
 */
import { tagged, } from '@monochromatic-dev/module-logger/ts';
import { acquireRecursiveRegistryLock, } from './registry-recursive-lock.ts';
import {
  provenanceJournalsPresent,
  recoverProvenanceTransactions,
} from './registry-transaction.ts';

/**
 Module logger.
 */
const l = tagged({ tag: 'cli-git', },);

/**
 Settles published provenance transactions before a reader that holds no lock reads the registry.

 @param registryRoot - complete registry root

 @throws {@link TrustStorageError} when a lock owner neither proven alive nor proven exited outlasts the lock's unproven-owner budget,
 or when a journal is unsafe or malformed

 @example
 ```ts
 await recoverProvenanceBeforeUnlockedRead({ registryRoot });
 ```
 */
export async function recoverProvenanceBeforeUnlockedRead({
  registryRoot,
}: Readonly<{
  registryRoot: string;
}>,): Promise<void> {
  /**
   Tagged logger.
   */
  const rl = tagged({
    tag: recoverProvenanceBeforeUnlockedRead.name,
    l,
  },);
  if (!await provenanceJournalsPresent(registryRoot,)) {
    rl.debug('no provenance journal published; reading without the recursive-operation lock',);
    return;
  }
  rl.debug('provenance journal published; waiting for the recursive-operation lock before reading',);
  /**
   Registry-wide lock, held while dead holders' journals are recovered.
   */
  await using _recursiveLock = await acquireRecursiveRegistryLock({ registryRoot, },);
  await recoverProvenanceTransactions({ registryRoot, },);
  rl.debug('provenance journals settled',);
}
