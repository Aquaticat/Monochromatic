/**
 * Read/write helpers for milestones and issue-milestone links.
 *
 * Each issue belongs to at most one milestone; clearing a link is a
 * separate operation from setting one so callers can unset on milestone
 * deletion or reassignment without a follow-up insert.
 */

import {
  all,
  get,
  run,
} from '../db.ts';
import type { Milestone, } from './types.ts';

/**
 * Inserts a milestone. Idempotent on `id` collision.
 *
 * @param row - milestone fields
 *
 * @example
 * ```ts
 * await insertMilestone({ id: 'm1', repoId: 'r1', title: 'v1.0', dueAt: null });
 * ```
 */
export async function insertMilestone(row: {
  readonly id: string;
  readonly repoId: string;
  readonly title: string;
  readonly dueAt?: number | null;
},): Promise<void> {
  await run({
    sql:
      'INSERT OR IGNORE INTO milestones(id, repo_id, title, due_at) VALUES (?, ?, ?, ?)',
    params: [
      row.id,
      row.repoId,
      row.title,
      row.dueAt
        ?? null,
    ],
  },);
}

/**
 * Loads a milestone by id.
 *
 * @param id - milestone id
 *
 * @returns milestone row or `undefined`
 *
 * @example
 * ```ts
 * const ms = await getMilestone('m1');
 * ```
 */
export async function getMilestone(id: string,): Promise<Milestone | undefined> {
  return await get<Milestone>({
    sql: 'SELECT * FROM milestones WHERE id = ?',
    params: [id,],
  },);
}

/**
 * Lists every milestone in a repo, due-date ascending then title.
 *
 * @param repoId - repo id
 *
 * @returns milestones array (possibly empty)
 *
 * @example
 * ```ts
 * const ms = await listRepoMilestones('r1');
 * ```
 */
export async function listRepoMilestones(repoId: string,): Promise<Milestone[]> {
  return await all<Milestone>({
    sql: `SELECT * FROM milestones WHERE repo_id = ?
     ORDER BY due_at IS NULL ASC, due_at ASC, title ASC`,
    params: [repoId,],
  },);
}

/**
 * Sets (or replaces) the milestone for an issue.
 *
 * @param row - link fields
 *
 * @example
 * ```ts
 * await setIssueMilestone({ issueId: 'i1', milestoneId: 'm1' });
 * ```
 */
export async function setIssueMilestone(row: {
  readonly issueId: string;
  readonly milestoneId: string;
},): Promise<void> {
  await run({
    sql: `INSERT INTO issue_milestone(issue_id, milestone_id) VALUES (?, ?)
     ON CONFLICT(issue_id) DO UPDATE SET milestone_id = excluded.milestone_id`,
    params: [
      row.issueId,
      row.milestoneId,
    ],
  },);
}

/**
 * Removes the milestone link for an issue.
 *
 * @param issueId - issue id
 *
 * @example
 * ```ts
 * await clearIssueMilestone('i1');
 * ```
 */
export async function clearIssueMilestone(issueId: string,): Promise<void> {
  await run({
    sql: 'DELETE FROM issue_milestone WHERE issue_id = ?',
    params: [issueId,],
  },);
}

/**
 * Returns the milestone id linked to an issue, or `undefined` if none.
 *
 * @param issueId - issue id
 *
 * @returns milestone id or `undefined`
 *
 * @example
 * ```ts
 * const ms = await getIssueMilestoneId('i1');
 * ```
 */
export async function getIssueMilestoneId(issueId: string,): Promise<string | undefined> {
  /**
   * Single junction row; `undefined` when the issue has no milestone.
   */
  const row = await get<{ readonly milestone_id: string; }>({
    sql: 'SELECT milestone_id FROM issue_milestone WHERE issue_id = ?',
    params: [issueId,],
  },);
  return row?.milestone_id;
}
