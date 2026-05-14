/**
 * Message read paths and edit/delete writes.
 *
 * Reads resolve a chunk via a recursive CTE that walks the draft chain
 * head-first, returning the closest ancestor draft that contains the
 * requested seq. This makes copy-on-write edits work without copying
 * unchanged chunks.
 */

import db, {
  all,
  get,
  run,
} from '../db.ts';
import {
  type Cursor,
  FEED_PAGE_SIZE,
} from '../pagination.ts';

/**
 * Maximum number of edits per message. The 11th edit returns 409 with a
 * suggestion to "save as new message." Cap exists because chain depth
 * grows linearly with revisions and chain compaction is out of scope.
 */
export const MAX_REVISIONS = 10;

/** Public shape of a row in the message feed. */
export type FeedMessage = {
  readonly id: number;
  readonly userId: string;
  readonly userName: string;
  readonly createdAt: number;
  readonly updatedAt: number;
  readonly revision: number;
  readonly chunkCount: number;
  readonly preview: string;
};

/** Snapshot of a message taken at the start of a read transaction. */
export type MessageSnapshot = {
  readonly id: number;
  readonly draftId: string;
  readonly revision: number;
  readonly chunkCount: number;
  readonly userId: string;
  readonly userName: string;
};

/**
 * Returns one page of the live (non-deleted) feed. Keyset paginated by
 * `(created_at DESC, id DESC)`; the partial index `messages_feed`
 * matches this order and the `deleted_at IS NULL` predicate so SQLite
 * can plan an index-only walk.
 *
 * @param cursor - position of the last message on the previous page,
 *                 or `null` for the first page
 *
 * @returns up to `FEED_PAGE_SIZE` rows in newest-first order
 *
 * @example
 * ```ts
 * const page = await listFeed(null);
 * const next = await listFeed({ createdAt: page.at(-1)!.createdAt, id: page.at(-1)!.id });
 * ```
 */
export async function listFeed(cursor: Cursor | null,): Promise<FeedMessage[]> {
  /** Raw SQL rows from the cursor or non-cursor query; mapped to the FeedMessage shape below. */
  const rows = cursor === null
    ? await all<{
      id: number;
      user_id: string;
      user_name: string;
      created_at: number;
      updated_at: number;
      revision: number;
      chunk_count: number;
      preview: string;
    }>({
      sql: `SELECT m.id, m.user_id, u.name AS user_name, m.created_at, m.updated_at,
                m.revision, m.chunk_count, m.preview
         FROM messages m JOIN users u ON u.id = m.user_id
         WHERE m.deleted_at IS NULL
         ORDER BY m.created_at DESC, m.id DESC
         LIMIT ?`,
      params: [FEED_PAGE_SIZE,],
    },)
    : await all<{
      id: number;
      user_id: string;
      user_name: string;
      created_at: number;
      updated_at: number;
      revision: number;
      chunk_count: number;
      preview: string;
    }>({
      sql: `SELECT m.id, m.user_id, u.name AS user_name, m.created_at, m.updated_at,
                m.revision, m.chunk_count, m.preview
         FROM messages m JOIN users u ON u.id = m.user_id
         WHERE m.deleted_at IS NULL
           AND (m.created_at < ? OR (m.created_at = ? AND m.id < ?))
         ORDER BY m.created_at DESC, m.id DESC
         LIMIT ?`,
      params: [
        cursor.createdAt,
        cursor.createdAt,
        cursor.id,
        FEED_PAGE_SIZE,
      ],
    },);

  return rows.map(function toFeedMessage(row,) {
    return {
      id: row.id,
      userId: row.user_id,
      userName: row.user_name,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      revision: row.revision,
      chunkCount: row.chunk_count,
      preview: row.preview,
    };
  },);
}

/**
 * Returns the maximum (id, updated_at) across live messages, or zeros
 * when the corpus is empty. Feeds the feed-page ETag.
 *
 * @returns aggregates suitable for `etagForFeed`
 *
 * @example
 * ```ts
 * const { maxId, maxUpdatedAt } = await feedAggregates();
 * ```
 */
export async function feedAggregates(): Promise<{
  maxId: number;
  maxUpdatedAt: number;
}> {
  /** Single-row aggregates query; nulls map to zeros so empty corpora still produce a stable ETag. */
  const row = await get<{
    max_id: number | null;
    max_updated_at: number | null;
  }>({
    sql: `SELECT MAX(id) AS max_id, MAX(updated_at) AS max_updated_at
       FROM messages WHERE deleted_at IS NULL`,
  },);
  return {
    maxId: row?.max_id ?? 0,
    maxUpdatedAt: row?.max_updated_at ?? 0,
  };
}

/**
 * Loads the snapshot for a single message. Returns `null` when the
 * message does not exist or is soft-deleted (handlers translate this to
 * 410 Gone vs 404 based on whether the row exists at all).
 *
 * Caller is responsible for opening a `BEGIN DEFERRED` transaction
 * before invoking this and `getChunk`: WAL snapshot isolation guards
 * the streaming response from observing a partial edit.
 *
 * @param messageId - target message id
 *
 * @returns snapshot, or `null` when not found or deleted
 *
 * @example
 * ```ts
 * const snapshot = await getSnapshot(42);
 * ```
 */
export async function getSnapshot(messageId: number,): Promise<MessageSnapshot | null> {
  /** Single-row snapshot lookup; null result or non-null `deleted_at` returns the public null below. */
  const row = await get<{
    id: number;
    draft_id: string;
    revision: number;
    chunk_count: number;
    user_id: string;
    user_name: string;
    deleted_at: number | null;
  }>({
    sql: `SELECT m.id, m.draft_id, m.revision, m.chunk_count, m.user_id,
            u.name AS user_name, m.deleted_at
       FROM messages m JOIN users u ON u.id = m.user_id
       WHERE m.id = ?`,
    params: [messageId,],
  },);
  if ((row === undefined) || (row.deleted_at !== null))
    return null;
  return {
    id: row.id,
    draftId: row.draft_id,
    revision: row.revision,
    chunkCount: row.chunk_count,
    userId: row.user_id,
    userName: row.user_name,
  };
}

/**
 * Returns whether a message id exists at all, regardless of soft-delete.
 * Used to distinguish 410 Gone (was a message, now deleted) from 404
 * Not Found (never existed).
 *
 * @param messageId - target id
 *
 * @returns `true` if the row exists in `messages`
 *
 * @example
 * ```ts
 * const exists = await messageExists(42);
 * ```
 */
export async function messageExists(messageId: number,): Promise<boolean> {
  /** Single-row EXISTS probe; null result returns `false` via the coalesce. */
  const row = await get<{ exists: number; }>({
    sql: 'SELECT EXISTS(SELECT 1 FROM messages WHERE id = ?) AS "exists"',
    params: [messageId,],
  },);
  return (row?.exists ?? 0) === 1;
}

/** Pre-rendered chunk fields returned to the read path. */
export type ChunkRow = {
  readonly md: string;
  readonly html: string;
};

/**
 * Reads chunk `(messageId, chunkIndex)` by walking the copy-on-write
 * draft chain head-first. Returns the closest ancestor draft that
 * contains a row for `seq = chunkIndex`.
 *
 * Chain depth equals `revision - 1`; for the demo's 10-revision cap the
 * walk is at most 10 PK lookups (~50 µs each).
 *
 * @param input - message + chunk index
 *
 * @returns chunk content, or `null` when the chunk index is out of range
 *
 * @example
 * ```ts
 * const chunk = await getChunk({ messageId: 5, chunkIndex: 7 });
 * ```
 */
export async function getChunk(
  input: {
    messageId: number;
    chunkIndex: number;
  },
): Promise<ChunkRow | null> {
  // Turso does not implement recursive CTEs, so we walk the chain in
  // JS. Chain depth is `revision - 1`; capped at 10 by the edit handler,
  // so this loop is bounded.
  /** Head draft row; absence means the message id is unknown. */
  const head = await get<{ draft_id: string; }>({
    sql: 'SELECT draft_id FROM messages WHERE id = ?',
    params: [input.messageId,],
  },);
  if (head === undefined)
    return null;
  /* oxlint-disable no-restricted-syntax/no-function-root-let -- parser cursor with side-effecting branches: the walk advances `cursor` after each row-by-row decision and exits via either `return found` or the parent-id reassignment to null */
  /** Walk cursor; advances to each draft's parent until a chunk is found or the chain ends. */
  let cursor: string | null = head.draft_id;
  /* oxlint-enable no-restricted-syntax/no-function-root-let */
  // Chain walk: each iteration must read the previous draft's parent_id
  // before deciding whether to keep walking. Inherently sequential.
  /* oxlint-disable eslint/no-await-in-loop */
  while (cursor !== null) {
    /** Chunk row in the current draft, if present; non-undefined returns the chunk immediately. */
    const found = await get<{
      md: string;
      html: string;
    }>({
      sql: 'SELECT md, html FROM chunks WHERE draft_id = ? AND seq = ?',
      params: [
        cursor,
        input.chunkIndex,
      ],
    },);
    if (found !== undefined)
      return found;
    /** Parent draft id used to step the chain back one revision. */
    const parentRow: { parent_id: string | null; } | undefined = await get<
      { parent_id: string | null; }
    >({
      sql: 'SELECT parent_id FROM drafts WHERE id = ?',
      params: [cursor,],
    },);
    cursor = parentRow?.parent_id ?? null;
  }
  /* oxlint-enable eslint/no-await-in-loop */
  return null;
}

/** Outcome codes returned by the edit handler. */
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
    messageId: number;
    userId: string;
    newDraftId: string;
    charCount: number;
    chunkCount: number;
    preview: string;
  },
): Promise<EditOutcome> {
  await db.exec('BEGIN IMMEDIATE',);
  try {
    /** Current message row; drives the outcome variant based on existence, ownership, and revision cap. */
    const message = await get<{
      user_id: string;
      revision: number;
      deleted_at: number | null;
    }>({
      sql: 'SELECT user_id, revision, deleted_at FROM messages WHERE id = ?',
      params: [input.messageId,],
    },);
    if ((message === undefined) || (message.deleted_at !== null)) {
      await db.exec('ROLLBACK',);
      return { kind: 'not-found', };
    }
    if (message.user_id !== input.userId) {
      await db.exec('ROLLBACK',);
      return { kind: 'forbidden', };
    }
    if (message.revision >= MAX_REVISIONS) {
      await db.exec('ROLLBACK',);
      return { kind: 'capped', };
    }
    /** Child draft row; absent or mismatched ownership becomes `forbidden`. */
    const newDraft = await get<{
      user_id: string;
      finalized: number;
    }>({
      sql: 'SELECT user_id, finalized FROM drafts WHERE id = ?',
      params: [input.newDraftId,],
    },);
    if ((newDraft === undefined) || (newDraft.user_id !== input.userId)) {
      await db.exec('ROLLBACK',);
      return { kind: 'forbidden', };
    }

    /** Captured before the UPDATE so messages.updated_at reflects the commit moment. */
    const now = Date.now();
    /** Incremented revision returned to the handler so it can echo the new value. */
    const newRevision = message.revision + 1;
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

/** Outcome codes returned by the delete handler. */
export type DeleteOutcome =
  | { readonly kind: 'ok'; }
  | { readonly kind: 'forbidden'; }
  | { readonly kind: 'not-found'; };

/**
 * Soft-deletes a message. Subsequent feed reads exclude it via the
 * partial index; `getSnapshot` returns `null`. Hard-delete and chunk
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
    messageId: number;
    userId: string;
  },
): Promise<DeleteOutcome> {
  /** Current message row; absent or already-deleted becomes `not-found`, mismatched user becomes `forbidden`. */
  const message = await get<{
    user_id: string;
    deleted_at: number | null;
  }>({
    sql: 'SELECT user_id, deleted_at FROM messages WHERE id = ?',
    params: [input.messageId,],
  },);
  if (message === undefined)
    return { kind: 'not-found', };
  if (message.deleted_at !== null)
    return { kind: 'not-found', };
  if (message.user_id !== input.userId)
    return { kind: 'forbidden', };
  /** Captured before the UPDATE so deleted_at and updated_at land at the same instant. */
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
