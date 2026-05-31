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
import type { LogEntry, } from '../types.ts';

/**
 * Navigation handler for the back button: routes to the lecture screen.
 */
function goBackToLecture(): void {
  navigate('lecture',);
}

/**
 * Mounts the log screen.
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
   * Active save record, source of the log entries to render.
   */
  const save = getActiveSave();
  /**
   * Persona display name, used to label persona lines.
   */
  const ruka = getCharacterName('ruka',);
  /**
   * Log entries from the active save, defaulting to empty when none.
   */
  const entries = save?.log
    ?? [];
  /**
   * Rendered row nodes, or an empty-state placeholder when no entries.
   */
  const rows = entries.length
    === 0
    ? [
      el({
        tag: 'p',
        attrs: { class: 'muted', },
        children: [ll.noLog(),],
      },),
    ]
    : entries.map(function toRow(entry: Readonly<LogEntry>,): HTMLElement {
      return el({
        tag: 'div',
        attrs: { class: 'log-entry', },
        children: [
          el({
            tag: 'div',
            attrs: { class: 'speaker-name', },
            children: [
              entry.speaker
                === 'persona' ? ruka : ll.speakerYou(),
            ],
          },),
          el({
            tag: 'div',
            attrs: { class: 'dialogue-text', },
            children: [entry.text,],
          },),
        ],
      },);
    },);
  /**
   * Outer screen container with header and the rendered rows.
   */
  const screen = el({
    tag: 'section',
    attrs: {
      class: 'screen log-pane',
      'data-screen': 'log',
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
              onclick: goBackToLecture,
            },
            children: [ll.back(),],
          },),
          el({
            tag: 'h2',
            attrs: {},
            children: [ll.memoryLog(),],
          },),
        ],
      },),
      ...rows,
    ],
  },);
  root.append(screen,);
}

/**
 * Registers the log screen with the router.
 *
 * @example
 * ```ts
 * registerLog();
 * navigate('log');
 * ```
 */
export function registerLog(): void {
  registerScreen({
    id: 'log',
    module: { mount, },
  },);
}
