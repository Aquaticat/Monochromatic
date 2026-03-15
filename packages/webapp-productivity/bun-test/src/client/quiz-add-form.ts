import { api, } from './lib/api.ts';

/**
 * Builds and appends the "Add Card" form section.
 *
 * @param parent - Container element to append the form into
 *
 * @param deckId - Deck identifier for the card creation API endpoint
 *
 * @example
 * ```ts
 * buildAddCardForm({ parent: app, deckId: data.deck.id });
 * ```
 */
export function buildAddCardForm({ parent, deckId, }: {
  parent: HTMLElement;
  deckId: string;
},): void {
  const addSection = document.createElement('div',);
  addSection.innerHTML = `<h2 style="margin-top:2rem">Add Card</h2>`;

  const addForm = document.createElement('form',);
  addForm.className = 'add-card-form';

  const frontInput = document.createElement('input',);
  frontInput.type = 'text';
  frontInput.placeholder = 'Front (question)';
  frontInput.required = true;
  addForm.append(frontInput,);

  const backInput = document.createElement('input',);
  backInput.type = 'text';
  backInput.placeholder = 'Back (answer)';
  backInput.required = true;
  addForm.append(backInput,);

  const addBtn = document.createElement('button',);
  addBtn.type = 'submit';
  addBtn.textContent = 'Add Card';
  addForm.append(addBtn,);

  /**
   * Submits a new card to the server and reloads the page.
   *
   * @param event - Form submission event to prevent default navigation
   */
  async function submitCard(event: Event,): Promise<void> {
    event.preventDefault();
    const front = frontInput.value.trim();
    const back = backInput.value.trim();
    if (!front || !back)
      return;
    await api(`/api/decks/${deckId}/cards`, {
      method: 'POST',
      body: JSON.stringify({ front, back, },),
    },);
    globalThis.location.reload();
  }

  /**
   * Wraps async submit to satisfy void-returning event listener contract.
   *
   * @param event - Form submission event forwarded to submitCard
   */
  function handleSubmit(event: Event,): void {
    void submitCard(event,);
  }

  addForm.addEventListener('submit', handleSubmit,);
  addSection.append(addForm,);
  parent.append(addSection,);
}
