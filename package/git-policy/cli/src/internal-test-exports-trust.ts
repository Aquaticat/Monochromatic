/**
 Trust registry lock internals reachable from the built artifact for unit tests.

 Not part of the authoring API;
 names and shapes change without notice.

 @internal

 @module
 */
import { acquireRecursiveRegistryLock, } from './trust/registry-recursive-lock.ts';

/**
 Shapes of the trust registry internals exposed to built-artifact tests.
 */
export type TrustTestExports = Readonly<{
  /**
   Internal `acquireRecursiveRegistryLock`.
   */
  acquireRecursiveRegistryLock: typeof acquireRecursiveRegistryLock;
}>;

/**
 Trust registry internals as one plain object.
 */
export const trustTestExports: TrustTestExports = {
  acquireRecursiveRegistryLock,
};
