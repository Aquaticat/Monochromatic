/**
 * Read/write helpers for repo membership and issue assignees.
 *
 * Both relations are simple many-to-many tables with a composite primary key
 * and no event-log writes; access-control changes are foundational metadata
 * that fragment renders treat as a stale read.
 */

import {
  all,
  get,
  run,
} from '../db.ts';
import type {
  RepoMember,
  User,
} from './types.ts';

/**
 * Adds (or updates the role of) a repo member.
 *
 * @param row - membership fields
 *
 * @example
 * ```ts
 * await upsertRepoMember({ repoId: 'r1', userId: 'u2', role: 'member' });
 * ```
 */
export async function upsertRepoMember(row: {
  readonly repoId: string;
  readonly userId: string;
  readonly role: string;
},): Promise<void> {
  await run({
    sql: `INSERT INTO repo_members(repo_id, user_id, role) VALUES (?, ?, ?)
     ON CONFLICT(repo_id, user_id) DO UPDATE SET role = excluded.role`,
    params: [
      row.repoId,
      row.userId,
      row.role,
    ],
  },);
}

/**
 * Removes a repo member.
 *
 * @param row - membership keys
 *
 * @example
 * ```ts
 * await removeRepoMember({ repoId: 'r1', userId: 'u2' });
 * ```
 */
export async function removeRepoMember(row: {
  readonly repoId: string;
  readonly userId: string;
},): Promise<void> {
  await run({
    sql: 'DELETE FROM repo_members WHERE repo_id = ? AND user_id = ?',
    params: [
      row.repoId,
      row.userId,
    ],
  },);
}

/**
 * Returns the membership row for a `(repo, user)` pair.
 *
 * @param row - membership keys
 *
 * @returns membership row or `undefined` (non-member)
 *
 * @example
 * ```ts
 * const m = await getRepoMember({ repoId: 'r1', userId: 'u2' });
 * ```
 */
export async function getRepoMember(row: {
  readonly repoId: string;
  readonly userId: string;
},): Promise<RepoMember | undefined> {
  return await get<RepoMember>({
    sql: 'SELECT * FROM repo_members WHERE repo_id = ? AND user_id = ?',
    params: [
      row.repoId,
      row.userId,
    ],
  },);
}

/**
 * Lists every member of a repo.
 *
 * @param repoId - repo id
 *
 * @returns membership rows in alphabetical user-id order
 *
 * @example
 * ```ts
 * const members = await listRepoMembers('r1');
 * ```
 */
export async function listRepoMembers(repoId: string,): Promise<RepoMember[]> {
  return await all<RepoMember>({
    sql: 'SELECT * FROM repo_members WHERE repo_id = ? ORDER BY user_id ASC',
    params: [repoId,],
  },);
}

/**
 * Adds a user as an issue assignee. Idempotent.
 *
 * @param row - assignee fields
 *
 * @example
 * ```ts
 * await assignUserToIssue({ issueId: 'i1', userId: 'u2' });
 * ```
 */
export async function assignUserToIssue(row: {
  readonly issueId: string;
  readonly userId: string;
},): Promise<void> {
  await run({
    sql: 'INSERT OR IGNORE INTO issue_assignees(issue_id, user_id) VALUES (?, ?)',
    params: [
      row.issueId,
      row.userId,
    ],
  },);
}

/**
 * Removes a user from an issue's assignees.
 *
 * @param row - assignee keys
 *
 * @example
 * ```ts
 * await unassignUserFromIssue({ issueId: 'i1', userId: 'u2' });
 * ```
 */
export async function unassignUserFromIssue(row: {
  readonly issueId: string;
  readonly userId: string;
},): Promise<void> {
  await run({
    sql: 'DELETE FROM issue_assignees WHERE issue_id = ? AND user_id = ?',
    params: [
      row.issueId,
      row.userId,
    ],
  },);
}

/**
 * Lists every assignee user for an issue, joined to user metadata.
 *
 * Reads from the Better Auth `user` table; aliases `username AS login`
 * and converts `createdAt` ISO 8601 to ms epoch in JS so the returned
 * rows match the {@link User} shape.
 *
 * @param issueId - issue id
 *
 * @returns user rows in alphabetical login order
 *
 * @example
 * ```ts
 * const assignees = await listIssueAssignees('i1');
 * ```
 */
export async function listIssueAssignees(issueId: string,): Promise<User[]> {
  /**
   * Raw join rows mapped through `toUser` before returning.
   */
  const rows = await all<{
    readonly id: string;
    readonly login: string | null;
    readonly email: string;
    readonly createdAt: string;
  }>({
    sql: `SELECT u.id, u.username AS login, u.email, u.createdAt
     FROM user u
     JOIN issue_assignees ia ON ia.user_id = u.id
     WHERE ia.issue_id = ?
     ORDER BY u.username ASC`,
    params: [issueId,],
  },);
  return rows.map(function rowToUser(row,) {
    return {
      id: row.id,
      login: row.login
        ?? row
        .id,
      email: row.email,
      created_at: new Date(row.createdAt,).getTime(),
    };
  },);
}
