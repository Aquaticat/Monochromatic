/**
 * Backend querying for synchronous stores.
 */

import type { BackendResult, } from '../../../../consensus.ts';
import type { SyncStorageBackend, } from '../../../../t/r s/index.ts';

/**
 * Query all sync backends for a key and return typed results with priority info.
 *
 * @param backends - sync storage backends to query
 *
 * @param key - lookup key
 *
 * @returns results from all backends
 *
 * @example
 * ```ts
 * const results = queryAllBackendsSync(backends, 'my-key');
 * ```
 */
export function queryAllBackendsSync(
  backends: readonly [
    SyncStorageBackend,
    ...SyncStorageBackend[],
  ],
  key: string,
): [
  BackendResult<SyncStorageBackend>,
  ...BackendResult<SyncStorageBackend>[],
] {
  const results = backends.map(function queryBackend(backend,) {
    const raw = backend.get(key,);
    return {
      value: raw ?? undefined,
      // oxlint-disable-next-line typescript/prefer-nullish-coalescing -- 0 is a valid default for undefined priority
      priority: backend.priority ?? 0,
      backend,
    };
  },);
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- non-empty backends guarantees non-empty results
  return results as [
    BackendResult<SyncStorageBackend>,
    ...BackendResult<SyncStorageBackend>[],
  ];
}
