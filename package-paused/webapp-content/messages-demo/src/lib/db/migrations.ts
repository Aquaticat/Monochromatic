/**
 * Schema migrations for the messages-demo database.
 *
 * Executed once at startup by `db.ts`. Tables, partial indexes, and
 * seed users that the identity dropdown depends on.
 *
 * Schema overview:
 *
 * - `users`: the identity dropdown's options. Seeded with three rows.
 * - `drafts`: staging area for in-progress messages. Drafts may have a
 *   `parent_id` to form a copy-on-write chain for edits; reads of a chunk
 *   that the head draft does not contain walk the chain to an ancestor.
 * - `chunks`: pre-rendered HTML chunks per draft. Stored once per draft;
 *   never copied at finalize/edit time.
 * - `messages`: finalised messages. `draft_id` points at the head of
 *   the chain. Soft-delete via `deleted_at`; hard-delete sweep walks the
 *   chain and removes every ancestor draft (cascading to chunks).
 */

import type { Database, } from '@tursodatabase/database';

/**
 * SQL DDL for the four tables and their indexes.
 */
const MIGRATION_SCHEMA = `
  CREATE TABLE IF NOT EXISTS users (
    id   TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE
  );

  CREATE TABLE IF NOT EXISTS drafts (
    id              TEXT PRIMARY KEY,
    parent_id       TEXT NULL REFERENCES drafts(id),
    user_id         TEXT NOT NULL REFERENCES users(id),
    created_at      INTEGER NOT NULL,
    updated_at      INTEGER NOT NULL,
    finalized       INTEGER NOT NULL DEFAULT 0
  );

  CREATE INDEX IF NOT EXISTS drafts_orphan ON drafts(user_id, updated_at)
    WHERE finalized = 0;

  CREATE TABLE IF NOT EXISTS chunks (
    draft_id    TEXT NOT NULL REFERENCES drafts(id) ON DELETE CASCADE,
    seq         INTEGER NOT NULL,
    md          BLOB NOT NULL,
    html        BLOB NOT NULL,
    char_count  INTEGER NOT NULL,
    PRIMARY KEY (draft_id, seq)
  );

  CREATE TABLE IF NOT EXISTS messages (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    draft_id     TEXT NOT NULL,
    user_id      TEXT NOT NULL REFERENCES users(id),
    created_at   INTEGER NOT NULL,
    updated_at   INTEGER NOT NULL,
    revision     INTEGER NOT NULL DEFAULT 1,
    deleted_at   INTEGER NULL,
    char_count   INTEGER NOT NULL,
    chunk_count  INTEGER NOT NULL,
    preview      TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS messages_feed ON messages(created_at DESC, id DESC)
    WHERE deleted_at IS NULL;

  CREATE UNIQUE INDEX IF NOT EXISTS messages_draft ON messages(draft_id);
`;

/**
 * Three demo identities the dropdown will display.
 */
const SEED_USERS: readonly {
  id: string;
  name: string;
}[] = [
  {
    id: 'user-a',
    name: 'User A',
  },
  {
    id: 'user-b',
    name: 'User B',
  },
  {
    id: 'user-c',
    name: 'User C',
  },
];

/**
 * Runs the schema migration and seeds the `users` table.
 *
 * Idempotent: safe to call on every startup. `IF NOT EXISTS` clauses
 * cover schema; `INSERT OR IGNORE` covers seed users.
 *
 * @param db - open Turso/SQLite database connection
 *
 * @example
 * ```ts
 * import db from './db.ts';
 * await runMigrations(db); // already called by db.ts on import
 * ```
 */
export async function runMigrations(db: Database,): Promise<void> {
  await db.exec(MIGRATION_SCHEMA,);

  /**
   * Prepared once so the seed-user loop can reuse it per row without re-parsing the SQL.
   */
  const insertUser = db.prepare(
    'INSERT OR IGNORE INTO users(id, name) VALUES (?, ?)',
  );
  // Sequential, not Promise.all: Turso's prepared statement is not safe
  // for concurrent re-execution with different params: doing so silently
  // drops all but one of the bind sets, leaving only one seed user.
  for (const user of SEED_USERS) {
    // oxlint-disable-next-line no-await-in-loop
    await insertUser.run(
      user.id,
      user.name,
    );
  }
}
