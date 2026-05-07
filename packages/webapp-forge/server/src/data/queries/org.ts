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
  id: string;
  name: string;
  createdAt: number;
},): Promise<void> {
  await run(
    'INSERT OR IGNORE INTO orgs(id, name, created_at) VALUES (?, ?, ?)',
    [
      row.id,
      row.name,
      row.createdAt,
    ],
  );
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
  return await get<Org>(
    'SELECT * FROM orgs WHERE id = ?',
    [id,],
  );
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
  return await get<Org>(
    'SELECT * FROM orgs WHERE name = ?',
    [name,],
  );
}
