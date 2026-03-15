import db from "../db.ts";

/** Flash card record from the `cards` table with answer statistics. */
export type Card = {
  id: string;
  deck_id: string;
  front: string;
  back: string;
  correct_count: number;
  wrong_count: number;
}

/**
 * Lists all cards in a deck ordered by insertion order.
 *
 * @param deckId - Parent deck UUID
 *
 * @returns Cards belonging to the deck
 */
export function listCards(deckId: string): Promise<Card[]> {
  return db
    .prepare("SELECT * FROM cards WHERE deck_id = ? ORDER BY rowid")
    .all(deckId) as Promise<Card[]>;
}

/**
 * Retrieves a single card by ID.
 *
 * @param id - Card UUID
 *
 * @returns Card record, or `null` if not found
 */
export async function getCard(id: string): Promise<Card | null> {
  const row = await db.prepare("SELECT * FROM cards WHERE id = ?").get(id) as Card | undefined;
  return row ?? null;
}

/**
 * Creates a new card in a deck with a random UUID.
 *
 * @param deckId - Parent deck UUID
 *
 * @param front - Question text shown on the front face
 *
 * @param back - Answer text shown on the back face
 *
 * @returns Newly created card record with zero counters
 */
export async function createCard(deckId: string, front: string, back: string): Promise<Card> {
  const id = crypto.randomUUID();
  await db.prepare(
    "INSERT INTO cards (id, deck_id, front, back) VALUES (?, ?, ?, ?)"
  ).run(id, deckId, front, back);
  return { id, deck_id: deckId, front, back, correct_count: 0, wrong_count: 0 };
}

/**
 * Permanently removes a card by ID.
 *
 * @param id - Card UUID to delete
 *
 * @returns `true` if the card was found and deleted
 */
export async function deleteCard(id: string): Promise<boolean> {
  const result = await db.prepare("DELETE FROM cards WHERE id = ?").run(id);
  return result.changes > 0;
}

/**
 * Increments the correct or wrong answer counter for a card.
 *
 * @param cardId - Card UUID to update
 *
 * @param correct - Whether the answer was correct
 */
export async function recordAnswer(cardId: string, correct: boolean): Promise<void> {
  const col = correct ? "correct_count" : "wrong_count";
  await db.prepare(`UPDATE cards SET ${col} = ${col} + 1 WHERE id = ?`).run(cardId);
}
