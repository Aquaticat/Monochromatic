// Custom element: <flash-card front="question" back="answer">
// Click to flip between front and back faces.
export class FlashCardElement extends HTMLElement {
  private flipped = false;

  connectedCallback() {
    this.render();
    this.addEventListener("click", () => {
      this.flipped = !this.flipped;
      this.render();
    });
  }

  render() {
    const front = this.getAttribute("front") ?? "";
    const back = this.getAttribute("back") ?? "";

    this.innerHTML = `
      <div class="face front ${this.flipped ? "hidden" : ""}">${front}</div>
      <div class="face back ${this.flipped ? "" : "hidden"}">${back}</div>
      <span class="flip-hint">${this.flipped ? "click to see question" : "click to reveal"}</span>
    `;
  }

  // Reset to front face (used when advancing to next card)
  reset() {
    this.flipped = false;
    this.render();
  }
}

customElements.define("flash-card", FlashCardElement);
