/**
 * Copy-on-write draft-chain walk shared by the read path (`getChunk`)
 * and the deleted-message sweep.
 *
 * Turso (libSQL) does not implement recursive CTEs, so the chain is
 * walked one parent at a time in JS. Chain depth equals `revision - 1`,
 * bounded by the 10-revision edit cap, so each walk is short.
 */

import {
  get,
  NO_ROW,
} from '../db.ts';

/**
 * Sentinel marking the end of a draft chain (a root draft whose
 * `parent_id` is SQL NULL, or a draft id with no row). A unique `Symbol`
 * rather than `null`: draft ids are non-empty strings, so the walk
 * disambiguates with `=== CHAIN_END`.
 */
export const CHAIN_END: unique symbol = Symbol('messages-demo:chain-end',);

/**
 * Resolves the parent draft id of `draftId`, or `CHAIN_END` when the
 * draft is a chain root or does not exist.
 *
 * `parent_id IS NOT NULL` and `IFNULL(parent_id, '')` are evaluated in
 * SQL so the row type carries no `null`: `has_parent` (0/1) is the
 * discriminant and `parent_id` is only read when it is a real id.
 *
 * @param draftId - draft whose parent to resolve
 *
 * @returns parent draft id, or `CHAIN_END` at the root
 *
 * @example
 * ```ts
 * const parent = await stepToParent('d-3');
 * if (parent === CHAIN_END) return;
 * ```
 */
export async function stepToParent(draftId: string,): Promise<string | typeof CHAIN_END> {
  /**
   * Parent probe; `has_parent` gates the read of `parent_id` so the empty filler is never observed.
   */
  const parentRow = await get<{
    has_parent: number;
    parent_id: string;
  }>({
    sql: `SELECT (parent_id IS NOT NULL) AS has_parent, IFNULL(parent_id, '') AS parent_id
       FROM drafts WHERE id = ?`,
    params: [draftId,],
  },);
  if ((parentRow === NO_ROW) || (parentRow.has_parent
    === 0))
    return CHAIN_END;
  return parentRow.parent_id;
}
