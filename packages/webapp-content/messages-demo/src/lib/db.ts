/**
 * Database initialisation; imported as a side-effect by `server.ts` and `seed.ts`.
 *
 * On import this module:
 *
 * 1. Resolves the database file path from CLI args / env / default
 * 2. Creates the parent directory if needed
 * 3. Opens the SQLite connection with WAL + memory temp store + 1 GiB mmap
 * 4. Runs the schema migration (creates tables and seeds users)
 *
 * The default export is the open `Database` instance shared by all
 * data-access modules in `lib/db/*.ts`. Mirrors the connect-on-import
 * pattern from `packages/webapp-productivity/done/src/lib/db.ts`.
 */

import {
  connect,
  type Database,
} from '@tursodatabase/database';
import { mkdirSync, } from 'node:fs';
import { dirname, } from 'node:path';

import { getArgumentValue, } from './args.ts';
import { runMigrations, } from './db/migrations.ts';

/** Default SQLite path when neither `--db=` nor `DB_PATH` env var is provided. */
const DEFAULT_DATABASE_PATH = './data/messages-demo.db';

/**
 * Strips the `file:` URI prefix if present, returning a plain filesystem path.
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
 * Creates the parent directory for the database file if it does not exist.
 * Skips creation for `:memory:` databases used in tests.
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

/** Resolved filesystem path for the SQLite database file. */
const databasePath = resolveDatabasePath();
ensureDatabaseDirectoryExists(databasePath,);

/** Open Turso database connection used by every data-access module. */
const db: Database = await connect(
  databasePath,
  { experimental: ['triggers',], },
);

// Turso (libSQL) only accepts a subset of SQLite pragmas; sticking to
// the two the `done` package proved out for the demo.
await db.exec('PRAGMA journal_mode = WAL',);
await db.exec('PRAGMA foreign_keys = ON',);

await runMigrations(db,);

export default db;

/**
 * Convenience: prepare + run a parameterised SQL statement, returning
 * the changes / lastInsertRowid pair.
 *
 * @param sql - SQL with `?` parameter placeholders
 *
 * @param params - bind parameters; defaults to none
 *
 * @returns `{ changes, lastInsertRowid }`
 *
 * @example
 * ```ts
 * await run('INSERT INTO users(id, name) VALUES (?, ?)', ['user-a', 'User A']);
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
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Turso typed result
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
 * const row = await get<{ name: string; }>('SELECT name FROM users WHERE id = ?', [id]);
 * ```
 */
export async function get<T = Record<string, unknown>,>(
  sql: string,
  params: readonly unknown[] = [],
): Promise<T | undefined> {
  const stmt = db.prepare(sql,);
  // oxlint-disable-next-line typescript/no-unsafe-assignment -- Turso returns any
  const value = await stmt.get(...params,);
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Turso typed row
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
 * const rows = await all<{ id: number; }>('SELECT id FROM users');
 * ```
 */
export async function all<T = Record<string, unknown>,>(
  sql: string,
  params: readonly unknown[] = [],
): Promise<T[]> {
  const stmt = db.prepare(sql,);
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Turso typed rows
  return await stmt.all(...params,) as T[];
}
