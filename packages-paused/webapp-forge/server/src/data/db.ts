/**
 * Database initialisation; imported as a side effect by routes and seed.
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
import migration0003 from './migrations/0003_better_auth.sql' with { type: 'text', };
import migration0004 from './migrations/0004_drop_users.sql' with { type: 'text', };

import { mkdirSync, } from 'node:fs';
import { dirname, } from 'node:path';

import { getArgumentValue, } from '../lib/args.ts';

/**
 * Default database path when neither `--db=` nor `DB_PATH` env var is set.
 */
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
  /**
   * `--db=PATH` CLI argument when supplied; highest priority source.
   */
  const argumentPath = getArgumentValue('db',);
  /**
   * `DB_PATH` environment variable; second priority source.
   */
  const environmentPath = process.env
    .DB_PATH;
  /**
   * Selected raw path; falls back to the compile-time default.
   */
  const rawPath = argumentPath ?? environmentPath
    ?? DEFAULT_DATABASE_PATH;
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

/**
 * Resolved filesystem path for the libSQL database file.
 */
const databasePath = resolveDatabasePath();
ensureDatabaseDirectoryExists(databasePath,);

/**
 * Open libSQL database connection used by every data-access module.
 */
const db: Database = await connect(
  databasePath,
  { experimental: ['triggers',], },
);

await db.exec('PRAGMA journal_mode = WAL',);
await db.exec('PRAGMA foreign_keys = ON',);

await db.exec(migration0001,);
await db.exec(migration0002,);
await db.exec(migration0003,);

/**
 * Detects whether the destructive 0004 cutover has already run by
 * inspecting the schema text of the `repos` table.
 *
 * Pre-cutover repos carry the FK to the legacy `users` table;
 * post-cutover repos carry the FK to Better Auth's `user` table.
 * The legacy `users` table itself cannot serve as the sentinel because
 * 0001 re-creates it on every boot via `CREATE TABLE IF NOT EXISTS`,
 * so the cutover would wipe data on every subsequent boot if guarded
 * by users-exists alone. SQLite normalises the FK syntax with a space
 * before the column list, so the substring match uses only the
 * table-name portion to remain robust against whitespace normalisation.
 */
const reposSchemaStmt = db.prepare(
  'SELECT sql AS s FROM sqlite_master WHERE type = ? AND name = ?',
);

/* oxlint-disable typescript/no-unsafe-type-assertion -- libSQL prepared statement returns a typed row */

/**
 * Schema text of the current `repos` table, or `undefined` on a fresh DB.
 */
const reposSchemaRow = await reposSchemaStmt.get(
  'table',
  'repos',
) as { s: string; } | undefined;
/* oxlint-enable typescript/no-unsafe-type-assertion */

if (
  (reposSchemaRow === undefined)
    || (reposSchemaRow
    .s
      .includes('REFERENCES users',))
) {
  await db.exec(migration0004,);
}

export default db;

/**
 * Convenience: prepare + run a parameterised SQL statement.
 *
 * @param row - SQL plus optional bind parameters
 *
 * @returns `{ changes, lastInsertRowid }`
 *
 * @example
 * ```ts
 * await run({
 *   sql: 'INSERT INTO users(id, login, created_at) VALUES (?, ?, ?)',
 *   params: ['u1', 'alice', Date.now()],
 * });
 * ```
 */
export async function run(row: {
  /**
   * SQL with `?` parameter placeholders.
   */
  readonly sql: string;
  /**
   * Bind parameters; defaults to none.
   */
  readonly params?: readonly unknown[];
},): Promise<{
  changes: number;
  lastInsertRowid: number;
}> {
  /**
   * Prepared statement for the one-shot execution.
   */
  const stmt = db.prepare(row.sql,);
  return await stmt.run(...(row.params
    ?? []),) as {
    changes: number;
    lastInsertRowid: number;
  };
}

/**
 * Convenience: prepare + fetch the first row, or `undefined` if none.
 *
 * @param row - SQL plus optional bind parameters
 *
 * @returns first row or `undefined`
 *
 * @example
 * ```ts
 * const user = await get<{ login: string; }>({
 *   sql: 'SELECT login FROM users WHERE id = ?',
 *   params: [id],
 * });
 * ```
 */
export async function get<T = Record<string, unknown>,>(row: {
  /**
   * SQL with `?` parameter placeholders.
   */
  readonly sql: string;
  /**
   * Bind parameters; defaults to none.
   */
  readonly params?: readonly unknown[];
},): Promise<T | undefined> {
  /**
   * Prepared statement for the single-row fetch.
   */
  const stmt = db.prepare(row.sql,);
  /* oxlint-disable typescript/no-unsafe-assignment -- libSQL returns any */
  /**
   * First row returned by the statement; undefined when no rows match.
   */
  const value = await stmt.get(...(row.params
    ?? []),);
  /* oxlint-enable typescript/no-unsafe-assignment */
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- libSQL typed row
  return ((value === undefined) || (value === null)) ? undefined : value as T;
}

/**
 * Convenience: prepare + fetch all rows.
 *
 * @param row - SQL plus optional bind parameters
 *
 * @returns array of rows; empty when no matches
 *
 * @example
 * ```ts
 * const repos = await all<{ id: string; }>({
 *   sql: 'SELECT id FROM repos WHERE owner_id = ?',
 *   params: [ownerId],
 * });
 * ```
 */
export async function all<T = Record<string, unknown>,>(row: {
  /**
   * SQL with `?` parameter placeholders.
   */
  readonly sql: string;
  /**
   * Bind parameters; defaults to none.
   */
  readonly params?: readonly unknown[];
},): Promise<T[]> {
  /**
   * Prepared statement for the multi-row fetch.
   */
  const stmt = db.prepare(row.sql,);
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- libSQL typed rows
  return await stmt.all(...(row.params
    ?? []),) as T[];
}
