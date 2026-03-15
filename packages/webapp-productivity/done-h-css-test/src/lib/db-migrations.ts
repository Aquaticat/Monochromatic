/**
 * Database migration SQL and runner for the Done app.
 *
 * Executed once at startup to ensure the schema is up to date.
 */
import type { Database, } from '@tursodatabase/database';

//region Migration SQL -- separated for readability; executed once at startup

/** Core tables, indexes, and CHECK constraints. */
const MIGRATION_TABLES_AND_INDEXES = `
  CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    tags TEXT NOT NULL DEFAULT '[]',
    locations TEXT NOT NULL DEFAULT '[]',
    priority TEXT CHECK (priority IN ('low', 'medium', 'high')),
    due_date TEXT,
    complexity TEXT CHECK (complexity IN ('low', 'medium', 'high')),
    reminders TEXT NOT NULL DEFAULT '[]',
    blocked_by TEXT NOT NULL DEFAULT '[]',
    tracked_time INTEGER NOT NULL DEFAULT 0,
    timer_started_at TEXT,
    status TEXT NOT NULL DEFAULT 'inbox' CHECK (status IN ('inbox', 'in_progress', 'done')),
    source TEXT NOT NULL DEFAULT 'local' CHECK (source IN ('local', 'github', 'linear', 'calendar', 'codebase')),
    source_id TEXT,
    source_meta TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS attachments (
    id TEXT PRIMARY KEY,
    task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    filename TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    data BLOB NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
  CREATE INDEX IF NOT EXISTS idx_tasks_status_source ON tasks(status, source);
  CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date) WHERE due_date IS NOT NULL;
  CREATE INDEX IF NOT EXISTS idx_tasks_source_id ON tasks(source, source_id) WHERE source_id IS NOT NULL;
  CREATE INDEX IF NOT EXISTS idx_attachments_task_id ON attachments(task_id);
`;

/** FTS5 virtual table and triggers that keep the index in sync with the tasks table. */
const MIGRATION_FTS_AND_TRIGGERS = `
  CREATE VIRTUAL TABLE IF NOT EXISTS tasks_fts USING fts5(
    title,
    description,
    tags,
    content=tasks,
    content_rowid=rowid
  );

  CREATE TRIGGER IF NOT EXISTS tasks_fts_insert AFTER INSERT ON tasks BEGIN
    INSERT INTO tasks_fts(rowid, title, description, tags)
    VALUES (new.rowid, new.title, new.description, new.tags);
  END;

  CREATE TRIGGER IF NOT EXISTS tasks_fts_update AFTER UPDATE ON tasks BEGIN
    INSERT INTO tasks_fts(tasks_fts, rowid, title, description, tags)
    VALUES ('delete', old.rowid, old.title, old.description, old.tags);
    INSERT INTO tasks_fts(rowid, title, description, tags)
    VALUES (new.rowid, new.title, new.description, new.tags);
  END;

  CREATE TRIGGER IF NOT EXISTS tasks_fts_delete AFTER DELETE ON tasks BEGIN
    INSERT INTO tasks_fts(tasks_fts, rowid, title, description, tags)
    VALUES ('delete', old.rowid, old.title, old.description, old.tags);
  END;
`;

/** Backfills FTS index for any rows that were inserted before triggers existed. */
const MIGRATION_FTS_BACKFILL = `
  INSERT INTO tasks_fts(rowid, title, description, tags)
  SELECT tasks.rowid, tasks.title, tasks.description, tasks.tags
  FROM tasks
  WHERE tasks.rowid NOT IN (SELECT rowid FROM tasks_fts);
`;

//endregion Migration SQL

/**
 * Executes all schema migrations (tables, indexes, FTS, triggers, backfill).
 *
 * @param database - Connected Turso database instance
 */
export async function runMigrations(database: Database,): Promise<void> {
  await database.exec(MIGRATION_TABLES_AND_INDEXES,);
  await database.exec(MIGRATION_FTS_AND_TRIGGERS,);
  await database.exec(MIGRATION_FTS_BACKFILL,);
}
