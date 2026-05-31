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

/**
 * Navigation handler for the Start button: routes to topic selection.
 */
function goToSelectTopic(): void {
  navigate('select-topic',);
}

/**
 * Navigation handler for the Saves button: routes to save list.
 */
function goToSaves(): void {
  navigate('saves',);
}

/**
 * Navigation handler for the Settings button: routes to settings screen.
 */
function goToSettings(): void {
  navigate('settings',);
}

/**
 * Mounts the menu into `root`.
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
   * Left-rail navigation block with start, saves, and settings entries.
   */
  const menu = el({
    tag: 'nav',
    attrs: { class: 'menu', },
    children: [
      el({
        tag: 'h1',
        attrs: {},
        children: [ll.appName(),],
      },),
      el({
        tag: 'button',
        attrs: {
          'data-variant': 'primary',
          onclick: goToSelectTopic,
        },
        children: [ll.start(),],
      },),
      el({
        tag: 'button',
        attrs: {
          onclick: goToSaves,
        },
        children: [ll.saves(),],
      },),
      el({
        tag: 'button',
        attrs: {
          onclick: goToSettings,
        },
        children: [ll.settings(),],
      },),
    ],
  },);
  /**
   * Ruka portrait shown alongside the menu so the landing screen has a face.
   */
  const portrait = el({
    tag: 'img',
    attrs: {
      src: getCharacterPose({
        characterId: 'ruka',
        pose: 'happy',
      },),
      alt: '',
      style: 'block-size: min(70dvb, 30rem); inline-size: auto; align-self: center;',
    },
  },);
  /**
   * Outer screen container the router toggles via the `data-screen` selector.
   */
  const screen = el({
    tag: 'section',
    attrs: {
      class: 'screen',
      'data-screen': 'menu',
    },
    children: [
      menu,
      portrait,
    ],
  },);
  root.append(screen,);
}

/**
 * Registers the menu screen with the router.
 *
 * @example
 * ```ts
 * registerMenu();
 * navigate('menu');
 * ```
 */
export function registerMenu(): void {
  registerScreen({
    id: 'menu',
    module: { mount, },
  },);
}
