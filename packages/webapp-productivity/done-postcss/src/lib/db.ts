/**
 * Database initialization module; imported as a side-effect by `server.ts`.
 *
 * On import, this module:
 * 1. Resolves the database path from CLI args / env / default
 * 2. Ensures the directory exists
 * 3. Opens the SQLite database with WAL mode
 * 4. Runs migrations (creates tables, indexes, FTS virtual table, triggers)
 *
 * The default export (`db`) is the open Database instance used by `lib/db/tasks.ts`.
 */
import {
  connect,
  type Database,
} from '@tursodatabase/database';
import { mkdirSync, } from 'node:fs';
import { dirname, } from 'node:path';
import { getArgumentValue, } from './args.ts';
import { runMigrations, } from './db/migrations.ts';

/** Default database file path when neither `--db=` nor `DB_PATH` env var is provided. */
const DEFAULT_DATABASE_PATH = './data/done.db';

/**
 * Strips the `file:` URI prefix if present, returning a plain filesystem path.
 *
 * @param value - Raw path that may use `file:` scheme
 *
 * @returns Plain filesystem path
 */
function normalizeDatabasePath(value: string,): string {
  if (!value.startsWith('file:',))
    return value;

  return value.slice('file:'.length,);
}

/**
 * Resolves the database file path from CLI arguments, environment, or default.
 * Priority: `--db=PATH` \> `DB_PATH` env var \> `DEFAULT_DATABASE_PATH`.
 *
 * @returns Resolved database path
 */
function resolveDatabasePath(): string {
  /** Path supplied via `--db=` CLI flag, if present. */
  const argumentPath = getArgumentValue('db',);
  /** Path from `DB_PATH` environment variable, used when no CLI flag is given. */
  const environmentPath = process.env.DB_PATH;
  /** First defined source in priority order, falling back to the default path. */
  const rawPath = argumentPath ?? environmentPath ?? DEFAULT_DATABASE_PATH;
  return normalizeDatabasePath(rawPath,);
}

/**
 * Creates the parent directory for the database file if it does not exist.
 * Skips creation for `:memory:` databases.
 *
 * @param databasePath - Resolved filesystem path
 */
function ensureDatabaseDirectoryExists(databasePath: string,): void {
  if (databasePath === ':memory:')
    return;

  /** Parent directory of the database file; ensured via `mkdirSync({ recursive: true })`. */
  const directoryPath = dirname(databasePath,);
  mkdirSync(
    directoryPath,
    { recursive: true, },
  );
}

/** Resolved filesystem path for the SQLite database file. */
const databasePath = resolveDatabasePath();
ensureDatabaseDirectoryExists(databasePath,);

/** Open Turso database connection used by all data-access modules. */
const db: Database = await connect(
  databasePath,
  { experimental: ['triggers',], },
);
await db.exec('PRAGMA journal_mode = WAL',);
await db.exec('PRAGMA foreign_keys = ON',);

await runMigrations(db,);

export default db;
