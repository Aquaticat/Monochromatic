/**
 Per-snapshot memo of TypeScript 7 synchronous API requests.

 @module
 */

import type { API, } from 'typescript/unstable/sync';

/**
 Request names whose answer is a pure function of snapshot, project, and parameters.
 */
export const MEMOIZED_SNAPSHOT_REQUESTS: ReadonlySet<string> = new Set<string>();

/**
 Most responses kept for one snapshot before the oldest is dropped.
 */
export const MAXIMUM_MEMOIZED_RESPONSES_PER_SNAPSHOT = 0;

/**
 Counters describing what a memo has served.
 */
export type SnapshotRequestMemoStats = {
  readonly hits: number;
  readonly misses: number;
  readonly evictions: number;
  readonly releases: number;
  readonly entries: number;
};

/**
 Surface of the synchronous API client the memo wraps.
 */
export type SnapshotRequestClient = {
  apiRequest: (method: string, params?: unknown,) => unknown;
};

/**
 Handle on an installed memo.
 */
export type SnapshotRequestMemo = {
  readonly stats: () => SnapshotRequestMemoStats;
};

/**
 Placeholder that forwards every request unchanged.

 @param options - Client to wrap.

 @returns statistics handle.
 */
export function memoizeSnapshotRequests(
  options: {
    readonly client: SnapshotRequestClient;
    readonly maximumResponses?: number;
  },
): SnapshotRequestMemo {
  void options;
  return {
    stats: function emptyStats(): SnapshotRequestMemoStats {
      return {
        hits: 0,
        misses: 0,
        evictions: 0,
        releases: 0,
        entries: 0,
      };
    },
  };
}

/**
 Placeholder that forwards every request unchanged.

 @param options - API whose client is wrapped.

 @returns statistics handle.
 */
export function memoizeApiSnapshotRequests(
  options: {
    readonly api: API;
    readonly maximumResponses?: number;
  },
): SnapshotRequestMemo {
  void options;
  return memoizeSnapshotRequests({
    client: { apiRequest: () => undefined, },
  },);
}
