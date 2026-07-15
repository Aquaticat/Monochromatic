/**
 * Fragment-index helpers.
 *
 * Reads and writes against `fragment_index`. The upsert is sequence-guarded
 * at SQL level so out-of-order rebuilds become no-ops.
 */

import {
  get,
  run,
} from '../db.ts';
import type { FragmentIndexRow, } from './types.ts';

/**
 * Reads a fragment-index row.
 *
 * @param fragmentKey - canonical fragment key
 *
 * @returns row or `undefined`
 *
 * @example
 * ```ts
 * const row = await getFragmentIndex('issues/r1/i1/detail');
 * ```
 */
export async function getFragmentIndex(
  fragmentKey: string,
): Promise<FragmentIndexRow | undefined> {
  return await get<FragmentIndexRow>({
    sql: 'SELECT * FROM fragment_index WHERE fragment_key = ?',
    params: [fragmentKey,],
  },);
}

/**
 * Updates a fragment-index row only when the supplied sequence is
 * strictly greater than the row's current sequence. Out-of-order
 * rebuilds become no-ops at SQL level.
 *
 * @param row - fragment-index update
 *
 * @returns `true` when the row was inserted or updated; `false` when discarded
 *
 * @example
 * ```ts
 * const accepted = await upsertFragmentIndexIfNewer({
 *   fragmentKey: 'issues/r1/i1/detail',
 *   contentHash: 'deadbeef',
 *   lastBuiltAt: Date.now(),
 *   sourceEventId: 42,
 *   sourceEventSequence: 42,
 * });
 * ```
 */
export async function upsertFragmentIndexIfNewer(row: {
  readonly fragmentKey: string;
  readonly contentHash: string;
  readonly lastBuiltAt: number;
  readonly sourceEventId: number;
  readonly sourceEventSequence: number;
},): Promise<boolean> {
  /**
   * Upsert result; `changes > 0` means our row won the sequence guard.
   */
  const result = await run({
    sql:
      `INSERT INTO fragment_index(fragment_key, content_hash, last_built_at, source_event_id, source_event_sequence)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(fragment_key) DO UPDATE SET
       content_hash = excluded.content_hash,
       last_built_at = excluded.last_built_at,
       source_event_id = excluded.source_event_id,
       source_event_sequence = excluded.source_event_sequence
     WHERE excluded.source_event_sequence > fragment_index.source_event_sequence`,
    params: [
      row.fragmentKey,
      row.contentHash,
      row.lastBuiltAt,
      row.sourceEventId,
      row.sourceEventSequence,
    ],
  },);
  return result.changes
    > 0;
}
