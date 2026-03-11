import db from "../db";

export interface Deck {
  id: string;
  name: string;
  created_at: string;
  card_count?: number;
}

export async function listDecks(): Promise<Deck[]> {
  return db
    .prepare(
      `SELECT d.*, COUNT(c.id) AS card_count
       FROM decks d
       LEFT JOIN cards c ON c.deck_id = d.id
       GROUP BY d.id
       ORDER BY d.created_at DESC`
    )
    .all() as Promise<Deck[]>;
}

export async function getDeck(id: string): Promise<Deck | null> {
  const row = await db.prepare("SELECT * FROM decks WHERE id = ?").get(id) as Deck | undefined;
  return row ?? null;
}

export async function createDeck(name: string): Promise<Deck> {
  const id = crypto.randomUUID();
  const created_at = new Date().toISOString();
  await db.prepare("INSERT INTO decks (id, name, created_at) VALUES (?, ?, ?)").run(
    id,
    name,
    created_at
  );
  return { id, name, created_at };
}

export async function deleteDeck(id: string): Promise<boolean> {
  const result = await db.prepare("DELETE FROM decks WHERE id = ?").run(id);
  return result.changes > 0;
}
