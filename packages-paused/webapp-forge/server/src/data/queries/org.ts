/**
 * Read/write helpers for organisations.
 *
 * Orgs group repos and members for ownership and access control. Phase 2
 * scope is intentionally minimal (no per-org settings or visibility);
 * extra columns get added when downstream features need them.
 */

import {
  get,
  run,
} from '../db.ts';
import type { Org, } from './types.ts';

/**
 * Inserts an organisation. Idempotent on `id` collision.
 *
 * @param row - org fields
 *
 * @example
 * ```ts
 * await insertOrg({ id: 'o1', name: 'monochromatic', createdAt: Date.now() });
 * ```
 */
export async function insertOrg(row: {
  readonly id: string;
  readonly name: string;
  readonly createdAt: number;
},): Promise<void> {
  await run({
    sql: 'INSERT OR IGNORE INTO orgs(id, name, created_at) VALUES (?, ?, ?)',
    params: [
      row.id,
      row.name,
      row.createdAt,
    ],
  },);
}

/**
 * Loads an org by id.
 *
 * @param id - org id
 *
 * @returns org row or `undefined`
 *
 * @example
 * ```ts
 * const org = await getOrg('o1');
 * ```
 */
export async function getOrg(id: string,): Promise<Org | undefined> {
  return await get<Org>({
    sql: 'SELECT * FROM orgs WHERE id = ?',
    params: [id,],
  },);
}

/**
 * Loads an org by name (the unique-by-convention identifier).
 *
 * @param name - org name
 *
 * @returns org row or `undefined`
 *
 * @example
 * ```ts
 * const org = await getOrgByName('monochromatic');
 * ```
 */
export async function getOrgByName(name: string,): Promise<Org | undefined> {
  return await get<Org>({
    sql: 'SELECT * FROM orgs WHERE name = ?',
    params: [name,],
  },);
}
