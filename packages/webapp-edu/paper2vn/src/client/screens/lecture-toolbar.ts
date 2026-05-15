/**
 * Lecture-screen toolbar button factory.
 *
 * Each toolbar button is the same `<button>` shape with a localised
 * label and an onclick callback; this helper consolidates the
 * `el({
   tag: 'button',
   attrs: ...,
 })` boilerplate so the screen file stays focused on
 * the lecture runtime.
 */
import { el, } from '../dom.ts';

/**
 * Builds a toolbar button with a primary or ghost variant.
 *
 * @param label - visible button text
 *
 * @param variant - `'primary'` for the accent-filled action, `'ghost'` otherwise
 *
 * @param onActivate - callback invoked on click
 *
 * @returns the wired `<button>` element
 *
 * @example
 * ```ts
 * const askBtn = toolbarButton({
 *   label: ll.ask(),
 *   variant: 'primary',
 *   onActivate: function go(): void { openAsk(); },
 * });
 * ```
 */
export function toolbarButton(
  {
    label,
    variant,
    onActivate,
  }: {
    label: string;
    variant: 'primary' | 'ghost';
    onActivate: () => void;
  },
): HTMLButtonElement {
  return el({
    tag: 'button',
    attrs: {
      'data-variant': variant,
      onclick: onActivate,
    },
    children: [label,],
  },);
}
