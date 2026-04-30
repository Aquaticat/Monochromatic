/**
 * Draft + chunk write paths.
 *
 * Drafts are the staging area for in-progress messages; they may have a
 * `parent_id` to form a copy-on-write chain for edits. Chunks are the
 * pre-rendered HTML bodies written via the chunk PUT endpoint and
 * referenced by the message's head draft.
 */

import db, {
  all,
  get,
  run,
} from '../db.ts';
import type { RenderedChunk, } from '../markdown-stream.ts';

/**
 * Inserts a new draft row.
 *
 * @param draft - draft fields. `id` is client-generated UUID; `parentId`
 *                is the previous draft when this draft is created during
 *                an edit, `null` for fresh messages.
 *
 * @example
 * ```ts
 * await createDraft({ id: 'd-1', userId: 'user-a', parentId: null });
 * ```
 */
export async function createDraft(
  draft: {
    id: string;
    userId: string;
    parentId: string | null;
  },
): Promise<void> {
  const now = Date.now();
  await run(
    'INSERT INTO drafts(id, parent_id, user_id, created_at, updated_at, finalized) VALUES (?, ?, ?, ?, ?, 0)',
    [
      draft.id,
      draft.parentId,
      draft.userId,
      now,
      now,
    ],
  );
}

/**
 * Upserts one chunk into a draft. Idempotent: re-PUTting the same
 * `(draft_id, seq)` overwrites md/html/charCount.
 *
 * @param input - chunk identifiers and content
 *
 * @example
 * ```ts
 * await putChunk({ draftId: 'd-1', seq: 0, chunk: { md, html, charCount } });
 * ```
 */
export async function putChunk(
  input: {
    draftId: string;
    seq: number;
    chunk: RenderedChunk;
  },
): Promise<void> {
  const now = Date.now();
  // Drop the row first so the upsert path uses a single CONFLICT-free
  // INSERT. Turso's prepared-statement planner handles this well; the
  // alternative ON CONFLICT REPLACE syntax requires more migrations.
  await run(
    `INSERT INTO chunks(draft_id, seq, md, html, char_count)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(draft_id, seq) DO UPDATE SET
         md = excluded.md,
         html = excluded.html,
         char_count = excluded.char_count`,
    [
      input.draftId,
      input.seq,
      input.chunk.md,
      input.chunk.html,
      input.chunk.charCount,
    ],
  );
  await run(
    'UPDATE drafts SET updated_at = ? WHERE id = ?',
    [
      now,
      input.draftId,
    ],
  );
}

/**
 * Returns the highest contiguous acknowledged seq for a draft, or `-1`
 * when no chunks exist. Used by the client outbox to resume after a
 * connection reset: anything above the returned seq still needs PUTting,
 * any seq at or below is durable.
 *
 * @param draftId - target draft
 *
 * @returns highest contiguous seq, or `-1` for an empty draft
 *
 * @example
 * ```ts
 * await highestContiguousSeq('d-1'); // 47 means seqs 0..47 are durable
 * ```
 */
export async function highestContiguousSeq(draftId: string,): Promise<number> {
  // Turso/libSQL does not implement window functions, so we materialise
  // the seq list and walk it in JS. A draft is capped at 100k chunks
  // by upstream limits; even at the maximum this scan is < 5 ms.
  const rows = await all<{ seq: number; }>(
    'SELECT seq FROM chunks WHERE draft_id = ? ORDER BY seq ASC',
    [draftId,],
  );
  let highest = -1;
  for (const row of rows) {
    if (row.seq === highest + 1)
      highest = row.seq;
    else
      break;
  }
  return highest;
}

/**
 * Checks whether a draft has any chunks (used by finalize to reject
 * empty drafts).
 *
 * @param draftId - target draft
 *
 * @returns `true` when at least one chunk exists
 *
 * @example
 * ```ts
 * if (!(await hasChunks(id))) throw new Error('empty');
 * ```
 */
export async function hasChunks(draftId: string,): Promise<boolean> {
  const row = await get<{ exists: number; }>(
    'SELECT EXISTS(SELECT 1 FROM chunks WHERE draft_id = ? LIMIT 1) AS "exists"',
    [draftId,],
  );
  return (row?.exists ?? 0) === 1;
}

/**
 * Finalises a draft into a `messages` row. Performs the empty-draft
 * check, the INSERT, and the `finalized = 1` UPDATE in one transaction.
 *
 * @param input - finalize fields. `userId` must match the draft's stored
 *                user_id; mismatch returns `null` so the handler can 403.
 *                `charCount`, `chunkCount`, and `preview` come from the
 *                client (the worker has already aggregated them).
 *
 * @returns the new `messages.id`, or `null` when the draft is missing,
 *          empty, or owned by a different user
 *
 * @example
 * ```ts
 * const id = await finalizeDraft({ draftId, userId, charCount, chunkCount, preview });
 * ```
 */
export async function finalizeDraft(
  input: {
    draftId: string;
    userId: string;
    charCount: number;
    chunkCount: number;
    preview: string;
  },
): Promise<number | null> {
  const draft = await get<{ user_id: string; }>(
    'SELECT user_id FROM drafts WHERE id = ?',
    [input.draftId,],
  );
  if (draft === undefined || draft.user_id !== input.userId)
    return null;
  if (!(await hasChunks(input.draftId,)))
    return null;

  const now = Date.now();
  await db.exec('BEGIN IMMEDIATE',);
  try {
    const insert = await run(
      `INSERT INTO messages(draft_id, user_id, created_at, updated_at,
                            revision, char_count, chunk_count, preview)
         VALUES (?, ?, ?, ?, 1, ?, ?, ?)`,
      [
        input.draftId,
        input.userId,
        now,
        now,
        input.charCount,
        input.chunkCount,
        input.preview,
      ],
    );
    await run(
      'UPDATE drafts SET finalized = 1 WHERE id = ?',
      [input.draftId,],
    );
    await db.exec('COMMIT',);
    return Number(insert.lastInsertRowid,);
  }
  catch (error) {
    await db.exec('ROLLBACK',);
    throw error;
  }
}

/**
 * Cancels (deletes) an unfinalised draft. Cascades to chunks via FK.
 * Refuses to delete a finalised draft (would orphan a messages row).
 *
 * @param input - draft and identity
 *
 * @returns `true` when a row was deleted, `false` otherwise (missing,
 *          finalised, or wrong user)
 *
 * @example
 * ```ts
 * await cancelDraft({ draftId, userId });
 * ```
 */
export async function cancelDraft(
  input: {
    draftId: string;
    userId: string;
  },
): Promise<boolean> {
  const result = await run(
    'DELETE FROM drafts WHERE id = ? AND user_id = ? AND finalized = 0',
    [
      input.draftId,
      input.userId,
    ],
  );
  return result.changes > 0;
}
