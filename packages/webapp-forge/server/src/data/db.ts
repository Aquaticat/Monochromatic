/**
 * Database initialisation -- imported as a side effect by routes and seed.
 *
 * On import this module:
 *
 * 1. Resolves the database path from CLI args / env / default
 * 2. Creates the parent directory if needed
 * 3. Opens the libSQL connection with WAL + foreign keys
 * 4. Runs the schema migration
 *
 * The default export is the open `Database` instance shared by every
 * data-access module in `data/queries.ts` and the dispatcher.
 *
 * Mirrors the connect-on-import pattern from
 * `packages/webapp-content/messages-demo/src/lib/db.ts`.
 */

import {
  connect,
  type Database,
} from '@tursodatabase/database';
import migration0001 from './migrations/0001_initial.sql' with { type: 'text', };
import migration0002 from './migrations/0002_phase2.sql' with { type: 'text', };

import { mkdirSync, } from 'node:fs';
import { dirname, } from 'node:path';

import { getArgumentValue, } from '../lib/args.ts';

/** Default database path when neither `--db=` nor `DB_PATH` env var is set. */
const DEFAULT_DATABASE_PATH = './data/forge.db';

/**
 * Strips the `file:` URI prefix if present.
 *
 * @param value - raw path that may use the `file:` scheme
 *
 * @returns plain filesystem path
 */
function normalizeDatabasePath(value: string,): string {
  if (!value.startsWith('file:',))
    return value;
  return value.slice('file:'.length,);
}

/**
 * Resolves the database path from CLI argument, environment, or default.
 *
 * Priority: `--db=PATH` over `DB_PATH` env var over `DEFAULT_DATABASE_PATH`.
 *
 * @returns resolved filesystem path
 */
function resolveDatabasePath(): string {
  const argumentPath = getArgumentValue('db',);
  const environmentPath = process.env.DB_PATH;
  const rawPath = argumentPath ?? environmentPath ?? DEFAULT_DATABASE_PATH;
  return normalizeDatabasePath(rawPath,);
}

/**
 * Creates the parent directory for the database file if needed.
 *
 * Skipped for `:memory:` databases used in tests.
 *
 * @param databasePath - resolved filesystem path
 */
function ensureDatabaseDirectoryExists(databasePath: string,): void {
  if (databasePath === ':memory:')
    return;
  mkdirSync(
    dirname(databasePath,),
    { recursive: true, },
  );
}

/** Resolved filesystem path for the libSQL database file. */
const databasePath = resolveDatabasePath();
ensureDatabaseDirectoryExists(databasePath,);

/** Open libSQL database connection used by every data-access module. */
const db: Database = await connect(
  databasePath,
  { experimental: ['triggers',], },
);

await db.exec('PRAGMA journal_mode = WAL',);
await db.exec('PRAGMA foreign_keys = ON',);

await db.exec(migration0001,);
await db.exec(migration0002,);

export default db;

/**
 * Convenience: prepare + run a parameterised SQL statement.
 *
 * @param sql - SQL with `?` parameter placeholders
 *
 * @param params - bind parameters; defaults to none
 *
 * @returns `{ changes, lastInsertRowid }`
 *
 * @example
 * ```ts
 * await run('INSERT INTO users(id, login, created_at) VALUES (?, ?, ?)', ['u1', 'alice', Date.now()]);
 * ```
 */
export async function run(
  sql: string,
  params: readonly unknown[] = [],
): Promise<{
  changes: number;
  lastInsertRowid: number;
}> {
  const stmt = db.prepare(sql,);
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- libSQL typed result
  return await stmt.run(...params,) as {
    changes: number;
    lastInsertRowid: number;
  };
}

/**
 * Convenience: prepare + fetch the first row, or `undefined` if none.
 *
 * @param sql - SQL with `?` parameter placeholders
 *
 * @param params - bind parameters; defaults to none
 *
 * @returns first row or `undefined`
 *
 * @example
 * ```ts
 * const row = await get<{ login: string; }>('SELECT login FROM users WHERE id = ?', [id]);
 * ```
 */
export async function get<T = Record<string, unknown>,>(
  sql: string,
  params: readonly unknown[] = [],
): Promise<T | undefined> {
  const stmt = db.prepare(sql,);
  // oxlint-disable-next-line typescript/no-unsafe-assignment -- libSQL returns any
  const value = await stmt.get(...params,);
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- libSQL typed row
  return (value === undefined || value === null) ? undefined : value as T;
}

/**
 * Convenience: prepare + fetch all rows.
 *
 * @param sql - SQL with `?` parameter placeholders
 *
 * @param params - bind parameters; defaults to none
 *
 * @returns array of rows; empty when no matches
 *
 * @example
 * ```ts
 * const rows = await all<{ id: string; }>('SELECT id FROM repos WHERE owner_id = ?', [ownerId]);
 * ```
 */
export async function all<T = Record<string, unknown>,>(
  sql: string,
  params: readonly unknown[] = [],
): Promise<T[]> {
  const stmt = db.prepare(sql,);
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- libSQL typed rows
  return await stmt.all(...params,) as T[];
}
