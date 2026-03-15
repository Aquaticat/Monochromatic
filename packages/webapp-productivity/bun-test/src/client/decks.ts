// Reads server-embedded deck data, builds DOM. No fetch on load.
import { api, } from './lib/api.ts';
import { injectCSS, } from './lib/inject-css.ts';
// build-css processes src/client/styles.css -> dist/css/styles.css
// (resolves @import, expands @mixin/@apply). tsdown inlines this as a text string.
import styles from '../../dist/css/styles.css' with { type: 'text', };

injectCSS(styles,);

/** Deck summary with card count for the deck list page. */
type Deck = {
  id: string;
  name: string;
  card_count: number;
  created_at: string;
};

/** Server-embedded deck list page data element. */
const pageDataEl = document.querySelector<HTMLElement>('#page-data',);
if (pageDataEl === null)
  throw new Error('Missing #page-data element',);

/** Parsed deck list from server-embedded JSON. */
// oxlint-disable-next-line typescript/no-unsafe-assignment -- JSON.parse returns any; shape validated by typed consumer
const data: { decks: Deck[]; } = JSON.parse(pageDataEl.textContent,);

/**
 * Deletes a deck via API and reloads the page.
 *
 * @param deckId - UUID of the deck to delete
 */
async function removeDeckById(deckId: string,): Promise<void> {
  await api(`/api/decks/${deckId}`, { method: 'DELETE', },);
  globalThis.location.reload();
}

/** Root application element. */
const app = document.createElement('main',);
document.body.prepend(app,);

/** Page heading. */
const h1 = document.createElement('h1',);
h1.textContent = 'Flashcard Quiz';
app.append(h1,);

if (data.decks.length === 0) {
  const empty = document.createElement('p',);
  empty.className = 'empty';
  empty.textContent = 'No decks yet. Create one below.';
  app.append(empty,);
}
else {
  const ul = document.createElement('ul',);
  ul.className = 'deck-list';
  for (const deck of data.decks) {
    const li = document.createElement('li',);

    const link = document.createElement('a',);
    link.href = `/quiz/${deck.id}`;
    link.textContent = deck.name;
    li.append(link,);

    const meta = document.createElement('span',);
    meta.className = 'card-count';
    meta.textContent = `${deck.card_count} card${deck.card_count !== 1 ? 's' : ''}`;
    li.append(meta,);

    const del = document.createElement('button',);
    del.className = 'danger';
    del.textContent = 'Delete';

    del.addEventListener('click', function onDelete(): void {
      void removeDeckById(deck.id,);
    },);
    li.append(del,);

    ul.append(li,);
  }
  app.append(ul,);
}

// New deck form

/** Deck creation form element. */
const form = document.createElement('form',);

/** Text input for the new deck name. */
const input = document.createElement('input',);
input.type = 'text';
input.name = 'name';
input.placeholder = 'New deck name...';
input.required = true;
form.append(input,);

/** Submit button for creating a new deck. */
const submit = document.createElement('button',);
submit.type = 'submit';
submit.textContent = 'Create Deck';
form.append(submit,);

/**
 * Submits a new deck to the server and reloads the page.
 *
 * @param event - Form submission event to prevent default navigation
 */
async function submitNewDeck(event: Event,): Promise<void> {
  event.preventDefault();
  const name = input.value.trim();
  if (!name)
    return;
  await api('/api/decks', {
    method: 'POST',
    body: JSON.stringify({ name, },),
  },);
  globalThis.location.reload();
}

/**
 * Wraps async submit to satisfy void-returning event listener contract.
 *
 * @param event - Form submission event forwarded to async handler
 */
function handleSubmit(event: Event,): void {
  void submitNewDeck(event,);
}

form.addEventListener('submit', handleSubmit,);

app.append(form,);
