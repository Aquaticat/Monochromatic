// Reads server-embedded deck data, builds DOM. No fetch on load.
import { api } from "./lib/api";
import { injectCSS } from "./lib/inject-css";
// build-css processes src/client/styles.css -> dist/client/styles.css at startup
// (resolves @import, expands @mixin/@apply). Bun.build() inlines this as a text string.
import styles from "../../dist/client/styles.css" with { type: "text" };

injectCSS(styles);

interface Deck {
  id: string;
  name: string;
  card_count: number;
  created_at: string;
}

const data: { decks: Deck[] } = JSON.parse(
  document.getElementById("page-data")!.textContent!
);

const app = document.createElement("main");
document.body.prepend(app);

const h1 = document.createElement("h1");
h1.textContent = "Flashcard Quiz";
app.appendChild(h1);

if (data.decks.length === 0) {
  const empty = document.createElement("p");
  empty.className = "empty";
  empty.textContent = "No decks yet. Create one below.";
  app.appendChild(empty);
} else {
  const ul = document.createElement("ul");
  ul.className = "deck-list";
  for (const deck of data.decks) {
    const li = document.createElement("li");

    const link = document.createElement("a");
    link.href = `/quiz/${deck.id}`;
    link.textContent = deck.name;
    li.appendChild(link);

    const meta = document.createElement("span");
    meta.className = "card-count";
    meta.textContent = `${deck.card_count} card${deck.card_count !== 1 ? "s" : ""}`;
    li.appendChild(meta);

    const del = document.createElement("button");
    del.className = "danger";
    del.textContent = "Delete";
    del.addEventListener("click", async () => {
      await api(`/api/decks/${deck.id}`, { method: "DELETE" });
      window.location.reload();
    });
    li.appendChild(del);

    ul.appendChild(li);
  }
  app.appendChild(ul);
}

// New deck form
const form = document.createElement("form");
const input = document.createElement("input");
input.type = "text";
input.name = "name";
input.placeholder = "New deck name...";
input.required = true;
form.appendChild(input);

const submit = document.createElement("button");
submit.type = "submit";
submit.textContent = "Create Deck";
form.appendChild(submit);

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const name = input.value.trim();
  if (!name) return;
  await api("/api/decks", {
    method: "POST",
    body: JSON.stringify({ name }),
  });
  window.location.reload();
});

app.appendChild(form);
