// Reads server-embedded quiz data, builds quiz UI with <flash-card> custom element.
import { api } from "./lib/api";
import { injectCSS } from "./lib/inject-css";
// build-css processes src/client/styles.css -> dist/client/styles.css at startup
import styles from "../../dist/client/styles.css" with { type: "text" };
import type { FlashCardElement } from "./components/flash-card";

injectCSS(styles);

type Card = {
  id: string;
  front: string;
  back: string;
  correct_count: number;
  wrong_count: number;
}

type Deck = {
  id: string;
  name: string;
}

const pageDataEl = document.querySelector("#page-data");
if (pageDataEl === null || pageDataEl.textContent === null) throw new Error("Missing #page-data element or content");
const data: { deck: Deck; cards: Card[] } = JSON.parse(
  pageDataEl.textContent
);

const app = document.createElement("main");
document.body.prepend(app);

// Back link
const backLink = document.createElement("a");
backLink.className = "back-link";
backLink.href = "/";
backLink.textContent = "\u2190 All decks";
app.append(backLink);

const h1 = document.createElement("h1");
h1.textContent = data.deck.name;
app.append(h1);

if (data.cards.length === 0) {
  const empty = document.createElement("p");
  empty.className = "empty";
  empty.textContent = "No cards in this deck. Add some below.";
  app.append(empty);
} else {
  // Quiz state
  let currentIndex = 0;
  let correctCount = 0;
  let wrongCount = 0;

  const scoreEl = document.createElement("div");
  scoreEl.className = "score";
  app.append(scoreEl);

  const cardEl = document.createElement("flash-card") as FlashCardElement;
  app.append(cardEl);

  const controls = document.createElement("div");
  controls.className = "quiz-controls";

  const correctBtn = document.createElement("button");
  correctBtn.className = "correct";
  correctBtn.textContent = "Got it";
  controls.append(correctBtn);

  const wrongBtn = document.createElement("button");
  wrongBtn.className = "wrong";
  wrongBtn.textContent = "Wrong";
  controls.append(wrongBtn);

  app.append(controls);

  const doneMsg = document.createElement("div");
  doneMsg.className = "done-message hidden";
  app.append(doneMsg);

  function updateUI() {
    scoreEl.textContent = `Card ${currentIndex + 1} of ${data.cards.length} | Correct: ${correctCount} | Wrong: ${wrongCount}`;

    if (currentIndex >= data.cards.length) {
      cardEl.style.display = "none";
      controls.style.display = "none";
      scoreEl.textContent = `Done! Correct: ${correctCount} | Wrong: ${wrongCount} out of ${data.cards.length}`;
      doneMsg.textContent = "Quiz complete! Go back to add more cards or try again.";
      doneMsg.classList.remove("hidden");
      return;
    }

    const card = data.cards[currentIndex];
    cardEl.setAttribute("front", card.front);
    cardEl.setAttribute("back", card.back);
    cardEl.reset();
  }

  async function answer(correct: boolean) {
    if (currentIndex >= data.cards.length) return;
    const card = data.cards[currentIndex];
    await api(`/api/quiz/${data.deck.id}/answer`, {
      method: "POST",
      body: JSON.stringify({ cardId: card.id, correct }),
    });
    if (correct) correctCount++;
    else wrongCount++;
    currentIndex++;
    updateUI();
  }

  correctBtn.addEventListener("click", () => answer(true));
  wrongBtn.addEventListener("click", () => answer(false));

  updateUI();
}

// Add card form (always visible at bottom)
const addSection = document.createElement("div");
addSection.innerHTML = `<h2 style="margin-top:2rem">Add Card</h2>`;

const addForm = document.createElement("form");
addForm.className = "add-card-form";

const frontInput = document.createElement("input");
frontInput.type = "text";
frontInput.placeholder = "Front (question)";
frontInput.required = true;
addForm.append(frontInput);

const backInput = document.createElement("input");
backInput.type = "text";
backInput.placeholder = "Back (answer)";
backInput.required = true;
addForm.append(backInput);

const addBtn = document.createElement("button");
addBtn.type = "submit";
addBtn.textContent = "Add Card";
addForm.append(addBtn);

addForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const front = frontInput.value.trim();
  const back = backInput.value.trim();
  if (!front || !back) return;
  await api(`/api/decks/${data.deck.id}/cards`, {
    method: "POST",
    body: JSON.stringify({ front, back }),
  });
  window.location.reload();
});

addSection.append(addForm);
app.append(addSection);

// Card list
if (data.cards.length > 0) {
  const listSection = document.createElement("div");
  listSection.innerHTML = `<h2 style="margin-top:1rem">Cards in Deck</h2>`;

  const ul = document.createElement("ul");
  ul.className = "card-list";
  for (const card of data.cards) {
    const li = document.createElement("li");
    li.innerHTML = `<span>${card.front} &rarr; ${card.back}</span>`;

    const del = document.createElement("button");
    del.className = "danger";
    del.textContent = "Delete";
    del.addEventListener("click", async () => {
      await api(`/api/cards/${card.id}`, { method: "DELETE" });
      window.location.reload();
    });
    li.append(del);
    ul.append(li);
  }
  listSection.append(ul);
  app.append(listSection);
}
