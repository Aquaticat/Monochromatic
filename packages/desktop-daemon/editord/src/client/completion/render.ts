/**
 * Rendering logic for the completion popup item list.
 *
 * Builds DOM elements for completion items and manages
 * the `data-selected` attribute for keyboard navigation.
 */

import { $ as h, } from '@monochromatic-dev/module-es/h-dom';

import type { CompletionItem, } from '../../../protocol.ts';

/**
 * Creates DOM elements for a list of completion items.
 * The first item is marked as selected by default.
 *
 * @param items - completion items to render
 *
 * @returns array of item div elements
 */
export function renderItems({ items, }: { items: CompletionItem[]; },): HTMLDivElement[] {
  return items.map(function createItemElement(item, index,) {
    const el = h({ tag: 'div', class: 'item', },);
    el.textContent = item.label;
    if (item.detail !== '')
      el.append(h({ tag: 'span', class: 'detail', text: item.detail, },),);
    if (index === 0)
      el.dataset.selected = '';
    return el;
  },);
}

/**
 * Updates the `data-selected` attribute on list children.
 *
 * @param list - container element with item children
 *
 * @param selectedIndex - index of the item to select
 */
export function updateSelection(
  { list, selectedIndex, }: { list: HTMLElement; selectedIndex: number; },
): void {
  const { children, } = list;
  for (let i = 0; i < children.length; i++) {
    const child = children[i];
    if (child instanceof HTMLElement) {
      if (i === selectedIndex) {
        child.dataset.selected = '';
        child.scrollIntoView({ block: 'nearest', },);
      }
      else {
        delete child.dataset.selected;
      }
    }
  }
}
