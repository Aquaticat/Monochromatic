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
  /** Current locale's translation accessors. */
  const ll = LL();
  /** Active save record, source of the log entries to render. */
  const save = getActiveSave();
  /** Persona display name, used to label persona lines. */
  const ruka = getCharacterName('ruka',);
  /** Log entries from the active save, defaulting to empty when none. */
  const entries = save?.log ?? [];
  /** Rendered row nodes, or an empty-state placeholder when no entries. */
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
  /** Outer screen container with header and the rendered rows. */
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
