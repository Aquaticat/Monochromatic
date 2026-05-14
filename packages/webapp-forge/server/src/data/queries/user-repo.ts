/**
 * Read/write helpers for users, repos, and labels.
 *
 * After the Better Auth cutover, `User` rows live in the `user` table
 * (Better Auth schema). The legacy `users.login` column is mapped to
 * `user.username`, and `users.created_at` (INTEGER ms epoch) is mapped
 * to `user.createdAt` (ISO 8601 string per Better Auth's SQLite
 * adapter, which writes `Date.toISOString()` because
 * `supportsDates: false` for SQLite). SELECTs alias `username AS login`
 * and convert `createdAt` ISO back to ms in JS so the `User` row shape
 * stays numeric and renderers do not change.
 *
 * No event-log writes here; these tables only feed the surface that the
 * dispatcher renders, and a stale read of the user/repo/label catalog
 * is acceptable.
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

/** Raw row shape returned by SELECTs against the Better Auth `user` table. */
type UserRow = {
  readonly id: string;
  readonly login: string | null;
  readonly email: string;
  readonly createdAt: string;
};

/**
 * Converts a raw `user` row into the {@link User} shape with ms epoch.
 *
 * `username` falls back to `id` for any row missing one (Better Auth
 * users created without the username plugin path).
 *
 * @param row - raw row from SELECT
 *
 * @returns user with `login: string` and `created_at: number`
 *
 * @example
 * ```ts
 * const user = toUser(row);
 * ```
 */
function toUser(row: UserRow,): User {
  return {
    id: row.id,
    login: row.login ?? row.id,
    email: row.email,
    created_at: new Date(row.createdAt,).getTime(),
  };
}

/**
 * Inserts a user into the Better Auth `user` table. Idempotent on `id`
 * collision.
 *
 * The Better Auth schema requires `name` (NOT NULL), `email`
 * (NOT NULL UNIQUE), `emailVerified` (NOT NULL), `createdAt`
 * (NOT NULL ISO 8601), `updatedAt` (NOT NULL ISO 8601). Defaults:
 * `name` and `username` derive from `login`; `email` synthesises a
 * `${login}@forge.test` address when not provided; `emailVerified` is
 * `0` (false); `updatedAt` mirrors `createdAt`.
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
  /** ISO timestamp shared by both `createdAt` and `updatedAt` columns. */
  const createdAtIso = new Date(row.createdAt,).toISOString();
  /** Email defaults to a synthesised value so the NOT NULL column is satisfied. */
  const email = row.email ?? `${row.login}@forge.test`;
  await run(
    `INSERT OR IGNORE INTO user(id, name, email, emailVerified, createdAt, updatedAt, username, displayUsername)
     VALUES (?, ?, ?, 0, ?, ?, ?, ?)`,
    [
      row.id,
      row.login,
      email,
      createdAtIso,
      createdAtIso,
      row.login,
      row.login,
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
  /** Raw user row from the DB; `undefined` when no match. */
  const row = await get<UserRow>(
    'SELECT id, username AS login, email, createdAt FROM user WHERE id = ?',
    [id,],
  );
  return row === undefined ? undefined : toUser(row,);
}

/**
 * Loads the user row for a given login (Better Auth `username`).
 *
 * @param login - user login (matched against `user.username`)
 *
 * @returns user row or `undefined`
 *
 * @example
 * ```ts
 * const user = await getUserByLogin('alice');
 * ```
 */
export async function getUserByLogin(login: string,): Promise<User | undefined> {
  /** Raw user row from the DB; `undefined` when no match. */
  const row = await get<UserRow>(
    'SELECT id, username AS login, email, createdAt FROM user WHERE username = ?',
    [login,],
  );
  return row === undefined ? undefined : toUser(row,);
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
     JOIN user u ON u.id = r.owner_id
     WHERE u.username = ? AND r.name = ?`,
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
