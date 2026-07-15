/**
 * Saves screen.
 *
 * Lists every save slot in the index. Loading a slot navigates to
 * the lecture screen at the saved chapter/beat. Deleting confirms
 * with a `window.confirm` to keep the build dependency-free.
 */
import { el, } from '../dom.ts';
import { LL, } from '../i18n/runtime.ts';
import {
  navigate,
  registerScreen,
} from '../router.ts';
import {
  deleteSave,
  getSaves,
  loadSave,
} from '../state.ts';
import type { SaveSummary, } from '../types.ts';

/**
 * Navigation handler for the back button: routes back to the menu.
 */
function goBackToMenu(): void {
  navigate('menu',);
}

/**
 * Renders one row inside the saves list.
 *
 * @param summary - save-slot metadata used to label the row
 *
 * @returns the rendered row element with load and delete actions wired up
 */
function renderRow(summary: Readonly<SaveSummary>,): HTMLElement {
  /**
   * Current locale's translation accessors.
   */
  // oxlint-disable-next-line new-cap -- typesafe-i18n exports the accessor as LL by convention.
  const ll = LL();
  return el({
    tag: 'div',
    attrs: { class: 'row', },
    children: [
      el({
        tag: 'span',
        attrs: { class: 'speaker-name', },
        children: [summary.label,],
      },),
      el({
        tag: 'span',
        attrs: { class: 'muted', },
        children: [
          new Date(summary.updatedAt,)
            .toLocaleString(),
        ],
      },),
      el({
        tag: 'button',
        attrs: {
          'data-variant': 'primary',
          onclick: function onClick(): void {
            /**
             * Loaded save record, `undefined` when the slot is gone.
             */
            const data = loadSave(summary.id,);
            if (data !== undefined)
              navigate('lecture',);
          },
        },
        children: [ll.loadSave(),],
      },),
      el({
        tag: 'button',
        attrs: {
          'data-variant': 'ghost',
          onclick: function onClick(): void {
            /*
             * `globalThis.confirm` is the simplest cross-frame confirmation
             * surface; the build is dependency-free and a custom modal would
             * pull in framework code for a single yes/no prompt. The lint
             * rule's intent is to avoid blocking dialogs in production app
             * flows, but a delete confirmation on a local save list is the
             * canonical case where a synchronous prompt is appropriate.
             */
            /* oxlint-disable no-alert -- intentional confirmation for a destructive local-save delete; documented above. */
            /**
             * User confirmation result for the destructive delete action.
             */
            const ok = globalThis.confirm(
              `${ll.deleteSave()}: ${summary.label}?`,
            );
            /* oxlint-enable no-alert */
            if (ok) {
              deleteSave(summary.id,);
              navigate('saves',);
            }
          },
        },
        children: [ll.deleteSave(),],
      },),
    ],
  },);
}

/**
 * Mounts the saves screen.
 *
 * @param root - host element the screen mounts into
 */
function mount(root: HTMLElement,): void {
  /**
   * Current locale's translation accessors.
   */
  // oxlint-disable-next-line new-cap -- typesafe-i18n exports the accessor as LL by convention.
  const ll = LL();
  /**
   * Index of every save slot, source of the rendered rows.
   */
  const saves = getSaves();
  /**
   * Rendered row nodes, or an empty-state placeholder when no saves exist.
   */
  const rows = saves.length
    === 0
    ? [
      el({
        tag: 'p',
        attrs: { class: 'muted', },
        children: [ll.noSaves(),],
      },),
    ]
    : saves.map(function renderEachRow(summary: Readonly<SaveSummary>,): HTMLElement {
      return renderRow(summary,);
    },);
  /**
   * Outer screen container with header and the rendered rows.
   */
  const screen = el({
    tag: 'section',
    attrs: {
      class: 'screen',
      'data-screen': 'saves',
    },
    children: [
      el({
        tag: 'header',
        attrs: { class: 'row', },
        children: [
          el({
            tag: 'button',
            attrs: {
              'data-variant': 'ghost',
              onclick: goBackToMenu,
            },
            children: [ll.back(),],
          },),
          el({
            tag: 'h2',
            attrs: {},
            children: [ll.saves(),],
          },),
        ],
      },),
      ...rows,
    ],
  },);
  root.append(screen,);
}

/**
 * Registers the saves screen with the router.
 *
 * @example
 * ```ts
 * registerSaves();
 * navigate('saves');
 * ```
 */
export function registerSaves(): void {
  registerScreen({
    id: 'saves',
    module: { mount, },
  },);
}
