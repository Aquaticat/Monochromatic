import db from '../db.ts';

/** Deck record from the `decks` table with optional aggregated card count. */
export type Deck = {
  id: string;
  name: string;
  created_at: string;
  card_count?: number;
};

/**
 * Lists all decks ordered by creation date, including card counts.
 *
 * @returns All decks with aggregated `card_count`
 */
export function listDecks(): Promise<Deck[]> {
  return db
    .prepare(
      `SELECT d.*, COUNT(c.id) AS card_count
       FROM decks d
       LEFT JOIN cards c ON c.deck_id = d.id
       GROUP BY d.id
       ORDER BY d.created_at DESC`,
    )
    .all() as Promise<Deck[]>;
}

/**
 * Retrieves a single deck by ID.
 *
 * @param id - Deck UUID
 *
 * @returns Deck record, or `null` if not found
 */
export async function getDeck(id: string,): Promise<Deck | null> {
  const row = await db.prepare('SELECT * FROM decks WHERE id = ?',).get(id,) as
    | Deck
    | undefined;
  return row ?? null;
}

/**
 * Creates a new deck with a random UUID.
 *
 * @param name - Display name for the deck
 *
 * @returns Newly created deck record
 */
export async function createDeck(name: string,): Promise<Deck> {
  const id = crypto.randomUUID();
  const created_at = new Date().toISOString();
  await db.prepare('INSERT INTO decks (id, name, created_at) VALUES (?, ?, ?)',).run(
    id,
    name,
    created_at,
  );
  return { id, name, created_at, };
}

/**
 * Permanently removes a deck by ID.
 *
 * @param id - Deck UUID to delete
 *
 * @returns `true` if the deck was found and deleted
 */
export async function deleteDeck(id: string,): Promise<boolean> {
  const result = await db.prepare('DELETE FROM decks WHERE id = ?',).run(id,);
  return result.changes > 0;
}
