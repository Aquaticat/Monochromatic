/**
 * Message read paths and edit/delete writes.
 *
 * Reads resolve a chunk via a recursive CTE that walks the draft chain
 * head-first, returning the closest ancestor draft that contains the
 * requested seq. This makes copy-on-write edits work without copying
 * unchanged chunks.
 */

import {
  all,
  get,
  NO_ROW,
} from '../db.ts';
import {
  CHAIN_END,
  stepToParent,
} from './chain.ts';
import {
  type Cursor,
  FEED_PAGE_SIZE,
} from '../pagination.ts';

export {
  type DeleteOutcome,
  editMessage,
  type EditOutcome,
  MAX_REVISIONS,
  softDeleteMessage,
} from './messages-writes.ts';

/**
 * Sentinel for a read that resolves no entity: `getSnapshot` for a
 * missing or soft-deleted message, `getChunk` for an out-of-range chunk
 * index. A unique `Symbol` rather than `null`; a real snapshot or chunk
 * is always an object, so callers disambiguate with `=== ABSENT`.
 */
export const ABSENT: unique symbol = Symbol('messages-demo:absent',);

/**
 * Public shape of a row in the message feed.
 */
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

/**
 * Snapshot of a message taken at the start of a read transaction.
 */
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
 *                 omitted for the first page
 *
 * @returns up to `FEED_PAGE_SIZE` rows in newest-first order
 *
 * @example
 * ```ts
 * const page = await listFeed();
 * const next = await listFeed({ createdAt: page.at(-1)!.createdAt, id: page.at(-1)!.id });
 * ```
 */
export async function listFeed(cursor?: Cursor,): Promise<FeedMessage[]> {
  /**
   * Raw SQL rows from the cursor or non-cursor query; mapped to the FeedMessage shape below.
   */
  const rows = cursor === undefined
    ? await all<{
      readonly id: number;
      readonly user_id: string;
      readonly user_name: string;
      readonly created_at: number;
      readonly updated_at: number;
      readonly revision: number;
      readonly chunk_count: number;
      readonly preview: string;
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
      readonly id: number;
      readonly user_id: string;
      readonly user_name: string;
      readonly created_at: number;
      readonly updated_at: number;
      readonly revision: number;
      readonly chunk_count: number;
      readonly preview: string;
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
  /**
   * Single-row aggregates query; `COALESCE` folds the empty-corpus null into 0 in SQL so the row type stays null-free.
   */
  const row = await get<{
    max_id: number;
    max_updated_at: number;
  }>({
    sql: `SELECT COALESCE(MAX(id), 0) AS max_id, COALESCE(MAX(updated_at), 0) AS max_updated_at
       FROM messages WHERE deleted_at IS NULL`,
  },);
  if (row === NO_ROW)
    return {
      maxId: 0,
      maxUpdatedAt: 0,
    };
  return {
    maxId: row.max_id,
    maxUpdatedAt: row.max_updated_at,
  };
}

/**
 * Loads the snapshot for a single message. Returns `ABSENT` when the
 * message does not exist or is soft-deleted (handlers translate this to
 * 410 Gone vs 404 based on whether the row exists at all).
 *
 * Caller is responsible for opening a `BEGIN DEFERRED` transaction
 * before invoking this and `getChunk`: WAL snapshot isolation guards
 * the streaming response from observing a partial edit.
 *
 * @param messageId - target message id
 *
 * @returns snapshot, or `ABSENT` when not found or deleted
 *
 * @example
 * ```ts
 * const snapshot = await getSnapshot(42);
 * ```
 */
export async function getSnapshot(messageId: number,): Promise<MessageSnapshot | typeof ABSENT> {
  /**
   * Single-row snapshot lookup; `deleted` (0/1) is computed in SQL so the row type stays null-free.
   */
  const row = await get<{
    id: number;
    draft_id: string;
    revision: number;
    chunk_count: number;
    user_id: string;
    user_name: string;
    deleted: number;
  }>({
    sql: `SELECT m.id, m.draft_id, m.revision, m.chunk_count, m.user_id,
            u.name AS user_name, (m.deleted_at IS NOT NULL) AS deleted
       FROM messages m JOIN users u ON u.id = m.user_id
       WHERE m.id = ?`,
    params: [messageId,],
  },);
  if ((row === NO_ROW) || (row.deleted
    !== 0))
    return ABSENT;
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
  /**
   * Single-row EXISTS probe; a no-row result reads as "does not exist".
   */
  const row = await get<{ exists: number; }>({
    sql: 'SELECT EXISTS(SELECT 1 FROM messages WHERE id = ?) AS "exists"',
    params: [messageId,],
  },);
  if (row === NO_ROW)
    return false;
  return row.exists
    === 1;
}

/**
 * Pre-rendered chunk fields returned to the read path.
 */
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
 * @returns chunk content, or `ABSENT` when the chunk index is out of range
 *
 * @example
 * ```ts
 * const chunk = await getChunk({ messageId: 5, chunkIndex: 7 });
 * ```
 */
export async function getChunk(
  input: {
    readonly messageId: number;
    readonly chunkIndex: number;
  },
): Promise<ChunkRow | typeof ABSENT> {
  // Turso does not implement recursive CTEs, so we walk the chain in
  // JS. Chain depth is `revision - 1`; capped at 10 by the edit handler,
  // so this loop is bounded.
  /**
   * Head draft row; absence means the message id is unknown.
   */
  const head = await get<{ draft_id: string; }>({
    sql: 'SELECT draft_id FROM messages WHERE id = ?',
    params: [input.messageId,],
  },);
  if (head === NO_ROW)
    return ABSENT;
  /* oxlint-disable no-restricted-syntax/no-function-root-let -- parser cursor with side-effecting branches: the walk advances `cursor` after each row-by-row decision and exits via either `return found` or the reassignment to the `CHAIN_END` sentinel */
  /**
   * Walk cursor; advances to each draft's parent until a chunk is found or the chain ends.
   */
  let cursor: string | typeof CHAIN_END = head.draft_id;
  /* oxlint-enable no-restricted-syntax/no-function-root-let */
  // Chain walk: each iteration must read the previous draft's parent_id
  // before deciding whether to keep walking. Inherently sequential.
  /* oxlint-disable eslint/no-await-in-loop */
  while (cursor !== CHAIN_END) {
    /**
     * Chunk row in the current draft, if present; a real row returns the chunk immediately.
     */
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
    if (found !== NO_ROW)
      return found;
    cursor = await stepToParent(cursor,);
  }
  /* oxlint-enable eslint/no-await-in-loop */
  return ABSENT;
}
