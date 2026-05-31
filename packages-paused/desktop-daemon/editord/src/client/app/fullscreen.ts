/**
 * Fullscreen floating action button for editord.
 *
 * Adds a FAB at the bottom-left corner that enters fullscreen
 * and locks the keyboard to capture browser-reserved shortcuts.
 * The FAB hides while fullscreen is active and reappears on exit.
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/API/Element/requestFullscreen
 */

import {
  enterFullscreenAndLock,
  lockKeyboard,
} from '../keybinding/keyboard-lock.ts';
import {
  l,
  tagged,
} from '../log.ts';

/**
 * Tagged logger for fullscreen module.
 */
const fsLog = tagged({
  tag: 'fullscreen',
  l,
},);

/**
 * Fullscreen expand icon as inline SVG.
 * Four outward-pointing arrows representing the fullscreen action.
 */
const FULLSCREEN_ICON_SVG =
  `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M21 8V5a2 2 0 0 0-2-2h-3"/><path d="M3 16v3a2 2 0 0 0 2 2h3"/><path d="M16 21h3a2 2 0 0 0 2-2v-3"/></svg>`;

/**
 * Creates the fullscreen FAB and appends it to the app container.
 * The button enters fullscreen + keyboard lock on click, hides while
 * fullscreen is active, and reappears when fullscreen is exited.
 *
 * @param appElement - root app container to append the FAB to
 *
 * @example
 * ```ts
 * wireFullscreen({ appElement: appRoot, });
 * ```
 */
export function wireFullscreen({ appElement, }: { readonly appElement: HTMLElement; },): void {
  /**
   * Floating action button that enters fullscreen + keyboard lock when clicked.
   */
  const fab = document.createElement('button',);
  fab.type = 'button';
  fab.className = 'fullscreen-fab';
  fab.innerHTML = FULLSCREEN_ICON_SVG;
  fab.title = 'Enter fullscreen (enables Ctrl+W)';

  fab.addEventListener(
    'click',
    function handleFabClick(): void {
      void enterFullscreenAndLock();
    },
  );

  appElement.append(fab,);

  document.addEventListener(
    'fullscreenchange',
    function handleFullscreenChange(): void {
      if (document.fullscreenElement
        !== null) {
        fsLog.info('fullscreen active',);
        fab.style
          .display = 'none';
        void lockKeyboard();
      }
      else {
        fsLog.info('fullscreen exited',);
        fab.style
          .display = '';
      }
    },
  );
}
