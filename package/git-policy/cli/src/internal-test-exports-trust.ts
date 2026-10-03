/**
 Trust registry lock and provenance-transaction internals reachable from the built artifact for unit tests.

 Not part of the authoring API;
 names and shapes change without notice.

 @internal

 @module
 */
import { acquireRecursiveRegistryLock, } from './trust/registry-recursive-lock.ts';
import { recoverProvenanceTransactions, } from './trust/registry-transaction.ts';

/**
 Shapes of the trust registry internals exposed to built-artifact tests.
 */
export type TrustTestExports = Readonly<{
  /**
   Internal `acquireRecursiveRegistryLock`.
   */
  acquireRecursiveRegistryLock: typeof acquireRecursiveRegistryLock;
  /**
   Internal `recoverProvenanceTransactions`,
   so a test holding the recursive-operation lock can finish the transaction it simulates.
   */
  recoverProvenanceTransactions: typeof recoverProvenanceTransactions;
}>;

/**
 Trust registry internals as one plain object.
 */
export const trustTestExports: TrustTestExports = {
  acquireRecursiveRegistryLock,
  recoverProvenanceTransactions,
};
