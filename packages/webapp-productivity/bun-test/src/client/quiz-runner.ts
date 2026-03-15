import type { FlashCardElement, } from './components/flash-card.ts';
import { api, } from './lib/api.ts';
import type { Card, } from './quiz-types.ts';

/**
 * Builds quiz runner UI with score display, flash card, and answer controls.
 *
 * @param parent - Container element to append quiz UI into
 *
 * @param cards - Flash cards to cycle through during the quiz
 *
 * @param deckId - Deck identifier used in answer API calls
 *
 * @example
 * ```ts
 * buildQuizRunner({ parent: app, cards: data.cards, deckId: data.deck.id });
 * ```
 */
export function buildQuizRunner({ parent, cards, deckId, }: {
  parent: HTMLElement;
  cards: Card[];
  deckId: string;
},): void {
  let currentIndex = 0;
  let correctCount = 0;
  let wrongCount = 0;

  const scoreEl = document.createElement('div',);
  scoreEl.className = 'score';
  parent.append(scoreEl,);

  const cardEl = document.createElement('flash-card',) as FlashCardElement;
  parent.append(cardEl,);

  const controls = document.createElement('div',);
  controls.className = 'quiz-controls';

  const correctBtn = document.createElement('button',);
  correctBtn.className = 'correct';
  correctBtn.textContent = 'Got it';
  controls.append(correctBtn,);

  const wrongBtn = document.createElement('button',);
  wrongBtn.className = 'wrong';
  wrongBtn.textContent = 'Wrong';
  controls.append(wrongBtn,);

  parent.append(controls,);

  const doneMsg = document.createElement('div',);
  doneMsg.className = 'done-message hidden';
  parent.append(doneMsg,);

  /** Updates score text, card content, and done-state visibility. */
  function updateUI(): void {
    scoreEl.textContent = `Card ${
      currentIndex + 1
    } of ${cards.length} | Correct: ${correctCount} | Wrong: ${wrongCount}`;

    if (currentIndex >= cards.length) {
      cardEl.style.display = 'none';
      controls.style.display = 'none';
      scoreEl.textContent =
        `Done! Correct: ${correctCount} | Wrong: ${wrongCount} out of ${cards.length}`;
      doneMsg.textContent = 'Quiz complete! Go back to add more cards or try again.';
      doneMsg.classList.remove('hidden',);
      return;
    }

    const card = cards[currentIndex];
    if (card === undefined)
      return;
    cardEl.setAttribute('front', card.front,);
    cardEl.setAttribute('back', card.back,);
    cardEl.reset();
  }

  /**
   * Posts answer to the server and advances to the next card.
   *
   * @param correct - Whether the user answered correctly
   */
  async function answer(correct: boolean,): Promise<void> {
    if (currentIndex >= cards.length)
      return;
    const card = cards[currentIndex];
    if (card === undefined)
      return;
    await api(`/api/quiz/${deckId}/answer`, {
      method: 'POST',
      body: JSON.stringify({ cardId: card.id, correct, },),
    },);
    if (correct)
      correctCount++;
    else
      wrongCount++;
    currentIndex++;
    updateUI();
  }

  /** Marks the current card as correct and advances. */
  function handleCorrect(): void {
    void answer(true,);
  }

  /** Marks the current card as wrong and advances. */
  function handleWrong(): void {
    void answer(false,);
  }

  correctBtn.addEventListener('click', handleCorrect,);
  wrongBtn.addEventListener('click', handleWrong,);

  updateUI();
}
