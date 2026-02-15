import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { Database } from "bun:sqlite";

const DEFAULT_DATABASE_PATH = "./data/done.db";

function getArgumentValue(name: string): string | undefined {
  const prefix = `--${name}=`;
  const argument = process.argv.find((entry) => entry.startsWith(prefix));
  return argument?.slice(prefix.length);
}

function normalizeDatabasePath(value: string): string {
  if (!value.startsWith("file:")) {
    return value;
  }

  return value.slice("file:".length);
}

function resolveDatabasePath(): string {
  const argumentPath = getArgumentValue("db");
  const environmentPath = process.env.DB_PATH;
  const rawPath = argumentPath ?? environmentPath ?? DEFAULT_DATABASE_PATH;
  return normalizeDatabasePath(rawPath);
}

function ensureDatabaseDirectoryExists(databasePath: string): void {
  if (databasePath === ":memory:") {
    return;
  }

  const directoryPath = dirname(databasePath);
  mkdirSync(directoryPath, { recursive: true });
}

function runMigrations(database: Database): void {
  database.exec(`
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
  `);

  database.exec(`
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
  `);

  database.exec(`
    INSERT INTO tasks_fts(rowid, title, description, tags)
    SELECT tasks.rowid, tasks.title, tasks.description, tasks.tags
    FROM tasks
    WHERE tasks.rowid NOT IN (SELECT rowid FROM tasks_fts);
  `);
}

const databasePath = resolveDatabasePath();
ensureDatabaseDirectoryExists(databasePath);

const db = new Database(databasePath);
db.exec("PRAGMA journal_mode = WAL");
db.exec("PRAGMA foreign_keys = ON");

runMigrations(db);

export default db;
