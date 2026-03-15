// Reads server-embedded quiz data, builds quiz UI with <flash-card> custom element.
import { injectCSS } from "./lib/inject-css.ts";
// build-css processes src/client/styles.css -> dist/css/styles.css
import styles from "../../dist/css/styles.css" with { type: "text" };
import type { PageData } from "./quiz-types.ts";
import { buildQuizRunner } from "./quiz-runner.ts";
import { buildAddCardForm } from "./quiz-add-form.ts";
import { buildCardList } from "./quiz-card-list.ts";

injectCSS(styles);

/** Server-embedded quiz page data element. */
const pageDataEl = document.querySelector<HTMLElement>("#page-data");
if (pageDataEl === null) throw new Error("Missing #page-data element");

/** Parsed quiz page data from server-embedded JSON. */
const data: PageData = JSON.parse(pageDataEl.textContent);

/** Root application element. */
const app = document.createElement("main");
document.body.prepend(app);

/** Navigation link back to the deck list. */
const backLink = document.createElement("a");
backLink.className = "back-link";
backLink.href = "/";
backLink.textContent = "\u2190 All decks";
app.append(backLink);

/** Page heading displaying the deck name. */
const h1 = document.createElement("h1");
h1.textContent = data.deck.name;
app.append(h1);

if (data.cards.length === 0) {
  const empty = document.createElement("p");
  empty.className = "empty";
  empty.textContent = "No cards in this deck. Add some below.";
  app.append(empty);
} else {
  buildQuizRunner({ parent: app, cards: data.cards, deckId: data.deck.id });
}

buildAddCardForm({ parent: app, deckId: data.deck.id });

if (data.cards.length > 0) {
  buildCardList({ parent: app, cards: data.cards });
}
