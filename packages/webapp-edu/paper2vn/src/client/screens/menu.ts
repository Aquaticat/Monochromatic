/**
 * Main-menu screen.
 *
 * Mirrors the original's left-rail entries: Start, Saves, Settings,
 * About. Each entry navigates to a sibling screen.
 */
import { el, } from '../dom.ts';
import { LL, } from '../i18n/runtime.ts';
import {
  navigate,
  registerScreen,
} from '../router.ts';
import { getCharacterPose, } from '../sprite-pack.ts';

/** Mounts the menu into `root`. */
function mount(root: HTMLElement,): void {
  /** Current locale's translation accessors. */
  const ll = LL();
  /** Left-rail navigation block with start, saves, and settings entries. */
  const menu = el(
    'nav',
    { class: 'menu', },
    [
      el(
        'h1',
        {},
        [ll.appName(),],
      ),
      el(
        'button',
        {
          'data-variant': 'primary',
          onclick: function go(): void {
            navigate('select-topic',);
          },
        },
        [ll.start(),],
      ),
      el(
        'button',
        {
          onclick: function go(): void {
            navigate('saves',);
          },
        },
        [ll.saves(),],
      ),
      el(
        'button',
        {
          onclick: function go(): void {
            navigate('settings',);
          },
        },
        [ll.settings(),],
      ),
    ],
  );
  /** Ruka portrait shown alongside the menu so the landing screen has a face. */
  const portrait = el(
    'img',
    {
      src: getCharacterPose(
        'ruka',
        'happy',
      ),
      alt: '',
      style: 'block-size: min(70dvb, 30rem); inline-size: auto; align-self: center;',
    },
  );
  /** Outer screen container the router toggles via the `data-screen` selector. */
  const screen = el(
    'section',
    {
      class: 'screen',
      'data-screen': 'menu',
    },
    [
      menu,
      portrait,
    ],
  );
  root.append(screen,);
}

/** Registers the menu screen with the router. */
export function registerMenu(): void {
  registerScreen(
    'menu',
    { mount, },
  );
}
