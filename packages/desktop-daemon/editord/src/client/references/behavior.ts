/**
 * Behavior helpers for the references popup component.
 *
 * Provides anchor management, item rendering, and selection
 * update functions used by the ReferencesPopup class.
 */

import { $ as h, } from '@monochromatic-dev/module-es/h-dom';

import type { ReferenceLocation, } from './types.ts';

/**
 * Creates the invisible anchor div used for CSS anchor positioning.
 *
 * @returns fixed-position anchor div
 */
export function createReferenceAnchor(): HTMLDivElement {
  const anchor = document.createElement('div',);
  anchor.style.setProperty('position', 'fixed',);
  anchor.style.setProperty('anchor-name', '--ref-anchor',);
  anchor.style.setProperty('inline-size', '2px',);
  anchor.style.setProperty('pointer-events', 'none',);
  anchor.style.setProperty('z-index', '9999',);
  return anchor;
}

/**
 * Positions the anchor div at the editor cursor location.
 *
 * @param anchor - anchor div to position
 *
 * @param x - horizontal viewport coordinate (pixels)
 *
 * @param y - top of the editor cursor (pixels)
 *
 * @param cursorHeight - height of the editor cursor (pixels)
 */
export function positionAnchor({ anchor, x, y, cursorHeight, }: {
  anchor: HTMLDivElement; x: number; y: number; cursorHeight: number;
}): void {
  anchor.style.setProperty('inset-inline-start', `${x}px`,);
  anchor.style.setProperty('inset-block-start', `${y}px`,);
  anchor.style.setProperty('block-size', `${cursorHeight}px`,);
}

/**
 * Renders reference location items as DOM elements.
 *
 * @param locations - reference locations to render
 *
 * @returns array of item div elements
 */
export function renderReferenceItems({ locations, }: { locations: ReferenceLocation[] }): HTMLElement[] {
  return locations.map(function renderItem(loc, index,) {
    const item = h({ tag: 'div', class: 'item', },);
    item.append(
      h({ tag: 'span', class: 'item-path', text: loc.label, },),
      h({ tag: 'span', class: 'line-num', text: `:${String(loc.line + 1,)}`, },),
    );
    /** Without dataset: prefer-dom-node-dataset lint error for setAttribute on data- attributes. */
    if (index === 0) item.dataset.selected = '';
    return item;
  },);
}

/**
 * Updates the selected item visual state in the list.
 *
 * @param list - list container div
 *
 * @param selectedIndex - index of the newly selected item
 */
export function updateItemSelection({ list, selectedIndex, }: {
  list: HTMLDivElement; selectedIndex: number;
}): void {
  /** Without querySelectorAll: unsafe type assertion from Element to HTMLElement on children. */
  const items = list.querySelectorAll<HTMLElement>('.item',);
  for (const [i, item,] of [...items,].entries()) {
    if (i === selectedIndex) { item.dataset.selected = ''; item.scrollIntoView({ block: 'nearest', },); }
    else delete item.dataset.selected;
  }
}

/**
 * Computes the next selected index after a navigation step.
 *
 * @param current - current selected index
 *
 * @param total - total number of items
 *
 * @param direction - navigation direction
 *
 * @returns new selected index (wraps around)
 */
export function computeNextIndex({ current, total, direction, }: {
  current: number; total: number; direction: 'up' | 'down';
}): number {
  if (direction === 'up') {
    return current <= 0 ? total - 1 : current - 1;
  }
  return current >= total - 1 ? 0 : current + 1;
}
