/**
 * Read/write helpers for pull requests.
 *
 * A PR shares its identity with an issue (`issue_id` is both PK and FK).
 * Mergeability is a TEXT discriminant: 'unknown' | 'clean' | 'conflicts'.
 *
 * Mutating operations that the rebuild pipeline observes wrap in a libSQL
 * transaction with `BEGIN IMMEDIATE`/`COMMIT`/`ROLLBACK`, mirroring the
 * pattern in `issue.ts`.
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
import type { PullRequest, } from './types.ts';

/**
 * Inserts a PR record. Idempotent on `issue_id` collision.
 *
 * @param row - PR fields
 *
 * @example
 * ```ts
 * await insertPullRequest({
 *   issueId: 'i1',
 *   baseRef: 'refs/heads/main',
 *   headRef: 'refs/heads/feat',
 *   headSha: '0123abcd...',
 * });
 * ```
 */
export async function insertPullRequest(row: {
  issueId: string;
  baseRef: string;
  headRef: string;
  headSha: string;
  mergeable?: string;
},): Promise<void> {
  await run(
    `INSERT OR IGNORE INTO prs(issue_id, base_ref, head_ref, head_sha, mergeable)
     VALUES (?, ?, ?, ?, ?)`,
    [
      row.issueId,
      row.baseRef,
      row.headRef,
      row.headSha,
      row.mergeable ?? 'unknown',
    ],
  );
}

/**
 * Loads a PR by issue id.
 *
 * @param issueId - issue id (the PR's primary key)
 *
 * @returns PR row or `undefined`
 *
 * @example
 * ```ts
 * const pr = await getPullRequest('i1');
 * ```
 */
export async function getPullRequest(issueId: string,): Promise<PullRequest | undefined> {
  return await get<PullRequest>(
    'SELECT * FROM prs WHERE issue_id = ?',
    [issueId,],
  );
}

/**
 * Lists PRs whose head SHA matches a commit.
 *
 * Used after a `push` event to identify which PRs need a merge-status rebuild.
 *
 * @param headSha - the new HEAD commit SHA
 *
 * @returns PR rows whose head_sha matches (possibly empty)
 *
 * @example
 * ```ts
 * const prs = await listPullRequestsByHeadSha('abc123...');
 * ```
 */
export async function listPullRequestsByHeadSha(
  headSha: string,
): Promise<PullRequest[]> {
  return await all<PullRequest>(
    'SELECT * FROM prs WHERE head_sha = ?',
    [headSha,],
  );
}

/**
 * Atomically inserts an issue header, a PR row, advances the PR's
 * sequence, and writes a `pr.opened` event.
 *
 * @param row - PR creation fields
 *
 * @returns generated `events.id` for the `pr.opened` event
 *
 * @example
 * ```ts
 * const eventId = await createPullRequestWithEvent({
 *   issueId: 'i-pr-1',
 *   repoId: 'r1',
 *   number: 42,
 *   authorId: 'u1',
 *   title: 'Add feature',
 *   baseRef: 'refs/heads/main',
 *   headRef: 'refs/heads/feat',
 *   headSha: '0123abcd...',
 *   createdAt: Date.now(),
 * });
 * ```
 */
export async function createPullRequestWithEvent(row: {
  issueId: string;
  repoId: string;
  number: number;
  authorId: string;
  title: string;
  body?: string;
  baseRef: string;
  headRef: string;
  headSha: string;
  createdAt: number;
},): Promise<number> {
  await db.exec('BEGIN IMMEDIATE',);
  try {
    await run(
      `INSERT INTO issues(id, repo_id, number, author_id, title, body, state, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 'open', ?, ?)`,
      [
        row.issueId,
        row.repoId,
        row.number,
        row.authorId,
        row.title,
        row.body ?? '',
        row.createdAt,
        row.createdAt,
      ],
    );
    await run(
      `INSERT INTO prs(issue_id, base_ref, head_ref, head_sha, mergeable)
       VALUES (?, ?, ?, ?, 'unknown')`,
      [
        row.issueId,
        row.baseRef,
        row.headRef,
        row.headSha,
      ],
    );
    const sequenceNumber = await nextSequence(
      'pr',
      row.issueId,
    );
    const eventId = await insertEvent({
      resourceType: 'pr',
      resourceId: row.issueId,
      kind: 'pr.opened',
      payload: {
        repoId: row.repoId,
        baseRef: row.baseRef,
        headRef: row.headRef,
        headSha: row.headSha,
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
 * Atomically updates a PR's head SHA + mergeable state, advances the
 * PR's sequence, and writes a `push` event.
 *
 * @param row - update fields
 *
 * @returns generated `events.id` for the `push` event
 *
 * @example
 * ```ts
 * const eventId = await pushPullRequestHead({ issueId: 'i1', headSha: '...' , createdAt: Date.now() });
 * ```
 */
export async function pushPullRequestHead(row: {
  issueId: string;
  headSha: string;
  mergeable?: string;
  createdAt: number;
},): Promise<number> {
  await db.exec('BEGIN IMMEDIATE',);
  try {
    await run(
      `UPDATE prs SET head_sha = ?, mergeable = ?
       WHERE issue_id = ?`,
      [
        row.headSha,
        row.mergeable ?? 'unknown',
        row.issueId,
      ],
    );
    await run(
      'UPDATE issues SET updated_at = ? WHERE id = ?',
      [
        row.createdAt,
        row.issueId,
      ],
    );
    const sequenceNumber = await nextSequence(
      'pr',
      row.issueId,
    );
    const eventId = await insertEvent({
      resourceType: 'pr',
      resourceId: row.issueId,
      kind: 'push',
      payload: {
        headSha: row.headSha,
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
