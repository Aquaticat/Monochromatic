import { connect } from "@tursodatabase/database";

/** In-memory SQLite connection -- no persistence needed for this test app. */
const db = await connect(":memory:");
await db.exec("PRAGMA journal_mode = WAL");
await db.exec("PRAGMA foreign_keys = ON");

await db.exec(`
  CREATE TABLE decks (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE cards (
    id TEXT PRIMARY KEY,
    deck_id TEXT NOT NULL REFERENCES decks(id) ON DELETE CASCADE,
    front TEXT NOT NULL,
    back TEXT NOT NULL,
    correct_count INTEGER NOT NULL DEFAULT 0,
    wrong_count INTEGER NOT NULL DEFAULT 0
  );
`);

export default db;
