/**
 * `\<flash-card\>` custom element that displays a flashcard with front and back faces.
 * Click to flip between front and back faces.
 */
export class FlashCardElement extends HTMLElement {
  /** Whether the card is currently showing the back face. */
  private flipped = false;

  /** Renders the card and attaches the click-to-flip handler. */
  connectedCallback(): void {
    this.render();
    this.addEventListener('click', function flip(this: FlashCardElement,): void {
      this.flipped = !this.flipped;
      this.render();
    }
      .bind(this,),);
  }

  /** Renders both faces with visibility toggled by the flipped state. */
  render(): void {
    const front = this.getAttribute('front',) ?? '';
    const back = this.getAttribute('back',) ?? '';

    this.innerHTML = `
      <div class="face front ${this.flipped ? 'hidden' : ''}">${front}</div>
      <div class="face back ${this.flipped ? '' : 'hidden'}">${back}</div>
      <span class="flip-hint">${
      this.flipped ? 'click to see question' : 'click to reveal'
    }</span>
    `;
  }

  /** Reset to front face (used when advancing to next card). */
  reset(): void {
    this.flipped = false;
    this.render();
  }
}

customElements.define('flash-card', FlashCardElement,);
