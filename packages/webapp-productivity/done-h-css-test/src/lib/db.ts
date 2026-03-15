/**
 * Database initialization module -- imported as a side-effect by `server.ts`.
 *
 * On import, this module:
 * 1. Resolves the database path from CLI args / env / default
 * 2. Ensures the directory exists
 * 3. Opens the SQLite database with WAL mode
 * 4. Runs migrations (creates tables, indexes, FTS virtual table, triggers)
 *
 * The default export (`db`) is the open Database instance used by `lib/db/tasks.ts`.
 */
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { connect } from "@tursodatabase/database";
import { getArgumentValue } from "./args.ts";
import { runMigrations } from "./db-migrations.ts";

/** Default database file path when neither `--db=` nor `DB_PATH` env var is provided. */
const DEFAULT_DATABASE_PATH = "./data/done.db";

/**
 * Strips the `file:` URI prefix if present, returning a plain filesystem path.
 *
 * @param value - Raw path that may use `file:` scheme
 */
function normalizeDatabasePath(value: string): string {
  if (!value.startsWith("file:")) {
    return value;
  }
  return value.slice("file:".length);
}

/**
 * Resolves the database file path from CLI arguments, environment, or default.
 * Priority: `--db=PATH` > `DB_PATH` env var > `DEFAULT_DATABASE_PATH`.
 */
function resolveDatabasePath(): string {
  const argumentPath = getArgumentValue("db");
  const environmentPath = process.env.DB_PATH;
  const rawPath = argumentPath ?? environmentPath ?? DEFAULT_DATABASE_PATH;
  return normalizeDatabasePath(rawPath);
}

/**
 * Creates the parent directory for the database file if it does not exist.
 * Skips creation for `:memory:` databases.
 *
 * @param databasePath - Resolved filesystem path
 */
function ensureDatabaseDirectoryExists(databasePath: string): void {
  if (databasePath === ":memory:") {
    return;
  }
  const directoryPath = dirname(databasePath);
  mkdirSync(directoryPath, { recursive: true });
}

const databasePath = resolveDatabasePath();
ensureDatabaseDirectoryExists(databasePath);

const db = await connect(databasePath, { experimental: ["triggers"] });
await db.exec("PRAGMA journal_mode = WAL");
await db.exec("PRAGMA foreign_keys = ON");

await runMigrations(db);

export default db;
