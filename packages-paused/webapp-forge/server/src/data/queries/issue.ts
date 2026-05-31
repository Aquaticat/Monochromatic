/**
 * Issue + comment writes (with event-log entries) and read helpers.
 *
 * Every write that the rebuild pipeline observes wraps in a libSQL
 * transaction so the resource update, sequence advance, and event
 * insertion all commit together.
 */

import db, {
  all,
  get,
  run,
} from '../db.ts';
import {
  insertEvent,
  nextSequence,
} from './event-log.ts';
import type {
  Comment,
  Issue,
  IssueIdRow,
  Label,
} from './types.ts';

/**
 * Atomically inserts an issue, advances its sequence, and writes an
 * `issue.created` event. All three statements run inside one libSQL
 * transaction so either everything commits or nothing does.
 *
 * @param row - issue fields
 *
 * @returns generated `events.id` for the `issue.created` event
 *
 * @example
 * ```ts
 * await createIssueWithEvent({
 *   id: 'i1',
 *   repoId: 'r1',
 *   number: 1,
 *   authorId: 'u1',
 *   title: 'Bug',
 *   createdAt: Date.now(),
 * });
 * ```
 */
export async function createIssueWithEvent(row: {
  readonly id: string;
  readonly repoId: string;
  readonly number: number;
  readonly authorId: string;
  readonly title: string;
  readonly body?: string;
  readonly createdAt: number;
},): Promise<number> {
  await db.exec('BEGIN IMMEDIATE',);
  try {
    await run({
      sql:
        `INSERT INTO issues(id, repo_id, number, author_id, title, body, state, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 'open', ?, ?)`,
      params: [
        row.id,
        row.repoId,
        row.number,
        row.authorId,
        row.title,
        row.body
          ?? '',
        row.createdAt,
        row.createdAt,
      ],
    },);
    /**
     * Per-resource monotonic sequence captured before the event row insert.
     */
    const sequenceNumber = await nextSequence({
      resourceType: 'issue',
      resourceId: row.id,
    },);
    /**
     * Generated `events.id` returned to callers for cursor tracking.
     */
    const eventId = await insertEvent({
      resourceType: 'issue',
      resourceId: row.id,
      kind: 'issue.created',
      payload: {
        repoId: row.repoId,
        number: row.number,
        authorId: row.authorId,
      },
      sequenceNumber,
      createdAt: row.createdAt,
    },);
    await db.exec('COMMIT',);
    return eventId;
  }
  catch (error) {
    await db.exec('ROLLBACK',);
    throw error;
  }
}

/**
 * Atomically attaches a label to an issue, advances the issue's
 * sequence, and writes an `issue.labeled` event.
 *
 * @param row - issue + label binding
 *
 * @returns generated `events.id` for the `issue.labeled` event
 *
 * @example
 * ```ts
 * await labelIssueWithEvent({ issueId: 'i1', labelId: 'l1', createdAt: Date.now() });
 * ```
 */
export async function labelIssueWithEvent(row: {
  readonly issueId: string;
  readonly labelId: string;
  readonly createdAt: number;
},): Promise<number> {
  await db.exec('BEGIN IMMEDIATE',);
  try {
    await run({
      sql: 'INSERT OR IGNORE INTO issue_labels(issue_id, label_id) VALUES (?, ?)',
      params: [
        row.issueId,
        row.labelId,
      ],
    },);
    await run({
      sql: 'UPDATE issues SET updated_at = ? WHERE id = ?',
      params: [
        row.createdAt,
        row.issueId,
      ],
    },);
    /**
     * Per-resource monotonic sequence captured before the event row insert.
     */
    const sequenceNumber = await nextSequence({
      resourceType: 'issue',
      resourceId: row.issueId,
    },);
    /**
     * Generated `events.id` returned to callers for cursor tracking.
     */
    const eventId = await insertEvent({
      resourceType: 'issue',
      resourceId: row.issueId,
      kind: 'issue.labeled',
      payload: { labelId: row.labelId, },
      sequenceNumber,
      createdAt: row.createdAt,
    },);
    await db.exec('COMMIT',);
    return eventId;
  }
  catch (error) {
    await db.exec('ROLLBACK',);
    throw error;
  }
}

/**
 * Atomically inserts a comment, advances the parent issue's sequence,
 * and writes a `comment.created` event.
 *
 * @param row - comment fields
 *
 * @returns generated `events.id` for the `comment.created` event
 *
 * @example
 * ```ts
 * await createCommentWithEvent({
 *   id: 'c1',
 *   issueId: 'i1',
 *   authorId: 'u1',
 *   body: 'first',
 *   createdAt: Date.now(),
 * });
 * ```
 */
export async function createCommentWithEvent(row: {
  readonly id: string;
  readonly issueId: string;
  readonly authorId: string;
  readonly body: string;
  readonly createdAt: number;
},): Promise<number> {
  await db.exec('BEGIN IMMEDIATE',);
  try {
    await run({
      sql:
        'INSERT INTO comments(id, issue_id, author_id, body, created_at) VALUES (?, ?, ?, ?, ?)',
      params: [
        row.id,
        row.issueId,
        row.authorId,
        row.body,
        row.createdAt,
      ],
    },);
    await run({
      sql: 'UPDATE issues SET updated_at = ? WHERE id = ?',
      params: [
        row.createdAt,
        row.issueId,
      ],
    },);
    /**
     * Per-resource monotonic sequence captured before the event row insert.
     */
    const sequenceNumber = await nextSequence({
      resourceType: 'issue',
      resourceId: row.issueId,
    },);
    /**
     * Generated `events.id` returned to callers for cursor tracking.
     */
    const eventId = await insertEvent({
      resourceType: 'issue',
      resourceId: row.issueId,
      kind: 'comment.created',
      payload: {
        commentId: row.id,
        authorId: row.authorId,
      },
      sequenceNumber,
      createdAt: row.createdAt,
    },);
    await db.exec('COMMIT',);
    return eventId;
  }
  catch (error) {
    await db.exec('ROLLBACK',);
    throw error;
  }
}

/**
 * Loads an issue by id.
 *
 * @param id - issue id
 *
 * @returns issue row or `undefined`
 *
 * @example
 * ```ts
 * const issue = await getIssue('i1');
 * ```
 */
export async function getIssue(id: string,): Promise<Issue | undefined> {
  return await get<Issue>({
    sql: 'SELECT * FROM issues WHERE id = ?',
    params: [id,],
  },);
}

/**
 * Loads a single comment row by id (for the Phase 2 standalone-comment
 * renderer).
 *
 * @param id - comment id
 *
 * @returns comment row or `undefined`
 *
 * @example
 * ```ts
 * const c = await getComment('c1');
 * ```
 */
export async function getComment(id: string,): Promise<Comment | undefined> {
  return await get<Comment>({
    sql: 'SELECT * FROM comments WHERE id = ?',
    params: [id,],
  },);
}

/**
 * Loads an issue by `(repo_id, number)`.
 *
 * @param row - lookup keys
 *
 * @returns issue row or `undefined`
 *
 * @example
 * ```ts
 * const issue = await getIssueByNumber({ repoId: 'r1', number: 5 });
 * ```
 */
export async function getIssueByNumber(row: {
  readonly repoId: string;
  readonly number: number;
},): Promise<Issue | undefined> {
  return await get<Issue>({
    sql: 'SELECT * FROM issues WHERE repo_id = ? AND number = ?',
    params: [
      row.repoId,
      row.number,
    ],
  },);
}

/**
 * Loads all comments for an issue, oldest first.
 *
 * @param issueId - issue id
 *
 * @returns comments array (possibly empty)
 *
 * @example
 * ```ts
 * const comments = await listComments('i1');
 * ```
 */
export async function listComments(issueId: string,): Promise<Comment[]> {
  return await all<Comment>({
    sql: 'SELECT * FROM comments WHERE issue_id = ? ORDER BY created_at ASC, id ASC',
    params: [issueId,],
  },);
}

/**
 * Loads all labels attached to an issue.
 *
 * @param issueId - issue id
 *
 * @returns labels array (possibly empty)
 *
 * @example
 * ```ts
 * const labels = await listIssueLabels('i1');
 * ```
 */
export async function listIssueLabels(issueId: string,): Promise<Label[]> {
  return await all<Label>({
    sql: `SELECT l.* FROM labels l
     JOIN issue_labels il ON il.label_id = l.id
     WHERE il.issue_id = ?
     ORDER BY l.name ASC`,
    params: [issueId,],
  },);
}

/**
 * Loads issue ids matching a filter, sorted by `updated_at` desc.
 *
 * @param row - filter inputs; `null` means "any"
 *
 * @returns array of `(issue_id, updated_at)` rows
 *
 * @example
 * ```ts
 * const ids = await listIssueIdsForFilter({ repoId: 'r1', labelId: null, state: 'open' });
 * ```
 */
export async function listIssueIdsForFilter(row: {
  readonly repoId: string;
  readonly labelId: string | null;
  readonly state: string;
},): Promise<IssueIdRow[]> {
  if (row.labelId
    === null) {
    return await all<IssueIdRow>({
      sql: `SELECT i.id, i.updated_at FROM issues i
       WHERE i.repo_id = ? AND i.state = ?
       ORDER BY i.updated_at DESC, i.id DESC`,
      params: [
        row.repoId,
        row.state,
      ],
    },);
  }
  return await all<IssueIdRow>({
    sql: `SELECT i.id, i.updated_at FROM issues i
     JOIN issue_labels il ON il.issue_id = i.id
     WHERE i.repo_id = ? AND i.state = ? AND il.label_id = ?
     ORDER BY i.updated_at DESC, i.id DESC`,
    params: [
      row.repoId,
      row.state,
      row.labelId,
    ],
  },);
}
