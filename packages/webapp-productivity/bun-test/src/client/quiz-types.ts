/** Flash card with answer statistics. */
export type Card = {
  id: string;
  front: string;
  back: string;
  correct_count: number;
  wrong_count: number;
};

/** Card deck metadata. */
export type Deck = {
  id: string;
  name: string;
};

/** Shape of server-embedded page data for the quiz view. */
export type PageData = {
  deck: Deck;
  cards: Card[];
};
