import db from "../db";

export type Deck = {
  id: string;
  name: string;
  created_at: string;
  card_count?: number;
}

export function listDecks(): Deck[] {
  return db
    .query(
      `SELECT d.*, COUNT(c.id) AS card_count
       FROM decks d
       LEFT JOIN cards c ON c.deck_id = d.id
       GROUP BY d.id
       ORDER BY d.created_at DESC`
    )
    .all() as Deck[];
}

export function getDeck(id: string): Deck | null {
  return (db.query("SELECT * FROM decks WHERE id = ?").get(id) as Deck) ?? null;
}

export function createDeck(name: string): Deck {
  const id = crypto.randomUUID();
  const created_at = new Date().toISOString();
  db.query("INSERT INTO decks (id, name, created_at) VALUES (?, ?, ?)").run(
    id,
    name,
    created_at
  );
  return { id, name, created_at };
}

export function deleteDeck(id: string): boolean {
  const result = db.query("DELETE FROM decks WHERE id = ?").run(id);
  return result.changes > 0;
}
