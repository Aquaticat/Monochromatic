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

/** Renders one row inside the saves list. */
function renderRow(summary: SaveSummary,): HTMLElement {
  const ll = LL();
  return el(
    'div',
    { class: 'row', },
    [
      el(
        'span',
        { class: 'speaker-name', },
        [summary.label,],
      ),
      el(
        'span',
        { class: 'muted', },
        [
          new Date(summary.updatedAt,)
            .toLocaleString(),
        ],
      ),
      el(
        'button',
        {
          'data-variant': 'primary',
          onclick: function onClick(): void {
            const data = loadSave(summary.id,);
            if (data !== undefined)
              navigate('lecture',);
          },
        },
        [ll.loadSave(),],
      ),
      el(
        'button',
        {
          'data-variant': 'ghost',
          onclick: function onClick(): void {
            const ok = globalThis.confirm(
              `${ll.deleteSave()}: ${summary.label}?`,
            );
            if (ok) {
              deleteSave(summary.id,);
              navigate('saves',);
            }
          },
        },
        [ll.deleteSave(),],
      ),
    ],
  );
}

/** Mounts the saves screen. */
function mount(root: HTMLElement,): void {
  const ll = LL();
  const saves = getSaves();
  const rows = saves.length === 0
    ? [
      el(
        'p',
        { class: 'muted', },
        [ll.noSaves(),],
      ),
    ]
    : saves.map(renderRow,);
  const screen = el(
    'section',
    {
      class: 'screen',
      'data-screen': 'saves',
    },
    [
      el(
        'header',
        { class: 'row', },
        [
          el(
            'button',
            {
              'data-variant': 'ghost',
              onclick: function go(): void {
                navigate('menu',);
              },
            },
            [ll.back(),],
          ),
          el(
            'h2',
            {},
            [ll.saves(),],
          ),
        ],
      ),
      ...rows,
    ],
  );
  root.append(screen,);
}

/** Registers the saves screen. */
export function registerSaves(): void {
  registerScreen(
    'saves',
    { mount, },
  );
}
