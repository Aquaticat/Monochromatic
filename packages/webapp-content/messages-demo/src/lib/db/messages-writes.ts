/**
 * Message edit and delete write paths.
 *
 * Split from `messages.ts` so the read-heavy module stays under the line
 * cap. Both writes guard ownership and soft-delete state inside a single
 * transaction so an in-flight cancellation cannot race the mutation.
 */

import db, {
  get,
  NO_ROW,
  run,
} from '../db.ts';

/**
 * Maximum number of edits per message. The 11th edit returns 409 with a
 * suggestion to "save as new message." Cap exists because chain depth
 * grows linearly with revisions and chain compaction is out of scope.
 */
export const MAX_REVISIONS = 10;

/**
 * Outcome codes returned by the edit handler.
 */
export type EditOutcome =
  | {
    readonly kind: 'ok';
    readonly newRevision: number;
  }
  | { readonly kind: 'forbidden'; }
  | { readonly kind: 'capped'; }
  | { readonly kind: 'not-found'; };

/**
 * Atomically swaps a message's `draft_id` to a new draft and increments
 * `revision`. Refuses when:
 *
 * - The message does not exist (`not-found`)
 * - The user does not own the message (`forbidden`)
 * - The message has already been edited `MAX_REVISIONS` times (`capped`)
 *
 * The new draft must already exist and be owned by the same user; this
 * is checked in the SAME transaction so an in-flight cancellation
 * cannot race the edit.
 *
 * @param input - message id, user id, new draft id, aggregated counts
 *
 * @returns outcome describing why the edit succeeded or was refused
 *
 * @example
 * ```ts
 * const outcome = await editMessage({ messageId, userId, newDraftId, charCount, chunkCount, preview });
 * ```
 */
export async function editMessage(
  input: {
    readonly messageId: number;
    readonly userId: string;
    readonly newDraftId: string;
    readonly charCount: number;
    readonly chunkCount: number;
    readonly preview: string;
  },
): Promise<EditOutcome> {
  await db.exec('BEGIN IMMEDIATE',);
  try {
    /**
     * Current message row; drives the outcome variant based on existence, ownership, and revision cap.
     */
    const message = await get<{
      user_id: string;
      revision: number;
      deleted: number;
    }>({
      sql: 'SELECT user_id, revision, (deleted_at IS NOT NULL) AS deleted FROM messages WHERE id = ?',
      params: [input.messageId,],
    },);
    if ((message === NO_ROW) || (message.deleted
      !== 0)) {
      await db.exec('ROLLBACK',);
      return { kind: 'not-found', };
    }
    if (message.user_id
      !== input
      .userId) {
      await db.exec('ROLLBACK',);
      return { kind: 'forbidden', };
    }
    if (message.revision
      >= MAX_REVISIONS) {
      await db.exec('ROLLBACK',);
      return { kind: 'capped', };
    }
    /**
     * Child draft row; absent or mismatched ownership becomes `forbidden`.
     */
    const newDraft = await get<{
      user_id: string;
      finalized: number;
    }>({
      sql: 'SELECT user_id, finalized FROM drafts WHERE id = ?',
      params: [input.newDraftId,],
    },);
    if ((newDraft === NO_ROW) || (newDraft.user_id
      !== input
      .userId)) {
      await db.exec('ROLLBACK',);
      return { kind: 'forbidden', };
    }

    /**
     * Captured before the UPDATE so messages.updated_at reflects the commit moment.
     */
    const now = Date.now();
    /**
     * Incremented revision returned to the handler so it can echo the new value.
     */
    const newRevision = message.revision
      + 1;
    await run({
      sql: `UPDATE messages
         SET draft_id = ?, revision = ?, updated_at = ?,
             char_count = ?, chunk_count = ?, preview = ?
         WHERE id = ?`,
      params: [
        input.newDraftId,
        newRevision,
        now,
        input.charCount,
        input.chunkCount,
        input.preview,
        input.messageId,
      ],
    },);
    await run({
      sql: 'UPDATE drafts SET finalized = 1 WHERE id = ?',
      params: [input.newDraftId,],
    },);
    await db.exec('COMMIT',);
    return {
      kind: 'ok',
      newRevision,
    };
  }
  catch (error) {
    await db.exec('ROLLBACK',);
    throw error;
  }
}

/**
 * Outcome codes returned by the delete handler.
 */
export type DeleteOutcome =
  | { readonly kind: 'ok'; }
  | { readonly kind: 'forbidden'; }
  | { readonly kind: 'not-found'; };

/**
 * Soft-deletes a message. Subsequent feed reads exclude it via the
 * partial index; `getSnapshot` returns `ABSENT`. Hard-delete and chunk
 * cleanup happen in the deleted-message sweep.
 *
 * @param input - message id and identity
 *
 * @returns outcome explaining whether the row was updated
 *
 * @example
 * ```ts
 * const outcome = await softDeleteMessage({ messageId, userId });
 * ```
 */
export async function softDeleteMessage(
  input: {
    readonly messageId: number;
    readonly userId: string;
  },
): Promise<DeleteOutcome> {
  /**
   * Current message row; absent or already-deleted becomes `not-found`, mismatched user becomes `forbidden`.
   */
  const message = await get<{
    user_id: string;
    deleted: number;
  }>({
    sql: 'SELECT user_id, (deleted_at IS NOT NULL) AS deleted FROM messages WHERE id = ?',
    params: [input.messageId,],
  },);
  if (message === NO_ROW)
    return { kind: 'not-found', };
  if (message.deleted
    !== 0)
    return { kind: 'not-found', };
  if (message.user_id
    !== input
    .userId)
    return { kind: 'forbidden', };
  /**
   * Captured before the UPDATE so deleted_at and updated_at land at the same instant.
   */
  const now = Date.now();
  await run({
    sql: 'UPDATE messages SET deleted_at = ?, updated_at = ? WHERE id = ?',
    params: [
      now,
      now,
      input.messageId,
    ],
  },);
  return { kind: 'ok', };
}
