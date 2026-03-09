import db from "../db";

export type Card = {
  id: string;
  deck_id: string;
  front: string;
  back: string;
  correct_count: number;
  wrong_count: number;
}

export function listCards(deckId: string): Card[] {
  return db
    .query("SELECT * FROM cards WHERE deck_id = ? ORDER BY rowid")
    .all(deckId) as Card[];
}

export function getCard(id: string): Card | null {
  return (db.query("SELECT * FROM cards WHERE id = ?").get(id) as Card) ?? null;
}

export function createCard(deckId: string, front: string, back: string): Card {
  const id = crypto.randomUUID();
  db.query(
    "INSERT INTO cards (id, deck_id, front, back) VALUES (?, ?, ?, ?)"
  ).run(id, deckId, front, back);
  return { id, deck_id: deckId, front, back, correct_count: 0, wrong_count: 0 };
}

export function deleteCard(id: string): boolean {
  const result = db.query("DELETE FROM cards WHERE id = ?").run(id);
  return result.changes > 0;
}

export function recordAnswer(cardId: string, correct: boolean): void {
  const col = correct ? "correct_count" : "wrong_count";
  db.query(`UPDATE cards SET ${col} = ${col} + 1 WHERE id = ?`).run(cardId);
}
