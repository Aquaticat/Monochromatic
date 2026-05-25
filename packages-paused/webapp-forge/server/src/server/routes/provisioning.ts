/**
 * Provisioning helpers used by tests and the seed CLI to create users
 * and repos before issuing data writes.
 *
 * The route handlers do not expose these; they bypass the auth header
 * and assume the caller already has trust to insert.
 */

import {
  insertRepo,
  insertUser,
} from '../../data/queries.ts';

/**
 * Fields accepted by {@link provisionUser}.
 */
export type ProvisionUserRow = {
  readonly id: string;
  readonly login: string;
  readonly email?: string | null;
  readonly createdAt?: number;
};

/**
 * Fields accepted by {@link provisionRepo}.
 */
export type ProvisionRepoRow = {
  readonly id: string;
  readonly ownerId: string;
  readonly name: string;
  readonly createdAt?: number;
};

/**
 * Creates a user upfront. Idempotent on `id` collision.
 *
 * @param row - user fields
 *
 * @example
 * ```ts
 * await provisionUser({ id: 'u1', login: 'alice' });
 * ```
 */
export async function provisionUser(row: ProvisionUserRow,): Promise<void> {
  await insertUser({
    id: row.id,
    login: row.login,
    email: row.email
      ?? null,
    createdAt: row.createdAt
      ?? Date
      .now(),
  },);
}

/**
 * Creates a repository upfront. Idempotent on `id` collision.
 *
 * @param row - repo fields
 *
 * @example
 * ```ts
 * await provisionRepo({ id: 'r1', ownerId: 'u1', name: 'demo' });
 * ```
 */
export async function provisionRepo(row: ProvisionRepoRow,): Promise<void> {
  await insertRepo({
    id: row.id,
    ownerId: row.ownerId,
    name: row.name,
    createdAt: row.createdAt
      ?? Date
      .now(),
  },);
}
