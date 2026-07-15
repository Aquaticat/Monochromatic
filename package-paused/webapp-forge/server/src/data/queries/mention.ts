/**
 * Read/write helpers for the cross-cutting mention reverse index.
 *
 * The mention index lets the dispatcher answer "given a user-rename event,
 * which fragments mention this user?" in one keyed lookup rather than
 * scanning every fragment in the system. Inserts happen during render
 * (the renderer already iterates the body looking for `@login` tokens),
 * so the index stays consistent with what was actually written.
 */

import {
  all,
  run,
} from '../db.ts';

/**
 * Records that a fragment mentions a user.
 *
 * @param row - mention fields
 *
 * @example
 * ```ts
 * await addMention({ userId: 'u1', fragmentKey: 'issues/r1/i1/detail' });
 * ```
 */
export async function addMention(row: {
  readonly userId: string;
  readonly fragmentKey: string;
},): Promise<void> {
  await run({
    sql: 'INSERT OR IGNORE INTO mention_index(user_id, fragment_key) VALUES (?, ?)',
    params: [
      row.userId,
      row.fragmentKey,
    ],
  },);
}

/**
 * Removes a single user-fragment mention link.
 *
 * @param row - mention keys
 *
 * @example
 * ```ts
 * await removeMention({ userId: 'u1', fragmentKey: 'issues/r1/i1/detail' });
 * ```
 */
export async function removeMention(row: {
  readonly userId: string;
  readonly fragmentKey: string;
},): Promise<void> {
  await run({
    sql: 'DELETE FROM mention_index WHERE user_id = ? AND fragment_key = ?',
    params: [
      row.userId,
      row.fragmentKey,
    ],
  },);
}

/**
 * Replaces the full mention set for a fragment in one statement-pair.
 *
 * Use after re-rendering: drop every mention pointing to this fragment,
 * then re-insert the current set. The dispatcher already serialises
 * renders per fragment_key via the sequence guard, so the delete + insert
 * pair runs without an interleaved render.
 *
 * @param row - replacement set
 *
 * @example
 * ```ts
 * await replaceMentionsForFragment({
 *   fragmentKey: 'issues/r1/i1/detail',
 *   userIds: ['u1', 'u2'],
 * });
 * ```
 */
export async function replaceMentionsForFragment(row: {
  readonly fragmentKey: string;
  readonly userIds: readonly string[];
},): Promise<void> {
  await run({
    sql: 'DELETE FROM mention_index WHERE fragment_key = ?',
    params: [row.fragmentKey,],
  },);
  for (const userId of row.userIds) {
    // oxlint-disable-next-line no-await-in-loop -- libSQL prepared statements run serially over the same connection
    await run({
      sql: 'INSERT OR IGNORE INTO mention_index(user_id, fragment_key) VALUES (?, ?)',
      params: [
        userId,
        row.fragmentKey,
      ],
    },);
  }
}

/**
 * Lists every fragment that mentions a user.
 *
 * @param userId - user id
 *
 * @returns sorted fragment keys (possibly empty)
 *
 * @example
 * ```ts
 * const keys = await listFragmentsMentioningUser('u1');
 * ```
 */
export async function listFragmentsMentioningUser(userId: string,): Promise<string[]> {
  /**
   * Raw `mention_index` rows projected to fragment keys below.
   */
  const rows = await all<{ readonly fragment_key: string; }>({
    sql:
      'SELECT fragment_key FROM mention_index WHERE user_id = ? ORDER BY fragment_key ASC',
    params: [userId,],
  },);
  return rows.map(function pickKey(r,) {
    return r.fragment_key;
  },);
}

/**
 * Lists every user mentioned by a fragment.
 *
 * @param fragmentKey - fragment key
 *
 * @returns sorted user ids (possibly empty)
 *
 * @example
 * ```ts
 * const ids = await listUsersMentionedByFragment('issues/r1/i1/detail');
 * ```
 */
export async function listUsersMentionedByFragment(
  fragmentKey: string,
): Promise<string[]> {
  /**
   * Raw `mention_index` rows projected to user ids below.
   */
  const rows = await all<{ readonly user_id: string; }>({
    sql: 'SELECT user_id FROM mention_index WHERE fragment_key = ? ORDER BY user_id ASC',
    params: [fragmentKey,],
  },);
  return rows.map(function pickId(r,) {
    return r.user_id;
  },);
}
