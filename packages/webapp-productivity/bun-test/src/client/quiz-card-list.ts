import { api } from "./lib/api.ts";
import type { Card } from "./quiz-types.ts";

/**
 * Appends a single card list item with a delete button to the list.
 *
 * @param ul - Target list element to append the item into
 *
 * @param card - Card data to display
 */
function appendCardItem({ ul, card }: {
  ul: HTMLUListElement;
  card: Card;
}): void {
  const li = document.createElement("li");
  li.innerHTML = `<span>${card.front} &rarr; ${card.back}</span>`;

  const del = document.createElement("button");
  del.className = "danger";
  del.textContent = "Delete";

  /** Deletes the card via API and reloads the page. */
  async function deleteCard(): Promise<void> {
    await api(`/api/cards/${card.id}`, { method: "DELETE" });
    globalThis.location.reload();
  }

  /** Wraps async delete to satisfy void-returning event listener contract. */
  function handleDelete(): void { void deleteCard(); }

  del.addEventListener("click", handleDelete);
  li.append(del);
  ul.append(li);
}

/**
 * Builds and appends the card list section showing all cards in the deck.
 *
 * @param parent - Container element to append the list section into
 *
 * @param cards - Cards to render in the list
 *
 * @example
 * ```ts
 * buildCardList({ parent: app, cards: data.cards });
 * ```
 */
export function buildCardList({ parent, cards }: {
  parent: HTMLElement;
  cards: Card[];
}): void {
  const listSection = document.createElement("div");
  listSection.innerHTML = `<h2 style="margin-top:1rem">Cards in Deck</h2>`;

  const ul = document.createElement("ul");
  ul.className = "card-list";
  for (const card of cards) {
    appendCardItem({ ul, card });
  }
  listSection.append(ul);
  parent.append(listSection);
}
