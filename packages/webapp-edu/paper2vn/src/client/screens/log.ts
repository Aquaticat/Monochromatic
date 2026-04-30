/**
 * Memory-log screen.
 *
 * Read-only scrollable list of every persona / user line in the
 * active save. Closing returns to the lecture screen.
 */
import { el, } from '../dom.ts';
import { LL, } from '../i18n/runtime.ts';
import {
  navigate,
  registerScreen,
} from '../router.ts';
import { getCharacterName, } from '../sprite-pack.ts';
import { getActiveSave, } from '../state.ts';

/** Mounts the log screen. */
function mount(root: HTMLElement,): void {
  const ll = LL();
  const save = getActiveSave();
  const ruka = getCharacterName('ruka',);
  const entries = save?.log ?? [];
  const rows = entries.length === 0
    ? [
      el(
        'p',
        { class: 'muted', },
        [ll.noLog(),],
      ),
    ]
    : entries.map(function toRow(entry,): HTMLElement {
      return el(
        'div',
        { class: 'log-entry', },
        [
          el(
            'div',
            { class: 'speaker-name', },
            [
              entry.speaker === 'persona' ? ruka : ll.speakerYou(),
            ],
          ),
          el(
            'div',
            { class: 'dialogue-text', },
            [entry.text,],
          ),
        ],
      );
    },);
  const screen = el(
    'section',
    {
      class: 'screen log-pane',
      'data-screen': 'log',
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
                navigate('lecture',);
              },
            },
            [ll.back(),],
          ),
          el(
            'h2',
            {},
            [ll.memoryLog(),],
          ),
        ],
      ),
      ...rows,
    ],
  );
  root.append(screen,);
}

/** Registers the log screen. */
export function registerLog(): void {
  registerScreen(
    'log',
    { mount, },
  );
}
