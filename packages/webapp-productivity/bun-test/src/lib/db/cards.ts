import db from "../db";

export type Card = {
  id: string;
  deck_id: string;
  front: string;
  back: string;
  correct_count: number;
  wrong_count: number;
}

export async function listCards(deckId: string): Promise<Card[]> {
  return db
    .prepare("SELECT * FROM cards WHERE deck_id = ? ORDER BY rowid")
    .all(deckId) as Promise<Card[]>;
}

export async function getCard(id: string): Promise<Card | null> {
  const row = await db.prepare("SELECT * FROM cards WHERE id = ?").get(id) as Card | undefined;
  return row ?? null;
}

export async function createCard(deckId: string, front: string, back: string): Promise<Card> {
  const id = crypto.randomUUID();
  await db.prepare(
    "INSERT INTO cards (id, deck_id, front, back) VALUES (?, ?, ?, ?)"
  ).run(id, deckId, front, back);
  return { id, deck_id: deckId, front, back, correct_count: 0, wrong_count: 0 };
}

export async function deleteCard(id: string): Promise<boolean> {
  const result = await db.prepare("DELETE FROM cards WHERE id = ?").run(id);
  return result.changes > 0;
}

export async function recordAnswer(cardId: string, correct: boolean): Promise<void> {
  const col = correct ? "correct_count" : "wrong_count";
  await db.prepare(`UPDATE cards SET ${col} = ${col} + 1 WHERE id = ?`).run(cardId);
}
