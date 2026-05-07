/**
 * Read/write helpers for users, repos, and labels.
 *
 * No event-log writes here; these tables only feed the surface that the
 * dispatcher renders, and a stale read of the user/repo/label catalog
 * is acceptable in Phase 1.
 */

import {
  all,
  get,
  run,
} from '../db.ts';
import type {
  Label,
  Repo,
  User,
} from './types.ts';

/**
 * Inserts a user. Idempotent on `id` collision.
 *
 * @param row - user fields
 *
 * @example
 * ```ts
 * await insertUser({ id: 'u1', login: 'alice', createdAt: Date.now() });
 * ```
 */
export async function insertUser(row: {
  id: string;
  login: string;
  email?: string | null;
  createdAt: number;
},): Promise<void> {
  await run(
    'INSERT OR IGNORE INTO users(id, login, email, password_hash, created_at) VALUES (?, ?, ?, NULL, ?)',
    [
      row.id,
      row.login,
      row.email ?? null,
      row.createdAt,
    ],
  );
}

/**
 * Inserts a repository. Idempotent on `id` collision.
 *
 * @param row - repo fields
 *
 * @example
 * ```ts
 * await insertRepo({ id: 'r1', ownerId: 'u1', name: 'demo', createdAt: Date.now() });
 * ```
 */
export async function insertRepo(row: {
  id: string;
  ownerId: string;
  name: string;
  createdAt: number;
},): Promise<void> {
  await run(
    'INSERT OR IGNORE INTO repos(id, owner_id, name, visibility, default_branch, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    [
      row.id,
      row.ownerId,
      row.name,
      'public',
      'main',
      row.createdAt,
    ],
  );
}

/**
 * Inserts a label. Idempotent on `id` collision.
 *
 * @param row - label fields
 *
 * @example
 * ```ts
 * await insertLabel({ id: 'l1', repoId: 'r1', name: 'bug' });
 * ```
 */
export async function insertLabel(row: {
  id: string;
  repoId: string;
  name: string;
  color?: string;
},): Promise<void> {
  await run(
    'INSERT OR IGNORE INTO labels(id, repo_id, name, color) VALUES (?, ?, ?, ?)',
    [
      row.id,
      row.repoId,
      row.name,
      row.color ?? '888888',
    ],
  );
}

/**
 * Loads the user row for a given id.
 *
 * @param id - user id
 *
 * @returns user row or `undefined`
 *
 * @example
 * ```ts
 * const user = await getUser('u1');
 * ```
 */
export async function getUser(id: string,): Promise<User | undefined> {
  return await get<User>(
    'SELECT id, login, email, created_at FROM users WHERE id = ?',
    [id,],
  );
}

/**
 * Loads the user row for a given login.
 *
 * @param login - user login
 *
 * @returns user row or `undefined`
 *
 * @example
 * ```ts
 * const user = await getUserByLogin('alice');
 * ```
 */
export async function getUserByLogin(login: string,): Promise<User | undefined> {
  return await get<User>(
    'SELECT id, login, email, created_at FROM users WHERE login = ?',
    [login,],
  );
}

/**
 * Loads a repo by id.
 *
 * @param id - repo id
 *
 * @returns repo row or `undefined`
 *
 * @example
 * ```ts
 * const repo = await getRepo('r1');
 * ```
 */
export async function getRepo(id: string,): Promise<Repo | undefined> {
  return await get<Repo>(
    'SELECT * FROM repos WHERE id = ?',
    [id,],
  );
}

/**
 * Loads a repo by `(owner_login, name)`.
 *
 * @param row - lookup keys
 *
 * @returns repo row or `undefined`
 *
 * @example
 * ```ts
 * const repo = await getRepoByOwnerLogin({ ownerLogin: 'alice', name: 'demo' });
 * ```
 */
export async function getRepoByOwnerLogin(row: {
  ownerLogin: string;
  name: string;
},): Promise<Repo | undefined> {
  return await get<Repo>(
    `SELECT r.* FROM repos r
     JOIN users u ON u.id = r.owner_id
     WHERE u.login = ? AND r.name = ?`,
    [
      row.ownerLogin,
      row.name,
    ],
  );
}

/**
 * Loads a label by id.
 *
 * @param id - label id
 *
 * @returns label row or `undefined`
 *
 * @example
 * ```ts
 * const label = await getLabel('l1');
 * ```
 */
export async function getLabel(id: string,): Promise<Label | undefined> {
  return await get<Label>(
    'SELECT * FROM labels WHERE id = ?',
    [id,],
  );
}

/**
 * Loads all labels for a repo.
 *
 * @param repoId - repo id
 *
 * @returns labels array (possibly empty)
 *
 * @example
 * ```ts
 * const labels = await listRepoLabels('r1');
 * ```
 */
export async function listRepoLabels(repoId: string,): Promise<Label[]> {
  return await all<Label>(
    'SELECT * FROM labels WHERE repo_id = ? ORDER BY name ASC',
    [repoId,],
  );
}
