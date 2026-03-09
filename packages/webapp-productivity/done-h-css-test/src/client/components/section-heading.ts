import { $ as h } from "@monochromatic-dev/module-es/ts/types/t object/t htmlElement/f/t string jsx/r s/p n/index.ts";
import { cssInt, cssRem, cssVar } from "@monochromatic-dev/module-es/h-css";
import { $ as css } from "../css.ts";
import { flexCenter, flexColumn, flexRow, minTouchTarget } from "../mixins.ts";

const STYLES = [
  css({
    rule: ':host',
    decls: { ...flexColumn(), gap: cssRem(0.5) },
  }),
  css({
    rule: '.heading',
    decls: { ...flexRow(), gap: cssRem(1), 'font-size': cssRem(1.25), 'font-weight': cssInt(400), cursor: 'pointer' },
  }),
  css({
    rule: '.icon',
    decls: { ...flexCenter(), ...minTouchTarget(), 'font-size': cssRem(2) },
  }),
  css({
    rule: '.toggle',
    decls: { 'inline-size': cssRem(1.25), 'block-size': cssRem(1.25) },
  }),
  css({
    rule: '.content',
    decls: { ...flexColumn(), gap: cssVar('gap') },
  }),
].join('');

/**
 * `<section-heading>` -- collapsible section with icon, label, and toggle indicator.
 * Dispatches a `toggle` event with `{ open }` when the heading is clicked.
 */
class SectionHeading extends HTMLElement {
  #shadow: ShadowRoot;
  #open = true;

  constructor() {
    super();
    this.#shadow = this.attachShadow({ mode: "open" });
  }

  get open(): boolean {
    return this.#open;
  }

  connectedCallback(): void {
    this.#render();
    this.#shadow.querySelector(".heading")?.addEventListener("click", this.#toggle);
  }

  #toggle = (): void => {
    this.#open = !this.#open;
    this.#updateToggle();
    this.dispatchEvent(new CustomEvent("toggle", { detail: { open: this.#open }, bubbles: true }));
  };

  #updateToggle(): void {
    const toggle = this.#shadow.querySelector(".toggle");
    if (toggle instanceof HTMLElement) {
      toggle.textContent = this.#open ? "\u25B2" : "\u25BC";
    }
    const content = this.#shadow.querySelector(".content") as HTMLElement | null;
    if (content !== null) {
      content.style.display = this.#open ? "flex" : "none";
    }
  }

  #render(): void {
    const icon = this.getAttribute("icon") ?? "";
    const label = this.getAttribute("label") ?? "";

    this.#shadow.replaceChildren(
      h({ tag: "style", text: STYLES }),
      h({
        tag: "div",
        class: "heading",
        children: [
          h({ tag: "span", class: "icon", text: icon }),
          h({ tag: "span", text: label }),
          h({ tag: "span", class: "toggle", text: this.#open ? "\u25B2" : "\u25BC" }),
        ],
      }),
      h({
        tag: "div",
        class: "content",
        children: [h({ tag: "slot" })],
      }),
    );
  }
}

customElements.define("section-heading", SectionHeading);
